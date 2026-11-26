// Plans de chantier (0.296.0) : calques d'un plan affiché dessous (masquer, couleur, geler), réglés pour CE plan de chantier
// seulement (le plan du projet ne change pas). Rangé dans plan.fond.calques[idDuPlan][numéroDuCalque] = { visible, couleur, gele }.
// 0.335.0 : la fenêtre de gestion est remplacée par la pastille « Plan » (pastilles.js).

/** Plans du projet avec les réglages de calques du plan de chantier appliqués (copies stables : même objet tant que rien ne change). */
const memoire = new Map();
export function plansAvecCalques(plans, fond) {
  return plans.map((p) => {
    const reglages = fond?.calques?.[p.id];
    if (!reglages || !p.calques?.length) return p;
    const signature = JSON.stringify(reglages);
    const vu = memoire.get(p.id);
    if (vu && vu.origine === p && vu.signature === signature) return vu.copie;
    const copie = Object.assign(Object.create(p), { calques: p.calques.map((c, i) => ({ ...c, ...(reglages[i] ?? {}) })) }); // Object.create : garde ce qu'un plan recalé hérite
    memoire.set(p.id, { origine: p, signature, copie });
    return copie;
  });
}
