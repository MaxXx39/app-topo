// Tests du guidage de lame à 2 RX2 (formules validées par l'utilisateur le 26.10.2026).
import { describe, it, expect } from 'vitest';
import { guidageLame, classeEcartLame, deversEntre, ligneDeCoupeLame, bordsDeLaLame } from '../src/topo/lame.js';

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

describe('profil en long de la lame', async () => {
  const { pointDeProfil, avantDeLaLame, vecteurAzimut, tronconsProfil } = await import('../src/topo/lame.js');

  it('point du profil : gauche, droite ou milieu', () => {
    const g = { est: 0, nord: 0, altitude: 10 };
    const d = { est: 4, nord: 0, altitude: 10.2 };
    expect(pointDeProfil(g, d, 'gauche')).toEqual(g);
    expect(pointDeProfil(g, d, 'droite')).toEqual(d);
    const m = pointDeProfil(g, d, 'milieu');
    expect(m.est).toBe(2);
    expect(m.altitude).toBeCloseTo(10.1, 9);
  });

  it('avant de la lame : gauche à l\'ouest, droite à l\'est → on regarde vers le nord', () => {
    const avant = avantDeLaLame({ est: 0, nord: 0 }, { est: 3, nord: 0 });
    expect(avant.est).toBeCloseTo(0, 9);
    expect(avant.nord).toBeCloseTo(1, 9);
    const est = vecteurAzimut(90);
    expect(est.est).toBeCloseTo(1, 9);
    expect(est.nord).toBeCloseTo(0, 9);
  });

  it('tronçons : segments de même pente regroupés, ruptures de plus de 0.5 %', () => {
    // 0 → 10 m à +2 % (2 segments), puis 10 → 20 m à −1 %, puis 20 → 30 m à −1.3 % (pas de rupture : 0.3 %).
    const morceau = [
      { distance: 0, altitude: 100 }, { distance: 5, altitude: 100.1 }, { distance: 10, altitude: 100.2 },
      { distance: 20, altitude: 100.1 }, { distance: 30, altitude: 99.97 },
    ];
    const { troncons, ruptures } = tronconsProfil([morceau]);
    expect(ruptures).toEqual([10]);
    expect(troncons).toHaveLength(2);
    expect(troncons[0]).toMatchObject({ debut: 0, fin: 10 });
    expect(troncons[0].pente).toBeCloseTo(2, 9);
    expect(troncons[1].pente).toBeCloseTo(-1.15, 9);
  });
});

describe('bords de la surface dans le prolongement de la lame', () => {
  // Carré de 10 m × 10 m (Est 0 à 10, Nord 0 à 10), altitude = 100 + 0.1 × Est.
  const point = (est, nord) => ({ est, nord, altitude: 100 + 0.1 * est });
  const triangles = [
    [point(0, 0), point(10, 0), point(10, 10)],
    [point(0, 0), point(10, 10), point(0, 10)],
  ];

  it('lame dans la surface : longueur qui reste de chaque côté et altitude au bord', () => {
    const bords = bordsDeLaLame({ est: 2, nord: 5, altitude: 100 }, { est: 6, nord: 5, altitude: 100 }, triangles);
    expect(bords.gauche.distance).toBeCloseTo(2, 6);
    expect(bords.gauche.altitude).toBeCloseTo(100, 6);
    expect(bords.droite.distance).toBeCloseTo(4, 6);
    expect(bords.droite.altitude).toBeCloseTo(101, 6);
  });

  it('coin hors de la surface : distance négative jusqu\'au bord', () => {
    const bords = bordsDeLaLame({ est: -3, nord: 5, altitude: 100 }, { est: 4, nord: 5, altitude: 100 }, triangles);
    expect(bords.gauche.distance).toBeCloseTo(-3, 6);
    expect(bords.gauche.altitude).toBeCloseTo(100, 6);
    expect(bords.droite.distance).toBeCloseTo(6, 6);
  });

  it('lame tournée (de droite à gauche) : gauche et droite suivent les coins', () => {
    const bords = bordsDeLaLame({ est: 6, nord: 5, altitude: 100 }, { est: 2, nord: 5, altitude: 100 }, triangles);
    expect(bords.gauche.distance).toBeCloseTo(4, 6);
    expect(bords.gauche.altitude).toBeCloseTo(101, 6);
    expect(bords.droite.distance).toBeCloseTo(2, 6);
  });

  it('les 2 coins hors de la surface, du même côté : distances négatives', () => {
    const bords = bordsDeLaLame({ est: 12, nord: 5, altitude: 100 }, { est: 15, nord: 5, altitude: 100 }, triangles);
    expect(bords.gauche.distance).toBeCloseTo(-2, 6);
    expect(bords.droite.distance).toBeCloseTo(-5, 6);
  });

  it('ligne de la lame qui ne touche pas la surface : rien', () => {
    const bords = bordsDeLaLame({ est: 2, nord: 20, altitude: 100 }, { est: 6, nord: 20, altitude: 100 }, triangles);
    expect(bords).toEqual({ gauche: null, droite: null });
  });
});

describe('sens de la coupe de la lame (0.100.0)', () => {
  it('bull : perpendiculaire à la lame ; grader : sens de marche, ou perpendiculaire à l\'arrêt', async () => {
    const { sensCoupeLame } = await import('../src/topo/lame.js');
    // Lame d'ouest (gauche) en est (droite) : l'avant est au nord.
    const gauche = { est: 0, nord: 0, altitude: 0 };
    const droite = { est: 3, nord: 0, altitude: 0 };
    const bull = sensCoupeLame('bull', gauche, droite, 45);
    expect(bull.est).toBeCloseTo(0);
    expect(bull.nord).toBeCloseTo(1);
    const grader = sensCoupeLame('grader', gauche, droite, 45);
    expect(grader.est).toBeCloseTo(Math.SQRT1_2);
    expect(grader.nord).toBeCloseTo(Math.SQRT1_2);
    expect(sensCoupeLame('grader', gauche, droite, null).nord).toBeCloseTo(1);
  });
});
