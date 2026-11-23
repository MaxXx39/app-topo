// Plans de chantier (0.292.0) : installations, base-vie et stockage dessinés dans Topo. Vue de dessus, centrés.
// Bennes de tri et de recyclage : les icônes (logo vert du recyclage, bois, métal, inertes, plâtre) se posent sur la benne
// jaune du DXF (voir symboles-retouches.js). Les formes sont dessinées à la main : à valider par l'utilisateur.
import {
  rectArrondi, cercle, ellipse, arc, tourner, deplacer, epais, pointe, plein, motif, trait, piece, texte, pneu,
  PERRIN_JAUNE, PERRIN_ORANGE, NOIR,
} from './symboles-outils.js';

const GRIS = '#5f666d';
const METAL = '#8a9198';
const CLAIR = '#d5d9dd';
const VERT = '#1f9d55';

// ------------------------------------------------------------------ Icônes (centrées en x, y, taille t en m)

/**
 * Logo du recyclage (d'après l'image de l'utilisateur) : 3 flèches épaisses qui suivent les côtés d'un triangle, chacune
 * part du milieu d'un côté, passe le coin (arrondi) et finit par une pointe sur le côté suivant. Vertes, contour sombre.
 */
export function logoRecyclage(x, y, t, k = VERT, contour = '#0f172a') {
  const R = t * 0.55;
  const V = [90, 210, 330].map((a) => [x + R * Math.cos((a * Math.PI) / 180), y + R * Math.sin((a * Math.PI) / 180) - R * 0.08]);
  const res = [];
  const sur = (A, B, f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
  for (let i = 0; i < 3; i++) {
    const A = V[i];
    const B = V[(i + 1) % 3];
    const C = V[(i + 2) % 3];
    const S = sur(A, B, 0.6);
    const P1 = sur(A, B, 0.86);
    const P2 = sur(B, C, 0.14);
    const E = sur(B, C, 0.34);
    const chemin = [S, P1];
    for (let j = 1; j <= 5; j++) {
      const u = j / 6;
      chemin.push([(1 - u) * (1 - u) * P1[0] + 2 * (1 - u) * u * B[0] + u * u * P2[0], (1 - u) * (1 - u) * P1[1] + 2 * (1 - u) * u * B[1] + u * u * P2[1]]);
    }
    chemin.push(P2, E);
    const tige = epais(chemin, t * 0.2);
    const tete = pointe([P2, E], t * 0.3, t * 0.46);
    res.push(plein(k, 'peinture', tige), trait(tige, true, contour), plein(k, 'peinture', tete), trait(tete, true, contour));
  }
  return res;
}

/** Étiquette carrée blanche à bord de couleur (fond des icônes de benne de tri). */
const etiquette = (x, y, t, couleur) => [...piece('#ffffff', 'blanc', rectArrondi(x - t / 2, y - t / 2, x + t / 2, y + t / 2, t * 0.12)), plein(couleur, 'peinture', rectArrondi(x - t / 2, y - t / 2, x + t / 2, y + t / 2, t * 0.12), rectArrondi(x - t / 2 + t * 0.07, y - t / 2 + t * 0.07, x + t / 2 - t * 0.07, y + t / 2 - t * 0.07, t * 0.08))];

/** Bois : trois bûches vues par le bout (cercles à cernes). */
export function iconeBois(x, y, t) {
  const res = etiquette(x, y, t, '#8b5a2b');
  for (const [dx, dy] of [[-0.22, -0.17], [0.22, -0.17], [0, 0.22]]) {
    const cx = x + dx * t;
    const cy = y + dy * t;
    res.push(...piece('#c58b52', 'gravats', cercle(cx, cy, t * 0.2, 18), '#7a4f2d'), trait(cercle(cx, cy, t * 0.13, 14), true, '#7a4f2d'), trait(cercle(cx, cy, t * 0.06, 10), true, '#7a4f2d'));
  }
  return res;
}
/** Métal : poutrelle en I et écrou hexagonal. */
export function iconeMetal(x, y, t) {
  const res = etiquette(x, y, t, '#475569');
  const P = (pts) => pts.map(([a, b]) => [x + a * t, y + b * t]);
  res.push(...piece('#7b8794', 'metal', P([[-0.4, 0.34], [0.0, 0.34], [0.0, 0.26], [-0.14, 0.26], [-0.14, -0.1], [0.0, -0.1], [0.0, -0.18], [-0.4, -0.18], [-0.4, -0.1], [-0.26, -0.1], [-0.26, 0.26], [-0.4, 0.26]]).map(([a, b]) => [a + t * 0.2, b])));
  const hex = Array.from({ length: 6 }, (_, i) => [x + t * 0.18 + t * 0.2 * Math.cos((Math.PI / 3) * i), y - t * 0.16 + t * 0.2 * Math.sin((Math.PI / 3) * i)]);
  res.push(...piece('#9aa3ab', 'metal', hex), plein('#475569', 'metal', cercle(x + t * 0.18, y - t * 0.16, t * 0.08, 10)));
  return res;
}
/** Inertes : tas de pierres. */
export function iconeInertes(x, y, t) {
  const res = etiquette(x, y, t, '#6b7280');
  const pierres = [[-0.2, -0.14, 0.17, '#7c8087'], [0.1, -0.16, 0.2, '#9a9ea3'], [0.27, -0.12, 0.12, '#6b7075'], [-0.04, 0.1, 0.19, '#a6a29a'], [0.2, 0.12, 0.13, '#7a756c'], [-0.24, 0.14, 0.11, '#8c9096']];
  pierres.forEach(([dx, dy, r, k], i) => {
    const pts = Array.from({ length: 7 }, (_, j) => {
      const a = (2 * Math.PI * j) / 7 + i;
      const rr = r * (0.85 + 0.25 * Math.sin(j * 2.3 + i));
      return [x + (dx + rr * Math.cos(a)) * t, y + (dy + rr * Math.sin(a) * 0.85) * t];
    });
    res.push(...piece(k, 'gravats', pts, '#3f4448'));
  });
  return res;
}
/** Plâtre : plaques empilées (blanches, cartonnées de bleu-gris). */
export function iconePlatre(x, y, t) {
  const res = etiquette(x, y, t, '#7c8da6');
  for (let i = 3; i >= 0; i--) {
    const dx = (i - 1.5) * 0.045;
    const dy = (i - 1.5) * 0.06;
    res.push(...piece(i === 0 ? '#f8fafc' : '#e2e8f0', 'blanc', rectArrondi(x + (-0.3 + dx) * t, y + (-0.22 + dy) * t, x + (0.3 + dx) * t, y + (0.16 + dy) * t, t * 0.02), '#7c8da6'));
  }
  res.push(trait([[x - 0.18 * t, y - 0.03 * t], [x + 0.22 * t, y - 0.03 * t]], false, '#9aa9bf'));
  return res;
}
/** Douche : pomme, tuyau et gouttes, sur une étiquette bleue. */
export function pictoDouche(x, y, t) {
  const res = etiquette(x, y, t, '#1f6fb5');
  const P = (a, b) => [x + a * t, y + b * t];
  res.push(...piece('#475569', 'metal', epais([P(-0.28, -0.3), P(-0.28, 0.28), P(0.0, 0.28)], t * 0.07)));
  res.push(...piece('#7b8794', 'metal', tourner(ellipse(0, 0, t * 0.19, t * 0.07, 14), -35).map(([a, b]) => [a + x + t * 0.12, b + y + t * 0.18])));
  for (const [a, b] of [[0.02, 0.0], [0.12, -0.05], [0.22, -0.1], [0.07, -0.14], [0.17, -0.2], [0.27, -0.25], [0.0, -0.26], [0.12, -0.32]]) res.push(trait([P(a, b), P(a + 0.015, b - 0.09)], false, '#1f6fb5'));
  return res;
}

// ------------------------------------------------------------------ Bennes

/** Benne de décantation (2,5 × 6 m) : 3 compartiments en série (décantation, neutralisation CO₂, eau claire), pompe et tuyaux. */
export function benneDecantation() {
  const W = 2.5;
  const L = 6.0;
  const res = [];
  res.push(...piece('#7b8794', 'metal', rectArrondi(-W / 2, -L / 2, W / 2, L / 2, 0.08)));
  res.push(plein('#5f6b78', 'metal', rectArrondi(-W / 2 + 0.12, -L / 2 + 0.12, W / 2 - 0.12, L / 2 - 0.12, 0.04)));
  const xs = [-L / 2 + 0.12, -L / 2 + 2.3, -L / 2 + 3.9, L / 2 - 0.12];
  const eaux = ['#9b8460', '#8fb5b8', '#6fb4dc']; // boues de lavage, eau en cours de neutralisation, eau claire
  for (let i = 0; i < 3; i++) {
    res.push(...piece(eaux[i], 'vitre', rectArrondi(-W / 2 + 0.22, xs[i] + 0.1, W / 2 - 0.22, xs[i + 1] - 0.1, 0.03)));
  }
  // Cloisons et seuils de passage.
  for (const y of [xs[1], xs[2]]) res.push(...piece('#3a3f45', 'metal', rectArrondi(-W / 2 + 0.12, y - 0.07, W / 2 - 0.12, y + 0.07, 0.01)), ...piece('#cbd5e1', 'metal', rectArrondi(-0.3, y - 0.07, 0.3, y + 0.07, 0.01)));
  // Boues déposées dans le premier compartiment.
  for (let i = 0; i < 8; i++) res.push(plein('#7a6647', 'gravats', ellipse(-0.6 + (i % 4) * 0.4, xs[0] + 0.5 + Math.floor(i / 4) * 0.7, 0.14 + (i % 3) * 0.03, 0.1, 8)));
  // Neutralisation : bouteille de CO₂ et sonde de pH.
  res.push(...piece('#c23b3b', 'peinture', cercle(0.6, xs[1] + 0.9, 0.2, 16)), ...piece(METAL, 'metal', cercle(0.6, xs[1] + 0.9, 0.07, 8)));
  res.push(trait([[0.6, xs[1] + 0.9], [0.1, xs[1] + 0.5]], false, NOIR), ...piece('#2b2f33', 'caoutchouc', cercle(0.1, xs[1] + 0.5, 0.07, 8)));
  // Pompe, tuyaux et regards.
  res.push(...piece('#f08c00', 'peinture', rectArrondi(-0.45, xs[2] + 0.55, 0.45, xs[2] + 1.0, 0.06)), trait([[0, xs[2] + 0.55], [0, xs[2] + 0.1]], false, NOIR), trait([[0.45, xs[2] + 0.8], [0.95, xs[2] + 0.8], [0.95, L / 2 - 0.3]], false, NOIR));
  res.push(...piece('#aeb4ba', 'metal', cercle(-0.7, xs[0] + 0.3, 0.12, 12)), ...piece('#aeb4ba', 'metal', cercle(-0.7, xs[2] + 0.3, 0.12, 12)));
  res.push(texte('Décantation', 0.35, (xs[0] + xs[3]) / 2, 0.42, { a: 90 })); // un seul texte (retour du 23.11)
  return res;
}

// ------------------------------------------------------------------ Installations

/** Silo à ciment : socle carré, 4 pieds, cylindre (vu de dessus, dôme, trou d'homme, filtre) et échelle. */
export function siloCiment() {
  const res = [];
  res.push(...piece('#aeb4ba', 'metal', rectArrondi(-1.85, -1.85, 1.85, 1.85, 0.05)));
  for (const [x, y] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) res.push(...piece(GRIS, 'metal', rectArrondi(x - 0.2, y - 0.2, x + 0.2, y + 0.2, 0.03)));
  res.push(...piece('#e6e9ec', 'metal', cercle(0, 0, 1.3, 40)), trait(cercle(0, 0, 1.05, 36), true, '#aeb4ba'), trait(cercle(0, 0, 0.6, 28), true, '#aeb4ba'));
  for (let i = 0; i < 12; i++) {
    const a = (2 * Math.PI * i) / 12;
    res.push(trait([[0.6 * Math.cos(a), 0.6 * Math.sin(a)], [1.3 * Math.cos(a), 1.3 * Math.sin(a)]], false, '#c4cad0'));
  }
  res.push(...piece('#aeb4ba', 'metal', cercle(0.1, 0.1, 0.28, 14)), trait(cercle(0.1, 0.1, 0.17, 12), true));
  res.push(...piece(GRIS, 'metal', rectArrondi(-0.95, 0.6, -0.45, 1.1, 0.05)), ...piece('#d63a3a', 'peinture', rectArrondi(1.2, -0.2, 1.7, 0.2, 0.05)));
  res.push(trait([[-1.3, -0.2], [-1.85, -0.2]], false, GRIS), trait([[-1.3, 0.2], [-1.85, 0.2]], false, GRIS));
  for (let y = -0.15; y < 0.2; y += 0.1) res.push(trait([[-1.8, y], [-1.4, y]], false, GRIS));
  return res;
}

/** Centrale à béton mobile : 4 trémies à granulats, tapis, tour de malaxage, silos à ciment, cabine, voie de chargement. */
export function centraleBeton() {
  const res = [];
  res.push(motif('#cbd5e1', rectArrondi(1.9, -4.0, 5.5, -1.3, 0.05)));
  for (const x of [2.6, 3.7, 4.8]) res.push(trait([[x, -3.9], [x, -1.4]], false, '#94a3b8'));
  // Trémies : 4 cases avec leur tas.
  const tas = ['#d4b878', '#a8a29a', '#8c8c86', '#78716c'];
  tas.forEach((k, i) => {
    const x0 = -9.5 + i * 2.15;
    res.push(...piece(METAL, 'metal', rectArrondi(x0, -3.7, x0 + 2.05, -0.2, 0.04)), ...piece(k, 'gravats', ellipse(x0 + 1.02, -1.95, 0.8, 1.2, 18)));
    res.push(trait([[x0 + 0.1, -3.6], [x0 + 1.95, -0.3]], false, '#6b7280'));
  });
  // Tapis d'alimentation vers la tour.
  res.push(...piece('#3a3f45', 'caoutchouc', rectArrondi(-9.2, 0.1, 3.4, 0.75, 0.1)), trait([[-9.0, 0.425], [3.2, 0.425]], false, '#6b7280'));
  for (const x of [-9.1, 3.3]) res.push(...piece(METAL, 'metal', cercle(x, 0.425, 0.3, 12)));
  for (let x = -8.0; x < 3.0; x += 2.0) res.push(trait([[x, 0.1], [x, 0.75]], false, '#6b7280'));
  // Tour de malaxage : malaxeur à pales.
  res.push(...piece('#6c7a89', 'metal', rectArrondi(1.8, -1.2, 5.6, 2.6, 0.1)), ...piece('#3a3f45', 'metal', cercle(3.7, 0.7, 1.3, 32)), ...piece('#5a6572', 'metal', cercle(3.7, 0.7, 1.0, 28)));
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + 0.5;
    res.push(trait([[3.7, 0.7], [3.7 + Math.cos(a) * 1.0, 0.7 + Math.sin(a) * 1.0]], false, '#cbd5e1'));
  }
  res.push(...piece(PERRIN_JAUNE, 'peinture', cercle(3.7, 0.7, 0.25, 12)), ...piece(GRIS, 'metal', rectArrondi(5.0, 0.2, 5.5, 1.2, 0.04)));
  // Silos à ciment et tuyau de transfert.
  for (const y of [2.2, -0.9]) res.push(...piece('#e6e9ec', 'metal', cercle(8.4, y, 1.3, 32)), trait(cercle(8.4, y, 0.9, 28), true, '#aeb4ba'), ...piece('#aeb4ba', 'metal', cercle(8.4, y, 0.25, 12)));
  res.push(trait([[7.1, 2.2], [5.6, 1.6]], false, GRIS), trait([[7.1, -0.9], [5.6, 0.2]], false, GRIS));
  // Cabine de commande et réservoirs d'adjuvant.
  res.push(...piece('#eef1f4', 'peinture', rectArrondi(6.0, -3.9, 8.8, -2.3, 0.1)), ...piece('#9cc9e6', 'vitre', rectArrondi(6.15, -3.75, 7.2, -2.45, 0.05)));
  res.push(...piece('#3b82f6', 'peinture', cercle(9.3, -3.6, 0.45, 14)), ...piece('#3b82f6', 'peinture', cercle(9.3, -2.7, 0.45, 14)));
  res.push(texte('Centrale à béton', 0.4, -4.8, 0.5));
  return res;
}

