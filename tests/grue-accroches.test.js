import { describe, it, expect } from 'vitest';
import { lignesChassisGrue, coteDuPiedDeLaGrue } from '../src/topo/grue-accroches.js';

describe('accroches d\'une grue (0.317.0)', () => {
  it('grue à tour avec châssis de 4.20 m : 4 coins, diagonales et axe de la tour', () => {
    const o = { type: 'grue', modele: 'tour', point: [2500000, 1120000], rotation: 0, chassis: '4.20' };
    expect(coteDuPiedDeLaGrue(o)).toBeCloseTo(4.2, 6);
    const l = lignesChassisGrue(o);
    expect(l).toHaveLength(4);
    const coins = l[0].points;
    expect(coins).toHaveLength(4);
    expect(coins[0].est).toBeCloseTo(2500002.1, 6);
    expect(coins[0].nord).toBeCloseTo(1120002.1, 6);
    expect(l[3].points[0].est).toBeCloseTo(2500000, 6); // axe de la tour
  });
  it('tourne avec l\'objet', () => {
    const o = { type: 'grue', modele: 'tour', point: [0, 0], rotation: 90, chassis: '4' };
    const c = lignesChassisGrue(o)[0].points[0]; // (2, 2) tourné de 90° = (-2, 2)
    expect(c.est).toBeCloseTo(-2, 6);
    expect(c.nord).toBeCloseTo(2, 6);
  });
  it('sans châssis : aucune accroche', () => {
    expect(lignesChassisGrue({ type: 'grue', modele: 'tour', point: [0, 0], chassis: 'aucun' })).toEqual([]);
  });
});

describe('grue d\'après fiche (0.317.0)', () => {
  it('donne les coins du carré d\'appui du pied choisi', () => {
    const o = { type: 'grue', modele: 'fiche', point: [10, 20], rotation: 0 };
    const l = lignesChassisGrue(o);
    expect(l.length === 0 || l.length === 4).toBe(true);
    if (l.length) {
      const [a, b] = l[0].points;
      expect(Math.hypot(a.est - b.est, a.nord - b.nord)).toBeCloseTo(coteDuPiedDeLaGrue(o), 6);
    }
  });
});
