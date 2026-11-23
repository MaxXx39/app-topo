// Plans de chantier (0.292.0) : véhicules et engins dessinés dans Topo (devant en bas, y mini, comme les camions du DXF).
// Tracteur + benne et niveleuse refaits (roues à crampons, capot, cabine vitrée…), camions citerne / carburant (couleurs
// Perrin) / balai / bitume, pompe à béton (repliée, dépliée), camions grues de 4 tailles (repliés, dépliés, appuis sortis),
// nacelle, élévateur à ciseaux, compresseur, bétonnière. Les formes sont dessinées à la main : à valider.
import { equipementsVehicule } from './symboles.js';
import {
  rectArrondi, cercle, ellipse, tourner, epais, pointe, plein, trait, piece, texte, pneu, pneuCrante, deplacer,
  PERRIN_JAUNE, PERRIN_ORANGE, NOIR,
} from './symboles-outils.js';

const GRIS = '#5f666d';
const METAL = '#8a9198';
const CLAIR = '#d5d9dd';
const BLANC = '#eef1f4';
const VITRE = '#9cc9e6';

// ------------------------------------------------------------------ Camions

/**
 * Camion (devant en bas) : cabine, roues, corps (fonction qui reçoit la boîte du plateau) ; phares, feux et rétroviseurs
 * comme les camions du DXF. L : longueur (m), W : largeur (m), couleurCabine, essieux : positions y des essieux arrière.
 */
export function camion({ L = 9, W = 2.5, couleurCabine = BLANC, essieux = [1.6, 2.9], corps }) {
  const y0 = -L / 2;
  const yc = y0 + 1.9; // fin de la cabine
  const prims = [];
  for (const y of [y0 + 1.0, ...essieux]) {
    prims.push(...pneu(-W / 2 - 0.06, y - 0.5, -W / 2 + 0.35, y + 0.5), ...pneu(W / 2 - 0.35, y - 0.5, W / 2 + 0.06, y + 0.5));
  }
  prims.push(...piece(GRIS, 'metal', rectArrondi(-W / 2 + 0.15, yc - 0.1, W / 2 - 0.15, L / 2 - 0.1, 0.05))); // châssis
  prims.push(...corps({ x0: -W / 2 + 0.05, y0: yc + 0.15, x1: W / 2 - 0.05, y1: L / 2 }));
  prims.push(...piece(couleurCabine, 'peinture', rectArrondi(-W / 2, y0, W / 2, yc, 0.35)));
  prims.push(...piece(VITRE, 'vitre', rectArrondi(-W / 2 + 0.18, y0 + 0.2, W / 2 - 0.18, y0 + 0.75, 0.15)));
  prims.push(...piece(couleurCabine, 'peinture', rectArrondi(-W / 2 + 0.15, y0 + 0.8, W / 2 - 0.15, yc - 0.1, 0.2)));
  return [...prims, ...equipementsVehicule('Camion', { xMin: -W / 2, yMin: y0, xMax: W / 2, yMax: L / 2 })];
}

/** Citerne (cylindre vu de dessus) avec ses cerclages, ses trous d'homme et sa passerelle. */
function citerne(b, couleur, { bandes = METAL, trous = 3 } = {}) {
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
  res.push(trait([[0, b.y0 + 0.3], [0, b.y1 - 0.3]], false, GRIS));
  return res;
}


// ------------------------------------------------------------------ Pictos des camions (0.293.0 : un logo plutôt qu'un mot)

/** Pastille ronde blanche (rayon r) au centre (0, y) : fond des pictos. */
const pastille = (y, r) => [...piece('#f8fafc', 'blanc', cercle(0, y, r, 28), '#334155')];
/** Goutte (eau, carburant) : pointe en haut, couleur k, taille r. */
const goutte = (y, r, k) => {
  const pts = [[0, y + r * 1.15], ...Array.from({ length: 21 }, (_, i) => { const a = (-30 + (i * 240) / 20) * Math.PI / 180 - Math.PI / 2 + Math.PI; return [r * 0.72 * Math.sin(a + Math.PI) * -1, y - r * 0.2 + r * 0.72 * Math.cos(a + Math.PI) * -1]; })];
  return plein(k, 'peinture', pts);
};
/** Picto citerne : goutte d'eau bleue. */
const pictoCiterne = (y) => [...pastille(y, 0.62), goutte(y, 0.5, '#1d6fd1')];
/** Picto carburant : pompe à essence (pistolet) rouge sur la pastille. */
const pictoCarburant = (y) => [...pastille(y, 0.62),
  plein('#d63a3a', 'peinture', rectArrondi(-0.26, y - 0.34, 0.08, y + 0.34, 0.04)), plein('#f8fafc', 'blanc', rectArrondi(-0.18, y + 0.1, 0.0, y + 0.26, 0.02)),
  trait([[0.08, y + 0.2], [0.26, y + 0.2], [0.26, y - 0.1]], false, '#d63a3a'), plein('#334155', 'metal', rectArrondi(0.2, y - 0.2, 0.32, y - 0.08, 0.02)),
  plein('#d63a3a', 'peinture', rectArrondi(-0.34, y - 0.42, 0.16, y - 0.34))];