/** Citerne à gasoil sur bac de rétention : bac gris, citerne rouge, 2 trous d'homme, groupe de distribution. */
export function citerneGasoil() {
  const res = [];
  res.push(plein('#c4cad0', 'metal', rectArrondi(-2.4, -1.3, 2.4, 1.3, 0.1), rectArrondi(-2.25, -1.15, 2.25, 1.15, 0.06)), trait(rectArrondi(-2.4, -1.3, 2.4, 1.3, 0.1), true), plein('#7b8794', 'metal', rectArrondi(-2.25, -1.15, 2.25, 1.15, 0.06)));
  for (let x = -2.1; x < 2.2; x += 0.3) res.push(trait([[x, -1.1], [x, 1.1]], false, '#6b7280'));
  res.push(...piece('#c23b3b', 'peinture', rectArrondi(-1.9, -0.8, 1.7, 0.8, 0.75)));
  res.push(trait([[-0.6, -0.78], [-0.6, 0.78]], false, '#8f2a2a'), trait([[0.6, -0.78], [0.6, 0.78]], false, '#8f2a2a'));
  for (const x of [-1.2, 0.0]) res.push(...piece('#aeb4ba', 'metal', cercle(x, 0, 0.22, 16)), trait(cercle(x, 0, 0.13, 12), true));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(1.75, -0.4, 2.2, 0.4, 0.05)), trait([[2.2, 0.2], [2.5, 0.8]], false, NOIR));
  res.push(texte('GASOIL', -0.55, 0.0, 0.4));
  return res;
}

