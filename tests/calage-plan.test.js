// Calage de plans : moteur (points, axes, vérification), essayé avec de vrais points du plan_A de l'utilisateur
// (coins du bâtiment, repris des tests de l'appli d'origine Calage-Plan) : attendu échelle 0,01, rotation ≈ 121,417°,
// translation ≈ (2 510 211,855 ; 1 141 525,202).
import { describe, it, expect } from 'vitest';
import {
  caler, ErreurCalage, appliquerSimilitude, inverserSimilitude, composerSimilitudes, puissanceDeDix, verdictEcart,
} from '../src/topo/calage-plan.js';

const P1 = [[16382.052, -16553.176], [2510267.726, 1141751.289]];
const P2 = [[19985.355, -14088.02], [2510227.906, 1141769.19]];
const P3 = [[21672.818, -15966.025], [2510235.137, 1141793.38]];
const point = ([plan, ref], role = 'calage') => ({ type: 'point', role, plan, ref });

describe('similitude', () => {
  it('inverse et composition', () => {
    const s = { echelle: 0.01, rotationDeg: 121.4, tx: 2510000, ty: 1140000 };
    const p = appliquerSimilitude(s, [1000, -500]);
    const retour = appliquerSimilitude(inverserSimilitude(s), p);
    expect(retour[0]).toBeCloseTo(1000, 6);
    expect(retour[1]).toBeCloseTo(-500, 6);
    const id = composerSimilitudes(inverserSimilitude(s), s);
    expect(id.echelle).toBeCloseTo(1, 12);
    expect(puissanceDeDix(0.00998)).toBeCloseTo(0.01, 12);
  });
  it('seuils décidés : ≤ 2 mm juste, ≤ 4 mm à revoir, au-delà faux', () => {
    expect(verdictEcart(0.0018)).toBe('juste');
    expect(verdictEcart(0.002)).toBe('juste');
    expect(verdictEcart(0.0035)).toBe('a-revoir');
    expect(verdictEcart(0.0041)).toBe('faux');
  });
});

describe('calage sur le vrai plan_A', () => {
  it('2 points + 1 vérification retrouvent la transformation', () => {
    const r = caler([point(P1), point(P2), point(P3, 'verification')]);
    const s = r.similitude;
    expect(s.echelle).toBe(0.01);
    expect(r.echelleArrondie).toBe(true);
    expect(Math.abs(s.rotationDeg - 121.417)).toBeLessThan(0.01);
    expect(Math.abs(s.tx - 2510211.855)).toBeLessThan(0.01);
    expect(Math.abs(s.ty - 1141525.202)).toBeLessThan(0.01);
    const v = r.elements.find((e) => e.role === 'verification');
    expect(v.ecartM).toBeLessThan(0.01);
    expect(['juste', 'a-revoir', 'faux']).toContain(r.verdict);
  });
  it('2 axes + 1 point, puis 3 axes seuls', () => {
    const mixte = caler([
      { type: 'axe', plan: [17000, -16552.66, 20000, -16550.142], ref: [2510260.373, 1141763.304, 2510250.0, 1141780.25] },
      { type: 'axe', plan: [16382.052, -16553.176, 15905.161, -14091.758], ref: [2510267.726, 1141751.289, 2510249.206, 1141734.389] },
      point(P3),
      point(P2, 'verification'),
    ]);
    expect(mixte.similitude.echelle).toBe(0.01);
    expect(Math.abs(mixte.similitude.rotationDeg - 121.417)).toBeLessThan(0.01);
    const A1 = { type: 'axe', plan: [16382.052, -16553.176, 21077.552, -16549.239], ref: [2510267.726, 1141751.289, 2510243.217, 1141791.34] };
    const A2 = { type: 'axe', plan: [15905.161, -14091.758, 19985.355, -14088.02], ref: [2510249.206, 1141734.389, 2510227.906, 1141769.19] };
    const A3 = { type: 'axe', plan: [16382.052, -16553.176, 15905.161, -14091.758], ref: [2510267.726, 1141751.289, 2510249.206, 1141734.389] };
    const axes = caler([A1, A2, A3, point(P3, 'verification')]);
    expect(axes.similitude.echelle).toBe(0.01);
    expect(Math.abs(axes.similitude.rotationDeg - 121.417)).toBeLessThan(0.01);
    expect(() => caler([A1, A3])).toThrow(ErreurCalage);
  });
  it('un clic faux est vu par la vérification ; combinaisons impossibles refusées', () => {
    const faux = [P3[0], [P3[1][0] + 0.8, P3[1][1]]];
    const r = caler([point(P1), point(P2), point(faux, 'verification')]);
    expect(r.verdict).toBe('faux');
    expect(r.message).toContain('FAUX');
    expect(() => caler([point(P1), point(P1)])).toThrow('confondus');
    expect(() => caler([point(P1)])).toThrow(ErreurCalage);
    expect(() => caler([point(P1, 'verification')])).toThrow('Aucun élément');
    const sans = caler([point(P1), point(P2)]);
    expect(sans.verdict).toBe('sans-verification');
  });
});
