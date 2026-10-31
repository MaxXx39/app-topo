// Libellés des noms de points levés (onglet Terrain) : abréviations courtes qui disent ce que
// l'on lève, dans le nom du point (L-HT-1-3 : ligne de haut de talus n° 1, point 3 ; P-RG-2 : regard 2).
// Une liste pour les lignes de rupture (et les longueurs d'un métré), une pour les points isolés
// (et les points comptés), une pour les aires d'un métré (A-ENR-1-3 : aire d'enrobé n° 1, point 3).
// Listes de départ (lignes et points validées par l'utilisateur le 22.10.2026, aires proposées
// ensuite). Depuis 0.95.0 (demande du 30.10.2026) : les libellés de départ ne se modifient pas
// (seulement leur couleur) ; ceux ajoutés se modifient dans les réglages (Expert) et sont partagés
// par Drive avec tous les appareils (listes partagées, voir reglages/listes-partagees.js :
// libelles = { ajoutes: { lignes, points, aires }, couleurs: { lignes: { HT: '#…' }, … },
// formes: { points: { RG: 'carre' }, … } }). Forme du point (0.97.0, voir plan/formes.js) : 4e case.
import { lireListesPartagees, ecrireListesPartagees, surChangementListes } from '../reglages/listes-partagees.js';

export const LIBELLES_DEPART = {
  lignes: [
    ['HT', 'haut de talus'],
    ['BT', 'bas de talus'],
    ['BOR', 'bordure'],
    ['RTE', 'bord de route'],
    ['CH', 'chemin'],
    ['CAN', 'caniveau'],
    ['MUR', 'mur'],
    ['CLO', 'clôture'],
  ],
  points: [
    ['TN', 'point terrain'],
    ['RG', 'regard / chambre'],
    ['GR', 'grille'],
    ['ARB', 'arbre'],
    ['POT', 'poteau'],
    ['BRN', 'borne'],
    ['HYD', 'hydrante'],
  ],
  aires: [
    ['ENR', 'enrobé'],
    ['GRA', 'gravier'],
    ['GAZ', 'gazon'],
    ['PAV', 'pavés'],
    ['BET', 'béton'],
    ['DAL', 'dallage'],
  ],
};

const CLE_MEMOIRE = 'topo-libelles';

// Couleur d'un libellé (3e case : [abréviation, signification, couleur]), choisie par l'utilisateur
// (demande du 23.10.2026) : les points et les lignes de ce libellé sont dessinés de cette couleur
// sur le plan, dans le PDF et dans le DXF. '' = couleur habituelle (celle du rôle).
// [couleur, nom, couleur AutoCAD du DXF].
export const COULEURS_LIBELLES = [
  ['', 'habituelle', null],
  ['#111827', 'noir', 7],
  ['#6b7280', 'gris', 8],
  ['#2563eb', 'bleu', 5],
  ['#0ea5e9', 'bleu clair', 4],
  ['#4ade80', 'vert', 3],
  ['#166534', 'vert foncé', 94],
  ['#dc2626', 'rouge', 1],
  ['#ea580c', 'orange', 30],
  ['#ca8a04', 'jaune', 2],
  ['#7c3aed', 'violet', 200],
  ['#db2777', 'rose', 221],
  ['#92400e', 'brun', 34],
];

// Dernière liste lue, pour ne pas relire la mémoire de l'appareil à chaque dessin du plan.
let enCache = null;
// Listes partagées changées (ici ou reçues de Drive) : les libellés seront relus.
surChangementListes(() => (enCache = null));

const SORTES = ['lignes', 'points', 'aires'];

/**
 * Libellés : ceux de départ (fixes, avec leur couleur choisie), puis ceux ajoutés. Renvoie
 * { lignes, points, aires } ([[abréviation, signification, couleur (facultative)]]), une copie.
 */
export function lireLibelles() {
  if (!enCache) enCache = assemblerLibelles(lireListesPartagees().libelles ?? ancienneListe());
  return structuredClone(enCache);
}

/** Abréviations de départ d'une sorte ('lignes', 'points', 'aires') : elles ne se modifient pas. */
export function abreviationsDepart(sorte) {
  return new Set(LIBELLES_DEPART[sorte].map(([a]) => a));
}

/**
 * Libellés complets à partir de la part partagée { ajoutes, couleurs } : départ (avec couleur),
 * puis ajoutés (sans ceux qui ont le nom d'un libellé de départ).
 */
// Anciennes couleurs retenues par des libellés déjà enregistrés : remplacées par la nouvelle (0.105.1).
const ANCIENNES_COULEURS = { '#16a34a': '#4ade80' };
const couleurAJour = (couleur) => ANCIENNES_COULEURS[couleur] ?? couleur;

export function assemblerLibelles(partage) {
  const resultat = {};
  for (const sorte of SORTES) {
    const couleurs = partage?.couleurs?.[sorte] ?? {};
    const formes = partage?.formes?.[sorte] ?? {};
    const depart = LIBELLES_DEPART[sorte].map(([a, s]) => [a, s, couleurAJour(couleurs[a] ?? ''), formes[a] ?? '']);
    const fixes = abreviationsDepart(sorte);
    const ajoutes = (partage?.ajoutes?.[sorte] ?? []).filter(([a]) => a && !fixes.has(a)).map(([a, s, c, f]) => [a, s ?? '', couleurAJour(c ?? ''), f ?? '']);
    resultat[sorte] = [...depart, ...ajoutes];
  }
  return resultat;
}

