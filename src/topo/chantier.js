// Levé chantier (0.175.0, demande du 09.11, remplace le Recollement dans Lever, Intermédiaire) :
// éléments en cours de chantier, points et lignes avec une bibliothèque de libellés à part et des
// attributs (nature, Ø, matériau, profondeur, remarque). Formules reprises du Recollement (validées 30.10) :
// - fil d'eau d'un tuyau levé sur le dessus = altitude du dessus − Ø extérieur (mm ÷ 1000) ;
// - radier d'une chambre = tampon − profondeur tapée ;
// - cadre carré / rectangulaire : 3 coins pris dans n'importe quel ordre (chambreDepuisTroisCoins).
// Altitude gardée d'un point (validé le 09.11) : le fil d'eau (ou le radier) quand on le connaît ;
// l'altitude réellement levée (dessus, tampon) est gardée à côté dans « altitudeLevee ».
// Coordonnées MN95 Est, Nord, altitude (m) ; diamètres en mm.
import { filDEauDepuisDessus, chambreDepuisTroisCoins } from './reseau.js';

/** Diamètres proposés (mm) pour un tuyau, une conduite qui arrive à un ouvrage… (demande du 09.11). */
export const DIAMETRES_LISTE = [80, 100, 125, 160, 200, 250, 315, 400, 500, 600, 800, 1000];
/** Gaines des câbles et fourreaux : [Ø intérieur, Ø extérieur] en mm (« 80 / 92 ») ; le Ø extérieur sert au fil d'eau. À confirmer : intérieur / extérieur. */
export const GAINES_LISTE = [[80, 92], [100, 112], [120, 132], [148, 163], [195, 214]];
/** Nombre de câbles ou de fourreaux côte à côte. */
export const NOMBRES_LISTE = [1, 2, 3, 4, 5, 6];

/** Préfixe du nom d'un levé chantier. */
export const PREFIXE_CHANTIER = 'LV-Chant ';
/** Rayon (m) du cercle d'un tampon rond dessiné sur le plan (arbitraire : 60 cm de diamètre, demande du 09.11). */
export const RAYON_TAMPON_ROND = 0.3;

/** Natures proposées pour les réseaux et pour les bordures (listes de départ, modifiables en Expert). */
export const NATURES_RESEAU_DEPART = ['EU', 'EC', 'ESP', 'Swisscom', 'Gaz', 'Elec', 'CAD', 'Éclairage', 'Autre'];
export const NATURES_BORDURE_DEPART = ['Haute', 'Basse', 'Bordurette', 'Caniveau', 'Volige'];

/**
 * Libellés de départ. abreviation = début du nom des points (« P-CH-1 », « L-T-1-3 », sans tiret
 * dedans). ouvrage : peut être levé en 1 point (rond) ou 3 coins. modes : ce que touche le GNSS
 * ('dessus' / 'tampon' / 'fe') ; le premier est proposé. champs : attributs demandés (diametre =
 * Ø extérieur du tuyau, ou Ø du tuyau qui arrive pour un ouvrage, facultatif). reseau : natures de réseaux
 * (sinon natures de bordures).
 */
export const LIBELLES_CHANTIER_DEPART = [
  { abreviation: 'CH', nom: 'Chambre', court: 'Chamb.', forme: 'carre', reseau: true, ouvrage: true, modes: ['tampon', 'fe'], champs: ['profondeur', 'diametre', 'remarque'] },
  { abreviation: 'GR', nom: 'Grille', court: 'Gril.', forme: 'carre-vide', reseau: true, ouvrage: true, modes: ['tampon', 'fe'], champs: ['profondeur', 'diametre', 'remarque'] },
  { abreviation: 'T', nom: 'Tuyau', court: 'Tuyau', forme: '', reseau: true, ouvrage: false, modes: ['dessus', 'fe'], champs: ['diametre', 'materiau', 'remarque'] },
  { abreviation: 'CV', nom: 'Cap de vanne', court: 'Cap de v.', forme: 'triangle', reseau: true, ouvrage: false, modes: [], champs: ['diametre', 'remarque'] },
  { abreviation: 'BO', nom: 'Borne', court: 'Born.', forme: 'losange', reseau: true, ouvrage: false, modes: [], champs: ['remarque'] },
  { abreviation: 'CB', nom: 'Câble', court: 'Cabl.', forme: 'croix', reseau: true, ouvrage: false, modes: [], champs: ['gaine', 'nombre', 'remarque'] },
  { abreviation: 'FO', nom: 'Fourreau', court: 'Four.', forme: 'rond-vide', reseau: true, ouvrage: false, modes: ['dessus', 'fe'], champs: ['gaine', 'nombre', 'materiau', 'remarque'] },
  { abreviation: 'BD', nom: 'Bordures', court: 'Bord.', forme: 'triangle-bas', reseau: false, ouvrage: false, modes: [], champs: ['remarque'] },
];

