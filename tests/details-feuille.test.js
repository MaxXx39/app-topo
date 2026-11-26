import { describe, it, expect } from 'vitest';
import { detailDe, detailsDe, nouveauDetail, empriseDuDetail, repereDuDetail, redimensionnerBoite, poigneesDeBoite, poigneeSousLePoint, MAX_DETAILS } from '../src/topo/details-feuille.js';

describe('cadres de détail (0.333.0)', () => {
  it('valeurs de départ complétées, bornées ; un vieux projet sans détail = liste vide', () => {
    const d = detailDe({}, 0);
    expect(d).toMatchObject({ lettre: 'A', titre: 'Détail A', echelle: 50, forme: 'rectangle', fond: 'blanc', repere: true });
    expect(d.bord).toEqual({ epaisseur: 0.5, couleur: '#1b2b36', trait: 'continu' });
    expect(detailDe({ echelle: -5, fw: 5, bord: { epaisseur: 99, couleur: 'x' }, fond: 'zz' }, 1)).toMatchObject({ lettre: 'B', echelle: 1, fw: 0.9, fond: 'blanc' });
    expect(detailsDe({})).toEqual([]);
    expect(detailsDe({ details: [{}, {}, {}] })).toHaveLength(MAX_DETAILS);
  });
  it('nouveau détail : lettre A puis B puis plus rien ; échelle de départ = le quart de celle du plan', () => {
    const a = nouveauDetail([], [2500000, 1118000], 200);
    expect(a.lettre).toBe('A');
    expect(a.echelle).toBe(50);
    const b = nouveauDetail([a], [2500010, 1118010], 200);
    expect(b.lettre).toBe('B');
    expect(nouveauDetail([a, b], [0, 0], 200)).toBeNull();
    expect(nouveauDetail([b], [0, 0], 200).lettre).toBe('A'); // la lettre libre
  });
  it('emprise : un cadre de 100 × 60 mm à 1:50 montre 5 × 3 m', () => {
    expect(empriseDuDetail({ echelle: 50 }, { l: 100, h: 60 })).toEqual({ l: 5, h: 3 });
  });
  it('repère : rectangle autour du centre (sans rotation), cercle pour un rond', () => {
    const r = repereDuDetail({ centre: [100, 200], echelle: 50, forme: 'rectangle', lettre: 'A' }, { l: 100, h: 60 });
    expect(r.coins).toEqual([[97.5, 201.5], [102.5, 201.5], [102.5, 198.5], [97.5, 198.5]]);
    const c = repereDuDetail({ centre: [100, 200], echelle: 50, forme: 'rond', lettre: 'B' }, { l: 80, h: 80 });
    expect(c).toMatchObject({ forme: 'rond', centre: [100, 200], rayon: 2 });
    expect(repereDuDetail({ centre: null, echelle: 50 }, { l: 1, h: 1 })).toBeNull();
  });
  it('repère tourné de 90° : la largeur devient la hauteur sur le terrain', () => {
    const r = repereDuDetail({ centre: [0, 0], echelle: 100, forme: 'rectangle', lettre: 'A' }, { l: 100, h: 50 }, 90);
    const largeurEst = Math.max(...r.coins.map((q) => q[0])) - Math.min(...r.coins.map((q) => q[0]));
    expect(largeurEst).toBeCloseTo(5, 6); // 50 mm à 1:100
  });
  it('redimensionner : le bord opposé reste en place, taille minimale, carré pour un rond, accroche', () => {
    const b = { x: 50, y: 40, l: 100, h: 60 };
    expect(redimensionnerBoite(b, 'se', 20, 10)).toEqual({ x: 50, y: 40, l: 120, h: 70 });
    expect(redimensionnerBoite(b, 'no', -10, -5)).toEqual({ x: 40, y: 35, l: 110, h: 65 });
    expect(redimensionnerBoite(b, 'e', -500, 0, 25).l).toBe(25);
    const carre = redimensionnerBoite({ x: 0, y: 0, l: 50, h: 50 }, 'se', 30, 10, 25, true);
    expect(carre.l).toBe(carre.h);
    expect(carre.l).toBe(80);
    const accroche = redimensionnerBoite(b, 'e', 19, 0, 25, false, (v, axe) => (axe === 'x' && Math.abs(v - 170) < 3 ? 170 : v));
    expect(accroche.x + accroche.l).toBe(170);
  });
  it('8 poignées ; la poignée sous le point', () => {
    const b = { x: 0, y: 0, l: 100, h: 50 };
    expect(poigneesDeBoite(b)).toHaveLength(8);
    expect(poigneeSousLePoint(b, [100, 50], 3)).toBe('se');
    expect(poigneeSousLePoint(b, [50, 0.5], 3)).toBe('n');
    expect(poigneeSousLePoint(b, [50, 25], 3)).toBeNull();
  });
});
