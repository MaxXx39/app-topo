import { describe, it, expect } from 'vitest';
import { creerPlanDao, refaireContenuDao, cercleParTroisPoints, pointsDeLArc, coinsDuRectangle } from '../src/topo/dao.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });

describe('DAO', () => {
  it('cercle par 3 points', () => {
    const c = cercleParTroisPoints(p(10, 0), p(0, 10), p(-10, 0));
    expect(c.est).toBeCloseTo(0, 9);
    expect(c.nord).toBeCloseTo(0, 9);
    expect(c.rayon).toBeCloseTo(10, 9);
    expect(cercleParTroisPoints(p(0, 0), p(1, 1), p(2, 2))).toBeNull();
  });
  it('arc qui passe par le milieu (demi-cercle par le nord)', () => {
    const pts = pointsDeLArc(p(10, 0, 400), p(0, 10), p(-10, 0, 402));
    expect(pts[0].est).toBeCloseTo(10, 6);
    expect(pts.at(-1).est).toBeCloseTo(-10, 6);
    expect(Math.max(...pts.map((x) => x.nord))).toBeCloseTo(10, 1);
    expect(pts.at(-1).altitude).toBeCloseTo(402, 6);
  });
  it('arc qui passe par le sud quand le milieu y est', () => {
    const pts = pointsDeLArc(p(10, 0), p(0, -10), p(-10, 0));
    expect(Math.min(...pts.map((x) => x.nord))).toBeCloseTo(-10, 1);
  });
  it('rectangle par deux coins', () => {
    expect(coinsDuRectangle(p(0, 0), p(4, 3)).map((c) => [c.est, c.nord])).toEqual([[0, 0], [4, 0], [4, 3], [0, 3]]);
  });
  it('contenu en repère local, bornes et calques', () => {
    const plan = creerPlanDao('d1', { est: 2500000.7, nord: 1200000.2 });
    plan.calques.push({ nom: 'B', couleur: '#000', visible: true });
    plan.dao.objets.push({ sorte: 'ligne', calque: 0, points: [p(2500001, 1200001, 400), p(2500011, 1200001, 401)] });
    plan.dao.objets.push({ sorte: 'cercle', calque: 1, points: [p(2500005, 1200005), p(2500007, 1200005)] });
    plan.dao.objets.push({ sorte: 'texte', calque: 0, texte: 'Mur', points: [p(2500003, 1200003)] });
    refaireContenuDao(plan);
    expect(plan.origine).toEqual({ est: 2500000, nord: 1200000 });
    expect(plan.contenu.traits[0]).toEqual({ c: 0, k: null, p: [1, 1, 11, 1], f: false, z: [400, 401] });
    expect(plan.contenu.cercles[0]).toEqual({ c: 1, k: null, x: 5, y: 5, r: 2 });
    expect(plan.contenu.textes[0].t).toBe('Mur');
    expect(plan.bornes).toEqual({ estMin: 2500001, nordMin: 1200001, estMax: 2500011, nordMax: 1200007 });
  });
});
