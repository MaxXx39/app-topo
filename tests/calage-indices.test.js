// Calage de plans 0.283.0 : tous les indices restent dans le projet (groupe, archive), référence ajoutée depuis le module.
import { describe, it, expect } from 'vitest';
import { plansCales, plansDeReference, indicesDuGroupe, planReference } from '../src/calage/plans.js';

const plan = (id, calage = null, extra = {}) => ({ id, nom: 'Plan', contenu: { traits: [{ p: [0, 0, 1, 1], c: 0 }] }, bornes: { estMin: 2500000, nordMin: 1120000, estMax: 2500100, nordMax: 1120100 }, origine: { est: 2500000, nord: 1120000 }, dejaCale: true, ...(calage ? { calage } : {}), ...extra });

describe('indices gardés', () => {
  const a = plan('a', { le: '2026-11-01', indice: 'A', groupe: 'a', archive: true });
  const b = plan('b', { le: '2026-11-10', indice: 'B', groupe: 'a' });
  const autre = plan('z', { le: '2026-11-05', indice: 'A' });
  const projet = [a, b, autre];

  it('la liste des plans calés ne montre que le dernier indice de chaque plan', () => {
    expect(plansCales(projet).map((p) => p.id)).toEqual(['b', 'z']);
  });
  it('tous les indices d\'un plan, du plus récent au plus ancien', () => {
    expect(indicesDuGroupe(projet, b).map((p) => p.calage.indice)).toEqual(['B', 'A']);
    expect(indicesDuGroupe(projet, a).map((p) => p.id)).toEqual(['b', 'a']);
  });
  it('un plan sans groupe (avant 0.283.0) est son propre groupe', () => {
    expect(indicesDuGroupe(projet, autre).map((p) => p.id)).toEqual(['z']);
  });
  it('un ancien indice ne sert pas de référence', () => {
    expect(plansDeReference(projet).map((p) => p.id)).toEqual(['b', 'z']);
  });
});

describe('référence ajoutée depuis le module de calage', () => {
  it('plan déjà calé, sans calage, avec sa recette de nettoyage', () => {
    const lu = plan('x');
    const r = planReference({ lu, nom: 'Mensuration', fichier: 'ref.dwg', le: '2026-11-23', nettoyage: { ecartes: ['A'] } });
    expect(r.dejaCale).toBe(true);
    expect(r.calage).toBeUndefined();
    expect(r.nom).toBe('Mensuration');
    expect(r.reference.nettoyage.ecartes).toEqual(['A']);
    expect(plansDeReference([r])).toHaveLength(1);
    expect(plansCales([r])).toHaveLength(0);
  });
});

import { planDesPoints, REF_POINTS } from '../src/calage/plans.js';
import { droiteParPoints, caler } from '../src/topo/calage-plan.js';

describe('calage sur des points du projet (0.284.0)', () => {
  it('« Points du projet » est un plan : un point accrochable, un rond et un nom par point', () => {
    const plan = planDesPoints([{ nom: 'B1', est: 2500010.5, nord: 1120020.25 }, { nom: 'B2', est: 2500030, nord: 1120040 }]);
    expect(plan.id).toBe(REF_POINTS);
    expect(plan.contenu.points).toHaveLength(2);
    expect(plan.contenu.textes.map((t) => t.t)).toEqual(['B1', 'B2']);
    expect(plan.origine.est + plan.contenu.points[0].x).toBeCloseTo(2500010.5, 3);
    expect(plan.bornes.estMax).toBe(2500030);
  });
  it('sans point, le plan est vide mais valide', () => {
    expect(planDesPoints([]).bornes).toBeNull();
  });
  it('droite ajustée : points alignés', () => {
    const d = droiteParPoints([[0, 0], [10, 10], [20, 20]]);
    expect(d.ecartMaxM).toBeLessThan(1e-9);
    expect(d.segment[0]).toBeCloseTo(0); expect(d.segment[2]).toBeCloseTo(20);
  });
  it('droite ajustée : écart des points à la droite', () => {
    const d = droiteParPoints([[0, 0.01], [10, -0.01], [20, 0.01], [30, -0.01]]);
    expect(d.ecartMaxM).toBeLessThan(0.015);
    expect(d.ecartMaxM).toBeGreaterThan(0.005);
  });
  it('points confondus ou un seul : erreur claire', () => {
    expect(() => droiteParPoints([[1, 1]])).toThrow(/au moins 2/);
    expect(() => droiteParPoints([[1, 1], [1, 1]])).toThrow(/confondus/);
  });
  it('2 points de calage + 1 axe ajusté sur des points levés : cale juste', () => {
    // Plan reçu en cm, tourné de 90°, ses 2 points P1 (0,0) P2 (1000,0) ↔ MN95 ; axe vertical x = 500 ↔ droite par des points levés.
    const P1 = { type: 'point', role: 'calage', plan: [0, 0], ref: [2500000, 1120000] };
    const P2 = { type: 'point', role: 'calage', plan: [1000, 0], ref: [2500000, 1120010] };
    const droite = droiteParPoints([[2500005, 1120003], [2500005, 1120008]]); // axe x_plan = 500 (cm) → N + 5 m ... droite E = 2500005
    const axe = { type: 'axe', role: 'verification', plan: [0, 0, 0, 1000], ref: droite.segment };
    const r = caler([P1, P2, axe]);
    expect(r.similitude.echelle).toBeCloseTo(0.01, 6);
    expect(r.elements.length).toBe(3);
  });
});
