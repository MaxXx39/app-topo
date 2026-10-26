// Tests des mesures (onglet 3. Mesures) : longueurs et aires, 2D et 3D.
import { describe, it, expect } from 'vitest';
import {
  creerMesure,
  nomDeMesureLibre,
  longueur2D,
  longueur3D,
  pente,
  morceauxDeLigne,
  aireTriangle3D,
  calculerLongueur,
  calculerAire,
  calculerMesure,
} from '../src/topo/mesure.js';
import { lignesEtiquette, texteMorceau, formaterPente, valeursCochees } from '../src/mesures/valeurs.js';
import { lireListeDeNoms } from '../src/topo/noms.js';
import { pt, pointsDeReference, STOCKS_REFERENCE, volumeDeReference } from './outils.js';

describe('longueurs et pente', () => {
  const a = pt('a', 0, 0, 10);
  const b = pt('b', 3, 4, 22);

  it('longueur à plat et longueur inclinée (m)', () => {
    expect(longueur2D(a, b)).toBeCloseTo(5, 12);
    expect(longueur3D(a, b)).toBeCloseTo(13, 12); // 3, 4, 12 -> 13
  });

  it('pente = dénivelé ÷ longueur à plat × 100, null si la longueur à plat est nulle', () => {
    expect(pente(1, 50)).toBeCloseTo(2, 12);
    expect(pente(-2.5, 10)).toBeCloseTo(-25, 12);
    expect(pente(1, 0)).toBeNull();
  });

  it('morceaux d\'une ligne ouverte, puis fermée', () => {
    const c = pt('c', 3, 0, 10);
    expect(morceauxDeLigne([a, b, c])).toHaveLength(2);
    const fermee = morceauxDeLigne([a, b, c], true);
    expect(fermee).toHaveLength(3);
    expect(fermee[2].debut).toBe(c);
    expect(fermee[2].fin).toBe(a);
    expect(fermee[0].denivele).toBeCloseTo(12, 12);
  });
});

describe('calculerLongueur', () => {
  const points = [pt('p1', 0, 0, 100), pt('p2', 30, 40, 101), pt('p3', 30, 80, 99), pt('p4', 30, 80, 105)];
  const longueur = (noms) => ({ ...creerMesure('longueur', 'L1', 'leve'), points: noms });

  it('additionne les morceaux ; dénivelé et pente du premier au dernier point', () => {
    const r = calculerLongueur(longueur(['p1', 'p2', 'p3']), points);
    expect(r.morceaux).toHaveLength(2);
    expect(r.l2d).toBeCloseTo(50 + 40, 9);
    expect(r.l3d).toBeCloseTo(Math.hypot(50, 1) + Math.hypot(40, 2), 9);
    expect(r.denivele).toBeCloseTo(-1, 9);
    expect(r.pente).toBeCloseTo((-1 / 90) * 100, 9);
    expect(r.morceaux[0].pente).toBeCloseTo(2, 9);
    expect(r.morceaux[1].pente).toBeCloseTo(-5, 9);
  });

  it('un morceau vertical : longueur 3D seulement, pas de pente', () => {
    const r = calculerLongueur(longueur(['p3', 'p4']), points);
    expect(r.l2d).toBe(0);
    expect(r.l3d).toBeCloseTo(6, 9);
    expect(r.pente).toBeNull();
  });

  it('signale les erreurs', () => {
    expect(calculerLongueur(longueur(['p1']), points).erreurs[0]).toMatch(/au moins 2 points/);
    expect(calculerLongueur(longueur(['p1', 'x9']), points).erreurs[0]).toMatch(/x9/);
  });
});

describe('aireTriangle3D', () => {
  it('à plat, comme l\'aire en plan ; incliné, plus grande', () => {
    expect(aireTriangle3D([pt('a', 0, 0, 5), pt('b', 4, 0, 5), pt('c', 0, 3, 5)])).toBeCloseTo(6, 12);
    // Plan incliné à 45° dans la direction Est : l'aire est multipliée par √2.
    expect(aireTriangle3D([pt('a', 0, 0, 0), pt('b', 4, 0, 4), pt('c', 0, 3, 0)])).toBeCloseTo(6 * Math.SQRT2, 12);
  });
});

