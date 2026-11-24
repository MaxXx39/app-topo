// Plans de chantier (0.293.0) : blocs dynamiques. Grue mobile = un seul objet réglable : porteur (rotation de l'objet),
// tourelle tournée librement par rapport au porteur, longueur de flèche, stabilisateurs sortis ou non, 4 tailles.
// Grues à tour / automontantes : la flèche s'oriente indépendamment du châssis (`rotationFleche`).
import { AUTOGRUES, porteurGrueMobile, tourelleGrueMobile, pivotGrueMobile, camionGrue } from './symboles-vehicules.js';
import { tournerPrims, deplacer } from './symboles-outils.js';
import { versSymbole } from './symboles-retouches.js';
import { grueLibre } from './symboles.js';
import { bornesPrimitives } from './blocs-dxf.js';
import { panneauDeviation, CLE_DEVIATION } from './panneau-deviation.js';
import { parkingDynamique, CLE_PARKING } from './parking-dynamique.js';
import { pompeDynamique, CLE_POMPE } from './pompe-dynamique.js';

const memoire = new Map();
export const TONNES_MOBILES = AUTOGRUES.map((a) => a.t);
export const FLECHE_MOBILE_MIN = 8;

/** Tailles de la grue mobile de t tonnes (la plus proche). */
export const autogrueDe = (t) => AUTOGRUES.reduce((m, a) => (Math.abs(a.t - t) < Math.abs(m.t - t) ? a : m));

const deplacerPrims = (prims, dx, dy) => prims.map((p) => {
  if (p.g === 'l') return { ...p, p: p.p.map((v, i) => v + (i % 2 ? dy : dx)) };
  if (p.g === 'h') return { ...p, p: p.p.map((c) => c.map((v, i) => v + (i % 2 ? dy : dx))), b: p.b && [p.b[0] + dx, p.b[1] + dy, p.b[2] + dx, p.b[3] + dy] };
  return { ...p, x: p.x + dx, y: p.y + dy };
});
void deplacer;

/**
 * Grue mobile d'un objet { tonnes, fleche, tourelle (°, par rapport au porteur), stabilisateurs } : symbole prêt à dessiner
 * { primitives, boite, fleche, modele: 'mobile', nom }. Le point de base est le centre du porteur.
 */
export function grueMobile(o) {
  const a = autogrueDe(o.tonnes ?? 100);
  const fleche = Math.min(a.fleche, Math.max(FLECHE_MOBILE_MIN, Number(o.fleche) || a.fleche * 0.6));
  const tourelle = Math.round((Number(o.tourelle) || 0) * 10) / 10;
  const stab = o.stabilisateurs !== false;
  const repliee = Boolean(o.repliee);
  const cle = `${a.t}|${fleche}|${tourelle}|${stab}|${repliee}`;
  if (!memoire.has(cle)) {
    if (memoire.size > 60) memoire.clear();
    // 0.305.0 : grue repliée (sur la route) : flèche couchée vers l'avant, appuis rentrés (le camion grue « plié »).
    const prims = repliee ? camionGrue(a, false) : [...porteurGrueMobile(a, stab), ...deplacerPrims(tournerPrims(tourelleGrueMobile(fleche), tourelle), 0, pivotGrueMobile(a))];
    const s = versSymbole(`Grue mobile ${a.t} t`, 'Grues', prims, { centre: false });
    memoire.set(cle, { ...s, fleche, modele: 'mobile', tonnes: a.t, flecheMax: a.fleche, rayon: [] });
  }
  return memoire.get(cle);
}

/**
 * Abaque tapé « 20:5.2, 25:3.8, 30:2.9 » (portée en m : charge en t) → [{ r, t }] triés par portée. Les entrées
 * illisibles sont ignorées ; la charge peut manquer (« 20, 25 » = seulement les cercles).
 */
export function lireAbaque(texte) {
  const nombre = (v) => (v === undefined || v.trim() === '' ? NaN : Number(v.replace(',', '.')));
  const res = [];
  for (const x of String(texte ?? '').split(/[;\n]+|,(?=\s*\d+(?:[.,]\d+)?\s*[:=])|,\s+(?=\d)/)) {
    const [r, t] = x.trim().split(/\s*[:=]\s*/);
    const portee = nombre(r ?? '');
    if (Number.isFinite(portee) && portee > 0) res.push({ r: portee, t: Number.isFinite(nombre(t ?? '')) ? nombre(t) : null });
  }
  return res.sort((a, b) => a.r - b.r);
}

