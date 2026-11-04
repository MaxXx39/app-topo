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
  it('fabrique un ZIP avec le DXF', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: true, swisstopo: true, photo: false }, aides);
    expect(r.erreur).toBeUndefined();
    expect(r.nom.endsWith('.zip')).toBe(true);
    const octets = new Uint8Array(await r.blob.arrayBuffer());
    expect(String.fromCharCode(...octets.slice(0, 2))).toBe('PK');
    const texte = new TextDecoder('latin1').decode(octets);
    expect(texte).toContain('CADASTRE_LIGNES');
    expect(texte).toContain('SWISSTOPO_3D');
  });
  it('refuse quand rien n\'est coché', async () => {
    const r = await fabriquerPaquet(projet, { cadastre: false, swisstopo: false, photo: true }, aides);
    expect(r.erreur).toMatch(/Rien à exporter/);
  });
});