/** Éclair dans un triangle d'avertissement (armoire électrique). */
function triangleEclair(x, y, h) {
  const u = h / 10;
  const tri = [[-5.5, -4.5], [5.5, -4.5], [0, 5]].map(([a, b]) => [x + a * u, y + b * u]);
  const inte = [[-3.9, -3.3], [3.9, -3.3], [0, 3.4]].map(([a, b]) => [x + a * u, y + b * u]);
  const ec = [[0.9, 2.3], [-2.0, -0.2], [-0.1, -0.2], [-0.9, -2.5], [2.0, 0.3], [0.2, 0.3]].map(([a, b]) => [x + a * u, y + b * u]);
  return [plein('#1b1f24', 'trait', tri), plein(PERRIN_JAUNE, 'peinture', inte), plein('#1b1f24', 'trait', ec)];
}

/** Armoire électrique de chantier (coffret orange sur pieds) avec son triangle « danger électrique ». */
export function armoireElectrique() {
  const res = [];
  res.push(...piece(GRIS, 'metal', rectArrondi(-0.5, -0.3, 0.5, 0.3, 0.03)));
  res.push(...piece('#f08c00', 'peinture', rectArrondi(-0.45, -0.22, 0.45, 0.22, 0.05)));
  res.push(trait([[0.02, -0.2], [0.02, 0.2]], false, '#b36200'), ...piece('#2b2f33', 'caoutchouc', cercle(0.08, 0, 0.02, 6)));
  for (let y = -0.14; y < 0.16; y += 0.07) res.push(trait([[0.28, y], [0.4, y]], false, '#b36200'));
  res.push(...triangleEclair(-0.22, 0, 0.3));
  return res;
}

