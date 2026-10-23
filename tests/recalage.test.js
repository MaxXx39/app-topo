import { describe, it, expect } from 'vitest';
import { calculerHelmert, appliquerHelmert, rotationLisible, recalerContenu } from '../src/topo/recalage.js';
import { genererDxfPlan, aciLePlusProche, octetsDxf } from '../src/export/dxf-recale.js';
import { lirePlanDxf, texteDuDxf } from '../src/topo/dxf-plan.js';

// Transformation connue : déplacement (2 600 000, 1 200 000), rotation 12.5°, échelle 1.0003.
const ROTATION = (12.5 * Math.PI) / 180;
const ECHELLE = 1.0003;
const CONNUE = { a: ECHELLE * Math.cos(ROTATION), b: ECHELLE * Math.sin(ROTATION), tEst: 2600000, tNord: 1200000 };
const calage = (x, y, bruit = [0, 0]) => {
  const { est, nord } = appliquerHelmert(CONNUE, x, y);
  return { x, y, est: est + bruit[0], nord: nord + bruit[1] };
};

describe('Recalage d\'un plan DXF (Helmert à 4 paramètres)', () => {
  it('2 points : solution exacte, aucun écart', () => {
    const resultat = calculerHelmert([calage(0, 0), calage(100, 50)]);
    expect(resultat.tEst).toBeCloseTo(2600000, 6);
    expect(resultat.tNord).toBeCloseTo(1200000, 6);
    expect(resultat.echelle).toBeCloseTo(ECHELLE, 9);
    expect(resultat.rotation).toBeCloseTo(ROTATION, 9);
    expect(resultat.ecartType).toBeNull();
    for (const ecart of resultat.ecarts) expect(ecart.distance).toBeLessThan(1e-6);
  });

  it('retrouve le déplacement, la rotation et l\'échelle d\'un cas fabriqué (4 points)', () => {
    const resultat = calculerHelmert([calage(0, 0), calage(120, 10), calage(110, 90), calage(-5, 80)]);
    expect(resultat.tEst).toBeCloseTo(2600000, 5);
    expect(resultat.tNord).toBeCloseTo(1200000, 5);
    expect(resultat.echelle).toBeCloseTo(1.0003, 9);
    expect(rotationLisible(resultat.rotation).degres).toBeCloseTo(12.5, 7);
    expect(rotationLisible(resultat.rotation).gon).toBeCloseTo(12.5 / 0.9, 6);
    expect(resultat.ecartType).toBeLessThan(1e-6);
  });

  it('3 points ou plus : moindres carrés, écart de chaque point, point désactivable', () => {
    // Le 4e point est faux de 25 cm en Est.
    const paires = [calage(0, 0, [0.004, -0.003]), calage(120, 10, [-0.002, 0.005]), calage(110, 90, [0.003, 0.001]), calage(-5, 80, [0.25, 0])];
    const avec = calculerHelmert(paires);
    expect(avec.ecarts).toHaveLength(4);
    expect(avec.ecarts[3].distance).toBeGreaterThan(0.1); // le point faux ressort
    expect(avec.ecartType).toBeGreaterThan(0.05);
    // On le désactive : les 3 autres s'accordent à quelques mm, et son écart reste affiché.
    paires[3].actif = false;
    const sans = calculerHelmert(paires);
    expect(sans.ecartType).toBeLessThan(0.01);
    for (const ecart of sans.ecarts.slice(0, 3)) expect(ecart.distance).toBeLessThan(0.01);
    expect(sans.ecarts[3].distance).toBeCloseTo(0.25, 2);
  });

  it('refuse moins de 2 points, ou des points confondus', () => {
    expect(calculerHelmert([calage(0, 0)]).erreur).toMatch(/au moins 2/);
    expect(calculerHelmert([calage(5, 5), { ...calage(5, 5), est: 2600010 }]).erreur).toMatch(/confondus/);
  });

  it('recale tous les objets du plan (altitudes inchangées, cercles et textes à l\'échelle)', () => {
    const plan = {
      origine: { est: 0, nord: 0 },
      contenu: {
        traits: [{ c: 0, p: [0, 0, 100, 0], z: [420, 421] }],
        pleins: [],
        cercles: [{ c: 0, x: 10, y: 10, r: 1 }],
        textes: [{ c: 0, x: 0, y: 0, h: 0.5, a: 0, t: 'A' }],
        points: [{ c: 0, x: 100, y: 0, z: 425 }],
      },
    };
    const { origine, bornes, contenu } = recalerContenu(plan, { ...CONNUE, echelle: ECHELLE, rotation: ROTATION });
    const absolu = (x, y) => ({ est: origine.est + x, nord: origine.nord + y });
    const fin = appliquerHelmert(CONNUE, 100, 0);
    expect(absolu(contenu.traits[0].p[2], contenu.traits[0].p[3]).est).toBeCloseTo(fin.est, 3);
    expect(absolu(contenu.traits[0].p[2], contenu.traits[0].p[3]).nord).toBeCloseTo(fin.nord, 3);
    expect(contenu.traits[0].z).toEqual([420, 421]);
    expect(contenu.points[0].z).toBe(425);
    expect(contenu.cercles[0].r).toBeCloseTo(1.0003, 3);
    expect(contenu.textes[0].a).toBeCloseTo(12.5, 2);
    expect(bornes.estMin).toBeGreaterThan(2599990);
    expect(origine.est).toBe(Math.floor(bornes.estMin));
  });
});


