// Réseaux (canalisations) : une polyligne avec un fil d'eau (FE) à chaque sommet, un diamètre extérieur
// et, facultatif, une tranchée. Application « Réseaux » (0.235.0, Expert, test).
// Unités : m, MN95 (Est, Nord, altitude). Le FE est l'altitude du BAS EXTÉRIEUR du tuyau (choix du 14.11,
// pas d'épaisseur de paroi). Le côté « gauche » / « droite » est celui que l'on voit en allant vers la fin.
import { ligneParallele, altitudeSurLigne, penteDuSegment, longueurPolyligne, positionSurLigne, pointALAbscisse } from './ligne-implantation.js';
import { nouvelIdentifiant } from './surface.js';

/** Types de réseau de départ (couleur proposée, à valider avec l'utilisateur). */
export const TYPES_RESEAU = [
  { cle: 'Drainage', couleur: '#16a34a' },
  { cle: 'EU', couleur: '#92400e' },
  { cle: 'EC', couleur: '#2563eb' },
  { cle: 'AEP', couleur: '#0891b2' },
  { cle: 'Gaz', couleur: '#ca8a04' },
];

/** Couleur d'un type (gris si le type est inconnu). */
export function couleurDuType(type) {
  return TYPES_RESEAU.find((t) => t.cle === type)?.couleur ?? '#64748b';
}

const nombreOk = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Nouveau réseau. tranchee : null ou { hauteur (m, du fond de la tranchée au FE), largeur (m, au fond),
 * talus (H/V : 0.5 = 0,5 m de large pour 1 m de haut ; 0 = bords droits, blindage) }.
 * sommets : [{ est, nord, fe, nom? }].
 */
export function nouveauReseau({ type, nom, diametre, sommets, tranchee = null, surfaceId = null, source = 'points' }) {
  return {
    id: nouvelIdentifiant(),
    type,
    nom,
    diametre,
    sommets: sommets.map((s) => ({ ...s })),
    tranchee: tranchee ? { ...tranchee } : null,
    surfaceId,
    source,
  };
}

/** Texte de l'erreur qui empêche d'enregistrer ce réseau, ou null s'il est correct. */
export function erreurReseau(reseau) {
  if (!reseau.nom || !String(reseau.nom).trim()) return 'Le réseau n\'a pas de nom.';
  if (!(reseau.sommets?.length >= 2)) return 'Il faut au moins 2 points.';
  if (!nombreOk(reseau.diametre) || reseau.diametre <= 0) return 'Le diamètre extérieur doit être plus grand que 0.';
  const sansFe = reseau.sommets.findIndex((s) => !nombreOk(s.fe));
  if (sansFe >= 0) return `Le fil d'eau du point ${sansFe + 1} manque.`;
  if (longueurPolyligne(reseau.sommets) === 0) return 'Les points sont tous au même endroit.';
  const t = reseau.tranchee;
  if (t) {
    if (!nombreOk(t.hauteur) || t.hauteur < 0) return 'Tranchée : la hauteur sous le fil d\'eau doit être 0 ou plus.';
    if (!nombreOk(t.largeur) || t.largeur <= 0) return 'Tranchée : la largeur au fond doit être plus grande que 0.';
    if (!nombreOk(t.talus) || t.talus < 0) return 'Tranchée : la pente du talus doit être 0 (bords droits) ou plus.';
  }
  return null;
}

/** Sommets avec « altitude » = fil d'eau (pour les calculs de ligne). */
export function sommetsFe(reseau) {
  return reseau.sommets.map((s) => ({ est: s.est, nord: s.nord, altitude: s.fe }));
}

/** Longueur en plan du réseau (m). */
export function longueurReseau(reseau) {
  return longueurPolyligne(reseau.sommets);
}

/** Pente de chaque segment (%, positive en montant vers la fin) : dénivelé ÷ longueur en plan × 100. */
export function pentesDesSegments(reseau) {
  const s = sommetsFe(reseau);
  return s.slice(0, -1).map((_, i) => penteDuSegment(i, s));
}

/** Fil d'eau à "abscisse" m du début (null avant le début ou après la fin). */
export function feALAbscisse(reseau, abscisse) {
  return altitudeSurLigne(abscisse, sommetsFe(reseau));
}

/**
 * Bords du fond de la tranchée, à gauche et à droite (comme L1 / L2 du Guidage) : la polyligne décalée de
 * ± largeur / 2, à l'altitude « FE − hauteur ». null sans tranchée. Chaque bord : [{ est, nord, altitude }].
 */
export function bordsFondTranchee(reseau) {
  const t = reseau.tranchee;
  if (!t) return null;
  const base = reseau.sommets.map((s) => ({ est: s.est, nord: s.nord, altitude: s.fe - t.hauteur }));
  return { gauche: ligneParallele(base, -t.largeur / 2), droit: ligneParallele(base, t.largeur / 2) };
}

/**
 * Coupe en travers (perpendiculaire au réseau) à "abscisse" m du début, de "demiLargeur" m de chaque côté :
 * { debut, fin (extrémités de la ligne de coupe, gauche → droite), centre, tuyaux }.
 * tuyaux : tous les réseaux de la liste que la ligne de coupe croise, { reseau, x (m depuis le bord gauche
 * de la coupe), fe }, le réseau choisi au milieu. null si l'abscisse est hors du réseau.
 */
