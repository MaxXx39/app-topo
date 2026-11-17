import { describe, it, expect } from 'vitest';
import * as W from 'web-ifc';
import {
  rangerMaquette, coupeHorizontale, coupeVerticale, coupeVerticaleLeLong, couperPolygoneEnX, couperLigneEnX,
  altitudeDeCoupe, calqueDuTypeIfc, bornesMaquette, altitudesObjetEn, recalerMaquette, trianglesSous, trianglesMaquette,
} from '../src/topo/ifc.js';
import { lireIfcAvecApi, texteIfc } from '../src/import/ifc.js';

// Boîte (pavé) de e0..e1 × n0..n1 × z0..z1 en triangles (12 triangles, 8 sommets répétés par face).
function boite(e0, n0, z0, e1, n1, z1, type = 'IfcWall') {
  const c = [[e0, n0, z0], [e1, n0, z0], [e1, n1, z0], [e0, n1, z0], [e0, n0, z1], [e1, n0, z1], [e1, n1, z1], [e0, n1, z1]];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const sommets = [];
  const triangles = [];
  for (const f of faces) {
    const d = sommets.length / 3;
    for (const k of f) sommets.push(...c[k]);
    triangles.push(d, d + 1, d + 2, d, d + 2, d + 3);
  }
  return { type, nom: 'boîte', sommets, triangles };
}

const E = 2500000;
const N = 1100000;

