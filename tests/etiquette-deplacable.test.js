// 0.320.5 : le texte d'une zone ou d'un bloc se décale par sa poignée (décalage en repère du bloc).
import { describe, it, expect } from 'vitest';
import { ancreEtiquette, decalEtiquette, etiquetteSousLePoint, etiquettePresente } from '../src/topo/plan-chantier.js';

describe('texte déplaçable', () => {
  const zone = { type: 'zone', points: [[0, 0], [10, 0], [10, 10], [0, 10]], etiquette: 'Stock' };
  it('la zone : le texte part du centre puis suit le décalage', () => {
    expect(ancreEtiquette(zone)).toEqual([5, 5]);
    zone.decalEtiq = [2, -1];
    expect(ancreEtiquette(zone)[0]).toBeCloseTo(7, 6);
    expect(ancreEtiquette(zone)[1]).toBeCloseTo(4, 6);
  });
  it('prendre la poignée puis la déplacer : le texte suit la souris', () => {
    const z = { type: 'zone', points: zone.points, etiquette: 'Stock' };
    expect(etiquetteSousLePoint(z, [5.1, 5], 0.5)).toBe(true);
    expect(etiquetteSousLePoint(z, [8, 8], 0.5)).toBe(false);
    z.decalEtiq = decalEtiquette(z, [5, 5], [8, 3]);
    expect(ancreEtiquette(z)[0]).toBeCloseTo(8, 6);
    expect(ancreEtiquette(z)[1]).toBeCloseTo(3, 6);
  });
  it('un bloc tourné : le décalage est dans son repère', () => {
    const b = { type: 'symbole', point: [100, 100], rotation: 90, etiquette: 'Bureaux' };
    expect(etiquettePresente(b)).toBe(true);
    b.decalEtiq = decalEtiquette(b, [100, 100], [100, 102]);
    const a = ancreEtiquette(b);
    expect(a[0]).toBeCloseTo(100, 6);
    expect(a[1]).toBeCloseTo(102, 6);
  });
  it('sans texte : pas de poignée', () => {
    expect(etiquettePresente({ type: 'zone', points: zone.points })).toBe(false);
  });
});
