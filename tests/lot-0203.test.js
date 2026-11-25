import { describe, it, expect } from 'vitest';
import { segmentConstruction, objetSousLePoint, STYLES_LIGNE, styleLigne } from '../src/topo/plan-chantier.js';
import { equipementsVehicule } from '../src/topo/symboles.js';
import { cadreDuTexte, rayonArrondi } from '../src/plans-chantier/dessin.js';

describe('0.320.3 construction en polyligne', () => {
  const o = { id: 'c', type: 'construction', infinie: false, points: [[0, 0], [10, 0], [10, 10]] };
  it('un segment garde tous ses points, sans prolongement', () => {
    expect(segmentConstruction(o)).toHaveLength(3);
  });
  it('se touche sur chacun de ses tronçons', () => {
    expect(objetSousLePoint([o], [10, 6], 0.5)).toBe(o);
    expect(objetSousLePoint([o], [5, 0], 0.5)).toBe(o);
    expect(objetSousLePoint([o], [0, 8], 0.5)).toBe(null);
  });
  it('une droite infinie est toujours prolongée', () => {
    const d = { id: 'd', type: 'construction', infinie: true, points: [[0, 0], [1, 0]] };
    const s = segmentConstruction(d);
    expect(s[0][0]).toBeLessThan(-1000);
    expect(s[1][0]).toBeGreaterThan(1000);
  });
});

describe('0.320.3 texte', () => {
  it('cadre : ancien réglage « sans cadre » repris, sinon arrondi', () => {
    expect(cadreDuTexte({ nu: true })).toBe('aucun');
    expect(cadreDuTexte({})).toBe('arrondi');
    expect(cadreDuTexte({ cadre: 'double', nu: true })).toBe('double');
  });
  it('arrondi : peu par défaut', () => {
    expect(rayonArrondi(undefined)).toBe(0.12);
    expect(rayonArrondi('carre')).toBe(0);
    expect(rayonArrondi('normal')).toBe(0.35);
  });
  it('l\'échafaudage propose son texte par défaut', () => {
    expect(styleLigne('echafaudage').texteDefaut).toBe('ÉCHAFAUDAGE');
    expect(STYLES_LIGNE.find((s) => s.cle === 'cloture').texteDefaut).toBeUndefined();
  });
});

describe('0.320.3 toupie', () => {
  it('les feux sont au bout du châssis, pas au bout de la trémie', () => {
    const b = { xMin: -1.619, xMax: 1.619, yMin: -4.247, yMax: 4.247 };
    const toupie = equipementsVehicule('Camion Toupie', b).filter((p) => p.mat === 'feu');
    const camion = equipementsVehicule('Camion Benne Vide', b).filter((p) => p.mat === 'feu');
    expect(toupie).toHaveLength(2);
    const yToupie = Math.max(...toupie.flatMap((p) => p.p[0].filter((_, i) => i % 2))); // y max d'un feu
    const yCamion = Math.max(...camion.flatMap((p) => p.p[0].filter((_, i) => i % 2)));
    expect(yToupie).toBeLessThan(3.1);
    expect(yCamion).toBeGreaterThan(4);
  });
});
