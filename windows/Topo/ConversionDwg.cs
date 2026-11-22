using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Topo
{
    // Plans DWG dans Topo Bureau (0.280.0, calage de plans ; décision du 22.11) : conversion DWG -> DXF par
    // ODA File Converter, programme gratuit installé sur le PC de l'utilisateur (Topo ne le contient pas).
    // - ODA est cherché dans « C:\Program Files\ODA\ODAFileConverter*\ODAFileConverter.exe » (la version la plus
    //   récente), ou au chemin du réglage « oda_chemin » de reglages.json.
    // - Les fichiers choisis sont copiés dans un dossier de travail, ODA les convertit tous d'un coup en DXF 2018.
    // - Xrefs : dans chaque DXF obtenu, les blocs « référence externe » donnent le nom du fichier ; s'il n'a pas été
    //   choisi mais se trouve à côté du plan (ou au chemin écrit dans le plan), il est converti aussi (3 niveaux au plus).
    public static class ConversionDwg
    {
        public const int DELAI_MS = 180000; // 3 minutes au plus pour une conversion

        // Chemin de ODAFileConverter.exe, ou null s'il n'est pas installé. reglage : chemin forcé (facultatif).
        public static string TrouverOda(string reglage, IEnumerable<string> dossiersProgrammes)
        {
            if (!string.IsNullOrEmpty(reglage) && File.Exists(reglage)) return reglage;
            foreach (string racine in dossiersProgrammes)
            {
                if (string.IsNullOrEmpty(racine)) continue;
                string oda = Path.Combine(racine, "ODA");
                if (!Directory.Exists(oda)) continue;
                // Plusieurs versions installées : la plus récente (le nom contient le numéro de version).
                foreach (string dossier in Directory.GetDirectories(oda, "ODAFileConverter*").OrderByDescending(d => d, StringComparer.OrdinalIgnoreCase))
                {
                    string exe = Path.Combine(dossier, "ODAFileConverter.exe");
                    if (File.Exists(exe)) return exe;
                }
            }
            return null;
        }

        // Arguments d'ODA File Converter : dossier d'entrée, dossier de sortie, version, type, récursif, contrôle, filtre.
        public static string Arguments(string entree, string sortie)
        {
            return "\"" + entree + "\" \"" + sortie + "\" \"ACAD2018\" \"DXF\" \"0\" \"1\" \"*.DWG\"";
        }

        // Chemins des xrefs écrits dans un DXF : blocs (section BLOCKS) dont le drapeau 70 a le bit 4, chemin en code 1.
        public static List<string> XrefsDuDxf(string texte)
        {
            var chemins = new List<string>();
            if (string.IsNullOrEmpty(texte)) return chemins;
            string[] lignes = texte.Split('\n');
            bool dansBlocs = false;
            bool dansBloc = false;
            int drapeau = 0;
            string chemin = null;
            for (int i = 0; i + 1 < lignes.Length; i += 2)
            {
                string code = lignes[i].Trim();
                string valeur = lignes[i + 1].Trim();
                if (code == "0")
                {
                    if (dansBloc && (drapeau & 4) != 0 && !string.IsNullOrEmpty(chemin)) chemins.Add(chemin);
                    dansBloc = false;
                    if (valeur == "SECTION") { dansBlocs = false; continue; }
                    if (valeur == "ENDSEC") { dansBlocs = false; continue; }
                    if (dansBlocs && valeur == "BLOCK") { dansBloc = true; drapeau = 0; chemin = null; }
                }
                else if (code == "2" && i >= 2 && lignes[i - 1].Trim() == "SECTION") dansBlocs = valeur == "BLOCKS";
                else if (dansBloc && code == "70") int.TryParse(valeur, out drapeau);
                else if (dansBloc && code == "1") chemin = valeur;
            }
            return chemins;
        }

        // Nom du fichier d'un xref, sans dossier : marche avec les chemins Windows « ..\Archi\Murs.dwg ».
        public static string NomDuFichier(string chemin)
        {
            int barre = Math.Max(chemin.LastIndexOf('\\'), chemin.LastIndexOf('/'));
            return barre >= 0 ? chemin.Substring(barre + 1) : chemin;
        }

        // Fichier d'un xref sur le disque : le chemin écrit (absolu ou relatif au plan), puis le même nom à côté du
        // plan, en .dwg ou en .dxf. null s'il n'est nulle part.
        public static string ChercherXref(string chemin, string dossierPlan)
        {
            var candidats = new List<string>();
            try
            {
                if (Path.IsPathRooted(chemin)) candidats.Add(chemin);
                else candidats.Add(Path.GetFullPath(Path.Combine(dossierPlan, chemin)));
            }
            catch (Exception) { /* chemin bizarre : on essaie le nom seul */ }
            string nom = NomDuFichier(chemin);
            candidats.Add(Path.Combine(dossierPlan, nom));
            string sansExtension = Path.GetFileNameWithoutExtension(nom);
            candidats.Add(Path.Combine(dossierPlan, sansExtension + ".dwg"));
            candidats.Add(Path.Combine(dossierPlan, sansExtension + ".dxf"));
            foreach (string c in candidats) if (File.Exists(c)) return c;
            return null;
        }

        // Résultat : nom du fichier (DXF) -> octets ; xrefsTrouves : xrefs ajoutés tout seuls (trouvés à côté du plan).
        public class Resultat
        {
            public readonly List<KeyValuePair<string, byte[]>> Fichiers = new List<KeyValuePair<string, byte[]>>();
            public readonly List<string> XrefsTrouves = new List<string>();
        }

        // Convertit les fichiers choisis (DWG ou DXF) et les xrefs trouvés à côté. Lance une exception claire en cas d'échec.
        public static Resultat Convertir(IList<string> choisis, string oda)
        {
            string travail = Path.Combine(Path.GetTempPath(), "TopoBureau-dwg", Guid.NewGuid().ToString("N"));
            var resultat = new Resultat();
            var faits = new HashSet<string>(StringComparer.OrdinalIgnoreCase); // noms sans extension déjà là
            var aFaire = choisis.Select(c => new KeyValuePair<string, bool>(c, false)).ToList();
            try
            {
                for (int niveau = 0; niveau < 4 && aFaire.Count > 0; niveau++)
                {
                    string entree = Path.Combine(travail, "entree" + niveau);
                    string sortie = Path.Combine(travail, "sortie" + niveau);
                    Directory.CreateDirectory(entree);
                    Directory.CreateDirectory(sortie);
                    var dossiers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); // nom -> dossier d'origine
                    var lus = new List<KeyValuePair<string, string>>(); // nom DXF -> texte (pour chercher ses xrefs)
                    bool unDwg = false;
                    foreach (var f in aFaire)
                    {
                        string nom = Path.GetFileName(f.Key);
                        string base_ = Path.GetFileNameWithoutExtension(nom);
                        if (!faits.Add(base_)) continue;
                        dossiers[base_] = Path.GetDirectoryName(f.Key);
                        if (f.Value) resultat.XrefsTrouves.Add(nom);
                        if (string.Equals(Path.GetExtension(nom), ".dxf", StringComparison.OrdinalIgnoreCase))
                        {
                            byte[] octets = File.ReadAllBytes(f.Key);
                            resultat.Fichiers.Add(new KeyValuePair<string, byte[]>(nom, octets));
                            lus.Add(new KeyValuePair<string, string>(base_, Encoding.UTF8.GetString(octets)));
                        }
                        else
                        {
                            File.Copy(f.Key, Path.Combine(entree, nom), true);
                            unDwg = true;
                        }
                    }
                    if (unDwg)
                    {
                        if (oda == null) throw new InvalidOperationException("ODA File Converter introuvable : installez-le (gratuit, site de l'Open Design Alliance), ou réglez « oda_chemin » dans reglages.json. En attendant : enregistrez le plan en DXF.");
                        LancerOda(oda, entree, sortie);
                        foreach (string dxf in Directory.GetFiles(sortie, "*.dxf"))
                        {
                            byte[] octets = File.ReadAllBytes(dxf);
                            string base_ = Path.GetFileNameWithoutExtension(dxf);
                            resultat.Fichiers.Add(new KeyValuePair<string, byte[]>(base_ + ".dxf", octets));
                            lus.Add(new KeyValuePair<string, string>(base_, Encoding.UTF8.GetString(octets)));
                        }
                        foreach (string dwg in Directory.GetFiles(entree, "*.dwg"))
                        {
                            string base_ = Path.GetFileNameWithoutExtension(dwg);
                            if (!File.Exists(Path.Combine(sortie, base_ + ".dxf"))) throw new InvalidOperationException("ODA n'a pas pu convertir « " + Path.GetFileName(dwg) + " » (fichier abîmé ou version trop récente ?).");
                        }
                    }
                    // Xrefs de ces fichiers, à chercher à côté du plan.
                    aFaire = new List<KeyValuePair<string, bool>>();
                    foreach (var lu in lus)
                    {
                        string dossier;
                        if (!dossiers.TryGetValue(lu.Key, out dossier)) continue;
                        foreach (string xref in XrefsDuDxf(lu.Value))
                        {
                            if (faits.Contains(Path.GetFileNameWithoutExtension(NomDuFichier(xref)))) continue;
                            string trouve = ChercherXref(xref, dossier);
                            if (trouve != null && !aFaire.Any(a => string.Equals(a.Key, trouve, StringComparison.OrdinalIgnoreCase))) aFaire.Add(new KeyValuePair<string, bool>(trouve, true));
                        }
                    }
                }
                return resultat;
            }
            finally
            {
                try { Directory.Delete(travail, true); } catch (Exception) { /* dossier temporaire : tant pis */ }
            }
        }

        static void LancerOda(string oda, string entree, string sortie)
        {
            var info = new ProcessStartInfo(oda, Arguments(entree, sortie))
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            using (Process p = Process.Start(info))
            {
                if (p == null) throw new InvalidOperationException("ODA File Converter n'a pas démarré.");
                if (!p.WaitForExit(DELAI_MS))
                {
                    try { p.Kill(); } catch (Exception) { /* déjà fini */ }
                    throw new InvalidOperationException("ODA File Converter n'a pas fini en 3 minutes.");
                }
            }
        }
    }
}
