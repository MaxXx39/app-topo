package ch.apptopo

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.BluetoothLeScanner
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

/**
 * Laser Leica DISTO (D510) en Bluetooth basse consommation (BLE), pour l'application « Test laser » (0.270.0).
 * Service et caractéristiques repris de la page d'essai de l'utilisateur (17.11, qui marche dans son Chrome) :
 * - 3ab10101 : distance (nombre à virgule de 4 octets, petit-boutiste, en mètres), par notification ;
 * - 3ab10103 : inclinaison (même format ; radians, à vérifier avec l'écran du D510) ;
 * - 3ab10109 : commandes (« g » = mesurer), si le D510 l'a.
 * Rien d'autre : pas de bibliothèque. Les messages vont à la page par [envoyer] (texte JavaScript).
 */
@SuppressLint("MissingPermission") // permissions vérifiées par EcranPrincipal avant chaque appel
class LaserBle(private val contexte: Context, private val envoyer: (String) -> Unit) {

    companion object {
        val SERVICE: UUID = UUID.fromString("3ab10100-f831-4395-b29d-570977d5bf94")
        val DISTANCE: UUID = UUID.fromString("3ab10101-f831-4395-b29d-570977d5bf94")
        val INCLINAISON: UUID = UUID.fromString("3ab10103-f831-4395-b29d-570977d5bf94")
        val COMMANDE: UUID = UUID.fromString("3ab10109-f831-4395-b29d-570977d5bf94")
        // Descripteur standard qui allume les notifications d'une caractéristique.
        val DESCRIPTEUR_NOTIF: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val DUREE_RECHERCHE_MS = 6000L
    }

    private val principal = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var commande: BluetoothGattCharacteristic? = null
    private var nom: String? = null
    // Notifications à allumer une par une (Android n'accepte qu'une écriture à la fois).
    private val aAllumer = ArrayDeque<BluetoothGattCharacteristic>()

    var etat = "deconnecte"
        private set

    /** Envoie l'état à la page : { etat, nom, peutMesurer, message }. */
    private fun direEtat(nouvel: String, message: String? = null) {
        etat = nouvel
        val json = JSONObject()
            .put("etat", nouvel)
            .put("nom", nom ?: JSONObject.NULL)
            .put("peutMesurer", commande != null)
            .put("message", message ?: JSONObject.NULL)
        envoyer("window.recevoirEtatLaser && window.recevoirEtatLaser($json)")
    }

    // ---------------------------------------------------------------- recherche

    private var recherche: ScanCallback? = null

    /**
     * Cherche les appareils BLE pendant 6 s ; garde ceux dont le nom commence par DISTO ou Leica
     * (sinon tous ceux qui ont un nom), puis appelle [fini] avec la liste (sur le fil principal).
     */
    fun chercher(scanner: BluetoothLeScanner, fini: (List<BluetoothDevice>) -> Unit) {
        arreterRecherche(scanner)
        val trouves = LinkedHashMap<String, BluetoothDevice>()
        val rappel = object : ScanCallback() {
            override fun onScanResult(type: Int, resultat: ScanResult) {
                val appareil = resultat.device
                val n = appareil.name ?: resultat.scanRecord?.deviceName ?: return
                if (n.isNotBlank()) trouves[appareil.address] = appareil
            }

            override fun onScanFailed(code: Int) {
                direEtat("deconnecte", "Recherche Bluetooth impossible (code $code).")
            }
        }
        recherche = rappel
        direEtat("recherche")
        scanner.startScan(rappel)
        principal.postDelayed({
            arreterRecherche(scanner)
            val tous = trouves.values.toList()
            val disto = tous.filter { (it.name ?: "").let { n -> n.startsWith("DISTO", true) || n.startsWith("Leica", true) } }
            if (etat == "recherche") direEtat("deconnecte")
            fini(disto.ifEmpty { tous })
        }, DUREE_RECHERCHE_MS)
    }

    fun arreterRecherche(scanner: BluetoothLeScanner?) {
        val rappel = recherche ?: return
        recherche = null
        try {
            scanner?.stopScan(rappel)
        } catch (_: Exception) {
            // Bluetooth coupé entre-temps : rien à arrêter.
        }
    }

    // ---------------------------------------------------------------- connexion

