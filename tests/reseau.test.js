// Tests du recollement de réseaux (formules validées par l'utilisateur le 30.10.2026).
import { describe, it, expect } from 'vitest';
import { filDEauDepuisDessus, penteTroncon, profondeurChambre, radierChambre, chambreDepuisTroisCoins } from '../src/topo/reseau.js';

describe('recollement de réseaux', () => {
  it('fil d\'eau = altitude du dessus − diamètre extérieur', () => {
    expect(filDEauDepuisDessus(450.5, 315)).toBeCloseTo(450.185, 9);
  });

  it('pente négative quand ça descend, avec le sens d\'écoulement', () => {
    const a = { est: 0, nord: 0, filEau: 450 };
    const b = { est: 30, nord: 40, filEau: 449 }; // 50 m à plat, descend de 1 m
    const descend = penteTroncon(a, b);
    expect(descend.distance).toBeCloseTo(50, 9);
    expect(descend.pente).toBeCloseTo(-2, 9);
    expect(descend.sens).toBe('a-b');
    const monte = penteTroncon(b, a);
    expect(monte.pente).toBeCloseTo(2, 9);
    expect(monte.sens).toBe('b-a');
    expect(penteTroncon(a, { ...b, filEau: 450 }).sens).toBe('plat');
  });

  it('pas de pente sans fil d\'eau ou au même endroit', () => {
    expect(penteTroncon({ est: 0, nord: 0 }, { est: 1, nord: 0, filEau: 1 }).pente).toBeNull();
    expect(penteTroncon({ est: 0, nord: 0, filEau: 1 }, { est: 0, nord: 0, filEau: 2 }).pente).toBeNull();
  });

  it('profondeur : calculée si tampon et radier, sinon tapée ; radier déduit', () => {
    expect(profondeurChambre({ tampon: 452, radier: 449.5, saisie: 9 })).toBeCloseTo(2.5, 9);
    expect(profondeurChambre({ tampon: 452, saisie: 2.4 })).toBe(2.4);
    expect(profondeurChambre({})).toBeNull();
    expect(radierChambre({ tampon: 452, saisie: 2.4 })).toBeCloseTo(449.6, 9);
    expect(radierChambre({ tampon: 452, radier: 449.5, saisie: 2.4 })).toBe(449.5);
    expect(radierChambre({ saisie: 2.4 })).toBeNull();
  });

  it('chambre rectangulaire : 3 coins dans n\'importe quel ordre', () => {
    const coins = [{ est: 0, nord: 0, altitude: 450 }, { est: 2, nord: 0, altitude: 450.02 }, { est: 2, nord: 1, altitude: 450.01 }];
    const ordres = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2]];
    for (const ordre of ordres) {
      const c = chambreDepuisTroisCoins(ordre.map((i) => coins[i]));
      expect(c.centre.est).toBeCloseTo(1, 9);
      expect(c.centre.nord).toBeCloseTo(0.5, 9);
      expect([c.cote1, c.cote2].sort()).toEqual([1, 2]);
      expect(c.tampon).toBeCloseTo(450.01, 9);
      expect(c.ecartAngleDroit).toBeLessThan(1e-6);
      expect(c.coins.some((k) => Math.abs(k.est) < 1e-9 && Math.abs(k.nord - 1) < 1e-9)).toBe(true); // 4e coin
    }
  });

  it('refuse un nombre de coins faux ou deux coins confondus', () => {
    expect(() => chambreDepuisTroisCoins([])).toThrow();
    const p = { est: 0, nord: 0, altitude: 1 };
    expect(() => chambreDepuisTroisCoins([p, p, { est: 1, nord: 1, altitude: 1 }])).toThrow();
  });
});
