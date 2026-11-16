using System;
using System.Globalization;

namespace Topo
{
    // Lecture des phrases NMEA du récepteur : même logique que l'APK (android/noyau/…/nmea/*.kt).
    // Une valeur absente est « null » (jamais remplacée par zéro).

    // Une phrase déjà découpée. Exemple : « $GNGGA,071530.00,4652.1234,N,...*5C »
    // Adresse = « GNGGA » ; Type = les 3 dernières lettres (« GGA ») ; Champs = valeurs entre les virgules.
    public class PhraseNmea
    {
        public string Texte;
        public string Adresse;
        public string[] Champs;
        public bool? SommeOk;     // vrai / faux, ou null si la phrase n'a pas de somme de contrôle

        public string Type { get { return Adresse.Length >= 3 ? Adresse.Substring(Adresse.Length - 3) : Adresse; } }

        // Champ n° « numero » (en comptant à partir de 1), ou "" s'il n'existe pas.
        public string Champ(int numero) { return numero >= 1 && numero <= Champs.Length ? Champs[numero - 1] : ""; }
    }

    // Message GGA : position et qualité. Latitude / longitude en degrés décimaux, altitudes en m, âge en s.
    public class PositionGga
    {
        public string HeureUtc;
        public double? LatitudeDeg;
        public double? LongitudeDeg;
        public int? Qualite;                    // 0 invalide, 1 autonome, 2 DGNSS, 4 FIXE, 5 FLOTTANT…
        public int? NbSatellites;
        public double? Hdop;
        public double? AltitudeGeoideRecepteurM; // altitude au-dessus du géoïde du récepteur (m)
        public double? SeparationGeoideM;        // écart géoïde du récepteur / ellipsoïde (m)
        public double? AgeCorrectionsS;
        public string StationReference;

        // Hauteur au-dessus de l'ellipsoïde (m) = altitude GGA + séparation ; null s'il en manque une.
        public double? HauteurEllipsoidaleM
        {
            get { return AltitudeGeoideRecepteurM != null && SeparationGeoideM != null ? AltitudeGeoideRecepteurM + SeparationGeoideM : null; }
        }

        public bool EstRtkFixe { get { return Qualite == 4; } }
    }

    // Message $GNETC du récepteur Emlid (compensation d'inclinaison). État 30 = compensation active.
    public class EtatCompensation
    {
        public int? Etat;
        public double? InclinaisonDeg;            // champ 6
        public double? CapDeg;                    // champ 4
        public double? DirectionInclinaisonDeg;   // champ 5
        public bool EstActive { get { return Etat == 30; } }
    }

    // Message GST : écarts-types (m) de la position estimée par le récepteur.
    public class PrecisionGst
    {
        public double? SigmaNordM, SigmaEstM, SigmaAltitudeM;

        // Précision horizontale (m) = √(σ nord² + σ est²).
        public double? HorizontaleM
        {
            get
            {
                if (SigmaNordM == null || SigmaEstM == null) return null;
                return Math.Sqrt(SigmaNordM.Value * SigmaNordM.Value + SigmaEstM.Value * SigmaEstM.Value);
            }
        }
        public double? VerticaleM { get { return SigmaAltitudeM; } }
    }

    // Message GSA : dilution de précision (sans unité).
    public class DilutionGsa
    {
        public double? Pdop, Hdop, Vdop;
    }

    public static class Nmea
    {
        // Découpe une ligne reçue ; null si ce n'est pas une phrase NMEA (elle doit commencer par « $ »).
        public static PhraseNmea LirePhrase(string ligne)
        {
            string texte = (ligne ?? "").Trim();
            if (!texte.StartsWith("$") || texte.Length < 2) return null;
            int etoile = texte.LastIndexOf('*');
            string contenu = etoile > 0 ? texte.Substring(1, etoile - 1) : texte.Substring(1);
            string sommeLue = etoile > 0 ? texte.Substring(etoile + 1) : null;
            string[] morceaux = contenu.Split(',');
            var champs = new string[morceaux.Length - 1];
            Array.Copy(morceaux, 1, champs, 0, champs.Length);
            return new PhraseNmea
            {
                Texte = texte,
                Adresse = morceaux[0],
                Champs = champs,
                SommeOk = sommeLue == null ? (bool?)null : string.Equals(sommeLue, SommeDeControle(contenu), StringComparison.OrdinalIgnoreCase),
            };
        }

        // Somme de contrôle NMEA : « ou exclusif » des caractères entre « $ » et « * », en 2 chiffres hexadécimaux.
        public static string SommeDeControle(string contenu)
        {
            int somme = 0;
            foreach (char c in contenu) somme ^= c;
            return somme.ToString("X2", CultureInfo.InvariantCulture);
        }

