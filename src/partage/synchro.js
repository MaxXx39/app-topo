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
// modifieLe, envoyePar (id de l'appareil qui a fait le dernier envoi, 0.103.4), et le verrou
// (verrouPar = id de l'appareil, verrouNom, verrouDepuis, verrouVu = dernier signe de vie de l'appareil).
// Un verrou sans signe de vie depuis 15 minutes (tablette éteinte, appli fermée sans ✕) ne compte
// plus : le projet est libre (décision du 23.10.2026).
// Sur l'appareil, une petite mémoire par projet (voir memoire.js) retient le dossier Drive, la
// date du dernier envoi, la date de Drive vue à ce moment (distantVu) et l'empreinte de chaque fichier
// envoyé (pour ne renvoyer que ce qui change).
// Règle (0.103.4) : un appareil n'envoie jamais par-dessus une version qu'un autre appareil a mise
// sur Drive et qu'il n'a pas reçue (par ex. après plus de 15 minutes sans réseau) : il prend
// d'abord la version de Drive (voir changeAilleurs).
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

/**
 * Vrai si un autre appareil a mis sur Drive une version que cet appareil n'a pas reçue depuis son
 * dernier échange. proprietes : propriétés du dossier Drive (modifieLe, envoyePar, verrouPar) ;
 * memoire : mémoire du projet sur cet appareil (distantVu, ou envoyeLe pour les anciennes mémoires) ;
 * appareilId : cet appareil. La date de Drive est comparée telle quelle (pas d'horloge à comparer).
 */
export function changeAilleurs(proprietes, memoire, appareilId) {
  const distant = proprietes?.modifieLe;
  if (!distant) return false;
  if (distant === (memoire?.distantVu ?? memoire?.envoyeLe ?? null)) return false;
  // Envoi fait par cet appareil (réponse de Drive perdue) : rien de nouveau. Ancien dossier sans
  // envoyePar : celui qui avait le verrou a fait le dernier envoi.
  return (proprietes.envoyePar ?? proprietes.verrouPar) !== appareilId;
}

