// Plateforme avec talus jusqu'au terrain naturel (0.108.0, Calculs › Dessin, Expert).
//
// Une plateforme fermée (sommets avec altitude) et un terrain (une surface du projet). Tout autour,
// un talus part du bord de la plateforme vers l'extérieur et descend (remblai : la plateforme est
// au-dessus du terrain) ou monte (déblai : elle est au-dessous) jusqu'à rencontrer le terrain
// (entrée en terre). Pentes en horizontal / vertical (3 / 2 = 3 m en plan pour 2 m de haut), une
// pour le remblai et une pour le déblai (choix de l'utilisateur, 02.11.2026).
// Formule (la même que l'implantation d'un talus, validée) : altitude du talus à d m du bord =
// altitude du bord ∓ d × V ÷ H ; l'entrée en terre est le premier d où le talus touche le terrain.
// Angles : vifs (arête), aux angles saillants comme aux angles rentrants (voir talus.js).
// Le long d'un côté, le talus passe du remblai au déblai là où le bord croise le terrain : ce point
// est à la fois sur la plateforme et sur l'entrée en terre (talus de longueur nulle).
//
// Coordonnées MN95 Est, Nord (m), altitudes (m).
import { entreeEnTerreSurface, altitudeTalus } from './talus.js';

/** Pentes proposées (H / V) ; « tapée » = H et V au choix. */
export const PENTES_TALUS = [
  ['1/1', 1, 1],
  ['3/2', 3, 2],
  ['2/1', 2, 1],
  ['3/1', 3, 1],
];

/** Normale vers l'extérieur du côté a → b (longueur 1) ; signe : 1 si la plateforme tourne dans le sens trigonométrique. */
function normaleExterieure(a, b, signe) {
  const l = Math.hypot(b.est - a.est, b.nord - a.nord);
  return { est: ((b.nord - a.nord) / l) * signe, nord: (-(b.est - a.est) / l) * signe };
}

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

/**
 * Talus d'une plateforme jusqu'au terrain.
 * - sommets : [{ nom, est, nord, altitude }] (plateforme fermée, au moins 3, altitudes connues) ;
 * - pentes : { remblai: { horizontal, vertical }, deblai: { horizontal, vertical } } ;
 * - altitudeTerrain(est, nord) → altitude du terrain (m) ou null hors du terrain ;
 * - pas : espacement des points sur les côtés (m) ; distanceMax : longueur de talus cherchée (m).
 * Renvoie { erreur } ou :
 * { bord: [{ est, nord, altitude, nature: 'remblai' | 'deblai', sommet (n° du sommet, ou null
 *   pour un point d'un côté) }] (le haut ou le bas du talus côté plateforme, dans l'ordre : sommets
 *   et points des côtés), entree: [{ est, nord, altitude,
 *   bord (n° du point de bord), nature }] (entrée en terre, dans le même ordre), aretes: [[n° de
 *   bord, n° d'entrée]] (arêtes aux angles) }.
 */
