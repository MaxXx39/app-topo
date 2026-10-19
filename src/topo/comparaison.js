// Comparaison de deux surfaces (deux levés à des dates différentes).
//
// Volume ajouté (remblai) : là où la surface "après" est plus haute que la surface "avant".
// Volume enlevé (déblai)  : là où elle est plus basse.
// La comparaison se fait sur une zone : toute la surface "après", ou l'intérieur d'un contour.
// Unités : m, m², m³.
import {
  volumeEntreSurfaces,
  intersectionTriangles,
  altitudeSurTriangle,
  trianglerAvecContraintes,
  segmentsDeLigne,
  pointDansPolygone,
  centre,
  airePolygone,
} from './volume.js';

/**
 * Compare deux surfaces.
 * - trianglesAvant, trianglesApres : triangles des deux surfaces (points { est, nord, altitude })
 * - contour : liste de points { nom, est, nord } délimitant la zone, ou null pour toute la surface "après"
 * Renvoie { surfaceZone, surfacePlan, remblai, deblai, surfaceRemblai, surfaceDeblai, surfaceNonCouverte }
 * ou { erreurs }.
 * - surfaceZone : surface de la zone comparée (m²)
 * - surfacePlan : partie de la zone couverte par la surface "après" (m²)
 * - surfaceNonCouverte : partie couverte par "après" mais pas par "avant" (m²)
 */
export function comparerSurfaces(trianglesAvant, trianglesApres, contour = null) {
  if (trianglesAvant.length === 0 || trianglesApres.length === 0) {
    return { erreurs: ['une des deux surfaces n\'a aucun triangle'] };
  }

  let apresDansZone = trianglesApres;
  let surfaceZone = null;
  if (contour) {
    const zone = trianglesDuContour(contour);
    if (zone.erreurs) return zone;
    surfaceZone = Math.abs(airePolygone(contour));
    apresDansZone = decouperDansZone(trianglesApres, zone.triangles);
    if (apresDansZone.length === 0) return { erreurs: ['la surface « après » ne recouvre pas la zone choisie'] };
  }

  const resultat = volumeEntreSurfaces(apresDansZone, trianglesAvant);
  return { ...resultat, surfaceZone: surfaceZone ?? resultat.surfacePlan };
}

/**
 * Découpe la zone (polygone, éventuellement en forme de « L ») en triangles,
 * en respectant ses côtés.
 */
function trianglesDuContour(contour) {
  if (contour.length < 3) return { erreurs: ['le contour de la zone doit avoir au moins 3 points'] };
  // Noms uniques pour la triangulation (le contour peut venir d'un autre levé).
  const sommets = contour.map((p, i) => ({ ...p, nom: `z${i}`, altitude: 0 }));
  const parNom = new Map(sommets.map((p) => [p.nom, p]));
  const noms = sommets.map((p) => p.nom);
  const resultat = trianglerAvecContraintes(noms, segmentsDeLigne(noms, true), parNom);
  if (resultat.erreurs) return { erreurs: resultat.erreurs.map((e) => `contour de la zone : ${e}`) };
  return { triangles: resultat.triangles.filter((t) => pointDansPolygone(centre(t), sommets)) };
}

/**
 * Garde la partie des triangles de "surface" située dans la zone.
 * Chaque morceau garde l'altitude du triangle d'origine (même plan).
 */
function decouperDansZone(triangles, trianglesZone) {
  const morceaux = [];
  for (const triangle of triangles) {
    for (const zone of trianglesZone) {
      const polygone = intersectionTriangles(triangle, zone);
      if (polygone.length < 3) continue;
      const avecAltitude = polygone.map((p) => ({ ...p, altitude: altitudeSurTriangle(triangle, p.est, p.nord) }));
      // Le morceau est convexe : on le découpe en éventail de triangles.
      for (let i = 1; i < avecAltitude.length - 1; i++) {
        const morceau = [avecAltitude[0], avecAltitude[i], avecAltitude[i + 1]];
        const aire = (morceau[1].est - morceau[0].est) * (morceau[2].nord - morceau[0].nord) - (morceau[2].est - morceau[0].est) * (morceau[1].nord - morceau[0].nord);
        if (Math.abs(aire) > 1e-9) morceaux.push(morceau);
      }
    }
  }
  return morceaux;
}
