// Surfaces (modèles de terrain en triangles) : stock, terrassement, terrain naturel...
// Elles sont créées à partir des points d'un levé, ou importées (LandXML, DXF).
//
// Une surface "points" a la forme :
// {
//   id, nom, type: 'points', leveId,
//   nature: 'stock',              // ce que représente la surface : voir NATURES
//   tousLesPoints: true,          // si vrai : tous les points du levé ; sinon la liste "points"
//   points: [...],                // noms des points (si tousLesPoints est faux)
//   contour: [...],               // optionnel : bord choisi (fermé automatiquement)
//   lignesRupture: [{ noms, fermee }],
//   trianglesSupprimes: [...],    // clés des triangles retirés à la main (voir cleTriangle)
// }
// Une surface importée a la forme { id, nom, type: 'landxml' ou 'dxf', nature, nomFichier, points, faces }
// où faces = liste de [i, j, k] (positions dans "points").
//
// Bord : sans contour, l'appli triangule tout (bord = enveloppe extérieure des points) ;
// l'utilisateur retire ensuite les triangles en trop en les touchant sur le plan.
import { trianglerAvecContraintes, segmentsDeLigne, pointDansPolygone, centre } from './volume.js';
import { creerLigne } from './noms.js';

/**
 * Ce que représente une surface : [clé, nom affiché]. Choisi par l'utilisateur à la création.
 * Il sert d'étiquette et à préremplir les calculs de volume (voir volumes/calculs.js).
 */
export const NATURES = [
  ['stock', 'Stock'],
  ['terrain', 'Terrain'],
  ['recollement', 'Recollement'],
  // Anciens levés (avant 0.87.0) : « Terrassement » reste affiché tel quel, mais n'est plus proposé.
  ['terrassement', 'Terrassement'],
  // Surface faite dans Calculs › Dessin (0.77.0) : rangée comme un levé, complétée au RX2.
  ['surface', 'Surface'],
];

/** Natures qu'on choisit à l'import d'un fichier (la « Surface » vient seulement d'un dessin). */
export const NATURES_IMPORT = NATURES.filter(([cle]) => cle !== 'surface' && cle !== 'terrassement');

/**
 * Surfaces importées sans nature (0.90.0) : elles peuvent servir de stock (volume depuis une
 * altitude) comme de terrain de référence. Vrai si la surface peut être prise comme stock.
 */
export function peutEtreStock(surface) {
  return surface.nature === 'stock' || estImportee(surface);
}

/** Vrai si la surface peut être prise comme terrain de référence d'une comparaison. */
export function peutEtreTerrain(surface) {
  return surface.nature === 'terrain' || estImportee(surface);
}

/** Nom affiché d'une nature ('terrain' -> 'Terrain'). */
export function nomNature(nature) {
  return NATURES.find(([cle]) => cle === nature)?.[1] ?? '';
}

/** Crée une surface vide à partir d'un levé. */
export function creerSurface(nom, leveId, nature = 'stock') {
  return {
    id: nouvelIdentifiant(),
    nom,
    type: 'points',
    nature,
    leveId,
    tousLesPoints: true,
    points: [],
    contour: [],
    lignesRupture: [creerLigne()],
    trianglesSupprimes: [],
  };
}

/** Vrai si la surface a été importée d'un fichier (LandXML, DXF) et non créée à partir de points. */
export function estImportee(surface) {
  return surface.type === 'landxml' || surface.type === 'dxf' || surface.type === 'dessin';
}

// Préfixes des noms (0.90.0, demande du 29.10.2026) : « LV- » pour un levé (stock, terrain,
// recollement, levé libre, métré), « Surf- » pour une surface importée ou faite dans Dessin.
export const PREFIXE_LEVE = 'LV-';
export const PREFIXE_SURFACE = 'Surf-';

/** Préfixe du nom de ce levé ou de cette surface. */
export function prefixeDuNom(objet) {
  return estImportee(objet) || objet?.nature === 'surface' ? PREFIXE_SURFACE : PREFIXE_LEVE;
}

/** Nom avec ce préfixe au début (ajouté s'il n'y est pas déjà, majuscules ignorées). */
export function avecPrefixe(nom, prefixe) {
  const texte = String(nom ?? '').trim();
  return texte.toLowerCase().startsWith(prefixe.toLowerCase()) ? texte : `${prefixe}${texte}`;
}

/** D'où vient une surface importée : « LandXML », « DXF » ou « Dessin » (plateforme ou bâtiment dessiné). */
export function origineSurface(surface) {
  return { dxf: 'DXF', landxml: 'LandXML', dessin: 'Dessin' }[surface.type] ?? '';
}

/**
 * Clé d'un triangle : les noms de ses 3 sommets, triés. Elle ne dépend pas de l'ordre
 * des sommets et reste la même tant que le triangle existe.
 */
export function cleTriangle(triangle) {
  return triangle
    .map((p) => p.nom)
    .sort()
    .join('|');
}

