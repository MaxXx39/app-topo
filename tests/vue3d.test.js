import { describe, it, expect } from 'vitest';
import { cadreScene, projeter, eclairage, preparerScene, dessinerScene } from '../src/plan/vue3d.js';

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

describe('dessin rapide de la 3D (0.265.0)', () => {
  const p = (est, nord, altitude) => ({ est, nord, altitude });
  const grand = [p(0, 0, 0), p(10, 0, 0), p(0, 10, 0)];
  const petit = [p(0, 0, 1), p(1, 0, 1), p(0, 1, 1)];
  const minuscule = [p(5, 5, 2), p(5.001, 5, 2), p(5, 5.001, 2)];
  // Faux contexte de canvas : compte les triangles remplis.
  const faux = () => ({ remplis: 0, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { this.remplis++; }, stroke() {} });
  const vue = { azimut: 0, inclinaison: 90, exageration: 1, centre: { est: 0, nord: 0, altitude: 0 }, echelle: 20, largeur: 400, hauteur: 400 };

  it('prépare couleurs (couleur propre d\'une maquette IFC) et ordre du plus grand au plus petit', () => {
    const scene = preparerScene([petit, grand], { min: 0, max: 1 }, { couleurDe: (k) => (k === 1 ? [220, 38, 38] : null) });
    expect(scene.n).toBe(2);
    expect(Array.from(scene.parTaille)).toEqual([1, 0]);
    expect(scene.teintes[1]).toMatch(/^rgb\(/);
  });

  it('dessine tout, sauf les triangles invisibles ; l\'aperçu ne garde que les plus grands', () => {
    const scene = preparerScene([petit, grand, minuscule], { min: 0, max: 2 });
    const complet = faux();
    dessinerScene(complet, scene, vue);
    expect(complet.remplis).toBe(2); // le minuscule (moins d'un quart de pixel) n'est pas dessiné
    const apercu = faux();
    dessinerScene(apercu, scene, vue, { apercu: true, max: 1 });
    expect(apercu.remplis).toBe(1);
  });
});
