// Talus d'une surface importée, côté par côté (0.135.0, Calculs › Dessin, Expert, demande du 05.11.2026).
//
// La surface importée (terrain, plateforme, terrassement…) garde ses triangles. On prend son contour
// extérieur (contourDeSurface) ; chaque côté du contour peut recevoir un talus vers l'extérieur, avec
// sa propre pente (H/V), son sens (remblai : le talus descend ; déblai : il monte ; auto : selon le
// terrain de référence) et sa fin :
//   - jusqu'au terrain de référence (une surface du projet), si on en a choisi un ;
//   - longueur fixe en plan (m), qui arrête le talus (aussi avec un terrain : le plus court des deux) ;
//   - sol plat à une altitude tapée (sans terrain de référence) ;
//   - rien de tout cela : l'entrée en terre se cherche sur le terrain avec la canne (Implanter › Talus).
// Formule (la même que le talus d'implantation, validée) : altitude du talus à d m du bord =
// altitude du bord ∓ d × V ÷ H.
// Angles (choix de l'utilisateur, 05.11.2026) :
//   - deux côtés voisins avec talus du même sens : les deux plans se coupent sur une arête (angle vif,
//     comme en 0.107.2) ; avec deux pentes différentes l'arête n'est plus au milieu de l'angle ;
//   - un côté avec talus à côté d'un côté sans talus (ou de sens contraire) : le talus s'arrête à la
//     perpendiculaire du sommet ; dans un angle rentrant, il s'arrête contre le côté voisin.
//
// Coordonnées MN95 Est, Nord (m), altitudes (m).
import { bordDeTriangles } from './surface.js';
import { entreeEnTerreSurface, entreeEnTerreSolPlat, altitudeTalus } from './talus.js';
import { texteDePente } from './tranches-talus.js';

/** Aire signée (m²) : positive si les sommets tournent dans le sens trigonométrique. */
function aireSignee(sommets) {
  let somme = 0;
  for (let i = 0; i < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    somme += a.est * b.nord - b.est * a.nord;
  }
  return somme / 2;
}

/**
 * Contour extérieur d'une surface en triangles : la plus grande boucle du bord (les trous sont
 * laissés de côté). triangles : [[a, b, c]] de points { est, nord, altitude, nom }.
 * Renvoie les sommets dans le sens trigonométrique (au moins 3), ou [] si le bord est illisible.
 */
export function contourDeSurface(triangles) {
  const segments = bordDeTriangles(triangles);
  const cle = (p) => `${p.est},${p.nord}`;
  // Pour chaque point du bord, ses voisins sur le bord.
  const voisins = new Map();
  const point = new Map();
  for (const [p, q] of segments) {
    for (const [a, b] of [[p, q], [q, p]]) {
      point.set(cle(a), a);
      if (!voisins.has(cle(a))) voisins.set(cle(a), []);
      voisins.get(cle(a)).push(cle(b));
    }
  }
  const utilises = new Set();
  const cleSegment = (a, b) => [a, b].sort().join('|');
  let meilleure = [];
  let meilleureAire = 0;
  for (const [p, q] of segments) {
    const depart = cleSegment(cle(p), cle(q));
    if (utilises.has(depart)) continue;
    // On suit le bord jusqu'à revenir au départ.
    const boucle = [cle(p)];
    let precedent = cle(p);
    let courant = cle(q);
    utilises.add(depart);
    let garde = segments.length + 1;
    while (courant !== boucle[0] && garde-- > 0) {
      boucle.push(courant);
      const suivant = (voisins.get(courant) ?? []).find((v) => v !== precedent && !utilises.has(cleSegment(courant, v)));
      if (!suivant) break;
      utilises.add(cleSegment(courant, suivant));
      precedent = courant;
      courant = suivant;
    }
    if (courant !== boucle[0] || boucle.length < 3) continue;
    const sommets = boucle.map((k) => point.get(k));
    const aire = Math.abs(aireSignee(sommets));
    if (aire > meilleureAire) {
      meilleureAire = aire;
      meilleure = sommets;
    }
  }
  return aireSignee(meilleure) < 0 ? [...meilleure].reverse() : meilleure;
}

