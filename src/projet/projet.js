// Projets : tout ce que l'utilisateur fait est rangé dans un projet, enregistré sur l'appareil.
//
// Un projet a la forme :
// {
//   format: 'topo-projet', version: 1,
//   id, nom, creeLe, modifieLe (dates ISO),
//   leves: [{ id, nom, importeLe, points: [{ nom, est, nord, altitude }] }],
//   leveActifId,                    // levé affiché
//   surfaces: [...],                // stocks, terrassements, terrains... : voir topo/surface.js
//   calculs: [...],                 // calculs de volume (onglet 3. Volumes) : voir volumes/calculs.js
//   cartouche: { affaire, dessinePar, date },   // date : 'AAAA-MM-JJ', ou '' pour la date du jour
// }
// Une surface créée à partir de points appartient à un levé : ses noms de points renvoient
// aux points de ce levé.
import { nouvelIdentifiant, estImportee } from '../topo/surface.js';
import { calculsDUnAncienProjet } from '../volumes/calculs.js';

export const FORMAT = 'topo-projet';
// Version 2 : calculs de volume (onglets Volumes et Comparer réunis) et nature des surfaces.
export const VERSION = 2;

/** Crée un projet vide. */
export function creerProjet(nom) {
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
    cartouche: { affaire: '', dessinePar: '', date: '' },
  };
}

/** Ajoute un levé (un fichier de points) au projet et le rend actif. Renvoie le levé. */
export function ajouterLeve(projet, nomFichier, points) {
  const leve = { id: nouvelIdentifiant(), nom: nomFichier, importeLe: new Date().toISOString(), points };
  projet.leves.push(leve);
  projet.leveActifId = leve.id;
  return leve;
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
  const vide = creerProjet(projet.nom ?? 'Projet');
  const complet = { ...vide, ...projet, version: VERSION, cartouche: { ...vide.cartouche, ...projet.cartouche } };
  complet.leves ??= [];
  complet.surfaces = (complet.surfaces ?? []).map((surface) => ({
    nature: estImportee(surface) ? 'terrain' : 'stock',
    ...surface,
  }));
  if (!Array.isArray(projet.calculs)) complet.calculs = calculsDUnAncienProjet(complet.surfaces, projet.comparaisons);
  // Anciens champs, remplacés par les calculs.
  delete complet.comparaisons;
  for (const surface of complet.surfaces) delete surface.volume;
  return complet;
}

/** Résumé d'un projet pour la liste des projets. */
export function resumerProjet(projet) {
  return {
    id: projet.id,
    nom: projet.nom,
    modifieLe: projet.modifieLe,
    nombreLeves: projet.leves.length,
    nombreSurfaces: projet.surfaces.length,
  };
}
