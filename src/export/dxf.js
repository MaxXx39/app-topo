// Export DXF (format AutoCAD R12, lu par AutoCAD, Mensura et la plupart des logiciels de DAO).
// Coordonnées MN95 : X = Est, Y = Nord, Z = altitude (m).
//
// Calques créés :
// - POINTS : les points levés (avec altitude)       - NOMS : nom de chaque point
// - ALTITUDES : altitude de chaque point écrite sous son nom (m, 3 décimales)
// - CONTOURS : contour de chaque surface (3D)       - LIGNES_RUPTURE : lignes de rupture (3D)
// - TRIANGLES_<nom> : triangles de chaque surface dont le volume est calculé (faces 3D)
// - SURFACE_<nom> : triangles des autres surfaces (faces 3D)
// - COURBES : courbes de niveau des surfaces calculées (si demandées)
import { courbesDeNiveau } from '../topo/courbes.js';
import { formaterNombre } from '../topo/format.js';

// Couleurs AutoCAD (numéros) : 1 rouge, 2 jaune, 3 vert, 4 cyan, 5 bleu, 6 magenta, 7 blanc/noir, 8 gris, 30 orange.
const COULEURS = { POINTS: 7, NOMS: 8, ALTITUDES: 5, CONTOURS: 1, LIGNES_RUPTURE: 30, COURBES: 32 };

/**
 * Construit le texte du fichier DXF.
 * - points : points du levé
 * - stocks, resultats : surfaces dont le volume est calculé, et leurs volumes (resultats[i].trianglesDessus)
 * - surfaces : liste de { nom, triangles }
 * - equidistance : équidistance des courbes de niveau (m), ou null pour ne pas en mettre
 */
export function genererDxf({ points, stocks = [], resultats = [], surfaces = [], equidistance = null }) {
  const entites = [];
  const calques = new Map(Object.entries(COULEURS).filter(([nom]) => nom !== 'COURBES' || equidistance));
  const parNom = new Map(points.map((p) => [p.nom, p]));

  for (const p of points) {
    entites.push(['0', 'POINT', '8', 'POINTS', ...xyz(p, 0)]);
    entites.push(['0', 'TEXT', '8', 'NOMS', ...xyz({ ...p, est: p.est + 0.2, nord: p.nord + 0.2 }, 0), '40', '0.3', '1', p.nom]);
    // Altitude sous le nom (texte de 0.25 m de haut)
    entites.push(['0', 'TEXT', '8', 'ALTITUDES', ...xyz({ ...p, est: p.est + 0.2, nord: p.nord - 0.4 }, 0), '40', '0.25', '1', formaterNombre(p.altitude)]);
  }

  stocks.forEach((stock, i) => {
    const contour = (stock.contour ?? []).map((nom) => parNom.get(nom)).filter(Boolean);
    if (contour.length >= 3) entites.push(...polyligne3D(contour, true, 'CONTOURS'));
    for (const ligne of stock.lignesRupture ?? []) {
      const sommets = ligne.noms.map((nom) => parNom.get(nom)).filter(Boolean);
      if (sommets.length >= 2) entites.push(...polyligne3D(sommets, ligne.fermee, 'LIGNES_RUPTURE'));
    }
    const triangles = resultats[i]?.trianglesDessus;
    if (triangles?.length > 0) {
      const calque = nomDeCalque(`TRIANGLES_${stock.nom}`);
      calques.set(calque, 8);
      for (const t of triangles) entites.push(face3D(t, calque));
      if (equidistance) {
        for (const { altitude, a, b } of courbesDeNiveau(triangles, equidistance)) {
          entites.push(['0', 'LINE', '8', 'COURBES', ...xyz({ ...a, altitude }, 0), ...xyz({ ...b, altitude }, 1)]);
        }
      }
    }
  });

  surfaces.forEach((surface) => {
    const calque = nomDeCalque(`SURFACE_${surface.nom}`);
    calques.set(calque, 5);
    for (const t of surface.triangles) entites.push(face3D(t, calque));
  });

  const lignes = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(calques.size),
    ...[...calques].flatMap(([nom, couleur]) => ['0', 'LAYER', '2', nom, '70', '0', '62', String(couleur), '6', 'CONTINUOUS']),
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...entites.flat(),
    '0', 'ENDSEC', '0', 'EOF',
  ];
  return lignes.join('\r\n') + '\r\n';
}

/** Codes DXF d'un point : X (10+n), Y (20+n), Z (30+n). */
function xyz(p, n) {
  return [String(10 + n), arrondi(p.est), String(20 + n), arrondi(p.nord), String(30 + n), arrondi(p.altitude ?? 0)];
}

/** Face 3D (triangle : le 4e sommet répète le 3e). */
function face3D([a, b, c], calque) {
  return ['0', '3DFACE', '8', calque, ...xyz(a, 0), ...xyz(b, 1), ...xyz(c, 2), ...xyz(c, 3)];
}

/** Polyligne 3D (fermée ou non). */
function polyligne3D(sommets, fermee, calque) {
  return [
    ['0', 'POLYLINE', '8', calque, '66', '1', '10', '0', '20', '0', '30', '0', '70', String(8 + (fermee ? 1 : 0))],
    ...sommets.map((p) => ['0', 'VERTEX', '8', calque, ...xyz(p, 0), '70', '32']),
    ['0', 'SEQEND', '8', calque],
  ];
}

/** Nom de calque accepté par AutoCAD : majuscules, sans accent ni espace. */
function nomDeCalque(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .slice(0, 31);
}

/** Coordonnée avec 3 décimales (mm), comme dans Mensura. */
function arrondi(valeur) {
  return valeur.toFixed(3);
}
