package ch.apptopo

import android.os.SystemClock
import ch.apptopo.noyau.coordonnees.GrilleGeoide
import ch.apptopo.noyau.coordonnees.PositionSuisse
import ch.apptopo.noyau.coordonnees.versPositionSuisse
import ch.apptopo.noyau.leve.Autorisation
import ch.apptopo.noyau.leve.autoriserPriseDePoint
import ch.apptopo.noyau.nmea.EtatCompensation
import ch.apptopo.noyau.nmea.PositionGga
import ch.apptopo.noyau.nmea.PrecisionGst
import ch.apptopo.noyau.nmea.libelleQualite
import ch.apptopo.noyau.nmea.lireEtc
import ch.apptopo.noyau.nmea.lireGga
import ch.apptopo.noyau.nmea.lireGst
import ch.apptopo.noyau.nmea.lirePhraseNmea
import ch.apptopo.noyau.ntrip.ClientNtrip
import org.json.JSONObject

/**
 * Tout ce que l'appli sait du récepteur à l'instant présent (repris d'Emlid Stock) : connexion
 * Bluetooth, dernière position (GGA convertie en MN95 / RAN95), état de l'inclinaison (ETC).
 * Les données arrivent par le fil Bluetooth ; la page les reçoit 5 fois par seconde ([enJson]).
 */
class EtatRecepteur {

    val bluetooth = RecepteurBluetooth(::surLigneNmea, ::surEtatBluetooth)

    // Dernière phrase GGA reçue telle quelle, et son heure : envoyée au serveur de corrections.
    @Volatile private var derniereGgaBrute: String? = null
    @Volatile private var heureGgaBruteMs: Long? = null

    /**
     * Corrections RTK reçues directement par internet (swipos), sans Emlid Flow : le client
     * envoie la GGA récente du RX2 au serveur et écrit les corrections vers le RX2 par Bluetooth.
     */
    val corrections = ClientNtrip(
        ggaActuelle = { derniereGgaBrute.takeIf { (age(heureGgaBruteMs) ?: Long.MAX_VALUE) <= DELAI_RECENT_MS } },
        surCorrections = { octets ->
            bluetooth.ecrire(octets)
            copieCorrections?.invoke(octets)
        },
        surEtat = {},
    )

    /**
     * Essai à 2 récepteurs (demande du 26.10.2026) : les mêmes corrections sont aussi envoyées au
     * 2e récepteur (même flux swipos, calculé près du 1er : les deux sont sur le même engin).
     */
    @Volatile var copieCorrections: ((ByteArray) -> Unit)? = null

    // Grille du géoïde : chargée une seule fois, à la première conversion.
    private val grille: GrilleGeoide by lazy { GrilleGeoide.chgeo2004Lhn95() }

    /** Une position reçue : le GGA, sa conversion MN95 / RAN95 et l'heure de réception, ensemble. */
    class Mesure(val gga: PositionGga, val position: PositionSuisse?, val heureMs: Long)

    // Un seul objet pour que GGA, position et heure soient toujours lus ensemble.
    @Volatile private var derniereMesure: Mesure? = null
    @Volatile private var derniereCompensation: EtatCompensation? = null
    @Volatile private var heureEtcMs: Long? = null
    // Précision estimée par le récepteur (message GST), si le RX2 l'envoie.
    @Volatile private var dernierePrecision: PrecisionGst? = null
    @Volatile private var heureGstMs: Long? = null
    @Volatile private var erreurConversion: String? = null

    @Volatile var etatBluetooth = "non connecté"
        private set
    @Volatile var connecte = false
        private set

    /** Âge (ms) d'une donnée reçue à [heureMs], ou null si jamais reçue. */
    private fun age(heureMs: Long?): Long? = heureMs?.let { SystemClock.elapsedRealtime() - it }

    /** Peut-on prendre un point maintenant ? (RTK fixe + inclinaison prête, données récentes) */
    fun autorisation(): Autorisation {
        val mesure = derniereMesure
        return autoriserPriseDePoint(mesure?.gga, age(mesure?.heureMs), derniereCompensation, age(heureEtcMs))
    }

    /** Oublie la position (après une déconnexion), pour ne jamais afficher une position périmée. */
    fun oublier(texte: String) {
        derniereMesure = null
        derniereCompensation = null
        heureEtcMs = null
        dernierePrecision = null
        heureGstMs = null
        connecte = false
        etatBluetooth = texte
    }

