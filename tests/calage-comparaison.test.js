// Calage de plans (0.281.0) : ce qui a changé entre deux indices, cotations lues pour le calage, résultat automatique.
import { describe, it, expect } from 'vitest';
import { differencesPlans, sousPlan } from '../src/topo/differences-plan.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';
import { recetteDeDepart, nettoyerPlan } from '../src/topo/nettoyage-plan.js';
import { resultatAutomatique } from '../src/topo/calage-plan.js';

const plan = (traits, textes = []) => ({
  origine: { est: 2500000, nord: 1100000 },
  calques: [{ nom: 'MURS' }, { nom: 'COTES' }],
  contenu: { traits, pleins: [], cercles: [], textes, points: [] },
});

describe('ce qui a changé entre deux indices', () => {
  const A = plan([{ c: 0, p: [0, 0, 10, 0] }, { c: 0, p: [10, 0, 10, 5] }, { c: 1, p: [0, 5, 10, 5] }], [{ c: 1, x: 5, y: 2, t: '2.50' }]);
  // B : le trait du haut supprimé, un trait ajouté, le texte décalé de 3 cm, le reste à 2 mm près.
  const B = plan([{ c: 0, p: [0.002, 0, 10, 0] }, { c: 0, p: [10, 0, 10, 5] }, { c: 0, p: [0, 0, 0, 5] }], [{ c: 1, x: 5.03, y: 2, t: '2.50' }]);
  const d = differencesPlans(A, B);
  it('ajoutés, supprimés, inchangés', () => {
    expect(d.compte).toEqual({ ajoutes: 2, supprimes: 2, inchanges: 2 });
    expect(d.ajoutes.traits).toEqual([2]);
    expect(d.supprimes.traits).toEqual([2]);
    expect(d.parCalque.find((c) => c.nom === 'COTES')).toEqual({ nom: 'COTES', ajoutes: 1, supprimes: 2 });
  });
  it('un trait supprimé entre deux objets restés n\'est pas « retrouvé » (milieu absent)', () => {
    const C = plan([{ c: 0, p: [0, 0, 10, 0] }, { c: 0, p: [10, 0, 10, 5] }, { c: 0, p: [0, 5, 3, 5] }, { c: 0, p: [7, 5, 10, 5] }]);
    expect(differencesPlans(A, C).supprimes.traits).toContain(2);
  });
  it('sous-plan d\'une couleur', () => {
    expect(sousPlan(B, d.ajoutes, '#16a34a').contenu.traits).toHaveLength(1);
  });
});

describe('cotations et lignes de repère (calage seulement)', () => {
  const dxf = [
    '0', 'SECTION', '2', 'BLOCKS',
    '0', 'BLOCK', '8', '0', '2', '*D1', '70', '1', '10', '0', '20', '0',
    '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '5', '21', '0',
    '0', 'TEXT', '8', '0', '10', '2', '20', '0.5', '40', '0.3', '1', '5.00',
    '0', 'POINT', '8', 'DEFPOINTS', '10', '0', '20', '0',
    '0', 'ENDBLK', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', 'MURS', '10', '0', '20', '0', '11', '5', '21', '5',
    '0', 'DIMENSION', '8', 'COTES', '2', '*D1',
    '0', 'LEADER', '8', 'REPERES', '10', '0', '20', '0', '10', '1', '20', '1',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
  it('ailleurs dans Topo : ignorées comme avant', () => {
    const { plan: p } = lirePlanDxf(dxf);
    expect(p.contenu.traits).toHaveLength(1);
    expect(p.compte.ignores).toEqual({ DIMENSION: 1, LEADER: 1 });
  });
  it('calage : lues, marquées, sur le calque de la cote, et retirées au nettoyage (cochées au départ)', () => {
    const { plan: p } = lirePlanDxf(dxf, 'p', { annotations: true });
    expect(p.contenu.traits.map((t) => t.s ?? '')).toEqual(['', 'DIMENSION', 'LEADER']);
    expect(p.contenu.textes[0]).toEqual(expect.objectContaining({ s: 'DIMENSION', t: '5.00' }));
    expect(p.contenu.points).toHaveLength(0);
    expect(p.calques[p.contenu.traits[1].c].nom).toBe('COTES');
    const r = recetteDeDepart(p);
    expect(r.types).toEqual(expect.objectContaining({ cotations: true, reperes: true, attributs: true, textes: false }));
    const n = nettoyerPlan(p, r);
    expect(n.contenu.traits).toHaveLength(1);
    expect(n.contenu.textes).toHaveLength(0);
  });
});

describe('résultat d\'un calage automatique', () => {
  const auto = { similitude: { echelle: 0.01, rotationDeg: 0, tx: 100, ty: 200 }, niveau: 'forte', echelleBrute: 0.01, echelleArrondie: true };
  it('sans vérification', () => {
    const r = resultatAutomatique(auto, [{ type: 'point', role: 'calage', plan: [0, 0], ref: [0, 0] }]);
    expect(r.verdict).toBe('sans-verification');
    expect(r.elements).toHaveLength(1);
    expect(r.message).toMatch(/FORTE/);
  });
  it('avec une vérification à 1 mm : juste', () => {
    const r = resultatAutomatique(auto, [{ type: 'point', role: 'verification', plan: [1000, 0], ref: [110.001, 200] }]);
    expect(r.verdict).toBe('juste');
    expect(r.elements[0].ecartM).toBeCloseTo(0.001, 6);
  });
});
