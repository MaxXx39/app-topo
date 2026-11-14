using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace Topo
{
    // Point d'entrée de l'appli Windows « Topo.exe ».
    // Tout est rangé DANS ce seul fichier .exe (appli web, géoïde, bibliothèque WebView2) : rien à installer à côté,
    // et une mise à jour = remplacer un fichier.
    static class Programme
    {
        [STAThread]
        static void Main()
        {
            // Les bibliothèques WebView2 sont dans le .exe : on les donne à .NET quand il les cherche.
            AppDomain.CurrentDomain.AssemblyResolve += (expediteur, e) =>
            {
                string nom = new AssemblyName(e.Name).Name + ".dll";
                using (Stream flux = Ressources.Ouvrir(nom))
                {
                    if (flux == null) return null;
                    using (var memoire = new MemoryStream())
                    {
                        flux.CopyTo(memoire);
                        return Assembly.Load(memoire.ToArray());
                    }
                }
            };

            // Une seule fenêtre Topo à la fois (deux fenêtres se disputeraient le récepteur et les projets).
            bool premiere;
            using (var verrou = new Mutex(true, "Topo-appli-windows", out premiere))
            {
                if (!premiere)
                {
                    MessageBox.Show("Topo est déjà ouvert.", "Topo", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                // Connexions https modernes (Google, GitHub).
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (expediteur, e) => Signaler(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (expediteur, e) => Signaler(e.ExceptionObject as Exception);
                MiseAJour.Nettoyer();
                Lancer();
            }
        }

        // À part de Main : la fenêtre utilise WebView2, qui ne doit être cherché qu'après la mise en place ci-dessus.
        [MethodImpl(MethodImplOptions.NoInlining)]
        static void Lancer()
        {
            Application.Run(new Fenetre());
        }

        // Erreur imprévue : notée dans un fichier (pour la retrouver) et montrée, au lieu d'une fermeture muette.
        static void Signaler(Exception erreur)
        {
            string texte = erreur == null ? "erreur inconnue" : erreur.ToString();
            try { File.AppendAllText(Path.Combine(Reglages.DossierDonnees(), "erreurs.txt"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\r\n" + texte + "\r\n\r\n", Encoding.UTF8); }
            catch (Exception) { /* disque plein : le message suffit */ }
            MessageBox.Show("Erreur imprévue dans Topo :\r\n" + (erreur == null ? texte : erreur.Message) +
                "\r\n\r\n(Détail noté dans le fichier erreurs.txt du dossier Topo.)", "Topo", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    // Fichiers rangés dans le .exe (voir Topo.csproj, « EmbeddedResource »).
    public static class Ressources
    {
        public static Stream Ouvrir(string nom)
        {
            return typeof(Ressources).Assembly.GetManifestResourceStream(nom);
        }

        public static string Texte(string nom)
        {
            using (Stream flux = Ouvrir(nom))
            {
                if (flux == null) return null;
                using (var lecteur = new StreamReader(flux, Encoding.UTF8)) return lecteur.ReadToEnd();
            }
        }

        // Icône de la fenêtre : celle du .exe.
        public static Icon Icone()
        {
            try { return Icon.ExtractAssociatedIcon(typeof(Ressources).Assembly.Location); }
            catch (Exception) { return SystemIcons.Application; }
        }

        // WebView2 a besoin d'un petit fichier « WebView2Loader.dll » posé sur le disque : on le sort du .exe
        // (une fois par version) dans le dossier des données, et on renvoie ce dossier.
        public static string DossierDuChargeur(string dossierDonnees)
        {
            string architecture = IntPtr.Size == 8 ? "x64" : "x86";
            string dossier = Path.Combine(dossierDonnees, "chargeur", architecture);
            string chemin = Path.Combine(dossier, "WebView2Loader.dll");
            using (Stream flux = Ouvrir(architecture + ".WebView2Loader.dll"))
            {
                if (flux == null) throw new InvalidOperationException("WebView2Loader manque dans ce .exe (fabrication incomplète)");
                if (!File.Exists(chemin) || new FileInfo(chemin).Length != flux.Length)
                {
                    Directory.CreateDirectory(dossier);
                    using (FileStream sortie = File.Create(chemin)) flux.CopyTo(sortie);
                }
            }
            return dossier;
        }
    }
}
