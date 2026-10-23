// Partage des projets par Google Drive, vu de l'appli : connexion, envoi automatique (environ
// 30 s après une modification, et quand on quitte l'appli), verrou du projet ouvert, ouverture
// d'un projet de Drive et choix de la bonne version (voir synchro.js).
// main.js appelle : projetEnregistre(), avantDeChanger(), apresOuverture(), envoyerMaintenant().
import { creerDrive } from './drive.js';
import { creerSynchro, choisirVersion, verrouActif, SIGNE_DE_VIE } from './synchro.js';
import { creerConnexion, connexionPossible } from './connexion.js';
import { appareil, nommerAppareil, etaitConnecte, retenirConnexion, memoireProjet, retenirProjet } from './memoire.js';

const DELAI_ENVOI = 30_000; // après une modification (ms)
const DELAI_NOUVEL_ESSAI = 60_000; // après un échec (pas de réseau…)

/**
 * Crée le partage.
 * - obtenirProjet() : projet ouvert ; titreDe(projet) : son titre (nom du dossier Drive) ;
 * - lireLocal(id) : promesse du projet enregistré sur l'appareil (ou null) ;
 * - ouvrirProjet(projet) : ouvre ce projet dans l'appli (et l'enregistre sur l'appareil) ;
 * - garderCopie(projet) : enregistre une copie (nouveau projet) sur l'appareil ;
 * - quandChange() : l'état a changé (redessiner) ; message(texte) : petit message à l'écran.
 */
