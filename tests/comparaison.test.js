// Tests de la comparaison de deux surfaces (deux levés).
import { describe, it, expect } from 'vitest';
import { comparerSurfaces } from '../src/topo/comparaison.js';

const pt = (est, nord, altitude) => ({ est, nord, altitude });

/** Carré de 20 m × 20 m, plat à l'altitude z (2 triangles). */
const plat = (z) => [
  [pt(0, 0, z), pt(20, 0, z), pt(20, 20, z)],
  [pt(0, 0, z), pt(20, 20, z), pt(0, 20, z)],
];

describe('comparerSurfaces', () => {
  it('toute la surface : 400 m² montés de 0.5 m -> 200 m³ ajoutés', () => {
    const r = comparerSurfaces(plat(10), plat(10.5));
    expect(r.remblai).toBeCloseTo(200, 9);
    expect(r.deblai).toBeCloseTo(0, 9);
    expect(r.surfaceZone).toBeCloseTo(400, 9);
  });

  it('descente : volume enlevé', () => {
    const r = comparerSurfaces(plat(10), plat(9));
    expect(r.deblai).toBeCloseTo(400, 9);
    expect(r.remblai).toBeCloseTo(0, 9);
  });

  it('dans un contour en « L » (300 m²) : 300 × 1 m = 300 m³', () => {
    const contour = [
      { nom: 'a', est: 0, nord: 0 },
      { nom: 'b', est: 20, nord: 0 },
      { nom: 'c', est: 20, nord: 10 },
      { nom: 'd', est: 10, nord: 10 },
      { nom: 'e', est: 10, nord: 20 },
      { nom: 'f', est: 0, nord: 20 },
    ];
    const r = comparerSurfaces(plat(10), plat(11), contour);
    expect(r.surfaceZone).toBeCloseTo(300, 9);
    expect(r.surfacePlan).toBeCloseTo(300, 9);
    expect(r.remblai).toBeCloseTo(300, 9);
  });

  it('signale la partie non couverte par la surface « avant »', () => {
    // Avant : seulement la moitié Ouest (10 m × 20 m).
    const avant = [
      [pt(0, 0, 10), pt(10, 0, 10), pt(10, 20, 10)],
      [pt(0, 0, 10), pt(10, 20, 10), pt(0, 20, 10)],
    ];
    const r = comparerSurfaces(avant, plat(11));
    expect(r.surfaceNonCouverte).toBeCloseTo(200, 9);
    expect(r.remblai).toBeCloseTo(200, 9);
  });

  it('refuse une surface vide', () => {
    expect(comparerSurfaces([], plat(1)).erreurs[0]).toContain('aucun triangle');
  });
});
