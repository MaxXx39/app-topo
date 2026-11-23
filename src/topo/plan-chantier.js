// Plans de chantier (0.286.0, Expert, site PC et Topo Bureau) : plan d'installation de chantier, de phasage, de
// circulation, dessiné sur les plans du projet. Ici : le modèle des données et les petits calculs (sans écran).
// Coordonnées MN95 (Est, Nord) en mètres ; un point = [est, nord].
//
// Un plan de chantier : { id, nom, genre, creeLe, modifieLe, phases [{ id, nom, couleur, visible }], phaseActive,
//   couleurs ('objets' | 'phases'), objets [...], fond { plans: [id…] cachés, points: bool } }.
// Un objet : { id, type, phase, ... } :
//   zone   : { points, categorie }                 (polygone fermé, aire en m²)
//   ligne  : { points, style }                     (clôture, barrière…)
//   piste  : { points, largeur }                   (largeur en m)
//   fleche : { points }                            (sens de circulation, la pointe au dernier point)
//   texte  : { point, texte, taille }              (taille = hauteur des lettres en m)

export const GENRES = [
  ['installation', 'Plan d\'installation de chantier'],
  ['phasage', 'Plan de phasage'],
  ['circulation', 'Plan de circulation'],
];

export const CATEGORIES_ZONE = [
  { cle: 'installation', nom: 'Installation', couleur: '#e0702c' },
  { cle: 'stockage', nom: 'Stockage', couleur: '#2f9e6b' },
  { cle: 'travail', nom: 'Zone de travail', couleur: '#d97706' },
  { cle: 'emprise', nom: 'Emprise du chantier', couleur: '#1d4ed8' },
  { cle: 'interdite', nom: 'Zone interdite', couleur: '#dc2626' },
  { cle: 'parking', nom: 'Parking', couleur: '#64748b' },
];

// tirets : longueurs en m (trait, vide), [] = trait plein ; epaisseur en px à l'écran.
export const STYLES_LIGNE = [
  { cle: 'cloture', nom: 'Clôture', couleur: '#c0392b', tirets: [0.9, 0.35], epaisseur: 2.5, ronds: true },
  { cle: 'barriere', nom: 'Barrière', couleur: '#ea580c', tirets: [0.5, 0.5], epaisseur: 3 },
  { cle: 'palplanches', nom: 'Palplanches', couleur: '#475569', tirets: [], epaisseur: 4 },
  { cle: 'conduite', nom: 'Conduite provisoire', couleur: '#2563eb', tirets: [1.5, 0.5], epaisseur: 2 },
  { cle: 'cable', nom: 'Câble électrique', couleur: '#a16207', tirets: [1, 0.3, 0.2, 0.3], epaisseur: 2 },
  { cle: 'signalisation', nom: 'Signalisation', couleur: '#f59e0b', tirets: [0.3, 0.3], epaisseur: 3 },
  { cle: 'libre', nom: 'Ligne', couleur: '#1b2b36', tirets: [], epaisseur: 2 },
];

export const COULEURS_PHASES = ['#e0702c', '#2f9e6b', '#2563eb', '#9333ea', '#db2777', '#0e7490', '#a16207', '#475569'];
export const COULEUR_PISTE = '#7c858e';
export const COULEUR_FLECHE = '#19a7cc';

export const categorieZone = (cle) => CATEGORIES_ZONE.find((c) => c.cle === cle) ?? CATEGORIES_ZONE[0];
export const styleLigne = (cle) => STYLES_LIGNE.find((s) => s.cle === cle) ?? STYLES_LIGNE[STYLES_LIGNE.length - 1];

let compteur = 0;
/** Identifiant court et unique (ex. « pc-lx3k9a-1 »). */
export function nouvelId(prefixe = 'pc') {
  compteur += 1;
  return `${prefixe}-${Date.now().toString(36)}-${compteur}`;
}

