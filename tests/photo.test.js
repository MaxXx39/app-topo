// Tests des photos : taille réduite, reconnaissance des photos HEIC.
import { describe, it, expect } from 'vitest';
import { tailleReduite, estPhotoHeic } from '../src/photos/photo.js';

describe('tailleReduite', () => {
  it('réduit le plus grand côté à la taille voulue, en gardant les proportions', () => {
    expect(tailleReduite(4000, 3000, 1600)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(tailleReduite(3000, 4000, 1600)).toEqual({ largeur: 1200, hauteur: 1600 });
  });

  it('ne grandit pas une image déjà petite', () => {
    expect(tailleReduite(800, 600, 1600)).toEqual({ largeur: 800, hauteur: 600 });
  });
});

describe('estPhotoHeic', () => {
  it('reconnaît une photo HEIC par son type, son extension ou sa marque', () => {
    expect(estPhotoHeic('photo.jpg', 'image/heic', '')).toBe(true);
    expect(estPhotoHeic('IMG_1234.HEIC', '', '')).toBe(true);
    expect(estPhotoHeic('20261020_101500.heif', '', '')).toBe(true);
    // Android donne parfois un nom sans extension et un type vide : la marque suffit.
    expect(estPhotoHeic('image', '', 'heic')).toBe(true);
    expect(estPhotoHeic('image', '', 'mif1')).toBe(true);
  });

  it('ne prend pas une photo JPEG ou PNG pour une photo HEIC', () => {
    expect(estPhotoHeic('photo.jpg', 'image/jpeg', '')).toBe(false);
    expect(estPhotoHeic('plan.png', 'image/png', '')).toBe(false);
    expect(estPhotoHeic('image', '', '')).toBe(false);
  });
});