describe('maquette IFC', () => {
  it('fusionne les sommets au même endroit et range les types en calques', () => {
    const m = rangerMaquette([boite(E, N, 400, E + 10, N + 1, 403), boite(E, N, 403, E + 10, N + 10, 403.3, 'IfcSlab')], [{ nom: 'N1', altitude: 403.3 }, { nom: 'N0', altitude: 400 }]);
    expect(m.origine).toEqual({ est: E, nord: N });
    expect(m.types).toEqual(['Murs', 'Dalles']);
    expect(m.objets[0].v.length).toBe(8 * 3); // 24 sommets donnés, 8 différents
    expect(m.objets[0].i.length).toBe(12 * 3);
    expect(m.niveaux.map((n) => n.nom)).toEqual(['N0', 'N1']); // triés par altitude
    expect(bornesMaquette(m)).toEqual({ estMin: E, nordMin: N, estMax: E + 10, nordMax: N + 10 });
  });

  it('coupe horizontale : un mur coupé donne un contour fermé et un aplat', () => {
    const m = rangerMaquette([boite(E + 2, N + 3, 400, E + 12, N + 3.3, 403)]);
    const c = coupeHorizontale(m, 401);
    expect(c.traits).toHaveLength(1);
    expect(c.traits[0].f).toBe(true);
    expect(c.traits[0].p.length).toBe(8); // 4 coins
    const xs = c.traits[0].p.filter((_, k) => k % 2 === 0);
    const ys = c.traits[0].p.filter((_, k) => k % 2 === 1);
    expect(Math.min(...xs)).toBeCloseTo(0, 3); // origine = coin sud-ouest de la maquette
    expect(Math.max(...xs)).toBeCloseTo(10, 3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.3, 3);
    expect(c.pleins[0].h).toEqual([4]);
    // Au-dessus du mur : rien.
    expect(coupeHorizontale(m, 404).traits).toHaveLength(0);
  });

  it('coupe horizontale pile sur le dessus d\'une dalle : pas de contour cassé', () => {
    const m = rangerMaquette([boite(E, N, 400, E + 5, N + 5, 400.3, 'IfcSlab')]);
    const c = coupeHorizontale(m, 400.3);
    expect(c.traits.every((t) => t.f)).toBe(true);
  });

  it('coupe verticale : rectangle du mur, coupé aux bouts de la coupe', () => {
    const m = rangerMaquette([boite(E, N, 400, E + 20, N + 0.3, 403)]);
    // Coupe le long du mur (dans son épaisseur), de E+5 à E+8 : rectangle 3 m × 3 m.
    const c = coupeVerticale(m, { est: E + 5, nord: N + 0.15 }, { est: E + 8, nord: N + 0.15 });
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe('Murs');
    const xs = c[0].points.map((p) => p.x);
    const zs = c[0].points.map((p) => p.z);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(3, 6);
    expect(Math.min(...zs)).toBeCloseTo(400, 3);
    expect(Math.max(...zs)).toBeCloseTo(403, 3);
    // Coupe en travers du mur : rectangle de 0.30 m de large.
    const t = coupeVerticale(m, { est: E + 5, nord: N - 2 }, { est: E + 5, nord: N + 2 });
    const tx = t[0].points.map((p) => p.x);
    expect(Math.max(...tx) - Math.min(...tx)).toBeCloseTo(0.3, 3);
    expect(Math.min(...tx)).toBeCloseTo(2, 3);
    // Coupe loin du mur : rien.
    expect(coupeVerticale(m, { est: E + 5, nord: N + 50 }, { est: E + 6, nord: N + 50 })).toHaveLength(0);
  });

  it('coupe le long d\'une ligne de 2 segments : distances cumulées', () => {
    const m = rangerMaquette([boite(E + 9, N - 1, 400, E + 11, N + 1, 401)]);
    const c = coupeVerticaleLeLong(m, [{ est: E, nord: N }, { est: E + 5, nord: N }, { est: E + 15, nord: N }]);
    const xs = c.flatMap((k) => k.points.map((p) => p.x));
    expect(Math.min(...xs)).toBeCloseTo(9, 3);
    expect(Math.max(...xs)).toBeCloseTo(11, 3);
  });

  it('garde un polygone et une ligne entre deux distances', () => {
    const carre = [{ x: -1, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 1 }, { x: -1, z: 1 }];
    const garde = couperPolygoneEnX(carre, 0, 2);
    expect(Math.min(...garde.map((p) => p.x))).toBe(0);
    expect(Math.max(...garde.map((p) => p.x))).toBe(2);
    expect(couperPolygoneEnX(carre, 5, 6)).toHaveLength(0);
    const ligne = [{ x: -1, z: 0 }, { x: 1, z: 2 }, { x: 3, z: 0 }, { x: 4, z: 0 }];
    const morceaux = couperLigneEnX(ligne, 0, 2);
    expect(morceaux).toHaveLength(1);
    expect(morceaux[0][0]).toEqual({ x: 0, z: 1 });
    expect(morceaux[0].at(-1)).toEqual({ x: 2, z: 1 });
    // Ligne qui sort puis revient : 2 morceaux.
    expect(couperLigneEnX([{ x: 0.5, z: 0 }, { x: 5, z: 0 }, { x: 1, z: 1 }], 0, 2)).toHaveLength(2);
  });

  it('altitude de coupe : niveau + 1.00 m, altitude tapée, récepteur', () => {
    const m = rangerMaquette([boite(E, N, 400, E + 1, N + 1, 410)], [{ nom: 'N0', altitude: 420.5 }, { nom: 'N1', altitude: 424.52 }]);
    expect(altitudeDeCoupe(m, { sorte: 'niveau', niveau: 'N1' }).altitude).toBeCloseTo(425.52, 6);
    expect(altitudeDeCoupe(m, null).altitude).toBeCloseTo(421.5, 6); // premier niveau
    expect(altitudeDeCoupe(m, { sorte: 'altitude', altitude: 418.2 }).altitude).toBe(418.2);
    expect(altitudeDeCoupe(m, { sorte: 'recepteur' }, 419.123).altitude).toBe(419.123);
    expect(altitudeDeCoupe(m, { sorte: 'recepteur' }, null).altitude).toBeNull();
  });

  it('nomme les calques et remet les accents des textes IFC', () => {
    expect(calqueDuTypeIfc('IfcWallStandardCase')).toBe('Murs');
    expect(calqueDuTypeIfc('IFCCOLUMN')).toBe('Poteaux');
    expect(calqueDuTypeIfc('IfcFurniture')).toBe('Autres');
    expect(texteIfc('Niveau R\\X\\E9f\\X\\E9rence')).toBe('Niveau Référence');
    expect(texteIfc('\\X2\\00E9\\X0\\t\\X2\\00E9\\X0\\')).toBe('été');
  });
});

