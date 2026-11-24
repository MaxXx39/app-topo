// Plans de chantier (0.310.0, essai du 24.11) : grue à tour Liebherr 172 EC-B 8 Litronic, bloc dynamique d'après la fiche
// technique du constructeur (données dans grue-liebherr-172-donnees.js). On choisit la flèche (16 longueurs), la tour et le
// pied (19 configurations), la hauteur sous crochet, le rayon du crochet et le mode de charge ; le bloc dessine la grue à
// l'échelle (vue de dessus, flèche vers +x, axe de la tour = point de base) et donne les charges, la hauteur, les contrepoids…
// Rien n'est deviné : une valeur absente de la fiche est dite absente (charge entre deux colonnes : colonne suivante).
import {
  ELEMENTS_FLECHE, DIMENSIONS, BLOCS, FLECHES, TOURS, TREUILS, MECANISMES, HAUTEUR_CHARGES_MAX,
} from './grue-liebherr-172-donnees.js';
import { piece, trait, rectArrondi, cercle, tourner, texte, tournerPrims, NOIR } from './symboles-outils.js';
import { versSymbole } from './symboles-retouches.js';

export const CLE_ECB172 = 'ecb172';
export { FLECHES, TOURS, TREUILS };
export const FLECHES_ECB172 = FLECHES.map((f) => f.nom);
export const RAYON_MIN = 2.6; // m : rayon minimal du crochet (fiche, page 5)

const JAUNE = '#f3cd6b'; // peinture des grues du DXF de l'utilisateur
const ARDOISE = '#61666a';
const METAL = '#d5d9dd';
const METAL_FONCE = '#8e979f';
const memoire = new Map();
const garder = (cle, calcul) => {
  if (!memoire.has(cle)) {
    if (memoire.size > 120) memoire.clear();
    memoire.set(cle, calcul());
  }
  return memoire.get(cle);
};

const fixe2 = (v) => v.toFixed(2);
const fixe1 = (v) => v.toFixed(1);
/** Petit code (4 signes) d'une chaîne : distingue les réglages dans le nom du bloc DXF. */
function hash36(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36).slice(-4).padStart(4, '0');
}
const borne = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- Données choisies

/** Flèche de la fiche la plus proche de la longueur demandée. */
export const flecheDe = (nom) => FLECHES.reduce((m, f) => (Math.abs(f.nom - nom) < Math.abs(m.nom - nom) ? f : m));
export const tourDe = (id) => TOURS.find((t) => t.id === id) ?? TOURS.find((t) => t.id === 'hc175-uc460m');

/** Hauteurs sous crochet d'une tour : [{ etiquette, h, etoile, speciaux, suspect }] (de la fiche, de bas en haut). */
export const hauteursDe = (tour) => tour.hauteurs.map(([etiquette, h, opt]) => ({ etiquette, h, ...(opt ?? {}) }));

/** Hauteur de la tour la plus proche de h (m). */
export function hauteurChoisie(tour, h) {
  const l = hauteursDe(tour);
  const but = Number.isFinite(Number(h)) ? Number(h) : 30;
  return l.reduce((m, x) => (Math.abs(x.h - but) < Math.abs(m.h - but) ? x : m));
}

/**
 * Réglages d'un objet { fleche, tour, hauteur, rayonCrochet, mode, treuil, cercles, rotationFleche } ramenés à ce que la
 * fiche permet (flèche, hauteur et rayon valables ; LM 2 seulement de 40,0 à 62,5 m).
 */
export function reglagesEcb172(o = {}) {
  const fleche = flecheDe(Number(o.fleche) || 50);
  const tour = tourDe(o.tour);
  const hauteur = hauteurChoisie(tour, o.hauteur);
  const r = borne(Number.isFinite(Number(o.rayonCrochet)) && o.rayonCrochet !== '' && o.rayonCrochet != null ? Number(o.rayonCrochet) : fleche.nom, RAYON_MIN, fleche.nom);
  const mode = o.mode === 'lm2' && fleche.lm2 ? 'lm2' : 'lm1';
  const treuil = o.treuil === 45 || o.treuil === '45' ? 45 : 24;
  const cercles = ['aucun', 'tous', 'principaux'].includes(o.cercles) ? o.cercles : 'principaux';
  return { fleche, tour, hauteur, r: Math.round(r * 10) / 10, mode, treuil, cercles, rotationFleche: Number(o.rotationFleche) || 0 };
}

