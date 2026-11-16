using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;

namespace Topo
{
    // Mise à jour de l'appli Windows : le nouveau « Topo.exe » est téléchargé depuis GitHub (release
    // « windows-derniere-version »), mis à la place de celui qui tourne, puis relancé.
    // Windows permet de renommer un programme en marche : l'ancien devient « Topo.exe.ancien », effacé au lancement suivant.
    public static class MiseAJour
    {
        const string DEBUT_AUTORISE = "https://github.com/MaxXx39/app-topo/releases/download/";

        // Seulement un fichier .exe des « Releases » du dépôt de l'appli, en https.
        public static bool AdresseAutorisee(string adresse)
        {
            return adresse != null && adresse.StartsWith(DEBUT_AUTORISE, StringComparison.Ordinal) &&
                adresse.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && adresse.IndexOf("..", StringComparison.Ordinal) < 0;
        }

        static string CheminDuProgramme() { return Assembly.GetEntryAssembly().Location; }

        // Au lancement : efface l'ancienne version laissée par la dernière mise à jour.
        public static void Nettoyer()
        {
            try
            {
                string chemin = CheminDuProgramme();
                foreach (string reste in new[] { chemin + ".ancien", chemin + ".nouveau" }) if (File.Exists(reste)) File.Delete(reste);
            }
            catch (Exception) { /* fichier encore utilisé : on réessaiera au prochain lancement */ }
        }

        // Télécharge et installe ; renvoie null si tout va bien (le nouveau programme est lancé, il reste à fermer
        // celui-ci), sinon la raison de l'échec (rien n'a été changé).
        public static string Installer(string adresse)
        {
            if (!AdresseAutorisee(adresse)) return "adresse de mise à jour refusée";
            string chemin = CheminDuProgramme();
            string nouveau = chemin + ".nouveau";
            string ancien = chemin + ".ancien";
            try
            {
                using (var client = new WebClient()) client.DownloadFile(adresse, nouveau);
                // Vérification simple : un vrai programme Windows commence par « MZ » et fait plus de 1 Mo.
                var infos = new FileInfo(nouveau);
                bool programme;
                using (FileStream flux = File.OpenRead(nouveau)) programme = flux.ReadByte() == 'M' && flux.ReadByte() == 'Z';
                if (!programme || infos.Length < 1000000)
                {
                    File.Delete(nouveau);
                    return "fichier téléchargé incomplet";
                }
                if (File.Exists(ancien)) File.Delete(ancien);
                File.Move(chemin, ancien);
                try { File.Move(nouveau, chemin); }
                catch (Exception) { File.Move(ancien, chemin); throw; } // on remet l'ancien en place
                Process.Start(new ProcessStartInfo(chemin) { UseShellExecute = true });
                return null;
            }
            catch (WebException erreur)
            {
                return "téléchargement impossible (" + erreur.Message + ")";
            }
            catch (UnauthorizedAccessException)
            {
                return "Windows refuse d'écrire dans le dossier de Topo.exe : déplacez Topo.exe sur le Bureau ou dans Documents";
            }
            catch (Exception erreur)
            {
                return erreur.Message;
            }
        }
    }
}
