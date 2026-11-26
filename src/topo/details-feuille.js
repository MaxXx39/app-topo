// Cadres de détail de la feuille (0.333.0, demande du 26.11) : jusqu'à 2 cadres montrant un AUTRE endroit du plan, à leur propre
// échelle, avec titre, bord et fond au choix ; un repère (rectangle ou cercle + lettre) sur le plan principal montre d'où vient le détail.
// Rangés dans `plan.feuille.details` [{ id, lettre, titre, centre [est, nord], echelle, forme ('rectangle' | 'rond'), fw, fh (taille,
// fractions du cadre du plan), pos { fx, fy }, bord { epaisseur (mm), couleur, trait ('continu' | 'tirets') }, fond ('blanc' | 'photo'
// | 'carte' | 'aucun'), plans (null = comme la feuille, sinon liste d'ids de plans), repere (bool) }].

export const MAX_DETAILS = 2;
export const FONDS_DETAIL = [['blanc', 'Blanc'], ['photo', 'Photo aérienne pâlie'], ['carte', 'Carte nationale'], ['aucun', 'Transparent (plan principal derrière)']];
export const COULEURS_BORD = [['#1b2b36', 'Noir'], ['#dc2626', 'Rouge'], ['#ea580c', 'Orange'], ['#2563eb', 'Bleu']];
export const ECHELLES_DETAIL = [10, 20, 25, 50, 100, 200, 250, 500];
const LETTRES = ['A', 'B'];

/** Cadre de détail complété par ses valeurs de départ (jamais d'erreur sur un ancien projet). */
export function detailDe(d = {}, rang = 0) {
  const forme = d.forme === 'rond' ? 'rond' : 'rectangle';
  const borne = (v, mini, maxi, defaut) => Math.min(maxi, Math.max(mini, Number.isFinite(Number(v)) ? Number(v) : defaut));
  return {
    id: d.id ?? `det-${rang}`,
    lettre: d.lettre ?? LETTRES[rang] ?? String(rang + 1),
    titre: d.titre ?? `Détail ${d.lettre ?? LETTRES[rang] ?? rang + 1}`,
    centre: Array.isArray(d.centre) && d.centre.length === 2 ? [Number(d.centre[0]), Number(d.centre[1])] : null,
    echelle: borne(d.echelle, 1, 10000, 50),
    forme,
    fw: borne(d.fw, 0.1, 0.9, 0.3),
    fh: borne(d.fh, 0.1, 0.9, forme === 'rond' ? 0.3 : 0.3),
    pos: d.pos && Number.isFinite(d.pos.fx) && Number.isFinite(d.pos.fy) ? { fx: d.pos.fx, fy: d.pos.fy } : null,
    bord: {
      epaisseur: borne(d.bord?.epaisseur, 0.1, 3, 0.5),
      couleur: COULEURS_BORD.some(([c]) => c === d.bord?.couleur) ? d.bord.couleur : '#1b2b36',
      trait: d.bord?.trait === 'tirets' ? 'tirets' : 'continu',
    },
    fond: FONDS_DETAIL.some(([c]) => c === d.fond) ? d.fond : 'blanc',
    plans: Array.isArray(d.plans) ? d.plans : null,
    repere: d.repere !== false,
  };
}

/** Les cadres de détail d'une feuille (2 au plus), complétés. */
export const detailsDe = (feuille) => (Array.isArray(feuille?.details) ? feuille.details : []).slice(0, MAX_DETAILS).map((d, i) => detailDe(d, i));

/** Nouveau cadre de détail centré sur un point du terrain ; lettre libre (A, puis B). Renvoie null s'il y en a déjà 2. */
export function nouveauDetail(details, centre, echelleDuPlan = 200) {
  if (details.length >= MAX_DETAILS) return null;
  const lettre = LETTRES.find((l) => !details.some((d) => d.lettre === l)) ?? String(details.length + 1);
  const rang = LETTRES.indexOf(lettre);
  return detailDe({ id: `det-${Date.now().toString(36)}${rang}`, lettre, centre, echelle: Math.max(10, Math.round(echelleDuPlan / 4)) }, rang < 0 ? details.length : rang);
}

