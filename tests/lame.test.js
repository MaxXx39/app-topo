// Tests du guidage de lame à 2 RX2 (formules validées par l'utilisateur le 26.10.2026).
import { describe, it, expect } from 'vitest';
import { guidageLame, classeEcartLame, deversEntre, ligneDeCoupeLame } from '../src/topo/lame.js';

// Surface plane qui monte de 2 % vers l'Est : altitude 450 en Est 2500000.
const surface = (est) => 450 + 0.02 * (est - 2500000);

describe('guidage de lame', () => {
  it('écart à chaque coin : positif = monter la lame ; couleurs 2 / 5 cm', () => {
    const gauche = { est: 2500000, nord: 1100000, altitude: 449.97 }; // 3 cm sous la surface
    const droite = { est: 2500003, nord: 1100000, altitude: 450.06 + 0.01 }; // surface 450.06, 1 cm au-dessus
    const r = guidageLame({ gauche, droite, altitudeSurface: (est) => surface(est) });
    expect(r.largeur).toBeCloseTo(3, 9);
    expect(r.gauche.ecart).toBeCloseTo(0.03, 9);
    expect(r.gauche.classe).toBe('orange');
    expect(r.droite.ecart).toBeCloseTo(-0.01, 9);
    expect(r.droite.classe).toBe('vert');
  });

  it('dévers : positif = côté droit plus haut ; dévers voulu = celui de la surface', () => {
    const gauche = { est: 2500000, nord: 1100000, altitude: 450 };
    const droite = { est: 2500003, nord: 1100000, altitude: 450.03 };
    const r = guidageLame({ gauche, droite, altitudeSurface: (est) => surface(est) });
    expect(r.devers).toBeCloseTo(1, 9); // 3 cm sur 3 m
    expect(r.deversVoulu).toBeCloseTo(2, 9);
    expect(r.ecartDevers).toBeCloseTo(1, 9);
    expect(deversEntre(droite, gauche)).toBeCloseTo(-1, 9); // lame vue dans l'autre sens
  });

  it('coin hors de la surface : pas d\'écart ; récepteurs au même endroit : erreur', () => {
    const gauche = { est: 0, nord: 0, altitude: 1 };
    const r = guidageLame({ gauche, droite: { est: 3, nord: 0, altitude: 1 }, altitudeSurface: () => null });
    expect(r.gauche).toEqual({ ecart: null, classe: null, altitudeSurface: null });
    expect(r.deversVoulu).toBeNull();
    expect(guidageLame({ gauche, droite: { est: 0.05, nord: 0, altitude: 1 }, altitudeSurface: () => 0 }).erreur).toBeTruthy();
    expect(classeEcartLame(0.051)).toBe('rouge');
    expect(classeEcartLame(0.02)).toBe('vert');
  });

  it('ligne de la coupe : coins prolongés de 1 m de chaque côté', () => {
    const { debut, fin } = ligneDeCoupeLame({ est: 0, nord: 0 }, { est: 3, nord: 4 });
    expect(debut.est).toBeCloseTo(-0.6, 9);
    expect(debut.nord).toBeCloseTo(-0.8, 9);
    expect(fin.est).toBeCloseTo(3.6, 9);
    expect(fin.nord).toBeCloseTo(4.8, 9);
  });
});
