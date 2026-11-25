// Plans de chantier (0.286.0, Expert, site PC et Topo Bureau) : plan d'installation de chantier, de phasage, de
// circulation, dessiné sur les plans du projet. Ici : le modèle des données et les petits calculs (sans écran).
// Coordonnées MN95 (Est, Nord) en mètres ; un point = [est, nord].
//
// Un plan de chantier : { id, nom, genre, creeLe, modifieLe, phases [{ id, nom, couleur, visible }], phaseActive,
//   couleurs ('objets' | 'phases'), objets [...], fond { plans: [id…] cachés, points: bool } }.
// Un objet : { id, type, phase, ... } :
//   zone   : { points, categorie, opacite (0–100, fond), contourMm, afficherSurface, traitContour, hachure { motif, angle, pasMm, couleur } }
//   ligne  : { points, style, epaisseurMm, echelleMotif, sens ('inverse' = chevrons retournés), couleur }
//   piste  : { points, largeur }                   (largeur en m)
//   fleche : { points, largeur (m, 0,2), echelle (pointe, ×1) }  (sens de circulation, la pointe au dernier point)
//   texte  : { point, texte, taille, repere [e, n], repereBout ('fleche' | 'point' | 'aucun') }
//             (taille = hauteur des lettres en m ; repere = point visé par la ligne de repère, facultatif)
//   symbole : { point (centre), rotation (°, sens trigonométrique), cle (symbole de la bibliothèque, topo/symboles.js),
//             etage { pose 0–7, textes ['1er', 'Rez'] } (base-vie à étage) }                         (0.289.0)
//   grue   : { point (la tour), rotation, modele ('tour' | 'auto' | 'mobile'), rotationFleche (°, tour / auto), tonnes + tourelle (°) + stabilisateurs + repliee (mobile), fleche (m), chassis ('4.50'… | 'aucun'), rayon (bool) }
// Unités du dessin (0.288.0) : épaisseurs de trait, taille et espacement des motifs en **mm sur le papier** ; sur le
// terrain, 1 mm de papier = « échelle du plan » / 1000 m (plan.echelle, 200 au départ : 1 mm = 0,2 m).
import { modeleDe } from './grue-modele.js';

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
  // 0.299.0 (demande du 24.11) : deux genres de plus, simples noms de zone (couleurs proposées, à confirmer).
  { cle: 'phase', nom: 'Phase', couleur: '#475569' },
  { cle: 'autre', nom: 'Autre', couleur: '#a855f7' },
  // 0.312.0 (demande du 24.11) : la zone « Bâtiment » a un Z bas et un Z haut, visibles sur la vue de côté (couleur proposée, à confirmer).
  { cle: 'batiment', nom: 'Bâtiment', couleur: '#78716c' },
];

// Styles de ligne (0.288.0, dimensions en mm sur le papier) :
//   tirets : [trait, vide] en mm, [] = trait plein ; epaisseurMm : épaisseur du trait ;
//   motif (d'après les lignes de l'utilisateur) : dessiné le long de la ligne, qui s'interrompt autour, tous les pasMm :
//   poteau (rectangle en travers, clôture), chevron « > » (flèche simple, retournable), double « < > » (flèche double),
//   texte (« EAU »…, eclair = petit éclair devant) ; tailleMm = hauteur du motif ou des lettres.
export const STYLES_LIGNE = [
  // 0.293.0 : clôture dans le style du portail (grillage orange à croisillons, poteaux sombres tous les 3,5 m).
  { cle: 'cloture', nom: 'Clôture de chantier', couleur: '#f2a20c', tirets: [], epaisseurMm: 0.3, motif: { type: 'cloture', largeurM: 0.14, elementM: 3.5 } },
  { cle: 'flecheSimple', nom: 'Flèche simple  >', couleur: '#eab308', tirets: [], epaisseurMm: 0.5, motif: { type: 'chevron', pasMm: 22, tailleMm: 2.6 } },
  { cle: 'flecheDouble', nom: 'Flèche double  < >', couleur: '#a21caf', tirets: [], epaisseurMm: 0.5, motif: { type: 'double', pasMm: 26, tailleMm: 2.6 } },
  { cle: 'elec', nom: 'Électricité', couleur: '#ef4444', tirets: [], epaisseurMm: 0.25, motif: { type: 'texte', texte: 'ELEC', eclair: true, pasMm: 34, tailleMm: 2.6 } },
  { cle: 'eau', nom: 'Eau', couleur: '#38b2c4', tirets: [], epaisseurMm: 0.5, motif: { type: 'texte', texte: 'EAU', pasMm: 34, tailleMm: 2.6 } },
  { cle: 'gaz', nom: 'Gaz', couleur: '#eab308', tirets: [], epaisseurMm: 0.5, motif: { type: 'texte', texte: 'GAZ', pasMm: 34, tailleMm: 2.6 } },
  { cle: 'eu', nom: 'Eaux usées (EU)', couleur: '#8a9a3b', tirets: [], epaisseurMm: 0.5, motif: { type: 'texte', texte: 'EU', pasMm: 34, tailleMm: 2.6 } },
  { cle: 'ec', nom: 'Eaux claires (EC)', couleur: '#1d4ed8', tirets: [], epaisseurMm: 0.5, motif: { type: 'texte', texte: 'EC', pasMm: 34, tailleMm: 2.6 } },
  { cle: 'swisscom', nom: 'Swisscom', couleur: '#22c55e', tirets: [], epaisseurMm: 0.5, motif: { type: 'texte', texte: 'SWISSCOM', pasMm: 40, tailleMm: 2.6 } },
  { cle: 'palplanches', nom: 'Palplanches', couleur: '#475569', tirets: [], epaisseurMm: 0.9 },
  { cle: 'conduite', nom: 'Conduite provisoire', couleur: '#2563eb', tirets: [7, 2.5], epaisseurMm: 0.4 },
  { cle: 'signalisation', nom: 'Signalisation', couleur: '#f97316', tirets: [1.5, 1.5], epaisseurMm: 0.6 },
  // 0.292.0 : lignes « en bande » (largeur réelle en m, qui suit l'échelle du plan) et barrière Heras.
  { cle: 'gba', nom: 'Glissière béton (GBA)', couleur: '#9aa3ab', tirets: [], epaisseurMm: 0.3, motif: { type: 'gba', largeurM: 0.6, elementM: 4 } },
  { cle: 'echafaudage', nom: 'Échafaudage', couleur: '#64748b', tirets: [], epaisseurMm: 0.3, motif: { type: 'echafaudage', largeurM: 0.9, elementM: 2.5 } },
  { cle: 'filet', nom: 'Filet de protection', couleur: '#2f9e55', tirets: [], epaisseurMm: 0.3, motif: { type: 'filet', largeurM: 0.35, elementM: 0.5 } },
  { cle: 'heras', nom: 'Barrière Heras', couleur: '#475569', tirets: [], epaisseurMm: 0.3, motif: { type: 'heras', largeurM: 0.8, elementM: 3.5 } },
  // 0.293.0 : barrière suisse à 2 lattes rouges et blanches, cheminement piéton (bande verte avec flèches).
  { cle: 'lattes', nom: 'Barrière 2 lattes rouge et blanc', couleur: '#d63a3a', tirets: [], epaisseurMm: 0.3, motif: { type: 'lattes', largeurM: 0.35, elementM: 0.5 } },
  { cle: 'pieton', nom: 'Cheminement piéton', couleur: '#16a34a', tirets: [], epaisseurMm: 0.3, motif: { type: 'pieton', largeurM: 1.2, elementM: 2.5 } },
  { cle: 'libre', nom: 'Ligne', couleur: '#1b2b36', tirets: [], epaisseurMm: 0.35 },
];
// Anciens genres de ligne : « Câble électrique » (0.286.0) = Électricité ; « Barrière (chevrons) » et « Limite » (0.287.0)
// = flèche simple et flèche double (0.288.0).
const ALIAS_STYLES = { cable: 'elec', barriere: 'flecheSimple', limite: 'flecheDouble' };

