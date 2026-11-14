using System;
using System.IO;

namespace Topo
{
    // Coordonnées GNSS (ETRS89 / CHTRS95) -> coordonnées suisses MN95 + altitude RAN95.
    // COPIE EXACTE du calcul de l'APK (android/noyau/…/coordonnees/Mn95.kt, GrilleGeoide.kt, PositionSuisse.kt),
    // méthode officielle swisstopo, validée le 20.10.2026 sur deux points d'Emlid Flow (écart ≤ 2 mm).
    // Les mêmes points de référence sont rejoués par les tests (windows/Topo.Tests).

    public class PointMn95 { public double Est, Nord; }

    // Est, Nord MN95 (m) et altitude RAN95 / LHN95 (m).
    public class PositionSuisse { public double Est, Nord, Altitude; }

    public static class Mn95
    {
        // GRS80 (ETRS89) : a = 6378137 m, aplatissement 1/298.257222101
        const double A_GRS80 = 6378137.0;
        static readonly double E2_GRS80 = (1 / 298.257222101) * (2 - 1 / 298.257222101);
        // Bessel 1841 (CH1903+)
        const double A_BESSEL = 6377397.155;
        const double E2_BESSEL = 0.006674372230614;
        // Translations CH1903+ -> CHTRS95 (m) : pour aller de CHTRS95 vers CH1903+, on les soustrait.
        const double TRANSLATION_X = 674.374, TRANSLATION_Y = 15.056, TRANSLATION_Z = 405.346;
        // Centre de la projection (ancien observatoire de Berne) et décalage MN95.
        static readonly double LATITUDE_BERNE = Radians(46.0 + 57.0 / 60 + 8.66 / 3600);
        static readonly double LONGITUDE_BERNE = Radians(7.0 + 26.0 / 60 + 22.50 / 3600);
        const double EST_BERNE = 2600000.0, NORD_BERNE = 1200000.0;

        static double Radians(double degres) { return degres * Math.PI / 180.0; }

        // Position GNSS (degrés décimaux, hauteur ellipsoïdale en m) -> Est, Nord MN95 (m).
        public static PointMn95 DepuisEtrs89(double latitudeDeg, double longitudeDeg, double hauteurEllipsoidaleM)
        {
            double lat = Radians(latitudeDeg), lon = Radians(longitudeDeg);
            // 1. Géographiques (GRS80) -> X, Y, Z.
            double n = A_GRS80 / Math.Sqrt(1 - E2_GRS80 * Math.Sin(lat) * Math.Sin(lat));
            double x = (n + hauteurEllipsoidaleM) * Math.Cos(lat) * Math.Cos(lon);
            double y = (n + hauteurEllipsoidaleM) * Math.Cos(lat) * Math.Sin(lon);
            double z = (n * (1 - E2_GRS80) + hauteurEllipsoidaleM) * Math.Sin(lat);
            // 2. Translations, puis 3. X, Y, Z -> géographiques sur Bessel (par itérations).
            x -= TRANSLATION_X; y -= TRANSLATION_Y; z -= TRANSLATION_Z;
            double lonB = Math.Atan2(y, x);
            double distanceAxe = Math.Sqrt(x * x + y * y);
            double latB = Math.Atan2(z, distanceAxe * (1 - E2_BESSEL));
            for (int i = 0; i < 10; i++)
            {
                double nB = A_BESSEL / Math.Sqrt(1 - E2_BESSEL * Math.Sin(latB) * Math.Sin(latB));
                double h = distanceAxe / Math.Cos(latB) - nB;
                latB = Math.Atan2(z, distanceAxe * (1 - E2_BESSEL * nB / (nB + h)));
            }
            // 4. Projection suisse.
            return Projection(latB, lonB);
        }

        // Projection suisse (cylindrique conforme à axe oblique) : latitude, longitude sur Bessel (radians) -> Est, Nord.
        static PointMn95 Projection(double latitude, double longitude)
        {
            double e2 = E2_BESSEL, e = Math.Sqrt(e2);
            double sinBerne = Math.Sin(LATITUDE_BERNE);
            double rayon = A_BESSEL * Math.Sqrt(1 - e2) / (1 - e2 * sinBerne * sinBerne);
            double alpha = Math.Sqrt(1 + e2 / (1 - e2) * Math.Pow(Math.Cos(LATITUDE_BERNE), 4.0));
            double b0 = Math.Asin(sinBerne / alpha);
            double k = Math.Log(Math.Tan(Math.PI / 4 + b0 / 2)) - alpha * Math.Log(Math.Tan(Math.PI / 4 + LATITUDE_BERNE / 2)) +
                alpha * e / 2 * Math.Log((1 + e * sinBerne) / (1 - e * sinBerne));

            // Ellipsoïde -> sphère.
            double sinLat = Math.Sin(latitude);
            double s = alpha * Math.Log(Math.Tan(Math.PI / 4 + latitude / 2)) -
                alpha * e / 2 * Math.Log((1 + e * sinLat) / (1 - e * sinLat)) + k;
            double b = 2 * (Math.Atan(Math.Exp(s)) - Math.PI / 4);
            double l = alpha * (longitude - LONGITUDE_BERNE);

            // Rotation vers le système « pseudo-équatorial » centré sur Berne.
            double lBarre = Math.Atan(Math.Sin(l) / (Math.Sin(b0) * Math.Tan(b) + Math.Cos(b0) * Math.Cos(l)));
            double bBarre = Math.Asin(Math.Cos(b0) * Math.Sin(b) - Math.Sin(b0) * Math.Cos(b) * Math.Cos(l));

            // Mercator sur la sphère.
            return new PointMn95
            {
                Est = EST_BERNE + rayon * lBarre,
                Nord = NORD_BERNE + rayon / 2 * Math.Log((1 + Math.Sin(bBarre)) / (1 - Math.Sin(bBarre))),
            };
        }