/** Picto balayeuse : balai (manche + brosse). */
const pictoBalai = (y) => [...pastille(y, 0.62),
  plein('#8a6a4b', 'gravats', epais([[0.3, y + 0.42], [-0.05, y - 0.05]], 0.07)),
  plein('#c98a2b', 'peinture', [[-0.34, y - 0.02], [0.2, y - 0.02], [0.28, y - 0.42], [-0.42, y - 0.42]]),
  ...[-0.28, -0.14, 0, 0.14].map((x) => trait([[x, y - 0.06], [x - 0.05, y - 0.4]], false, '#7a521a'))];
/** Picto bitume : flamme noire sur la pastille (bitume chaud) avec 2 traits de route. */
const pictoBitume = (y) => [...pastille(y, 0.62),
  plein('#f08c00', 'peinture', [[0, y + 0.45], [0.22, y + 0.12], [0.3, y - 0.18], [0.12, y - 0.38], [-0.12, y - 0.38], [-0.3, y - 0.18], [-0.2, y + 0.05], [-0.08, y + 0.15]]),
  plein('#3a3f45', 'caoutchouc', [[0, y + 0.1], [0.12, y - 0.12], [0.06, y - 0.3], [-0.06, y - 0.3], [-0.12, y - 0.12]])];

export const camionCiterne = () => [...camion({ L: 9, corps: (b) => citerne(b, '#c3c8cd') }), ...pictoCiterne(1.1)];

/** Camion carburant aux couleurs Perrin : cabine jaune, citerne orange comme la caisse des camions benne. */
export function camionCarburant() {
  const corps = (b) => [
    ...citerne(b, PERRIN_ORANGE, { bandes: '#334155' }),
    plein('#334155', 'peinture', rectArrondi(b.x0 + 0.02, b.y0 + 0.4, b.x0 + 0.14, b.y1 - 0.4)),
    plein('#334155', 'peinture', rectArrondi(b.x1 - 0.14, b.y0 + 0.4, b.x1 - 0.02, b.y1 - 0.4)),
    ...piece('#f8fafc', 'blanc', rectArrondi(-0.22, b.y1 - 0.06, 0.22, b.y1 + 0.1)),
  ];
  return [...camion({ L: 9, corps, couleurCabine: PERRIN_JAUNE }), ...pictoCarburant(1.1)];
}

export function camionBitume() {
  const corps = (b) => [
    ...citerne(b, '#3a3f45', { bandes: GRIS, trous: 2 }),
    ...piece(METAL, 'metal', rectArrondi(-1.7, b.y1 + 0.05, 1.7, b.y1 + 0.22, 0.04)),
    ...Array.from({ length: 12 }, (_, i) => plein('#2b2f33', 'caoutchouc', cercle(-1.55 + (3.1 * i) / 11, b.y1 + 0.135, 0.045, 8))),
  ];
  return [...camion({ L: 9, corps, couleurCabine: PERRIN_ORANGE }), ...pictoBitume(0.9)];
}

export function camionBalai() {
  const L = 6.2;
  const W = 2.2;
  const corps = (b) => [
    ...piece('#f08c00', 'peinture', rectArrondi(b.x0, b.y0, b.x1, b.y1, 0.25)),
    plein('#f8fafc', 'blanc', rectArrondi(b.x0 + 0.1, b.y0 + 0.9, b.x1 - 0.1, b.y0 + 1.15)),
    plein('#f8fafc', 'blanc', rectArrondi(b.x0 + 0.1, b.y1 - 1.0, b.x1 - 0.1, b.y1 - 0.75)),
    ...piece(GRIS, 'metal', rectArrondi(-0.6, b.y0 + 0.2, 0.6, b.y0 + 0.6, 0.1)),
  ];
  const brosse = (x) => {
    const y = -L / 2 + 0.25;
    const res = [...piece('#8a6a4b', 'gravats', cercle(x, y, 0.5, 24))];
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12;
      res.push(trait([[x + 0.12 * Math.cos(a), y + 0.12 * Math.sin(a)], [x + 0.48 * Math.cos(a), y + 0.48 * Math.sin(a)]], false, '#5c4630'));
    }
    return [...res, ...piece(GRIS, 'metal', cercle(x, y, 0.12, 12))];
  };
  return [...camion({ L, W, essieux: [1.8], corps, couleurCabine: BLANC }), ...brosse(-1.05), ...brosse(1.05), ...pictoBalai(1.3)];
}


// ------------------------------------------------------------------ Tracteur + benne

