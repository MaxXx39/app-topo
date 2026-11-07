// Calage d'un plan par axes (0.152.0) : 2 lignes du plan sur 2 lignes MN95.
import { describe, it, expect } from 'vitest';
import { calageParAxes, croisementDroites, echelleParDeuxPoints, appliquerHelmert } from '../src/topo/recalage.js';

// Plan local : croix d'axes en (0, 0) ; en MN95 elle est en (2500100, 1200200), tournée de 30°.
const R = (30 * Math.PI) / 180;
const versMn95 = (x, y) => ({ est: 2500100 + x * Math.cos(R) - y * Math.sin(R), nord: 1200200 + x * Math.sin(R) + y * Math.cos(R) });
const lignesPlan = [{ a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }, { a: { x: 0, y: -5 }, b: { x: 0, y: 12 } }];
// Les mêmes lignes en MN95, dessinées avec d'autres bouts (et la 1re dans l'autre sens).
const lignesCalees = [{ a: versMn95(30, 0), b: versMn95(-4, 0) }, { a: versMn95(0, 3), b: versMn95(0, 40) }];

describe('calageParAxes', () => {
  it('retrouve la position et la rotation (croisement sur croisement, 1re ligne)', () => {
    const r = calageParAxes(lignesPlan, lignesCalees);
    expect(r.erreur).toBeUndefined();
    expect((r.rotation * 180) / Math.PI).toBeCloseTo(30, 9);
    expect(r.echelle).toBe(1);
    expect(r.ecartAngle).toBeCloseTo(0, 9);
    const p = appliquerHelmert(r, 7, 3);
    const attendu = versMn95(7, 3);
    expect(p.est).toBeCloseTo(attendu.est, 6);
    expect(p.nord).toBeCloseTo(attendu.nord, 6);
  });

  it('« Tourner de 180° » : le croisement reste en place, le plan est retourné', () => {
    const r = calageParAxes(lignesPlan, lignesCalees, { tourne: true });
    expect((r.rotation * 180) / Math.PI).toBeCloseTo(210, 9);
    const c = appliquerHelmert(r, 0, 0);
    expect(c.est).toBeCloseTo(2500100, 6);
    expect(c.nord).toBeCloseTo(1200200, 6);
  });

  it('écart d\'angle de la 2e ligne (contrôle)', () => {
    const tordue = [lignesCalees[0], { a: versMn95(0, 3), b: versMn95(1, 40) }];
    const r = calageParAxes(lignesPlan, tordue);
    expect(Math.abs((r.ecartAngle * 180) / Math.PI)).toBeGreaterThan(1);
    expect((r.rotation * 180) / Math.PI).toBeCloseTo(30, 9); // la 1re ligne commande
  });

  it('échelle donnée : appliquée', () => {
    const r = calageParAxes(lignesPlan, lignesCalees, { echelle: 2 });
    const p = appliquerHelmert(r, 1, 0);
    expect(Math.hypot(p.est - 2500100, p.nord - 1200200)).toBeCloseTo(2, 9);
  });

  it('lignes parallèles : erreur claire', () => {
    const r = calageParAxes([lignesPlan[0], { a: { x: -10, y: 1 }, b: { x: 10, y: 1 } }], lignesCalees);
    expect(r.erreur).toMatch(/parallèles/);
  });
});

describe('croisementDroites et échelle par 2 points', () => {
  it('croisement de droites (hors des segments compris)', () => {
    expect(croisementDroites({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 })).toEqual({ x: 5, y: 0 });
  });
  it('échelle = distance réelle ÷ longueur sur le plan', () => {
    expect(echelleParDeuxPoints({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toBe(2);
    expect(echelleParDeuxPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toBeNull();
  });
});