        // MN95 + altitude RAN95 ; null hors de la grille du géoïde (hors de Suisse).
        public static PositionSuisse VersPositionSuisse(double latitudeDeg, double longitudeDeg, double hauteurEllipsoidaleM, GrilleGeoide grille)
        {
            double? hauteurGeoide = grille.HauteurGeoide(latitudeDeg, longitudeDeg);
            if (hauteurGeoide == null) return null;
            PointMn95 p = DepuisEtrs89(latitudeDeg, longitudeDeg, hauteurEllipsoidaleM);
            return new PositionSuisse { Est = p.Est, Nord = p.Nord, Altitude = hauteurEllipsoidaleM - hauteurGeoide.Value };
        }

        // Même conversion depuis un GGA (hauteur ellipsoïdale = altitude GGA + séparation) ; null s'il manque une valeur.
        public static PositionSuisse VersPositionSuisse(PositionGga gga, GrilleGeoide grille)
        {
            if (gga == null || gga.LatitudeDeg == null || gga.LongitudeDeg == null || gga.HauteurEllipsoidaleM == null) return null;
            return VersPositionSuisse(gga.LatitudeDeg.Value, gga.LongitudeDeg.Value, gga.HauteurEllipsoidaleM.Value, grille);
        }
    }

    // Grille du géoïde CHGeo2004 (swisstopo, CC0) : hauteur du géoïde au-dessus de l'ellipsoïde GRS80 (m).
    // Altitude RAN95 = hauteur ellipsoïdale − valeur de la grille. Même fichier que l'APK
    // (android/noyau/src/main/resources/geoide/chgeo2004_lhn95.grille), nœuds du nord au sud et d'ouest en est.
    public class GrilleGeoide
    {
        readonly int nbLignes, nbColonnes;
        readonly double longitudeOuestDeg, latitudeNordDeg, pasDeg;
        readonly float[] valeurs;

        GrilleGeoide(int nbLignes, int nbColonnes, double longitudeOuest, double latitudeNord, double pas, float[] valeurs)
        {
            this.nbLignes = nbLignes; this.nbColonnes = nbColonnes;
            longitudeOuestDeg = longitudeOuest; latitudeNordDeg = latitudeNord; pasDeg = pas;
            this.valeurs = valeurs;
        }

        // Hauteur du géoïde (m) par interpolation bilinéaire entre les 4 nœuds voisins ; null hors de la grille.
        public double? HauteurGeoide(double latitudeDeg, double longitudeDeg)
        {
            double ligneDecimale = (latitudeNordDeg - latitudeDeg) / pasDeg;
            double colonneDecimale = (longitudeDeg - longitudeOuestDeg) / pasDeg;
            if (ligneDecimale < 0 || colonneDecimale < 0) return null;
            int ligne = (int)ligneDecimale, colonne = (int)colonneDecimale;
            if (ligne + 1 >= nbLignes || colonne + 1 >= nbColonnes) return null;
            double versSud = ligneDecimale - ligne, versEst = colonneDecimale - colonne;
            return Valeur(ligne, colonne) * (1 - versSud) * (1 - versEst) +
                Valeur(ligne, colonne + 1) * (1 - versSud) * versEst +
                Valeur(ligne + 1, colonne) * versSud * (1 - versEst) +
                Valeur(ligne + 1, colonne + 1) * versSud * versEst;
        }

        double Valeur(int ligne, int colonne) { return valeurs[ligne * nbColonnes + colonne]; }

        // Lit la grille (octets « big-endian » : 2 entiers, 3 doubles, puis les valeurs sur 4 octets).
        public static GrilleGeoide Lire(Stream flux)
        {
            byte[] octets;
            using (var memoire = new MemoryStream())
            {
                flux.CopyTo(memoire);
                octets = memoire.ToArray();
            }
            int position = 0;
            int nbLignes = (int)Entier(octets, ref position, 4);
            int nbColonnes = (int)Entier(octets, ref position, 4);
            double longitudeOuest = BitConverter.Int64BitsToDouble(Entier(octets, ref position, 8));
            double latitudeNord = BitConverter.Int64BitsToDouble(Entier(octets, ref position, 8));
            double pas = BitConverter.Int64BitsToDouble(Entier(octets, ref position, 8));
            if (nbLignes <= 0 || nbColonnes <= 0 || octets.Length < position + 4L * nbLignes * nbColonnes)
                throw new InvalidDataException("grille du géoïde incomplète");
            var valeurs = new float[nbLignes * nbColonnes];
            var quatre = new byte[4];
            for (int i = 0; i < valeurs.Length; i++)
            {
                // Octets dans l'ordre inverse de celui de Windows.
                quatre[0] = octets[position + 3]; quatre[1] = octets[position + 2];
                quatre[2] = octets[position + 1]; quatre[3] = octets[position];
                valeurs[i] = BitConverter.ToSingle(quatre, 0);
                position += 4;
            }
            return new GrilleGeoide(nbLignes, nbColonnes, longitudeOuest, latitudeNord, pas, valeurs);
        }

        // Entier « big-endian » de « taille » octets.
        static long Entier(byte[] octets, ref int position, int taille)
        {
            if (position + taille > octets.Length) throw new InvalidDataException("grille du géoïde incomplète");
            long valeur = 0;
            for (int i = 0; i < taille; i++) valeur = (valeur << 8) | octets[position + i];
            position += taille;
            return taille == 4 ? (int)valeur : valeur;
        }
    }
}
