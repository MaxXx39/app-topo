// Mesures (onglet Calculs › Mesures) : longueurs et aires, tout à fait à part des surfaces et des volumes.
// Une mesure ne crée pas de surface et ne sert jamais de base à un volume.
// Pour une mesure, on parle d'« aire » (m²), jamais de « surface ».
//
// Une mesure de longueur a la forme :
// { id, nom, type: 'longueur', leveId, points: [...noms dans l'ordre], afficher: { l2d, l3d, denivele, pente, morceaux } }
// Une mesure d'aire a la forme :
// { id, nom, type: 'aire', leveId, contour: [...], lignesRupture: [{ noms, fermee }],
//   tousLesPoints, points: [...points isolés / caractéristiques], afficher: { a2d, a3d, p2d, p3d, morceaux } }
// "afficher" : valeurs à montrer sur le plan et dans le PDF (cases cochées par l'utilisateur).
// "couleur" : couleur choisie (voir COULEURS_MESURES dans mesures/valeurs.js), cyan au départ.
import { calculerSurface, nouvelIdentifiant } from './surface.js';
import { airePolygone } from './volume.js';
import { creerLigne } from './noms.js';

// Valeurs cochées au départ pour une nouvelle mesure.
const AFFICHER_PAR_DEFAUT = {
  longueur: { l2d: true, l3d: true, denivele: false, pente: false, morceaux: false },
  aire: { a2d: true, a3d: true, p2d: false, p3d: false, morceaux: false },
};

/** Crée une mesure vide ('longueur' ou 'aire') sur les points d'un levé. */
export function creerMesure(type, nom, leveId) {
  const commun = { id: nouvelIdentifiant(), nom, type, leveId, couleur: '#0891b2', afficher: { ...AFFICHER_PAR_DEFAUT[type] } };
  if (type === 'longueur') return { ...commun, points: [] };
  return { ...commun, contour: [], lignesRupture: [creerLigne()], tousLesPoints: false, points: [] };
}

/** Nom proposé pour une nouvelle mesure : « L1 », « L2 »... pour les longueurs, « A1 »... pour les aires. */
export function nomDeMesureLibre(mesures, type) {
  const lettre = type === 'longueur' ? 'L' : 'A';
  let numero = 1;
  while (mesures.some((m) => m.nom === `${lettre}${numero}`)) numero += 1;
  return `${lettre}${numero}`;
}

/** Longueur à plat (en plan) entre deux points (m). */
export function longueur2D(a, b) {
  return Math.hypot(b.est - a.est, b.nord - a.nord);
}

/** Longueur inclinée entre deux points, en tenant compte des altitudes (m). */
export function longueur3D(a, b) {
  return Math.hypot(b.est - a.est, b.nord - a.nord, b.altitude - a.altitude);
}

/**
 * Pente (%) : différence d'altitude (m) divisée par la longueur à plat (m), fois 100.
 * Positive quand ça monte. null si la longueur à plat est nulle (deux points l'un sur l'autre).
 */
export function pente(denivele, longueurAPlat) {
  return longueurAPlat > 0 ? (denivele / longueurAPlat) * 100 : null;
}

/**
 * Morceaux d'une ligne (d'un point au suivant, et du dernier au premier si elle est fermée).
 * Chaque morceau : { debut, fin, l2d (m), l3d (m), denivele (m, fin - début), pente (%) }.
 */
export function morceauxDeLigne(sommets, fermee = false) {
  const morceaux = [];
  const nombre = fermee && sommets.length >= 3 ? sommets.length : sommets.length - 1;
  for (let i = 0; i < nombre; i++) {
    const debut = sommets[i];
    const fin = sommets[(i + 1) % sommets.length];
    const l2d = longueur2D(debut, fin);
    const denivele = fin.altitude - debut.altitude;
    morceaux.push({ debut, fin, l2d, l3d: longueur3D(debut, fin), denivele, pente: pente(denivele, l2d) });
  }
  return morceaux;
}

