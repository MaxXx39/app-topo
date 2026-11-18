// Sous-dossiers d'un projet (0.251.0, demande du 16.11) : Terrassement, Canalo, Bâtiment… Ils REMPLACENT le « type » des plans DXF.
// - La liste des noms (avec une pastille de couleur chacun, comme les anciens types) est partagée par Drive avec les autres listes
//   (partie « sousDossiers » ; « dossiers » désigne déjà les dossiers de projets sur Drive, voir projet/dossiers.js).
// - Un élément (liste de points / levé, surface, plan DXF ou PDF, dessin, réseau) peut être dans PLUSIEURS sous-dossiers :
//   il porte `sousDossiers: ['Canalo', 'Terrassement']` (les noms). Aucun sous-dossier = « Sans dossier ».
// - Le sous-dossier choisi dans le menu du projet (« Tout » au départ) est un réglage de CHAQUE tablette : seuls les éléments
//   rangés dans ce sous-dossier sont montrés (plan, pages du projet, choix de surfaces). Voir / choisir : tous les modes ;
//   créer, ranger, déplacer : Expert.
import { lireListesPartagees, ecrireListesPartagees } from '../reglages/listes-partagees.js';

// Liste de départ réorganisée le 17.11 (TER., CANA, TS, AMEX, BAT, SITU, PIC, PERRIN1, PERRIN2, GEOOFF, GEOPERRIN, OLD, Autre), une couleur différente chacune.
// 0.257.0 : + PIC (plan d'installation de chantier). Les levés et les annotations n'ont PAS de dossier de base (0.260.0) : ils restent dans leurs catégories.
export const SOUS_DOSSIERS_DEPART = ['TER.', 'CANA', 'TS', 'AMEX', 'BAT', 'SITU', 'PIC', 'PERRIN1', 'PERRIN2', 'GEOOFF', 'GEOPERRIN', 'OLD', 'Autre'];
/** Dossier « Autre » (0.261.0) : toujours le dernier de la liste (remplace la puce « Sans dossier »). */
export const DOSSIER_AUTRE = 'Autre';
// 15 couleurs distinctes, dans l'ordre de la liste (les dossiers ajoutés ensuite reprennent la 1re, etc.).
const COULEURS = ['#6b7280', '#7c3aed', '#a16207', '#1d4ed8', '#ea580c', '#84cc16', '#0ea5e9', '#db2777', '#991b1b', '#eab308', '#0f766e', '#111827', '#be185d', '#0369a1', '#65a30d'];

/** Anciens types de plans (avant les dossiers) → nom du dossier de départ qui les remplace (comparaison sans tenir compte des majuscules). */
const ANCIENS_NOMS = { ter: 'TER.', 'bât': 'BAT', 'bat': 'BAT', 'bât radier': 'BAT-Rad.', 'bât/ss': 'BAT-SS', 'bât/rez': 'BAT-REZ' };
const nomActuel = (nom) => ANCIENS_NOMS[String(nom).trim().toLowerCase()] ?? nom;

/** Valeur du choix « Tout » (rien n'est filtré) et du choix « Sans dossier ». */
export const TOUT = '';
export const SANS_SOUS_DOSSIER = '__sans';

/** Texte ou liste → noms propres : sans doublon (majuscules ignorées), 20 signes au plus, séparés par virgule, point-virgule ou retour. */
export function nettoyerSousDossiers(texteOuListe) {
  const morceaux = Array.isArray(texteOuListe) ? texteOuListe : String(texteOuListe ?? '').split(/[,;\n]/);
  const vus = new Set();
  const noms = [];
  for (const m of morceaux) {
    const nom = String(m).trim().slice(0, 20);
    if (nom && nom !== SANS_SOUS_DOSSIER && !vus.has(nom.toLowerCase())) {
      vus.add(nom.toLowerCase());
      noms.push(nom);
    }
  }
  return noms;
}

