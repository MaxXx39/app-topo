package ch.apptopo.noyau

import ch.apptopo.noyau.leve.autoriserPriseDePoint
import ch.apptopo.noyau.nmea.EtatCompensation
import ch.apptopo.noyau.nmea.PositionGga
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PriseDePointTest {

    private fun gga(qualite: Int) = PositionGga(
        heureUtc = "120000.00", latitudeDeg = 46.38, longitudeDeg = 6.19, qualite = qualite, nbSatellites = 27,
        hdop = 0.6, altitudeGeoideRecepteurM = 462.0, separationGeoideM = 47.2, ageCorrectionsS = 1.0,
        stationReference = "3866",
    )

    private val pret = EtatCompensation(etat = 30, inclinaisonDeg = 5.0)

    @Test
    fun `prise de point autorisee seulement en RTK fixe avec inclinaison prete`() {
        assertTrue(autoriserPriseDePoint(gga(4), 200, pret, 200).autorise)
        assertEquals("RTK pas fixe", autoriserPriseDePoint(gga(5), 200, pret, 200).raison)
        assertFalse(autoriserPriseDePoint(gga(4), 200, EtatCompensation(20, null), 200).autorise)
        assertFalse(autoriserPriseDePoint(gga(4), 200, null, null).autorise)
        assertFalse(autoriserPriseDePoint(gga(4), 5_000, pret, 200).autorise)
        assertFalse(autoriserPriseDePoint(null, null, pret, 200).autorise)
        assertFalse(autoriserPriseDePoint(gga(4), 200, pret, 5_000).autorise)
    }
}
