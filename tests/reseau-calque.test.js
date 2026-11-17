import { describe, it, expect } from 'vitest';
import { fesInterpoles, lireNomCalque, tronconsDeLignes } from '../src/topo/reseau.js';

describe('fils d\'eau interpolés (0.266.0)', () => {
  it('point entre deux FE : interpolé selon la longueur ; aux bouts : vide', () => {
    const s = [
      { est: 0, nord: 0, fe: null },
      { est: 10, nord: 0, fe: 420 },
      { est: 20, nord: 0, fe: '' },
      { est: 40, nord: 0, fe: 419.4 },
      { est: 50, nord: 0, fe: null },
    ];
    const r = fesInterpoles(s);
    expect(r.map((x) => x.fe)).toEqual([null, 420, 419.8, 419.4, null]);
    expect(r.map((x) => x.interpole)).toEqual([false, false, true, false, false]);
  });
  it('plusieurs points de suite sans FE', () => {
    const s = [{ est: 0, nord: 0, fe: 400 }, { est: 3, nord: 4, fe: null }, { est: 6, nord: 8, fe: null }, { est: 6, nord: 18, fe: 399 }];
    expect(fesInterpoles(s).map((x) => x.fe)).toEqual([400, 399.75, 399.5, 399]);
  });
});

describe('diamètre et type lus dans le nom du calque', () => {
  it('lit les exemples de l\'utilisateur', () => {
    expect(lireNomCalque('perrin-ec-200')).toEqual({ diametre: 200, type: 'EC' });
    expect(lireNomCalque('Aaa-800')).toEqual({ diametre: 800, type: null });
    expect(lireNomCalque('C-EC_PVC_200')).toEqual({ diametre: 200, type: 'EC' });
    expect(lireNomCalque('EU315')).toEqual({ diametre: 315, type: 'EU' });
    expect(lireNomCalque('Conduite gaz 2025 x')).toEqual({ diametre: 2025, type: 'Gaz' });
    expect(lireNomCalque('Canalisations')).toEqual({ diametre: null, type: null });
  });
});

describe('lignes d\'un calque en tronçons', () => {
  const p = (est, nord, altitude = 0) => ({ est, nord, altitude });
  it('met bout à bout les lignes qui se touchent, dans le bon sens', () => {
    const t = tronconsDeLignes([[p(10, 0), p(20, 0)], [p(0, 0), p(10, 0)], [p(30, 0), p(20, 0)]]);
    expect(t).toHaveLength(1);
    expect(t[0].map((q) => q.est).sort((a, b) => a - b)).toEqual([0, 10, 20, 30]);
    const xs = t[0].map((q) => q.est);
    expect(xs[0] === 0 || xs[0] === 30).toBe(true); // d'un bout à l'autre, sans aller-retour
  });
  it('lignes séparées = tronçons séparés ; embranchement = arrêt', () => {
    expect(tronconsDeLignes([[p(0, 0), p(10, 0)], [p(50, 0), p(60, 0)]])).toHaveLength(2);
    expect(tronconsDeLignes([[p(0, 0), p(10, 0)], [p(10, 0), p(20, 0)], [p(10, 0), p(10, 10)]])).toHaveLength(3);
  });
});

import { lignesDuCalque } from '../src/topo/calque-sous-doigt.js';
describe('lignes d\'un calque', () => {
  it('rend les lignes du calque en MN95 avec le Z du DXF 3D (0 = pas d\'altitude)', () => {
    const plan = { origine: { est: 2500000, nord: 1100000 }, contenu: { traits: [
      { c: 1, p: [0, 0, 10, 0], z: [420.5, 420.3] },
      { c: 1, p: [10, 0, 20, 0], z: [0, 0] },
      { c: 2, p: [0, 5, 10, 5] },
    ] } };
    const l = lignesDuCalque(plan, 1);
    expect(l).toHaveLength(2);
    expect(l[0][1]).toEqual({ est: 2500010, nord: 1100000, altitude: 420.3 });
    expect(l[1][0].altitude).toBeNull();
  });
});

import { svgCoupeAxe } from '../src/reseaux/coupe-svg.js';
describe('FE interpolé dans la coupe dans l\'axe', () => {
  it('est écrit en italique gris avec « interpolé »', () => {
    const reseau = { id: 'r', type: 'EC', nom: 'EC-1', diametre: 0.2, tranchee: null, sommets: [
      { est: 0, nord: 0, fe: 420 }, { est: 10, nord: 0, fe: 419.9, interpole: true }, { est: 20, nord: 0, fe: 419.8 }] };
    const { svg } = svgCoupeAxe({ reseau });
    expect(svg).toContain('fe-interpole-coupe');
    expect(svg).toContain('419.900 interpolé');
  });
});
