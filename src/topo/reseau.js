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

/**
 * Réseaux croisés par une droite de coupe debut → fin (coupes d'Implanter › Surface, case « Cana »).
 * Pour chacun : { reseau, x (m depuis le début de la coupe), fe, etirement (1 / sin de l'angle entre la coupe et le réseau :
 * un tuyau coupé de biais paraît plus large), forme (tranchée [{ x, z }] ou null) }. terrainEn(x) : altitude du terrain ou null.
 */
export function tuyauxSurCoupe(reseaux, debut, fin, terrainEn = null) {
  const longueur = Math.hypot(fin.est - debut.est, fin.nord - debut.nord);
  if (longueur === 0) return [];
  const liste = [];
  for (const r of reseaux) {
    for (let i = 0; i + 1 < r.sommets.length; i++) {
      const [a, b] = [r.sommets[i], r.sommets[i + 1]];
      const croise = croisementSegments(debut, fin, a, b);
      if (!croise) continue;
      const lSegment = Math.hypot(b.est - a.est, b.nord - a.nord);
      const sinus = Math.abs((fin.est - debut.est) * (b.nord - a.nord) - (fin.nord - debut.nord) * (b.est - a.est)) / (longueur * lSegment);
      const etirement = 1 / Math.max(sinus, 0.1);
      const x = croise.t * longueur;
      const fe = a.fe + (b.fe - a.fe) * croise.u;
      const forme = r.tranchee
        ? formeTranchee(x, fe, r.tranchee, terrainEn).map((p) => ({ x: x + (p.x - x) * etirement, z: p.z }))
        : null;
      liste.push({ reseau: r, x, fe, etirement, forme });
    }
  }
  return liste.sort((p, q) => p.x - q.x);
}

/** Ce qu'on peut implanter sur un réseau : la ligne (axe ou bords du fond de tranchée) et l'altitude visée. */
export const CIBLES_RESEAU = [['axe', 'Axe du tuyau'], ['bordG', 'Bord G du fond'], ['bordD', 'Bord D du fond']];
export const ALTITUDES_RESEAU = [['fe', 'Fil d\'eau'], ['dessus', 'Dessus du tuyau'], ['fond', 'Fond de tranchée']];

/**
 * Ligne à implanter d'un réseau (même forme que celle d'Implanter › Ligne) : { nom, sommets [{ est, nord, altitude }], decalage }.
 * cible : 'axe', 'bordG' ou 'bordD' (bords du fond de tranchée : la ligne décalée de ± largeur / 2, comme L1 / L2 du Guidage) ;
 * altitude : 'fe' (le FE), 'dessus' (FE + diamètre) ou 'fond' (FE − hauteur de la tranchée). null si la tranchée manque pour ce choix.
 */
export function ligneAImplanterDuReseau(reseau, cible = 'axe', altitude = 'fe') {
  const t = reseau.tranchee;
  if ((cible !== 'axe' || altitude === 'fond') && !t) return null;
  const z = { fe: (s) => s.fe, dessus: (s) => s.fe + reseau.diametre, fond: (s) => s.fe - t.hauteur }[altitude];
  if (!z) return null;
  const decalage = cible === 'bordG' ? -t.largeur / 2 : cible === 'bordD' ? t.largeur / 2 : 0;
  const quoi = { axe: 'axe', bordG: 'bord G du fond', bordD: 'bord D du fond' }[cible];
  const lib = { fe: 'FE', dessus: 'dessus', fond: 'fond' }[altitude];
  return {
    nom: `${reseau.nom} · ${quoi} · ${lib}`,
    sommets: reseau.sommets.map((s) => ({ est: s.est, nord: s.nord, altitude: z(s) })),
    decalage,
  };
}

/**
 * Fils d'eau interpolés (0.266.0, demande du 17.11) : un point sans FE, entre deux points qui en ont un, reçoit le FE
 * interpolé selon la longueur le long du tracé (en plan : entre deux FE la pente est constante, la longueur le long
 * du tuyau donne donc la même proportion). Avant le premier FE ou après le dernier : rien (à taper).
 * - sommets : [{ est, nord, fe }] (fe : nombre, ou null / vide)
 * Renvoie un tableau de la même longueur : { fe (m, au mm, ou null), interpole (vrai si calculé) }.
 */
export function fesInterpoles(sommets) {
  const fe = sommets.map((s) => (nombreOk(s.fe) ? s.fe : null));
  const cumul = [0];
  for (let k = 1; k < sommets.length; k++) cumul.push(cumul[k - 1] + Math.hypot(sommets[k].est - sommets[k - 1].est, sommets[k].nord - sommets[k - 1].nord));
  return fe.map((valeur, k) => {
    if (valeur != null) return { fe: valeur, interpole: false };
    let a = k - 1;
    while (a >= 0 && fe[a] == null) a--;
    let b = k + 1;
    while (b < fe.length && fe[b] == null) b++;
    if (a < 0 || b >= fe.length || cumul[b] === cumul[a]) return { fe: null, interpole: false };
    const r = (cumul[k] - cumul[a]) / (cumul[b] - cumul[a]);
    return { fe: Math.round((fe[a] + r * (fe[b] - fe[a])) * 1000) / 1000, interpole: true };
  });
}

