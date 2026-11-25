// Plans de chantier (0.320.3) : raboteuses W100 et W50, benne à béton pour grue, ouvriers (vue de dessus et silhouette),
// signaleur à la raquette. Formes dessinées à la main et dimensions estimées : à valider par l'utilisateur sur la planche.
import {
  rectArrondi, cercle, ellipse, epais, plein, trait, piece, PERRIN_JAUNE,
} from './symboles-outils.js';

const GRIS = '#5f666d';
const METAL = '#8a9198';
const CLAIR = '#d5d9dd';
const CHENILLE = '#2b2f33';
const GILET = '#f26a1b';
const PEAU = '#e0b48f';
const CASQUE = '#f5c518';
const BLEU = '#2f4b7c';

/**
 * Raboteuse (vue de dessus, convoyeur vers +x comme la W200) : 4 chenilles, corps, cabine, capot jaune du tambour et
 * convoyeur à bande. corps = [longueur, largeur], conv = [longueur, largeur] (m).
 */
function raboteuse({ corps: [Lc, W], conv: [Lt, Wt] }) {
  const res = [];
  const x0 = -Lc / 2;
  const x1 = Lc / 2;
  const lc = Math.min(1.3, Lc * 0.2); // longueur d'une chenille
  for (const sy of [-1, 1]) {
    for (const [a, b] of [[x0 + 0.25, x0 + 0.25 + lc], [x1 - 0.25 - lc, x1 - 0.25]]) {
      const ya = sy * (W / 2 - 0.42);
      const yb = sy * (W / 2 + 0.04);
      res.push(...piece(CHENILLE, 'caoutchouc', rectArrondi(a, Math.min(ya, yb), b, Math.max(ya, yb), 0.18), '#0f1215'));
    }
  }
  // Convoyeur : cadre, bande noire, trémie du bout.
  const cx0 = x1 - 0.2;
  const cx1 = x1 + Lt;
  res.push(...piece('#4b535c', 'metal', rectArrondi(cx0, -Wt / 2, cx1, Wt / 2, 0.06)));
  res.push(plein(CHENILLE, 'caoutchouc', rectArrondi(cx0 + 0.3, -Wt / 2 + 0.1, cx1 - 0.5, Wt / 2 - 0.1, 0.03)));
  for (let x = cx0 + 0.6; x < cx1 - 0.6; x += 0.5) res.push(trait([[x, -Wt / 2 + 0.1], [x, Wt / 2 - 0.1]], false, '#3a4048'));
  res.push(...piece('#59616a', 'metal', rectArrondi(cx1 - 0.55, -Wt / 2 + 0.03, cx1 + 0.05, Wt / 2 - 0.03, 0.05)));
  // Corps et capot du tambour.
  res.push(...piece('#6b7380', 'metal', rectArrondi(x0, -W / 2 + 0.2, x1, W / 2 - 0.2, 0.2)));
  for (let i = 0; i < 5; i++) res.push(trait([[x0 + 0.12 + i * 0.1, -W / 2 + 0.4], [x0 + 0.12 + i * 0.1, W / 2 - 0.4]], false, '#3a4048')); // grille du moteur
  res.push(...piece('#f2d466', 'peinture', [[x1 - Lc * 0.28, -W / 2 + 0.3], [x1 + 0.1, -Wt / 2], [x1 + 0.1, Wt / 2], [x1 - Lc * 0.28, W / 2 - 0.3]]));
  res.push(...piece('#2b2f33', 'vitre', rectArrondi(x0 + Lc * 0.28, -W / 2 + 0.3, x0 + Lc * 0.58, W / 2 - 0.3, 0.1))); // cabine
  res.push(trait([[x0 + Lc * 0.28, 0], [x0 + Lc * 0.58, 0]], false, '#555d66'));
  return res;
}

/** Raboteuse Wirtgen W 100 (largeur de fraisage 1,0 m) : dimensions estimées. */
export const raboteuse100 = () => raboteuse({ corps: [6.6, 2.3], conv: [4.8, 0.9] });
/** Raboteuse Wirtgen W 50 (largeur de fraisage 0,5 m) : dimensions estimées. */
export const raboteuse50 = () => raboteuse({ corps: [4.3, 1.6], conv: [3.4, 0.6] });

