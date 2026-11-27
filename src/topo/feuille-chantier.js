// Plans de chantier, étape 4 (0.289.0) : mise en page de la feuille (comme l'espace papier d'AutoCAD), sans écran.
// Feuille A4 / A3 / A1 paysage ou portrait, plan à l'échelle du plan de chantier (plan.echelle), cartouche avec logo,
// légende automatique (genres et symboles utilisés), nord, barre d'échelle ; une page par phase ou toutes sur une page.
// Unités : mm de papier (origine en haut à gauche de la feuille, y vers le bas).
import { modeleDe } from './grue-modele.js';
import { detailsDe } from './details-feuille.js';
import { tailleFeuille, barreEchellePapier } from '../export/echelle.js';
import { categorieZone, styleLigne, objetsVisibles, objetsVus, bornesObjets, ECHELLE_PAPIER, estPose, materiauTas } from './plan-chantier.js';

export const FORMATS_FEUILLE = [['a4', 'A4'], ['a3', 'A3'], ['a2', 'A2'], ['a1', 'A1']];

// 0.337.0 : cartouche, nord, échelle et légende se règlent chacun dans une petite fenêtre.
export const STYLES_NORD = [['boussole', 'Boussole (cercle)'], ['simple', 'Flèche simple'], ['rose', 'Rose des vents'], ['pleine', 'Flèche pleine']];
export const STYLES_BARRE = [['alternee', 'Barre alternée noir / blanc'], ['simple', 'Barre simple graduée'], ['chiffres', 'Ligne avec chiffres'], ['texte', 'Texte seul (1:200)']];
export const COLONNES_LEGENDE = [['auto', 'Automatique'], ['1', '1 colonne'], ['2', '2 colonnes']];
const borne = (v, mini, maxi, defaut) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.min(maxi, Math.max(mini, n)) : defaut; };
const couleurDe = (v, defaut) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? v : defaut);
/** Réglages du nord, de l'échelle (barre) et de la légende : valeurs de départ et bornes (jamais une valeur absurde). */
export function reglagesElements(f = {}) {
  return {
    cartoucheActif: f.cartoucheActif !== false,
    nordStyle: STYLES_NORD.some(([c]) => c === f.nordStyle) ? f.nordStyle : 'boussole', nordTaille: borne(f.nordTaille, 50, 250, 100), nordCouleur: couleurDe(f.nordCouleur, '#1b2b36'),
    barreStyle: STYLES_BARRE.some(([c]) => c === f.barreStyle) ? f.barreStyle : 'alternee', barreTaille: borne(f.barreTaille, 50, 250, 100), barreLongueur: borne(f.barreLongueur, 0, 5000, 0), barreCouleur: couleurDe(f.barreCouleur, '#1b2b36'),
    barreFond: f.barreFond !== false, legendeTaille: borne(f.legendeTaille, 60, 200, 100), legendeColonnes: COLONNES_LEGENDE.some(([c]) => c === f.legendeColonnes) ? f.legendeColonnes : 'auto',
  };
}

/** Réglages de la feuille d'un plan, complétés par ceux de départ. */
export function reglagesFeuille(plan) {
  const f = plan.feuille ?? {};
  return {
    ...reglagesElements(f),
    format: f.format ?? 'a3', orientation: f.orientation ?? 'paysage', pages: f.pages ?? 'une',
    centre: f.centre ?? null, legende: f.legende !== false, nord: f.nord !== false, barre: f.barre !== false,
    plans: f.plans ?? null, situation: situationDe(f.situation), planning: Boolean(f.planning), coupe: Boolean(f.coupe), indice: f.indice ?? 'A', auteur: f.auteur ?? '', date: f.date ?? '', titre: f.titre ?? '', chantier: f.chantier ?? '', cartouche: ['bd', 'bg', 'hd', 'hg'].includes(f.cartouche) ? f.cartouche : 'bd', positions: f.positions ?? {}, rotation: rotationDeFeuille(f.rotation), details: detailsDe(f), logo: f.logo ?? 'perrin',
  };
}

export const COINS_SITUATION = [['hd', 'Haut droite'], ['hg', 'Haut gauche'], ['bg', 'Bas gauche'], ['bd', 'Bas droite']];
/** Nom du chantier du cartouche : celui tapé, sinon « affaire - désignation » du projet (0.329.0). */
export const nomChantierCartouche = (cartouche, nomProjet, tape = '') => String(tape || '').trim()
  || [cartouche?.affaire || nomProjet, cartouche?.lieu ?? cartouche?.designation].map((x) => String(x ?? '').trim()).filter(Boolean).join(' - ');