/** Nom lisible d'un fichier du dossier Drive d'un projet (pour les messages d'erreur). */
export function decrireFichier(nom) {
  if (nom === FICHIER_PROJET) return 'fichier du projet';
  if (nom.startsWith('plan-')) return `plan DXF (${nom})`;
  if (nom.startsWith('photo-')) return `photo (${nom})`;
  return nom;
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
    /** Projets sur Drive : [{ dossierId, projetId, titre, modifieLe, envoyePar, verrou: { appareilId, nom, depuis } ou null }]. */
    async listerProjets() {
      const parent = await racine();
      const dossiers = await drive.lister(`'${parent}' in parents and mimeType = '${TYPE_DOSSIER}'`);
      return dossiers
        // Sans date de modification, le premier envoi n'est pas fini (dossier créé, fichiers pas tous
        // arrivés) : il n'y a encore rien à ouvrir, le projet n'est pas proposé.
        .filter((d) => d.appProperties?.projetId && d.appProperties?.modifieLe)
        .map((d) => ({ dossierId: d.id, projetId: d.appProperties.projetId, titre: d.appProperties.titre ?? d.name, modifieLe: d.appProperties.modifieLe ?? null, envoyePar: d.appProperties.envoyePar ?? null, verrou: verrouDe(d) }));
    },

    /**
     * Envoie le projet (seulement les fichiers changés depuis le dernier envoi, "memoire"), et le
     * verrouille au nom de cet appareil. Si un autre appareil a pris la main, rien n'est envoyé.
     * Si un autre appareil a envoyé une version que cet appareil n'a pas reçue, rien n'est envoyé non
     * plus (on ne l'écrase pas).
     * Renvoie { memoire } (nouvelle mémoire à garder), { repris: verrou } ou { changeAilleurs: true, dossierId }.
     */
    async envoyer(projet, memoire = null, titre = projet.nom) {
      let dossier = memoire?.dossierId ? await drive.decrire(memoire.dossierId).catch(() => null) : null;
      if (!dossier || dossier.trashed) dossier = await dossierDuProjet(projet.id);
      if (dossier) {
        // Verrou d'un autre appareil encore en vie : il a la main, on n'écrase rien.
        const verrou = verrouDe(dossier);
        if (verrou && verrou.appareilId !== appareil.id && verrouActif(verrou)) return { repris: verrou };
        if (changeAilleurs(dossier.appProperties, memoire, appareil.id)) return { changeAilleurs: true, dossierId: dossier.id };
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
      const modifieLe = projet.modifieLe ?? '';
      await drive.modifier(dossier.id, { nom: court(titre), proprietes: { titre: court(titre), modifieLe, envoyePar: appareil.id, ...proprietesVerrou() } });
      return { memoire: { dossierId: dossier.id, envoyeLe: projet.modifieLe ?? null, distantVu: modifieLe, empreintes } };
    },

    /** Télécharge un projet de Drive. Renvoie { projet, memoire, verrou, modifieLe }. */
    async telecharger(dossierId) {
      const dossier = await drive.decrire(dossierId);
      const lus = new Map();
      const empreintes = {};
      for (const fichier of await drive.listerDossier(dossierId)) {
        let objet;
        try {
          objet = await decomprimer(await drive.lire(fichier.id));
        } catch (erreur) {
          // Le message dit quel fichier du dossier Drive pose problème (plan DXF, photo, projet).
          throw new Error(`${decrireFichier(fichier.name)} : ${erreur.message}`);
        }
        lus.set(fichier.name, objet);
        empreintes[fichier.name] = await empreinte(objet);
      }
      const projet = fichiersVersProjet(lus);
      // distantVu : la date de Drive lue avant les fichiers (si un envoi arrive pendant la lecture,
      // il sera vu comme nouveau et relu).
      return {
        projet,
        memoire: { dossierId, envoyeLe: projet.modifieLe ?? null, distantVu: dossier.appProperties?.modifieLe ?? null, empreintes },
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
     * Verrou d'un projet, lu toutes les 30 s (0.76.0) : { verrou (ou null), modifieLe, changeAilleurs }.
     * Un verrou sans signe de vie depuis 15 minutes compte comme null. changeAilleurs : vrai si un
     * autre appareil a envoyé une version pas encore reçue ici (memoire : mémoire du projet).
     */
    async lireVerrou(dossierId, memoire = null) {
      const dossier = await drive.decrire(dossierId);
      const verrou = verrouDe(dossier);
      return {
        verrou: verrouActif(verrou) ? verrou : null,
        modifieLe: dossier.appProperties?.modifieLe ?? null,
        changeAilleurs: Boolean(memoire) && changeAilleurs(dossier.appProperties, memoire, appareil.id),
      };
    },

    /**
     * Signe de vie (toutes les 5 minutes, projet ouvert) : le verrou reste à cet appareil.
     * Renvoie { repris: verrou } si un autre appareil a pris la main entre-temps, { changeAilleurs: true }
     * s'il a envoyé une version pas encore reçue ici (rien n'est écrit), sinon {}.
     */
    async signeDeVie(dossierId, memoire = null) {
      const dossier = await drive.decrire(dossierId);
      const verrou = verrouDe(dossier);
      if (verrou && verrou.appareilId !== appareil.id && verrouActif(verrou)) return { repris: verrou };
      if (memoire && changeAilleurs(dossier.appProperties, memoire, appareil.id)) return { changeAilleurs: true };
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
 *   (ou téléchargement) depuis cet appareil ; distant : modifieLe sur Drive (dates ISO) ;
 *   distantVu : modifieLe de Drive au dernier échange (0.103.4 ; absent dans les anciennes mémoires).
 * Renvoie 'local' (rien de nouveau sur Drive), 'distant' (Drive plus récent, rien à perdre ici)
 * ou 'conflit' (modifié des deux côtés depuis le dernier envoi).
 */
export function choisirVersion({ local, envoyeLe, distant, distantVu }) {
  if (!distant) return 'local';
  if (!local) return 'distant';
  if (local === distant) return 'local';
  // Jamais échangé avec Drive depuis cet appareil, et les deux copies diffèrent : on demande.
  if (!envoyeLe) return 'conflit';
  const changeIci = local > envoyeLe;
  // Changé sur Drive : sa date n'est plus celle vue au dernier échange (sans comparer d'horloges).
  const changeLaBas = distantVu != null ? distant !== distantVu : distant > envoyeLe;
  if (changeIci && changeLaBas) return 'conflit';
  return changeLaBas ? 'distant' : 'local';
}