export const ECHELLE_PAPIER = 200; // échelle du plan au départ (1:200)
export const OPACITE_ZONE = 20; // % du fond d'une zone, au départ
export const CONTOUR_ZONE_MM = 0.35; // épaisseur du contour d'une zone, au départ (l'emprise : × 2)

export const COULEURS_PHASES = ['#e0702c', '#2f9e6b', '#2563eb', '#9333ea', '#db2777', '#0e7490', '#a16207', '#475569'];
export const COULEUR_PISTE = '#7c858e';
export const COULEUR_FLECHE = '#19a7cc';
export const LARGEUR_FLECHE = 0.2; // m, largeur du corps d'une flèche (0.288.0 : 0,2 au lieu de 0,9)
export const POINTE_LONGUEUR = 1.2; // m, longueur de la pointe à l'échelle ×1
export const POINTE_LARGEUR = 0.9; // m, largeur de la pointe à l'échelle ×1

// 0.292.0 : taille du texte des symboles (mm sur le papier, la même pour tous les blocs) et matériaux des tas de stock.
export const TAILLE_TEXTE_MM = 3;
/** Hauteur (m sur le terrain) du texte des symboles : tailleTexteMm × échelle / 1000. */
/** Taille du texte d'un bloc posé en m (0.320.2) : la sienne (o.texteMm, mm sur le papier) ou celle du plan. */
export const texteDuBlocM = (plan, o) => texteSymbolesM(o?.texteMm ? { ...plan, tailleTexteMm: o.texteMm } : plan);
export const texteSymbolesM = (plan) => Math.min(12, Math.max(0.5, plan?.tailleTexteMm ?? TAILLE_TEXTE_MM)) * ((plan?.echelle ?? ECHELLE_PAPIER) / 1000);
export const MATERIAUX_TAS = [
  { cle: 'terre', nom: 'Terre végétale', couleur: '#6b4a2f' },
  { cle: 'remblai', nom: 'Remblai / tout-venant', couleur: '#8a6d4b' },
  { cle: 'sable', nom: 'Sable', couleur: '#d4b878' },
  { cle: 'gravier', nom: 'Gravier', couleur: '#a8a29a' },
  { cle: 'grave', nom: 'Grave 0/45', couleur: '#8c8c86' },
  { cle: 'concasse', nom: 'Béton concassé', couleur: '#9ca3a8' },
  { cle: 'enrobe', nom: 'Enrobé / fraisât', couleur: '#454b50' },
  { cle: 'blocs', nom: 'Blocs', couleur: '#78716c' },
];
export const materiauTas = (cle) => MATERIAUX_TAS.find((m) => m.cle === cle) ?? null;
export const TAS_HAUTEUR = 3; // m, au départ
export const TAS_TALUS = 1.5; // m horizontaux pour 1 m de hauteur, au départ (à valider)

export const categorieZone = (cle) => CATEGORIES_ZONE.find((c) => c.cle === cle) ?? CATEGORIES_ZONE[0];
export const styleLigne = (cle) => STYLES_LIGNE.find((s) => s.cle === (ALIAS_STYLES[cle] ?? cle)) ?? STYLES_LIGNE[STYLES_LIGNE.length - 1];

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
    phases: [phase], phaseActive: phase.id, couleurs: 'objets', objets: [], fond: { plansCaches: [], points: true, ortho: true }, echelle: ECHELLE_PAPIER, // 0.289.0 : photo pâlie au départ
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

/**
 * Gestion des phases (0.293.0) : « on voit quoi, quand ». plan.vues[phaseEnCours][phaseVue] = règle d'affichage des
 * éléments de phaseVue quand on est dans phaseEnCours :
 *   { mode, opacite (0–1), couleur, fini (mode des éléments dont la fin est passée), genresCaches [types], elementsCaches [ids] }.
 * Un élément peut avoir une phase de fin (o.fin) : « en place » de sa phase jusqu'à cette phase, « fini » après.
 * Sans règle pour la phase en cours : seule cette phase est montrée (0.296.2), avec les phases cochées « sur toutes les pages ».
 */
export const MODES_VUE = [['cache', 'Caché'], ['normal', 'Normal'], ['estompe', 'Estompé'], ['assombri', 'Assombri / grisé'], ['couleur', 'Couleur unique']];
export const OPACITE_VUE = 0.35;
export const COULEUR_VUE = '#64748b';

/** Règle d'affichage des éléments de `vue` quand on est dans `courante` (règle enregistrée, sinon celle de départ). */
export function regleDeVue(plan, courante, vue) {
  const r = plan.vues?.[courante]?.[vue];
  if (r) return r;
  // 0.296.2 : par défaut, seule la phase en cours est montrée (ni les phases d'avant, ni celles d'après)
  return { mode: vue === courante ? 'normal' : 'cache' };
}

/** Phase après laquelle l'élément est « fini » : rang de la phase de fin, ou null. */
const rangDe = (plan, id) => plan.phases.findIndex((p) => p.id === id);

/**
 * Objets à montrer dans la phase `courante` (la phase active à l'écran, celle de la page sur la feuille). Un élément
 * estompé, assombri ou en couleur unique est rendu comme une copie avec `rendu: { mode, opacite, couleur }` (même id).
 */
export function objetsVus(plan, courante = plan.phaseActive) {
  const construction = plan.construction?.visible !== false; // lignes de construction, hors phases
  const reglee = Boolean(plan.vues?.[courante]);
  const rc = rangDe(plan, courante);
  return plan.objets.flatMap((o) => {
    if (o.type === 'construction') return construction ? [o] : [];
    if (!reglee) return o.phase === courante || plan.phases.find((p) => p.id === o.phase)?.commune ? [o] : []; // départ : la phase en cours (et celles « sur toutes les pages »)
    const r = regleDeVue(plan, courante, o.phase);
    if (r.genresCaches?.includes(o.type) || r.elementsCaches?.includes(o.id)) return [];
    let mode = r.mode;
    if (o.fin && rc > rangDe(plan, o.fin)) mode = r.fini ?? 'cache';
    if (mode === 'cache') return [];
    if (mode === 'normal') return [o];
    return [{ ...o, rendu: { mode, opacite: r.opacite ?? OPACITE_VUE, couleur: r.couleur ?? plan.phases.find((p) => p.id === o.phase)?.couleur ?? COULEUR_VUE } }]; // couleur unique de départ = celle de la phase
  });
}

/** Objets dont la phase est visible (dans la phase active). */
export function objetsVisibles(plan) {
  return objetsVus(plan, plan.phaseActive);
}

