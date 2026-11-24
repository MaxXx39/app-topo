// Plans de chantier (0.301.0) : rectangle par 3 clics, rond (centre + rayon), point de base d'un symbole.
import { describe, it, expect } from 'vitest';
import {
  rectangleTroisPoints, pointsDuRond, changerRayon, poigneesDe, pointDeBase, deplacerObjet, milieuxDesCotes,
  sommetSousLePoint, nouveauPlanChantier, ajouterObjet,
} from '../src/topo/plan-chantier.js';
import { dxfPlanChantier } from '../src/topo/plan-chantier-dxf.js';

describe('rectangle par 3 clics', () => {
  it('un côté puis la largeur, du côté du 3e point', () => {
    expect(rectangleTroisPoints([0, 0], [10, 0], [3, 4])).toEqual([[0, 0], [10, 0], [10, 4], [0, 4]]);
    expect(rectangleTroisPoints([0, 0], [10, 0], [3, -2])).toEqual([[0, 0], [10, 0], [10, -2], [0, -2]]);
  });
  it('penché : les côtés restent perpendiculaires', () => {
    const r = rectangleTroisPoints([0, 0], [3, 4], [-4, 3]);
    expect(r[2]).toEqual([-1, 7]);
    expect(r[3]).toEqual([-4, 3]);
  });
  it('3e point sur le côté ou 2 coins confondus : refusé', () => {
    expect(rectangleTroisPoints([0, 0], [10, 0], [5, 0])).toBeNull();
    expect(rectangleTroisPoints([1, 1], [1, 1], [5, 5])).toBeNull();
  });
});

describe('rond', () => {
  const rond = () => ({ type: 'zone', categorie: 'autre', cercle: { centre: [100, 200], rayon: 5 }, points: pointsDuRond([100, 200], 5) });
  it('72 points sur le cercle ; poignées = centre et un point du bord ; pas de « + »', () => {
    const o = rond();
    expect(o.points).toHaveLength(72);
    expect(o.points[0]).toEqual([105, 200]);
    expect(poigneesDe(o)).toEqual([[100, 200], [105, 200]]);
    expect(milieuxDesCotes(o)).toEqual([]);
    expect(sommetSousLePoint(o, [105.1, 200], 0.5)).toBe(1);
  });
  it('déplacer = le centre suit ; changer le rayon refait les points', () => {
    const o = rond();
    deplacerObjet(o, 10, -5);
    expect(o.cercle.centre).toEqual([110, 195]);
    expect(o.points[0]).toEqual([115, 195]);
    changerRayon(o, 2.5);
    expect(o.cercle.rayon).toBe(2.5);
    expect(o.points[0]).toEqual([112.5, 195]);
  });
  it('DXF : un vrai cercle', () => {
    const plan = nouveauPlanChantier('Essai');
    ajouterObjet(plan, rond());
    const t = dxfPlanChantier(plan, []);
    expect(t).toMatch(/\r?\nCIRCLE\r?\n/);
    expect(t).not.toMatch(/ZONE_AUTRE\r?\n70\r?\n1/);
  });
});

describe('point de base d\'un symbole', () => {
  const coins = [[0, 0], [6, 0], [6, 2.5], [0, 2.5]];
  it('le coin ou le milieu de bord le plus proche, sinon le point saisi', () => {
    expect(pointDeBase(coins, [5.8, 0.2], 0.5)).toEqual([6, 0]);
    expect(pointDeBase(coins, [3.1, 2.4], 0.5)).toEqual([3, 2.5]);
    expect(pointDeBase(coins, [3, 1.2], 0.5)).toEqual([3, 1.2]);
  });
});