/**
 * Couleur des points selon la nature (demande du 09.11 : la forme vient du libellé, la couleur de la nature).
 * Réseaux : mêmes couleurs que le Recollement (EU rouge, EC bleu, Gaz jaune, Elec orange, CAD rose, Swisscom vert) ;
 * ESP, Éclairage et les bordures : propositions, modifiables en Expert (bibliothèque du chantier).
 */
export const COULEURS_NATURES_DEPART = {
  EU: '#dc2626', EC: '#2563eb', ESP: '#7c3aed', Swisscom: '#16a34a', Gaz: '#ca8a04', Elec: '#ea580c', CAD: '#db2777', 'Éclairage': '#92400e', Autre: '#6b7280',
  Haute: '#475569', Basse: '#94a3b8', Bordurette: '#a16207', Caniveau: '#0891b2', Volige: '#78350f',
};

/** Couleur d'une nature (celle de la liste donnée, sinon celle de départ, sinon gris). */
export function couleurDeNature(nature, couleurs = {}) {
  return couleurs[nature] || COULEURS_NATURES_DEPART[nature] || '#6b7280';
}

/** Vrai si le libellé est un tuyau (le Ø extérieur donne le fil d'eau quand on lève le dessus). */
const estTuyau = (libelle) => libelle.modes?.[0] === 'dessus';

/**
 * Lit ce qui a été tapé pour un point et vérifie : saisie = { nature, mode, diametre, profondeur,
 * materiau, remarque, forme ('ronde' / 'rect') } (textes ou nombres). Renvoie { attributs } (valeurs
 * propres, nombres en nombres, vide = absent) ou { erreur }.
 */
export function lireAttributsChantier(libelle, saisie = {}) {
  const nombre = (valeur) => {
    const texte = String(valeur ?? '').trim().replace(',', '.');
    if (texte === '') return { vide: true };
    const n = Number(texte);
    return Number.isFinite(n) ? { n } : { faux: true };
  };
  const attributs = { libelle: libelle.abreviation, nature: saisie.nature || '' };
  if (!attributs.nature) return { erreur: 'choisis la nature' };
  const mode = libelle.modes?.length ? (libelle.modes.includes(saisie.mode) ? saisie.mode : libelle.modes[0]) : '';
  if (mode) attributs.mode = mode;
  if (libelle.ouvrage) attributs.forme = saisie.forme === 'rect' ? 'rect' : 'ronde';
  if (libelle.champs.includes('diametre')) {
    const d = nombre(saisie.diametre);
    if (d.faux || (d.n !== undefined && d.n <= 0)) return { erreur: 'le Ø doit être un nombre de mm plus grand que 0' };
    if (d.vide && estTuyau(libelle) && mode === 'dessus') return { erreur: 'le Ø est obligatoire pour lever le dessus du tuyau' };
    if (!d.vide) attributs.diametre = d.n;
  }
  // Câble / fourreau : gaine « Ø int. / Ø ext. » (le Ø extérieur donne le fil d'eau) et nombre.
  if (libelle.champs.includes('gaine')) {
    const [int, ext] = String(saisie.gaine ?? '').split('/').map((t) => Number(t));
    if (Number.isFinite(int) && Number.isFinite(ext) && ext > 0) {
      attributs.diametreInterieur = int;
      attributs.diametre = ext;
    } else if (estTuyau(libelle) && mode === 'dessus') return { erreur: 'la gaine (Ø) est obligatoire pour lever le dessus' };
  }
  if (libelle.champs.includes('nombre')) {
    const n = Math.round(Number(saisie.nombre));
    if (Number.isFinite(n) && n >= 1) attributs.nombre = n;
  }
  if (libelle.champs.includes('profondeur') && mode === 'tampon') {
    const p = nombre(saisie.profondeur);
    if (p.faux || (p.n !== undefined && p.n < 0)) return { erreur: 'la profondeur doit être un nombre de mètres (0 ou plus)' };
    if (!p.vide) attributs.profondeur = p.n;
  }
  if (libelle.champs.includes('materiau') && String(saisie.materiau ?? '').trim()) attributs.materiau = String(saisie.materiau).trim();
  if (libelle.champs.includes('remarque') && String(saisie.remarque ?? '').trim()) attributs.remarque = String(saisie.remarque).trim();
  return { attributs };
}

