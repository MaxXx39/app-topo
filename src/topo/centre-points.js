// Accroche « Centre pts » (0.214.0, demande du 12.11, dès Intermédiaire) : on touche 2 ou 3 points, l'appli place un point au centre.
// - 2 points : le milieu du segment ;
// - 3 points : le centre du cercle qui passe par les 3 points (centre circonscrit), choix validé le 12.11 ;
// - 4 points et plus : pas accepté (3 au maximum).
// Coordonnées MN95 Est, Nord (m). L'altitude du centre est la moyenne des altitudes des points si tous en ont une, sinon null
// (jamais inventée) ; à confirmer pour le centre d'un cercle de 3 points.

/** Nombre maximal de points pour un centre. */
export const MAX_POINTS_CENTRE = 3;

/**
 * Centre de 2 ou 3 points [{ est, nord, altitude }].
 * Renvoie { ok: true, est, nord, altitude, nombre, rayon } (rayon du cercle pour 3 points, la moitié du segment pour 2) ou
 * { ok: false, raison } : trop peu de points, trop de points, points confondus ou alignés (pas de cercle).
 */
export function centreDePoints(points) {
  const n = points.length;
  if (n < 2) return { ok: false, raison: 'il faut 2 points au moins' };
  if (n > MAX_POINTS_CENTRE) return { ok: false, raison: `${MAX_POINTS_CENTRE} points au maximum` };
  const avecAltitude = points.every((p) => p.altitude != null && Number.isFinite(p.altitude));
  const altitude = avecAltitude ? points.reduce((t, p) => t + p.altitude, 0) / n : null;
  const [a, b, c] = points;
  if (n === 2) {
    const distance = Math.hypot(b.est - a.est, b.nord - a.nord);
    if (distance === 0) return { ok: false, raison: 'les 2 points sont au même endroit' };
    return { ok: true, est: (a.est + b.est) / 2, nord: (a.nord + b.nord) / 2, altitude, nombre: 2, rayon: distance / 2 };
  }
  // Centre du cercle circonscrit, calculé depuis le point A (petits nombres : pas de perte de précision avec des coordonnées MN95).
  const [bx, by, cx, cy] = [b.est - a.est, b.nord - a.nord, c.est - a.est, c.nord - a.nord];
  const d = 2 * (bx * cy - by * cx);
  // Presque alignés (aire du triangle quasi nulle) : le cercle serait gigantesque ou n'existe pas.
  if (Math.abs(d) < 1e-9) return { ok: false, raison: 'les 3 points sont alignés : pas de cercle' };
  const [b2, c2] = [bx * bx + by * by, cx * cx + cy * cy];
  const ux = (cy * b2 - by * c2) / d;
  const uy = (bx * c2 - cx * b2) / d;
  return { ok: true, est: a.est + ux, nord: a.nord + uy, altitude, nombre: 3, rayon: Math.hypot(ux, uy) };
}
