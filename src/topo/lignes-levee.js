// Lignes et contour d'un levé (Terrain › Lever, 0.78.0, demandes du 27.10.2026) :
// - un segment nouveau (du dernier point de la ligne ou du contour en cours au nouveau point) ne
//   doit pas croiser un autre segment du levé : l'appli propose de supprimer le segment de la ligne
//   du dessous (la plus ancienne) ou de lever le point en point isolé (voir segmentCroise) ;
// - supprimer un segment coupe la ligne en deux, les points restent (supprimerSegment) ;
// - un point déjà levé peut être ajouté à la ligne ou au contour en cours, en gardant son nom,
//   s'il n'est encore dans aucune ligne ni dans le contour (ajouterPointExistant) ;
// - dans un stock, un point de ligne ou un point isolé hors du contour est refusé (horsDuContour) ;
// - supprimer un point du levé (supprimerPointDuLevee).
// Un levé a la forme d'une surface (voir topo/surface.js) : contour (noms), lignesRupture
// ([{ noms, fermee, libelle, numero }]), points (noms des points isolés).
// Coordonnées : Est, Nord (m, MN95).
import { pointDansPolygone } from './volume.js';
import { creerLigne } from './noms.js';
import { debutDeNom } from './leve-direct.js';

/** Nom affiché d'une ligne : « L-HT-1 » (ou « Ligne 2 » sans libellé). */
export function nomDeLigne(ligne, index) {
  return ligne.numero ? `${debutDeNom('L', ligne.libelle)}${ligne.numero}` : `Ligne ${index + 1}`;
}

/**
 * Où est ce point dans le levé : { type: 'contour' }, { type: 'ligne', index }, { type: 'isole' }
 * ou null s'il n'y est pas.
 */
export function placeDuPoint(surface, nom) {
  if ((surface.contour ?? []).includes(nom)) return { type: 'contour' };
  const index = (surface.lignesRupture ?? []).findIndex((l) => l.noms.includes(nom));
  if (index >= 0) return { type: 'ligne', index };
  if ((surface.points ?? []).includes(nom)) return { type: 'isole' };
  return null;
}

/**
 * Segments du levé : [{ type ('contour' ou 'ligne'), index (n° de la ligne), i (position du
 * premier point), a, b (noms) }]. Le contour (dès 3 points) et les lignes fermées ont aussi le
 * segment du dernier point au premier.
 */
export function segmentsDuLevee(surface) {
  const segments = [];
  const ajouter = (noms, ferme, type, index) => {
    for (let i = 0; i + 1 < noms.length; i++) segments.push({ type, index, i, a: noms[i], b: noms[i + 1] });
    if (ferme && noms.length >= 3) segments.push({ type, index, i: noms.length - 1, a: noms.at(-1), b: noms[0] });
  };
  ajouter(surface.contour ?? [], true, 'contour', null);
  (surface.lignesRupture ?? []).forEach((ligne, index) => ajouter(ligne.noms, ligne.fermee, 'ligne', index));
  return segments;
}

