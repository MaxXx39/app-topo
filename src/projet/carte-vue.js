// Calculs de la carte des projets (0.216.0) : vue = { est, nord, echelle } (centre de la carte en MN95 et pixels par mètre).
// Tout est en MN95 (m), comme le fond swisstopo : aucune conversion. Les fonctions ne touchent pas à l'écran.

/** Échelle minimale (1 pixel = 4 km : toute la Suisse) et maximale (10 pixels par mètre). */
export const ECHELLE_MIN = 0.00025;
export const ECHELLE_MAX = 10;
/** Largeur visible (m) au-delà de laquelle la photo aérienne laisse place à la carte nationale (comme le plan). */
export const LARGEUR_CARTE_NATIONALE = 2000;

const borner = (valeur) => Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, valeur));

/** Point du terrain { est, nord } → pixel { x, y } de la carte (largeur × hauteur en pixels). */
export function versEcran(vue, largeur, hauteur, est, nord) {
  return { x: largeur / 2 + (est - vue.est) * vue.echelle, y: hauteur / 2 - (nord - vue.nord) * vue.echelle };
}

/** Pixel de la carte → point du terrain { est, nord } (l'inverse de versEcran). */
export function versTerrain(vue, largeur, hauteur, x, y) {
  return { est: vue.est + (x - largeur / 2) / vue.echelle, nord: vue.nord - (y - hauteur / 2) / vue.echelle };
}

/** Zone du terrain visible : { estMin, estMax, nordMin, nordMax }. */
export function zoneVisible(vue, largeur, hauteur) {
  const a = versTerrain(vue, largeur, hauteur, 0, 0);
  const b = versTerrain(vue, largeur, hauteur, largeur, hauteur);
  return { estMin: a.est, estMax: b.est, nordMin: b.nord, nordMax: a.nord };
}

/** Fond à montrer : 'satellite' (photo aérienne) jusqu'à 2 km de large visible, puis 'carte' (carte nationale). */
export function fondSelonLargeur(vue, largeur) {
  return largeur / vue.echelle > LARGEUR_CARTE_NATIONALE ? 'carte' : 'satellite';
}

/**
 * Vue qui montre tous les centres [{ est, nord }] avec une marge. Un seul centre : environ 1 km de large. Aucun : la Suisse entière.
 */
export function vueSurCentres(centres, largeur, hauteur) {
  if (centres.length === 0) return { est: 2660000, nord: 1185000, echelle: borner(Math.min(largeur / 360000, hauteur / 230000)) };
  const ests = centres.map((c) => c.est);
  const nords = centres.map((c) => c.nord);
  const [estMin, estMax, nordMin, nordMax] = [Math.min(...ests), Math.max(...ests), Math.min(...nords), Math.max(...nords)];
  const largeurTerrain = Math.max(estMax - estMin, 1) * 1.4;
  const hauteurTerrain = Math.max(nordMax - nordMin, 1) * 1.4;
  const echelle = centres.length === 1 || (estMax - estMin < 50 && nordMax - nordMin < 50)
    ? largeur / 1000
    : Math.min(largeur / largeurTerrain, hauteur / hauteurTerrain);
  return { est: (estMin + estMax) / 2, nord: (nordMin + nordMax) / 2, echelle: borner(echelle) };
}

/** Zoom d'un facteur autour du pixel (x, y) : le point du terrain sous ce pixel ne bouge pas. */
export function zoomerVue(vue, facteur, x, y, largeur, hauteur) {
  const echelle = borner(vue.echelle * facteur);
  const sous = versTerrain(vue, largeur, hauteur, x, y);
  return { echelle, est: sous.est - (x - largeur / 2) / echelle, nord: sous.nord + (y - hauteur / 2) / echelle };
}

/** Déplacement de la carte de (dx, dy) pixels (le doigt glisse : le terrain suit le doigt). */
export function deplacerVue(vue, dx, dy) {
  return { ...vue, est: vue.est - dx / vue.echelle, nord: vue.nord + dy / vue.echelle };
}
