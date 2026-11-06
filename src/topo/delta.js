// Delta sur un point levé (0.139.0, liste du 05.11, point 1, Intermédiaire) : le point enregistré est
// décalé à gauche ou à droite de la canne, perpendiculairement au cap du GNSS, et en hauteur.
// Utile quand la canne ne peut pas être posée sur le point (angle de mur, arbre…).

/**
 * Point décalé. point : { est, nord, altitude } (m, MN95 / RAN95) ; delta : { lateral (m, + = à droite,
 * − = à gauche, en regardant dans le sens du cap), z (m, + = plus haut) } ; azimut : cap du GNSS en degrés
 * (0 = nord, 90 = est, sens des aiguilles d'une montre). Renvoie { est, nord, altitude } (3 décimales)
 * ou null si un décalage latéral est demandé sans cap connu.
 */
export function pointAvecDelta(point, delta, azimut) {
  const lateral = delta?.lateral ?? 0;
  const z = delta?.z ?? 0;
  if (lateral !== 0 && (azimut == null || !Number.isFinite(azimut))) return null;
  const a = ((azimut ?? 0) * Math.PI) / 180;
  // Devant = (sin a, cos a) en (Est, Nord) ; droite = devant tourné de 90° dans le sens horaire = (cos a, −sin a).
  const mm = (v) => Math.round(v * 1000) / 1000;
  return {
    est: mm(point.est + lateral * Math.cos(a)),
    nord: mm(point.nord - lateral * Math.sin(a)),
    altitude: point.altitude == null ? null : mm(point.altitude + z),
  };
}

/** Vrai si le delta décale le point (latéral ou hauteur différent de 0). */
export function deltaActif(delta) {
  return Boolean(delta) && ((delta.lateral ?? 0) !== 0 || (delta.z ?? 0) !== 0);
}
