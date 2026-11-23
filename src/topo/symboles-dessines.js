// Plans de chantier (0.291.0, demandes du 23.11) : symboles dessinés dans Topo (pas tirés du DXF de l'utilisateur), dans
// le même style que les blocs modernisés (topo/symboles.js) : primitives en m, centrées, matériaux (lustre, ombres).
// Véhicules : devant en bas (y mini), comme les camions du DXF. Panneaux et signaux : vus de face (comme le panneau
// « Travaux » du DXF). Les formes des signaux suivent les signaux suisses de chantier (OSR), dessinées à la main : à
// valider par l'utilisateur.
import { ARDOISE, BLANC_BLOC, equipementsVehicule } from './symboles.js';
import { bornesPrimitives } from './blocs-dxf.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const plat = (pts) => pts.flatMap(([x, y]) => [r3(x), r3(y)]);

// ------------------------------------------------------------------ Petites formes (listes de points [x, y])

/** Rectangle [x0, y0] – [x1, y1], coins arrondis de rayon r (m). */
export function rectArrondi(x0, y0, x1, y1, r = 0, n = 4) {
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
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
/** Triangle équilatéral pointe en haut, centré en (cx, cy), de côté c. */
const triangle = (cx, cy, c) => {
  const h = (c * Math.sqrt(3)) / 2;
  return [[cx - c / 2, cy - h / 3], [cx + c / 2, cy - h / 3], [cx, cy + (2 * h) / 3]];
};
/** Points tournés de a degrés autour de (cx, cy). */
const tourner = (pts, a, cx = 0, cy = 0) => {
  const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};

// ------------------------------------------------------------------ Primitives

const boite = (contours) => {
  const b = bornesPrimitives([{ g: 'h', p: contours }]);
  return [b.xMin, b.yMin, b.xMax, b.yMax].map(r3);
};
/** Remplissage d'un ou plusieurs contours (le 2e et les suivants = trous), matériau mat. */
const plein = (k, mat, ...contours) => {
  const p = contours.map(plat);
  return { g: 'h', k, mat, p, b: boite(p), m: false };
};
const trait = (pts, ferme = false, k = ARDOISE) => ({ g: 'l', k, p: plat(pts), f: ferme, mat: 'trait' });
/** Pièce : remplissage + contour fin. */
const piece = (k, mat, pts, kTrait = ARDOISE) => [plein(k, mat, pts), trait(pts, true, kTrait)];
const texte = (t, x, y, h, { k = '#1e293b', a = 0, pl = false } = {}) => ({ g: 't', k, x: r3(x), y: r3(y), h, a, t, ah: 1, av: 2, ...(pl ? { pl: true } : {}) });
const pneu = (x0, y0, x1, y1) => piece('#2b2f33', 'caoutchouc', rectArrondi(x0, y0, x1, y1, Math.min(x1 - x0, y1 - y0) * 0.25));

// ------------------------------------------------------------------ Camions

/**
 * Camion (devant en bas) : cabine, roues, corps (fonction qui reçoit la boîte du plateau) ; phares, feux et rétroviseurs
 * comme les camions du DXF. L : longueur (m), W : largeur (m), couleurCabine, essieux : positions y des essieux arrière.
 */
function camion({ L = 9, W = 2.5, couleurCabine = '#eef1f4', essieux = [1.6, 2.9], corps }) {
  const y0 = -L / 2;
  const yc = y0 + 1.9; // fin de la cabine
  const prims = [];
  // Roues (sous la carrosserie, dépassent un peu).
  for (const y of [y0 + 1.0, ...essieux]) {
    prims.push(...pneu(-W / 2 - 0.06, y - 0.5, -W / 2 + 0.35, y + 0.5), ...pneu(W / 2 - 0.35, y - 0.5, W / 2 + 0.06, y + 0.5));
  }
  prims.push(...piece('#5f666d', 'metal', rectArrondi(-W / 2 + 0.15, yc - 0.1, W / 2 - 0.15, L / 2 - 0.1, 0.05))); // châssis
  prims.push(...corps({ x0: -W / 2 + 0.05, y0: yc + 0.15, x1: W / 2 - 0.05, y1: L / 2 }));
  // Cabine : carrosserie, pare-brise, toit.
  prims.push(...piece(couleurCabine, 'peinture', rectArrondi(-W / 2, y0, W / 2, yc, 0.35)));
  prims.push(...piece('#9cc9e6', 'vitre', rectArrondi(-W / 2 + 0.18, y0 + 0.2, W / 2 - 0.18, y0 + 0.75, 0.15)));
  prims.push(...piece(couleurCabine, 'peinture', rectArrondi(-W / 2 + 0.15, y0 + 0.8, W / 2 - 0.15, yc - 0.1, 0.2)));
  return [...prims, ...equipementsVehicule('Camion', { xMin: -W / 2, yMin: y0, xMax: W / 2, yMax: L / 2 })];
}

/** Citerne (cylindre vu de dessus) avec ses cerclages et ses trous d'homme. */
function citerne(b, couleur, { bandes = '#8a9198', trous = 3 } = {}) {
  const res = [...piece(couleur, 'metal', rectArrondi(b.x0, b.y0, b.x1, b.y1, (b.x1 - b.x0) * 0.42, 6))];
  const n = Math.max(2, Math.round((b.y1 - b.y0) / 1.3));
  for (let i = 1; i < n; i++) {
    const y = b.y0 + ((b.y1 - b.y0) * i) / n;
    res.push(trait([[b.x0 + 0.05, y], [b.x1 - 0.05, y]], false, bandes));
  }
  for (let i = 0; i < trous; i++) {
    const y = b.y0 + ((b.y1 - b.y0) * (i + 0.5)) / trous;
    res.push(...piece('#aeb4ba', 'metal', cercle(0, y, 0.28, 18)), trait(cercle(0, y, 0.16, 14), true));
  }
  res.push(trait([[0, b.y0 + 0.3], [0, b.y1 - 0.3]], false, '#5f666d')); // passerelle
  return res;
}

function camionCiterne() {
  return [...camion({ L: 9, corps: (b) => citerne(b, '#c3c8cd') }), texte('CITERNE', 0, 1.1, 0.42, { a: 90, pl: true })];
}

function camionCarburant() {
  const corps = (b) => [
    ...citerne(b, '#eef1f4', { bandes: '#aeb4ba' }),
    plein('#d63a3a', 'peinture', rectArrondi(b.x0 + 0.02, b.y0 + 0.4, b.x0 + 0.16, b.y1 - 0.4)),
    plein('#d63a3a', 'peinture', rectArrondi(b.x1 - 0.16, b.y0 + 0.4, b.x1 - 0.02, b.y1 - 0.4)),
    // Plaque orange de matières dangereuses à l'arrière.
    ...piece('#f08c00', 'peinture', rectArrondi(-0.2, b.y1 - 0.02, 0.2, b.y1 + 0.12)),
  ];
  return [...camion({ L: 9, corps }), ...piece('#f08c00', 'peinture', rectArrondi(-0.2, -4.62, 0.2, -4.5)), texte('CARBURANT', 0, 1.1, 0.4, { a: 90, pl: true })];
}

function camionBitume() {
  const corps = (b) => [
    ...citerne(b, '#3a3f45', { bandes: '#5f666d', trous: 2 }),
    // Rampe d'épandage à l'arrière, plus large que le camion, avec ses buses.
    ...piece('#8a9198', 'metal', rectArrondi(-1.7, b.y1 + 0.05, 1.7, b.y1 + 0.22, 0.04)),
    ...Array.from({ length: 12 }, (_, i) => plein('#2b2f33', 'caoutchouc', cercle(-1.55 + (3.1 * i) / 11, b.y1 + 0.135, 0.045, 8))),
  ];
  return [...camion({ L: 9, corps, couleurCabine: '#f2a20c' }), texte('BITUME', 0, 0.9, 0.42, { a: 90, pl: true, k: '#1e293b' })];
}

function camionBalai() {
  const L = 6.2;
  const W = 2.2;
  const corps = (b) => [
    ...piece('#f08c00', 'peinture', rectArrondi(b.x0, b.y0, b.x1, b.y1, 0.25)),
    plein('#f8fafc', 'blanc', rectArrondi(b.x0 + 0.1, b.y0 + 0.9, b.x1 - 0.1, b.y0 + 1.15)),
    plein('#f8fafc', 'blanc', rectArrondi(b.x0 + 0.1, b.y1 - 1.0, b.x1 - 0.1, b.y1 - 0.75)),
    ...piece('#5f666d', 'metal', rectArrondi(-0.6, b.y0 + 0.2, 0.6, b.y0 + 0.6, 0.1)), // bouche d'aspiration
  ];
  const brosse = (x) => {
    const y = -L / 2 + 0.25;
    const res = [...piece('#8a6a4b', 'gravats', cercle(x, y, 0.5, 24))];
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12;
      res.push(trait([[x + 0.12 * Math.cos(a), y + 0.12 * Math.sin(a)], [x + 0.48 * Math.cos(a), y + 0.48 * Math.sin(a)]], false, '#5c4630'));
    }
    return [...res, ...piece('#5f666d', 'metal', cercle(x, y, 0.12, 12))];
  };
  return [...camion({ L, W, essieux: [1.8], corps, couleurCabine: '#f8fafc' }), ...brosse(-1.05), ...brosse(1.05), texte('BALAYEUSE', 0, 1.3, 0.34, { a: 90, pl: true })];
}