/** Mât d'éclairage mobile : remorque, 4 appuis, mât et tête à 4 projecteurs. */
export function matEclairage() {
  const res = [];
  for (const [x, y] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
    res.push(trait([[x * 0.55, y * 0.5], [x, y]], false, GRIS), ...piece(CLAIR, 'metal', rectArrondi(x - 0.2, y - 0.2, x + 0.2, y + 0.2, 0.03)));
  }
  res.push(...pneu(-0.3, -0.85, 0.3, -0.62), ...pneu(-0.3, 0.62, 0.3, 0.85));
  res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-1.05, -0.55, 1.05, 0.55, 0.1)), trait([[-1.05, 0], [-1.7, 0]], false, GRIS));
  res.push(...piece('#d9a90f', 'peinture', rectArrondi(-0.9, -0.42, 0.2, 0.42, 0.06)), ...piece(GRIS, 'metal', cercle(0.55, 0, 0.14, 12)));
  res.push(...piece('#3a3f45', 'metal', rectArrondi(-0.7, -0.09, 0.7, 0.09, 0.02)), ...piece('#3a3f45', 'metal', rectArrondi(-0.09, -0.7, 0.09, 0.7, 0.02)));
  for (const [x, y] of [[-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7]]) res.push(...piece('#3a3f45', 'metal', cercle(x, y, 0.16, 12)), plein('#fff4cc', 'phare', cercle(x, y, 0.11, 12)));
  return res;
}

