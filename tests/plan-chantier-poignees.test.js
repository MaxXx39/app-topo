import { describe, it, expect } from 'vitest';
import { estRectangle, poigneesDe, poigneeDecalageCote, decalageCoteDepuis, geometrieCotation, deplacerObjet, rectangleTroisPoints, pointsDuRond } from '../src/topo/plan-chantier.js';

const rect = (pts) => ({ type: 'zone', points: pts });

describe('poignées (0.328.0)', () => {
  it('rectangle : 4 angles droits reconnus ; un quadrilatère quelconque non', () => {
    expect(estRectangle(rect([[0, 0], [4, 0], [4, 3], [0, 3]]))).toBe(true);
    expect(estRectangle(rect(rectangleTroisPoints([0, 0], [10, 5], [5, 7])))).toBe(true); // rectangle tourné
    expect(estRectangle(rect([[0, 0], [4, 0], [5, 3], [0, 3]]))).toBe(false);
    expect(estRectangle(rect([[0, 0], [4, 0], [4, 3]]))).toBe(false);
  });
  it('rond : centre, bord est, puis nord / ouest / sud', () => {
    const o = { type: 'zone', cercle: { centre: [10, 20], rayon: 3 }, points: pointsDuRond([10, 20], 3) };
    expect(poigneesDe(o)).toEqual([[10, 20], [13, 20], [10, 23], [7, 20], [10, 17]]);
  });
  it('prendre un angle et le poser ailleurs déplace tout le rectangle (le coin tombe sur le point visé)', () => {
    const o = rect([[0, 0], [4, 0], [4, 3], [0, 3]]);
    const coin = [...o.points[2]];
    deplacerObjet(o, 10 - coin[0], 20 - coin[1]);
    expect(o.points[2]).toEqual([10, 20]);
    expect(o.points[0]).toEqual([6, 17]);
  });
  it('cote : la poignée est au milieu de la ligne de cote ; la tirer change la distance', () => {
    const o = { type: 'cotation', genre: 'longueur', points: [[0, 0], [10, 0]], decalage: 1 };
    expect(poigneeDecalageCote(o)).toEqual([2.5, 1]); // au quart de la ligne : le texte est au milieu
    expect(decalageCoteDepuis(o, [2.5, 2.504])).toBe(2.5);
    o.decalage = decalageCoteDepuis(o, [2.5, -1.5]); // de l'autre côté
    expect(o.decalage).toBe(-1.5);
    expect(poigneeDecalageCote(o)).toEqual([2.5, -1.5]);
    expect(geometrieCotation(o).texte.p[1]).toBeCloseTo(-1.5, 6);
  });
  it('pas de poignée de distance pour une cote d\'angle', () => {
    expect(poigneeDecalageCote({ type: 'cotation', genre: 'angle', points: [[0, 0], [1, 0], [0, 1]] })).toBeNull();
  });
});
