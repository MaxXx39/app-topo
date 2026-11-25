// Plans de chantier (0.310.0 → 0.311.0) : grue « d'après la fiche technique », bloc dynamique. Le modèle (Liebherr 172 EC-B,
// Condecta EURO 4513 ou un modèle de l'utilisateur : voir grue-modele.js) donne toutes les caractéristiques ; on choisit la
// flèche, la tour et le pied, la HSC (hauteur sous crochet), le rayon du crochet, le Z du pied…; le bloc dessine la grue à
// l'échelle (vue de dessus, flèche vers +x, axe de la tour = point de base) et donne les charges, la HSC, les contrepoids…
// Rien n'est deviné : une valeur absente de la fiche est dite absente (charge entre deux portées : la portée suivante).
import { piece, trait, rectArrondi, cercle, tourner, texte, tournerPrims, NOIR } from './symboles-outils.js';
import { versSymbole } from './symboles-retouches.js';
import { coteDuChassis } from './symboles.js';
import { bornesPrimitives } from './blocs-dxf.js';
import { modeleDe, versionModeles } from './grue-modele.js';

export const CLE_FICHE = 'fiche';
export const RAYON_MIN = 2.6; // m : rayon minimal du crochet proposé
export const COULEUR_TEXTE = '#7c2d12';

const JAUNE = '#f3cd6b'; // peinture des grues du DXF de l'utilisateur
const ARDOISE = '#61666a';
const METAL = '#d5d9dd';
const METAL_FONCE = '#8e979f';
const BETON = '#b9bfc6';
const memoire = new Map();
const garder = (cle, calcul) => {
  if (!memoire.has(cle)) {
    if (memoire.size > 120) memoire.clear();
    memoire.set(cle, calcul());
  }
  return memoire.get(cle);
};

/** Petit code (4 signes) d'une chaîne : distingue les réglages dans le nom du bloc DXF. */
function hash36(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36).slice(-4).padStart(4, '0');
}
const borne = (v, a, b) => Math.min(b, Math.max(a, v));
const fixe2 = (v) => Number(v).toFixed(2);
const fixe1 = (v) => Number(v).toFixed(1);

// ---------------------------------------------------------------- Données choisies

/** Flèche du modèle la plus proche de la longueur demandée. */
export const flecheDe = (modele, nom) => modele.fleches.reduce((m, f) => (Math.abs(f.nom - nom) < Math.abs(m.nom - nom) ? f : m));
export const tourDe = (modele, id) => modele.tours.find((t) => t.id === id) ?? modele.tours[0];

/** Portée maximale du crochet d'une flèche = dernière portée du tableau de charge. */
export const porteeMax = (fleche) => fleche.charges[fleche.charges.length - 1][0];

/** HSC d'une tour : [{ etiquette, h, etoile, speciaux, suspect, contrepoidsT }] (de bas en haut). */
export const hauteursDe = (tour) => tour.hauteurs.map(([etiquette, h, opt]) => ({ etiquette, h, ...(opt ?? {}) }));

/** Hauteur de la tour la plus proche de h (m). */
export function hauteurChoisie(tour, h) {
  const l = hauteursDe(tour);
  const but = Number.isFinite(Number(h)) ? Number(h) : 30;
  return l.reduce((m, x) => (Math.abs(x.h - but) < Math.abs(m.h - but) ? x : m));
}

/**
 * Réglages d'un objet posé ramenés à ce que le modèle permet. Champs de l'objet : modeleGrue, fleche, tour, hauteur (HSC),
 * rayonCrochet, mode (lm1 / lm2), cercles, rotationFleche, zPied, afficherCharge, afficherHsc, couleurTexte, massifs
 * (+ massifL, massifB, massifH).
 */
