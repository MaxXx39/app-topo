// Plans de chantier, étape 4 (0.289.0) : mise en page de la feuille (comme l'espace papier d'AutoCAD), sans écran.
// Feuille A4 / A3 / A1 paysage ou portrait, plan à l'échelle du plan de chantier (plan.echelle), cartouche avec logo,
// légende automatique (genres et symboles utilisés), nord, barre d'échelle ; une page par phase ou toutes sur une page.
// Unités : mm de papier (origine en haut à gauche de la feuille, y vers le bas).
import { modeleDe } from './grue-modele.js';
import { tailleFeuille, barreEchellePapier } from '../export/echelle.js';
import { categorieZone, styleLigne, objetsVisibles, objetsVus, bornesObjets, ECHELLE_PAPIER, estPose, materiauTas } from './plan-chantier.js';

export const FORMATS_FEUILLE = [['a4', 'A4'], ['a3', 'A3'], ['a2', 'A2'], ['a1', 'A1']];

/** Réglages de la feuille d'un plan, complétés par ceux de départ. */
export function reglagesFeuille(plan) {
  const f = plan.feuille ?? {};
  return {
    format: f.format ?? 'a3', orientation: f.orientation ?? 'paysage', pages: f.pages ?? 'une',
    centre: f.centre ?? null, legende: f.legende !== false, nord: f.nord !== false, barre: f.barre !== false,
    plans: f.plans ?? null, situation: situationDe(f.situation), planning: Boolean(f.planning), coupe: Boolean(f.coupe), indice: f.indice ?? 'A', auteur: f.auteur ?? '', date: f.date ?? '', titre: f.titre ?? '', logo: f.logo ?? 'perrin',
  };
}

export const COINS_SITUATION = [['hd', 'Haut droite'], ['hg', 'Haut gauche'], ['bg', 'Bas gauche'], ['bd', 'Bas droite']];
/** Vue de situation (0.293.0) : petit cadre carte nationale dans un coin, zone du plan en rouge. */
export const situationDe = (s = {}) => ({ actif: Boolean(s.actif), coin: s.coin ?? 'hd', echelle: s.echelle ?? 5000, taille: s.taille ?? 60, auto: Boolean(s.auto) });

/**
 * Échelle de la carte de situation : celle tapée, ou en automatique (0.295.1) celle qui donne à la zone du plan (rectangle
 * rouge) environ un tiers du côté du cadre, quel que soit le zoom du plan.
 */
export function echelleDeSituation(plan, mise, sit) {
  if (!sit.auto) return sit.echelle;
  const largeurM = (mise.cadre.l * (plan.echelle ?? ECHELLE_PAPIER)) / 1000;
  const B = cadreSituation(mise, sit);
  return Math.max(200, Math.round((largeurM * 1000) / (0.33 * B.l) / 100) * 100);
}

/**
 * Cadre (mm) de la vue de situation dans un coin du cadre du plan ; taille = côté en mm sur une feuille A3 (suit k).
 * Au-dessus du cartouche et de la légende, il vaut mieux choisir un coin du haut.
 */
export function cadreSituation(mise, situation) {
  const t = situation.taille * mise.k;
  const m = 3 * mise.k;
  const c = mise.cadre;
  const x = situation.coin.endsWith('g') ? c.x + m + (situation.coin === 'hg' ? 26 * mise.k : 0) : c.x + c.l - t - m;
  const y = situation.coin.startsWith('h') ? c.y + m : c.y + c.h - t - m - (situation.coin === 'bg' ? 12 * mise.k : 0);
  return { x, y, l: t, h: t };
}

/**
 * Rectangle (m, en MN95) montré en rouge dans la vue de situation = ce que voit le cadre du plan.
 */
export function etendueDuCadre(plan, cadre, centre) {
  const echelle = plan.echelle ?? ECHELLE_PAPIER;
  const l = (cadre.l * echelle) / 1000;
  const h = (cadre.h * echelle) / 1000;
  return { estMin: centre[0] - l / 2, estMax: centre[0] + l / 2, nordMin: centre[1] - h / 2, nordMax: centre[1] + h / 2 };
}

/**
 * Cadres de la feuille (mm) : page, cadre du plan (toute la feuille moins la marge), cartouche en bas à droite, légende
 * au-dessus du cartouche, nord en haut à gauche, barre d'échelle en bas à gauche. k = taille des éléments (A3 = 1).
 */