/** Normale vers l'extérieur du côté a → b (longueur 1), contour dans le sens trigonométrique. */
function normaleExterieure(a, b) {
  const l = Math.hypot(b.est - a.est, b.nord - a.nord);
  if (l === 0) return null;
  return { est: (b.nord - a.nord) / l, nord: -(b.est - a.est) / l };
}

const produitScalaire = (u, v) => u.est * v.est + u.nord * v.nord;

/** Paramètre t (> 0) où la demi-droite p + t·d coupe la demi-droite v + λ·u (λ > 0), ou null. */
function intersection(p, d, v, u) {
  const det = d.est * -u.nord + u.est * d.nord;
  if (Math.abs(det) < 1e-12) return null;
  const wx = v.est - p.est;
  const wy = v.nord - p.nord;
  const t = (wx * -u.nord + u.est * wy) / det;
  const lambda = (d.est * wy - d.nord * wx) / det;
  return t > 1e-9 && lambda > 1e-9 ? t : null;
}

/** Vrai si le réglage d'un côté permet un talus (pente H et V positives). */
export function reglageComplet(reglage) {
  return Boolean(reglage) && reglage.horizontal > 0 && reglage.vertical > 0;
}

/** Pente en m de hauteur par m en plan (sans signe). */
const pente = (reglage) => reglage.vertical / reglage.horizontal;

/**
 * Talus de tous les côtés réglés d'un contour.
 * - sommets : contour fermé [{ est, nord, altitude }] dans le sens trigonométrique (contourDeSurface) ;
 * - reglages : { [n° du côté]: { horizontal, vertical, sens: 'auto' | 'remblai' | 'deblai',
 *     longueur (m en plan, ou null), altitudeSol (m, ou null) } } ; le côté n va du sommet n au sommet n + 1 ;
 * - altitudeTerrain(est, nord) → altitude du terrain de référence (m) ou null ; absent = pas de terrain.
 * Renvoie { cotes: [{ cote (n°), etat: 'ok' | 'aChercher' | 'erreur', message, nature (du côté :
 *   'remblai', 'deblai' ou 'mixte'), points: [{ bord: { est, nord, altitude }, entree: { est, nord,
 *   altitude }, nature, distance (m, selon la normale du côté), arete (vrai au sommet partagé) }] }] }
 * (seulement les côtés réglés, dans l'ordre du contour).
 */
