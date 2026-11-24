// 0.309.0 : plan importé « déjà calé » (MN95, sans référence ni calage) dans le Calage de plans.
import { describe, it, expect } from 'vitest';
import { planCale, plansCales, resultatDejaCale, estDejaCale, referencesPourVerifier, plansDeReference } from '../src/calage/plans.js';
import { planRecale } from '../src/topo/recalage.js';
import { controlerIndice, reperesDuPlan } from '../src/topo/indice-plan.js';

// Plan déjà en MN95, rangé comme lirePlanDxf (origine + coordonnées relatives).
const lu = {
  nom: 'Villa.dxf',
  origine: { est: 2510200, nord: 1141700 },
  bornes: { estMin: 2510200, nordMin: 1141700, estMax: 2510260, nordMax: 1141740 },
  calques: [{ nom: 'Murs', couleur: '#000000', visible: true }],
  contenu: { traits: [{ c: 0, k: null, p: [0, 0, 60, 0, 60, 40, 0, 40, 0, 0] }], pleins: [], cercles: [], textes: [], points: [] },
  compte: { objets: 1, ignores: {} },
};

const range = (id, extra = {}) => ({
  ...planCale({ lu, nom: 'DXF-Villa_ind-A', fichier: 'Villa.dxf', resultat: resultatDejaCale(), reference: null, elements: [], id, le: '2026-11-24T10:00:00Z', mode: 'deja-cale', reperes: reperesDuPlan(lu, {}) }),
  ...extra,
});

describe('plan importé déjà calé', () => {
  it('rangé comme un plan calé, sans référence, sans déplacement', () => {
    const p = range('a');
    expect(estDejaCale(p)).toBe(true);
    expect(p.calage.referenceId).toBeNull();
    expect(p.calage.verdict).toBe('sans-verification');
    expect(p.calage.indices[0].mode).toBe('deja-cale');
    expect(p.dejaCale).toBe(true);
    const enPlace = planRecale(p);
    expect(enPlace.bornes.estMin).toBeCloseTo(2510200, 6);
    expect(enPlace.bornes.nordMax).toBeCloseTo(1141740, 6);
    expect(plansCales([p]).map((q) => q.id)).toEqual(['a']);
  });

  it('nouvel indice : même origine si le plan n\'a pas bougé (échelle 1)', () => {
    const p = range('a');
    expect(controlerIndice(p.calage.reperes, lu, p.calage.similitude.echelle).memeOrigine).toBe(true);
    const bouge = { ...lu, origine: { est: lu.origine.est + 0.5, nord: lu.origine.nord } };
    expect(controlerIndice(p.calage.reperes, bouge, 1).memeOrigine).toBe(false);
  });

  it('vérifier : les autres plans du projet, pas les indices du même plan', () => {
    const a = range('a');
    const b = range('b', { calage: { ...range('b').calage, groupe: 'a' } });
    const autre = { id: 'r', nom: 'Référence', contenu: { traits: [{ p: [0, 0, 1, 1] }] }, bornes: lu.bornes };
    const plans = [a, b, autre];
    expect(plansDeReference(plans).map((p) => p.id)).toEqual(['a', 'b', 'r']);
    expect(referencesPourVerifier(plans, a).map((p) => p.id)).toEqual(['r']);
  });
});
