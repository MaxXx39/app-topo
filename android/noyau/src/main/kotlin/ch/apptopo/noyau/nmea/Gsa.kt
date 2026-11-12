package ch.apptopo.noyau.nmea

/**
 * Dilution de précision (DOP) d'un message GSA, sans unité : plus la valeur est petite, meilleure est la géométrie des satellites.
 * Format NMEA 0183 : $GNGSA,mode,fix,sat1..sat12,PDOP,HDOP,VDOP[,identifiant du système]. PDOP = champ 15, HDOP = 16, VDOP = 17.
 * Un récepteur multi-constellations envoie un GSA par système (la valeur est la même pour tous).
 */
data class DilutionGsa(
    val pdop: Double?,
    val hdop: Double?,
    val vdop: Double?,
)

/** Lit un message GSA. Renvoie null si la phrase n'est pas un GSA ou si le récepteur n'a pas de position (fix 1 = pas de fix). */
fun lireGsa(phrase: PhraseNmea): DilutionGsa? {
    if (phrase.type != "GSA") return null
    if (phrase.champ(2) == "1") return null
    return DilutionGsa(
        pdop = phrase.champ(15).toDoubleOrNull(),
        hdop = phrase.champ(16).toDoubleOrNull(),
        vdop = phrase.champ(17).toDoubleOrNull(),
    )
}
