// Calage automatique d'un plan (0.281.0, calage de plans, étape 3 ; repris de l'appli d'origine « Calage de plans »,
// calage_core/estimation.py). Trouve la similitude plan reçu → MN95 sans clic, en comparant ses traits à ceux de la
// référence (et des plans déjà calés du projet).
//  1. VOTE : pour chaque échelle candidate (puissances de 10), on apparie des segments de même longueur
//     (tolérance 5 mm + 0,05 %), dans les deux sens de parcours. Chaque paire propose une rotation et une translation ;
//     on compte les propositions par case (0,1° ; 0,25 m) en ajoutant les cases voisines. La meilleure case gagne.
//  2. AJUSTEMENT FIN (ICP, « plus proches points itérés ») : chaque sommet du plan cherche le sommet le plus proche de
//     la cible, moindres carrés, avec des rayons de plus en plus petits (1 m → 3 cm). Échelle libre d'abord, puis
//     arrondie à la puissance de 10 si elle en est à moins de 0,5 % (décision du 22.11) et fixée.
//  3. L'ajustement est fait dans les deux sens (plan → cible et cible → plan) : on garde celui qui fait coïncider
//     le plus de sommets à 1 cm (de la géométrie propre à l'un des deux plans peut faire dériver l'autre sens).
// Confiance (seuils de l'appli d'origine) : FORTE = vote net (2 × la 2e solution), ≥ 15 votes, ≥ 30 sommets
// appariés, écart moyen < 1 cm ; MOYENNE = 1,5 ×, ≥ 8 votes, ≥ 15 sommets, < 2 cm ; sinon FAIBLE (probablement faux).
// Les distances sont en unités de la CIBLE (mètres MN95). Segments : [x1, y1, x2, y2] (coordonnées absolues).

import { similitudeDepuisComplexes, puissanceDeDix, TOLERANCE_ARRONDI_ECHELLE } from './calage-plan.js';

export const ECHELLES_CANDIDATES = [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000];
export const SEUILS_ICP = [1, 0.5, 0.2, 0.1, 0.05, 0.03];
const MAX_POINTS_ICP = 4000;
const VOTE = { tolAbs: 0.005, tolRel: 0.0005, longueurMin: 0.5, nbMaxSegments: 900, maxCandidats: 60, pasAngleDeg: 0.1, pasTranslation: 0.25 };

/**
 * Segments droits d'un plan (traits ordinaires seulement : pas les contours de hachure, splines, cotations…), sans
 * les calques écartés ni cachés. plan : format lirePlanDxf (déjà recalé s'il le faut). Renvoie [[x1, y1, x2, y2]…].
 */
export function segmentsDuPlan(plan, { ecartes = [] } = {}) {
  const ecarte = new Set(ecartes);
  const { est: e0, nord: n0 } = plan.origine;
  const segs = [];
  for (const t of plan.contenu?.traits ?? []) {
    if (t.s || ecarte.has(plan.calques[t.c]?.nom) || plan.calques[t.c]?.visible === false) continue;
    const p = t.p;
    const n = p.length / 2;
    const aretes = t.f && n > 2 ? n : n - 1;
    for (let i = 0; i < aretes; i += 1) {
      const j = (i + 1) % n;
      if (p[2 * i] === p[2 * j] && p[2 * i + 1] === p[2 * j + 1]) continue;
      segs.push([e0 + p[2 * i], n0 + p[2 * i + 1], e0 + p[2 * j], n0 + p[2 * j + 1]]);
    }
  }
  return segs;
}