/**
 * Diamètre et type lus dans le nom d'un calque DXF (0.266.0) : le nom peut être écrit n'importe comment
 * (« perrin-ec-200 » = EC, 200 mm ; « Aaa-800 » = 800 mm, type inconnu ; « C-EC_PVC_200 »).
 * Diamètre = premier nombre de 2 à 4 chiffres (mm) ; type = EC, EU, AEP, Gaz ou Drainage écrit comme un mot
 * (sans tenir compte des majuscules, aussi collé au nombre : « EC200 »).
 * Renvoie { diametre (mm, ou null), type (clé de TYPES_RESEAU, ou null) }.
 */
export function lireNomCalque(nom) {
  const texte = String(nom ?? '');
  const morceaux = texte.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let diametre = null;
  let type = null;
  for (const morceau of morceaux) {
    const colle = morceau.match(/^([A-Za-z]+)(\d{2,4})$/); // « EC200 »
    const mot = colle ? colle[1] : morceau;
    const chiffres = colle ? colle[2] : /^\d{2,4}$/.test(morceau) ? morceau : null;
    if (diametre == null && chiffres) diametre = Number(chiffres);
    if (type == null) type = TYPES_RESEAU.find((t) => t.cle.toLowerCase() === mot.toLowerCase())?.cle ?? null;
  }
  return { diametre, type };
}

/**
 * Lignes d'un calque mises en tronçons (0.266.0, « Par calque ») : les lignes qui se touchent bout à bout (à 1 cm près)
 * sont mises ensemble, dans le bon sens ; un embranchement (3 lignes au même bout) arrête le tronçon.
 * - lignes : [[{ est, nord, altitude }]] ; renvoie [[{ est, nord, altitude }]] (un tableau de points par tronçon).
 */
export function tronconsDeLignes(lignes, tolerance = 0.01) {
  const restantes = lignes.filter((l) => l.length >= 2).map((l) => [...l]);
  const proche = (p, q) => Math.hypot(p.est - q.est, p.nord - q.nord) <= tolerance;
  // Nombre de bouts de lignes à cet endroit (pour voir les embranchements).
  const bouts = (p) => lignes.reduce((n, l) => n + (l.length >= 2 && proche(l[0], p) ? 1 : 0) + (l.length >= 2 && proche(l.at(-1), p) ? 1 : 0), 0);
  const troncons = [];
  while (restantes.length > 0) {
    let troncon = restantes.shift();
    for (let sens = 0; sens < 2; sens++) {
      for (;;) {
        const bout = troncon.at(-1);
        if (bouts(bout) !== 2) break; // bout libre ou embranchement
        const k = restantes.findIndex((l) => proche(l[0], bout) || proche(l.at(-1), bout));
        if (k < 0) break;
        const suite = restantes.splice(k, 1)[0];
        const dansLeSens = proche(suite[0], bout) ? suite : [...suite].reverse();
        troncon = [...troncon, ...dansLeSens.slice(1)];
      }
      troncon = troncon.reverse(); // puis on prolonge par l'autre bout
    }
    troncons.push(troncon);
  }
  return troncons;
}

/**
 * Fils d'eau de tout le tracé (0.267.0) : tapés, calculés par une pente tapée, ou interpolés.
 * - sommets : [{ est, nord, fe, pente }] (nombres, ou null) ; pente en % du point d'avant vers ce point, dans le sens du
 *   tracé (−2 = descend), rapportée à la longueur en plan (décidé le 17.11) : FE = FE d'avant + pente / 100 × longueur.
 * Un FE tapé passe avant une pente tapée. Les points restés sans FE entre deux FE connus sont interpolés (fesInterpoles).
 * Renvoie [{ fe (m, au mm, ou null), source: 'tape' | 'pente' | 'interpole' | null, pente (% du segment qui arrive, ou null) }].
 */
export function fesDuTrace(sommets) {
  const n = sommets.length;
  const fe = new Array(n).fill(null);
  const source = new Array(n).fill(null);
  const longueur = (k) => Math.hypot(sommets[k].est - sommets[k - 1].est, sommets[k].nord - sommets[k - 1].nord);
  const parPentes = () => {
    for (let k = 0; k < n; k++) {
      if (fe[k] != null) continue;
      if (nombreOk(sommets[k].fe)) {
        fe[k] = sommets[k].fe;
        source[k] = 'tape';
      } else if (k > 0 && nombreOk(sommets[k].pente) && fe[k - 1] != null) {
        fe[k] = Math.round((fe[k - 1] + (sommets[k].pente / 100) * longueur(k)) * 1000) / 1000;
        source[k] = 'pente';
      }
    }
  };
  parPentes();
  // Interpolation entre FE connus, puis les pentes qui suivent un point interpolé.
  const interpoles = fesInterpoles(sommets.map((s, k) => ({ est: s.est, nord: s.nord, fe: fe[k] })));
  interpoles.forEach((r, k) => {
    if (r.interpole) {
      fe[k] = r.fe;
      source[k] = 'interpole';
    }
  });
  parPentes();
  return fe.map((valeur, k) => {
    const l = k > 0 ? longueur(k) : 0;
    const pente = k > 0 && valeur != null && fe[k - 1] != null && l > 0 ? Math.round(((valeur - fe[k - 1]) / l) * 100 * 1000) / 1000 : null;
    return { fe: valeur, source: source[k], pente };
  });
}

/** Nom proposé pour un nouveau réseau (0.267.0) : « type-n », le premier numéro libre parmi les noms pris (EU-1, EU-2…). */
export function nomProposeReseau(type, nomsPris, deja = 0) {
  const pris = new Set(nomsPris);
  let n = 1;
  let restants = deja;
  for (;;) {
    const nom = `${type}-${n}`;
    if (!pris.has(nom)) {
      if (restants === 0) return nom;
      restants--;
    }
    n++;
  }
}