/** Tracteur agricole (rouge) et sa benne basculante (verte), d'après l'image de l'utilisateur : devant en bas. */
export function tracteurBenne() {
  const res = [];
  const ROUGE = '#c93a3a';
  const VERT = '#2f9e55';
  const wb = 1.15; // demi-largeur de la benne
  // --- Benne : roues, garde-boue, timon en V, caisse ondulée, rebord, vérin, hayon.
  for (const y of [3.9, 5.1]) {
    res.push(...pneu(-wb - 0.14, y - 0.46, -wb + 0.3, y + 0.46), ...pneu(wb - 0.3, y - 0.46, wb + 0.14, y + 0.46));
    res.push(trait([[-wb - 0.1, y - 0.1], [-wb + 0.26, y - 0.1]], false, '#6b7280'), trait([[wb - 0.26, y - 0.1], [wb + 0.1, y - 0.1]], false, '#6b7280'));
  }
  res.push(...piece(GRIS, 'metal', epais([[-0.6, 0.95], [-0.05, -0.85]], 0.1)), ...piece(GRIS, 'metal', epais([[0.6, 0.95], [0.05, -0.85]], 0.1)));
  res.push(...piece(METAL, 'metal', cercle(0, -0.95, 0.1, 12)));
  res.push(...piece('#27804a', 'peinture', rectArrondi(-wb - 0.16, 3.25, -wb + 0.36, 5.75, 0.1)), ...piece('#27804a', 'peinture', rectArrondi(wb - 0.36, 3.25, wb + 0.16, 5.75, 0.1)));
  res.push(...piece(VERT, 'peinture', rectArrondi(-wb, 0.9, wb, 6.0, 0.07)));
  res.push(...piece('#258a49', 'peinture', rectArrondi(-wb + 0.12, 1.02, wb - 0.12, 5.88, 0.04), '#1d6b3a'));
  for (let x = -wb + 0.36; x < wb - 0.2; x += 0.3) res.push(trait([[x, 1.1], [x, 5.8]], false, '#1d6b3a'));
  res.push(...piece(METAL, 'metal', rectArrondi(-0.1, 1.05, 0.1, 1.9, 0.04)));
  res.push(trait([[-wb + 0.12, 5.62], [wb - 0.12, 5.62]], false, '#e8f5e9'), ...piece(METAL, 'metal', cercle(-wb + 0.12, 5.88, 0.07, 8)), ...piece(METAL, 'metal', cercle(wb - 0.12, 5.88, 0.07, 8)));
  // --- Tracteur : attelage, grandes roues arrière à crampons, garde-boue, petites roues avant, capot, cabine.
  res.push(...piece(GRIS, 'metal', rectArrondi(-0.28, -1.5, 0.28, -0.85, 0.05)), ...piece(METAL, 'metal', cercle(0, -0.95, 0.08, 10)));
  res.push(...pneuCrante(-1.4, -3.05, -0.85, -1.45, { pas: 0.2, chevron: true }), ...pneuCrante(0.85, -3.05, 1.4, -1.45, { pas: 0.2, chevron: true }));
  res.push(...pneuCrante(-1.1, -5.2, -0.74, -4.15, { pas: 0.17 }), ...pneuCrante(0.74, -5.2, 1.1, -4.15, { pas: 0.17 }));
  res.push(trait([[-0.85, -4.65], [-0.5, -4.65]], false, '#4b5563'), trait([[0.5, -4.65], [0.85, -4.65]], false, '#4b5563'));
  res.push(...piece('#a82f2f', 'peinture', rectArrondi(-1.45, -2.95, -0.8, -1.5, 0.2)), ...piece('#a82f2f', 'peinture', rectArrondi(0.8, -2.95, 1.45, -1.5, 0.2)));
  res.push(...piece(ROUGE, 'peinture', rectArrondi(-0.55, -5.55, 0.55, -3.05, 0.28)));
  for (let y = -4.75; y < -3.3; y += 0.17) res.push(trait([[-0.3, y], [0.3, y]], false, '#8f2a2a'));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.36, -5.5, 0.36, -5.36, 0.05)));
  res.push(...piece('#f8fafc', 'blanc', rectArrondi(-0.62, -5.0, -0.5, -4.6, 0.04)), ...piece('#f8fafc', 'blanc', rectArrondi(0.5, -5.0, 0.62, -4.6, 0.04)));
  res.push(...piece(GRIS, 'metal', cercle(0.32, -3.7, 0.06, 10)));
  res.push(...piece(ROUGE, 'peinture', rectArrondi(-0.82, -3.12, 0.82, -1.4, 0.16)));
  res.push(...piece(VITRE, 'vitre', rectArrondi(-0.74, -3.06, 0.74, -2.78, 0.1)), ...piece(VITRE, 'vitre', rectArrondi(-0.74, -1.72, 0.74, -1.46, 0.1)));
  res.push(...piece(VITRE, 'vitre', rectArrondi(-0.8, -2.8, -0.68, -1.75, 0.04)), ...piece(VITRE, 'vitre', rectArrondi(0.68, -2.8, 0.8, -1.75, 0.04)));
  res.push(...piece(CLAIR, 'metal', rectArrondi(-0.66, -2.76, 0.66, -1.76, 0.1)));
  res.push(...piece(METAL, 'metal', rectArrondi(-0.25, -2.45, 0.25, -2.05, 0.08)));
  res.push(trait([[-0.82, -2.85], [-1.02, -2.9]], false, NOIR), trait([[0.82, -2.85], [1.02, -2.9]], false, NOIR));
  return res;
}

// ------------------------------------------------------------------ Niveleuse