/** Extincteur : carré rouge de sécurité incendie avec le pictogramme blanc de l'extincteur. */
export function extincteur() {
  const res = [...piece('#d42b2b', 'peinture', rectArrondi(-0.3, -0.3, 0.3, 0.3, 0.03))];
  res.push(plein('#ffffff', 'blanc', rectArrondi(-0.08, -0.2, 0.08, 0.06, 0.05)), plein('#ffffff', 'blanc', rectArrondi(-0.05, 0.06, 0.05, 0.12, 0.02)));
  res.push(plein('#ffffff', 'blanc', [[-0.05, 0.12], [0.1, 0.17], [0.1, 0.13], [0.0, 0.1]]), plein('#ffffff', 'blanc', [[-0.12, 0.1], [-0.05, 0.1], [-0.05, 0.14], [-0.12, 0.14]]));
  res.push(trait([[-0.1, 0.12], [-0.2, 0.0], [-0.17, -0.12]], false, '#ffffff'));
  res.push(plein('#ffffff', 'blanc', [[0.12, -0.2], [0.2, -0.05], [0.12, 0.0], [0.17, -0.08]].slice(0, 3)));
  return res;
}

/** Poste de lavage des roues : rampes d'accès, bassin à caillebotis, rampes de buses, bac de décantation. */
export function lavageRoues() {
  const res = [];
  res.push(...piece('#7b8794', 'metal', rectArrondi(-3.0, -2.2, 3.0, 2.2, 0.06)));
  for (const s of [-1, 1]) {
    const rampe = [[s * 4.6, -2.0], [s * 3.0, -2.2], [s * 3.0, 2.2], [s * 4.6, 2.0]];
    res.push(...piece('#a8b0b8', 'metal', rampe));
    for (let i = 1; i < 6; i++) res.push(trait([[s * (3.0 + i * 0.27), -2.15 + i * 0.03], [s * (3.0 + i * 0.27), 2.15 - i * 0.03]], false, '#6b7280'));
  }
  res.push(...piece('#7fb8d6', 'vitre', rectArrondi(-2.5, -1.6, 2.5, 1.6, 0.05)));
  for (let x = -2.4; x < 2.5; x += 0.2) res.push(trait([[x, -1.55], [x, 1.55]], false, '#3a3f45'));
  res.push(trait([[-2.5, 0], [2.5, 0]], false, '#3a3f45'));
  for (const y of [-1.9, 1.9]) {
    res.push(...piece(PERRIN_JAUNE, 'peinture', rectArrondi(-2.4, y - 0.08, 2.4, y + 0.08, 0.03)));
    for (let x = -2.2; x < 2.3; x += 0.4) res.push(plein('#1f6fb5', 'phare', cercle(x, y, 0.045, 8)));
  }
  res.push(...piece('#3a3f45', 'metal', rectArrondi(3.2, -2.0, 3.9, -1.2, 0.05)), ...piece('#aeb4ba', 'metal', cercle(3.55, -1.6, 0.2, 12)));
  res.push(texte('Lavage roues', 0, 2.9, 0.45));
  return res;
}