    /**
     * État envoyé à la page (src/android/pont.js) :
     * { connecte, bluetooth, recu, qualite, libelleQualite, nbSatellites, hdop, ageCorrections,
     *   etatInclinaison, inclinaisonPrete, inclinaison, cap, position: { est, nord, altitude } ou null,
     *   precisionH, precisionV (m, message GST récent, sinon null), erreurConversion, autorise, raison }
     */
    fun enJson(nomDernierRecepteur: String?): String {
        val mesure = derniereMesure
        val ageGga = age(mesure?.heureMs)
        val recu = mesure != null && ageGga != null && ageGga <= DELAI_RECENT_MS
        val compensation = derniereCompensation
        val ageEtc = age(heureEtcMs)
        val etcRecent = compensation != null && ageEtc != null && ageEtc <= DELAI_RECENT_MS
        val autorisation = autorisation()
        return JSONObject().apply {
            put("connecte", connecte)
            put("bluetooth", etatBluetooth)
            put("dernierRecepteur", nomDernierRecepteur ?: JSONObject.NULL)
            put("recu", recu)
            if (recu) {
                val gga = mesure!!.gga
                put("qualite", gga.qualite ?: JSONObject.NULL)
                put("libelleQualite", libelleQualite(gga.qualite))
                put("nbSatellites", gga.nbSatellites ?: JSONObject.NULL)
                put("hdop", gga.hdop ?: JSONObject.NULL)
                put("ageCorrections", gga.ageCorrectionsS ?: JSONObject.NULL)
                put("position", mesure.position?.let { positionEnJson(it) } ?: JSONObject.NULL)
            }
            put("etatInclinaison", if (etcRecent) compensation!!.etat ?: JSONObject.NULL else JSONObject.NULL)
            put("inclinaisonPrete", etcRecent && compensation!!.estActive)
            put("inclinaison", if (etcRecent) compensation!!.inclinaisonDeg ?: JSONObject.NULL else JSONObject.NULL)
            // Cap du récepteur (°), seulement quand la compensation est prête (champ vide sinon).
            put("cap", if (etcRecent && compensation!!.estActive) compensation.capDeg ?: JSONObject.NULL else JSONObject.NULL)
            // Précision H / V (m), seulement si un GST récent est arrivé.
            val precision = dernierePrecision.takeIf { (age(heureGstMs) ?: Long.MAX_VALUE) <= DELAI_RECENT_MS }
            put("precisionH", precision?.horizontaleM ?: JSONObject.NULL)
            put("precisionV", precision?.verticaleM ?: JSONObject.NULL)
            put("erreurConversion", erreurConversion ?: JSONObject.NULL)
            put("autorise", autorisation.autorise)
            put("raison", autorisation.raison)
            put("corrections", correctionsEnJson())
        }.toString()
    }

    /**
     * Corrections par internet : { etat ('arrete', 'connexion', 'recoit', 'attente', 'erreur'),
     * message, octets, age (s depuis les dernières corrections reçues, ou null) }.
     */
    private fun correctionsEnJson(): JSONObject {
        val etat = corrections.etat
        val age = etat.heureDerniereDonnee?.let { (corrections.horloge() - it) / 1000.0 }
        return JSONObject()
            .put("etat", etat.etat)
            .put("message", etat.message)
            .put("octets", etat.octets)
            .put("age", age ?: JSONObject.NULL)
    }

    /**
     * Point à prendre maintenant : { ok: true, point: { est, nord, altitude, qualite, nbSatellites,
     * hdop, ageCorrections, inclinaison, precisionH, precisionV, heureUtc } }, ou { ok: false, raison } si la règle le refuse.
     */
    fun pointEnJson(): String {
        val mesure = derniereMesure
        val autorisation = autorisation()
        val position = mesure?.position
        if (!autorisation.autorise || mesure == null || position == null) {
            val raison = if (!autorisation.autorise) autorisation.raison else erreurConversion ?: "Position hors de Suisse"
            return JSONObject().put("ok", false).put("raison", raison).toString()
        }
        val point = positionEnJson(position).apply {
            put("qualite", mesure.gga.qualite ?: JSONObject.NULL)
            put("nbSatellites", mesure.gga.nbSatellites ?: JSONObject.NULL)
            put("hdop", mesure.gga.hdop ?: JSONObject.NULL)
            put("ageCorrections", mesure.gga.ageCorrectionsS ?: JSONObject.NULL)
            put("inclinaison", derniereCompensation?.inclinaisonDeg ?: JSONObject.NULL)
            val precision = dernierePrecision.takeIf { (age(heureGstMs) ?: Long.MAX_VALUE) <= DELAI_RECENT_MS }
            put("precisionH", precision?.horizontaleM ?: JSONObject.NULL)
            put("precisionV", precision?.verticaleM ?: JSONObject.NULL)
            put("heureUtc", mesure.gga.heureUtc)
        }
        return JSONObject().put("ok", true).put("point", point).toString()
    }

    private fun positionEnJson(position: PositionSuisse) =
        JSONObject().put("est", position.est).put("nord", position.nord).put("altitude", position.altitude)

    /** Appelé (depuis le fil Bluetooth) pour chaque ligne reçue du récepteur. */
    private fun surLigneNmea(ligne: String) {
        val maintenant = SystemClock.elapsedRealtime()
        val phrase = lirePhraseNmea(ligne) ?: return
        if (phrase.sommeOk == false) return
        when (phrase.type) {
            "GGA" -> {
                derniereGgaBrute = ligne
                heureGgaBruteMs = maintenant
                lireGga(phrase)?.let { gga -> derniereMesure = Mesure(gga, convertir(gga), maintenant) }
            }
            "ETC" -> {
                derniereCompensation = lireEtc(phrase)
                heureEtcMs = maintenant
            }
            "GST" -> {
                dernierePrecision = lireGst(phrase)
                heureGstMs = maintenant
            }
        }
    }

    /** Convertit un GGA en MN95 / RAN95, sans jamais faire planter l'appli. */
    private fun convertir(gga: PositionGga): PositionSuisse? =
        try {
            erreurConversion = null
            versPositionSuisse(gga, grille)
        } catch (erreur: Exception) {
            erreurConversion = "conversion impossible : ${erreur.message}"
            null
        }

    private fun surEtatBluetooth(texte: String, estConnecte: Boolean) {
        if (!estConnecte) oublier(texte)
        etatBluetooth = texte
        connecte = estConnecte
    }

    companion object {
        // Au-delà, une donnée n'est plus « actuelle » (même délai que la règle de prise de point).
        private const val DELAI_RECENT_MS = 2_000L
    }
}
