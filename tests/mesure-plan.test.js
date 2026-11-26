import { describe, it, expect } from 'vitest';
import { resultatMesure } from '../src/topo/mesure-plan.js';

describe('mesure rapide du plan de chantier', () => {
  it('longueur : 3-4-5 donne 5 m, puis le total d\'une ligne', () => {
    expect(resultatMesure('longueur', [[0, 0], [3, 4]]).lignes).toEqual(['Longueur : 5.000 m']);
    expect(resultatMesure('longueur', [[0, 0], [3, 4], [3, 14]]).lignes).toEqual(['Longueur : 15.000 m', 'Dernier côté : 10.000 m']);
  });
  it('angle : coin droit = 90°, au sommet du 2e point', () => {
    expect(resultatMesure('angle', [[0, 10], [0, 0], [10, 0]]).lignes).toEqual(['Angle : 90.00°']);
    expect(resultatMesure('angle', [[10, 0], [0, 0], [10, 10]]).lignes).toEqual(['Angle : 45.00°']);
  });
  it('surface : carré de 10 m', () => {
    expect(resultatMesure('surface', [[0, 0], [10, 0], [10, 10], [0, 10]]).lignes).toEqual(['Surface : 100.00 m²', 'Périmètre : 40.000 m']);
  });
  it('pas assez de points : rien à lire (jamais -0.000)', () => {
    expect(resultatMesure('longueur', [[0, 0]]).lignes).toEqual([]);
    expect(resultatMesure('angle', [[0, 0], [1, 1]]).lignes).toEqual([]);
    expect(resultatMesure('surface', [[0, 0], [1, 1]]).lignes).toEqual([]);
    expect(resultatMesure('longueur', [[1, 1], [1, 1]]).lignes).toEqual(['Longueur : 0.000 m']);
  });
});
