// 0.212.0 : à l'ouverture d'un projet, le Métré et le Recollement sont retirés (avec leurs levés et mesures).
import { describe, expect, it } from 'vitest';
import { retirerMetreEtRecollement } from '../src/projet/retrait-metre-recollement.js';

function projetDeTest() {
  return {
    leves: [{ id: 'L1', nom: 'LV-Stock 1' }, { id: 'L2', nom: 'LV-Métré 1' }, { id: 'L3', nom: 'LV-Recoll 1' }, { id: 'L4', nom: 'LV-Libre 1' }],
    surfaces: [{ id: 'S1', leveId: 'L1' }],
    autres: [{ id: 'A1', leveId: 'L4' }],
    metres: [{ id: 'M1', leveId: 'L2' }],
    reseaux: [{ id: 'R1', leveId: 'L3' }],
    mesures: [{ id: 'X1', metreId: 'M1', leveId: 'L2' }, { id: 'X2', leveId: 'L1' }],
    archives: [
      { id: 'AR1', type: 'leve', contenu: { leves: [], metres: [{ id: 'M9' }], reseaux: [], mesures: [{ id: 'Y1', metreId: 'M9' }, { id: 'Y2' }] } },
      { id: 'AR2', type: 'metre', contenu: {} },
    ],
  };
}

describe('retirerMetreEtRecollement', () => {
  it('retire les métrés, les recollements, leurs mesures et leurs levés seuls', () => {
    const projet = projetDeTest();
    const bilan = retirerMetreEtRecollement(projet);
    expect(bilan).toEqual({ metres: 1, reseaux: 1, mesures: 1, leves: 2 });
    expect(projet.metres).toBeUndefined();
    expect(projet.reseaux).toBeUndefined();
    expect(projet.leves.map((l) => l.id)).toEqual(['L1', 'L4']);
    expect(projet.mesures.map((m) => m.id)).toEqual(['X2']);
  });

  it('garde un levé encore utilisé par une surface ou un levé libre', () => {
    const projet = projetDeTest();
    projet.surfaces.push({ id: 'S2', leveId: 'L2' });
    retirerMetreEtRecollement(projet);
    expect(projet.leves.map((l) => l.id)).toEqual(['L1', 'L2', 'L4']);
  });

  it('nettoie les archives et retire les archives de métré ou de recollement', () => {
    const projet = projetDeTest();
    retirerMetreEtRecollement(projet);
    expect(projet.archives.map((a) => a.id)).toEqual(['AR1']);
    expect(projet.archives[0].contenu.metres).toBeUndefined();
    expect(projet.archives[0].contenu.reseaux).toBeUndefined();
    expect(projet.archives[0].contenu.mesures.map((m) => m.id)).toEqual(['Y2']);
  });

  it('ne fait rien sur un projet sans métré ni recollement', () => {
    const projet = { leves: [{ id: 'L1' }], surfaces: [], mesures: [], archives: [] };
    expect(retirerMetreEtRecollement(projet)).toEqual({ metres: 0, reseaux: 0, mesures: 0, leves: 0 });
    expect(projet.leves).toEqual([{ id: 'L1' }]);
  });

  it('garde les anciens « Recollement (ancien) » : surfaces rangées en Terrain', () => {
    const projet = { leves: [], surfaces: [{ id: 'S9', nature: 'recollement' }, { id: 'S8', nature: 'stock' }], mesures: [], archives: [] };
    retirerMetreEtRecollement(projet);
    expect(projet.surfaces.map((s) => s.nature)).toEqual(['terrain', 'stock']);
  });
});