/** Extrémités des segments, sans doublon (au µ près) : [[x, y]…]. */
export function sommetsDesSegments(segs) {
  const vus = new Set();
  const pts = [];
  for (const s of segs) {
    for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) {
      const cle = `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      pts.push([x, y]);
    }
  }
  return pts;
}

const longueur = (s) => Math.hypot(s[2] - s[0], s[3] - s[1]);

/** Segments assez longs à l'échelle (≥ 0,5 m), les plus longs d'abord (900 au plus). */
function preparer(segs, echelle) {
  const avec = segs.map((s) => ({ s, L: longueur(s) * echelle })).filter((x) => x.L >= VOTE.longueurMin);
  avec.sort((a, b) => b.L - a.L);
  return avec.slice(0, VOTE.nbMaxSegments);
}

/** Vote rotation / translation pour chaque échelle candidate ; meilleure solution ou null. */
export function voter(segsSource, segsCible, echelles = ECHELLES_CANDIDATES) {
  const cible = preparer(segsCible, 1).sort((a, b) => a.L - b.L);
  if (!cible.length) return null;
  const Lc = cible.map((c) => c.L);
  const angC = cible.map(({ s }) => Math.atan2(s[3] - s[1], s[2] - s[0]));
  const milC = cible.map(({ s }) => [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2]);
  const chercher = (v) => { // premier indice où Lc >= v
    let bas = 0;
    let haut = Lc.length;
    while (bas < haut) {
      const m = (bas + haut) >> 1;
      if (Lc[m] < v) bas = m + 1; else haut = m;
    }
    return bas;
  };
  let meilleur = null;
  const scores = new Map();
  for (const ech of echelles) {
    const source = preparer(segsSource, ech);
    const th = [];
    const tx = [];
    const ty = [];
    for (const { s, L } of source) {
      const tol = VOTE.tolAbs + VOTE.tolRel * L;
      const lo = chercher(L - tol);
      const hi = chercher(L + tol + 1e-12);
      if (hi - lo <= 0 || hi - lo > VOTE.maxCandidats) continue;
      const angS = Math.atan2(s[3] - s[1], s[2] - s[0]);
      const zx = ((s[0] + s[2]) / 2) * ech;
      const zy = ((s[1] + s[3]) / 2) * ech;
      for (let j = lo; j < hi; j += 1) {
        for (const sens of [0, Math.PI]) {
          const t = (((angC[j] - angS + sens) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const c = Math.cos(t);
          const si = Math.sin(t);
          th.push(t);
          tx.push(milC[j][0] - (c * zx - si * zy));
          ty.push(milC[j][1] - (si * zx + c * zy));
        }
      }
    }
    const res = th.length ? meilleureCase(th, tx, ty) : null;
    scores.set(ech, res ? res.score : 0);
    if (res && (!meilleur || res.score > meilleur.score)) {
      meilleur = { echelle: ech, theta: res.theta, tx: res.tx, ty: res.ty, score: res.score, second: res.second };
    }
  }
  if (!meilleur) return null;
  // La 2e solution peut venir d'une autre échelle.
  for (const [ech, sc] of scores) if (ech !== meilleur.echelle) meilleur.second = Math.max(meilleur.second, sc);
  meilleur.dominance = meilleur.second > 0 ? meilleur.score / meilleur.second : Infinity;
  return meilleur;
}

/** Regroupe les propositions en cases, ajoute les voisines, renvoie la meilleure (et la 2e, éloignée). */
function meilleureCase(th, tx, ty) {
  const nbAng = Math.round(360 / VOTE.pasAngleDeg);
  const n = th.length;
  const ka = new Int32Array(n);
  const kx = new Float64Array(n);
  const ky = new Float64Array(n);
  const table = new Map();
  for (let i = 0; i < n; i += 1) {
    ka[i] = ((Math.floor((th[i] * 180) / Math.PI / VOTE.pasAngleDeg) % nbAng) + nbAng) % nbAng;
    kx[i] = Math.floor(tx[i] / VOTE.pasTranslation);
    ky[i] = Math.floor(ty[i] / VOTE.pasTranslation);
    const cle = `${ka[i]},${kx[i]},${ky[i]}`;
    table.set(cle, (table.get(cle) ?? 0) + 1);
  }
  const cases = [...table.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2000);
  const lisses = cases.map(([cle]) => {
    const [a, x, y] = cle.split(',').map(Number);
    let total = 0;
    for (const da of [-1, 0, 1]) {
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) total += table.get(`${(a + da + nbAng) % nbAng},${x + dx},${y + dy}`) ?? 0;
      }
    }
    return { total, a, x, y };
  }).sort((p, q) => q.total - p.total);
  const { total: score, a: a0, x: x0, y: y0 } = lisses[0];
  let second = 0;
  for (const c of lisses.slice(1)) {
    const da = Math.min(Math.abs(c.a - a0), nbAng - Math.abs(c.a - a0)) * VOTE.pasAngleDeg;
    if (da > 1 || Math.hypot(c.x - x0, c.y - y0) * VOTE.pasTranslation > 2) {
      second = c.total;
      break;
    }
  }
  // Estimation fine : médiane des propositions autour de la meilleure case.
  const thRef = ((a0 + 0.5) * VOTE.pasAngleDeg * Math.PI) / 180;
  const dth = [];
  const txs = [];
  const tys = [];
  for (let i = 0; i < n; i += 1) {
    if (Math.min(Math.abs(ka[i] - a0), nbAng - Math.abs(ka[i] - a0)) > 1 || Math.abs(kx[i] - x0) > 1 || Math.abs(ky[i] - y0) > 1) continue;
    dth.push(Math.atan2(Math.sin(th[i] - thRef), Math.cos(th[i] - thRef)));
    txs.push(tx[i]);
    tys.push(ty[i]);
  }
  return { score, second, theta: thRef + mediane(dth), tx: mediane(txs), ty: mediane(tys) };
}

function mediane(v) {
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

// --- Plus proche voisin : grille de cases carrées ---

/**
 * Index des points [[x, y]…] par cases carrées de « taille » (clés numériques, tableaux typés : rapide sur des
 * dizaines de milliers de points) : plusProche(x, y, rayon) = { indice, distance } ou null.
 */
function creerGrille(points, taille) {
  const n = points.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let x0 = Infinity;
  let y0 = Infinity;
  for (let i = 0; i < n; i += 1) {
    xs[i] = points[i][0];
    ys[i] = points[i][1];
    if (xs[i] < x0) x0 = xs[i];
    if (ys[i] < y0) y0 = ys[i];
  }
  const DECALAGE = 134217728; // 2^27 : une clé = colonne × 2^27 + ligne
  const cle = (i, j) => i * DECALAGE + j;
  // Rangement : tri des points par case, puis début / fin de chaque case.
  const cles = new Float64Array(n);
  for (let k = 0; k < n; k += 1) cles[k] = cle(Math.floor((xs[k] - x0) / taille), Math.floor((ys[k] - y0) / taille));
  const ordre = Uint32Array.from({ length: n }, (_, k) => k).sort((p, q) => cles[p] - cles[q]);
  const debut = new Map();
  for (let r = 0; r < n; r += 1) {
    const c = cles[ordre[r]];
    if (!debut.has(c)) debut.set(c, [r, r + 1]);
    else debut.get(c)[1] = r + 1;
  }
  return {
    plusProche(x, y, rayon = taille) {
      const i0 = Math.floor((x - x0) / taille);
      const j0 = Math.floor((y - y0) / taille);
      const m = Math.max(1, Math.ceil(rayon / taille));
      let meilleur = -1;
      let d2Min = rayon * rayon;
      for (let i = i0 - m; i <= i0 + m; i += 1) {
        for (let j = j0 - m; j <= j0 + m; j += 1) {
          const plage = debut.get(cle(i, j));
          if (!plage) continue;
          for (let r = plage[0]; r < plage[1]; r += 1) {
            const k = ordre[r];
            const dx = xs[k] - x;
            const dy = ys[k] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 <= d2Min) {
              d2Min = d2;
              meilleur = k;
            }
          }
        }
      }
      return meilleur < 0 ? null : { indice: meilleur, distance: Math.sqrt(d2Min) };
    },
  };
}

/** Moindres carrés complexes w ≈ a·z + b (a, b = [re, im]) ; échelle fixée si demandé. */
function moindresCarres(z, w, echelleFixe) {
  const n = z.length;
  let zx = 0; let zy = 0; let wx = 0; let wy = 0;
  for (let i = 0; i < n; i += 1) { zx += z[i][0]; zy += z[i][1]; wx += w[i][0]; wy += w[i][1]; }
  zx /= n; zy /= n; wx /= n; wy /= n;
  let nr = 0; let ni = 0; let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dzx = z[i][0] - zx; const dzy = z[i][1] - zy;
    const dwx = w[i][0] - wx; const dwy = w[i][1] - wy;
    nr += dwx * dzx + dwy * dzy; // dw · conj(dz)
    ni += dwy * dzx - dwx * dzy;
    den += dzx * dzx + dzy * dzy;
  }
  let ar; let ai;
  if (echelleFixe === null) { ar = nr / den; ai = ni / den; } else {
    const m = Math.hypot(nr, ni) || 1;
    ar = (echelleFixe * nr) / m; ai = (echelleFixe * ni) / m;
  }
  return { a: [ar, ai], b: [wx - (ar * zx - ai * zy), wy - (ai * zx + ar * zy)] };
}

const appliquer = ({ a, b }, [x, y]) => [a[0] * x - a[1] * y + b[0], a[1] * x + a[0] * y + b[1]];

/** Ajustement fin depuis « depart » ({ a, b }) : renvoie { a, b, echelleArrondie }. Points source en unités source. */
export function icp(ptsSourceTous, ptsCible, depart, { echelleFixe = null } = {}) {
  let t = depart;
  // Pour la vitesse, l'ajustement se fait sur au plus MAX_POINTS_ICP sommets répartis dans tout le plan (les
  // statistiques finales, elles, prennent tous les sommets).
  const pas = Math.max(1, ptsSourceTous.length / MAX_POINTS_ICP);
  const ptsSource = pas === 1 ? ptsSourceTous : Array.from({ length: Math.floor(ptsSourceTous.length / pas) }, (_, i) => ptsSourceTous[Math.floor(i * pas)]);
  const grilles = new Map(SEUILS_ICP.map((s) => [s, creerGrille(ptsCible, s)]));
  const passe = (seuil, fixe) => {
    const grille = grilles.get(seuil);
    let n = 0;
    for (let it = 0; it < 15; it += 1) {
      const z = [];
      const w = [];
      for (const p of ptsSource) {
        const q = appliquer(t, p);
        const v = grille.plusProche(q[0], q[1], seuil);
        if (v) {
          z.push(p);
          w.push(ptsCible[v.indice]);
        }
      }
      n = z.length;
      if (n < 3) return n;
      const t2 = moindresCarres(z, w, fixe);
      // Fini quand plus rien ne bouge (moins d'1 millionième de rotation / échelle, moins de 0,01 mm).
      const fini = Math.hypot(t2.a[0] - t.a[0], t2.a[1] - t.a[1]) <= 1e-6 * Math.hypot(...t.a) && Math.hypot(t2.b[0] - t.b[0], t2.b[1] - t.b[1]) < 1e-5;
      t = t2;
      if (fini) break;
    }
    return n;
  };
  if (echelleFixe === null) {
    for (const s of SEUILS_ICP) if (passe(s, null) < 3) break;
  }
  const libre = Math.hypot(...t.a);
  const p10 = puissanceDeDix(libre);
  const fixe = echelleFixe ?? (Math.abs(libre / p10 - 1) < TOLERANCE_ARRONDI_ECHELLE ? p10 : null);
  if (fixe !== null) {
    t = { a: [(t.a[0] * fixe) / Math.hypot(...t.a), (t.a[1] * fixe) / Math.hypot(...t.a)], b: t.b };
    for (const s of SEUILS_ICP) passe(s, fixe);
  }
  return { ...t, echelleFixe: fixe };
}

/** Indicateurs d'un calage { a, b } : sommets source à < 3 cm, écart moyen (unités cible), nombre à < 1 cm. */
export function statistiques(t, ptsSource, ptsCible) {
  const grille = creerGrille(ptsCible, SEUILS_ICP.at(-1));
  let proches = 0;
  let somme = 0;
  let a1cm = 0;
  for (const p of ptsSource) {
    const q = appliquer(t, p);
    const v = grille.plusProche(q[0], q[1], SEUILS_ICP.at(-1));
    if (!v) continue;
    proches += 1;
    somme += v.distance;
    if (v.distance < 0.01) a1cm += 1;
  }
  return { points: proches, ecartMoyen: proches ? somme / proches : Infinity, a1cm };
}

/** Inverse d'un calage { a, b } (complexes). */
function inverser({ a, b }) {
  const n = a[0] * a[0] + a[1] * a[1];
  const ia = [a[0] / n, -a[1] / n];
  return { a: ia, b: [-(ia[0] * b[0] - ia[1] * b[1]), -(ia[1] * b[0] + ia[0] * b[1])] };
}

/** Niveau de confiance (seuils de l'appli d'origine). */
export function niveauDeConfiance({ dominance, score }, { points, ecartMoyen }) {
  const dom = Math.min(dominance, 99);
  if (dom >= 2 && score >= 15 && points >= 30 && ecartMoyen < 0.01) return 'forte';
  if (dom >= 1.5 && score >= 8 && points >= 15 && ecartMoyen < 0.02) return 'moyenne';
  return 'faible';
}

/**
 * Calage automatique. segsSource : segments du plan reçu (unités du plan) ; segsCible : segments MN95 (référence et
 * plans calés). Renvoie null (rien trouvé) ou { similitude, niveau, votes, dominance, points, ecartMoyenM, echelleBrute,
 * echelleArrondie }.
 */
export function calerAutomatiquement(segsSource, segsCible, { echelles = ECHELLES_CANDIDATES, echelleFixe = null } = {}) {
  const vote = voter(segsSource, segsCible, echelleFixe ? [echelleFixe] : echelles);
  if (!vote || vote.score <= 0) return null;
  const ptsSource = sommetsDesSegments(segsSource);
  const ptsCible = sommetsDesSegments(segsCible);
  const depart = {
    a: [vote.echelle * Math.cos(vote.theta), vote.echelle * Math.sin(vote.theta)],
    b: [vote.tx, vote.ty],
  };
  const candidats = [icp(ptsSource, ptsCible, depart, { echelleFixe })];
  // Dans l'autre sens : la cible cherche ses voisins dans le plan reçu, puis on inverse.
  const inv = inverser(icp(ptsCible, ptsSource, inverser(depart), { echelleFixe: echelleFixe ? 1 / echelleFixe : null }));
  const ech = Math.hypot(...inv.a);
  const p10 = puissanceDeDix(ech);
  if (echelleFixe || Math.abs(ech / p10 - 1) < TOLERANCE_ARRONDI_ECHELLE) {
    const f = echelleFixe ?? p10;
    inv.a = [(inv.a[0] * f) / ech, (inv.a[1] * f) / ech];
    inv.echelleFixe = f;
  }
  candidats.push(inv);
  const meilleur = candidats
    .map((t) => ({ t, stats: statistiques(t, ptsSource, ptsCible) }))
    .sort((p, q) => q.stats.a1cm - p.stats.a1cm)[0];
  const similitude = similitudeDepuisComplexes(meilleur.t.a, meilleur.t.b);
  if (meilleur.t.echelleFixe) similitude.echelle = meilleur.t.echelleFixe;
  return {
    similitude,
    niveau: niveauDeConfiance(vote, meilleur.stats),
    votes: vote.score,
    dominance: Math.min(vote.dominance, 99),
    points: meilleur.stats.points,
    ecartMoyenM: meilleur.stats.ecartMoyen,
    echelleBrute: Math.hypot(...meilleur.t.a),
    echelleArrondie: Boolean(meilleur.t.echelleFixe),
  };
}
