// Calculs de volume du projet (onglet Calculs › Volumes). Deux sortes de volumes :
// - « Stock seul » : le volume d'un stock par rapport à sa base, au choix
//   la ligne du contour (les points du pied) ou un plan horizontal à une altitude ;
// - « Comparaison de 2 surfaces » : une surface de référence (la première choisie : terrain
//   naturel, état « avant »...) et une surface comparée (terrassement, état « après »...).
// Remblai : là où la surface 1 (le stock, ou la surface comparée) est au-dessus de la base ;
// déblai : là où elle est au-dessous.
//
// Un calcul a la forme :
// {
//   id,
//   nom,           // '' : on affiche nomAutomatique (le nom du stock)
//   surface1Id,    // le stock, ou la surface comparée (dessus, après)
//   uneSeule,      // vrai : stock seul ; faux : comparaison ; null : pas encore choisi
//   base,          // stock seul : 'contour' (ligne du contour) ou 'altitude'
//   altitude,      // stock seul depuis une altitude : altitude du plan de base (m)
//   surface2Id,    // comparaison : la surface de référence (dessous, avant), ou null
//   zone,          // { type: 'toute' } ; les anciens projets peuvent avoir
//                  // { type: 'surface', surfaceId } : calcul limité au contour de cette surface
//   auto,          // vrai : créé par l'appli (voir calculsAutomatiques), pas encore modifié à la main
// }
// Unités : m, m², m³.
import { nouvelIdentifiant, estImportee, nomNature, NATURES } from '../topo/surface.js';
import { calculerVolumeSurface } from '../topo/volume.js';
import { comparerSurfaces } from '../topo/comparaison.js';
import { formaterNombre } from '../topo/format.js';

/** Nouveau volume vide (bouton « + Ajouter un volume ») : on choisit d'abord stock seul ou comparaison. */
export function nouveauVolume() {
  return { id: nouvelIdentifiant(), nom: '', surface1Id: null, uneSeule: null, base: 'contour', altitude: null, surface2Id: null, zone: { type: 'toute' } };
}

/**
 * Crée un calcul prérempli d'après la nature de la surface 1 :
 * - un stock (créé à partir de points) : stock seul, volume sur la ligne de son contour ;
 * - sinon : comparé au dernier terrain naturel du projet (s'il y en a un).
 */
export function creerCalcul(surface1, surfaces) {
  const calcul = nouveauVolume();
  if (surface1) preremplir(calcul, surface1, surfaces);
  return calcul;
}

/**
 * Choisit la sorte d'un volume : 'stock' (stock seul) ou 'comparaison' (2 surfaces).
 * - stock seul : le premier stock du projet est proposé, le nom suit celui du stock ;
 * - comparaison : nom « Volume 1, 2... », la référence proposée est le dernier terrain naturel.
 */
export function choisirSorte(calcul, sorte, surfaces, calculs) {
  if (sorte === 'stock') {
    calcul.uneSeule = true;
    calcul.surface2Id = null;
    if (!surfaces.some((s) => s.id === calcul.surface1Id && s.nature === 'stock')) {
      calcul.surface1Id = surfaces.find((s) => s.nature === 'stock')?.id ?? null;
    }
    const stock = surfaces.find((s) => s.id === calcul.surface1Id);
    calcul.base = stock && estImportee(stock) ? 'altitude' : (calcul.base ?? 'contour');
    if (/^Volume \d+$/.test(calcul.nom)) calcul.nom = '';
  } else {
    calcul.uneSeule = false;
    calcul.zone = { type: 'toute' };
    calcul.surface2Id ??= surfaces.filter((s) => s.nature === 'terrain' && s.id !== calcul.surface1Id).at(-1)?.id ?? null;
    if (!calcul.nom) calcul.nom = nomDeVolumeLibre(calculs);
  }
}

/** Premier nom « Volume N » qui n'est pas déjà pris. */
export function nomDeVolumeLibre(calculs) {
  const pris = new Set(calculs.map((c) => c.nom));
  let numero = 1;
  while (pris.has(`Volume ${numero}`)) numero++;
  return `Volume ${numero}`;
}

/** Remplit la surface 1 d'un calcul, et la base qui lui convient (voir creerCalcul). */
export function preremplir(calcul, surface1, surfaces) {
  calcul.surface1Id = surface1.id;
  calcul.uneSeule = surface1.nature === 'stock' && !estImportee(surface1);
  calcul.base = 'contour';
  const terrains = surfaces.filter((s) => s.nature === 'terrain' && s.id !== surface1.id);
  calcul.surface2Id = calcul.uneSeule ? null : (terrains.at(-1)?.id ?? null);
  calcul.zone = { type: 'toute' };
}

/**
 * Calculs créés par l'appli pour une surface, d'après sa nature, quand on la choisit ou qu'elle
 * change : un stock créé à partir de points reçoit son volume « stock seul » sur la ligne de son
 * contour ; les autres surfaces aucun (les comparaisons s'ajoutent à la main).
 * Les calculs déjà modifiés à la main ne sont jamais touchés.
 * Les calculs automatiques qui n'ont pas encore de surface de référence reçoivent le dernier terrain naturel.
 * Renvoie la nouvelle liste des calculs.
 */