/**
 * Charge maximale (t) au rayon r du crochet, d'après le tableau LM 1 / LM 2 de la fiche : 8 t de 2,6 m jusqu'à « rPlein » ;
 * au-delà, la valeur de la COLONNE SUIVANTE du tableau (la fiche ne donne que des colonnes : on ne calcule pas entre deux,
 * c'est le côté prudent). Renvoie { t, rayon, source: 'plein' | 'colonne', colonne?, jusqua?, mode }.
 */
export function chargeAuRayon(fleche, r, mode = 'lm1') {
  const lm2 = mode === 'lm2' && fleche.lm2;
  const tab = lm2 ? fleche.lm2 : fleche.lm1;
  const rPlein = lm2 ? fleche.rPlein2 : fleche.rPlein;
  const rr = borne(Number(r), RAYON_MIN, fleche.nom);
  const m = lm2 ? 'lm2' : 'lm1';
  if (rr <= rPlein + 1e-9) return { t: 8, rayon: rr, source: 'plein', jusqua: rPlein, mode: m };
  const c = tab.find(([cr]) => cr >= rr - 1e-9);
  return { t: c[1], rayon: rr, source: 'colonne', colonne: c[0], mode: m };
}

/** Contrepoids de la flèche pour un treuil : { t, blocs, total (texte « 6 × A + 1 × B ») } ; null si la fiche n'en donne pas (45 kW). */
export function contrepoidsDe(fleche, treuil = 24) {
  if (treuil !== 24) return null;
  const { t, blocs } = fleche.contrepoids;
  const nb = {};
  for (const b of blocs) nb[b] = (nb[b] ?? 0) + 1;
  return { t, blocs, texte: Object.entries(nb).map(([b, n]) => `${n} × ${b}`).join(' + ') };
}

/** Poids des éléments de flèche (kg, poids individuels de la fiche, hors contre-flèche et tour). */
export const poidsFleche = (fleche) => fleche.sections.reduce((s, i) => s + ELEMENTS_FLECHE[i].kg, 0);

/** Position de l'extrémité de la flèche (m depuis l'axe) : début + éléments (longueurs nominales du dessin de la fiche). */
export const boutDeFleche = (fleche) => DIMENSIONS.debutFleche + fleche.sections.reduce((s, i) => s + ELEMENTS_FLECHE[i].nom, 0);

const CERCLES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

