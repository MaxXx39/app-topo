// Tests des courbes de niveau et des bandes de couleur.
import { describe, it, expect } from 'vitest';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../src/topo/courbes.js';
import { airePolygone } from '../src/topo/volume.js';

const pt = (est, nord, altitude) => ({ est, nord, altitude });

// Pyramide : base carrée 10 m × 10 m à 0 m, sommet au centre à 3 m (4 triangles).
const sommet = pt(5, 5, 3);
const pyramide = [
  [pt(0, 0, 0), pt(10, 0, 0), sommet],
  [pt(10, 0, 0), pt(10, 10, 0), sommet],
  [pt(10, 10, 0), pt(0, 10, 0), sommet],
  [pt(0, 10, 0), pt(0, 0, 0), sommet],
];
const longueur = (s) => Math.hypot(s.b.est - s.a.est, s.b.nord - s.a.nord);

describe('courbesDeNiveau', () => {
  it('courbe à mi-hauteur d\'une pyramide : un carré de 5 m de côté (20 m de long)', () => {
    const segments = courbesDeNiveau(pyramide, 1.5).filter((s) => s.altitude === 1.5);
    expect(segments).toHaveLength(4);
    expect(segments.reduce((total, s) => total + longueur(s), 0)).toBeCloseTo(20, 9);
  });

  it('ne dessine pas deux fois un côté posé pile sur une courbe', () => {
    // Deux triangles qui partagent le côté (0,0)-(10,0) à 0 m : un monte, l'autre descend.
    const triangles = [
      [pt(0, 0, 0), pt(10, 0, 0), pt(5, 5, 1)],
      [pt(10, 0, 0), pt(0, 0, 0), pt(5, -5, -1)],
    ];
    const aZero = courbesDeNiveau(triangles, 1).filter((s) => s.altitude === 0);
    expect(aZero).toHaveLength(1);
    expect(longueur(aZero[0])).toBeCloseTo(10, 9);
  });

  it('donne des altitudes rondes', () => {
    const altitudes = new Set(courbesDeNiveau(pyramide, 0.1).map((s) => s.altitude));
    expect(altitudes.has(0.3)).toBe(true);
  });
});

describe('bandesDeNiveau', () => {
  it('les bandes recouvrent exactement la surface de la pyramide (100 m²)', () => {
    const bandes = bandesDeNiveau(pyramide, 1);
    const aireTotale = bandes.reduce((total, b) => total + Math.abs(airePolygone(b.polygone)), 0);
    expect(aireTotale).toBeCloseTo(100, 9);
  });

  it('la bande du bas (0 à 1.5 m) fait 100 - 25 = 75 m²', () => {
    const bas = bandesDeNiveau(pyramide, 1.5).filter((b) => b.altitude === 0);
    expect(bas.reduce((total, b) => total + Math.abs(airePolygone(b.polygone)), 0)).toBeCloseTo(75, 9);
  });
});

describe('equidistanceAuto et plageAltitudes', () => {
  it('choisit une équidistance ronde', () => {
    expect(equidistanceAuto(426.8, 429.6)).toBe(0.25); // 2.8 m -> environ 11 courbes
    expect(equidistanceAuto(0, 100)).toBe(10);
  });

  it('trouve les altitudes extrêmes', () => {
    expect(plageAltitudes(pyramide)).toEqual({ min: 0, max: 3 });
  });
});
