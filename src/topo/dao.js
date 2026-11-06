// DAO « mini Mensura », étape 1 (0.147.0, Expert, liste du 05.11 point 9) : dessiner des lignes,
// polylignes, rectangles, cercles, arcs, points et textes en MN95. Le dessin est un plan du projet
// (projet.plansDxf, champ `dao`) : il est affiché, accroché, montré / caché et partagé comme un DXF.
// Chaque objet est gardé tel quel dans `plan.dao.objets` ; le contenu du plan (traits, cercles,
// textes, points, repère local depuis `plan.origine`) en est refait à chaque modification.
// Coordonnées : Est, Nord, altitude (m, MN95).

import { ligneDecalee } from './ligne-decalee.js';

export const NOM_DAO = 'DAO';
export const OUTILS_DAO = [
  ['ligne', 'Ligne', 2],
  ['polyligne', 'Polyligne', Infinity],
  ['rectangle', 'Rectangle', 2],
  ['cercle', 'Cercle', 2],
  ['arc', 'Arc 3 pts', 3],
  ['point', 'Point', 1],
  ['texte', 'Texte', 1],
];
export const COULEURS_CALQUES_DAO = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#111827'];

const mm = (v) => Math.round(v * 1000) / 1000;

/** Nombre de points d'un outil (Infinity : polyligne, finie par « Terminer »). */
export function pointsDeLOutil(sorte) {
  return OUTILS_DAO.find(([cle]) => cle === sorte)?.[2] ?? 2;
}

/** Plan DAO vide, repère local autour de "depart" { est, nord }. */
export function creerPlanDao(id, depart) {
  return {
    id,
    nom: NOM_DAO,
    dao: { objets: [] },
    origine: { est: Math.floor(depart.est), nord: Math.floor(depart.nord) },
    bornes: null,
    calques: [{ nom: 'DAO', couleur: COULEURS_CALQUES_DAO[0], visible: true }],
    contenu: { traits: [], pleins: [], cercles: [], textes: [], points: [] },
    compte: { objets: 0, ignores: {} },
    importeLe: new Date().toISOString(),
  };
}

/**
 * Centre et rayon du cercle qui passe par 3 points (m), ou null s'ils sont alignés.
 */
export function cercleParTroisPoints(a, b, c) {
  const d = 2 * (a.est * (b.nord - c.nord) + b.est * (c.nord - a.nord) + c.est * (a.nord - b.nord));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.est ** 2 + a.nord ** 2;
  const b2 = b.est ** 2 + b.nord ** 2;
  const c2 = c.est ** 2 + c.nord ** 2;
  const est = (a2 * (b.nord - c.nord) + b2 * (c.nord - a.nord) + c2 * (a.nord - b.nord)) / d;
  const nord = (a2 * (c.est - b.est) + b2 * (a.est - c.est) + c2 * (b.est - a.est)) / d;
  return { est, nord, rayon: Math.hypot(a.est - est, a.nord - nord) };
}

/**
 * Arc de "debut" à "fin" en passant par "milieu" : points tous les 5° environ (au moins 8 morceaux).
 * Altitudes : de celle du début à celle de la fin, en proportion de l'angle (null si l'une manque).
 */