/** Niveleuse (grader) : roues avant, col de cygne, cercle et lame en biais, cabine vitrée, capot, tandem arrière, défonceuse. */
export function niveleuse() {
  const J = '#f2a20c';
  const res = [];
  // Tandem arrière (sous le moteur) et roues avant.
  for (const s of [-1, 1]) {
    res.push(...piece(GRIS, 'metal', rectArrondi(s > 0 ? 0.95 : -1.55, 2.55, s > 0 ? 1.55 : -0.95, 4.95, 0.08)));
    res.push(...pneuCrante(s > 0 ? 1.0 : -1.62, 2.65, s > 0 ? 1.62 : -1.0, 3.75, { pas: 0.2 }), ...pneuCrante(s > 0 ? 1.0 : -1.62, 3.85, s > 0 ? 1.62 : -1.0, 4.95, { pas: 0.2 }));
    res.push(...pneuCrante(s > 0 ? 1.0 : -1.58, -4.95, s > 0 ? 1.58 : -1.0, -3.55, { pas: 0.2 }));
  }
  res.push(...piece(J, 'peinture', rectArrondi(-1.05, -4.45, 1.05, -4.05, 0.08)));
  res.push(...piece('#fff4cc', 'phare', cercle(-0.9, -4.55, 0.07, 10)), ...piece('#fff4cc', 'phare', cercle(0.9, -4.55, 0.07, 10)));
  // Châssis : col de cygne, caisse arrière.
  res.push(...piece(J, 'peinture', [[-0.3, -4.2], [0.3, -4.2], [0.34, 0.5], [0.95, 0.9], [0.95, 4.75], [-0.95, 4.75], [-0.95, 0.9], [-0.34, 0.5]]));
  // Bâti (A) et cercle, puis lame en biais.
  res.push(...piece('#d98a08', 'peinture', [[0, -3.7], [0.82, -1.62], [-0.82, -1.62]]));
  res.push(...piece(GRIS, 'metal', cercle(0, -1.2, 0.88, 32)), ...piece('#3a3f45', 'metal', cercle(0, -1.2, 0.62, 28)));
  for (let i = 0; i < 24; i++) {
    const a = (2 * Math.PI * i) / 24;
    res.push(trait([[0.62 * Math.cos(a), -1.2 + 0.62 * Math.sin(a)], [0.88 * Math.cos(a), -1.2 + 0.88 * Math.sin(a)]], false, '#2b2f33'));
  }
  res.push(...piece(J, 'peinture', rectArrondi(-0.35, -1.6, 0.35, -0.8, 0.1)));
  const lame = tourner(rectArrondi(-1.9, -1.34, 1.9, -1.06, 0.05), 24, 0, -1.2);
  res.push(...piece(METAL, 'metal', lame), trait(tourner([[-1.85, -1.3], [1.85, -1.3]], 24, 0, -1.2), false, '#d5d9dd'));
  res.push(...piece(GRIS, 'metal', tourner(rectArrondi(-1.95, -1.4, -1.8, -1.0, 0.02), 24, 0, -1.2)), ...piece(GRIS, 'metal', tourner(rectArrondi(1.8, -1.4, 1.95, -1.0, 0.02), 24, 0, -1.2)));
  // Cabine vitrée (toit clair), capot avec grilles, échappement.
  res.push(...piece(J, 'peinture', rectArrondi(-1.0, 0.15, 1.0, 2.2, 0.22)));
  res.push(...piece(VITRE, 'vitre', rectArrondi(-0.9, 0.25, 0.9, 2.1, 0.15)));
  res.push(...piece(J, 'peinture', rectArrondi(-0.82, 0.5, 0.82, 1.85, 0.12)), ...piece(CLAIR, 'metal', rectArrondi(-0.4, 0.95, 0.4, 1.45, 0.1)));
  res.push(...piece(J, 'peinture', rectArrondi(-0.95, 2.2, 0.95, 4.8, 0.2)));
  for (let y = 2.55; y < 4.4; y += 0.17) res.push(trait([[-0.62, y], [0.62, y]], false, '#b37a0a'));
  res.push(...piece(GRIS, 'metal', cercle(0.55, 2.4, 0.07, 10)), trait([[0.55, 2.4], [0.55, 2.0]], false, GRIS));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.5, 4.78, 0.5, 4.9, 0.03)));
  // Défonceuse à l'arrière.
  res.push(...piece(GRIS, 'metal', rectArrondi(-0.85, 4.95, 0.85, 5.2, 0.05)));
  for (const x of [-0.6, 0, 0.6]) res.push(...piece('#3a3f45', 'metal', [[x - 0.08, 5.2], [x + 0.08, 5.2], [x, 5.5]]));
  return res;
}

// ------------------------------------------------------------------ Appuis (camions grues, pompe)