/** Tracteur agricole et sa benne (d'après l'image de l'utilisateur : benne verte en haut, tracteur rouge en bas). */
function tracteurBenne() {
  const res = [];
  // Benne : caisse verte, rebord, 2 essieux.
  for (const y of [2.6, 3.7]) res.push(...pneu(-1.38, y - 0.42, -1.12, y + 0.42), ...pneu(1.12, y - 0.42, 1.38, y + 0.42));
  res.push(...piece('#2f9e55', 'peinture', rectArrondi(-1.2, 0.6, 1.2, 5.6, 0.06)));
  res.push(trait(rectArrondi(-1.08, 0.72, 1.08, 5.48, 0.04), true, '#e8f5e9'));
  // Timon en V.
  res.push(trait([[-0.75, 0.6], [0, -0.9], [0.75, 0.6]], false), trait([[0, -0.9], [0, -1.45]], false));
  res.push(...piece('#8a9198', 'metal', cercle(0, -1.45, 0.08, 10)));
  // Tracteur : grandes roues arrière, petites roues avant, capot, cabine.
  res.push(...pneu(-1.25, -2.85, -0.75, -1.65), ...pneu(0.75, -2.85, 1.25, -1.65));
  res.push(...pneu(-1.05, -5.35, -0.65, -4.65), ...pneu(0.65, -5.35, 1.05, -4.65));
  res.push(...piece('#d63a3a', 'peinture', rectArrondi(-0.75, -3.1, 0.75, -1.45, 0.15)));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.55, -3.05, 0.55, -1.75, 0.1))); // toit de la cabine
  res.push(...piece('#9cc9e6', 'vitre', rectArrondi(-0.5, -3.05, 0.5, -2.75, 0.08)));
  res.push(...piece('#d63a3a', 'peinture', rectArrondi(-0.42, -5.55, 0.42, -3.05, 0.3))); // capot
  res.push(trait([[-0.18, -5.3], [-0.18, -3.4]], false, '#a12a2a'), trait([[0.18, -5.3], [0.18, -3.4]], false, '#a12a2a'));
  res.push(...equipementsVehicule('Camion', { xMin: -0.6, yMin: -5.6, xMax: 0.6, yMax: -5.0 }).filter((p) => p.mat === 'phare'));
  return res;
}

