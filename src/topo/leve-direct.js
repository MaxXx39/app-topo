// Levé direct avec le récepteur Emlid (appli Android) : chaque point pris est rangé dans un levé,
// exactement comme les points d'un fichier importé, et, selon le rôle choisi avant de le prendre,
// dans la surface en cours : contour, ligne de rupture (ouverte ou fermée) ou point isolé.
// Les surfaces, volumes, mesures et exports marchent donc sans rien changer.
// Sur le terrain, on ne voit que les surfaces (stock, terrain naturel, terrassement) : leur levé
// est créé tout seul, un par jour (« Levé RX2 AAAA-MM-JJ »), et reçoit les points du jour.
//
// Noms proposés (décision de l'utilisateur, 22.10.2026 : dans Mensura, il ne travaille qu'avec les
// noms, et retrouve une ligne par ses numéros qui se suivent) : type - libellé - numéro(s).
// - contour d'un stock : C-Stock-<n° du contour>-<n° du point>   (C-Stock-1-1, C-Stock-1-2…, C-Stock-2-1)
// - ligne de rupture   : L-<libellé>-<n° de la ligne>-<n° du point> (L-HT-1-1, L-HT-1-2…, L-HT-2-1)
// - point isolé        : P-<libellé>-<n° du point>               (P-RG-1, P-RG-2…)
// Les libellés sont des abréviations courtes (HT haut de talus, RG regard…, voir leve/libelles.js).
// Les numéros des contours et des lignes sont comptés dans tout le projet (jamais deux L-HT-1),
// et un nom ne sert qu'une fois dans le projet. L'utilisateur peut changer le nom avant de prendre le point.
// Un terrain naturel ou un terrassement n'a pas de contour : seulement des lignes de rupture et
// des points isolés (demande de l'utilisateur).
import { creerSurface, nouvelIdentifiant, NATURES } from './surface.js';
import { creerLigne } from './noms.js';
import { nomsDeLaMesure } from './mesure.js';

/** Rôles d'un point levé : [clé, nom affiché]. */
export const ROLES_LEVE = [
  ['contour', 'Contour'],
  ['ligne', 'Ligne de rupture'],
  ['isole', 'Point isolé'],
];

/** Libellé du contour (dans C-Stock-1-1). */
export const LIBELLE_CONTOUR = 'Stock';

/** Rôles permis pour lever cette surface : le contour seulement pour un stock. */
export function rolesPermis(surface) {
  return surface?.nature === 'stock' ? ['contour', 'ligne', 'isole'] : ['ligne', 'isole'];
}

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

/**
 * Levé « Levé libre » (« Autres » dans le code ; levé de contrôle, points géomètre… ; décision du 23.10.2026) : des lignes
 * (L-<lib>-<n°>-<pt>) et des points isolés (P-<lib>-<n°>), sans surface, sans volume, sans mesure.
 * Même forme qu'une surface (contour vide, lignesRupture, points) pour en reprendre les outils ;
 * rangé à part dans projet.autres. Nommé « Levé libre N » (« Autres N » avant la 0.57.1). Renvoie l'objet créé.
 */