/** Fiche écrite d'un réglage : [{ titre, valeur, alerte? }] (affichée dans le panneau, tout vient de la fiche). */
export function ficheEcb172(o) {
  const g = reglagesEcb172(o);
  const { fleche: f, tour, hauteur: h, r, mode } = g;
  const ch = chargeAuRayon(f, r, mode);
  const bout = chargeAuRayon(f, f.nom, mode);
  const cp = contrepoidsDe(f, g.treuil);
  const pas = [];
  const l = [];
  l.push({ titre: 'Charge au crochet', valeur: `${fixe2(ch.t)} t à ${fixe1(ch.rayon)} m (${mode === 'lm2' ? 'LM 2' : 'LM 1'})`, detail: ch.source === 'plein' ? `charge maximale de 8 t de ${fixe1(RAYON_MIN)} m à ${fixe1(ch.jusqua)} m` : `colonne du tableau à ${fixe1(ch.colonne)} m (la fiche ne donne pas de valeur entre deux colonnes)` });
  l.push({ titre: 'Charge en bout de flèche', valeur: `${fixe2(bout.t)} t à ${fixe1(f.nom)} m` });
  l.push({ titre: 'Hauteur sous crochet', valeur: `${fixe1(h.h)} m`, detail: `tour ${tour.famille}, ${h.etiquette === '0' ? 'sans élément de mât' : `rang « ${h.etiquette} » de la fiche`}`, alerte: h.h > HAUTEUR_CHARGES_MAX ? `Les charges de la fiche valent jusqu'à ${HAUTEUR_CHARGES_MAX} m de hauteur sous crochet : au-dessus, voir le manuel du constructeur.` : null });
  if (h.speciaux) pas.push(`Éléments de mât spéciaux demandés : ${h.speciaux}.`);
  if (h.etoile) pas.push('Cette hauteur porte le repère « *) » de la fiche (pictogramme non expliqué dans la fiche).');
  if (h.suspect) pas.push('Valeur qui semble fausse dans la fiche (imprimée telle quelle).');
  l.push({ titre: 'Flèche', valeur: `${fixe1(f.nom)} m (portée maximale ${fixe1(f.rMax)} m)`, detail: `éléments ${f.sections.map((i) => CERCLES[i - 1]).join(' ')}, ${Math.round(poidsFleche(f))} kg` });
  if (cp) l.push({ titre: 'Contrepoids (treuil 24 kW FU)', valeur: `${fixe2(cp.t)} t`, detail: cp.texte });
  else l.push({ titre: 'Contrepoids', valeur: 'non donnés par la fiche pour le treuil 45 kW FU' });
  const tr = TREUILS[g.treuil];
  l.push({ titre: `Treuil ${tr.nom}`, valeur: `câble ${tr.cable} m`, detail: tr.vitesses.map(([t, v]) => `${fixe2(t)} t à ${v} m/min`).join(' · ') });
  l.push({ titre: 'Pied', valeur: tour.pied.type === 'FA' ? 'ancrage fixe' : tour.pied.type === 'UC' ? `châssis roulant ${fixe2(tour.pied.c)} m` : `croix de fondation ${fixe2(tour.pied.c)} m`, detail: `mât ${fixe2(tour.mat)} m de large` });
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
  return [...piece(JAUNE, 'peinture', pts), ...treillis(x0, x1, w, 1.25), trait([[x0, 0], [x1, 0]], false, '#8a9198')];
}

/** Pointe de flèche ⑨ : sabot qui se rétrécit, poulie au bout. */
function pointeFleche(x0, x1, w) {
  const l = x1 - x0;
  const pts = [[x0, -w / 2], [x0 + l * 0.7, -w / 2], [x1, -w * 0.26], [x1, w * 0.26], [x0 + l * 0.7, w / 2], [x0, w / 2]];
  return [...piece(JAUNE, 'peinture', pts), ...piece(METAL_FONCE, 'metal', cercle(x1 - 0.2, 0, 0.17, 14))];
}

/** Pied de la tour (vue de dessus) : ancrage fixe, croix de fondation ou châssis roulant (carré d'appui c, bras en diagonale). */
function pied(tour) {
  const { type, c } = tour.pied;
  const B = tour.mat;
  const res = [];
  if (type === 'FA') {
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) res.push(...piece(METAL_FONCE, 'metal', rectArrondi(sx * (B / 2 + 0.05) - 0.22, sy * (B / 2 + 0.05) - 0.22, sx * (B / 2 + 0.05) + 0.22, sy * (B / 2 + 0.05) + 0.22, 0.03, 1)));
    return res;
  }
  const arm = c * Math.SQRT2 + 0.6; // longueur d'un bras en diagonale (7,12 m pour 4,60 m : « Tragholm lang » de la fiche)
  const cote = c - 0.35; // longueur d'un côté du carré (« Randträger »)
  for (const a of [45, -45]) res.push(...piece(METAL, 'metal', tourner(rectArrondi(-arm / 2, -0.38, arm / 2, 0.38, 0.05, 1), a)));
  for (const [dx, dy, a] of [[0, c / 2, 0], [0, -c / 2, 0], [c / 2, 0, 90], [-c / 2, 0, 90]]) {
    const p = tourner(rectArrondi(-cote / 2, -0.25, cote / 2, 0.25, 0.04, 1), a);
    res.push(...piece(METAL, 'metal', p.map(([x, y]) => [x + dx, y + dy])));
  }
  if (type === 'UC') {
    // 4 chariots de roulement aux coins (1,38 × 0,88 m)
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      res.push(...piece('#3a3f45', 'metal', rectArrondi(sx * c / 2 - 0.69, sy * c / 2 - 0.44, sx * c / 2 + 0.69, sy * c / 2 + 0.44, 0.08, 2)));
      res.push(trait([[sx * c / 2 - 0.69, sy * c / 2], [sx * c / 2 + 0.69, sy * c / 2]], false, '#9aa3ab'));
    }
  }
  return res;
}

