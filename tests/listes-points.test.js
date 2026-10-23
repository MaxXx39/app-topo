import { describe, it, expect } from 'vitest';
import { listesDePoints, pointsDesListes, montrerListe } from '../src/plan/listes-points.js';

const pt = (nom) => ({ nom, est: 0, nord: 0, altitude: 0 });

function projetEssai() {
  return {
    leves: [
      { id: 'f', nom: 'stock.csv', points: [pt('b1'), pt('b2'), pt('h1'), pt('x')] },
      { id: 'j', nom: 'Levé RX2 2026-10-23', direct: true, points: [pt('P-RG-1'), pt('L-HT-1-1'), pt('A-ENR-1-1')] },
      { id: 'a', nom: 'Points ajoutés', ajoutes: true, points: [pt('P1')] },
    ],
    surfaces: [
      { id: 's1', nom: 'Stock 1', nature: 'stock', leveId: 'f', contour: ['b1', 'b2'], lignesRupture: [{ noms: ['h1'] }], points: [], tousLesPoints: false },
      { id: 'lx', nom: 'Terrain', type: 'landxml', nature: 'terrain', points: [] },
    ],
    metres: [{ id: 'm1', nom: 'Métré 1', leveId: 'j' }],
    mesures: [{ id: 'me', metreId: 'm1', contour: ['A-ENR-1-1'], lignesRupture: [], points: [] }],
    autres: [{ id: 'o1', nom: 'Autres 1', leveId: 'j', contour: [], lignesRupture: [{ noms: ['L-HT-1-1'] }], points: ['P-RG-1'] }],
    listesCachees: [],
  };
}

describe('Listes de points du plan', () => {
  it('une liste par fichier, surface, métré, Autres et points ajoutés (pas les surfaces LandXML)', () => {
    const listes = listesDePoints(projetEssai());
    expect(listes.map((l) => [l.id, l.nature])).toEqual([['f', 'fichier'], ['a', 'ajoutes'], ['s1', 'stock'], ['m1', 'metre'], ['o1', 'autres']]);
  });

  it('dessine seulement les points des listes cochées, chacun une fois', () => {
    const projet = projetEssai();
    expect(pointsDesListes(projet, listesDePoints(projet))).toHaveLength(8);
    montrerListe(projet, 'f', false);
    montrerListe(projet, 'o1', false);
    // Reste : Stock 1 (b1, b2, h1), Métré 1 (A-ENR-1-1), Points ajoutés (P1).
    expect(pointsDesListes(projet, listesDePoints(projet)).map((p) => p.nom)).toEqual(['P1', 'b1', 'b2', 'h1', 'A-ENR-1-1']);
    montrerListe(projet, 'f', true);
    expect(projet.listesCachees).toEqual(['o1']);
  });
});