export function miseEnPageFeuille(format = 'a3', orientation = 'paysage', lignesLegende = 0) {
  const page = tailleFeuille(format, orientation);
  const k = Math.max(page.largeur, page.hauteur) / 420;
  const marge = Math.max(7, 10 * Math.sqrt(k));
  const cadre = { x: marge, y: marge, l: page.largeur - 2 * marge, h: page.hauteur - 2 * marge };
  const lc = Math.min(cadre.l * 0.45, 135 * k);
  const hc = 36 * k;
  const cartouche = { x: cadre.x + cadre.l - lc, y: cadre.y + cadre.h - hc, l: lc, h: hc };
  const ligne = 6 * k; // hauteur d'une ligne de la légende
  const colonnes = lignesLegende > 8 ? 2 : 1;
  const nLignes = Math.ceil(lignesLegende / colonnes);
  const hl = lignesLegende ? Math.min(cadre.h - hc - 10 * k, 9 * k + nLignes * ligne) : 0;
  const legende = { x: cartouche.x, y: cartouche.y - hl, l: lc, h: hl, ligne, colonnes };
  const nord = { x: cadre.x + 11 * k, y: cadre.y + 17 * k, t: 12 * k };
  const barre = { x: cadre.x + 6 * k, y: cadre.y + cadre.h - 8 * k, max: Math.min(70 * k, cadre.l * 0.25) };
  // Planning des phases (0.294.1) : à gauche du cartouche, après la barre d'échelle.
  const px = cadre.x + 6 * k + barre.max + 8 * k;
  const planning = { x: px, y: cartouche.y, l: Math.max(0, cartouche.x - px - 4 * k), h: cartouche.h };
  return { page, k, cadre, cartouche, legende, nord, barre, planning };
}

/** Pages à faire : une par phase (avec les phases « sur toutes les pages »), ou une seule (phases visibles). */
export function pagesDeLaFeuille(plan, pages = reglagesFeuille(plan).pages) {
  if (pages !== 'phases' || plan.phases.length < 2) {
    return [{ titre: '', phases: plan.phases.filter((p) => p.visible !== false).map((p) => p.id) }];
  }
  const communes = plan.phases.filter((p) => p.commune).map((p) => p.id);
  return plan.phases.filter((p) => !p.commune).map((p) => ({ titre: p.nom, phase: p.id, phases: [...communes, p.id] }));
}

/** Objets d'une page (phases de la page). */
export function objetsDeLaPage(plan, page) {
  // Gestion des phases : une page par phase avec des règles = « on voit quoi » dans cette phase.
  if (page.phase && plan.vues?.[page.phase]) return objetsVus(plan, page.phase).filter((o) => o.type !== 'construction');
  const ids = new Set(page.phases);
  return plan.objets.filter((o) => o.type !== 'construction' && ids.has(o.phase)); // construction : jamais imprimée
}

/**
 * Légende automatique : chaque genre utilisé une fois (zones par catégorie, lignes par genre, pistes, flèches, symboles,
 * grues), dans l'ordre : zones, lignes, circulation, symboles. nomSymbole(cle) : nom lisible d'un symbole.
 * Renvoie [{ cle, nom, type, exemple (objet modèle pour le petit dessin) }].
 */
export function elementsLegende(objets, nomSymbole = (c) => String(c).replace(/^[a-z]+:/, '')) {
  const vus = new Map();
  const ajouter = (cle, nom, type, exemple, rang) => {
    if (!vus.has(cle)) vus.set(cle, { cle, nom, type, exemple, rang });
  };
  for (const o of objets) {
    if (o.type === 'zone') ajouter(`zone:${o.categorie}:${o.materiau ?? ''}:${o.couleur ?? ''}`, o.materiau ? `Stock : ${materiauTas(o.materiau)?.nom ?? o.materiau}` : categorieZone(o.categorie).nom, 'zone', o, 0);
    else if (o.type === 'ligne') ajouter(`ligne:${styleLigne(o.style).cle}:${o.couleur ?? ''}`, styleLigne(o.style).nom.replace(/\s+[<>].*$/, ''), 'ligne', o, 1);
    else if (o.type === 'piste') ajouter('piste', 'Piste de chantier', 'piste', o, 2);
    else if (o.type === 'fleche') ajouter(`fleche:${o.couleur ?? ''}`, 'Sens de circulation', 'fleche', o, 2);
    else if (o.type === 'grue') ajouter(`grue:${o.modele}:${o.modele === 'mobile' ? o.tonnes : o.fleche}`, o.modele === 'mobile' ? `Grue mobile ${o.tonnes ?? 100} t` : o.modele === 'fiche' ? `Grue ${modeleDe(o.modeleGrue).nom}, flèche ${o.fleche} m` : `Grue ${o.modele === 'auto' ? 'automontante' : 'à tour'}, flèche ${o.fleche} m`, 'grue', o, 3);
    else if (o.type === 'symbole') ajouter(o.etage ? 'etage' : `symbole:${o.cle}`, o.etage ? 'Base-vie à étage' : nomSymbole(o.cle), 'symbole', o, 3);
  }
  return [...vus.values()].sort((a, b) => a.rang - b.rang);
}

