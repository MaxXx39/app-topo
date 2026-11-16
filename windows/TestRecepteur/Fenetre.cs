using System;
using System.Drawing;
using System.Globalization;
using System.IO.Ports;
using System.Text;
using System.Windows.Forms;

namespace TestRecepteur
{
    static class Programme
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Fenetre());
        }
    }

    // Fenêtre de test : choisir le port COM du récepteur, voir les lignes NMEA et la position.
    public class Fenetre : Form
    {
        readonly ComboBox listePorts = new ComboBox();
        readonly ComboBox listeVitesses = new ComboBox();
        readonly Button boutonActualiser = new Button();
        readonly Button boutonConnecter = new Button();
        readonly Label resume = new Label();
        readonly TextBox journal = new TextBox();
        readonly TextBox champHote = new TextBox();
        readonly TextBox champPortNtrip = new TextBox();
        readonly TextBox champMontage = new TextBox();
        readonly TextBox champUtilisateur = new TextBox();
        readonly TextBox champMotDePasse = new TextBox();
        readonly Button boutonNtrip = new Button();
        readonly Label etatNtrip = new Label();
        ClientNtrip clientNtrip;
        string derniereGga;                 // dernière ligne GGA reçue du récepteur (envoyée au serveur)
        readonly object verrouEcriture = new object();
        SerialPort port;
        readonly StringBuilder tampon = new StringBuilder();
        int lignesRecues;

        public Fenetre()
        {
            Text = "Topo – Test récepteur GNSS (CC180)";
            Width = 900;
            Height = 820;
            Font = new Font("Segoe UI", 12f);

            var haut = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(8) };
            listePorts.DropDownStyle = ComboBoxStyle.DropDownList;
            listePorts.Width = 150;
            listeVitesses.DropDownStyle = ComboBoxStyle.DropDownList;
            listeVitesses.Width = 110;
            listeVitesses.Items.AddRange(new object[] { "4800", "9600", "19200", "38400", "57600", "115200" });
            listeVitesses.SelectedItem = "115200";
            boutonActualiser.Text = "Actualiser";
            boutonActualiser.AutoSize = true;
            boutonActualiser.MinimumSize = new Size(0, 48);
            boutonActualiser.Click += delegate { ActualiserPorts(); };
            boutonConnecter.Text = "Connecter";
            boutonConnecter.AutoSize = true;
            boutonConnecter.MinimumSize = new Size(0, 48);
            boutonConnecter.Click += BasculerConnexion;
            haut.Controls.Add(new Label { Text = "Port :", AutoSize = true, Margin = new Padding(3, 12, 3, 0) });
            haut.Controls.Add(listePorts);
            haut.Controls.Add(new Label { Text = "Vitesse :", AutoSize = true, Margin = new Padding(12, 12, 3, 0) });
            haut.Controls.Add(listeVitesses);
            haut.Controls.Add(boutonActualiser);
            haut.Controls.Add(boutonConnecter);

            resume.Dock = DockStyle.Top;
            resume.Height = 190;
            resume.Padding = new Padding(12);
            resume.Font = new Font("Segoe UI", 16f, FontStyle.Bold);
            resume.Text = "Pas connecté.\r\nJumelez d'abord le récepteur dans Windows (Bluetooth), puis choisissez son port COM.";

            journal.Dock = DockStyle.Fill;
            journal.Multiline = true;
            journal.ReadOnly = true;
            journal.ScrollBars = ScrollBars.Vertical;
            journal.Font = new Font("Consolas", 10f);

            // Corrections NTRIP (swipos…) : le mot de passe se tape ici, il n'est jamais enregistré.
            var ntrip = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(8) };
            champHote.Width = 230;
            champPortNtrip.Width = 70;
            champPortNtrip.Text = "2101";
            champMontage.Width = 150;
            champUtilisateur.Width = 150;
            champMotDePasse.Width = 150;
            champMotDePasse.UseSystemPasswordChar = true;
            boutonNtrip.Text = "Démarrer NTRIP";
            boutonNtrip.AutoSize = true;
            boutonNtrip.MinimumSize = new Size(0, 48);
            boutonNtrip.Click += BasculerNtrip;
            ntrip.Controls.Add(Etiquette("Serveur :")); ntrip.Controls.Add(champHote);
            ntrip.Controls.Add(Etiquette("Port :")); ntrip.Controls.Add(champPortNtrip);
            ntrip.Controls.Add(Etiquette("Point de montage :")); ntrip.Controls.Add(champMontage);
            ntrip.Controls.Add(Etiquette("Identifiant :")); ntrip.Controls.Add(champUtilisateur);
            ntrip.Controls.Add(Etiquette("Mot de passe :")); ntrip.Controls.Add(champMotDePasse);
            ntrip.Controls.Add(boutonNtrip);
            etatNtrip.AutoSize = true;
            etatNtrip.Margin = new Padding(8, 12, 3, 0);
            etatNtrip.Text = "NTRIP arrêté.";
            ntrip.Controls.Add(etatNtrip);

            Controls.Add(journal);
            Controls.Add(resume);
            Controls.Add(ntrip);
            Controls.Add(haut);

            ActualiserPorts();
            FormClosing += delegate { if (clientNtrip != null) clientNtrip.Arreter(); Deconnecter(); };
        }

        void ActualiserPorts()
        {
            string avant = listePorts.SelectedItem as string;
            listePorts.Items.Clear();
            string[] noms = SerialPort.GetPortNames();
            Array.Sort(noms);
            listePorts.Items.AddRange(noms);
            if (avant != null && listePorts.Items.Contains(avant)) listePorts.SelectedItem = avant;
            else if (listePorts.Items.Count > 0) listePorts.SelectedIndex = 0;
            Ajouter("Ports COM trouvés : " + (noms.Length == 0 ? "aucun" : string.Join(", ", noms)));
        }

        void BasculerConnexion(object expediteur, EventArgs e)
        {
            if (port != null) { Deconnecter(); return; }
            string nom = listePorts.SelectedItem as string;
            if (nom == null)
            {
                MessageBox.Show("Aucun port COM choisi. Jumelez le récepteur dans Windows, puis touchez « Actualiser ».", "Topo");
                return;
            }
            try
            {
                int vitesse = int.Parse((string)listeVitesses.SelectedItem, CultureInfo.InvariantCulture);
                port = new SerialPort(nom, vitesse, Parity.None, 8, StopBits.One);
                port.ReadTimeout = 1000;
                port.DataReceived += DonneesRecues;
                port.Open();
                lignesRecues = 0;
                boutonConnecter.Text = "Déconnecter";
                resume.Text = "Connecté à " + nom + " (" + vitesse + " bauds).\r\nEn attente de lignes NMEA…";
                Ajouter("Connecté à " + nom + " à " + vitesse + " bauds.");
            }
            catch (Exception ex)
            {
                port = null;
                MessageBox.Show("Connexion impossible sur " + nom + " :\r\n" + ex.Message, "Topo");
                Ajouter("Erreur : " + ex.Message);
            }
        }

        static Label Etiquette(string texte)
        {
            return new Label { Text = texte, AutoSize = true, Margin = new Padding(12, 12, 3, 0) };
        }

        void BasculerNtrip(object expediteur, EventArgs e)
        {
            if (clientNtrip != null)
            {
                clientNtrip.Arreter();
                clientNtrip = null;
                boutonNtrip.Text = "Démarrer NTRIP";
                return;
            }
            if (port == null)
            {
                MessageBox.Show("Connectez d'abord le récepteur (port COM), puis démarrez le NTRIP.", "Topo");
                return;
            }
            int portReseau;
            int.TryParse(champPortNtrip.Text.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out portReseau);
            var reglages = new ReglagesNtrip
            {
                Hote = champHote.Text,
                Port = portReseau,
                PointDeMontage = champMontage.Text,
                Utilisateur = champUtilisateur.Text,
                MotDePasse = champMotDePasse.Text,
            };
            string manque = reglages.Manque();
            if (manque != null)
            {
                MessageBox.Show("NTRIP : " + manque + ".", "Topo");
                return;
            }
            clientNtrip = new ClientNtrip(
                () => derniereGga,
                EcrireVersRecepteur,
                etat => BeginInvoke(new Action(() => MontrerEtatNtrip(etat))));
            boutonNtrip.Text = "Arrêter NTRIP";
            clientNtrip.Demarrer(reglages);
        }

        // Corrections reçues (fil du client NTRIP) -> récepteur, par le port COM.
        void EcrireVersRecepteur(byte[] octets)
        {
            try
            {
                lock (verrouEcriture)
                {
                    SerialPort p = port;
                    if (p != null && p.IsOpen) p.Write(octets, 0, octets.Length);
                }
            }
            catch (Exception ex)
            {
                BeginInvoke(new Action(() => Ajouter("Erreur d'écriture vers le récepteur : " + ex.Message)));
            }
        }

        void MontrerEtatNtrip(EtatNtrip etat)
        {
            etatNtrip.Text = etat.Message + (etat.Octets > 0 ? "  (" + etat.Octets + " octets reçus)" : "");
            etatNtrip.ForeColor = etat.Etat == "recoit" ? Color.ForestGreen : (etat.Etat == "erreur" ? Color.Firebrick : Color.DarkOrange);
            if (etat.Etat == "erreur" || etat.Etat == "attente") Ajouter("NTRIP : " + etat.Message);
            if (etat.Etat == "erreur" && clientNtrip != null)
            {
                clientNtrip = null;
                boutonNtrip.Text = "Démarrer NTRIP";
            }
        }

        void Deconnecter()
        {
            if (port == null) return;
            try { port.DataReceived -= DonneesRecues; if (port.IsOpen) port.Close(); }
            catch (Exception ex) { Ajouter("Erreur à la fermeture : " + ex.Message); }
            port = null;
            boutonConnecter.Text = "Connecter";
            resume.Text = "Déconnecté.";
            Ajouter("Déconnecté.");
        }

        // Appelé par Windows sur un autre fil : on recompose les lignes puis on passe au fil de la fenêtre.
        void DonneesRecues(object expediteur, SerialDataReceivedEventArgs e)
        {
            string texte;
            try { texte = port.ReadExisting(); }
            catch (Exception ex) { BeginInvoke(new Action(() => Ajouter("Erreur de lecture : " + ex.Message))); return; }
            BeginInvoke(new Action(() => TraiterTexte(texte)));
        }

        void TraiterTexte(string texte)
        {
            tampon.Append(texte);
            string tout = tampon.ToString();
            int fin;
            while ((fin = tout.IndexOf('\n')) >= 0)
            {
                string ligne = tout.Substring(0, fin).Trim();
                tout = tout.Substring(fin + 1);
                if (ligne.Length > 0) TraiterLigne(ligne);
            }
            tampon.Clear();
            if (tout.Length < 500) tampon.Append(tout); // ligne en cours ; on jette un reste absurde
        }

        void TraiterLigne(string ligne)
        {
            lignesRecues++;
            bool valide = Nmea.SommeValide(ligne);
            Ajouter((valide ? "" : "[somme fausse] ") + ligne);
            PositionGga p = Nmea.LireGga(ligne);
            if (p == null) return;
            derniereGga = ligne;
            resume.Text =
                Nmea.NomQualite(p.Qualite) + "  –  " + p.Satellites + " satellites  –  HDOP " + p.Hdop.ToString("0.0", CultureInfo.InvariantCulture) + "\r\n" +
                "Lat " + p.Latitude.ToString("0.00000000", CultureInfo.InvariantCulture) + "°   Lon " + p.Longitude.ToString("0.00000000", CultureInfo.InvariantCulture) + "°\r\n" +
                "Altitude (WGS84) " + p.Altitude.ToString("0.000", CultureInfo.InvariantCulture) + " m\r\n" +
                "Heure UTC " + p.Heure + "   (" + lignesRecues + " lignes lues)";
            resume.ForeColor = p.Qualite == 4 ? Color.ForestGreen : (p.Qualite == 5 ? Color.DarkOrange : Color.Firebrick);
        }

        void Ajouter(string ligne)
        {
            journal.AppendText(ligne + "\r\n");
            if (journal.TextLength > 20000) journal.Text = journal.Text.Substring(journal.TextLength - 10000);
        }
    }
}
