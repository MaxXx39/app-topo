// 0.214.0 : accroche « Centre pts » : milieu de 2 points, centre du cercle qui passe par 3 points.
import { describe, expect, it } from 'vitest';
import { centreDePoints, MAX_POINTS_CENTRE } from '../src/topo/centre-points.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });

describe('centre de 2 ou 3 points', () => {
  it('2 points : le milieu, avec la moyenne des altitudes', () => {
    const c = centreDePoints([p(2500000, 1100000, 400), p(2500010, 1100020, 402)]);
    expect(c).toMatchObject({ ok: true, est: 2500005, nord: 1100010, altitude: 401, nombre: 2 });
    expect(c.rayon).toBeCloseTo(Math.hypot(10, 20) / 2, 9);
  });

  it('3 points : centre du cercle (triangle rectangle : milieu de l\'hypoténuse)', () => {
    const c = centreDePoints([p(0, 0), p(8, 0), p(0, 6)]);
    expect(c.ok).toBe(true);
    expect(c.est).toBeCloseTo(4, 9);
    expect(c.nord).toBeCloseTo(3, 9);
    expect(c.rayon).toBeCloseTo(5, 9);
  });

  it('3 points sur un cercle connu, avec de grandes coordonnées MN95', () => {
    const [ce, cn, r] = [2509468.123, 1141162.456, 7.25];
    const sur = (angle) => p(ce + r * Math.cos(angle), cn + r * Math.sin(angle));
    const c = centreDePoints([sur(0.3), sur(2.1), sur(4.4)]);
    expect(c.est).toBeCloseTo(ce, 6);
    expect(c.nord).toBeCloseTo(cn, 6);
    expect(c.rayon).toBeCloseTo(r, 6);
  });

  it('le centre est équidistant des 3 points, quel que soit leur ordre', () => {
    const pts = [p(10, 3), p(-4, 12), p(7, -9)];
    for (const ordre of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
      const c = centreDePoints(ordre.map((i) => pts[i]));
      const distances = pts.map((q) => Math.hypot(q.est - c.est, q.nord - c.nord));
      expect(distances[0]).toBeCloseTo(distances[1], 9);
      expect(distances[1]).toBeCloseTo(distances[2], 9);
    }
  });

  it('altitude : moyenne si tous les points en ont, sinon null (jamais inventée)', () => {
    expect(centreDePoints([p(0, 0, 10), p(8, 0, 12), p(0, 6, 14)]).altitude).toBeCloseTo(12, 9);
    expect(centreDePoints([p(0, 0, 10), p(8, 0), p(0, 6, 14)]).altitude).toBeNull();
  });

  it('refus : un seul point, 4 points, points confondus, points alignés', () => {
    expect(centreDePoints([p(0, 0)]).ok).toBe(false);
    expect(centreDePoints([p(0, 0), p(1, 1), p(2, 0), p(3, 3)])).toMatchObject({ ok: false });
    expect(MAX_POINTS_CENTRE).toBe(3);
    expect(centreDePoints([p(1, 1), p(1, 1)]).raison).toContain('même endroit');
    expect(centreDePoints([p(0, 0), p(5, 5), p(10, 10)]).raison).toContain('alignés');
  });
});
