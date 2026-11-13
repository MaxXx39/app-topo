using System;
using System.Globalization;

namespace TestRecepteur
{
    // Résultat de la lecture d'une ligne GGA (la position du récepteur).
    public class PositionGga
    {
        public string Heure;          // hhmmss.ss (UTC)
        public double Latitude;       // degrés décimaux (WGS84)
        public double Longitude;      // degrés décimaux (WGS84)
        public int Qualite;           // 0 invalide, 1 autonome, 2 DGPS, 4 FIXE, 5 FLOTTANT…
        public int Satellites;
        public double Hdop;
        public double Altitude;       // mètres
    }

    public static class Nmea
    {
        // Vérifie la somme de contrôle d'une ligne « $…*HH ». Une ligne sans somme est refusée.
        public static bool SommeValide(string ligne)
        {
            if (string.IsNullOrEmpty(ligne) || ligne[0] != '$') return false;
            int etoile = ligne.IndexOf('*');
            if (etoile < 0 || etoile + 3 > ligne.Length) return false;
            int somme = 0;
            for (int i = 1; i < etoile; i++) somme ^= ligne[i];
            int attendu;
            if (!int.TryParse(ligne.Substring(etoile + 1, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out attendu)) return false;
            return somme == attendu;
        }

        // Lit une ligne GGA (GPGGA, GNGGA…). Rend null si ce n'est pas une GGA correcte.
        public static PositionGga LireGga(string ligne)
        {
            if (!SommeValide(ligne)) return null;
            string corps = ligne.Substring(1, ligne.IndexOf('*') - 1);
            string[] c = corps.Split(',');
            if (c.Length < 10 || c[0].Length != 5 || !c[0].EndsWith("GGA")) return null;

            var p = new PositionGga();
            p.Heure = c[1];
            p.Qualite = EntierOuZero(c[6]);
            p.Satellites = EntierOuZero(c[7]);
            p.Hdop = DecimalOuZero(c[8]);
            p.Altitude = DecimalOuZero(c[9]);
            if (c[2] != "" && c[4] != "")
            {
                p.Latitude = DegresDecimaux(c[2], 2) * (c[3] == "S" ? -1 : 1);
                p.Longitude = DegresDecimaux(c[4], 3) * (c[5] == "W" ? -1 : 1);
            }
            return p;
        }

        // « ddmm.mmmm » (ou « dddmm.mmmm ») -> degrés décimaux ; chiffresDegres = 2 (latitude) ou 3 (longitude).
        public static double DegresDecimaux(string texte, int chiffresDegres)
        {
            if (texte.Length <= chiffresDegres) return 0;
            double degres = DecimalOuZero(texte.Substring(0, chiffresDegres));
            double minutes = DecimalOuZero(texte.Substring(chiffresDegres));
            return degres + minutes / 60.0;
        }

        public static string NomQualite(int q)
        {
            switch (q)
            {
                case 0: return "Pas de position";
                case 1: return "AUTONOME";
                case 2: return "DGPS";
                case 4: return "FIXE";
                case 5: return "FLOTTANT";
                default: return "Autre (" + q + ")";
            }
        }

        static int EntierOuZero(string t)
        {
            int v;
            return int.TryParse(t, NumberStyles.Integer, CultureInfo.InvariantCulture, out v) ? v : 0;
        }

        static double DecimalOuZero(string t)
        {
            double v;
            return double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : 0;
        }
    }
}
