// Plans de chantier, étape 2 (0.289.0) : symboles (blocs DXF modernisés), grues réglables, base-vie à étage.
// Calculs sans écran : ranger les blocs lus par blocs-dxf.js en bibliothèque, les « moderniser » (même géométrie,
// couleurs adoucies, matériaux d'après la couleur d'origine, phares / feux / rétroviseurs sur les camions et la
// chargeuse), poser un symbole (point de base = centre, rotation libre, échelle réelle en m).
// Coordonnées des primitives : m, dans le repère du symbole (x vers l'Est, y vers le Nord avant rotation), listes plates
// [x, y, x, y…] ; voir blocs-dxf.js pour leur forme.
import { bornesPrimitives, deplacerPrimitives } from './blocs-dxf.js';

export const CATEGORIES_SYMBOLES = ['Base-vie', 'Installations', 'Stockage', 'Engins', 'Grues', 'Véhicules', 'Sécurité', 'Signalisation']; // Signalisation : 0.291.0 ; Installations, Stockage : 0.292.0

// Matériaux d'après la couleur d'origine (décidé le 23.11) et leur couleur modernisée.
const MATERIAUX = {
  '#80bfff': ['vitre', '#9cc9e6'], '#80ffff': ['vitre', '#a7dbe4'], '#66cccc': ['vitre', '#8fc6cf'],
  '#333333': ['caoutchouc', '#2b2f33'],
  '#858585': ['metal', '#8a9198'], '#adadad': ['metal', '#aeb4ba'], '#5c5c5c': ['metal', '#5f666d'], '#5b5b5b': ['metal', '#5f666d'],
  '#d6d6d6': ['metal', '#d5d9dd'], '#c0c0c0': ['metal', '#c3c8cd'], '#848484': ['metal', '#8a9198'],
  '#ffbf00': ['peinture', '#f2a20c'], '#ffff00': ['peinture', '#f5c518'], '#ffdf80': ['peinture', '#f3cd6b'], '#ffff80': ['peinture', '#f6dc7a'],
  '#806040': ['gravats', '#8a6a4b'], '#99734d': ['gravats', '#9a7a58'], '#d38b6b': ['gravats', '#b98263'],
  '#809fff': ['conteneur', '#6f8fb8'], '#6680cc': ['conteneur', '#56739a'], '#8080ff': ['conteneur', '#6f8fb8'], '#0040ff': ['peinture', '#3a62b0'],
  '#0000ff': ['peinture', '#3557a8'],
};
export const ARDOISE = '#334155'; // traits fins (couleur « du bloc », noir)
export const BLANC_BLOC = '#f8fafc'; // remplissage « du bloc » (couleur 7)

