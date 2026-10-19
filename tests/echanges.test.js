// Tests des exports DXF et LandXML.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { creerStock, lireListeDeNoms } from '../src/topo/stocks.js';
import { calculerVolumeStock } from '../src/topo/volume.js';
import { lireLandXML, ecrireLandXML, resumerSurface } from '../src/topo/landxml.js';
import { genererDxf } from '../src/export/dxf.js';

const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
const noms = points.map((p) => p.nom);
const stock = creerStock('Stock 2');
stock.contour = lireListeDeNoms('b100 à b116', noms).noms;
stock.lignesRupture = [{ noms: lireListeDeNoms('h100 à h114', noms).noms, fermee: true }];
const resultat = calculerVolumeStock(stock, points);

describe('genererDxf', () => {
  const dxf = genererDxf({ points, stocks: [stock], resultats: [resultat], equidistance: 0.5 });
  const lignes = dxf.split('\r\n');
  const compter = (mot) => lignes.filter((l) => l === mot).length;

  it('contient un point et un nom par point levé', () => {
    expect(compter('POINT')).toBe(115);
    expect(compter('TEXT')).toBe(115);
  });

  it('contient une face 3D par triangle du stock et les polylignes 3D', () => {
    expect(compter('3DFACE')).toBe(resultat.nombreTrianglesDessus);
    expect(compter('POLYLINE')).toBe(2); // contour + ligne de rupture
    expect(compter('TRIANGLES_STOCK_2')).toBeGreaterThan(0);
  });

  it('écrit les coordonnées X = Est, Y = Nord, Z = altitude', () => {
    const i = lignes.indexOf('POINT');
    // Premier point du fichier : b1 2499349.955 1124567.410 427.654
    expect(lignes.slice(i + 3, i + 9)).toEqual(['10', '2499349.955', '20', '1124567.410', '30', '427.654']);
  });

  it('commence et finit correctement', () => {
    expect(lignes[1]).toBe('SECTION');
    expect(lignes.at(-2)).toBe('EOF');
    expect(compter('COURBES')).toBeGreaterThan(1);
  });
});

describe('ecrireLandXML', () => {
  it('se relit à l\'identique (triangles, surface, ordre Nord/Est)', () => {
    const texte = ecrireLandXML([{ nom: 'Stock 2 & dessus', triangles: resultat.trianglesDessus }], 'Essai');
    const { surfaces, erreurs } = lireLandXML(texte);
    expect(erreurs).toEqual([]);
    expect(surfaces[0].nom).toBe('Stock 2 & dessus');
    expect(surfaces[0].triangles).toHaveLength(resultat.nombreTrianglesDessus);
    expect(resumerSurface(surfaces[0]).surfacePlan).toBeCloseTo(resultat.surfacePlan, 3);
    const b100 = points.find((p) => p.nom === 'b100');
    expect(surfaces[0].points.find((p) => p.nom === 'b100')).toMatchObject({ est: b100.est, nord: b100.nord, altitude: b100.altitude });
  });
});