/**
 * Calcule les triangles d'une surface.
 * - surface : voir en haut du fichier
 * - points : points du levé de la surface (pour une surface "points")
 * Renvoie { triangles, trianglesRetires, avertissements } ou { erreurs, segmentsEnErreur }.
 * trianglesRetires : triangles supprimés à la main (pour les montrer et pouvoir les rétablir).
 */
export function calculerSurface(surface, points) {
  if (estImportee(surface)) {
    return { triangles: trianglesImportes(surface), trianglesRetires: [], avertissements: [] };
  }

  const parNom = new Map(points.map((p) => [p.nom, p]));
  const avertissements = [];
  const nomsLignes = surface.lignesRupture.flatMap((ligne) => ligne.noms);
  const nomsVoulus = surface.tousLesPoints
    ? points.map((p) => p.nom)
    : [...surface.points, ...surface.contour, ...nomsLignes];

  const absents = [...new Set([...nomsVoulus, ...surface.contour, ...nomsLignes].filter((nom) => !parNom.has(nom)))];
  if (absents.length > 0) return { erreurs: [`point(s) absent(s) du levé : ${absents.join(', ')}`] };

  // Deux points à la même position en plan : on garde le premier et on prévient.
  // (Un point des lignes de rupture ou du contour est prioritaire.)
  const prioritaires = new Set([...surface.contour, ...nomsLignes]);
  const ordre = [...new Set([...nomsVoulus.filter((n) => prioritaires.has(n)), ...nomsVoulus])];
  const positions = new Map();
  const noms = [];
  for (const nom of ordre) {
    const p = parNom.get(nom);
    const cle = `${p.est.toFixed(4)} ${p.nord.toFixed(4)}`;
    if (positions.has(cle)) {
      avertissements.push(`point ${nom} ignoré : même position que ${positions.get(cle)}`);
      continue;
    }
    positions.set(cle, nom);
    noms.push(nom);
  }
  if (noms.length < 3) return { erreurs: ['il faut au moins 3 points pour faire une surface'] };

  const avecContour = surface.contour.length >= 3;
  const segments = [
    ...(avecContour ? segmentsDeLigne(surface.contour, true) : []),
    ...surface.lignesRupture.flatMap((ligne) => segmentsDeLigne(ligne.noms, ligne.fermee)),
  ];
  const resultat = trianglerAvecContraintes(noms, segments, parNom);
  if (resultat.erreurs) return resultat;

  let triangles = resultat.triangles;
  if (avecContour) {
    // Contour choisi : on ne garde que les triangles à l'intérieur.
    const polygone = surface.contour.map((nom) => parNom.get(nom));
    triangles = triangles.filter((t) => pointDansPolygone(centre(t), polygone));
  }

  const supprimes = new Set(surface.trianglesSupprimes);
  return {
    triangles: triangles.filter((t) => !supprimes.has(cleTriangle(t))),
    trianglesRetires: triangles.filter((t) => supprimes.has(cleTriangle(t))),
    avertissements,
  };
}

/**
 * Prépare une surface lue dans un fichier (voir landxml.js et dxf-lecture.js) pour la ranger
 * dans un projet. surfaceLue = { nom, points, triangles } ; type = 'landxml' ou 'dxf'.
 */
export function surfaceImportee(surfaceLue, nomFichier, type = 'landxml') {
  const index = new Map(surfaceLue.points.map((p, i) => [p, i]));
  return {
    id: nouvelIdentifiant(),
    nom: avecPrefixe(surfaceLue.nom, PREFIXE_SURFACE),
    type,
    nomFichier,
    points: surfaceLue.points.map(({ nom, est, nord, altitude }) => ({ nom, est, nord, altitude })),
    faces: surfaceLue.triangles.map((t) => t.map((p) => index.get(p))),
  };
}

/** Triangles d'une surface importée rangée dans le projet. */
function trianglesImportes(surface) {
  return surface.faces.map((face) => face.map((i) => surface.points[i]));
}

/** Identifiant unique (pour retrouver une surface même si on la renomme). */
export function nouvelIdentifiant() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Bord d'une surface en triangles (0.83.0) : les côtés qui n'appartiennent qu'à un seul triangle
 * (les côtés intérieurs sont partagés par deux triangles). triangles : [[a, b, c]] de points
 * { est, nord }. Renvoie [[p, q]] (segments du bord, dans n'importe quel ordre).
 */
export function bordDeTriangles(triangles) {
  const cle = (p) => `${p.est},${p.nord}`;
  const cotes = new Map();
  for (const triangle of triangles) {
    for (let i = 0; i < 3; i++) {
      const p = triangle[i];
      const q = triangle[(i + 1) % 3];
      const k = [cle(p), cle(q)].sort().join('|');
      const deja = cotes.get(k);
      if (deja) deja.nombre += 1;
      else cotes.set(k, { segment: [p, q], nombre: 1 });
    }
  }
  return [...cotes.values()].filter((c) => c.nombre === 1).map((c) => c.segment);
}
