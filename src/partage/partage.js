// Partage des projets par Google Drive, vu de l'appli : connexion, envoi automatique (environ
// 30 s après une modification, et quand on quitte l'appli), verrou du projet ouvert, ouverture
// d'un projet de Drive (voir synchro.js).
// main.js appelle : projetEnregistre(), avantDeChanger(), apresOuverture(), envoyerMaintenant(),
// rendreLaMain() (main touchée, ou 5 minutes sans rien faire sur le site), reprendreApresRendu(),
// prendreLaMain().
// Une seule main par projet (demande du 27.10.2026, 0.76.0) :
// - prendre la main à un autre appareil (site ou APK) : mode Expert et code de sécurité, toujours ;
//   on prend la version de Drive (ce que l'autre n'a pas encore envoyé est perdu : choix de l'utilisateur) ;
// - l'appareil qui perd la main le voit en 30 s au plus (verrou relu toutes les 30 s) : il est mis
//   en attente (fenêtre « … a la main », lecture seule) ; quand la main est rendue, il reprend tout
//   seul la version de Drive et la main ;
// - on peut ouvrir en lecture seule un projet qu'un autre appareil a en main : on voit et on
//   implante, mais rien ne s'enregistre ;
// - plus de fenêtre « a changé ici et sur Drive » : la version de Drive l'emporte.

import { creerDrive } from './drive.js';
import { creerSynchro, choisirVersion, verrouActif, SIGNE_DE_VIE } from './synchro.js';
import { creerConnexion, connexionPossible } from './connexion.js';
import { appareil, nommerAppareil, etaitConnecte, retenirConnexion, memoireProjet, retenirProjet } from './memoire.js';
import { lireListesPartagees, ecrireListesPartagees, surChangementListes, versionAGarder } from '../reglages/listes-partagees.js';

const DELAI_ENVOI = 30_000; // après une modification (ms)
const DELAI_NOUVEL_ESSAI = 60_000; // après un échec (pas de réseau…)
const VERIFICATION = 30_000; // le verrou du projet ouvert est relu toutes les 30 s
const LISTES = 10 * 60_000; // listes partagées (adresses, swipos) relues toutes les 10 minutes

/**
 * Crée le partage.
 * - obtenirProjet() : projet ouvert ; titreDe(projet) : son titre (nom du dossier Drive) ;
 * - lireLocal(id) : promesse du projet enregistré sur l'appareil (ou null) ;
 * - ouvrirProjet(projet) : ouvre ce projet dans l'appli (et l'enregistre sur l'appareil) ;
 * - demanderPriseDeMain(verrou, titre, { avecAnnuler }) : « lecture » (voir en lecture seule),
 *   « prendre » (prendre la main) ou null (ne pas ouvrir) ;
 * - autoriserPrise(verrou) : promesse vraie si on peut prendre la main (mode Expert, code) ;
 * - quandMainPrise(verrou) : un autre appareil vient de prendre la main (fenêtre d'attente) ;
 * - quandMainRendue(nom, { repris }) : il l'a rendue, le projet est à jour (fermer la fenêtre d'attente) ;
 *   repris : vrai si cet appareil a retrouvé la main, faux s'il reste en lecture seule ;
 * - quandChange() : l'état a changé (redessiner) ; message(texte) : petit message à l'écran.
 */
