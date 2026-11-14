// Tests des réseaux (canalisations) : validation, pentes, bords du fond de tranchée, coupe en travers, forme de la tranchée.
import { describe, it, expect } from 'vitest';
import { nouveauReseau, erreurReseau, pentesDesSegments, feALAbscisse, bordsFondTranchee, coupeEnTravers, croisementSegments, formeTranchee, longueurReseau, couleurDuType, croisementsSurAxe, HAUTEUR_SANS_SURFACE } from '../src/topo/reseau.js';

const s = (est, nord, fe) => ({ est, nord, fe });
// Réseau EU vers l'est : 10 m à +10 % puis 10 m à −20 %.
const EU = () => nouveauReseau({ type: 'EU', nom: 'EU-1', diametre: 0.315, sommets: [s(0, 0, 100), s(10, 0, 101), s(20, 0, 99)], tranchee: { hauteur: 0.15, largeur: 0.8, talus: 0.5 } });

describe('validation', () => {
  it('un réseau correct n\'a pas d\'erreur', () => {
    expect(erreurReseau(EU())).toBeNull();
  });

  it('dit ce qui manque : nom, points, fil d\'eau, diamètre, tranchée', () => {
    expect(erreurReseau({ ...EU(), nom: ' ' })).toMatch(/nom/);
    expect(erreurReseau({ ...EU(), sommets: [s(0, 0, 100)] })).toMatch(/2 points/);
    expect(erreurReseau({ ...EU(), diametre: 0 })).toMatch(/diamètre/);
    expect(erreurReseau({ ...EU(), sommets: [s(0, 0, 100), s(5, 0, null)] })).toMatch(/point 2/);
    expect(erreurReseau({ ...EU(), sommets: [s(0, 0, 100), s(0, 0, 101)] })).toMatch(/même endroit/);
    expect(erreurReseau({ ...EU(), tranchee: { hauteur: 0.15, largeur: 0, talus: 0.5 } })).toMatch(/largeur/);
    expect(erreurReseau({ ...EU(), tranchee: { hauteur: 0.15, largeur: 0.8, talus: -1 } })).toMatch(/talus/);
  });

  it('bords droits (blindage) : talus 0 accepté', () => {
    expect(erreurReseau({ ...EU(), tranchee: { hauteur: 0.15, largeur: 0.8, talus: 0 } })).toBeNull();
  });
});

describe('pentes et fil d\'eau', () => {
  it('pente de chaque segment en % (dénivelé ÷ longueur en plan)', () => {
    const [p1, p2] = pentesDesSegments(EU());
    expect(p1).toBeCloseTo(10, 6);
    expect(p2).toBeCloseTo(-20, 6);
    expect(longueurReseau(EU())).toBe(20);
  });

  it('fil d\'eau à une abscisse, null hors du réseau', () => {
    expect(feALAbscisse(EU(), 5)).toBeCloseTo(100.5, 6);
    expect(feALAbscisse(EU(), 15)).toBeCloseTo(100, 6);
    expect(feALAbscisse(EU(), 25)).toBeNull();
  });

  it('couleur du type, gris si inconnu', () => {
    expect(couleurDuType('EU')).toBe('#92400e');
    expect(couleurDuType('Zorglub')).toBe('#64748b');
  });
});

describe('bords du fond de la tranchée', () => {
  it('à gauche et à droite de ± largeur / 2, à FE − hauteur', () => {
    const { gauche, droit } = bordsFondTranchee(EU());
    // Vers l'est : la gauche est au nord (+), la droite au sud (−).
    expect(gauche[0].nord).toBeCloseTo(0.4, 6);
    expect(droit[0].nord).toBeCloseTo(-0.4, 6);
    expect(gauche[0].altitude).toBeCloseTo(99.85, 6);
    expect(droit[1].altitude).toBeCloseTo(100.85, 6);
  });

  it('pas de tranchée : null', () => {
    expect(bordsFondTranchee({ ...EU(), tranchee: null })).toBeNull();
  });
});

