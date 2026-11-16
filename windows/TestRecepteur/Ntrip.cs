using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace TestRecepteur
{
    // Corrections RTK par internet (NTRIP version 1) : même logique que l'APK (android/noyau/…/ntrip/Ntrip.kt).
    // Requête du genre « GET /<point de montage> » avec identifiant et mot de passe ; le serveur répond
    // « ICY 200 OK » (ou « HTTP/1.x 200 OK ») puis envoie les corrections (RTCM) sans fin.
    // Le récepteur renvoie sa position (GGA) régulièrement : le réseau calcule les corrections pour l'endroit où il est.

    public class ReglagesNtrip
    {
        public string Hote = "";
        public int Port = 2101;
        public string PointDeMontage = "";
        public string Utilisateur = "";
        public string MotDePasse = "";

        // Ce qui manque pour se connecter (texte à afficher), ou null si tout est rempli.
        public string Manque()
        {
            if (string.IsNullOrWhiteSpace(Hote)) return "adresse du serveur manquante";
            if (Port < 1 || Port > 65535) return "port invalide";
            if (string.IsNullOrWhiteSpace(PointDeMontage)) return "point de montage manquant";
            if (string.IsNullOrWhiteSpace(Utilisateur)) return "identifiant manquant";
            if (string.IsNullOrEmpty(MotDePasse)) return "mot de passe manquant";
            return null;
        }
    }

    public class ReponseNtrip
    {
        public bool Acceptee;
        public bool Decoupe;      // corrections envoyées par morceaux (« chunked »)
        public string Raison;     // si refusée
        public bool Definitif;    // refus définitif : inutile de réessayer tout seul
    }

    public static class Ntrip
    {
        // Texte de la requête envoyée au serveur, lignes terminées par CR LF.
        public static string Requete(ReglagesNtrip r, string logiciel = "Topo")
        {
            string identifiants = Convert.ToBase64String(Encoding.UTF8.GetBytes(r.Utilisateur + ":" + r.MotDePasse));
            string montage = r.PointDeMontage.Trim();
            if (montage.StartsWith("/")) montage = montage.Substring(1);
            return string.Join("\r\n", new[]
            {
                "GET /" + montage + " HTTP/1.0",
                "Host: " + r.Hote.Trim() + ":" + r.Port,
                "User-Agent: NTRIP " + logiciel,
                "Accept: */*",
                "Authorization: Basic " + identifiants,
                "Connection: close",
                "",
                "",
            });
        }

        // Lit la réponse du serveur : première ligne (« ICY 200 OK », « HTTP/1.1 401 Unauthorized »,
        // « SOURCETABLE 200 OK »…) et lignes d'en-tête qui suivent.
        public static ReponseNtrip LireReponse(string premiereLigne, IList<string> entetes)
        {
            string ligne = (premiereLigne ?? "").Trim();
            if (ligne.StartsWith("SOURCETABLE"))
                return Refus("point de montage inconnu sur ce serveur", true);
            Match m = Regex.Match(ligne, @"^(ICY|HTTP/\d\.\d)\s+(\d{3})");
            if (!m.Success)
                return Refus("réponse inattendue du serveur : « " + Court(ligne) + " »", false);
            switch (int.Parse(m.Groups[2].Value))
            {
                case 200:
                    bool decoupe = entetes != null && entetes.Any(e => e.ToLowerInvariant().Replace(" ", "").StartsWith("transfer-encoding:chunked"));
                    return new ReponseNtrip { Acceptee = true, Decoupe = decoupe };
                case 401: return Refus("identifiant ou mot de passe refusé", true);
                case 403: return Refus("accès refusé par le serveur (abonnement ? connexion déjà utilisée ?)", false);
                case 404: return Refus("point de montage inconnu sur ce serveur", true);
                default: return Refus("le serveur a répondu « " + Court(ligne) + " »", false);
            }
        }

        static ReponseNtrip Refus(string raison, bool definitif)
        {
            return new ReponseNtrip { Acceptee = false, Raison = raison, Definitif = definitif };
        }

        static string Court(string t)
        {
            return t.Length > 60 ? t.Substring(0, 60) : t;
        }

        // Phrase GGA prête à envoyer au serveur (terminée par CR LF), ou null si ce n'est pas une GGA.
        public static string GgaPourServeur(string ligne)
        {
            if (ligne == null) return null;
            string propre = ligne.Trim();
            // « $GNGGA, », « $GPGGA, »… : le type est en 4e à 7e position.
            if (!propre.StartsWith("$") || propre.Length < 7 || propre.Substring(3, 4) != "GGA,") return null;
            return propre + "\r\n";
        }
    }

    // Remet bout à bout des données envoyées « par morceaux » (HTTP chunked : taille en hexadécimal sur une
    // ligne, puis le morceau, puis CR LF). Les octets arrivent dans n'importe quel découpage.
    public class Remonteur
    {
        int resteDuMorceau;                          // octets du morceau en cours encore à recevoir
        readonly StringBuilder tailleLue = new StringBuilder();
        int aSauter;                                 // CR LF après un morceau

        public byte[] Ajouter(byte[] octets, int nombre)
        {
            var sortie = new MemoryStream();
            int i = 0;
            while (i < nombre)
            {
                if (aSauter > 0) { aSauter--; i++; }
                else if (resteDuMorceau > 0)
                {
                    int n = Math.Min(resteDuMorceau, nombre - i);
                    sortie.Write(octets, i, n);
                    resteDuMorceau -= n;
                    i += n;
                    if (resteDuMorceau == 0) aSauter = 2;
                }
                else
                {
                    char c = (char)octets[i];
                    i++;
                    if (c == '\n')
                    {
                        string t = tailleLue.ToString();
                        int pointVirgule = t.IndexOf(';');
                        if (pointVirgule >= 0) t = t.Substring(0, pointVirgule);
                        int taille;
                        resteDuMorceau = int.TryParse(t.Trim(), System.Globalization.NumberStyles.HexNumber,
                            System.Globalization.CultureInfo.InvariantCulture, out taille) ? taille : 0;
                        tailleLue.Clear();
                    }
                    else if (c != '\r') tailleLue.Append(c);
                }
            }
            return sortie.ToArray();
        }
    }
}