export function talusDePlateforme(sommets, pentes, altitudeTerrain, { pas = 1, distanceMax = 200 } = {}) {
  const n = sommets.length;
  if (n < 3) return { erreur: 'il faut une plateforme fermée d\'au moins 3 sommets' };
  if (sommets.some((s) => s.altitude == null)) return { erreur: 'une altitude de la plateforme manque' };
  for (const [cle, titre] of [['remblai', 'remblai'], ['deblai', 'déblai']]) {
    const p = pentes?.[cle];
    if (!(p?.horizontal > 0 && p?.vertical > 0)) return { erreur: `pente du ${titre} à choisir` };
  }
  const signe = aireSignee(sommets) >= 0 ? 1 : -1;
  const normales = sommets.map((a, i) => normaleExterieure(a, sommets[(i + 1) % n], signe));
  // Direction de l'arête au sommet k (entre les côtés k − 1 et k), à « t m de chaque côté ».
  const aretes = sommets.map((_, k) => {
    const n1 = normales[(k + n - 1) % n];
    const n2 = normales[k];
    const produit = 1 + n1.est * n2.est + n1.nord * n2.nord;
    return produit > 1e-6 ? { est: (n1.est + n2.est) / produit, nord: (n1.nord + n2.nord) / produit } : null;
  });
  // Coin rentrant au sommet k : le talus des deux côtés se rejoint sur l'arête (une « noue »).
  const rentrant = sommets.map((s, k) => {
    const a = sommets[(k + n - 1) % n];
    const c = sommets[(k + 1) % n];
    return ((s.est - a.est) * (c.nord - s.nord) - (s.nord - a.nord) * (c.est - s.est)) * signe < -1e-12;
  });

  const ecart = (p) => {
    const terrain = altitudeTerrain(p.est, p.nord);
    return terrain == null ? null : p.altitude - terrain;
  };
  /** Entrée en terre depuis le point p du bord, dans la direction d (pas forcément de longueur 1). */
  const entree = (p, d) => {
    const e = ecart(p);
    if (e == null) return { erreur: `terrain absent sous la plateforme (E ${p.est.toFixed(3)}, N ${p.nord.toFixed(3)})` };
    const nature = e >= 0 ? 'remblai' : 'deblai';
    if (Math.abs(e) < 1e-6) return { distance: 0, nature, altitude: p.altitude };
    const pente = pentes[nature];
    const reglages = { horizontal: pente.horizontal, vertical: pente.vertical, ligneEst: nature === 'remblai' ? 'haut' : 'bas' };
    const distance = entreeEnTerreSurface(p, d, p.altitude, reglages, altitudeTerrain, distanceMax);
    if (distance == null) return { erreur: `pas d'entrée en terre à moins de ${distanceMax} m (E ${p.est.toFixed(3)}, N ${p.nord.toFixed(3)})` };
    return { distance, nature, altitude: altitudeTalus(p.altitude, distance, reglages) };
  };

  const bord = [];
  const entreeEnTerre = [];
  const liens = [];
  const ajouter = (p, d, { arete = false, sommet = null } = {}) => {
    const r = entree(p, d);
    if (r.erreur) return r;
    bord.push({ est: p.est, nord: p.nord, altitude: p.altitude, nature: r.nature, sommet });
    entreeEnTerre.push({ est: p.est + d.est * r.distance, nord: p.nord + d.nord * r.distance, altitude: r.altitude, bord: bord.length - 1, nature: r.nature });
    if (arete && r.distance > 0) liens.push([bord.length - 1, entreeEnTerre.length - 1]);
    return null;
  };

  for (let k = 0; k < n; k++) {
    const a = sommets[k];
    const b = sommets[(k + 1) % n];
    if (!aretes[k]) return { erreur: `angle trop aigu au sommet ${a.nom ?? k + 1}` };
    const erreurSommet = ajouter(a, aretes[k], { arete: true, sommet: k });
    if (erreurSommet) return erreurSommet;
    // Points le long du côté, et le point où le bord croise le terrain (passage remblai / déblai).
    const longueur = Math.hypot(b.est - a.est, b.nord - a.nord);
    const nombre = Math.max(1, Math.ceil(longueur / pas));
    const point = (t) => ({ est: a.est + (b.est - a.est) * t, nord: a.nord + (b.nord - a.nord) * t, altitude: a.altitude + (b.altitude - a.altitude) * t });
    const ts = [];
    let tPrecedent = 0;
    let ePrecedent = ecart(a);
    for (let j = 1; j <= nombre; j++) {
      const t = j / nombre;
      const e = ecart(point(t));
      if (ePrecedent != null && e != null && ePrecedent * e < 0) {
        // Passage : on resserre (20 fois la moitié) jusqu'au point où bord et terrain se croisent.
        let [t0, t1, e0] = [tPrecedent, t, ePrecedent];
        for (let r = 0; r < 20; r++) {
          const tm = (t0 + t1) / 2;
          const em = ecart(point(tm)) ?? 0;
          if (em * e0 > 0) [t0, e0] = [tm, em];
          else t1 = tm;
        }
        ts.push((t0 + t1) / 2);
      }
      if (j < nombre) ts.push(t);
      tPrecedent = t;
      ePrecedent = e;
    }
    for (const t of ts) {
      const p = point(t);
      const r = entree(p, normales[k]);
      if (r.erreur) return r;
      // Près d'un coin rentrant, le talus de ce côté passe derrière la noue : ce point est caché.
      const cache = [[k, a], [(k + 1) % n, b]].some(([s, v]) => {
        if (!rentrant[s] || !aretes[s]) return false;
        const t2 = intersection(p, normales[k], v, aretes[s]);
        return t2 != null && t2 < r.distance - 1e-9;
      });
      if (cache) continue;
      bord.push({ est: p.est, nord: p.nord, altitude: p.altitude, nature: r.nature });
      entreeEnTerre.push({ est: p.est + normales[k].est * r.distance, nord: p.nord + normales[k].nord * r.distance, altitude: r.altitude, bord: bord.length - 1, nature: r.nature });
    }
  }
  return { bord, entree: entreeEnTerre, aretes: liens };
}
