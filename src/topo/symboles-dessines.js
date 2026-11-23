// Plans de chantier (0.291.0, demandes du 23.11) : symboles dessinés dans Topo (pas tirés du DXF de l'utilisateur), dans
// le même style que les blocs modernisés (topo/symboles.js) : primitives en m, centrées, matériaux (lustre, ombres).
// Véhicules : devant en bas (y mini), comme les camions du DXF. Panneaux et signaux : vus de face (comme le panneau
// « Travaux » du DXF). Les formes des signaux suivent les signaux suisses de chantier (OSR), dessinées à la main : à
// valider par l'utilisateur.
import { ARDOISE, BLANC_BLOC, equipementsVehicule } from './symboles.js';
import { bornesPrimitives } from './blocs-dxf.js';

import {
  r3, plat, rectArrondi, cercle, triangle, tourner, boite, plein, motif, trait, piece, texte, epais, NOIR as NOIR_OUTILS,
} from './symboles-outils.js';
void r3; void plat; void boite; void NOIR_OUTILS; void tourner;
export { rectArrondi, cercle };

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
  res.push(...mot('CHANTIER', 0, 0.58, 0.13, '#ffffff'), ...mot('INTERDIT AU PUBLIC', 0, 0.44, 0.06, '#ffffff'));
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

/** Balise de guidage (0,5 × 1,2 m) : fond blanc, 7 bandes rouges en biais ; sens = +1 (montent vers la droite) ou −1. */
function balise(sens) {
  const res = [...piece('#f8fafc', 'blanc', rectArrondi(-0.25, -0.6, 0.25, 0.6))];
  for (let i = -3; i <= 3; i++) {
    const c = i * 0.3;
    const bande = [[-0.25, c - 0.1], [-0.25, c + 0.06], [0.25, c + 0.3], [0.25, c + 0.14]].map(([x, y]) => [x * sens, Math.max(-0.6, Math.min(0.6, y))]);
    res.push(plein(ROUGE, 'peinture', bande));
  }
  res.push(trait(rectArrondi(-0.25, -0.6, 0.25, 0.6), true));
  return res;
}

/** Chiffre « 0 », « 3 » ou « 5 » dessiné en traits épais (pour les panneaux : pas de texte sur plaque), centré, hauteur h. */
function chiffre(c, cx, cy, h, k) {
  const w = h * 0.52;
  const e = h * 0.17;
  const P = (pts) => pts.map(([x, y]) => [cx + x * w, cy + y * h]);
  if (c === '0') {
    const ext = rectArrondi(cx - w / 2 - e / 2, cy - h / 2, cx + w / 2 + e / 2, cy + h / 2, e * 1.1);
    const inte = rectArrondi(cx - w / 2 + e / 2, cy - h / 2 + e, cx + w / 2 - e / 2, cy + h / 2 - e, e * 0.4);
    return [plein(k, 'trait', ext, inte)];
  }
  const lignes = {
    3: [[[-0.5, 0.5], [0.5, 0.5], [0.5, 0], [-0.1, 0]], [[0.5, 0], [0.5, -0.5], [-0.5, -0.5]]],
    5: [[[0.5, 0.5], [-0.5, 0.5], [-0.5, 0.02], [0.5, 0.02], [0.5, -0.5], [-0.5, -0.5]]],
  }[c] ?? [];
  return lignes.map((l) => plein(k, 'trait', epais(P(l), e)));
}
/** Nombre de 1 à 3 chiffres parmi 0, 3 et 5 (vitesses 30 et 50). */
const nombre = (txt, cx, cy, h, k) => [...txt].flatMap((c, i, a) => chiffre(c, cx + (i - (a.length - 1) / 2) * h * 0.78, cy, h, k));
/** Petit mot en lettres capitales (rectangles) : seulement pour les panneaux, qui n'ont pas de plaque ; ici trait épais simplifié. */
function mot(t, x, y, h, k) {
  // Bande de la largeur du mot (le texte exact est écrit par le plan sur plaque : ici seulement un repère graphique).
  const l = Math.min(1.0, [...t].length * h * 0.55);
  return [plein(k, 'blanc', rectArrondi(x - l / 2, y - h * 0.32, x + l / 2, y + h * 0.32, h * 0.1))];
}

