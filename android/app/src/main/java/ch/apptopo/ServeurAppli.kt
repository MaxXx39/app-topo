package ch.apptopo

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Sert à la WebView les fichiers de l'appli web rangés dans l'APK (dossier assets/app-topo),
 * à l'adresse https://appassets.androidplatform.net/app-topo/ (adresse prévue par Android pour cela :
 * elle ne part jamais sur internet). Avec une vraie adresse « https », l'appli web marche comme
 * sur GitHub Pages (modules JavaScript, base de données IndexedDB des projets).
 */
class ServeurAppli(private val assets: AssetManager) {

    /** Réponse pour [adresse], ou null si ce n'est pas un fichier de l'appli (ex. tuile swisstopo : internet). */
    fun repondre(adresse: Uri): WebResourceResponse? {
        if (adresse.scheme != "https" || adresse.host != HOTE) return null
        val chemin = adresse.path.orEmpty()
        if (!chemin.startsWith(DOSSIER)) return pasTrouve()
        val fichier = chemin.removePrefix("/").let { if (it.endsWith("/")) it + "index.html" else it }
        return try {
            WebResourceResponse(typeDuFichier(fichier), null, 200, "OK", mapOf("Cache-Control" to "no-cache"), assets.open(fichier))
        } catch (erreur: IOException) {
            pasTrouve()
        }
    }

    private fun pasTrouve() =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    companion object {
        const val HOTE = "appassets.androidplatform.net"
        const val DOSSIER = "/app-topo/"
        const val ADRESSE_ACCUEIL = "https://$HOTE$DOSSIER"

        /** Type du fichier d'après son extension (le navigateur en a besoin, surtout pour les modules .js). */
        fun typeDuFichier(nom: String): String =
            when (nom.substringAfterLast('.', "").lowercase()) {
                "html" -> "text/html"
                "js", "mjs" -> "text/javascript"
                "css" -> "text/css"
                "json", "webmanifest" -> "application/json"
                "svg" -> "image/svg+xml"
                "png" -> "image/png"
                "jpg", "jpeg" -> "image/jpeg"
                "wasm" -> "application/wasm"
                "woff2" -> "font/woff2"
                else -> "application/octet-stream"
            }
    }
}
