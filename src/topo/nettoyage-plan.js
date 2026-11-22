// Nettoyage d'un plan calé (0.279.0, calage de plans, décisions du 22.11) : garder seulement ce qui sert sur le
// chantier, avant de ranger le plan dans le projet.
//  - calques écartés (les calques gelés / éteints du fichier sont écartés d'office, voir recetteDeDepart) ;
//  - types d'objets à retirer : attributs, textes, splines, surfaces pleines ; hachures : garder, contour seulement,
//    supprimer (les cotations, lignes de repère et multilignes ne sont jamais lues par Topo) ;
//  - zone à garder (polygone) : les traits sont COUPÉS au bord ; textes, cercles, points, hachures et surfaces
//    pleines qui touchent la zone sont gardés ENTIERS ;
//  - couleur d'un calque (tous ses objets la prennent) ; préfixe ajouté au nom des calques.
// Coordonnées : celles du plan (repère de lirePlanDxf : origine + coordonnées relatives). La zone est donnée en
// coordonnées absolues du plan reçu (avant calage), [[x, y], …].

export const TYPES_RETIRABLES = [
  ['attributs', 'Attributs'],
  ['textes', 'Textes'],
  ['splines', 'Splines'],
  ['pleins', 'Surfaces pleines'],
];
export const CHOIX_HACHURES = [['garder', 'Garder'], ['contour', 'Contour seulement'], ['supprimer', 'Supprimer']];

/**
 * Recette de départ : calques gelés / éteints écartés, rien d'autre retiré, hachures en contour seulement
 * (comme l'appli d'origine). prefixe : texte ajouté devant le nom de chaque calque.
 */
export function recetteDeDepart(plan, prefixe = '') {
  return {
    ecartes: plan.calques.filter((c) => c.visible === false).map((c) => c.nom),
    couleurs: {},
    types: { attributs: false, textes: false, splines: false, pleins: false },
    hachures: 'contour',
    zone: null,
    prefixe,
  };
}

/** Nombre d'objets de chaque calque (index du calque → nombre). */
export function compterParCalque(plan) {
  const compte = new Array(plan.calques.length).fill(0);
  const { traits = [], pleins = [], cercles = [], textes = [], points = [] } = plan.contenu ?? {};
  for (const liste of [traits, pleins, cercles, textes, points]) for (const o of liste) compte[o.c] = (compte[o.c] ?? 0) + 1;
  return compte;
}

// --- Géométrie de la zone (polygone [[x, y], …], fermé implicitement) ---

/** Vrai si le point (x, y) est dans le polygone (règle pair-impair). */
export function pointDansPolygone(x, y, poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Paramètres t (0 à 1) où le segment a-b croise les bords du polygone. */
function croisementsAvecZone(ax, ay, bx, by, poly) {
  const ts = [];
  const dx = bx - ax;
  const dy = by - ay;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [cx, cy] = poly[j];
    const ex = poly[i][0] - cx;
    const ey = poly[i][1] - cy;
    const den = dx * ey - dy * ex;
    if (den === 0) continue;
    const t = ((cx - ax) * ey - (cy - ay) * ex) / den;
    const u = ((cx - ax) * dy - (cy - ay) * dx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  return ts.sort((a, b) => a - b);
}

/**
 * Coupe une suite de points [[x, y], …] (fermée si « ferme ») au bord de la zone : renvoie les morceaux qui sont
 * dedans, chacun [[x, y], …] (au moins 2 points). Un trait entièrement dedans revient entier.
 */
export function couperDansZone(points, ferme, poly) {
  const suite = ferme && points.length > 2 ? [...points, points[0]] : points;
  const morceaux = [];
  let courant = [];
  const fermerMorceau = () => {
    if (courant.length >= 2) morceaux.push(courant);
    courant = [];
  };
  for (let i = 0; i + 1 < suite.length; i += 1) {
    const [ax, ay] = suite[i];
    const [bx, by] = suite[i + 1];
    const bornes = [0, ...croisementsAvecZone(ax, ay, bx, by, poly), 1];
    for (let k = 0; k + 1 < bornes.length; k += 1) {
      const t0 = bornes[k];
      const t1 = bornes[k + 1];
      const tm = (t0 + t1) / 2;
      const p0 = t0 === 0 ? [ax, ay] : [ax + t0 * (bx - ax), ay + t0 * (by - ay)];
      const p1 = t1 === 1 ? [bx, by] : [ax + t1 * (bx - ax), ay + t1 * (by - ay)];
      if (pointDansPolygone(ax + tm * (bx - ax), ay + tm * (by - ay), poly)) {
        if (courant.length === 0) courant.push(p0);
        courant.push(p1);
      } else fermerMorceau();
    }
  }
  fermerMorceau();
  return morceaux;
}

/** Vrai si une suite de points (contour) touche la zone : un sommet dedans, un bord qui croise, ou la zone dedans. */
function toucheZone(points, poly, ferme = true) {
  if (points.some(([x, y]) => pointDansPolygone(x, y, poly))) return true;
  const suite = ferme ? [...points, points[0]] : points;
  for (let i = 0; i + 1 < suite.length; i += 1) {
    if (croisementsAvecZone(suite[i][0], suite[i][1], suite[i + 1][0], suite[i + 1][1], poly).length) return true;
  }
  return ferme && pointDansPolygone(poly[0][0], poly[0][1], points);
}

/** Vrai si le cercle touche la zone (centre dedans, bord qui croise la zone, ou zone dans le cercle). */
function cercleToucheZone(x, y, r, poly) {
  if (pointDansPolygone(x, y, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2));
    if (Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y) <= r) return true;
  }
  return false;
}

