package ch.apptopo.noyau

import ch.apptopo.noyau.ntrip.DecoupeurRtcm
import ch.apptopo.noyau.ntrip.crc24q
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

/** Essai 0.272.0 : découpage des corrections RTCM 3 en messages entiers. */
class RtcmTest {
    private fun octets(vararg v: Int) = ByteArray(v.size) { v[it].toByte() }

    // Deux vrais messages (contrôle CRC-24Q calculé à part) : 8 octets de données, puis 4 octets de données.
    private val message1 = octets(0xD3, 0x00, 0x08, 0x3E, 0xD0, 0x00, 0x03, 0x8A, 0x00, 0x00, 0x00, 0xF0, 0x70, 0xA5)
    private val message2 = octets(0xD3, 0x00, 0x04, 0x43, 0xF0, 0x01, 0x02, 0x17, 0xD4, 0xAB)

    @Test
    fun `le controle CRC-24Q donne la valeur officielle`() {
        assertEquals(0xCDE703, crc24q("123456789".toByteArray()))
    }

    @Test
    fun `deux messages d'un coup sortent un par un`() {
        val sortie = DecoupeurRtcm().ajouter(message1 + message2)
        assertEquals(2, sortie.size)
        assertContentEquals(message1, sortie[0])
        assertContentEquals(message2, sortie[1])
    }

    @Test
    fun `un message coupe en deux sort quand il est complet`() {
        val d = DecoupeurRtcm()
        assertEquals(0, d.ajouter(message1.copyOfRange(0, 6)).size)
        val sortie = d.ajouter(message1.copyOfRange(6, message1.size) + message2.copyOfRange(0, 3))
        assertEquals(1, sortie.size)
        assertContentEquals(message1, sortie[0])
        val suite = d.ajouter(message2.copyOfRange(3, message2.size))
        assertEquals(1, suite.size)
        assertContentEquals(message2, suite[0])
    }

    @Test
    fun `les octets avant un message et un message abime sont jetes`() {
        val abime = message1.copyOf().also { it[5] = 0x55 }
        val d = DecoupeurRtcm()
        val sortie = d.ajouter(octets(0x01, 0x02) + abime + message2)
        assertEquals(1, sortie.size)
        assertContentEquals(message2, sortie[0])
        assertEquals(true, d.octetsJetes >= 2 + abime.size)
    }

    @Test
    fun `octet par octet donne le meme resultat`() {
        val d = DecoupeurRtcm()
        val recus = mutableListOf<ByteArray>()
        for (b in message1 + message2) recus += d.ajouter(byteArrayOf(b))
        assertEquals(2, recus.size)
        assertContentEquals(message1, recus[0])
        assertContentEquals(message2, recus[1])
    }
}
