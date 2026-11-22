// Ce qui a changé entre deux indices d'un plan calé (0.281.0, calage de plans, étape 4 « comparaison » ; repris de
// l'appli d'origine, calage_app/session.py _differences et calage_core/appariement.py).
// Les deux plans sont déjà en MN95 (calés et nettoyés). Un objet est « retrouvé » dans l'autre plan si au moins 50 %
// de ses points (sommets ET 3 points le long de chaque segment, au quart, au milieu et aux trois quarts, pour qu'un
// trait remplacé par un autre qui touche les mêmes sommets ne passe pas pour retrouvé) ont un point de la même famille (trait, cercle, texte, point) à moins de 1 cm.
//  - ajouté   = objet du nouvel indice pas retrouvé dans l'ancien ;
//  - supprimé = objet de l'ancien indice pas retrouvé dans le nouveau ;
//  - inchangé = le reste du nouvel indice.

export const TOLERANCE_DIFFERENCE_M = 0.01;
const PART_MIN = 0.5;
const LISTES = ['traits', 'pleins', 'cercles', 'textes', 'points'];
const FAMILLE = { traits: 'trait', pleins: 'trait', cercles: 'cercle', textes: 'texte', points: 'point' };

/** Points d'un objet (coordonnées absolues) : sommets + 3 points par segment ; cercle : centre + 4 points. */
function pointsObjet(liste, o, { est, nord }) {
  if (liste === 'cercles') {
    return [[o.x, o.y], [o.x + o.r, o.y], [o.x - o.r, o.y], [o.x, o.y + o.r], [o.x, o.y - o.r]].map(([x, y]) => [est + x, nord + y]);
  }
  if (liste === 'textes' || liste === 'points') return [[est + o.x, nord + o.y]];
  const p = o.p;
  const pts = [];
  for (let i = 0; i < p.length; i += 2) {
    pts.push([est + p[i], nord + p[i + 1]]);
    if (i + 3 < p.length) {
      for (const f of [0.25, 0.5, 0.75]) pts.push([est + p[i] + f * (p[i + 2] - p[i]), nord + p[i + 1] + f * (p[i + 3] - p[i + 1])]);
    }
  }
  return pts;
}

/** Index des points d'un plan par famille, en cases de la taille de la tolérance. */
function indexer(plan, tol) {
  const index = new Map(); // famille -> Map(case -> [[x, y]])
  for (const liste of LISTES) {
    const famille = FAMILLE[liste];
    if (!index.has(famille)) index.set(famille, new Map());
    const cases = index.get(famille);
    for (const o of plan.contenu?.[liste] ?? []) {
      for (const [x, y] of pointsObjet(liste, o, plan.origine)) {
        const cle = `${Math.floor(x / tol)},${Math.floor(y / tol)}`;
        if (!cases.has(cle)) cases.set(cle, []);
        cases.get(cle).push([x, y]);
      }
    }
  }
  return index;
}

function retrouve(points, cases, tol) {
  if (!points.length || !cases) return false;
  let ok = 0;
  for (const [x, y] of points) {
    const i = Math.floor(x / tol);
    const j = Math.floor(y / tol);
    let trouve = false;
    for (let di = -1; di <= 1 && !trouve; di += 1) {
      for (let dj = -1; dj <= 1 && !trouve; dj += 1) {
        trouve = (cases.get(`${i + di},${j + dj}`) ?? []).some(([u, v]) => Math.hypot(u - x, v - y) <= tol);
      }
    }
    if (trouve) ok += 1;
  }
  return ok / points.length >= PART_MIN;
}

/**
 * Différences entre l'ancien et le nouvel indice (plans en MN95, format lirePlanDxf). Renvoie
 * { ajoutes, supprimes, inchanges } (pour chaque : { traits: [indices], pleins, cercles, textes, points }),
 * compte { ajoutes, supprimes, inchanges } et parCalque [{ nom, ajoutes, supprimes }] (les plus touchés d'abord).
 */
export function differencesPlans(ancien, nouveau, tol = TOLERANCE_DIFFERENCE_M) {
  const indexAncien = indexer(ancien, tol);
  const indexNouveau = indexer(nouveau, tol);
  const vide = () => Object.fromEntries(LISTES.map((l) => [l, []]));
  const res = { ajoutes: vide(), supprimes: vide(), inchanges: vide() };
  const parCalque = new Map();
  const compter = (nom, quoi) => {
    if (!parCalque.has(nom)) parCalque.set(nom, { nom, ajoutes: 0, supprimes: 0 });
    parCalque.get(nom)[quoi] += 1;
  };
  for (const liste of LISTES) {
    (nouveau.contenu?.[liste] ?? []).forEach((o, i) => {
      if (retrouve(pointsObjet(liste, o, nouveau.origine), indexAncien.get(FAMILLE[liste]), tol)) res.inchanges[liste].push(i);
      else {
        res.ajoutes[liste].push(i);
        compter(nouveau.calques[o.c]?.nom ?? '?', 'ajoutes');
      }
    });
    (ancien.contenu?.[liste] ?? []).forEach((o, i) => {
      if (!retrouve(pointsObjet(liste, o, ancien.origine), indexNouveau.get(FAMILLE[liste]), tol)) {
        res.supprimes[liste].push(i);
        compter(ancien.calques[o.c]?.nom ?? '?', 'supprimes');
      }
    });
  }
  const total = (r) => LISTES.reduce((n, l) => n + r[l].length, 0);
  return {
    ...res,
    compte: { ajoutes: total(res.ajoutes), supprimes: total(res.supprimes), inchanges: total(res.inchanges) },
    parCalque: [...parCalque.values()].sort((a, b) => b.ajoutes + b.supprimes - (a.ajoutes + a.supprimes)),
  };
}

/** Plan réduit aux objets choisis (indices par liste), d'une seule couleur : pour dessiner ajoutés / supprimés. */
export function sousPlan(plan, choix, couleur) {
  const contenu = Object.fromEntries(LISTES.map((l) => [l, (choix[l] ?? []).map((i) => plan.contenu[l][i])]));
  // Object.create : un plan recalé tient ses calques de son plan d'origine (prototype) ; une copie « { ...plan } »
  // les perdrait.
  return Object.assign(Object.create(plan), { contenu, couleur, visible: true });
}
