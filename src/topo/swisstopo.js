// Surface Swisstopo (0.109.0, demande du 02.11.2026, mode Expert) : terrain tiré du modèle
// altimétrique swissALTI3D de swisstopo (grille de 0,5 m, carrés de 1 km × 1 km, MN95 / RAN95).
// 1. on trace le contour de la zone sur le plan (sommets en MN95) ;
// 2. on télécharge les carrés de 1 km qui touchent la zone (import/swisstopo.js) ;
// 3. grille de 0,5 m dans le contour (les centres des pixels : …,25 et …,75) ;
// 4. on garde une grille plus large (1, 2 ou 5 m) ou on réduit « Intelligent » (méthode validée le
//    02.11.2026 : on part de quelques points, on ajoute à chaque tour, dans chaque triangle, le point
//    le plus loin en hauteur des triangles s'il dépasse la tolérance (5, 10 ou 20 cm), jusqu'à ce
//    que tout le terrain soit à moins de la tolérance : peu de points en terrain plat, beaucoup dans
//    les talus et les ruptures de pente) ;
// 5. triangles de ces points (seulement ceux dans le contour) → surface « SWISSTOP … ».
// Coordonnées : Est, Nord, altitude (m, MN95). Aucune altitude n'est inventée : chaque point est un
// pixel du modèle de swisstopo.
import Delaunator from 'delaunator';
import { mini, maxi } from '../outils/bornes.js';
import { avecPrefixe, nouvelIdentifiant, PREFIXE_SWISSTOP } from './surface.js';

export { PREFIXE_SWISSTOP };
export const RESOLUTION = 0.5; // m : taille du pixel de swissALTI3D
export const PAS_GRILLE = [0.5, 1, 2, 5]; // m : choix « grille régulière »
export const TOLERANCES = [0.05, 0.1, 0.2]; // m : choix « Intelligent »
export const SURFACE_MAX = 2e6; // m² : rectangle de la zone au plus (sinon trop lourd pour la tablette)
export const POINTS_LOURDS = 100000; // au-delà, le plan et les calculs deviennent lents

/**
 * Position approchée en degrés WGS84 d'un point MN95 (formules approchées officielles de
 * swisstopo, précises à ~1 m). Sert seulement à demander à swisstopo quels carrés couvrent la zone :
 * aucune coordonnée du projet n'est convertie. Renvoie { longitude, latitude }.
 */
export function versWgs84Approche(est, nord) {
  const y = (est - 2600000) / 1e6;
  const x = (nord - 1200000) / 1e6;
  const lambda = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3;
  const phi = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3;
  return { longitude: (lambda * 100) / 36, latitude: (phi * 100) / 36 };
}

/** Rectangle des sommets { est, nord } : { estMin, estMax, nordMin, nordMax }. */
export function rectangleDe(sommets) {
  const est = sommets.map((s) => s.est);
  const nord = sommets.map((s) => s.nord);
  return { estMin: mini(est), estMax: maxi(est), nordMin: mini(nord), nordMax: maxi(nord) };
}

/**
 * Vérifie le contour tracé. Renvoie un message d'erreur, ou null s'il est bon : au moins 3 sommets,
 * une aire, en Suisse (MN95), pas trop grand.
 */
export function erreurDuContour(sommets) {
  if (sommets.length < 3) return 'il faut au moins 3 sommets';
  if (Math.abs(aire(sommets)) < 1) return 'la zone n\'a pas de surface';
  const r = rectangleDe(sommets);
  if (r.estMin < 2480000 || r.estMax > 2840000 || r.nordMin < 1070000 || r.nordMax > 1300000) return 'la zone n\'est pas en Suisse (MN95)';
  const surface = (r.estMax - r.estMin) * (r.nordMax - r.nordMin);
  if (surface > SURFACE_MAX) return `zone trop grande (rectangle de ${(surface / 1e6).toFixed(2)} km²) : ${SURFACE_MAX / 1e6} km² au plus`;
  return null;
}

/** Carrés de 1 km qui touchent le rectangle de la zone : [{ e, n }] (coin bas gauche, en km). */
export function carresDeLaZone(sommets) {
  const r = rectangleDe(sommets);
  const carres = [];
  for (let e = Math.floor(r.estMin / 1000); e <= Math.floor(r.estMax / 1000); e++) {
    for (let n = Math.floor(r.nordMin / 1000); n <= Math.floor(r.nordMax / 1000); n++) carres.push({ e, n });
  }
  return carres;
}

