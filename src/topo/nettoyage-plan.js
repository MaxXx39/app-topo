// Nettoyage d'un plan calé (0.279.0, calage de plans, décisions du 22.11) : garder seulement ce qui sert sur le
// chantier, avant de ranger le plan dans le projet.
//  - calques écartés (les calques gelés / éteints du fichier sont écartés d'office, voir recetteDeDepart) ;
//  - types d'objets à retirer : cotations, lignes de repère (lues seulement pour le calage, 0.281.0), attributs, textes,
//    splines, surfaces pleines ; hachures : garder, contour seulement, supprimer (multilignes jamais lues) ;
//  - zone à garder (polygone) : les traits sont COUPÉS au bord ; textes, cercles, points, hachures et surfaces
//    pleines qui touchent la zone sont gardés ENTIERS ;
//  - couleur d'un calque (tous ses objets la prennent) ; préfixe ajouté au nom des calques.
// Coordonnées : celles du plan (repère de lirePlanDxf : origine + coordonnées relatives). La zone est donnée en
// coordonnées absolues du plan reçu (avant calage), [[x, y], …].

export const TYPES_RETIRABLES = [
  ['cotations', 'Cotations'],
  ['reperes', 'Lignes de repère'],
  ['attributs', 'Attributs (valeurs des blocs : n° d\'axe…)'],
  ['textes', 'Textes'],
  ['splines', 'Splines'],
  ['pleins', 'Surfaces pleines'],
];
export const CHOIX_HACHURES = [['garder', 'Garder'], ['contour', 'Contour seulement'], ['supprimer', 'Supprimer']];

/**
 * Recette de départ : calques gelés / éteints écartés, rien d'autre retiré, hachures gardées (0.284.1, demande du 23.11). prefixe : texte ajouté devant le nom de chaque calque.
 */
export function recetteDeDepart(plan, prefixe = '') {
  return {
    ecartes: plan.calques.filter((c) => c.visible === false).map((c) => c.nom),
    couleurs: {},
    // Cochés au départ : cotations, lignes de repère. Attributs gardés (valeur écrite comme un texte, comme « Burst » d'AutoCAD ; demande du 25.11).
    types: { cotations: true, reperes: true, attributs: false, textes: false, splines: false, pleins: false },
    hachures: 'garder',
    zone: null,
    enleves: [],
    prefixe,
  };
}

/** Interligne d'un MTEXT (AutoCAD : 5 / 3 de la hauteur du texte). */
export const INTERLIGNE = 5 / 3;
const memoireExplose = new WeakMap();

/**
 * 0.307.0 : « Exploser les textes » : un texte de plusieurs lignes (MTEXT, `lignes`) devient une ligne de texte par ligne,
 * chacune à sa place (interligne 5/3 de la hauteur, dans le sens du texte), même calque, même alignement. Les autres
 * objets ne changent pas. Même plan en entrée = même résultat (les clés des objets enlevés à la main restent valables).
 */
