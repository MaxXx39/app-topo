import { describe, it, expect } from 'vitest';
import { nouveauPlanChantier, ajouterPhase, ajouterObjet, retirerObjet } from '../src/topo/plan-chantier.js';
import { grouper, degrouper, reglerPhaseGroupe, harmoniserGroupes, regrouperCopies, membresDe, groupesDe } from '../src/topo/groupes-chantier.js';
import { dupliquerPhase } from '../src/topo/phases-chantier.js';

function planDeTest() {
  const plan = nouveauPlanChantier('Essai', 'pic', '2026-11-28');
  const p1 = plan.phases[0];
  const p2 = ajouterPhase(plan, 'B');
  const p3 = ajouterPhase(plan, 'C');
  plan.phaseActive = p1.id;
  const a = ajouterObjet(plan, { type: 'texte', point: [0, 0], texte: 'a' });
  const b = ajouterObjet(plan, { type: 'texte', point: [1, 1], texte: 'b', phase: p2.id });
  const c = ajouterObjet(plan, { type: 'texte', point: [2, 2], texte: 'c' });
  return { plan, p1, p2, p3, a, b, c };
}

describe('groupes d\'éléments (0.356.0)', () => {
  it('grouper : même phase pour tous (celle du premier), nom « Groupe 1 »', () => {
    const { plan, p1, a, b } = planDeTest();
    const g = grouper(plan, [a.id, b.id]);
    expect(g.nom).toBe('Groupe 1');
    expect(membresDe(plan, g.id).map((o) => o.phase)).toEqual([p1.id, p1.id]);
  });
  it('un seul élément ou des lignes de construction : pas de groupe', () => {
    const { plan, a } = planDeTest();
    const k = ajouterObjet(plan, { type: 'construction', points: [[0, 0], [1, 1]] });
    expect(grouper(plan, [a.id, k.id])).toBeNull();
  });
  it('changer la phase du groupe : tous suivent ; fin avant début refusée', () => {
    const { plan, p1, p2, p3, a, b } = planDeTest();
    const g = grouper(plan, [a.id, b.id]);
    reglerPhaseGroupe(plan, g.id, { phase: p2.id, fin: p3.id });
    expect([a.phase, b.phase, a.fin, b.fin]).toEqual([p2.id, p2.id, p3.id, p3.id]);
    reglerPhaseGroupe(plan, g.id, { fin: p1.id });
    expect(a.fin).toBeUndefined();
  });
  it('un objet est dans un seul groupe : le regrouper le sort de l\'ancien', () => {
    const { plan, a, b, c } = planDeTest();
    const g1 = grouper(plan, [a.id, b.id]);
    grouper(plan, [b.id, c.id]);
    expect(groupesDe(plan).some((g) => g.id === g1.id)).toBe(false); // il ne restait que a : groupe retiré
    expect(a.groupe).toBeUndefined();
  });
  it('effacer jusqu\'à un seul objet : le groupe disparaît ; dégrouper garde les objets', () => {
    const { plan, a, b, c } = planDeTest();
    const g = grouper(plan, [a.id, b.id, c.id]);
    retirerObjet(plan, c.id);
    harmoniserGroupes(plan);
    expect(groupesDe(plan)).toHaveLength(1);
    degrouper(plan, g.id);
    expect(groupesDe(plan)).toHaveLength(0);
    expect(plan.objets.filter((o) => o.groupe)).toHaveLength(0);
  });
  it('copies (coller, dupliquer une phase) : nouveau groupe, jamais l\'original', () => {
    const { plan, p1, a, b } = planDeTest();
    const g = grouper(plan, [a.id, b.id]);
    const copies = [a, b].map((o) => ajouterObjet(plan, { ...JSON.parse(JSON.stringify(o)), id: undefined }));
    regrouperCopies(plan, copies);
    expect(copies[0].groupe).not.toBe(g.id);
    expect(copies[0].groupe).toBe(copies[1].groupe);
    expect(membresDe(plan, g.id)).toHaveLength(2);
    dupliquerPhase(plan, p1.id);
    expect(groupesDe(plan)).toHaveLength(4);
  });
});
