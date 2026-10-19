// Projets : tout ce que l'utilisateur fait est rangé dans un projet, enregistré sur l'appareil.
//
// Un projet a la forme :
// {
//   format: 'topo-projet', version: 1,
//   id, nom, creeLe, modifieLe (dates ISO),
//   leves: [{ id, nom, importeLe, points: [{ nom, est, nord, altitude }], stocks: [...] }],
//   leveActifId,                    // levé affiché
//   surfaces: [...],                // voir topo/surface.js
//   comparaisons: [{ id, nom, avantId, apresId, zone }],
//                                   // zone : { type: 'toute' } ou { type: 'stock', leveId, stockNom }
//   cartouche: { affaire, dessinePar },
// }
// Les stocks appartiennent à un levé : leurs noms de points renvoient aux points de ce levé.
import { nouvelIdentifiant } from '../topo/surface.js';

export const FORMAT = 'topo-projet';
export const VERSION = 1;

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
    comparaisons: [],
    cartouche: { affaire: '', dessinePar: '' },
  };
}

/** Ajoute un levé (un fichier de points) au projet et le rend actif. Renvoie le levé. */
export function ajouterLeve(projet, nomFichier, points) {
  const leve = { id: nouvelIdentifiant(), nom: nomFichier, importeLe: new Date().toISOString(), points, stocks: [] };
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

/** Ajoute les champs manquants avec leur valeur par défaut. */
export function completerProjet(projet) {
  const vide = creerProjet(projet.nom ?? 'Projet');
  const complet = { ...vide, ...projet, cartouche: { ...vide.cartouche, ...projet.cartouche } };
  complet.leves = (complet.leves ?? []).map((leve) => ({ stocks: [], ...leve }));
  complet.surfaces ??= [];
  complet.comparaisons ??= [];
  return complet;
}

/** Résumé d'un projet pour la liste des projets. */
export function resumerProjet(projet) {
  return {
    id: projet.id,
    nom: projet.nom,
    modifieLe: projet.modifieLe,
    nombreLeves: projet.leves.length,
    nombreStocks: projet.leves.reduce((n, l) => n + l.stocks.length, 0),
    nombreSurfaces: projet.surfaces.length,
  };
}
