// Plans de chantier (0.311.0) : vue de côté (coupe verticale) le long d'une ligne du plan. On y voit les grues posées d'après
// fiche (pied à son Z, tour, flèche, contre-flèche, crochet à la HSC) et les bâtiments (zones avec un Z bas et un Z haut) coupés
// par la ligne. Projection : chaque point est ramené sur la ligne (distance s depuis le début A), les hauteurs sont vraies ;
// une flèche qui n'est pas dans l'axe de la coupe apparaît raccourcie (× cos de l'angle).
// Tout en m. Résultat : { longueur, zMin, zMax, batiments, grues, niveaux }.
import { reglagesGrue, niveauxGrue, boutDeFleche, porteeMax, chargeAuRayon } from './grue-fiche.js';
import { profilSurface } from './coupe.js';
import { modeleDe } from './grue-modele.js';

const RAD = Math.PI / 180;
const fixe1 = (v) => Number(v).toFixed(1);

/** Intervalles [s0, s1] (m depuis A) où la ligne AB traverse le polygone (points [E, N]). */
export function traverseePolygone(a, b, pts) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const longueur = Math.hypot(dx, dy);
  if (longueur < 1e-9 || pts.length < 3) return [];
  const ts = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / den; // le long de AB
    const u = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / den; // le long de l'arête
    if (t >= 0 && t <= 1 && u >= 0 && u < 1) ts.push(t);
  }
  const dedans = (m) => {
    let d = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > m[1]) !== (yj > m[1]) && m[0] < ((xj - xi) * (m[1] - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  };
  if (dedans(a)) ts.push(0);
  if (dedans(b)) ts.push(1);
  ts.sort((x, y) => x - y);
  const res = [];
  for (let i = 0; i + 1 < ts.length; i += 2) if (ts[i + 1] - ts[i] > 1e-9) res.push([ts[i] * longueur, ts[i + 1] * longueur]);
  return res;
}

/**
 * Lignes proposées pour la coupe : les lignes de coupe tracées (lignes de construction marquées `coupe`), l'axe de chaque
 * grue d'après fiche, puis les autres lignes de construction (segments).
 */
export function lignesDeCoupe(plan) {
  const res = [];
  let n = 0;
  let nc = 0;
  for (const o of plan?.objets ?? []) {
    if (o.type === 'construction' && o.coupe && o.points?.length >= 2) {
      nc += 1;
      res.push({ id: `constr:${o.id}`, nom: `Coupe ${nc} (tracée)`, a: o.points[0], b: o.points[o.points.length - 1], tracee: true });
    }
  }
  for (const o of plan?.objets ?? []) {
    if (o.type === 'grue' && o.modele === 'fiche') {
      const g = reglagesGrue(o);
      const th = ((o.rotation ?? 0) + g.rotationFleche) * RAD;
      const u = [Math.cos(th), Math.sin(th)];
      const avant = g.modele.dim.arriereTotal + 3;
      const apres = porteeMax(g.fleche) + 4;
      res.push({ id: `grue:${o.id}`, nom: `Axe de la grue (${g.modele.nom}, flèche ${fixe1(g.fleche.nom)} m)`, a: [o.point[0] - u[0] * avant, o.point[1] - u[1] * avant], b: [o.point[0] + u[0] * apres, o.point[1] + u[1] * apres] });
    }
  }
  for (const o of plan?.objets ?? []) {
    if (o.type === 'construction' && !o.coupe && o.points?.length >= 2) {
      n += 1;
      res.push({ id: `constr:${o.id}`, nom: `Ligne de construction ${n}`, a: o.points[0], b: o.points[o.points.length - 1] });
    }
  }
  return res;
}

const ptCoupe = (s, z) => [Math.round(s * 1000) / 1000, Math.round(z * 1000) / 1000];

