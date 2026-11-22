// Calage automatique (0.281.0) : un plan fabriqué (en cm, origine et rotation à lui) est retrouvé sur sa copie MN95.
import { describe, it, expect } from 'vitest';
import { calerAutomatiquement, voter, niveauDeConfiance } from '../src/topo/calage-auto.js';
import { appliquerSimilitude } from '../src/topo/calage-plan.js';

// Plan « architecte » : 60 rectangles de tailles variées (cm), répartis sur 60 m × 40 m.
function planEnCm() {
  const segs = [];
  let graine = 7;
  const hasard = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  for (let k = 0; k < 60; k += 1) {
    const x = hasard() * 6000;
    const y = hasard() * 4000;
    const l = 150 + hasard() * 900;
    const h = 120 + hasard() * 700;
    const c = [[x, y], [x + l, y], [x + l, y + h], [x, y + h]];
    for (let i = 0; i < 4; i += 1) segs.push([...c[i], ...c[(i + 1) % 4]]);
  }
  return segs;
}
const vrai = { echelle: 0.01, rotationDeg: 121.4163, tx: 2510211.853, ty: 1141525.2 };
const versMn95 = (segs, s) => segs.map(([a, b, c, d]) => [...appliquerSimilitude(s, [a, b]), ...appliquerSimilitude(s, [c, d])]);

describe('calage automatique', () => {
  const plan = planEnCm();
  it('retrouve échelle, rotation et translation (confiance forte)', () => {
    const r = calerAutomatiquement(plan, versMn95(plan, vrai));
    expect(r.niveau).toBe('forte');
    expect(r.similitude.echelle).toBe(0.01);
    expect(Math.abs(r.similitude.rotationDeg - vrai.rotationDeg)).toBeLessThan(0.0001);
    expect(Math.hypot(r.similitude.tx - vrai.tx, r.similitude.ty - vrai.ty)).toBeLessThan(0.001);
  });
  it('la cible n\'a qu\'une partie du plan, avec des traits en plus : retrouvé quand même', () => {
    const cible = [...versMn95(plan.slice(0, 160), vrai), ...versMn95(planEnCm().map(([a, b, c, d]) => [a + 9000, b, c + 9000, d]).slice(0, 80), vrai)];
    const r = calerAutomatiquement(plan, cible);
    expect(Math.abs(r.similitude.rotationDeg - vrai.rotationDeg)).toBeLessThan(0.001);
  });
  it('rien en commun : pas de solution ou confiance faible', () => {
    const autre = planEnCm().map(([a, b, c, d]) => [a * 0.37, b * 0.53, c * 0.37, d * 0.53]);
    const r = calerAutomatiquement(plan, versMn95(autre, vrai).slice(0, 40));
    expect(r === null || r.niveau === 'faible').toBe(true);
  });
  it('niveaux de confiance (seuils de l\'appli d\'origine)', () => {
    expect(niveauDeConfiance({ dominance: 3, score: 20 }, { points: 40, ecartMoyen: 0.005 })).toBe('forte');
    expect(niveauDeConfiance({ dominance: 1.6, score: 9 }, { points: 20, ecartMoyen: 0.015 })).toBe('moyenne');
    expect(niveauDeConfiance({ dominance: 1.2, score: 30 }, { points: 200, ecartMoyen: 0.001 })).toBe('faible');
  });
  it('vote seul : la bonne échelle gagne', () => {
    expect(voter(plan, versMn95(plan, vrai)).echelle).toBe(0.01);
  });
});
