// Projets : tout ce que l'utilisateur fait est rangé dans un projet, enregistré sur l'appareil.
//
// Un projet a la forme :
// {
//   format: 'topo-projet', version: 1,
//   id, nom (facultatif), creeLe, modifieLe (dates ISO),
//   leves: [{ id, nom, importeLe, points: [{ nom, est, nord, altitude }] }],
//   leveActifId,                    // levé affiché
//   surfaces: [...],                // stocks, terrassements, terrains... : voir topo/surface.js
//   calculs: [...],                 // calculs de volume (onglet Calculs › Volumes) : voir volumes/calculs.js
//   coupes: [{ id, nom ('A', 'B'), debut, fin, exageration (1 ou 2), dansPdf }],  // 2 au maximum
//                                   // debut, fin : { est, nord } (m, MN95)
//   mesures: [...],                 // longueurs et aires (onglet Calculs › Mesures) : voir topo/mesure.js
//   cartouche: { affaire, lieu, dessinePar, date },   // affaire et lieu : infos du projet (onglet Projet) ;
//                                   // dessinePar, date : anciens champs (réglés maintenant au moment du PDF)
//   plansDxf: [{ id, nom, importeLe, origine, bornes, calques, contenu, compte }],  // fonds de plan DXF
//                                   // (voir topo/dxf-plan.js) : affichés sous le levé, pour l'implantation
//   aImplanter: [{ id, nom, est, nord, altitude (ou null) }],   // points à implanter (Terrain › Implanter › Point)
//   talus: [{ id, nom, ligne: { nom, sommets, segment, inverse, altitudes: { debut, fin } },
//            reglages: { horizontal, vertical, ligneEst ('haut', 'bas'), cote ('droite', 'gauche'),
//                        longueur (m ou null), terrainId, altitudeSurfaceId } }],  // « Mes talus » (voir topo/talus.js)
//   metres: [{ id, nom, nature: 'metre', leveId, enCours }],   // métrés levés (voir topo/metre.js)
//   autres: [{ id, nom, nature: 'autres', leveId, contour: [], lignesRupture, points }],  // levés « Autres »
//                                   // (contrôle, points géomètre… : lignes et points, pas de surface ni de volume)
//   implantations: [{ id, nom, cible: { est, nord, altitude }, mesure: { est, nord, altitude, gnss },
//                     ecarts: { dEst, dNord, distance, dAltitude }, le (date ISO) }],  // implantations enregistrées
//   pointsControle: [{ id, nom, est, nord, altitude (ou null) }],  // points de contrôle (Terrain › Contrôle)
//   tolerancesControle: { plan: { vert, orange }, hauteur: { vert, orange } },  // m (voir topo/controle.js)
//   controles: [{ id, type: 'mesure', pointId, nom, connu, mesure, ecarts, resultat, gnss, appareil, remarque, le }
//               ou { id, type: 'refus', appareil, le }],  // autocontrôles et refus du rappel
//   dessins: [{ id, nom, numero, type ('dessin' depuis 0.66.0 ; avant : 'plateforme', 'batiment', 'ligne',
//              'points'), ferme (type 'dessin' : « Fermer la figure »), sommets: [{ est, nord, altitude }],
//              hauteur: { mode ('fixe', 'sommets'), altitude, pente: { pourcent, cote, depuis } ou null } }],
//                                   // Calculs › Dessin (voir topo/dessin.js)
// }
// Une surface créée à partir de points appartient à un levé : ses noms de points renvoient
// aux points de ce levé. De même pour une mesure.
import { nouvelIdentifiant, estImportee, avecPrefixe, prefixeDuNom } from '../topo/surface.js';
import { calculsDUnAncienProjet } from '../volumes/calculs.js';
import { TOLERANCES_PAR_DEFAUT } from '../topo/controle.js';

export const FORMAT = 'topo-projet';
// Version 2 : calculs de volume (onglets Volumes et Comparer réunis) et nature des surfaces.
export const VERSION = 2;

/** Crée un projet vide (le nom est facultatif : le projet se reconnaît à son affaire et son lieu). */
export function creerProjet(nom = '') {
  const maintenant = new Date().toISOString();
  return {
    format: FORMAT,
    version: VERSION,
    id: nouvelIdentifiant(),
    nom,
    creeLe: maintenant,
    modifieLe: maintenant,
    leves: [],
    leveActifId: null,
    surfaces: [],
    calculs: [],
    coupes: [],
    mesures: [],
    cartouche: { affaire: '', lieu: '', dessinePar: '', date: '' },
    plansDxf: [],
    aImplanter: [],
    talus: [],
    implantations: [],
    metres: [],
    autres: [],
    listesCachees: [],
    pointsControle: [],
    tolerancesControle: structuredClone(TOLERANCES_PAR_DEFAUT),
    controles: [],
    dessins: [],
    couleursListes: {},
  };
}

/** Ajoute un levé (un fichier de points) au projet et le rend actif. Renvoie le levé. */
export function ajouterLeve(projet, nomFichier, points) {
  const leve = { id: nouvelIdentifiant(), nom: nomFichier, importeLe: new Date().toISOString(), points };
  projet.leves.push(leve);
  projet.leveActifId = leve.id;
  return leve;
}

/**
 * Titre du projet, en haut de l'appli et dans les listes : « Affaire - Désignation » (« 10 203 - Gland »),
 * sinon son nom, sinon « Projet sans nom ».
 */
export function titreProjet(projet) {
  const affaireLieu = [projet.cartouche?.affaire, projet.cartouche?.lieu].map((t) => (t ?? '').trim()).filter(Boolean).join(' - ');
  return affaireLieu || (projet.nom ?? '').trim() || projet.nomAuto || 'Projet sans nom';
}

