using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace TestRecepteur
{
    // Où en est la réception des corrections (affiché par la fenêtre).
    public class EtatNtrip
    {
        public string Etat;      // "arrete", "connexion", "recoit", "attente" (nouvel essai bientôt) ou "erreur" (arrêté)
        public string Message;
        public long Octets;      // octets de corrections reçus depuis le démarrage
        public EtatNtrip(string etat, string message, long octets = 0) { Etat = etat; Message = message; Octets = octets; }
    }

    // Client NTRIP (même logique que ClientNtrip.kt de l'APK) : se connecte au serveur, envoie la GGA du récepteur
    // (au début puis toutes les 10 s) et passe chaque paquet de corrections reçu à surCorrections (écrit vers le
    // récepteur par le port COM). En cas de coupure, il se reconnecte tout seul après 5 s ; refusé pour de bon
    // (mot de passe, point de montage), il s'arrête et le dit. Tout se passe dans un fil séparé.
    public class ClientNtrip
    {
        readonly Func<string> ggaActuelle;
        readonly Action<byte[]> surCorrections;
        readonly Action<EtatNtrip> surEtat;
        const int IntervalleGgaMs = 10000;
        const int AttenteReconnexionMs = 5000;
        const int DelaiConnexionMs = 10000;

        volatile int numero;                 // numéro de la session en cours (une ancienne s'arrête d'elle-même)
        TcpClient prise;
        readonly object verrou = new object();
        long octetsTotal;

        public ClientNtrip(Func<string> ggaActuelle, Action<byte[]> surCorrections, Action<EtatNtrip> surEtat)
        {
            this.ggaActuelle = ggaActuelle;
            this.surCorrections = surCorrections;
            this.surEtat = surEtat;
        }

        public void Demarrer(ReglagesNtrip reglages)
        {
            Arreter();
            int monNumero = ++numero;
            string manque = reglages.Manque();
            if (manque != null) { surEtat(new EtatNtrip("erreur", manque)); return; }
            octetsTotal = 0;
            var fil = new Thread(() => Boucle(reglages, monNumero)) { IsBackground = true, Name = "corrections-ntrip" };
            fil.Start();
        }

        public void Arreter()
        {
            numero++;
            Fermer();
            surEtat(new EtatNtrip("arrete", "Corrections arrêtées", octetsTotal));
        }

        bool Actif(int monNumero) { return monNumero == numero; }

        void Boucle(ReglagesNtrip r, int monNumero)
        {
            while (Actif(monNumero))
            {
                surEtat(new EtatNtrip("connexion", "Connexion à " + r.Hote + "…", octetsTotal));
                try
                {
                    var socket = new TcpClient();
                    lock (verrou) { prise = socket; }
                    var connexion = socket.BeginConnect(r.Hote.Trim(), r.Port, null, null);
                    if (!connexion.AsyncWaitHandle.WaitOne(DelaiConnexionMs)) throw new IOException("le serveur ne répond pas");
                    socket.EndConnect(connexion);
                    NetworkStream flux = socket.GetStream();
                    flux.ReadTimeout = 1000;

                    byte[] requete = Encoding.GetEncoding("ISO-8859-1").GetBytes(Ntrip.Requete(r));
                    flux.Write(requete, 0, requete.Length);
                    flux.Flush();

                    string premiere = LireLigne(flux, monNumero);
                    if (premiere == null) throw new IOException("le serveur n'a pas répondu");
                    var entetes = new List<string>();
                    // En NTRIP 1, « ICY 200 OK » peut être suivi directement des données : en-têtes seulement en HTTP.
                    if (premiere.StartsWith("HTTP") || premiere.StartsWith("SOURCETABLE"))
                    {
                        while (true)
                        {
                            string l = LireLigne(flux, monNumero);
                            if (string.IsNullOrEmpty(l)) break;
                            entetes.Add(l);
                        }
                    }
                    ReponseNtrip reponse = Ntrip.LireReponse(premiere, entetes);
                    if (!reponse.Acceptee)
                    {
                        if (reponse.Definitif)
                        {
                            Fermer();
                            if (Actif(monNumero)) surEtat(new EtatNtrip("erreur", reponse.Raison, octetsTotal));
                            return;
                        }
                        throw new IOException(reponse.Raison);
                    }

                    Remonteur remonteur = reponse.Decoupe ? new Remonteur() : null;
                    surEtat(new EtatNtrip("connexion", "Connecté, en attente des corrections…", octetsTotal));
                    DateTime prochaineGga = DateTime.MinValue;
                    var tampon = new byte[4096];
                    bool recoit = false;
                    while (Actif(monNumero))
                    {
                        // Position du récepteur : au début, puis régulièrement.
                        if (DateTime.UtcNow >= prochaineGga)
                        {
                            string gga = Ntrip.GgaPourServeur(ggaActuelle());
                            if (gga != null)
                            {
                                byte[] g = Encoding.ASCII.GetBytes(gga);
                                flux.Write(g, 0, g.Length);
                                flux.Flush();
                                prochaineGga = DateTime.UtcNow.AddMilliseconds(IntervalleGgaMs);
                            }
                        }
                        int lus;
                        try { lus = flux.Read(tampon, 0, tampon.Length); }
                        catch (IOException ex) when (EstDelai(ex)) { continue; }
                        if (lus <= 0) throw new IOException("connexion fermée par le serveur");
                        byte[] utiles = remonteur != null ? remonteur.Ajouter(tampon, lus) : Copie(tampon, lus);
                        if (utiles.Length == 0) continue;
                        surCorrections(utiles);
                        octetsTotal += utiles.Length;
                        if (!recoit) { recoit = true; }
                        surEtat(new EtatNtrip("recoit", "Corrections reçues", octetsTotal));
                    }
                }
                catch (Exception ex)
                {
                    if (!Actif(monNumero)) return;
                    surEtat(new EtatNtrip("attente", TexteErreur(ex) + " : nouvel essai dans " + (AttenteReconnexionMs / 1000) + " s", octetsTotal));
                }
                finally
                {
                    Fermer();
                }
                // Pause avant de réessayer (interrompue si la session est arrêtée).
                DateTime fin = DateTime.UtcNow.AddMilliseconds(AttenteReconnexionMs);
                while (Actif(monNumero) && DateTime.UtcNow < fin) Thread.Sleep(100);
            }
        }

        // Une ligne de texte de la réponse du serveur (sans CR LF), ou null si la connexion se ferme.
        string LireLigne(NetworkStream flux, int monNumero)
        {
            var ligne = new StringBuilder();
            DateTime debut = DateTime.UtcNow;
            while (Actif(monNumero))
            {
                int c;
                try { c = flux.ReadByte(); }
                catch (IOException ex) when (EstDelai(ex))
                {
                    if ((DateTime.UtcNow - debut).TotalMilliseconds > DelaiConnexionMs) throw new IOException("le serveur ne répond pas");
                    continue;
                }
                if (c < 0) return ligne.Length == 0 ? null : ligne.ToString();
                if (c == '\n') return ligne.ToString().TrimEnd('\r');
                ligne.Append((char)c);
                if (ligne.Length > 1000) throw new IOException("réponse illisible du serveur");
            }
            return null;
        }

        static bool EstDelai(IOException ex)
        {
            var se = ex.InnerException as SocketException;
            return se != null && se.SocketErrorCode == SocketError.TimedOut;
        }

        static byte[] Copie(byte[] source, int n)
        {
            var c = new byte[n];
            Buffer.BlockCopy(source, 0, c, 0, n);
            return c;
        }

        static string TexteErreur(Exception ex)
        {
            var se = ex as SocketException ?? ex.InnerException as SocketException;
            if (se != null)
            {
                if (se.SocketErrorCode == SocketError.HostNotFound || se.SocketErrorCode == SocketError.TryAgain)
                    return "serveur introuvable (adresse ? internet ?)";
                if (se.SocketErrorCode == SocketError.ConnectionRefused) return "connexion impossible au serveur";
                if (se.SocketErrorCode == SocketError.TimedOut) return "le serveur ne répond pas";
            }
            return string.IsNullOrEmpty(ex.Message) ? "erreur de connexion" : ex.Message;
        }

        void Fermer()
        {
            lock (verrou)
            {
                try { if (prise != null) prise.Close(); }
                catch (Exception) { /* déjà fermée */ }
                prise = null;
            }
        }
    }
}
