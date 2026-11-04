// Dossiers de projets (0.125.0, demande du 05.11) : « Maxime », « Germain »… pour ranger les projets.
//
// - Un seul niveau de dossiers ; un projet est dans un dossier ou « Sans dossier ».
// - La liste des dossiers ET le rangement de chaque projet sont dans les listes partagées (Drive,
//   voir reglages/listes-partagees.js) : tous les appareils voient le même classement, et ranger un
//   projet ne touche pas au projet lui-même (même s'il est ouvert sur un autre appareil).
//   Forme : dossiers = { liste: [{ id, nom }], projets: { idDuProjet: idDuDossier } }.
// - Créer, renommer, supprimer un dossier et ranger un projet : Expert. Un dossier qui contient
//   encore des projets ne peut pas être supprimé (choix de l'utilisateur).
// - Choisir le dossier d'un nouveau projet : dès Intermédiaire (qui peut créer un projet).
import { lireListesPartagees, ecrireListesPartagees } from '../reglages/listes-partagees.js';

export const SANS_DOSSIER = '';

/** Remet les dossiers en ordre : noms non vides, sans doublon de nom ; rangements vers des dossiers existants. */
export function nettoyerDossiers(dossiers) {
  const liste = [];
  const noms = new Set();
  for (const d of dossiers?.liste ?? []) {
    const nom = String(d?.nom ?? '').trim();
    const id = String(d?.id ?? '').trim();
    if (!nom || !id || noms.has(nom.toLowerCase()) || liste.some((x) => x.id === id)) continue;
    noms.add(nom.toLowerCase());
    liste.push({ id, nom });
  }
  const ids = new Set(liste.map((d) => d.id));
  const projets = {};
  for (const [projetId, dossierId] of Object.entries(dossiers?.projets ?? {})) {
    if (ids.has(dossierId)) projets[projetId] = dossierId;
  }
  return { liste, projets };
}

/** Les dossiers, triés par nom (A → Z). */
export function dossiersTries(dossiers) {
  return [...dossiers.liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' }));
}

/** Dossier d'un projet (son id), ou SANS_DOSSIER. */
export function dossierDuProjet(dossiers, projetId) {
  return dossiers.projets[projetId] ?? SANS_DOSSIER;
}

/**
 * Projets regroupés par dossier, dans l'ordre : les dossiers de A à Z (vides compris), puis
 * « Sans dossier » (seulement s'il contient des projets). L'ordre des projets reste celui reçu.
 * Renvoie [{ id (ou SANS_DOSSIER), nom, projets }].
 */
export function regrouperParDossier(projets, dossiers) {
  const groupes = dossiersTries(dossiers).map((d) => ({ id: d.id, nom: d.nom, projets: [] }));
  const parId = new Map(groupes.map((g) => [g.id, g]));
  const sans = { id: SANS_DOSSIER, nom: 'Sans dossier', projets: [] };
  for (const p of projets) (parId.get(dossierDuProjet(dossiers, p.id)) ?? sans).projets.push(p);
  return sans.projets.length > 0 ? [...groupes, sans] : groupes;
}

/** Ajoute un dossier : { dossiers, id } ou { erreur }. */
export function ajouterDossier(dossiers, nom, id = `dossier-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`) {
  const propre = String(nom ?? '').trim();
  if (!propre) return { erreur: 'Nom du dossier vide' };
  if (dossiers.liste.some((d) => d.nom.toLowerCase() === propre.toLowerCase())) return { erreur: `Le dossier « ${propre} » existe déjà` };
  return { dossiers: { ...dossiers, liste: [...dossiers.liste, { id, nom: propre }] }, id };
}

/** Renomme un dossier : { dossiers } ou { erreur }. */
export function renommerDossier(dossiers, id, nom) {
  const propre = String(nom ?? '').trim();
  if (!propre) return { erreur: 'Nom du dossier vide' };
  if (dossiers.liste.some((d) => d.id !== id && d.nom.toLowerCase() === propre.toLowerCase())) return { erreur: `Le dossier « ${propre} » existe déjà` };
  return { dossiers: { ...dossiers, liste: dossiers.liste.map((d) => (d.id === id ? { ...d, nom: propre } : d)) } };
}

/**
 * Supprime un dossier vide : { dossiers } ou { erreur } s'il contient encore des projets.
 * projetsExistants : ids des projets connus (appareil et Drive) ; un rangement d'un projet qui
 * n'existe plus nulle part ne bloque pas.
 */
export function supprimerDossier(dossiers, id, projetsExistants) {
  const existants = new Set(projetsExistants);
  const dedans = Object.entries(dossiers.projets).filter(([projetId, d]) => d === id && existants.has(projetId)).length;
  if (dedans > 0) return { erreur: `Ce dossier contient encore ${dedans} projet${dedans > 1 ? 's' : ''} : déplace-les d'abord` };
  const projets = Object.fromEntries(Object.entries(dossiers.projets).filter(([, d]) => d !== id));
  return { dossiers: { liste: dossiers.liste.filter((d) => d.id !== id), projets } };
}

/** Range un projet dans un dossier (ou SANS_DOSSIER). */
export function rangerProjet(dossiers, projetId, dossierId) {
  const projets = { ...dossiers.projets };
  if (dossierId && dossiers.liste.some((d) => d.id === dossierId)) projets[projetId] = dossierId;
  else delete projets[projetId];
  return { ...dossiers, projets };
}

// --- Lecture et écriture dans les listes partagées (cet appareil, puis Drive) ---

export function lireDossiers() {
  return nettoyerDossiers(lireListesPartagees().dossiers);
}

export function ecrireDossiers(dossiers) {
  ecrireListesPartagees({ ...lireListesPartagees(), dossiers: nettoyerDossiers(dossiers) });
}