/** Modifie une règle de vue (crée la ligne de la phase en cours au besoin, avec les règles de départ de toutes les phases). */
export function reglerVue(plan, courante, vue, champs) {
  plan.vues ??= {};
  if (!plan.vues[courante]) {
    plan.vues[courante] = {};
    for (const p of plan.phases) plan.vues[courante][p.id] = { ...regleDeVue(plan, courante, p.id) };
  }
  plan.vues[courante][vue] = { ...(plan.vues[courante][vue] ?? { mode: 'normal' }), ...champs };
  return plan.vues[courante][vue];
}

/** Remet la ligne d'une phase en cours à l'affichage de départ (cases « visible » des phases). */
export function reinitialiserVues(plan, courante) {
  if (plan.vues) delete plan.vues[courante];
}

/** Dates d'une phase pour le cartouche : « 01.03.2027 – 30.04.2027 » (ou une seule, ou vide). */
export function datesDePhase(phase) {
  const f = (d) => (d ? d.split('-').reverse().join('.') : '');
  return [f(phase?.debut), f(phase?.fin)].filter(Boolean).join(' – ');
}

/** Lignes d'un texte de plan (retours à la ligne), au moins une. */
export const lignesDuTexte = (t) => String(t ?? '').split(/\r?\n/);

/** Objets qui s'impriment (PDF, DXF, légende) : tout sauf les lignes de construction (0.293.0). */
export const objetsImprimables = (objets) => objets.filter((o) => o.type !== 'construction');

/**
 * Couleur d'un objet : celle de sa phase (plan.couleurs = 'phases'), sinon celle choisie pour lui (objet.couleur), sinon
 * celle de sa catégorie / son style.
 */
export function couleurObjet(plan, objet) {
  if (objet.rendu?.mode === 'couleur') return objet.rendu.couleur; // gestion des phases : couleur unique
  if (plan.couleurs === 'phases') return plan.phases.find((p) => p.id === objet.phase)?.couleur ?? '#1b2b36';
  if (objet.couleur) return objet.couleur; // couleur choisie pour cet élément (0.287.0)
  if (objet.type === 'zone') return materiauTas(objet.materiau)?.couleur ?? categorieZone(objet.categorie).couleur;
  if (objet.type === 'ligne') return styleLigne(objet.style).couleur;
  if (objet.type === 'piste') return COULEUR_PISTE;
  if (objet.type === 'fleche') return COULEUR_FLECHE;
  if (estPose(objet)) return '#64748b';
  if (objet.type === 'construction') return '#06b6d4';
  if (objet.type === 'cotation') return '#be123c';
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

/** Points d'un objet (le point d'un texte et son point de repère compris). */
export const pointsDe = (o) => (o.type === 'texte' ? [o.point, ...(o.repere ? [o.repere] : [])] : estPose(o) ? [o.point] : o.points ?? []);
/** Élément posé d'un point (symbole, grue : 0.289.0). */
export const estPose = (o) => o.type === 'symbole' || o.type === 'grue';

/**
 * Objet sous le point p (m), à tolerance m près : le plus haut dessiné (le dernier) d'abord. Une zone est touchée
 * dedans ou sur son bord ; une piste à sa demi-largeur ; un texte dans le rectangle de ses lettres (environ).
 */
export function objetSousLePoint(objets, p, tolerance, surSymbole = null) {
  for (let k = objets.length - 1; k >= 0; k--) {
    const o = objets[k];
    if (o.type === 'construction') {
      const [a, b] = segmentConstruction(o);
      if (distanceAuSegment(p, a, b) <= tolerance) return o;
      continue;
    }
    if (estPose(o)) {
      // Symbole posé (0.289.0) : dans sa boîte tournée (surSymbole, qui connaît la bibliothèque), sinon près de son centre.
      if (surSymbole ? surSymbole(o, p, tolerance) : Math.hypot(p[0] - o.point[0], p[1] - o.point[1]) <= tolerance + 1) return o;
      continue;
    }
    if (o.type === 'texte') {
      const h = o.taille ?? 1;
      const lignes = lignesDuTexte(o.texte);
      const l = Math.max(1, ...lignes.map((x) => x.length)) * h * 0.6;
      const H = lignes.length * h * 1.25;
      if (Math.abs(p[0] - o.point[0]) <= l / 2 + tolerance && Math.abs(p[1] - o.point[1]) <= H / 2 + tolerance) return o;
      // 0.293.0 : la ligne de repère se touche facilement (zone élargie le long du trait et autour du point visé).
      if (o.repere && (distanceAuSegment(p, o.point, o.repere) <= tolerance * 2 || Math.hypot(p[0] - o.repere[0], p[1] - o.repere[1]) <= tolerance * 2.5)) return o;
      continue;
    }
    if (o.type === 'cotation') {
      const g = geometrieCotation(o);
      if (g && (g.lignes.some(([a, b]) => distanceAuSegment(p, a, b) <= tolerance * 1.5) || g.arc?.some((q, i) => i && distanceAuSegment(p, g.arc[i - 1], q) <= tolerance * 1.5) || Math.hypot(p[0] - g.texte.p[0], p[1] - g.texte.p[1]) <= tolerance * 3)) return o;
      continue;
    }
    const pts = o.points ?? [];
    const ferme = o.type === 'zone';
    const marge = o.type === 'piste' ? (o.largeur ?? 4) / 2 + tolerance : o.type === 'fleche' ? Math.max(o.largeur ?? LARGEUR_FLECHE, 0.4) / 2 + tolerance : tolerance;
    const n = ferme ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) if (distanceAuSegment(p, pts[i], pts[(i + 1) % pts.length]) <= marge) return o;
    if (ferme && pts.length >= 3 && dansPolygone(p, pts)) return o;
  }
  return null;
}

/** Déplace un objet de (dEst, dNord) m (sans le copier). */
export function deplacerObjet(o, dEst, dNord) {
  if (o.type === 'texte' || estPose(o)) o.point = [o.point[0] + dEst, o.point[1] + dNord]; // le point de repère reste en place
  else o.points = o.points.map(([e, n]) => [e + dEst, n + dNord]);
  if (o.cercle) o.cercle = { ...o.cercle, centre: [o.cercle.centre[0] + dEst, o.cercle.centre[1] + dNord] };
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
    .map((o) => ({ points: (o.type === 'construction' ? segmentConstruction(o) : o.points).map(([est, nord]) => ({ est, nord, altitude: null })), ferme: o.type === 'zone' }));
}

/**
 * Segment d'une ligne de construction (0.293.0) : ses 2 points ; une droite infinie est prolongée de 5 000 m de chaque côté
 * (assez pour l'accroche et le toucher sur tout un chantier). Renvoie [[e, n], [e, n]].
 */
export function segmentConstruction(o, prolongement = 5000) {
  const [a, b] = o.points;
  if (!o.infinie) return [a, b];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uy] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  return [[a[0] - ux * prolongement, a[1] - uy * prolongement], [b[0] + ux * prolongement, b[1] + uy * prolongement]];
}

/**
 * Segment le plus proche du point p (à tolerance m près) parmi des lignes au format de l'accroche ; renvoie [[e, n], [e, n]]
 * ou null (pour une parallèle en ligne de construction : on décale ce segment-là, pas toute la polyligne).
 */
export function segmentLePlusProche(lignes, p, tolerance) {
  let meilleur = null;
  for (const l of lignes) {
    const pts = l.points.map((q) => [q.est, q.nord]);
    const n = l.ferme ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = distanceAuSegment(p, a, b);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, seg: [a, b] };
    }
  }
  return meilleur?.seg ?? null;
}