/**
 * Altitude gardée pour un point levé à l'altitude « levee » avec ces attributs (voir lireAttributsChantier) :
 * { altitude (celle gardée), altitudeLevee (celle touchée par le GNSS), filEau (ou null), radier (ou null) }.
 * Tuyau levé sur le dessus : fil d'eau = dessus − Ø. Ouvrage levé au tampon avec profondeur : radier =
 * tampon − profondeur. Sinon l'altitude levée est gardée telle quelle (mode « fe » : c'est le fil d'eau).
 */
export function altitudesDuPoint(levee, attributs) {
  if (levee == null) return { altitude: null, altitudeLevee: null, filEau: null, radier: null };
  if (attributs.mode === 'dessus' && attributs.diametre != null) {
    const filEau = filDEauDepuisDessus(levee, attributs.diametre);
    return { altitude: filEau, altitudeLevee: levee, filEau, radier: null };
  }
  if (attributs.mode === 'tampon' && attributs.profondeur != null) {
    const radier = levee - attributs.profondeur;
    return { altitude: radier, altitudeLevee: levee, filEau: null, radier };
  }
  return { altitude: levee, altitudeLevee: levee, filEau: attributs.mode === 'fe' ? levee : null, radier: null };
}

/**
 * Cadre d'un ouvrage levé en 3 coins : { coins (4, pourtour), centre, longueur, largeur (m, côté 1 ≥ côté 2),
 * direction (degrés, azimut du grand côté depuis le nord, dans le sens horaire, 0 à 180), tampon (moyenne des 3),
 * ecartAngleDroit (°) }. Reprend chambreDepuisTroisCoins.
 */
export function cadreDeTroisCoins(points) {
  const c = chambreDepuisTroisCoins(points);
  const [a, b] = c.cote1 >= c.cote2 ? [c.coins[0], c.coins[1]] : [c.coins[0], c.coins[3]];
  let direction = (Math.atan2(b.est - a.est, b.nord - a.nord) * 180) / Math.PI;
  direction = ((direction % 180) + 180) % 180;
  return {
    coins: c.coins, centre: c.centre,
    longueur: Math.max(c.cote1, c.cote2), largeur: Math.min(c.cote1, c.cote2),
    direction, tampon: c.tampon, ecartAngleDroit: c.ecartAngleDroit,
  };
}

/** Texte court écrit à côté d'un point sur le plan et dans le DXF : « Ø300 · FE 432.150 », « Prof. 2.40 · Radier 429.800 ». */
export function texteDuPoint(attributs, altitudes = {}) {
  const parties = [];
  if (attributs.diametre != null) parties.push(`Ø${attributs.diametre}${attributs.nombre > 1 ? ` ×${attributs.nombre}` : ''}`);
  else if (attributs.nombre > 1) parties.push(`×${attributs.nombre}`);
  if (attributs.profondeur != null) parties.push(`Prof. ${attributs.profondeur.toFixed(2)}`);
  if (altitudes.filEau != null) parties.push(`FE ${altitudes.filEau.toFixed(3)}`);
  if (altitudes.radier != null) parties.push(`Radier ${altitudes.radier.toFixed(3)}`);
  return parties.join(' · ');
}

/** Nom d'un calque DXF : CHANT_TUYAU_EU (sans accents ni espaces). */
export function calqueChantier(libelleNom, nature) {
  const net = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  return ['CHANT', net(libelleNom), net(nature)].filter(Boolean).join('_');
}
