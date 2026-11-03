import { describe, it, expect } from 'vitest';
import { ecartAuBout } from '../src/topo/ligne-implantation.js';
import { classeTolerance, TOLERANCES_PAR_DEFAUT } from '../src/topo/controle.js';

// 0.118.1 : bloc « Début / fin » coloré selon l'écart au bout le plus proche.
describe('ecartAuBout', () => {
  it('plus près du début', () => expect(ecartAuBout(0.015, 32.447)).toBeCloseTo(0.015, 9));
  it('plus près de la fin', () => expect(ecartAuBout(32.43, 32.447)).toBeCloseTo(0.017, 9));
  it('au milieu', () => expect(ecartAuBout(10, 30)).toBe(10));
  it('avant le début : distance jusqu\'au début', () => expect(ecartAuBout(-0.03, 20)).toBeCloseTo(0.03, 9));
  it('après la fin : distance jusqu\'à la fin', () => expect(ecartAuBout(20.5, 20)).toBeCloseTo(0.5, 9));
  it('couleurs avec les tolérances du Contrôle (2 cm / 4 cm)', () => {
    const t = TOLERANCES_PAR_DEFAUT.plan;
    expect(classeTolerance(ecartAuBout(0.02, 30), t)).toBe('vert');
    expect(classeTolerance(ecartAuBout(29.965, 30), t)).toBe('orange');
    expect(classeTolerance(ecartAuBout(12, 30), t)).toBe('rouge');
  });
});