export function creerPartage({ obtenirProjet, titreDe, lireLocal, ouvrirProjet, demanderPriseDeMain, autoriserPrise, quandMainPrise, quandMainRendue, quandChange, message }) {
  const etat = {
    possible: connexionPossible(),
    connecte: false,
    // 'deconnecte', 'connexion', 'a-jour', 'envoi', 'attente' (hors ligne, nouvel essai bientôt),
    // 'repris' (un autre appareil a la main : lecture seule), 'rendu', 'erreur'
    etat: 'deconnecte',
    message: '',
    derniereSynchro: null,
    projetsDrive: [],
    // { projetId, appareilId, nom, depuis, vu, attente } : un autre appareil a la main (lecture seule) ;
    // attente : vrai si cet appareil l'avait (il la reprendra tout seul quand elle sera rendue).
    repris: null,
    rendu: null, // { projetId } : main rendue (ou libre) : lecture seule jusqu'à la reprendre (main grise, 0.80.0)
    // Connexion ou comparaison avec Drive du projet ouvert en cours (0.92.1) : l'appli montre
    // « En attente de synchronisation » et ne laisse rien modifier.
    synchroEnCours: false,
  };
  let enSynchro = 0;
  /** Début (+1) ou fin (−1) d'une synchronisation : met à jour etat.synchroEnCours et prévient l'appli. */
  function compterSynchro(pas) {
    enSynchro = Math.max(0, enSynchro + pas);
    const enCours = enSynchro > 0;
    if (enCours === etat.synchroEnCours) return;
    etat.synchroEnCours = enCours;
    quandChange();
  }
  let synchro = null;
  let minuterie = null;
  let envoiEnCours = null;

  let dernierSigneDeVie = 0;
  let choixEnAttente = false; // fenêtre de démarrage : le projet ouvert n'est pas encore celui qu'on garde
  let silence = false; // projet ouvert par le partage lui-même : son enregistrement ne relance rien
  // Ouverture, prise de main ou vérification en cours : la vérification du verrou attend (sinon
  // elle pourrait croire que la main est perdue pendant qu'on l'ouvre).
  let occupe = 0;

  // Toutes les 30 s : le verrou du projet ouvert. Cet appareil a la main : un autre la lui a-t-il
  // prise ? (et, toutes les 5 minutes, signe de vie : sinon, au bout de 15 minutes, le projet est
  // libre). Un autre a la main : l'a-t-il rendue ?
  setInterval(async () => {
    if (occupe > 0 || envoiEnCours || !etat.connecte || !synchro) return;
    occupe += 1;
    try {
      await verifierVerrou();
    } catch {
      // Pas de réseau : nouvel essai dans 30 s.
    } finally {
      occupe -= 1;
    }
  }, VERIFICATION);

  // Listes partagées (0.79.0) : relues à la connexion et toutes les 10 minutes ; une modification
  // faite ici part tout de suite sur Drive.
  setInterval(() => synchroniserListes().catch(() => {}), LISTES);
  surChangementListes((listes, { depuisDrive }) => {
    if (!depuisDrive && etat.connecte && synchro) synchro.ecrireListes(listes).catch(() => {});
  });

  /** Garde la version la plus récente des listes partagées, ici ou sur Drive. */
  async function synchroniserListes() {
    if (!etat.connecte || !synchro) return;
    const local = lireListesPartagees();
    const distant = await synchro.lireListes();
    const garder = versionAGarder(local.modifieLe, distant?.modifieLe ?? null);
    if (garder === 'drive') ecrireListesPartagees(distant.listes, { modifieLe: distant.modifieLe, depuisDrive: true });
    else if (garder === 'local') await synchro.ecrireListes(local);
  }

  async function verifierVerrou() {
    const projet = obtenirProjet();
    const dossierId = memoireProjet(projet.id)?.dossierId;
    if (!dossierId || etat.rendu?.projetId === projet.id) return;
    if (etat.repris?.projetId === projet.id) {
      const { verrou } = await synchro.lireVerrou(dossierId);
      if (!verrou || verrou.appareilId === appareil().id) await mainLiberee(dossierId);
      else if (verrou.appareilId !== etat.repris.appareilId) {
        etat.repris = { ...etat.repris, ...verrou };
        changer('repris');
      }
      return;
    }
    let pris = null;
    if (Date.now() - dernierSigneDeVie >= SIGNE_DE_VIE) {
      pris = (await synchro.signeDeVie(dossierId)).repris ?? null;
      dernierSigneDeVie = Date.now();
    } else {
      const { verrou } = await synchro.lireVerrou(dossierId);
      if (verrou && verrou.appareilId !== appareil().id) pris = verrou;
    }
    if (pris && obtenirProjet().id === projet.id) perdreLaMain(projet, pris);
  }

  /** Un autre appareil a pris la main sur le projet ouvert : plus d'envoi, lecture seule, fenêtre d'attente. */
  function perdreLaMain(projet, verrou) {
    clearTimeout(minuterie);
    etat.repris = { projetId: projet.id, ...verrou, attente: true };
    changer('repris');
    if (obtenirProjet().id === projet.id) quandMainPrise(etat.repris);
  }

  /**
   * Le projet ouvert en lecture seule est libre : on prend la version de Drive. Cet appareil
   * l'avait en main (attente) : il la reprend tout seul ; sinon la main reste libre (main grise).
   */
  async function mainLiberee(dossierId) {
    const { attente, nom } = etat.repris;
    changer('envoi', 'téléchargement…');
    if (attente) await synchro.prendreVerrou(dossierId);
    const lu = await synchro.telecharger(dossierId);
    retenirProjet(lu.projet.id, lu.memoire);
    etat.repris = null;
    etat.rendu = attente ? null : { projetId: lu.projet.id };
    await ouvrirEnSilence(lu.projet);
    changer(attente ? 'a-jour' : 'rendu');
    quandMainRendue(nom, { repris: Boolean(attente) });
  }

  /** Ouvre un projet sans que son enregistrement sur l'appareil ne relance un envoi ou une prise de main. */
  async function ouvrirEnSilence(projet) {
    silence = true;
    try {
      await ouvrirProjet(projet);
    } finally {
      silence = false;
    }
  }

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
    compterSynchro(1);
    changer('connexion', 'connexion à Google…');
    const connexion = creerConnexion();
    synchro = creerSynchro(creerDrive({ obtenirJeton: connexion.obtenirJeton }), appareil());
    try {
      await connexion.obtenirJeton();
      etat.connecte = true;
      retenirConnexion(true);
      await rafraichirListe();
      changer('a-jour');
      synchroniserListes().catch(() => {});
      // Choix du projet pas encore fait (fenêtre de démarrage) : rien n'est comparé ni pris pour l'instant.
      if (!choixEnAttente) await apresOuverture();
    } catch (erreur) {
      etat.connecte = false;
      synchro = null;
      changer('erreur', erreur.message);
    } finally {
      compterSynchro(-1);
    }
  }

  function deconnecter() {
    clearTimeout(minuterie);
    retenirConnexion(false);
    etat.connecte = false;
    etat.projetsDrive = [];
    etat.repris = null;
    etat.rendu = null;
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
    if (etat.rendu?.projetId === projet.id) return; // main rendue : rien ne part sans la reprendre
    envoiEnCours = (async () => {
      changer('envoi', 'envoi…');
      try {
        const resultat = await synchro.envoyer(projet, memoireProjet(projet.id), titreDe(projet));
        if (resultat.repris) {
          perdreLaMain(projet, resultat.repris);
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
   * pris par un autre appareil (lecture seule, ou prendre la main) ? Sinon, on l'envoie bientôt
   * (il prend le verrou).
   */
  async function apresOuverture() {
    choixEnAttente = false;
    etat.repris = null;
    etat.rendu = null;
    if (!etat.connecte || !synchro) return;
    const projet = obtenirProjet();
    occupe += 1;
    compterSynchro(1);
    try {
      await rafraichirListe();
      const surDrive = etat.projetsDrive.find((p) => p.projetId === projet.id);
      if (surDrive) {
        const memoire = memoireProjet(projet.id);
        const choix = choisirVersion({ local: projet.modifieLe, envoyeLe: memoire?.envoyeLe, distant: surDrive.modifieLe });
        const verrou = autreMain(surDrive.verrou);
        if (verrou) {
          if (choix !== 'local') await ouvrirVersionDrive(surDrive, { prendre: false });
          retenirProjet(projet.id, { ...(memoireProjet(projet.id) ?? {}), dossierId: surDrive.dossierId });
          etat.repris = { projetId: projet.id, ...verrou, attente: false };
          changer('repris');
          if ((await demanderPriseDeMain(verrou, surDrive.titre)) === 'prendre') await prendreLaMain();
          return;
        }
        if (choix !== 'local') {
          await ouvrirVersionDrive(surDrive, { prendre: true, conflit: choix === 'conflit' });
          return;
        }
      }
      planifier(2_000);
      rendreAutresVerrous(projet.id);
    } catch (erreur) {
      changer('attente', erreur.message);
    } finally {
      occupe -= 1;
      compterSynchro(-1);
    }
  }

  /** Verrou d'un autre appareil encore en vie (il a la main), ou null. */
  function autreMain(verrou) {
    return verrou && verrou.appareilId !== appareil().id && verrouActif(verrou) ? verrou : null;
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
    if (choixEnAttente || !etat.connecte || !synchro) return Promise.resolve();
    const projet = obtenirProjet();
    if (etat.repris?.projetId === projet.id || etat.rendu?.projetId === projet.id) return Promise.resolve();
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
   * Ouvre la version Drive d'un projet. prendre : la main passe à cet appareil (avant le
   * téléchargement : l'autre appareil n'envoie plus rien) ; sinon lecture seule. conflit : modifié
   * ici et sur Drive depuis le dernier échange : la version de Drive l'emporte (0.76.0).
   */
  async function ouvrirVersionDrive(surDrive, { prendre, conflit = false }) {
    changer('envoi', 'téléchargement…');
    if (prendre) await synchro.prendreVerrou(surDrive.dossierId);
    const lu = await synchro.telecharger(surDrive.dossierId);
    retenirProjet(lu.projet.id, lu.memoire);
    await ouvrirEnSilence(lu.projet);
    if (conflit) message('Version de Drive ouverte : les changements faits ici depuis le dernier envoi sont remplacés');
    else if (prendre) message(`Version de Drive ouverte${surDrive.verrou?.nom ? ` (dernier envoi : ${surDrive.verrou.nom})` : ''}`);
    changer('a-jour');
  }

  /**
   * Prendre la main sur le projet ouvert, qu'un autre appareil a (mode Expert, code de
   * sécurité) : le verrou passe ici, puis on ouvre la version de Drive.
   */
  async function prendreLaMain() {
    const projet = obtenirProjet();
    const surDrive = etat.projetsDrive.find((p) => p.projetId === projet.id);
    const dossierId = memoireProjet(projet.id)?.dossierId ?? surDrive?.dossierId;
    if (!synchro || !dossierId || etat.repris?.projetId !== projet.id) return;
    const { nom } = etat.repris;
    if (!(await autoriserPrise(etat.repris))) return;
    occupe += 1;
    try {
      changer('envoi', 'téléchargement…');
      await synchro.prendreVerrou(dossierId);
      const lu = await synchro.telecharger(dossierId);
      retenirProjet(lu.projet.id, lu.memoire);
      etat.repris = null;
      etat.rendu = null;
      await ouvrirEnSilence(lu.projet);
      dernierSigneDeVie = Date.now();
      message(`Tu as la main (dernière version envoyée par ${nom})`);
      changer('a-jour');
    } catch (erreur) {
      changer('attente', erreur.message);
    } finally {
      occupe -= 1;
    }
  }

  /**
   * Rend la main sur le projet ouvert : on envoie ce qui reste, puis le verrou est enlevé (un autre
   * appareil peut l'ouvrir sans rien demander). raison : texte affiché (ex. « 5 min sans activité »).
   */
  async function rendreLaMain(raison = '') {
    if (!etat.connecte || !synchro) return;
    const projet = obtenirProjet();
    if (etat.repris?.projetId === projet.id || etat.rendu?.projetId === projet.id) return;
    try {
      await envoyer(projet);
      if (etat.repris?.projetId === projet.id) return;
      const dossierId = memoireProjet(projet.id)?.dossierId;
      if (!dossierId) return;
      await synchro.rendreVerrou(dossierId);
      etat.rendu = { projetId: projet.id };
      await rafraichirListe().catch(() => {});
      changer('rendu', raison);
    } catch (erreur) {
      changer('attente', erreur.message);
    }
  }

  return {
    etat,
    connecter,
    rendreLaMain,

    /** Main rendue, et on veut de nouveau envoyer : comme à l'ouverture (version, verrou), puis envoi. */
    reprendreApresRendu() {
      if (etat.rendu?.projetId !== obtenirProjet().id) return;
      apresOuverture();
    },
    deconnecter,
    rafraichirListe,
    nommerAppareil(nom) {
      nommerAppareil(nom);
      quandChange();
    },
    appareil,

    /** Au démarrage de l'appli : se reconnecte si on l'était (dans l'APK, sans rien demander). */
    demarrer({ choixEnAttente: attente = false } = {}) {
      // Fenêtre de démarrage (0.84.0) : si on n'ouvre pas le dernier projet, il n'est ni comparé à
      // Drive ni envoyé ; c'est le projet ouvert ensuite (apresOuverture) qui le sera.
      choixEnAttente = attente;
      if (etat.possible && etaitConnecte() && appareil().nom) connecter();
    },

    /** Le projet ouvert vient d'être enregistré sur l'appareil : envoi dans 30 s. */
    projetEnregistre() {
      if (choixEnAttente || silence || etat.repris?.projetId === obtenirProjet().id) return;
      // Main rendue : lecture seule, rien ne part (on la reprend en touchant la main grise, 0.80.0).
      if (etat.rendu?.projetId === obtenirProjet().id) return;
      planifier();
    },

    envoyerMaintenant: () => {
      if (etat.rendu?.projetId === obtenirProjet().id) return Promise.resolve();
      return envoyer();
    },
    avantDeChanger,
    apresOuverture,

    /**
     * Ouvre un projet de la liste Drive. Un autre appareil l'a en main : lecture seule, ou prendre
     * la main (mode Expert, code de sécurité).
     */
    async ouvrirDepuisDrive(dossierId) {
      const surDrive = etat.projetsDrive.find((p) => p.dossierId === dossierId);
      if (!surDrive || !synchro) return;
      const verrou = autreMain(surDrive.verrou);
      let prendre = true;
      if (verrou) {
        const choix = await demanderPriseDeMain(verrou, surDrive.titre, { avecAnnuler: true });
        if (!choix || (choix === 'prendre' && !(await autoriserPrise(verrou)))) return;
        prendre = choix === 'prendre';
      }
      occupe += 1;
      try {
        avantDeChanger(); // en arrière-plan
        etat.repris = null;
        etat.rendu = null;
        if (!prendre) {
          retenirProjet(surDrive.projetId, { ...(memoireProjet(surDrive.projetId) ?? {}), dossierId });
          etat.repris = { projetId: surDrive.projetId, ...verrou, attente: false };
          await ouvrirVersionDrive(surDrive, { prendre: false });
          changer('repris');
          return;
        }
        const local = await lireLocal(surDrive.projetId);
        const memoire = memoireProjet(surDrive.projetId);
        const choix = choisirVersion({ local: local?.modifieLe, envoyeLe: memoire?.envoyeLe, distant: surDrive.modifieLe });
        if (choix === 'local' && !verrou) {
          await synchro.prendreVerrou(dossierId);
          retenirProjet(local.id, { ...(memoire ?? {}), dossierId });
          await ouvrirProjet(local);
          changer('a-jour');
          return;
        }
        await ouvrirVersionDrive(surDrive, { prendre: true, conflit: choix === 'conflit' && !verrou });
      } catch (erreur) {
        changer('attente', erreur.message);
        message(`Ouverture de « ${surDrive.titre} » impossible : ${erreur.message}`);
      } finally {
        occupe -= 1;
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

    /** « Prendre la main » sur le projet ouvert, qu'un autre appareil a (main rouge, réglages). */
    prendreLaMain,
  };
}