describe('calculerAire', () => {
  const aire = (champs) => ({ ...creerMesure('aire', 'A1', 'leve'), ...champs });

  it('carré de 10 m incliné : aire 2D 100 m², aire 3D 100 × √(1 + pente²)', () => {
    // Le terrain monte de 2 m sur 10 m vers le Nord (pente de 20 %).
    const points = [pt('a', 0, 0, 0), pt('b', 10, 0, 0), pt('c', 10, 10, 2), pt('d', 0, 10, 2)];
    const r = calculerAire(aire({ contour: ['a', 'b', 'c', 'd'] }), points);
    expect(r.a2d).toBeCloseTo(100, 9);
    expect(r.a3d).toBeCloseTo(100 * Math.hypot(1, 0.2), 9);
    expect(r.p2d).toBeCloseTo(40, 9);
    expect(r.p3d).toBeCloseTo(20 + 2 * Math.hypot(10, 2), 9);
    expect(r.morceaux).toHaveLength(4);
  });

  it('compte une bosse au milieu seulement si son point est choisi (points isolés)', () => {
    const points = [pt('a', 0, 0, 0), pt('b', 10, 0, 0), pt('c', 10, 10, 0), pt('d', 0, 10, 0), pt('h', 5, 5, 3), pt('loin', 50, 50, 9)];
    const sans = calculerAire(aire({ contour: ['a', 'b', 'c', 'd'] }), points);
    expect(sans.a3d).toBeCloseTo(100, 9);
    const avec = calculerAire(aire({ contour: ['a', 'b', 'c', 'd'], points: ['h'] }), points);
    expect(avec.a2d).toBeCloseTo(100, 9);
    // 4 triangles de base 10 m et de hauteur √(5² + 3²) : 4 × 10 × √34 / 2
    expect(avec.a3d).toBeCloseTo(20 * Math.sqrt(34), 9);
    // « Tous les points du levé » : seuls ceux dans le contour comptent.
    const tous = calculerAire(aire({ contour: ['a', 'b', 'c', 'd'], tousLesPoints: true }), points);
    expect(tous.a3d).toBeCloseTo(20 * Math.sqrt(34), 9);
  });

  it('respecte une forme en « L » (concave)', () => {
    const points = [pt('a', 0, 0, 0), pt('b', 20, 0, 0), pt('c', 20, 10, 0), pt('d', 10, 10, 0), pt('e', 10, 20, 0), pt('f', 0, 20, 0)];
    const r = calculerAire(aire({ contour: ['a', 'b', 'c', 'd', 'e', 'f'] }), points);
    expect(r.a2d).toBeCloseTo(300, 9);
    expect(r.a3d).toBeCloseTo(300, 9);
  });

  it('signale les erreurs (contour trop court, segments qui se croisent)', () => {
    const points = [pt('a', 0, 0, 0), pt('b', 10, 0, 0), pt('c', 10, 10, 0), pt('d', 0, 10, 0)];
    expect(calculerAire(aire({ contour: ['a', 'b'] }), points).erreurs[0]).toMatch(/au moins 3 points/);
    const croise = calculerAire(aire({ contour: ['a', 'c', 'b', 'd'] }), points);
    expect(croise.erreurs[0]).toMatch(/se croisent/);
  });

  it('levé du 20/05/2026 : l\'aire 2D du contour du stock 1 est la surface en plan du volume', () => {
    const points = pointsDeReference();
    const noms = points.map((p) => p.nom);
    const stock = STOCKS_REFERENCE[0];
    const r = calculerMesure(
      aire({ contour: lireListeDeNoms(stock.contour, noms).noms, lignesRupture: [{ noms: lireListeDeNoms(stock.ligne, noms).noms, fermee: true }], tousLesPoints: true }),
      points,
    );
    expect(r.a2d).toBeCloseTo(volumeDeReference(stock, points).surfacePlan, 6);
    expect(r.a3d).toBeGreaterThan(r.a2d);
  });
});

