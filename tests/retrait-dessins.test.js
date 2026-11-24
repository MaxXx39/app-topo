// Suppression de Calculs › Dessin (0.300.0) : à l'ouverture, les dessins et ce qui ne servait qu'à eux sont retirés.
import { describe, it, expect } from 'vitest';
import { retirerDessins } from '../src/projet/retrait-dessins.js';
import { completerProjet, creerProjet } from '../src/projet/projet.js';

const projetAvecDessins = () => ({
  dessins: [{ id: 'd1', nom: 'D1', sommets: [] }, { id: 'd2', nom: 'D2', sommets: [] }],
  surfaces: [
    { id: 's1', type: 'dessin', dessinId: 'd1', nom: 'Surf-D1', points: [], faces: [] },
    { id: 's2', type: 'points', dessinId: 'd2', leveId: 'l2', nom: 'Surf-D2' },
    { id: 's3', type: 'landxml', nom: 'Surf-Terrain', points: [], faces: [] },
  ],
  leves: [{ id: 'l1', nom: 'LV-Stock', points: [] }, { id: 'l2', nom: 'LV-Surface D2', points: [], dediee: true }],
  leveActifId: 'l2',
  calculs: [{ id: 'c1', surface1Id: 's1', surface2Id: 's3' }, { id: 'c2', surface1Id: 's3', surface2Id: null }],
  archives: [{ id: 'a1', type: 'dessin', contenu: {} }, { id: 'a2', type: 'leve', contenu: { dessins: [{ id: 'x' }] } }],
});

describe('retrait des dessins', () => {
  it('dessins, leurs surfaces, leurs levés dédiés et leurs calculs retirés ; le reste gardé', () => {
    const p = projetAvecDessins();
    expect(retirerDessins(p)).toEqual({ dessins: 2, surfaces: 2, leves: 1, calculs: 1 });
    expect(p.dessins).toEqual([]);
    expect(p.surfaces.map((s) => s.id)).toEqual(['s3']);
    expect(p.leves.map((l) => l.id)).toEqual(['l1']);
    expect(p.leveActifId).toBe('l1');
    expect(p.calculs.map((c) => c.id)).toEqual(['c2']);
    expect(p.archives.map((a) => a.id)).toEqual(['a2']);
    expect(p.archives[0].contenu.dessins).toBeUndefined();
  });
  it('à l\'ouverture d\'un projet (completerProjet) ; plateformes ajoutées', () => {
    const p = completerProjet({ ...creerProjet('Essai'), ...projetAvecDessins() });
    expect(p.dessins).toEqual([]);
    expect(p.surfaces.map((s) => s.id)).toEqual(['s3']);
    expect(p.plateformes).toEqual([]);
    expect(p.constructionsPlateformes).toEqual([]);
  });
  it('projet sans dessin : rien ne change', () => {
    const p = { surfaces: [{ id: 's3', type: 'landxml' }], leves: [], calculs: [] };
    expect(retirerDessins(p)).toEqual({ dessins: 0, surfaces: 0, leves: 0, calculs: 0 });
    expect(p.surfaces).toHaveLength(1);
  });
});
