// Nettoyage d'un plan calé (0.279.0) : calques, types, hachures, zone (traits coupés, le reste gardé entier), préfixe.
import { describe, it, expect } from 'vitest';
import { recetteDeDepart, nettoyerPlan, couperDansZone, pointDansPolygone, compterParCalque, calqueSousLePoint } from '../src/topo/nettoyage-plan.js';

const plan = {
  nom: 'essai',
  origine: { est: 100, nord: 200 },
  bornes: { estMin: 100, nordMin: 200, estMax: 130, nordMax: 220 },
  calques: [
    { nom: 'MURS', couleur: '#ff0000', visible: true },
    { nom: 'COTES', couleur: '#00ff00', visible: true },
    { nom: 'GELE', couleur: '#0000ff', visible: false },
  ],
  contenu: {
    traits: [
      { c: 0, k: '#123456', p: [0, 5, 20, 5], f: false },          // traverse la zone : coupé
      { c: 0, k: null, p: [2, 2, 4, 2, 4, 4], f: true },           // entièrement dedans
      { c: 0, k: null, p: [0, 0, 1, 1], f: false, s: 'SPLINE' },
      { c: 0, k: null, p: [1, 1, 3, 1, 3, 3], f: true, s: 'HATCH' },
      { c: 2, k: null, p: [0, 0, 1, 0], f: false },
    ],
    pleins: [{ c: 0, k: null, p: [1, 1, 3, 1, 3, 3], h: [3] }, { c: 1, k: null, p: [0, 0, 1, 0, 1, 1, 0, 1], s: 'SOLID' }],
    cercles: [{ c: 0, k: null, x: 11, y: 5, r: 2 }, { c: 0, k: null, x: 25, y: 15, r: 1 }],
    textes: [{ c: 1, k: null, x: 5, y: 5, h: 1, a: 0, t: '12.50' }, { c: 0, k: null, x: 5, y: 6, h: 1, a: 0, t: 'A', s: 'ATTRIB' }],
    points: [],
  },
  compte: { objets: 11, ignores: { DIMENSION: 4 } },
};
// Zone : carré de 0 à 10 (coordonnées absolues du plan).
const zone = [[100, 200], [110, 200], [110, 210], [100, 210]];

describe('géométrie de la zone', () => {
  it('point dedans / dehors', () => {
    expect(pointDansPolygone(5, 5, [[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(pointDansPolygone(15, 5, [[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(false);
  });
  it('trait coupé au bord', () => {
    const m = couperDansZone([[-5, 5], [20, 5]], false, [[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(m).toHaveLength(1);
    expect(m[0][0][0]).toBeCloseTo(0, 9);
    expect(m[0][1][0]).toBeCloseTo(10, 9);
  });
  it('trait qui sort et rentre : deux morceaux', () => {
    const m = couperDansZone([[2, 2], [15, 2], [15, 8], [2, 8]], false, [[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(m).toHaveLength(2);
  });
});

describe('nettoyage', () => {
  it('recette de départ : calques gelés / éteints écartés', () => {
    expect(recetteDeDepart(plan).ecartes).toEqual(['GELE']);
    expect(compterParCalque(plan)).toEqual([8, 2, 1]);
  });
  it('sans zone : calques écartés, hachure en contour seulement, types', () => {
    const r = { ...recetteDeDepart(plan, 'P - '), types: { attributs: true, textes: false, splines: true, pleins: true } };
    const n = nettoyerPlan(plan, r);
    expect(n.calques.map((c) => c.nom)).toEqual(['P - MURS', 'P - COTES']);
    expect(n.contenu.traits).toHaveLength(3); // spline et calque gelé retirés, contour de hachure gardé
    expect(n.contenu.pleins).toHaveLength(0); // hachure (contour seulement) et surface pleine retirées
    expect(n.contenu.textes.map((t) => t.t)).toEqual(['12.50']); // attribut retiré
  });
  it('zone : traits coupés, cercles et textes qui touchent gardés entiers', () => {
    const n = nettoyerPlan(plan, { ...recetteDeDepart(plan), hachures: 'garder', zone });
    const coupe = n.contenu.traits.find((t) => t.k === '#123456');
    expect(coupe.p).toEqual([0, 5, 10, 5]);
    expect(n.contenu.traits.some((t) => t.f && t.p.length === 6 && !t.s)).toBe(true); // dedans : entier
    expect(n.contenu.cercles).toEqual([expect.objectContaining({ x: 11, r: 2 })]); // touche la zone : entier
    expect(n.contenu.pleins).toHaveLength(2);
    expect(n.bornes.estMax).toBe(113);
  });
  it('couleur d\'un calque : tous ses objets la prennent', () => {
    const n = nettoyerPlan(plan, { ...recetteDeDepart(plan), couleurs: { MURS: '#abcdef' } });
    expect(n.calques[0].couleur).toBe('#abcdef');
    expect(n.contenu.traits.every((t) => t.k === null)).toBe(true);
  });
  it('clic sur un objet = son calque', () => {
    expect(calqueSousLePoint(plan, 110, 205.1, 0.5)).toBe(0);
    expect(calqueSousLePoint(plan, 105, 205.2, 0.5)).toBe(1); // le texte est plus proche
    expect(calqueSousLePoint(plan, 128, 200, 0.5)).toBe(-1);
  });
});
