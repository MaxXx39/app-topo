// Implantation d'un talus (onglet Terrain › Implanter › Talus) : une ligne (haut ou bas du talus),
// une pente donnée en horizontal / vertical (ex. 3 / 2 : 3 m en plan pour 2 m de haut) et un côté
// (à droite ou à gauche en regardant vers la fin de la ligne). Le talus part de la ligne :
// - ligne = haut du talus : il descend en s'éloignant de la ligne ;
// - ligne = bas du talus : il monte en s'éloignant de la ligne.
// Il s'arrête à sa longueur (en plan) si elle est donnée, sinon à l'entrée en terre (là où il
// rencontre le terrain).
//
// En chaque endroit, le talus est le plan du segment le plus proche de la ligne (distance en plan
// à ce segment). Aux angles saillants (0.107.2, validé par l'utilisateur : angle vif, plus de
// cône) : les plans des deux segments voisins se coupent sur une arête ; la distance est la plus
// grande des deux distances perpendiculaires aux deux droites (voir angleVif).
//
// Terrain : une surface du projet, ou aucune. Sans surface, le sol est supposé plat à l'altitude
// du bout de canne (méthode des piquets de pente, validée par l'utilisateur le 24.10.2026) :
// distance voulue = |altitude de la ligne − altitude de la canne| × H ÷ V, recalculée à chaque
// position ; on s'approche de l'entrée en terre par essais successifs.
//
// Coordonnées MN95 Est, Nord (m), altitudes (m), distances en plan (m).
import { positionSurLigne, altitudeSurLigne, longueurPolyligne, pointALAbscisse } from './ligne-implantation.js';

/**
 * Direction « côté talus » (longueur 1) du segment i : perpendiculaire, à droite (signe 1) ou à
 * gauche (signe −1) en regardant vers la fin ; null si le segment est de longueur nulle.
 */
function normaleTalus(sommets, i, signe) {
  const a = sommets[i];
  const b = sommets[i + 1];
  const l = Math.hypot(b.est - a.est, b.nord - a.nord);
  if (l === 0) return null;
  return { est: ((b.nord - a.nord) / l) * signe, nord: (-(b.est - a.est) / l) * signe };
}

/** Vrai si le sommet i (entre les segments i − 1 et i) est un angle saillant du côté du talus. */
function estSaillant(sommets, i, signe) {
  const a = sommets[i - 1];
  const b = sommets[i];
  const c = sommets[i + 1];
  const vectoriel = (b.est - a.est) * (c.nord - b.nord) - (b.nord - a.nord) * (c.est - b.est);
  return vectoriel * signe > 1e-12;
}

/**
 * Angle vif (0.107.2) : si "position" est dans le coin d'un angle saillant (son point le plus
 * proche sur la ligne est le sommet k), le talus est le plan du segment voisin dont la droite est
 * la plus loin. Renvoie { distance (m), direction (côté talus, longueur 1), pied (point de cette
 * droite en face de la position) } ou null (pas dans le coin d'un angle saillant).
 */
export function angleVif(position, sommets, signe, projete) {
  for (let k = 1; k + 1 < sommets.length; k++) {
    const s = sommets[k];
    if (Math.hypot(projete.est - s.est, projete.nord - s.nord) > 1e-6 || !estSaillant(sommets, k, signe)) continue;
    let meilleur = null;
    for (const i of [k - 1, k]) {
      const n = normaleTalus(sommets, i, signe);
      if (!n) continue;
      const distance = (position.est - s.est) * n.est + (position.nord - s.nord) * n.nord;
      if (!meilleur || distance > meilleur.distance) {
        meilleur = { distance, direction: n, pied: { est: position.est - n.est * distance, nord: position.nord - n.nord * distance } };
      }
    }
    return meilleur;
  }
  return null;
}

/** Vrai si les réglages du talus permettent de le calculer (pente H et V positives). */
export function talusComplet(reglages) {
  return Boolean(reglages) && reglages.horizontal > 0 && reglages.vertical > 0;
}