export function talusParCotes(sommets, reglages, { altitudeTerrain = null, pas = 1, distanceMax = 200 } = {}) {
  const n = sommets.length;
  if (n < 3) return { erreur: 'contour de la surface introuvable' };
  if (sommets.some((s) => s.altitude == null)) return { erreur: 'une altitude du contour manque' };
  const normales = sommets.map((a, i) => normaleExterieure(a, sommets[(i + 1) % n]));
  const reglageDe = (k) => (reglageComplet(reglages?.[k]) && normales[k] ? reglages[k] : null);
  const ecart = (p) => {
    if (!altitudeTerrain) return null;
    const terrain = altitudeTerrain(p.est, p.nord);
    return terrain == null ? null : p.altitude - terrain;
  };
  /** Nature d'un point du côté k : celle choisie, ou celle donnée par le terrain (auto). */
  const natureEn = (k, p) => {
    const sens = reglageDe(k).sens ?? 'auto';
    if (sens === 'remblai' || sens === 'deblai') return sens;
    const e = ecart(p);
    if (e == null) return null;
    return e >= 0 ? 'remblai' : 'deblai';
  };
  /** Tourne dans un angle rentrant au sommet k (entre les côtés k − 1 et k) ? */
  const rentrant = (k) => {
    const a = sommets[(k + n - 1) % n];
    const s = sommets[k];
    const c = sommets[(k + 1) % n];
    return (s.est - a.est) * (c.nord - s.nord) - (s.nord - a.nord) * (c.est - s.est) < -1e-12;
  };

  // Direction du talus au sommet k pour le côté k (au début) et pour le côté k − 1 (à la fin) :
  // { debut: u (u·n_k = 1), fin: u (u·n_(k−1) = 1), arete, mur }.
  const auSommet = sommets.map((s, k) => {
    const avant = (k + n - 1) % n;
    const rA = reglageDe(avant);
    const rB = reglageDe(k);
    const nA = normales[avant];
    const nB = normales[k];
    const resultat = { debut: nB, fin: nA, arete: false, limiteDebut: null, limiteFin: null };
    if (rA && rB && nA && nB && natureEn(avant, s) != null && natureEn(avant, s) === natureEn(k, s)) {
      // Arête : u tel que u·n_k = 1 et pente_(k−1) × u·n_(k−1) = pente_k (même hauteur sur les deux plans).
      const b1 = 1;
      const b2 = pente(rB) / pente(rA);
      const det = nB.est * nA.nord - nB.nord * nA.est;
      if (Math.abs(det) > 1e-9) {
        const u = { est: (b1 * nA.nord - b2 * nB.nord) / det, nord: (nB.est * b2 - nA.est * b1) / det };
        // Le même rayon, compté pour le côté k − 1 (u·n_(k−1) = 1).
        const facteur = produitScalaire(u, nA);
        if (facteur > 1e-6) {
          resultat.debut = u;
          resultat.fin = { est: u.est / facteur, nord: u.nord / facteur, echelle: facteur };
          resultat.arete = true;
          if (rentrant(k)) {
            resultat.limiteDebut = u;
            resultat.limiteFin = u;
          }
          return resultat;
        }
      }
    }
    // Pas d'arête : perpendiculaire ; dans un angle rentrant, le talus s'arrête contre le côté voisin.
    if (rentrant(k)) {
      const precedent = sommets[avant];
      const suivant = sommets[(k + 1) % n];
      const longueur = (p) => Math.hypot(p.est - s.est, p.nord - s.nord);
      if (rB && nB && longueur(precedent) > 0) {
        const w = { est: (precedent.est - s.est) / longueur(precedent), nord: (precedent.nord - s.nord) / longueur(precedent) };
        const f = produitScalaire(w, nB);
        if (f > 1e-6) {
          resultat.debut = { est: w.est / f, nord: w.nord / f };
          resultat.limiteDebut = w;
        }
      }
      if (rA && nA && longueur(suivant) > 0) {
        const w = { est: (suivant.est - s.est) / longueur(suivant), nord: (suivant.nord - s.nord) / longueur(suivant) };
        const f = produitScalaire(w, nA);
        if (f > 1e-6) {
          resultat.fin = { est: w.est / f, nord: w.nord / f };
          resultat.limiteFin = w;
        }
      }
    }
    return resultat;
  });

  /**
   * Distance du talus (paramètre le long de u, u·n = 1 : c'est la distance à la droite du côté) depuis
   * le point p du bord, pour le côté k : { distance, nature } ou { aChercher } ou { erreur }.
   */
  const fin = (k, p, u) => {
    const reglage = reglageDe(k);
    const nature = natureEn(k, p);
    if (nature == null) {
      return altitudeTerrain
        ? { erreur: `terrain de référence absent au bord (E ${p.est.toFixed(3)}, N ${p.nord.toFixed(3)})` }
        : { erreur: 'sens « auto » sans terrain de référence : choisir remblai ou déblai' };
    }
    const r = { horizontal: reglage.horizontal, vertical: reglage.vertical, ligneEst: nature === 'remblai' ? 'haut' : 'bas' };
    const longueur = reglage.longueur > 0 ? reglage.longueur : null;
    if (altitudeTerrain) {
      const e = ecart(p);
      if (e != null && Math.abs(e) < 1e-6) return { distance: 0, nature, r };
      // Remblai sous le terrain (ou déblai au-dessus) : le talus part dans le terrain, longueur nulle.
      if (e != null && (nature === 'remblai') !== (e > 0)) return { distance: 0, nature, r };
      const d = entreeEnTerreSurface(p, u, p.altitude, r, altitudeTerrain, longueur ?? distanceMax);
      if (d != null) return { distance: longueur != null ? Math.min(d, longueur) : d, nature, r };
      if (longueur != null) return { distance: longueur, nature, r };
      return { erreur: `pas d'entrée en terre à moins de ${distanceMax} m (E ${p.est.toFixed(3)}, N ${p.nord.toFixed(3)})` };
    }
    if (longueur != null) return { distance: longueur, nature, r };
    if (reglage.altitudeSol != null) {
      const d = entreeEnTerreSolPlat(p.altitude, reglage.altitudeSol, r);
      if (d == null) return { erreur: `sol à ${reglage.altitudeSol} m ${nature === 'remblai' ? 'plus haut' : 'plus bas'} que le bord : pas d'entrée en terre` };
      return { distance: d, nature, r };
    }
    return { aChercher: true, nature };
  };

  const cotes = [];
  for (let k = 0; k < n; k++) {
    const reglage = reglageDe(k);
    if (!reglage) continue;
    const a = sommets[k];
    const b = sommets[(k + 1) % n];
    const debut = auSommet[k];
    const finSommet = auSommet[(k + 1) % n];
    const longueurCote = Math.hypot(b.est - a.est, b.nord - a.nord);
    const nombre = Math.max(1, Math.ceil(longueurCote / pas));
    const point = (t) => ({ est: a.est + (b.est - a.est) * t, nord: a.nord + (b.nord - a.nord) * t, altitude: a.altitude + (b.altitude - a.altitude) * t });
    // Positions sur le côté : les deux bouts, tous les "pas" m, et le passage remblai / déblai (auto).
    const ts = [0];
    let tPrecedent = 0;
    let ePrecedent = (reglage.sens ?? 'auto') === 'auto' ? ecart(a) : null;
    for (let j = 1; j <= nombre; j++) {
      const t = j / nombre;
      const e = (reglage.sens ?? 'auto') === 'auto' ? ecart(point(t)) : null;
      if (ePrecedent != null && e != null && ePrecedent * e < 0) {
        let [t0, t1, e0] = [tPrecedent, t, ePrecedent];
        for (let r = 0; r < 20; r++) {
          const tm = (t0 + t1) / 2;
          const em = ecart(point(tm)) ?? 0;
          if (em * e0 > 0) [t0, e0] = [tm, em];
          else t1 = tm;
        }
        ts.push((t0 + t1) / 2);
      }
      ts.push(t);
      tPrecedent = t;
      ePrecedent = e;
    }
    const resultat = { cote: k, etat: 'ok', message: null, nature: null, points: [] };
    const natures = new Set();
    for (const t of ts) {
      const p = point(t);
      const auDebut = t === 0;
      const aLaFin = t === 1;
      const u = auDebut ? debut.debut : aLaFin ? finSommet.fin : normales[k];
      const r = fin(k, p, u);
      if (r.erreur) {
        resultat.etat = 'erreur';
        resultat.message = r.erreur;
        resultat.points = [];
        break;
      }
      natures.add(r.nature);
      if (r.aChercher) {
        resultat.etat = 'aChercher';
        continue;
      }
      // Près d'un angle rentrant, le talus passe derrière la noue (ou le côté voisin) : point caché.
      if (!auDebut && !aLaFin) {
        const cache = [[a, debut.limiteDebut], [b, finSommet.limiteFin]].some(([v, limite]) => {
          if (!limite) return false;
          const t2 = intersection(p, normales[k], v, limite);
          return t2 != null && t2 < r.distance - 1e-9;
        });
        if (cache) continue;
      }
      const entree = { est: p.est + u.est * r.distance, nord: p.nord + u.nord * r.distance, altitude: altitudeTalus(p.altitude, r.distance, r.r) };
      resultat.points.push({ bord: p, entree, nature: r.nature, distance: r.distance, arete: (auDebut && debut.arete) || (aLaFin && finSommet.arete) });
    }
    if (resultat.etat === 'aChercher') {
      resultat.points = [];
      resultat.message = 'entrée en terre à chercher sur le terrain (Implanter › Talus)';
    }
    resultat.nature = natures.size > 1 ? 'mixte' : [...natures][0] ?? null;
    cotes.push(resultat);
  }
  return { cotes };
}

