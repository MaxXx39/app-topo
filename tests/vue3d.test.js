import { describe, it, expect } from 'vitest';
import { cadreScene, projeter, eclairage } from '../src/plan/vue3d.js';

const p = (est, nord, altitude) => ({ est, nord, altitude });

describe('vue 3D (0.99.0)', () => {
  it('cadre : centre et plus grand côté', () => {
    const { centre, taille } = cadreScene([[p(0, 0, 400), p(20, 0, 402), p(0, 10, 404)]]);
    expect(centre).toEqual({ est: 10, nord: 5, altitude: 402 });
    expect(taille).toBe(20);
  });

  it('vu de dessus, depuis le sud : l\'est à droite, le nord en haut', () => {
    const vue = { azimut: 0, inclinaison: 90, exageration: 1, centre: { est: 0, nord: 0, altitude: 0 }, echelle: 10, largeur: 200, hauteur: 100 };
    const est = projeter(p(1, 0, 0), vue);
    const nord = projeter(p(0, 1, 0), vue);
    expect(est.x).toBeCloseTo(110);
    expect(est.y).toBeCloseTo(50);
    expect(nord.y).toBeCloseTo(40);
    // Vu de dessus : un point plus haut est plus près.
    expect(projeter(p(0, 0, 5), vue).profondeur).toBeLessThan(projeter(p(0, 0, 0), vue).profondeur);
  });

  it('éclairage : un sol plat entre 0.35 et 1, la même valeur quel que soit le sens des sommets', () => {
    const plat = [p(0, 0, 0), p(1, 0, 0), p(0, 1, 0)];
    const e = eclairage(plat, 1);
    expect(e).toBeGreaterThan(0.35);
    expect(e).toBeLessThanOrEqual(1);
    expect(eclairage([plat[0], plat[2], plat[1]], 1)).toBeCloseTo(e);
  });
});