// ------------------------------------------------------------------ Base-vie (autres)

/** Abri à vélos : toiture ondulée translucide, 6 poteaux, 6 vélos vus de dessus. */
export function abriVelos() {
  const res = [];
  // Sol de l'abri, puis 6 vélos vus de dessus (2 roues, cadre, guidon), puis la toiture (cadre et nervures, sans voile).
  res.push(plein('#d8dde2', 'metal', rectArrondi(-2.3, -1.15, 2.3, 1.15, 0.04)));
  for (let i = 0; i < 6; i++) {
    const x = -1.8 + i * 0.72;
    res.push(...piece('#1f2937', 'caoutchouc', ellipse(x, -0.52, 0.07, 0.36, 12)), ...piece('#1f2937', 'caoutchouc', ellipse(x, 0.52, 0.07, 0.36, 12)));
    res.push(...piece(['#d63a3a', '#1f5fae', '#2f9e55', '#f08c00', '#7c3aed', '#0e7490'][i], 'peinture', epais([[x, -0.5], [x, 0.4]], 0.05)), ...piece('#1f2937', 'caoutchouc', rectArrondi(x - 0.25, 0.74, x + 0.25, 0.8, 0.02)), ...piece('#1f2937', 'caoutchouc', rectArrondi(x - 0.07, 0.15, x + 0.07, 0.3, 0.03)));
  }
  res.push(trait(rectArrondi(-2.3, -1.15, 2.3, 1.15, 0.04), true, '#475569'));
  for (let x = -2.0; x < 2.2; x += 0.5) res.push(trait([[x, -1.15], [x, 1.15]], false, '#94a3b8'));
  for (const [x, y] of [[-2.25, -1.1], [0, -1.1], [2.25, -1.1], [-2.25, 1.1], [0, 1.1], [2.25, 1.1]]) res.push(...piece(GRIS, 'metal', rectArrondi(x - 0.08, y - 0.08, x + 0.08, y + 0.08, 0.01)));
  return res;
}

/** Place de parking réservée : une seule place, fond transparent, contour et lettre P bleus (retour du 23.11). */
export function parkingReserve() {
  const res = [];
  const BLEU = '#1f5fae';
  res.push(plein(BLEU, 'peinture', rectArrondi(-1.3, -2.6, 1.3, 2.6, 0.04), rectArrondi(-1.2, -2.5, 1.2, 2.5, 0.03)));
  // Lettre P bleue : fût et panse (anneau en demi-cercle).
  const panse = [[-0.06, 1.2], [0.04, 1.2], ...arc(0.04, 0.95, 0.25, 90, -90, 10), [0.04, 0.7], [-0.06, 0.7]];
  const trou = [[-0.06, 1.08], [0.04, 1.08], ...arc(0.04, 0.95, 0.13, 90, -90, 8), [0.04, 0.82], [-0.06, 0.82]];
  res.push(plein(BLEU, 'peinture', [[-0.3, 0.4], [-0.06, 0.4], [-0.06, 1.3], [-0.3, 1.3]]), plein(BLEU, 'peinture', panse, trou));
  return res;
}

// ------------------------------------------------------------------ Stockage

/**
 * Banche de coffrage avec lest, vue de dessus (0.293.0, d'après la photo de l'utilisateur) : le coffrant orange (devant,
 * y mini), la passerelle de travail grillagée avec garde-corps derrière, 2 étais obliques en acier jusqu'au sol et 2 blocs
 * de lest en béton posés sur les pieds des étais.
 */