/** Vue de situation (0.293.0) : petit cadre carte nationale dans un coin, zone du plan en rouge. */
export const situationDe = (s = {}) => ({
  actif: Boolean(s.actif), coin: s.coin ?? 'hd', echelle: s.echelle ?? 5000, taille: s.taille ?? 60, auto: Boolean(s.auto),
  // 0.329.0 : transparence de la carte (0 à 90 %, fond blanc gardé : la carte s'efface vers le blanc pour faire ressortir le rectangle)
  // et épaisseur du trait du rectangle rouge (mm sur le papier).
  transparence: Math.min(90, Math.max(0, Number(s.transparence) || 0)), epaisseur: Math.min(3, Math.max(0.2, Number(s.epaisseur) || 0.5)),
});

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
  if (mise.situation) return mise.situation; // 0.331.0 : placée par miseEnPageFeuille (coin libre ou place choisie)
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

export const COINS_CARTOUCHE = [['bd', 'Bas droite'], ['bg', 'Bas gauche'], ['hd', 'Haut droite'], ['hg', 'Haut gauche']];

/** Rectangles { x, y, l, h } qui se touchent ou se recouvrent (à « marge » mm près) ? */
const seRecouvrent = (a, b, marge = 0) => a.x < b.x + b.l + marge && b.x < a.x + a.l + marge && a.y < b.y + b.h + marge && b.y < a.y + a.h + marge;

/**
 * Cadres de la feuille (mm) : page, cadre du plan (toute la feuille moins la marge), cartouche dans un des 4 coins (0.331.0 :
 * `opts.coin`, bas droite au départ), légende collée au cartouche (du côté du plan), nord, barre d'échelle et vue de situation.
 * k = taille des éléments (A3 = 1).
 * Nord, barre d'échelle et situation : à la place demandée (`opts.positions[nom] = { fx, fy }`, fractions 0 à 1 de la place libre dans le
 * cadre : on les glisse sur la feuille), sinon dans un coin libre (jamais sur le cartouche, la légende ni un autre élément) :
 * situation dans son coin (`opts.situation.coin`), nord en haut à gauche, barre d'échelle en bas à gauche, ou le coin libre suivant.
 */
