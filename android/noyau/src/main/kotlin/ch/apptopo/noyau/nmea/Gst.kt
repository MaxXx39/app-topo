package ch.apptopo.noyau.nmea

import kotlin.math.sqrt

/**
 * Contenu utile d'un message GST (précision de la position estimée par le récepteur), en mètres,
 * écarts-types (1 sigma) : champ 6 latitude (nord), 7 longitude (est), 8 altitude.
 * Format NMEA 0183 : $GNGST,heure,rms,demi-grand axe,demi-petit axe,orientation,σ lat,σ lon,σ alt.
 */
data class PrecisionGst(
    val sigmaNordM: Double?,
    val sigmaEstM: Double?,
    val sigmaAltitudeM: Double?,
) {
    /** Précision horizontale (m) = √(σ nord² + σ est²) ; null s'il manque une valeur. */
    val horizontaleM: Double?
        get() = if (sigmaNordM != null && sigmaEstM != null) sqrt(sigmaNordM * sigmaNordM + sigmaEstM * sigmaEstM) else null

    /** Précision verticale (m) = σ altitude. */
    val verticaleM: Double?
        get() = sigmaAltitudeM
}

/** Lit un message GST. Renvoie null si la phrase n'est pas un GST. */
fun lireGst(phrase: PhraseNmea): PrecisionGst? {
    if (phrase.type != "GST") return null
    return PrecisionGst(
        sigmaNordM = phrase.champ(6).toDoubleOrNull(),
        sigmaEstM = phrase.champ(7).toDoubleOrNull(),
        sigmaAltitudeM = phrase.champ(8).toDoubleOrNull(),
    )
}
