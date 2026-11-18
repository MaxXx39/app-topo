package ch.apptopo.noyau.ntrip

/**
 * Découpage des corrections RTCM 3 en messages entiers (essai 0.272.0, Stonex S800 / S900).
 *
 * Un message RTCM 3 = 0xD3, 6 bits à zéro + longueur (10 bits), les données, puis 3 octets de contrôle
 * (CRC-24Q, calculé sur tout ce qui précède). Le serveur NTRIP envoie un flux continu qui peut couper
 * un message en deux ; ici on ne rend que des messages complets dont le contrôle est bon, un par un.
 * Ce qui n'est pas un message complet (octets avant le premier 0xD3, message abîmé) est jeté.
 */

/** Contrôle CRC-24Q (polynôme 0x1864CFB, départ 0, sans inversion) des octets [debut, fin). */
fun crc24q(octets: ByteArray, debut: Int = 0, fin: Int = octets.size): Int {
    var crc = 0
    for (i in debut until fin) {
        crc = crc xor ((octets[i].toInt() and 0xFF) shl 16)
        repeat(8) {
            crc = crc shl 1
            if (crc and 0x1000000 != 0) crc = crc xor 0x1864CFB
        }
    }
    return crc and 0xFFFFFF
}

class DecoupeurRtcm {
    private var tampon = ByteArray(0)

    /** Nombre d'octets jetés depuis le début (hors message RTCM complet et valide), pour le diagnostic. */
    var octetsJetes = 0L
        private set

    /** Ajoute les [nombre] premiers octets reçus ; renvoie les messages complets, dans l'ordre. */
    fun ajouter(octets: ByteArray, nombre: Int = octets.size): List<ByteArray> {
        tampon += octets.copyOf(nombre)
        val messages = mutableListOf<ByteArray>()
        var debut = 0
        while (true) {
            // Cherche le début d'un message.
            while (debut < tampon.size && tampon[debut] != PREAMBULE) {
                debut++
                octetsJetes++
            }
            if (tampon.size - debut < 3) break
            // Les 6 bits qui suivent doivent être à zéro : sinon ce n'est pas un début de message.
            if (tampon[debut + 1].toInt() and 0xFC != 0) {
                debut++
                octetsJetes++
                continue
            }
            val longueur = ((tampon[debut + 1].toInt() and 0x03) shl 8) or (tampon[debut + 2].toInt() and 0xFF)
            val total = longueur + 6
            if (tampon.size - debut < total) break // message pas encore arrivé en entier
            val attendu = ((tampon[debut + total - 3].toInt() and 0xFF) shl 16) or
                ((tampon[debut + total - 2].toInt() and 0xFF) shl 8) or
                (tampon[debut + total - 1].toInt() and 0xFF)
            if (crc24q(tampon, debut, debut + total - 3) == attendu) {
                messages.add(tampon.copyOfRange(debut, debut + total))
                debut += total
            } else {
                debut++ // contrôle faux : on repart un octet plus loin
                octetsJetes++
            }
        }
        tampon = tampon.copyOfRange(debut, tampon.size)
        // Garde-fou : jamais plus de 2 messages maximum en attente (un message fait au plus 1 029 octets).
        if (tampon.size > 2 * (1023 + 6)) {
            octetsJetes += tampon.size
            tampon = ByteArray(0)
        }
        return messages
    }

    private companion object {
        const val PREAMBULE: Byte = 0xD3.toByte()
    }
}
