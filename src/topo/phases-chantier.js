// Plans de chantier (0.338.0, demande du 26.11) : gestion des phases dans une fenêtre (monter / descendre, dupliquer).
// Les phases sont dans plan.phases (ordre = ordre affiché). Ces fonctions changent le plan sur place.
import { nouvelId } from './plan-chantier.js';

/** Déplace la phase id d'un cran : sens = -1 (monter) ou 1 (descendre). Renvoie vrai si elle a bougé. */
export function deplacerPhase(plan, id, sens) {
  const i = plan.phases.findIndex((p) => p.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= plan.phases.length) return false;
  [plan.phases[i], plan.phases[j]] = [plan.phases[j], plan.phases[i]];
  return true;
}

/**
 * Duplique la phase id : nouvelle phase « nom (copie) » juste après, même couleur, et une copie de ses éléments
 * (nouveaux identifiants, rattachés à la copie). Renvoie la nouvelle phase, ou null si la phase n'existe pas.
 */
export function dupliquerPhase(plan, id) {
  const i = plan.phases.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const source = plan.phases[i];
  const copie = { ...JSON.parse(JSON.stringify(source)), id: nouvelId('ph'), nom: `${source.nom} (copie)` };
  plan.phases.splice(i + 1, 0, copie);
  const elements = plan.objets.filter((o) => o.phase === id).map((o) => ({ ...JSON.parse(JSON.stringify(o)), id: nouvelId('o'), phase: copie.id }));
  plan.objets.push(...elements);
  plan.phaseActive = copie.id;
  return copie;
}

/** Renomme la phase id (texte vide refusé : renvoie faux). */
export function renommerPhase(plan, id, nom) {
  const texte = String(nom ?? '').trim().slice(0, 60);
  const ph = plan.phases.find((p) => p.id === id);
  if (!ph || !texte) return false;
  ph.nom = texte;
  return true;
}
