// Partage des projets par Google Drive, avec un seul compte Google réservé à l'appli
// (décisions de l'utilisateur, 23.10.2026) : tout le monde voit tous les projets ; un projet
// ouvert sur un appareil est « verrouillé » à son nom (les autres peuvent prendre la main) ;
// l'envoi est automatique.
//
// Sur Drive (0.76.0, organisation de l'utilisateur) : un dossier « App Topo », dedans « Configuration
// Projet », puis un dossier par projet (nommé par son titre), qui contient les fichiers du projet
// (voir partage/fichiers.js). L'appli ne voit que les dossiers qu'elle a créés (accès « drive.file ») :
// elle crée elle-même « App Topo » et « Configuration Projet » (l'ancien dossier « Topo - projets »
// est ignoré). Le dossier du projet porte des propriétés lues par l'appli : projetId, titre,
// modifieLe, et le verrou (verrouPar = id de l'appareil, verrouNom, verrouDepuis, verrouVu = dernier
// signe de vie de l'appareil).
// Un verrou sans signe de vie depuis 15 minutes (tablette éteinte, appli fermée sans ✕) ne compte
// plus : le projet est libre (décision du 23.10.2026).
// Sur l'appareil, une petite mémoire par projet (voir memoire.js) retient le dossier Drive, la
// date du dernier envoi et l'empreinte de chaque fichier envoyé (pour ne renvoyer que ce qui change).
import { TYPE_DOSSIER } from './drive.js';
import { projetVersFichiers, fichiersVersProjet, comprimer, decomprimer, empreinte, FICHIER_PROJET } from './fichiers.js';

export const NOM_RACINE = 'App Topo';
export const NOM_PROJETS = 'Configuration Projet';
// Signe de vie de l'appareil qui a le projet (ms), et durée après laquelle son verrou expire.
export const SIGNE_DE_VIE = 5 * 60 * 1000;
export const VERROU_EXPIRE = 15 * 60 * 1000;

/**
 * Vrai si le verrou { appareilId, nom, depuis, vu } compte encore : signe de vie de moins de
 * 15 minutes (maintenant : date en ms).
 */
export function verrouActif(verrou, maintenant = Date.now()) {
  if (!verrou) return false;
  const vu = Date.parse(verrou.vu ?? verrou.depuis ?? '');
  return Number.isFinite(vu) && maintenant - vu < VERROU_EXPIRE;
}

/** Propriétés Drive : 124 octets au plus par clé + valeur ; on coupe les textes longs. */
const court = (texte) => String(texte ?? '').slice(0, 90);

/**
 * Crée la synchronisation. drive : voir partage/drive.js ; appareil : { id, nom }.
 */