/** Point à la distance l (m) de p dans la direction angle (degrés, sens inverse des aiguilles depuis l'Est). */
export function pointALaDistance(p, l, angle) {
  const a = (angle * Math.PI) / 180;
  return [Math.round((p[0] + l * Math.cos(a)) * 1e6) / 1e6, Math.round((p[1] + l * Math.sin(a)) * 1e6) / 1e6];
}

/** Angle (degrés, sens inverse des aiguilles depuis l'Est) de p vers q, ou null s'ils sont confondus. */
export function angleVers(p, q) {
  if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9) return null;
  return (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
}

/** Résumé d'un objet pour la liste et le panneau : « Zone · Stockage · 312.5 m² ». */
export function resumeObjet(o) {
  const n = (x, d = 1) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  if (o.type === 'zone') return `Zone · ${categorieZone(o.categorie).nom} · ${n(aire(o.points))} m²`;
  if (o.type === 'ligne') return `${styleLigne(o.style).nom} · ${n(longueur(o.points))} m`;
  if (o.type === 'piste') return `Piste · ${n(o.largeur ?? 4)} m de large · ${n(longueur(o.points))} m`;
  if (o.type === 'fleche') return `Flèche · ${n(longueur(o.points))} m`;
  if (o.type === 'texte') return `Texte « ${String(o.texte).split(/\r?\n/)[0]}${/\n/.test(o.texte) ? '…' : ''} »`;
  if (o.type === 'cotation') { const g = geometrieCotation(o); return g ? `Cotation ${o.genre === 'angle' ? 'd\'angle' : 'de longueur'} · ${g.texte.t}` : 'Cotation'; }
  if (o.type === 'construction') return o.infinie ? 'Construction · droite' : `Construction · segment ${n(longueur(o.points))} m`;
  if (o.type === 'grue' && o.modele === 'fiche') return `Grue ${modeleDe(o.modeleGrue).nom} · flèche ${o.fleche ?? ''} m`;
  if (o.type === 'grue' && o.modele === 'mobile') return `Grue mobile ${o.tonnes ?? 100} t · flèche ${o.fleche ?? 25} m`;
  if (o.type === 'grue') return `Grue ${o.modele === 'auto' ? 'automontante' : 'à tour'} · flèche ${o.fleche ?? 40} m${o.chassis && o.chassis !== 'aucun' ? ` · châssis ${o.chassis}` : ''}`;
  if (o.type === 'symbole' && o.cle === 'dyn:pompe') return o.deploye === false ? 'Pompe à béton · mât plié' : `Pompe à béton · mât ${o.longueur ?? 28} m`;
  if (o.type === 'symbole' && o.cle === 'dyn:parking') return `Parking réservé · ${o.nombre ?? 1} place${(o.nombre ?? 1) > 1 ? 's' : ''}`;
  if (o.type === 'symbole' && o.cle === 'dyn:deviation') return `Panneau de déviation « ${o.texte ?? ''} »`;
  if (o.type === 'symbole') return o.etage ? 'Base-vie à étage' : String(o.cle ?? '').replace(/^[a-z]+:/, '');
  return o.type;
}

/** Sommet d'un objet sous le point p (à tolerance m près) : son rang, ou -1 (pour le glisser par sa poignée). */
export function sommetSousLePoint(o, p, tolerance) {
  const pts = poigneesDe(o);
  let meilleur = -1;
  let dMin = tolerance;
  pts.forEach((q, i) => {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d <= dMin) {
      dMin = d;
      meilleur = i;
    }
  });
  return meilleur;
}

/**
 * Positions régulières le long d'une polyligne (points [x, y], toutes unités) : un repère tous les « pas », le premier à
 * « debut » du départ. Renvoie [{ x, y, angle (radians, sens du segment), s (abscisse le long de la ligne) }].
 */
export function positionsLeLong(points, pas, debut = pas / 2) {
  const res = [];
  if (!(pas > 0) || points.length < 2) return res;
  let cumul = 0;
  let prochain = debut;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1);
    while (l > 0 && prochain <= cumul + l) {
      const t = (prochain - cumul) / l;
      res.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), angle: Math.atan2(y2 - y1, x2 - x1), s: prochain });
      prochain += pas;
      if (res.length > 5000) return res;
    }
    cumul += l;
  }
  return res;
}

/**
 * Morceaux d'une polyligne sans les trous autour de certaines abscisses (pour y écrire un motif) : demi = demi-largeur
 * de chaque trou (même unité). Renvoie une liste de polylignes [[x, y]…].
 */
export function morceauxAvecTrous(points, abscisses, demi) {
  const trous = abscisses.map((s) => [s - demi, s + demi]);
  const dedans = (s) => trous.some(([a, b]) => s > a && s < b);
  const morceaux = [];
  let courant = [];
  let cumul = 0;
  const finir = () => {
    if (courant.length >= 2) morceaux.push(courant);
    courant = [];
  };
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1);
    if (!l) continue;
    // Coupures du segment : ses bouts et les bords des trous qui tombent dedans.
    const coupes = [0, l, ...trous.flat().map((s) => s - cumul).filter((d) => d > 0 && d < l)].sort((a, b) => a - b);
    for (let k = 0; k + 1 < coupes.length; k++) {
      const d0 = coupes[k];
      const d1 = coupes[k + 1];
      if (d1 - d0 < 1e-9) continue;
      const point = (d) => [x1 + ((x2 - x1) * d) / l, y1 + ((y2 - y1) * d) / l];
      if (dedans(cumul + (d0 + d1) / 2)) {
        finir();
        continue;
      }
      if (!courant.length) courant.push(point(d0));
      courant.push(point(d1));
    }
    cumul += l;
  }
  finir();
  return morceaux;
}

// ------------------------------------------------------------------ Unités du papier, flèche, surface, décalage

/** Mètres sur le terrain pour 1 mm de papier (échelle du plan : 200 → 0,2). */
export const metresParMm = (plan) => (plan?.echelle ?? ECHELLE_PAPIER) / 1000;

/** Épaisseur d'une ligne (mm de papier) : la sienne, sinon celle de son genre. */
export const epaisseurLigneMm = (o) => o.epaisseurMm ?? styleLigne(o.style).epaisseurMm;

/** Épaisseur du contour d'une zone (mm de papier). */
export const contourZoneMm = (o) => o.contourMm ?? (o.categorie === 'emprise' ? CONTOUR_ZONE_MM * 2 : CONTOUR_ZONE_MM);

/** Opacité du fond d'une zone, de 0 à 1. */
export const opaciteZone = (o) => Math.min(100, Math.max(0, o.opacite ?? OPACITE_ZONE)) / 100;

/**
 * Dimensions d'une flèche (m) : largeur du corps, échelle de la pointe, longueur et largeur de la pointe (au moins deux
 * fois la largeur du corps). Une flèche d'avant 0.288.0 (« pointe » en m) garde à peu près sa pointe.
 */
export function dimensionsFleche(o) {
  const largeur = o.largeur ?? LARGEUR_FLECHE;
  const echelle = o.echelle ?? (o.pointe ? o.pointe / POINTE_LONGUEUR : 1);
  return { largeur, echelle, longueurPointe: POINTE_LONGUEUR * echelle, largeurPointe: Math.max(POINTE_LARGEUR * echelle, largeur * 2) };
}

/** Centre d'une zone (centre de gravité du polygone ; milieu des bornes si la zone est plate). */
export function centreZone(points) {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const c = x1 * y2 - x2 * y1;
    a2 += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  if (Math.abs(a2) < 1e-9) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return [cx / (3 * a2), cy / (3 * a2)];
}

