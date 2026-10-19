// Couleurs selon l'altitude, utilisées sur l'écran et dans le PDF.

// Du plus bas (bleu) au plus haut (rouge), palette classique des cartes d'altitude.
const PALETTE = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'];

/**
 * Couleur [rouge, vert, bleu] (0 à 255) d'une altitude (m), entre plage.min et plage.max,
 * en mélangeant les couleurs voisines de la palette.
 */
export function couleurRVB(altitude, plage) {
  const etendue = plage.max - plage.min;
  const t = etendue > 0 ? Math.min(Math.max((altitude - plage.min) / etendue, 0), 1) : 0.5;
  const position = t * (PALETTE.length - 1);
  const i = Math.min(Math.floor(position), PALETTE.length - 2);
  const melange = position - i;
  const avant = enRVB(PALETTE[i]);
  const apres = enRVB(PALETTE[i + 1]);
  return avant.map((canal, k) => Math.round(canal + (apres[k] - canal) * melange));
}

/** Même couleur, écrite pour une page web : 'rgb(44, 123, 182)'. */
export function couleurAltitude(altitude, plage) {
  return `rgb(${couleurRVB(altitude, plage).join(', ')})`;
}

/** '#2c7bb6' -> [44, 123, 182] */
function enRVB(couleur) {
  return [1, 3, 5].map((i) => parseInt(couleur.slice(i, i + 2), 16));
}