/**
 * Triangles du talus : entre deux points voisins d'un même côté, le quadrilatère bord – bord –
 * entrée – entrée coupé en deux. Renvoie [[p, q, r]] de points { est, nord, altitude }
 * (les triangles plats, de talus de longueur nulle, sont laissés de côté).
 */
export function trianglesDuTalus(talus) {
  const triangles = [];
  const aire = (p, q, r) => Math.abs((q.est - p.est) * (r.nord - p.nord) - (q.nord - p.nord) * (r.est - p.est)) / 2;
  for (const cote of talus?.cotes ?? []) {
    for (let i = 0; i + 1 < cote.points.length; i++) {
      const p = cote.points[i];
      const q = cote.points[i + 1];
      for (const t of [[p.bord, q.bord, q.entree], [p.bord, q.entree, p.entree]]) {
        if (aire(...t) > 1e-6) triangles.push(t);
      }
    }
  }
  return triangles;
}

/**
 * Tronçons à implanter : les côtés voisins réglés pareil (pente, sens, fin) forment une seule ligne
 * (Implanter › Talus la suit avec ses angles vifs). En sens « auto », un tronçon est aussi coupé là où
 * le talus passe du remblai au déblai (d'après "talus", le résultat de talusParCotes), car Implanter
 * a besoin de savoir si la ligne est le haut ou le bas du talus.
 * Renvoie [{ cotes: [n°], sommets: [{ est, nord, altitude }], reglage, nature ('remblai', 'deblai'
 * ou null si inconnue) }] ; la ligne va dans le sens du contour (trigonométrique) : le talus est à droite.
 */
