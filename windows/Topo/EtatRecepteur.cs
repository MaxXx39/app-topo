using System;
using System.Collections.Generic;
using System.Text;

namespace Topo
{
    // Tout ce que l'appli sait du récepteur à l'instant présent : même rôle et MÊME TEXTE JSON que
    // EtatRecepteur.kt de l'APK (la page web ne voit pas la différence). Les données arrivent par le fil
    // de lecture du port COM ; la page les reçoit 5 fois par seconde.
    public class EtatRecepteur
    {
        const long DELAI_RECENT_MS = 2000;   // au-delà, une donnée n'est plus « actuelle »

        public readonly RecepteurSerie Liaison;
        public readonly ClientNtrip Corrections;

        // Essai à 2 récepteurs : les mêmes corrections sont aussi envoyées au 2e récepteur.
        public volatile Action<byte[]> CopieCorrections;

        // Une position reçue : le GGA, sa conversion et l'heure de réception, toujours lus ensemble.
        class Mesure
        {
            public PositionGga Gga;
            public PositionSuisse Position;
            public long HeureMs;
        }

        // Une donnée et son heure de réception, lues ensemble.
        class Datee<T> where T : class
        {
            public T Valeur;
            public long HeureMs;
        }

        volatile Mesure derniereMesure;
        volatile Datee<string> derniereGgaBrute;
        volatile Datee<EtatCompensation> derniereCompensation;
        volatile Datee<PrecisionGst> dernierePrecision;
        volatile Datee<DilutionGsa> derniereDilution;
        volatile string erreurConversion;

        readonly Func<GrilleGeoide> grille;

        // Journal NMEA : toutes les lignes reçues, telles quelles, pendant un temps donné.
        readonly StringBuilder journal = new StringBuilder();
        int journalDejaLu;                   // nombre de caractères déjà remis à la page
        long finJournalMs;

        public volatile string EtatLiaison = "non connecté";
        public volatile bool Connecte;

        public EtatRecepteur(Func<GrilleGeoide> grille)
        {
            this.grille = grille;
            Liaison = new RecepteurSerie(SurLigneNmea, SurEtatLiaison);
            Corrections = new ClientNtrip(
                () =>
                {
                    Datee<string> gga = derniereGgaBrute;
                    return gga != null && Horloge.Ms() - gga.HeureMs <= DELAI_RECENT_MS ? gga.Valeur : null;
                },
                octets =>
                {
                    bool ecrit = Liaison.Ecrire(octets);
                    Action<byte[]> copie = CopieCorrections;
                    if (copie != null) copie(octets);
                    return ecrit;
                },
                etat => { });
        }

        static long? Age(long? heureMs) { return heureMs == null ? (long?)null : Horloge.Ms() - heureMs.Value; }

        static T Recent<T>(Datee<T> donnee) where T : class
        {
            return donnee != null && Horloge.Ms() - donnee.HeureMs <= DELAI_RECENT_MS ? donnee.Valeur : null;
        }

        // Peut-on prendre un point maintenant ? (RTK fixe + inclinaison prête, données récentes)
        public Autorisation Autorisation()
        {
            Mesure m = derniereMesure;
            Datee<EtatCompensation> c = derniereCompensation;
            return PriseDePoint.Autoriser(m == null ? null : m.Gga, Age(m == null ? (long?)null : m.HeureMs),
                c == null ? null : c.Valeur, Age(c == null ? (long?)null : c.HeureMs));
        }

        // Oublie la position (après une déconnexion), pour ne jamais afficher une position périmée.
        public void Oublier(string texte)
        {
            derniereMesure = null;
            derniereCompensation = null;
            dernierePrecision = null;
            derniereDilution = null;
            Connecte = false;
            EtatLiaison = texte;
        }

        // ---------- Journal NMEA ----------

        public void DemarrerJournal(long dureeMs)
        {
            lock (journal) { journal.Clear(); journalDejaLu = 0; }
            finJournalMs = Horloge.Ms() + dureeMs;
        }

        // Lignes du journal arrivées depuis la dernière lecture (ou "" s'il n'y a rien de nouveau).
        public string SuiteDuJournal()
        {
            lock (journal)
            {
                if (journal.Length <= journalDejaLu) return "";
                string suite = journal.ToString(journalDejaLu, journal.Length - journalDejaLu);
                journalDejaLu = journal.Length;
                return suite;
            }
        }

        // ---------- Textes JSON pour la page ----------

        // État envoyé à la page : mêmes noms que l'APK (voir src/android/pont.js, ecouterRecepteur).
        public string EnJson(string nomDernierRecepteur)
        {
            Mesure mesure = derniereMesure;
            bool recu = mesure != null && Horloge.Ms() - mesure.HeureMs <= DELAI_RECENT_MS;
            EtatCompensation compensation = Recent(derniereCompensation);
            Autorisation autorisation = Autorisation();
            var o = new Dictionary<string, object>();
            o["connecte"] = Connecte;
            o["bluetooth"] = EtatLiaison;
            o["dernierRecepteur"] = nomDernierRecepteur;
            o["recu"] = recu;
            if (recu)
            {
                PositionGga gga = mesure.Gga;
                o["qualite"] = gga.Qualite;
                o["libelleQualite"] = Nmea.LibelleQualite(gga.Qualite);
                o["nbSatellites"] = gga.NbSatellites;
                o["hdop"] = gga.Hdop;
                o["ageCorrections"] = gga.AgeCorrectionsS;
                o["position"] = mesure.Position == null ? null : PositionEnJson(mesure.Position);
            }
            o["etatInclinaison"] = compensation == null ? null : (object)compensation.Etat;
            o["inclinaisonPrete"] = compensation != null && compensation.EstActive;
            o["inclinaison"] = compensation == null ? null : (object)compensation.InclinaisonDeg;
            o["directionInclinaison"] = compensation == null ? null : (object)compensation.DirectionInclinaisonDeg;
            // Cap du récepteur (°), seulement quand la compensation est prête.
            o["cap"] = compensation != null && compensation.EstActive ? (object)compensation.CapDeg : null;
            PrecisionGst precision = Recent(dernierePrecision);
            o["precisionH"] = precision == null ? null : (object)precision.HorizontaleM;
            o["precisionV"] = precision == null ? null : (object)precision.VerticaleM;
            o["pdop"] = PdopRecent();
            o["erreurConversion"] = erreurConversion;
            o["autorise"] = autorisation.Autorise;
            o["raison"] = autorisation.Raison;
            o["corrections"] = CorrectionsEnJson();
            return Json.Ecrire(o);
        }