export function reglagesGrue(o = {}) {
  const modele = modeleDe(o.modeleGrue);
  const fleche = flecheDe(modele, Number(o.fleche) || modele.fleches[Math.floor(modele.fleches.length / 2)].nom);
  const tour = tourDe(modele, o.tour);
  const hauteur = hauteurChoisie(tour, o.hauteur);
  const rMax = porteeMax(fleche);
  const brut = o.rayonCrochet === '' || o.rayonCrochet == null ? NaN : Number(o.rayonCrochet);
  const r = borne(Number.isFinite(brut) ? brut : rMax, RAYON_MIN, rMax);
  const mode = o.mode === 'lm2' && fleche.charges2 ? 'lm2' : 'lm1';
  // 0.318.0 : cercles de charge = ceux de la fiche (case à cocher) ; l'ancien réglage « cercles » (aucun / principaux / tous) devient oui / non
  // 0.319.0 : trois choix : « fiche » (portées du tableau + charges), « cinq » (un cercle tous les 5 m dès 20 m, sans charge inventée), « aucun »
  const cerclesMode = ['fiche', 'cinq', 'aucun'].includes(o.cerclesMode) ? o.cerclesMode : (o.cerclesCharge === false || o.cercles === 'aucun' ? 'aucun' : 'fiche');
  const nombreOu = (v, defaut) => (Number.isFinite(Number(v)) && v !== '' && v != null && Number(v) > 0 ? Number(v) : defaut);
  return {
    modele, fleche, tour, hauteur, r: Math.round(r * 10) / 10, mode, cerclesMode, afficherCrochet: o.afficherCrochet !== false,
    texteFleche: String(o.texteFleche ?? '').trim().slice(0, 60), rotationFleche: Number(o.rotationFleche) || 0,
    zPied: Number.isFinite(Number(o.zPied)) && o.zPied !== '' && o.zPied != null ? Number(o.zPied) : 0,
    afficherCharge: o.afficherCharge !== false, afficherHsc: o.afficherHsc !== false,
    couleurTexte: /^#[0-9a-f]{6}$/i.test(o.couleurTexte ?? '') ? o.couleurTexte : COULEUR_TEXTE,
    // 0.313.0 : 4 massifs carrés (côté massifL, 2 m au départ) sous le pied, dans l'orientation du pied ; massifH : seulement pour la vue de côté
    massifs: Boolean(o.massifs), massifL: nombreOu(o.massifL, 2), massifB: nombreOu(o.massifL, 2), massifH: nombreOu(o.massifH, 1),
  };
}

/**
 * Charge maximale (t) au rayon r du crochet, d'après le tableau de la fiche (paires [portée, charge]) : la charge de la
 * première portée ≥ r (la fiche ne donne que ces portées : on prend la suivante, côté prudent, sans calculer entre deux) ;
 * si la fiche donne une zone « charge maximale » (rPlein), la charge maximale jusqu'à elle.
 * Renvoie { t, rayon, source: 'plein' | 'colonne', colonne?, jusqua?, mode }.
 */
export function chargeAuRayon(fleche, r, mode = 'lm1') {
  const lm2 = mode === 'lm2' && fleche.charges2;
  const tab = lm2 ? fleche.charges2 : fleche.charges;
  const rPlein = lm2 ? fleche.rPlein2 : fleche.rPlein;
  const rr = borne(Number(r), RAYON_MIN, tab[tab.length - 1][0]);
  const m = lm2 ? 'lm2' : 'lm1';
  if (rPlein && rr <= rPlein + 1e-9) return { t: tab[0][1], rayon: rr, source: 'plein', jusqua: rPlein, mode: m };
  const c = tab.find(([cr]) => cr >= rr - 1e-9);
  return { t: c[1], rayon: rr, source: 'colonne', colonne: c[0], mode: m };
}

/** Contrepoids d'une flèche et d'une HSC : { t, blocs?, texte? } ou null si la fiche n'en donne pas. */
export function contrepoidsDe(fleche, hauteur = null) {
  if (hauteur?.contrepoidsT) return { t: hauteur.contrepoidsT, blocs: null, texte: null };
  if (!fleche.contrepoids) return null;
  const { t, blocs } = fleche.contrepoids;
  if (!blocs) return { t, blocs: null, texte: null };
  const nb = {};
  for (const b of blocs) nb[b] = (nb[b] ?? 0) + 1;
  return { t, blocs, texte: Object.entries(nb).map(([b, n]) => `${n} × ${b}`).join(' + ') };
}

/** Poids des éléments de flèche (kg) si le modèle les donne, sinon null. */
export const poidsFleche = (modele, fleche) => (fleche.sections && modele.elements ? fleche.sections.reduce((s, i) => s + modele.elements[i].kg, 0) : null);