/** Appui sorti : poutre horizontale à la hauteur y, de −demi à +demi, patins carrés aux bouts ; replié : petit tiroir. */
function appui(y, demi, ouvert, demiCorps) {
  if (!ouvert) {
    return [...piece(GRIS, 'metal', rectArrondi(-demiCorps - 0.28, y - 0.2, demiCorps + 0.28, y + 0.2, 0.05))];
  }
  return [
    ...piece(GRIS, 'metal', rectArrondi(-demi, y - 0.2, demi, y + 0.2, 0.04)),
    trait([[-demiCorps, y], [-demi + 0.5, y]], false, '#334155'),
    trait([[demiCorps, y], [demi - 0.5, y]], false, '#334155'),
    ...[-1, 1].flatMap((s) => [
      ...piece(CLAIR, 'metal', rectArrondi(s * demi - 0.65, y - 0.65, s * demi + 0.65, y + 0.65, 0.06)),
      trait([[s * demi - 0.65, y - 0.65], [s * demi + 0.65, y + 0.65]], false, '#8a9198'),
      trait([[s * demi - 0.65, y + 0.65], [s * demi + 0.65, y - 0.65]], false, '#8a9198'),
    ]),
  ];
}

// ------------------------------------------------------------------ Camion grue (autogrue)

/** Tailles proposées : tonnage, longueur (m), essieux, écartement des appuis (m), longueur de la flèche déployée (m). */
export const AUTOGRUES = [
  { t: 40, L: 11.2, essieux: 3, appuis: 6.4, fleche: 28 },
  { t: 100, L: 13.2, essieux: 4, appuis: 8.0, fleche: 42 },
  { t: 200, L: 15.2, essieux: 5, appuis: 9.6, fleche: 56 },
  { t: 350, L: 17.2, essieux: 6, appuis: 11.4, fleche: 72 },
];

/**
 * Camion grue (devant en bas) : cabine, essieux, châssis, tourelle jaune avec cabine de grutier et contrepoids, flèche.
 * Replié : flèche couchée vers l'avant au-dessus de la cabine, appuis rentrés. Déplié : appuis sortis (patins), flèche
 * télescopique déployée vers l'arrière (y +) sur sa longueur (1 / 0,88 en plan, hors crochet) avec poulie et crochet.
 * Le centre est celui du camion (le point de base de la pose).
 */
export function camionGrue({ L, essieux, appuis, fleche }, deploye) {
  const W = 2.55;
  const y0 = -L / 2;
  const res = [];
  const posEssieux = [y0 + 1.2, y0 + 2.7];
  for (let i = 0; i < essieux - 2; i++) posEssieux.push(y0 + L - 1.3 - (essieux - 3 - i) * 1.5);
  for (const y of posEssieux) res.push(...pneu(-W / 2 - 0.1, y - 0.55, -W / 2 + 0.42, y + 0.55), ...pneu(W / 2 - 0.42, y - 0.55, W / 2 + 0.1, y + 0.55));
  res.push(...piece(GRIS, 'metal', rectArrondi(-W / 2 + 0.15, y0 + 2.0, W / 2 - 0.15, y0 + L - 0.1, 0.06)));
  res.push(...appui(y0 + 3.5, appuis / 2, deploye, W / 2), ...appui(y0 + L - 1.0, appuis / 2, deploye, W / 2));
  // Cabine du porteur.
  res.push(...piece(BLANC, 'peinture', rectArrondi(-W / 2, y0, W / 2, y0 + 2.2, 0.35)), ...piece(VITRE, 'vitre', rectArrondi(-W / 2 + 0.18, y0 + 0.2, W / 2 - 0.18, y0 + 0.75, 0.15)));
  res.push(...piece(BLANC, 'peinture', rectArrondi(-W / 2 + 0.15, y0 + 0.8, W / 2 - 0.15, y0 + 2.1, 0.2)));
  // Tourelle : couronne, caisse jaune, cabine du grutier (à gauche), contrepoids.
  const yT = y0 + L * 0.6;
  res.push(...piece(CLAIR, 'metal', cercle(0, yT, 1.35, 32)));
  res.push(...piece('#3a3f45', 'metal', rectArrondi(-1.25, yT + 1.05, 1.25, yT + 2.0, 0.1)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.3, yT - 1.25, 1.3, yT + 1.15, 0.2)));
  res.push(...piece('#d9a90f', 'peinture', rectArrondi(-1.18, yT - 0.2, 1.18, yT + 1.02, 0.1)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.35, yT - 1.3, -0.35, yT - 0.2, 0.12)), ...piece(VITRE, 'vitre', rectArrondi(-1.28, yT - 1.22, -0.43, yT - 0.62, 0.08)));
  res.push(...piece(METAL, 'metal', cercle(0, yT, 0.32, 14)));
  if (!deploye) {
    // Flèche couchée vers l'avant : 4 éléments télescopiques emboîtés, du pivot jusque sur la cabine.
    const long = yT - 0.6 - (y0 + 0.5);
    const parts = [[0.34, 1.12], [0.55, 0.95], [0.78, 0.8], [1.0, 0.66]];
    let y = yT - 0.3;
    for (const [part, w] of parts) {
      const l = long * (part === 1.0 ? 0.28 : part === 0.78 ? 0.26 : part === 0.55 ? 0.24 : 0.22);
      res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-w / 2, y - l, w / 2, y, 0.08)), trait([[0, y - 0.1], [0, y - l + 0.1]], false, '#b37a0a'));
      y -= l * 0.92;
    }
    res.push(...piece(METAL, 'metal', cercle(0, y + 0.1, 0.3, 14)), ...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.22, y - 0.5, 0.22, y - 0.05, 0.05)));
  } else {
    // Flèche déployée vers +y : 4 éléments de plus en plus étroits ; poulie en tête et crochet.
    const long = fleche * 0.88;
    const parts = [[1.15, 0.32], [0.95, 0.27], [0.76, 0.23], [0.58, 0.18]];
    let y = yT;
    parts.forEach(([w, f], i) => {
      const l = long * f + (i === 3 ? long * 0.0 : 0);
      res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-w / 2, y, w / 2, y + l + 0.3, 0.07)), trait([[0, y + 0.15], [0, y + l + 0.15]], false, '#b37a0a'));
      y += l;
    });
    res.push(...piece(METAL, 'metal', cercle(0, y + 0.2, 0.42, 16)), ...piece('#2b2f33', 'caoutchouc', cercle(0, y + 0.2, 0.18, 10)));
    res.push(trait([[0, y + 0.2], [0, y + 1.1]], false, NOIR), ...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.25, y + 1.1, 0.25, y + 1.6, 0.05)));
  }
  return res;
}