export function pointsDeLArc(debut, milieu, fin) {
  const cercle = cercleParTroisPoints(debut, milieu, fin);
  if (!cercle) return [debut, fin];
  const angle = (p) => Math.atan2(p.nord - cercle.nord, p.est - cercle.est);
  const a0 = angle(debut);
  const tourner = (a) => ((a - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // 0 à 2π, sens trigonométrique
  let balayage = tourner(angle(fin));
  // Le milieu doit être sur l'arc : sinon on tourne dans l'autre sens.
  if (tourner(angle(milieu)) > balayage) balayage -= 2 * Math.PI;
  const n = Math.max(8, Math.ceil(Math.abs(balayage) / (Math.PI / 36)));
  const zDebut = debut.altitude;
  const zFin = fin.altitude;
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + balayage * t;
    points.push({ est: cercle.est + cercle.rayon * Math.cos(a), nord: cercle.nord + cercle.rayon * Math.sin(a), altitude: zDebut != null && zFin != null ? zDebut + (zFin - zDebut) * t : null });
  }
  return points;
}

/** Les 4 coins d'un rectangle (côtés Est / Nord) donné par deux coins opposés (fermé ensuite). */
export function coinsDuRectangle(a, b) {
  return [a, { est: b.est, nord: a.nord, altitude: null }, b, { est: a.est, nord: b.nord, altitude: null }];
}

/**
 * Refait le contenu du plan (repère local depuis plan.origine) à partir des objets ; "provisoire" :
 * objet en cours de dessin, ajouté à la fin pour qu'on le voie. Met aussi à jour bornes et compte.
 */
// selection (0.148.0) : Set des index des objets choisis, dessinés en orange.
export const COULEUR_SELECTION = '#f59e0b';
export function refaireContenuDao(plan, provisoire = null, selection = null) {
  const o = plan.origine;
  const contenu = { traits: [], pleins: [], cercles: [], textes: [], points: [] };
  let estMin = Infinity;
  let nordMin = Infinity;
  let estMax = -Infinity;
  let nordMax = -Infinity;
  const borner = (p, marge = 0) => {
    estMin = Math.min(estMin, p.est - marge);
    estMax = Math.max(estMax, p.est + marge);
    nordMin = Math.min(nordMin, p.nord - marge);
    nordMax = Math.max(nordMax, p.nord + marge);
  };
  let k = null; // couleur imposée (objet choisi), sinon celle du calque
  const trait = (points, c, ferme = false) => {
    if (points.length < 2) return;
    points.forEach((p) => borner(p));
    const z = points.every((p) => p.altitude != null) ? points.map((p) => mm(p.altitude)) : null;
    contenu.traits.push({ c, k, p: points.flatMap((p) => [mm(p.est - o.est), mm(p.nord - o.nord)]), f: ferme, ...(z ? { z } : {}) });
  };
  const tous = [...plan.dao.objets, ...(provisoire ? [provisoire] : [])];
  for (const [index, objet] of tous.entries()) {
    const c = Math.min(objet.calque ?? 0, plan.calques.length - 1);
    k = selection?.has(index) ? COULEUR_SELECTION : null;
    const [a, b, d] = objet.points;
    if (objet.sorte === 'ligne' || objet.sorte === 'polyligne') trait(objet.points, c, Boolean(objet.ferme));
    else if (objet.sorte === 'rectangle' && b) trait(coinsDuRectangle(a, b), c, true);
    else if (objet.sorte === 'arc' && d) trait(pointsDeLArc(a, b, d), c);
    else if (objet.sorte === 'arc' && b) trait([a, b], c);
    else if (objet.sorte === 'cercle' && b) {
      const r = Math.hypot(b.est - a.est, b.nord - a.nord);
      borner(a, r);
      contenu.cercles.push({ c, k, x: mm(a.est - o.est), y: mm(a.nord - o.nord), r: mm(r) });
    } else if (objet.sorte === 'point' && a) {
      borner(a);
      contenu.points.push({ c, k, x: mm(a.est - o.est), y: mm(a.nord - o.nord), z: a.altitude != null ? mm(a.altitude) : 0 });
    } else if (objet.sorte === 'texte' && a && objet.texte) {
      borner(a);
      contenu.textes.push({ c, k, x: mm(a.est - o.est), y: mm(a.nord - o.nord), h: objet.hauteur ?? 0.5, a: 0, t: objet.texte, ah: 0, av: 0 });
    }
  }
  plan.contenu = contenu;
  plan.bornes = Number.isFinite(estMin) ? { estMin, nordMin, estMax, nordMax } : null;
  plan.compte = { objets: plan.dao.objets.length, ignores: {} };
  return plan;
}

// --- Étape 2 (0.148.0) : modifier les objets ---

/** Points du tracé d'un objet (pour mesurer une distance, chercher une limite) ; fermé : 1er point répété. */
export function traceObjet(objet) {
  const [a, b, c] = objet.points;
  if (objet.sorte === 'ligne' || objet.sorte === 'polyligne') return objet.ferme && objet.points.length > 2 ? [...objet.points, objet.points[0]] : objet.points;
  if (objet.sorte === 'rectangle' && b) {
    const coins = coinsDuRectangle(a, b);
    return [...coins, coins[0]];
  }
  if (objet.sorte === 'arc' && c) return pointsDeLArc(a, b, c);
  if (objet.sorte === 'cercle' && b) {
    const r = Math.hypot(b.est - a.est, b.nord - a.nord);
    return Array.from({ length: 73 }, (_, i) => ({ est: a.est + r * Math.cos((i * Math.PI) / 36), nord: a.nord + r * Math.sin((i * Math.PI) / 36), altitude: null }));
  }
  return a ? [a] : [];
}

/** Distance à plat (m) d'un point à un segment. */
function distanceSegment(p, a, b) {
  const dx = b.est - a.est;
  const dy = b.nord - a.nord;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.est - a.est) * dx + (p.nord - a.nord) * dy) / l2));
  return Math.hypot(p.est - (a.est + t * dx), p.nord - (a.nord + t * dy));
}

