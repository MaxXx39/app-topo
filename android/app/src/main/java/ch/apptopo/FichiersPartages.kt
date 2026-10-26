package ch.apptopo

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Fichiers exportés que l'on « Envoie » (mail, WhatsApp, Drive…) : rangés dans le cache de l'appli
 * (dossier « partage »), et donnés en lecture seule à l'appli choisie, par une adresse
 * content://ch.apptopo.partage/<nom>. Petit fournisseur fait à la main (pas de bibliothèque).
 */
class FichiersPartages : ContentProvider() {

    companion object {
        const val AUTORITE = "ch.apptopo.partage"

        /** Dossier des fichiers à envoyer (vidé à chaque nouvel envoi). */
        fun dossier(contexte: android.content.Context): File = File(contexte.cacheDir, "partage")

        /** Adresse à donner à l'appli choisie pour ce fichier. */
        fun adresse(nom: String): Uri = Uri.parse("content://$AUTORITE/" + Uri.encode(nom))
    }

    override fun onCreate(): Boolean = true

    /** Le fichier demandé, seulement dans le dossier « partage » (pas de « ../ »), ou null. */
    private fun fichier(uri: Uri): File? {
        val contexte = context ?: return null
        val nom = uri.lastPathSegment ?: return null
        val dossier = dossier(contexte).canonicalFile
        val fichier = File(dossier, nom).canonicalFile
        return if (fichier.parentFile == dossier && fichier.isFile) fichier else null
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val fichier = fichier(uri) ?: throw FileNotFoundException(uri.toString())
        return ParcelFileDescriptor.open(fichier, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    /** Nom et taille du fichier (les applis de mail s'en servent pour la pièce jointe). */
    override fun query(uri: Uri, colonnes: Array<String>?, selection: String?, arguments: Array<String>?, tri: String?): Cursor? {
        val fichier = fichier(uri) ?: return null
        val noms = colonnes ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val curseur = MatrixCursor(noms)
        curseur.addRow(noms.map { if (it == OpenableColumns.SIZE) fichier.length() else if (it == OpenableColumns.DISPLAY_NAME) fichier.name else null }.toTypedArray())
        return curseur
    }

    override fun getType(uri: Uri): String {
        val nom = uri.lastPathSegment?.lowercase() ?: return "application/octet-stream"
        return when {
            nom.endsWith(".pdf") -> "application/pdf"
            nom.endsWith(".csv") -> "text/csv"
            nom.endsWith(".xml") -> "application/xml"
            nom.endsWith(".json") -> "application/json"
            else -> "application/octet-stream"
        }
    }

    override fun insert(uri: Uri, valeurs: ContentValues?): Uri? = null
    override fun update(uri: Uri, valeurs: ContentValues?, selection: String?, arguments: Array<String>?): Int = 0
    override fun delete(uri: Uri, selection: String?, arguments: Array<String>?): Int = 0
}
