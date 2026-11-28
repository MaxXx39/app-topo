// Plans de chantier (0.356.0, demande du 28.11) : groupes d'objets (Expert).
// plan.groupes = [{ id, nom, phase, fin? }] ; un objet groupé a `groupe: id`. Règles validées par l'utilisateur :
//  - un objet est dans un seul groupe (pas de groupe dans un groupe) ;
//  - tout ce qui est dans un groupe a la même phase de début et de fin : celles du groupe.
// Ces fonctions changent le plan sur place.
import { nouvelId } from './plan-chantier.js';

/** Groupes du plan (jamais undefined). */
export const groupesDe = (plan) => (Array.isArray(plan?.groupes) ? plan.groupes : []);

/** Groupe d'un id, ou null. */
export const groupeDe = (plan, id) => groupesDe(plan).find((g) => g.id === id) ?? null;

/** Objets d'un groupe. */
export const membresDe = (plan, id) => (id ? plan.objets.filter((o) => o.groupe === id) : []);

/** Nom libre « Groupe n » (le premier numéro non pris). */
function nomLibre(plan) {
  const pris = new Set(groupesDe(plan).map((g) => g.nom));
  let i = 1;
  while (pris.has(`Groupe ${i}`)) i++;
  return `Groupe ${i}`;
}

/**
 * Groupe les objets `ids` (au moins 2, lignes de construction exclues). Un objet déjà groupé quitte son ancien groupe.
 * Phase de début / fin du groupe = celles du premier objet. Renvoie le groupe, ou null s'il n'y a pas assez d'objets.
 */
export function grouper(plan, ids, nom) {
  const objets = ids.map((id) => plan.objets.find((o) => o.id === id)).filter((o) => o && o.type !== 'construction');
  if (objets.length < 2) return null;
  const g = { id: nouvelId('gr'), nom: String(nom ?? '').trim().slice(0, 60) || nomLibre(plan), phase: objets[0].phase, ...(objets[0].fin ? { fin: objets[0].fin } : {}) };
  plan.groupes = [...groupesDe(plan), g];
  for (const o of objets) o.groupe = g.id;
  harmoniserGroupes(plan);
  return g;
}

/** Défait un groupe : ses objets restent, sans groupe. */
export function degrouper(plan, id) {
  for (const o of plan.objets) if (o.groupe === id) delete o.groupe;
  plan.groupes = groupesDe(plan).filter((g) => g.id !== id);
}

/** Change la phase de début et / ou de fin d'un groupe (fin = '' : sans fin) ; tous ses objets suivent. */
export function reglerPhaseGroupe(plan, id, { phase, fin } = {}) {
  const g = groupeDe(plan, id);
  if (!g) return false;
  if (phase) g.phase = phase;
  if (fin !== undefined) { if (fin) g.fin = fin; else delete g.fin; }
  // la fin ne peut pas être avant le début
  const rang = (x) => plan.phases.findIndex((p) => p.id === x);
  if (g.fin && rang(g.fin) < rang(g.phase)) delete g.fin;
  harmoniserGroupes(plan);
  return true;
}

/**
 * À chaque enregistrement : retire les groupes vides ou d'un seul objet, les groupes dont la phase n'existe plus prennent
 * la phase de leur premier objet, et chaque objet groupé reprend la phase de début / fin de son groupe.
 */
export function harmoniserGroupes(plan) {
  if (!groupesDe(plan).length) {
    for (const o of plan.objets) delete o.groupe;
    return;
  }
  const phases = new Set(plan.phases.map((p) => p.id));
  plan.groupes = groupesDe(plan).filter((g) => membresDe(plan, g.id).length >= 2);
  const ids = new Set(plan.groupes.map((g) => g.id));
  for (const o of plan.objets) if (o.groupe && !ids.has(o.groupe)) delete o.groupe;
  for (const g of plan.groupes) {
    const membres = membresDe(plan, g.id);
    if (!phases.has(g.phase)) g.phase = membres[0].phase;
    if (g.fin && !phases.has(g.fin)) delete g.fin;
    const rang = (x) => plan.phases.findIndex((p) => p.id === x);
    if (g.fin && rang(g.fin) < rang(g.phase)) delete g.fin;
    for (const o of membres) {
      o.phase = g.phase;
      if (g.fin) o.fin = g.fin; else delete o.fin;
    }
  }
}

/**
 * Copies d'objets groupés (coller, dupliquer une phase) : chaque groupe d'origine devient un nouveau groupe « … (copie) »
 * pour les copies, qui ne rejoignent jamais le groupe d'origine. À appeler après avoir ajouté les copies au plan.
 */
export function regrouperCopies(plan, copies) {
  const nouveaux = new Map();
  for (const o of copies) {
    if (!o.groupe) continue;
    if (!nouveaux.has(o.groupe)) {
      const source = groupeDe(plan, o.groupe);
      const g = { id: nouvelId('gr'), nom: `${source?.nom ?? 'Groupe'} (copie)`.slice(0, 60), phase: o.phase, ...(o.fin ? { fin: o.fin } : {}) };
      plan.groupes = [...groupesDe(plan), g];
      nouveaux.set(o.groupe, g.id);
    }
    o.groupe = nouveaux.get(o.groupe);
  }
  harmoniserGroupes(plan);
}