const SIGNAUX = [
  ['Signal Chaussée rétrécie', () => triangleDanger(() => [
    plein(NOIR, 'trait', [[-0.17, -0.16], [-0.12, -0.16], [-0.06, 0.02], [-0.06, 0.18], [-0.1, 0.18], [-0.1, 0.03]]),
    plein(NOIR, 'trait', [[0.17, -0.16], [0.12, -0.16], [0.06, 0.02], [0.06, 0.18], [0.1, 0.18], [0.1, 0.03]]),
  ])],
  ['Signal Signaux lumineux', () => triangleDanger(() => [
    plein(NOIR, 'trait', rectArrondi(-0.08, -0.17, 0.08, 0.2, 0.03)),
    plein('#e03131', 'phare', cercle(0, 0.11, 0.045, 14)), plein('#f59f00', 'phare', cercle(0, 0.01, 0.045, 14)), plein('#2f9e44', 'phare', cercle(0, -0.09, 0.045, 14)),
  ])],
  ['Signal Vitesse maximale 30', () => rondInterdiction(() => nombre('30', 0, 0, 0.36, NOIR))],
  ['Signal Vitesse maximale 50', () => rondInterdiction(() => nombre('50', 0, 0, 0.36, NOIR))],
  ['Signal Interdiction de dépasser', () => rondInterdiction(() => [...voiture(-0.12, ROUGE), ...voiture(0.12, NOIR)])],
  ['Signal Circulation interdite', () => rondInterdiction(() => [])],
  ['Signal Accès interdit', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(ROUGE, 'peinture', cercle(0, 0, 0.45, 36)), plein('#f8fafc', 'blanc', rectArrondi(-0.3, -0.07, 0.3, 0.07))]],
  ['Signal Obstacle à contourner par la droite', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(BLEU, 'peinture', cercle(0, 0, 0.45, 36)), fleche(0.55, 0.12, -135, '#f8fafc')]],
  ['Signal Obstacle à contourner par la gauche', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.45)), ...piece(BLEU, 'peinture', cercle(0, 0, 0.45, 36)), fleche(0.55, 0.12, 135, '#f8fafc')]],
  // Circulation alternée : rond rouge (le trafic en sens inverse est prioritaire : sa grande flèche rouge descend) et carré
  // bleu (nous sommes prioritaires : notre grande flèche blanche monte), dans les 2 sens (flèche de notre côté à gauche / à droite).
  ['Signal Priorité au trafic en sens inverse – flèche noire à gauche', () => rondInterdiction(() => [{ ...fleche(0.34, 0.07, 0, NOIR, -0.12, 0.05), mat: 'trait' }, { ...fleche(0.54, 0.09, 180, ROUGE, 0.12, -0.02), mat: 'peinture' }])],
  ['Signal Priorité au trafic en sens inverse – flèche noire à droite', () => rondInterdiction(() => [{ ...fleche(0.34, 0.07, 0, NOIR, 0.12, 0.05), mat: 'trait' }, { ...fleche(0.54, 0.09, 180, ROUGE, -0.12, -0.02), mat: 'peinture' }])],
  ['Signal Priorité sur le trafic en sens inverse – flèche blanche à gauche', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.42)), ...piece(BLEU, 'peinture', rectArrondi(-0.42, -0.42, 0.42, 0.42, 0.04)), fleche(0.56, 0.1, 0, '#f8fafc', -0.12, 0.0), { ...fleche(0.34, 0.07, 180, ROUGE, 0.12, 0.05), mat: 'peinture' }]],
  ['Signal Priorité sur le trafic en sens inverse – flèche blanche à droite', () => [...piece('#8a9198', 'metal', rectArrondi(-0.03, -0.95, 0.03, -0.42)), ...piece(BLEU, 'peinture', rectArrondi(-0.42, -0.42, 0.42, 0.42, 0.04)), fleche(0.56, 0.1, 0, '#f8fafc', 0.12, 0.0), { ...fleche(0.34, 0.07, 180, ROUGE, -0.12, 0.05), mat: 'peinture' }]],
  ['Barrière suisse 2 lattes rouge et blanc', () => barriere2Lattes()],
  // Balise de guidage : bandes rouges et blanches en biais, dans les 2 sens.
  ['Balise de guidage – bandes montant vers la droite', () => balise(1)],
  ['Balise de guidage – bandes montant vers la gauche', () => balise(-1)],
];

/** Barrière suisse à 2 lattes rouges et blanches (vue de face, 2,0 m) sur deux pieds. */
function barriere2Lattes() {
  const res = [...piece('#8a9198', 'metal', rectArrondi(-0.95, -0.35, -0.85, 0.35)), ...piece('#8a9198', 'metal', rectArrondi(0.85, -0.35, 0.95, 0.35))];
  for (const y of [-0.15, 0.15]) {
    res.push(plein('#f8fafc', 'blanc', rectArrondi(-1.0, y - 0.07, 1.0, y + 0.07)));
    for (let k = 0; k < 8; k++) if (k % 2 === 0) res.push(plein('#d63a3a', 'peinture', rectArrondi(-1.0 + k * 0.25, y - 0.07, -1.0 + (k + 1) * 0.25, y + 0.07)));
    res.push(trait(rectArrondi(-1.0, y - 0.07, 1.0, y + 0.07), true));
  }
  return res;
}

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