/**
 * Dans la réponse de swisstopo (liste « features » du catalogue STAC), le fichier GeoTIFF à 0,5 m
 * le plus récent de chaque carré voulu. Renvoie { fichiers: [{ e, n, annee, url }], manquants: [{ e, n }] }.
 */
export function choisirFichiers(features, carres) {
  const parCarre = new Map();
  for (const feature of features ?? []) {
    const trouve = /_(\d{4})_(\d{4})-(\d{4})$/.exec(String(feature?.id ?? ''));
    if (!trouve) continue;
    const [annee, e, n] = trouve.slice(1).map(Number);
    const asset = Object.entries(feature.assets ?? {}).find(([cle, a]) => /_0\.5_2056_\d+\.tif$/i.test(String(a?.href ?? cle)));
    if (!asset) continue;
    const cle = `${e}-${n}`;
    if (!parCarre.has(cle) || parCarre.get(cle).annee < annee) parCarre.set(cle, { e, n, annee, url: asset[1].href });
  }
  const fichiers = [];
  const manquants = [];
  for (const carre of carres) {
    const fichier = parCarre.get(`${carre.e}-${carre.n}`);
    if (fichier) fichiers.push(fichier);
    else manquants.push(carre);
  }
  return { fichiers, manquants };
}

/**
 * Grille de 0,5 m couvrant le rectangle de la zone, remplie avec les GeoTIFF lus (voir
 * geotiff-lecture.js). Les pixels hors du contour ou sans donnée valent NaN.
 * Renvoie { est0, nord0 (centre de la case en bas à gauche), nx, ny, z (Float32Array, ligne par
 * ligne depuis le bas), valides (nombre de cases avec une altitude) }.
 */
export function grilleDeLaZone(sommets, rasters) {
  const r = rectangleDe(sommets);
  // Centres des pixels de swissALTI3D : …,25 et …,75.
  const versIndice = (v) => Math.floor((v - RESOLUTION / 2) / RESOLUTION);
  const i0 = versIndice(r.estMin);
  const j0 = versIndice(r.nordMin);
  const nx = versIndice(r.estMax) - i0 + 2;
  const ny = versIndice(r.nordMax) - j0 + 2;
  const est0 = i0 * RESOLUTION + RESOLUTION / 2;
  const nord0 = j0 * RESOLUTION + RESOLUTION / 2;
  const z = new Float32Array(nx * ny).fill(Number.NaN);
  for (const raster of rasters) {
    for (let j = 0; j < ny; j++) {
      const nord = nord0 + j * RESOLUTION;
      const ligne = Math.round((raster.nord0 - nord) / raster.pas);
      if (ligne < 0 || ligne >= raster.hauteur) continue;
      for (let i = 0; i < nx; i++) {
        const colonne = Math.round((est0 + i * RESOLUTION - raster.est0) / raster.pas);
        if (colonne < 0 || colonne >= raster.largeur) continue;
        const valeur = raster.valeurs[ligne * raster.largeur + colonne];
        if (Number.isFinite(valeur)) z[j * nx + i] = valeur;
      }
    }
  }
  // Hors du contour : NaN (test ligne par ligne, avec les croisements des côtés).
  let valides = 0;
  for (let j = 0; j < ny; j++) {
    const nord = nord0 + j * RESOLUTION;
    const croisements = [];
    for (let k = 0; k < sommets.length; k++) {
      const a = sommets[k];
      const b = sommets[(k + 1) % sommets.length];
      if ((a.nord > nord) !== (b.nord > nord)) croisements.push(a.est + ((nord - a.nord) / (b.nord - a.nord)) * (b.est - a.est));
    }
    croisements.sort((p, q) => p - q);
    for (let i = 0; i < nx; i++) {
      const est = est0 + i * RESOLUTION;
      let dedans = false;
      for (const c of croisements) if (c < est) dedans = !dedans;
      if (!dedans) z[j * nx + i] = Number.NaN;
      else if (Number.isFinite(z[j * nx + i])) valides++;
    }
  }
  return { est0, nord0, nx, ny, z, valides, sommets: sommets.map(({ est, nord }) => ({ est, nord })) };
}

/** Rang de la case dans la grille swissALTI3D de toute la Suisse (pour des grilles alignées). */
function rangGlobal(grille, i, j) {
  return [Math.round((grille.est0 - RESOLUTION / 2) / RESOLUTION) + i, Math.round((grille.nord0 - RESOLUTION / 2) / RESOLUTION) + j];
}

