// Autocontrôle sur des points connus (Terrain › Contrôler).
import { describe, it, expect } from 'vitest';
import {
  TOLERANCES_PAR_DEFAUT,
  ecartsControle,
  classeTolerance,
  resultatControle,
  controleNecessaire,
  lireTolerances,
  csvControles,
  ajouterPointsControle,
} from '../src/topo/controle.js';

const connu = { est: 2500000, nord: 1100000, altitude: 450 };

describe('écarts du contrôle', () => {
  it('mesuré − connu, en Est, Nord, plan et hauteur (m)', () => {
    const e = ecartsControle(connu, { est: 2500000.03, nord: 1099999.96, altitude: 450.012 });
    expect(e.est).toBeCloseTo(0.03, 6);
    expect(e.nord).toBeCloseTo(-0.04, 6);
    expect(e.plan).toBeCloseTo(0.05, 6);
    expect(e.hauteur).toBeCloseTo(0.012, 6);
  });

  it('pas d\'écart en hauteur si le point connu n\'a pas d\'altitude', () => {
    expect(ecartsControle({ est: 0, nord: 0, altitude: null }, { est: 0, nord: 0, altitude: 450 }).hauteur).toBeNull();
  });
});

describe('couleur selon la tolérance', () => {
  const tol = { vert: 0.02, orange: 0.04 };
  it('vert jusqu\'à 2 cm (compris), orange jusqu\'à 4 cm, rouge au-delà', () => {
    expect(classeTolerance(0.0199, tol)).toBe('vert');
    expect(classeTolerance(0.02, tol)).toBe('vert');
    expect(classeTolerance(-0.03, tol)).toBe('orange');
    expect(classeTolerance(0.04, tol)).toBe('orange');
    expect(classeTolerance(0.0401, tol)).toBe('rouge');
    expect(classeTolerance(null, tol)).toBeNull();
  });

  it('20.00004 mm compte comme 2 cm (arrondi au 1/10 de mm)', () => {
    expect(classeTolerance(0.02000004, tol)).toBe('vert');
  });

  it('résultat global = la plus mauvaise couleur', () => {
    expect(resultatControle({ plan: 0.01, hauteur: 0.03 }, TOLERANCES_PAR_DEFAUT)).toEqual({ plan: 'vert', hauteur: 'orange', global: 'orange' });
    expect(resultatControle({ plan: 0.05, hauteur: 0.0 }, TOLERANCES_PAR_DEFAUT).global).toBe('rouge');
    expect(resultatControle({ plan: 0.01, hauteur: null }, TOLERANCES_PAR_DEFAUT)).toEqual({ plan: 'vert', hauteur: null, global: 'vert' });
  });
});

describe('rappel du contrôle', () => {
  // Dates en heure locale (comme sur la tablette).
  const le = (heure, minute = 0, jour = 26) => new Date(2026, 9, jour, heure, minute).toISOString();
  const reussi = (iso) => ({ type: 'mesure', resultat: { global: 'vert' }, le: iso });

  it('aucun contrôle : il en faut un', () => {
    expect(controleNecessaire([], new Date(2026, 9, 26, 8))).toBe(true);
  });

  it('contrôle réussi à 7 h : rien à 10 h 59, rappel à 11 h', () => {
    const controles = [reussi(le(7))];
    expect(controleNecessaire(controles, new Date(2026, 9, 26, 10, 59))).toBe(false);
    expect(controleNecessaire(controles, new Date(2026, 9, 26, 11, 0))).toBe(true);
  });

  it('contrôle réussi la veille au soir : rappel le matin (nouveau jour)', () => {
    expect(controleNecessaire([reussi(le(22, 0, 25))], new Date(2026, 9, 26, 0, 30))).toBe(true);
  });

  it('un refus ou un contrôle rouge ne compte pas comme réussi', () => {
    const controles = [{ type: 'refus', le: le(8) }, { type: 'mesure', resultat: { global: 'rouge' }, le: le(8, 5) }];
    expect(controleNecessaire(controles, new Date(2026, 9, 26, 8, 10))).toBe(true);
  });

  it('un contrôle orange compte comme réussi', () => {
    expect(controleNecessaire([{ type: 'mesure', resultat: { global: 'orange' }, le: le(8) }], new Date(2026, 9, 26, 9))).toBe(false);
  });
});

describe('tolérances tapées (cm)', () => {
  it('lues en mètres, virgule acceptée', () => {
    expect(lireTolerances({ planVert: '2', planOrange: '4', hauteurVert: '2,5', hauteurOrange: '5' }).tolerances)
      .toEqual({ plan: { vert: 0.02, orange: 0.04 }, hauteur: { vert: 0.025, orange: 0.05 } });
  });

  it('refusées si vides, illisibles ou orange plus petite que vert', () => {
    expect(lireTolerances({ planVert: '', planOrange: '4', hauteurVert: '2', hauteurOrange: '4' }).erreur).toMatch(/en plan illisible/);
    expect(lireTolerances({ planVert: '2', planOrange: '4', hauteurVert: 'abc', hauteurOrange: '4' }).erreur).toMatch(/en hauteur illisible/);
    expect(lireTolerances({ planVert: '4', planOrange: '2', hauteurVert: '2', hauteurOrange: '4' }).erreur).toMatch(/plus grande/);
  });
});

describe('CSV des contrôles', () => {
  it('un contrôle et un refus', () => {
    const controles = [
      {
        type: 'mesure', nom: 'PF1', le: new Date(2026, 9, 26, 8, 15).toISOString(), appareil: 'Tablette 1', remarque: 'ok; vu',
        connu, mesure: { est: 2500000.01, nord: 1100000, altitude: 450.03 },
        ecarts: { est: 0.01, nord: 0, plan: 0.01, hauteur: 0.03 }, resultat: { plan: 'vert', hauteur: 'orange', global: 'orange' },
        gnss: { precisionH: 0.008, precisionV: 0.012, nbSatellites: 24 },
      },
      { type: 'refus', le: new Date(2026, 9, 26, 12, 0).toISOString(), appareil: 'Tablette 1' },
    ];
    const lignes = csvControles(controles).trim().split('\r\n');
    expect(lignes).toHaveLength(3);
    expect(lignes[1]).toBe('26.10.2026 08:15;Contrôle;PF1;2500000.000;1100000.000;450.000;2500000.010;1100000.000;450.030;0.010;0.000;0.010;0.030;vert;orange;orange;0.008;0.012;24;Tablette 1;"ok; vu"');
    expect(lignes[2]).toBe('26.10.2026 12:00;Refus;;;;;;;;;;;;;;refusé;;;;Tablette 1;');
  });
});

describe('liste des points de contrôle', () => {
  it('ajoute sans nom en double, ni point sans nom', () => {
    const liste = [{ id: 'a', nom: 'PF1', est: 1, nord: 2, altitude: 3 }];
    let n = 0;
    const r = ajouterPointsControle(liste, [
      { nom: 'PF1', est: 9, nord: 9, altitude: 9 },
      { nom: ' PF2 ', est: 4, nord: 5 },
      { nom: '', est: 0, nord: 0 },
    ], () => `id${++n}`);
    expect(r).toEqual({ ajoutes: 1, deja: ['PF1'], sansNom: 1 });
    expect(liste).toEqual([{ id: 'a', nom: 'PF1', est: 1, nord: 2, altitude: 3 }, { id: 'id1', nom: 'PF2', est: 4, nord: 5, altitude: null }]);
  });
});