/** Position de l'extrémité de la flèche (m depuis l'axe). */
export function boutDeFleche(modele, fleche) {
  if (fleche.sections && modele.elements) return modele.dim.flecheDebut + fleche.sections.reduce((s, i) => s + modele.elements[i].nom, 0);
  return fleche.rMax ?? porteeMax(fleche);
}

const CERCLES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
const NOMS_ESTIMES = { flecheLargeur: 'largeur de la flèche', contreFlecheLargeur: 'largeur de la contre-flèche', flecheDebut: 'début de la flèche', mat: 'largeur du mât', teteAuDessusFleche: 'tête au-dessus de la flèche', flecheAuDessusHsc: 'flèche au-dessus du crochet' };

/** Cotes verticales d'une grue posée (Z du pied connu) : niveaux en m. */
export function niveauxGrue(g) {
  const { modele, hauteur, zPied } = g;
  const D = modele.dim;
  const crochet = zPied + hauteur.h;
  const flecheBas = crochet + D.flecheAuDessusHsc;
  const flecheHaut = flecheBas + D.flecheProfondeur;
  return { pied: zPied, crochet, flecheBas, flecheHaut, haut: flecheHaut + D.teteAuDessusFleche };
}

/** Fiche écrite d'un réglage : { lignes: [{ titre, valeur, detail?, alerte? }], pasDansLaFiche: [texte] }. */
export function ficheGrue(o) {
  const g = reglagesGrue(o);
  const { modele, fleche: f, tour, hauteur: h, r, mode } = g;
  const ch = chargeAuRayon(f, r, mode);
  const rMax = porteeMax(f);
  const bout = chargeAuRayon(f, rMax, mode);
  const cp = contrepoidsDe(f, h);
  const nv = niveauxGrue(g);
  const pas = [];
  const l = [];
  l.push({ titre: 'Charge au crochet', valeur: `${fixe2(ch.t)} t à ${fixe1(ch.rayon)} m${f.charges2 ? ` (${mode === 'lm2' ? 'LM 2' : 'LM 1'})` : ''}`, detail: ch.source === 'plein' ? `charge maximale de ${fixe1(RAYON_MIN)} m à ${fixe1(ch.jusqua)} m` : `valeur du tableau à ${fixe1(ch.colonne)} m (la fiche ne donne pas de valeur entre deux portées)` });
  l.push({ titre: 'Charge en bout de flèche', valeur: `${fixe2(bout.t)} t à ${fixe1(rMax)} m` });
  const limite = modele.chargesValablesJusqua;
  l.push({ titre: 'HSC (hauteur sous crochet)', valeur: `${fixe1(h.h)} m`, detail: `Z pied ${fixe2(nv.pied)} · Z crochet ${fixe2(nv.crochet)} · Z haut de la grue ${fixe2(nv.haut)}`, alerte: limite && h.h > limite ? `Les charges de la fiche valent jusqu'à ${limite} m de hauteur sous crochet : au-dessus, voir le manuel du constructeur.` : null });
  if (h.speciaux) pas.push(`Éléments de mât spéciaux demandés : ${h.speciaux}.`);
  if (h.etoile) pas.push('Cette HSC porte le repère « *) » de la fiche (pictogramme non expliqué dans la fiche).');
  if (h.suspect) pas.push('Valeur qui semble fausse dans la fiche (imprimée telle quelle).');
  const pf = poidsFleche(modele, f);
  l.push({ titre: 'Flèche', valeur: `${fixe1(f.nom)} m (portée maximale ${fixe1(f.rMax ?? rMax)} m)`, detail: f.sections ? `éléments ${f.sections.map((i) => CERCLES[i - 1]).join(' ')}${pf ? `, ${Math.round(pf)} kg` : ''}` : null });
  if (cp) l.push({ titre: 'Contrepoids', valeur: `${fixe2(cp.t)} t`, detail: cp.texte });
  const pied = tour.pied.type === 'FA' ? 'ancrage fixe' : tour.pied.type === 'UC' ? `châssis roulant ${fixe2(tour.pied.c)} m` : tour.pied.type === 'CB' ? `croix de fondation ${fixe2(tour.pied.c)} m` : `stabilisateurs ${fixe2(tour.pied.c)} × ${fixe2(tour.pied.c)} m`;
  l.push({ titre: 'Pied', valeur: pied, detail: `mât ${fixe2(tour.mat)} m de large${g.massifs ? ` · 4 massifs ${fixe2(g.massifL)} × ${fixe2(g.massifL)} m` : ''}` });
  for (const [titre, valeur] of modele.infos ?? []) l.push({ titre, valeur });
  const estimes = (modele.estimes ?? []).map((k) => NOMS_ESTIMES[k] ?? k);
  if (estimes.length) pas.push(`Dimensions estimées (pas dans la fiche) : ${estimes.join(', ')}. À corriger dans « Modèles de grues… ».`);
  return { lignes: l, pasDansLaFiche: pas };
}

