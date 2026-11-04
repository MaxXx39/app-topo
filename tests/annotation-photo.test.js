import { describe, it, expect } from 'vitest';
import { rayonCercle, pointeFleche, dessinValide, epaisseurTrait } from '../src/photos/annotation.js';

describe('dessin sur une photo', () => {
  it('rayon du cercle en pixels', () => {
    expect(rayonCercle({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, 1000, 500)).toBeCloseTo(100);
    expect(rayonCercle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.7 }, 1000, 500)).toBeCloseTo(100);
  });

  it('la pointe de flèche est au bout et les deux branches reviennent en arrière', () => {
    const [gauche, bout, droite] = pointeFleche({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }, 1000, 1000, 50);
    expect(bout).toEqual({ x: 600, y: 500 });
    expect(gauche.x).toBeLessThan(600);
    expect(droite.x).toBeLessThan(600);
    expect(gauche.y).toBeCloseTo(1000 - droite.y); // symétriques de part et d'autre de l'axe
  });

  it('pas de flèche sans longueur, pointe raccourcie sur une flèche courte', () => {
    expect(pointeFleche({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 1000, 1000, 50)).toBe(null);
    const [gauche, bout] = pointeFleche({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, 1000, 1000, 50);
    expect(bout.x - gauche.x).toBeLessThan(10);
  });

  it('un simple toucher ne crée pas de dessin', () => {
    expect(dessinValide({ type: 'cercle', a: { x: 0.5, y: 0.5 }, b: { x: 0.5, y: 0.5 } }, 1000, 1000)).toBe(false);
    expect(dessinValide({ type: 'cercle', a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.5 } }, 1000, 1000)).toBe(true);
    expect(dessinValide({ type: 'trait', points: [{ x: 0, y: 0 }] }, 1000, 1000)).toBe(false);
    expect(dessinValide({ type: 'trait', points: [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }] }, 1000, 1000)).toBe(true);
  });

  it('épaisseur : 0,6 % du grand côté, au moins 3 pixels', () => {
    expect(epaisseurTrait(1600, 1200)).toBe(10);
    expect(epaisseurTrait(240, 180)).toBe(3);
  });
});
