package ch.apptopo.noyau.leve

import ch.apptopo.noyau.nmea.EtatCompensation
import ch.apptopo.noyau.nmea.PositionGga

// Repris d'Emlid Stock (règle validée sur le terrain le 21.10.2026).

/** Réponse à « peut-on prendre un point maintenant ? » : vrai, ou faux avec la raison à afficher. */
data class Autorisation(val autorise: Boolean, val raison: String)

/**
 * Règle de prise de point (test terrain n° 3 d'Emlid Stock) : le point n'est accepté que si
 * - le récepteur a envoyé une position il y a moins de [delaiMaxMs] ;
 * - le statut RTK est « fixe » (GGA qualité 4) ;
 * - la compensation d'inclinaison est prête (ETC état 30, reçu il y a moins de [delaiMaxMs]).
 *   Sinon, le RX2 envoie la position de l'antenne et non celle du bout de canne.
 */
fun autoriserPriseDePoint(
    gga: PositionGga?,
    ageGgaMs: Long?,
    compensation: EtatCompensation?,
    ageEtcMs: Long?,
    delaiMaxMs: Long = 2_000,
): Autorisation = when {
    gga == null || ageGgaMs == null || ageGgaMs > delaiMaxMs ->
        Autorisation(false, "Pas de position récente du récepteur")
    !gga.estRtkFixe ->
        Autorisation(false, "RTK pas fixe")
    compensation == null || ageEtcMs == null || ageEtcMs > delaiMaxMs ->
        Autorisation(false, "État de l'inclinaison inconnu")
    !compensation.estActive ->
        Autorisation(false, "Inclinaison NON PRÊTE : bougez la canne")
    else -> Autorisation(true, "Prêt")
}
