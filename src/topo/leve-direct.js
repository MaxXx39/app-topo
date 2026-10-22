// Levé direct avec le récepteur Emlid (appli Android) : chaque point pris est rangé dans un levé,
// exactement comme les points d'un fichier importé, et, selon le rôle choisi avant de le prendre,
// dans la surface en cours : contour, ligne de rupture (ouverte ou fermée) ou point isolé.
// Les surfaces, volumes, mesures et exports marchent donc sans rien changer.
// Sur le terrain, on ne voit que les surfaces (stock, terrain naturel, terrassement) : leur levé
// est créé tout seul, un par jour (« Levé RX2 AAAA-MM-JJ »), et reçoit les points du jour.
//
// Noms proposés (comme Emlid Stock) : contour B1, B2… ; lignes de rupture H1-1, H1-2… puis H2-1… ;
// points isolés C1, C2… Le numéro suivant = le plus grand du levé + 1 (les noms restent uniques
// dans le levé, même avec plusieurs stocks). L'utilisateur peut changer le nom avant de prendre le point.
import { creerSurface, nouvelIdentifiant, NATURES } from './surface.js';
import { creerLigne } from './noms.js';

/** Rôles d'un point levé : [clé, nom affiché]. */
export const ROLES_LEVE = [
  ['contour', 'Contour'],
  ['ligne', 'Ligne de rupture'],
  ['isole', 'Point isolé'],
];

/** Vrai si le levé a été fait avec le récepteur (et non importé d'un fichier). */
export function estLeveDirect(leve) {
  return Boolean(leve?.direct);
}

