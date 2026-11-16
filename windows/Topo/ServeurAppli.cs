using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;

namespace Topo
{
    // Sert à la fenêtre les fichiers de l'appli web rangés DANS le .exe (archive « appli.zip » fabriquée par
    // « npm run build:windows »), à l'adresse https://topo.appli/app-topo/ : cette adresse ne part jamais sur
    // internet, la fenêtre nous demande chaque fichier. Même rôle que ServeurAppli.kt de l'APK.
    // ATTENTION : ne jamais changer cette adresse : les projets enregistrés sur la tablette (IndexedDB) y sont liés.
    public class ServeurAppli
    {
        public const string HOTE = "topo.appli";
        public const string DOSSIER = "/app-topo/";
        public const string ADRESSE_ACCUEIL = "https://" + HOTE + DOSSIER;

        readonly Dictionary<string, byte[]> fichiers = new Dictionary<string, byte[]>(StringComparer.Ordinal);

        // Lit toute l'archive en mémoire (quelques Mo).
        public ServeurAppli(Stream archive)
        {
            using (var zip = new ZipArchive(archive, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entree in zip.Entries)
                {
                    if (entree.FullName.EndsWith("/")) continue; // dossier
                    using (Stream flux = entree.Open())
                    using (var memoire = new MemoryStream())
                    {
                        flux.CopyTo(memoire);
                        fichiers[entree.FullName.Replace('\\', '/')] = memoire.ToArray();
                    }
                }
            }
        }

        public int NombreDeFichiers { get { return fichiers.Count; } }

        // Contenu du fichier demandé à « adresse », ou null s'il n'existe pas.
        public byte[] Contenu(string adresse, out string type)
        {
            type = null;
            string chemin = CheminDuFichier(adresse);
            byte[] octets;
            if (chemin == null || !fichiers.TryGetValue(chemin, out octets)) return null;
            type = TypeDuFichier(chemin);
            return octets;
        }

        // « https://topo.appli/app-topo/assets/a.js?v=2 » -> « assets/a.js » ; null si ce n'est pas un fichier de l'appli.
        public static string CheminDuFichier(string adresse)
        {
            Uri uri;
            if (!Uri.TryCreate(adresse, UriKind.Absolute, out uri)) return null;
            if (uri.Scheme != "https" || !string.Equals(uri.Host, HOTE, StringComparison.OrdinalIgnoreCase)) return null;
            string chemin = Uri.UnescapeDataString(uri.AbsolutePath);
            if (!chemin.StartsWith(DOSSIER, StringComparison.Ordinal)) return null;
            chemin = chemin.Substring(DOSSIER.Length);
            if (chemin.Length == 0 || chemin.EndsWith("/")) chemin += "index.html";
            return chemin;
        }

        // Type du fichier d'après son extension (le navigateur en a besoin, surtout pour les modules .js).
        public static string TypeDuFichier(string nom)
        {
            int point = nom.LastIndexOf('.');
            switch (point < 0 ? "" : nom.Substring(point + 1).ToLowerInvariant())
            {
                case "html": return "text/html";
                case "js":
                case "mjs": return "text/javascript";
                case "css": return "text/css";
                case "json":
                case "webmanifest": return "application/json";
                case "svg": return "image/svg+xml";
                case "png": return "image/png";
                case "jpg":
                case "jpeg": return "image/jpeg";
                case "wasm": return "application/wasm";
                case "woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }
    }
}