export function creerPartage({ obtenirProjet, titreDe, lireLocal, ouvrirProjet, garderCopie, quandChange, message }) {
  const etat = {
    possible: connexionPossible(),
    connecte: false,
    // 'deconnecte', 'connexion', 'a-jour', 'envoi', 'attente' (hors ligne, nouvel essai bientôt),
    // 'repris' (ouvert sur un autre appareil), 'erreur'
    etat: 'deconnecte',
    message: '',
    derniereSynchro: null,
    projetsDrive: [],
    repris: null, // { projetId, nom, depuis } : verrou pris par un autre appareil
  };
  let synchro = null;
  let minuterie = null;
  let envoiEnCours = null;

  // Signe de vie toutes les 5 minutes : le projet ouvert reste à cet appareil (sinon, au bout de
  // 15 minutes, un autre appareil peut l'ouvrir sans « prendre la main »).
  setInterval(async () => {
    if (!etat.connecte || !synchro) return;
    const projet = obtenirProjet();
    const dossierId = memoireProjet(projet.id)?.dossierId;
    if (!dossierId || etat.repris?.projetId === projet.id) return;
    try {
      const { repris } = await synchro.signeDeVie(dossierId);
      if (repris) {
        etat.repris = { projetId: projet.id, ...repris };
        changer('repris');
      }
    } catch {
      // Pas de réseau : nouvel essai au prochain signe de vie.
    }
  }, SIGNE_DE_VIE);

  function changer(nouvel, texte = '') {
    etat.etat = nouvel;
    etat.message = texte;
    quandChange();
  }

  /** Connexion à Drive (bouton, ou toute seule au démarrage si on était connecté). */
  async function connecter() {
    if (!appareil().nom) {
      changer('erreur', 'donne d\'abord un nom à cet appareil');
      return;
    }
    changer('connexion', 'connexion à Google…');
    const connexion = creerConnexion();
    synchro = creerSynchro(creerDrive({ obtenirJeton: connexion.obtenirJeton }), appareil());
    try {
      await connexion.obtenirJeton();
      etat.connecte = true;
      retenirConnexion(true);
      await rafraichirListe();
      changer('a-jour');
      await apresOuverture();
    } catch (erreur) {
      etat.connecte = false;
      synchro = null;
      changer('erreur', erreur.message);
    }
  }

  function deconnecter() {
    clearTimeout(minuterie);
    retenirConnexion(false);
    etat.connecte = false;
    etat.projetsDrive = [];
    etat.repris = null;
    synchro = null;
    changer('deconnecte');
  }

  async function rafraichirListe() {
    if (!synchro) return;
    etat.projetsDrive = await synchro.listerProjets();
    quandChange();
  }

  /** Envoi dans "delai" ms (le délai repart à chaque modification). */
  function planifier(delai = DELAI_ENVOI) {
    if (!etat.connecte) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => envoyer(), delai);
  }

  /** Envoie le projet ouvert, ou "projet" (un seul envoi à la fois). */
  async function envoyer(projet = obtenirProjet()) {
    if (!etat.connecte || !synchro) return;
    clearTimeout(minuterie);
    if (envoiEnCours) {
      await envoiEnCours;
      return envoyer(projet);
    }
    if (etat.repris?.projetId === projet.id) return; // ouvert ailleurs : on n'écrase rien
    envoiEnCours = (async () => {
      changer('envoi', 'envoi…');
      try {
        const resultat = await synchro.envoyer(projet, memoireProjet(projet.id), titreDe(projet));
        if (resultat.repris) {
          etat.repris = { projetId: projet.id, ...resultat.repris };
          changer('repris');
          return;
        }
        retenirProjet(projet.id, resultat.memoire);
        etat.derniereSynchro = new Date();
        // Premier envoi de ce projet : il apparaît maintenant sur Drive (☁ dans la liste).
        if (!etat.projetsDrive.some((p) => p.projetId === projet.id)) await rafraichirListe().catch(() => {});
        changer('a-jour');
      } catch (erreur) {
        changer('attente', erreur.message);
        planifier(DELAI_NOUVEL_ESSAI);
      }
    })();
    try {
      await envoiEnCours;
    } finally {
      envoiEnCours = null;
    }
  }

  /**
   * Après l'ouverture d'un projet (ou la connexion) : version plus récente sur Drive ? verrou
   * pris par un autre appareil ? Sinon, on l'envoie bientôt (il prend le verrou).
   */
  async function apresOuverture() {
    etat.repris = null;
    if (!etat.connecte || !synchro) return;
    const projet = obtenirProjet();
    try {
      await rafraichirListe();
      const surDrive = etat.projetsDrive.find((p) => p.projetId === projet.id);
      if (surDrive) {
        const memoire = memoireProjet(projet.id);
        const choix = choisirVersion({ local: projet.modifieLe, envoyeLe: memoire?.envoyeLe, distant: surDrive.modifieLe });
        if (choix !== 'local') {
          await ouvrirVersionDrive(surDrive, choix === 'conflit');
          return;
        }
        if (surDrive.verrou && surDrive.verrou.appareilId !== appareil().id && verrouActif(surDrive.verrou)) {
          etat.repris = { projetId: projet.id, ...surDrive.verrou };
          changer('repris');
          return;
        }
      }
      planifier(2_000);
      rendreAutresVerrous(projet.id);
    } catch (erreur) {
      changer('attente', erreur.message);
    }
  }

  /**
   * Un seul projet ouvert par appareil : les autres projets encore verrouillés au nom de cet
   * appareil (ancien changement de projet sans réseau…) sont rendus.
   */
  async function rendreAutresVerrous(projetOuvertId) {
    for (const p of etat.projetsDrive) {
      if (p.projetId === projetOuvertId || p.verrou?.appareilId !== appareil().id) continue;
      try {
        await synchro.rendreVerrou(p.dossierId);
        p.verrou = null;
      } catch {
        // Pas grave : il expirera tout seul (15 minutes sans signe de vie).
      }
    }
    quandChange();
  }

  /**
   * Avant d'ouvrir un autre projet : on envoie ce qui reste et on rend le verrou, en arrière-plan
   * (l'autre projet s'ouvre tout de suite, sans attendre internet). Renvoie la promesse de l'envoi.
   */
  function avantDeChanger() {
    if (!etat.connecte || !synchro) return Promise.resolve();
    const projet = obtenirProjet();
    if (etat.repris?.projetId === projet.id) return Promise.resolve();
    return (async () => {
      try {
        await envoyer(projet);
        const memoire = memoireProjet(projet.id);
        if (memoire && etat.repris?.projetId !== projet.id) await synchro.rendreVerrou(memoire.dossierId);
      } catch {
        // Pas de réseau : le verrou restera ; l'autre appareil pourra prendre la main.
      }
    })();
  }

  /**
   * Ouvre la version Drive d'un projet. conflit : modifié ici et sur Drive depuis le dernier
   * échange ; on demande laquelle garder, l'autre devient une copie.
   */
  async function ouvrirVersionDrive(surDrive, conflit) {
    changer('envoi', 'téléchargement…');
    const lu = await synchro.telecharger(surDrive.dossierId);
    if (conflit) {
      const prendreDrive = confirm(
        `« ${surDrive.titre} » a été modifié ici et sur Drive.\n\nOK : prendre la version de Drive (celle de cet appareil est gardée en copie).\nAnnuler : garder celle de cet appareil (elle remplacera celle de Drive).`,
      );
      if (!prendreDrive) {
        // Tout sera renvoyé depuis cet appareil (mémoire vide), par-dessus la version de Drive.
        retenirProjet(lu.projet.id, { ...lu.memoire, envoyeLe: null, empreintes: {} });
        await synchro.prendreVerrou(surDrive.dossierId);
        const local = await lireLocal(lu.projet.id);
        if (local && obtenirProjet().id !== local.id) await ouvrirProjet(local);
        changer('a-jour');
        planifier(2_000);
        return;
      }
      const local = await lireLocal(lu.projet.id);
      if (local) await garderCopie(local);
    }
    retenirProjet(lu.projet.id, lu.memoire);
    await synchro.prendreVerrou(surDrive.dossierId);
    await ouvrirProjet(lu.projet);
    message(`Version de Drive ouverte${surDrive.verrou?.nom ? ` (dernier envoi : ${surDrive.verrou.nom})` : ''}`);
    changer('a-jour');
  }

  return {
    etat,
    connecter,
    deconnecter,
    rafraichirListe,
    nommerAppareil(nom) {
      nommerAppareil(nom);
      quandChange();
    },
    appareil,

    /** Au démarrage de l'appli : se reconnecte si on l'était (dans l'APK, sans rien demander). */
    demarrer() {
      if (etat.possible && etaitConnecte() && appareil().nom) connecter();
    },

    /** Le projet ouvert vient d'être enregistré sur l'appareil : envoi dans 30 s. */
    projetEnregistre() {
      if (etat.repris?.projetId === obtenirProjet().id) return;
      planifier();
    },

    envoyerMaintenant: () => envoyer(),
    avantDeChanger,
    apresOuverture,

    /** Ouvre un projet de la liste Drive (en prenant la main s'il est ouvert ailleurs). */
    async ouvrirDepuisDrive(dossierId) {
      const surDrive = etat.projetsDrive.find((p) => p.dossierId === dossierId);
      if (!surDrive || !synchro) return;
      const verrou = surDrive.verrou;
      if (verrou && verrou.appareilId !== appareil().id && verrouActif(verrou)) {
        const depuis = verrou.depuis ? new Date(verrou.depuis).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' }) : '?';
        if (!confirm(`« ${surDrive.titre} » est ouvert sur ${verrou.nom} (depuis ${depuis}).\n\nPrendre la main ? ${verrou.nom} ne pourra plus envoyer ses modifications.`)) return;
      }
      try {
        avantDeChanger(); // en arrière-plan
        const local = await lireLocal(surDrive.projetId);
        const memoire = memoireProjet(surDrive.projetId);
        const choix = choisirVersion({ local: local?.modifieLe, envoyeLe: memoire?.envoyeLe, distant: surDrive.modifieLe });
        if (choix === 'local') {
          await synchro.prendreVerrou(dossierId);
          retenirProjet(local.id, { ...(memoire ?? {}), dossierId });
          await ouvrirProjet(local);
          changer('a-jour');
          return;
        }
        await ouvrirVersionDrive(surDrive, choix === 'conflit');
      } catch (erreur) {
        changer('attente', erreur.message);
      }
    },

    /** Supprime un projet de Drive (dossier à la corbeille de Drive), puis rafraîchit la liste. */
    async supprimerDeDrive(projetId) {
      const surDrive = etat.projetsDrive.find((p) => p.projetId === projetId);
      if (!synchro || !surDrive) return;
      await synchro.supprimerProjet(surDrive.dossierId);
      retenirProjet(projetId, null);
      await rafraichirListe();
    },

    /** « Prendre la main » sur le projet ouvert ailleurs : le verrou passe ici, puis envoi. */
    async reprendreLaMain() {
      const projet = obtenirProjet();
      const surDrive = etat.projetsDrive.find((p) => p.projetId === projet.id);
      const dossierId = memoireProjet(projet.id)?.dossierId ?? surDrive?.dossierId;
      if (!synchro || !dossierId) return;
      if (!confirm(`Prendre la main sur « ${titreDe(projet)} » ? ${etat.repris?.nom ?? 'L\'autre appareil'} ne pourra plus envoyer ses modifications, et tes modifications remplaceront les siennes sur Drive.`)) return;
      try {
        await synchro.prendreVerrou(dossierId);
        etat.repris = null;
        await envoyer();
      } catch (erreur) {
        changer('attente', erreur.message);
      }
    },
  };
}