        // Corrections par internet : { etat, message, octets, age (s depuis les dernières corrections, ou null) }.
        Dictionary<string, object> CorrectionsEnJson()
        {
            EtatNtrip etat = Corrections.Etat;
            var o = new Dictionary<string, object>();
            o["etat"] = etat.Etat;
            o["message"] = etat.Message;
            o["octets"] = etat.Octets;
            o["octetsTransmis"] = etat.OctetsTransmis;
            o["age"] = etat.HeureDerniereMs == null ? null : (object)((Horloge.Ms() - etat.HeureDerniereMs.Value) / 1000.0);
            return o;
        }

        // Point à prendre maintenant : { ok: true, point: {...} } ou { ok: false, raison } si la règle le refuse.
        public string PointEnJson()
        {
            Mesure mesure = derniereMesure;
            Autorisation autorisation = Autorisation();
            var reponse = new Dictionary<string, object>();
            if (!autorisation.Autorise || mesure == null || mesure.Position == null)
            {
                reponse["ok"] = false;
                reponse["raison"] = !autorisation.Autorise ? autorisation.Raison : (erreurConversion ?? "Position hors de Suisse");
                return Json.Ecrire(reponse);
            }
            Dictionary<string, object> point = PositionEnJson(mesure.Position);
            point["qualite"] = mesure.Gga.Qualite;
            point["nbSatellites"] = mesure.Gga.NbSatellites;
            point["hdop"] = mesure.Gga.Hdop;
            point["ageCorrections"] = mesure.Gga.AgeCorrectionsS;
            Datee<EtatCompensation> c = derniereCompensation;
            point["inclinaison"] = c == null ? null : (object)c.Valeur.InclinaisonDeg;
            PrecisionGst precision = Recent(dernierePrecision);
            point["precisionH"] = precision == null ? null : (object)precision.HorizontaleM;
            point["precisionV"] = precision == null ? null : (object)precision.VerticaleM;
            point["pdop"] = PdopRecent();
            point["heureUtc"] = mesure.Gga.HeureUtc;
            reponse["ok"] = true;
            reponse["point"] = point;
            return Json.Ecrire(reponse);
        }

        // PDOP du dernier GSA, seulement s'il est récent (sinon null : on n'invente rien).
        object PdopRecent()
        {
            DilutionGsa d = Recent(derniereDilution);
            return d == null ? null : (object)d.Pdop;
        }

        static Dictionary<string, object> PositionEnJson(PositionSuisse p)
        {
            var o = new Dictionary<string, object>();
            o["est"] = p.Est;
            o["nord"] = p.Nord;
            o["altitude"] = p.Altitude;
            return o;
        }

        // ---------- Réception ----------

        // Appelé (depuis le fil de lecture) pour chaque ligne reçue du récepteur.
        public void SurLigneNmea(string ligne)
        {
            long maintenant = Horloge.Ms();
            // Journal : la ligne brute, avant toute lecture (au plus 2 millions de caractères).
            if (maintenant < finJournalMs) lock (journal) { if (journal.Length < 2000000) journal.Append(ligne).Append("\r\n"); }
            PhraseNmea phrase = Nmea.LirePhrase(ligne);
            if (phrase == null || phrase.SommeOk == false) return;
            switch (phrase.Type)
            {
                case "GGA":
                    derniereGgaBrute = new Datee<string> { Valeur = ligne, HeureMs = maintenant };
                    PositionGga gga = Nmea.LireGga(phrase);
                    if (gga != null) derniereMesure = new Mesure { Gga = gga, Position = Convertir(gga), HeureMs = maintenant };
                    break;
                case "ETC":
                    derniereCompensation = new Datee<EtatCompensation> { Valeur = Nmea.LireEtc(phrase), HeureMs = maintenant };
                    break;
                case "GST":
                    dernierePrecision = new Datee<PrecisionGst> { Valeur = Nmea.LireGst(phrase), HeureMs = maintenant };
                    break;
                case "GSA":
                    // Un GSA par système satellite : on garde le dernier qui a un PDOP.
                    DilutionGsa d = Nmea.LireGsa(phrase);
                    if (d != null && d.Pdop != null) derniereDilution = new Datee<DilutionGsa> { Valeur = d, HeureMs = maintenant };
                    break;
            }
        }

        // Convertit un GGA en MN95 / RAN95, sans jamais faire planter l'appli.
        PositionSuisse Convertir(PositionGga gga)
        {
            try
            {
                erreurConversion = null;
                return Mn95.VersPositionSuisse(gga, grille());
            }
            catch (Exception erreur)
            {
                erreurConversion = "conversion impossible : " + erreur.Message;
                return null;
            }
        }

        void SurEtatLiaison(string texte, bool estConnecte)
        {
            if (!estConnecte) Oublier(texte);
            EtatLiaison = texte;
            Connecte = estConnecte;
        }
    }
}
