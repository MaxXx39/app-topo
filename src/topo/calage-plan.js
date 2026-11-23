// Calage de plans (0.278.0, module repris de l'appli « Calage de plans », dépôt MaxXx39/Calage-Plan,
// calage_core/points.py et geometrie.py) : caler un plan reçu (architecte, ingénieur : ses unités, sa rotation, son
// origine) sur la référence MN95 du projet par des éléments homologues cliqués sur les deux plans.
//
// La transformation est une SIMILITUDE : x' = échelle · R(rotation) · x + translation (aucune déformation).
// On l'écrit avec des nombres complexes : z' = a·z + b, avec a = échelle · e^(i·rotation) et b = translation.
//
// Éléments : { type: 'point' | 'axe', role: 'calage' | 'verification', plan, ref }
//  - point : plan = [x, y], ref = [E, N] → 2 équations ;
//  - axe   : plan = [x1, y1, x2, y2], ref = [E1, N1, E2, N2] : la droite du plan doit tomber SUR la droite de la
//    référence (les deux points cliqués du plan sur la droite de référence) → 2 équations, peu importe où l'on a
//    cliqué le long de l'axe.
// Toutes ces équations sont linéaires en (a, b) : moindres carrés. Combinaisons valables : 2 points ; 1 point + 1 axe ;
// 3 axes ou plus qui ne se croisent pas tous au même point (ex. 2 façades parallèles + 1 perpendiculaire). Deux axes
// seuls ne suffisent pas (l'échelle n'est pas connue).
// Les éléments « vérification » n'entrent pas dans le calcul : leur écart dit si le calage est juste.
//
// Seuils de la vérification (décidés par l'utilisateur le 22.11) : ≤ 2 mm juste (vert), ≤ 4 mm à revoir (orange),
// au-delà faux (rouge). L'échelle est arrondie à la puissance de 10 la plus proche (0,01 pour un plan en cm, 0,001 en
// mm) si elle en est à moins de 0,5 %. Coordonnées en mètres pour la référence (MN95), dans les unités du plan sinon.

export const SEUIL_JUSTE_M = 0.002;
export const SEUIL_A_REVOIR_M = 0.004;
export const TOLERANCE_ARRONDI_ECHELLE = 0.005;

/** Erreur de calage : message pour l'utilisateur (combinaison d'éléments impossible…). */
export class ErreurCalage extends Error {}

// --- Similitude ---

/** Similitude { echelle, rotationDeg (0 à 360, sens trigonométrique), tx, ty } depuis a = [re, im] et b = [re, im]. */
export function similitudeDepuisComplexes([ar, ai], [br, bi]) {
  const rotation = (Math.atan2(ai, ar) * 180) / Math.PI;
  return { echelle: Math.hypot(ar, ai), rotationDeg: ((rotation % 360) + 360) % 360, tx: br, ty: bi };
}

/** Partie « a » (complexe [re, im]) d'une similitude. */
function partieA(s) {
  const r = (s.rotationDeg * Math.PI) / 180;
  return [s.echelle * Math.cos(r), s.echelle * Math.sin(r)];
}

/** Applique la similitude au point [x, y] : renvoie [x', y']. */
export function appliquerSimilitude(s, [x, y]) {
  const [ar, ai] = partieA(s);
  return [ar * x - ai * y + s.tx, ai * x + ar * y + s.ty];
}

/** Similitude inverse (de la référence vers le plan). */
export function inverserSimilitude(s) {
  const [ar, ai] = partieA(s);
  const n = ar * ar + ai * ai;
  const [ir, ii] = [ar / n, -ai / n]; // 1 / a
  return similitudeDepuisComplexes([ir, ii], [-(ir * s.tx - ii * s.ty), -(ii * s.tx + ir * s.ty)]);
}

/** s ∘ avant : on applique d'abord « avant », puis « s ». */
export function composerSimilitudes(s, avant) {
  const [ar, ai] = partieA(s);
  const [cr, ci] = partieA(avant);
  return similitudeDepuisComplexes([ar * cr - ai * ci, ar * ci + ai * cr], [ar * avant.tx - ai * avant.ty + s.tx, ai * avant.tx + ar * avant.ty + s.ty]);
}

