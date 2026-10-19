// Fonds de plan swisstopo (service WMTS de geo.admin.ch), directement en MN95 (EPSG:2056) :
// aucune conversion de coordonnées.
//
// Le fond est découpé en "tuiles" carrées de 256 × 256 pixels. Pour chaque niveau de zoom,
// une tuile couvre 256 × résolution mètres. La grille part du coin en haut à gauche
// (Est 2 420 000, Nord 1 350 000) ; les colonnes vont vers l'Est, les lignes vers le Sud.

// Résolutions (m par pixel) de chaque niveau de zoom, du niveau 0 au niveau 28.
export const RESOLUTIONS = [
  4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10,
  5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1,
];
const ORIGINE_EST = 2420000;
const ORIGINE_NORD = 1350000;
const TAILLE_TUILE = 256; // pixels

// Fonds disponibles : photo aérienne et plan cadastral (transparent, posé par-dessus).
export const FONDS = {
  satellite: {
    url: (z, colonne, ligne) =>
      `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/${z}/${colonne}/${ligne}.jpeg`,
    attribution: '© swisstopo',
  },
  cadastre: {
    url: (z, colonne, ligne) =>
      `https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/2056/${z}/${colonne}/${ligne}.png`,
    attribution: 'Cadastre © cantons',
  },
};

/**
 * Choisit le niveau de zoom des tuiles : le moins détaillé qui reste net à l'écran.
 * - metresParPixel : taille d'un pixel de l'écran sur le terrain (m)
 * - densite : pixels réels par pixel affiché (écrans haute définition : 2 ou 3)
 */
export function niveauDeZoom(metresParPixel, densite = 1) {
  const cible = metresParPixel / Math.min(densite, 2);
  const niveau = RESOLUTIONS.findIndex((resolution) => resolution <= cible);
  return niveau === -1 ? RESOLUTIONS.length - 1 : niveau;
}

/**
 * Tuiles nécessaires pour couvrir une zone du terrain.
 * - zone : { estMin, estMax, nordMin, nordMax } en m
 * Renvoie une liste de { z, colonne, ligne, est, nord, cote } où (est, nord) est le coin
 * en haut à gauche de la tuile et cote sa largeur sur le terrain (m).
 */
export function tuilesPourZone(zone, z) {
  const cote = TAILLE_TUILE * RESOLUTIONS[z];
  const colonneMin = Math.floor((zone.estMin - ORIGINE_EST) / cote);
  const colonneMax = Math.floor((zone.estMax - ORIGINE_EST) / cote);
  const ligneMin = Math.floor((ORIGINE_NORD - zone.nordMax) / cote);
  const ligneMax = Math.floor((ORIGINE_NORD - zone.nordMin) / cote);
  const tuiles = [];
  for (let ligne = ligneMin; ligne <= ligneMax; ligne++) {
    for (let colonne = colonneMin; colonne <= colonneMax; colonne++) {
      tuiles.push({ z, colonne, ligne, est: ORIGINE_EST + colonne * cote, nord: ORIGINE_NORD - ligne * cote, cote });
    }
  }
  return tuiles;
}
