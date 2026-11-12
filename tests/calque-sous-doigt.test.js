import { describe, it, expect } from 'vitest';
import { calqueSousLeDoigt } from '../src/topo/calque-sous-doigt.js';

const plan = {
  id: 'p1', nom: 'Plan 1', origine: { est: 1000, nord: 2000 },
  calques: [{ nom: 'MUR', visible: true }, { nom: 'ROUTE', visible: true }, { nom: 'CACHE', visible: false }],
  contenu: {
    traits: [{ c: 0, p: [0, 0, 10, 0] }, { c: 1, p: [0, 5, 10, 5] }, { c: 2, p: [0, 1, 10, 1] }],
    cercles: [{ c: 1, x: 20, y: 20, r: 2 }],
    textes: [{ c: 0, x: 30, y: 30, t: 'abc' }],
    points: [],
  },
};

describe('calque sous le doigt', () => {
  it('trouve le trait le plus proche et son calque', () => {
    const r = calqueSousLeDoigt([plan], { est: 1005, nord: 2000.1 }, 0.5);
    expect(r).toMatchObject({ planId: 'p1', calque: 0, calqueNom: 'MUR' });
  });
  it('ignore les calques cachés', () => {
    // Le trait du calque caché est à 1 m de y = 0, mais il ne compte pas : le trait du calque 0 (à 0,95 m) est trouvé.
    const r = calqueSousLeDoigt([plan], { est: 1005, nord: 2000.95 }, 1);
    expect(r.calque).toBe(0);
  });
  it('trouve un cercle par son bord et un texte par son point', () => {
    expect(calqueSousLeDoigt([plan], { est: 1022, nord: 2020 }, 0.3).calqueNom).toBe('ROUTE');
    expect(calqueSousLeDoigt([plan], { est: 1030.1, nord: 2030 }, 0.3).calqueNom).toBe('MUR');
  });
  it('renvoie null si rien n\'est assez près, ou si le plan est caché', () => {
    expect(calqueSousLeDoigt([plan], { est: 1500, nord: 2500 }, 1)).toBeNull();
    expect(calqueSousLeDoigt([{ ...plan, visible: false }], { est: 1005, nord: 2000 }, 1)).toBeNull();
  });
});