export function stockBanches() {
  const res = [];
  const L = 3.0;
  // Lest : 2 blocs de béton au pied des étais.
  for (const x of [-1.0, 1.0]) {
    res.push(...piece('#a8adb2', 'beton', rectArrondi(x - 0.35, 1.05, x + 0.35, 1.7, 0.03), '#6b7280'), trait([[x - 0.35, 1.375], [x + 0.35, 1.375]], false, '#7b848d'));
    res.push(...piece('#d63a3a', 'peinture', rectArrondi(x - 0.05, 1.3, x + 0.05, 1.45, 0.02)));
  }
  // Étais : de la passerelle (y = 0.5) au pied lesté (y = 1.4), avec le vérin au milieu.
  for (const x of [-1.0, 1.0]) {
    res.push(...piece('#5f666d', 'metal', epais([[x, 0.45], [x, 1.2]], 0.08)), ...piece('#e0a23c', 'peinture', epais([[x, 0.75], [x, 1.0]], 0.12)));
    res.push(...piece(METAL, 'metal', cercle(x, 0.45, 0.07, 10)));
  }
  // Passerelle : plancher grillagé et garde-corps (lisses sur 3 côtés).
  res.push(...piece('#c9ced3', 'metal', rectArrondi(-L / 2, 0.12, L / 2, 0.95, 0.02), '#5f666d'));
  for (let x = -L / 2 + 0.1; x < L / 2; x += 0.1) res.push(trait([[x, 0.15], [x, 0.92]], false, '#9aa3ab'));
  res.push(trait([[-L / 2 + 0.03, 0.15], [-L / 2 + 0.03, 0.92], [L / 2 - 0.03, 0.92], [L / 2 - 0.03, 0.15]], false, '#d63a3a'));
  for (const x of [-L / 2 + 0.03, 0, L / 2 - 0.03]) res.push(plein('#d63a3a', 'peinture', rectArrondi(x - 0.04, 0.89, x + 0.04, 0.97, 0.01)));
  // Coffrant orange à nervures (devant) et poutres verticales.
  res.push(...piece('#e0a23c', 'peinture', rectArrondi(-L / 2, -0.12, L / 2, 0.12, 0.02), '#a76e12'));
  for (let x = -L / 2 + 0.25; x < L / 2; x += 0.5) res.push(trait([[x, -0.1], [x, 0.1]], false, '#a76e12'));
  res.push(...piece('#5f666d', 'metal', rectArrondi(-L / 2 - 0.04, -0.14, -L / 2 + 0.04, 0.14)), ...piece('#5f666d', 'metal', rectArrondi(L / 2 - 0.04, -0.14, L / 2 + 0.04, 0.14)));
  return res;
}

/** Palette de tuyaux PVC : 8 tuyaux orange à emboîtement, 3 sangles, cales en bois. */
export function paletteTuyaux() {
  const res = [];
  for (const x of [-2.7, 0, 2.7]) res.push(...piece('#a9744a', 'gravats', rectArrondi(x - 0.12, -0.7, x + 0.12, 0.7, 0.02)));
  for (let i = 0; i < 8; i++) {
    const y = -0.52 + i * 0.148;
    res.push(...piece('#c8682a', 'peinture', rectArrondi(-3.0, y - 0.068, 3.0, y + 0.068, 0.06)), ...piece('#9c4a14', 'peinture', rectArrondi(2.3, y - 0.082, 3.0, y + 0.082, 0.07)), trait([[-2.9, y - 0.02], [2.2, y - 0.02]], false, '#e8934f'));
  }
  for (const x of [-2.0, 0, 2.0]) res.push(...piece('#1b1f24', 'caoutchouc', rectArrondi(x - 0.03, -0.62, x + 0.03, 0.62, 0.01)));
  return res;
}

/** Stock d'armatures : fagot de barres d'acier, 3 liens, 2 cales. */
export function stockArmatures() {
  const res = [];
  for (const x of [-2.2, 2.2]) res.push(...piece('#a9744a', 'gravats', rectArrondi(x - 0.1, -0.6, x + 0.1, 0.6, 0.02)));
  for (let i = 0; i < 15; i++) {
    const y = -0.5 + i * 0.071 + ((i * 7) % 3) * 0.004;
    const l = 3.0 + ((i * 5) % 3) * 0.08;
    res.push(...piece(i % 3 ? '#5b6672' : '#75808c', 'metal', rectArrondi(-l, y - 0.03, l - ((i * 3) % 4) * 0.1, y + 0.03, 0.03), '#2f3640'));
  }
  for (const x of [-1.9, 0, 1.9]) res.push(...piece('#b9561a', 'peinture', rectArrondi(x - 0.04, -0.58, x + 0.04, 0.58, 0.01)));
  return res;
}

/** Treillis soudés empilés : panneau 5 × 2,4 m, maillage de 15 cm. */
export function stockTreillis() {
  const res = [...piece('#7b8794', 'metal', rectArrondi(-2.5, -1.2, 2.5, 1.2, 0.03))];
  res.push(...piece('#9aa3ab', 'metal', rectArrondi(-2.46, -1.16, 2.46, 1.16, 0.02)));
  for (let x = -2.4; x < 2.45; x += 0.15) res.push(trait([[x, -1.15], [x, 1.15]], false, '#475569'));
  for (let y = -1.12; y < 1.2; y += 0.15) res.push(trait([[-2.45, y], [2.45, y]], false, '#334155'));
  res.push(...piece('#b9561a', 'peinture', rectArrondi(-0.04, -1.2, 0.04, 1.2, 0.01)));
  return res;
}

