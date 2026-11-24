// Plans de chantier (0.301.0) : rectangle par 3 clics, rond (centre + rayon), point de base d'un symbole.
import { describe, it, expect } from 'vitest';
import {
  rectangleTroisPoints, pointsDuRond, changerRayon, poigneesDe, pointDeBase, deplacerObjet, milieuxDesCotes,
  sommetSousLePoint, nouveauPlanChantier, ajouterObjet, courberCote, arcsDe, poigneesArcs, recourber,
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

// 0.307.0 : appui long sur le « + » = le côté devient un arc qui passe par la souris.
import { arcSurCote } from '../src/topo/plan-chantier.js';
describe('arc sur un côté', () => {
  it('demi-cercle de 0,0 à 10,0 par 5,5 : tous les points à 5 m du centre, dans le bon sens', () => {
    const pts = arcSurCote([[0, 0], [10, 0], [10, -10]], 0, [5, 5], false, 8);
    expect(pts).toHaveLength(3 + 7);
    for (const p of pts.slice(1, 8)) {
      expect(Math.hypot(p[0] - 5, p[1])).toBeCloseTo(5, 2);
      expect(p[1]).toBeGreaterThan(0);
    }
    expect(pts.at(-2)).toEqual([10, 0]);
  });
  it('points alignés : le côté reste droit ; côté qui ferme une zone', () => {
    expect(arcSurCote([[0, 0], [10, 0]], 0, [5, 0])).toEqual([[0, 0], [10, 0]]);
    const z = arcSurCote([[0, 0], [10, 0], [10, 10]], 2, [3, 7], true, 4);
    expect(z).toHaveLength(6);
    expect(z.slice(0, 3)).toEqual([[0, 0], [10, 0], [10, 10]]);
  });
});

describe('arcs modifiables (0.315.0)', () => {
  const carre = () => ({ type: 'zone', points: [[0, 0], [10, 0], [10, 10], [0, 10]] });
  it('un arc garde son souvenir et se courbe de nouveau sans couper en segments à part', () => {
    const o = carre();
    const r = courberCote(o.points, [], 0, [5, -3], true);
    Object.assign(o, { points: r.points, arcs: r.arcs, arcsLen: r.arcsLen });
    expect(o.points).toHaveLength(4 + 15);
    expect(arcsDe(o)).toHaveLength(1);
    expect(poigneesArcs(o)).toHaveLength(1);
    expect(poigneesArcs(o)[0].point[1]).toBeCloseTo(-3, 1); // le milieu de l'arc passe par le point tiré
    recourber(o, 0, [5, -6]);
    expect(o.points).toHaveLength(19);
    expect(poigneesArcs(o)[0].point[1]).toBeCloseTo(-6, 1);
    expect(o.points[0]).toEqual([0, 0]);
    expect(o.points[16]).toEqual([10, 0]);
  });
  it('un deuxième arc décale le premier ; un point ajouté ailleurs fait oublier les arcs', () => {
    const o = carre();
    let r = courberCote(o.points, [], 2, [5, 13], true);
    Object.assign(o, r);
    r = courberCote(o.points, arcsDe(o), 0, [5, -3], true);
    Object.assign(o, { points: r.points, arcs: r.arcs, arcsLen: r.arcsLen });
    expect(arcsDe(o).map((a) => a.i).sort((a, b) => a - b)).toEqual([0, 17]);
    o.points = [...o.points, [0, 5]];
    expect(arcsDe(o)).toHaveLength(0);
  });
});
