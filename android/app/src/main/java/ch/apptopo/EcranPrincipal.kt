package ch.apptopo

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Activité unique de l'appli. Elle affiche l'appli web (la même que sur GitHub Pages, rangée
 * dans l'APK) dans une WebView (fenêtre de navigateur intégrée), et fait pour elle ce qu'un
 * navigateur fait d'habitude : choisir des fichiers, prendre des photos, enregistrer les exports,
 * afficher les questions (« Supprimer… ? »). Elle garde aussi la connexion Bluetooth au
 * récepteur Emlid et envoie son état à la page 5 fois par seconde.
 */
class EcranPrincipal : Activity() {

    val recepteur = EtatRecepteur()
    private val minuterie = Handler(Looper.getMainLooper())
    private var pageChargee = false

    // Vrai quand la touche « volume − » prend le point (onglet Terrain, mode Lever : voir la page).
    @Volatile private var toucheVolumePourPoint = false

    // Action à refaire quand l'utilisateur aura accepté la permission Bluetooth.
    private var apresPermission: (() -> Unit)? = null

    private lateinit var page: WebView
    private val serveur by lazy { ServeurAppli(assets) }

    // Réponse attendue par la page quand elle a demandé des fichiers (bouton « Importer », photos…).
    private var fichiersDemandes: ValueCallback<Array<Uri>>? = null

    // Photo en cours avec l'appareil photo (emplacement réservé dans la galerie).
    private var photoPrise: Uri? = null

    // Contenu en attente d'être écrit dans le fichier choisi par l'utilisateur (export).
    private var contenuAEnregistrer: ByteArray? = null

    @SuppressLint("SetJavaScriptEnabled") // l'appli web a besoin de JavaScript ; elle vient de l'APK
    override fun onCreate(etat: Bundle?) {
        super.onCreate(etat)
        page = WebView(this)
        page.settings.javaScriptEnabled = true
        page.settings.domStorageEnabled = true
        page.settings.allowFileAccess = false
        page.webViewClient = ClientNavigation()
        page.webChromeClient = ClientPage()
        page.addJavascriptInterface(PontAndroid(this), "AppliAndroid")

        val cadre = FrameLayout(this)
        cadre.addView(page)
        garderHorsDesBarres(cadre)
        setContentView(cadre)
        page.loadUrl(ServeurAppli.ADRESSE_ACCUEIL)
    }

    override fun onResume() {
        super.onResume()
        minuterie.post(envoyerEtat)
    }

    override fun onPause() {
        super.onPause()
        minuterie.removeCallbacks(envoyerEtat)
    }

    override fun onDestroy() {
        recepteur.bluetooth.deconnecter()
        page.destroy()
        super.onDestroy()
    }

    /**
     * Envoie l'état du récepteur à la page, 5 fois par seconde (comme le GGA du RX2) (fonction window.recevoirEtatRecepteur,
     * voir src/android/pont.js). Pendant la connexion, l'écran reste allumé.
     */
    private val envoyerEtat = object : Runnable {
        override fun run() {
            if (pageChargee) {
                val etat = recepteur.enJson(nomDernierRecepteur())
                page.evaluateJavascript("window.recevoirEtatRecepteur && window.recevoirEtatRecepteur($etat)", null)
            }
            if (recepteur.connecte) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            minuterie.postDelayed(this, 200)
        }
    }

    /** Demandé par la page : la touche « volume − » prend le point (ou redevient le volume). */
    fun activerToucheVolume(actif: Boolean) {
        toucheVolumePourPoint = actif
    }

    /**
     * Touche « volume − » pendant le levé : elle prend le point comme le bouton PRENDRE LE POINT
     * (la page fait les mêmes vérifications) et le volume ne change pas. Sinon, rien ne change.
     */
    override fun dispatchKeyEvent(evenement: KeyEvent): Boolean {
        if (toucheVolumePourPoint && evenement.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (evenement.action == KeyEvent.ACTION_DOWN && evenement.repeatCount == 0) {
                page.evaluateJavascript("window.toucheVolumeBas && window.toucheVolumeBas()", null)
            }
            return true
        }
        return super.dispatchKeyEvent(evenement)
    }

    @Deprecated("Méthode Android classique, suffisante ici")
    override fun onBackPressed() {
        if (page.canGoBack()) {
            page.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    /**
     * Depuis Android 15, l'appli dessine aussi sous la barre d'état et la barre du bas :
     * on garde l'appli web en dehors (et au-dessus du clavier).
     */
    private fun garderHorsDesBarres(cadre: View) {
        if (Build.VERSION.SDK_INT < 35) return
        cadre.setOnApplyWindowInsetsListener { vue, encarts ->
            val marges = encarts.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime(),
            )
            vue.setPadding(marges.left, marges.top, marges.right, marges.bottom)
            WindowInsets.CONSUMED
        }
    }

    fun message(texte: String) {
        Toast.makeText(this, texte, Toast.LENGTH_LONG).show()
    }

    // =====================================================================
    // Pages : l'appli dans l'APK, les liens vers d'autres sites dans le navigateur
    // =====================================================================

    private inner class ClientNavigation : WebViewClient() {
        override fun onPageFinished(vue: WebView, adresse: String) {
            pageChargee = true
        }

        override fun shouldInterceptRequest(vue: WebView, demande: WebResourceRequest) = serveur.repondre(demande.url)

        override fun shouldOverrideUrlLoading(vue: WebView, demande: WebResourceRequest): Boolean {
            if (demande.url.host == ServeurAppli.HOTE) return false
            try {
                startActivity(Intent(Intent.ACTION_VIEW, demande.url))
            } catch (erreur: ActivityNotFoundException) {
                message("Impossible d'ouvrir ${demande.url}")
            }
            return true
        }
    }

    // =====================================================================
    // Questions de la page (alert, confirm, prompt) et choix de fichiers
    // =====================================================================

    private inner class ClientPage : WebChromeClient() {
        override fun onJsAlert(vue: WebView, adresse: String, texte: String, reponse: JsResult): Boolean {
            AlertDialog.Builder(this@EcranPrincipal)
                .setMessage(texte)
                .setPositiveButton("OK") { _, _ -> reponse.confirm() }
                .setOnCancelListener { reponse.confirm() }
                .show()
            return true
        }

        override fun onJsConfirm(vue: WebView, adresse: String, texte: String, reponse: JsResult): Boolean {
            AlertDialog.Builder(this@EcranPrincipal)
                .setMessage(texte)
                .setPositiveButton("OK") { _, _ -> reponse.confirm() }
                .setNegativeButton("Annuler") { _, _ -> reponse.cancel() }
                .setOnCancelListener { reponse.cancel() }
                .show()
            return true
        }

        override fun onJsPrompt(vue: WebView, adresse: String, texte: String, valeur: String?, reponse: JsPromptResult): Boolean {
            val champ = EditText(this@EcranPrincipal).apply {
                setText(valeur.orEmpty())
                setSingleLine()
                selectAll()
            }
            AlertDialog.Builder(this@EcranPrincipal)
                .setMessage(texte)
                .setView(champ)
                .setPositiveButton("OK") { _, _ -> reponse.confirm(champ.text.toString()) }
                .setNegativeButton("Annuler") { _, _ -> reponse.cancel() }
                .setOnCancelListener { reponse.cancel() }
                .show()
            return true
        }

        override fun onShowFileChooser(vue: WebView, rappel: ValueCallback<Array<Uri>>, choix: FileChooserParams): Boolean {
            fichiersDemandes?.onReceiveValue(null)
            fichiersDemandes = rappel
            val plusieurs = choix.mode == FileChooserParams.MODE_OPEN_MULTIPLE
            // Photos seulement si on ne demande que des images (« image/vnd.dxf » est un plan DXF, pas une photo).
            val types = choix.acceptTypes.filter { it.isNotBlank() }
            val photos = types.isNotEmpty() && types.all { it.startsWith("image/") && it != "image/vnd.dxf" }
            return choisirFichiers(photos, plusieurs)
        }
    }

    /**
     * Demande à Android de choisir des fichiers (Téléchargements, Google Drive…), ou pour des photos :
     * la galerie ou l'appareil photo. La réponse arrive dans [onActivityResult].
     */
    @Suppress("DEPRECATION") // méthode simple et suffisante pour une appli sans bibliothèque
    private fun choisirFichiers(photos: Boolean, plusieurs: Boolean): Boolean {
        val intention = if (photos) {
            val galerie = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, plusieurs)
            }
            val appareil = intentionAppareilPhoto()
            Intent.createChooser(galerie, "Ajouter des photos").apply {
                if (appareil != null) putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(appareil))
            }
        } else {
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, plusieurs)
            }
        }
        return try {
            startActivityForResult(intention, CODE_CHOISIR)
            true
        } catch (erreur: ActivityNotFoundException) {
            oublierPhotoPrise()
            fichiersDemandes?.onReceiveValue(null)
            fichiersDemandes = null
            message("Aucune appli pour choisir un fichier sur ce téléphone.")
            false
        }
    }

    /** Appareil photo, avec la photo rangée dans la galerie (Images/Topo). Android 10 et plus récent. */
    private fun intentionAppareilPhoto(): Intent? {
        if (Build.VERSION.SDK_INT < 29) return null
        val date = SimpleDateFormat("yyyy-MM-dd_HH'h'mm'm'ss", Locale.ROOT).format(Date())
        val infos = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "topo_$date.jpg")
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Topo")
        }
        val emplacement = try {
            contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, infos)
        } catch (erreur: Exception) {
            null
        } ?: return null
        photoPrise = emplacement
        return Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, emplacement)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
    }

    /** Efface l'emplacement réservé dans la galerie si aucune photo n'a été prise. */
    private fun oublierPhotoPrise() {
        val emplacement = photoPrise ?: return
        photoPrise = null
        try {
            contentResolver.delete(emplacement, null, null)
        } catch (erreur: Exception) {
            // Rien de grave : au pire, une image vide reste dans la galerie.
        }
    }

    /** Vrai si la photo a bien été écrite par l'appareil photo (fichier non vide). */
    private fun photoEcrite(emplacement: Uri): Boolean =
        try {
            (contentResolver.openFileDescriptor(emplacement, "r")?.use { it.statSize } ?: 0L) > 0L
        } catch (erreur: Exception) {
            false
        }

    // =====================================================================
    // Récepteur Emlid : permission, choix de l'appareil, connexion (comme Emlid Stock)
    // =====================================================================

    private fun preferences() = getSharedPreferences("reglages", MODE_PRIVATE)

    private fun nomDernierRecepteur(): String? = preferences().getString(CLE_NOM_RECEPTEUR, null)

    fun choisirRecepteur() {
        val adaptateur = adaptateurBluetooth { choisirRecepteur() } ?: return
        @SuppressLint("MissingPermission")
        val appareils: List<BluetoothDevice> = adaptateur.bondedDevices?.toList().orEmpty()
        if (appareils.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Aucun appareil appairé")
                .setMessage("Appairez d'abord le RX2 dans les réglages Bluetooth du téléphone, puis revenez ici.")
                .setPositiveButton("OK", null)
                .show()
            return
        }
        @SuppressLint("MissingPermission")
        val noms = appareils.map { "${it.name ?: "(sans nom)"}\n${it.address}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Choisir le récepteur")
            .setItems(noms) { _, numero ->
                val appareil = appareils[numero]
                @SuppressLint("MissingPermission")
                val nom = appareil.name ?: appareil.address
                preferences().edit()
                    .putString(CLE_DERNIER_RECEPTEUR, appareil.address)
                    .putString(CLE_NOM_RECEPTEUR, nom)
                    .apply()
                recepteur.bluetooth.connecter(appareil)
            }
            .setNegativeButton("Annuler", null)
            .show()
    }

    fun reconnecterRecepteur() {
        val adresse = preferences().getString(CLE_DERNIER_RECEPTEUR, null)
        if (adresse == null) {
            choisirRecepteur()
            return
        }
        val adaptateur = adaptateurBluetooth { reconnecterRecepteur() } ?: return
        try {
            recepteur.bluetooth.connecter(adaptateur.getRemoteDevice(adresse))
        } catch (erreur: IllegalArgumentException) {
            choisirRecepteur()
        }
    }

    fun deconnecterRecepteur() {
        recepteur.bluetooth.deconnecter()
        recepteur.oublier("non connecté")
    }

    private fun aLaPermission(permission: String) =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    /**
     * Renvoie l'adaptateur Bluetooth prêt à l'emploi, ou null (avec un message) s'il ne l'est pas.
     * Sans la permission (Android 12 et plus), on la demande, puis on refait [ensuite].
     */
    private fun adaptateurBluetooth(ensuite: () -> Unit): BluetoothAdapter? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !aLaPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            apresPermission = ensuite
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), CODE_PERMISSIONS)
            return null
        }
        val adaptateur = getSystemService(BluetoothManager::class.java)?.adapter
        if (adaptateur == null) {
            message("Ce téléphone n'a pas de Bluetooth.")
            return null
        }
        if (!adaptateur.isEnabled) {
            message("Activez le Bluetooth du téléphone.")
            return null
        }
        return adaptateur
    }

    override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, resultats: IntArray) {
        super.onRequestPermissionsResult(code, permissions, resultats)
        if (code != CODE_PERMISSIONS) return
        val action = apresPermission
        apresPermission = null
        if (resultats.isNotEmpty() && resultats.all { it == PackageManager.PERMISSION_GRANTED }) {
            action?.invoke()
        } else {
            message("Sans la permission « Appareils à proximité », l'appli ne peut pas lire le récepteur.")
        }
    }

    // =====================================================================
    // Exports
    // =====================================================================

    /** Demande où enregistrer le fichier (Téléchargements, Google Drive…), puis y écrit [contenu]. */
    @Suppress("DEPRECATION")
    fun enregistrerFichier(nom: String, type: String, contenu: ByteArray) {
        contenuAEnregistrer = contenu
        val intention = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            // « text/csv;charset=utf-8 » -> « text/csv »
            this.type = type.substringBefore(';').trim().ifEmpty { "application/octet-stream" }
            putExtra(Intent.EXTRA_TITLE, nom)
        }
        try {
            startActivityForResult(intention, CODE_ENREGISTRER)
        } catch (erreur: ActivityNotFoundException) {
            contenuAEnregistrer = null
            message("Aucune appli pour enregistrer un fichier sur ce téléphone.")
        }
    }

    @Deprecated("Méthode Android classique, suffisante ici")
    override fun onActivityResult(code: Int, resultat: Int, donnees: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(code, resultat, donnees)
        when (code) {
            CODE_CHOISIR -> rendreFichiersChoisis(resultat, donnees)
            CODE_ENREGISTRER -> ecrireFichierExporte(resultat, donnees)
        }
    }

    /** Donne à la page les fichiers choisis (ou rien si l'utilisateur a annulé). */
    private fun rendreFichiersChoisis(resultat: Int, donnees: Intent?) {
        val rappel = fichiersDemandes
        fichiersDemandes = null
        val photo = photoPrise
        var choisis: Array<Uri>? = null
        if (resultat == RESULT_OK) {
            val plusieurs = donnees?.clipData
            val un = donnees?.data
            choisis = when {
                plusieurs != null && plusieurs.itemCount > 0 -> Array(plusieurs.itemCount) { plusieurs.getItemAt(it).uri }
                un != null -> arrayOf(un)
                photo != null && photoEcrite(photo) -> arrayOf(photo)
                else -> null
            }
        }
        if (photo != null && choisis?.contains(photo) == true) photoPrise = null else oublierPhotoPrise()
        rappel?.onReceiveValue(choisis)
    }

    private fun ecrireFichierExporte(resultat: Int, donnees: Intent?) {
        val contenu = contenuAEnregistrer
        contenuAEnregistrer = null
        val adresse = donnees?.data
        if (resultat != RESULT_OK || adresse == null || contenu == null) return
        try {
            val flux = contentResolver.openOutputStream(adresse) ?: error("fichier impossible à ouvrir")
            flux.use { it.write(contenu) }
            message("Fichier enregistré.")
        } catch (erreur: Exception) {
            message("Échec de l'enregistrement : ${erreur.message}")
        }
    }

    companion object {
        private const val CODE_CHOISIR = 1
        private const val CODE_ENREGISTRER = 2
        private const val CODE_PERMISSIONS = 3
        private const val CLE_DERNIER_RECEPTEUR = "dernier_recepteur"
        private const val CLE_NOM_RECEPTEUR = "nom_dernier_recepteur"
    }
}
