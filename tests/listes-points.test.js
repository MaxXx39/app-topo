import { describe, it, expect } from 'vitest';
import { listesDePoints, pointsDesListes, montrerListe, mesuresVisibles, LISTE_MESURES } from '../src/plan/listes-points.js';

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
  it('rangées par catégories (0.94.0) : Levé (levés et levés libres), Points Import, Surface Import, Métré', () => {
    const listes = listesDePoints(projetEssai());
    expect(listes.map((l) => [l.id, l.nature, l.section])).toEqual([
      ['s1', 'stock', 'leve'], ['o1', 'autres', 'leve'],
      ['f', 'fichier', 'points'], ['a', 'ajoutes', 'points'],
      ['lx', 'importee', 'surface'],
      ['m1', 'metre', 'metre'],
    ]);
    expect(listes.filter((l) => l.couleurModifiable).map((l) => l.id)).toEqual(['f', 'a', 'lx']);
  });

  it('mesures dessinées : celles des métrés cochés et, si « Mesures » est cochée, celles faites à la main', () => {
    const projet = projetEssai();
    projet.mesures.push({ id: 'main', contour: [], lignesRupture: [], points: [] });
    let listes = listesDePoints(projet);
    expect(listes.find((l) => l.id === LISTE_MESURES)?.section).toBe('metre');
    expect(mesuresVisibles(projet, listes).map((m) => m.id)).toEqual(['me', 'main']);
    montrerListe(projet, 'm1', false);
    listes = listesDePoints(projet);
    expect(mesuresVisibles(projet, listes).map((m) => m.id)).toEqual(['main']);
  });

  it('dessine seulement les points des listes cochées, chacun une fois', () => {
    const projet = projetEssai();
    expect(pointsDesListes(projet, listesDePoints(projet))).toHaveLength(8);
    montrerListe(projet, 'f', false);
    montrerListe(projet, 'o1', false);
    // Reste : Stock 1 (b1, b2, h1), Métré 1 (A-ENR-1-1), Points ajoutés (P1).
    expect(pointsDesListes(projet, listesDePoints(projet)).map((p) => p.nom)).toEqual(['b1', 'b2', 'h1', 'P1', 'A-ENR-1-1']);
    montrerListe(projet, 'f', true);
    expect(projet.listesCachees).toEqual(['o1']);
  });
});

describe('couleur des listes de points', async () => {
  const { listesDePoints: listes, couleursDesPoints, COULEUR_CONTROLE } = await import('../src/plan/listes-points.js');
  it('couleur choisie pour un fichier de points ; points de contrôle toujours rouges', () => {
    const a = { nom: 'a', est: 0, nord: 0 };
    const b = { nom: 'b', est: 1, nord: 1 };
    const projet = {
      leves: [{ id: 'f1', nom: 'fichier.csv', points: [a, b] }, { id: 'f2', nom: 'autre.csv', points: [{ nom: 'c', est: 2, nord: 2 }] }],
      surfaces: [], metres: [], mesures: [], autres: [],
      pointsControle: [{ id: 'k', nom: 'PF1', est: 0, nord: 0 }],
      couleursListes: { f1: '#2563eb', 'points-controle': '#16a34a' },
      listesCachees: [],
    };
    const l = listes(projet);
    expect(l.find((x) => x.id === 'f1').couleur).toBe('#2563eb');
    expect(l.find((x) => x.id === 'f2').couleur).toBeNull();
    const controle = l.find((x) => x.nature === 'controle');
    expect(controle.couleur).toBe(COULEUR_CONTROLE);
    expect(controle.couleurModifiable).toBe(false);
    const couleurs = couleursDesPoints(projet, l);
    expect(couleurs.get(a)).toBe('#2563eb');
    expect(couleurs.get(b)).toBe('#2563eb');
    expect(couleurs.size).toBe(2);
  });
});
