package ch.apptopo.noyau.nmea

/**
 * Contenu utile du message $GNETC du RX2 (compensation d'inclinaison).
 *
 * Ordre des champs selon la doc Emlid « NMEA specification » et le test terrain du 20.10.2026 :
 * 1 heure UTC, 2 état, 3 notification, 4 cap, 5 direction de l'inclinaison, 6 valeur de l'inclinaison (°)…
 * État 30 = compensation active (observé sur le terrain) ; les autres codes ne sont pas encore identifiés.
 */
data class EtatCompensation(
    val etat: Int?,
    val inclinaisonDeg: Double?,
    /**
     * Champ 4 « cap » (°) : semble être l'orientation du récepteur (de 0 à 360°), à confirmer
     * sur le terrain (tourner le RX2 vers le nord, l'est, le sud, l'ouest). Rempli seulement à l'état 30.
     */
    val capDeg: Double? = null,
    /** Champ 5 : direction vers laquelle la tête de canne penche (°, azimut ; test terrain n° 2). */
    val directionInclinaisonDeg: Double? = null,
) {
    val estActive: Boolean
        get() = etat == 30
}

/** Lit un message ETC. Renvoie null si la phrase n'est pas un ETC. */
fun lireEtc(phrase: PhraseNmea): EtatCompensation? {
    if (phrase.type != "ETC") return null
    return EtatCompensation(
        etat = phrase.champ(2).toIntOrNull(),
        inclinaisonDeg = phrase.champ(6).toDoubleOrNull(),
        capDeg = phrase.champ(4).toDoubleOrNull(),
        directionInclinaisonDeg = phrase.champ(5).toDoubleOrNull(),
    )
}
