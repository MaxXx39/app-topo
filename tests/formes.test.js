import { describe, it, expect } from 'vitest';
import { cheminForme, formeEnTrait, FORMES } from '../src/plan/formes.js';

describe('formes des points (0.97.0)', () => {
  it('donne un tracé pour chaque forme, sauf le rond', () => {
    expect(cheminForme('', 10, 10, 3)).toBeNull();
    expect(cheminForme('rond-vide', 10, 10, 3)).toBeNull();
    expect(cheminForme('carre', 10, 10, 3)).toBe('M7.0 7.0L13.0 7.0L13.0 13.0L7.0 13.0Z');
    expect(cheminForme('carre-vide', 10, 10, 3)).toBe(cheminForme('carre', 10, 10, 3));
    expect(cheminForme('croix-45', 0, 0, 1)).toBe('M-1.0 -1.0L1.0 1.0M-1.0 1.0L1.0 -1.0');
    expect(cheminForme('etoile', 0, 0, 2).split('L')).toHaveLength(10);
    for (const [cle] of FORMES) if (!['', 'rond-vide'].includes(cle)) expect(cheminForme(cle, 0, 0, 3)).toBeTruthy();
  });

  it('les formes vides et les croix se dessinent en trait', () => {
    expect(formeEnTrait('carre-vide')).toBe(true);
    expect(formeEnTrait('croix')).toBe(true);
    expect(formeEnTrait('carre')).toBe(false);
    expect(formeEnTrait('')).toBe(false);
  });
});
