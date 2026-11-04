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

describe('vue 3D : choix, échelle et nord (0.126.0)', () => {
  const carre = (e, n, h) => [[p(e, n, h), p(e + 10, n, h), p(e, n + 10, h)]];
  it('éléments éloignés : vrai à 6 km, faux côte à côte', async () => {
    const { elementsEloignes } = await import('../src/plan/vue3d.js');
    expect(elementsEloignes([{ triangles: carre(0, 0, 400) }, { triangles: carre(6000, 0, 420) }])).toBe(true);
    expect(elementsEloignes([{ triangles: carre(0, 0, 400) }, { triangles: carre(12, 0, 401) }])).toBe(false);
    expect(elementsEloignes([{ triangles: carre(0, 0, 400) }])).toBe(false);
  });
  it('longueur ronde de la barre d\'échelle', async () => {
    const { longueurRonde } = await import('../src/plan/vue3d.js');
    expect(longueurRonde(7.3)).toBe(5);
    expect(longueurRonde(19)).toBe(10);
    expect(longueurRonde(250)).toBe(200);
    expect(longueurRonde(0.37)).toBeCloseTo(0.2);
  });
  it('nord à l\'écran : en haut vu du sud, à droite vu de l\'est', async () => {
    const { directionNord } = await import('../src/plan/vue3d.js');
    const duSud = directionNord({ azimut: 0, inclinaison: 35 });
    expect(duSud.x).toBeCloseTo(0);
    expect(duSud.y).toBeCloseTo(-1);
    // azimut 90 : rotation de la scène de 90° ; le nord part sur le côté (gauche ou droite), à plat.
    const tourne = directionNord({ azimut: 90, inclinaison: 35 });
    expect(Math.abs(tourne.x)).toBeCloseTo(1);
    expect(tourne.y).toBeCloseTo(0);
  });
});