/** Distance à plat (m) entre un point et le tracé d'un objet. */
export function distanceObjet(objet, p) {
  const trace = traceObjet(objet);
  if (trace.length === 1) return Math.hypot(p.est - trace[0].est, p.nord - trace[0].nord);
  let mini = Infinity;
  for (let i = 0; i + 1 < trace.length; i++) mini = Math.min(mini, distanceSegment(p, trace[i], trace[i + 1]));
  return mini;
}

/** Index de l'objet le plus proche du point, à "tolerance" m au plus, ou -1. */
export function objetSousLeDoigt(objets, p, tolerance) {
  let meilleur = -1;
  let dMin = tolerance;
  objets.forEach((objet, i) => {
    const d = distanceObjet(objet, p);
    if (d <= dMin) {
      dMin = d;
      meilleur = i;
    }
  });
  return meilleur;
}

/** Copie de l'objet dont chaque point passe par "f" (déplacement, rotation, miroir…). Altitudes gardées. */
export function transformerObjet(objet, f) {
  return { ...objet, points: objet.points.map((p) => ({ ...f(p), altitude: p.altitude ?? null })) };
}

/** Déplacement de "de" vers "vers" (m). */
export const translation = (de, vers) => (p) => ({ est: mm(p.est + vers.est - de.est), nord: mm(p.nord + vers.nord - de.nord) });

/**
 * Rotation autour de "centre" de "degres" (° ; horaire = sens des aiguilles d'une montre, comme les
 * gisements ; sinon sens inverse).
 */
