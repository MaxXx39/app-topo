// Tests des photos : taille réduite.
import { describe, it, expect } from 'vitest';
import { tailleReduite } from '../src/photos/photo.js';

describe('tailleReduite', () => {
  it('réduit le plus grand côté à la taille voulue, en gardant les proportions', () => {
    expect(tailleReduite(4000, 3000, 1600)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(tailleReduite(3000, 4000, 1600)).toEqual({ largeur: 1200, hauteur: 1600 });
  });

  it('ne grandit pas une image déjà petite', () => {
    expect(tailleReduite(800, 600, 1600)).toEqual({ largeur: 800, hauteur: 600 });
  });
});