/** Mât (carré B, croisillons) : visible seulement hors de la plate-forme. */
function mat(B) {
  const h = B / 2;
  return [...piece(JAUNE, 'peinture', rectArrondi(-h, -h, h, h, 0.03, 1)), trait([[-h, -h], [h, h]], false, ARDOISE), trait([[-h, h], [h, -h]], false, ARDOISE)];
}

/** Contre-flèche, treuil, contrepoids, plate-forme, cabine et flèche : tout ce qui tourne avec la flèche. */
function partieHaute(g) {
  const { fleche: f, r, mode, treuil } = g;
  const D = DIMENSIONS;
  const res = [];
  const x0 = -D.contreFlecheArriere;
  // Contre-flèche (13,4 m × 2,30 m)
  res.push(...piece(JAUNE, 'peinture', rectArrondi(x0, -D.contreFleche.b / 2, -0.4, D.contreFleche.b / 2, 0.06, 1)));
  res.push(...treillis(x0, -0.4, 2.3, 1.3), trait([[x0, 0], [-0.4, 0]], false, '#8a9198'));
  // Contrepoids : un bloc par place, de l'arrière vers la tour (ordre de la fiche, à valider) ; 0,28 m d'épaisseur
  const cp = contrepoidsDe(f, treuil);
  if (cp) {
    const arriere = -D.arriereTotal;
    cp.blocs.forEach((b, i) => {
      const bl = BLOCS[b];
      const xa = arriere + i * (bl.ep + 0.03);
      res.push(...piece(bl.couleur, 'peinture', rectArrondi(xa, -bl.long / 2, xa + bl.ep, bl.long / 2, 0.02, 1)));
    });
  }
  // Treuil de levage : deux tambours
  res.push(...piece(METAL, 'metal', rectArrondi(-11.9, -0.9, -8.2, 0.9, 0.06, 2)), ...piece(METAL_FONCE, 'metal', rectArrondi(-11.5, -0.6, -9.2, 0.6, 0.05, 2)), trait([[-10.3, -0.6], [-10.3, 0.6]], false, ARDOISE));
  res.push(texte('172 EC-B', -5.6, 0, 0.7, { k: '#1e293b' }));
  // Plate-forme tournante (5,52 × 2,32 m), couronne d'orientation, pointe de mât
  res.push(...piece(METAL, 'metal', rectArrondi(-2.9, -D.plateforme.b / 2, -2.9 + D.plateforme.l, D.plateforme.b / 2, 0.08, 2)));
  res.push(trait(cercle(0, 0, g.tour.mat * 0.62, 28), true, ARDOISE), ...piece(JAUNE, 'peinture', cercle(0, 0, 0.5, 18)));
  // Cabine à côté de la flèche (2,40 × 2,09 m, position estimée)
  res.push(...piece('#f8fafc', 'blanc', rectArrondi(0.5, 0.86, 0.5 + D.cabine.l, 0.86 + D.cabine.b, 0.12, 3)), ...piece('#8fc6cf', 'vitre', rectArrondi(0.5 + D.cabine.l - 0.7, 1.0, 0.5 + D.cabine.l - 0.1, 0.86 + D.cabine.b - 0.14, 0.05, 2)));
  // Flèche : éléments mis bout à bout (longueurs nominales)
  let x = D.debutFleche;
  for (const i of f.sections) {
    const l = ELEMENTS_FLECHE[i].nom;
    res.push(...(i === 9 ? pointeFleche(x, x + l, DIMENSIONS.flecheLargeur) : troncon(x, x + l, DIMENSIONS.flecheLargeur)));
    x += l;
  }
  // Chariot et crochet au rayon choisi
  res.push(...piece('#3a3f45', 'metal', rectArrondi(r - 0.5, -0.78, r + 0.5, 0.78, 0.08, 2)), ...piece(NOIR, 'metal', cercle(r, 0, 0.28, 14)));
  const ch = chargeAuRayon(f, r, mode);
  res.push(texte(`r ${fixe1(ch.rayon)} m · ${fixe2(ch.t)} t`, r, -1.7, 0.9, { k: '#7c2d12' }));
  return res;
}