export function tronconsAImplanter(sommets, reglages, talus = null) {
  const n = sommets.length;
  const meme = (r1, r2) => ['horizontal', 'vertical', 'sens', 'longueur', 'altitudeSol'].every((c) => (r1?.[c] ?? null) === (r2?.[c] ?? null));
  const regles = sommets.map((_, k) => (reglageComplet(reglages?.[k]) ? k : null)).filter((k) => k != null);
  if (regles.length === 0) return [];
  const resultats = new Map((talus?.cotes ?? []).map((c) => [c.cote, c]));
  // Morceaux de côtés de même nature : { k, a, b, reglage, nature }.
  const morceaux = (k) => {
    const reglage = reglages[k];
    const a = sommets[k];
    const b = sommets[(k + 1) % n];
    if ((reglage.sens ?? 'auto') !== 'auto') return [{ k, a, b, reglage, nature: reglage.sens }];
    const points = resultats.get(k)?.points ?? [];
    if (points.length === 0) return [{ k, a, b, reglage, nature: null }];
    const liste = [];
    let debut = a;
    let nature = points[0].nature;
    for (let i = 1; i < points.length; i++) {
      if (points[i].nature === nature) continue;
      // Passage : au point du talus de longueur nulle (le plus court des deux voisins).
      const passage = Math.abs(points[i].distance) <= Math.abs(points[i - 1].distance) ? points[i].bord : points[i - 1].bord;
      liste.push({ k, a: debut, b: passage, reglage, nature });
      debut = passage;
      nature = points[i].nature;
    }
    liste.push({ k, a: debut, b, reglage, nature });
    return liste.filter((m) => Math.hypot(m.b.est - m.a.est, m.b.nord - m.a.nord) > 1e-6);
  };
  // On commence à un côté réglé dont le précédent n'est pas réglé pareil (sinon, tout le tour est pareil).
  const depart = regles.find((k) => !reglageComplet(reglages[(k + n - 1) % n]) || !meme(reglages[(k + n - 1) % n], reglages[k])) ?? regles[0];
  const tous = [];
  for (let i = 0; i < n; i++) {
    const k = (depart + i) % n;
    tous.push(reglageComplet(reglages?.[k]) ? morceaux(k) : [null]);
  }
  // Tout le tour pareil et de même nature, mais coupé au départ : on commence plutôt à un passage.
  let liste = tous.flat();
  const coupure = liste.findIndex((m, i) => i > 0 && m && liste[i - 1] && m.nature !== liste[i - 1].nature);
  if (!liste.includes(null) && coupure > 0) liste = [...liste.slice(coupure), ...liste.slice(0, coupure)];
  const troncons = [];
  let courant = null;
  for (const m of liste) {
    if (!m) {
      courant = null;
      continue;
    }
    if (!courant || !meme(courant.reglage, m.reglage) || courant.nature !== m.nature) {
      courant = { cotes: [], sommets: [m.a], reglage: m.reglage, nature: m.nature };
      troncons.push(courant);
    }
    if (courant.cotes.at(-1) !== m.k) courant.cotes.push(m.k);
    courant.sommets.push(m.b);
  }
  return troncons;
}

