import { describe, it, expect } from 'vitest';
import { retirerPointDuProjet, retirerPointDesMesures, texteUsages, usagesDuPoint } from '../src/topo/retirer-point.js';

/** Petit projet : une liste LV-1 (A, B, C) utilisée par une surface, un chantier et deux mesures. */
function projetDeTest() {
  const leve = { id: 'l1', nom: 'LV-1', points: [{ nom: 'A' }, { nom: 'B' }, { nom: 'C' }] };
  return {
    leve,
    projet: {
      leves: [leve],
      surfaces: [{ id: 's1', leveId: 'l1', contour: ['A', 'B', 'C'], points: ['B'], lignesRupture: [{ noms: ['A', 'B'] }], photos: [{ id: 'p1', point: 'B' }, { id: 'p2', point: null }] }],
      autres: [{ id: 'a1', leveId: 'l2', points: [], cadres: [{ noms: ['B', 'C'] }, { noms: ['B'] }] }],
      mesures: [
        { id: 'm1', contour: ['A', 'B'], points: [], lignesRupture: [] },
        { id: 'm2', contour: [], points: ['B'], lignesRupture: [] },
      ],
    },
  };
}

describe('retirer un point de n\'importe quelle liste (0.209.0)', () => {
  it('compte où le point sert', () => {
    const { projet, leve } = projetDeTest();
    expect(usagesDuPoint(projet, leve, 'B')).toEqual({ contours: 1, lignes: 1, isoles: 1, cadres: 2, mesures: 2, photos: 1 });
    expect(usagesDuPoint(projet, leve, 'C').contours).toBe(1);
    expect(texteUsages(usagesDuPoint(projet, leve, 'B'))).toBe('1 contour, 1 ligne de rupture, 1 liste de points choisis, 2 cadres de chantier, 2 mesures, 1 photo');
  });

  it('un point qui ne sert nulle part : texte vide', () => {
    const projet = { leves: [], surfaces: [], autres: [], mesures: [] };
    const leve = { id: 'l1', points: [{ nom: 'Z' }] };
    expect(texteUsages(usagesDuPoint(projet, leve, 'Z'))).toBe('');
  });

  it('retire le point de la liste et de tout ce qui l\'utilise', () => {
    const { projet, leve } = projetDeTest();
    expect(retirerPointDuProjet(projet, leve, 'B')).toBe(true);
    expect(leve.points.map((p) => p.nom)).toEqual(['A', 'C']);
    const surface = projet.surfaces[0];
    expect(surface.contour).toEqual(['A', 'C']);
    expect(surface.points).toEqual([]);
    expect(surface.lignesRupture[0].noms).toEqual(['A']);
    expect(surface.photos.map((p) => p.id)).toEqual(['p2']); // la photo du point part, celle de tout le levé reste
    expect(projet.autres[0].cadres).toEqual([{ noms: ['C'] }]); // le cadre resté vide disparaît
    expect(projet.mesures[0].contour).toEqual(['A']); // le point sort des mesures
    expect(projet.mesures[1].points).toEqual([]);
  });

  it('un point inconnu : rien ne change', () => {
    const { projet, leve } = projetDeTest();
    expect(retirerPointDuProjet(projet, leve, 'Inconnu')).toBe(false);
    expect(leve.points).toHaveLength(3);
  });

  it('retirerPointDesMesures : le point sort du contour, des points et des lignes des mesures', () => {
    const projet = { mesures: [{ contour: ['A', 'B'], points: ['B', 'C'], lignesRupture: [{ noms: ['B', 'D'] }] }] };
    retirerPointDesMesures(projet, 'B');
    expect(projet.mesures[0]).toEqual({ contour: ['A'], points: ['C'], lignesRupture: [{ noms: ['D'] }] });
  });
});