/** Emprise du détail sur le terrain (m) : largeur et hauteur de son cadre à son échelle. cadreMm = { l, h } du cadre du détail (mm). */
export const empriseDuDetail = (det, cadreMm) => ({ l: (cadreMm.l * det.echelle) / 1000, h: (cadreMm.h * det.echelle) / 1000 });

/**
 * Repère sur le plan principal : le contour (4 coins, ou le cercle) de ce que montre le détail, sur le terrain. rotation = celle de
 * la feuille (le détail est tourné comme le plan). Renvoie { forme, coins (4 [est, nord]) | centre + rayon, lettre }.
 */
export function repereDuDetail(det, cadreMm, rotation = 0) {
  if (!det.centre) return null;
  const { l, h } = empriseDuDetail(det, cadreMm);
  if (det.forme === 'rond') return { forme: 'rond', centre: det.centre, rayon: Math.min(l, h) / 2, lettre: det.lettre };
  const a = (rotation * Math.PI) / 180; // la direction « rotation » est en haut : un vecteur écran (x, y) devient, sur le terrain, tourné de +rotation
  const c = Math.cos(a);
  const s = Math.sin(a);
  const coin = (x, y) => [det.centre[0] + x * c - y * s, det.centre[1] + x * s + y * c];
  return { forme: 'rectangle', coins: [coin(-l / 2, h / 2), coin(l / 2, h / 2), coin(l / 2, -h / 2), coin(-l / 2, -h / 2)], lettre: det.lettre };
}

/**
 * Redimensionne une boîte { x, y, l, h } (mm) en tirant une poignée (« no », « n », « ne », « e », « se », « s », « so », « o ») de (dx, dy) mm.
 * mini = taille minimale (mm) ; carre = garder un carré (rond) ; accrocher(valeur, 'x' | 'y') → valeur accrochée (facultatif, appliqué
 * à l'arête tirée). Le bord opposé reste en place.
 */
export function redimensionnerBoite(boite, poignee, dx, dy, mini = 25, carre = false, accrocher = null) {
  let { x, y, l, h } = boite;
  const droite = x + l;
  const bas = y + h;
  const acc = (v, axe) => (accrocher ? accrocher(v, axe) : v);
  if (poignee.includes('o')) x = Math.min(droite - mini, acc(x + dx, 'x'));
  if (poignee.includes('e')) l = Math.max(mini, acc(droite + dx, 'x') - x);
  else l = droite - x;
  if (poignee.includes('n')) y = Math.min(bas - mini, acc(y + dy, 'y'));
  if (poignee.includes('s')) h = Math.max(mini, acc(bas + dy, 'y') - y);
  else h = bas - y;
  if (carre) {
    const t = Math.max(l, h);
    if (poignee.includes('o')) x = droite - t;
    if (poignee.includes('n')) y = bas - t;
    l = t;
    h = t;
  }
  return { x, y, l, h };
}

/** Les 8 poignées d'une boîte : { nom, x, y } (mm). */
export function poigneesDeBoite(b) {
  const xs = { o: b.x, m: b.x + b.l / 2, e: b.x + b.l };
  const ys = { n: b.y, m: b.y + b.h / 2, s: b.y + b.h };
  return [['no', 'o', 'n'], ['n', 'm', 'n'], ['ne', 'e', 'n'], ['e', 'e', 'm'], ['se', 'e', 's'], ['s', 'm', 's'], ['so', 'o', 's'], ['o', 'o', 'm']].map(([nom, cx, cy]) => ({ nom, x: xs[cx], y: ys[cy] }));
}

/** Poignée sous le point (mm) à « tolerance » mm près, ou null. */
export function poigneeSousLePoint(b, p, tolerance) {
  return poigneesDeBoite(b).find((q) => Math.hypot(q.x - p[0], q.y - p[1]) <= tolerance)?.nom ?? null;
}
