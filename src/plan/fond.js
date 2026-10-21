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

// Fonds disponibles : photo aérienne, et cadastre posé par-dessus.
// Le cadastre est la couche « Mensuration officielle » de swisstopo : seulement les limites des
// parcelles et les bâtiments, en traits, sur un fond transparent (on voit la photo aérienne
// derrière). Elle n'existe qu'en service WMS : on demande une image PNG transparente par tuile,
// à la place exacte de la tuile (BBOX = Est min, Nord min, Est max, Nord max, en MN95).
export const FONDS = {
  satellite: {
    url: (z, colonne, ligne) =>
      `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/${z}/${colonne}/${ligne}.jpeg`,
    attribution: '© swisstopo',
  },
  cadastre: {
    url: (z, colonne, ligne) => {
      const { estMin, nordMin, estMax, nordMax } = emprise(z, colonne, ligne);
      return (
        'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo-vd.amtliche-vermessung' +
        `&STYLES=&CRS=EPSG:2056&BBOX=${estMin},${nordMin},${estMax},${nordMax}` +
        `&WIDTH=${TAILLE_TUILE}&HEIGHT=${TAILLE_TUILE}&FORMAT=image/png&TRANSPARENT=true`
      );
    },
    attribution: 'Mensuration officielle © swisstopo / cantons',
  },
};

// Fonds de secours : si une tuile d'un fond ne se charge pas, on essaie celle-ci à la place.
// Le cadastre en traits (service WMS) peut refuser d'être copié dans le PDF ou être indisponible :
// on reprend alors le plan cadastral en couleurs (tuiles WMTS, comme la photo aérienne).
export const FONDS_SECOURS = {
  cadastre: {
    url: (z, colonne, ligne) =>
      `https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/2056/${z}/${colonne}/${ligne}.png`,
    attribution: 'Cadastre © cantons',
  },
};

/** Emprise d'une tuile sur le terrain (m, MN95) : { estMin, nordMin, estMax, nordMax }. */
export function emprise(z, colonne, ligne) {
  const cote = TAILLE_TUILE * RESOLUTIONS[z];
  const estMin = ORIGINE_EST + colonne * cote;
  const nordMax = ORIGINE_NORD - ligne * cote;
  return { estMin, nordMin: nordMax - cote, estMax: estMin + cote, nordMax };
}

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
