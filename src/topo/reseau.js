// Recollement de réseaux (0.101.0, demande du 30.10.2026) : calculs d'un levé de collecteurs.
// Formules validées par l'utilisateur (30.10.2026) :
// - fil d'eau d'un tuyau levé sur le dessus = altitude du dessus − diamètre extérieur ;
// - pente d'un tronçon = (fil d'eau du 2e point − fil d'eau du 1er) ÷ distance à plat × 100
//   (% ; négative quand ça descend du 1er vers le 2e) ; le sens d'écoulement va vers le plus bas.
// Coordonnées MN95 Est, Nord, altitude (m) ; diamètres en millimètres.
import { nouvelIdentifiant } from './surface.js';

/** Fil d'eau (m) d'un tuyau levé sur le dessus : altitude du dessus − diamètre extérieur (mm). */
export function filDEauDepuisDessus(altitudeDessus, diametreExterieurMm) {
  return altitudeDessus - diametreExterieurMm / 1000;
}

/**
 * Pente d'un tronçon entre deux points { est, nord, filEau } (m). Renvoie { distance (m, à plat),
 * pente (%, négative si le fil d'eau descend du point a vers le point b), sens ('a-b' = l'eau va
 * de a vers b, 'b-a' = de b vers a, 'plat') } ; pente et sens sont null si les points sont au
 * même endroit ou sans fil d'eau.
 */
export function penteTroncon(a, b) {
  const distance = Math.hypot(b.est - a.est, b.nord - a.nord);
  if (distance < 1e-6 || a.filEau == null || b.filEau == null) return { distance, pente: null, sens: null };
  const difference = b.filEau - a.filEau;
  const pente = (difference / distance) * 100;
  const sens = Math.abs(difference) < 1e-9 ? 'plat' : difference < 0 ? 'a-b' : 'b-a';
  return { distance, pente, sens };
}

/** Profondeur d'une chambre (m) : tampon − radier si les deux existent, sinon celle tapée, sinon null. */
export function profondeurChambre({ tampon, radier, saisie }) {
  if (tampon != null && radier != null) return tampon - radier;
  return saisie ?? null;
}

/** Radier (m) : celui levé, sinon déduit du tampon et de la profondeur tapée, sinon null. */
export function radierChambre({ tampon, radier, saisie }) {
  if (radier != null) return radier;
  return tampon != null && saisie != null ? tampon - saisie : null;
}

/**
 * Chambre carrée ou rectangulaire levée avec 3 coins du cadre, pris dans n'importe quel ordre :
 * le coin d'angle droit est celui dont l'angle est le plus proche de 90°. Renvoie les 4 coins
 * dans l'ordre du pourtour, le centre, les dimensions (m), l'altitude du tampon (moyenne des 3
 * coins) et l'écart à l'angle droit (degrés, à signaler s'il est grand).
 */
export function chambreDepuisTroisCoins(points) {
  if (points.length !== 3) throw new Error('Il faut 3 coins pour une chambre carrée ou rectangulaire.');
  let meilleur = null;
  for (let i = 0; i < 3; i++) {
    const coin = points[i];
    const p = points[(i + 1) % 3];
    const q = points[(i + 2) % 3];
    const ux = p.est - coin.est, uy = p.nord - coin.nord;
    const vx = q.est - coin.est, vy = q.nord - coin.nord;
    const longueurs = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (longueurs < 1e-9) throw new Error('Deux coins de la chambre sont au même endroit.');
    const angle = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / longueurs))) * 180) / Math.PI;
    const ecart = Math.abs(angle - 90);
    if (!meilleur || ecart < meilleur.ecart) meilleur = { coin, p, q, ecart };
  }
  const { coin, p, q, ecart } = meilleur;
  const quatrieme = { est: p.est + q.est - coin.est, nord: p.nord + q.nord - coin.nord };
  return {
    coins: [coin, p, quatrieme, q].map(({ est, nord }) => ({ est, nord })),
    centre: { est: (p.est + q.est) / 2, nord: (p.nord + q.nord) / 2 },
    cote1: Math.hypot(p.est - coin.est, p.nord - coin.nord),
    cote2: Math.hypot(q.est - coin.est, q.nord - coin.nord),
    tampon: points.reduce((somme, pt) => somme + pt.altitude, 0) / 3,
    ecartAngleDroit: ecart,
  };
}