/** Puissance de 10 la plus proche (en logarithme) : 0,0098 → 0,01. */
export function puissanceDeDix(s) {
  return 10 ** Math.round(Math.log10(s));
}

// --- Moindres carrés ---

/** Résout le système 4 × 4 (ou n × n) M·x = v par la méthode de Gauss avec pivot ; null s'il est singulier. */
function resoudre(M, v) {
  const n = v.length;
  const A = M.map((ligne, i) => [...ligne, v[i]]);
  const plusGrand = Math.max(...M.map((l, i) => Math.abs(l[i]))) || 1;
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let l = c + 1; l < n; l += 1) if (Math.abs(A[l][c]) > Math.abs(A[pivot][c])) pivot = l;
    if (Math.abs(A[pivot][c]) < 1e-12 * plusGrand) return null;
    [A[c], A[pivot]] = [A[pivot], A[c]];
    for (let l = c + 1; l < n; l += 1) {
      const f = A[l][c] / A[c][c];
      for (let k = c; k <= n; k += 1) A[l][k] -= f * A[c][k];
    }
  }
  const x = Array(n).fill(0);
  for (let l = n - 1; l >= 0; l -= 1) {
    let somme = A[l][n];
    for (let k = l + 1; k < n; k += 1) somme -= A[l][k] * x[k];
    x[l] = somme / A[l][l];
  }
  return x;
}

/** Moindres carrés : lignes = [[...coefficients]], seconds = [...] ; colonnes mises à l'échelle pour la précision. */
function moindresCarres(lignes, seconds) {
  const n = lignes[0].length;
  const norme = Array.from({ length: n }, (_, j) => Math.hypot(...lignes.map((l) => l[j])) || 1);
  const L = lignes.map((l) => l.map((v, j) => v / norme[j]));
  const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => L.reduce((s, l) => s + l[i] * l[j], 0)));
  const v = Array.from({ length: n }, (_, i) => L.reduce((s, l, k) => s + l[i] * seconds[k], 0));
  const x = resoudre(M, v);
  return x ? x.map((val, j) => val / norme[j]) : null;
}

// --- Équations des éléments (coordonnées déjà ramenées près de 0 : plan − centrePlan, ref − centreRef) ---

/** Lignes [ar, ai, br, bi] et seconds membres d'un élément (z_ref = a·z_plan + b). */
function equations(e, cp, cr) {
  if (e.type === 'point') {
    const [x, y] = [e.plan[0] - cp[0], e.plan[1] - cp[1]];
    const [u, v] = [e.ref[0] - cr[0], e.ref[1] - cr[1]];
    return { lignes: [[x, -y, 1, 0], [y, x, 0, 1]], seconds: [u, v] };
  }
  const [x1, y1, x2, y2] = [e.plan[0] - cp[0], e.plan[1] - cp[1], e.plan[2] - cp[0], e.plan[3] - cp[1]];
  const [u1, v1, u2, v2] = [e.ref[0] - cr[0], e.ref[1] - cr[1], e.ref[2] - cr[0], e.ref[3] - cr[1]];
  const longueur = Math.hypot(u2 - u1, v2 - v1);
  if (longueur === 0 || Math.hypot(x2 - x1, y2 - y1) === 0) throw new ErreurCalage('Axe de longueur nulle : cliquez sur une ligne.');
  const [dx, dy] = [(u2 - u1) / longueur, (v2 - v1) / longueur];
  // Distance signée du point du plan, une fois calé, à la droite de référence = 0.
  const ligne = (x, y) => [y * dx - x * dy, x * dx + y * dy, -dy, dx];
  return { lignes: [ligne(x1, y1), ligne(x2, y2)], seconds: [v1 * dx - u1 * dy, v1 * dx - u1 * dy] };
}

