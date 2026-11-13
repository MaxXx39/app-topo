import { describe, it, expect } from 'vitest';
import { calqueSousLeDoigt, appliquerGelIsolement, reafficherTousLesCalques } from '../src/topo/calque-sous-doigt.js';

const nouveauPlan = () => ({
  id: 'p1', nom: 'Plan', visible: true, origine: { est: 2500000, nord: 1100000 },
  calques: [{ nom: 'A', visible: true }, { nom: 'B', visible: true }, { nom: 'C', visible: true }],
  contenu: { traits: [{ c: 0, p: [0, 0, 10, 0] }, { c: 1, p: [0, 5, 10, 5] }], cercles: [{ c: 2, x: 20, y: 20, r: 3 }], textes: [], points: [] },
});

describe('calqueSousLeDoigt : forme et clé', () => {
  it('rend la forme en MN95 et une clé', () => {
    const t = calqueSousLeDoigt([nouveauPlan()], { est: 2500005, nord: 1100000.1 }, 0.5);
    expect(t.calque).toBe(0);
    expect(t.cle).toBe('p1|t0');
    expect(t.forme.pts[1]).toEqual({ est: 2500010, nord: 1100000 });
  });
});

describe('Geler / Isoler / Tout réafficher', () => {
  it('geler cache les calques choisis', () => {
    const plan = nouveauPlan();
    const n = appliquerGelIsolement([plan], [{ planId: 'p1', calque: 0 }], 'geler');
    expect(n).toBe(1);
    expect(plan.calques.map((c) => c.visible)).toEqual([false, true, true]);
  });
  it('isoler ne garde que les calques choisis', () => {
    const plan = nouveauPlan();
    appliquerGelIsolement([plan], [{ planId: 'p1', calque: 1 }], 'isoler');
    expect(plan.calques.map((c) => c.visible)).toEqual([false, true, false]);
  });
  it('tout réafficher remet tout', () => {
    const plan = nouveauPlan();
    appliquerGelIsolement([plan], [{ planId: 'p1', calque: 1 }], 'isoler');
    expect(reafficherTousLesCalques([plan])).toBe(2);
    expect(plan.calques.every((c) => c.visible)).toBe(true);
  });
});
