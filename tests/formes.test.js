import { describe, it, expect } from 'vitest';
import { apercuForme, centrePointLeger, cheminControle, cheminForme, formeEnTrait, formeVide, FORMES, rayonPointLeger, symboleDeForme } from '../src/plan/formes.js';

describe('formes des points (0.97.0)', () => {
  it('donne un tracé pour chaque forme, sauf le rond', () => {
    expect(cheminForme('', 10, 10, 3)).toBeNull();
    expect(cheminForme('rond-vide', 10, 10, 3)).toBeNull();
    expect(cheminForme('carre', 10, 10, 3)).toBe('M7.0 7.0L13.0 7.0L13.0 13.0L7.0 13.0Z');
    expect(cheminForme('carre-vide', 10, 10, 3)).toBe(cheminForme('carre', 10, 10, 3));
    expect(cheminForme('triangle-bas', 0, 0, 1)).toBe('M0.0 1.2L1.1 -0.8L-1.1 -0.8Z');
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

describe('formes 0.206.0 : triangles vides réservés, bulle, point de contrôle', () => {
  it('les triangles vides ne sont plus proposés pour les libellés (réservés aux contrôles)', () => {
    const cles = FORMES.map(([cle]) => cle);
    expect(cles).not.toContain('triangle-vide');
    expect(cles).not.toContain('triangle-bas-vide');
    expect(cles).toContain('triangle');
    expect(cles).toContain('triangle-bas');
  });

  it('la bulle d\'annotation est un tracé arrondi, en trait', () => {
    const d = cheminForme('bulle', 0, 0, 4);
    expect(d).toMatch(/^M/);
    expect(d.endsWith('Z')).toBe(true);
    expect(formeEnTrait('bulle')).toBe(true);
  });

  it('le point de contrôle : triangle vide pointe en haut, avec un point léger au centre (0.207.0, sans x)', () => {
    const { triangle, point, rayonPoint } = cheminControle(0, 0, 4);
    // Pointe en haut : le sommet est à y = -1,2 r, la base à y = +0,8 r.
    expect(triangle).toBe(cheminForme('triangle', 0, 0, 4));
    expect(triangle).toContain('M0.0 -4.8');
    // Le point léger est au centre du triangle, un peu plus bas que le centre du cadre.
    expect(point.x).toBe(0);
    expect(point.y).toBeCloseTo(0.532, 3);
    expect(rayonPoint).toBe(rayonPointLeger(4));
  });

  it('point léger : seulement dans les formes vides, 30 % du rayon (1,2 px au moins)', () => {
    expect(formeVide('carre-vide')).toBe(true);
    expect(formeVide('rond-vide')).toBe(true);
    expect(formeVide('bulle')).toBe(true);
    expect(formeVide('carre')).toBe(false);
    expect(formeVide('croix')).toBe(false);
    expect(centrePointLeger('carre', 10, 10, 4)).toBeNull();
    expect(centrePointLeger('carre-vide', 10, 10, 4)).toEqual({ x: 10, y: 10 });
    expect(centrePointLeger('bulle', 10, 10, 5)).toEqual({ x: 10, y: 9 });
    expect(rayonPointLeger(4)).toBeCloseTo(1.2, 5);
    expect(rayonPointLeger(10)).toBeCloseTo(3, 5);
  });

  it('les listes de choix ont un nom en clair, et l\'aperçu dessiné suit le même style', () => {
    for (const [, , nom] of FORMES) expect(nom).toBeTruthy();
    expect(symboleDeForme('carre-vide')).toBe(apercuForme('carre-vide'));
    expect(apercuForme('carre-vide')).toContain('apercu-point');
    expect(apercuForme('carre')).not.toContain('apercu-point');
    expect(apercuForme('croix')).not.toContain('apercu-point');
  });
});