/**
 * Benne à béton de grue (vue de dessus) : cuve conique, trémie de remplissage, goulotte de vidange avec sa manette,
 * 2 oreilles de levage et 4 élingues qui rejoignent l'anneau du crochet au centre.
 */
export function bennePourGrue() {
  const res = [];
  const R = 0.7;
  res.push(...piece(PERRIN_JAUNE, 'peinture', cercle(0, 0, R, 36), '#8a6a08'));
  res.push(...piece('#d9a90f', 'peinture', cercle(0, 0, R * 0.72, 32), '#8a6a08'));
  res.push(...piece('#8a6a08', 'metal', cercle(0, 0, R * 0.38, 24), '#4a3a05')); // goulotte vue du dessus
  // Goulotte de vidange et manette (côté +x).
  res.push(...piece(GRIS, 'metal', rectArrondi(R * 0.55, -0.16, R + 0.32, 0.16, 0.05)));
  res.push(...piece(METAL, 'metal', rectArrondi(R + 0.18, -0.34, R + 0.42, -0.1, 0.04)));
  res.push(trait([[R + 0.3, -0.34], [R + 0.3, -0.62]], false, '#334155'));
  res.push(...piece('#d63a3a', 'peinture', cercle(R + 0.3, -0.66, 0.07, 10)));
  // Oreilles de levage et anneau du crochet.
  for (const a of [45, 135, 225, 315]) {
    const r = (a * Math.PI) / 180;
    res.push(...piece(METAL, 'metal', cercle(R * 0.9 * Math.cos(r), R * 0.9 * Math.sin(r), 0.06, 8)));
  }
  // Élingues des oreilles vers l'anneau du crochet (vues de dessus, par-dessus la cuve).
  for (const a of [45, 135, 225, 315]) {
    const r = (a * Math.PI) / 180;
    res.push(trait([[0, 0], [R * 0.85 * Math.cos(r), R * 0.85 * Math.sin(r)]], false, '#475569'));
  }
  res.push(...piece(METAL, 'metal', cercle(0, 0, 0.14, 14), '#334155'), ...piece(CLAIR, 'metal', cercle(0, 0, 0.06, 10)));
  return res;
}

// ------------------------------------------------------------------ Ouvriers

/** Ouvrier vu de dessus : casque jaune, épaules en gilet orange, bras, bottes. Devant en bas (y mini). */
function ouvrierDessus({ raquette = false } = {}) {
  const res = [];
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.2, -0.3, -0.02, -0.12, 0.05)), ...piece('#2b2f33', 'caoutchouc', rectArrondi(0.02, -0.3, 0.2, -0.12, 0.05))); // bottes
  const bras = (sy) => {
    const tendu = raquette && sy === 1;
    const fin = tendu ? [0.45, -0.38] : [sy * 0.3, -0.12];
    return [
      ...piece(GILET, 'peinture', epais([[sy * 0.26, 0.02], fin], 0.13)),
      ...piece(BLEU, 'peinture', cercle(fin[0], fin[1], 0.065, 10)),
    ];
  };
  res.push(...bras(-1), ...bras(1));
  res.push(...piece(GILET, 'peinture', ellipse(0, 0, 0.3, 0.16, 20), '#7a2f08'));
  res.push(plein('#e9edf1', 'blanc', ellipse(0, 0.01, 0.22, 0.015, 12)), plein('#e9edf1', 'blanc', ellipse(0, -0.06, 0.22, 0.015, 12))); // bandes réfléchissantes
  res.push(...piece(CASQUE, 'peinture', cercle(0, 0.03, 0.125, 18), '#8a6a08'));
  res.push(trait([[0, -0.07], [0, 0.13]], false, '#b8920c'));
  if (raquette) {
    // Manche et disque de la raquette tenus au bout du bras droit (la raquette est montrée à plat, de face).
    res.push(...piece('#374151', 'metal', epais([[0.45, -0.38], [0.45, -0.1]], 0.04)));
    res.push(...raquetteDisque(0.45, 0.12, 0.26));
  }
  return res;
}

