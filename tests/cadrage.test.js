import { describe, it, expect } from 'vitest';
import { cadrerSurPoints } from '../src/plan/vue.js';

describe('Cadrage du plan (Tout voir)', () => {
  it('cadre sur une très grande liste de points sans bloquer (0.106.1)', () => {
    const points = Array.from({ length: 300000 }, (_, i) => ({ est: 2600000 + (i % 1000), nord: 1200000 + Math.floor(i / 1000) }));
    const vue = cadrerSurPoints(points, 800, 600);
    expect(vue.estCentre).toBeCloseTo(2600499.5, 3);
    expect(vue.nordCentre).toBeCloseTo(1200149.5, 3);
    expect(Number.isFinite(vue.echelle)).toBe(true);
  });

  it('ignore les points sans coordonnées lisibles', () => {
    const vue = cadrerSurPoints([{ est: 10, nord: 20 }, { est: undefined, nord: 5 }, { est: 30, nord: 40 }], 800, 600);
    expect(vue.estCentre).toBe(20);
    expect(vue.nordCentre).toBe(30);
  });
});
