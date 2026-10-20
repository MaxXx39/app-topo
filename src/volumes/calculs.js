// Calculs de volume du projet (onglet 3. Volumes).
//
// Un calcul mesure le volume de la surface 1 (le dessus, ou l'état « après ») :
// - par rapport à sa ligne basse (les points de son contour) si « une seule surface » est coché,
//   comme pour un stock posé sur le terrain ;
// - sinon par rapport à la surface 2 (le dessous, ou l'état « avant »).
// Remblai : là où la surface 1 est au-dessus ; déblai : là où elle est au-dessous.
//
// Un calcul a la forme :
// {
//   id,
//   nom,           // '' tant que l'utilisateur n'en a pas choisi (on affiche alors nomAutomatique)
//   surface1Id,
//   uneSeule,      // vrai : volume sur la ligne basse de la surface 1
//   surface2Id,    // surface 2 (si uneSeule est faux), ou null
//   zone,          // { type: 'toute' } : toute la surface 1 ;
//                  // { type: 'surface', surfaceId } : seulement dans le contour de cette surface
// }
// Unités : m, m², m³.
import { nouvelIdentifiant, estImportee, nomNature, NATURES } from '../topo/surface.js';
import { calculerVolumeSurface } from '../topo/volume.js';
import { comparerSurfaces } from '../topo/comparaison.js';

/**
 * Crée un calcul prérempli d'après la nature de la surface 1 :
 * - un stock (créé à partir de points) : une seule surface, volume sur sa ligne basse ;
 * - sinon : comparé au dernier terrain naturel du projet (s'il y en a un).
 */
export function creerCalcul(surface1, surfaces) {
  const calcul = { id: nouvelIdentifiant(), nom: '', surface1Id: null, uneSeule: false, surface2Id: null, zone: { type: 'toute' } };
  if (surface1) preremplir(calcul, surface1, surfaces);
  return calcul;
}

/** Remplit la surface 1 d'un calcul, et la base qui lui convient (voir creerCalcul). */
export function preremplir(calcul, surface1, surfaces) {
  calcul.surface1Id = surface1.id;
  calcul.uneSeule = surface1.nature === 'stock' && !estImportee(surface1);
  const terrains = surfaces.filter((s) => s.nature === 'terrain' && s.id !== surface1.id);
  calcul.surface2Id = calcul.uneSeule ? null : (terrains.at(-1)?.id ?? null);
  calcul.zone = { type: 'toute' };
}

/** Nom proposé quand l'utilisateur n'en a pas choisi : « Stock 1 », ou « Terrassement 1 / TN ». */
export function nomAutomatique(calcul, surfaces) {
  const nom = (id) => surfaces.find((s) => s.id === id)?.nom;
  const nom1 = nom(calcul.surface1Id) ?? 'Calcul';
  const nom2 = calcul.uneSeule ? null : nom(calcul.surface2Id);
  return nom2 ? `${nom1} / ${nom2}` : nom1;
}

/** Nom du calcul : celui choisi par l'utilisateur, sinon le nom automatique. */
export function nomDuCalcul(calcul, surfaces) {
  return calcul.nom || nomAutomatique(calcul, surfaces);
}

const TITRES_TOTAUX = { stock: 'Total stocks', terrain: 'Total terrains naturels', terrassement: 'Total terrassements' };

/**
 * Range les lignes du tableau des volumes par nature de la surface 1 (stocks, terrains naturels,
 * terrassements), pour ne jamais additionner des volumes qui n'ont rien à voir.
 * - lignes : liste de { nature, resultat, ... } (resultat : volume calculé)
 * Renvoie [{ nature, lignes, total }] dans l'ordre des natures. total = { titre, surfacePlan,
 * remblai, deblai } (m², m³) quand le groupe a au moins deux lignes, sinon null.
 */
export function grouperParNature(lignes) {
  const ordre = [...NATURES.map(([cle]) => cle), null];
  const natureConnue = (nature) => (ordre.includes(nature) ? nature : null);
  return ordre
    .map((nature) => {
      const groupe = lignes.filter((ligne) => natureConnue(ligne.nature) === nature);
      const somme = (cle) => groupe.reduce((total, { resultat }) => total + resultat[cle], 0);
      const total =
        groupe.length >= 2
          ? { titre: TITRES_TOTAUX[nature] ?? 'Total', surfacePlan: somme('surfacePlan'), remblai: somme('remblai'), deblai: somme('deblai') }
          : null;
      return { nature, lignes: groupe, total };
    })
    .filter((groupe) => groupe.lignes.length > 0);
}

/**
 * Phrase qui décrit un calcul (pour le PDF) :
 * « Stock 1 » (stock) sur sa ligne basse ;
 * « Terrassement 1 » (terrassement) par rapport à « TN » (terrain naturel), dans le contour de « Stock 1 ».
 */
