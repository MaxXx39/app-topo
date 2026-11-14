using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Topo
{
    // Réglages gardés sur cette tablette Windows (jamais dans le projet) : dernier récepteur, corrections NTRIP,
    // connexion Drive. Fichier : %LOCALAPPDATA%\Topo\reglages.json.
    // Les secrets (mot de passe NTRIP, accès Drive) sont chiffrés par Windows pour cet utilisateur de la tablette :
    // le fichier copié sur un autre ordinateur ne les livre pas.
    public class Reglages
    {
        readonly string chemin;
        readonly Dictionary<string, object> valeurs;
        readonly object verrou = new object();

        public Reglages(string dossier)
        {
            chemin = Path.Combine(dossier, "reglages.json");
            Dictionary<string, object> lues = null;
            try { if (File.Exists(chemin)) lues = Json.LireObjet(File.ReadAllText(chemin, Encoding.UTF8)); }
            catch (Exception) { /* fichier illisible : on repart de réglages vides */ }
            valeurs = lues ?? new Dictionary<string, object>();
        }

        // Dossier des données de l'appli sur cette tablette (créé au besoin).
        public static string DossierDonnees()
        {
            string dossier = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Topo");
            Directory.CreateDirectory(dossier);
            return dossier;
        }

        public string Texte(string cle, string defaut = null)
        {
            lock (verrou)
            {
                object v;
                return valeurs.TryGetValue(cle, out v) && v is string ? (string)v : defaut;
            }
        }

        public int Entier(string cle, int defaut) { lock (verrou) return Json.Entier(valeurs, cle, defaut); }

        public bool Vrai(string cle) { lock (verrou) return Json.Vrai(valeurs, cle); }

        public void Ecrire(string cle, object valeur)
        {
            lock (verrou)
            {
                if (valeur == null) valeurs.Remove(cle); else valeurs[cle] = valeur;
                Enregistrer();
            }
        }

        // Secret : gardé chiffré (texte base64 illisible dans le fichier).
        public string Secret(string cle)
        {
            string chiffre = Texte(cle);
            if (string.IsNullOrEmpty(chiffre)) return "";
            try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(chiffre), null, DataProtectionScope.CurrentUser)); }
            catch (Exception) { return ""; } // autre utilisateur, fichier abîmé : comme s'il n'y avait rien
        }

        public void EcrireSecret(string cle, string valeur)
        {
            if (string.IsNullOrEmpty(valeur)) { Ecrire(cle, null); return; }
            Ecrire(cle, Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(valeur), null, DataProtectionScope.CurrentUser)));
        }

        void Enregistrer()
        {
            try
            {
                // Écrit à côté puis remplace : une coupure de courant ne laisse jamais un fichier à moitié écrit.
                string provisoire = chemin + ".tmp";
                File.WriteAllText(provisoire, Json.Ecrire(valeurs), Encoding.UTF8);
                if (File.Exists(chemin)) File.Replace(provisoire, chemin, null); else File.Move(provisoire, chemin);
            }
            catch (Exception) { /* disque plein ou protégé : les réglages restent valables jusqu'à la fermeture */ }
        }
    }
}