/** Cercles de charge : le principal (portée du crochet au bout de la flèche), ceux du tableau, le rayon choisi. */
function cerclesDeCharge(g) {
  const { fleche: f, mode, r, cercles } = g;
  const tab = mode === 'lm2' && f.lm2 ? f.lm2 : f.lm1;
  const res = [{ g: 'c', k: '#334155', x: 0, y: 0, r: f.nom, mat: 'trait' }];
  const texteCercle = (rr, t) => ({ g: 't', k: '#92400e', x: rr, y: -2.4, h: 0.9, a: 90, t: `${rr} m · ${fixe2(t)} t`, ah: 1, av: 2 });
  const choisis = tab.filter(([rr]) => rr < f.nom && rr >= 20 && (cercles === 'tous' || rr % 10 === 0));
  for (const [rr, t] of choisis) {
    if (cercles === 'aucun') break;
    res.push({ g: 'c', k: '#8a9198', x: 0, y: 0, r: rr, mat: 'trait' }, texteCercle(rr, t));
  }
  res.push(texteCercle(f.nom, tab[tab.length - 1][1]));
  return res;
}

/**
 * Symbole d'une grue Liebherr 172 EC-B 8 posée { fleche, tour, hauteur, rayonCrochet, mode, treuil, cercles,
 * rotationFleche } : { primitives, rayon, boite, fleche (portée du crochet en bout), modele: 'ecb172', nom, nomBloc }.
 * Le point de base est l'axe de la tour. La rotation de la flèche fait tourner tout le haut (pas le pied).
 */
export function grueEcb172(o = {}) {
  const g = reglagesEcb172(o);
  const cle = JSON.stringify([g.fleche.nom, g.tour.id, g.hauteur.h, g.r, g.mode, g.treuil, g.cercles, g.rotationFleche]);
  return garder(cle, () => {
    const bas = [...pied(g.tour), ...mat(g.tour.mat)];
    let haut = partieHaute(g);
    haut.push(texte(`H ${fixe1(g.hauteur.h)} m`, -7.2, -2.2, 0.8, { k: '#1e293b' }));
    if (g.rotationFleche) haut = tournerPrims(haut, g.rotationFleche);
    const nom = `Grue Liebherr 172 EC-B 8 · flèche ${fixe1(g.fleche.nom)} m`;
    const s = versSymbole(nom, 'Grues', [...bas, ...haut], { centre: false });
    const code = (v) => String(v).replace('.', '_');
    return {
      ...s, modele: 'ecb172', fleche: g.fleche.nom, rayon: cerclesDeCharge(g), tonnes: chargeAuRayon(g.fleche, g.r, g.mode).t,
      nomBloc: `GRUE_ECB172_${code(g.fleche.nom)}M_${hash36(cle)}`, // court : un nom de bloc DXF R12 a 31 caractères au plus
    };
  });
}