const enPoints = (p) => {
  const pts = [];
  for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  return pts;
};

/**
 * Plan nettoyé selon la recette : { ...plan, calques, contenu, compte } (rangé comme lirePlanDxf). Les calques
 * écartés ou sans objet gardé disparaissent ; les autres prennent le préfixe et leur couleur choisie.
 */
export function nettoyerPlan(plan, recette) {
  const ecartes = new Set(recette.ecartes);
  const garde = (o) => !ecartes.has(plan.calques[o.c]?.nom);
  const { traits = [], pleins = [], cercles = [], textes = [], points = [] } = plan.contenu ?? {};
  const { types, hachures } = recette;
  const o0 = plan.origine;
  // Zone dans le repère du plan (coordonnées relatives à l'origine).
  const zone = recette.zone?.length >= 3 ? recette.zone.map(([x, y]) => [x - o0.est, y - o0.nord]) : null;
  const mm = (v) => Math.round(v * 1000) / 1000;

  const sortie = { traits: [], pleins: [], cercles: [], textes: [], points: [] };
  for (const t of traits) {
    if (!garde(t)) continue;
    if (t.s === 'SPLINE' && types.splines) continue;
    if (t.s === 'HATCH' && hachures === 'supprimer') continue;
    if (t.s === 'SOLID' && types.pleins) continue;
    if (!zone) {
      sortie.traits.push(t);
      continue;
    }
    const pts = enPoints(t.p);
    // Contour de hachure : gardé entier s'il touche la zone (comme la hachure).
    if (t.s === 'HATCH') {
      if (toucheZone(pts, zone, true)) sortie.traits.push(t);
      continue;
    }
    const morceaux = couperDansZone(pts, t.f, zone);
    // Entièrement dedans (un seul morceau, tous les sommets) : gardé tel quel, altitudes comprises.
    const suite = t.f && pts.length > 2 ? [...pts, pts[0]] : pts;
    if (morceaux.length === 1 && morceaux[0].length === suite.length && morceaux[0].every(([x, y], i) => x === suite[i][0] && y === suite[i][1])) {
      sortie.traits.push(t);
      continue;
    }
    // Coupé au bord : les altitudes (DXF 3D) ne sont pas gardées.
    const { z, ...reste } = t;
    for (const morceau of morceaux) sortie.traits.push({ ...reste, p: morceau.flatMap(([x, y]) => [mm(x), mm(y)]), f: false });
  }
  for (const p of pleins) {
    if (!garde(p)) continue;
    if (p.h && hachures !== 'garder') continue;
    if (!p.h && types.pleins) continue;
    if (zone && !toucheZone(enPoints(p.p), zone, true)) continue;
    sortie.pleins.push(p);
  }
  for (const c of cercles) if (garde(c) && (!zone || cercleToucheZone(c.x, c.y, c.r, zone))) sortie.cercles.push(c);
  for (const t of textes) {
    if (!garde(t) || types.textes || (t.s === 'ATTRIB' && types.attributs)) continue;
    if (zone && !pointDansPolygone(t.x, t.y, zone)) continue;
    sortie.textes.push(t);
  }
  for (const p of points) if (garde(p) && (!zone || pointDansPolygone(p.x, p.y, zone))) sortie.points.push(p);

  // Calques : seulement ceux qui ont encore un objet ; préfixe, couleur choisie (les objets la prennent tous).
  const utilises = new Set([...sortie.traits, ...sortie.pleins, ...sortie.cercles, ...sortie.textes, ...sortie.points].map((o) => o.c));
  const nouvelIndex = new Map();
  const calques = [];
  plan.calques.forEach((c, i) => {
    if (!utilises.has(i)) return;
    nouvelIndex.set(i, calques.length);
    calques.push({ ...c, nom: `${recette.prefixe ?? ''}${c.nom}`, couleur: recette.couleurs[c.nom] ?? c.couleur, visible: true });
  });
  const renumeroter = (o) => {
    const recolore = recette.couleurs[plan.calques[o.c].nom];
    return { ...o, c: nouvelIndex.get(o.c), ...(recolore ? { k: null } : {}) };
  };
  const contenu = Object.fromEntries(Object.entries(sortie).map(([cle, liste]) => [cle, liste.map(renumeroter)]));
  const objets = Object.values(contenu).reduce((n, l) => n + l.length, 0);
  return { ...plan, calques, contenu, bornes: bornesDuContenu(contenu, o0) ?? plan.bornes, compte: { ...plan.compte, objets } };
}

