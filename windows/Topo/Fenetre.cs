using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace Topo
{
    // Fenêtre unique de l'appli Windows. Elle montre l'appli web (la même que dans l'APK et sur le site, rangée
    // dans le .exe) dans une fenêtre de navigateur intégrée (WebView2, le moteur d'Edge), et fait pour elle ce
    // que la page ne sait pas faire : lire le récepteur GNSS (port COM), recevoir les corrections NTRIP,
    // enregistrer les exports, se connecter à Google Drive. Même rôle qu'EcranPrincipal.kt + PontAndroid.kt.
    public class Fenetre : Form
    {
        // Largeur « de référence » de l'écran, en points de l'appli web : le zoom est réglé pour que le grand côté
        // de l'écran en fasse autant, quelle que soit la tablette (comme la tablette Android : 1280 × 800).
        const double GRAND_COTE_REFERENCE = 1280.0;

        readonly string dossierDonnees;
        readonly Reglages reglages;
        readonly EtatRecepteur recepteur;
        readonly EtatRecepteur recepteur2;
        readonly PositionTablette positionTablette = new PositionTablette();
        readonly Drive drive;
        readonly WebView2 vue = new WebView2();
        readonly System.Windows.Forms.Timer minuterie = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer minuterieMessage = new System.Windows.Forms.Timer();
        readonly Label bulle = new Label();
        ServeurAppli serveur;
        CoreWebView2Environment environnement;
        GrilleGeoide grille;
        bool pageChargee;
        bool ecranGardeAllume;

        public Fenetre()
        {
            dossierDonnees = Reglages.DossierDonnees();
            reglages = new Reglages(dossierDonnees);
            recepteur = new EtatRecepteur(Grille);
            recepteur2 = new EtatRecepteur(Grille);
            string[] google = (Ressources.Texte("google-bureau.txt") ?? "").Split('\n');
            drive = new Drive(reglages, google.Length > 0 ? google[0] : "", google.Length > 1 ? google[1] : "");

            Text = "Topo " + Version();
            Icon = Ressources.Icone();
            BackColor = Color.FromArgb(0x1b, 0x2b, 0x36);
            MinimumSize = new Size(480, 360);
            // Plein écran (sans barre de titre ni barre des tâches), comme sur la tablette Android : tout l'écran
            // est pour l'appli. On la ferme par « Fermer l'appli » du menu. Touche F11 (clavier) : fenêtre normale.
            KeyPreview = true;
            pleinEcran = reglages.Texte("plein_ecran", "oui") != "non";
            AppliquerPleinEcran();

            vue.Dock = DockStyle.Fill;
            vue.DefaultBackgroundColor = Color.White;
            Controls.Add(vue);

            // Petit message en bas de la fenêtre (comme les messages courts d'Android).
            bulle.Visible = false;
            bulle.AutoSize = false;
            bulle.TextAlign = ContentAlignment.MiddleCenter;
            bulle.BackColor = Color.FromArgb(0x1b, 0x2b, 0x36);
            bulle.ForeColor = Color.White;
            bulle.Font = new Font("Segoe UI", 13f);
            Controls.Add(bulle);
            bulle.BringToFront();
            minuterieMessage.Tick += delegate { minuterieMessage.Stop(); bulle.Visible = false; };

            minuterie.Interval = 200;
            minuterie.Tick += delegate { EnvoyerEtat(); };

            Load += async delegate { await Demarrer(); };
            Resize += delegate { ReglerZoom(); PlacerBulle(); };
            FormClosing += delegate { Arreter(); };
        }

        bool pleinEcran;

        void AppliquerPleinEcran()
        {
            // L'ordre compte : sans bordure d'abord, puis agrandi, pour recouvrir aussi la barre des tâches.
            WindowState = FormWindowState.Normal;
            FormBorderStyle = pleinEcran ? FormBorderStyle.None : FormBorderStyle.Sizable;
            WindowState = FormWindowState.Maximized;
        }

        void BasculerPleinEcran()
        {
            pleinEcran = !pleinEcran;
            reglages.Ecrire("plein_ecran", pleinEcran ? "oui" : "non");
            AppliquerPleinEcran();
        }

        protected override bool ProcessCmdKey(ref Message message, Keys touche)
        {
            if (touche == Keys.F11) { BasculerPleinEcran(); return true; }
            return base.ProcessCmdKey(ref message, touche);
        }

        public static string Version()
        {
            return (Ressources.Texte("version.txt") ?? "").Trim();
        }

        // Grille du géoïde : chargée une seule fois, à la première conversion.
        GrilleGeoide Grille()
        {
            lock (positionTablette)
            {
                if (grille == null)
                {
                    using (Stream flux = Ressources.Ouvrir("chgeo2004_lhn95.grille"))
                    {
                        if (flux == null) throw new InvalidOperationException("fichier du géoïde CHGeo2004 introuvable dans l'appli");
                        grille = GrilleGeoide.Lire(flux);
                    }
                }
                return grille;
            }
        }

        // =====================================================================
        // Démarrage : navigateur intégré, appli web, pont
        // =====================================================================

        async Task Demarrer()
        {
            try
            {
                using (Stream archive = Ressources.Ouvrir("appli.zip"))
                {
                    if (archive == null) throw new InvalidOperationException("l'appli web manque dans ce .exe (fabrication incomplète)");
                    serveur = new ServeurAppli(archive);
                }
                CoreWebView2Environment.SetLoaderDllFolderPath(Ressources.DossierDuChargeur(dossierDonnees));
                environnement = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dossierDonnees, "WebView2"), null);
                await vue.EnsureCoreWebView2Async(environnement);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                DialogResult choix = MessageBox.Show(this,
                    "Il manque « Microsoft Edge WebView2 Runtime » sur cette tablette (le moteur qui affiche l'appli).\r\n\r\n" +
                    "Touchez OK pour ouvrir la page de téléchargement de Microsoft, installez-le, puis relancez Topo.",
                    "Topo", MessageBoxButtons.OKCancel, MessageBoxIcon.Information);
                if (choix == DialogResult.OK) OuvrirDehors("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                Close();
                return;
            }
            catch (Exception erreur)
            {
                MessageBox.Show(this, "Topo ne peut pas démarrer :\r\n" + erreur.Message, "Topo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            CoreWebView2 coeur = vue.CoreWebView2;
            CoreWebView2Settings s = coeur.Settings;
            s.AreDefaultContextMenusEnabled = false;   // l'appui long ne doit pas ouvrir le menu du navigateur
            s.IsStatusBarEnabled = false;
            s.IsPinchZoomEnabled = false;              // le plan a ses propres gestes à deux doigts
            s.IsSwipeNavigationEnabled = false;        // glisser depuis le bord ne doit pas « revenir en arrière »
            s.IsZoomControlEnabled = false;            // le zoom est réglé par l'appli (voir ReglerZoom)
            s.IsPasswordAutosaveEnabled = false;
            s.IsGeneralAutofillEnabled = false;

            // Les fichiers de l'appli web sont servis depuis le .exe.
            coeur.AddWebResourceRequestedFilter("https://" + ServeurAppli.HOTE + "/*", CoreWebView2WebResourceContext.All);
            coeur.WebResourceRequested += ServirFichier;
            coeur.WebMessageReceived += RecevoirMessage;
            coeur.NavigationStarting += (expediteur, e) =>
            {
                // Seule l'appli reste dans la fenêtre : un lien vers un autre site s'ouvre dans le navigateur.
                if (e.Uri.StartsWith(ServeurAppli.ADRESSE_ACCUEIL, StringComparison.OrdinalIgnoreCase) || e.Uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase)) return;
                e.Cancel = true;
                OuvrirDehors(e.Uri);
            };
            coeur.NewWindowRequested += (expediteur, e) =>
            {
                e.Handled = true;
                OuvrirDehors(e.Uri);
            };
            coeur.NavigationCompleted += (expediteur, e) =>
            {
                pageChargee = e.IsSuccess;
                if (!e.IsSuccess) return;
                ReglerZoom();
                EnvoyerReglagesCorrections(1);
                EnvoyerReglagesCorrections(2);
            };
            coeur.ProcessFailed += (expediteur, e) =>
            {
                // Le moteur d'affichage s'est arrêté (rare) : on recharge la page, les projets sont sur le disque.
                pageChargee = false;
                try { coeur.Navigate(ServeurAppli.ADRESSE_ACCUEIL); } catch (Exception) { /* la fenêtre se ferme */ }
            };

            // F11 tapé pendant que le clavier est dans la page.
            vue.KeyDown += (expediteur, e) => { if (e.KeyCode == Keys.F11) { e.Handled = true; BasculerPleinEcran(); } };

            await coeur.AddScriptToExecuteOnDocumentCreatedAsync(ScriptDuPont());
            coeur.Navigate(ServeurAppli.ADRESSE_ACCUEIL);

            // Essai à 2 récepteurs : le 2e reçoit une copie des corrections du 1er, ou a sa propre connexion.
            AppliquerModeCorrections2();
            // Corrections par internet laissées en marche la dernière fois : on les reprend.
            if (reglages.Vrai("ntrip1_actives"))
            {
                ReglagesNtrip r = ReglagesCorrections(1);
                if (r != null) recepteur.Corrections.Demarrer(r);
            }
            minuterie.Start();
        }

        // Le pont (pont-windows.js) avec ses valeurs de départ.
        string ScriptDuPont()
        {
            var depart = new Dictionary<string, object>
            {
                { "reglages1", ReglagesCorrectionsJson(1) },
                { "reglages2", ReglagesCorrectionsJson(2) },
                { "modele", ModeleAppareil() },
                { "version", Version() },
            };
            return (Ressources.Texte("pont-windows.js") ?? "").Replace("/*DEPART*/ {}", Json.Ecrire(depart));
        }

        void ServirFichier(object expediteur, CoreWebView2WebResourceRequestedEventArgs e)
        {
            string type;
            byte[] contenu = serveur.Contenu(e.Request.Uri, out type);
            if (contenu == null)
            {
                e.Response = environnement.CreateWebResourceResponse(new MemoryStream(new byte[0]), 404, "Not Found", "Content-Type: text/plain");
                return;
            }
            e.Response = environnement.CreateWebResourceResponse(new MemoryStream(contenu), 200, "OK",
                "Content-Type: " + type + (type.StartsWith("text/") || type == "application/json" ? "; charset=utf-8" : "") + "\r\nCache-Control: no-cache");
        }

        // Zoom de la page : le grand côté de la fenêtre vaut GRAND_COTE_REFERENCE points de l'appli web.
        // (Réglage « zoom_ecran » de reglages.json, en pour cent, pour forcer une autre valeur.)
        void ReglerZoom()
        {
            if (vue.CoreWebView2 == null || WindowState == FormWindowState.Minimized) return;
            double zoom;
            int force = reglages.Entier("zoom_ecran", 0);
            if (force >= 30 && force <= 300) zoom = force / 100.0;
            else
            {
                double echelleWindows = EchelleWindows();
                double grandCote = Math.Max(vue.ClientSize.Width, vue.ClientSize.Height);
                zoom = grandCote / (echelleWindows * GRAND_COTE_REFERENCE);
                zoom = Math.Max(0.5, Math.Min(2.0, zoom));
            }
            try { if (Math.Abs(vue.ZoomFactor - zoom) > 0.005) vue.ZoomFactor = zoom; }
            catch (Exception) { /* page pas encore prête */ }
        }

        // =====================================================================
        // Vers la page : état du récepteur 5 fois par seconde
        // =====================================================================

        void EnvoyerEtat()
        {
            if (pageChargee && vue.CoreWebView2 != null)
            {
                // Sans récepteur connecté : la position donnée par Windows (pour se localiser seulement).
                string tablette = "null";
                if (recepteur.Connecte) positionTablette.Arreter();
                else { positionTablette.Demarrer(); tablette = positionTablette.EnJson(); }
                string script = "window.__topoWindows&&window.__topoWindows.etat(" +
                    recepteur.EnJson(reglages.Texte("recepteur1_nom")) + "," +
                    Json.Ecrire(recepteur.PointEnJson()) + "," +
                    recepteur2.EnJson(reglages.Texte("recepteur2_nom")) + "," +
                    Json.Ecrire(ModeCorrections2()) + "," +
                    tablette + "," +
                    Json.Ecrire(recepteur.SuiteDuJournal()) + ")";
                Executer(script);
            }
            // Pendant la connexion au récepteur, l'écran reste allumé.
            bool garder = recepteur.Connecte || recepteur2.Connecte;
            if (garder != ecranGardeAllume)
            {
                ecranGardeAllume = garder;
                SetThreadExecutionState(garder ? ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED : ES_CONTINUOUS);
            }
        }

        // Exécute un petit script dans la page (depuis n'importe quel fil).
        void Executer(string script)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action(() => Executer(script))); } catch (Exception) { /* fenêtre fermée */ }
                return;
            }
            try { if (vue.CoreWebView2 != null) vue.CoreWebView2.ExecuteScriptAsync(script); }
            catch (Exception) { /* page en cours de rechargement */ }
        }

        void EnvoyerReglagesCorrections(int numero)
        {
            Executer("window.__topoWindows&&window.__topoWindows.reglages(" + numero + "," + Json.Ecrire(ReglagesCorrectionsJson(numero)) + ")");
        }

        // =====================================================================
        // Depuis la page : les fonctions de window.AppliAndroid (pont-windows.js)
        // =====================================================================

        void RecevoirMessage(object expediteur, CoreWebView2WebMessageReceivedEventArgs e)
        {
            // Seule l'appli rangée dans le .exe a le droit de donner des ordres.
            if (e.Source == null || !e.Source.StartsWith(ServeurAppli.ADRESSE_ACCUEIL, StringComparison.OrdinalIgnoreCase)) return;
            Dictionary<string, object> message = Json.LireObjet(e.WebMessageAsJson);
            if (message == null) return;
            var args = message.ContainsKey("args") ? message["args"] as List<object> : null;
            if (args == null) args = new List<object>();
            try
            {
                switch (Json.Texte(message, "fonction"))
                {
                    case "enregistrerFichier": EnregistrerFichier(Texte(args, 0), Texte(args, 2)); break;
                    case "partagerFichier": PartagerFichier(Texte(args, 0), Texte(args, 2), Texte(args, 3)); break;
                    case "choisirRecepteur": ChoisirRecepteur(1); break;
                    case "reconnecterRecepteur": ReconnecterRecepteur(); break;
                    case "deconnecterRecepteur": Deconnecter(1); break;
                    case "choisirRecepteur2": ChoisirRecepteur(2); break;
                    case "deconnecterRecepteur2": Deconnecter(2); break;
                    case "demarrerJournalNmea": recepteur.DemarrerJournal(Math.Max(5, Math.Min(300, Nombre(args, 0))) * 1000L); break;
                    case "demarrerCorrections": DemarrerCorrections(Texte(args, 0), 1); break;
                    case "arreterCorrections": ArreterCorrections(1); break;
                    case "demarrerCorrections2": DemarrerCorrections(Texte(args, 0), 2); break;
                    case "arreterCorrections2": ArreterCorrections(2); break;
                    case "choisirModeCorrections2":
                        reglages.Ecrire("ntrip2_mode", Texte(args, 0) == "ntrip" ? "ntrip" : "copie");
                        AppliquerModeCorrections2();
                        break;
                    case "demanderJetonDrive": DemanderJetonDrive(args.Count > 0 && args[0] is bool && (bool)args[0]); break;
                    case "fermerAppli": Close(); break;
                    case "ouvrirAnydesk": OuvrirAnydesk(); break;
                    case "lireAdresse": LireAdresse(Nombre(args, 0), Texte(args, 1)); break;
                    case "installerMiseAJour": InstallerMiseAJour(Texte(args, 0)); break;
                }
            }
            catch (Exception erreur)
            {
                Message("Erreur : " + erreur.Message);
            }
        }

        static string Texte(List<object> args, int rang) { return rang < args.Count && args[rang] is string ? (string)args[rang] : ""; }

        static int Nombre(List<object> args, int rang) { return rang < args.Count && args[rang] is double ? (int)(double)args[rang] : 0; }

        // =====================================================================
        // Récepteur GNSS : choix du port COM, connexion
        // =====================================================================

        EtatRecepteur Recepteur(int numero) { return numero == 2 ? recepteur2 : recepteur; }

        void ChoisirRecepteur(int numero)
        {
            using (var choix = new ChoixRecepteur(numero == 2 ? "Choisir le 2e récepteur" : "Choisir le récepteur"))
            {
                if (choix.ShowDialog(this) != DialogResult.OK || choix.Choisi == null) return;
                PortSerie p = choix.Choisi;
                if (numero == 2 && p.Port == reglages.Texte("recepteur1_port") && recepteur.Connecte)
                {
                    Message("C'est déjà le récepteur 1 : choisissez l'autre récepteur.");
                    return;
                }
                string nom = string.IsNullOrEmpty(p.Appareil) ? p.Port : p.Appareil;
                reglages.Ecrire("recepteur" + numero + "_port", p.Port);
                reglages.Ecrire("recepteur" + numero + "_nom", nom);
                Recepteur(numero).Liaison.Connecter(p.Port, nom);
            }
        }

        void ReconnecterRecepteur()
        {
            string port = reglages.Texte("recepteur1_port");
            if (string.IsNullOrEmpty(port)) { ChoisirRecepteur(1); return; }
            recepteur.Liaison.Connecter(port, reglages.Texte("recepteur1_nom", port));
        }

        void Deconnecter(int numero)
        {
            Recepteur(numero).Liaison.Deconnecter();
            Recepteur(numero).Oublier("non connecté");
        }

        // =====================================================================
        // Corrections RTK par internet (swipos) : réglages gardés sur cette tablette seulement
        // =====================================================================

        const int PORT_NTRIP = 2101;
        const string POINT_DE_MONTAGE_PROPOSE = "MSM_GISGEO_LV95LHN95";

        ReglagesNtrip ReglagesCorrections(int numero)
        {
            string p = "ntrip" + numero + "_";
            string hote = reglages.Texte(p + "hote");
            if (hote == null) return null;
            return new ReglagesNtrip
            {
                Hote = hote,
                Port = reglages.Entier(p + "port", PORT_NTRIP),
                PointDeMontage = reglages.Texte(p + "montage", ""),
                Utilisateur = reglages.Texte(p + "utilisateur", ""),
                MotDePasse = reglages.Secret(p + "motdepasse"),
            };
        }

        // Réglages pour la page (texte JSON) : le mot de passe lui-même ne quitte jamais ce programme.
        string ReglagesCorrectionsJson(int numero)
        {
            ReglagesNtrip r = ReglagesCorrections(numero);
            return Json.Ecrire(new Dictionary<string, object>
            {
                { "hote", r == null ? "" : r.Hote },
                { "port", r == null ? PORT_NTRIP : r.Port },
                { "pointDeMontage", r == null ? POINT_DE_MONTAGE_PROPOSE : r.PointDeMontage },
                { "utilisateur", r == null ? "" : r.Utilisateur },
                { "motDePasseEnregistre", r != null && r.MotDePasse.Length > 0 },
                { "actives", reglages.Vrai("ntrip" + numero + "_actives") },
            });
        }

        // Démarre les corrections avec les réglages tapés dans la page (mot de passe vide = garder l'ancien).
        void DemarrerCorrections(string texteJson, int numero)
        {
            Dictionary<string, object> lu = Json.LireObjet(texteJson);
            if (lu == null) { Message("Réglages des corrections illisibles."); return; }
            ReglagesNtrip ancien = ReglagesCorrections(numero);
            string motDePasse = Json.Texte(lu, "motDePasse");
            var r = new ReglagesNtrip
            {
                Hote = Json.Texte(lu, "hote").Trim(),
                Port = Json.Entier(lu, "port", PORT_NTRIP),
                PointDeMontage = Json.Texte(lu, "pointDeMontage").Trim(),
                Utilisateur = Json.Texte(lu, "utilisateur").Trim(),
                MotDePasse = motDePasse.Length > 0 ? motDePasse : (ancien == null ? "" : ancien.MotDePasse),
            };
            string p = "ntrip" + numero + "_";
            reglages.Ecrire(p + "hote", r.Hote);
            reglages.Ecrire(p + "port", r.Port);
            reglages.Ecrire(p + "montage", r.PointDeMontage);
            reglages.Ecrire(p + "utilisateur", r.Utilisateur);
            reglages.EcrireSecret(p + "motdepasse", r.MotDePasse);
            reglages.Ecrire(p + "actives", true);
            Recepteur(numero).Corrections.Demarrer(r);
            EnvoyerReglagesCorrections(numero);
        }

        void ArreterCorrections(int numero)
        {
            reglages.Ecrire("ntrip" + numero + "_actives", false);
            Recepteur(numero).Corrections.Arreter();
            EnvoyerReglagesCorrections(numero);
        }

        string ModeCorrections2() { return reglages.Texte("ntrip2_mode", "copie") == "ntrip" ? "ntrip" : "copie"; }

        // Copie : le 1er récepteur recopie ses corrections vers le 2e. 2e connexion : plus de copie.
        void AppliquerModeCorrections2()
        {
            if (ModeCorrections2() == "ntrip")
            {
                recepteur.CopieCorrections = null;
                if (reglages.Vrai("ntrip2_actives"))
                {
                    ReglagesNtrip r = ReglagesCorrections(2);
                    if (r != null) recepteur2.Corrections.Demarrer(r);
                }
            }
            else
            {
                recepteur2.Corrections.Arreter();
                recepteur.CopieCorrections = octets => recepteur2.Liaison.Ecrire(octets);
            }
        }

        // =====================================================================
        // Fichiers exportés
        // =====================================================================

        static byte[] Octets(string base64)
        {
            try { return Convert.FromBase64String(base64); }
            catch (FormatException) { return null; }
        }

        // Nom de fichier sans caractère interdit par Windows.
        static string NomPropre(string nom)
        {
            var s = new StringBuilder();
            foreach (char c in nom ?? "") s.Append(Array.IndexOf(Path.GetInvalidFileNameChars(), c) >= 0 ? '_' : c);
            string propre = s.ToString().Trim().TrimEnd('.');
            return propre.Length == 0 ? "export" : propre;
        }

        // Demande où enregistrer le fichier, puis l'écrit.
        void EnregistrerFichier(string nom, string contenuBase64)
        {
            byte[] contenu = Octets(contenuBase64);
            if (contenu == null) { Message("Export impossible : fichier mal transmis."); return; }
            string propre = NomPropre(nom);
            string extension = Path.GetExtension(propre);
            using (var fenetre = new SaveFileDialog())
            {
                fenetre.FileName = propre;
                fenetre.Title = "Enregistrer " + propre;
                fenetre.Filter = extension.Length > 1 ? "Fichier " + extension.Substring(1).ToUpperInvariant() + "|*" + extension + "|Tous les fichiers|*.*" : "Tous les fichiers|*.*";
                string dernier = reglages.Texte("dossier_exports");
                if (!string.IsNullOrEmpty(dernier) && Directory.Exists(dernier)) fenetre.InitialDirectory = dernier;
                if (fenetre.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    File.WriteAllBytes(fenetre.FileName, contenu);
                    reglages.Ecrire("dossier_exports", Path.GetDirectoryName(fenetre.FileName));
                    Message("Fichier enregistré.");
                }
                catch (Exception erreur)
                {
                    Message("Échec de l'enregistrement : " + erreur.Message);
                }
            }
        }

        // « Envoyer » : Windows n'a pas le partage d'Android. Le fichier est rangé dans Documents\Topo\Envois et
        // montré dans l'Explorateur ; avec une adresse, un nouveau mail s'ouvre (il reste à y glisser le fichier).
        void PartagerFichier(string nom, string contenuBase64, string adresse)
        {
            byte[] contenu = Octets(contenuBase64);
            if (contenu == null) { Message("Envoi impossible : fichier mal transmis."); return; }
            try
            {
                string dossier = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Topo", "Envois");
                Directory.CreateDirectory(dossier);
                string chemin = Path.Combine(dossier, NomPropre(nom));
                File.WriteAllBytes(chemin, contenu);
                Process.Start("explorer.exe", "/select,\"" + chemin + "\"");
                if (!string.IsNullOrWhiteSpace(adresse))
                {
                    OuvrirDehors("mailto:" + Uri.EscapeDataString(adresse.Trim()).Replace("%40", "@") + "?subject=" + Uri.EscapeDataString(Path.GetFileName(chemin)));
                    Message("Fichier prêt dans Documents › Topo › Envois : glissez-le dans le mail.");
                }
                else Message("Fichier prêt dans Documents › Topo › Envois.");
            }
            catch (Exception erreur)
            {
                Message("Envoi impossible : " + erreur.Message);
            }
        }

        // =====================================================================
        // Google Drive, cadastre, AnyDesk, mise à jour
        // =====================================================================

        void DemanderJetonDrive(bool renouveler)
        {
            drive.DemanderJeton(renouveler, (jeton, raison) =>
            {
                var reponse = new Dictionary<string, object>();
                reponse["ok"] = jeton != null;
                if (jeton != null) reponse["jeton"] = jeton; else reponse["raison"] = raison ?? "connexion Google impossible";
                Executer("window.recevoirJetonDrive && window.recevoirJetonDrive(" + Json.Ecrire(reponse) + ")");
                // Après la page Google dans le navigateur, on revient devant.
                try { BeginInvoke(new Action(() => { if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Maximized; Activate(); })); }
                catch (Exception) { /* fenêtre fermée */ }
            });
        }

        static readonly string[] HOTES_CADASTRE = { "rdppf.vd.ch", "geodienste.ch" };

        // Cadastre : lit une adresse internet pour la page, sans la protection « CORS » du navigateur.
        // Seulement en https et vers les services du cadastre.
        void LireAdresse(int numero, string adresse)
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                var reponse = new Dictionary<string, object>();
                try
                {
                    var uri = new Uri(adresse);
                    bool autorise = uri.Scheme == "https" && Array.Exists(HOTES_CADASTRE, h => uri.Host == h || uri.Host.EndsWith("." + h, StringComparison.Ordinal));
                    if (!autorise) throw new ArgumentException("adresse non autorisée : " + uri.Host);
                    var demande = (HttpWebRequest)WebRequest.Create(uri);
                    demande.Timeout = 20000;
                    demande.ReadWriteTimeout = 45000;
                    demande.Accept = "application/json, application/xml, text/xml, */*";
                    HttpWebResponse recue;
                    try { recue = (HttpWebResponse)demande.GetResponse(); }
                    catch (WebException erreur)
                    {
                        recue = erreur.Response as HttpWebResponse;
                        if (recue == null) throw;
                    }
                    using (recue)
                    using (var memoire = new MemoryStream())
                    {
                        Stream flux = recue.GetResponseStream();
                        if (flux != null) flux.CopyTo(memoire);
                        if (memoire.Length > 20000000) throw new InvalidOperationException("réponse trop grande");
                        int statut = (int)recue.StatusCode;
                        reponse["ok"] = statut >= 200 && statut <= 299;
                        reponse["statut"] = statut;
                        reponse["texte"] = Encoding.UTF8.GetString(memoire.ToArray());
                    }
                }
                catch (Exception erreur)
                {
                    reponse.Clear();
                    reponse["erreur"] = erreur.Message;
                }
                Executer("window.recevoirAdresse && window.recevoirAdresse(" + numero + "," + Json.Ecrire(reponse) + ")");
            });
        }

        // Partage d'écran : ouvre AnyDesk s'il est installé, sinon sa page de téléchargement.
        void OuvrirAnydesk()
        {
            foreach (Environment.SpecialFolder dossier in new[] { Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.ProgramFiles })
            {
                string chemin = Path.Combine(Environment.GetFolderPath(dossier), "AnyDesk", "AnyDesk.exe");
                if (!File.Exists(chemin)) continue;
                try { Process.Start(chemin); return; }
                catch (Exception erreur) { Message("Impossible d'ouvrir AnyDesk : " + erreur.Message); return; }
            }
            Message("AnyDesk n'est pas installé : page de téléchargement ouverte.");
            OuvrirDehors("https://anydesk.com/fr/downloads/windows");
        }

        void InstallerMiseAJour(string adresse)
        {
            Message("Téléchargement de la mise à jour…", 60000);
            ThreadPool.QueueUserWorkItem(delegate
            {
                string echec = MiseAJour.Installer(adresse);
                try
                {
                    BeginInvoke(new Action(() =>
                    {
                        if (echec != null) Message("Mise à jour impossible : " + echec, 8000);
                        else Close(); // la nouvelle version est déjà lancée
                    }));
                }
                catch (Exception) { /* fenêtre fermée */ }
            });
        }

        // Modèle de la tablette (« Handheld CC180 »), proposé comme nom de l'appareil.
        static string ModeleAppareil()
        {
            try
            {
                using (RegistryKey cle = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\BIOS"))
                {
                    if (cle != null)
                    {
                        string modele = ((cle.GetValue("SystemManufacturer") as string ?? "") + " " + (cle.GetValue("SystemProductName") as string ?? "")).Trim();
                        if (modele.Length > 0) return modele;
                    }
                }
            }
            catch (Exception) { /* registre illisible */ }
            return Environment.MachineName;
        }

        // =====================================================================
        // Divers
        // =====================================================================

        // Ouvre une adresse dans le navigateur (ou le logiciel de mail) de la tablette.
        void OuvrirDehors(string adresse)
        {
            if (adresse == null) return;
            bool permise = adresse.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || adresse.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                adresse.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || adresse.StartsWith("tel:", StringComparison.OrdinalIgnoreCase);
            if (!permise) return;
            try { Process.Start(new ProcessStartInfo(adresse) { UseShellExecute = true }); }
            catch (Exception) { Message("Impossible d'ouvrir " + adresse); }
        }

        // Petit message en bas de la fenêtre, quelques secondes.
        void Message(string texte, int dureeMs = 4000)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action(() => Message(texte, dureeMs))); } catch (Exception) { /* fenêtre fermée */ }
                return;
            }
            bulle.Text = texte;
            PlacerBulle();
            bulle.Visible = true;
            bulle.BringToFront();
            minuterieMessage.Stop();
            minuterieMessage.Interval = dureeMs;
            minuterieMessage.Start();
        }

        void PlacerBulle()
        {
            int largeur = Math.Min(ClientSize.Width - 40, Math.Max(300, TextRenderer.MeasureText(bulle.Text, bulle.Font).Width + 60));
            int hauteur = Math.Max(48, bulle.Font.Height * 2);
            bulle.SetBounds((ClientSize.Width - largeur) / 2, ClientSize.Height - hauteur - 90, largeur, hauteur);
        }

        void Arreter()
        {
            minuterie.Stop();
            recepteur.Corrections.Arreter();
            recepteur2.Corrections.Arreter();
            recepteur.Liaison.Deconnecter();
            recepteur2.Liaison.Deconnecter();
            positionTablette.Arreter();
            SetThreadExecutionState(ES_CONTINUOUS);
        }

        // Échelle d'affichage de Windows pour cette fenêtre (1 = 100 %, 1.5 = 150 %).
        double EchelleWindows()
        {
            try
            {
                uint ppp = GetDpiForWindow(Handle);   // Windows 10 (1607) et plus récent
                if (ppp > 0) return ppp / 96.0;
            }
            catch (Exception) { /* Windows plus ancien : on lit l'échelle générale ci-dessous */ }
            using (Graphics dessin = CreateGraphics()) return dessin.DpiX / 96.0;
        }

        [DllImport("user32.dll")]
        static extern uint GetDpiForWindow(IntPtr fenetre);

        const uint ES_CONTINUOUS = 0x80000000, ES_SYSTEM_REQUIRED = 0x00000001, ES_DISPLAY_REQUIRED = 0x00000002;

        [DllImport("kernel32.dll")]
        static extern uint SetThreadExecutionState(uint etat);
    }

    // Petite fenêtre « Choisir le récepteur » : la liste des ports COM, avec le nom de l'appareil Bluetooth.
    public class ChoixRecepteur : Form
    {
        readonly ListBox liste = new ListBox();
        readonly Label aide = new Label();
        List<PortSerie> ports = new List<PortSerie>();

        public PortSerie Choisi;

        public ChoixRecepteur(string titre)
        {
            Text = titre;
            Font = new Font("Segoe UI", 14f);
            AutoScaleMode = AutoScaleMode.Dpi;
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MinimizeBox = false;
            MaximizeBox = false;
            ShowInTaskbar = false;
            ClientSize = new Size(560, 460);

            aide.Dock = DockStyle.Top;
            aide.Height = 70;
            aide.Padding = new Padding(10, 8, 10, 0);
            aide.Font = new Font("Segoe UI", 11f);

            liste.Dock = DockStyle.Fill;
            liste.IntegralHeight = false;
            liste.ItemHeight = 44;
            liste.DrawMode = DrawMode.OwnerDrawFixed;
            liste.DrawItem += DessinerLigne;
            liste.Click += delegate { Valider(); };

            var bas = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 70, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(8) };
            var annuler = new Button { Text = "Annuler", Width = 150, Height = 50, DialogResult = DialogResult.Cancel };
            var actualiser = new Button { Text = "Actualiser", Width = 150, Height = 50 };
            actualiser.Click += delegate { Remplir(); };
            bas.Controls.Add(annuler);
            bas.Controls.Add(actualiser);
            CancelButton = annuler;

            Controls.Add(liste);
            Controls.Add(aide);
            Controls.Add(bas);
            Remplir();
        }

        void Remplir()
        {
            ports = RecepteurSerie.Lister();
            liste.Items.Clear();
            foreach (PortSerie p in ports) liste.Items.Add(p.Libelle);
            aide.Text = ports.Count == 0
                ? "Aucun port trouvé. Jumelez d'abord le récepteur GNSS dans les paramètres Bluetooth de Windows, puis touchez « Actualiser »."
                : "Touchez le récepteur GNSS (jumelé dans les paramètres Bluetooth de Windows).";
        }

        void DessinerLigne(object expediteur, DrawItemEventArgs e)
        {
            if (e.Index < 0) return;
            e.DrawBackground();
            using (var pinceau = new SolidBrush(e.ForeColor))
                e.Graphics.DrawString((string)liste.Items[e.Index], e.Font, pinceau, e.Bounds.Left + 10, e.Bounds.Top + (e.Bounds.Height - e.Font.Height) / 2);
        }

        void Valider()
        {
            if (liste.SelectedIndex < 0 || liste.SelectedIndex >= ports.Count) return;
            Choisi = ports[liste.SelectedIndex];
            DialogResult = DialogResult.OK;
            Close();
        }
    }
}
