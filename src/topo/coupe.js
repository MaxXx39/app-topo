// Coupes (profils en long) : altitude des surfaces le long d'une ligne tracée sur le plan.
//
// Une coupe va d'un point de début à un point de fin { est, nord } (m, MN95).
// Pour chaque triangle d'une surface, on cherche la partie de la ligne qui passe dedans :
// l'altitude y varie en ligne droite (le triangle est plat), donc les deux bouts suffisent.
// Unités : m.
import { altitudeSurTriangle } from './volume.js';

// Tolérance sur la position le long de la ligne (fraction de la longueur).
const PRECISION = 1e-9;

/** Longueur en plan d'une coupe (m). */
export function longueurCoupe(debut, fin) {
  return Math.hypot(fin.est - debut.est, fin.nord - debut.nord);
}

/**
 * Profil d'une surface le long de la coupe debut → fin.
 * - triangles : triangles de la surface (3 points { est, nord, altitude })
 * Renvoie la liste des morceaux de profil (là où la surface existe), chacun étant une liste de
 * points { distance (m depuis le début), altitude (m) }. Liste vide si la coupe ne traverse pas
 * la surface.
 */
export function profilSurface(triangles, debut, fin) {
  const longueur = longueurCoupe(debut, fin);
  if (longueur === 0) return [];
  const dEst = fin.est - debut.est;
  const dNord = fin.nord - debut.nord;
  const position = (t) => ({ est: debut.est + t * dEst, nord: debut.nord + t * dNord });

  // Partie de la ligne dans chaque triangle : [t0, t1] (0 = début, 1 = fin)
  const morceaux = [];
  for (const triangle of triangles) {
    const intervalle = partieDansTriangle(triangle, debut, dEst, dNord);
    if (!intervalle || intervalle[1] - intervalle[0] < PRECISION) continue;
    const [t0, t1] = intervalle;
    const p0 = position(t0);
    const p1 = position(t1);
    morceaux.push({
      t0,
      t1,
      a0: altitudeSurTriangle(triangle, p0.est, p0.nord),
      a1: altitudeSurTriangle(triangle, p1.est, p1.nord),
    });
  }
  morceaux.sort((a, b) => a.t0 - b.t0);

  // Les morceaux qui se suivent sont réunis en une seule ligne ; un trou (surface absente) coupe la ligne.
  const lignes = [];
  let ligne = null;
  let finPrecedente = -1;
  for (const { t0, t1, a0, a1 } of morceaux) {
    if (t1 <= finPrecedente + PRECISION) continue; // morceau déjà couvert (ligne le long d'une arête)
    if (!ligne || t0 > finPrecedente + 1e-6) {
      ligne = [{ distance: t0 * longueur, altitude: a0 }];
      lignes.push(ligne);
    }
    ligne.push({ distance: t1 * longueur, altitude: a1 });
    finPrecedente = t1;
  }
  return lignes;
}

/**
 * Partie de la ligne P(t) = debut + t × (dEst, dNord), t entre 0 et 1, qui est dans le triangle.
 * Renvoie [t0, t1] ou null. Le triangle est convexe : on coupe la ligne par chacun de ses côtés.
 */
function partieDansTriangle([a, b, c], debut, dEst, dNord) {
  let t0 = 0;
  let t1 = 1;
  for (const [p, q, autre] of [[a, b, c], [b, c, a], [c, a, b]]) {
    // Perpendiculaire au côté p-q, tournée vers l'intérieur (du côté du 3e sommet).
    let nEst = -(q.nord - p.nord);
    let nNord = q.est - p.est;
    if (nEst * (autre.est - p.est) + nNord * (autre.nord - p.nord) < 0) {
      nEst = -nEst;
      nNord = -nNord;
    }
    // Intérieur : n · (P(t) - p) >= 0, soit depart + t × pente >= 0
    const depart = nEst * (debut.est - p.est) + nNord * (debut.nord - p.nord);
    const pente = nEst * dEst + nNord * dNord;
    if (Math.abs(pente) < 1e-15) {
      if (depart < 0) return null; // ligne parallèle au côté, à l'extérieur
      continue;
    }
    const t = -depart / pente;
    if (pente > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/** Distances des cotes de longueur : la coupe divisée en 5 (6 cotes, de 0 à la longueur), en m. */
export function cotesLongueur(longueur) {
  return [0, 1, 2, 3, 4, 5].map((i) => (longueur * i) / 5);
}

/** Altitudes de la petite échelle des hauteurs : point bas, point haut et 3 entre les deux (m). */
export function cotesAltitude(altitudeMin, altitudeMax) {
  return [0, 1, 2, 3, 4].map((i) => altitudeMin + ((altitudeMax - altitudeMin) * i) / 4);
}