/** Nouveau plan de chantier vide, avec une phase. maintenant : date ISO (pour les tests). */
export function nouveauPlanChantier(nom, genre = 'installation', maintenant = new Date().toISOString()) {
  const phase = { id: nouvelId('ph'), nom: 'Phase 1', couleur: COULEURS_PHASES[0], visible: true };
  return {
    id: nouvelId('pc'), nom: nom || 'Plan de chantier', genre, creeLe: maintenant, modifieLe: maintenant,
    phases: [phase], phaseActive: phase.id, couleurs: 'objets', objets: [], fond: { plansCaches: [], points: true },
  };
}

/** Ajoute une phase (« Phase n », couleur suivante de la palette), la rend active et la renvoie. */
export function ajouterPhase(plan, nom = null) {
  const n = plan.phases.length + 1;
  const phase = { id: nouvelId('ph'), nom: nom || `Phase ${n}`, couleur: COULEURS_PHASES[(n - 1) % COULEURS_PHASES.length], visible: true };
  plan.phases.push(phase);
  plan.phaseActive = phase.id;
  return phase;
}

/**
 * Retire une phase et ses objets. Refusé (false) s'il ne reste qu'une phase. La phase active devient la première.
 */
export function retirerPhase(plan, id) {
  if (plan.phases.length <= 1) return false;
  plan.phases = plan.phases.filter((p) => p.id !== id);
  plan.objets = plan.objets.filter((o) => o.phase !== id);
  if (plan.phaseActive === id) plan.phaseActive = plan.phases[0].id;
  return true;
}

/** Ajoute un objet dans la phase active (si l'objet n'en a pas), lui donne un id et le renvoie. */
export function ajouterObjet(plan, objet) {
  const range = { id: nouvelId('o'), phase: plan.phaseActive, ...objet };
  plan.objets.push(range);
  return range;
}

export function retirerObjet(plan, id) {
  const avant = plan.objets.length;
  plan.objets = plan.objets.filter((o) => o.id !== id);
  return plan.objets.length < avant;
}

/** Objets dont la phase est visible. */
export function objetsVisibles(plan) {
  const visibles = new Set(plan.phases.filter((p) => p.visible !== false).map((p) => p.id));
  return plan.objets.filter((o) => visibles.has(o.phase));
}

/** Couleur d'un objet : celle de sa phase (plan.couleurs = 'phases') ou celle de sa catégorie / son style. */
export function couleurObjet(plan, objet) {
  if (plan.couleurs === 'phases') return plan.phases.find((p) => p.id === objet.phase)?.couleur ?? '#1b2b36';
  if (objet.type === 'zone') return categorieZone(objet.categorie).couleur;
  if (objet.type === 'ligne') return styleLigne(objet.style).couleur;
  if (objet.type === 'piste') return COULEUR_PISTE;
  if (objet.type === 'fleche') return COULEUR_FLECHE;
  return '#1b2b36';
}

// ------------------------------------------------------------------ Géométrie (m, m²)

/** Aire d'un polygone (formule du lacet), m², toujours positive. */
export function aire(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Longueur d'une polyligne (m) ; ferme = ajouter le segment du dernier au premier point. */
export function longueur(points, ferme = false) {
  let l = 0;
  const n = ferme ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    l += Math.hypot(x2 - x1, y2 - y1);
  }
  return l;
}

/** Distance (m) d'un point p à un segment [a, b]. */
export function distanceAuSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Le point p est-il dans le polygone ? (lancer de rayon) */
export function dansPolygone(p, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Points d'un objet (le point d'un texte compris). */
export const pointsDe = (o) => (o.type === 'texte' ? [o.point] : o.points ?? []);

/**
 * Objet sous le point p (m), à tolerance m près : le plus haut dessiné (le dernier) d'abord. Une zone est touchée
 * dedans ou sur son bord ; une piste à sa demi-largeur ; un texte dans le rectangle de ses lettres (environ).
 */