/**
 * Part à partager d'une liste complète : { ajoutes, couleurs, formes } (les libellés de départ ne
 * gardent que leur couleur et leur forme).
 */
export function partDesLibelles(libelles) {
  const partage = { ajoutes: {}, couleurs: {}, formes: {} };
  for (const sorte of SORTES) {
    const fixes = abreviationsDepart(sorte);
    const liste = libelles[sorte] ?? [];
    partage.ajoutes[sorte] = liste.filter(([a]) => !fixes.has(a)).map(([a, s, c, f]) => [a, s ?? '', c ?? '', f ?? '']);
    partage.couleurs[sorte] = Object.fromEntries(liste.filter(([a, , c]) => fixes.has(a) && c).map(([a, , c]) => [a, c]));
    partage.formes[sorte] = Object.fromEntries(liste.filter(([a, , , f]) => fixes.has(a) && f).map(([a, , , f]) => [a, f]));
  }
  return partage;
}

/** Forme du point d'après le libellé de son nom (P-RG-3, L-HT-1-2, A-ENR-1-2), ou '' (rond plein). */
export function formeDuNom(nom, libelles = lireLibelles()) {
  const decoupe = /^([PLA])-([^-]+)-\d+(-\d+)?$/.exec(String(nom ?? ''));
  if (!decoupe) return '';
  const liste = { P: libelles.points, L: libelles.lignes, A: libelles.aires }[decoupe[1]];
  return (liste ?? []).find(([a]) => a === decoupe[2])?.[3] || '';
}

/** Anciens libellés de cet appareil (avant 0.95.0, « topo-libelles »), en part partagée, ou null. */
function ancienneListe() {
  try {
    const lus = JSON.parse(localStorage.getItem(CLE_MEMOIRE));
    if (lus?.lignes?.length > 0) return partDesLibelles({ lignes: lus.lignes, points: lus.points ?? [], aires: lus.aires ?? [] });
  } catch {
    // Mémoire indisponible ou abîmée : on reprend la liste de départ.
  }
  return null;
}

/** Enregistre les libellés : dans les listes partagées (envoyées sur Drive à tous les appareils). */
export function enregistrerLibelles(libelles) {
  ecrireListesPartagees({ ...lireListesPartagees(), libelles: partDesLibelles(libelles) });
  enCache = null;
}

/** Couleur d'une abréviation dans une liste de libellés, ou null (pas de couleur choisie). */
function couleurDansListe(liste, abreviation) {
  return (liste ?? []).find(([a]) => a === abreviation)?.[2] || null;
}

/**
 * Couleur d'un point d'après le libellé de son nom (P-RG-3 : libellé RG des points ; L-HT-1-2 :
 * HT des lignes ; A-ENR-1-2 : ENR des aires), ou null.
 */
export function couleurDuNom(nom, libelles = lireLibelles()) {
  const decoupe = /^([PLA])-([^-]+)-\d+(-\d+)?$/.exec(String(nom ?? ''));
  if (!decoupe) return null;
  const [, lettre, abreviation] = decoupe;
  const liste = { P: libelles.points, L: libelles.lignes, A: libelles.aires }[lettre];
  return couleurDansListe(liste, abreviation);
}

/** Couleur d'une ligne de rupture : son libellé (ligne.libelle), sinon celui de son premier point, ou null. */
export function couleurDeLigne(ligne, libelles = lireLibelles()) {
  if (ligne?.libelle) return couleurDansListe(libelles.lignes, ligne.libelle);
  return couleurDuNom(ligne?.noms?.[0], libelles);
}

/** Abréviation utilisable dans un nom de point : sans espace ni tiret (« h t » → « HT »), en majuscules. */
export function nettoyerAbreviation(texte) {
  return String(texte).replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Lit une liste tapée par l'utilisateur, une ligne par libellé : l'abréviation, puis sa
 * signification (« HT haut de talus »). Les lignes vides sont ignorées, une abréviation en double
 * n'est gardée qu'une fois. Renvoie [[abréviation, signification]].
 */
export function lireTexteLibelles(texte) {
  const liste = [];
  for (const ligne of String(texte).split('\n')) {
    const [premier, ...reste] = ligne.trim().split(/\s+/);
    const abreviation = nettoyerAbreviation(premier ?? '');
    if (!abreviation || liste.some(([a]) => a === abreviation)) continue;
    liste.push([abreviation, reste.join(' ')]);
  }
  return liste;
}

/** Texte d'une liste de libellés, une ligne par libellé (pour la modifier). */
export function ecrireTexteLibelles(liste) {
  return liste.map(([abreviation, signification]) => `${abreviation} ${signification}`.trim()).join('\n');
}

/** Couleur AutoCAD (DXF) d'une couleur de libellé, ou null (couleur du calque). */
export function aciDeCouleurLibelle(couleur) {
  return COULEURS_LIBELLES.find(([c]) => c && c === couleur)?.[2] ?? null;
}
