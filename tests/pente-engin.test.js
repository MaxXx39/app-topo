import { describe, it, expect } from 'vitest';
import { penteEngin } from '../src/topo/outil.js';

describe('pente de l\'engin (GNSS #1)', () => {
  it('mât vertical : engin à plat', () => {
    expect(penteEngin({ cap: 90, inclinaison: 0, directionInclinaison: 0 })).toBe(0);
  });
  it('cap au nord, haut du mât penché vers le sud de 5° : avant plus haut (+)', () => {
    // Le mât penche vers l'arrière : l'engin a le nez en l'air.
    const p = penteEngin({ cap: 0, inclinaison: 5, directionInclinaison: 180 });
    expect(p).toBeCloseTo(Math.tan((5 * Math.PI) / 180) * 100, 1);
  });
  it('mât penché vers l\'avant : avant plus bas (−)', () => {
    expect(penteEngin({ cap: 0, inclinaison: 5, directionInclinaison: 0 })).toBeLessThan(0);
  });
  it('mât penché sur le côté : pas de pente le long de l\'avant', () => {
    expect(Math.abs(penteEngin({ cap: 0, inclinaison: 5, directionInclinaison: 90 }))).toBeLessThan(0.01);
  });
  it('sans cap : pas de pente', () => {
    expect(penteEngin({ cap: null, inclinaison: 5, directionInclinaison: 0 })).toBeNull();
  });
});