/** Vrai si les segments p1-p2 et p3-p4 se coupent vraiment (se toucher par un bout ne compte pas). */
export function seCroisent(p1, p2, p3, p4) {
  const cote = (a, b, c) => (b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est);
  const d1 = cote(p3, p4, p1);
  const d2 = cote(p3, p4, p2);
  const d3 = cote(p1, p2, p3);
  const d4 = cote(p1, p2, p4);
  const eps = 1e-9;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/**
 * Le nouveau segment, du point "depuisNom" à "vers" ({ est, nord }), croise-t-il un segment du
 * levé ? parNom : Map nom -> point. Les segments qui ont "depuisNom" (ou "versNom") pour bout ne
 * comptent pas. Renvoie le segment croisé le plus ancien (le contour, puis les lignes dans l'ordre
 * où elles ont été commencées), ou null.
 */
export function segmentCroise(surface, parNom, depuisNom, vers, versNom = null) {
  const depuis = parNom.get(depuisNom);
  if (!depuis || !vers) return null;
  for (const segment of segmentsDuLevee(surface)) {
    if ([segment.a, segment.b].some((n) => n === depuisNom || (versNom && n === versNom))) continue;
    const a = parNom.get(segment.a);
    const b = parNom.get(segment.b);
    if (a && b && seCroisent(depuis, vers, a, b)) return segment;
  }
  return null;
}

/**
 * Supprime le segment n° i de la ligne n° index (entre son point i et le suivant) : la ligne est
 * coupée en deux, les points restent (les deux morceaux gardent le libellé et le numéro de la
 * ligne). Une ligne fermée devient simplement ouverte à cet endroit.
 */
export function supprimerSegment(surface, index, i) {
  const ligne = surface.lignesRupture[index];
  if (!ligne || i < 0 || i >= ligne.noms.length) return;
  if (ligne.fermee) {
    // On rouvre la boucle à cet endroit : elle commence au point d'après et finit au point i.
    ligne.noms = [...ligne.noms.slice(i + 1), ...ligne.noms.slice(0, i + 1)];
    ligne.fermee = false;
    return;
  }
  if (i + 1 >= ligne.noms.length) return;
  const suite = { ...creerLigne(), libelle: ligne.libelle, numero: ligne.numero, noms: ligne.noms.slice(i + 1) };
  ligne.noms = ligne.noms.slice(0, i + 1);
  surface.lignesRupture.splice(index + 1, 0, suite);
}

/**
 * Ajoute un point déjà levé (toucher sur le plan) à la ligne en cours (role 'ligne') ou au
 * contour (role 'contour'), avec son nom. Refusé s'il est déjà dans une ligne ou dans le contour ;
 * un point isolé quitte les points isolés. Renvoie null, ou { erreur }.
 */
export function ajouterPointExistant(surface, role, nom) {
  const place = placeDuPoint(surface, nom);
  if (place?.type === 'contour') return { erreur: `${nom} est déjà dans le contour` };
  if (place?.type === 'ligne') return { erreur: `${nom} est déjà dans la ligne ${nomDeLigne(surface.lignesRupture[place.index], place.index)}` };
  if (place?.type === 'isole') surface.points = surface.points.filter((n) => n !== nom);
  if (role === 'contour') surface.contour.push(nom);
  else {
    if (surface.lignesRupture.length === 0) surface.lignesRupture.push(creerLigne());
    surface.lignesRupture.at(-1).noms.push(nom);
  }
  return null;
}

/**
 * Vrai si le point { est, nord } est hors du contour du stock (contour d'au moins 3 points ; les
 * autres levés n'ont pas de contour : jamais hors). parNom : Map nom -> point.
 */
export function horsDuContour(surface, parNom, point) {
  if (surface.nature !== 'stock') return false;
  const polygone = (surface.contour ?? []).map((n) => parNom.get(n)).filter(Boolean);
  if (polygone.length < 3) return false;
  return !pointDansPolygone(point, polygone);
}

/**
 * Supprime un point du levé : il quitte le contour, les lignes et les points isolés ; il part aussi
 * de la liste de points si plus rien ne s'en sert (autre levé, mesure). objets : les autres levés
 * et mesures du projet (pour savoir s'ils l'utilisent). Renvoie vrai si le point a été trouvé.
 */
export function supprimerPointDuLevee(leve, surface, nom, objets = []) {
  const place = placeDuPoint(surface, nom);
  surface.contour = (surface.contour ?? []).filter((n) => n !== nom);
  surface.points = (surface.points ?? []).filter((n) => n !== nom);
  for (const ligne of surface.lignesRupture ?? []) ligne.noms = ligne.noms.filter((n) => n !== nom);
  const utilise = objets.some((o) => o !== surface && [...(o.contour ?? []), ...(o.points ?? []), ...(o.lignesRupture ?? []).flatMap((l) => l.noms)].includes(nom));
  const avant = leve.points.length;
  if (!utilise) leve.points = leve.points.filter((p) => p.nom !== nom);
  return Boolean(place) || leve.points.length !== avant;
}
