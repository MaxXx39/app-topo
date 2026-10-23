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

/** Libellés retenus sur l'appareil, ou ceux de départ. Renvoie { lignes, points, aires } ([[abréviation, signification]]). */
export function lireLibelles() {
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
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(libelles));
  } catch {
    // Mémoire indisponible : la liste ne sera simplement pas retenue.
  }
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
