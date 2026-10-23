// Libellés des noms de points levés (onglet Terrain) : abréviations courtes qui disent ce que
// l'on lève, dans le nom du point (L-HT-1-3 : ligne de haut de talus n° 1, point 3 ; P-RG-2 : regard 2).
// Une liste pour les lignes de rupture (et les longueurs d'un métré), une pour les points isolés
// (et les points comptés), une pour les aires d'un métré (A-ENR-1-3 : aire d'enrobé n° 1, point 3).
// Listes de départ (lignes et points validées par l'utilisateur le 22.10.2026, aires proposées
// ensuite), qu'il complète dans l'appli ; elles sont gardées sur l'appareil (pour tous les projets).

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
  ['#16a34a', 'vert', 3],
  ['#dc2626', 'rouge', 1],
  ['#ea580c', 'orange', 30],
  ['#ca8a04', 'jaune', 2],
  ['#7c3aed', 'violet', 200],
  ['#db2777', 'rose', 221],
  ['#92400e', 'brun', 34],
];

// Dernière liste lue, pour ne pas relire la mémoire de l'appareil à chaque dessin du plan.
let enCache = null;

/**
 * Libellés retenus sur l'appareil, ou ceux de départ. Renvoie { lignes, points, aires }
 * ([[abréviation, signification, couleur (facultative)]]), une copie qu'on peut modifier.
 */
export function lireLibelles() {
  if (!enCache) enCache = lireMemoire();
  return structuredClone(enCache);
}

function lireMemoire() {
  try {
    const lus = JSON.parse(localStorage.getItem(CLE_MEMOIRE));
    // Listes retenues avant les métrés : sans aires, on prend celles de départ.
    if (lus?.lignes?.length > 0 && lus?.points?.length > 0) return { ...lus, aires: lus.aires?.length > 0 ? lus.aires : structuredClone(LIBELLES_DEPART.aires) };
  } catch {
    // Mémoire indisponible ou abîmée : on reprend la liste de départ.
  }
  return structuredClone(LIBELLES_DEPART);
}

/** Retient les libellés sur l'appareil. */
export function enregistrerLibelles(libelles) {
  enCache = structuredClone(libelles);
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(libelles));
  } catch {
    // Mémoire indisponible : la liste ne sera simplement pas retenue.
  }
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