/** Niveleuse (devant en bas) : roues avant, long châssis, lame en biais, cabine, moteur, roues arrière en tandem. */
function niveleuse() {
  const jaune = '#f2a20c';
  const res = [];
  for (const y of [1.6, 3.0]) res.push(...pneu(-1.3, y - 0.55, -0.85, y + 0.55), ...pneu(0.85, y - 0.55, 1.3, y + 0.55));
  res.push(...pneu(-1.2, -4.6, -0.8, -3.6), ...pneu(0.8, -4.6, 1.2, -3.6));
  res.push(...piece(jaune, 'peinture', rectArrondi(-0.95, -4.3, 0.95, -3.95, 0.08))); // essieu avant
  res.push(...piece(jaune, 'peinture', rectArrondi(-0.28, -4.4, 0.28, 0.9, 0.12))); // col de cygne
  res.push(...piece('#5f666d', 'metal', cercle(0, -1.2, 0.85, 28), cercle(0, -1.2, 0.6, 24)));
  res.push(...piece('#8a9198', 'metal', tourner(rectArrondi(-1.9, -1.32, 1.9, -1.08, 0.04), 18, 0, -1.2))); // lame
  res.push(...piece(jaune, 'peinture', rectArrondi(-1.0, 0.7, 1.0, 2.3, 0.25))); // cabine
  res.push(...piece('#9cc9e6', 'vitre', rectArrondi(-0.82, 0.85, 0.82, 1.35, 0.12)));
  res.push(...piece(jaune, 'peinture', rectArrondi(-1.0, 2.3, 1.0, 4.5, 0.2))); // moteur
  for (let i = 0; i < 5; i++) res.push(trait([[-0.7, 3.0 + i * 0.25], [0.7, 3.0 + i * 0.25]], false, '#b37a0a'));
  return res;
}

