import { describe, it, expect } from 'vitest';
import { cadrerSurPointsTourne, cadrerSurPoints, versEcran } from '../src/plan/vue.js';

// 0.118.0 « Voir toute la ligne » : la ligne entière au milieu du plan, tourné comme le récepteur.
describe('cadrerSurPointsTourne', () => {
  const ligne = [{ est: 2509478.9, nord: 1141143.6 }, { est: 2509488.4, nord: 1141133.3 }, { est: 2509500.9, nord: 1141119.7 }];

  it('sans rotation : même cadre que cadrerSurPoints', () => {
    const a = cadrerSurPointsTourne(ligne, 400, 300, 0, 30);
    const b = cadrerSurPoints(ligne, 400, 300, 30);
    expect(a.echelle).toBeCloseTo(b.echelle, 6);
    expect(a.estCentre).toBeCloseTo(b.estCentre, 6);
    expect(a.nordCentre).toBeCloseTo(b.nordCentre, 6);
  });

  it.each([0, 37, 90, 180, 251])('rotation %i° : tous les points dans l\'écran, ligne centrée', (rotation) => {
    const vue = cadrerSurPointsTourne(ligne, 400, 300, rotation, 30);
    expect(vue.rotation).toBe(rotation);
    const ecran = ligne.map((p) => versEcran(p.est, p.nord, vue));
    const xs = ecran.map((p) => p.x);
    const ys = ecran.map((p) => p.y);
    for (const p of ecran) {
      expect(p.x).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(370 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(270 + 1e-6);
    }
    // Centré : le cadre des points a son milieu au milieu de l'écran.
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(200, 6);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(150, 6);
  });

  it('ligne tournée dans le sens de marche : elle remplit la hauteur', () => {
    // Ligne vers le nord-est (azimut 45°) et plan tourné de 45° : la ligne est verticale à l'écran.
    const droite = [{ est: 0, nord: 0 }, { est: 10, nord: 10 }];
    const vue = cadrerSurPointsTourne(droite, 400, 300, 45, 30);
    const a = versEcran(0, 0, vue);
    const b = versEcran(10, 10, vue);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(240, 6);
  });

  it('sans point lisible : null', () => {
    expect(cadrerSurPointsTourne([], 400, 300, 0)).toBeNull();
    expect(cadrerSurPointsTourne([{ est: NaN, nord: 1 }], 400, 300, 0)).toBeNull();
  });
});
