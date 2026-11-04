import { describe, it, expect } from 'vitest';
import { genererDxfPaquet, entitesDeDxf } from '../src/export/pack-dxf.js';
import { genererDxfPlan } from '../src/export/dxf-recale.js';

const plan = {
  origine: { est: 2500000, nord: 1100000 },
  calques: [{ nom: 'Limites', couleur: '#ff0000' }, { nom: 'Autre', couleur: '#00ff00' }],
  contenu: { traits: [{ c: 0, p: [0, 0, 10, 0, 10, 10] }, { c: 1, p: [0, 0, 5, 5] }] },
};
const leve = { points: [{ nom: 'CAD-1', est: 2500001, nord: 1100001, altitude: null }] };
const tri = [{ est: 2500000, nord: 1100000, altitude: 400 }, { est: 2500010, nord: 1100000, altitude: 401 }, { est: 2500000, nord: 1100010, altitude: 402 }];

describe('DXF cadastre + swisstopo', () => {
  it('extrait les entités d\'un DXF', () => {
    const lignes = entitesDeDxf(genererDxfPlan(plan));
    expect(lignes[0]).toBe('0');
    expect(lignes[1]).toBe('POLYLINE');
    expect(lignes.at(-1)).not.toBe('0');
  });
  it('un calque par élément', () => {
    const texte = genererDxfPaquet({ cadastres: [{ leve, plan }], swisstopo: [{ triangles: [tri] }] });
    for (const nom of ['CADASTRE_LIGNES', 'CADASTRE_POINTS', 'CADASTRE_NOMS', 'SWISSTOPO_3D']) expect(texte).toContain(nom);
    expect(texte).not.toContain('LIMITES');
    expect(texte).toContain('3DFACE');
    expect(texte).toContain('2500001.000');
    expect(texte.trimEnd().endsWith('EOF')).toBe(true);
  });
  it('pas de calque vide', () => {
    const texte = genererDxfPaquet({ swisstopo: [{ triangles: [tri] }] });
    expect(texte).toContain('SWISSTOPO_3D');
    expect(texte).not.toContain('CADASTRE');
  });
});
