using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace Topo
{
    // Connexion à Google Drive sous Windows (même Drive que l'APK : accès « drive.file », seulement les fichiers
    // créés par l'appli). Méthode officielle de Google pour un programme d'ordinateur :
    //  1. la première fois, la page de connexion Google s'ouvre dans le navigateur de la tablette (Edge) ;
    //  2. Google renvoie un code à ce programme, sur une adresse locale (127.0.0.1) qui ne sort pas de la tablette ;
    //  3. le programme échange ce code contre un accès, et garde de quoi le renouveler tout seul
    //     (chiffré par Windows, voir Reglages.Secret) : plus aucune fenêtre ensuite.
    // L'identifiant « Application de bureau » du projet Google Cloud est mis dans le .exe à la fabrication
    // (secrets GitHub GOOGLE_BUREAU_ID et GOOGLE_BUREAU_SECRET) ; il n'est jamais écrit dans le dépôt.
    public class Drive
    {
        const string PORTEE = "https://www.googleapis.com/auth/drive.file";
        const string ADRESSE_CONNEXION = "https://accounts.google.com/o/oauth2/v2/auth";
        const string ADRESSE_JETON = "https://oauth2.googleapis.com/token";
        const string CLE_RENOUVELLEMENT = "drive_renouvellement";
        const int DELAI_CONNEXION_MS = 110000;   // la page attend 2 minutes au plus

        readonly Reglages reglages;
        readonly string idClient, secretClient;
        readonly object verrou = new object();
        string jeton;                 // dernier accès reçu
        long finValiditeMs;
        bool enCours;

        public Drive(Reglages reglages, string idClient, string secretClient)
        {
            this.reglages = reglages;
            this.idClient = (idClient ?? "").Trim();
            this.secretClient = (secretClient ?? "").Trim();
        }

        public bool Regle { get { return idClient.Length > 0 && secretClient.Length > 0; } }

        // Demande un accès ; « reponse(jeton, raison) » est appelée une fois (jeton null = échec, avec la raison).
        // renouveler : l'accès précédent a été refusé par Google, il en faut un nouveau.
        public void DemanderJeton(bool renouveler, Action<string, string> reponse)
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                lock (verrou)
                {
                    if (enCours) { reponse(null, "connexion Google déjà en cours"); return; }
                    enCours = true;
                }
                try
                {
                    reponse(ObtenirJeton(renouveler), null);
                }
                catch (Exception erreur)
                {
                    reponse(null, erreur.Message);
                }
                finally
                {
                    lock (verrou) enCours = false;
                }
            });
        }

        string ObtenirJeton(bool renouveler)
        {
            if (!Regle) throw new Exception("Drive n'est pas encore réglé pour Windows (identifiant Google « bureau » absent de ce .exe)");
            if (!renouveler && jeton != null && Horloge.Ms() < finValiditeMs) return jeton;

            // Renouvellement sans fenêtre, avec ce qui a été gardé à la première connexion.
            string renouvellement = reglages.Secret(CLE_RENOUVELLEMENT);
            if (renouvellement.Length > 0)
            {
                Dictionary<string, object> r = Demander(new Dictionary<string, string>
                {
                    { "client_id", idClient }, { "client_secret", secretClient },
                    { "refresh_token", renouvellement }, { "grant_type", "refresh_token" },
                });
                if (Json.Texte(r, "access_token").Length > 0) return Garder(r);
                // « invalid_grant » : accès retiré ou expiré (7 jours tant que l'appli Google est « en test ») : on se reconnecte.
                if (Json.Texte(r, "error") != "invalid_grant") throw new Exception("Google refuse l'accès : " + TexteErreur(r));
                reglages.EcrireSecret(CLE_RENOUVELLEMENT, null);
            }
            return ConnexionParNavigateur();
        }

        // Première connexion : page Google dans le navigateur, retour du code sur 127.0.0.1.
        string ConnexionParNavigateur()
        {
            var ecoute = new TcpListener(IPAddress.Loopback, 0);
            ecoute.Start();
            try
            {
                int port = ((IPEndPoint)ecoute.LocalEndpoint).Port;
                string retour = "http://127.0.0.1:" + port;
                string verificateur = Aleatoire(48);
                string etat = Aleatoire(24);
                string adresse = ADRESSE_CONNEXION +
                    "?response_type=code" +
                    "&client_id=" + Uri.EscapeDataString(idClient) +
                    "&redirect_uri=" + Uri.EscapeDataString(retour) +
                    "&scope=" + Uri.EscapeDataString(PORTEE) +
                    "&state=" + etat +
                    "&code_challenge=" + DefiPkce(verificateur) +
                    "&code_challenge_method=S256";
                Process.Start(new ProcessStartInfo(adresse) { UseShellExecute = true });

                long fin = Horloge.Ms() + DELAI_CONNEXION_MS;
                while (Horloge.Ms() < fin)
                {
                    if (!ecoute.Pending()) { Thread.Sleep(100); continue; }
                    using (TcpClient client = ecoute.AcceptTcpClient())
                    {
                        Dictionary<string, string> parametres = ParametresDeLaRequete(LirePremiereLigne(client));
                        if (parametres.Count == 0) { Repondre(client, 404, ""); continue; } // icône du navigateur, etc.
                        if (!parametres.ContainsKey("state") || parametres["state"] != etat)
                        {
                            Repondre(client, 400, "Demande inconnue.");
                            continue;
                        }
                        if (!parametres.ContainsKey("code"))
                        {
                            Repondre(client, 200, "Connexion à Google refusée. Vous pouvez fermer cette page et revenir à Topo.");
                            string raison = parametres.ContainsKey("error") ? parametres["error"] : "aucun code reçu";
                            throw new Exception(raison == "access_denied" ? "connexion Google refusée" : "connexion Google impossible (" + raison + ")");
                        }
                        Repondre(client, 200, "Connexion à Google Drive réussie. Vous pouvez fermer cette page et revenir à Topo.");
                        Dictionary<string, object> r = Demander(new Dictionary<string, string>
                        {
                            { "client_id", idClient }, { "client_secret", secretClient },
                            { "code", parametres["code"] }, { "code_verifier", verificateur },
                            { "redirect_uri", retour }, { "grant_type", "authorization_code" },
                        });
                        if (Json.Texte(r, "access_token").Length == 0) throw new Exception("Google refuse l'accès : " + TexteErreur(r));
                        string renouvellement = Json.Texte(r, "refresh_token");
                        if (renouvellement.Length > 0) reglages.EcrireSecret(CLE_RENOUVELLEMENT, renouvellement);
                        return Garder(r);
                    }
                }
                throw new Exception("connexion Google non terminée (page fermée ?)");
            }
            finally
            {
                ecoute.Stop();
            }
        }

        // Garde l'accès reçu 2 minutes seulement (deux demandes de suite ne dérangent pas Google deux fois) :
        // la page garde elle-même son accès 50 minutes, et quand elle en redemande un, il doit être tout neuf.
        string Garder(Dictionary<string, object> reponse)
        {
            jeton = Json.Texte(reponse, "access_token");
            finValiditeMs = Horloge.Ms() + 120000;
            return jeton;
        }

        static string TexteErreur(Dictionary<string, object> r)
        {
            string description = Json.Texte(r, "error_description");
            return description.Length > 0 ? description : Json.Texte(r, "error", "réponse illisible");
        }

        // Envoie un formulaire à Google ; renvoie sa réponse (aussi quand c'est un refus).
        static Dictionary<string, object> Demander(Dictionary<string, string> champs)
        {
            var corps = new StringBuilder();
            foreach (var champ in champs)
            {
                if (corps.Length > 0) corps.Append('&');
                corps.Append(champ.Key).Append('=').Append(Uri.EscapeDataString(champ.Value));
            }
            byte[] octets = Encoding.UTF8.GetBytes(corps.ToString());
            var demande = (HttpWebRequest)WebRequest.Create(ADRESSE_JETON);
            demande.Method = "POST";
            demande.ContentType = "application/x-www-form-urlencoded";
            demande.Timeout = 20000;
            string texte;
            try
            {
                using (Stream flux = demande.GetRequestStream()) flux.Write(octets, 0, octets.Length);
                using (WebResponse reponse = demande.GetResponse()) texte = LireTout(reponse);
            }
            catch (WebException erreur)
            {
                if (erreur.Response == null) throw new Exception("Google injoignable (internet ?)");
                using (erreur.Response) texte = LireTout(erreur.Response);
            }
            Dictionary<string, object> objet = Json.LireObjet(texte);
            if (objet == null) throw new Exception("réponse illisible de Google");
            return objet;
        }

        static string LireTout(WebResponse reponse)
        {
            using (var lecteur = new StreamReader(reponse.GetResponseStream(), Encoding.UTF8)) return lecteur.ReadToEnd();
        }

        static string LirePremiereLigne(TcpClient client)
        {
            client.ReceiveTimeout = 5000;
            var ligne = new StringBuilder();
            try
            {
                NetworkStream flux = client.GetStream();
                while (ligne.Length < 8000)
                {
                    int c = flux.ReadByte();
                    if (c < 0 || c == '\n') break;
                    if (c != '\r') ligne.Append((char)c);
                }
            }
            catch (IOException) { /* navigateur parti : ligne incomplète, ignorée */ }
            return ligne.ToString();
        }

        static void Repondre(TcpClient client, int statut, string phrase)
        {
            try
            {
                string page = "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>Topo</title>" +
                    "<body style=\"font-family:Segoe UI,sans-serif;font-size:22px;margin:3em\">" + WebUtility.HtmlEncode(phrase) + "</body></html>";
                byte[] corps = Encoding.UTF8.GetBytes(page);
                byte[] entete = Encoding.ASCII.GetBytes("HTTP/1.1 " + statut + " OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + corps.Length + "\r\nConnection: close\r\n\r\n");
                NetworkStream flux = client.GetStream();
                flux.Write(entete, 0, entete.Length);
                flux.Write(corps, 0, corps.Length);
                flux.Flush();
            }
            catch (IOException) { /* navigateur parti */ }
        }

        // « GET /?code=…&state=… HTTP/1.1 » -> { code, state } ; vide si ce n'est pas le retour de Google.
        public static Dictionary<string, string> ParametresDeLaRequete(string premiereLigne)
        {
            var parametres = new Dictionary<string, string>();
            string[] mots = (premiereLigne ?? "").Split(' ');
            if (mots.Length < 2 || mots[0] != "GET") return parametres;
            int question = mots[1].IndexOf('?');
            if (question < 0 || !mots[1].StartsWith("/?")) return parametres;
            foreach (string paire in mots[1].Substring(question + 1).Split('&'))
            {
                int egal = paire.IndexOf('=');
                if (egal <= 0) continue;
                parametres[Uri.UnescapeDataString(paire.Substring(0, egal))] = Uri.UnescapeDataString(paire.Substring(egal + 1).Replace('+', ' '));
            }
            return parametres;
        }

        // Défi « PKCE » (norme RFC 7636) : empreinte SHA-256 du vérificateur, en base64 pour adresse internet.
        // Sert à ce que seul CE programme puisse échanger le code reçu.
        public static string DefiPkce(string verificateur)
        {
            using (SHA256 sha = SHA256.Create()) return Base64Url(sha.ComputeHash(Encoding.ASCII.GetBytes(verificateur)));
        }

        static string Aleatoire(int octets)
        {
            var hasard = new byte[octets];
            using (var generateur = new RNGCryptoServiceProvider()) generateur.GetBytes(hasard);
            return Base64Url(hasard);
        }

        static string Base64Url(byte[] octets)
        {
            return Convert.ToBase64String(octets).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
