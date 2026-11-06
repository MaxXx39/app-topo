import { describe, it, expect } from 'vitest';
import { lignesDesPlans, draperLignes } from '../src/topo/drapage.js';

describe('drapage', () => {
  it('lit les traits visibles d\'un plan recalé', () => {
    const plan = { origine: { est: 100, nord: 200 }, couleur: '#ff0000', calques: [{ visible: true }, { visible: false }], contenu: { traits: [{ c: 0, p: [0, 0, 10, 0] }, { c: 1, p: [0, 0, 5, 5] }] } };
    const lignes = lignesDesPlans([plan]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].points).toEqual([{ est: 100, nord: 200 }, { est: 110, nord: 200 }]);
  });
  it('pose une ligne sur un plan incliné et coupe hors surface', () => {
    // Surface : altitude = 400 + est / 10, seulement pour 0 ≤ est ≤ 5.
    const altitude = (est) => (est >= 0 && est <= 5 ? 400 + est / 10 : null);
    const morceaux = draperLignes([{ points: [{ est: 0, nord: 0 }, { est: 10, nord: 0 }], couleur: 'x' }], altitude, { pas: 1 });
    expect(morceaux).toHaveLength(1);
    expect(morceaux[0].points).toHaveLength(6);
    expect(morceaux[0].points[5]).toEqual({ est: 5, nord: 0, altitude: 400.5 });
  });
});