// Petit IFC écrit à la main : un mur de 10 m × 0.30 m × 3 m (extrudé), en centimètres, posé en MN95
// à l'altitude 420.00, un étage « N0 » à +0.50 m.
const PETIT_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('essai.ifc','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSIUNIT(*,.LENGTHUNIT.,.CENTI.,.METRE.);
#2=IFCUNITASSIGNMENT((#1));
#3=IFCCARTESIANPOINT((0.,0.,0.));
#4=IFCAXIS2PLACEMENT3D(#3,$,$);
#5=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.01,#4,$);
#6=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Essai',$,$,$,$,(#5),#2);
#10=IFCCARTESIANPOINT((250000000.,110000000.,42000.));
#11=IFCAXIS2PLACEMENT3D(#10,$,$);
#12=IFCLOCALPLACEMENT($,#11);
#13=IFCSITE('1YvctVUKr0kugbFTf53O9L',$,'Site',$,$,#12,$,$,.ELEMENT.,$,$,$,$,$);
#14=IFCCARTESIANPOINT((0.,0.,50.));
#15=IFCAXIS2PLACEMENT3D(#14,$,$);
#16=IFCLOCALPLACEMENT(#12,#15);
#17=IFCBUILDINGSTOREY('2YvctVUKr0kugbFTf53O9L',$,'N0',$,$,#16,$,$,.ELEMENT.,50.);
#20=IFCLOCALPLACEMENT(#16,#4);
#21=IFCCARTESIANPOINT((0.,0.));
#22=IFCAXIS2PLACEMENT2D(#21,$);
#23=IFCRECTANGLEPROFILEDEF(.AREA.,$,#22,1000.,30.);
#24=IFCDIRECTION((0.,0.,1.));
#25=IFCCARTESIANPOINT((500.,15.,0.));
#26=IFCAXIS2PLACEMENT3D(#25,$,$);
#27=IFCEXTRUDEDAREASOLID(#23,#26,#24,300.);
#28=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#27));
#29=IFCPRODUCTDEFINITIONSHAPE($,$,(#28));
#30=IFCWALL('3YvctVUKr0kugbFTf53O9L',$,'Mur b\\X\\E9ton',$,$,#20,#29,$,$);
ENDSEC;
END-ISO-10303-21;
`;

describe('coin d\'IFC à implanter et recalage (0.263.0)', () => {
  it('dessus et dessous de l\'objet touché sur la coupe, pile à cet endroit', () => {
    // Mur 420.00 → 423.00 et dalle posée dessus 423.00 → 423.25 (plus large).
    const m = rangerMaquette([boite(E, N, 420, E + 10, N + 0.3, 423), boite(E - 1, N - 1, 423, E + 11, N + 5, 423.25, 'IfcSlab')]);
    // Coin du mur, touché sur la coupe à 421.00 : c'est le mur (la dalle n'est pas coupée à cette altitude).
    expect(altitudesObjetEn(m, E, N, 421)).toEqual({ nom: 'boîte', type: 'Murs', dessus: 423, dessous: 420 });
    // Au milieu du mur (sur son bord) aussi.
    expect(altitudesObjetEn(m, E + 5, N + 0.3, 421)).toMatchObject({ dessus: 423, dessous: 420 });
    // Coupe à 423.10 : seule la dalle est coupée ; son coin.
    expect(altitudesObjetEn(m, E - 1, N - 1, 423.1)).toMatchObject({ type: 'Dalles', dessus: 423.25, dessous: 423 });
    // Loin de tout contour coupé (plus de 2 cm) : rien.
    expect(altitudesObjetEn(m, E + 5, N + 0.15, 421)).toBeNull();
    expect(altitudesObjetEn(m, E + 20, N, 421)).toBeNull();
  });

  it('dessus d\'une dalle en pente : altitude pile au coin touché', () => {
    // Dalle dont le dessus monte de 1 % vers l'est : triangles faits à la main.
    const z = (e) => 421 + 0.01 * (e - E);
    const sommets = [E, N, 420.8, E + 10, N, 420.8, E + 10, N + 4, 420.8, E, N + 4, 420.8, E, N, z(E), E + 10, N, z(E + 10), E + 10, N + 4, z(E + 10), E, N + 4, z(E)];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const m = rangerMaquette([{ type: 'IfcSlab', nom: 'Dalle', sommets, triangles: faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]) }]);
    expect(altitudesObjetEn(m, E + 10, N, 420.9)).toMatchObject({ dessus: 421.1, dessous: 420.8 });
  });

  it('maquette recalée : sommets déplacés en plan, altitudes et objets gardés', () => {
    const m = rangerMaquette([boite(0, 0, 400, 10, 0.3, 403)]);
    const r = recalerMaquette(m, (est, nord) => ({ est: est + 2500000, nord: nord + 1100000 }));
    expect(bornesMaquette(r)).toEqual({ estMin: 2500000, nordMin: 1100000, estMax: 2500010, nordMax: 1100000.3 });
    expect(r.objets).toHaveLength(1);
    expect(coupeHorizontale(r, 401).traits).toHaveLength(1);
    expect(m.origine).toEqual({ est: 0, nord: 0 }); // la maquette lue ne bouge pas
  });
});

describe('lecture d\'un IFC avec web-ifc', () => {
  it('lit le mur en MN95, en mètres, et l\'étage', async () => {
    const api = new W.IfcAPI();
    await api.Init();
    const { maquette, compte } = lireIfcAvecApi(api, W, new TextEncoder().encode(PETIT_IFC));
    expect(compte.objets).toBe(1);
    expect(maquette.types).toEqual(['Murs']);
    expect(maquette.objets[0].n).toBe('Mur béton');
    expect(maquette.niveaux).toEqual([{ nom: 'N0', altitude: 420.5 }]);
    const b = bornesMaquette(maquette);
    expect(b.estMin).toBeCloseTo(2500000, 3);
    expect(b.estMax).toBeCloseTo(2500010, 3);
    expect(b.nordMax - b.nordMin).toBeCloseTo(0.3, 3);
    expect(b.nordMin).toBeCloseTo(1100000, 3);
    const c = coupeHorizontale(maquette, 421.5);
    expect(c.traits).toHaveLength(1);
    expect(c.traits[0].f).toBe(true);
  });
});

describe('maquette dans la vue 3D (0.264.0)', () => {
  it('coupe un triangle sous une altitude : 0, 1 ou 2 triangles', () => {
    const p = (est, nord, altitude) => ({ est, nord, altitude });
    const t = [p(0, 0, 0), p(1, 0, 0), p(0, 0, 2)];
    expect(trianglesSous(t, 3)).toEqual([t]);
    expect(trianglesSous(t, -1)).toEqual([]);
    const garde = trianglesSous(t, 1); // 2 sommets dessous : un quadrilatère = 2 triangles
    expect(garde).toHaveLength(2);
    expect(Math.max(...garde.flat().map((q) => q.altitude))).toBe(1);
    expect(trianglesSous([p(0, 0, 0), p(1, 0, 2), p(0, 1, 2)], 1)).toHaveLength(1);
  });

  it('triangles de la maquette : couleur du type, calques cachés, coupe au-dessus', () => {
    const m = rangerMaquette([boite(E, N, 420, E + 10, N + 0.3, 423), boite(E, N, 423, E + 10, N + 5, 423.25, 'IfcSlab')]);
    const tout = trianglesMaquette(m);
    expect(tout).toHaveLength(24);
    expect(tout[0].couleur).toEqual([220, 38, 38]); // murs rouges (#dc2626)
    expect(trianglesMaquette(m, { cachees: new Set(['Dalles']) })).toHaveLength(12);
    const coupe = trianglesMaquette(m, { haut: 421 });
    expect(Math.max(...coupe.flatMap((x) => x.t.map((q) => q.altitude)))).toBeCloseTo(421, 6);
    expect(coupe.every((x) => x.couleur[0] === 220)).toBe(true); // la dalle (au-dessus) a disparu
  });
});
