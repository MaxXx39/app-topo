package ch.apptopo

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import java.io.IOException
import java.util.UUID
import kotlin.concurrent.thread

/**
 * Connexion Bluetooth au récepteur (RX2) pour lire son flux NMEA, ligne par ligne (repris d'Emlid Stock).
 *
 * On utilise le « port série Bluetooth » (profil SPP), le moyen standard pour recevoir du NMEA.
 * La lecture se fait dans un fil d'exécution séparé, pour ne pas bloquer l'écran.
 *
 * - [surLigne] est appelé pour chaque ligne reçue.
 * - [surEtat] est appelé quand l'état de la connexion change (texte à afficher, et vrai si connecté).
 */
class RecepteurBluetooth(
    private val surLigne: (String) -> Unit,
    private val surEtat: (texte: String, connecte: Boolean) -> Unit,
) {
    @Volatile private var prise: BluetoothSocket? = null

    // Numéro de la connexion en cours : une ancienne connexion qui se termine
    // ne doit pas toucher à la nouvelle.
    @Volatile private var numeroConnexion = 0

    /** Se connecte à l'appareil choisi (déjà appairé au téléphone) et lit le flux. */
    @SuppressLint("MissingPermission") // la permission est vérifiée par l'écran avant l'appel
    fun connecter(appareil: BluetoothDevice) {
        deconnecter()
        val monNumero = ++numeroConnexion
        thread(name = "lecture-nmea") {
            val nom = appareil.name ?: appareil.address
            var maPrise: BluetoothSocket? = null
            try {
                surEtat("connexion à $nom…", false)
                maPrise = ouvrirPrise(appareil)
                if (monNumero != numeroConnexion) return@thread
                prise = maPrise
                surEtat("connecté à $nom", true)
                val lecteur = maPrise.inputStream.bufferedReader(Charsets.US_ASCII)
                while (monNumero == numeroConnexion) {
                    val ligne = lecteur.readLine() ?: break
                    if (ligne.isNotBlank()) surLigne(ligne.trim())
                }
                if (monNumero == numeroConnexion) surEtat("connexion coupée par le récepteur", false)
            } catch (erreur: IOException) {
                if (monNumero == numeroConnexion) surEtat("échec de la connexion à $nom : ${erreur.message}", false)
            } catch (erreur: SecurityException) {
                surEtat("permission Bluetooth refusée", false)
            } finally {
                fermer(maPrise)
                if (monNumero == numeroConnexion) prise = null
            }
        }
    }

    /**
     * Envoie des octets au récepteur (les corrections RTK reçues par internet, voir ClientNtrip).
     * Renvoie faux si le récepteur n'est pas connecté ou si l'envoi échoue.
     */
    fun ecrire(octets: ByteArray): Boolean {
        val maPrise = prise ?: return false
        return try {
            synchronized(this) {
                maPrise.outputStream.write(octets)
                maPrise.outputStream.flush()
            }
            true
        } catch (erreur: IOException) {
            false
        }
    }

    /** Coupe la connexion en cours. */
    fun deconnecter() {
        numeroConnexion++
        fermer(prise)
        prise = null
    }

    /**
     * Ouvre la liaison SPP. Si la méthode normale échoue, on essaie la variante « non sécurisée »,
     * que certains récepteurs GNSS demandent.
     */
    @SuppressLint("MissingPermission")
    private fun ouvrirPrise(appareil: BluetoothDevice): BluetoothSocket {
        val priseNormale = appareil.createRfcommSocketToServiceRecord(UUID_SPP)
        return try {
            priseNormale.connect()
            priseNormale
        } catch (premiereErreur: IOException) {
            fermer(priseNormale)
            appareil.createInsecureRfcommSocketToServiceRecord(UUID_SPP).also { it.connect() }
        }
    }

    private fun fermer(prise: BluetoothSocket?) {
        try {
            prise?.close()
        } catch (erreur: IOException) {
            // Rien à faire : la connexion est déjà fermée.
        }
    }

    companion object {
        /** Identifiant standard du « port série Bluetooth » (SPP). */
        val UUID_SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
