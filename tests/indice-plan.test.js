// Nouvel indice d'un plan calé (0.280.0) : indice suivant, repères, contrôle « même origine » à 2 mm.
import { describe, it, expect } from 'vitest';
import { indiceSuivant, reperesDuPlan, partRetrouvee, controlerIndice } from '../src/topo/indice-plan.js';

const plan = (decalage = 0) => ({
  origine: { est: 1000, nord: 2000 },
  calques: [{ nom: 'MURS' }, { nom: 'COTES' }],
  contenu: {
    traits: [
      { c: 0, p: [0 + decalage, 0, 100 + decalage, 0, 100 + decalage, 50] },
      { c: 0, p: [10 + decalage, 10, 20 + decalage, 20] },
      { c: 1, p: [500, 500, 600, 600] },
    ],
  },
});

describe('indice suivant', () => {
  it('A → B, Z → ZA, 3 → 4, B2 → B3, 09 → 10', () => {
    expect(indiceSuivant('A')).toBe('B');
    expect(indiceSuivant('Z')).toBe('ZA');
    expect(indiceSuivant('3')).toBe('4');
    expect(indiceSuivant('B2')).toBe('B3');
    expect(indiceSuivant('09')).toBe('10');
    expect(indiceSuivant('')).toBe('A');
  });
});

describe('contrôle d\'un nouvel indice', () => {
  const reperes = reperesDuPlan(plan(), { ecartes: ['COTES'] });
  it('repères : calques gardés seulement, sans doublon', () => {
    expect(reperes).toHaveLength(5);
    expect(reperes[0]).toEqual([1000, 2000]);
  });
  it('même plan : 100 % ; plan en cm (échelle 0.01) décalé de 0.1 cm = 1 mm : retrouvé', () => {
    expect(partRetrouvee(reperes, plan(), 0.2)).toBe(1);
    expect(controlerIndice(reperes, plan(0.1), 0.01).memeOrigine).toBe(true);
  });
  it('plan décalé de 1 cm (1 unité en cm) : origine différente', () => {
    const r = controlerIndice(reperes, plan(1), 0.01);
    expect(r.memeOrigine).toBe(false);
    expect(r.part).toBe(0);
  });
});
