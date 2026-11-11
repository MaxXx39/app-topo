import { describe, it, expect } from 'vitest';
import { retirerPointDuProjet, texteUsages, usagesDuPoint } from '../src/topo/retirer-point.js';
import { annulerDernierPointReseau, retirerPointReseau } from '../src/topo/reseau.js';

/** Petit projet : une liste LV-1 (A, B, C) utilisée par une surface, un chantier, deux mesures et un recollement. */
function projetDeTest() {
  const leve = { id: 'l1', nom: 'LV-1', points: [{ nom: 'A' }, { nom: 'B' }, { nom: 'C' }] };
  return {
    leve,
    projet: {
      leves: [leve],
      surfaces: [{ id: 's1', leveId: 'l1', contour: ['A', 'B', 'C'], points: ['B'], lignesRupture: [{ noms: ['A', 'B'] }], photos: [{ id: 'p1', point: 'B' }, { id: 'p2', point: null }] }],
      metres: [],
      autres: [{ id: 'a1', leveId: 'l2', points: [], cadres: [{ noms: ['B', 'C'] }, { noms: ['B'] }] }],
      mesures: [
        { id: 'm1', contour: ['A', 'B'], points: [], lignesRupture: [] },
        { id: 'm2', metreId: 'x', contour: [], points: ['B'], lignesRupture: [] },
      ],
      reseaux: [{ id: 'r1', leveId: 'l3', conduites: [{ noeuds: [{ point: 'A' }, { point: 'B' }] }], ouvrages: [{ id: 'o1', points: ['B'], forme: 'ronde' }], enCours: { ouvrage: null } }],
    },
  };
}

describe('retirer un point de n\'importe quelle liste (0.209.0)', () => {
  it('compte où le point sert', () => {
    const { projet, leve } = projetDeTest();
    expect(usagesDuPoint(projet, leve, 'B')).toEqual({ contours: 1, lignes: 1, isoles: 1, cadres: 2, mesures: 2, recollements: 1, photos: 1 });
    expect(usagesDuPoint(projet, leve, 'C').contours).toBe(1);
    expect(texteUsages(usagesDuPoint(projet, leve, 'B'))).toBe('1 contour, 1 ligne de rupture, 1 liste de points choisis, 2 cadres de chantier, 2 mesures, 1 recollement, 1 photo');
  });

  it('un point qui ne sert nulle part : texte vide', () => {
    const projet = { leves: [], surfaces: [], metres: [], autres: [], mesures: [], reseaux: [] };
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
    expect(projet.mesures.map((m) => m.id)).toEqual(['m1']); // la mesure de métré restée vide disparaît
    expect(projet.mesures[0].contour).toEqual(['A']);
    expect(projet.reseaux[0].conduites[0].noeuds).toEqual([{ point: 'A' }]);
    expect(projet.reseaux[0].ouvrages).toEqual([]);
  });

  it('un point inconnu : rien ne change', () => {
    const { projet, leve } = projetDeTest();
    expect(retirerPointDuProjet(projet, leve, 'Inconnu')).toBe(false);
    expect(leve.points).toHaveLength(3);
  });

  it('recollement : « dernier point annulé » donne le même résultat qu\'avant', () => {
    const recollement = { conduites: [{ noeuds: [{ point: 'A' }, { point: 'B' }] }], ouvrages: [{ id: 'o1', points: ['B'], forme: 'ronde' }], enCours: { ouvrage: 'o1' } };
    const leve = { points: [{ nom: 'A' }, { nom: 'B' }] };
    expect(annulerDernierPointReseau(recollement, leve).nom).toBe('B');
    expect(leve.points).toHaveLength(1);
    expect(recollement.ouvrages).toEqual([]);
    expect(recollement.enCours.ouvrage).toBeNull();
    // Une chambre rectangulaire redevient incomplète quand on retire un de ses coins.
    const rect = { conduites: [], ouvrages: [{ id: 'o2', points: ['P1', 'P2', 'P3'], forme: 'rect', centre: { est: 1, nord: 2 }, coins: [1, 2, 3], tampon: 400 }], enCours: { ouvrage: null } };
    retirerPointReseau(rect, 'P2');
    expect(rect.ouvrages[0].points).toEqual(['P1', 'P3']);
    expect(rect.ouvrages[0].centre).toBeNull();
    expect(rect.enCours.ouvrage).toBe('o2');
  });
});