// ---------------------------------------------------------------- Dessin (vue de dessus, en m)

/** Treillis d'un rectangle [x0, x1] × [-w/2, w/2] : zigzag entre les membrures et l'axe, pas de p m. */
function treillis(x0, x1, w, p) {
  const nb = Math.max(1, Math.round((x1 - x0) / p));
  const pas = (x1 - x0) / nb;
  const res = [];
  const h = w / 2;
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= nb; i++) pts.push([x0 + i * pas, i % 2 ? 0 : s * h]);
    res.push(trait(pts, false, ARDOISE));
  }
  return res;
}

/** Tronçon de flèche : cadre jaune, treillis, axe. */
function troncon(x0, x1, w) {
  const pts = rectArrondi(x0, -w / 2, x1, w / 2, 0.04, 1);
  return [...piece(JAUNE, 'peinture', pts), ...treillis(x0, x1, w, Math.max(0.9, w * 1.04)), trait([[x0, 0], [x1, 0]], false, '#8a9198')];
}

/** Pointe de flèche : sabot qui se rétrécit, poulie au bout. */
function pointeFleche(x0, x1, w) {
  const l = x1 - x0;
  const pts = [[x0, -w / 2], [x0 + l * 0.7, -w / 2], [x1, -w * 0.26], [x1, w * 0.26], [x0 + l * 0.7, w / 2], [x0, w / 2]];
  return [...piece(JAUNE, 'peinture', pts), ...piece(METAL_FONCE, 'metal', cercle(x1 - 0.2, 0, 0.17, 14))];
}

/** Positions des 4 appuis du pied (là où se posent les massifs) : coins du carré d'appui, ou coins du mât pour un ancrage fixe. */
export function appuisDuPied(tour) {
  const { type, c } = tour.pied;
  const d = type === 'FA' ? tour.mat / 2 : c / 2;
  return [[d, d], [d, -d], [-d, d], [-d, -d]];
}

/** Massifs sous les appuis (rectangles L × B centrés sur chaque appui) + leur étiquette. */
function massifs(g) {
  const res = [];
  for (const [x, y] of appuisDuPied(g.tour)) {
    res.push(...piece(BETON, 'peinture', rectArrondi(x - g.massifL / 2, y - g.massifB / 2, x + g.massifL / 2, y + g.massifB / 2, 0.03, 1), '#6b7280'));
  }
  return res;
}

/** Cote d'un massif carré de côté c centré en [x, y] : une cote au-dessus et une à droite (« 2.00 m »). */
function coteDuMassif([x, y], c) {
  const k = '#0f172a';
  const h = Math.max(0.3, c * 0.18);
  const tic = h * 0.5;
  const yc = y + c / 2 + 0.5;
  const xc = x + c / 2 + 0.5;
  const t = `${c.toFixed(2)} m`;
  const l = (p) => ({ g: 'l', k, p, f: false, mat: 'trait' });
  return [
    l([x - c / 2, yc, x + c / 2, yc]), l([x - c / 2, yc - tic, x - c / 2, yc + tic]), l([x + c / 2, yc - tic, x + c / 2, yc + tic]),
    { g: 't', k, x, y: yc + h, h, a: 0, t, ah: 1, av: 2 },
    l([xc, y - c / 2, xc, y + c / 2]), l([xc - tic, y - c / 2, xc + tic, y - c / 2]), l([xc - tic, y + c / 2, xc + tic, y + c / 2]),
    { g: 't', k, x: xc + h, y, h, a: 90, t, ah: 1, av: 2 },
  ];
}

