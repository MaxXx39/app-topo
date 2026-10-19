// Surfaces (modèles de terrain en triangles) : stock, terrassement, terrain naturel...
// Elles sont créées à partir des points d'un levé, ou importées (LandXML, DXF).
//
// Une surface "points" a la forme :
// {
//   id, nom, type: 'points', leveId,
//   tousLesPoints: true,          // si vrai : tous les points du levé ; sinon la liste "points"
//   points: [...],                // noms des points (si tousLesPoints est faux)
//   contour: [...],               // optionnel : bord choisi (fermé automatiquement)
//   lignesRupture: [{ noms, fermee }],
//   trianglesSupprimes: [...],    // clés des triangles retirés à la main (voir cleTriangle)
//   volume: { base, surfaceId },  // base du volume (onglet Volumes) : 'contour', 'surface' ou 'aucune'
// }
// Une surface importée a la forme { id, nom, type: 'landxml' ou 'dxf', nomFichier, points, faces, volume }
// où faces = liste de [i, j, k] (positions dans "points").
//
// Bord : sans contour, l'appli triangule tout (bord = enveloppe extérieure des points) ;
// l'utilisateur retire ensuite les triangles en trop en les touchant sur le plan.
import { trianglerAvecContraintes, segmentsDeLigne, pointDansPolygone, centre } from './volume.js';
import { creerLigne } from './noms.js';

/** Crée une surface vide à partir d'un levé. */
export function creerSurface(nom, leveId) {
  return {
    id: nouvelIdentifiant(),
    nom,
    type: 'points',
    leveId,
    tousLesPoints: true,
    points: [],
    contour: [],
    lignesRupture: [creerLigne()],
    trianglesSupprimes: [],
    volume: { base: 'contour', surfaceId: null },
  };
}

/** Vrai si la surface a été importée d'un fichier (LandXML, DXF) et non créée à partir de points. */
export function estImportee(surface) {
  return surface.type === 'landxml' || surface.type === 'dxf';
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
    nom: surfaceLue.nom,
    type,
    nomFichier,
    points: surfaceLue.points.map(({ nom, est, nord, altitude }) => ({ nom, est, nord, altitude })),
    faces: surfaceLue.triangles.map((t) => t.map((p) => index.get(p))),
    volume: { base: 'aucune', surfaceId: null },
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
