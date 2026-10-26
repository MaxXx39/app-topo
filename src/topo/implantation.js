// Contrôle sur le terrain avec le récepteur (onglet Terrain, mode « Contrôler ») : de combien
// faut-il monter ou descendre pour être sur une surface, orientation (où l'on regarde) et
// extrémités des coupes en direct autour de la position.
//
// Conventions : coordonnées MN95 Est, Nord (m), altitudes (m) ; azimut en degrés, compté depuis
// le nord dans le sens des aiguilles d'une montre (0 = nord, 90 = est).
import { altitudeSurTriangle } from './volume.js';

/** Azimut ramené entre 0 et 360° (°). */
export function normaliserAzimut(azimut) {
  return ((azimut % 360) + 360) % 360;
}

/** Azimut (°) pour aller du point a au point b (Est, Nord en m). */
export function azimutEntre(a, b) {
  return normaliserAzimut((Math.atan2(b.est - a.est, b.nord - a.nord) * 180) / Math.PI);
}

/**
 * Direction de marche (°) d'après les dernières positions [{ est, nord, temps (ms) }], de la plus
 * ancienne à la plus récente : azimut entre la position d'il y a au plus "dureeMax" ms et la
 * dernière, si l'on a avancé d'au moins "distanceMin" m. Sinon null (arrêté, ou pas assez de positions).
 */
export function directionDeMarche(historique, { distanceMin = 1, dureeMax = 5000 } = {}) {
  const derniere = historique[historique.length - 1];
  if (!derniere) return null;
  const depart = historique.find((p) => derniere.temps - p.temps <= dureeMax);
  if (!depart || Math.hypot(derniere.est - depart.est, derniere.nord - depart.nord) < distanceMin) return null;
  return azimutEntre(depart, derniere);
}

/** Vrai si le point (est, nord) est dans le triangle (bords compris, à 1 mm près). */
function dansTriangle([a, b, c], est, nord) {
  const cote = (p, q) => (q.est - p.est) * (nord - p.nord) - (q.nord - p.nord) * (est - p.est);
  const d1 = cote(a, b);
  const d2 = cote(b, c);
  const d3 = cote(c, a);
  const tolerance = 1e-3 * Math.max(Math.hypot(b.est - a.est, b.nord - a.nord), Math.hypot(c.est - b.est, c.nord - b.nord), 1e-9);
  const negatif = d1 < -tolerance || d2 < -tolerance || d3 < -tolerance;
  const positif = d1 > tolerance || d2 > tolerance || d3 > tolerance;
  return !(negatif && positif);
}

/**
 * Altitude de la surface (m) sous le point (est, nord) : dans le triangle qui contient le point,
 * la surface est plate (plan des 3 sommets), comme pour le calcul des volumes.
 * Renvoie null si le point est en dehors de la surface.
 */
export function altitudeSurSurface(triangles, est, nord) {
  const triangle = triangles.find((t) => dansTriangle(t, est, nord));
  return triangle ? altitudeSurTriangle(triangle, est, nord) : null;
}

/**
 * Recherche rapide de l'altitude d'une surface (même résultat que altitudeSurSurface) : les
 * triangles sont rangés une fois dans des cases carrées de "taille" m, puis on ne regarde que ceux
 * de la case du point. Renvoie une fonction (est, nord) → altitude (m) ou null hors de la surface.
 */
export function chercheurAltitude(triangles, taille = 5) {
  const cases = new Map();
  const cle = (i, j) => `${i}:${j}`;
  for (const triangle of triangles) {
    const est = triangle.map((p) => p.est);
    const nord = triangle.map((p) => p.nord);
    const [i0, i1] = [Math.floor(Math.min(...est) / taille), Math.floor(Math.max(...est) / taille)];
    const [j0, j1] = [Math.floor(Math.min(...nord) / taille), Math.floor(Math.max(...nord) / taille)];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = cle(i, j);
        if (!cases.has(k)) cases.set(k, []);
        cases.get(k).push(triangle);
      }
    }
  }
  return (est, nord) => {
    const dansLaCase = cases.get(cle(Math.floor(est / taille), Math.floor(nord / taille)));
    return dansLaCase ? altitudeSurSurface(dansLaCase, est, nord) : null;
  };
}

/**
 * Écart vertical (m) entre la surface et le bout de canne : altitude de la surface − altitude du
 * point. Positif : il faut monter de cette valeur ; négatif : il faut descendre.
 */
export function ecartSurface(altitudeSurface, altitudePoint) {
  return altitudeSurface - altitudePoint;
}

/**
 * Couleur de l'écart (m), choisie par l'utilisateur : vert clair de −2 à +2 cm, jaune orangé de
 * 2 à 5 cm (dessus ou dessous), rouge au-delà de +5 cm (il faut monter), bleu au-delà de −5 cm
 * (il faut descendre). Renvoie 'vert-clair', 'jaune-orange', 'rouge' ou 'bleu'.
 */
export function classeEcart(ecart) {
  // Arrondi au dixième de millimètre : 0.05 m affiché reste « jaune orangé ».
  const valeur = Math.round(ecart * 10000) / 10000;
  if (Math.abs(valeur) <= 0.02) return 'vert-clair';
  if (Math.abs(valeur) <= 0.05) return 'jaune-orange';
  return valeur > 0 ? 'rouge' : 'bleu';
}

/**
 * Début et fin d'une coupe centrée sur la position, de "demiLongueur" m de chaque côté :
 * - sens 'axe' : dans la direction regardée (de derrière vers devant) ;
 * - sens 'perpendiculaire' : en travers (de la gauche vers la droite de celui qui regarde).
 * Renvoie { debut, fin } ({ est, nord } en m).
 */
export function extremitesCoupe(position, azimut, demiLongueur, sens) {
  const angle = ((sens === 'perpendiculaire' ? azimut + 90 : azimut) * Math.PI) / 180;
  const dEst = Math.sin(angle) * demiLongueur;
  const dNord = Math.cos(angle) * demiLongueur;
  return {
    debut: { est: position.est - dEst, nord: position.nord - dNord },
    fin: { est: position.est + dEst, nord: position.nord + dNord },
  };
}
