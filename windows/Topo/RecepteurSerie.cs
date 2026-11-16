using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Ports;
using System.Text;
using System.Threading;
using Microsoft.Win32;

namespace Topo
{
    // Un port COM proposé dans la liste « Choisir le récepteur ».
    public class PortSerie
    {
        public string Port;        // « COM5 »
        public string Appareil;    // nom Bluetooth de l'appareil (« Reach RX2 »), ou "" si inconnu
        public bool Entrant;       // port « entrant » de Windows : ce n'est pas celui qu'il faut pour un récepteur

        public string Libelle
        {
            get
            {
                if (!string.IsNullOrEmpty(Appareil)) return Appareil + "  (" + Port + ")";
                return Entrant ? Port + "  (Bluetooth entrant : ne convient pas)" : Port;
            }
        }
    }

    // Liaison avec le récepteur GNSS par un port COM (Bluetooth « port série » ou USB) : même rôle que
    // RecepteurBluetooth.kt de l'APK. Sous Windows, un récepteur jumelé en Bluetooth apparaît comme un port COM.
    // La lecture se fait dans un fil séparé, ligne par ligne.
    public class RecepteurSerie
    {
        readonly Action<string> surLigne;
        readonly Action<string, bool> surEtat;    // (texte à afficher, connecté ?)
        readonly object verrouEcriture = new object();
        volatile SerialPort port;
        volatile int numeroConnexion;             // une ancienne connexion qui se termine ne touche pas à la nouvelle

        public RecepteurSerie(Action<string> surLigne, Action<string, bool> surEtat)
        {
            this.surLigne = surLigne;
            this.surEtat = surEtat;
        }

        // Se connecte au port choisi et lit le flux ; « nom » = texte montré à l'utilisateur.
        public void Connecter(string nomPort, string nom)
        {
            Deconnecter();
            int monNumero = ++numeroConnexion;
            var fil = new Thread(() => Lire(nomPort, string.IsNullOrEmpty(nom) ? nomPort : nom, monNumero)) { IsBackground = true, Name = "lecture-nmea" };
            fil.Start();
        }

