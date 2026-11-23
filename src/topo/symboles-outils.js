// Plans de chantier (0.292.0) : petits outils de dessin communs aux symboles dessinés dans Topo
// (symboles-dessines.js : panneaux et signaux ; symboles-vehicules.js : camions, grues mobiles, engins ;
// symboles-divers.js : installations, stockage, bennes). Tout en m, devant des véhicules en bas (y mini).
import { ARDOISE } from './symboles.js';
import { bornesPrimitives } from './blocs-dxf.js';

export const r3 = (v) => Math.round(v * 1000) / 1000;
export const plat = (pts) => pts.flatMap(([x, y]) => [r3(x), r3(y)]);
export const PERRIN_JAUNE = '#f5c518'; // cabine des camions benne
export const PERRIN_ORANGE = '#f2a20c'; // caisse des camions benne et des bennes
export const NOIR = '#1b1f24';

// ------------------------------------------------------------------ Formes (listes de points [x, y])

/** Rectangle [x0, y0] – [x1, y1], coins arrondis de rayon r (m). */
export function rectArrondi(x0, y0, x1, y1, r = 0, n = 4) {
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const pts = [];
  const coin = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  coin(x1 - r, y0 + r, -Math.PI / 2);
  coin(x1 - r, y1 - r, 0);
  coin(x0 + r, y1 - r, Math.PI / 2);
  coin(x0 + r, y0 + r, Math.PI);
  return pts;
}
/** Cercle (polygone de n côtés). */
export const cercle = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
/** Ellipse (polygone de n côtés). */
export const ellipse = (cx, cy, rx, ry, n = 28) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
/** Arc de cercle (points) de a0 à a1 degrés. */
export const arc = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
/** Triangle équilatéral pointe en haut, centré en (cx, cy), de côté c. */
export const triangle = (cx, cy, c) => {
  const h = (c * Math.sqrt(3)) / 2;
  return [[cx - c / 2, cy - h / 3], [cx + c / 2, cy - h / 3], [cx, cy + (2 * h) / 3]];
};
/** Points tournés de a degrés autour de (cx, cy). */
export const tourner = (pts, a, cx = 0, cy = 0) => {
  const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};
/** Points déplacés. */
export const deplacer = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
/** Polygone d'une polyligne épaissie de w (m), coins à onglet (limités). */
export function epais(pts, w) {
  const h = w / 2;
  const n = pts.length;
  const dir = (a, b) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const gauche = [];
  const droite = [];
  for (let i = 0; i < n; i++) {
    const d1 = i > 0 ? dir(pts[i - 1], pts[i]) : dir(pts[0], pts[1]);
    const d2 = i < n - 1 ? dir(pts[i], pts[i + 1]) : d1;
    let nx = -(d1[1] + d2[1]);
    let ny = d1[0] + d2[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const cos = Math.max(0.55, nx * -d1[1] + ny * d1[0]);
    gauche.push([pts[i][0] + (nx * h) / cos, pts[i][1] + (ny * h) / cos]);
    droite.push([pts[i][0] - (nx * h) / cos, pts[i][1] - (ny * h) / cos]);
  }
  return [...gauche, ...droite.reverse()];
}
/** Pointe de flèche au bout d'une polyligne (triangle), longueur l, largeur w. */
export function pointe(pts, l, w) {
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uy] = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  return [[b[0] + ux * l, b[1] + uy * l], [b[0] - uy * (w / 2), b[1] + ux * (w / 2)], [b[0] + uy * (w / 2), b[1] - ux * (w / 2)]];
}

// ------------------------------------------------------------------ Primitives

export const boite = (contours) => {
  const b = bornesPrimitives([{ g: 'h', p: contours }]);
  return [b.xMin, b.yMin, b.xMax, b.yMax].map(r3);
};
/** Remplissage d'un ou plusieurs contours (le 2e et les suivants = trous), matériau mat. */
export const plein = (k, mat, ...contours) => {
  const p = contours.map(plat);
  return { g: 'h', k, mat, p, b: boite(p), m: false };
};
/** Remplissage « motif » (hachure légère, dessinée à 40 % : zones, halos). */
export const motif = (k, ...contours) => ({ ...plein(k, 'peinture', ...contours), m: true });
export const trait = (pts, ferme = false, k = ARDOISE) => ({ g: 'l', k, p: plat(pts), f: ferme, mat: 'trait' });
/** Pièce : remplissage + contour fin. */
export const piece = (k, mat, pts, kTrait = ARDOISE) => [plein(k, mat, pts), trait(pts, true, kTrait)];
/** Texte centré (la taille réelle est fixée par le plan : taille unique des textes, plaque blanche). */
export const texte = (t, x, y, h, { k = '#1e293b', a = 0 } = {}) => ({ g: 't', k, x: r3(x), y: r3(y), h, a, t, ah: 1, av: 2 });
export const pneu = (x0, y0, x1, y1) => piece('#2b2f33', 'caoutchouc', rectArrondi(x0, y0, x1, y1, Math.min(x1 - x0, y1 - y0) * 0.25));
/** Pneu à crampons : traits en travers (ou chevrons V), pour un tracteur ou un engin. */
export function pneuCrante(x0, y0, x1, y1, { pas = 0.2, chevron = false } = {}) {
  const res = [...pneu(x0, y0, x1, y1)];
  const xm = (x0 + x1) / 2;
  for (let y = y0 + pas / 2; y < y1 - 0.02; y += pas) {
    res.push(chevron ? trait([[x0 + 0.03, y - pas * 0.3], [xm, y + pas * 0.2], [x1 - 0.03, y - pas * 0.3]], false, '#6b7280') : trait([[x0 + 0.02, y], [x1 - 0.02, y]], false, '#6b7280'));
  }
  return res;
}
/** Miroir gauche ↔ droite d'une liste de primitives (x → −x). */
export function miroir(prims) {
  const f = (pts) => {
    const r = [];
    for (let i = 0; i + 1 < pts.length; i += 2) r.push(r3(-pts[i]), pts[i + 1]);
    return r;
  };
  return prims.map((p) => {
    if (p.g === 'l') return { ...p, p: f(p.p) };
    if (p.g === 'h') return { ...p, p: p.p.map(f), b: [r3(-p.b[2]), p.b[1], r3(-p.b[0]), p.b[3]] };
    return { ...p, x: r3(-p.x), a: p.a == null ? p.a : -p.a };
  });
}
export const miroirV = (prims) => prims.map((p) => {
  const f = (pts) => {
    const r = [];
    for (let i = 0; i + 1 < pts.length; i += 2) r.push(pts[i], r3(-pts[i + 1]));
    return r;
  };
  if (p.g === 'l') return { ...p, p: f(p.p) };
  if (p.g === 'h') return { ...p, p: p.p.map(f), b: [p.b[0], r3(-p.b[3]), p.b[2], r3(-p.b[1])] };
  return { ...p, y: r3(-p.y) };
});
/** Primitives tournées de a degrés autour de l'origine. */
export function tournerPrims(prims, a) {
  const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  const f = (pts) => {
    const r = [];
    for (let i = 0; i + 1 < pts.length; i += 2) r.push(r3(pts[i] * c - pts[i + 1] * s), r3(pts[i] * s + pts[i + 1] * c));
    return r;
  };
  return prims.map((p) => {
    if (p.g === 'l') return { ...p, p: f(p.p) };
    if (p.g === 'h') {
      const pp = p.p.map(f);
      return { ...p, p: pp, b: boite(pp) };
    }
    const [x, y] = f([p.x, p.y]);
    return { ...p, x, y, a: (p.a ?? 0) + a };
  });
}