/** Date du jour sur l'appareil, « AAAA-MM-JJ » (heure de Suisse, pas l'heure universelle). */
export function jourLocal(maintenant = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/** Crée un levé vide fait avec le récepteur, l'ajoute au projet et le rend actif. Renvoie le levé. */
export function creerLeveDirect(projet, maintenant = new Date()) {
  const jour = jourLocal(maintenant);
  const base = `Levé RX2 ${jour}`;
  const noms = new Set(projet.leves.map((l) => l.nom));
  let nom = base;
  for (let numero = 2; noms.has(nom); numero += 1) nom = `${base} (${numero})`;
  const leve = { id: nouvelIdentifiant(), nom, importeLe: maintenant.toISOString(), jour, direct: true, points: [] };
  projet.leves.push(leve);
  projet.leveActifId = leve.id;
  return leve;
}

/** Levé du jour fait avec le récepteur (créé s'il n'existe pas encore). */
export function leveDuJour(projet, maintenant = new Date()) {
  const jour = jourLocal(maintenant);
  return projet.leves.find((l) => estLeveDirect(l) && l.jour === jour) ?? creerLeveDirect(projet, maintenant);
}

/**
 * Crée une surface vide dans ce levé, de cette nature (stock, terrain, terrassement), nommée
 * « Stock 3 », « Terrain naturel 1 »… (le plus grand numéro du projet pour cette nature + 1), et
 * l'ajoute au projet. Seuls les points levés pour elle en font partie. Renvoie la surface.
 */
export function creerSurfaceDirecte(projet, leve, nature = 'stock') {
  const titre = NATURES.find(([cle]) => cle === nature)?.[1] ?? 'Stock';
  const modele = new RegExp(`^${titre} (\\d+)$`);
  const numeros = projet.surfaces.map((s) => modele.exec(s.nom)?.[1]).filter(Boolean).map(Number);
  const surface = creerSurface(`${titre} ${Math.max(0, ...numeros) + 1}`, leve.id, NATURES.some(([cle]) => cle === nature) ? nature : 'stock');
  surface.tousLesPoints = false;
  projet.surfaces.push(surface);
  return surface;
}

/** Ligne de rupture en cours du stock (la dernière ; créée s'il n'y en a pas). */
export function ligneEnCours(surface) {
  if (surface.lignesRupture.length === 0) surface.lignesRupture.push(creerLigne());
  return surface.lignesRupture[surface.lignesRupture.length - 1];
}

/** Commence une nouvelle ligne de rupture (sauf si la ligne en cours est encore vide). */
export function nouvelleLigne(surface) {
  if (ligneEnCours(surface).noms.length > 0) surface.lignesRupture.push(creerLigne());
}

/** Ferme la ligne en cours (dernier point relié au premier) ou la rouvre. */
export function basculerFermeture(surface) {
  const ligne = ligneEnCours(surface);
  ligne.fermee = !ligne.fermee;
}

/** Plus grand numéro des noms du levé qui suivent ce modèle (ex. /^B(\d+)$/), ou 0. */
function plusGrandNumero(noms, modele) {
  let plusGrand = 0;
  for (const nom of noms) {
    const trouve = modele.exec(nom);
    if (trouve) plusGrand = Math.max(plusGrand, Number(trouve[1]));
  }
  return plusGrand;
}

/** Numéro de la ligne en cours dans les noms H<ligne>-<point> : celui de son 1er point, sinon un nouveau. */
function numeroDeLigne(noms, ligne) {
  const premier = /^H(\d+)-\d+$/.exec(ligne.noms[0] ?? '');
  return premier ? Number(premier[1]) : plusGrandNumero(noms, /^H(\d+)-\d+$/) + 1;
}

/** Nom proposé pour le prochain point de ce rôle (voir en haut du fichier). */
export function prochainNom(leve, surface, role) {
  const noms = leve.points.map((p) => p.nom);
  const pris = new Set(noms);
  let fabriquer;
  if (role === 'contour') {
    const depart = plusGrandNumero(noms, /^B(\d+)$/);
    fabriquer = (i) => `B${depart + i}`;
  } else if (role === 'ligne') {
    const ligne = numeroDeLigne(noms, ligneEnCours(surface));
    const depart = plusGrandNumero(noms, new RegExp(`^H${ligne}-(\\d+)$`));
    fabriquer = (i) => `H${ligne}-${depart + i}`;
  } else {
    const depart = plusGrandNumero(noms, /^C(\d+)$/);
    fabriquer = (i) => `C${depart + i}`;
  }
  let i = 1;
  while (pris.has(fabriquer(i))) i += 1;
  return fabriquer(i);
}

/**
 * Range un point pris avec le récepteur : dans le levé, et dans le stock selon son rôle.
 * point = { nom, est, nord, altitude, ... }. Renvoie { point } ou { erreur } (nom vide ou déjà pris).
 */
export function ajouterPointDirect(leve, surface, role, point) {
  const nom = String(point.nom ?? '').trim();
  if (!nom) return { erreur: 'donne un nom au point' };
  if (leve.points.some((p) => p.nom === nom)) return { erreur: `le nom ${nom} est déjà pris dans ce levé` };
  const range = { ...point, nom };
  leve.points.push(range);
  if (role === 'contour') surface.contour.push(nom);
  else if (role === 'ligne') ligneEnCours(surface).noms.push(nom);
  else surface.points.push(nom);
  return { point: range };
}

/**
 * Efface le dernier point pris dans le levé, et l'enlève des surfaces de ce levé.
 * Renvoie le point effacé, ou null si le levé est vide.
 */
export function annulerDernierPoint(leve, surfaces) {
  const point = leve.points.pop();
  if (!point) return null;
  for (const surface of surfaces.filter((s) => s.leveId === leve.id)) {
    surface.contour = surface.contour.filter((n) => n !== point.nom);
    surface.points = surface.points.filter((n) => n !== point.nom);
    for (const ligne of surface.lignesRupture) ligne.noms = ligne.noms.filter((n) => n !== point.nom);
  }
  return point;
}

/** Nombre de points du stock par rôle : { contour, lignes (non vides), pointsLignes, isoles }. */
export function resumeStock(surface) {
  const lignes = surface.lignesRupture.filter((l) => l.noms.length > 0);
  return {
    contour: surface.contour.length,
    lignes: lignes.length,
    pointsLignes: lignes.reduce((total, l) => total + l.noms.length, 0),
    isoles: surface.points.length,
  };
}
