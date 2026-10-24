// Tests des barbules d'un talus : espacement, longues et courtes en alternance, angles.
import { describe, it, expect } from 'vitest';
import { traitsDeBarbules } from '../src/plan/barbules.js';

/** Traits du chemin SVG : [[x1, y1, x2, y2], …]. */
function traits(d) {
  return [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].map((m) => m.slice(1).map(Number));
}

describe('barbules du talus', () => {
  it('tous les "pas" pixels, longue puis courte, du haut vers le bas', () => {
    const haut = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
    const bas = [{ x: 0, y: 20 }, { x: 40, y: 20 }];
    const t = traits(traitsDeBarbules(haut, bas, 10));
    expect(t.map((trait) => trait[0])).toEqual([0, 10, 20, 30, 40]);
    expect(t[0]).toEqual([0, 0, 0, 20]); // longue
    expect(t[1]).toEqual([10, 0, 10, 10]); // courte (la moitié)
    expect(t[2]).toEqual([20, 0, 20, 20]);
  });

  it('l\'espacement continue d\'un morceau à l\'autre, les morceaux de longueur nulle sont sautés', () => {
    const haut = [{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 15 }];
    const bas = [{ x: 0, y: 10 }, { x: 5, y: 10 }, { x: 5, y: 10 }, { x: 5, y: 15 }];
    const t = traits(traitsDeBarbules(haut, bas, 10));
    // 0 et 10 sur le 1er morceau, puis 5 px dans le 3e (15 + 5 = 20 px depuis le début).
    expect(t.map((trait) => [trait[0], trait[1]])).toEqual([[0, 0], [10, 0], [15, 5], [15, 15]]);
  });

  it('rien sans morceau', () => {
    expect(traitsDeBarbules([{ x: 0, y: 0 }], [{ x: 0, y: 5 }], 10)).toBe('');
  });
});
