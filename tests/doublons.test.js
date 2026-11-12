import { describe, it, expect } from 'vitest';
import { nomsEnDouble, sansDoublons, renommerDoublons } from '../src/topo/doublons.js';

const pts = (...noms) => noms.map((nom, i) => ({ nom, est: i, nord: i }));

describe('doublons à l\'import', () => {
  it('repère les noms déjà pris ou répétés', () => {
    expect(nomsEnDouble(['1737', 'A'], pts('1737', 'B', 'B', 'C'))).toEqual(['1737', 'B']);
    expect(nomsEnDouble([], pts('a', 'b'))).toEqual([]);
    expect(nomsEnDouble([], pts('', ''))).toEqual([]); // sans nom : pas un doublon
  });
  it('ignore les doublons en gardant le premier', () => {
    expect(sansDoublons(['A'], pts('A', 'B', 'B', 'C')).map((p) => p.nom)).toEqual(['B', 'C']);
  });
  it('renomme sans jamais reprendre un nom pris', () => {
    const r = renommerDoublons(['A', 'A-2'], pts('A', 'A', 'B', 'B'));
    expect(r.points.map((p) => p.nom)).toEqual(['A-3', 'A-4', 'B', 'B-2']);
    expect(r.renommes).toEqual([{ avant: 'A', apres: 'A-3' }, { avant: 'A', apres: 'A-4' }, { avant: 'B', apres: 'B-2' }]);
    expect(r.points[0].est).toBe(0); // le reste du point est gardé
  });
});

import { ajouterPointsControle } from '../src/topo/controle.js';
describe('points de contrôle : garder les doublons', () => {
  it('« importer quand même » ajoute aussi les noms déjà pris', () => {
    const liste = [{ id: 'x', nom: 'A', est: 1, nord: 1 }];
    let n = 0;
    const r = ajouterPointsControle(liste, [{ nom: 'A', est: 2, nord: 2 }, { nom: 'B', est: 3, nord: 3 }], () => `id${n++}`, { garderDoublons: true });
    expect(r).toEqual({ ajoutes: 2, deja: [], sansNom: 0 });
    expect(liste.map((p) => p.nom)).toEqual(['A', 'A', 'B']);
  });
});