/**
 * Pente du talus en m de hauteur par m en plan (sans unité), avec son signe : négative si le
 * talus descend en s'éloignant de la ligne (ligne = haut), positive s'il monte (ligne = bas).
 */
export function penteSignee({ horizontal, vertical, ligneEst }) {
  const pente = vertical / horizontal;
  return ligneEst === 'bas' ? pente : -pente;
}

/** Altitude du talus (m) à "distance" m en plan de la ligne, l'altitude de la ligne étant "altitudeLigne". */
export function altitudeTalus(altitudeLigne, distance, reglages) {
  return altitudeLigne + penteSignee(reglages) * distance;
}

/**
 * Entrée en terre avec un sol plat à "altitudeSol" (m) : distance en plan depuis la ligne (m) où
 * le talus arrive à cette altitude, ou null si le sol est du mauvais côté (talus qui descend et
 * sol plus haut que la ligne, ou talus qui monte et sol plus bas).
 */
export function entreeEnTerreSolPlat(altitudeLigne, altitudeSol, reglages) {
  const distance = (altitudeSol - altitudeLigne) / penteSignee(reglages);
  return distance >= 0 ? distance : null;
}

/**
 * Entrée en terre sur une surface : on part du point "depart" de la ligne ({ est, nord }) dans la
 * direction "direction" ({ est, nord }, longueur 1) et on cherche la première distance où le talus
 * rencontre la surface (altitudeTerrain(est, nord) → m, ou null hors de la surface).
 * Pas de 0.25 m jusqu'à "distanceMax" m, puis on resserre au millimètre.
 * Renvoie la distance (m) ou null (pas de rencontre, ou surface absente).
 */
export function entreeEnTerreSurface(depart, direction, altitudeLigne, reglages, altitudeTerrain, distanceMax = 200) {
  const ecart = (distance) => {
    const terrain = altitudeTerrain(depart.est + direction.est * distance, depart.nord + direction.nord * distance);
    return terrain == null ? null : altitudeTalus(altitudeLigne, distance, reglages) - terrain;
  };
  const PAS = 0.25;
  let avant = ecart(0);
  let distanceAvant = 0;
  if (avant === 0) return 0;
  for (let distance = PAS; distance <= distanceMax + 1e-9; distance += PAS) {
    const valeur = ecart(distance);
    if (valeur == null) {
      // Hors de la surface : on repart plus loin (un trou dans la surface).
      avant = null;
      continue;
    }
    if (avant != null && Math.sign(valeur) !== Math.sign(avant)) {
      // Changement de signe entre distanceAvant et distance : on resserre (dichotomie).
      let a = distanceAvant;
      let b = distance;
      let va = avant;
      while (b - a > 0.0005) {
        const milieu = (a + b) / 2;
        const vm = ecart(milieu);
        if (vm == null) break;
        if (Math.sign(vm) === Math.sign(va)) {
          a = milieu;
          va = vm;
        } else b = milieu;
      }
      return (a + b) / 2;
    }
    if (valeur === 0) return distance;
    avant = valeur;
    distanceAvant = distance;
  }
  return null;
}

/**
 * Guidage du talus à la position de la canne ({ est, nord, altitude }).
 * sommets : la ligne (début → fin) ; reglages : { horizontal, vertical, ligneEst ('haut' ou 'bas'),
 * cote ('droite' ou 'gauche'), longueur (m en plan, ou null : jusqu'au terrain) } ;
 * options : altitudeLigne(abscisse, point) → altitude de la ligne (m) ou null,
 *           altitudeTerrain(est, nord) → altitude du terrain (m) ou null (rien : sol plat à la canne).
 * Renvoie { message } si ce n'est pas calculable, sinon :
 * { abscisse, longueur (de la ligne), segment, distance (de la canne à la ligne, m, + du côté du
 *   talus), altitudeLigne, altitudeTalusCanne (altitude du talus à l'endroit de la canne, ou null
 *   hors du talus), distanceVoulue (entrée en terre, ou bord du talus), auBord (vrai si l'on vise le
 *   bord du talus : il n'atteint pas le terrain), manque (m de haut entre le bord du talus et le
 *   terrain, si auBord), ecartDistance (distance − distance voulue : > 0 il faut se rapprocher de la
 *   ligne), cible: { est, nord, altitude } (point voulu en face de la canne), solPlat (vrai sans surface),
 *   pied (point de la ligne en face de la canne), direction (vers le talus, longueur 1) }.
 */
