import { describe, it, expect } from 'vitest';
import { pointsOutil } from '../src/topo/outil.js';

const bas = { est: 2500000, nord: 1200000, altitude: 400 };
const dims = { gauche: 0.5, droite: 1.5, avant: 0.4, arriere: 0.6 };

describe('pointsOutil', () => {
  it('à plat, cap nord : gauche = ouest, droite = est, même altitude', () => {
    const r = pointsOutil(bas, { cap: 0, inclinaison: 0, directionInclinaison: 0 }, dims);
    expect(r.gauche).toEqual({ est: 2499999.5, nord: 1199999.9, altitude: 400 });
    expect(r.droite).toEqual({ est: 2500001.5, nord: 1199999.9, altitude: 400 });
    expect(r.centre).toEqual({ est: 2500000.5, nord: 1199999.9, altitude: 400 });
    expect(r.coins[0]).toEqual({ est: 2499999.5, nord: 1200000.4, altitude: 400 });
    expect(r.coins[2]).toEqual({ est: 2500001.5, nord: 1199999.4, altitude: 400 });
  });
  it('cap est : la droite est au sud', () => {
    const r = pointsOutil(bas, { cap: 90, inclinaison: 0 }, { gauche: 1, droite: 1, avant: 0, arriere: 0 });
    expect(r.droite.est).toBeCloseTo(2500000, 3);
    expect(r.droite.nord).toBeCloseTo(1199999, 3);
  });
  it('mât penché de 10° vers l\'est, cap nord : le côté droit (est) est plus bas', () => {
    const r = pointsOutil(bas, { cap: 0, inclinaison: 10, directionInclinaison: 90 }, { gauche: 1, droite: 1, avant: 0, arriere: 0 });
    expect(r.droite.altitude).toBeCloseTo(400 - Math.sin((10 * Math.PI) / 180), 3);
    expect(r.gauche.altitude).toBeCloseTo(400 + Math.sin((10 * Math.PI) / 180), 3);
    // Dévers (droite − gauche) / largeur à plat = −tan 10° ≈ −17.6 %.
    const largeur = Math.hypot(r.droite.est - r.gauche.est, r.droite.nord - r.gauche.nord);
    expect(((r.droite.altitude - r.gauche.altitude) / largeur) * 100).toBeCloseTo(-17.63, 1);
  });
  it('mât penché vers le nord (avant), cap nord : l\'avant est plus bas', () => {
    const r = pointsOutil(bas, { cap: 0, inclinaison: 5, directionInclinaison: 0 }, { gauche: 0, droite: 0, avant: 1, arriere: 1 });
    expect(r.coins[0].altitude).toBeLessThan(400);
    expect(r.coins[3].altitude).toBeGreaterThan(400);
  });
  it('sans cap : null', () => {
    expect(pointsOutil(bas, { cap: null }, dims)).toBeNull();
  });
});