/** Regards préfabriqués en béton : 4 éléments Ø 1,2 m, vus de dessus (anneau, cône, fond). */
export function stockRegards() {
  const res = [];
  for (const [x, y] of [[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]]) {
    res.push(plein('#b8bcc0', 'metal', cercle(x, y, 0.6, 28), cercle(x, y, 0.44, 24)), trait(cercle(x, y, 0.6, 28), true), plein('#7b8794', 'metal', cercle(x, y, 0.44, 24)), trait(cercle(x, y, 0.3, 20), true, '#5f666d'), plein('#3a3f45', 'metal', cercle(x, y, 0.16, 14)));
  }
  return res;
}

/** Big-bags : 4 sacs de 1 m³ (2 × 2) avec leurs anses et leurs coutures. */
export function stockBigBags() {
  const res = [];
  for (const [x, y] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    res.push(...piece('#d8cfb8', 'gravats', rectArrondi(x - 0.46, y - 0.46, x + 0.46, y + 0.46, 0.12), '#8a7f63'));
    res.push(trait([[x - 0.46, y], [x + 0.46, y]], false, '#b8ad92'), trait([[x, y - 0.46], [x, y + 0.46]], false, '#b8ad92'));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) res.push(trait(arc(x + a * 0.36, y + b * 0.36, 0.1, 0, 360, 10), true, '#3f4448'));
  }
  return res;
}

/** Sacs sur palette : 6 sacs de ciment ou de sable (3 × 2) sur une palette bois. */
export function sacsPalette() {
  const res = [...piece('#a9744a', 'gravats', rectArrondi(-0.6, -0.5, 0.6, 0.5, 0.02))];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = -0.4 + i * 0.4;
    const y = -0.25 + j * 0.5;
    res.push(...piece('#c7c1b1', 'gravats', rectArrondi(x - 0.18, y - 0.23, x + 0.18, y + 0.23, 0.07), '#7a745f'), trait([[x - 0.1, y], [x + 0.1, y]], false, '#a39d88'));
  }
  return res;
}

/** Palette de parpaings : 3 × 5 blocs gris sur palette. */
export function paletteParpaings() {
  const res = [...piece('#a9744a', 'gravats', rectArrondi(-0.6, -0.5, 0.6, 0.5, 0.02))];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
    const x0 = -0.57 + i * 0.38;
    const y0 = -0.48 + j * 0.192;
    res.push(...piece(j % 2 ? '#9ca0a4' : '#a8acb0', 'gravats', rectArrondi(x0, y0, x0 + 0.36, y0 + 0.18, 0.01), '#6b7075'));
  }
  return res;
}

/** Plaques de roulage en acier : 2 plaques de 3 × 1,5 m bord à bord, antidérapant, 4 trous de levage chacune. */
export function plaquesRoulage() {
  const res = [];
  for (const x0 of [-3.0, 0]) {
    res.push(...piece('#8a9198', 'metal', rectArrondi(x0 + 0.01, -0.75, x0 + 2.99, 0.75, 0.03)));
    for (let t = -1.4; t < 3.0; t += 0.25) {
      const a = [Math.max(x0 + 0.06, x0 + 0.06 + t), -0.7 + Math.max(0, x0 + 0.06 - (x0 + 0.06 + t)) * 1];
      const b = [Math.min(x0 + 2.94, x0 + 0.06 + t + 1.4), -0.7 + Math.min(1.4, x0 + 2.94 - (x0 + 0.06 + t))];
      if (b[0] > a[0] + 0.05) res.push(trait([a, b], false, '#6b7280'));
    }
    for (const [dx, dy] of [[0.2, 0.55], [2.8, 0.55], [0.2, -0.55], [2.8, -0.55]]) res.push(plein('#3a3f45', 'metal', cercle(x0 + dx, dy, 0.07, 8)));
  }
  return res;
}

/** Bobine de câble : 2 flasques en bois, tambour de câble noir enroulé. */
export function bobineCable() {
  const res = [];
  res.push(...piece('#b88955', 'gravats', rectArrondi(-0.62, -0.85, -0.5, 0.85, 0.02)), ...piece('#b88955', 'gravats', rectArrondi(0.5, -0.85, 0.62, 0.85, 0.02)));
  res.push(...piece('#2b2f33', 'caoutchouc', rectArrondi(-0.5, -0.62, 0.5, 0.62, 0.02)));
  for (let x = -0.46; x < 0.5; x += 0.07) res.push(trait([[x, -0.6], [x, 0.6]], false, '#5b6672'));
  res.push(...piece(PERRIN_ORANGE, 'peinture', rectArrondi(-0.1, -0.1, 0.1, 0.1, 0.02)));
  return res;
}
void deplacer;