describe('noms et étiquettes', () => {
  it('propose L1, L2... et A1, A2... sans doublon', () => {
    const mesures = [{ nom: 'L1' }, { nom: 'L3' }, { nom: 'A1' }];
    expect(nomDeMesureLibre(mesures, 'longueur')).toBe('L2');
    expect(nomDeMesureLibre(mesures, 'aire')).toBe('A2');
  });

  it('étiquette : nom puis valeurs cochées ; texte de chaque morceau', () => {
    const mesure = creerMesure('longueur', 'Bordure', 'leve');
    mesure.afficher = { l2d: true, l3d: false, denivele: true, pente: true, morceaux: true };
    const resultat = { l2d: 12.3456, l3d: 12.4, denivele: -0.25, pente: -2.0255 };
    expect(lignesEtiquette(mesure, resultat)).toEqual(['Bordure', 'L 2D 12.346 m', 'Déniv. -0.250 m', 'Pente -2.03 %']);
    expect(texteMorceau(mesure, { l2d: 5, l3d: 5.1, denivele: 1, pente: 20 })).toBe('5.000 m · +1.000 m · +20.00 %');
    expect(formaterPente(null)).toBe('-');
  });
});

describe('couleur des mesures', async () => {
  const { couleurDeMesure, aciDeMesure, rvbDeCouleur } = await import('../src/mesures/valeurs.js');
  const { genererDxfMesures } = await import('../src/export/dxf.js');

  it('cyan au départ (et pour une ancienne mesure sans couleur), sinon la couleur choisie', () => {
    expect(creerMesure('aire', 'A1', 'leve').couleur).toBe('#0891b2');
    expect(couleurDeMesure({})).toBe('#0891b2');
    expect(couleurDeMesure({ couleur: '#db2777' })).toBe('#db2777');
    expect(aciDeMesure({ couleur: '#db2777' })).toBe(221);
    expect(rvbDeCouleur('#0891b2')).toEqual([8, 145, 178]);
  });

  it('DXF : les lignes et les textes ont la couleur de la mesure', () => {
    const points = [pt('a', 0, 0, 10), pt('b', 30, 40, 11)];
    const mesure = { ...creerMesure('longueur', 'L1', 'leve'), points: ['a', 'b'], couleur: '#dc2626' };
    const texte = genererDxfMesures({ points, mesures: [{ mesure, resultat: calculerMesure(mesure, points) }] });
    expect(texte).toMatch(/POLYLINE\r\n8\r\nMESURES\r\n62\r\n1\r\n/);
    expect(texte).toMatch(/TEXT\r\n8\r\nMESURES\r\n62\r\n1\r\n/);
  });
});

describe('calculerNombre (points comptés)', () => {
  const points = [pt('P-RG-1', 0, 0, 400), pt('P-RG-2', 10, 0, 401), pt('P-RG-3', 0, 10, 402)];

  it('compte les points de la mesure', () => {
    const mesure = { ...creerMesure('nombre', 'RG', 'leve'), points: ['P-RG-1', 'P-RG-2', 'P-RG-3'] };
    const r = calculerMesure(mesure, points);
    expect(r.nombre).toBe(3);
    expect(lignesEtiquette(mesure, r)).toEqual(['RG', 'Nb 3 pce']);
    expect(nomDeMesureLibre([mesure], 'nombre')).toBe('N1');
  });

  it('signale un point absent ou une liste vide', () => {
    expect(calculerMesure({ ...creerMesure('nombre', 'RG', 'leve'), points: ['x'] }, points).erreurs[0]).toContain('x');
    expect(calculerMesure(creerMesure('nombre', 'RG', 'leve'), points).erreurs[0]).toContain('aucun point');
  });
});

it('valeurs cochées : seulement celles choisies, sinon la première', () => {
  const mesure = { type: 'aire', afficher: { a2d: false, p3d: true } };
  expect(valeursCochees(mesure).map((v) => v.cle)).toEqual(['p3d']);
  expect(valeursCochees({ type: 'aire', afficher: {} }).map((v) => v.cle)).toEqual(['a2d']);
});
