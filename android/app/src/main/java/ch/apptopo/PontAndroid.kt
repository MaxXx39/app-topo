package ch.apptopo

import android.webkit.JavascriptInterface
import java.util.Base64

/**
 * Fonctions de l'appli Android que l'appli web peut appeler (objet window.AppliAndroid,
 * côté web : src/android/pont.js). Elles sont appelées hors de l'écran (fil « JavaBridge ») :
 * on repasse sur l'écran avant d'afficher quoi que ce soit.
 * Plus tard : connexion au récepteur Emlid et position (Bluetooth), comme Emlid Stock.
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
}
