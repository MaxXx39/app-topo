import { describe, it, expect } from 'vitest';
import { fabriquerPaquet } from '../src/export/paquet.js';

const projet = {
  nom: 'Essai',
  leves: [
    { id: 'c1', nom: 'Cadastre 1', cadastre: true, points: [{ nom: 'CAD-1', est: 2500001, nord: 1100001, altitude: null }] },
    { id: 's1', nom: 'SWISSTOP 1', points: [] },
  ],
  plansDxf: [{ cadastre: 'c1', origine: { est: 2500000, nord: 1100000 }, calques: [{ nom: 'x' }], contenu: { traits: [{ c: 0, p: [0, 0, 5, 5] }] } }],
  surfaces: [{ id: 'surf', type: 'swisstopo', leveId: 's1' }],
};
const tri = [[{ est: 2500000, nord: 1100000, altitude: 400 }, { est: 2500010, nord: 1100000, altitude: 401 }, { est: 2500000, nord: 1100010, altitude: 402 }]];
const aides = { trianglesDe: () => tri, pointsDe: () => [] };

describe('ZIP cadastre + swisstopo', () => {
  const pointsSurface = [{ nom: 'SW-1', est: 2500000, nord: 1100000, altitude: 400 }];
  const aidesTxt = { trianglesDe: () => tri, pointsDe: () => pointsSurface };
  const lire = async (r) => new TextDecoder('latin1').decode(new Uint8Array(await r.blob.arrayBuffer()));

  it('au départ : lignes du cadastre en DXF (sans points), surface en TXT', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: true, swisstopo: true, photo: false }, aidesTxt);
    expect(r.erreur).toBeUndefined();
    const texte = await lire(r);
    expect(texte.startsWith('PK')).toBe(true);
    expect(texte).toContain('CADASTRE_LIGNES');
    expect(texte).not.toContain('CADASTRE_POINTS');
    expect(texte).not.toContain('SWISSTOPO_3D');
    expect(texte).toContain('_swisstopo_points.txt');
    expect(texte).toContain('SW-1');
  });
  it('TXT : tous les points de la surface (ID, X, Y, Z séparés par des tabulations)', async () => {
    const surfaces = [{ id: 'sw', type: 'swisstopo', points: [{ nom: 'SW-1', est: 2500000.5, nord: 1100000, altitude: 400.25 }, { nom: 'SW-2', est: 2500010, nord: 1100005.125, altitude: 401 }] }];
    const projetSw = { ...projet, leves: [], surfaces };
    // Comme main.js : les points sont ceux de la surface elle-même.
    const r = await fabriquerPaquet(projetSw, { cadastre: false, swisstopo: true, photo: false }, { trianglesDe: () => [], pointsDe: (s) => s.points });
    const octets = new Uint8Array(await r.blob.arrayBuffer());
    const texte = new TextDecoder('latin1').decode(octets);
    expect(texte).toContain('SW-1\t2500000.500\t1100000.000\t400.250');
    expect(texte).toContain('SW-2\t2500010.000\t1100005.125\t401.000');
  });
  it('points du cadastre sur demande', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: true, cadastrePoints: true, swisstopo: false, photo: false }, aidesTxt);
    expect(await lire(r)).toContain('CADASTRE_POINTS');
  });
  it('surface en DXF sur demande', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: false, swisstopo: true, formatSurface: 'dxf', photo: false }, aidesTxt);
    const texte = await lire(r);
    expect(texte).toContain('SWISSTOPO_3D');
    expect(texte).not.toContain('_swisstopo_points.txt');
  });
  it('refuse quand rien n\'est coché', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: false, swisstopo: false, photo: true }, aidesTxt);
    expect(r.erreur).toMatch(/Rien à exporter/);
  });
});
