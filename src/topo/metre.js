// Métré levé avec le récepteur (onglet Terrain, « Que lèves-tu ? » › Métré) : des aires (surface
// d'enrobé…), des longueurs (bordure…) et des points à compter (regards…). Ce n'est pas une
// surface : chaque aire ou longueur levée devient toute seule une mesure de Calculs › Mesures /
// métrés (nommée avec son libellé : « ENR 1 », « BOR 2 »), et les points comptés une mesure
// « Nombre » par libellé (« RG »).
//
// Un métré a la forme { id, nom ('Métré 1'…), leveId, enCours: { aire, longueur } } (identifiants
// des mesures en cours, ou null) ; il est rangé dans projet.metres. Ses mesures portent metreId,
// libelle et numero (n° de l'aire ou de la longueur dans le projet).
// Noms des points : A-<libellé>-<n° de l'aire>-<n° du point> (A-ENR-1-1…), L-<libellé>-<n° de la
// longueur>-<n° du point> (L-BOR-1-1…, comptés avec les lignes de rupture), P-<libellé>-<n°> (P-RG-1…).
import { nouvelIdentifiant } from './surface.js';
import { creerMesure, nomsDeLaMesure } from './mesure.js';
import { numeroElementLibre, nomSuivant, nomsDuProjet } from './leve-direct.js';

/** Rôles d'un point levé dans un métré : [clé, nom affiché]. */
export const ROLES_METRE = [
  ['aire', 'Aire'],
  ['longueur', 'Longueur'],
  ['compte', 'Point compté'],
];
// Lettre des noms de points et sorte de mesure, pour chaque rôle.
const LETTRES = { aire: 'A', longueur: 'L', compte: 'P' };
const TYPES = { aire: 'aire', longueur: 'longueur', compte: 'nombre' };

/** Vrai si cet objet est un métré (et non une surface). */
export function estMetre(objet) {
  return objet?.nature === 'metre';
}

/** Crée un métré vide dans ce levé, nommé « Métré N » (le plus grand du projet + 1). Renvoie le métré. */
export function creerMetre(projet, leve) {
  projet.metres ??= [];
  const numeros = projet.metres.map((m) => /^Métré (\d+)$/.exec(m.nom)?.[1]).filter(Boolean).map(Number);
  const metre = { id: nouvelIdentifiant(), nom: `Métré ${Math.max(0, ...numeros) + 1}`, nature: 'metre', leveId: leve.id, enCours: { aire: null, longueur: null } };
  projet.metres.push(metre);
  return metre;
}

/** Mesure en cours du métré pour ce rôle (aire, longueur), ou null. */
export function mesureEnCours(projet, metre, role) {
  return projet.mesures.find((m) => m.id === metre.enCours?.[role]) ?? null;
}

/** Mesure « Nombre » du métré pour ce libellé (points comptés), ou null. */
function mesureDeComptage(projet, metre, libelle) {
  return projet.mesures.find((m) => m.metreId === metre.id && m.type === 'nombre' && m.libelle === libelle) ?? null;
}

/**
 * Numéro de l'aire ou de la longueur pour ce libellé : celui de la mesure en cours si elle a ce
 * libellé, sinon le prochain libre dans le projet (A-ENR-1, A-ENR-2…).
 */
function numeroPour(projet, metre, role, libelle) {
  const enCours = mesureEnCours(projet, metre, role);
  if (enCours && enCours.libelle === libelle) return enCours.numero;
  return numeroElementLibre(projet, LETTRES[role], libelle);
}

/** Nom proposé pour le prochain point du métré (voir en haut du fichier). */
export function prochainNomMetre(projet, metre, role, libelle) {
  if (role === 'compte') return nomSuivant(projet, `P-${libelle}-`);
  return nomSuivant(projet, `${LETTRES[role]}-${libelle}-${numeroPour(projet, metre, role, libelle)}-`);
}

/**
 * Range un point pris avec le récepteur dans un métré : dans le levé, et dans la mesure du rôle
 * (créée si besoin : nouvelle aire ou longueur si le libellé change ou après « Nouvelle »).
 * point = { nom, est, nord, altitude, ... }. Renvoie { point, mesure } ou { erreur }.
 */
export function ajouterPointMetre(projet, leve, metre, role, libelle, point) {
  const nom = String(point.nom ?? '').trim();
  if (!nom) return { erreur: 'donne un nom au point' };
  if (!TYPES[role]) return { erreur: 'rôle inconnu dans un métré' };
  if (nomsDuProjet(projet).has(nom)) return { erreur: `le nom ${nom} est déjà pris dans ce projet` };

  let mesure;
  if (role === 'compte') {
    mesure = mesureDeComptage(projet, metre, libelle);
    if (!mesure) mesure = nouvelleMesure(projet, metre, 'nombre', libelle, null, libelle);
  } else {
    mesure = mesureEnCours(projet, metre, role);
    if (!mesure || mesure.libelle !== libelle) {
      const numero = numeroPour(projet, metre, role, libelle);
      mesure = nouvelleMesure(projet, metre, TYPES[role], libelle, numero, `${libelle} ${numero}`);
      metre.enCours[role] = mesure.id;
    }
  }
  const range = { ...point, nom };
  leve.points.push(range);
  if (role === 'aire') mesure.contour.push(nom);
  else mesure.points.push(nom);
  return { point: range, mesure };
}

/** Crée une mesure du métré et l'ajoute au projet. */
function nouvelleMesure(projet, metre, type, libelle, numero, nom) {
  const mesure = { ...creerMesure(type, nom, metre.leveId), metreId: metre.id, libelle, numero };
  projet.mesures.push(mesure);
  return mesure;
}

/** « + Nouvelle » : la prochaine aire (ou longueur) commence une nouvelle mesure. */
export function nouvelElementMetre(projet, metre, role) {
  const enCours = mesureEnCours(projet, metre, role);
  if (enCours && nomsDeLaMesure(enCours).length > 0) metre.enCours[role] = null;
}

/** Enlève un point (dernier point annulé) des mesures, puis les mesures de métré restées vides. */
export function retirerPointDesMesures(projet, nom) {
  for (const mesure of projet.mesures) {
    if (mesure.contour) mesure.contour = mesure.contour.filter((n) => n !== nom);
    if (mesure.points) mesure.points = mesure.points.filter((n) => n !== nom);
    for (const ligne of mesure.lignesRupture ?? []) ligne.noms = ligne.noms.filter((n) => n !== nom);
  }
  projet.mesures = projet.mesures.filter((m) => !m.metreId || nomsDeLaMesure(m).length > 0);
}

/** Résumé court d'un métré : « 2 aires · 1 longueur · 5 points comptés ». */
export function resumeMetre(projet, metre) {
  const mesures = projet.mesures.filter((m) => m.metreId === metre.id);
  const pluriel = (nombre) => (nombre > 1 ? 's' : '');
  const aires = mesures.filter((m) => m.type === 'aire').length;
  const longueurs = mesures.filter((m) => m.type === 'longueur').length;
  const comptes = mesures.filter((m) => m.type === 'nombre').reduce((total, m) => total + m.points.length, 0);
  return `${aires} aire${pluriel(aires)} · ${longueurs} longueur${pluriel(longueurs)} · ${comptes} point${pluriel(comptes)} compté${pluriel(comptes)}`;
}
