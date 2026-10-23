// Recalage d'un plan DXF qui n'est pas en MN95 (coordonnées locales d'un plan d'architecte,
// d'un plan décalé…). Méthode validée par l'utilisateur (23.10.2026) : transformation de Helmert
// complète à 4 paramètres (déplacement Est et Nord, rotation, échelle), seulement en plan :
//   Est  = a·x − b·y + tEst
//   Nord = b·x + a·y + tNord
// avec x, y les coordonnées du DXF (m), échelle = √(a² + b²), rotation = atan2(b, a).
// Les altitudes ne changent pas.
// - 2 points de calage : la solution est exacte (aucun écart).
// - 3 points ou plus : moindres carrés ; l'écart de chaque point est donné, et on peut en
//   désactiver un (point douteux).
// Calcul par rapport au centre de gravité des points, pour garder de bons chiffres avec de
// grandes coordonnées (2 600 000 m).

/**
 * Paramètres de Helmert à partir des points de calage [{ x, y, est, nord, actif }] (m) ; seuls
 * les points actifs (actif !== false) comptent. Renvoie { a, b, tEst, tNord, echelle, rotation
 * (radians), ecarts: [{ dEst, dNord, distance } ou null pour un point désactivé], ecartType (m,
 * null avec 2 points) } ou { erreur } (moins de 2 points, points confondus).
 */
export function calculerHelmert(paires) {
  const actives = paires.filter((p) => p.actif !== false);
  if (actives.length < 2) return { erreur: 'il faut au moins 2 points de calage actifs' };
  const n = actives.length;
  const moyenne = (cle) => actives.reduce((somme, p) => somme + p[cle], 0) / n;
  const xm = moyenne('x');
  const ym = moyenne('y');
  const em = moyenne('est');
  const nm = moyenne('nord');
  let sommeCarres = 0;
  let sommeA = 0;
  let sommeB = 0;
  for (const p of actives) {
    const dx = p.x - xm;
    const dy = p.y - ym;
    const de = p.est - em;
    const dn = p.nord - nm;
    sommeCarres += dx * dx + dy * dy;
    sommeA += dx * de + dy * dn;
    sommeB += dx * dn - dy * de;
  }
  if (sommeCarres < 1e-9) return { erreur: 'les points de calage sont confondus sur le plan DXF' };
  const a = sommeA / sommeCarres;
  const b = sommeB / sommeCarres;
  const tEst = em - a * xm + b * ym;
  const tNord = nm - b * xm - a * ym;
  const parametres = { a, b, tEst, tNord, echelle: Math.hypot(a, b), rotation: Math.atan2(b, a) };

  // Écart de chaque point : coordonnées transformées − coordonnées MN95 données.
  let sommeEcarts = 0;
  const ecarts = paires.map((p) => {
    const { est, nord } = appliquerHelmert(parametres, p.x, p.y);
    const ecart = { dEst: est - p.est, dNord: nord - p.nord, distance: Math.hypot(est - p.est, nord - p.nord) };
    if (p.actif !== false) sommeEcarts += ecart.dEst ** 2 + ecart.dNord ** 2;
    return ecart;
  });
  // Écart-type d'une coordonnée : 2 équations par point, 4 inconnues.
  const ecartType = n > 2 ? Math.sqrt(sommeEcarts / (2 * n - 4)) : null;
  return { ...parametres, ecarts, ecartType };
}

/** Coordonnées MN95 { est, nord } d'un point du DXF (x, y en m). */
export function appliquerHelmert({ a, b, tEst, tNord }, x, y) {
  return { est: a * x - b * y + tEst, nord: b * x + a * y + tNord };
}

/** Rotation en gons (400 gon = un tour) et en degrés, pour l'affichage. */
export function rotationLisible(rotation) {
  return { gon: (rotation * 200) / Math.PI, degres: (rotation * 180) / Math.PI };
}

/**
 * Plan recalé : mêmes objets, coordonnées transformées (en plan seulement), rangés comme à la
 * lecture (voir topo/dxf-plan.js) : origine au mètre (coin sud-ouest), coordonnées au mm.
 * Rayons des cercles et hauteurs des textes multipliés par l'échelle, angles des textes tournés.
 * Renvoie { origine, bornes, contenu }.
 */