/** Indices des cases gardées pour une grille régulière de "pas" m (0,5 ; 1 ; 2 ; 5). */
function indicesEnGrille(grille, pas) {
  const k = Math.max(1, Math.round(pas / RESOLUTION));
  const indices = [];
  for (let j = 0; j < grille.ny; j++) {
    for (let i = 0; i < grille.nx; i++) {
      const [gi, gj] = rangGlobal(grille, i, j);
      if (gi % k === 0 && gj % k === 0 && Number.isFinite(grille.z[j * grille.nx + i])) indices.push(j * grille.nx + i);
    }
  }
  return indices;
}

/** Nombre de points d'une grille régulière de "pas" m dans la zone. */
export function nombreEnGrille(grille, pas) {
  return indicesEnGrille(grille, pas).length;
}

/** Coordonnées de la case n° indice : { est, nord, altitude }. */
function pointDeCase(grille, indice) {
  return {
    est: grille.est0 + (indice % grille.nx) * RESOLUTION,
    nord: grille.nord0 + Math.floor(indice / grille.nx) * RESOLUTION,
    altitude: grille.z[indice],
  };
}

/** Triangles (indices dans "points") de ces points, seulement ceux dont le centre est dans le contour. */
export function trianglesDansContour(points, sommets) {
  if (points.length < 3) return [];
  const coordonnees = new Float64Array(points.length * 2);
  // Coordonnées locales (meilleure précision des calculs de la triangulation).
  const e0 = points[0].est;
  const n0 = points[0].nord;
  points.forEach((p, i) => {
    coordonnees[2 * i] = p.est - e0;
    coordonnees[2 * i + 1] = p.nord - n0;
  });
  const { triangles } = new Delaunator(coordonnees);
  const faces = [];
  for (let t = 0; t < triangles.length; t += 3) {
    const [a, b, c] = [triangles[t], triangles[t + 1], triangles[t + 2]];
    const centre = { est: (points[a].est + points[b].est + points[c].est) / 3, nord: (points[a].nord + points[b].nord + points[c].nord) / 3 };
    if (dansPolygone(centre, sommets)) faces.push([a, b, c]);
  }
  return faces;
}

/**
 * Réduction « Intelligent » (méthode validée le 02.11.2026) : renvoie les indices des cases
 * gardées pour que tout le terrain de la grille soit à moins de "tolerance" m (en hauteur) des
 * triangles. Départ : une case tous les 10 m, le long du contour une case tous les 5 m, et la
 * case la plus proche de chaque sommet de la zone.
 */
export function indicesIntelligents(grille, tolerance) {
  const { nx, ny, z } = grille;
  const garde = new Uint8Array(nx * ny);
  const gardes = [];
  const ajouter = (indice) => {
    if (indice >= 0 && !garde[indice] && Number.isFinite(z[indice])) {
      garde[indice] = 1;
      gardes.push(indice);
    }
  };
  // Une case tous les 10 m (20 pixels).
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [gi, gj] = rangGlobal(grille, i, j);
      if (gi % 20 === 0 && gj % 20 === 0) ajouter(j * nx + i);
    }
  }
  // Bord de la zone : les cases valides qui touchent une case vide, une sur 10 (≈ 5 m).
  let compte = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const indice = j * nx + i;
      if (!Number.isFinite(z[indice])) continue;
      const vide = (a, b) => a < 0 || b < 0 || a >= nx || b >= ny || !Number.isFinite(z[b * nx + a]);
      if (vide(i - 1, j) || vide(i + 1, j) || vide(i, j - 1) || vide(i, j + 1)) {
        if (compte % 10 === 0) ajouter(indice);
        compte++;
      }
    }
  }
  // Coins de la zone : la case valide la plus proche de chaque sommet (les angles restent nets).
  for (const sommet of grille.sommets ?? []) {
    const ci = Math.round((sommet.est - grille.est0) / RESOLUTION);
    const cj = Math.round((sommet.nord - grille.nord0) / RESOLUTION);
    let meilleur = -1;
    let distanceMin = Infinity;
    for (let j = cj - 4; j <= cj + 4; j++) {
      for (let i = ci - 4; i <= ci + 4; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny || !Number.isFinite(z[j * nx + i])) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < distanceMin) {
          distanceMin = d;
          meilleur = j * nx + i;
        }
      }
    }
    ajouter(meilleur);
  }
  // Tours : dans chaque triangle, le point le plus loin en hauteur, s'il dépasse la tolérance.
  for (let tour = 0; tour < 200; tour++) {
    if (gardes.length < 3) break;
    const coordonnees = new Float64Array(gardes.length * 2);
    gardes.forEach((indice, k) => {
      coordonnees[2 * k] = indice % nx;
      coordonnees[2 * k + 1] = Math.floor(indice / nx);
    });
    let triangles;
    try {
      triangles = new Delaunator(coordonnees).triangles;
    } catch {
      break;
    }
    const nouveaux = [];
    for (let t = 0; t < triangles.length; t += 3) {
      const pire = pireCase(grille, garde, [gardes[triangles[t]], gardes[triangles[t + 1]], gardes[triangles[t + 2]]], tolerance);
      if (pire >= 0) nouveaux.push(pire);
    }
    if (nouveaux.length === 0) break;
    for (const indice of nouveaux) ajouter(indice);
  }
  return gardes;
}

