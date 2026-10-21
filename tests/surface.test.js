// Tests des surfaces créées à partir de points.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { lireListeDeNoms } from '../src/topo/noms.js';
import { lireLandXML, resumerSurface } from '../src/topo/landxml.js';
import { creerSurface, calculerSurface, cleTriangle, surfaceImportee, pointsIsolesAutomatiques } from '../src/topo/surface.js';

const pt = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });
const aire = (triangles) =>
  triangles.reduce((s, [a, b, c]) => s + Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2, 0);

// Carré de 10 m avec un point au centre : 4 triangles, 100 m².
const carre = [pt('a', 0, 0, 0), pt('b', 10, 0, 0), pt('c', 10, 10, 0), pt('d', 0, 10, 0), pt('m', 5, 5, 2)];

describe('calculerSurface', () => {
  it('triangule tous les points du levé (bord automatique)', () => {
    const { triangles } = calculerSurface(creerSurface('Terrain', 'l1'), carre);
    expect(triangles).toHaveLength(4);
    expect(aire(triangles)).toBeCloseTo(100, 9);
  });

  it('retire les triangles supprimés à la main, et peut les rétablir', () => {
    const surface = creerSurface('Terrain', 'l1');
    const [premier] = calculerSurface(surface, carre).triangles;
    surface.trianglesSupprimes = [cleTriangle(premier)];
    const resultat = calculerSurface(surface, carre);
    expect(resultat.triangles).toHaveLength(3);
    expect(resultat.trianglesRetires).toHaveLength(1);
    expect(aire(resultat.triangles)).toBeCloseTo(75, 9);
    surface.trianglesSupprimes = [];
    expect(calculerSurface(surface, carre).triangles).toHaveLength(4);
  });

  it('la clé d\'un triangle ne dépend pas de l\'ordre des sommets', () => {
    expect(cleTriangle([carre[0], carre[1], carre[4]])).toBe(cleTriangle([carre[4], carre[0], carre[1]]));
  });

  it('respecte un contour choisi (stock 1 en « L » : creux non triangulé)', () => {
    const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
    const noms = points.map((p) => p.nom);
    const surface = creerSurface('Stock 1', 'l1');
    surface.tousLesPoints = false;
    surface.contour = lireListeDeNoms('b1 à b17', noms).noms;
    surface.lignesRupture = [{ noms: lireListeDeNoms('h1 à h31', noms).noms, fermee: true }];
    const { triangles, erreurs } = calculerSurface(surface, points);
    expect(erreurs).toBeUndefined();
    // Même surface que le calcul de volume du stock 1 (758.638 m²)
    expect(aire(triangles)).toBeCloseTo(758.638, 3);
  });

  it('ignore un point en double (même position) avec un avertissement', () => {
    const { triangles, avertissements } = calculerSurface(creerSurface('T', 'l1'), [...carre, pt('m2', 5, 5, 2.1)]);
    expect(triangles).toHaveLength(4);
    expect(avertissements[0]).toContain('m2');
  });

  it('signale les lignes de rupture qui se croisent', () => {
    const surface = creerSurface('T', 'l1');
    surface.lignesRupture = [
      { noms: ['a', 'c'], fermee: false },
      { noms: ['b', 'd'], fermee: false },
    ];
    expect(calculerSurface(surface, carre).erreurs[0]).toContain('se croisent');
  });
});

describe('surfaceImportee', () => {
  it('range une surface LandXML dans le projet sans perdre de triangle', () => {
    const texte = readFileSync(new URL('../exemples/3D SUR Tapis AC11.xml', import.meta.url), 'utf-8');
    const [lue] = lireLandXML(texte).surfaces;
    const rangee = JSON.parse(JSON.stringify(surfaceImportee(lue, 'tapis.xml')));
    const { triangles } = calculerSurface(rangee, []);
    expect(triangles).toHaveLength(506);
    expect(aire(triangles)).toBeCloseTo(resumerSurface(lue).surfacePlan, 6);
  });
});

describe('pointsIsolesAutomatiques', () => {
  // Carré de 10 m (contour c1 à c4), un point de ligne au milieu, un point isolé dedans, un dehors.
  const points = [
    pt('c1', 0, 0, 1), pt('c2', 10, 0, 1), pt('c3', 10, 10, 1), pt('c4', 0, 10, 1),
    pt('h1', 5, 5, 3), pt('i1', 2, 2, 2), pt('loin', 50, 50, 1),
  ];

  it('avec un contour : les points dedans, sans ceux du contour ni des lignes de rupture', () => {
    const surface = { ...creerSurface('Stock 1', 'leve', 'stock'), contour: ['c1', 'c2', 'c3', 'c4'], lignesRupture: [{ noms: ['h1'], fermee: false }] };
    expect(pointsIsolesAutomatiques(surface, points)).toEqual(['i1']);
  });

  it('sans contour : tous les points du levé (hors lignes de rupture)', () => {
    const surface = creerSurface('Stock 1', 'leve', 'stock');
    expect(pointsIsolesAutomatiques(surface, points)).toEqual(['c1', 'c2', 'c3', 'c4', 'h1', 'i1', 'loin']);
  });
});