/** Pied de la tour (vue de dessus) : ancrage fixe, croix, châssis roulant ou stabilisateurs (carré d'appui c, bras en diagonale). */
function pied(tour) {
  const { type, c } = tour.pied;
  const B = tour.mat;
  const res = [];
  if (type === 'FA') {
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) res.push(...piece(METAL_FONCE, 'metal', rectArrondi(sx * (B / 2 + 0.05) - 0.22, sy * (B / 2 + 0.05) - 0.22, sx * (B / 2 + 0.05) + 0.22, sy * (B / 2 + 0.05) + 0.22, 0.03, 1)));
    return res;
  }
  const arm = c * Math.SQRT2 + 0.6; // longueur d'un bras en diagonale (7,12 m pour 4,60 m : « Tragholm lang » de la fiche Liebherr)
  const cote = c - 0.35; // longueur d'un côté du carré
  for (const a of [45, -45]) res.push(...piece(METAL, 'metal', tourner(rectArrondi(-arm / 2, -0.38, arm / 2, 0.38, 0.05, 1), a)));
  if (type !== 'ST') {
    for (const [dx, dy, a] of [[0, c / 2, 0], [0, -c / 2, 0], [c / 2, 0, 90], [-c / 2, 0, 90]]) {
      const p = tourner(rectArrondi(-cote / 2, -0.25, cote / 2, 0.25, 0.04, 1), a);
      res.push(...piece(METAL, 'metal', p.map(([x, y]) => [x + dx, y + dy])));
    }
  }
  if (type === 'UC') {
    // 4 chariots de roulement aux coins (1,38 × 0,88 m)
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      res.push(...piece('#3a3f45', 'metal', rectArrondi(sx * c / 2 - 0.69, sy * c / 2 - 0.44, sx * c / 2 + 0.69, sy * c / 2 + 0.44, 0.08, 2)));
      res.push(trait([[sx * c / 2 - 0.69, sy * c / 2], [sx * c / 2 + 0.69, sy * c / 2]], false, '#9aa3ab'));
    }
  }
  if (type === 'ST') {
    // 4 patins d'appui aux coins
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) res.push(...piece('#3a3f45', 'metal', rectArrondi(sx * c / 2 - 0.4, sy * c / 2 - 0.4, sx * c / 2 + 0.4, sy * c / 2 + 0.4, 0.06, 2)));
  }
  return res;
}

/** Mât (carré B, croisillons) : visible seulement hors de la plate-forme. */
function mat(B) {
  const h = B / 2;
  return [...piece(JAUNE, 'peinture', rectArrondi(-h, -h, h, h, 0.03, 1)), trait([[-h, -h], [h, h]], false, ARDOISE), trait([[-h, h], [h, -h]], false, ARDOISE)];
}