/**
 * Vue du cadre du plan (pour dessiner) : px par m, centre, taille en px. pxParMm : définition du dessin (px / mm de
 * papier). Le centre est celui de la feuille (feuille.centre), sinon le milieu des éléments, sinon des plans.
 */
export function vueDuCadre(plan, cadre, pxParMm, centre) {
  const echelle = plan.echelle ?? ECHELLE_PAPIER;
  return { echelle: (pxParMm * 1000) / echelle, estCentre: centre[0], nordCentre: centre[1], largeur: cadre.l * pxParMm, hauteur: cadre.h * pxParMm, rotation: 0 };
}

/** Centre de départ de la feuille : milieu des éléments du plan (ou des plans du projet, ou null). */
export function centreDeDepart(plan, plans = []) {
  const b = bornesObjets(objetsVisibles(plan).filter((o) => o.type !== 'construction'));
  if (b) return [(b.estMin + b.estMax) / 2, (b.nordMin + b.nordMax) / 2];
  const p = plans.find((x) => x.bornes);
  return p ? [(p.bornes.estMin + p.bornes.estMax) / 2, (p.bornes.nordMin + p.bornes.nordMax) / 2] : null;
}

/** Barre d'échelle (m et mm de papier) pour une échelle et une longueur maxi (mm). */
export const barreDeLaFeuille = (echelle, maxMm) => barreEchellePapier(echelle, maxMm);

/**
 * Textes du cartouche (mm de papier, y vers le bas ; taille en points) : affaire, titre du plan, phase, échelle, format,
 * date, indice, auteur. cartouche : cadre du cartouche ; k : taille (A3 = 1) ; champs : { affaire, projet, titre, phase,
 * echelle, format, date, indice, auteur }. La partie gauche (40 %) est pour le logo.
 */
export function textesCartouche(cartouche, k, champs) {
  const x0 = cartouche.x + cartouche.l * 0.4 + 3 * k;
  const y = (f) => cartouche.y + cartouche.h * f;
  const t = (texte, x, yy, taille, gras = false, couleur = '#1b2b36') => ({ texte: String(texte ?? ''), x, y: yy, taille: taille * k, gras, couleur });
  const xm = x0 + (cartouche.x + cartouche.l - x0) / 2;
  return [
    t(champs.affaire, x0, y(0.15), 8, true),
    t(champs.projet, x0, y(0.27), 6.5),
    t(champs.titre, x0, y(0.41), 9.5, true),
    t(`Indice ${champs.indice}`, x0, y(0.54), 8, true), // 0.297.0 : l'indice sous le numéro et le nom du plan
    t(champs.phase, x0, y(0.67), 7, false, '#b45309'),
    t(`Échelle 1:${champs.echelle}`, x0, y(0.81), 6.5),
    t(`Format ${champs.format}`, xm, y(0.81), 6.5),
    t(`Date ${champs.date}`, x0, y(0.93), 6.5),
    ...(champs.auteur ? [t(`Dessiné par ${champs.auteur}`, xm, y(0.93), 6.5)] : []),
  ].filter((x) => x.texte.trim() && !/ $/.test(x.texte));
}

/** Nombre d'éléments posés (symboles, grues) d'une liste d'objets (pour les messages). */
export const nombrePoses = (objets) => objets.filter(estPose).length;

// --- 0.317.0 : plans montrés sur la feuille, réglés à part de l'écran (cases + opacité par plan) ---

const copiesOpacite = new WeakMap(); // plan -> Map(transparence -> copie) : mêmes objets d'un dessin à l'autre (cache de dessin)

/**
 * Plans à dessiner sur la feuille. tous : tous les plans du projet ; deLEcran : ceux montrés à l'écran pour cette phase ;
 * reglages : plan.feuille.plans { [id]: { visible, opacite (0 à 100 %) } } ou null (= comme l'écran). Un plan sans réglage
 * garde sa visibilité d'écran. Renvoie la liste, avec la transparence réglée (copie gardée en mémoire).
 */
export function plansDeLaFeuille(tous, deLEcran, reglages) {
  if (!reglages) return deLEcran;
  const ecran = new Set(deLEcran.map((p) => p.id));
  return tous.filter((p) => reglages[p.id]?.visible ?? ecran.has(p.id)).map((p) => {
    const op = reglages[p.id]?.opacite;
    if (op === undefined || op === null) return p;
    const transparence = Math.round(100 - Math.min(100, Math.max(0, op)));
    if (transparence === (p.transparence ?? 0)) return p;
    let m = copiesOpacite.get(p);
    if (!m) copiesOpacite.set(p, (m = new Map()));
    if (!m.has(transparence)) m.set(transparence, { ...p, transparence, sourcePlan: p.sourcePlan ?? p });
    return m.get(transparence);
  });
}