// ------------------------------------------------------------------ Base-vie

/** Pictogramme homme (repère du symbole), centré en (x, y), hauteur t. */
const homme = (x, y, t, k) => [
  plein(k, 'trait', cercle(x, y + t * 0.38, t * 0.11, 16)),
  plein(k, 'trait', [[x - t * 0.17, y + t * 0.22], [x + t * 0.17, y + t * 0.22], [x + t * 0.14, y - t * 0.12], [x + t * 0.08, y - t * 0.5], [x - t * 0.08, y - t * 0.5], [x - t * 0.14, y - t * 0.12]]),
];
/** Pictogramme femme (robe en trapèze). */
const femme = (x, y, t, k) => [
  plein(k, 'trait', cercle(x, y + t * 0.38, t * 0.11, 16)),
  plein(k, 'trait', [[x - t * 0.1, y + t * 0.22], [x + t * 0.1, y + t * 0.22], [x + t * 0.24, y - t * 0.22], [x - t * 0.24, y - t * 0.22]]),
  plein(k, 'trait', rectArrondi(x - t * 0.1, y - t * 0.5, x - t * 0.03, y - t * 0.22)),
  plein(k, 'trait', rectArrondi(x + t * 0.03, y - t * 0.5, x + t * 0.1, y - t * 0.22)),
];

function wcHommeFemme() {
  return [
    ...piece('#9cc9e6', 'vitre', rectArrondi(-0.6, -0.6, 0.6, 0.6, 0.1)),
    trait([[0, -0.45], [0, 0.32]], false),
    ...homme(-0.28, -0.08, 0.62, '#1e293b'),
    ...femme(0.28, -0.08, 0.62, '#b4234f'),
    texte('WC', 0, 0.44, 0.2, { pl: true }),
  ];
}

/** Logo du recyclage : 3 flèches qui tournent autour d'un triangle, centré en (x, y), taille t. */
function logoRecyclage(x, y, t, k = '#f8fafc') {
  const res = [];
  for (let i = 0; i < 3; i++) {
    const a = 90 + i * 120;
    // Une branche : bande le long d'un côté du triangle, terminée par une pointe.
    const corps = [[-0.42, -0.06], [0.18, -0.06], [0.18, 0.06], [-0.42, 0.06]].map(([u, v]) => [u * t, v * t]);
    const pointe = [[0.16, -0.16], [0.42, 0], [0.16, 0.16]].map(([u, v]) => [u * t, v * t]);
    const place = (pts) => tourner(pts.map(([u, v]) => [u, v - 0.3 * t]), a + 90).map(([u, v]) => [x + u, y + v]);
    res.push(plein(k, 'blanc', place(corps)), plein(k, 'blanc', place(pointe)));
  }
  return res;
}

function benneRecyclage() {
  return [
    ...piece('#2f9e55', 'peinture', [[-1.0, -2.0], [1.0, -2.0], [1.0, 2.0], [-1.0, 2.0]]),
    plein('#258a49', 'peinture', [[-0.85, -1.85], [0.85, -1.85], [0.85, 1.85], [-0.85, 1.85]]),
    trait([[-1.0, -2.0], [-0.85, -1.85]], false), trait([[1.0, -2.0], [0.85, -1.85]], false),
    trait([[1.0, 2.0], [0.85, 1.85]], false), trait([[-1.0, 2.0], [-0.85, 1.85]], false),
    ...logoRecyclage(0, 0.35, 1.25),
    texte('RECYCLAGE', 0, -1.2, 0.26, { pl: true }),
  ];
}

// ------------------------------------------------------------------ Panneaux et signaux (vus de face)

const ROUGE = '#d42b2b';
const BLEU = '#1f5fae';
const NOIR = '#1b1f24';