/** Dessin d'une grue dans le plan de coupe : formes { type: 'poly' | 'ligne' | 'texte', pts, genre } en (s, z). */
export function formesGrue(o, a, u) {
  const g = reglagesGrue(o);
  const { modele: M, fleche: f, tour, hauteur: h, r } = g;
  const D = M.dim;
  const nv = niveauxGrue(g);
  const s0 = (o.point[0] - a[0]) * u[0] + (o.point[1] - a[1]) * u[1];
  const th = ((o.rotation ?? 0) + g.rotationFleche) * RAD;
  const cosF = Math.cos(th - Math.atan2(u[1], u[0])); // longueur apparente de la flèche
  const rho = ((o.rotation ?? 0) * RAD) - Math.atan2(u[1], u[0]);
  const proj = Math.abs(Math.cos(rho)) + Math.abs(Math.sin(rho)); // largeur apparente d'un carré tourné
  const rect = (s1, s2, z1, z2, genre) => ({ type: 'poly', genre, pts: [ptCoupe(Math.min(s1, s2), z1), ptCoupe(Math.max(s1, s2), z1), ptCoupe(Math.max(s1, s2), z2), ptCoupe(Math.min(s1, s2), z2)] });
  const largeurMin = (s1, s2, mini = 0.5) => (Math.abs(s2 - s1) < mini ? [s0 + (s1 - s0) - mini / 2, s0 + (s1 - s0) + mini / 2] : [s1, s2]);
  const X = (x) => s0 + x * cosF;
  const formes = [];
  const c = tour.pied.c ?? tour.mat + 1;
  if (g.massifs) formes.push(rect(s0 - (c * proj + g.massifL) / 2, s0 + (c * proj + g.massifL) / 2, nv.pied - g.massifH, nv.pied, 'massif'));
  if (tour.pied.type !== 'FA') formes.push(rect(s0 - (c * proj) / 2, s0 + (c * proj) / 2, nv.pied, nv.pied + 0.5, 'pied'));
  formes.push(rect(s0 - tour.mat / 2, s0 + tour.mat / 2, nv.pied, nv.flecheHaut, 'mat'));
  formes.push({ type: 'poly', genre: 'mat', pts: [ptCoupe(s0 - tour.mat / 2, nv.flecheHaut), ptCoupe(s0 + tour.mat / 2, nv.flecheHaut), ptCoupe(s0, nv.haut)] });
  const bout = boutDeFleche(M, f);
  const arr = D.contreFlecheArriere;
  const [c1, c2] = largeurMin(X(-arr), X(-0.4));
  formes.push(rect(c1, c2, nv.flecheBas, nv.flecheHaut, 'contre'));
  const [j1, j2] = largeurMin(X(D.flecheDebut), X(bout));
  formes.push(rect(j1, j2, nv.flecheBas, nv.flecheHaut, 'fleche'));
  formes.push({ type: 'ligne', genre: 'hauban', pts: [ptCoupe(s0, nv.haut), ptCoupe(X(bout * 0.72), nv.flecheHaut)] });
  formes.push({ type: 'ligne', genre: 'hauban', pts: [ptCoupe(s0, nv.haut), ptCoupe(X(-arr), nv.flecheHaut)] });
  // Crochet à la HSC, au rayon choisi
  const sc = X(r);
  formes.push({ type: 'ligne', genre: 'cable', pts: [ptCoupe(sc, nv.flecheBas), ptCoupe(sc, nv.crochet + 0.8)] });
  formes.push(rect(sc - 0.35, sc + 0.35, nv.crochet, nv.crochet + 0.8, 'crochet'));
  const ch = chargeAuRayon(f, r, g.mode);
  formes.push({ type: 'texte', genre: 'charge', s: sc, z: nv.crochet - 0.9, t: `${fixe1(ch.rayon)} m · ${ch.t.toFixed(2)} t` });
  formes.push({ type: 'texte', genre: 'hsc', ancre: 'end', s: s0 - tour.mat / 2 - 0.6, z: nv.pied + 1.2, t: `HSC ${fixe1(h.h)} m · Z pied ${nv.pied.toFixed(2)}` });
  return { formes, niveaux: nv, s0, nom: `${M.nom}` };
}

/**
 * Coupe d'un plan le long de la ligne { a, b } : grues d'après fiche (projetées), zones « Bâtiment » avec Z bas et Z haut, et
 * profil des surfaces du projet (terrains, plateformes) : surfaces = [{ id, nom, type, triangles }].
 */
export function coupeChantier(plan, ligne, surfaces = []) {
  const { a, b } = ligne;
  const longueur = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = longueur > 0 ? [(b[0] - a[0]) / longueur, (b[1] - a[1]) / longueur] : [1, 0];
  const batiments = [];
  const grues = [];
  const zs = [];
  for (const o of plan?.objets ?? []) {
    if (o.type === 'zone' && o.categorie === 'batiment' && Number.isFinite(Number(o.zBas)) && Number.isFinite(Number(o.zHaut)) && o.zBas !== '' && o.zHaut !== '' && o.points?.length >= 3) {
      for (const [s0, s1] of traverseePolygone(a, b, o.points)) {
        batiments.push({ id: o.id, s0, s1, zBas: Number(o.zBas), zHaut: Number(o.zHaut), nom: o.etiquette || 'Bâtiment' });
        zs.push(Number(o.zBas), Number(o.zHaut));
      }
    } else if (o.type === 'grue' && o.modele === 'fiche') {
      const gr = formesGrue(o, a, u);
      grues.push({ id: o.id, ...gr });
      zs.push(gr.niveaux.pied, gr.niveaux.haut);
      if (o.massifs) zs.push(gr.niveaux.pied - (Number(o.massifH) > 0 ? Number(o.massifH) : 1));
    }
  }
  const profils = [];
  for (const s of surfaces) {
    const lignes = profilSurface(s.triangles, { est: a[0], nord: a[1] }, { est: b[0], nord: b[1] }).map((l) => l.map((p) => [Math.round(p.distance * 1000) / 1000, Math.round(p.altitude * 1000) / 1000]));
    if (!lignes.length) continue;
    profils.push({ id: s.id, nom: s.nom, type: s.type === 'plateforme' ? 'plateforme' : 'terrain', lignes });
    for (const l of lignes) for (const p of l) zs.push(p[1]);
  }
  return { longueur, batiments, grues, surfaces: profils, zMin: zs.length ? Math.min(...zs) : 0, zMax: zs.length ? Math.max(...zs) : 10 };
}