/** Texte de la surface d'une zone : « 312 m² » (arrondi au m², milliers séparés). */
export function texteSurface(points) {
  return `${Math.round(aire(points)).toLocaleString('fr-CH').replace(/\u202f|\u00a0/g, "'")} m²`;
}

/**
 * Côté d'une polyligne où se trouve le point p : +1 = à gauche en suivant la ligne dans son sens, −1 = à droite
 * (d'après le segment le plus proche).
 */
export function coteDuPoint(points, p) {
  let meilleur = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const d = distanceAuSegment(p, points[i], points[i + 1]);
    if (!meilleur || d < meilleur.d) meilleur = { d, i };
  }
  if (!meilleur) return 1;
  const [ax, ay] = points[meilleur.i];
  const [bx, by] = points[meilleur.i + 1];
  return (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) >= 0 ? 1 : -1;
}

/**
 * Polyligne décalée de d mètres (d > 0 = à gauche en suivant la ligne, d < 0 = à droite), coins prolongés jusqu'à
 * leur croisement (coin trop pointu : coupé). Si le dernier point = le premier (contour fermé), le décalage reste fermé.
 */
export function decalerPolyligne(points, d) {
  const copie = points.map((p) => [p[0], p[1]]);
  if (copie.length < 2 || !d) return copie;
  const segs = [];
  for (let i = 0; i + 1 < copie.length; i++) {
    const [x1, y1] = copie[i];
    const [x2, y2] = copie[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1);
    if (l < 1e-9) continue;
    const ux = (x2 - x1) / l;
    const uy = (y2 - y1) / l;
    segs.push({ a: [x1, y1], b: [x2, y2], ux, uy, nx: -uy * d, ny: ux * d });
  }
  if (!segs.length) return copie;
  // Coin entre deux segments consécutifs : croisement des deux droites décalées (ou 2 points si le coin est trop pointu).
  const coin = (s, t) => {
    const px = s.b[0] + s.nx;
    const py = s.b[1] + s.ny;
    const qx = t.a[0] + t.nx;
    const qy = t.a[1] + t.ny;
    const croix = s.ux * t.uy - s.uy * t.ux;
    if (Math.abs(croix) < 1e-9) return [[px, py]];
    const k = ((qx - px) * t.uy - (qy - py) * t.ux) / croix;
    const x = px + s.ux * k;
    const y = py + s.uy * k;
    return Math.hypot(x - s.b[0], y - s.b[1]) > 4 * Math.abs(d) ? [[px, py], [qx, qy]] : [[x, y]];
  };
  const ferme = segs.length >= 3 && Math.hypot(copie[0][0] - copie[copie.length - 1][0], copie[0][1] - copie[copie.length - 1][1]) < 1e-9;
  const res = [];
  if (ferme) {
    const jonction = coin(segs[segs.length - 1], segs[0]);
    res.push(...jonction);
    for (let i = 0; i + 1 < segs.length; i++) res.push(...coin(segs[i], segs[i + 1]));
    res.push(...jonction);
    return res;
  }
  res.push([segs[0].a[0] + segs[0].nx, segs[0].a[1] + segs[0].ny]);
  for (let i = 0; i + 1 < segs.length; i++) res.push(...coin(segs[i], segs[i + 1]));
  const dern = segs[segs.length - 1];
  res.push([dern.b[0] + dern.nx, dern.b[1] + dern.ny]);
  return res;
}

/**
 * Ligne la plus proche du point p (à tolerance m près) parmi des lignes au format de l'accroche
 * ({ points: [{ est, nord }], ferme }) : ses points [e, n] (refermés si la ligne est fermée), ou null.
 */
export function ligneLaPlusProche(lignes, p, tolerance) {
  let meilleur = null;
  for (const l of lignes) {
    const pts = l.points.map((q) => [q.est, q.nord]);
    const n = l.ferme ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const d = distanceAuSegment(p, pts[i], pts[(i + 1) % pts.length]);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, pts: l.ferme ? [...pts, pts[0]] : pts };
    }
  }
  return meilleur?.pts ?? null;
}

/** Copie profonde du plan (pour « Annuler »). */
export const copiePlan = (plan) => JSON.parse(JSON.stringify(plan));

/**
 * Bords d'une surface triangulée (0.289.0, fond du plan de chantier) : les côtés qui n'appartiennent qu'à un triangle.
 * triangles : [[a, b, c]] avec a = { est, nord } ; renvoie [[[e, n], [e, n]]…] (segments).
 */
export function bordsDesTriangles(triangles) {
  const cle = (p) => `${Math.round(p.est * 1000)},${Math.round(p.nord * 1000)}`;
  const vus = new Map();
  for (const t of triangles) {
    for (let i = 0; i < 3; i++) {
      const a = t[i];
      const b = t[(i + 1) % 3];
      const k = [cle(a), cle(b)].sort().join('|');
      const deja = vus.get(k);
      if (deja) deja.n += 1;
      else vus.set(k, { n: 1, seg: [[a.est, a.nord], [b.est, b.nord]] });
    }
  }
  return [...vus.values()].filter((x) => x.n === 1).map((x) => x.seg);
}

/**
 * Ordre de dessin (0.290.0) : le dernier élément de plan.objets est dessiné au-dessus. quoi : 'devant' (tout au-dessus),
 * 'arriere' (tout en dessous), 'monter' / 'descendre' (d'un cran, seulement parmi les éléments de la même phase visibles
 * ou non, l'ordre suit la liste). Renvoie vrai si l'ordre a changé.
 */
export function changerOrdre(plan, id, quoi) {
  const i = plan.objets.findIndex((o) => o.id === id);
  if (i < 0) return false;
  const n = plan.objets.length;
  const j = { devant: n - 1, arriere: 0, monter: Math.min(n - 1, i + 1), descendre: Math.max(0, i - 1) }[quoi] ?? i;
  if (j === i) return false;
  const [o] = plan.objets.splice(i, 1);
  plan.objets.splice(j, 0, o);
  return true;
}

/**
 * Direction de la ligne la plus proche du point p (à tolerance m près), pour aligner un symbole (0.290.0) : angle du
 * segment le plus proche en degrés (sens trigonométrique, 0 = vers l'Est), ramené au plus près de « actuel » (le symbole
 * ne se retourne pas : on prend le segment ou son sens inverse). lignes : format de l'accroche ({ points: [{ est, nord }],
 * ferme }). Renvoie null si aucune ligne n'est assez près.
 */
export function angleDeLaLigne(lignes, p, tolerance, actuel = 0) {
  let meilleur = null;
  for (const l of lignes) {
    const pts = l.points;
    const n = l.ferme ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (Math.hypot(b.est - a.est, b.nord - a.nord) < 1e-9) continue;
      const d = distanceAuSegment(p, [a.est, a.nord], [b.est, b.nord]);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, angle: (Math.atan2(b.nord - a.nord, b.est - a.est) * 180) / Math.PI };
    }
  }
  if (!meilleur) return null;
  // Le sens le plus proche de la rotation actuelle (écart ramené à −180…180°).
  const ecart = (x) => ((((x - actuel) % 360) + 540) % 360) - 180;
  const angle = Math.abs(ecart(meilleur.angle)) <= 90 ? meilleur.angle : meilleur.angle + 180;
  return Math.round(((angle % 360) + 360) % 360 * 100) / 100;
}


