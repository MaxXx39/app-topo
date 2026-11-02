import { describe, it, expect } from 'vitest';
import { rythmeBip, placeSurRegle } from '../src/topo/bip.js';

describe('Bip-bip de hauteur', () => {
  it('silence au-delà de 50 cm, sans écart', () => {
    expect(rythmeBip(0.6, 0.02)).toBeNull();
    expect(rythmeBip(-0.51, 0.02)).toBeNull();
    expect(rythmeBip(null, 0.02)).toBeNull();
  });
  it('son continu dans la tolérance', () => {
    expect(rythmeBip(0.015, 0.02)).toEqual({ continu: true, monter: true });
    expect(rythmeBip(-0.02, 0.02).continu).toBe(true);
  });
  it('bips plus rapides en approchant, aigu pour monter', () => {
    const loin = rythmeBip(0.5, 0.02);
    const pres = rythmeBip(-0.05, 0.02);
    expect(loin).toEqual({ continu: false, monter: true, intervalle: 900 });
    expect(pres.monter).toBe(false);
    expect(pres.intervalle).toBeLessThan(loin.intervalle);
    expect(pres.intervalle).toBeGreaterThanOrEqual(120);
  });
  it('place sur la règle : milieu = altitude voulue, monter = marque en dessous', () => {
    expect(placeSurRegle(0)).toBe(0.5);
    expect(placeSurRegle(0.25)).toBe(0.75);
    expect(placeSurRegle(-0.25)).toBe(0.25);
    expect(placeSurRegle(3)).toBe(0.97);
    expect(placeSurRegle(-3)).toBe(0.03);
  });
});
