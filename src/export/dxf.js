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
//
// Le DXF des mesures (onglet Calculs › Mesures, voir genererDxfMesures) est un fichier à part, sans volume.
import { courbesDeNiveau } from '../topo/courbes.js';
import { formaterNombre } from '../topo/format.js';
import { nomsDeLaMesure } from '../topo/mesure.js';
import { lignesEtiquette, texteMorceau, placeEtiquetteMesure, aciDeMesure } from '../mesures/valeurs.js';

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

  return ecrireDxf(calques, entites);
}

/**
 * Construit le texte du fichier DXF des mesures (sans aucun volume).
 * - points : points du levé (seuls ceux des mesures sont écrits)
 * - mesures : liste de { mesure, resultat } (mesures calculées)
 * Calques : POINTS, NOMS, ALTITUDES ; MESURES (lignes et contours en polylignes 3D, et les
 * textes : nom et valeurs cochées de chaque mesure, et chaque morceau si demandé) ;
 * MESURES_TRIANGLES (triangles des aires, en faces 3D). Lignes et textes ont la couleur de la mesure.
 */
export function genererDxfMesures({ points, mesures }) {
  const calques = new Map([['POINTS', COULEURS.POINTS], ['NOMS', COULEURS.NOMS], ['ALTITUDES', COULEURS.ALTITUDES], ['MESURES', 4], ['MESURES_TRIANGLES', 8]]);
  const entites = [];
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const noms = new Set(mesures.flatMap(({ mesure, resultat }) => [...nomsDeLaMesure(mesure), ...(resultat.triangles ?? []).flat().map((p) => p.nom)]));
  for (const p of [...noms].map((nom) => parNom.get(nom)).filter(Boolean)) {
    entites.push(['0', 'POINT', '8', 'POINTS', ...xyz(p, 0)]);
    entites.push(['0', 'TEXT', '8', 'NOMS', ...xyz({ ...p, est: p.est + 0.2, nord: p.nord + 0.2 }, 0), '40', '0.3', '1', p.nom]);
    entites.push(['0', 'TEXT', '8', 'ALTITUDES', ...xyz({ ...p, est: p.est + 0.2, nord: p.nord - 0.4 }, 0), '40', '0.25', '1', formaterNombre(p.altitude)]);
  }
  for (const { mesure, resultat } of mesures) {
    const couleur = aciDeMesure(mesure);
    // Nombre : pas de trait, seulement les points (calque POINTS) et l'étiquette.
    if (mesure.type !== 'nombre') entites.push(...polyligne3D(resultat.sommets, mesure.type === 'aire', 'MESURES', couleur));
    for (const ligne of mesure.lignesRupture ?? []) {
      const sommets = ligne.noms.map((nom) => parNom.get(nom)).filter(Boolean);
      if (sommets.length >= 2) entites.push(...polyligne3D(sommets, ligne.fermee, 'MESURES', couleur));
    }
    for (const t of resultat.triangles ?? []) entites.push(face3D(t, 'MESURES_TRIANGLES'));
    // Étiquette : nom, puis valeurs cochées, une ligne de texte chacune (0.4 m de haut).
    const place = placeEtiquetteMesure(mesure, resultat);
    lignesEtiquette(mesure, resultat).forEach((ligne, i) => {
      entites.push(texteCentre({ ...place, nord: place.nord - i * 0.6, altitude: 0 }, 0.4, 0, texteAscii(ligne), 'MESURES', couleur));
    });
    if (mesure.afficher?.morceaux) {
      for (const morceau of resultat.morceaux) {
        // Texte au milieu du morceau, le long du trait (jamais à l'envers).
        let angle = (Math.atan2(morceau.fin.nord - morceau.debut.nord, morceau.fin.est - morceau.debut.est) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const milieu = { est: (morceau.debut.est + morceau.fin.est) / 2, nord: (morceau.debut.nord + morceau.fin.nord) / 2, altitude: 0 };
        entites.push(texteCentre(milieu, 0.25, angle, texteAscii(texteMorceau(mesure, morceau)), 'MESURES', couleur));
      }
    }
  }
  return ecrireDxf(calques, entites);
}

/** Texte complet du fichier DXF : en-tête, calques (nom -> couleur), puis les entités. */
function ecrireDxf(calques, entites) {
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

/**
 * Texte centré sur un point (hauteur en m, angle en degrés depuis l'Est, sens inverse des aiguilles
 * d'une montre). couleur : numéro de couleur AutoCAD, ou null pour la couleur du calque.
 */
function texteCentre(p, hauteur, angle, texte, calque, couleur = null) {
  return ['0', 'TEXT', '8', calque, ...codeCouleur(couleur), ...xyz(p, 0), '40', String(hauteur), '1', texte, '50', angle.toFixed(2), '72', '1', ...xyz(p, 1)];
}

/** Code DXF d'une couleur propre à l'entité (62), ou rien pour garder la couleur du calque. */
function codeCouleur(couleur) {
  return couleur === null ? [] : ['62', String(couleur)];
}

/** Texte sans accent ni signe spécial, lu partout dans un DXF R12 (« Déniv. » -> « Deniv. », « m² » -> « m2 »). */
function texteAscii(texte) {
  return texte
    .replaceAll('²', '2')
    .replaceAll('·', '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Face 3D (triangle : le 4e sommet répète le 3e). */
function face3D([a, b, c], calque) {
  return ['0', '3DFACE', '8', calque, ...xyz(a, 0), ...xyz(b, 1), ...xyz(c, 2), ...xyz(c, 3)];
}

/** Polyligne 3D (fermée ou non). couleur : numéro de couleur AutoCAD, ou null pour la couleur du calque. */
function polyligne3D(sommets, fermee, calque, couleur = null) {
  return [
    ['0', 'POLYLINE', '8', calque, ...codeCouleur(couleur), '66', '1', '10', '0', '20', '0', '30', '0', '70', String(8 + (fermee ? 1 : 0))],
    ...sommets.map((p) => ['0', 'VERTEX', '8', calque, ...codeCouleur(couleur), ...xyz(p, 0), '70', '32']),
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
