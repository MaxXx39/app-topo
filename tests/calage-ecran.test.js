// Calage de plans (0.278.0) : plans de référence, étiquettes, plan calé rangé comme un plan recalé.
import { describe, it, expect } from 'vitest';
import { caler } from '../src/topo/calage-plan.js';
import { plansDeReference, plansCales, etiquettes, planCale } from '../src/calage/plans.js';
import { planRecale } from '../src/topo/recalage.js';

const P1 = [[16382.052, -16553.176], [2510267.726, 1141751.289]];
const P2 = [[19985.355, -14088.02], [2510227.906, 1141769.19]];
const P3 = [[21672.818, -15966.025], [2510235.137, 1141793.38]];
const point = ([plan, ref], role = 'calage') => ({ type: 'point', role, plan, ref });

// Plan reçu (unités du plan, cm), rangé comme lirePlanDxf : origine + coordonnées relatives.
const lu = {
  nom: 'plan_A.dxf',
  origine: { est: 16382, nord: -16554 },
  bornes: { estMin: 16382, nordMin: -16554, estMax: 21673, nordMax: -14088 },
  calques: [{ nom: '0', couleur: '#000000', visible: true }],
  contenu: { traits: [{ c: 0, k: null, p: [0.052, 0.824, 3603.355, 2465.98, 5290.818, 587.975] }], pleins: [], cercles: [], textes: [], points: [] },
  compte: { objets: 1, ignores: {} },
};
const mn95 = { id: 'r', nom: 'Référence', origine: { est: 2510000, nord: 1141000 }, bornes: { estMin: 2510000, nordMin: 1141000, estMax: 2510300, nordMax: 1141800 }, calques: [], contenu: { traits: [{ c: 0, p: [0, 0, 1, 1] }] } };

describe('plans de référence', () => {
  it('plans en MN95 ou locaux (0.284.0), sans IFC ni plan vide', () => {
    const local = { ...lu, id: 'l' };
    const ifc = { ...mn95, id: 'i', ifc: {} };
    const vide = { ...mn95, id: 'v', contenu: { traits: [] } };
    expect(plansDeReference([local, mn95, ifc, vide]).map((p) => p.id)).toEqual(['l', 'r']);
  });
});

describe('étiquettes', () => {
  it('P, A et V numérotés à part', () => {
    expect(etiquettes([
      { type: 'point', role: 'calage' }, { type: 'axe', role: 'calage' }, { type: 'point', role: 'calage' }, { type: 'point', role: 'verification' },
    ])).toEqual(['P1', 'A1', 'P2', 'V1']);
  });
});

describe('plan calé', () => {
  const elements = [point(P1), point(P2), point(P3, 'verification')];
  const resultat = caler(elements);
  const plan = planCale({ lu, nom: 'Archi A', fichier: 'plan_A.dxf', resultat, reference: mn95, elements, id: 'c1', le: '2026-11-22T10:00:00Z' });

  it('le plan reçu est gardé tel quel, avec un recalage appliqué et la recette', () => {
    expect(plan.contenu).toBe(lu.contenu);
    expect(plan.recalage.applique).toBe(true);
    expect(plan.calage.referenceId).toBe('r');
    expect(plan.calage.elements).toHaveLength(3);
    expect(plan.calage.verdict).toBe('juste');
    expect(plansCales([mn95, plan])).toEqual([plan]);
  });

  it('affiché recalé : le sommet P3 du trait tombe sur sa place MN95 (≤ 2 mm)', () => {
    const recale = planRecale(plan);
    const t = recale.contenu.traits[0].p;
    const est = recale.origine.est + t[4];
    const nord = recale.origine.nord + t[5];
    expect(Math.hypot(est - P3[1][0], nord - P3[1][1])).toBeLessThan(0.002);
  });
});
