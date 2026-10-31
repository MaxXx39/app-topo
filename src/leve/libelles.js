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

// Couleur habituelle de chaque sorte sur le plan quand le libellé n'a pas de couleur choisie
// (lignes orange, points vert, aires cyan) : aussi celle des symboles de forme dans Lever.
export const COULEURS_HABITUELLES = { lignes: '#ea580c', points: '#15803d', aires: '#0891b2' };

// Libellés propres au projet ouvert (0.105.6) : { lignes, points, aires } de [abréviation, signification,
// couleur, forme]. Ils s'ajoutent à ceux « par défaut » (la liste partagée, valable dans tous les projets).
let duProjet = { lignes: [], points: [], aires: [] };
let signatureProjet = JSON.stringify(duProjet);
let quandProjetChange = null;

/** Libellés du projet qui vient de s'ouvrir ou de changer (appelé par main.js) ; sans effet s'ils sont identiques. */
export function definirLibellesProjet(libelles) {
  const propres = Object.fromEntries(SORTES.map((sorte) => [sorte, (libelles?.[sorte] ?? []).map(([a, s, c, f]) => [a, s ?? '', couleurAJour(c ?? ''), f ?? ''])]));
  const signature = JSON.stringify(propres);
  if (signature === signatureProjet) return;
  duProjet = propres;
  signatureProjet = signature;
}

/** main.js y range les libellés du projet quand la fenêtre des libellés les change : fonction(libelles). */
export function surLibellesProjet(fonction) {
  quandProjetChange = fonction;
}

/** Libellés propres au projet ouvert (une copie). */
export function lireLibellesProjet() {
  return structuredClone(duProjet);
}

/** Enregistre les libellés propres au projet ouvert (ils partent avec le projet, sur Drive aussi). */
export function enregistrerLibellesProjet(libelles) {
  definirLibellesProjet(libelles);
  quandProjetChange?.(structuredClone(duProjet));
}

/** Libellés « par défaut » seulement (liste partagée, tous les projets) : { lignes, points, aires }. */
export function lireLibellesParDefaut() {
  if (!enCache) enCache = assemblerLibelles(lireListesPartagees().libelles ?? ancienneListe());
  return structuredClone(enCache);
}

/**
 * Libellés : ceux par défaut (de départ, avec leur couleur choisie, puis ajoutés), puis ceux du projet. Renvoie
 * { lignes, points, aires } ([[abréviation, signification, couleur, forme]]), une copie. Pour l'écran, les exports et le plan :
 * par défaut, puis ceux du projet (un projet ne
 * redonne pas une abréviation déjà par défaut).
 */
export function lireLibelles() {
  const defaut = lireLibellesParDefaut();
  return Object.fromEntries(SORTES.map((sorte) => [sorte, [...defaut[sorte], ...duProjet[sorte].filter(([a]) => !defaut[sorte].some(([d]) => d === a))]]));
}

/** Libellés pour la fenêtre de modification : [abréviation, signification, couleur, forme, parDéfaut (vrai / faux)]. */
export function lireLibellesDetail() {
  const defaut = lireLibellesParDefaut();
  return Object.fromEntries(SORTES.map((sorte) => [sorte, [
    ...defaut[sorte].map((l) => [...l, true]),
    ...duProjet[sorte].filter(([a]) => !defaut[sorte].some(([d]) => d === a)).map((l) => [...l, false]),
  ]]));
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
    // 0.105.5 (Expert) : liste complète modifiable, départ compris ; elle remplace départ + ajoutés.
    if (Array.isArray(partage?.complet?.[sorte])) {
      resultat[sorte] = partage.complet[sorte].filter(([a]) => a).map(([a, s, c, f]) => [a, s ?? '', couleurAJour(c ?? ''), f ?? '']);
      continue;
    }
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
  const partage = { ajoutes: {}, couleurs: {}, formes: {}, complet: {} };
  for (const sorte of SORTES) {
    partage.complet[sorte] = (libelles[sorte] ?? []).map(([a, s, c, f]) => [a, s ?? '', c ?? '', f ?? '']);
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

/**
 * Libellés qui manquent à la liste d'après les noms de points d'un projet (0.105.5, anciens projets :
 * un libellé supprimé est recréé) : { lignes: [abréviations], points: [...], aires: [...] }. Les noms
 * sans libellé (L-1-3, P-5) et les noms d'un autre genre (C-Stock-1-1) sont ignorés.
 */
export function libellesManquants(noms, libelles = lireLibelles()) {
  const manquants = { lignes: new Set(), points: new Set(), aires: new Set() };
  const sorte = { L: 'lignes', P: 'points', A: 'aires' };
  for (const nom of noms) {
    const decoupe = /^([PLA])-([^-]+)-\d+(-\d+)?$/.exec(String(nom ?? ''));
    if (!decoupe || /^\d+$/.test(decoupe[2])) continue;
    const cle = sorte[decoupe[1]];
    if (!(libelles[cle] ?? []).some(([a]) => a === decoupe[2])) manquants[cle].add(decoupe[2]);
  }
  return Object.fromEntries(SORTES.map((cle) => [cle, [...manquants[cle]]]));
}

/**
 * Recrée les libellés manquants d'après ces noms de points, comme libellés de ce projet seulement
 * (pas dans la liste par défaut). Renvoie les libellés du projet complétés, ou null s'il n'en manque pas.
 */
export function recreerLibellesManquants(noms) {
  const manquants = libellesManquants(noms, lireLibelles());
  if (SORTES.every((sorte) => manquants[sorte].length === 0)) return null;
  const propres = lireLibellesProjet();
  for (const sorte of SORTES) for (const abreviation of manquants[sorte]) propres[sorte].push([abreviation, '', '', '']);
  definirLibellesProjet(propres);
  return propres;
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
