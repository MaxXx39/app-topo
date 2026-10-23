package ch.apptopo.noyau.ntrip

import java.io.IOException
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

/** Où en est la réception des corrections (affiché par la page). */
data class EtatNtrip(
    /** 'arrete', 'connexion', 'recoit', 'attente' (nouvel essai bientôt) ou 'erreur' (arrêté). */
    val etat: String,
    val message: String,
    /** Octets de corrections reçus depuis le démarrage. */
    val octets: Long = 0,
    /** Heure (ms, horloge de [ClientNtrip.horloge]) des dernières corrections reçues, ou null. */
    val heureDerniereDonnee: Long? = null,
)

/**
 * Client NTRIP : se connecte au serveur de corrections, envoie la GGA du récepteur (au début puis
 * toutes les [intervalleGgaMs]) et passe chaque paquet de corrections reçu à [surCorrections]
 * (l'appli Android les écrit vers le RX2 par Bluetooth). En cas de coupure (réseau, serveur), il
 * se reconnecte tout seul après [attenteReconnexionMs] ; s'il est refusé pour de bon (mot de
 * passe, point de montage), il s'arrête et le dit.
 *
 * - [ggaActuelle] : dernière phrase GGA reçue du récepteur (ou null) ;
 * - [surEtat] : appelé à chaque changement d'état (depuis le fil du client).
 * Tout se passe dans un fil d'exécution séparé, pour ne jamais bloquer l'écran.
 */
class ClientNtrip(
    private val ggaActuelle: () -> String?,
    private val surCorrections: (ByteArray) -> Unit,
    private val surEtat: (EtatNtrip) -> Unit,
    private val intervalleGgaMs: Long = 10_000,
    private val attenteReconnexionMs: Long = 5_000,
    private val delaiConnexionMs: Int = 10_000,
    val horloge: () -> Long = { System.currentTimeMillis() },
) {
    @Volatile private var numero = 0 // numéro de la session en cours (une ancienne s'arrête d'elle-même)
    @Volatile private var prise: Socket? = null
    @Volatile var etat = EtatNtrip("arrete", "corrections arrêtées")
        private set

    /** Démarre (ou redémarre) la réception avec ces réglages. */
    fun demarrer(reglages: ReglagesNtrip) {
        arreter()
        val monNumero = ++numero
        reglages.manque()?.let {
            changer(EtatNtrip("erreur", it))
            return
        }
        thread(name = "corrections-ntrip", isDaemon = true) { boucle(reglages, monNumero) }
    }

    /** Arrête la réception. */
    fun arreter() {
        numero++
        fermer()
        changer(EtatNtrip("arrete", "corrections arrêtées", etat.octets, etat.heureDerniereDonnee))
    }

    private fun actif(monNumero: Int) = monNumero == numero

    private fun changer(nouvel: EtatNtrip) {
        etat = nouvel
        surEtat(nouvel)
    }

    /** Connexions successives tant que la session est active. */
    private fun boucle(reglages: ReglagesNtrip, monNumero: Int) {
        var octets = 0L
        var heureDerniere: Long? = null
        while (actif(monNumero)) {
            changer(EtatNtrip("connexion", "connexion à ${reglages.hote}…", octets, heureDerniere))
            try {
                val socket = Socket()
                prise = socket
                socket.connect(InetSocketAddress(reglages.hote.trim(), reglages.port), delaiConnexionMs)
                socket.soTimeout = 1_000
                val sortie = socket.getOutputStream()
                sortie.write(requeteNtrip(reglages).toByteArray(Charsets.ISO_8859_1))
                sortie.flush()

                val entree = socket.getInputStream()
                val premiere = lireLigne(entree, monNumero) ?: throw IOException("le serveur n'a pas répondu")
                val entetes = mutableListOf<String>()
                // En NTRIP 1, « ICY 200 OK » peut être suivi directement des données : en-têtes seulement en HTTP.
                if (premiere.startsWith("HTTP") || premiere.startsWith("SOURCETABLE")) {
                    while (true) {
                        val ligne = lireLigne(entree, monNumero) ?: break
                        if (ligne.isEmpty()) break
                        entetes.add(ligne)
                    }
                }
                when (val reponse = lireReponseNtrip(premiere, entetes)) {
                    is ReponseNtrip.Refusee -> {
                        if (reponse.definitif) {
                            fermer()
                            if (actif(monNumero)) changer(EtatNtrip("erreur", reponse.raison, octets, heureDerniere))
                            return
                        }
                        throw IOException(reponse.raison)
                    }
                    is ReponseNtrip.Acceptee -> {
                        val remonteur = if (reponse.decoupe) Remonteur() else null
                        changer(EtatNtrip("connexion", "connecté, en attente des corrections…", octets, heureDerniere))
                        var prochaineGga = 0L
                        val tampon = ByteArray(4096)
                        while (actif(monNumero)) {
                            // Position du récepteur : au début, puis régulièrement.
                            if (horloge() >= prochaineGga) {
                                ggaPourServeur(ggaActuelle())?.let {
                                    sortie.write(it.toByteArray(Charsets.US_ASCII))
                                    sortie.flush()
                                    prochaineGga = horloge() + intervalleGgaMs
                                }
                            }
                            val lus = try {
                                entree.read(tampon)
                            } catch (attente: SocketTimeoutException) {
                                continue
                            }
                            if (lus < 0) throw IOException("connexion fermée par le serveur")
                            val utiles = remonteur?.ajouter(tampon, lus) ?: tampon.copyOf(lus)
                            if (utiles.isEmpty()) continue
                            surCorrections(utiles)
                            octets += utiles.size
                            heureDerniere = horloge()
                            if (etat.etat != "recoit") changer(EtatNtrip("recoit", "corrections reçues", octets, heureDerniere))
                            else etat = EtatNtrip("recoit", "corrections reçues", octets, heureDerniere)
                        }
                    }
                }
            } catch (erreur: Exception) {
                if (!actif(monNumero)) return
                changer(EtatNtrip("attente", "${texteErreur(erreur)} : nouvel essai dans ${attenteReconnexionMs / 1000} s", octets, heureDerniere))
            } finally {
                fermer()
            }
            // Pause avant de réessayer (interrompue si la session est arrêtée).
            val fin = horloge() + attenteReconnexionMs
            while (actif(monNumero) && horloge() < fin) Thread.sleep(100)
        }
    }

    /** Une ligne de texte de la réponse du serveur (sans CR LF), ou null si la connexion se ferme. */
    private fun lireLigne(entree: InputStream, monNumero: Int): String? {
        val ligne = StringBuilder()
        val debut = horloge()
        while (actif(monNumero)) {
            val c = try {
                entree.read()
            } catch (attente: SocketTimeoutException) {
                if (horloge() - debut > delaiConnexionMs) throw IOException("le serveur ne répond pas")
                continue
            }
            if (c < 0) return if (ligne.isEmpty()) null else ligne.toString()
            if (c == '\n'.code) return ligne.toString().trimEnd('\r')
            ligne.append(c.toChar())
            if (ligne.length > 1000) throw IOException("réponse illisible du serveur")
        }
        return null
    }

    private fun texteErreur(erreur: Exception): String = when (erreur) {
        is java.net.UnknownHostException -> "serveur introuvable (adresse ? internet ?)"
        is java.net.ConnectException -> "connexion impossible au serveur"
        is SocketTimeoutException -> "le serveur ne répond pas"
        else -> erreur.message ?: "erreur de connexion"
    }

    private fun fermer() {
        try {
            prise?.close()
        } catch (erreur: IOException) {
            // Déjà fermée.
        }
        prise = null
    }
}