const hexVersRvb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rvbVersHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Couleur adoucie : un peu moins saturée et moins crue (les couleurs pures d'AutoCAD), même teinte. */
export function adoucir(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = hexVersRvb(hex.toLowerCase());
  const gris = (r + g + b) / 3;
  const m = (v) => v + (gris - v) * 0.22; // 22 % vers le gris
  return rvbVersHex(m(r) * 0.94 + 6, m(g) * 0.94 + 6, m(b) * 0.94 + 6);
}

/** Couleur plus claire (k > 0) ou plus foncée (k < 0), k de −1 à 1. */
export function nuance(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = hexVersRvb(hex);
  const f = (v) => (k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return rvbVersHex(f(r), f(g), f(b));
}

/** Matériau et couleur modernisée d'une couleur d'origine (k du DXF ; 'BB' = du bloc). */
export function materiau(k, remplissage) {
  if (k === 'BB') return remplissage ? ['blanc', BLANC_BLOC] : ['trait', ARDOISE];
  const connu = MATERIAUX[String(k).toLowerCase()];
  if (connu) return connu;
  return [remplissage ? 'peinture' : 'trait', adoucir(String(k).toLowerCase())];
}

/** Catégorie d'un bloc d'après son nom (bibliothèque de l'utilisateur ; un bloc inconnu va dans Base-vie). */
export function categorieDuBloc(nom) {
  const n = nom.toLowerCase();
  if (/grue|chassis grue/.test(n)) return 'Grues';
  if (/camion|voiture/.test(n)) return 'Véhicules';
  if (/pelle|compact|finisseur|raboteuse|chargeuse|dumper|manuscop|maniscop/.test(n)) return 'Engins';
  if (/panneau|c[oô]ne|^tri$|rassemblement|portique|portail|fl[eè]che|lattes|interdiction|infir/.test(n)) return 'Sécurité';
  return 'Base-vie';
}

/** Blocs qui ne sont pas proposés seuls : parties des grues (posées par l'objet grue), escalier de la base-vie à étage. */
export function blocCache(nom) {
  return /^Grue |^Chassis Grue|^Base vie Etage$/i.test(nom);
}

// Véhicules qui reçoivent phares, feux et rétroviseurs (décidé : camions et chargeuse ; pas de gyrophare).
// avant : côté du devant dans le bloc ('bas' = y mini : camions ; 'droite' = x maxi : chargeuse).
function sensVehicule(nom) {
  if (/^camion/i.test(nom)) return 'bas';
  if (/^chargeuse/i.test(nom)) return 'droite';
  return null;
}

const rect = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
function ovale(cx, cy, rx, ry, n = 14) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    p.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return p;
}

/** Phares (devant), feux (derrière) et rétroviseurs ajoutés à un camion ou à la chargeuse, placés par fractions de la boîte. */
export function equipementsVehicule(nom, b) {
  const sens = sensVehicule(nom);
  if (!sens || !b) return [];
  const res = [];
  const phare = (x, y, r) => res.push({ g: 'h', k: '#fff4cc', p: [ovale(x, y, r, r * 0.6)], mat: 'phare' });
  const feu = (x0, y0, x1, y1) => res.push({ g: 'h', k: '#d63a3a', p: [rect(x0, y0, x1, y1)], mat: 'feu' });
  const retro = (x0, y0, x1, y1, bras) => {
    res.push({ g: 'l', k: ARDOISE, p: bras, f: false, mat: 'trait' });
    res.push({ g: 'h', k: '#2b2f33', p: [rect(x0, y0, x1, y1)], mat: 'caoutchouc' });
  };
  const L = b.xMax - b.xMin;
  const H = b.yMax - b.yMin;
  if (sens === 'bas') {
    // Camion : devant en bas (y mini), cabine d'environ 1,7 m.
    const r = Math.min(0.16, L * 0.07);
    phare(b.xMin + L * 0.16, b.yMin + 0.1, r);
    phare(b.xMax - L * 0.16, b.yMin + 0.1, r);
    feu(b.xMin + 0.05, b.yMax - 0.1, b.xMin + 0.3, b.yMax - 0.02);
    feu(b.xMax - 0.3, b.yMax - 0.1, b.xMax - 0.05, b.yMax - 0.02);
    const y = b.yMin + Math.min(1.0, H * 0.13);
    retro(b.xMin - 0.32, y, b.xMin - 0.18, y + 0.32, [b.xMin, y + 0.1, b.xMin - 0.2, y + 0.16]);
    retro(b.xMax + 0.18, y, b.xMax + 0.32, y + 0.32, [b.xMax, y + 0.1, b.xMax + 0.2, y + 0.16]);
  } else {
    // Chargeuse : devant à droite (godet), cabine vers le tiers arrière.
    const x = b.xMin + L * 0.42;
    const r = Math.min(0.14, H * 0.07);
    phare(x, b.yMin + H * 0.3, r);
    phare(x, b.yMax - H * 0.3, r);
    feu(b.xMin + 0.02, b.yMin + H * 0.22, b.xMin + 0.1, b.yMin + H * 0.36);
    feu(b.xMin + 0.02, b.yMax - H * 0.36, b.xMin + 0.1, b.yMax - H * 0.22);
    const xr = b.xMin + L * 0.36;
    retro(xr, b.yMin + H * 0.1 - 0.3, xr + 0.12, b.yMin + H * 0.1 - 0.12, [xr + 0.06, b.yMin + H * 0.18, xr + 0.06, b.yMin + H * 0.1 - 0.12]);
    retro(xr, b.yMax - H * 0.1 + 0.12, xr + 0.12, b.yMax - H * 0.1 + 0.3, [xr + 0.06, b.yMax - H * 0.18, xr + 0.06, b.yMax - H * 0.1 + 0.12]);
  }
  return res;
}

/** Boîte [xMin, yMin, xMax, yMax] des contours d'un remplissage (pour le dégradé du lustre). */
function boiteRemplissage(p) {
  const b = bornesPrimitives([{ g: 'h', p }]);
  return b ? [b.xMin, b.yMin, b.xMax, b.yMax].map((v) => Math.round(v * 1000) / 1000) : null;
}

/**
 * Modernise un bloc lu (blocs-dxf.js) : même géométrie, couleurs et matériaux (mat : vitre, caoutchouc, metal,
 * peinture, gravats, conteneur, blanc, trait, phare, feu), boîte de chaque remplissage (b), phares… ajoutés.
 * Les hachures à motif deviennent un aplat léger (m : vrai, dessiné plus pâle).
 */
export function moderniserPrimitives(nom, prims, bornes) {
  const res = prims.map((p) => {
    if (p.g === 'h') {
      const [mat, k] = materiau(p.k, true);
      return { ...p, k, mat, b: boiteRemplissage(p.p) };
    }
    if (p.g === 't') return { ...p, k: p.k === 'BB' ? '#1e293b' : nuance(adoucir(p.k), -0.25) };
    const [mat, k] = materiau(p.k, false);
    // Traits : fins ; ceux d'origine noirs ou gris foncé deviennent ardoise, les autres une nuance plus foncée.
    return { ...p, k: mat === 'trait' ? k : nuance(k, -0.3), mat: 'trait' };
  });
  return [...res, ...equipementsVehicule(nom, bornes)];
}

/** Grue : rayon d'action (grands cercles et leurs cotes « 25m ») séparé de la grue elle-même. */
export function separerRayon(prims) {
  const rayon = [];
  const grue = [];
  for (const p of prims) {
    const estRayon = (p.g === 'c' && p.r >= 8) || (p.g === 't' && /^\d+(\.\d+)?\s*m$/i.test(p.t.trim()));
    (estRayon ? rayon : grue).push(p);
  }
  return { grue, rayon };
}

const LONGUEUR_FLECHE = (nom) => Number(/(\d+)\s*m\b/i.exec(nom)?.[1] ?? NaN);

/**
 * Bibliothèque à partir des blocs lus : [{ cle, nom, categorie, largeur, hauteur, primitives, cache, rayon? }].
 * Point de base = centre de la boîte (sauf les grues et leurs châssis : la tour, déjà au point de base du bloc).
 * Les grues « avec châssis » toutes faites ne sont pas gardées (la grue se compose : flèche + châssis).
 * prefixe : début de la clé (« base: » pour la bibliothèque livrée, « projet: » pour un DXF importé dans le projet).
 */
export function bibliothequeDepuisBlocs(blocs, prefixe = 'base:') {
  const res = [];
  for (const bloc of blocs) {
    if (/^Grue Tour \d+m /i.test(bloc.nom) || /^Grue AutoM chassis/i.test(bloc.nom)) continue;
    const b = bloc.bornes;
    if (!b) continue;
    const grue = /^Grue |^Chassis Grue/i.test(bloc.nom);
    // Base-vie : on garde le coin du conteneur (repère du bloc) pour poser l'escalier de l'étage.
    const dx = grue ? 0 : -(b.xMin + b.xMax) / 2;
    const dy = grue ? 0 : -(b.yMin + b.yMax) / 2;
    let prims = moderniserPrimitives(bloc.nom, bloc.primitives, b);
    prims = deplacerPrimitives(prims, dx, dy).map((p) => (p.b ? { ...p, b: [p.b[0] + dx, p.b[1] + dy, p.b[2] + dx, p.b[3] + dy].map((v) => Math.round(v * 1000) / 1000) } : p));
    const symbole = {
      cle: `${prefixe}${bloc.nom}`, nom: bloc.nom, categorie: categorieDuBloc(bloc.nom),
      largeur: Math.round((b.xMax - b.xMin) * 100) / 100, hauteur: Math.round((b.yMax - b.yMin) * 100) / 100,
      decalage: [Math.round(dx * 1000) / 1000, Math.round(dy * 1000) / 1000], primitives: prims,
    };
    if (blocCache(bloc.nom)) symbole.cache = true;
    if (/^Grue /i.test(bloc.nom)) {
      const { grue: g, rayon } = separerRayon(prims);
      symbole.primitives = g;
      symbole.rayon = rayon;
      symbole.fleche = LONGUEUR_FLECHE(bloc.nom);
      symbole.modele = /AutoM/i.test(bloc.nom) ? 'auto' : 'tour';
      const bg = bornesPrimitives(g);
      if (bg) [symbole.largeur, symbole.hauteur] = [bg.xMax - bg.xMin, bg.yMax - bg.yMin].map((v) => Math.round(v * 100) / 100);
    }
    const bf = bornesPrimitives(symbole.primitives);
    if (bf) symbole.boite = [bf.xMin, bf.yMin, bf.xMax, bf.yMax].map((v) => Math.round(v * 1000) / 1000);
    if (/^Chassis Grue/i.test(bloc.nom)) symbole.chassis = /Chassis Grue ([\d.]+)/i.exec(bloc.nom)?.[1] ?? bloc.nom;
    res.push(symbole);
  }
  return res;
}

// ------------------------------------------------------------------ Grues réglables

/** Longueurs de flèche disponibles d'un modèle de grue ('tour' ou 'auto'), triées. */
export function flechesDisponibles(bibliotheque, modele) {
  return [...new Set(bibliotheque.filter((s) => s.modele === modele && Number.isFinite(s.fleche)).map((s) => s.fleche))].sort((a, b) => a - b);
}

/** Châssis disponibles (« 3.80 », « 4.50 »…), sans doublon. */
export function chassisDisponibles(bibliotheque) {
  return [...new Set(bibliotheque.filter((s) => s.chassis).map((s) => s.chassis.replace(/\(\d+\)$/, '')))].sort((a, b) => Number(a) - Number(b));
}

/** Symbole de la grue la plus proche de la flèche voulue (m) pour ce modèle. */
export function symboleGrue(bibliotheque, modele, fleche) {
  const choix = bibliotheque.filter((s) => s.modele === modele && Number.isFinite(s.fleche));
  if (!choix.length) return null;
  return choix.reduce((m, s) => (Math.abs(s.fleche - fleche) < Math.abs(m.fleche - fleche) ? s : m));
}

/** Symbole du châssis choisi (ou null pour « sans châssis »). */
export const symboleChassis = (bibliotheque, chassis) => (chassis && chassis !== 'aucun' ? bibliotheque.find((s) => s.chassis === chassis) ?? null : null);

// ------------------------------------------------------------------ Grue à longueur libre (0.290.0, demande du 23.11)

export const FLECHE_MIN = 10; // m
export const FLECHE_MAX = 90; // m
export const CHASSIS_MIN = 2; // m
export const CHASSIS_MAX = 12; // m
const DEBUT_FLECHE = 2; // m : au-delà de x = 2 m (la tour et la contre-flèche restent telles quelles), la flèche s'allonge
const arrondi3 = (v) => Math.round(v * 1000) / 1000;
const texteM = (v) => `${String(Math.round(v * 100) / 100).replace(/\.?0+$/, '')}m`;

/** Côté du châssis (m) lu dans « 4.50 », « 4.5 » ou un nombre ; null pour « aucun ». */
export function coteChassis(chassis) {
  if (chassis == null || chassis === 'aucun' || chassis === '') return null;
  const v = Number(String(chassis).replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.min(CHASSIS_MAX, Math.max(CHASSIS_MIN, v)) : null;
}

/**
 * Grue pour une flèche de longueur libre (m) : le bloc le plus proche, flèche allongée ou raccourcie au-delà de la tour
 * (x > 2 m, la tour et la contre-flèche ne bougent pas) ; rayon d'action refait : cercle principal à la longueur de la
 * flèche, cercles gris tous les 5 m dès 20 m, avec leurs cotes. Renvoie { primitives, rayon, fleche, boite } ou null.
 */
const memoire = new Map(); // calculs gardés (dessin à chaque image) : clé → résultat
function garder(cle, calcul) {
  if (!memoire.has(cle)) {
    if (memoire.size > 200) memoire.clear();
    memoire.set(cle, calcul());
  }
  return memoire.get(cle);
}

export function grueLibre(bibliotheque, modele, fleche) {
  const base = symboleGrue(bibliotheque, modele, fleche);
  if (!base) return null;
  const L = Math.min(FLECHE_MAX, Math.max(FLECHE_MIN, Number(fleche) || base.fleche));
  return garder(`g|${base.cle}|${L}`, () => calculerGrue(base, L, modele));
}

function calculerGrue(base, L, modele) {
  const k = L / base.fleche;
  const f = (x, y) => [arrondi3(x > DEBUT_FLECHE ? DEBUT_FLECHE + (x - DEBUT_FLECHE) * ((L - DEBUT_FLECHE) / (base.fleche - DEBUT_FLECHE)) : x), y];
  const primitives = Math.abs(k - 1) < 1e-9 ? base.primitives : transformerPrimitives(base.primitives, f).map((p) => (p.g === 't' ? { ...p, t: p.t.replace(/\d+(\.\d+)?\s*m\b/i, texteM(L)) } : p));
  const rayon = [{ g: 'c', k: ARDOISE, x: 0, y: 0, r: L }, { g: 't', k: '#92400e', x: L, y: -1.2, h: 0.9, a: 90, t: texteM(L), ah: 1, av: 2 }];
  for (let r = 20; r < L - 2; r += 5) {
    rayon.push({ g: 'c', k: '#8a9198', x: 0, y: 0, r }, { g: 't', k: '#92400e', x: r, y: -1.2, h: 0.9, a: 90, t: texteM(r), ah: 1, av: 2 });
  }
  const b = bornesPrimitives(primitives);
  return { primitives, rayon, fleche: L, boite: b ? [b.xMin, b.yMin, b.xMax, b.yMax] : base.boite, modele, nom: base.nom };
}

/**
 * Châssis d'un côté libre (m) : le châssis de la bibliothèque le plus proche, mis à l'échelle (nominal : le nombre de son
 * nom, « Chassis Grue 4.50 » = 4,50 m), avec sa cote (côté écrit sous le châssis et à gauche, traits de cote).
 * Renvoie { primitives, cote } ou null (sans châssis).
 */
export function chassisLibre(bibliotheque, chassis) {
  const c = coteChassis(chassis);
  if (!c) return null;
  const liste = bibliotheque.filter((s) => s.chassis && Number.isFinite(Number(s.chassis.replace(/\(\d+\)$/, ''))));
  if (!liste.length) return null;
  const nominal = (s) => Number(s.chassis.replace(/\(\d+\)$/, ''));
  const base = liste.reduce((m, s) => (Math.abs(nominal(s) - c) < Math.abs(nominal(m) - c) ? s : m));
  return garder(`c|${base.cle}|${c}`, () => calculerChassis(base, c, c / nominal(base)));
}

function calculerChassis(base, c, k) {
  const prims = Math.abs(k - 1) < 1e-9 ? base.primitives : transformerPrimitives(base.primitives, (x, y) => [arrondi3(x * k), arrondi3(y * k)]);
  return { primitives: [...prims, ...coteDuChassis(c, bornesPrimitives(prims))], cote: c };
}

/** Cote d'un châssis carré de côté c (m) : traits de cote sous le châssis et à sa gauche, avec « 4.50 m » écrit. */
export function coteDuChassis(c, b) {
  const h = Math.max(0.3, c * 0.08); // hauteur du texte (m)
  const d = Math.max(0.6, c * 0.15); // écart entre le châssis et la ligne de cote
  const y = (b?.yMin ?? -c / 2) - d;
  const x = (b?.xMin ?? -c / 2) - d;
  const t = c / 2;
  const tic = h * 0.5;
  const k = '#0f172a';
  const texte = `${c.toFixed(2)} m`;
  return [
    { g: 'l', k, p: [-t, y, t, y], f: false, mat: 'trait' },
    { g: 'l', k, p: [-t - tic, y - tic, -t + tic, y + tic], f: false, mat: 'trait' },
    { g: 'l', k, p: [t - tic, y - tic, t + tic, y + tic], f: false, mat: 'trait' },
    { g: 'l', k, p: [-t, y + tic * 2, -t, y - tic], f: false, mat: 'trait' },
    { g: 'l', k, p: [t, y + tic * 2, t, y - tic], f: false, mat: 'trait' },
    { g: 't', k, x: 0, y: y - h * 0.9, h, a: 0, t: texte, ah: 1, av: 2 },
    { g: 'l', k, p: [x, -t, x, t], f: false, mat: 'trait' },
    { g: 'l', k, p: [x - tic, -t - tic, x + tic, -t + tic], f: false, mat: 'trait' },
    { g: 'l', k, p: [x - tic, t - tic, x + tic, t + tic], f: false, mat: 'trait' },
    { g: 't', k, x: x - h * 0.9, y: 0, h, a: 90, t: texte, ah: 1, av: 2 },
  ];
}

// ------------------------------------------------------------------ Base-vie à étage

// Conteneur de la base-vie (bloc « Base Vie Contenair », 6,04 × 2,47 m) et escalier « Base vie Etage » (palier + volée
// en L, 3,8 × 3,25 m) : les deux blocs ont leur point de base au coin du conteneur.
export const CLE_CONTENEUR = 'base:Base Vie Contenair';
export const CLE_ESCALIER = 'base:Base vie Etage';
export const POSES_ETAGE = [
  'Coin bas gauche · le long du grand côté', 'Coin bas gauche · le long du petit côté',
  'Coin bas droit · le long du grand côté', 'Coin bas droit · le long du petit côté',
  'Coin haut droit · le long du grand côté', 'Coin haut droit · le long du petit côté',
  'Coin haut gauche · le long du grand côté', 'Coin haut gauche · le long du petit côté',
];
export const DECALAGE_ETAGE = 0.25; // m : le conteneur du haut est un peu décalé (vers le haut à gauche)

/**
 * Transformation de l'escalier pour une pose (0 à 7) : 4 coins × 2 sens de montée (volée le long du grand côté ou du
 * petit côté du conteneur). L, W : longueur et largeur du conteneur (repère du bloc, coin en bas à gauche en 0, 0).
 * Renvoie (x, y) → [x', y'] dans le repère du bloc.
 */
export function transformeEscalier(pose, L, W) {
  const coin = Math.floor(pose / 2) % 4; // 0 bas gauche, 1 bas droit, 2 haut droit, 3 haut gauche
  const courte = pose % 2 === 1;
  const miroirX = coin === 1 || coin === 2;
  const miroirY = coin === 2 || coin === 3;
  return (x, y) => {
    let [u, v] = courte ? [y, x] : [x, y]; // le long du petit côté : la volée suit l'axe y
    if (miroirX) u = L - u;
    if (miroirY) v = W - v;
    return [u, v];
  };
}

/** Primitives transformées point par point (miroirs compris) : listes plates, cercles et textes. */
export function transformerPrimitives(prims, f) {
  const plat = (l) => {
    const r = [];
    for (let i = 0; i + 1 < l.length; i += 2) r.push(...f(l[i], l[i + 1]));
    return r;
  };
  return prims.map((p) => {
    if (p.g === 'l') return { ...p, p: plat(p.p) };
    if (p.g === 'h') {
      const contours = p.p.map(plat);
      return { ...p, p: contours, b: boiteRemplissage(contours) };
    }
    const [x, y] = f(p.x, p.y);
    return { ...p, x, y };
  });
}

/**
 * Primitives d'une base-vie à étage (repère du symbole, centré comme le conteneur) : escalier posé (pose 0 à 7),
 * conteneur du rez, conteneur de l'étage un peu décalé (dessiné par-dessus, ombre plus marquée : etage = vrai).
 * Renvoie { dessous, rez, etage } (listes de primitives) ou null si un des blocs manque.
 */
export function primitivesEtage(bibliotheque, pose = 0) {
  const conteneur = bibliotheque.find((s) => s.cle === CLE_CONTENEUR);
  const escalier = bibliotheque.find((s) => s.cle === CLE_ESCALIER);
  if (!conteneur || !escalier) return null;
  const L = conteneur.largeur;
  const W = conteneur.hauteur;
  const [cx, cy] = conteneur.decalage; // conteneur : repère du bloc → repère centré
  const [ex, ey] = escalier.decalage;
  const f = transformeEscalier(pose, L, W);
  const dessous = transformerPrimitives(escalier.primitives, (x, y) => {
    const [u, v] = f(x - ex, y - ey); // revenir au repère du bloc (coin du conteneur)
    return [u + cx, v + cy];
  });
  const etage = deplacerPrimitives(conteneur.primitives, -DECALAGE_ETAGE, DECALAGE_ETAGE).map((p) => (p.b ? { ...p, b: [p.b[0] - DECALAGE_ETAGE, p.b[1] + DECALAGE_ETAGE, p.b[2] - DECALAGE_ETAGE, p.b[3] + DECALAGE_ETAGE] } : p));
  return { dessous, rez: conteneur.primitives, etage };
}

// ------------------------------------------------------------------ Pose

/** Échelle d'un symbole posé (0.292.0, ×1 = taille réelle) ; une grue se règle par sa flèche, pas par l'échelle. */
export const echelleDeLObjet = (objet) => (objet.type === 'grue' ? 1 : Math.min(10, Math.max(0.1, Number(objet.echelle) || 1)));

/** Rotation (degrés, sens trigonométrique), échelle et point [e, n] → transformation du repère du symbole au terrain. */
export function versTerrainSymbole(objet) {
  const a = ((objet.rotation ?? 0) * Math.PI) / 180;
  const k = echelleDeLObjet(objet);
  const [c, s] = [Math.cos(a) * k, Math.sin(a) * k];
  const [e, n] = objet.point;
  return (x, y) => [e + c * x - s * y, n + s * x + c * y];
}

/** Repère du terrain → repère du symbole (inverse de versTerrainSymbole). */
export function versSymbole(objet, [e, n]) {
  const a = ((objet.rotation ?? 0) * Math.PI) / 180;
  const k = echelleDeLObjet(objet);
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const [dx, dy] = [e - objet.point[0], n - objet.point[1]];
  return [(c * dx + s * dy) / k, (-s * dx + c * dy) / k];
}

/** Boîte [xMin, yMin, xMax, yMax] (m) d'un symbole dans son repère (centrée sur 0, 0 sauf les grues). */
export function boiteSymbole(symbole) {
  if (symbole?.boite) return symbole.boite;
  const [l, h] = [Math.max(0.6, symbole?.largeur ?? 2), Math.max(0.6, symbole?.hauteur ?? 2)];
  return [-l / 2, -h / 2, l / 2, h / 2];
}

/** Poignée de rotation d'un symbole posé : un point devant lui (le long de son axe x), 1 m au-delà de sa boîte. */
export function poigneeRotation(objet, symbole) {
  const b = boiteSymbole(symbole);
  return versTerrainSymbole(objet)(Math.max(b[2], 0.3) + 1 + 0.15 * (b[2] - b[0]), 0);
}

/** Rotation (degrés, arrondie au 0,5°) qui met l'axe du symbole vers le point p. */
export function rotationVers(objet, p) {
  const a = (Math.atan2(p[1] - objet.point[1], p[0] - objet.point[0]) * 180) / Math.PI;
  return Math.round((((a % 360) + 360) % 360) * 2) / 2;
}

/** Le point p est-il sur le symbole posé (dans sa boîte tournée, à tolerance m près) ? */
export function surLeSymbole(objet, symbole, p, tolerance = 0) {
  const [x, y] = versSymbole(objet, p);
  const [x0, y0, x1, y1] = boiteSymbole(symbole);
  return x >= x0 - tolerance && x <= x1 + tolerance && y >= y0 - tolerance && y <= y1 + tolerance;
}

/** Coins du symbole posé sur le terrain (pour les bornes et l'accroche). */
export function coinsSymbole(objet, symbole) {
  const [x0, y0, x1, y1] = boiteSymbole(symbole);
  const f = versTerrainSymbole(objet);
  return [f(x0, y0), f(x1, y0), f(x1, y1), f(x0, y1)];
}