        void Lire(string nomPort, string nom, int monNumero)
        {
            SerialPort monPort = null;
            try
            {
                surEtat("connexion à " + nom + "…", false);
                // La vitesse ne compte pas pour un port Bluetooth ; 115200 convient aussi à un câble USB.
                monPort = new SerialPort(nomPort, 115200, Parity.None, 8, StopBits.One);
                monPort.ReadTimeout = 1000;
                monPort.WriteTimeout = 3000;
                // Certains ports Bluetooth de Windows ne laissent passer les données VERS l'appareil
                // (les corrections RTK) que si ces deux signaux sont levés.
                monPort.DtrEnable = true;
                monPort.RtsEnable = true;
                monPort.Open();
                if (monNumero != numeroConnexion) return;
                port = monPort;
                surEtat("connecté à " + nom, true);

                var tampon = new byte[4096];
                var ligne = new StringBuilder();
                long derniereDonnee = Horloge.Ms();
                while (monNumero == numeroConnexion)
                {
                    int lus;
                    try { lus = monPort.Read(tampon, 0, tampon.Length); }
                    catch (TimeoutException)
                    {
                        // Rien reçu depuis 15 s : le récepteur est éteint ou trop loin.
                        if (Horloge.Ms() - derniereDonnee > 15000) throw new IOException("plus rien reçu depuis 15 s");
                        continue;
                    }
                    if (lus <= 0) continue;
                    derniereDonnee = Horloge.Ms();
                    for (int i = 0; i < lus; i++)
                    {
                        char c = (char)tampon[i];
                        if (c == '\n')
                        {
                            string texte = ligne.ToString().Trim();
                            ligne.Clear();
                            if (texte.Length > 0) surLigne(texte);
                        }
                        else if (ligne.Length < 2000) ligne.Append(c);
                        else ligne.Clear(); // ligne absurde (pas du NMEA) : on la jette
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                if (monNumero == numeroConnexion) surEtat("échec : " + nomPort + " est déjà utilisé par un autre programme (Emlid Flow ?)", false);
            }
            catch (Exception erreur)
            {
                if (monNumero == numeroConnexion) surEtat("échec de la connexion à " + nom + " : " + erreur.Message, false);
            }
            finally
            {
                Fermer(monPort);
                if (monNumero == numeroConnexion) port = null;
            }
        }

        // Envoie des octets au récepteur (les corrections RTK). Faux si non connecté ou si l'envoi échoue.
        public bool Ecrire(byte[] octets)
        {
            SerialPort monPort = port;
            if (monPort == null) return false;
            try
            {
                lock (verrouEcriture)
                {
                    if (!monPort.IsOpen) return false;
                    monPort.Write(octets, 0, octets.Length);
                }
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public void Deconnecter()
        {
            numeroConnexion++;
            SerialPort ancien = port;
            port = null;
            // La fermeture d'un port Bluetooth peut durer plusieurs secondes : hors de l'écran.
            if (ancien != null) ThreadPool.QueueUserWorkItem(delegate { Fermer(ancien); });
        }

        static void Fermer(SerialPort p)
        {
            try { if (p != null) { if (p.IsOpen) p.Close(); p.Dispose(); } }
            catch (Exception) { /* déjà fermé */ }
        }

        // ---------- Liste des ports COM, avec le nom de l'appareil Bluetooth quand Windows le connaît ----------

        public static List<PortSerie> Lister()
        {
            var ports = new List<PortSerie>();
            string[] noms;
            try { noms = SerialPort.GetPortNames(); }
            catch (Exception) { noms = new string[0]; }
            Array.Sort(noms, (a, b) => Numero(a).CompareTo(Numero(b)));
            Dictionary<string, string> adresses = AdressesBluetoothDesPorts();
            var dejaVus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string nom in noms)
            {
                // Windows répète parfois un nom, ou y laisse un caractère parasite à la fin.
                string propre = Propre(nom);
                if (propre.Length == 0 || !dejaVus.Add(propre)) continue;
                var p = new PortSerie { Port = propre, Appareil = "" };
                string adresse;
                if (adresses.TryGetValue(propre.ToUpperInvariant(), out adresse))
                {
                    if (adresse == "000000000000") p.Entrant = true;
                    else p.Appareil = NomAppareilBluetooth(adresse) ?? "";
                }
                ports.Add(p);
            }
            return ports;
        }

        static string Propre(string nom)
        {
            var s = new StringBuilder();
            foreach (char c in nom ?? "") if (char.IsLetterOrDigit(c)) s.Append(c); else break;
            return s.ToString();
        }

        static int Numero(string nom)
        {
            int n;
            string chiffres = Propre(nom).TrimStart('C', 'O', 'M', 'c', 'o', 'm');
            return int.TryParse(chiffres, out n) ? n : int.MaxValue;
        }

        // Pour chaque port COM Bluetooth : l'adresse (12 chiffres hexadécimaux) de l'appareil, lue dans le registre
        // de Windows ; « 000000000000 » = port entrant. Vide si Windows range cela autrement (on montre alors « COM5 » seul).
        static Dictionary<string, string> AdressesBluetoothDesPorts()
        {
            var resultat = new Dictionary<string, string>();
            try
            {
                using (RegistryKey racine = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\BTHENUM"))
                {
                    if (racine == null) return resultat;
                    foreach (string service in racine.GetSubKeyNames())
                    {
                        using (RegistryKey cleService = racine.OpenSubKey(service))
                        {
                            if (cleService == null) continue;
                            foreach (string instance in cleService.GetSubKeyNames())
                            {
                                using (RegistryKey parametres = cleService.OpenSubKey(instance + @"\Device Parameters"))
                                {
                                    string nomPort = parametres == null ? null : parametres.GetValue("PortName") as string;
                                    if (string.IsNullOrEmpty(nomPort)) continue;
                                    // Instance du genre « 7&2c0f0c9&0&0C8CDC123456_C00000000 » : l'adresse précède « _ ».
                                    int tiret = instance.LastIndexOf('_');
                                    int debut = instance.LastIndexOf('&');
                                    if (tiret < 0 || debut < 0 || tiret - debut - 1 != 12) continue;
                                    resultat[nomPort.ToUpperInvariant()] = instance.Substring(debut + 1, 12).ToUpperInvariant();
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception) { /* registre illisible : on montrera les ports sans nom d'appareil */ }
            return resultat;
        }

        static string NomAppareilBluetooth(string adresse)
        {
            try
            {
                using (RegistryKey cle = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters\Devices\" + adresse.ToLowerInvariant()))
                {
                    byte[] octets = cle == null ? null : cle.GetValue("Name") as byte[];
                    if (octets == null) return null;
                    string nom = Encoding.UTF8.GetString(octets).TrimEnd('\0').Trim();
                    return nom.Length == 0 ? null : nom;
                }
            }
            catch (Exception) { return null; }
        }
    }
}