    fun connecter(appareil: BluetoothDevice) {
        deconnecter(dire = false)
        nom = appareil.name ?: appareil.address
        direEtat("connexion")
        gatt = appareil.connectGatt(contexte, false, rappel, BluetoothDevice.TRANSPORT_LE)
    }

    fun deconnecter(dire: Boolean = true) {
        gatt?.let {
            try {
                it.disconnect()
                it.close()
            } catch (_: Exception) {
                // déjà fermé
            }
        }
        gatt = null
        commande = null
        aAllumer.clear()
        if (dire) direEtat("deconnecte")
    }

    /** Déclenche une mesure depuis la tablette (commande « g »), si le D510 le permet. */
    fun mesurer(): Boolean {
        val g = gatt ?: return false
        val c = commande ?: return false
        val octets = byteArrayOf(0x67)
        return if (Build.VERSION.SDK_INT >= 33) {
            g.writeCharacteristic(c, octets, typeEcriture(c)) == BluetoothGatt.GATT_SUCCESS
        } else {
            @Suppress("DEPRECATION")
            c.value = octets
            c.writeType = typeEcriture(c)
            @Suppress("DEPRECATION")
            g.writeCharacteristic(c)
        }
    }

    private fun typeEcriture(c: BluetoothGattCharacteristic) =
        if (c.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        else BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT

    private fun allumerSuivante(g: BluetoothGatt) {
        val c = aAllumer.removeFirstOrNull()
        if (c == null) {
            principal.post { direEtat("connecte") }
            return
        }
        g.setCharacteristicNotification(c, true)
        val d = c.getDescriptor(DESCRIPTEUR_NOTIF)
        if (d == null) {
            allumerSuivante(g)
            return
        }
        val valeur = if (c.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
        else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        if (Build.VERSION.SDK_INT >= 33) {
            g.writeDescriptor(d, valeur)
        } else {
            @Suppress("DEPRECATION")
            d.value = valeur
            @Suppress("DEPRECATION")
            g.writeDescriptor(d)
        }
    }

    /** Valeur reçue : distance ou inclinaison (nombre de 4 octets petit-boutiste), envoyée telle quelle à la page. */
    private fun recu(uuid: UUID, octets: ByteArray?) {
        if (octets == null || octets.size < 4) return
        val valeur = ByteBuffer.wrap(octets, 0, 4).order(ByteOrder.LITTLE_ENDIAN).float.toDouble()
        if (valeur.isNaN() || valeur.isInfinite()) return
        val quoi = when (uuid) {
            DISTANCE -> "distance"
            INCLINAISON -> "inclinaison"
            else -> return
        }
        val json = JSONObject().put("quoi", quoi).put("valeur", valeur).put("heure", System.currentTimeMillis())
        principal.post { envoyer("window.recevoirMesureLaser && window.recevoirMesureLaser($json)") }
    }

    private val rappel = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, statut: Int, nouvelEtat: Int) {
            if (nouvelEtat == BluetoothProfile.STATE_CONNECTED) {
                g.discoverServices()
            } else if (nouvelEtat == BluetoothProfile.STATE_DISCONNECTED) {
                principal.post {
                    if (gatt === g) {
                        g.close()
                        gatt = null
                        commande = null
                        direEtat("deconnecte", if (statut != BluetoothGatt.GATT_SUCCESS) "Laser déconnecté (code $statut)." else null)
                    }
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, statut: Int) {
            val service = g.getService(SERVICE)
            if (service == null) {
                principal.post { direEtat("deconnecte", "Ce n'est pas un laser Leica DISTO (service introuvable).") }
                g.disconnect()
                return
            }
            commande = service.getCharacteristic(COMMANDE)
            aAllumer.clear()
            service.getCharacteristic(DISTANCE)?.let { aAllumer.add(it) }
            service.getCharacteristic(INCLINAISON)?.let { aAllumer.add(it) }
            allumerSuivante(g)
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, statut: Int) {
            allumerSuivante(g)
        }

        // Android 13 et plus.
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, valeur: ByteArray) {
            recu(c.uuid, valeur)
        }

        // Android 12 et moins.
        @Deprecated("Remplacée sous Android 13, gardée pour les tablettes plus anciennes")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            if (Build.VERSION.SDK_INT >= 33) return
            @Suppress("DEPRECATION")
            recu(c.uuid, c.value)
        }
    }
}