export function creerAutres(projet, leve) {
  projet.autres ??= [];
  // Anciens noms « Autres N » comptés aussi (avant la version 0.57.1).
  const numeros = projet.autres.map((a) => /^(?:Autres|Levé libre) (\d+)$/.exec(a.nom)?.[1]).filter(Boolean).map(Number);
  const autres = { id: nouvelIdentifiant(), nom: `Levé libre ${Math.max(0, ...numeros) + 1}`, nature: 'autres', leveId: leve.id, contour: [], lignesRupture: [], points: [] };
  projet.autres.push(autres);
  return autres;
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

/**
 * Lit un nom donné par le levé : « C-Stock-2-5 », « L-HT-1-3 », « A-ENR-1-2 » (aire d'un métré)
 * ou « P-RG-4 ». Renvoie { type ('C', 'L', 'A' ou 'P'), libelle, element (n° du contour, de la
 * ligne ou de l'aire ; null pour un point isolé), numero (n° du point) }, ou null si le nom ne
 * suit pas cette règle.
 */
export function lireNomLeve(nom) {
  const element = /^([CLA])-([^-\s]+)-(\d+)-(\d+)$/.exec(String(nom));
  if (element) return { type: element[1], libelle: element[2], element: Number(element[3]), numero: Number(element[4]) };
  const point = /^P-([^-\s]+)-(\d+)$/.exec(String(nom));
  if (point) return { type: 'P', libelle: point[1], element: null, numero: Number(point[2]) };
  return null;
}

/**
 * Numéro libre dans le projet pour un nouvel élément de ce type ('C' contour, 'L' ligne) et de ce
 * libellé : le plus grand déjà utilisé (dans les noms des points, ou réservé par un contour ou une
 * ligne encore vide) + 1. "sauf" : la surface ou la ligne qui cherche son numéro (pas comptée).
 */
export function numeroElementLibre(projet, type, libelle, sauf = null) {
  let plusGrand = 0;
  for (const nom of nomsDuProjet(projet)) {
    const lu = lireNomLeve(nom);
    if (lu && lu.type === type && lu.libelle === libelle) plusGrand = Math.max(plusGrand, lu.element);
  }
  for (const surface of [...projet.surfaces, ...(projet.autres ?? [])]) {
    if (type === 'C' && surface !== sauf && surface.numeroContour) plusGrand = Math.max(plusGrand, surface.numeroContour);
    if (type !== 'L') continue;
    for (const ligne of surface.lignesRupture ?? []) {
      if (ligne !== sauf && ligne.libelle === libelle && ligne.numero) plusGrand = Math.max(plusGrand, ligne.numero);
    }
  }
  // Aires et longueurs des métrés (voir topo/metre.js) : leur numéro est réservé aussi.
  const typeDeMesure = { A: 'aire', L: 'longueur' }[type];
  for (const mesure of projet.mesures ?? []) {
    if (mesure.metreId && mesure.type === typeDeMesure && mesure.libelle === libelle && mesure.numero) plusGrand = Math.max(plusGrand, mesure.numero);
  }
  return plusGrand + 1;
}

/** Numéro du contour du stock dans le projet (C-Stock-1, C-Stock-2…), donné au premier besoin. */
export function numeroDeContour(projet, surface) {
  if (!surface.numeroContour) surface.numeroContour = numeroElementLibre(projet, 'C', LIBELLE_CONTOUR, surface);
  return surface.numeroContour;
}

/**
 * Prépare la ligne en cours pour ce libellé : si elle a déjà des points d'un autre libellé, une
 * nouvelle ligne commence. La ligne reçoit son libellé et son numéro dans le projet (L-HT-1,
 * L-HT-2…). Renvoie la ligne.
 */
export function preparerLigne(projet, surface, libelle) {
  let ligne = ligneEnCours(surface);
  if (ligne.noms.length > 0 && ligne.libelle !== libelle) {
    surface.lignesRupture.push(creerLigne());
    ligne = ligneEnCours(surface);
  }
  if (ligne.libelle !== libelle || !ligne.numero) {
    ligne.libelle = libelle;
    ligne.numero = numeroElementLibre(projet, 'L', libelle, ligne);
  }
  return ligne;
}

/**
 * Nom proposé pour le prochain point (voir en haut du fichier) : le n° du point qui suit le plus
 * grand de son contour, de sa ligne ou de son libellé de point, en sautant les noms déjà pris.
 * Pour une ligne, la ligne en cours est d'abord préparée pour ce libellé (voir preparerLigne).
 */
export function prochainNom(projet, surface, role, libelle) {
  let prefixe;
  if (role === 'contour') prefixe = `C-${LIBELLE_CONTOUR}-${numeroDeContour(projet, surface)}-`;
  else if (role === 'ligne') prefixe = `L-${libelle}-${preparerLigne(projet, surface, libelle).numero}-`;
  else prefixe = `P-${libelle}-`;
  return nomSuivant(projet, prefixe);
}

/**
 * Premier nom libre avec ce début (« L-HT-1- ») : le numéro qui suit le plus grand déjà pris dans
 * le projet, en sautant les noms déjà pris.
 */
export function nomSuivant(projet, prefixe) {
  const pris = nomsDuProjet(projet);
  let plusGrand = 0;
  for (const nom of pris) {
    if (!nom.startsWith(prefixe)) continue;
    const numero = Number(nom.slice(prefixe.length));
    if (Number.isInteger(numero)) plusGrand = Math.max(plusGrand, numero);
  }
  let numero = plusGrand + 1;
  while (pris.has(`${prefixe}${numero}`)) numero += 1;
  return `${prefixe}${numero}`;
}

/**
 * Range un point pris avec le récepteur : dans le levé, et dans la surface selon son rôle.
 * point = { nom, est, nord, altitude, ... } ; nomsPris : noms déjà utilisés ailleurs dans le projet.
 * Renvoie { point } ou { erreur } (nom vide ou déjà pris).
 */
export function ajouterPointDirect(leve, surface, role, point, nomsPris = new Set()) {
  const nom = String(point.nom ?? '').trim();
  if (!nom) return { erreur: 'donne un nom au point' };
  if (!rolesPermis(surface).includes(role)) return { erreur: 'pas de contour pour un terrain naturel ou un terrassement' };
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

// --- Supprimer un levé du Terrain (surface levée, métré ou levé libre) et ses points ---

/** Noms des points d'une surface ou d'un levé libre (contour, lignes, points choisis). */
const nomsDeLaLevee = (objet) => [...(objet.contour ?? []), ...(objet.lignesRupture ?? []).flatMap((l) => l.noms), ...(objet.points ?? []).filter((p) => typeof p === 'string')];

/** Le levé (surface, métré ou levé libre) d'identifiant "id", avec la liste où il est rangé ; ou null. */
function trouverLevee(projet, id) {
  for (const cle of ['surfaces', 'metres', 'autres']) {
    const objet = (projet[cle] ?? []).find((o) => o.id === id);
    if (objet) return { objet, cle };
  }
  return null;
}

/**
 * Points qui partent avec ce levé : les siens (pour un métré, ceux de ses mesures), sauf ceux
 * qu'utilise encore une autre surface, un autre levé libre ou une autre mesure du même levé du jour.
 * Renvoie [nom].
 */
export function pointsDeLaLevee(projet, id) {
  const trouve = trouverLevee(projet, id);
  if (!trouve) return [];
  const { objet, cle } = trouve;
  const propres = cle === 'metres' ? projet.mesures.filter((m) => m.metreId === id).flatMap(nomsDeLaMesure) : nomsDeLaLevee(objet);
  const memeLeve = (o) => o.leveId === objet.leveId && o.id !== id;
  const utilises = new Set([
    ...projet.surfaces.filter(memeLeve).flatMap(nomsDeLaLevee),
    ...(projet.autres ?? []).filter(memeLeve).flatMap(nomsDeLaLevee),
    ...projet.mesures.filter((m) => m.leveId === objet.leveId && m.metreId !== id).flatMap(nomsDeLaMesure),
  ]);
  return [...new Set(propres)].filter((nom) => !utilises.has(nom));
}

/**
 * Supprime un levé du Terrain : la surface (ou le métré et ses mesures, ou le levé libre) et ses
 * points (voir pointsDeLaLevee) ; le levé du jour, s'il n'a plus rien, part aussi.
 * Renvoie { nom, points (nombre de points enlevés) } ou null s'il n'existe pas.
 */
export function supprimerLevee(projet, id) {
  const trouve = trouverLevee(projet, id);
  if (!trouve) return null;
  const { objet, cle } = trouve;
  const aRetirer = new Set(pointsDeLaLevee(projet, id));
  projet[cle] = projet[cle].filter((o) => o.id !== id);
  if (cle === 'metres') projet.mesures = projet.mesures.filter((m) => m.metreId !== id);
  const leve = projet.leves.find((l) => l.id === objet.leveId);
  if (leve) {
    leve.points = leve.points.filter((p) => !aRetirer.has(p.nom));
    const encoreUtilise = [...projet.surfaces, ...(projet.metres ?? []), ...(projet.autres ?? []), ...projet.mesures].some((o) => o.leveId === leve.id);
    if (leve.points.length === 0 && !encoreUtilise) projet.leves = projet.leves.filter((l) => l !== leve);
  }
  return { nom: objet.nom, points: aRetirer.size };
}