/** Aire d'un triangle dans l'espace, en tenant compte des altitudes (m²) : moitié du produit vectoriel. */
export function aireTriangle3D([a, b, c]) {
  const u = [b.est - a.est, b.nord - a.nord, b.altitude - a.altitude];
  const v = [c.est - a.est, c.nord - a.nord, c.altitude - a.altitude];
  const produit = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return Math.hypot(...produit) / 2;
}

/** Somme des longueurs d'une liste de morceaux : { l2d, l3d } (m). */
function totalDesMorceaux(morceaux) {
  return {
    l2d: morceaux.reduce((somme, m) => somme + m.l2d, 0),
    l3d: morceaux.reduce((somme, m) => somme + m.l3d, 0),
  };
}

/** Points d'une liste de noms, ou la liste des noms absents du levé. */
function retrouverPoints(noms, points) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const absents = [...new Set(noms.filter((nom) => !parNom.has(nom)))];
  return { sommets: noms.map((nom) => parNom.get(nom)), absents };
}

/**
 * Mesure de longueur : suite de points (non fermée).
 * Renvoie { sommets, morceaux, l2d, l3d (m), denivele (m, dernier point - premier),
 * pente (%, dénivelé ÷ longueur à plat totale × 100) } ou { erreurs }.
 */
export function calculerLongueur(mesure, points) {
  const { sommets, absents } = retrouverPoints(mesure.points, points);
  if (absents.length > 0) return { erreurs: [`point(s) absent(s) du levé : ${absents.join(', ')}`] };
  if (sommets.length < 2) return { erreurs: ['il faut au moins 2 points pour mesurer une longueur'] };
  const morceaux = morceauxDeLigne(sommets);
  const { l2d, l3d } = totalDesMorceaux(morceaux);
  const denivele = sommets.at(-1).altitude - sommets[0].altitude;
  return { sommets, morceaux, l2d, l3d, denivele, pente: pente(denivele, l2d) };
}

/**
 * Mesure d'aire : contour (fermé automatiquement), lignes de rupture et points isolés.
 * - aire 2D : aire du contour à plat (m²)
 * - aire 3D : somme des aires des triangles dans l'espace (m²), triangles faits comme pour une
 *   surface (contour, lignes de rupture et points isolés respectés)
 * - périmètre 2D et 3D (m), et les côtés du contour (morceaux)
 * Renvoie { sommets, triangles, morceaux, a2d, a3d, p2d, p3d, avertissements } ou { erreurs, segmentsEnErreur }.
 */
export function calculerAire(mesure, points) {
  if (mesure.contour.length < 3) return { erreurs: ['le contour doit avoir au moins 3 points'] };
  const { sommets, absents } = retrouverPoints(mesure.contour, points);
  if (absents.length > 0) return { erreurs: [`point(s) absent(s) du levé : ${absents.join(', ')}`] };
  // Les triangles se font exactement comme pour une surface (sans triangle supprimé à la main).
  const triangulation = calculerSurface({ ...mesure, type: 'points', trianglesSupprimes: [] }, points);
  if (triangulation.erreurs) return triangulation;
  const morceaux = morceauxDeLigne(sommets, true);
  const perimetre = totalDesMorceaux(morceaux);
  return {
    sommets,
    triangles: triangulation.triangles,
    morceaux,
    a2d: Math.abs(airePolygone(sommets)),
    a3d: triangulation.triangles.reduce((somme, t) => somme + aireTriangle3D(t), 0),
    p2d: perimetre.l2d,
    p3d: perimetre.l3d,
    avertissements: triangulation.avertissements,
  };
}

/** Calcule une mesure (longueur ou aire) sur les points de son levé. */
export function calculerMesure(mesure, points) {
  return mesure.type === 'longueur' ? calculerLongueur(mesure, points) : calculerAire(mesure, points);
}

/** Tous les noms de points utilisés par une mesure. */
export function nomsDeLaMesure(mesure) {
  return [...(mesure.contour ?? []), ...(mesure.lignesRupture ?? []).flatMap((l) => l.noms), ...(mesure.points ?? [])];
}
