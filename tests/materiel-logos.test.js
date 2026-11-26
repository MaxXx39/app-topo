import { describe, it, expect } from 'vitest';
import { LOGOS, svgLogo, logoDeCle } from '../src/materiel/logos.js';
import { definirLogoCategorie, normaliserParc, ajouterCategorie } from '../src/materiel/donnees.js';

describe('logos des catégories (0.325.0)', () => {
  it('16 logos, clés uniques, svg écrit, clé inconnue = rien', () => {
    expect(LOGOS.length).toBe(16);
    expect(new Set(LOGOS.map((l) => l.cle)).size).toBe(16);
    expect(svgLogo('canne')).toContain('<svg');
    expect(svgLogo('nimporte')).toBe('');
    expect(logoDeCle('drone').nom).toBe('Drone');
  });
  it('choisir puis retirer le logo d\'une catégorie', () => {
    const parc = normaliserParc(null);
    const c = ajouterCategorie(parc, 'Canne GPS');
    definirLogoCategorie(parc, c.id, 'canne');
    expect(parc.categories[0].logo).toBe('canne');
    definirLogoCategorie(parc, c.id, '');
    expect(parc.categories[0].logo).toBeUndefined();
  });
});