// --- Levé de recollement d'un réseau (données) -------------------------------------------------
// Un levé de recollement = un réseau (EU, EC… : voir leve/reseaux.js). Il est rangé dans
// projet.reseaux : { id, nom ('LV-EU 1'), nature: 'reseau', reseau ('EU'), leveId (liste de points),
// ouvrages: [{ id, type, nom, forme ('ronde' ou 'rect'), points: [noms], centre: { est, nord },
//             tampon, radier, profondeurSaisie, diametre (mm), materiau, remarque }],
// conduites: [{ id, numero, noeuds: [{ point: nom } ou { ouvrage: id }] }],
// enCours: { conduite (id ou null), ouvrage (id d'une chambre rectangulaire pas finie, ou null) } }.
// Les points sont dans la liste du levé avec leurs attributs : { nom, est, nord, altitude, element,
// diametre (mm), materiau, remarque }. Un point de conduite est levé sur le dessus du tuyau.
// Noms des points (proposition) : ouvrage <CH|RG|GR>-<réseau>-<n°> (rond) ou -<n°>-<coin> (rect.) ;
// point de conduite T-<réseau>-<n° de la conduite>-<n° du point>.

/** Éléments levés : [clé, nom affiché, ouvrage (vrai) ou point de conduite (faux)]. */
export const ELEMENTS_RESEAU = [
  ['chambre', 'Chambre', true],
  ['regard', 'Regard', true],
  ['grille', 'Grille', true],
  ['tuyau', 'Tuyau', false],
  ['coude', 'Coude', false],
  ['te', 'Té', false],
  ['vanne', 'Vanne', false],
  ['borne', 'Borne hydrante', false],
  ['bouchon', 'Bouchon', false],
  ['branchement', 'Branchement', false],
];
const LETTRES_OUVRAGE = { chambre: 'CH', regard: 'RG', grille: 'GR' };

/** Vrai si cet élément est un ouvrage (chambre, regard, grille : tampon, radier, profondeur). */
export function estOuvrage(element) {
  return Boolean(ELEMENTS_RESEAU.find(([cle]) => cle === element)?.[2]);
}

/** Crée un levé de recollement vide pour ce réseau (« LV-EU 1 », « LV-EU 2 »…). Renvoie le levé. */
export function creerRecollement(projet, leve, reseau) {
  projet.reseaux ??= [];
  const debut = `LV-${reseau} `;
  const numeros = projet.reseaux.map((r) => (r.nom.startsWith(debut) ? Number(r.nom.slice(debut.length)) : 0)).filter(Number.isInteger);
  const recollement = {
    id: nouvelIdentifiant(), nom: `${debut}${Math.max(0, ...numeros) + 1}`, nature: 'reseau', reseau, leveId: leve.id,
    ouvrages: [], conduites: [], enCours: { conduite: null, ouvrage: null },
  };
  projet.reseaux.push(recollement);
  return recollement;
}

/** Noms de points déjà pris dans le projet (toutes les listes). */
function nomsPris(projet) {
  return new Set(projet.leves.flatMap((l) => l.points.map((p) => p.nom)));
}

/** Plus grand numéro après ce début dans les noms du projet (« T-EU-3-… » → 3 pour le début « T-EU-»). */
function plusGrandNumero(projet, debut) {
  let plusGrand = 0;
  for (const nom of nomsPris(projet)) {
    if (!nom.startsWith(debut)) continue;
    const numero = Number(nom.slice(debut.length).split('-')[0]);
    if (Number.isInteger(numero)) plusGrand = Math.max(plusGrand, numero);
  }
  return plusGrand;
}

/** Conduite en cours du levé, ou null. */
export function conduiteEnCours(recollement) {
  return recollement.conduites.find((c) => c.id === recollement.enCours.conduite) ?? null;
}

/** Ouvrage rectangulaire en cours (moins de 3 coins), ou null. */
export function ouvrageEnCours(recollement) {
  return recollement.ouvrages.find((o) => o.id === recollement.enCours.ouvrage) ?? null;
}

/** Numéro libre d'une conduite de ce réseau dans le projet (T-EU-1, T-EU-2…). */
function numeroConduiteLibre(projet, reseau) {
  const reserves = (projet.reseaux ?? []).filter((r) => r.reseau === reseau).flatMap((r) => r.conduites.map((c) => c.numero));
  return Math.max(plusGrandNumero(projet, `T-${reseau}-`), 0, ...reserves) + 1;
}

