// Présentations d'un plan de chantier (0.330.0, demande du 26.11) : une « présentation » = les réglages de la feuille (format,
// orientation, cadrage, légende, situation, cartouche, plans dessous, pages…) ET l'échelle d'impression, gardés sous un nom pour
// y revenir, la dupliquer, la modifier. Rangées dans le plan : `plan.presentations` [{ id, nom, feuille, echelle }] et
// `plan.presentationActive` (id, ou absent = réglages libres). Décision de l'utilisateur : la présentation choisie se met à jour
// TOUTE SEULE à chaque modification (voir synchroniserPresentation) ; « Dupliquer » sert à garder une version avant de changer.

const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const nouvelId = () => `pr-${Math.random().toString(36).slice(2, 8)}`;

/** Liste des présentations du plan (jamais undefined). */
export const presentationsDe = (plan) => (Array.isArray(plan?.presentations) ? plan.presentations : []);

/** Présentation choisie, ou null. */
export const presentationActive = (plan) => presentationsDe(plan).find((p) => p.id === plan?.presentationActive) ?? null;

/** Nom libre : si « nom » existe déjà, on ajoute « (2) », « (3)… ». */
export function nomLibre(plan, nom, sauf = null) {
  const base = String(nom ?? '').trim().slice(0, 60) || 'Présentation';
  const pris = new Set(presentationsDe(plan).filter((p) => p.id !== sauf).map((p) => p.nom.toLowerCase()));
  let n = base;
  for (let i = 2; pris.has(n.toLowerCase()); i++) n = `${base} (${i})`;
  return n;
}

/** Enregistre les réglages actuels sous un nouveau nom et la choisit. Renvoie la présentation. */
export function creerPresentation(plan, nom) {
  const p = { id: nouvelId(), nom: nomLibre(plan, nom), feuille: copie(plan.feuille ?? {}), echelle: plan.echelle };
  plan.presentations = [...presentationsDe(plan), p];
  plan.presentationActive = p.id;
  return p;
}

/** Ouvre une présentation : ses réglages et son échelle remplacent ceux du plan. */
export function appliquerPresentation(plan, id) {
  const p = presentationsDe(plan).find((x) => x.id === id);
  if (!p) return null;
  plan.feuille = copie(p.feuille ?? {});
  if (p.echelle) plan.echelle = p.echelle;
  plan.presentationActive = p.id;
  return p;
}

/** Ne plus suivre de présentation (les réglages actuels restent, mais plus rien n'est mis à jour). */
export function quitterPresentation(plan) {
  delete plan.presentationActive;
}

/**
 * À appeler à chaque enregistrement du plan : la présentation choisie reprend les réglages actuels de la feuille et l'échelle
 * (mise à jour « toute seule »). Renvoie vrai si quelque chose a changé.
 */
export function synchroniserPresentation(plan) {
  const p = presentationActive(plan);
  if (!p) return false;
  const feuille = copie(plan.feuille ?? {});
  if (JSON.stringify(p.feuille) === JSON.stringify(feuille) && p.echelle === plan.echelle) return false;
  p.feuille = feuille;
  p.echelle = plan.echelle;
  return true;
}

/** Copie de la présentation choisie (« … (copie) »), qui devient la choisie. */
export function dupliquerPresentation(plan, id = plan.presentationActive) {
  const source = presentationsDe(plan).find((x) => x.id === id);
  if (!source) return null;
  const p = { ...copie(source), id: nouvelId(), nom: nomLibre(plan, `${source.nom} (copie)`) };
  plan.presentations = [...presentationsDe(plan), p];
  plan.presentationActive = p.id;
  plan.feuille = copie(p.feuille);
  return p;
}

export function renommerPresentation(plan, id, nom) {
  const p = presentationsDe(plan).find((x) => x.id === id);
  if (!p) return null;
  p.nom = nomLibre(plan, nom, id);
  return p;
}

/** Supprime une présentation. Les réglages du plan restent comme ils sont. */
export function supprimerPresentation(plan, id) {
  plan.presentations = presentationsDe(plan).filter((x) => x.id !== id);
  if (plan.presentationActive === id) delete plan.presentationActive;
}