export function guidageTalus(position, sommets, reglages, { altitudeLigne, altitudeTerrain = null } = {}) {
  if (!talusComplet(reglages)) return { message: 'Pente du talus à régler (⚙)' };
  const sur = positionSurLigne(position, sommets);
  if (!sur) return { message: 'Ligne sans longueur' };
  // Altitude de la ligne en face de la canne (au début ou à la fin si l'on est au-delà).
  const abscisseBornee = Math.max(0, Math.min(sur.longueur, sur.abscisse));
  const pied = pointALAbscisse(sommets, abscisseBornee) ?? sur.projete;
  const zLigne = altitudeLigne(abscisseBornee, pied);
  if (zLigne == null) return { message: 'Altitude de la ligne inconnue (⚙)' };
  const signe = reglages.cote === 'gauche' ? -1 : 1;
  let distance = sur.decalage * signe;
  // Direction du talus : perpendiculaire au segment, du côté choisi.
  let direction = { est: sur.droite.est * signe, nord: sur.droite.nord * signe };
  // Dans le coin d'un angle saillant : angle vif (plan du segment voisin le plus loin).
  const vif = angleVif(position, sommets, signe, sur.projete);
  if (vif) {
    distance = vif.distance;
    direction = vif.direction;
    sur.projete = vif.pied;
  }
  const longueurTalus = reglages.longueur > 0 ? reglages.longueur : null;
  const solPlat = !altitudeTerrain;
  const dansLeTalus = distance >= 0 && (longueurTalus == null || distance <= longueurTalus);
  const altitudeTalusCanne = dansLeTalus ? altitudeTalus(zLigne, distance, reglages) : null;

  // Entrée en terre : sur la surface, ou avec le sol plat à l'altitude de la canne.
  const entree = solPlat
    ? entreeEnTerreSolPlat(zLigne, position.altitude, reglages)
    : entreeEnTerreSurface(sur.projete, direction, zLigne, reglages, altitudeTerrain, longueurTalus ?? 200);
  let distanceVoulue = entree;
  let auBord = false;
  let manque = null;
  if (longueurTalus != null && (entree == null || entree > longueurTalus)) {
    // Le talus s'arrête avant le terrain : on vise son bord (décision du 24.10.2026).
    distanceVoulue = longueurTalus;
    auBord = true;
    const terrainAuBord = solPlat
      ? position.altitude
      : altitudeTerrain(sur.projete.est + direction.est * longueurTalus, sur.projete.nord + direction.nord * longueurTalus);
    manque = terrainAuBord == null ? null : Math.abs(altitudeTalus(zLigne, longueurTalus, reglages) - terrainAuBord);
  }
  const base = { abscisse: sur.abscisse, longueur: sur.longueur, segment: sur.segment, distance, altitudeLigne: zLigne, altitudeTalusCanne, solPlat, pied: sur.projete, direction };
  if (distanceVoulue == null) {
    const message = solPlat
      ? `Terrain ${reglages.ligneEst === 'haut' ? 'plus haut' : 'plus bas'} que la ligne : pas d'entrée en terre`
      : 'Pas d\'entrée en terre sur la surface';
    return { ...base, message };
  }
  return {
    ...base,
    distanceVoulue,
    auBord,
    manque,
    ecartDistance: distance - distanceVoulue,
    cible: {
      est: sur.projete.est + direction.est * distanceVoulue,
      nord: sur.projete.nord + direction.nord * distanceVoulue,
      altitude: altitudeTalus(zLigne, distanceVoulue, reglages),
    },
    message: null,
  };
}

/**
 * Zone du talus pour le plan : le long de la ligne (tous les "pas" m environ et à chaque sommet),
 * le point de la ligne et le bord du talus (entrée en terre sur la surface, ou longueur donnée).
 * Renvoie { ligne: [{ est, nord }], bord: [{ est, nord }] } (même nombre de points), ou null
 * (sans surface ni longueur, le bord n'est connu qu'à l'endroit de la canne).
 */