/** Rond d'obligation bleu (casque, chaussures) avec son pictogramme blanc. */
function rondBleu(x, y, r, picto) {
  return [...piece(BLEU, 'peinture', cercle(x, y, r, 32)), ...picto(x, y, r)];
}
const casque = (x, y, r) => [
  plein('#f8fafc', 'blanc', [...Array.from({ length: 13 }, (_, i) => [x + r * 0.55 * Math.cos((Math.PI * i) / 12), y - r * 0.05 + r * 0.55 * Math.sin((Math.PI * i) / 12)])]),
  plein('#f8fafc', 'blanc', rectArrondi(x - r * 0.72, y - r * 0.2, x + r * 0.72, y - r * 0.06, r * 0.04)),
];
/** Chaussure de sécurité : tige montante, bout arrondi, semelle épaisse séparée. */
const chaussure = (x, y, r) => {
  const P = (pts) => pts.map(([u, v]) => [x + u * r, y + v * r]);
  const bout = Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI / 2 - (Math.PI / 2) * (i / 6);
    return [0.36 + 0.24 * Math.cos(a), -0.26 + 0.24 * Math.sin(a)];
  });
  return [
    plein('#f8fafc', 'blanc', P([[-0.34, 0.56], [0.02, 0.56], [0.06, 0.06], [0.22, -0.02], ...bout, [-0.36, -0.26]])),
    plein('#f8fafc', 'blanc', P([[-0.38, -0.33], [0.62, -0.33], [0.6, -0.44], [-0.38, -0.44]])),
    plein('#1f5fae', 'peinture', P([[-0.3, 0.42], [-0.02, 0.42], [-0.02, 0.36], [-0.3, 0.36]])),
  ];
};

function panneauInterditPublic() {
  const res = [...piece('#f8fafc', 'blanc', rectArrondi(-0.55, -0.75, 0.55, 0.75, 0.04)), ...piece(ROUGE, 'peinture', rectArrondi(-0.55, 0.38, 0.55, 0.75, 0.04))];
  res.push(texte('CHANTIER', 0, 0.62, 0.15, { k: '#ffffff' }), texte('INTERDIT AU PUBLIC', 0, 0.46, 0.085, { k: '#ffffff' }));
  // Interdiction aux piétons : rond rouge barré sur un piéton.
  res.push(plein(ROUGE, 'peinture', cercle(0, 0.05, 0.26, 32), cercle(0, 0.05, 0.21, 32)));
  res.push(...homme(0, 0.03, 0.34, NOIR));
  res.push(plein(ROUGE, 'peinture', tourner(rectArrondi(-0.24, 0.025, 0.24, 0.075), -45, 0, 0.05)));
  res.push(...rondBleu(-0.26, -0.48, 0.17, casque), ...rondBleu(0.26, -0.48, 0.17, chaussure));
  return res;
}

/** Triangle de danger (bord rouge, fond blanc) avec un pictogramme. */
function triangleDanger(picto) {
  const ext = triangle(0, 0, 1.0);
  const int = triangle(0, 0, 0.76);
  return [plein(ROUGE, 'peinture', rectArrondi(-0.02, -0.75, 0.02, -0.3)), ...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.9, 0.03, -0.29)), plein(ROUGE, 'peinture', ext, int), plein('#f8fafc', 'blanc', int), trait(ext, true), ...picto()];
}
/** Rond d'interdiction (bord rouge, fond blanc) avec un pictogramme. */
function rondInterdiction(picto, fond = '#f8fafc') {
  return [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), plein(ROUGE, 'peinture', cercle(0, 0, 0.45, 36), cercle(0, 0, 0.36, 36)), plein(fond, 'blanc', cercle(0, 0, 0.36, 36)), trait(cercle(0, 0, 0.45, 36), true), ...picto()];
}
/** Flèche (pointe vers le haut) de longueur l, épaisseur e, centrée, tournée de a degrés. */
const fleche = (l, e, a, k, dx = 0, dy = 0) => {
  const pts = [[-e / 2, -l / 2], [e / 2, -l / 2], [e / 2, l / 2 - e * 1.2], [e * 1.2, l / 2 - e * 1.2], [0, l / 2], [-e * 1.2, l / 2 - e * 1.2], [-e / 2, l / 2 - e * 1.2]];
  return plein(k, 'blanc', tourner(pts, a).map(([x, y]) => [x + dx, y + dy]));
};
const voiture = (x, k) => [plein(k, 'peinture', rectArrondi(x - 0.09, -0.15, x + 0.09, 0.15, 0.04)), plein('#f8fafc', 'blanc', rectArrondi(x - 0.06, 0.04, x + 0.06, 0.1, 0.01))];