/** Sous-dossiers proposés : la liste partagée, sinon ceux de départ ; + ceux déjà utilisés par des éléments du projet. [{ nom, couleur }] */
export function lireSousDossiers(projet = null, listes = lireListesPartagees()) {
  const propres = nettoyerSousDossiers(listes?.sousDossiers ?? []);
  const noms = propres.length > 0 ? propres : [...SOUS_DOSSIERS_DEPART];
  for (const nom of sousDossiersUtilises(projet)) if (!noms.some((n) => n.toLowerCase() === nom.toLowerCase())) noms.push(nom);
  // « Autre » toujours en bas de la liste.
  const sansAutre = noms.filter((n) => n.toLowerCase() !== DOSSIER_AUTRE.toLowerCase());
  noms.splice(0, noms.length, ...sansAutre, DOSSIER_AUTRE);
  return noms.map((nom, i) => ({ nom, couleur: COULEURS[i % COULEURS.length] }));
}

/** Couleur de texte lisible (noir ou blanc) sur un fond « #rrggbb » : luminance relative, seuil à 0,45 (0.252.0 : texte blanc illisible sur les fonds clairs). */
export function texteSur(fond) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(fond ?? ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [1, 2, 3].map((i) => {
    const c = parseInt(m[i], 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
}

/** Pastille HTML d'un sous-dossier (couleur de fond du dossier, texte noir ou blanc selon le fond). */
export function pastilleSousDossier(nom, liste) {
  const fond = liste.find((d) => d.nom === nom)?.couleur ?? '#6b7280';
  const echappe = String(nom).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<span class="pastille-pastel-dossier" style="background: ${fond}; color: ${texteSur(fond)}">${echappe}</span>`;
}

/** Couleur de la pastille d'un sous-dossier (gris s'il n'est plus dans la liste). */
export function couleurDuSousDossier(nom, liste) {
  return liste.find((d) => d.nom === nom)?.couleur ?? '#6b7280';
}

/** Enregistre la liste des sous-dossiers dans les listes partagées (envoyée sur Drive à tous les appareils). */
export function enregistrerSousDossiers(texteOuListe) {
  ecrireListesPartagees({ ...lireListesPartagees(), sousDossiers: nettoyerSousDossiers(texteOuListe) });
}

/** Tous les éléments rangeables du projet, avec leur genre : 'leve', 'surface', 'autre', 'plan', 'dessin', 'reseau'. */
export function elementsRangeables(projet) {
  const genres = [['leves', 'leve'], ['surfaces', 'surface'], ['autres', 'autre'], ['plansDxf', 'plan'], ['dessins', 'dessin'], ['canalisations', 'reseau']];
  return genres.flatMap(([cle, genre]) => (projet?.[cle] ?? []).map((element) => ({ genre, element })));
}

/** Noms de sous-dossiers portés par des éléments du projet. */
export function sousDossiersUtilises(projet) {
  const noms = new Set();
  for (const { element } of elementsRangeables(projet)) for (const nom of element.sousDossiers ?? []) noms.add(nom);
  return noms;
}

/**
 * Anciens projets (0.251.0) : le « type » d'un plan DXF devient un sous-dossier du même nom (« TER », « CANA »…), pour ne rien perdre.
 * Renvoie le nombre de plans changés.
 */
export function typesVersSousDossiers(projet) {
  let nb = 0;
  for (const plan of projet?.plansDxf ?? []) {
    if (!('type' in plan)) continue;
    const nom = nettoyerSousDossiers([nomActuel(plan.type)])[0];
    if (nom) {
      plan.sousDossiers = [...new Set([...(plan.sousDossiers ?? []), nom])];
      nb += 1;
    }
    delete plan.type;
  }
  // Plans déjà migrés par la 0.251 : « TER » devient « TER. » (liste de départ), etc.
  for (const plan of projet?.plansDxf ?? []) {
    if (!Array.isArray(plan.sousDossiers)) continue;
    const renommes = [...new Set(plan.sousDossiers.map(nomActuel))];
    if (renommes.join('|') !== plan.sousDossiers.join('|')) {
      plan.sousDossiers = renommes;
      nb += 1;
    }
  }
  return nb;
}

/** L'élément est-il montré quand `choix` est le sous-dossier choisi ? Tout : oui ; Sans dossier : s'il n'est dans aucun. */
export function dansSousDossier(element, choix) {
  if (!choix) return true;
  const portes = element?.sousDossiers ?? [];
  return choix === SANS_SOUS_DOSSIER ? portes.length === 0 : portes.includes(choix);
}

/** Nouveaux sous-dossiers de l'élément quand on coche / décoche `nom` (sans modifier l'élément). */
export function basculerSousDossier(element, nom, present) {
  const actuels = new Set(element?.sousDossiers ?? []);
  if (present) actuels.add(nom);
  else actuels.delete(nom);
  return [...actuels];
}

// --- Sous-dossier choisi sur CETTE tablette, projet par projet (clé « topo-sous-dossier ») ---
export const CLE_CHOIX = 'topo-sous-dossier';
let choisi = TOUT;

/** Sous-dossier choisi en ce moment (lu par les listes du plan et des pages). */
export function sousDossierChoisi() {
  return choisi;
}

/** Retient le choix en mémoire (sans le ranger sur l'appareil : voir retenirChoix). */
export function definirSousDossier(nom) {
  choisi = nom || TOUT;
}

function stockage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Range le choix de cette tablette pour ce projet. Tout = rien de gardé. */
export function retenirChoix(idProjet, nom, magasin = stockage()) {
  if (!idProjet || !magasin) return;
  try {
    const tout = JSON.parse(magasin.getItem(CLE_CHOIX) ?? '{}');
    if (nom) tout[idProjet] = nom;
    else delete tout[idProjet];
    magasin.setItem(CLE_CHOIX, JSON.stringify(tout));
  } catch {
    // stockage plein ou interdit : le choix revient simplement à « Tout »
  }
}

/** Choix retenu sur cette tablette pour ce projet (« Tout » s'il n'y en a pas, ou si ce sous-dossier n'existe plus). */
export function lireChoix(projet, magasin = stockage()) {
  try {
    const nom = JSON.parse(magasin?.getItem(CLE_CHOIX) ?? '{}')[projet?.id] ?? TOUT;
    if (nom === SANS_SOUS_DOSSIER) return TOUT; // 0.261.0 : la puce « Sans dossier » n'existe plus
    return nom && lireSousDossiers(projet).some((d) => d.nom === nom) ? nom : TOUT;
  } catch {
    return TOUT;
  }
}

/**
 * Sous-dossiers qui comptent pour un élément : une surface ou une liste « autres » issue d'un levé suit son levé (on range le levé,
 * ses surfaces suivent) ; sinon ceux de l'élément lui-même.
 */
export function sousDossiersEffectifs(projet, element, genre = '') {
  if ((genre === 'surface' || genre === 'autre') && element?.leveId) {
    const leve = (projet?.leves ?? []).find((l) => l.id === element.leveId);
    if (leve && Array.isArray(leve.sousDossiers)) return leve.sousDossiers;
  }
  return element?.sousDossiers ?? [];
}

// Filtre des applications : actif en Base seulement (réglé par main.js selon le mode).
let filtreApplications = true;
export function definirFiltreApplications(actif) {
  filtreApplications = Boolean(actif);
}

/** Texte « · TER., CANA » à ajouter au nom d'un élément dans une liste d'application (vide s'il n'est dans aucun dossier). */
export function suffixeDossiers(projet, element, genre = '') {
  const noms = sousDossiersEffectifs(projet, element, genre);
  return noms.length > 0 ? ` · ${noms.join(', ')}` : '';
}

/** L'élément est-il montré avec le sous-dossier choisi (celui de cette tablette par défaut) ? */
export function estMontre(projet, element, genre = '', choix = choisi) {
  // 0.259.0 : dans les applications, seul le mode Base est filtré par le dossier ; Intermédiaire et Expert listent tout (avec la pastille du dossier).
  if (!filtreApplications) return true;
  // 0.260.0 : un levé ou une liste d'annotations sans dossier reste montré (ils n'ont pas de dossier de base).
  if (choix && (genre === 'leve' || genre === 'autre') && sousDossiersEffectifs(projet, element, genre).length === 0) return true;
  return estDansSousDossier(projet, element, genre, choix);
}

/** Vrai si l'élément est rangé dans le dossier `choix` (Tout : oui), quel que soit le mode : sert à cocher / décocher l'affichage. */
export function estDansSousDossier(projet, element, genre = '', choix = choisi) {
  return dansSousDossier({ sousDossiers: sousDossiersEffectifs(projet, element, genre) }, choix);
}

/** Identifiants des éléments cachés par le sous-dossier choisi (vide si « Tout »), à ajouter aux listes décochées. */
export function idsHorsSousDossier(projet, choix = choisi) {
  const ids = new Set();
  if (!choix) return ids;
  for (const { genre, element } of elementsRangeables(projet)) if (!estMontre(projet, element, genre, choix)) ids.add(element.id);
  return ids;
}
