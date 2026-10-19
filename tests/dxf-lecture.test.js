// Tests de la lecture des surfaces DXF (faces 3D).
import { describe, it, expect } from 'vitest';
import { lireDXF } from '../src/topo/dxf-lecture.js';
import { genererDxf } from '../src/export/dxf.js';

const pt = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });

/** Petit DXF écrit à la main : une section ENTITIES avec les entités données (listes code, valeur...). */
const dxf = (...entites) => ['0', 'SECTION', '2', 'ENTITIES', ...entites.flat(), '0', 'ENDSEC', '0', 'EOF'].join('\n');

describe('lireDXF', () => {
  it('relit les faces 3D écrites par l\'export DXF de l\'appli (une surface par calque)', () => {
    const a = pt('a', 2600000, 1200000, 400);
    const b = pt('b', 2600010, 1200000, 401);
    const c = pt('c', 2600010, 1200010, 402);
    const d = pt('d', 2600000, 1200010, 403);
    const texte = genererDxf({ points: [], surfaces: [{ nom: 'Terrain', triangles: [[a, b, c], [a, c, d]] }] });
    const { surfaces, erreurs } = lireDXF(texte);
    expect(erreurs).toEqual([]);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].nom).toBe('SURFACE_TERRAIN');
    expect(surfaces[0].triangles).toHaveLength(2);
    // Les sommets communs sont partagés : 4 points pour 2 triangles.
    expect(surfaces[0].points).toHaveLength(4);
    expect(surfaces[0].triangles[0][2]).toMatchObject({ est: 2600010, nord: 1200010, altitude: 402 });
  });

  it('coupe une face à 4 sommets en 2 triangles et ignore une face verticale', () => {
    const texte = dxf(
      ['0', '3DFACE', '8', 'TN', '10', '0', '20', '0', '30', '1', '11', '10', '21', '0', '31', '1', '12', '10', '22', '10', '32', '2', '13', '0', '23', '10', '33', '2'],
      // Face verticale : tous les sommets sur la même ligne en plan
      ['0', '3DFACE', '8', 'TN', '10', '0', '20', '0', '30', '0', '11', '5', '21', '0', '31', '3', '12', '10', '22', '0', '32', '0', '13', '10', '23', '0', '33', '0'],
    );
    const { surfaces, avertissements } = lireDXF(texte);
    expect(surfaces[0].triangles).toHaveLength(2);
    expect(avertissements.join()).toContain('1 face(s) verticale(s)');
  });

  it('lit un maillage polyface', () => {
    const vertex = (x, y, z) => ['0', 'VERTEX', '8', 'MNT', '10', x, '20', y, '30', z, '70', '192'];
    const face = (...numeros) => ['0', 'VERTEX', '8', 'MNT', '10', '0', '20', '0', '30', '0', '70', '128', ...numeros.flatMap((n, i) => [String(71 + i), String(n)])];
    const texte = dxf(
      ['0', 'POLYLINE', '8', 'MNT', '66', '1', '70', '64', '71', '4', '72', '2'],
      vertex('0', '0', '5'), vertex('10', '0', '5'), vertex('10', '10', '6'), vertex('0', '10', '6'),
      face(1, 2, 3), face(1, 3, -4),
      ['0', 'SEQEND', '8', 'MNT'],
    );
    const { surfaces, erreurs } = lireDXF(texte);
    expect(erreurs).toEqual([]);
    expect(surfaces[0].nom).toBe('MNT');
    expect(surfaces[0].triangles).toHaveLength(2);
    expect(surfaces[0].points).toHaveLength(4);
  });

  it('explique quand il n\'y a aucune face 3D, ou un DXF binaire', () => {
    expect(lireDXF(dxf(['0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1', '21', '1'])).erreurs[0]).toContain('aucune face 3D');
    expect(lireDXF('AutoCAD Binary DXF\r\n...').erreurs[0]).toContain('binaire');
  });
});
