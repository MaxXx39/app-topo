package ch.apptopo

import android.webkit.JavascriptInterface
import java.util.Base64

/**
 * Fonctions de l'appli Android que l'appli web peut appeler (objet window.AppliAndroid,
 * côté web : src/android/pont.js). Elles sont appelées hors de l'écran (fil « JavaBridge ») :
 * on repasse sur l'écran avant d'afficher quoi que ce soit.
 * Dans l'autre sens, l'état du récepteur est envoyé à la page 5 fois par seconde
 * (fonction window.recevoirEtatRecepteur, voir EcranPrincipal).
 */
class PontAndroid(private val ecran: EcranPrincipal) {

    /** Enregistre un fichier exporté (PDF, CSV, DXF, LandXML, fichier projet) : Android demande où. */
    @JavascriptInterface
    fun enregistrerFichier(nom: String, type: String, contenuBase64: String) {
        val contenu = try {
            Base64.getDecoder().decode(contenuBase64)
        } catch (erreur: IllegalArgumentException) {
            ecran.runOnUiThread { ecran.message("Export impossible : fichier mal transmis.") }
            return
        }
        ecran.runOnUiThread { ecran.enregistrerFichier(nom, type, contenu) }
    }

    // --- Récepteur Emlid (Bluetooth) ---

    /** Montre la liste des appareils Bluetooth appairés, puis se connecte à celui choisi. */
    @JavascriptInterface
    fun choisirRecepteur() {
        ecran.runOnUiThread { ecran.choisirRecepteur() }
    }

    /** Se reconnecte au dernier récepteur choisi (ou demande lequel). */
    @JavascriptInterface
    fun reconnecterRecepteur() {
        ecran.runOnUiThread { ecran.reconnecterRecepteur() }
    }

    /** Coupe la connexion au récepteur. */
    @JavascriptInterface
    fun deconnecterRecepteur() {
        ecran.runOnUiThread { ecran.deconnecterRecepteur() }
    }

    /**
     * Point à prendre maintenant, en MN95 / RAN95 (texte JSON, voir EtatRecepteur.pointEnJson) :
     * refusé si le RTK n'est pas fixe ou si l'inclinaison n'est pas prête.
     */
    @JavascriptInterface
    fun prendrePoint(): String = ecran.recepteur.pointEnJson()
}
