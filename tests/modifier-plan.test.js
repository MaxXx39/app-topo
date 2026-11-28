import { describe, it, expect } from 'vitest';
import { prolongerPolyligne, ajusterPolyligne } from '../src/topo/modifier-plan.js';

describe('Prolonger', () => {
  it('prolonge le bout le plus proche jusqu\'à une droite', () => {
    const r = prolongerPolyligne([[0, 0], [10, 0]], [20, 5], [[15, -5], [15, 5]]);
    expect(r).toEqual([[0, 0], [15, 0]]);
  });
  it('prolonge le début quand le clic est de son côté', () => {
    const r = prolongerPolyligne([[0, 0], [10, 0]], [-20, 3], [[-4, -5], [-4, 5]]);
    expect(r).toEqual([[-4, 0], [10, 0]]);
  });
  it('sans droite : jusqu\'au pied du clic', () => {
    expect(prolongerPolyligne([[0, 0], [10, 0]], [18, 7])).toEqual([[0, 0], [18, 0]]);
  });
  it('refuse une droite parallèle ou déjà dépassée', () => {
    expect(prolongerPolyligne([[0, 0], [10, 0]], [20, 5], [[0, 3], [10, 3]])).toBeNull();
    expect(prolongerPolyligne([[0, 0], [10, 0]], [20, 5], [[5, -5], [5, 5]])).toBeNull();
  });
});

describe('Ajuster', () => {
  it('coupe à la droite et enlève le bout du côté du clic', () => {
    expect(ajusterPolyligne([[0, 0], [10, 0]], [8, 3], [[6, -5], [6, 5]])).toEqual([[0, 0], [6, 0]]);
    expect(ajusterPolyligne([[0, 0], [10, 0]], [2, 3], [[6, -5], [6, 5]])).toEqual([[6, 0], [10, 0]]);
  });
  it('sur une ligne brisée : garde les points d\'avant la coupe', () => {
    const r = ajusterPolyligne([[0, 0], [10, 0], [10, 10]], [10, 12], [[5, 5], [15, 5]]);
    expect(r).toEqual([[0, 0], [10, 0], [10, 5]]);
  });
  it('sans droite : coupe au point le plus proche du clic', () => {
    expect(ajusterPolyligne([[0, 0], [10, 0]], [7, 1])).toEqual([[0, 0], [7, 0]]);
  });
  it('rien si la droite ne traverse pas', () => {
    expect(ajusterPolyligne([[0, 0], [10, 0]], [8, 3], [[20, -5], [20, 5]])).toBeNull();
  });
});
