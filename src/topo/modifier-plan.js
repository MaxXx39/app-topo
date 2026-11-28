// Prolonger et Ajuster (0.360.0) : calculs sur une ligne ouverte (liste de points [Est, Nord], mètres).
// Une « droite » est un segment [[e, n], [e, n]] pris comme droite infinie (la limite jusqu'où l'on prolonge ou coupe).

const EPS = 1e-9;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const arrondi = (v) => Math.round(v * 1e6) / 1e6;
const pt = (p) => [arrondi(p[0]), arrondi(p[1])];

/** Point d'une droite AB (infinie) touché par le rayon qui part de e dans la direction d (unité) ; s = distance parcourue, ou null. */
function coupeRayon(e, d, a, b) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const det = d[0] * uy - d[1] * ux;
  if (Math.abs(det) < EPS * Math.max(1, Math.hypot(ux, uy))) return null; // parallèles
  const wx = a[0] - e[0];
  const wy = a[1] - e[1];
  const s = (wx * uy - wy * ux) / det;
  return s > 1e-6 ? s : null;
}

/**
 * Prolonge le bout de la ligne le plus proche de t (le clic) : jusqu'à la droite donnée, ou, sans droite, jusqu'au pied du clic sur la
 * direction du dernier segment. Renvoie les nouveaux points, ou null (rien à prolonger : parallèle, ou déjà dépassé).
 */
export function prolongerPolyligne(points, t, droite = null) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const finit = distance(t, points[points.length - 1]) < distance(t, points[0]); // true = on prolonge le dernier bout
  const e = finit ? points[points.length - 1] : points[0];
  const avant = finit ? points[points.length - 2] : points[1];
  const l = distance(e, avant);
  if (l < EPS) return null;
  const d = [(e[0] - avant[0]) / l, (e[1] - avant[1]) / l];
  let s;
  if (droite) s = coupeRayon(e, d, droite[0], droite[1]);
  else {
    s = (t[0] - e[0]) * d[0] + (t[1] - e[1]) * d[1];
    if (!(s > 1e-6)) s = null;
  }
  if (s === null) return null;
  const nouveau = pt([e[0] + d[0] * s, e[1] + d[1] * s]);
  const res = points.map((p) => [...p]);
  res[finit ? res.length - 1 : 0] = nouveau;
  return res;
}

/** Point de la droite AB à l'intérieur du segment [p, q] : { u (0 à 1), point } ou null. */
function coupeSegment(p, q, a, b) {
  const r = [q[0] - p[0], q[1] - p[1]];
  const u = [b[0] - a[0], b[1] - a[1]];
  const det = r[0] * u[1] - r[1] * u[0];
  if (Math.abs(det) < EPS * Math.max(1, Math.hypot(r[0], r[1]) * Math.hypot(u[0], u[1]))) return null;
  const w = [a[0] - p[0], a[1] - p[1]];
  const k = (w[0] * u[1] - w[1] * u[0]) / det;
  if (k < -1e-9 || k > 1 + 1e-9) return null;
  return { u: Math.min(1, Math.max(0, k)), point: [p[0] + r[0] * k, p[1] + r[1] * k] };
}

/** Pied du point t sur le segment [p, q] : { u, point, d }. */
function pied(p, q, t) {
  const r = [q[0] - p[0], q[1] - p[1]];
  const l2 = r[0] * r[0] + r[1] * r[1];
  const u = l2 < EPS ? 0 : Math.min(1, Math.max(0, ((t[0] - p[0]) * r[0] + (t[1] - p[1]) * r[1]) / l2));
  const point = [p[0] + r[0] * u, p[1] + r[1] * u];
  return { u, point, d: distance(point, t) };
}

/**
 * Coupe la ligne et enlève le bout le plus proche du clic t. Le trait de coupe est la droite donnée (point de la ligne qui la
 * traverse, le plus près de t) ou, sans droite, le point de la ligne le plus proche de t. Renvoie les points restants, ou null
 * (la droite ne traverse pas la ligne, ou il ne resterait rien).
 */
export function ajusterPolyligne(points, t, droite = null) {
  if (!Array.isArray(points) || points.length < 2) return null;
  let coupe = null; // { i (segment), point }
  for (let i = 0; i < points.length - 1; i++) {
    const c = droite ? coupeSegment(points[i], points[i + 1], droite[0], droite[1]) : pied(points[i], points[i + 1], t);
    if (!c) continue;
    const d = distance(c.point, t);
    if (!coupe || d < coupe.d) coupe = { i, point: c.point, d };
  }
  if (!coupe) return null;
  const c = pt(coupe.point);
  const debut = distance(t, points[0]) <= distance(t, points[points.length - 1]); // true = on enlève le début
  const gardes = debut ? [c, ...points.slice(coupe.i + 1)] : [...points.slice(0, coupe.i + 1), c];
  const propres = gardes.filter((p, k) => k === 0 || distance(p, gardes[k - 1]) > 1e-6).map((p) => [...p]);
  return propres.length >= 2 ? propres : null;
}