/**
 * Commence une nouvelle conduite, depuis un ouvrage (id) ou de nulle part (null). Le numéro est
 * donné au premier point. Renvoie la conduite.
 */
export function nouvelleConduite(recollement, ouvrageId) {
  const conduite = { id: nouvelIdentifiant(), numero: null, noeuds: ouvrageId ? [{ ouvrage: ouvrageId }] : [] };
  recollement.conduites.push(conduite);
  recollement.enCours.conduite = conduite.id;
  return conduite;
}

/** Dernier ouvrage fini du levé (pour partir de lui), ou null. */
function dernierOuvrage(recollement) {
  return [...recollement.ouvrages].reverse().find((o) => o.centre) ?? null;
}

/**
 * Nom proposé pour le prochain point de cet élément (voir en haut). forme : 'ronde' ou 'rect'
 * (ouvrages seulement).
 */
export function prochainNomReseau(projet, recollement, element, forme = 'ronde') {
  const reseau = recollement.reseau;
  if (estOuvrage(element)) {
    const enCours = ouvrageEnCours(recollement);
    if (enCours && enCours.type === element && forme === 'rect') return `${enCours.nom}-${enCours.points.length + 1}`;
    const debut = `${LETTRES_OUVRAGE[element]}-${reseau}-`;
    const numero = plusGrandNumero(projet, debut) + 1;
    return forme === 'rect' ? `${debut}${numero}-1` : `${debut}${numero}`;
  }
  const conduite = conduiteEnCours(recollement);
  const numero = conduite?.numero ?? numeroConduiteLibre(projet, reseau);
  const debut = `T-${reseau}-${numero}-`;
  const pris = nomsPris(projet);
  let n = plusGrandNumero(projet, debut) + 1;
  while (pris.has(`${debut}${n}`)) n += 1;
  return `${debut}${n}`;
}

/**
 * Range un point pris avec le récepteur dans le levé de recollement.
 * point = { nom, est, nord, altitude } ; attributs = { element, forme ('ronde' / 'rect', ouvrages),
 * diametre (mm), materiau, remarque }. Un ouvrage rond est fini tout de suite ; un rectangulaire
 * après son 3e coin. Un ouvrage fini est ajouté à la conduite en cours ; un point de conduite
 * aussi (une conduite commence, depuis le dernier ouvrage, s'il n'y en a pas).
 * Renvoie { point, ouvrage?, conduite? } ou { erreur }.
 */
export function ajouterPointReseau(projet, leve, recollement, point, attributs) {
  const nom = String(point.nom ?? '').trim();
  if (!nom) return { erreur: 'donne un nom au point' };
  const { element, forme = 'ronde', diametre = null, materiau = '', remarque = '' } = attributs;
  if (!ELEMENTS_RESEAU.some(([cle]) => cle === element)) return { erreur: 'élément inconnu' };
  if (nomsPris(projet).has(nom)) return { erreur: `le nom ${nom} est déjà pris dans ce projet` };
  const range = { ...point, nom, element, diametre, materiau, remarque };

  if (estOuvrage(element)) {
    let ouvrage = ouvrageEnCours(recollement);
    if (forme !== 'rect' || !ouvrage || ouvrage.type !== element) {
      ouvrage = {
        id: nouvelIdentifiant(), type: element, nom: forme === 'rect' ? nom.replace(/-\d+$/, '') : nom, forme, points: [], centre: null,
        tampon: null, radier: null, profondeurSaisie: null, diametre, materiau, remarque,
      };
      recollement.ouvrages.push(ouvrage);
    }
    ouvrage.points.push(nom);
    leve.points.push(range);
    if (forme === 'rect' && ouvrage.points.length < 3) {
      recollement.enCours.ouvrage = ouvrage.id;
      return { point: range, ouvrage };
    }
    recollement.enCours.ouvrage = null;
    if (forme === 'rect') {
      const coins = ouvrage.points.map((n) => leve.points.find((p) => p.nom === n));
      const cadre = chambreDepuisTroisCoins(coins);
      Object.assign(ouvrage, { centre: cadre.centre, coins: cadre.coins, tampon: cadre.tampon, ecartAngleDroit: cadre.ecartAngleDroit });
    } else {
      Object.assign(ouvrage, { centre: { est: point.est, nord: point.nord }, tampon: point.altitude });
    }
    const conduite = conduiteEnCours(recollement);
    if (conduite) conduite.noeuds.push({ ouvrage: ouvrage.id });
    return { point: range, ouvrage, conduite };
  }

  let conduite = conduiteEnCours(recollement);
  if (!conduite) conduite = nouvelleConduite(recollement, dernierOuvrage(recollement)?.id ?? null);
  conduite.numero ??= numeroConduiteLibre(projet, recollement.reseau);
  conduite.noeuds.push({ point: nom });
  leve.points.push(range);
  return { point: range, conduite };
}