const SIGNAUX = [
  ['Signal Chaussée rétrécie', () => triangleDanger(() => [
    plein(NOIR, 'trait', [[-0.17, -0.16], [-0.12, -0.16], [-0.06, 0.02], [-0.06, 0.18], [-0.1, 0.18], [-0.1, 0.03]]),
    plein(NOIR, 'trait', [[0.17, -0.16], [0.12, -0.16], [0.06, 0.02], [0.06, 0.18], [0.1, 0.18], [0.1, 0.03]]),
  ])],
  ['Signal Signaux lumineux', () => triangleDanger(() => [
    plein(NOIR, 'trait', rectArrondi(-0.08, -0.17, 0.08, 0.2, 0.03)),
    plein('#e03131', 'phare', cercle(0, 0.11, 0.045, 14)), plein('#f59f00', 'phare', cercle(0, 0.01, 0.045, 14)), plein('#2f9e44', 'phare', cercle(0, -0.09, 0.045, 14)),
  ])],
  ['Signal Vitesse maximale 30', () => rondInterdiction(() => [texte('30', 0, 0, 0.36, { k: NOIR })])],
  ['Signal Vitesse maximale 50', () => rondInterdiction(() => [texte('50', 0, 0, 0.36, { k: NOIR })])],
  ['Signal Interdiction de dépasser', () => rondInterdiction(() => [...voiture(-0.12, ROUGE), ...voiture(0.12, NOIR)])],
  ['Signal Circulation interdite', () => rondInterdiction(() => [])],
  ['Signal Accès interdit', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(ROUGE, 'peinture', cercle(0, 0, 0.45, 36)), plein('#f8fafc', 'blanc', rectArrondi(-0.3, -0.07, 0.3, 0.07))]],
  ['Signal Obstacle à contourner par la droite', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(BLEU, 'peinture', cercle(0, 0, 0.45, 36)), fleche(0.55, 0.12, -135, '#f8fafc')]],
  ['Signal Obstacle à contourner par la gauche', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(BLEU, 'peinture', cercle(0, 0, 0.45, 36)), fleche(0.55, 0.12, 135, '#f8fafc')]],
  ['Signal Priorité au trafic en sens inverse', () => rondInterdiction(() => [{ ...fleche(0.46, 0.08, 0, NOIR, -0.1), mat: 'trait' }, { ...fleche(0.46, 0.08, 180, ROUGE, 0.1), mat: 'peinture' }])],
  ['Signal Priorité sur le trafic en sens inverse', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.42)), ...piece(BLEU, 'peinture', rectArrondi(-0.42, -0.42, 0.42, 0.42, 0.04)), fleche(0.5, 0.09, 0, '#f8fafc', -0.11), { ...fleche(0.5, 0.09, 180, ROUGE, 0.11), mat: 'peinture' }]],
  ['Balise de guidage', () => {
    const res = [...piece('#f8fafc', 'blanc', rectArrondi(-0.25, -0.6, 0.25, 0.6))];
    for (let i = -3; i <= 3; i++) res.push(plein(ROUGE, 'peinture', [[-0.25, i * 0.3 - 0.06], [-0.25, i * 0.3 + 0.1], [0.25, i * 0.3 + 0.34], [0.25, i * 0.3 + 0.18]].filter(Boolean).map(([x, y]) => [x, Math.max(-0.6, Math.min(0.6, y))])));
    res.push(trait(rectArrondi(-0.25, -0.6, 0.25, 0.6), true));
    return res;
  }],
];

/** Feu de chantier (vu de face) : boîtier noir à 3 feux sur un pied, batterie au sol. */
function feuChantier() {
  return [
    ...piece('#5f666d', 'metal', rectArrondi(-0.45, -1.05, 0.45, -0.75, 0.04)),
    ...piece('#8a9198', 'metal', rectArrondi(-0.04, -0.75, 0.04, -0.15)),
    ...piece(NOIR, 'caoutchouc', rectArrondi(-0.22, -0.15, 0.22, 1.05, 0.06)),
    ...[['#e03131', 0.78], ['#f59f00', 0.45], ['#2f9e44', 0.12]].flatMap(([k, y]) => [plein('#3a3f45', 'metal', cercle(0, y, 0.15, 20)), plein(k, 'phare', cercle(0, y, 0.12, 20))]),
  ];
}

