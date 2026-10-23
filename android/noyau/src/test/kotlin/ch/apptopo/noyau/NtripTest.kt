package ch.apptopo.noyau

import ch.apptopo.noyau.ntrip.ClientNtrip
import ch.apptopo.noyau.ntrip.EtatNtrip
import ch.apptopo.noyau.ntrip.ReglagesNtrip
import ch.apptopo.noyau.ntrip.Remonteur
import ch.apptopo.noyau.ntrip.ReponseNtrip
import ch.apptopo.noyau.ntrip.ggaPourServeur
import ch.apptopo.noyau.ntrip.lireReponseNtrip
import ch.apptopo.noyau.ntrip.requeteNtrip
import java.io.ByteArrayOutputStream
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Tests des corrections par internet (NTRIP) : requête, réponses, morceaux, client complet. */
class NtripTest {
    private val gga = "\$GNGGA,081500.00,4624.0000,N,00614.0000,E,4,30,0.6,419.06,M,47.234,M,1.0,1935*7A"
    private fun reglages(port: Int = 2101, motDePasse: String = "secret") =
        ReglagesNtrip("127.0.0.1", port, "MSM_GISGEO_LV95LHN95", "max", motDePasse)

    @Test
    fun `requete NTRIP 1 avec identifiants en Basic`() {
        val requete = requeteNtrip(reglages())
        assertTrue(requete.startsWith("GET /MSM_GISGEO_LV95LHN95 HTTP/1.0\r\n"))
        // « max:secret » en base64
        assertTrue(requete.contains("Authorization: Basic bWF4OnNlY3JldA==\r\n"))
        assertTrue(requete.endsWith("\r\n\r\n"))
    }

    @Test
    fun `reponses du serveur`() {
        assertEquals(ReponseNtrip.Acceptee(decoupe = false), lireReponseNtrip("ICY 200 OK"))
        assertEquals(ReponseNtrip.Acceptee(decoupe = true), lireReponseNtrip("HTTP/1.1 200 OK", listOf("Transfer-Encoding: chunked")))
        val refus = lireReponseNtrip("HTTP/1.1 401 Unauthorized") as ReponseNtrip.Refusee
        assertTrue(refus.definitif)
        assertTrue(refus.raison.contains("mot de passe"))
        assertTrue((lireReponseNtrip("SOURCETABLE 200 OK") as ReponseNtrip.Refusee).raison.contains("point de montage"))
        assertTrue(!(lireReponseNtrip("bonjour") as ReponseNtrip.Refusee).definitif)
    }

    @Test
    fun `reglages incomplets`() {
        assertEquals("mot de passe manquant", reglages(motDePasse = "").manque())
        assertNull(reglages().manque())
    }

    @Test
    fun `donnees par morceaux remises bout a bout, quel que soit le decoupage`() {
        val envoye = "4\r\nABCD\r\n3\r\nEFG\r\n0\r\n\r\n".toByteArray()
        val remonteur = Remonteur()
        val recu = ByteArrayOutputStream()
        for (octet in envoye) recu.write(remonteur.ajouter(byteArrayOf(octet)))
        assertEquals("ABCDEFG", recu.toString())
    }

    @Test
    fun `GGA envoyee au serveur seulement si c'est une GGA`() {
        assertEquals("$gga\r\n", ggaPourServeur(gga))
        assertNull(ggaPourServeur("\$GNRMC,081500.00,A"))
        assertNull(ggaPourServeur(null))
    }

    @Test
    fun `client complet avec un faux serveur local`() {
        val serveur = ServerSocket(0)
        val requeteRecue = StringBuilder()
        val corrections = byteArrayOf(0xD3.toByte(), 0x00, 0x13, 0x3E, 0xD7.toByte())
        thread(isDaemon = true) {
            serveur.accept().use { client ->
                val entree = client.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                while (true) {
                    val ligne = entree.readLine() ?: break
                    requeteRecue.append(ligne).append('\n')
                    if (ligne.isEmpty()) break
                }
                // Le serveur accepte, puis la GGA arrive, puis les corrections partent.
                val sortie = client.getOutputStream()
                sortie.write("ICY 200 OK\r\n".toByteArray())
                sortie.flush()
                requeteRecue.append(entree.readLine()).append('\n')
                sortie.write(corrections)
                sortie.flush()
                Thread.sleep(300)
            }
        }
        val recues = ByteArrayOutputStream()
        val etats = CopyOnWriteArrayList<EtatNtrip>()
        val client = ClientNtrip({ gga }, { synchronized(recues) { recues.write(it) } }, { etats.add(it) }, attenteReconnexionMs = 60_000)
        client.demarrer(reglages(serveur.localPort))
        val fin = System.currentTimeMillis() + 5_000
        while (synchronized(recues) { recues.size() } < corrections.size && System.currentTimeMillis() < fin) Thread.sleep(20)
        client.arreter()
        serveur.close()

        assertContentEquals(corrections, synchronized(recues) { recues.toByteArray() })
        assertTrue(requeteRecue.contains("GET /MSM_GISGEO_LV95LHN95 HTTP/1.0"), requeteRecue.toString())
        assertTrue(requeteRecue.contains(gga), "la GGA doit être envoyée au serveur")
        assertTrue(etats.any { it.etat == "recoit" && it.octets == corrections.size.toLong() })
        assertEquals("arrete", client.etat.etat)
    }

    @Test
    fun `mot de passe refuse, le client s arrete et le dit`() {
        val serveur = ServerSocket(0)
        thread(isDaemon = true) {
            serveur.accept().use { client ->
                val entree = client.getInputStream().bufferedReader()
                while ((entree.readLine() ?: "").isNotEmpty()) Unit
                client.getOutputStream().write("HTTP/1.1 401 Unauthorized\r\n\r\n".toByteArray())
                client.getOutputStream().flush()
                Thread.sleep(300)
            }
        }
        val client = ClientNtrip({ gga }, {}, {})
        client.demarrer(reglages(serveur.localPort))
        val fin = System.currentTimeMillis() + 5_000
        while (client.etat.etat != "erreur" && System.currentTimeMillis() < fin) Thread.sleep(20)
        serveur.close()
        assertEquals("erreur", client.etat.etat)
        assertTrue(client.etat.message.contains("mot de passe"))
    }
}