// ------------------------------------------------------------------ Grue mobile dynamique (0.293.0)

/** Porteur de la grue mobile (devant en bas) : essieux, châssis, cabine, appuis sortis ou non. Centré sur le milieu du camion. */
export function porteurGrueMobile({ L, essieux, appuis }, stabilisateurs) {
  const W = 2.55;
  const y0 = -L / 2;
  const res = [];
  const posEssieux = [y0 + 1.2, y0 + 2.7];
  for (let i = 0; i < essieux - 2; i++) posEssieux.push(y0 + L - 1.3 - (essieux - 3 - i) * 1.5);
  for (const y of posEssieux) res.push(...pneu(-W / 2 - 0.1, y - 0.55, -W / 2 + 0.42, y + 0.55), ...pneu(W / 2 - 0.42, y - 0.55, W / 2 + 0.1, y + 0.55));
  res.push(...piece(GRIS, 'metal', rectArrondi(-W / 2 + 0.15, y0 + 2.0, W / 2 - 0.15, y0 + L - 0.1, 0.06)));
  res.push(...appui(y0 + 3.5, appuis / 2, stabilisateurs, W / 2), ...appui(y0 + L - 1.0, appuis / 2, stabilisateurs, W / 2));
  res.push(...piece(BLANC, 'peinture', rectArrondi(-W / 2, y0, W / 2, y0 + 2.2, 0.35)), ...piece(VITRE, 'vitre', rectArrondi(-W / 2 + 0.18, y0 + 0.2, W / 2 - 0.18, y0 + 0.75, 0.15)));
  res.push(...piece(BLANC, 'peinture', rectArrondi(-W / 2 + 0.15, y0 + 0.8, W / 2 - 0.15, y0 + 2.1, 0.2)));
  return res;
}

/** Hauteur (m, depuis le milieu du camion) du pivot de la tourelle. */
export const pivotGrueMobile = ({ L }) => -L / 2 + L * 0.6;

/** Tourelle + flèche déployée vers +y, pivot en (0, 0) : cabine du grutier à gauche, contrepoids, flèche télescopique, crochet. */
export function tourelleGrueMobile(fleche) {
  const res = [];
  res.push(...piece(CLAIR, 'metal', cercle(0, 0, 1.35, 32)));
  res.push(...piece('#3a3f45', 'metal', rectArrondi(-1.25, 1.05, 1.25, 2.0, 0.1)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.3, -1.25, 1.3, 1.15, 0.2)));
  res.push(...piece('#d9a90f', 'peinture', rectArrondi(-1.18, -0.2, 1.18, 1.02, 0.1)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.35, -1.3, -0.35, -0.2, 0.12)), ...piece(VITRE, 'vitre', rectArrondi(-1.28, -1.22, -0.43, -0.62, 0.08)));
  const long = Math.max(4, fleche) * 0.88;
  const parts = [[1.15, 0.32], [0.95, 0.27], [0.76, 0.23], [0.58, 0.18]];
  let y = 0;
  parts.forEach(([w, f], i) => {
    const l = long * f;
    res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-w / 2, y, w / 2, y + l + 0.3, 0.07)), trait([[0, y + 0.15], [0, y + l + 0.15]], false, '#b37a0a'));
    void i;
    y += l;
  });
  res.push(...piece(METAL, 'metal', cercle(0, y + 0.2, 0.42, 16)), ...piece('#2b2f33', 'caoutchouc', cercle(0, y + 0.2, 0.18, 10)));
  res.push(trait([[0, y + 0.2], [0, y + 1.1]], false, NOIR), ...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.25, y + 1.1, 0.25, y + 1.6, 0.05)));
  res.push(...piece(METAL, 'metal', cercle(0, 0, 0.32, 14)));
  return res;
}

// ------------------------------------------------------------------ Pompe à béton

/**
 * Camion pompe à béton (devant en bas) : porteur à 4 essieux, trémie à l'arrière, mât de distribution. Replié : mât plié
 * le long du porteur vers l'avant, appuis rentrés. Déplié : mât déployé en zigzag vers l'arrière (5 éléments, ~28 m),
 * tuyau terminal, appuis sortis.
 */