// ------------------------------------------------------------------ Tas de stock (0.292.0)

/** Aire signée d'un contour (> 0 = sens trigonométrique en Est / Nord). */
export function aireSignee(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Anneaux d'un tas de stock : le contour décalé vers l'intérieur de largeur × i / n (i = 1…n), largeur = hauteur × talus,
 * limitée à 45 % de la plus petite dimension de la zone. Renvoie { anneaux [contours fermés], largeur (m), sens (+1 / −1) }.
 * Un anneau qui se retourne (zone trop étroite) arrête la liste.
 */
export function anneauxDuTas(points, hauteur = TAS_HAUTEUR, talus = TAS_TALUS, n = 6) {
  const ferme = [...points, points[0]];
  const sens = aireSignee(points) >= 0 ? 1 : -1; // intérieur = à gauche pour un contour trigonométrique
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const petit = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const largeur = Math.max(0.1, Math.min(hauteur * talus, petit * 0.45));
  const anneaux = [];
  let aireAvant = Math.abs(aireSignee(points));
  for (let i = 1; i <= n; i++) {
    const r = decalerPolyligne(ferme, sens * ((largeur * i) / n));
    if (r.length < 4) break;
    const a = Math.abs(aireSignee(r.slice(0, -1)));
    if (a >= aireAvant * 0.999 || aireSignee(r.slice(0, -1)) * sens < 0) break;
    anneaux.push(r.slice(0, -1));
    aireAvant = a;
  }
  return { anneaux, largeur, sens };
}

// ------------------------------------------------------------------ Cotations (0.293.0)

const dirDe = (a, b) => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

/** Angle (degrés, sens trigonométrique, 0 = Est) d'un vecteur. */
const angleDe = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/**
 * Géométrie d'une cotation, en m (E, N) :
 *  - longueur { points [A, B], decalage (m, + à gauche de A → B) } : traits de rappel, ligne de cote avec flèches, valeur ;
 *  - angle { points [sommet, P1, P2], rayon (m, facultatif) } : arc entre les deux côtés, valeur en degrés.
 * Renvoie { lignes [[a, b]…], fleches [{ p, dir }], arc ([[e, n]…] ou null), texte { p, angle (°, lisible), t } , valeur }.
 */
export function geometrieCotation(o) {
  const pts = o.points ?? [];
  if (o.genre === 'angle') {
    // 0.295.1 : angle coté entre les points 1, 2, 3 (le sommet est le point 2) ; les anciens (sommet en premier) gardent leur ordre
    const [S, A, B] = o.ordre === 'p1-s-p3' ? [pts[1], pts[0], pts[2]] : pts;
    if (!S || !A || !B) return null;
    const a1 = angleDe(S, A);
    const a2 = angleDe(S, B);
    let d = ((a2 - a1 + 540) % 360) - 180; // écart signé entre les côtés, de −180 à 180
    const valeur = Math.abs(d);
    const r = o.rayon ?? Math.max(0.3, 0.55 * Math.min(Math.hypot(A[0] - S[0], A[1] - S[1]), Math.hypot(B[0] - S[0], B[1] - S[1])));
    const arc = [];
    const n = Math.max(6, Math.ceil(valeur / 5));
    for (let i = 0; i <= n; i++) {
      const a = ((a1 + (d * i) / n) * Math.PI) / 180;
      arc.push([S[0] + r * Math.cos(a), S[1] + r * Math.sin(a)]);
    }
    const am = ((a1 + d / 2) * Math.PI) / 180;
    const rt = r * 1.0;
    return {
      sommet: S, lignes: [[S, [S[0] + (A[0] - S[0]) * 1, S[1] + (A[1] - S[1]) * 1]], [S, B]], fleches: [], arc,
      texte: { p: [S[0] + rt * Math.cos(am), S[1] + rt * Math.sin(am)], angle: 0, t: `${Math.abs(valeur).toFixed(2)}°` }, valeur,
    };
  }
  const [A, B] = pts;
  if (!A || !B) return null;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 1e-6) return null;
  const u = dirDe(A, B);
  const nv = [-u[1], u[0]];
  const dec = o.decalage ?? 1;
  const s = dec < 0 ? -1 : 1;
  const A2 = [A[0] + nv[0] * dec, A[1] + nv[1] * dec];
  const B2 = [B[0] + nv[0] * dec, B[1] + nv[1] * dec];
  const ext = 0.25 * s; // les traits de rappel dépassent un peu la ligne de cote
  const rappel = (P, P2) => [P, [P2[0] + nv[0] * ext, P2[1] + nv[1] * ext]];
  let ang = angleDe(A, B);
  if (ang > 90 || ang <= -90) ang += 180; // texte jamais à l'envers
  ang = ((ang + 180) % 360) - 180;
  return {
    lignes: [rappel(A, A2), rappel(B, B2), [A2, B2]],
    fleches: [{ p: A2, dir: u }, { p: B2, dir: [-u[0], -u[1]] }], arc: null,
    texte: { p: [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2], angle: ang, t: `${L.toFixed(2)} m` }, valeur: L,
  };
}

// ------------------------------------------------------------------ Planning des phases (0.294.1)

/**
 * Diagramme de Gantt des phases d'après leurs dates (phase.debut / phase.fin, « AAAA-MM-JJ »). Une phase sans date de fin
 * dure jusqu'au début de la suivante (ou 30 jours) ; sans date de début elle est « sans dates ».
 * Renvoie { debut, fin (ms), jours, lignes [{ id, nom, couleur, x0, x1 (0–1 de la largeur), debut, fin }], sansDates [noms] }
 * ou null s'il n'y a aucune date.
 */
export function ganttPhases(phases) {
  const jour = 86400000;
  const t = (d) => (d ? Date.parse(`${d}T00:00:00Z`) : NaN);
  const avecDebut = phases.filter((p) => Number.isFinite(t(p.debut)));
  if (!avecDebut.length) return null;
  const brutes = phases.map((p, i) => {
    const d = t(p.debut);
    if (!Number.isFinite(d)) return null;
    let f = t(p.fin);
    if (!Number.isFinite(f)) {
      const suivante = phases.slice(i + 1).map((q) => t(q.debut)).find((x) => Number.isFinite(x) && x > d);
      f = suivante ?? d + 30 * jour;
    }
    return { p, d, f: Math.max(f, d + jour) };
  });
  const valides = brutes.filter(Boolean);
  const debut = Math.min(...valides.map((x) => x.d));
  const fin = Math.max(...valides.map((x) => x.f));
  const etendue = fin - debut || jour;
  return {
    debut, fin, jours: Math.round(etendue / jour),
    lignes: valides.map(({ p, d, f }) => ({ id: p.id, nom: p.nom, couleur: p.couleur, x0: (d - debut) / etendue, x1: (f - debut) / etendue, debut: p.debut, fin: p.fin ?? new Date(f).toISOString().slice(0, 10) })),
    sansDates: phases.filter((p) => !Number.isFinite(t(p.debut))).map((p) => p.nom),
  };
}

// --- Zones : type de trait du contour et hachures (0.299.0, demande du 24.11) ---

/** Types de trait du contour d'une zone : [clé, nom, tirets en mm de papier ([] = continu)]. */
export const TRAITS_CONTOUR = [
  ['continu', 'Continu', []],
  ['tirets', 'Tirets', [4, 2]],
  ['points', 'Pointillé', [0.2, 1.4]],
  ['mixte', 'Tirets-points', [5, 1.5, 0.4, 1.5]],
];
/** Tirets (mm de papier) du contour d'une zone ; [] = continu. */
export const tiretsContour = (o) => (TRAITS_CONTOUR.find(([c]) => c === o?.traitContour) ?? TRAITS_CONTOUR[0])[2];

