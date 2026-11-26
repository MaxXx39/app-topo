import { describe, it, expect } from 'vitest';
import { plansAvecCalques, gelIsolementChantier, reafficherCalquesChantier } from '../src/plans-chantier/gestion-calques.js';

const plan = () => ({ id: 'p1', nom: 'Plan', transparence: 10, calques: [{ nom: 'MUR', visible: true }, { nom: 'COTES', visible: true }, { nom: 'AXES', visible: true }] });

describe('calques d\'un plan de chantier : Geler / Isoler / Tout réafficher (0.337.0)', () => {
  it('transparence et couleur propres au plan de chantier, sans toucher au plan du projet', () => {
    const p = plan();
    const [copie] = plansAvecCalques([p], { reglagesPlans: { p1: { transparence: 60, couleur: '#ff0000' } } });
    expect(copie.transparence).toBe(60);
    expect(copie.couleur).toBe('#ff0000');
    expect(p.transparence).toBe(10);
    expect(plansAvecCalques([p], {})[0]).toBe(p);
  });
  it('Geler cache les calques touchés', () => {
    const p = plan();
    const fond = {};
    const n = gelIsolementChantier(plansAvecCalques([p], fond), fond, [{ planId: 'p1', calque: 1 }], 'geler');
    expect(n).toBe(1);
    expect(plansAvecCalques([p], fond)[0].calques.map((c) => c.visible)).toEqual([true, false, true]);
    expect(p.calques[1].visible).toBe(true);
  });
  it('Isoler ne garde que les calques touchés', () => {
    const p = plan();
    const fond = {};
    const n = gelIsolementChantier(plansAvecCalques([p], fond), fond, [{ planId: 'p1', calque: 0 }], 'isoler');
    expect(n).toBe(2);
    expect(plansAvecCalques([p], fond)[0].calques.map((c) => c.visible)).toEqual([true, false, false]);
  });
  it('Tout réafficher remet les calques cachés', () => {
    const p = plan();
    const fond = {};
    gelIsolementChantier(plansAvecCalques([p], fond), fond, [{ planId: 'p1', calque: 0 }], 'isoler');
    expect(reafficherCalquesChantier(fond)).toBe(2);
    expect(plansAvecCalques([p], fond)[0].calques.every((c) => c.visible)).toBe(true);
    expect(reafficherCalquesChantier(fond)).toBe(0);
  });
});