/** Contre-flèche, contrepoids, plate-forme, cabine et flèche : tout ce qui tourne avec la flèche. */
function partieHaute(g) {
  const { modele: M, fleche: f, r, mode } = g;
  const D = M.dim;
  const res = [];
  const arr = D.contreFlecheArriere;
  const w = D.contreFlecheLargeur;
  res.push(...piece(JAUNE, 'peinture', rectArrondi(-arr, -w / 2, -0.4, w / 2, 0.06, 1)));
  res.push(...treillis(-arr, -0.4, w, Math.max(0.9, w * 0.57)), trait([[-arr, 0], [-0.4, 0]], false, '#8a9198'));
  // Contrepoids (si la fiche donne les blocs) : un bloc par place, de l'arrière vers la tour
  const cp = contrepoidsDe(f, g.hauteur);
  if (cp?.blocs && M.blocs) {
    cp.blocs.forEach((b, i) => {
      const bl = M.blocs[b];
      const xa = -D.arriereTotal + i * (bl.ep + 0.03);
      res.push(...piece(bl.couleur, 'peinture', rectArrondi(xa, -bl.long / 2, xa + bl.ep, bl.long / 2, 0.02, 1)));
    });
  }
  if (D.treuil) res.push(...piece(METAL, 'metal', rectArrondi(D.treuil.x0, -0.9, D.treuil.x1, 0.9, 0.06, 2)), ...piece(METAL_FONCE, 'metal', rectArrondi(D.treuil.x0 + 0.4, -0.6, D.treuil.x1 - 1, 0.6, 0.05, 2)));
  if (M.court && arr >= 8) res.push(texte(M.court, -5.6, 0, 0.7, { k: '#1e293b' }));
  // Plate-forme tournante, couronne d'orientation, pointe de mât
  if (D.plateforme) res.push(...piece(METAL, 'metal', rectArrondi(-2.9, -D.plateforme.b / 2, -2.9 + D.plateforme.l, D.plateforme.b / 2, 0.08, 2)));
  res.push(trait(cercle(0, 0, g.tour.mat * 0.62, 28), true, ARDOISE), ...piece(JAUNE, 'peinture', cercle(0, 0, Math.min(0.5, g.tour.mat * 0.35), 18)));
  if (D.cabine) res.push(...piece('#f8fafc', 'blanc', rectArrondi(0.5, 0.86, 0.5 + D.cabine.l, 0.86 + D.cabine.b, 0.12, 3)), ...piece('#8fc6cf', 'vitre', rectArrondi(0.5 + D.cabine.l - 0.7, 1.0, 0.5 + D.cabine.l - 0.1, 0.86 + D.cabine.b - 0.14, 0.05, 2)));
  // Flèche : éléments de la fiche bout à bout, ou une flèche continue
  const fl = D.flecheLargeur;
  if (f.sections && M.elements) {
    let x = D.flecheDebut;
    for (const i of f.sections) {
      const l = M.elements[i].nom;
      res.push(...(i === 9 ? pointeFleche(x, x + l, fl) : troncon(x, x + l, fl)));
      x += l;
    }
  } else {
    const bout = boutDeFleche(M, f);
    res.push(...troncon(D.flecheDebut, bout - 1.2, fl), ...pointeFleche(bout - 1.2, bout, fl));
  }
  // Chariot et crochet au rayon choisi (case « Crochet » : décochée, ni chariot ni crochet ni texte)
  const xc = Math.min(r, boutDeFleche(M, f) - 0.5); // le chariot s'arrête avant le bout de la flèche
  if (g.afficherCrochet) res.push(...piece('#3a3f45', 'metal', rectArrondi(xc - 0.5, -fl * 0.65, xc + 0.5, fl * 0.65, 0.08, 2)), ...piece(NOIR, 'metal', cercle(r, 0, 0.28, 14)));
  if (g.afficherCharge && g.afficherCrochet) {
    const ch = chargeAuRayon(f, r, mode);
    res.push(texte(`r ${fixe1(ch.rayon)} m · ${fixe2(ch.t)} t`, r, -1.7, 0.9, { k: g.couleurTexte }));
  }
  return res;
}

/**
 * Cercles de charge : le principal (portée maximale du crochet) et, si la case est cochée, ceux de la fiche (les portées
 * du tableau, dès 20 m, au moins 5 m d'écart), avec leur charge. Aucune portée n'est inventée.
 */
function cerclesDeCharge(g) {
  const { fleche: f, mode, cerclesMode } = g;
  const tab = mode === 'lm2' && f.charges2 ? f.charges2 : f.charges;
  const rMax = tab[tab.length - 1][0];
  const res = [{ g: 'c', k: '#334155', x: 0, y: 0, r: rMax, mat: 'trait' }];
  // 0.319.8 : texte debout (90°), le bout du texte à 50 cm du bord de la flèche, sur le cercle ; il tourne avec la grue.
  // Un texte qui toucherait celui du crochet (rayon voisin) n'est pas écrit : le texte du crochet donne déjà r et la charge.
  const demi = g.modele.dim.flecheLargeur / 2;
  const longueur = (t) => t.length * 0.9 * 0.55;
  const textCrochet = g.afficherCrochet ? longueur(`r ${fixe1(g.r)} m · ${fixe2(chargeAuRayon(f, g.r, mode).t)} t`) : 0;
  const texteCercle = (rr, txt) => {
    const y = -(demi + 0.5 + longueur(txt) / 2);
    const x = Math.sqrt(Math.max(0, rr * rr - y * y));
    if (textCrochet && Math.abs(x - g.r) < textCrochet / 2 + 0.6) return null;
    return { g: 't', k: g.couleurTexte, perso: true, x, y, h: 0.9, a: 90, t: txt, ah: 1, av: 2 };
  };
  const ecrire = (rr, t, seul) => { const p = texteCercle(rr, seul ?? `${rr} m · ${fixe2(t)} t`); if (p) res.push(p); };
  if (cerclesMode === 'cinq') {
    // un cercle tous les 5 m dès 20 m : seulement la portée écrite (la fiche ne donne pas de charge à ces rayons exacts)
    for (let rr = 20; rr <= rMax - 5; rr += 5) {
      res.push({ g: 'c', k: '#8a9198', x: 0, y: 0, r: rr, mat: 'trait' });
      if (g.afficherCharge) ecrire(rr, 0, `${rr} m`);
    }
  } else if (cerclesMode === 'fiche') {
    let dernier = -Infinity;
    const gardes = tab.filter(([rr]) => rr <= rMax - 5 && rr >= 20).filter(([rr]) => (rr - dernier >= 5 ? ((dernier = rr), true) : false));
    for (const [rr, t] of gardes) {
      res.push({ g: 'c', k: '#8a9198', x: 0, y: 0, r: rr, mat: 'trait' });
      if (g.afficherCharge) ecrire(rr, t);
    }
  }
  if (g.afficherCharge) ecrire(rMax, tab[tab.length - 1][1]);
  return g.rotationFleche ? tournerPrims(res, g.rotationFleche) : res;
}