/** Casque / chaussures obligatoires (ronds bleus seuls, sur un pied). */
const signalObligation = (picto) => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.9, 0.03, -0.38)), ...rondBleu(0, 0, 0.4, picto)];

// ------------------------------------------------------------------ Portail et trilattes (remplacent ceux du DXF)

/** Portail de chantier à 2 vantaux (5 m) : poteaux, vantaux grillagés, sens d'ouverture. */
export function portail(largeur = 5) {
  const d = largeur / 2;
  const res = [];
  for (const s of [-1, 1]) {
    const arc = Array.from({ length: 13 }, (_, i) => {
      const a = (Math.PI / 2) * (i / 12);
      return [s * (d - (d - 0.12) * Math.cos(a)), (d - 0.12) * Math.sin(a)];
    });
    res.push(trait(arc, false, '#db7e20'));
    res.push(...piece('#aeb4ba', 'metal', rectArrondi(s > 0 ? 0.04 : -d + 0.12, -0.06, s > 0 ? d - 0.12 : -0.04, 0.06)));
    for (let x = 0.3; x < d - 0.2; x += 0.3) res.push(trait([[s * x, -0.05], [s * x, 0.05]], false, '#5f666d'));
    res.push(...piece('#3a3f45', 'metal', rectArrondi(s * d - 0.12, -0.12, s * d + 0.12, 0.12)));
  }
  res.push(texte('Portail', 0, -0.4, 0.3, { pl: true }));
  return res;
}

/** Trilattes (vues de face, comme sur la photo de l'utilisateur) : 3 lattes rouges et blanches sur un cadre. */
export function trilattes() {
  const res = [...piece('#8a9198', 'metal', rectArrondi(-0.5, -1.55, 0.5, -1.45)), ...piece('#8a9198', 'metal', rectArrondi(-0.44, -1.2, 0.44, -1.14))];
  [-0.31, 0, 0.31].forEach((x, i) => {
    const y0 = -1.45;
    const y1 = 1.5;
    res.push(plein('#f8fafc', 'blanc', rectArrondi(x - 0.075, y0, x + 0.075, y1)));
    for (let k = 0; k * 0.5 < y1 - y0; k++) {
      if ((k + i) % 2) continue;
      res.push(plein('#d63a3a', 'peinture', rectArrondi(x - 0.075, y0 + k * 0.5, x + 0.075, Math.min(y1, y0 + (k + 1) * 0.5))));
    }
    res.push(trait(rectArrondi(x - 0.075, y0, x + 0.075, y1), true));
  });
  return res;
}

// ------------------------------------------------------------------ Liste

/** Symboles dessinés : [{ nom, categorie, primitives }] (centrés et mis au format de la bibliothèque par symboles-retouches.js). */
export function symbolesDessines() {
  return [
    { nom: 'Tracteur + benne', categorie: 'Véhicules', primitives: tracteurBenne() },
    { nom: 'Camion citerne', categorie: 'Véhicules', primitives: camionCiterne() },
    { nom: 'Camion carburant', categorie: 'Véhicules', primitives: camionCarburant() },
    { nom: 'Camion balai', categorie: 'Véhicules', primitives: camionBalai() },
    { nom: 'Camion bitume', categorie: 'Véhicules', primitives: camionBitume() },
    { nom: 'Niveleuse', categorie: 'Engins', primitives: niveleuse() },
    { nom: 'WC homme / femme', categorie: 'Base-vie', primitives: wcHommeFemme() },
    { nom: 'Benne recyclage', categorie: 'Base-vie', primitives: benneRecyclage() },
    { nom: 'Panneau Chantier interdit au public', categorie: 'Sécurité', primitives: panneauInterditPublic() },
    { nom: 'Casque obligatoire', categorie: 'Sécurité', primitives: signalObligation(casque) },
    { nom: 'Chaussures de sécurité obligatoires', categorie: 'Sécurité', primitives: signalObligation(chaussure) },
    { nom: 'Feu de chantier', categorie: 'Signalisation', primitives: feuChantier() },
    ...SIGNAUX.map(([nom, f]) => ({ nom, categorie: 'Signalisation', primitives: f() })),
  ];
}

export { BLANC_BLOC };