/** Écart d'un élément après calage : point = distance ; axe = plus grande distance à la droite + angle (degrés). */
export function ecartElement(e, s) {
  if (e.type === 'point') {
    const [x, y] = appliquerSimilitude(s, e.plan);
    return { ecartM: Math.hypot(x - e.ref[0], y - e.ref[1]) };
  }
  const [u1, v1, u2, v2] = e.ref;
  const L = Math.hypot(u2 - u1, v2 - v1);
  const [dx, dy] = [(u2 - u1) / L, (v2 - v1) / L];
  const p1 = appliquerSimilitude(s, [e.plan[0], e.plan[1]]);
  const p2 = appliquerSimilitude(s, [e.plan[2], e.plan[3]]);
  const distance = ([x, y]) => Math.abs((x - u1) * dy - (y - v1) * dx);
  const angle = Math.abs(((Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.atan2(dy, dx)) * 180) / Math.PI) % 180;
  return { ecartM: Math.max(distance(p1), distance(p2)), ecartAngleDeg: Math.min(angle, 180 - angle) };
}

/**
 * Avec des axes seuls, l'échelle n'est connue que s'ils ne passent pas tous par un même point : au moins 3 axes,
 * pas tous parallèles, et soit une paire parallèle, soit des croisements à des endroits différents.
 */
function verifierAxesSeuls(segments) {
  if (segments.length < 3) {
    throw new ErreurCalage('Avec des axes seulement, il en faut au moins 3 (par exemple 2 axes parallèles et 1 perpendiculaire), ou ajoutez un point.');
  }
  const angles = segments.map(([x1, y1, x2, y2]) => ((((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI) % 180) + 180) % 180);
  const ecart = Math.max(...angles.map((a) => Math.abs((((a - angles[0] + 90) % 180) + 180) % 180 - 90)));
  if (ecart < 0.5) throw new ErreurCalage('Les axes sont tous parallèles : ajoutez un axe perpendiculaire ou un point.');
  const xs = segments.flatMap((s) => [s[0], s[2]]);
  const ys = segments.flatMap((s) => [s[1], s[3]]);
  const etendue = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const croisements = [];
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const [x1, y1, x2, y2] = segments[i];
      const [x3, y3, x4, y4] = segments[j];
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-9 * etendue ** 2) return; // une paire parallèle suffit à fixer l'échelle
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      croisements.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
    }
  }
  const ex = Math.max(...croisements.map((c) => c[0])) - Math.min(...croisements.map((c) => c[0]));
  const ey = Math.max(...croisements.map((c) => c[1])) - Math.min(...croisements.map((c) => c[1]));
  if (Math.max(ex, ey) < 1e-3 * etendue) {
    throw new ErreurCalage('Les axes se croisent tous au même point : l\'échelle n\'est pas connue. Ajoutez un axe parallèle à l\'un d\'eux, ou un point.');
  }
}