export function coupeEnTravers(reseaux, reseauId, abscisse, demiLargeur = 4) {
  const choisi = reseaux.find((r) => r.id === reseauId);
  if (!choisi) return null;
  if (!(abscisse >= 0 && abscisse <= longueurPolyligne(choisi.sommets))) return null;
  const pied = pointALAbscisse(choisi.sommets, abscisse);
  if (!pied) return null;
  const sur = positionSurLigne(pied, choisi.sommets);
  const droite = sur.droite;
  const debut = { est: pied.est - droite.est * demiLargeur, nord: pied.nord - droite.nord * demiLargeur };
  const fin = { est: pied.est + droite.est * demiLargeur, nord: pied.nord + droite.nord * demiLargeur };
  const tuyaux = [];
  for (const r of reseaux) {
    if (r.id === choisi.id) {
      tuyaux.push({ reseau: r, x: demiLargeur, fe: feALAbscisse(r, abscisse) ?? r.sommets[0].fe });
      continue;
    }
    for (let i = 0; i + 1 < r.sommets.length; i++) {
      const croise = croisementSegments(debut, fin, r.sommets[i], r.sommets[i + 1]);
      if (!croise) continue;
      const fe = r.sommets[i].fe + (r.sommets[i + 1].fe - r.sommets[i].fe) * croise.u;
      tuyaux.push({ reseau: r, x: croise.t * 2 * demiLargeur, fe });
    }
  }
  return { debut, fin, centre: pied, demiLargeur, tuyaux };
}

/** Croisement des segments p→q et a→b : { t (sur p→q), u (sur a→b) } entre 0 et 1, ou null. */
export function croisementSegments(p, q, a, b) {
  const dx = q.est - p.est;
  const dy = q.nord - p.nord;
  const ex = b.est - a.est;
  const ey = b.nord - a.nord;
  const d = dx * ey - dy * ex;
  if (Math.abs(d) < 1e-12) return null; // parallèles
  const t = ((a.est - p.est) * ey - (a.nord - p.nord) * ex) / d;
  const u = ((a.est - p.est) * dy - (a.nord - p.nord) * dx) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

/** Hauteur au-dessus du FE où l'on arrête la tranchée quand il n'y a pas de surface de référence (m). */
export const HAUTEUR_SANS_SURFACE = 1.5;

/**
 * Forme de la tranchée dans une coupe en travers : [{ x, z }] (haut gauche, fond gauche, fond droit, haut droit).
 * xCentre : place du tuyau (m) ; fe : fil d'eau ; terrain(x) : altitude du terrain (ou null s'il n'y a pas de
 * surface : la tranchée s'arrête alors à FE + HAUTEUR_SANS_SURFACE). Talus 0 = bords droits (blindage).
 */
export function formeTranchee(xCentre, fe, tranchee, terrain = null) {
  const zFond = fe - tranchee.hauteur;
  const demi = tranchee.largeur / 2;
  const haut = (cote) => {
    let x = xCentre + cote * demi;
    let z = fe + HAUTEUR_SANS_SURFACE;
    if (terrain) {
      // Le talus monte jusqu'au terrain : on cherche où il le touche (quelques passes suffisent).
      for (let i = 0; i < 6; i++) {
        const zt = terrain(x);
        if (zt == null) break;
        z = zt;
        x = xCentre + cote * (demi + tranchee.talus * Math.max(0, z - zFond));
      }
    } else {
      x = xCentre + cote * (demi + tranchee.talus * (z - zFond));
    }
    return { x, z };
  };
  const g = haut(-1);
  const d = haut(1);
  return [g, { x: xCentre - demi, z: zFond }, { x: xCentre + demi, z: zFond }, d];
}

/**
 * Les autres réseaux qui croisent (en plan) le réseau choisi : [{ reseau, d (m depuis le début du réseau choisi), fe }].
 * Sert à les montrer dans la coupe dans l'axe.
 */
export function croisementsSurAxe(reseaux, reseauId) {
  const choisi = reseaux.find((r) => r.id === reseauId);
  if (!choisi) return [];
  const liste = [];
  for (const autre of reseaux) {
    if (autre.id === choisi.id) continue;
    let cumul = 0;
    for (let i = 0; i + 1 < choisi.sommets.length; i++) {
      const a = choisi.sommets[i];
      const b = choisi.sommets[i + 1];
      const l = Math.hypot(b.est - a.est, b.nord - a.nord);
      for (let j = 0; j + 1 < autre.sommets.length; j++) {
        const croise = croisementSegments(a, b, autre.sommets[j], autre.sommets[j + 1]);
        if (!croise) continue;
        liste.push({ reseau: autre, d: cumul + croise.t * l, fe: autre.sommets[j].fe + (autre.sommets[j + 1].fe - autre.sommets[j].fe) * croise.u });
      }
      cumul += l;
    }
  }
  return liste.sort((x, y) => x.d - y.d);
}