export function rotation(centre, degres, horaire = true) {
  const a = ((horaire ? -degres : degres) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (p) => {
    const dx = p.est - centre.est;
    const dy = p.nord - centre.nord;
    return { est: mm(centre.est + dx * cos - dy * sin), nord: mm(centre.nord + dx * sin + dy * cos) };
  };
}

/** Miroir par rapport à la droite (a, b). */
export function miroir(a, b) {
  const dx = b.est - a.est;
  const dy = b.nord - a.nord;
  const l2 = dx * dx + dy * dy || 1;
  return (p) => {
    const t = ((p.est - a.est) * dx + (p.nord - a.nord) * dy) / l2;
    const pied = { est: a.est + t * dx, nord: a.nord + t * dy };
    return { est: mm(2 * pied.est - p.est), nord: mm(2 * pied.nord - p.nord) };
  };
}

/**
 * Objet décalé de "distance" m : ligne, polyligne, rectangle (devient une polyligne fermée) : parallèle,
 * + = à droite en regardant dans le sens du tracé ; cercle et arc : + = rayon plus grand. Null si impossible.
 */
export function decalerObjet(objet, distance) {
  const [a, b, c] = objet.points;
  if (objet.sorte === 'cercle' && b) {
    const r = Math.hypot(b.est - a.est, b.nord - a.nord);
    if (r + distance <= 0) return null;
    const k = (r + distance) / r;
    return { ...objet, points: [a, { est: mm(a.est + (b.est - a.est) * k), nord: mm(a.nord + (b.nord - a.nord) * k), altitude: b.altitude ?? null }] };
  }
  if (objet.sorte === 'arc' && c) {
    const centre = cercleParTroisPoints(a, b, c);
    if (!centre || centre.rayon + distance <= 0) return null;
    const k = (centre.rayon + distance) / centre.rayon;
    return { ...objet, points: objet.points.map((p) => ({ est: mm(centre.est + (p.est - centre.est) * k), nord: mm(centre.nord + (p.nord - centre.nord) * k), altitude: p.altitude ?? null })) };
  }
  if (['ligne', 'polyligne', 'rectangle'].includes(objet.sorte)) {
    const trace = traceObjet(objet);
    if (trace.length < 2) return null;
    const { sommets, fermee } = ligneDecalee(trace, distance, 0);
    return { ...objet, sorte: objet.sorte === 'ligne' ? 'ligne' : 'polyligne', ferme: fermee, points: sommets };
  }
  return null;
}

/** Intersection des droites (a, b) et (c, d) : { point, t (sur ab), u (sur cd) } ou null si parallèles. */
function intersection(a, b, c, d) {
  const r = { est: b.est - a.est, nord: b.nord - a.nord };
  const s = { est: d.est - c.est, nord: d.nord - c.nord };
  const den = r.est * s.nord - r.nord * s.est;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.est - a.est) * s.nord - (c.nord - a.nord) * s.est) / den;
  const u = ((c.est - a.est) * r.nord - (c.nord - a.nord) * r.est) / den;
  return { point: { est: a.est + t * r.est, nord: a.nord + t * r.nord }, t, u };
}

/**
 * Prolonger ou couper (0.148.0) : le bout d'une ligne / polyligne le plus proche de "pres" glisse sur
 * la droite de son dernier segment jusqu'à la limite (tracé d'un autre objet, ou ligne d'un plan),
 * à l'intersection la plus proche du bout. Altitude du bout : prolongée selon la pente du segment.
 * limite : liste de points (tracé). Renvoie le nouvel objet, ou null si aucune intersection.
 */
export function prolongerJusqua(objet, pres, limite) {
  if (!['ligne', 'polyligne'].includes(objet.sorte) || objet.points.length < 2 || objet.ferme) return null;
  const pts = objet.points;
  const finVoulue = Math.hypot(pres.est - pts.at(-1).est, pres.nord - pts.at(-1).nord) <= Math.hypot(pres.est - pts[0].est, pres.nord - pts[0].nord);
  const [avant, bout] = finVoulue ? [pts.at(-2), pts.at(-1)] : [pts[1], pts[0]];
  let meilleur = null;
  for (let i = 0; i + 1 < limite.length; i++) {
    const x = intersection(avant, bout, limite[i], limite[i + 1]);
    if (!x || x.u < -1e-9 || x.u > 1 + 1e-9 || x.t <= 1e-9) continue;
    const d = Math.abs(x.t - 1);
    if (!meilleur || d < meilleur.d) meilleur = { d, x };
  }
  if (!meilleur) return null;
  const { t, point } = meilleur.x;
  const z = avant.altitude != null && bout.altitude != null ? mm(avant.altitude + (bout.altitude - avant.altitude) * t) : null;
  const nouveau = { est: mm(point.est), nord: mm(point.nord), altitude: z };
  const points = finVoulue ? [...pts.slice(0, -1), nouveau] : [nouveau, ...pts.slice(1)];
  return { ...objet, points };
}
