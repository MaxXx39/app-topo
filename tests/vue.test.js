// Tests des calculs de la vue du plan.
import { describe, it, expect } from 'vitest';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer, barreEchelle } from '../src/plan/vue.js';

const points = [
  { nom: 'a', est: 2499300, nord: 1124500, altitude: 0 },
  { nom: 'b', est: 2499400, nord: 1124550, altitude: 0 },
];

describe('cadrerSurPoints', () => {
  it('centre la vue sur les points et les fait tenir dans le plan', () => {
    const vue = cadrerSurPoints(points, 400, 300, 0);
    expect(vue.estCentre).toBe(2499350);
    expect(vue.nordCentre).toBe(1124525);
    expect(vue.echelle).toBe(4); // 100 m en Est sur 400 px
  });

  it('ne plante pas avec un seul point', () => {
    const vue = cadrerSurPoints([points[0]], 400, 300);
    expect(Number.isFinite(vue.echelle)).toBe(true);
  });
});

describe('versEcran et versTerrain', () => {
  const vue = cadrerSurPoints(points, 400, 300, 0);

  it('place l\'Ouest à gauche et le Nord en haut', () => {
    const ouest = versEcran(2499300, 1124525, vue);
    const nord = versEcran(2499350, 1124550, vue);
    expect(ouest.x).toBe(0);
    expect(nord.y).toBe(50);
  });

  it('revient au même point terrain', () => {
    const ecran = versEcran(2499321.123, 1124537.456, vue);
    const terrain = versTerrain(ecran.x, ecran.y, vue);
    expect(terrain.est).toBeCloseTo(2499321.123, 6);
    expect(terrain.nord).toBeCloseTo(1124537.456, 6);
  });
});

describe('deplacer et zoomer', () => {
  const vue = cadrerSurPoints(points, 400, 300, 0);

  it('fait suivre le plan au doigt', () => {
    const avant = versEcran(2499320, 1124510, vue);
    const apres = versEcran(2499320, 1124510, deplacer(vue, 30, -20));
    expect(apres.x).toBeCloseTo(avant.x + 30, 9);
    expect(apres.y).toBeCloseTo(avant.y - 20, 9);
  });

  it('garde le point sous le doigt immobile pendant le zoom', () => {
    const nouvelleVue = zoomer(vue, 2.5, 100, 80);
    const avant = versTerrain(100, 80, vue);
    const apres = versTerrain(100, 80, nouvelleVue);
    expect(nouvelleVue.echelle).toBe(10);
    expect(apres.est).toBeCloseTo(avant.est, 6);
    expect(apres.nord).toBeCloseTo(avant.nord, 6);
  });
});

describe('barreEchelle', () => {
  it('choisit une longueur ronde', () => {
    expect(barreEchelle(4, 120)).toEqual({ metres: 20, pixels: 80 });
    expect(barreEchelle(1, 120)).toEqual({ metres: 100, pixels: 100 });
    expect(barreEchelle(50, 120).metres).toBe(2);
  });
});