        public static PositionGga LireGga(PhraseNmea p)
        {
            if (p == null || p.Type != "GGA") return null;
            return new PositionGga
            {
                HeureUtc = p.Champ(1),
                LatitudeDeg = DegresDepuisNmea(p.Champ(2), p.Champ(3)),
                LongitudeDeg = DegresDepuisNmea(p.Champ(4), p.Champ(5)),
                Qualite = Entier(p.Champ(6)),
                NbSatellites = Entier(p.Champ(7)),
                Hdop = Nombre(p.Champ(8)),
                AltitudeGeoideRecepteurM = Nombre(p.Champ(9)),
                SeparationGeoideM = Nombre(p.Champ(11)),
                AgeCorrectionsS = Nombre(p.Champ(13)),
                StationReference = p.Champ(14),
            };
        }

        public static EtatCompensation LireEtc(PhraseNmea p)
        {
            if (p == null || p.Type != "ETC") return null;
            return new EtatCompensation
            {
                Etat = Entier(p.Champ(2)),
                InclinaisonDeg = Nombre(p.Champ(6)),
                CapDeg = Nombre(p.Champ(4)),
                DirectionInclinaisonDeg = Nombre(p.Champ(5)),
            };
        }

        public static PrecisionGst LireGst(PhraseNmea p)
        {
            if (p == null || p.Type != "GST") return null;
            return new PrecisionGst { SigmaNordM = Nombre(p.Champ(6)), SigmaEstM = Nombre(p.Champ(7)), SigmaAltitudeM = Nombre(p.Champ(8)) };
        }

        // null si ce n'est pas un GSA ou si le récepteur n'a pas de position (fix 1).
        public static DilutionGsa LireGsa(PhraseNmea p)
        {
            if (p == null || p.Type != "GSA") return null;
            if (p.Champ(2) == "1") return null;
            return new DilutionGsa { Pdop = Nombre(p.Champ(15)), Hdop = Nombre(p.Champ(16)), Vdop = Nombre(p.Champ(17)) };
        }

        // Latitude ou longitude NMEA (« ddmm.mmmm » ou « dddmm.mmmm ») en degrés décimaux ; sud et ouest négatifs.
        public static double? DegresDepuisNmea(string valeur, string hemisphere)
        {
            double? nombre = Nombre(valeur);
            if (nombre == null) return null;
            int degres = (int)(nombre.Value / 100);
            double minutes = nombre.Value - degres * 100;
            double resultat = degres + minutes / 60.0;
            return hemisphere == "S" || hemisphere == "W" ? -resultat : resultat;
        }

        public static string LibelleQualite(int? code)
        {
            switch (code)
            {
                case null: return "inconnu";
                case 0: return "pas de position";
                case 1: return "autonome (sans corrections)";
                case 2: return "DGNSS";
                case 4: return "RTK FIXE";
                case 5: return "RTK flottant";
                case 6: return "estimée";
                default: return "code " + code;
            }
        }

        static int? Entier(string t)
        {
            int v;
            return int.TryParse(t, NumberStyles.Integer, CultureInfo.InvariantCulture, out v) ? v : (int?)null;
        }

        static double? Nombre(string t)
        {
            double v;
            return double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : (double?)null;
        }
    }

    // Réponse à « peut-on prendre un point maintenant ? ».
    public class Autorisation
    {
        public bool Autorise;
        public string Raison;
        public Autorisation(bool autorise, string raison) { Autorise = autorise; Raison = raison; }
    }

    public static class PriseDePoint
    {
        // Même règle que l'APK (validée sur le terrain le 21.10.2026) : position de moins de 2 s,
        // RTK fixe (GGA qualité 4), compensation d'inclinaison prête (ETC état 30, de moins de 2 s).
        public static Autorisation Autoriser(PositionGga gga, long? ageGgaMs, EtatCompensation compensation, long? ageEtcMs, long delaiMaxMs = 2000)
        {
            if (gga == null || ageGgaMs == null || ageGgaMs > delaiMaxMs) return new Autorisation(false, "Pas de position récente du récepteur");
            if (!gga.EstRtkFixe) return new Autorisation(false, "RTK pas fixe");
            if (compensation == null || ageEtcMs == null || ageEtcMs > delaiMaxMs) return new Autorisation(false, "État de l'inclinaison inconnu");
            if (!compensation.EstActive) return new Autorisation(false, "Inclinaison NON PRÊTE : bougez la canne");
            return new Autorisation(true, "Prêt");
        }
    }
}