export function zoneTalus(sommets, reglages, { altitudeLigne, altitudeTerrain = null, pas = 1 } = {}) {
  if (!talusComplet(reglages) || sommets.length < 2) return null;
  const longueurTalus = reglages.longueur > 0 ? reglages.longueur : null;
  if (!altitudeTerrain && longueurTalus == null) return null;
  const signe = reglages.cote === 'gauche' ? -1 : 1;
  const ligne = [];
  const bord = [];
  let cumul = 0;
  for (let i = 0; i + 1 < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[i + 1];
    const l = Math.hypot(b.est - a.est, b.nord - a.nord);
    if (l === 0) continue;
    const direction = { est: ((b.nord - a.nord) / l) * signe, nord: (-(b.est - a.est) / l) * signe };
    const nombre = Math.max(1, Math.ceil(l / pas));
    for (let k = 0; k <= nombre; k++) {
      const t = k / nombre;
      const point = { est: a.est + (b.est - a.est) * t, nord: a.nord + (b.nord - a.nord) * t };
      const z = altitudeLigne(cumul + l * t, point);
      let distance = longueurTalus;
      if (z != null && altitudeTerrain) {
        const entree = entreeEnTerreSurface(point, direction, z, reglages, altitudeTerrain, longueurTalus ?? 200);
        if (entree != null && (longueurTalus == null || entree < longueurTalus)) distance = entree;
      }
      if (distance == null) continue;
      ligne.push(point);
      bord.push({ est: point.est + direction.est * distance, nord: point.nord + direction.nord * distance });
    }
    cumul += l;
    // Angle saillant au bout de ce segment : le bord passe par l'arête (angle vif, 0.107.2).
    // Le long de l'arête, à t m de chaque droite : sommet + t × (n1 + n2) ÷ (1 + n1·n2).
    const n2 = i + 2 < sommets.length ? normaleTalus(sommets, i + 1, signe) : null;
    if (n2 && estSaillant(sommets, i + 1, signe)) {
      const n1 = { est: direction.est, nord: direction.nord };
      const produit = 1 + n1.est * n2.est + n1.nord * n2.nord;
      const z = altitudeLigne(cumul, b);
      if (produit > 1e-6 && z != null) {
        const arete = { est: (n1.est + n2.est) / produit, nord: (n1.nord + n2.nord) / produit };
        let distance = longueurTalus;
        if (altitudeTerrain) {
          const entree = entreeEnTerreSurface(b, arete, z, reglages, altitudeTerrain, longueurTalus ?? 200);
          if (entree != null && (longueurTalus == null || entree < longueurTalus)) distance = entree;
        }
        if (distance != null) {
          ligne.push({ est: b.est, nord: b.nord });
          bord.push({ est: b.est + arete.est * distance, nord: b.nord + arete.nord * distance });
        }
      }
    }
  }
  return ligne.length >= 2 ? { ligne, bord } : null;
}

/**
 * Altitude de la ligne du talus, selon sa source : la surface "altitudeSurface(est, nord)" si on
 * l'a choisie, sinon les altitudes tapées au début et à la fin, ou celles des sommets (plan 3D,
 * points du projet). Renvoie une fonction (abscisse, point) → altitude (m) ou null.
 */
export function sourceAltitudeLigne(sommets, altitudesTapees = {}, altitudeSurface = null) {
  const longueur = longueurPolyligne(sommets);
  return (abscisse, point) => {
    if (altitudeSurface) return altitudeSurface(point.est, point.nord);
    return altitudeSurLigne(Math.max(0, Math.min(longueur, abscisse)), sommets, altitudesTapees);
  };
}

/** Texte court de la pente : « 3/2 » (H/V), ou « — » si elle n'est pas réglée. */
export function textePente({ horizontal, vertical }) {
  if (!(horizontal > 0 && vertical > 0)) return '—';
  const court = (v) => String(Math.round(v * 1000) / 1000);
  return `${court(horizontal)}/${court(vertical)}`;
}
