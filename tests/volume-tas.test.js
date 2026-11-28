import { describe, it, expect } from 'vitest';
import { volumeDuTas } from '../src/topo/plan-chantier.js';

// Rectangle 20 × 10 m, talus 1/1 : la section à la hauteur z est (20 − 2z) × (10 − 2z).
const rect = [[0, 0], [20, 0], [20, 10], [0, 10]];

describe('volume d\'un tas de stock (0.355.0)', () => {
  it('rectangle 20 × 10 m, H 3 m, talus 1/1 = 366 m³ (calcul à la main : ∫ (20−2z)(10−2z) dz de 0 à 3)', () => {
    // ∫0^3 (200 − 60z + 4z²) dz = 600 − 270 + 36 = 366
    const v = volumeDuTas(rect, 3, 1);
    expect(v.volume).toBeCloseTo(366, 1);
    expect(v.aireBas).toBeCloseTo(200, 6);
    expect(v.aireHaut).toBeCloseTo(56, 6);
    expect(v.pointu).toBe(false);
  });
  it('sens du contour sans effet', () => {
    expect(volumeDuTas([...rect].reverse(), 3, 1).volume).toBeCloseTo(366, 1);
  });
  it('talus 0 = surface × hauteur', () => {
    expect(volumeDuTas(rect, 2, 0).volume).toBeCloseTo(400, 6);
  });
  it('tas trop haut pour la zone : pointu à 5 m (la moitié de 10 m)', () => {
    // ∫0^5 (200 − 60z + 4z²) dz = 1000 − 750 + 166.667 = 416.667
    const v = volumeDuTas(rect, 8, 1);
    expect(v.pointu).toBe(true);
    expect(v.hauteurReelle).toBeCloseTo(5, 1);
    expect(v.volume).toBeCloseTo(416.667, 0);
  });
});