/** Centre (moyenne) des coordonnées d'éléments (champ « plan » ou « ref ») : les calculs se font près de 0. */
function centre(elements, champ) {
  const pts = elements.flatMap((e) => (e[champ].length === 2 ? [e[champ]] : [[e[champ][0], e[champ][1]], [e[champ][2], e[champ][3]]]));
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Verdict de la vérification : 'juste' (≤ 2 mm), 'a-revoir' (≤ 4 mm), 'faux' (au-delà), 'sans-verification'. */
export function verdictEcart(ecartM) {
  if (ecartM <= SEUIL_JUSTE_M) return 'juste';
  if (ecartM <= SEUIL_A_REVOIR_M) return 'a-revoir';
  return 'faux';
}

const mm = (m) => `${(m * 1000).toFixed(1)} mm`;

/**
 * Calage par éléments homologues. elements : voir en tête du fichier. Renvoie { similitude, echelleBrute,
 * echelleArrondie, elements (avec ecartM, ecartAngleDeg pour les axes), verdict, message, methode }.
 * Lance ErreurCalage (message clair) si la combinaison ne permet pas de caler.
 */
export function caler(elements, { arrondirEchelle = true } = {}) {
  const calage = elements.filter((e) => (e.role ?? 'calage') === 'calage');
  const verifications = elements.filter((e) => e.role === 'verification');
  if (calage.length === 0) throw new ErreurCalage('Aucun élément de calage.');
  const nbPoints = calage.filter((e) => e.type === 'point').length;
  if (nbPoints === 0) verifierAxesSeuls(calage.map((e) => e.plan));
  if (nbPoints > 0 && calage.length < 2) throw new ErreurCalage('Il faut au moins 2 éléments de calage (2 points, ou 1 point et 1 axe…).');
  if (nbPoints >= 2 && calage.length === 2) {
    const [p, q] = calage;
    if (p.type === 'point' && q.type === 'point' && (Math.hypot(p.plan[0] - q.plan[0], p.plan[1] - q.plan[1]) < 1e-9 || Math.hypot(p.ref[0] - q.ref[0], p.ref[1] - q.ref[1]) < 1e-9)) {
      throw new ErreurCalage('Les 2 points de calage sont confondus : choisissez des points éloignés.');
    }
  }
  const cp = centre(calage, 'plan');
  const cr = centre(calage, 'ref');
  const lignes = [];
  const seconds = [];
  for (const e of calage) {
    const eq = equations(e, cp, cr);
    lignes.push(...eq.lignes);
    seconds.push(...eq.seconds);
  }
  const solution = lignes.length >= 4 ? moindresCarres(lignes, seconds) : null;
  if (!solution) {
    throw new ErreurCalage('Calage indéterminé : il faut 2 points, ou 1 point et 1 axe, ou 3 axes (pas tous parallèles, pas tous croisés au même point).');
  }
  let [ar, ai, br, bi] = solution;
  const echelleBrute = Math.hypot(ar, ai);
  let echelleArrondie = false;
  if (arrondirEchelle) {
    const s10 = puissanceDeDix(echelleBrute);
    if (Math.abs(echelleBrute / s10 - 1) < TOLERANCE_ARRONDI_ECHELLE) {
      [ar, ai] = [(ar * s10) / echelleBrute, (ai * s10) / echelleBrute];
      echelleArrondie = true;
      // Translation recalculée avec l'échelle fixée (moindres carrés sur br, bi seulement).
      const t = moindresCarres(lignes.map((l) => [l[2], l[3]]), seconds.map((s, k) => s - lignes[k][0] * ar - lignes[k][1] * ai));
      [br, bi] = t;
    }
  }
  // Retour aux vraies coordonnées : z_ref = a·(z_plan − cp) + b' + cr  →  b = b' + cr − a·cp.
  const b = [br + cr[0] - (ar * cp[0] - ai * cp[1]), bi + cr[1] - (ai * cp[0] + ar * cp[1])];
  const similitude = similitudeDepuisComplexes([ar, ai], b);
  if (echelleArrondie) similitude.echelle = puissanceDeDix(echelleBrute);

  const evalues = elements.map((e) => ({ ...e, role: e.role ?? 'calage', ...ecartElement(e, similitude) }));
  const ecartsCalage = evalues.filter((e) => e.role === 'calage').map((e) => e.ecartM);
  const ecartsVerif = evalues.filter((e) => e.role === 'verification').map((e) => e.ecartM);
  const interne = Math.max(0, ...ecartsCalage);
  let verdict;
  let message;
  if (!verifications.length) {
    verdict = 'sans-verification';
    message = 'Pas de vérification : cliquez un point de plus sur les deux plans pour savoir si le calage est juste.';
    if (interne > SEUIL_JUSTE_M) message += ` Écart entre les éléments de calage : ${mm(interne)}.`;
  } else {
    const pire = Math.max(...ecartsVerif);
    verdict = verdictEcart(pire);
    message = {
      juste: `Vérification : le point tombe à ${mm(pire)} de sa place. Le calage est juste.`,
      'a-revoir': `Vérification : le point tombe à ${mm(pire)} de sa place. À revoir (clic imprécis ?).`,
      faux: `Vérification : le point tombe à ${pire < 1 ? mm(pire) : `${pire.toFixed(2)} m`} de sa place. Le calage est FAUX : les éléments cliqués ne sont pas les mêmes sur les deux plans, ou le plan n'est pas assez précis.`,
    }[verdict];
  }
  if (arrondirEchelle && !echelleArrondie) message += ` Échelle ${echelleBrute.toPrecision(6)} : pas une puissance de 10 (unités inhabituelles ?).`;
  else if (echelleArrondie && interne > SEUIL_JUSTE_M && verifications.length) message += ` Écart sur les éléments de calage : ${mm(interne)}.`;
  return {
    similitude, echelleBrute, echelleArrondie, elements: evalues, verdict, message,
    methode: calage.some((e) => e.type === 'axe') ? 'axes et points' : 'points',
  };
}

/**
 * Paramètres de recalage de Topo ({ a, b, tEst, tNord, echelle, rotation (radians) }, voir topo/recalage.js,
 * appliquerHelmert) depuis une similitude : le plan calé s'affiche, s'accroche et s'exporte comme un plan recalé.
 */
export function versHelmert(s) {
  const [a, b] = partieA(s);
  return { a, b, tEst: s.tx, tNord: s.ty, echelle: s.echelle, rotation: Math.atan2(b, a) };
}

const MESSAGES_AUTO = {
  forte: 'Calage automatique trouvé, confiance FORTE. Regardez la superposition et cliquez un point de vérification pour en être sûr.',
  moyenne: 'Calage automatique trouvé, confiance MOYENNE : cliquez un ou deux points de vérification avant de continuer.',
  faible: 'Calage automatique INCERTAIN : probablement faux. Calez à la main (points ou axes).',
};

/**
 * Résultat d'un calage automatique (0.281.0, topo/calage-auto.js), présenté comme celui de caler() : les éléments
 * (ici seulement des vérifications) sont évalués avec la similitude trouvée. auto : retour de calerAutomatiquement
 * (+ sources). Même verdict que caler() quand il y a des vérifications ; sinon « sans-verification ».
 */
export function resultatAutomatique(auto, elements = []) {
  const similitude = { ...auto.similitude };
  // Tous les éléments sont évalués (mêmes rangs que la liste) ; seules les vérifications font le verdict.
  const evalues = elements.map((e) => ({ ...e, role: e.role ?? 'calage', ...ecartElement(e, similitude) }));
  const ecarts = evalues.filter((e) => e.role === 'verification').map((e) => e.ecartM);
  const titre = `Calage automatique (confiance ${auto.niveau}). `;
  let verdict = 'sans-verification';
  let message = MESSAGES_AUTO[auto.niveau] ?? MESSAGES_AUTO.faible;
  if (ecarts.length) {
    const pire = Math.max(...ecarts);
    verdict = verdictEcart(pire);
    message = titre + {
      juste: `Vérification : le point tombe à ${mm(pire)} de sa place. Le calage est juste.`,
      'a-revoir': `Vérification : le point tombe à ${mm(pire)} de sa place. À revoir (clic imprécis ?).`,
      faux: `Vérification : le point tombe à ${pire < 1 ? mm(pire) : `${pire.toFixed(2)} m`} de sa place. Le calage automatique est FAUX : calez à la main.`,
    }[verdict];
  }
  return {
    similitude, echelleBrute: auto.echelleBrute ?? similitude.echelle, echelleArrondie: Boolean(auto.echelleArrondie),
    elements: evalues, verdict, message, methode: 'automatique', confiance: auto.niveau, auto,
  };
}

/**
 * Droite ajustée sur des points levés (un axe dont on a levé des points : bornes sur l'axe, axe implanté) : moindres
 * carrés orthogonaux (la droite qui passe au mieux par tous les points). points : [[E, N], …], au moins 2 distincts.
 * Renvoie { segment: [E1, N1, E2, N2] (du premier au dernier point projetés sur la droite), ecartMaxM, ecartMoyenM }
 * (écart = distance d'un point à la droite). Lance ErreurCalage s'il n'y a pas 2 points distincts.
 */
export function droiteParPoints(points) {
  if (points.length < 2) throw new ErreurCalage('Il faut au moins 2 points levés sur l\'axe.');
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  if (sxx + syy < 1e-12) throw new ErreurCalage('Les points de l\'axe sont confondus : choisissez des points éloignés.');
  // Direction principale du nuage de points.
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const abscisse = (p) => (p[0] - mx) * ux + (p[1] - my) * uy;
  const ecarts = points.map((p) => Math.abs(-(p[0] - mx) * uy + (p[1] - my) * ux));
  const ts = points.map(abscisse);
  const t1 = Math.min(...ts);
  const t2 = Math.max(...ts);
  return {
    segment: [mx + t1 * ux, my + t1 * uy, mx + t2 * ux, my + t2 * uy],
    ecartMaxM: Math.max(...ecarts),
    ecartMoyenM: ecarts.reduce((s, e) => s + e, 0) / n,
  };
}