/** Motifs de hachure : [clé, nom]. « aucune » = remplissage seul. */
export const MOTIFS_HACHURE = [
  ['aucune', 'Aucune'],
  ['lignes', 'Lignes'],
  ['quadrillage', 'Quadrillage'],
  ['tirets', 'Tirets'],
  ['points', 'Points'],
  ['briques', 'Briques'],
];
export const HACHURE_ANGLE = 45; // degrés depuis l'Est, sens trigonométrique, au départ
export const HACHURE_PAS_MM = 3; // espacement en mm de papier, au départ
const HACHURE_MAX = 20000; // segments ou points au plus (un pas trop fin est élargi)

/** Morceaux de la droite horizontale y (repère local) qui sont dans le polygone [[x, y]…] (règle pair-impair). */
function morceauxSurLigne(poly, y) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  const res = [];
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-9) res.push([xs[k], xs[k + 1]]);
  return res;
}

/**
 * Hachure d'une zone (polygone [[est, nord]…]) : { segments: [[x1, y1, x2, y2]…], points: [[x, y]…] } en MN95.
 * motif : 'lignes', 'quadrillage', 'tirets', 'points', 'briques' ; angle en degrés (depuis l'Est, sens trigonométrique) ;
 * pas = espacement en m. La grille est calée sur l'origine MN95 (deux zones voisines ont des hachures qui se suivent).
 */
export function hachureZone(points, { motif = 'lignes', angle = HACHURE_ANGLE, pas = 1 } = {}) {
  const vide = { segments: [], points: [] };
  if (!points || points.length < 3 || !(pas > 0) || motif === 'aucune') return vide;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const aire = Math.abs(aireSigneeZone(points));
  // Trop de traits (pas minuscule pour la zone) : on élargit le pas.
  let p = pas;
  const nombre = () => (motif === 'points' ? aire / (p * p) : (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / p) * (motif === 'quadrillage' ? 2 : motif === 'briques' || motif === 'tirets' ? 4 : 1));
  while (nombre() > HACHURE_MAX) p *= 1.5;
  const segments = [];
  const pts = [];
  // Une direction : on tourne la zone de −angle (les hachures deviennent horizontales), on coupe, on retourne.
  const direction = (deg, genre) => {
    const a = (deg * Math.PI) / 180;
    const [c, sn] = [Math.cos(a), Math.sin(a)];
    const versLocal = ([x, y]) => [x * c + y * sn, -x * sn + y * c];
    const versMn95 = (u, v) => [u * c - v * sn, u * sn + v * c];
    const poly = points.map(versLocal);
    const vmin = Math.min(...poly.map((q) => q[1]));
    const vmax = Math.max(...poly.map((q) => q[1]));
    for (let k = Math.ceil(vmin / p); k * p <= vmax; k += 1) {
      const v = k * p;
      for (const [u1, u2] of morceauxSurLigne(poly, v)) {
        if (genre === 'points') {
          for (let m = Math.ceil(u1 / p); m * p <= u2; m += 1) pts.push(versMn95(m * p, v));
        } else if (genre === 'tirets') {
          // Tirets de 0,6 pas, vides de 0,4 pas, décalés d'une ligne à l'autre.
          const decale = (k % 2) * 0.5 * p;
          for (let m = Math.floor((u1 - decale) / p); m * p + decale < u2; m += 1) {
            const d1 = Math.max(u1, m * p + decale);
            const d2 = Math.min(u2, m * p + decale + 0.6 * p);
            if (d2 - d1 > 1e-9) segments.push([...versMn95(d1, v), ...versMn95(d2, v)]);
          }
        } else segments.push([...versMn95(u1, v), ...versMn95(u2, v)]);
      }
      // Briques : joints verticaux entre cette ligne et la suivante, tous les 2 pas, décalés d'un pas une rangée sur deux.
      if (genre === 'briques') {
        const v2 = v + p;
        const decale = (((k % 2) + 2) % 2) * p;
        for (const [u1, u2] of morceauxSurLigne(poly, v + p / 2)) {
          for (let m = Math.ceil((u1 - decale) / (2 * p)); m * 2 * p + decale <= u2; m += 1) {
            const u = m * 2 * p + decale;
            // Joint gardé là où il est dans la zone (coupé à ses bords hauts et bas).
            const haut = morceauxSurLigne(poly.map(([x, y]) => [y, x]), u).find(([a, b]) => a <= v + p / 2 && v + p / 2 <= b);
            if (!haut) continue;
            const w1 = Math.max(v, haut[0]);
            const w2 = Math.min(v2, haut[1]);
            if (w2 - w1 > 1e-9) segments.push([...versMn95(u, w1), ...versMn95(u, w2)]);
          }
        }
      }
    }
  };
  if (motif === 'points') direction(angle, 'points');
  else if (motif === 'tirets') direction(angle, 'tirets');
  else if (motif === 'briques') direction(angle, 'briques');
  else {
    direction(angle, 'lignes');
    if (motif === 'quadrillage') direction(angle + 90, 'lignes');
  }
  return { segments, points: pts };
}