/**
 * Symbole d'une grue posée : { primitives, rayon, boite, fleche (portée maximale), modele: 'fiche', nom, nomBloc }.
 * Le point de base est l'axe de la tour. La rotation de la flèche fait tourner tout le haut (pas le pied).
 */
export function grueFiche(o = {}) {
  const g = reglagesGrue(o);
  const cle = JSON.stringify([g.modele.id, versionModeles(), g.fleche.nom, g.tour.id, g.hauteur.h, g.r, g.mode, g.cerclesMode, g.afficherCrochet, g.texteFleche, g.rotationFleche, g.afficherCharge, g.afficherHsc, g.couleurTexte, g.massifs, g.massifL, g.massifB]);
  return garder(cle, () => {
    const dessous = g.massifs ? massifs(g) : [];
    const base = pied(g.tour);
    // Pied toujours coté (côté du carré d'appui) ; massifs : leur taille écrite
    const bornes = bornesPrimitives([...dessous, ...base]);
    const cote = g.tour.pied.type === 'FA' ? [] : coteDuChassis(g.tour.pied.c, bornes);
    if (g.massifs) cote.push(...coteDuMassif(appuisDuPied(g.tour)[0], g.massifL));
    const bas = [...dessous, ...base, ...mat(g.tour.mat), ...cote];
    let haut = partieHaute(g);
    // 0.315.0 : UNE étiquette le long de la flèche (côté opposé au texte du crochet) : longueur de flèche + HSC
    // 0.318.0 : l'étiquette de la flèche est toujours là : [texte libre ·] Flèche … m [· HSC … m si la case est cochée]
    {
      const etiquette = `${g.texteFleche ? `${g.texteFleche} · ` : ''}Flèche ${fixe1(g.fleche.nom)} m${g.afficherHsc ? ` · HSC ${fixe1(g.hauteur.h)} m` : ''}`;
      haut.push(texte(etiquette, (g.modele.dim.flecheDebut + boutDeFleche(g.modele, g.fleche)) / 2, g.modele.dim.flecheLargeur / 2 + 1.3, 0.9, { k: '#1e293b' }));
    }
    if (g.rotationFleche) haut = tournerPrims(haut, g.rotationFleche);
    const nom = `Grue ${g.modele.nom} · flèche ${fixe1(g.fleche.nom)} m`;
    const s = versSymbole(nom, 'Grues', [...bas, ...haut], { centre: false });
    const code = (v) => String(v).replace('.', '_');
    const rMax = porteeMax(g.fleche);
    return {
      ...s, modele: 'fiche', fleche: rMax, rayon: cerclesDeCharge(g), tonnes: chargeAuRayon(g.fleche, g.r, g.mode).t,
      nomBloc: `GRUE_${hash36(g.modele.id).toUpperCase()}_${code(g.fleche.nom)}M_${hash36(cle)}`, // court : un nom de bloc DXF R12 a 31 caractères au plus
    };
  });
}