/** Traits en tirets le long d'une polyligne (longueur du trait l, vide v, en m). */
function tirets(pts, l = 0.25, v = 0.2, k = '#475569') {
  const res = [];
  let cumul = 0;
  let trace = true;
  let restant = l;
  for (let i = 0; i + 1 < pts.length; i++) {
    let [x, y] = pts[i];
    const [x2, y2] = pts[i + 1];
    let d = Math.hypot(x2 - x, y2 - y);
    const [ux, uy] = [(x2 - x) / (d || 1), (y2 - y) / (d || 1)];
    while (d > 1e-9) {
      const pas = Math.min(restant, d);
      if (trace) res.push(trait([[x, y], [x + ux * pas, y + uy * pas]], false, k));
      x += ux * pas;
      y += uy * pas;
      d -= pas;
      restant -= pas;
      cumul += pas;
      if (restant < 1e-9) {
        trace = !trace;
        restant = trace ? l : v;
      }
    }
  }
  void cumul;
  return res;
}

/** Vantail de portail grillagé : cadre orange, maillage en croix tous les 0,5 m (longueur l le long de x, de x0 à x0 + l). */
function vantail(x0, l, y = 0) {
  const res = [...piece('#f2a20c', 'peinture', rectArrondi(x0, y - 0.07, x0 + l, y + 0.07, 0.02))];
  for (let x = x0 + 0.25; x < x0 + l - 0.1; x += 0.5) res.push(trait([[x - 0.25, y - 0.05], [x + 0.25, y + 0.05]], false, '#7a4b00'), trait([[x - 0.25, y + 0.05], [x + 0.25, y - 0.05]], false, '#7a4b00'));
  return res;
}

/**
 * Portail de chantier à 2 vantaux (5 m) : poteaux, vantaux fermés (orange grillagé), zone balayée à l'ouverture (secteur
 * jaune clair, 90° vers l'intérieur) avec les vantaux ouverts en tirets. Centré sur l'ouverture, intérieur du chantier en haut.
 */
export function portail(largeur = 5) {
  const d = largeur / 2;
  const R = d - 0.2;
  const res = [];
  for (const s of [-1, 1]) {
    const secteur = [[s * d, 0], ...Array.from({ length: 13 }, (_, i) => {
      const a = ((s < 0 ? 0 : 180) + (s < 0 ? 90 : -90) * (i / 12)) * (Math.PI / 180);
      return [s * d + R * Math.cos(a), R * Math.sin(a)];
    })];
    res.push(motif('#fde68a', secteur));
    res.push(...tirets(secteur.slice(1), 0.22, 0.16, '#a16207'));
    res.push(...tirets([[s * d, 0.12], [s * d, R]], 0.25, 0.18, '#a16207'));
    res.push(...vantail(s < 0 ? -d + 0.1 : d - 0.1 - R, R));
    res.push(...piece('#3a3f45', 'metal', rectArrondi(s * d - 0.15, -0.15, s * d + 0.15, 0.15, 0.02)), plein('#cbd5e1', 'metal', cercle(s * d, 0, 0.05, 8)));
  }
  res.push(trait([[-d - 0.8, -0.05], [-d - 0.15, -0.05]], false, '#475569'), trait([[d + 0.15, -0.05], [d + 0.8, -0.05]], false, '#475569'));
  return res;
}

/** Portail coulissant (4 m) : vantail fermé dans l'ouverture, sa position ouverte en tirets derrière la clôture, flèche. */
export function portailCoulissant(largeur = 4) {
  const d = largeur / 2;
  const res = [];
  res.push(motif('#fde68a', rectArrondi(d, 0.12, d + largeur, 0.5, 0.02)));
  res.push(...tirets(rectArrondi(d, 0.12, d + largeur, 0.5, 0.02).concat([[d, 0.12]]), 0.22, 0.16, '#a16207'));
  res.push(...vantail(-d, largeur));
  res.push(plein('#a16207', 'peinture', [[d + 0.3, 0.31], [d + 1.2, 0.31], [d + 1.2, 0.4], [d + 1.8, 0.28], [d + 1.2, 0.16], [d + 1.2, 0.25], [d + 0.3, 0.25]]));
  for (const x of [-d - 0.1, d + 0.1]) res.push(...piece('#3a3f45', 'metal', rectArrondi(x - 0.15, -0.15, x + 0.15, 0.15, 0.02)));
  res.push(trait([[-d - 0.9, -0.05], [-d - 0.25, -0.05]], false, '#475569'), trait([[d + 0.25, -0.05], [d + largeur + 0.9, -0.05]], false, '#475569'));
  res.push(trait([[-d, 0.3], [d + largeur, 0.3]], false, '#94a3b8'));
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
    { nom: 'WC homme / femme', categorie: 'Base-vie', primitives: wcHommeFemme() },
    { nom: 'Panneau Chantier interdit au public', categorie: 'Sécurité', primitives: panneauInterditPublic() },
    { nom: 'Casque obligatoire', categorie: 'Sécurité', primitives: signalObligation(casque) },
    { nom: 'Chaussures de sécurité obligatoires', categorie: 'Sécurité', primitives: signalObligation(chaussure) },
    { nom: 'Feu de chantier', categorie: 'Signalisation', primitives: feuChantier() },
    ...SIGNAUX.map(([nom, f]) => ({ nom, categorie: 'Signalisation', primitives: f() })),
  ];
}

export { BLANC_BLOC };
