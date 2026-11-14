using System;
using System.Collections.Generic;
using System.Device.Location;

namespace Topo
{
    // Position donnée par Windows (GPS de la tablette, sinon Wi-Fi), seulement pour se localiser sur le plan
    // quand aucun récepteur n'est connecté : même rôle que PositionTablette.kt de l'APK. Précision de quelques
    // mètres : jamais utilisée pour prendre un point, implanter, contrôler ou guider.
    // Windows demande d'activer « Localisation » dans ses paramètres (Confidentialité).
    public class PositionTablette
    {
        GeoCoordinateWatcher ecoute;
        GeoCoordinate derniere;
        DateTime heureDerniere;

        public void Demarrer()
        {
            if (ecoute != null) return;
            try
            {
                ecoute = new GeoCoordinateWatcher(GeoPositionAccuracy.High);
                ecoute.MovementThreshold = 0;
                ecoute.PositionChanged += (expediteur, e) =>
                {
                    if (e.Position == null || e.Position.Location == null || e.Position.Location.IsUnknown) return;
                    derniere = e.Position.Location;
                    heureDerniere = DateTime.UtcNow;
                };
                ecoute.Start();
            }
            catch (Exception)
            {
                ecoute = null; // localisation indisponible sur cette tablette : pas de position, rien d'autre ne change
            }
        }

        public void Arreter()
        {
            if (ecoute == null) return;
            try { ecoute.Stop(); ecoute.Dispose(); }
            catch (Exception) { /* déjà arrêtée */ }
            ecoute = null;
            derniere = null;
        }

        // { est, nord, precision (m) } en texte JSON, ou "null" sans position de moins de 30 s.
        public string EnJson()
        {
            GeoCoordinate p = derniere;
            if (p == null || (DateTime.UtcNow - heureDerniere).TotalSeconds > 30) return "null";
            if (double.IsNaN(p.HorizontalAccuracy)) return "null";
            // Sans altitude connue : 500 m (comme l'APK) ; l'effet sur Est / Nord est négligeable ici.
            double hauteur = double.IsNaN(p.Altitude) ? 500.0 : p.Altitude;
            PointMn95 point = Mn95.DepuisEtrs89(p.Latitude, p.Longitude, hauteur);
            return Json.Ecrire(new Dictionary<string, object> { { "est", point.Est }, { "nord", point.Nord }, { "precision", p.HorizontalAccuracy } });
        }
    }
}
