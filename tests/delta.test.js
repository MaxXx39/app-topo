import { describe, it, expect } from 'vitest';
import { pointAvecDelta, deltaActif } from '../src/topo/delta.js';

const p = { est: 2500000, nord: 1200000, altitude: 400 };

describe('pointAvecDelta', () => {
  it('cap nord : droite = vers l\'est, gauche = vers l\'ouest', () => {
    expect(pointAvecDelta(p, { lateral: 1.5, z: 0 }, 0)).toEqual({ est: 2500001.5, nord: 1200000, altitude: 400 });
    expect(pointAvecDelta(p, { lateral: -2, z: 0 }, 0)).toEqual({ est: 2499998, nord: 1200000, altitude: 400 });
  });
  it('cap est : droite = vers le sud', () => {
    expect(pointAvecDelta(p, { lateral: 1, z: 0 }, 90)).toEqual({ est: 2500000, nord: 1199999, altitude: 400 });
  });
  it('cap 45° : droite = sud-est', () => {
    const r = pointAvecDelta(p, { lateral: Math.SQRT2, z: 0 }, 45);
    expect(r.est).toBeCloseTo(2500001, 3);
    expect(r.nord).toBeCloseTo(1199999, 3);
  });
  it('hauteur seule : pas besoin du cap', () => {
    expect(pointAvecDelta(p, { lateral: 0, z: -0.25 }, null)).toEqual({ est: 2500000, nord: 1200000, altitude: 399.75 });
  });
  it('latéral sans cap : refusé', () => {
    expect(pointAvecDelta(p, { lateral: 1, z: 0 }, null)).toBeNull();
  });
  it('sans altitude : reste sans altitude', () => {
    expect(pointAvecDelta({ est: 0, nord: 0, altitude: null }, { lateral: 0, z: 1 }, 0).altitude).toBeNull();
  });
  it('deltaActif', () => {
    expect(deltaActif({ lateral: 0, z: 0 })).toBe(false);
    expect(deltaActif({ lateral: 0, z: 0.1 })).toBe(true);
    expect(deltaActif(null)).toBe(false);
  });
});