export function objetSousLePoint(objets, p, tolerance) {
  for (let k = objets.length - 1; k >= 0; k--) {
    const o = objets[k];
    if (o.type === 'texte') {
      const h = o.taille ?? 1;
      const l = Math.max(1, String(o.texte).length) * h * 0.6;
      if (Math.abs(p[0] - o.point[0]) <= l / 2 + tolerance && Math.abs(p[1] - o.point[1]) <= h / 2 + tolerance) return o;
      continue;
    }
    const pts = o.points ?? [];
    const ferme = o.type === 'zone';
    const marge = o.type === 'piste' ? (o.largeur ?? 4) / 2 + tolerance : tolerance;
    const n = ferme ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) if (distanceAuSegment(p, pts[i], pts[(i + 1) % pts.length]) <= marge) return o;
    if (ferme && pts.length >= 3 && dansPolygone(p, pts)) return o;
  }
  return null;
}

/** Déplace un objet de (dEst, dNord) m (sans le copier). */
export function deplacerObjet(o, dEst, dNord) {
  if (o.type === 'texte') o.point = [o.point[0] + dEst, o.point[1] + dNord];
  else o.points = o.points.map(([e, n]) => [e + dEst, n + dNord]);
  return o;
}

/** Bornes { estMin, estMax, nordMin, nordMax } des objets, ou null s'il n'y en a pas. */
export function bornesObjets(objets) {
  let estMin = Infinity;
  let estMax = -Infinity;
  let nordMin = Infinity;
  let nordMax = -Infinity;
  for (const o of objets) {
    for (const [e, n] of pointsDe(o)) {
      if (e < estMin) estMin = e;
      if (e > estMax) estMax = e;
      if (n < nordMin) nordMin = n;
      if (n > nordMax) nordMax = n;
    }
  }
  return estMin === Infinity ? null : { estMin, estMax, nordMin, nordMax };
}

/**
 * Pointe d'une flèche dessinée de a vers b : triangle [pointe, gauche, droite] (m). longueurPointe, largeurPointe en m.
 */
export function pointeDeFleche(a, b, longueurPointe = 2, largeurPointe = 1.6) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / l;
  const uy = (b[1] - a[1]) / l;
  const base = [b[0] - ux * longueurPointe, b[1] - uy * longueurPointe];
  const nx = -uy * (largeurPointe / 2);
  const ny = ux * (largeurPointe / 2);
  return [b, [base[0] + nx, base[1] + ny], [base[0] - nx, base[1] - ny]];
}

/**
 * Lignes des objets pour l'accroche (format de topo/accroche.js : { points: [{ est, nord }], ferme }) : on peut
 * accrocher les sommets, milieux et bords de ce qu'on a déjà dessiné.
 */
export function lignesPourAccroche(objets) {
  return objets
    .filter((o) => o.type !== 'texte' && (o.points?.length ?? 0) >= 2)
    .map((o) => ({ points: o.points.map(([est, nord]) => ({ est, nord, altitude: null })), ferme: o.type === 'zone' }));
}

/** Résumé d'un objet pour la liste et le panneau : « Zone · Stockage · 312.5 m² ». */
export function resumeObjet(o) {
  const n = (x, d = 1) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  if (o.type === 'zone') return `Zone · ${categorieZone(o.categorie).nom} · ${n(aire(o.points))} m²`;
  if (o.type === 'ligne') return `${styleLigne(o.style).nom} · ${n(longueur(o.points))} m`;
  if (o.type === 'piste') return `Piste · ${n(o.largeur ?? 4)} m de large · ${n(longueur(o.points))} m`;
  if (o.type === 'fleche') return `Flèche · ${n(longueur(o.points))} m`;
  if (o.type === 'texte') return `Texte « ${o.texte} »`;
  return o.type;
}

/** Copie profonde du plan (pour « Annuler »). */
export const copiePlan = (plan) => JSON.parse(JSON.stringify(plan));
