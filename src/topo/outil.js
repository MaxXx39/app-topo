// Outil guidé par UN seul GNSS (0.142.0, Guidage, Expert, demande du 05.11, validée le 06.11) : râteau
// sur le bras d'une pelle, ou lame de Bull à 1 récepteur. Le GNSS est sur un mât fixé à l'outil ; avec
// la compensation d'inclinaison, la position reçue est le bas du mât (sur l'outil). On connaît, depuis
// ce point, les distances jusqu'aux bords de l'outil : gauche, droite, avant, arrière (m).
//
// Formule (À VALIDER sur le terrain avec le journal NMEA) :
// - le mât est perpendiculaire à l'outil : outil à plat = mât vertical ;
// - message ETC du GNSS : inclinaison θ (°, champ 6), direction φ vers laquelle le haut du mât penche
//   (°, azimut, champ 5), cap c (°, champ 4) = direction de l'avant de l'outil ;
// - axe du mât u = (sin θ · sin φ, sin θ · cos φ, cos θ) en (Est, Nord, haut) ;
// - avant de l'outil f = direction du cap (sin c, cos c, 0) rendue perpendiculaire au mât puis de
//   longueur 1 ; droite de l'outil r = f × u (à droite en regardant vers l'avant) ;
// - un point de l'outil = bas du mât + a · f + b · r (a : + avant, − arrière ; b : + droite, − gauche).
// Conséquence : si le haut du mât penche vers l'est, le côté est de l'outil est plus bas.

const rad = (deg) => (deg * Math.PI) / 180;
const mm = (v) => Math.round(v * 1000) / 1000;

/** Axes de l'outil : { f (avant), r (droite), u (mât) }, vecteurs { e, n, z } de longueur 1, ou null. */
export function axesOutil({ cap, inclinaison = 0, directionInclinaison = 0 }) {
  if (cap == null || !Number.isFinite(cap)) return null;
  const t = rad(inclinaison ?? 0);
  const p = rad(directionInclinaison ?? 0);
  const u = { e: Math.sin(t) * Math.sin(p), n: Math.sin(t) * Math.cos(p), z: Math.cos(t) };
  const f0 = { e: Math.sin(rad(cap)), n: Math.cos(rad(cap)), z: 0 };
  const d = f0.e * u.e + f0.n * u.n + f0.z * u.z;
  const fb = { e: f0.e - d * u.e, n: f0.n - d * u.n, z: f0.z - d * u.z };
  const l = Math.hypot(fb.e, fb.n, fb.z);
  if (l < 1e-9) return null;
  const f = { e: fb.e / l, n: fb.n / l, z: fb.z / l };
  // r = f × u
  const r = { e: f.n * u.z - f.z * u.n, n: f.z * u.e - f.e * u.z, z: f.e * u.n - f.n * u.e };
  return { f, r, u };
}

/**
 * Points de l'outil. position : { est, nord, altitude } (bas du mât) ; orientation : { cap,
 * inclinaison, directionInclinaison } (°) ; dimensions : { gauche, droite, avant, arriere } (m, ≥ 0).
 * Renvoie { gauche, droite, centre (milieu de l'outil : bouts gauche et droit et centre à mi-longueur),
 * coins: [avant-gauche, avant-droite, arrière-droite, arrière-gauche] } en MN95, ou null.
 */
export function pointsOutil(position, orientation, dimensions) {
  const axes = axesOutil(orientation);
  if (!axes || !position) return null;
  const { gauche = 0, droite = 0, avant = 0, arriere = 0 } = dimensions;
  const point = (a, b) => ({
    est: mm(position.est + a * axes.f.e + b * axes.r.e),
    nord: mm(position.nord + a * axes.f.n + b * axes.r.n),
    altitude: position.altitude == null ? null : mm(position.altitude + a * axes.f.z + b * axes.r.z),
  });
  const milieu = (avant - arriere) / 2;
  return {
    gauche: point(milieu, -gauche),
    droite: point(milieu, droite),
    centre: point(milieu, (droite - gauche) / 2),
    coins: [point(avant, -gauche), point(avant, droite), point(-arriere, droite), point(-arriere, -gauche)],
  };
}