/**
 * Surface importée + talus, en une seule surface (points et faces, comme une surface importée).
 * points : [{ nom, est, nord, altitude }] et faces : [[i, j, k]] de la surface importée (gardés tels
 * quels) ; talus : résultat de talusParCotes. Les points du talus sont arrondis au millimètre et
 * nommés T-BP-n (bord, haut ou bas du talus côté surface) et T-ET-n (entrée en terre, ou bout du talus) ;
 * un point déjà présent (même Est / Nord au millimètre) n'est pas ajouté une 2e fois.
 * Renvoie { points, faces }.
 */
export function surfaceAvecTalus(points, faces, talus) {
  const mm = (x) => Math.round(x * 1000) / 1000;
  const tous = points.map((p) => ({ ...p }));
  const index = new Map(tous.map((p, i) => [`${mm(p.est)} ${mm(p.nord)}`, i]));
  const compteurs = { BP: 0, ET: 0 };
  const indexDe = (p, sorte) => {
    const cle = `${mm(p.est)} ${mm(p.nord)}`;
    if (index.has(cle)) return index.get(cle);
    compteurs[sorte] += 1;
    tous.push({ nom: `T-${sorte}-${compteurs[sorte]}`, est: mm(p.est), nord: mm(p.nord), altitude: mm(p.altitude) });
    index.set(cle, tous.length - 1);
    return tous.length - 1;
  };
  const nouvelles = [];
  for (const cote of talus?.cotes ?? []) {
    // Les bords d'abord (noms T-BP dans l'ordre du contour), puis les entrées en terre.
    const bords = cote.points.map((q) => indexDe(q.bord, 'BP'));
    const entrees = cote.points.map((q) => indexDe(q.entree, 'ET'));
    for (let i = 0; i + 1 < cote.points.length; i++) {
      for (const face of [[bords[i], bords[i + 1], entrees[i + 1]], [bords[i], entrees[i + 1], entrees[i]]]) {
        if (new Set(face).size < 3) continue;
        const [a, b, c] = face.map((k) => tous[k]);
        const aire = Math.abs((b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est)) / 2;
        if (aire > 1e-6) nouvelles.push(face);
      }
    }
  }
  return { points: tous, faces: [...faces.map((f) => [...f]), ...nouvelles] };
}

/**
 * Tranches du talus pour le plan (barbules du haut vers le bas, pente écrite dedans), dans la forme
 * de tranchesDeTalus : [{ nature, pente, haut, bas, milieu }] ; une tranche par côté et par nature.
 */
export function tranchesDesCotes(talus, reglages) {
  const tranches = [];
  for (const cote of talus?.cotes ?? []) {
    let courante = null;
    for (const q of cote.points) {
      if (!courante || courante.nature !== q.nature) {
        courante = { nature: q.nature, bords: [], entrees: [] };
        tranches.push({ courante, reglage: reglages?.[cote.cote] });
      }
      courante.bords.push(q.bord);
      courante.entrees.push(q.entree);
    }
  }
  const simple = ({ est, nord }) => ({ est, nord });
  return tranches
    .filter(({ courante }) => courante.bords.length >= 2)
    .map(({ courante: t, reglage }) => {
      const [haut, bas] = t.nature === 'remblai' ? [t.bords, t.entrees] : [t.entrees, t.bords];
      const m = Math.floor(t.bords.length / 2);
      const milieu = { est: (haut[m].est + bas[m].est) / 2, nord: (haut[m].nord + bas[m].nord) / 2 };
      return { nature: t.nature, pente: reglage ? texteDePente(reglage) : '', haut: haut.map(simple), bas: bas.map(simple), milieu };
    });
}