/**
 * Nœud d'une conduite avec sa position et son fil d'eau : { est, nord, filEau (ou null), nom }.
 * Point de conduite : fil d'eau = dessus − diamètre extérieur ; ouvrage : son radier.
 */
export function noeudReseau(recollement, leve, noeud) {
  if (noeud.ouvrage) {
    const ouvrage = recollement.ouvrages.find((o) => o.id === noeud.ouvrage);
    if (!ouvrage?.centre) return null;
    return { ...ouvrage.centre, filEau: radierChambre({ tampon: ouvrage.tampon, radier: ouvrage.radier, saisie: ouvrage.profondeurSaisie }), nom: ouvrage.nom };
  }
  const point = leve.points.find((p) => p.nom === noeud.point);
  if (!point) return null;
  const filEau = point.diametre > 0 && point.altitude != null ? filDEauDepuisDessus(point.altitude, point.diametre) : null;
  return { est: point.est, nord: point.nord, filEau, nom: point.nom };
}

/** Tronçons d'une conduite : [{ a, b, distance, pente, sens }] (voir penteTroncon). */
export function tronconsConduite(recollement, leve, conduite) {
  const noeuds = conduite.noeuds.map((n) => noeudReseau(recollement, leve, n)).filter(Boolean);
  const troncons = [];
  for (let i = 1; i < noeuds.length; i++) troncons.push({ a: noeuds[i - 1], b: noeuds[i], ...penteTroncon(noeuds[i - 1], noeuds[i]) });
  return troncons;
}

/** Dernier tronçon de la conduite en cours (pour l'écran Lever), ou null. */
export function dernierTroncon(recollement, leve) {
  const conduite = conduiteEnCours(recollement);
  return conduite ? tronconsConduite(recollement, leve, conduite).at(-1) ?? null : null;
}

/** Profondeur (m) et radier (m) d'un ouvrage, d'après ses altitudes ou la profondeur tapée. */
export function mesuresOuvrage(ouvrage) {
  const valeurs = { tampon: ouvrage.tampon, radier: ouvrage.radier, saisie: ouvrage.profondeurSaisie };
  return { profondeur: profondeurChambre(valeurs), radier: radierChambre(valeurs) };
}

/** Enlève le dernier point levé du recollement (et de sa conduite ou de son ouvrage). Renvoie le point ou null. */
export function annulerDernierPointReseau(recollement, leve) {
  const point = leve.points.at(-1);
  if (!point) return null;
  leve.points.pop();
  for (const conduite of recollement.conduites) conduite.noeuds = conduite.noeuds.filter((n) => n.point !== point.nom);
  const ouvrage = recollement.ouvrages.find((o) => o.points.includes(point.nom));
  if (ouvrage) {
    ouvrage.points = ouvrage.points.filter((n) => n !== point.nom);
    if (ouvrage.points.length === 0) {
      recollement.ouvrages = recollement.ouvrages.filter((o) => o !== ouvrage);
      for (const conduite of recollement.conduites) conduite.noeuds = conduite.noeuds.filter((n) => n.ouvrage !== ouvrage.id);
      if (recollement.enCours.ouvrage === ouvrage.id) recollement.enCours.ouvrage = null;
    } else if (ouvrage.forme === 'rect') {
      // Chambre rectangulaire redevenue incomplète : on reprend ses coins.
      for (const conduite of recollement.conduites) conduite.noeuds = conduite.noeuds.filter((n) => n.ouvrage !== ouvrage.id);
      Object.assign(ouvrage, { centre: null, coins: undefined, tampon: null });
      recollement.enCours.ouvrage = ouvrage.id;
    }
  }
  return point;
}