describe('coupe en travers', () => {
  it('le réseau choisi est au milieu, un autre réseau qui croise est placé avec son FE', () => {
    const eu = EU();
    // EC parallèle à EU, 2 m au nord (à gauche), FE 98 → 102 entre x = 3 et x = 5.
    const ec = nouveauReseau({ type: 'EC', nom: 'EC-1', diametre: 0.25, sommets: [s(3, 2, 98), s(5, 2, 102)] });
    const coupe = coupeEnTravers([eu, ec], eu.id, 4, 4);
    // Coupe nord-sud à x = 4 : la gauche (nord) est au début.
    expect(coupe.debut.nord).toBeCloseTo(4, 6);
    expect(coupe.fin.nord).toBeCloseTo(-4, 6);
    expect(coupe.tuyaux).toHaveLength(2);
    expect(coupe.tuyaux[0].x).toBe(4);
    expect(coupe.tuyaux[0].fe).toBeCloseTo(100.4, 6);
    // L'EC croise à 2 m du bord gauche (nord = 2), FE 100.
    expect(coupe.tuyaux[1].x).toBeCloseTo(2, 6);
    expect(coupe.tuyaux[1].fe).toBeCloseTo(100, 6);
  });

  it('hors du réseau : null', () => {
    const eu = EU();
    expect(coupeEnTravers([eu], eu.id, 99)).toBeNull();
    expect(coupeEnTravers([eu], 'inconnu', 1)).toBeNull();
  });

  it('croisement de segments', () => {
    expect(croisementSegments({ est: 0, nord: 0 }, { est: 10, nord: 0 }, { est: 5, nord: -1 }, { est: 5, nord: 1 })).toEqual({ t: 0.5, u: 0.5 });
    expect(croisementSegments({ est: 0, nord: 0 }, { est: 10, nord: 0 }, { est: 0, nord: 1 }, { est: 10, nord: 1 })).toBeNull();
    expect(croisementSegments({ est: 0, nord: 0 }, { est: 4, nord: 0 }, { est: 5, nord: -1 }, { est: 5, nord: 1 })).toBeNull();
  });
});

describe('forme de la tranchée', () => {
  const t = { hauteur: 0.15, largeur: 0.8, talus: 0.5 };

  it('terrain plat : le talus monte jusqu\'au terrain', () => {
    // FE 100, fond 99.85, terrain 101.85 : 2 m de haut → 1 m de talus de chaque côté.
    const f = formeTranchee(4, 100, t, () => 101.85);
    expect(f[1]).toEqual({ x: 3.6, z: 99.85 });
    expect(f[2]).toEqual({ x: 4.4, z: 99.85 });
    expect(f[0].x).toBeCloseTo(2.6, 6);
    expect(f[3].x).toBeCloseTo(5.4, 6);
    expect(f[0].z).toBeCloseTo(101.85, 6);
  });

  it('bords droits (talus 0, blindage) : largeur constante', () => {
    const f = formeTranchee(4, 100, { ...t, talus: 0 }, () => 101.85);
    expect(f[0].x).toBeCloseTo(3.6, 6);
    expect(f[3].x).toBeCloseTo(4.4, 6);
  });

  it('terrain en pente : chaque côté touche le terrain à sa place', () => {
    const f = formeTranchee(4, 100, t, (x) => 101 + 0.2 * x);
    const [g, , , d] = f;
    expect(g.z).toBeCloseTo(101 + 0.2 * g.x, 4);
    expect(d.z).toBeCloseTo(101 + 0.2 * d.x, 4);
    expect(d.z).toBeGreaterThan(g.z);
  });

  it('sans surface : la tranchée s\'arrête à FE + hauteur par défaut', () => {
    const f = formeTranchee(4, 100, t, null);
    expect(f[0].z).toBeCloseTo(100 + HAUTEUR_SANS_SURFACE, 6);
  });
});

describe('croisements dans l\'axe', () => {
  it('liste les autres réseaux qui croisent, avec leur distance et leur FE', () => {
    const eu = EU();
    const ec = nouveauReseau({ type: 'EC', nom: 'EC-1', diametre: 0.25, sommets: [s(4, -2, 98), s(4, 2, 102)] });
    const loin = nouveauReseau({ type: 'AEP', nom: 'AEP-1', diametre: 0.11, sommets: [s(50, -2, 98), s(50, 2, 98)] });
    const liste = croisementsSurAxe([eu, ec, loin], eu.id);
    expect(liste).toHaveLength(1);
    expect(liste[0].d).toBeCloseTo(4, 6);
    expect(liste[0].fe).toBeCloseTo(100, 6);
    expect(liste[0].reseau.nom).toBe('EC-1');
  });
});