/**
 * Nom donné à un nouveau projet tant qu'il n'a ni affaire, ni lieu, ni nom : « Projet sans nom »,
 * puis « Projet sans nom 2 », « Projet sans nom 3 »… (jamais deux fois le même, demande du 24.10.2026).
 * titres : titres des projets existants (appareil et Drive).
 */
export function nomAutomatique(titres) {
  let plusGrand = 0;
  for (const titre of titres) {
    const trouve = /^Projet sans nom(?: (\d+))?$/.exec(String(titre ?? '').trim());
    if (trouve) plusGrand = Math.max(plusGrand, Number(trouve[1] ?? 1));
  }
  return plusGrand === 0 ? 'Projet sans nom' : `Projet sans nom ${plusGrand + 1}`;
}

/** Nom du projet, à écrire sous le titre (seulement s'il n'est pas déjà le titre), ou ''. */
export function sousTitreProjet(projet) {
  const nom = (projet.nom ?? '').trim();
  return nom && nom !== titreProjet(projet) ? nom : '';
}

/** Début des noms de fichiers exportés : le titre du projet, sans caractères spéciaux. */
export function nomDeFichierProjet(projet) {
  return titreProjet(projet).replace(/[^\w-]+/g, '_') || 'projet';
}

/** Levé affiché (ou null). */
export function leveActif(projet) {
  return projet.leves.find((l) => l.id === projet.leveActifId) ?? projet.leves[0] ?? null;
}

/** Copie complète d'un projet, avec un nouvel identifiant et un nouveau nom. */
export function dupliquerProjet(projet, nom) {
  const copie = structuredClone(projet);
  copie.id = nouvelIdentifiant();
  copie.nom = nom;
  copie.creeLe = copie.modifieLe = new Date().toISOString();
  return copie;
}

/** Texte du fichier projet (.topo.json) à enregistrer ou à envoyer. */
export function ecrireFichierProjet(projet) {
  return JSON.stringify(projet);
}

/**
 * Lit un fichier projet. Renvoie { projet } ou { erreur } (message compréhensible).
 * Les champs manquants (fichiers d'une version plus ancienne) sont complétés.
 */
export function lireFichierProjet(texte) {
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch {
    return { erreur: 'ce fichier n\'est pas un fichier projet (contenu illisible)' };
  }
  if (donnees?.format !== FORMAT) return { erreur: 'ce fichier n\'est pas un fichier projet Topo' };
  if (donnees.version > VERSION) {
    return { erreur: 'ce projet vient d\'une version plus récente de l\'appli : mets l\'appli à jour' };
  }
  return { projet: completerProjet(donnees) };
}

/**
 * Ajoute les champs manquants avec leur valeur par défaut. Un projet de la version 1 est
 * transformé : la base de chaque surface et les comparaisons deviennent des calculs de volume.
 */
export function completerProjet(projet) {
  const vide = creerProjet(projet.nom ?? '');
  const complet = { ...vide, ...projet, version: VERSION, cartouche: { ...vide.cartouche, ...projet.cartouche } };
  complet.leves ??= [];
  complet.plansDxf ??= [];
  complet.aImplanter ??= [];
  complet.talus ??= [];
  complet.implantations ??= [];
  complet.metres ??= [];
  complet.autres ??= [];
  complet.listesCachees ??= []; // listes de points décochées dans le menu « Points » du plan
  complet.pointsControle ??= [];
  complet.tolerancesControle ??= structuredClone(TOLERANCES_PAR_DEFAUT);
  complet.controles ??= [];
  complet.dessins ??= [];
  complet.couleursListes ??= {}; // couleur choisie par liste de points (id → « #2563eb »)
  // Surfaces importées : plus de nature depuis 0.90.0 (celle des anciennes est retirée).
  complet.surfaces = (complet.surfaces ?? []).map((surface) => {
    if (!estImportee(surface)) return { nature: 'stock', ...surface };
    const { nature, ...sansNature } = surface;
    return sansNature;
  });
  if (!Array.isArray(projet.calculs)) complet.calculs = calculsDUnAncienProjet(complet.surfaces, projet.comparaisons);
  // Calculs d'avant le choix de la base « depuis une altitude » : base sur la ligne du contour.
  complet.calculs = complet.calculs.map((calcul) => ({ base: 'contour', altitude: null, ...calcul }));
  // Anciens champs, remplacés par les calculs.
  delete complet.comparaisons;
  for (const surface of complet.surfaces) delete surface.volume;
  prefixerNoms(complet);
  return complet;
}

/**
 * Noms des levés et des surfaces avec leur préfixe (0.90.0) : « LV- » (levé) ou « Surf- » (surface
 * importée ou de Dessin), ajouté s'il manque (anciens projets, nom changé à la main). La liste de
 * points propre à un levé prend le même nom.
 */
export function prefixerNoms(projet) {
  for (const objet of [...projet.surfaces, ...(projet.metres ?? []), ...(projet.autres ?? [])]) {
    const nom = avecPrefixe(objet.nom, prefixeDuNom(objet));
    if (nom === objet.nom) continue;
    const liste = objet.leveId ? projet.leves.find((l) => l.id === objet.leveId) : null;
    if (liste?.dediee && liste.nom === objet.nom) liste.nom = nom;
    objet.nom = nom;
  }
}

/** Résumé d'un projet pour la liste des projets. */
export function resumerProjet(projet) {
  return {
    id: projet.id,
    nom: projet.nom,
    titre: titreProjet(projet),
    sousTitre: sousTitreProjet(projet),
    modifieLe: projet.modifieLe,
    nombreLeves: projet.leves.length,
    nombreSurfaces: projet.surfaces.length,
  };
}