export function descriptionCalcul(calcul, surfaces) {
  const decrire = (id) => {
    const surface = surfaces.find((s) => s.id === id);
    if (!surface) return '?';
    const nature = nomNature(surface.nature);
    return `« ${surface.nom} »${nature ? ` (${nature.toLowerCase()})` : ''}`;
  };
  if (calcul.uneSeule) return `${decrire(calcul.surface1Id)} sur sa ligne basse`;
  let texte = `${decrire(calcul.surface1Id)} par rapport à ${decrire(calcul.surface2Id)}`;
  if (calcul.zone?.type === 'surface') {
    texte += `, dans le contour de « ${surfaces.find((s) => s.id === calcul.zone.surfaceId)?.nom ?? '?'} »`;
  }
  return texte;
}

/**
 * Après la suppression d'une surface : retire les calculs dont la surface 1 n'existe plus,
 * et vide les choix (surface 2, zone) qui désignent une surface disparue.
 */
export function nettoyerCalculs(calculs, surfaces) {
  const existe = (id) => surfaces.some((s) => s.id === id);
  const restants = calculs.filter((c) => existe(c.surface1Id));
  for (const calcul of restants) {
    if (calcul.surface2Id && !existe(calcul.surface2Id)) calcul.surface2Id = null;
    if (calcul.zone?.type === 'surface' && !existe(calcul.zone.surfaceId)) calcul.zone = { type: 'toute' };
  }
  return restants;
}

/**
 * Calcule le volume d'un calcul.
 * - surfaces : surfaces du projet
 * - triangulations : Map id de surface -> résultat de calculerSurface ({ triangles } ou { erreurs })
 * - pointsDe(surface) : points du levé d'une surface créée à partir de points
 * Renvoie le résultat de calculerVolumeSurface (sur toute la surface 1), ou de comparerSurfaces
 * (dans un contour), ou { erreurs }.
 */
export function calculerVolume(calcul, { surfaces, triangulations, pointsDe }) {
  const surface1 = surfaces.find((s) => s.id === calcul.surface1Id);
  if (!surface1) return { erreurs: ['choisis la surface 1'] };
  const triangulation1 = triangulations.get(surface1.id);
  if (calcul.uneSeule) {
    if (estImportee(surface1)) return { erreurs: ['une surface importée n\'a pas de ligne basse : choisis une surface 2'] };
    return calculerVolumeSurface(surface1, triangulation1, pointsDe(surface1), null);
  }

  const surface2 = surfaces.find((s) => s.id === calcul.surface2Id);
  if (!surface2) return { erreurs: ['choisis la surface 2'] };
  if (surface2.id === surface1.id) return { erreurs: ['choisis deux surfaces différentes'] };
  const triangles2 = triangulations.get(surface2.id)?.triangles ?? [];

  if (calcul.zone?.type === 'surface') {
    // Calcul limité au contour d'une surface (créée à partir de points).
    const surfaceZone = surfaces.find((s) => s.id === calcul.zone.surfaceId);
    const parNom = new Map((surfaceZone ? pointsDe(surfaceZone) : []).map((p) => [p.nom, p]));
    const contour = (surfaceZone?.contour ?? []).map((nom) => parNom.get(nom)).filter(Boolean);
    return comparerSurfaces(triangles2, triangulation1?.triangles ?? [], contour);
  }
  return calculerVolumeSurface(surface1, triangulation1, estImportee(surface1) ? [] : pointsDe(surface1), {
    nom: surface2.nom,
    triangles: triangles2,
  });
}

/**
 * Projets enregistrés avant la fusion des onglets Volumes et Comparer : transforme la base
 * de chaque surface (surface.volume) et les comparaisons en calculs.
 * - base 'contour' : une seule surface ; base 'surface' : surface 2 ; 'aucune' : pas de calcul
 * - comparaison : surface 1 = « après », surface 2 = « avant », même zone
 */
export function calculsDUnAncienProjet(surfaces, comparaisons = []) {
  const calculs = [];
  for (const surface of surfaces) {
    const base = surface.volume?.base ?? (estImportee(surface) ? 'aucune' : 'contour');
    if (base === 'aucune') continue;
    calculs.push({
      id: nouvelIdentifiant(),
      nom: '',
      surface1Id: surface.id,
      uneSeule: base === 'contour',
      surface2Id: base === 'surface' ? surface.volume.surfaceId : null,
      zone: { type: 'toute' },
    });
  }
  const id = (reference) => (reference?.startsWith('surface:') ? reference.slice('surface:'.length) : null);
  for (const comparaison of comparaisons) {
    calculs.push({
      id: comparaison.id ?? nouvelIdentifiant(),
      nom: comparaison.nom ?? '',
      surface1Id: id(comparaison.apres),
      uneSeule: false,
      surface2Id: id(comparaison.avant),
      zone: comparaison.zone ?? { type: 'toute' },
    });
  }
  return calculs;
}