/** Disque de raquette de signalisation : rouge « STOP » (octogone) ; centré en (x, y), rayon r. */
function raquetteDisque(x, y, r) {
  const octo = Array.from({ length: 8 }, (_, i) => [x + r * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), y + r * Math.sin(Math.PI / 8 + (i * Math.PI) / 4)]);
  const ocoI = Array.from({ length: 8 }, (_, i) => [x + r * 0.82 * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), y + r * 0.82 * Math.sin(Math.PI / 8 + (i * Math.PI) / 4)]);
  return [
    ...piece('#f8fafc', 'blanc', octo, '#334155'),
    ...piece('#d62828', 'peinture', ocoI, '#7a1010'),
    plein('#f8fafc', 'blanc', rectArrondi(x - r * 0.5, y - r * 0.09, x + r * 0.5, y + r * 0.09, 0.01)),
  ];
}

export const ouvrier = () => ouvrierDessus();
export const ouvrierRaquette = () => ouvrierDessus({ raquette: true });

// ------------------------------------------------------------------ Silhouettes (vue de face, lisibles à petite échelle)

/**
 * Silhouette d'un ouvrier debout (vue de face, un peu en 3/4 : épaule gauche plus en avant), 0,55 × 1,8 m.
 * Devant le plan : pictogramme posé « debout » sur le plan. avecRaquette : bras droit levé tenant une raquette STOP.
 */
function silhouette({ avecRaquette = false } = {}) {
  const res = [];
  // Jambes et bottes.
  res.push(...piece('#2f3b52', 'peinture', rectArrondi(-0.15, -0.9, -0.02, -0.15, 0.04)), ...piece('#2f3b52', 'peinture', rectArrondi(0.02, -0.9, 0.15, -0.15, 0.04)));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.18, -0.95, -0.01, -0.82, 0.04)), ...piece('#2b2f33', 'caoutchouc', rectArrondi(0.01, -0.95, 0.19, -0.82, 0.04)));
  // Tronc en gilet, bras.
  res.push(...piece(GILET, 'peinture', rectArrondi(-0.24, -0.2, 0.24, 0.5, 0.1), '#7a2f08'));
  res.push(plein('#e9edf1', 'blanc', rectArrondi(-0.24, 0.02, 0.24, 0.1, 0.01)), plein('#e9edf1', 'blanc', rectArrondi(-0.24, 0.26, 0.24, 0.34, 0.01)));
  res.push(plein('#e9edf1', 'blanc', rectArrondi(-0.17, -0.2, -0.1, 0.5, 0.01)), plein('#e9edf1', 'blanc', rectArrondi(0.1, -0.2, 0.17, 0.5, 0.01)));
  res.push(...piece('#3a4660', 'peinture', epais([[-0.3, 0.42], [-0.34, -0.12]], 0.13)), ...piece(BLEU, 'peinture', cercle(-0.34, -0.17, 0.065, 10)));
  if (avecRaquette) {
    res.push(...piece('#3a4660', 'peinture', epais([[0.3, 0.42], [0.46, 0.85]], 0.13)), ...piece(BLEU, 'peinture', cercle(0.46, 0.88, 0.065, 10)));
    res.push(...piece('#374151', 'metal', epais([[0.46, 0.85], [0.46, 1.1]], 0.04)));
    res.push(...raquetteDisque(0.46, 1.38, 0.3));
  } else {
    res.push(...piece('#3a4660', 'peinture', epais([[0.3, 0.42], [0.34, -0.12]], 0.13)), ...piece(BLEU, 'peinture', cercle(0.34, -0.17, 0.065, 10)));
  }
  // Tête, visage, casque.
  res.push(...piece(PEAU, 'peinture', cercle(0, 0.72, 0.15, 18), '#8a5a3c'));
  const demi = Array.from({ length: 13 }, (_, i) => [0.2 * Math.cos((Math.PI * i) / 12), 0.74 + 0.2 * Math.sin((Math.PI * i) / 12)]);
  res.push(...piece(CASQUE, 'peinture', demi, '#8a6a08'));
  res.push(trait([[-0.21, 0.745], [0.21, 0.745]], false, '#b8920c'));
  return res;
}

export const ouvrierSilhouette = () => silhouette();
export const signaleurRaquette = () => silhouette({ avecRaquette: true });