/** Rayon d'action d'une grue à partir de son abaque : cercle principal (flèche) + un cercle par portée, avec « 24 m · 3.2 t ». */
function rayonAbaque(g, abaque) {
  const res = [{ g: 'c', k: '#334155', x: 0, y: 0, r: g.fleche, mat: 'trait' }];
  const texte = (r, t) => (t === null || t === undefined ? `${r} m` : `${r} m · ${t} t`);
  for (const { r, t } of abaque) {
    if (Math.abs(r - g.fleche) < 0.05) continue;
    res.push({ g: 'c', k: '#8a9198', x: 0, y: 0, r, mat: 'trait' }, { g: 't', k: '#92400e', x: r, y: -2.4, h: 0.9, a: 90, t: texte(r, t), ah: 1, av: 2 });
  }
  res.push({ g: 't', k: '#92400e', x: g.fleche, y: -2.4, h: 0.9, a: 90, t: texte(g.fleche, abaque.find((e) => Math.abs(e.r - g.fleche) < 0.05)?.t), ah: 1, av: 2 });
  return res;
}

/** Symbole d'une grue (tour, automontante ou mobile) : l'orientation de la flèche des grues à tour est indépendante du châssis. */
export function grueDeLObjet(bib, o) {
  if (o.modele === 'mobile') return grueMobile(o);
  let g = grueLibre(bib, o.modele ?? 'tour', o.fleche ?? 40);
  const abaque = g ? lireAbaque(o.abaqueTexte) : [];
  if (g && abaque.length) g = { ...g, rayon: rayonAbaque(g, abaque) }; // abaque tapé : remplace les cercles tous les 5 m
  if (!g || !Number(o.rotationFleche)) return g;
  const cle = `${g.modele}|${g.fleche}|${o.rotationFleche}|${o.abaqueTexte ?? ''}`;
  if (!memoire.has(cle)) {
    if (memoire.size > 60) memoire.clear();
    const primitives = tournerPrims(g.primitives, o.rotationFleche);
    let xMin = Infinity; let yMin = Infinity; let xMax = -Infinity; let yMax = -Infinity;
    for (const p of primitives) {
      const b = p.b ?? (p.g === 'l' ? [Math.min(p.p[0], p.p[2]), Math.min(p.p[1], p.p[3]), Math.max(p.p[0], p.p[2]), Math.max(p.p[1], p.p[3])] : null);
      if (!b) continue;
      xMin = Math.min(xMin, b[0]); yMin = Math.min(yMin, b[1]); xMax = Math.max(xMax, b[2]); yMax = Math.max(yMax, b[3]);
    }
    memoire.set(cle, { ...g, primitives, boite: Number.isFinite(xMin) ? [xMin, yMin, xMax, yMax] : g.boite });
  }
  return memoire.get(cle);
}

/**
 * Symbole d'un objet posé : celui de la bibliothèque ; si ce symbole a une tourelle (`pivote` : les `depuis` premières
 * primitives sont le châssis, le reste tourne autour de `centre`), la tourelle est tournée de `o.tourelle` degrés.
 */
export function symboleDeLObjetPose(bib, o) {
  if (o.cle === CLE_DEVIATION) return panneauDeviation(o);
  if (o.cle === CLE_POMPE) return pompeDynamique(o);
  if (o.cle === CLE_PARKING) return parkingDynamique(o);
  const s = bib.find((x) => x.cle === o.cle) ?? null;
  const a = Number(o.tourelle) || 0;
  if (!s?.pivote || !a) return s;
  const cle = `p|${s.cle}|${a}`;
  if (!memoire.has(cle)) {
    if (memoire.size > 60) memoire.clear();
    const [cx, cy] = s.pivote.centre;
    // 0.305.0 : la tourelle = les primitives à partir de « depuis », ou la liste « indices » (pelle 5 t).
    const dansTour = s.pivote.indices ? ((_, i) => s.pivote.indices.includes(i)) : ((_, i) => i >= s.pivote.depuis);
    const fixe = s.primitives.filter((p, i) => !dansTour(p, i));
    const tour = deplacerPrims(tournerPrims(deplacerPrims(s.primitives.filter(dansTour), -cx, -cy), a), cx, cy);
    const primitives = [...fixe, ...tour];
    const b = bornesPrimitives(primitives);
    memoire.set(cle, { ...s, primitives, boite: b ? [b.xMin, b.yMin, b.xMax, b.yMax] : s.boite });
  }
  return memoire.get(cle);
}
