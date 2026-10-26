package ch.apptopo

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import ch.apptopo.noyau.coordonnees.etrs89VersMn95
import org.json.JSONObject

/**
 * GPS de la tablette (ou du téléphone), seulement pour se localiser sur le plan quand aucun RX2
 * n'est connecté (demande du 26.10.2026). Précision de quelques mètres : jamais utilisé pour
 * prendre un point, implanter, contrôler ou guider la lame (la page ne reçoit qu'Est, Nord et la
 * précision, à part de l'état du récepteur).
 * Conversion en MN95 : même calcul exact que pour le RX2 (WGS84 du téléphone pris comme ETRS89 :
 * moins d'un mètre d'écart, bien en dessous de la précision du GPS du téléphone).
 */
class PositionTablette(private val contexte: Context) : LocationListener {

    private val gestionnaire = contexte.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var derniere: Location? = null
    var enMarche = false
        private set

    /** Démarre l'écoute du GPS (et du réseau, s'il y en a) ; la permission doit être accordée. */
    @SuppressLint("MissingPermission") // vérifiée par EcranPrincipal avant l'appel
    fun demarrer() {
        if (enMarche) return
        for (fournisseur in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            if (!gestionnaire.allProviders.contains(fournisseur)) continue
            try {
                gestionnaire.requestLocationUpdates(fournisseur, 1000L, 0f, this, Looper.getMainLooper())
                enMarche = true
            } catch (erreur: Exception) {
                // fournisseur indisponible : on essaie l'autre
            }
        }
    }

    fun arreter() {
        if (!enMarche) return
        gestionnaire.removeUpdates(this)
        enMarche = false
        derniere = null
    }

    override fun onLocationChanged(position: Location) {
        // On garde la plus précise des récentes (le GPS l'emporte sur le réseau quand il est là).
        val ancienne = derniere
        val recente = ancienne == null || position.time - ancienne.time > 5000 || position.accuracy <= ancienne.accuracy
        if (recente) derniere = position
    }

    @Deprecated("Ancienne méthode Android, sans effet ici")
    override fun onStatusChanged(fournisseur: String?, statut: Int, extras: Bundle?) {}
    override fun onProviderEnabled(fournisseur: String) {}
    override fun onProviderDisabled(fournisseur: String) {}

    /** { est, nord, precision (m) } en texte JSON, ou "null" sans position récente (moins de 30 s). */
    fun enJson(): String {
        val position = derniere ?: return "null"
        if (System.currentTimeMillis() - position.time > 30_000) return "null"
        val hauteur = if (position.hasAltitude()) position.altitude else 500.0
        val point = etrs89VersMn95(position.latitude, position.longitude, hauteur)
        return JSONObject()
            .put("est", point.est)
            .put("nord", point.nord)
            .put("precision", position.accuracy.toDouble())
            .toString()
    }
}
