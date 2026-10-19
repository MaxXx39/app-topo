// Tests du placement des étiquettes sur le plan.
import { describe, it, expect } from 'vitest';
import { placerEtiquettes, pointInterieur } from '../src/plan/etiquettes.js';
import { pointDansPolygone } from '../src/topo/volume.js';

describe('placerEtiquettes', () => {
  it('place une étiquette seule à droite au-dessus du point', () => {
    expect(placerEtiquettes([{ x: 100, y: 100, largeur: 30, hauteur: 12 }])).toEqual([{ x: 105, y: 95, aGauche: false }]);
  });

  it('déplace la 2e étiquette à gauche si la droite est prise', () => {
    const [premiere, deuxieme] = placerEtiquettes([
      { x: 100, y: 100, largeur: 30, hauteur: 12 },
      { x: 102, y: 100, largeur: 30, hauteur: 12 },
    ]);
    expect(premiere.aGauche).toBe(false);
    expect(deuxieme.aGauche).toBe(true);
  });

  it('cache une étiquette quand il n\'y a plus de place', () => {
    const memePoint = { x: 100, y: 100, largeur: 30, hauteur: 12 };
    const resultat = placerEtiquettes([memePoint, memePoint, memePoint, memePoint, memePoint]);
    expect(resultat.filter((r) => r === null)).toHaveLength(1);
  });
});

describe('pointInterieur', () => {
  it('reste dans un stock en forme de « L »', () => {
    // L : carré 0-20 en bas, puis carré 0-10 en haut à gauche. Le centre de gravité
    // tombe près du coin intérieur ; le point choisi doit être dans le L.
    const p = (est, nord) => ({ est, nord });
    const triangles = [
      [p(0, 0), p(20, 0), p(20, 10)],
      [p(0, 0), p(20, 10), p(10, 10)],
      [p(0, 0), p(10, 10), p(0, 10)],
      [p(0, 10), p(10, 10), p(10, 20)],
      [p(0, 10), p(10, 20), p(0, 20)],
    ];
    const contour = [p(0, 0), p(20, 0), p(20, 10), p(10, 10), p(10, 20), p(0, 20)];
    expect(pointDansPolygone(pointInterieur(triangles), contour)).toBe(true);
  });

  it('renvoie null sans triangle', () => {
    expect(pointInterieur([])).toBeNull();
  });
});