export function pompeABeton(deploye) {
  const L = 11.4;
  const W = 2.5;
  const y0 = -L / 2;
  const pivotY = y0 + 3.1;
  const corps = (b) => [
    ...piece('#d63a3a', 'peinture', rectArrondi(b.x0 + 0.05, b.y0 + 0.1, b.x1 - 0.05, b.y1 - 0.2, 0.12)),
    ...piece('#3a3f45', 'metal', [[-0.95, b.y1 - 2.0], [0.95, b.y1 - 2.0], [0.6, b.y1 - 0.4], [-0.6, b.y1 - 0.4]]),
    ...piece(METAL, 'metal', rectArrondi(-0.5, b.y1 - 3.6, 0.5, b.y1 - 2.1, 0.08)),
  ];
  const res = camion({ L, W, essieux: [0.5, 1.7, 2.9], corps, couleurCabine: BLANC });
  res.push(...appui(y0 + 3.0, 3.6, deploye, W / 2), ...appui(y0 + L - 0.9, 2.9, deploye, W / 2));
  res.push(...piece(CLAIR, 'metal', cercle(0, pivotY, 0.8, 24)), ...piece('#d63a3a', 'peinture', rectArrondi(-0.55, pivotY - 0.6, 0.55, pivotY + 0.6, 0.12)));
  if (!deploye) {
    // Mât plié : posé derrière la cabine, 4 éléments empilés couchés vers l'arrière au-dessus du porteur ; tuyau replié.
    const largeurs = [0.66, 0.56, 0.46, 0.36];
    const lon = [7.4, 6.8, 6.0, 5.2];
    largeurs.forEach((w, i) => {
      res.push(...piece(i % 2 ? '#e9edf0' : '#d63a3a', 'peinture', rectArrondi(-w / 2 + (i - 1.5) * 0.05, pivotY - 0.2, w / 2 + (i - 1.5) * 0.05, pivotY + lon[i], 0.12)));
    });
    res.push(trait([[0.2, pivotY + 7.4], [0.2, pivotY + 7.9]], false, NOIR));
  } else {
    const pts = [[0, pivotY]];
    const lon = [7.6, 6.6, 5.6, 4.6, 3.6];
    const dev = [90, 90 + 14, 90 - 22, 90 + 26, 90 - 12];
    lon.forEach((l, i) => {
      const [x, y] = pts[i];
      pts.push([x + l * Math.cos((dev[i] * Math.PI) / 180), y + l * Math.sin((dev[i] * Math.PI) / 180)]);
    });
    pts.slice(0, -1).forEach((p, i) => {
      res.push(...piece(i % 2 ? '#e9edf0' : '#d63a3a', 'peinture', epais([p, pts[i + 1]], 0.7 - i * 0.07)));
    });
    pts.forEach((p, i) => res.push(...piece(METAL, 'metal', cercle(p[0], p[1], 0.3 - i * 0.02, 12))));
    const fin = pts[pts.length - 1];
    const b = pts[pts.length - 2];
    const d = Math.hypot(fin[0] - b[0], fin[1] - b[1]);
    const [ux, uy] = [(fin[0] - b[0]) / d, (fin[1] - b[1]) / d];
    for (let k = 0; k < 4; k++) res.push(trait([[fin[0] + ux * (0.3 + k * 1.0), fin[1] + uy * (0.3 + k * 1.0)], [fin[0] + ux * (0.9 + k * 1.0), fin[1] + uy * (0.9 + k * 1.0)]], false, NOIR));
  }
  return res;
}

// ------------------------------------------------------------------ Nacelle, ciseaux, compresseur, bétonnière

/** Nacelle articulée (devant en bas) : porteur à 4 roues, tourelle, flèche à 2 éléments, panier. Repliée ou déployée. */
export function nacelle(deploye) {
  const O = '#f08c00';
  const res = [];
  for (const [x0, x1] of [[-1.45, -1.0], [1.0, 1.45]]) for (const y of [-1.35, 1.35]) res.push(...pneu(x0, y - 0.55, x1, y + 0.55));
  res.push(...piece(O, 'peinture', rectArrondi(-1.12, -2.3, 1.12, 2.3, 0.25)));
  res.push(...piece('#3a3f45', 'metal', rectArrondi(-0.6, 1.1, 0.6, 2.1, 0.1)), ...piece(CLAIR, 'metal', cercle(0, 0.2, 0.85, 24)));
  if (!deploye) {
    res.push(...piece(O, 'peinture', rectArrondi(-0.32, -4.1, 0.32, 0.4, 0.1)), ...piece('#3a3f45', 'metal', rectArrondi(-0.14, -3.7, 0.14, 0.2, 0.05)));
    res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-0.62, -5.0, 0.62, -4.1, 0.08)), trait(rectArrondi(-0.52, -4.9, 0.52, -4.2, 0.04), true, NOIR));
  } else {
    for (const [x, y] of [[-1.55, -2.0], [1.55, -2.0], [-1.55, 2.0], [1.55, 2.0]]) res.push(...piece(CLAIR, 'metal', rectArrondi(x - 0.4, y - 0.4, x + 0.4, y + 0.4, 0.05)), trait([[x - 0.4, y], [x + 0.4, y]], false, METAL));
    const p0 = [0, 0.2];
    const p1 = [1.2, 6.0];
    const p2 = [3.4, 11.4];
    res.push(...piece(O, 'peinture', epais([p0, p1], 0.55)), ...piece(O, 'peinture', epais([p1, p2], 0.45)), ...piece(METAL, 'metal', cercle(p1[0], p1[1], 0.28, 12)));
    const panier = deplacer(tourner(rectArrondi(-0.6, -0.45, 0.6, 0.45, 0.06), 62), p2[0] + 0.3, p2[1] + 0.2);
    res.push(...piece(PERRIN_JAUNE, 'peinture', panier), trait(deplacer(tourner(rectArrondi(-0.5, -0.35, 0.5, 0.35, 0.04), 62), p2[0] + 0.3, p2[1] + 0.2), true, NOIR));
  }
  return res;
}