/**
 * Dans le triangle (3 indices de cases), la case la plus loin en hauteur du plan du triangle, si
 * cet écart dépasse la tolérance ; sinon -1. Les cases vides (hors contour) sont ignorées.
 */
function pireCase(grille, garde, sommets, tolerance) {
  const { nx, z } = grille;
  const [a, b, c] = sommets.map((indice) => ({ i: indice % nx, j: Math.floor(indice / nx), z: z[indice] }));
  const det = (b.j - c.j) * (a.i - c.i) + (c.i - b.i) * (a.j - c.j);
  if (det === 0) return -1;
  let pire = -1;
  let ecartPire = tolerance;
  const iMin = Math.max(0, Math.min(a.i, b.i, c.i));
  const iMax = Math.max(a.i, b.i, c.i);
  const jMin = Math.max(0, Math.min(a.j, b.j, c.j));
  const jMax = Math.max(a.j, b.j, c.j);
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      // Coordonnées barycentriques : la case est dans le triangle si les 3 sont ≥ 0.
      const l1 = ((b.j - c.j) * (i - c.i) + (c.i - b.i) * (j - c.j)) / det;
      const l2 = ((c.j - a.j) * (i - c.i) + (a.i - c.i) * (j - c.j)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const indice = j * nx + i;
      const altitude = z[indice];
      if (garde[indice] || !Number.isFinite(altitude)) continue;
      const ecart = Math.abs(altitude - (l1 * a.z + l2 * b.z + l3 * c.z));
      if (ecart > ecartPire) {
        ecartPire = ecart;
        pire = indice;
      }
    }
  }
  return pire;
}

/** Nombre de points de la réduction « Intelligent » pour cette tolérance (m). */
export function nombreIntelligent(grille, tolerance) {
  return indicesIntelligents(grille, tolerance).length;
}

/**
 * Points de la surface pour le choix fait : { sorte: 'grille', pas } ou { sorte: 'intelligent',
 * tolerance }. Renvoie [{ est, nord, altitude }] (altitudes au mm).
 */
export function pointsDuChoix(grille, choix) {
  const indices = choix.sorte === 'intelligent' ? indicesIntelligents(grille, choix.tolerance) : indicesEnGrille(grille, choix.pas);
  return indices.map((indice) => {
    const p = pointDeCase(grille, indice);
    return { est: p.est, nord: p.nord, altitude: Math.round(p.altitude * 1000) / 1000 };
  });
}

/**
 * Surface du projet faite avec ces points : { id, nom (« SWISSTOP … »), type: 'swisstopo',
 * nomFichier (origine), points [{ nom SW-n, est, nord, altitude }], faces }.
 */
export function surfaceSwisstopo(nom, points, sommets, origine) {
  const faces = trianglesDansContour(points, sommets);
  return {
    id: nouvelIdentifiant(),
    nom: avecPrefixe(nom, PREFIXE_SWISSTOP),
    type: 'swisstopo',
    nomFichier: origine,
    contourZone: sommets.map(({ est, nord }) => ({ est, nord })),
    points: points.map((p, i) => ({ nom: `SW-${i + 1}`, est: p.est, nord: p.nord, altitude: p.altitude })),
    faces,
  };
}

/** Aire (signée) d'un polygone { est, nord } (m²). */
function aire(sommets) {
  let somme = 0;
  for (let k = 0; k < sommets.length; k++) {
    const a = sommets[k];
    const b = sommets[(k + 1) % sommets.length];
    somme += a.est * b.nord - b.est * a.nord;
  }
  return somme / 2;
}

/** Vrai si le point { est, nord } est dans le polygone. */
function dansPolygone(point, sommets) {
  let dedans = false;
  for (let k = 0, l = sommets.length - 1; k < sommets.length; l = k++) {
    const a = sommets[k];
    const b = sommets[l];
    if ((a.nord > point.nord) !== (b.nord > point.nord) && point.est < ((b.est - a.est) * (point.nord - a.nord)) / (b.nord - a.nord) + a.est) dedans = !dedans;
  }
  return dedans;
}
