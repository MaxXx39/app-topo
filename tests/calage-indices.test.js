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
