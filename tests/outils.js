// Petits outils partagés par les tests : surfaces et volumes du levé d'exemple.
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { lireListeDeNoms } from '../src/topo/noms.js';
import { creerSurface, calculerSurface } from '../src/topo/surface.js';
import { calculerVolumeSurface } from '../src/topo/volume.js';

/** Fabrique un point { nom, est, nord, altitude }. */
export const pt = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });

/**
 * Surface créée à partir de points : contour et lignes de rupture (listes de noms).
 * points : liste de noms choisis un par un, ou null pour « tous les points du levé ».
 */
export function surfaceDe({ nom = 'Essai', contour = [], lignes = null, points = null }) {
  const surface = creerSurface(nom, 'leve');
  surface.contour = contour;
  if (lignes) surface.lignesRupture = lignes;
  if (points) {
    surface.tousLesPoints = false;
    surface.points = points;
  }
  return surface;
}

/**
 * Volume d'une surface décrite comme pour surfaceDe : base A (points du contour) par défaut,
 * ou base B si surfaceBase = { nom, triangles } est donnée.
 */
export function volumeDe(description, pointsLeve, surfaceBase = null) {
  const surface = surfaceDe(description);
  return calculerVolumeSurface(surface, calculerSurface(surface, pointsLeve), pointsLeve, surfaceBase);
}

/** Points du levé du 20/05/2026 (fichier exemples/stock_export.txt). */
export function pointsDeReference() {
  return lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8')).points;
}

/** Les 3 stocks du levé de référence, avec leur volume de remblai Mensura (m³) et l'écart accepté. */
export const STOCKS_REFERENCE = [
  { nom: 'Stock 1', contour: 'b1 à b17', ligne: 'h1 à h31', mensura: 1636.197, tolerance: 8.2 },
  { nom: 'Stock 2', contour: 'b100 à b116', ligne: 'h100 à h114', mensura: 648.979, tolerance: 3.2 },
  { nom: 'Stock 3', contour: 'b200 à b217', ligne: 'h200 à h216', mensura: 372.201, tolerance: 1.9 },
];

/**
 * Surface d'un stock de référence, comme l'utilisateur la crée dans l'appli : contour,
 * ligne de rupture fermée, tous les points du levé, base A (points du contour).
 */
export function surfaceDeReference({ nom, contour, ligne }, points) {
  const noms = points.map((p) => p.nom);
  return surfaceDe({
    nom,
    contour: lireListeDeNoms(contour, noms).noms,
    lignes: [{ noms: lireListeDeNoms(ligne, noms).noms, fermee: true }],
  });
}

/** Volume d'un stock de référence (voir surfaceDeReference). */
export function volumeDeReference(stock, points) {
  const surface = surfaceDeReference(stock, points);
  return calculerVolumeSurface(surface, calculerSurface(surface, points), points);
}