export function creerSynchro(drive, appareil) {
  let racineId = null;
  let appTopoId = null; // dossier « App Topo » (les listes partagées y sont rangées)

  /** Dossier qui contient les projets : « App Topo › Configuration Projet » (créés au premier besoin). */
  async function racine() {
    if (racineId) return racineId;
    const dossier = async (nom, parentId, cle) => {
      const dans = parentId ? `'${parentId}' in parents and ` : '';
      const trouves = await drive.lister(`${dans}mimeType = '${TYPE_DOSSIER}' and appProperties has { key='topo' and value='${cle}' }`);
      return trouves[0]?.id ?? (await drive.creerDossier(nom, parentId, { topo: cle })).id;
    };
    appTopoId = await dossier(NOM_RACINE, null, 'app-topo');
    racineId = await dossier(NOM_PROJETS, appTopoId, 'configuration-projet');
    return racineId;
  }

  /** Fichier des listes partagées (adresses mail, réglages swipos) dans « App Topo », ou null. */
  async function fichierListes() {
    await racine();
    const trouves = await drive.lister(`'${appTopoId}' in parents and appProperties has { key='topo' and value='listes-partagees' }`);
    return trouves[0] ?? null;
  }

  /** Dossier Drive d'un projet, ou null. */
  async function dossierDuProjet(projetId) {
    const parent = await racine();
    const trouves = await drive.lister(`'${parent}' in parents and appProperties has { key='projetId' and value='${projetId}' }`);
    return trouves[0] ?? null;
  }

  const verrouDe = (dossier) => {
    const p = dossier.appProperties ?? {};
    return p.verrouPar
      ? { appareilId: p.verrouPar, nom: p.verrouNom ?? '?', depuis: p.verrouDepuis ?? null, vu: p.verrouVu ?? p.verrouDepuis ?? null }
      : null;
  };
  const proprietesVerrou = () => {
    const maintenant = new Date().toISOString();
    return { verrouPar: appareil.id, verrouNom: court(appareil.nom), verrouDepuis: maintenant, verrouVu: maintenant };
  };

  return {
    /** Projets sur Drive : [{ dossierId, projetId, titre, modifieLe, verrou: { appareilId, nom, depuis } ou null }]. */
    async listerProjets() {
      const parent = await racine();
      const dossiers = await drive.lister(`'${parent}' in parents and mimeType = '${TYPE_DOSSIER}'`);
      return dossiers
        .filter((d) => d.appProperties?.projetId)
        .map((d) => ({ dossierId: d.id, projetId: d.appProperties.projetId, titre: d.appProperties.titre ?? d.name, modifieLe: d.appProperties.modifieLe ?? null, verrou: verrouDe(d) }));
    },

    /**
     * Envoie le projet (seulement les fichiers changés depuis le dernier envoi, "memoire"), et le
     * verrouille au nom de cet appareil. Si un autre appareil a pris la main, rien n'est envoyé.
     * Renvoie { memoire } (nouvelle mémoire à garder) ou { repris: verrou }.
     */
    async envoyer(projet, memoire = null, titre = projet.nom) {
      let dossier = memoire?.dossierId ? await drive.decrire(memoire.dossierId).catch(() => null) : null;
      if (!dossier || dossier.trashed) dossier = await dossierDuProjet(projet.id);
      if (dossier) {
        // Verrou d'un autre appareil encore en vie : il a la main, on n'écrase rien.
        const verrou = verrouDe(dossier);
        if (verrou && verrou.appareilId !== appareil.id && verrouActif(verrou)) return { repris: verrou };
      } else {
        // Nouveau dossier : seulement les propriétés qui ont une valeur (pas de « null » à la création).
        const proprietes = Object.fromEntries(Object.entries({ projetId: projet.id, titre: court(titre), ...proprietesVerrou() }).filter(([, v]) => v != null));
        dossier = await drive.creerDossier(court(titre), await racine(), proprietes);
      }

      const existants = new Map((await drive.listerDossier(dossier.id)).map((f) => [f.name, f]));
      const fichiers = projetVersFichiers(projet);
      const empreintes = {};
      // Le projet en dernier : quand il arrive, les plans et les photos sont déjà là.
      const noms = [...fichiers.keys()].sort((a, b) => Number(a === FICHIER_PROJET) - Number(b === FICHIER_PROJET));
      for (const nom of noms) {
        const contenu = fichiers.get(nom);
        empreintes[nom] = await empreinte(contenu);
        const existant = existants.get(nom);
        if (existant && memoire?.empreintes?.[nom] === empreintes[nom]) continue; // pas changé
        const blob = await comprimer(contenu);
        if (existant) await drive.ecrireContenu(existant.id, new Blob([blob], { type: 'application/gzip' }));
        else await drive.creerFichier(nom, dossier.id, new Blob([blob], { type: 'application/gzip' }));
      }
      // Plans ou photos enlevés du projet : à la corbeille de Drive.
      for (const [nom, fichier] of existants) if (!fichiers.has(nom)) await drive.supprimer(fichier.id);

      // Main prise par un autre appareil pendant l'envoi : on ne lui reprend pas le verrou.
      const prisEntreTemps = verrouDe(await drive.decrire(dossier.id));
      if (prisEntreTemps && prisEntreTemps.appareilId !== appareil.id && verrouActif(prisEntreTemps)) return { repris: prisEntreTemps };
      await drive.modifier(dossier.id, { nom: court(titre), proprietes: { titre: court(titre), modifieLe: projet.modifieLe ?? '', ...proprietesVerrou() } });
      return { memoire: { dossierId: dossier.id, envoyeLe: projet.modifieLe ?? null, empreintes } };
    },

    /** Télécharge un projet de Drive. Renvoie { projet, memoire, verrou, modifieLe }. */
    async telecharger(dossierId) {
      const dossier = await drive.decrire(dossierId);
      const lus = new Map();
      const empreintes = {};
      for (const fichier of await drive.listerDossier(dossierId)) {
        const objet = await decomprimer(await drive.lire(fichier.id));
        lus.set(fichier.name, objet);
        empreintes[fichier.name] = await empreinte(objet);
      }
      const projet = fichiersVersProjet(lus);
      return {
        projet,
        memoire: { dossierId, envoyeLe: projet.modifieLe ?? null, empreintes },
        verrou: verrouDe(dossier),
        modifieLe: dossier.appProperties?.modifieLe ?? projet.modifieLe ?? null,
      };
    },

    /** Prend la main sur un projet : le verrou passe à cet appareil. */
    async prendreVerrou(dossierId) {
      await drive.modifier(dossierId, { proprietes: proprietesVerrou() });
    },

    /**
     * Rend un projet (on en ouvre un autre, « Rendre la main », 5 minutes sans rien faire) : le
     * verrou est enlevé, s'il est encore à cet appareil.
     */
    async rendreVerrou(dossierId) {
      const dossier = await drive.decrire(dossierId);
      if (verrouDe(dossier)?.appareilId !== appareil.id) return;
      await drive.modifier(dossierId, { proprietes: { verrouPar: null, verrouNom: null, verrouDepuis: null, verrouVu: null } });
    },

    /**
     * Verrou d'un projet, lu toutes les 30 s (0.76.0) : { verrou (ou null), modifieLe }. Un verrou
     * sans signe de vie depuis 15 minutes compte comme null.
     */
    async lireVerrou(dossierId) {
      const dossier = await drive.decrire(dossierId);
      const verrou = verrouDe(dossier);
      return { verrou: verrouActif(verrou) ? verrou : null, modifieLe: dossier.appProperties?.modifieLe ?? null };
    },

    /**
     * Signe de vie (toutes les 5 minutes, projet ouvert) : le verrou reste à cet appareil.
     * Renvoie { repris: verrou } si un autre appareil a pris la main entre-temps, sinon {}.
     */
    async signeDeVie(dossierId) {
      const dossier = await drive.decrire(dossierId);
      const verrou = verrouDe(dossier);
      if (verrou && verrou.appareilId !== appareil.id && verrouActif(verrou)) return { repris: verrou };
      await drive.modifier(dossierId, { proprietes: { ...proprietesVerrou(), verrouDepuis: verrou?.appareilId === appareil.id ? verrou.depuis : new Date().toISOString() } });
      return {};
    },

    /**
     * Listes partagées par tous les appareils (0.79.0, voir reglages/listes-partagees.js) :
     * { listes, modifieLe } lues sur Drive, ou null s'il n'y en a pas encore.
     */
    async lireListes() {
      const fichier = await fichierListes();
      if (!fichier) return null;
      return { listes: await decomprimer(await drive.lire(fichier.id)), modifieLe: fichier.appProperties?.modifieLe ?? null };
    },

    /** Écrit les listes partagées sur Drive (fichier créé au premier envoi). */
    async ecrireListes(listes) {
      const fichier = await fichierListes();
      const blob = new Blob([await comprimer(listes)], { type: 'application/gzip' });
      if (fichier) await drive.ecrireContenu(fichier.id, blob);
      else {
        const cree = await drive.creerFichier('listes-partagees.json.gz', appTopoId, blob);
        await drive.modifier(cree.id, { proprietes: { topo: 'listes-partagees' } });
      }
      const id = fichier?.id ?? (await fichierListes())?.id;
      if (id) await drive.modifier(id, { proprietes: { topo: 'listes-partagees', modifieLe: listes.modifieLe ?? '' } });
    },

    /** Supprime un projet de Drive (son dossier va à la corbeille de Drive). */
    async supprimerProjet(dossierId) {
      await drive.supprimer(dossierId);
    },
  };
}

/**
 * Quelle version ouvrir quand un projet existe sur l'appareil et sur Drive ?
 * - local : modifieLe de la copie de l'appareil ; envoyeLe : date du projet au dernier envoi
 *   (ou téléchargement) depuis cet appareil ; distant : modifieLe sur Drive (dates ISO).
 * Renvoie 'local' (rien de nouveau sur Drive), 'distant' (Drive plus récent, rien à perdre ici)
 * ou 'conflit' (modifié des deux côtés depuis le dernier envoi).
 */
export function choisirVersion({ local, envoyeLe, distant }) {
  if (!distant) return 'local';
  if (!local) return 'distant';
  if (local === distant) return 'local';
  // Jamais échangé avec Drive depuis cet appareil, et les deux copies diffèrent : on demande.
  if (!envoyeLe) return 'conflit';
  const changeIci = local > envoyeLe;
  const changeLaBas = distant > envoyeLe;
  if (changeIci && changeLaBas) return 'conflit';
  return changeLaBas ? 'distant' : 'local';
}