export function miseEnPageFeuille(format = 'a3', orientation = 'paysage', lignesLegende = 0, opts = {}) {
  let { coin = 'bd', positions = {}, situation = null, details = [] } = opts;
  const { cartoucheActif = true, nordTaille = 100, barreTaille = 100, legendeTaille = 100, legendeColonnes = 'auto' } = opts;
  const page = tailleFeuille(format, orientation);
  const k = Math.max(page.largeur, page.hauteur) / 420;
  const marge = Math.max(7, 10 * Math.sqrt(k));
  const cadre = { x: marge, y: marge, l: page.largeur - 2 * marge, h: page.hauteur - 2 * marge };
  const lc = Math.min(cadre.l * 0.45, 135 * k);
  const hc = cartoucheActif ? 36 * k : 0; // sans cartouche : la légende prend sa place
  const enBas = coin.startsWith('b');
  const aDroite = coin.endsWith('d');
  const cartouche = { x: aDroite ? cadre.x + cadre.l - lc : cadre.x, y: enBas ? cadre.y + cadre.h - hc : cadre.y, l: lc, h: hc };
  const ligne = 6 * k * (legendeTaille / 100); // hauteur d'une ligne de la légende
  const colonnes = legendeColonnes === '1' ? 1 : legendeColonnes === '2' ? 2 : lignesLegende > 8 ? 2 : 1;
  const nLignes = Math.ceil(lignesLegende / colonnes);
  const hl = lignesLegende ? Math.min(cadre.h - hc - 10 * k, 9 * k + nLignes * ligne) : 0;
  const legende = { x: cartouche.x, y: enBas ? cartouche.y - hl : cartouche.y + hc, l: lc, h: hl, ligne, colonnes };
  const maxBarre = Math.min(70 * k, cadre.l * 0.25);
  // Planning des phases (0.294.1) : dans la rangée du cartouche, à côté de lui (après la barre d'échelle si elle est en bas).
  const reserve = enBas ? maxBarre + 21 * k : 6 * k; // la barre d'échelle (bas gauche) reste devant lui
  const px = aDroite ? cadre.x + reserve : cartouche.x + lc + 4 * k;
  const pFin = aDroite ? cartouche.x - 4 * k : cadre.x + cadre.l - (enBas ? reserve : 6 * k);
  const planning = { x: px, y: cartouche.y, l: Math.max(0, pFin - px), h: cartouche.h };

  // Tailles des éléments déplaçables (boîtes en mm).
  const tNord = 12 * k * (nordTaille / 100);
  const tailles = {
    nord: { l: 1.7 * tNord, h: 2.1 * tNord },
    barre: { l: maxBarre + 14 * k, h: 9 * k * (barreTaille / 100) },
    situation: situation?.actif ? { l: situation.taille * k, h: situation.taille * k } : null,
  };
  // Cadres de détail (0.333.0) : taille = fractions du cadre ; un rond est un carré.
  const nomsDetails = [];
  for (const d of details) {
    const nom = `det:${d.id}`;
    const l = d.fw * cadre.l;
    const h = d.fh * cadre.h;
    tailles[nom] = d.forme === 'rond' ? { l: Math.min(l, h), h: Math.min(l, h) } : { l, h };
    nomsDetails.push(nom);
    if (d.pos) positions = { ...positions, [nom]: d.pos };
  }
  const occupes = [cartouche, ...(hl ? [legende] : []), ...(planning.l > 40 * k ? [planning] : [])];
  const dansCoin = (nom, c) => {
    const { l, h } = tailles[nom];
    const m = (nom === 'situation' || nom.startsWith('det:') ? 3 : nom === 'nord' ? 1 : 4) * k;
    // c : coin ('hg', 'hd', 'bg', 'bd') ou milieu d'un bord ('hm' en haut, 'bm' en bas)
    const x = c.endsWith('m') ? cadre.x + (cadre.l - l) / 2 : c.endsWith('g') ? cadre.x + m : cadre.x + cadre.l - l - m;
    return { x, y: c.startsWith('h') ? cadre.y + m : cadre.y + cadre.h - h - m, l, h };
  };
  const libre = (b) => ![...occupes, ...Object.values(boites)].some((o) => seRecouvrent(b, o, 2 * k));
  /** Première place libre : les coins préférés, puis les milieux des bords, puis un balayage de la feuille. */
  const placeLibre = (nom) => {
    const { l, h } = tailles[nom];
    const coins = [...preferes[nom], 'hm', 'bm'].map((c) => dansCoin(nom, c));
    const trouve = coins.find(libre);
    if (trouve) return trouve;
    for (let fy = 0; fy <= 1.001; fy += 0.05) {
      for (let fx = 0; fx <= 1.001; fx += 0.05) {
        const b = { x: cadre.x + fx * Math.max(0, cadre.l - l), y: cadre.y + fy * Math.max(0, cadre.h - h), l, h };
        if (libre(b)) return b;
      }
    }
    return coins[0];
  };
  const dePosition = (nom, pos) => {
    const { l, h } = tailles[nom];
    const fx = Math.min(1, Math.max(0, Number(pos.fx) || 0));
    const fy = Math.min(1, Math.max(0, Number(pos.fy) || 0));
    return { x: cadre.x + fx * Math.max(0, cadre.l - l), y: cadre.y + fy * Math.max(0, cadre.h - h), l, h };
  };
  const boites = {};
  const preferes = { situation: [situation?.coin ?? 'hd', 'hd', 'hg', 'bd', 'bg'], nord: ['hg', 'hd', 'bg', 'bd'], barre: ['bg', 'bd', 'hg', 'hd'] };
  nomsDetails.forEach((nom, i) => { preferes[nom] = i ? ['hg', 'hd', 'bd', 'bg'] : ['hd', 'hg', 'bd', 'bg']; });
  for (const nom of [...nomsDetails, 'situation', 'nord', 'barre']) {
    if (!tailles[nom]) continue;
    let b = positions[nom] ? dePosition(nom, positions[nom]) : null;
    if (!b) b = placeLibre(nom);
    boites[nom] = b;
  }
  const nord = boites.nord ? { x: boites.nord.x + 0.85 * tNord, y: boites.nord.y + 1.25 * tNord, t: tNord } : { x: cadre.x + 11 * k, y: cadre.y + 17 * k, t: tNord };
  const barre = boites.barre ? { x: boites.barre.x + 2 * k, y: boites.barre.y + 6 * k * (barreTaille / 100), max: maxBarre } : { x: cadre.x + 6 * k, y: cadre.y + cadre.h - 8 * k, max: maxBarre };
  return {
    page, k, cadre, cartouche, legende, nord, barre, planning, situation: boites.situation ?? null,
    // Boîtes (mm) de ce qu'on peut glisser sur la feuille, pour le toucher et les accroches.
    boites: { nord: boites.nord ?? null, barre: boites.barre ?? null, situation: boites.situation ?? null, ...Object.fromEntries(nomsDetails.map((n) => [n, boites[n]])) }, fixes: occupes,
  };
}

/** Place { fx, fy } (fractions) qui met la boîte { x, y, l, h } là où elle est, dans le cadre. */
export function positionDeBoite(mise, boite) {
  const { cadre } = mise;
  return {
    fx: Math.round(Math.min(1, Math.max(0, (boite.x - cadre.x) / Math.max(1e-6, cadre.l - boite.l))) * 10000) / 10000,
    fy: Math.round(Math.min(1, Math.max(0, (boite.y - cadre.y) / Math.max(1e-6, cadre.h - boite.h))) * 10000) / 10000,
  };
}