describe('Export du DXF recalé', () => {
  it('relu par l\'appli, il redonne les mêmes objets (coordonnées, altitudes, calques, textes)', () => {
    const plan = {
      origine: { est: 2507300, nord: 1140550 },
      calques: [{ nom: 'Bordure', couleur: '#ff0000', visible: true }, { nom: 'Textes', couleur: '#000000', visible: true }],
      contenu: {
        traits: [{ c: 0, k: null, p: [0, 0, 10.5, 0, 10.5, 7.25], f: false, z: [427.1, 427.2, 427.3] }, { c: 0, k: '#0000ff', p: [1, 1, 2, 1, 2, 2], f: true }],
        pleins: [{ c: 0, k: null, p: [0, 0, 1, 0, 1, 1, 0, 1] }],
        cercles: [{ c: 0, k: null, x: 5, y: 5, r: 0.6 }],
        textes: [{ c: 1, k: null, x: 3, y: 4, h: 0.5, a: 30, t: 'Chambre Ø 80', ah: 1, av: 2 }],
        points: [{ c: 0, k: null, x: 9, y: 9, z: 426.5 }],
      },
    };
    const relu = lirePlanDxf(texteDuDxf(octetsDxf(genererDxfPlan(plan))), 'recale.dxf').plan;
    expect(relu.calques.map((c) => c.nom)).toEqual(['BORDURE', 'TEXTES']);
    expect(relu.contenu.traits).toHaveLength(2);
    const absolu = (o, x, y) => [o.est + x, o.nord + y];
    const t = relu.contenu.traits.find((tr) => tr.z);
    expect(absolu(relu.origine, t.p[4], t.p[5])).toEqual([2507310.5, 1140557.25]);
    expect(t.z).toEqual([427.1, 427.2, 427.3]);
    expect(relu.contenu.traits.find((tr) => !tr.z).f).toBe(true);
    expect(relu.contenu.textes[0]).toMatchObject({ t: 'Chambre Ø 80', h: 0.5, a: 30, ah: 1, av: 2 });
    expect(relu.contenu.cercles[0].r).toBe(0.6);
    expect(relu.contenu.pleins).toHaveLength(1);
    expect(relu.contenu.points[0].z).toBe(426.5);
  });

  it('couleur AutoCAD la plus proche', () => {
    expect(aciLePlusProche('#ff0000')).toBe(1);
    expect(aciLePlusProche('#000000')).toBe(7);
    expect(aciLePlusProche('#0000fe')).toBe(5);
  });
});