/** Élévateur à ciseaux : châssis, 4 petites roues, plate-forme grillagée avec garde-corps, boîtier de commande. */
export function elevateurCiseaux() {
  const res = [];
  for (const [x, y] of [[-0.85, -0.7], [0.85, -0.7], [-0.85, 0.7], [0.85, 0.7]]) res.push(...pneu(x - 0.25, y - 0.1, x + 0.25, y + 0.1));
  res.push(...piece('#3a3f45', 'metal', rectArrondi(-1.25, -0.6, 1.25, 0.6, 0.1)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.2, -0.56, 1.2, 0.56, 0.05)));
  for (let x = -1.0; x < 1.15; x += 0.18) res.push(trait([[x, -0.5], [x + 0.1, 0.5]], false, '#b9770a'));
  res.push(trait(rectArrondi(-1.14, -0.5, 1.14, 0.5, 0.03), true, '#334155'), trait(rectArrondi(-1.1, -0.46, 1.1, 0.46, 0.03), true, '#334155'));
  res.push(...piece(GRIS, 'metal', rectArrondi(-1.1, -0.2, -0.85, 0.2, 0.03)), ...piece('#e03131', 'phare', cercle(-0.97, 0, 0.05, 8)));
  res.push(plein(PERRIN_JAUNE, 'peinture', rectArrondi(1.05, -0.2, 1.17, 0.2, 0.02)));
  return res;
}

/** Compresseur mobile : caisse jaune à grilles, 2 roues, timon en V avec roue jockey. */
export function compresseur() {
  const res = [];
  res.push(...piece(GRIS, 'metal', epais([[-1.5, -0.3], [-2.55, 0]], 0.1)), ...piece(GRIS, 'metal', epais([[-1.5, 0.3], [-2.55, 0]], 0.1)), ...piece(METAL, 'metal', cercle(-2.6, 0, 0.1, 10)));
  res.push(...pneu(-0.2, -0.98, 0.6, -0.74), ...pneu(-0.2, 0.74, 0.6, 0.98));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-2.05, -0.12, -1.8, 0.12, 0.05)));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.55, -0.72, 1.55, 0.72, 0.14)));
  res.push(...piece('#d9a90f', 'peinture', rectArrondi(-1.4, -0.58, 1.4, 0.58, 0.08)));
  for (let y = -0.45; y < 0.5; y += 0.14) res.push(trait([[0.2, y], [1.25, y]], false, '#8a6a08'));
  res.push(...piece(GRIS, 'metal', rectArrondi(-1.25, -0.35, -0.3, 0.35, 0.06)), ...piece(METAL, 'metal', cercle(-0.78, 0, 0.2, 14)), ...piece(GRIS, 'metal', cercle(0.2, -0.45, 0.06, 8)));
  return res;
}

/** Bétonnière de chantier : cuve inclinée à pales, châssis, moteur, 2 roues, volant de basculement. */
export function betonniere() {
  const res = [];
  res.push(...pneu(-0.12, -0.62, 0.34, -0.46), ...pneu(-0.12, 0.46, 0.34, 0.62));
  res.push(...piece(GRIS, 'metal', rectArrondi(-0.8, -0.38, 0.5, 0.38, 0.05)));
  res.push(...piece('#2f6fb0', 'peinture', rectArrondi(-0.78, -0.3, -0.3, 0.3, 0.06)), trait([[-0.7, -0.2], [-0.4, -0.2]], false, '#1d4f82'));
  res.push(...piece('#d9531e', 'peinture', ellipse(0.12, 0, 0.5, 0.44, 24)), ...piece('#b43f13', 'peinture', ellipse(0.2, 0, 0.3, 0.27, 20)), ...piece('#3a3f45', 'metal', ellipse(0.22, 0, 0.17, 0.15, 16)));
  for (let i = 0; i < 6; i++) {
    const a = (2 * Math.PI * i) / 6;
    res.push(trait([[0.12 + 0.3 * Math.cos(a), 0.27 * Math.sin(a)], [0.12 + 0.5 * Math.cos(a), 0.44 * Math.sin(a)]], false, '#7a2c0b'));
  }
  res.push(trait([[-0.75, 0], [-1.15, 0]], false, GRIS), ...piece(METAL, 'metal', cercle(-1.2, 0, 0.1, 10)));
  return res;
}
void ellipse; void pointe;