/**
 * Accroche d'une boîte qu'on glisse (0.331.0, « comme un bloc ») : ses bords se collent au cadre, aux bords et aux milieux
 * des autres éléments (cartouche, légende, planning, les autres boîtes) à « tolerance » mm près. Renvoie la boîte corrigée.
 */
export function accrocherBoite(boite, autres, cadre, tolerance) {
  const xs = [cadre.x, cadre.x + cadre.l, cadre.x + cadre.l / 2];
  const ys = [cadre.y, cadre.y + cadre.h, cadre.y + cadre.h / 2];
  for (const o of autres) {
    xs.push(o.x, o.x + o.l, o.x + o.l / 2);
    ys.push(o.y, o.y + o.h, o.y + o.h / 2);
  }
  const meilleur = (valeurs, ancres) => {
    let d = tolerance;
    let delta = 0;
    for (const v of valeurs) {
      for (const a of ancres) {
        if (Math.abs(a - v) < Math.abs(d)) { d = a - v; delta = a - v; }
      }
    }
    return delta;
  };
  const dx = meilleur([boite.x, boite.x + boite.l, boite.x + boite.l / 2], xs);
  const dy = meilleur([boite.y, boite.y + boite.h, boite.y + boite.h / 2], ys);
  return { ...boite, x: boite.x + dx, y: boite.y + dy };
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
export function vueDuCadre(plan, cadre, pxParMm, centre, rotation = 0) {
  const echelle = plan.echelle ?? ECHELLE_PAPIER;
  return { echelle: (pxParMm * 1000) / echelle, estCentre: centre[0], nordCentre: centre[1], largeur: cadre.l * pxParMm, hauteur: cadre.h * pxParMm, rotation };
}

/** Rotation de la feuille (°) ramenée à −180…180 ; arrondie au centième. */
export const rotationDeFeuille = (v) => {
  const n = Number(String(v ?? 0).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round((((n + 180) % 360 + 360) % 360 - 180) * 100) / 100;
};

/**
 * Rotation de la feuille (0.332.0) qui met une ligne du plan à l'HORIZONTALE (ou à la VERTICALE) : « angle » = angle de la ligne
 * sur le terrain (°, depuis l'Est, sens inverse des aiguilles, comme `angleDeLaLigne`). La rotation est la direction du terrain
 * montrée en haut de la feuille (azimut, voir plan/vue.js) ; on garde le plan « à l'endroit » (de −90° à 90°).
 */
export function rotationPourAligner(angle, vertical = false) {
  const base = vertical ? 90 - angle : -angle;
  const r = ((((base + 90) % 180) + 180) % 180) - 90;
  return Math.round(r * 100) / 100;
}

/** Centre de départ de la feuille : milieu des éléments du plan (ou des plans du projet, ou null). */
export function centreDeDepart(plan, plans = []) {
  const b = bornesObjets(objetsVisibles(plan).filter((o) => o.type !== 'construction'));
  if (b) return [(b.estMin + b.estMax) / 2, (b.nordMin + b.nordMax) / 2];
  const p = plans.find((x) => x.bornes);
  return p ? [(p.bornes.estMin + p.bornes.estMax) / 2, (p.bornes.nordMin + p.bornes.nordMax) / 2] : null;
}

/** Barre d'échelle (m et mm de papier) pour une échelle et une longueur maxi (mm). */
export function barreDeLaFeuille(echelle, maxMm, longueurM = 0) {
  if (longueurM > 0) { // longueur choisie (m), sans dépasser la place
    const mm = (longueurM * 1000) / echelle;
    return mm <= maxMm ? { metres: longueurM, mm } : barreEchellePapier(echelle, maxMm);
  }
  return barreEchellePapier(echelle, maxMm);
}

/** Options de mise en page tirées des réglages de la feuille (une seule source pour l'écran et le PDF). */
export const optionsMiseEnPage = (r) => ({ coin: r.cartouche, positions: r.positions, situation: r.situation, details: r.details, cartoucheActif: r.cartoucheActif, nordTaille: r.nordTaille, barreTaille: r.barreTaille, legendeTaille: r.legendeTaille, legendeColonnes: r.legendeColonnes });

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
    t(champs.affaire, x0, y(0.15), 8, true), // 0.329.0 : « affaire - désignation » (modifiable), sur une seule ligne
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
    if (!m.has(transparence)) m.set(transparence, Object.assign(Object.create(p), { transparence, sourcePlan: p.sourcePlan ?? p }) /* Object.create : un plan recalé hérite de son plan d'origine (un { ...p } perdait calques, couleur… et faisait une page blanche) */);
    return m.get(transparence);
  });
}
