// Levé direct avec le récepteur Emlid (appli Android) : chaque point pris est rangé dans un levé,
// exactement comme les points d'un fichier importé, et, selon le rôle choisi avant de le prendre,
// dans la surface en cours : contour, ligne de rupture (ouverte ou fermée) ou point isolé.
// Les surfaces, volumes, mesures et exports marchent donc sans rien changer.
// Sur le terrain, on ne voit que les surfaces (stock, terrain naturel, terrassement) : leur levé
// est créé tout seul, un par jour (« Levé RX2 AAAA-MM-JJ »), et reçoit les points du jour.
//
// Noms proposés (demande de l'utilisateur, 22.10.2026) : des numéros, par centaine pour chaque
// surface du projet : 1, 2, 3… pour la première, 101, 102… pour la deuxième, 201… pour la troisième,
// quel que soit le rôle du point. Jamais deux fois le même nom dans le projet. L'utilisateur peut
// changer le nom avant de prendre le point.
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
  surface.premierNumero = numeroDeDepartLibre(projet);
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

/** Tous les noms de points du projet (tous ses levés). */
export function nomsDuProjet(projet) {
  return new Set(projet.leves.flatMap((leve) => leve.points.map((p) => p.nom)));
}

/** Centaine d'un numéro : 1 à 100 → 0, 101 à 200 → 1, 201 à 300 → 2… */
const centaine = (numero) => Math.floor((numero - 1) / 100);

/**
 * Premier numéro d'une nouvelle surface levée : 1, puis 101, 201… (la centaine qui suit le plus
 * grand numéro déjà utilisé ou réservé par une surface dans le projet).
 */
export function numeroDeDepartLibre(projet) {
  let derniere = -1;
  for (const nom of nomsDuProjet(projet)) if (/^\d+$/.test(nom)) derniere = Math.max(derniere, centaine(Number(nom)));
  for (const surface of projet.surfaces) if (surface.premierNumero) derniere = Math.max(derniere, centaine(surface.premierNumero));
  return (derniere + 1) * 100 + 1;
}

/** Noms des points d'une surface, tous rôles confondus. */
function nomsDeLaSurface(surface) {
  return [...surface.contour, ...surface.lignesRupture.flatMap((l) => l.noms), ...surface.points];
}

/**
 * Nom proposé pour le prochain point de la surface : le numéro qui suit son plus grand numéro
 * (à partir de son premier numéro : 1, 101, 201…), en sautant les noms déjà pris dans le projet.
 * Une surface sans premier numéro (levée avant cette règle) en reçoit un.
 */
export function prochainNom(projet, surface) {
  if (!surface.premierNumero) surface.premierNumero = numeroDeDepartLibre(projet);
  const pris = nomsDuProjet(projet);
  const miens = nomsDeLaSurface(surface)
    .filter((nom) => /^\d+$/.test(nom))
    .map(Number)
    .filter((numero) => numero >= surface.premierNumero);
  let numero = Math.max(surface.premierNumero - 1, ...miens) + 1;
  while (pris.has(String(numero))) numero += 1;
  return String(numero);
}

/**
 * Range un point pris avec le récepteur : dans le levé, et dans la surface selon son rôle.
 * point = { nom, est, nord, altitude, ... } ; nomsPris : noms déjà utilisés ailleurs dans le projet.
 * Renvoie { point } ou { erreur } (nom vide ou déjà pris).
 */
export function ajouterPointDirect(leve, surface, role, point, nomsPris = new Set()) {
  const nom = String(point.nom ?? '').trim();
  if (!nom) return { erreur: 'donne un nom au point' };
  if (nomsPris.has(nom) || leve.points.some((p) => p.nom === nom)) return { erreur: `le nom ${nom} est déjà pris dans ce projet` };
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
