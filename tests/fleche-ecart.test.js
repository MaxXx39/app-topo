import { describe, it, expect } from 'vitest';
import { couleurFlecheEcart, placerFlecheEcart } from '../src/plan/fleche-ecart.js';

describe('flèche de l\'écart sur le plan (0.210.0)', () => {
  it('canne à droite de la ligne : flèche puis texte (pas retourné), à 6 px de la ligne', () => {
    const p = placerFlecheEcart({ x: 100, y: 50 }, { x: 200, y: 50 });
    expect(p).toEqual({ x: 106, y: 50, angle: 0, retourne: false });
  });

  it('canne à gauche : texte puis flèche (retourné), texte toujours lisible à l\'endroit', () => {
    const p = placerFlecheEcart({ x: 100, y: 50 }, { x: 0, y: 50 });
    expect(p.retourne).toBe(true);
    expect(Math.abs(p.angle)).toBeCloseTo(0, 5);
    expect(p.x).toBeCloseTo(94, 5);
  });

  it('ligne en diagonale : le texte est penché, l\'angle reste entre -90 et 90', () => {
    for (const [dx, dy] of [[70, 70], [-70, 70], [70, -70], [-70, -70], [0, 80], [0, -80]]) {
      const p = placerFlecheEcart({ x: 0, y: 0 }, { x: dx, y: dy });
      expect(p.angle).toBeGreaterThanOrEqual(-90);
      expect(p.angle).toBeLessThanOrEqual(90);
    }
    const bas = placerFlecheEcart({ x: 0, y: 0 }, { x: 70, y: 70 });
    expect(bas.angle).toBeCloseTo(45, 5);
    expect(bas.retourne).toBe(false);
    const hautGauche = placerFlecheEcart({ x: 0, y: 0 }, { x: -70, y: -70 });
    expect(hautGauche.angle).toBeCloseTo(45, 5);
    expect(hautGauche.retourne).toBe(true);
  });

  it('canne sur la ligne : pas de flèche', () => {
    expect(placerFlecheEcart({ x: 10, y: 10 }, { x: 10.2, y: 10.1 })).toBeNull();
  });

  it('0.232.0 : canne à moins d\'un pixel de la ligne mais avec une direction de repli : la flèche reste visible', () => {
    const p = placerFlecheEcart({ x: 10, y: 10 }, { x: 10.2, y: 10.1 }, 6, { x: 1, y: 0 });
    expect(p).toEqual({ x: 16, y: 10, angle: 0, retourne: false });
    const gauche = placerFlecheEcart({ x: 10, y: 10 }, { x: 10, y: 10 }, 6, { x: -3, y: 0 });
    expect(gauche.retourne).toBe(true);
    expect(gauche.x).toBeCloseTo(4, 5);
  });

  it('couleurs de la tolérance, neutre sinon', () => {
    expect(couleurFlecheEcart('vert')).toBe('#16a34a');
    expect(couleurFlecheEcart('orange')).toBe('#f59e0b');
    expect(couleurFlecheEcart('rouge')).toBe('#dc2626');
    expect(couleurFlecheEcart('pas-fiable')).toBe('#0f766e');
    expect(couleurFlecheEcart(undefined)).toBe('#0f766e');
  });
});