export function recalerContenu(plan, parametres) {
  const { origine, contenu = {} } = plan;
  const versMn95 = (x, y) => appliquerHelmert(parametres, origine.est + x, origine.nord + y);
  // 1. Tout en coordonnées absolues transformées.
  const transformerSuite = (p) => {
    const sortie = [];
    for (let i = 0; i < p.length; i += 2) {
      const { est, nord } = versMn95(p[i], p[i + 1]);
      sortie.push(est, nord);
    }
    return sortie;
  };
  const degres = (parametres.rotation * 180) / Math.PI;
  const absolu = {
    traits: (contenu.traits ?? []).map((t) => ({ ...t, p: transformerSuite(t.p) })),
    pleins: (contenu.pleins ?? []).map((t) => ({ ...t, p: transformerSuite(t.p) })),
    cercles: (contenu.cercles ?? []).map((c) => ({ ...c, ...xy(versMn95(c.x, c.y)), r: c.r * parametres.echelle })),
    textes: (contenu.textes ?? []).map((t) => ({ ...t, ...xy(versMn95(t.x, t.y)), h: t.h * parametres.echelle, a: (t.a ?? 0) + degres })),
    points: (contenu.points ?? []).map((p) => ({ ...p, ...xy(versMn95(p.x, p.y)) })),
  };
  // 2. Bornes et nouvelle origine (coin sud-ouest arrondi au mètre).
  let estMin = Infinity;
  let nordMin = Infinity;
  let estMax = -Infinity;
  let nordMax = -Infinity;
  const borner = (e, n) => {
    estMin = Math.min(estMin, e);
    nordMin = Math.min(nordMin, n);
    estMax = Math.max(estMax, e);
    nordMax = Math.max(nordMax, n);
  };
  for (const liste of [absolu.traits, absolu.pleins]) for (const t of liste) for (let i = 0; i < t.p.length; i += 2) borner(t.p[i], t.p[i + 1]);
  for (const c of absolu.cercles) {
    borner(c.x - c.r, c.y - c.r);
    borner(c.x + c.r, c.y + c.r);
  }
  for (const objet of [...absolu.textes, ...absolu.points]) borner(objet.x, objet.y);
  if (!Number.isFinite(estMin)) return { origine: { ...origine }, bornes: plan.bornes, contenu };
  const nouvelle = { est: Math.floor(estMin), nord: Math.floor(nordMin) };
  // 3. Coordonnées par rapport à la nouvelle origine, au mm.
  const mm = (v) => Math.round(v * 1000) / 1000;
  const local = (p) => p.map((v, i) => mm(v - (i % 2 === 0 ? nouvelle.est : nouvelle.nord)));
  const relatif = (o) => ({ ...o, x: mm(o.x - nouvelle.est), y: mm(o.y - nouvelle.nord) });
  return {
    origine: nouvelle,
    bornes: { estMin, nordMin, estMax, nordMax },
    contenu: {
      traits: absolu.traits.map((t) => ({ ...t, p: local(t.p) })),
      pleins: absolu.pleins.map((t) => ({ ...t, p: local(t.p) })),
      cercles: absolu.cercles.map((c) => ({ ...relatif(c), r: mm(c.r) })),
      textes: absolu.textes.map((t) => ({ ...relatif(t), h: mm(t.h), a: Math.round(t.a * 100) / 100 })),
      points: absolu.points.map(relatif),
    },
  };
}

const xy = ({ est, nord }) => ({ x: est, y: nord });

// Plans recalés déjà calculés (pour ne pas tout retransformer à chaque dessin).
const recales = new WeakMap();

/**
 * Plan à afficher et à utiliser (implantation, accroches, export) : le plan recalé s'il a un
 * recalage appliqué (plan.recalage = { paires, parametres, applique }), sinon le plan tel quel.
 * Le plan d'origine n'est pas modifié (le recalage s'annule). Le plan recalé lit tout le reste
 * (nom, calques, couleur, visible) sur le plan d'origine.
 */
export function planRecale(plan) {
  const parametres = plan.recalage?.applique ? plan.recalage.parametres : null;
  if (!parametres) return plan;
  const cle = JSON.stringify(parametres);
  const enCache = recales.get(plan);
  if (enCache?.cle === cle) return enCache.plan;
  const recale = Object.assign(Object.create(plan), recalerContenu(plan, parametres));
  recales.set(plan, { cle, plan: recale });
  return recale;
}
