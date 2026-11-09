// Annotations (0.177.0, Intermédiaire et Expert, demande du 09.11) : des points posés sur le plan avec une ou
// plusieurs remarques et des photos. Pas un levé : liste « Annot-AAAAMMJJ » (une par jour, date collée), points « Annot-n » (nom modifiable à la main).
// Rangée dans projet.autres (nature 'annotation') avec sa liste de points propre, comme un levé libre : le plan,
// les photos (📷), Drive, l'historique, l'archivage et les exports de listes marchent déjà.
// Un point : { nom, est, nord, altitude (ou null), annotation: { source 'loupe' | 'gnss' | 'tablette', precision (m, ou null),
// le (date ISO), remarques: [texte] } } ; ses photos sont dans la liste (photo.point = son nom).
import { creerListeDeLevee, nommerListeDeLevee } from './leve-direct.js';
import { nouvelIdentifiant, dateDuJourCollee, PREFIXE_ANNOTATION_LISTE } from './surface.js';

export const PREFIXE_ANNOTATION = PREFIXE_ANNOTATION_LISTE;
// Précision minimale du GPS de la tablette pour enregistrer un point (m) : 3 m au départ, réglable.
export const PRECISION_TABLETTE_DEPART = 3;

/** Vrai pour une liste d'annotations. */
export const estAnnotation = (objet) => objet?.nature === 'annotation';

/** Nom de départ de la liste du jour : « Annot-20261109 ». */
export function nomListeAnnotation(maintenant = new Date()) {
  return `${PREFIXE_ANNOTATION}${dateDuJourCollee(maintenant)}`;
}

/** Listes d'annotations du projet (de la plus récente à la plus ancienne). */
export function listesAnnotation(projet) {
  return (projet.autres ?? []).filter(estAnnotation).reverse();
}

/** Liste du jour (créée si elle manque) : celle qui porte le nom « Anot-AAAAMMJJ ». */
export function listeAnnotationDuJour(projet, maintenant = new Date()) {
  projet.autres ??= [];
  const nom = nomListeAnnotation(maintenant);
  const existante = projet.autres.find((a) => estAnnotation(a) && a.nom === nom);
  if (existante) return existante;
  const leve = creerListeDeLevee(projet, maintenant);
  const liste = { id: nouvelIdentifiant(), nom, nature: 'annotation', leveId: leve.id, contour: [], lignesRupture: [], points: [] };
  projet.autres.push(liste);
  nommerListeDeLevee(projet, liste);
  return liste;
}

/** Vrai si la précision (m) du GPS de la tablette suffit (inconnue = refusée). */
export function precisionSuffisante(precision, maximum = PRECISION_TABLETTE_DEPART) {
  return Number.isFinite(precision) && precision <= maximum;
}

/** Remarques nettoyées : sans espaces autour, sans ligne vide. */
export function nettoyerRemarques(remarques) {
  return (remarques ?? []).map((r) => String(r ?? '').trim()).filter(Boolean);
}

/** Numéro le plus haut des points « Annot-n » du projet (les anciens « A-n » comptent aussi). */
function dernierNumero(projet) {
  const numeros = projet.autres.filter(estAnnotation).flatMap((a) => projet.leves.find((l) => l.id === a.leveId)?.points ?? [])
    .map((p) => /^(?:Annot|A)-(\d+)$/.exec(p.nom)?.[1]).filter(Boolean).map(Number);
  return Math.max(0, ...numeros);
}

/** Nom proposé pour le prochain point : « Annot-1 », « Annot-2 »… (jamais un nom déjà pris). */
export function nomProposeAnnotation(projet, nomsPris = new Set()) {
  projet.autres ??= [];
  let numero = dernierNumero(projet) + 1;
  while (nomsPris.has(`Annot-${numero}`)) numero += 1;
  return `Annot-${numero}`;
}

/**
 * Ajoute un point d'annotation à la liste du jour. donnees : { est, nord, altitude, source, precision, remarques,
 * nom (tapé à la main, facultatif : sinon « Annot-n »), photos (déjà préparées, rangées dans la liste avec
 * photo.point = nom du point) }. nomsPris : noms déjà utilisés dans le projet (jamais deux fois le même nom).
 * Renvoie { liste, point } ou { erreur }.
 */
export function ajouterAnnotation(projet, donnees, nomsPris = new Set(), maintenant = new Date()) {
  const tape = String(donnees.nom ?? '').trim();
  if (tape && nomsPris.has(tape)) return { erreur: `Le nom « ${tape} » existe déjà` };
  const liste = listeAnnotationDuJour(projet, maintenant);
  const leve = projet.leves.find((l) => l.id === liste.leveId);
  const point = {
    nom: tape || nomProposeAnnotation(projet, nomsPris),
    est: donnees.est,
    nord: donnees.nord,
    altitude: donnees.altitude ?? null,
    annotation: { source: donnees.source, precision: donnees.precision ?? null, le: maintenant.toISOString(), remarques: nettoyerRemarques(donnees.remarques) },
  };
  leve.points.push(point);
  liste.points.push(point.nom);
  liste.photos = [...(liste.photos ?? []), ...(donnees.photos ?? []).map((p) => ({ ...p, point: point.nom }))];
  return { liste, point };
}

/** Point d'annotation le plus récent du projet (d'après sa date de prise), ou null. */
export function dernierAnnotation(projet) {
  let meilleur = null;
  for (const liste of listesAnnotation(projet)) {
    for (const point of projet.leves.find((l) => l.id === liste.leveId)?.points ?? []) {
      if (!meilleur || String(point.annotation?.le ?? '') >= String(meilleur.annotation?.le ?? '')) meilleur = point;
    }
  }
  return meilleur;
}

/** Liste et point d'annotation de ce nom (ou null). */
export function trouverAnnotation(projet, nom) {
  for (const liste of listesAnnotation(projet)) {
    const point = projet.leves.find((l) => l.id === liste.leveId)?.points.find((p) => p.nom === nom);
    if (point) return { liste, point };
  }
  return null;
}

/** Supprime un point d'annotation et ses photos. Renvoie vrai si trouvé. */
export function supprimerAnnotation(projet, nom) {
  const trouve = trouverAnnotation(projet, nom);
  if (!trouve) return false;
  const leve = projet.leves.find((l) => l.id === trouve.liste.leveId);
  leve.points = leve.points.filter((p) => p.nom !== nom);
  trouve.liste.points = trouve.liste.points.filter((n) => n !== nom);
  trouve.liste.photos = (trouve.liste.photos ?? []).filter((p) => p.point !== nom);
  return true;
}
