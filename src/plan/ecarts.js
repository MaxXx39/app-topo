// Couleurs remblai / déblai par paliers de hauteur, utilisées sur le plan et dans le PDF.
//
// On part des « triangles d'écart » du calcul de volume (voir volumeEntreSurfaces) :
// leur « altitude » est l'écart de hauteur dessus - base (m). On les découpe en bandes
// d'un palier de hauteur (comme des courbes de niveau, mais sur l'écart) :
// - écart positif = remblai, en rouge : plus le remblai est épais, plus le rouge est foncé ;
// - écart négatif = déblai, en jaune : plus le déblai est profond, plus le jaune est foncé.
// Unités : mètres.
import { bandesDeNiveau } from '../topo/courbes.js';

// Couleurs [rouge, vert, bleu] du palier le plus faible (clair) au plus fort (foncé).
const REMBLAI = { clair: [254, 202, 202], fonce: [153, 27, 27] };
const DEBLAI = { clair: [254, 240, 138], fonce: [161, 98, 7] };
// Paliers proposés (m). « auto » : choisi pour avoir au plus 6 classes de chaque côté.
export const PALIERS = ['auto', '0.1', '0.25', '0.5', '1'];
const PALIERS_AUTO = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
// Au-delà, les classes restantes prennent la couleur la plus foncée (légende lisible).
const CLASSES_MAX = 12;

/** Plus grand remblai et plus grand déblai (m, valeurs positives) des triangles d'écart. */
export function ecartsExtremes(trianglesEcart) {
  let remblai = 0;
  let deblai = 0;
  for (const triangle of trianglesEcart) {
    for (const { altitude } of triangle) {
      remblai = Math.max(remblai, altitude);
      deblai = Math.max(deblai, -altitude);
    }
  }
  return { remblai, deblai };
}

/** Palier (m) : celui choisi, ou en « auto » le plus petit qui donne au plus 6 classes. */
export function choisirPalier(trianglesEcart, choix = 'auto') {
  if (choix !== 'auto' && Number(choix) > 0) return Number(choix);
  const { remblai, deblai } = ecartsExtremes(trianglesEcart);
  const plusGrand = Math.max(remblai, deblai);
  return PALIERS_AUTO.find((palier) => plusGrand / palier <= 6) ?? 20;
}

/** Nombre de classes d'un côté (remblai ou déblai) pour un écart maximal donné (m). */
function nombreDeClasses(ecartMax, palier) {
  return Math.min(Math.max(Math.ceil(ecartMax / palier - 1e-9), 1), CLASSES_MAX);
}

/** Mélange de deux couleurs (t = 0 : clair, t = 1 : foncé). */
function melanger({ clair, fonce }, t) {
  return clair.map((canal, k) => Math.round(canal + (fonce[k] - canal) * t));
}

/** Couleur de la classe "rang" (0 = la plus faible) sur "nombre" classes. Une seule classe : teinte moyenne. */
function couleurDeClasse(teinte, rang, nombre) {
  const t = nombre > 1 ? Math.min(rang, nombre - 1) / (nombre - 1) : 0.5;
  return melanger(teinte, t);
}

/**
 * Découpe les triangles d'écart en zones colorées, une par palier.
 * Renvoie { palier, zones: [{ couleur: [r, v, b], polygone: [{ est, nord }] }], legende }.
 * legende = { palier, remblai: [{ de, a, couleur }], deblai: [{ de, a, couleur }] } (de, a en m).
 */
export function zonesRemblaiDeblai(trianglesEcart, choix = 'auto') {
  const palier = choisirPalier(trianglesEcart, choix);
  const extremes = ecartsExtremes(trianglesEcart);
  const classes = { remblai: nombreDeClasses(extremes.remblai, palier), deblai: nombreDeClasses(extremes.deblai, palier) };

  const zones = [];
  for (const { altitude: bas, polygone } of bandesDeNiveau(trianglesEcart, palier)) {
    // Bande [bas, bas + palier] : au-dessus de 0 c'est du remblai, en dessous du déblai.
    const couleur =
      bas >= 0
        ? couleurDeClasse(REMBLAI, Math.round(bas / palier), classes.remblai)
        : couleurDeClasse(DEBLAI, Math.round(-bas / palier) - 1, classes.deblai);
    zones.push({ couleur, polygone });
  }

  const legendeCote = (teinte, ecartMax, nombre) =>
    ecartMax > 1e-6
      ? Array.from({ length: nombre }, (_, rang) => ({
          de: rang * palier,
          a: rang === nombre - 1 ? Math.max(ecartMax, (rang + 1) * palier) : (rang + 1) * palier,
          couleur: couleurDeClasse(teinte, rang, nombre),
        }))
      : [];
  const legende = {
    palier,
    remblai: legendeCote(REMBLAI, extremes.remblai, classes.remblai),
    deblai: legendeCote(DEBLAI, extremes.deblai, classes.deblai),
  };
  return { palier, zones, legende };
}

/** Couleur [r, v, b] écrite pour une page web : 'rgb(254, 202, 202)'. */
export const enRgb = (couleur) => `rgb(${couleur.join(', ')})`;