export function calculsAutomatiques(calculs, surfaces, surface) {
  const resultat = calculs.filter((c) => !(c.auto && c.surface1Id === surface.id));
  if (surface.nature === 'stock' && !estImportee(surface)) {
    resultat.push({ ...creerCalcul(surface, surfaces), auto: true });
  }
  for (const calcul of resultat) {
    const surface1 = surfaces.find((s) => s.id === calcul.surface1Id);
    if (calcul.auto && !calcul.uneSeule && !calcul.surface2Id && surface1) preremplir(calcul, surface1, surfaces);
  }
  return resultat;
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
 * remblai, deblai } (m², m³) quand le groupe a au moins deux lignes, sinon null (null aussi
 * quand deux lignes portent sur la même surface : leur somme n'aurait pas de sens).
 */
export function grouperParNature(lignes) {
  const ordre = [...NATURES.map(([cle]) => cle), null];
  const natureConnue = (nature) => (ordre.includes(nature) ? nature : null);
  return ordre
    .map((nature) => {
      const groupe = lignes.filter((ligne) => natureConnue(ligne.nature) === nature);
      const somme = (cle) => groupe.reduce((total, { resultat }) => total + resultat[cle], 0);
      // Deux volumes du même stock (ex. depuis le contour et depuis une altitude) : pas de total.
      const ids = groupe.map((ligne) => ligne.calcul?.surface1Id ?? ligne.stock?.id).filter(Boolean);
      const memeSurface = new Set(ids).size < ids.length;
      const total =
        groupe.length >= 2 && !memeSurface
          ? { titre: TITRES_TOTAUX[nature] ?? 'Total', surfacePlan: somme('surfacePlan'), remblai: somme('remblai'), deblai: somme('deblai') }
          : null;
      return { nature, lignes: groupe, total };
    })
    .filter((groupe) => groupe.lignes.length > 0);
}

/**
 * Phrase qui décrit un calcul (pour le PDF) :
 * « Stock 1 » (stock) sur sa ligne basse ;
 * « Stock 1 » (stock) au-dessus de l'altitude 425.000 m ;
 * « Terrassement 1 » (terrassement) par rapport à « TN » (terrain naturel), dans le contour de « Stock 1 ».
 */
export function descriptionCalcul(calcul, surfaces) {
  const decrire = (id) => {
    const surface = surfaces.find((s) => s.id === id);
    if (!surface) return '?';
    const nature = nomNature(surface.nature);
    return `« ${surface.nom} »${nature ? ` (${nature.toLowerCase()})` : ''}`;
  };
  if (calcul.uneSeule && calcul.base === 'altitude') {
    return `${decrire(calcul.surface1Id)} au-dessus de l'altitude ${(Number.isFinite(calcul.altitude) ? formaterNombre(calcul.altitude) : '?')} m`;
  }
  if (calcul.uneSeule) return `${decrire(calcul.surface1Id)} sur sa ligne basse`;
  let texte = `${decrire(calcul.surface1Id)} par rapport à ${decrire(calcul.surface2Id)}`;
  if (calcul.zone?.type === 'surface') {
    texte += `, dans le contour de « ${surfaces.find((s) => s.id === calcul.zone.surfaceId)?.nom ?? '?'} »`;
  }
  return texte;
}

/**
 * Après la suppression d'une surface : retire les calculs dont la surface 1 n'existe plus,
 * et vide les choix (surface de référence, zone) qui désignent une surface disparue.
 * Un volume dont la surface 1 n'est pas encore choisie reste.
 */
export function nettoyerCalculs(calculs, surfaces) {
  const existe = (id) => surfaces.some((s) => s.id === id);
  const restants = calculs.filter((c) => !c.surface1Id || existe(c.surface1Id));
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
  if (calcul.uneSeule === null || calcul.uneSeule === undefined) return { erreurs: ['choisis : stock seul ou comparaison de 2 surfaces'] };
  const surface1 = surfaces.find((s) => s.id === calcul.surface1Id);
  if (!surface1) return { erreurs: [calcul.uneSeule ? 'choisis le stock' : 'choisis la surface comparée'] };
  const triangulation1 = triangulations.get(surface1.id);
  if (calcul.uneSeule) {
    const points1 = estImportee(surface1) ? [] : pointsDe(surface1);
    if (calcul.base === 'altitude') {
      return calculerVolumeSurface(surface1, triangulation1, points1, { altitude: calcul.altitude ?? NaN });
    }
    if (estImportee(surface1)) return { erreurs: ['une surface importée n\'a pas de ligne de contour : choisis « depuis une altitude »'] };
    return calculerVolumeSurface(surface1, triangulation1, points1, null);
  }

  const surface2 = surfaces.find((s) => s.id === calcul.surface2Id);
  if (!surface2) return { erreurs: ['choisis la surface de référence'] };
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
