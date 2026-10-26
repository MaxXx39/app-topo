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

    /** « Envoyer » un fichier exporté : le partage d'Android (mail, WhatsApp, Drive…). */
    @JavascriptInterface
    fun partagerFichier(nom: String, type: String, contenuBase64: String) {
        val contenu = try {
            Base64.getDecoder().decode(contenuBase64)
        } catch (erreur: IllegalArgumentException) {
            ecran.runOnUiThread { ecran.message("Envoi impossible : fichier mal transmis.") }
            return
        }
        ecran.runOnUiThread { ecran.partagerFichier(nom, type, contenu) }
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

    /** Essai à 2 récepteurs : choisit le 2e RX2 et s'y connecte. */
    @JavascriptInterface
    fun choisirRecepteur2() {
        ecran.runOnUiThread { ecran.choisirRecepteur2() }
    }

    /** Essai à 2 récepteurs : coupe le 2e RX2. */
    @JavascriptInterface
    fun deconnecterRecepteur2() {
        ecran.runOnUiThread { ecran.deconnecterRecepteur2() }
    }

    /**
     * Point à prendre maintenant, en MN95 / RAN95 (texte JSON, voir EtatRecepteur.pointEnJson) :
     * refusé si le RTK n'est pas fixe ou si l'inclinaison n'est pas prête.
     */
    @JavascriptInterface
    fun prendrePoint(): String = ecran.recepteur.pointEnJson()

    // --- Corrections RTK par internet (swipos), sans Emlid Flow ---

    /** Réglages enregistrés (texte JSON, sans le mot de passe), voir EcranPrincipal.reglagesCorrectionsJson. */
    @JavascriptInterface
    fun lireReglagesCorrections(): String = ecran.reglagesCorrectionsJson()

    /** Démarre les corrections avec ces réglages (texte JSON) et les enregistre sur la tablette. */
    @JavascriptInterface
    fun demarrerCorrections(reglagesJson: String) {
        ecran.runOnUiThread { ecran.demarrerCorrections(reglagesJson) }
    }

    /** Arrête les corrections. */
    @JavascriptInterface
    fun arreterCorrections() {
        ecran.runOnUiThread { ecran.arreterCorrections() }
    }

    // --- Essai à 2 récepteurs : corrections du 2e (copie du 1er, ou sa propre connexion NTRIP) ---

    /** Réglages NTRIP du 2e récepteur (texte JSON, sans le mot de passe). */
    @JavascriptInterface
    fun lireReglagesCorrections2(): String = ecran.reglagesCorrectionsJson(2)

    /** Démarre la 2e connexion NTRIP avec ces réglages et les enregistre sur la tablette. */
    @JavascriptInterface
    fun demarrerCorrections2(reglagesJson: String) {
        ecran.runOnUiThread { ecran.demarrerCorrections(reglagesJson, 2) }
    }

    /** Arrête la 2e connexion NTRIP. */
    @JavascriptInterface
    fun arreterCorrections2() {
        ecran.runOnUiThread { ecran.arreterCorrections(2) }
    }

    /** 'copie' (copie des corrections du 1er) ou 'ntrip' (2e connexion). */
    @JavascriptInterface
    fun choisirModeCorrections2(mode: String) {
        ecran.runOnUiThread { ecran.choisirModeCorrections2(mode) }
    }

    // --- Google Drive (partage des projets) ---

    /**
     * Demande un jeton d'accès à Google Drive ; la réponse arrive par window.recevoirJetonDrive.
     * [renouveler] : le jeton précédent a été refusé (Google en redonne un valable).
     */
    @JavascriptInterface
    fun demanderJetonDrive(renouveler: Boolean) {
        ecran.runOnUiThread { ecran.demanderJetonDrive() }
    }

    /** Ferme l'appli (bouton ✕ de l'en-tête, après confirmation dans la page). */
    @JavascriptInterface
    fun fermerAppli() {
        ecran.runOnUiThread { ecran.finishAndRemoveTask() }
    }

    /** Modèle de l'appareil (« Crosscall Core-T4 »), proposé comme nom de l'appareil. */
    @JavascriptInterface
    fun modeleAppareil(): String = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim()

    /** La touche « volume − » prend le point (vrai) ou redevient le volume (faux). */
    @JavascriptInterface
    fun activerToucheVolume(actif: Boolean) {
        ecran.activerToucheVolume(actif)
    }
}