/** Bornes absolues du contenu (rangé par rapport à « origine »), ou null s'il est vide. */
function bornesDuContenu(contenu, origine) {
  let estMin = Infinity;
  let nordMin = Infinity;
  let estMax = -Infinity;
  let nordMax = -Infinity;
  const b = (x, y) => {
    if (x < estMin) estMin = x;
    if (x > estMax) estMax = x;
    if (y < nordMin) nordMin = y;
    if (y > nordMax) nordMax = y;
  };
  for (const l of [contenu.traits, contenu.pleins]) for (const t of l) for (let i = 0; i < t.p.length; i += 2) b(t.p[i], t.p[i + 1]);
  for (const c of contenu.cercles) {
    b(c.x - c.r, c.y - c.r);
    b(c.x + c.r, c.y + c.r);
  }
  for (const o of [...contenu.textes, ...contenu.points]) b(o.x, o.y);
  if (!Number.isFinite(estMin)) return null;
  return { estMin: estMin + origine.est, nordMin: nordMin + origine.nord, estMax: estMax + origine.est, nordMax: nordMax + origine.nord };
}

/**
 * Calque de l'objet le plus proche du point (x, y) absolus du plan, à moins de « tolerance » (unités du plan) :
 * index du calque, ou -1. Sert à « cliquer un objet = choisir son calque ».
 */
export function calqueSousLePoint(plan, x, y, tolerance) {
  const px = x - plan.origine.est;
  const py = y - plan.origine.nord;
  let meilleur = { d: tolerance, c: -1 };
  const essayer = (d, c) => {
    if (d <= meilleur.d) meilleur = { d, c };
  };
  const { traits = [], cercles = [], textes = [], points = [], pleins = [] } = plan.contenu ?? {};
  for (const t of [...traits, ...pleins]) {
    const p = t.p;
    for (let i = 0; i + 3 < p.length + (t.f ? 2 : 0); i += 2) {
      const ax = p[i];
      const ay = p[i + 1];
      const bx = p[(i + 2) % p.length];
      const by = p[(i + 3) % p.length];
      if (Math.min(ax, bx) - tolerance > px || Math.max(ax, bx) + tolerance < px || Math.min(ay, by) - tolerance > py || Math.max(ay, by) + tolerance < py) continue;
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const u = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
      essayer(Math.hypot(ax + u * (bx - ax) - px, ay + u * (by - ay) - py), t.c);
    }
  }
  for (const c of cercles) essayer(Math.abs(Math.hypot(c.x - px, c.y - py) - c.r), c.c);
  for (const o of [...textes, ...points]) essayer(Math.hypot(o.x - px, o.y - py), o.c);
  return meilleur.c;
}
