import { describe, it, expect } from 'vitest';
import { ecartControlePlan, couleurControlePlan, resultatControlePlan, resumeControlePlan, texteEcartMm } from '../src/topo/controle-plan.js';

describe('contrôle d\'un plan', () => {
  it('calcule l\'écart en millimètres (plan − connu)', () => {
    const e = ecartControlePlan({ est: 2538000.003, nord: 1155000.004 }, { est: 2538000, nord: 1155000 });
    expect(e.dEstMm).toBe(3);
    expect(e.dNordMm).toBe(4);
    expect(e.distanceMm).toBe(5);
  });
  it('refuse une coordonnée manquante', () => {
    expect(ecartControlePlan({ est: 1, nord: null }, { est: 1, nord: 2 })).toBeNull();
    expect(ecartControlePlan(null, { est: 1, nord: 2 })).toBeNull();
  });
  it('couleurs : ≤ 2 mm vert, ≤ 15 mm orange, au-delà rouge', () => {
    expect(couleurControlePlan(0)).toBe('vert');
    expect(couleurControlePlan(2)).toBe('vert');
    expect(couleurControlePlan(2.1)).toBe('orange');
    expect(couleurControlePlan(5)).toBe('orange');
    expect(couleurControlePlan(15)).toBe('orange');
    expect(couleurControlePlan(15.1)).toBe('rouge');
    expect(couleurControlePlan(NaN)).toBe('rouge');
  });
  it('garde le résultat complet', () => {
    const r = resultatControlePlan({ est: 10.02, nord: 20 }, { nom: 'P1', est: 10, nord: 20 }, new Date('2026-11-12T10:00:00Z'));
    expect(r).toMatchObject({ connu: 'P1', distanceMm: 20, couleur: 'rouge', le: '2026-11-12T10:00:00.000Z' });
  });
  it('résume pour la liste des plans', () => {
    expect(resumeControlePlan(null)).toBe('');
    expect(resumeControlePlan({ saute: true, raison: 'aucun point connu' })).toBe('Non contrôlé (aucun point connu)');
    expect(resumeControlePlan({ distanceMm: 3.24, connu: 'P1' })).toBe('Contrôlé : écart 3.2 mm sur P1');
    expect(texteEcartMm(12)).toBe('12.0 mm');
  });
});