/** Aire signée d'un polygone [[x, y]…] (m², positive dans le sens trigonométrique). */
function aireSigneeZone(points) {
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Réglages de hachure d'une zone en m : { motif, angle, pas } (pas = pasMm × échelle / 1000), ou null sans hachure. */
export function hachureDeLaZone(plan, o) {
  const h = o?.hachure;
  if (!h || !h.motif || h.motif === 'aucune') return null;
  return { motif: h.motif, angle: Number.isFinite(h.angle) ? h.angle : HACHURE_ANGLE, pas: (h.pasMm > 0 ? h.pasMm : HACHURE_PAS_MM) * metresParMm(plan) };
}

// --- Ajouter un point au milieu d'un côté (0.299.0) ---

/**
 * Côtés d'un objet (ligne, zone, flèche, piste) où l'on peut ajouter un point : [{ index (le point est inséré après
 * celui-ci), milieu [e, n] }]. Une zone a aussi le côté qui ferme (dernier → premier).
 */
export function milieuxDesCotes(o) {
  if (!['ligne', 'zone', 'fleche', 'piste'].includes(o?.type) || !o.points || o.points.length < 2 || o.cercle) return [];
  const n = o.points.length;
  const res = [];
  const cotes = o.type === 'zone' && n >= 3 ? n : n - 1;
  for (let i = 0; i < cotes; i += 1) {
    const a = o.points[i];
    const b = o.points[(i + 1) % n];
    res.push({ index: i, milieu: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
  }
  return res;
}

/** Copie des points avec un point ajouté au milieu du côté « index » (entre le point index et le suivant). */
export function ajouterPointAuMilieu(points, index, ferme = false) {
  const n = points.length;
  if (index < 0 || index >= (ferme ? n : n - 1)) return points.slice();
  const a = points[index];
  const b = points[(index + 1) % n];
  const m = [Math.round(((a[0] + b[0]) / 2) * 1000) / 1000, Math.round(((a[1] + b[1]) / 2) * 1000) / 1000];
  return [...points.slice(0, index + 1), m, ...points.slice(index + 1)];
}

/**
 * 0.307.0 (demande du 24.11 : appui long sur le « + » d'un côté) : le côté « index » devient un arc de cercle qui passe
 * par ses deux bouts et par le point m (la souris) ; l'arc est remplacé par `n` petits segments (suite de points, comme
 * un arc exporté en polyligne). Points alignés : le côté reste droit. Renvoie une copie des points.
 */
export function arcSurCote(points, index, m, ferme = false, n = 16) {
  const nb = points.length;
  if (index < 0 || index >= (ferme ? nb : nb - 1)) return points.slice();
  const a = points[index];
  const b = points[(index + 1) % nb];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  // Centre du cercle par a, m, b.
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (Math.abs(d) < 1e-9 * Math.max(1, L * L)) return points.slice();
  const c2 = (p) => p[0] * p[0] + p[1] * p[1];
  const cx = (c2(a) * (m[1] - b[1]) + c2(m) * (b[1] - a[1]) + c2(b) * (a[1] - m[1])) / d;
  const cy = (c2(a) * (b[0] - m[0]) + c2(m) * (a[0] - b[0]) + c2(b) * (m[0] - a[0])) / d;
  const r = Math.hypot(a[0] - cx, a[1] - cy);
  const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx);
  const deuxPi = 2 * Math.PI;
  const norme = (x) => ((x % deuxPi) + deuxPi) % deuxPi;
  const a0 = ang(a);
  // Sens : celui qui passe par m.
  let balayage = norme(ang(b) - a0);
  if (norme(ang(m) - a0) > balayage) balayage -= deuxPi;
  const milieu = [];
  for (let k = 1; k < n; k++) {
    const t = a0 + (balayage * k) / n;
    milieu.push([r3(cx + r * Math.cos(t)), r3(cy + r * Math.sin(t))]);
  }
  return [...points.slice(0, index + 1), ...milieu, ...points.slice(index + 1)];
}

// --- Arcs modifiables (0.315.0, demande du 24.11 : un arc ne doit pas devenir « juste des segments ») ---
// Un arc reste une suite de points (tous les calculs, le DXF et le PDF la lisent comme avant) mais l'objet se souvient des
// arcs : o.arcs = [{ i (point de départ), n (points ajoutés), m (point de passage) }] et o.arcsLen (nombre de points quand
// c'est vrai). Si le nombre de points change autrement (point ajouté ou retiré), les arcs sont oubliés : il reste des segments.

/** Arcs encore valables d'un élément. */
export function arcsDe(o) {
  return Array.isArray(o?.arcs) && o.arcsLen === o.points?.length ? o.arcs : [];
}

/** Le côté « index » devient un arc passant par m (depuis les points et arcs de départ) : { points, arcs, arcsLen }. */
export function courberCote(base, baseArcs, index, m, ferme = false) {
  const points = arcSurCote(base, index, m, ferme);
  const ajoutes = points.length - base.length;
  if (ajoutes <= 0) return { points, arcs: baseArcs, arcsLen: base.length };
  const arcs = [...baseArcs.map((a) => (a.i > index ? { ...a, i: a.i + ajoutes } : a)), { i: index, n: ajoutes, m: [m[0], m[1]] }];
  return { points, arcs, arcsLen: points.length };
}

/** Poignées rondes des arcs (milieu de chaque arc) : [{ numero, point }]. */
export function poigneesArcs(o) {
  return arcsDe(o).map((a, numero) => ({ numero, point: o.points[a.i + 1 + Math.floor(a.n / 2)] })).filter((x) => x.point);
}

/** Indices des points intérieurs aux arcs (pas de carré à glisser dessus). */
export function pointsDansArcs(o) {
  const res = new Set();
  for (const a of arcsDe(o)) for (let k = 1; k <= a.n; k++) res.add(a.i + k);
  return res;
}

/** Courbe de nouveau l'arc « numero » pour qu'il passe par m (mêmes bouts, même nombre de points). */
export function recourber(o, numero, m) {
  const a = arcsDe(o)[numero];
  if (!a) return o;
  const debut = o.points[a.i];
  const fin = o.points[(a.i + a.n + 1) % o.points.length];
  const nouveau = arcSurCote([debut, fin], 0, m, false);
  if (nouveau.length !== a.n + 2) return o; // m aligné avec les bouts : l'arc reste comme il est
  o.points = [...o.points.slice(0, a.i + 1), ...nouveau.slice(1, -1), ...o.points.slice(a.i + 1 + a.n)];
  o.arcs = o.arcs.map((x, k) => (k === numero ? { ...x, m: [m[0], m[1]] } : x));
  return o;
}

// --- Formes : rectangle et rond (0.301.0, demande du 24.11) ---
// Ce sont des zones (contour, épaisseur, remplissage, hachures comme toute zone). Le rond garde son centre et son rayon
// (o.cercle = { centre: [e, n], rayon }) ; ses points (polygone de 72 côtés) servent au dessin, à la surface, aux
// hachures ; ses poignées sont le centre et un point du bord (rayon). DXF : un vrai cercle (CIRCLE).

export const COTES_ROND = 72;

/** Points d'un rond (polygone régulier de « n » côtés, en m, arrondis au mm). */
export function pointsDuRond(centre, rayon, n = COTES_ROND) {
  const m = (v) => Math.round(v * 1000) / 1000;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [m(centre[0] + rayon * Math.cos(a)), m(centre[1] + rayon * Math.sin(a))];
  });
}

/**
 * Rectangle par 3 clics : a et b = un côté, c donne la largeur (distance de c à la droite a → b, du côté de c).
 * Renvoie les 4 coins [a, b, b + l, a + l], ou null si a et b sont confondus ou c sur la droite.
 */
export function rectangleTroisPoints(a, b, c) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1e-6) return null;
  const nx = -(b[1] - a[1]) / L;
  const ny = (b[0] - a[0]) / L;
  const l = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny;
  if (Math.abs(l) < 1e-6) return null;
  const m = (v) => Math.round(v * 1000) / 1000;
  return [a, b, [m(b[0] + nx * l), m(b[1] + ny * l)], [m(a[0] + nx * l), m(a[1] + ny * l)]];
}

/** Poignées d'un élément (carrés à glisser) : le centre et un point du bord pour un rond, sinon ses points. */
export function poigneesDe(o) {
  if (o?.cercle) return [o.cercle.centre, [o.cercle.centre[0] + o.cercle.rayon, o.cercle.centre[1]]];
  return pointsDe(o);
}

/** Change le rayon d'un rond (et refait ses points). */
export function changerRayon(o, rayon) {
  if (!o?.cercle || !(rayon > 0)) return o;
  o.cercle = { ...o.cercle, rayon: Math.round(rayon * 1000) / 1000 };
  o.points = pointsDuRond(o.cercle.centre, o.cercle.rayon);
  return o;
}

/**
 * Point de base pour déplacer un symbole (0.301.0) : le coin ou le milieu de bord de sa boîte le plus proche du point
 * saisi, à « tolerance » près ; sinon le point saisi lui-même. coins = les 4 coins de la boîte tournée.
 */
export function pointDeBase(coins, p, tolerance) {
  const candidats = [...coins, ...coins.map((c, i) => {
    const d = coins[(i + 1) % coins.length];
    return [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2];
  })];
  let meilleur = null;
  let dMin = tolerance;
  for (const q of candidats) {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= dMin) [dMin, meilleur] = [d, q];
  }
  return meilleur ?? p;
}