export function exploserTextes(plan) {
  if (memoireExplose.has(plan)) return memoireExplose.get(plan);
  const textes = plan.contenu?.textes ?? [];
  if (!textes.some((t) => t.lignes?.length > 1)) return plan;
  const mm = (v) => Math.round(v * 1000) / 1000;
  const sortie = [];
  for (const t of textes) {
    if (!(t.lignes?.length > 1)) {
      sortie.push(t);
      continue;
    }
    const n = t.lignes.length;
    const pas = t.h * INTERLIGNE;
    // Décalage de la 1re ligne par rapport au point d'attache : haut (av 3) = 0, milieu = moitié du bloc, bas = tout le bloc.
    const debut = t.av === 2 ? ((n - 1) * pas) / 2 : t.av === 1 || t.av === 0 ? (n - 1) * pas : 0;
    const a = (t.a * Math.PI) / 180;
    const [bx, by] = [Math.sin(a), -Math.cos(a)]; // vers le bas du texte
    const { lignes, ...reste } = t;
    lignes.forEach((ligne, i) => {
      const d = i * pas - debut;
      sortie.push({ ...reste, t: ligne, x: mm(t.x + bx * d), y: mm(t.y + by * d) });
    });
  }
  const res = { ...plan, contenu: { ...plan.contenu, textes: sortie } };
  memoireExplose.set(plan, res);
  return res;
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
export function nettoyerPlan(planRecu, recette) {
  const plan = recette.exploserTextes ? exploserTextes(planRecu) : planRecu;
  const ecartes = new Set(recette.ecartes);
  // 0.298.0 : objets enlevés à la main (clés, voir cleObjet).
  const enleves = new Set(recette.enleves ?? []);
  const garde = (o, genre) => !ecartes.has(plan.calques[o.c]?.nom) && (enleves.size === 0 || !enleves.has(cleObjet(plan, genre, o)));
  const { traits = [], pleins = [], cercles = [], textes = [], points = [] } = plan.contenu ?? {};
  const { types, hachures } = recette;
  const o0 = plan.origine;
  // Zone dans le repère du plan (coordonnées relatives à l'origine).
  const zone = recette.zone?.length >= 3 ? recette.zone.map(([x, y]) => [x - o0.est, y - o0.nord]) : null;
  const mm = (v) => Math.round(v * 1000) / 1000;

  const sortie = { traits: [], pleins: [], cercles: [], textes: [], points: [] };
  for (const t of traits) {
    if (!garde(t, 'traits')) continue;
    if ((t.s === 'DIMENSION' && types.cotations) || (t.s === 'LEADER' && types.reperes)) continue;
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
    if (!garde(p, 'pleins')) continue;
    if (p.s === 'DIMENSION' && types.cotations) continue;
    if (p.h && hachures !== 'garder') continue;
    if (!p.h && types.pleins) continue;
    if (zone && !toucheZone(enPoints(p.p), zone, true)) continue;
    sortie.pleins.push(p);
  }
  for (const c of cercles) if (garde(c, 'cercles') && (!zone || cercleToucheZone(c.x, c.y, c.r, zone))) sortie.cercles.push(c);
  for (const t of textes) {
    if (!garde(t, 'textes') || types.textes || (t.s === 'ATTRIB' && types.attributs) || (t.s === 'DIMENSION' && types.cotations)) continue;
    if (zone && !pointDansPolygone(t.x, t.y, zone)) continue;
    sortie.textes.push(t);
  }
  for (const p of points) if (garde(p, 'points') && (!zone || pointDansPolygone(p.x, p.y, zone))) sortie.points.push(p);

  // Calques : seulement ceux qui ont encore un objet ; préfixe, couleur choisie (les objets la prennent tous).
  const utilises = new Set([...sortie.traits, ...sortie.pleins, ...sortie.cercles, ...sortie.textes, ...sortie.points].map((o) => o.c));
  // 0.298.0 : plan en image (PDF scanné) : l'image reste, avec son calque, sauf si ce calque est écarté.
  const indexImage = plan.contenu?.image ? Math.max(0, plan.calques.findIndex((c) => c.nom === 'PDF_IMAGE')) : -1;
  const image = indexImage >= 0 && !ecartes.has(plan.calques[indexImage]?.nom) ? plan.contenu.image : null;
  if (image) utilises.add(indexImage);
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
  const objets = Object.values(contenu).reduce((n, l) => n + l.length, 0) + (image ? 1 : 0);
  if (image) contenu.image = image;
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

// --- Objets enlevés à la main (0.298.0, demande du 24.11) ---
// On peut enlever un objet seul (clic) ou plusieurs (rectangle), sans écarter tout son calque ; la recette garde la liste
// « enleves » (clés des objets) et on peut les restaurer un par un ou tous.
// Clé d'un objet = son genre, son calque et sa géométrie en coordonnées absolues du plan reçu (au mm) : elle ne dépend pas
// de l'ordre des objets dans le fichier, donc un nouvel indice où l'objet n'a pas bougé le retrouve (et l'enlève encore).

export const GENRES_OBJETS = ['traits', 'pleins', 'cercles', 'textes', 'points'];
const NOM_GENRE = { traits: 'Trait', pleins: 'Surface', cercles: 'Cercle', textes: 'Texte', points: 'Point' };

/** Petit résumé (empreinte FNV-1a 32 bits) d'un texte, en base 36 : une clé courte. */
function empreinte(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Clé d'un objet (genre : 'traits', 'pleins', 'cercles', 'textes' ou 'points') du plan. */
export function cleObjet(plan, genre, o) {
  const { est, nord } = plan.origine ?? { est: 0, nord: 0 };
  const r = (v) => Math.round(v * 1000);
  const calque = plan.calques[o.c]?.nom ?? '';
  let geo;
  if (genre === 'traits' || genre === 'pleins') {
    const p = [];
    for (let i = 0; i < o.p.length; i += 2) p.push(r(o.p[i] + est), r(o.p[i + 1] + nord));
    geo = `${p.join(',')}|${o.f ? 1 : 0}|${o.s ?? ''}|${o.h ? 1 : 0}`;
  } else if (genre === 'cercles') geo = `${r(o.x + est)},${r(o.y + nord)},${r(o.r)}`;
  else if (genre === 'textes') geo = `${r(o.x + est)},${r(o.y + nord)}|${o.t ?? ''}`;
  else geo = `${r(o.x + est)},${r(o.y + nord)}`;
  return `${genre[0]}${empreinte(`${calque}|${geo}`)}`;
}

/** Libellé d'un objet pour la liste « Enlevés à la main » : { cle, texte }. */
export function libelleObjet(plan, genre, o) {
  const calque = plan.calques[o.c]?.nom ?? '?';
  const extrait = genre === 'textes' && o.t ? ` « ${String(o.t).slice(0, 24)} »` : '';
  return { cle: cleObjet(plan, genre, o), texte: `${NOM_GENRE[genre]}${extrait} · ${calque}` };
}

/** Distance du point (px, py) à une suite de points plats [x0, y0, x1, y1…] (fermée si « ferme »). */
function distanceAuxSegments(p, ferme, px, py) {
  let d = Infinity;
  const n = p.length;
  if (n === 2) return Math.hypot(p[0] - px, p[1] - py);
  for (let i = 0; i + 3 < n + (ferme ? 2 : 0); i += 2) {
    const ax = p[i];
    const ay = p[i + 1];
    const bx = p[(i + 2) % n];
    const by = p[(i + 3) % n];
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const u = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
    d = Math.min(d, Math.hypot(ax + u * (bx - ax) - px, ay + u * (by - ay) - py));
  }
  return d;
}

/**
 * Objet le plus proche du point (x, y) absolus du plan, à moins de « tolerance » (unités du plan) :
 * { genre, index, cle } ou null. « exclus » : Set de clés à ne pas proposer. Une surface pleine est trouvée aussi
 * en touchant dedans.
 */
export function objetSousLePoint(plan, x, y, tolerance, exclus = new Set()) {
  const px = x - plan.origine.est;
  const py = y - plan.origine.nord;
  const c = plan.contenu ?? {};
  let meilleur = null;
  const essayer = (d, genre, index) => {
    if (d > tolerance || (meilleur && d >= meilleur.d)) return;
    const cle = cleObjet(plan, genre, c[genre][index]);
    if (!exclus.has(cle)) meilleur = { d, genre, index, cle };
  };
  (c.traits ?? []).forEach((t, i) => essayer(distanceAuxSegments(t.p, t.f, px, py), 'traits', i));
  (c.cercles ?? []).forEach((o, i) => essayer(Math.abs(Math.hypot(o.x - px, o.y - py) - o.r), 'cercles', i));
  (c.textes ?? []).forEach((o, i) => essayer(Math.hypot(o.x - px, o.y - py), 'textes', i));
  (c.points ?? []).forEach((o, i) => essayer(Math.hypot(o.x - px, o.y - py), 'points', i));
  (c.pleins ?? []).forEach((o, i) => {
    const pts = enPoints(o.p);
    // Dedans : un peu moins prioritaire qu'un trait tout proche (distance = moitié de la tolérance).
    essayer(pointDansPolygone(px, py, pts) ? tolerance / 2 : distanceAuxSegments(o.p, true, px, py), 'pleins', i);
  });
  return meilleur && { genre: meilleur.genre, index: meilleur.index, cle: meilleur.cle };
}

/**
 * Clés des objets pris par une zone (polygone [[x, y], …] en coordonnées absolues du plan reçu) :
 * mode 'dedans' = entièrement dedans (rectangle tiré de gauche à droite, comme AutoCAD) ;
 * mode 'touche' = qui touchent la zone (tiré de droite à gauche). « exclus » : clés déjà enlevées.
 */
export function objetsDansZone(plan, zoneAbsolue, mode = 'dedans', exclus = new Set()) {
  const o0 = plan.origine;
  const poly = zoneAbsolue.map(([x, y]) => [x - o0.est, y - o0.nord]);
  const c = plan.contenu ?? {};
  const cles = [];
  const prendre = (genre, o, pris) => {
    if (!pris) return;
    const cle = cleObjet(plan, genre, o);
    if (!exclus.has(cle)) cles.push(cle);
  };
  const dedansTous = (pts) => pts.every(([x, y]) => pointDansPolygone(x, y, poly));
  for (const genre of ['traits', 'pleins']) {
    for (const o of c[genre] ?? []) {
      const pts = enPoints(o.p);
      const ferme = genre === 'pleins' || o.f;
      prendre(genre, o, mode === 'dedans' ? dedansTous(pts) : toucheZone(pts, poly, ferme && pts.length > 2));
    }
  }
  for (const o of c.cercles ?? []) {
    const boite = [[o.x - o.r, o.y - o.r], [o.x + o.r, o.y - o.r], [o.x + o.r, o.y + o.r], [o.x - o.r, o.y + o.r]];
    prendre('cercles', o, mode === 'dedans' ? dedansTous(boite) : cercleToucheZone(o.x, o.y, o.r, poly));
  }
  for (const genre of ['textes', 'points']) for (const o of c[genre] ?? []) prendre(genre, o, pointDansPolygone(o.x, o.y, poly));
  return cles;
}

/** Libellés des objets enlevés à la main, dans l'ordre de la liste « enleves » (ceux introuvables dans ce plan sont omis). */
export function objetsEnleves(plan, enleves = []) {
  if (!enleves.length) return [];
  const voulu = new Set(enleves);
  const trouves = new Map();
  for (const genre of GENRES_OBJETS) {
    for (const o of plan.contenu?.[genre] ?? []) {
      const l = libelleObjet(plan, genre, o);
      if (voulu.has(l.cle) && !trouves.has(l.cle)) trouves.set(l.cle, l);
    }
  }
  return enleves.filter((cle) => trouves.has(cle)).map((cle) => trouves.get(cle));
}

/**
 * Plan reçu réduit aux objets montrés par la recette (calques gardés, types gardés, dans la zone, pas enlevés à la main),
 * SANS les couper ni les renommer : mêmes objets, mêmes clés (cleObjet). Sert à choisir un objet à enlever à la main.
 */
export function planVisible(planRecu, recette) {
  const plan = recette.exploserTextes ? exploserTextes(planRecu) : planRecu;
  const ecartes = new Set(recette.ecartes);
  const enleves = new Set(recette.enleves ?? []);
  const { types, hachures } = recette;
  const o0 = plan.origine;
  const zone = recette.zone?.length >= 3 ? recette.zone.map(([x, y]) => [x - o0.est, y - o0.nord]) : null;
  const c = plan.contenu ?? {};
  const base = (o, genre) => !ecartes.has(plan.calques[o.c]?.nom) && !(enleves.size && enleves.has(cleObjet(plan, genre, o)));
  const contenu = {
    traits: (c.traits ?? []).filter((t) => base(t, 'traits')
      && !((t.s === 'DIMENSION' && types.cotations) || (t.s === 'LEADER' && types.reperes) || (t.s === 'SPLINE' && types.splines)
        || (t.s === 'HATCH' && hachures === 'supprimer') || (t.s === 'SOLID' && types.pleins))
      && (!zone || toucheZone(enPoints(t.p), zone, t.f && t.p.length > 4))),
    pleins: (c.pleins ?? []).filter((p) => base(p, 'pleins') && !(p.s === 'DIMENSION' && types.cotations) && !(p.h && hachures !== 'garder') && !(!p.h && types.pleins)
      && (!zone || toucheZone(enPoints(p.p), zone, true))),
    cercles: (c.cercles ?? []).filter((o) => base(o, 'cercles') && (!zone || cercleToucheZone(o.x, o.y, o.r, zone))),
    textes: (c.textes ?? []).filter((t) => base(t, 'textes') && !types.textes && !(t.s === 'ATTRIB' && types.attributs) && !(t.s === 'DIMENSION' && types.cotations)
      && (!zone || pointDansPolygone(t.x, t.y, zone))),
    points: (c.points ?? []).filter((p) => base(p, 'points') && (!zone || pointDansPolygone(p.x, p.y, zone))),
  };
  return { ...plan, contenu };
}

/** Plan réduit aux objets enlevés à la main (pour les montrer en rouge et pouvoir les restaurer d'un clic). */
export function planDesEnleves(plan, enleves = []) {
  const voulu = new Set(enleves);
  const c = plan.contenu ?? {};
  const contenu = Object.fromEntries(GENRES_OBJETS.map((g) => [g, (c[g] ?? []).filter((o) => voulu.has(cleObjet(plan, g, o)))]));
  return { ...plan, contenu };
}
