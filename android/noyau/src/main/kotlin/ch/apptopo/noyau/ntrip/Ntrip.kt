package ch.apptopo.noyau.ntrip

import java.util.Base64

// Corrections RTK par internet (protocole NTRIP), pour se passer d'Emlid Flow : l'appli se
// connecte elle-même au service de corrections (swipos), lui envoie la position approchée du
// récepteur (phrase GGA) et fait passer les corrections reçues (format RTCM) au RX2 par Bluetooth.
//
// NTRIP version 1 : une requête du genre HTTP « GET /<point de montage> », avec l'identifiant et le
// mot de passe ; le service répond « ICY 200 OK » (ou « HTTP/1.x 200 OK »), puis envoie les
// corrections sans fin. Le récepteur doit renvoyer sa position (GGA) régulièrement : pour un réseau
// comme swipos, les corrections sont calculées pour l'endroit où il se trouve.

/** Réglages de la connexion, tapés par l'utilisateur (repris d'Emlid Flow). */
data class ReglagesNtrip(
    val hote: String,
    val port: Int,
    val pointDeMontage: String,
    val utilisateur: String,
    val motDePasse: String,
) {
    /** Ce qui manque pour se connecter (texte à afficher), ou null si tout est rempli. */
    fun manque(): String? = when {
        hote.isBlank() -> "adresse du serveur manquante"
        port !in 1..65535 -> "port invalide"
        pointDeMontage.isBlank() -> "point de montage manquant"
        utilisateur.isBlank() -> "identifiant manquant"
        motDePasse.isEmpty() -> "mot de passe manquant"
        else -> null
    }
}

/** Texte de la requête envoyée au serveur (NTRIP version 1), lignes terminées par CR LF. */
fun requeteNtrip(reglages: ReglagesNtrip, logiciel: String = "Topo"): String {
    val identifiants = Base64.getEncoder()
        .encodeToString("${reglages.utilisateur}:${reglages.motDePasse}".toByteArray(Charsets.UTF_8))
    return listOf(
        "GET /${reglages.pointDeMontage.trim().removePrefix("/")} HTTP/1.0",
        "Host: ${reglages.hote.trim()}:${reglages.port}",
        "User-Agent: NTRIP $logiciel",
        "Accept: */*",
        "Authorization: Basic $identifiants",
        "Connection: close",
        "",
        "",
    ).joinToString("\r\n")
}

/** Réponse du serveur, lue sur sa première ligne et ses en-têtes. */
sealed class ReponseNtrip {
    /** Le serveur envoie les corrections ; [decoupe] : vrai si elles arrivent par morceaux (« chunked »). */
    data class Acceptee(val decoupe: Boolean) : ReponseNtrip()

    /** Refus, avec la raison à afficher ; [definitif] : inutile de réessayer tout seul (mot de passe…). */
    data class Refusee(val raison: String, val definitif: Boolean) : ReponseNtrip()
}

/**
 * Lit la réponse du serveur : [premiereLigne] (« ICY 200 OK », « HTTP/1.1 401 Unauthorized »,
 * « SOURCETABLE 200 OK »…) et les lignes d'en-tête qui suivent (jusqu'à la ligne vide).
 */
fun lireReponseNtrip(premiereLigne: String, entetes: List<String> = emptyList()): ReponseNtrip {
    val ligne = premiereLigne.trim()
    if (ligne.startsWith("SOURCETABLE")) {
        // Le serveur renvoie sa liste de points de montage : celui demandé n'existe pas.
        return ReponseNtrip.Refusee("point de montage inconnu sur ce serveur", definitif = true)
    }
    val code = Regex("""^(ICY|HTTP/\d\.\d)\s+(\d{3})""").find(ligne)?.groupValues?.get(2)?.toInt()
        ?: return ReponseNtrip.Refusee("réponse inattendue du serveur : « ${ligne.take(60)} »", definitif = false)
    return when (code) {
        200 -> ReponseNtrip.Acceptee(
            decoupe = entetes.any { it.lowercase().replace(" ", "").startsWith("transfer-encoding:chunked") },
        )
        401 -> ReponseNtrip.Refusee("identifiant ou mot de passe refusé", definitif = true)
        403 -> ReponseNtrip.Refusee("accès refusé par le serveur (abonnement ? connexion déjà utilisée ?)", definitif = false)
        404 -> ReponseNtrip.Refusee("point de montage inconnu sur ce serveur", definitif = true)
        else -> ReponseNtrip.Refusee("le serveur a répondu « ${ligne.take(60)} »", definitif = false)
    }
}

/**
 * Remet bout à bout des données envoyées « par morceaux » (HTTP chunked : la taille de chaque
 * morceau en hexadécimal sur une ligne, puis le morceau, puis CR LF). Les octets arrivent dans
 * n'importe quel découpage ; [ajouter] renvoie les octets utiles reçus jusque-là.
 */
class Remonteur {
    private var resteDuMorceau = 0 // octets du morceau en cours encore à recevoir
    private val tailleLue = StringBuilder() // ligne de taille en cours de lecture
    private var aSauter = 0 // CR LF après un morceau

    fun ajouter(octets: ByteArray, nombre: Int = octets.size): ByteArray {
        val sortie = java.io.ByteArrayOutputStream()
        var i = 0
        while (i < nombre) {
            when {
                aSauter > 0 -> {
                    aSauter--
                    i++
                }
                resteDuMorceau > 0 -> {
                    val n = minOf(resteDuMorceau, nombre - i)
                    sortie.write(octets, i, n)
                    resteDuMorceau -= n
                    i += n
                    if (resteDuMorceau == 0) aSauter = 2
                }
                else -> {
                    val c = (octets[i].toInt() and 0xFF).toChar()
                    i++
                    if (c == '\n') {
                        // Taille en hexadécimal (on ignore ce qui suit un « ; »).
                        resteDuMorceau = tailleLue.toString().substringBefore(';').trim().toIntOrNull(16) ?: 0
                        tailleLue.clear()
                    } else if (c != '\r') {
                        tailleLue.append(c)
                    }
                }
            }
        }
        return sortie.toByteArray()
    }
}

/** Phrase GGA prête à envoyer au serveur (terminée par CR LF), ou null si ce n'est pas une GGA. */
fun ggaPourServeur(ligne: String?): String? {
    val propre = ligne?.trim() ?: return null
    // « $GNGGA, », « $GPGGA, »… : le type est en 4e à 6e position.
    if (!propre.startsWith("\$") || propre.length < 7 || propre.substring(3, 7) != "GGA,") return null
    return "$propre\r\n"
}
