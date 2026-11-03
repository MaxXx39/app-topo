import { describe, it, expect } from 'vitest';
import {
  lireGml, ordreEstNord, garderDansLeCercle, pointsDuCadastre, dxfDuCadastre, lireRayon,
  nomDeLaListe, choisirCouches, nomsDesCouches, rectangleAutour,
} from '../src/topo/cadastre.js';
import { telechargerCadastre } from '../src/import/cadastre.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';

const GML2 = `<wfs:FeatureCollection xmlns:gml="http://www.opengis.net/gml"><gml:featureMember><ms:Grenzpunkt><ms:geom><gml:Point><gml:coordinates>2538000.500,1152000.250</gml:coordinates></gml:Point></ms:geom></ms:Grenzpunkt></gml:featureMember>
<gml:featureMember><ms:Liegenschaft><ms:geom><gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>2538000.5,1152000.25 2538010,1152000.25 2538010,1152010 2538000.5,1152000.25</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:geom></ms:Liegenschaft></gml:featureMember></wfs:FeatureCollection>`;

describe('cadastre', () => {
  it('lit un GML 2 (point et contour)', () => {
    const lu = lireGml(GML2);
    expect(lu.points).toEqual([[2538000.5, 1152000.25]]);
    expect(lu.lignes).toHaveLength(1);
    expect(lu.lignes[0]).toHaveLength(4);
  });
  it('lit un GML 3 en Nord, Est et le remet en Est, Nord', () => {
    const gml = '<gml:LineString><gml:posList srsDimension="2">1152000 2538000 1152010 2538010</gml:posList></gml:LineString>';
    expect(lireGml(gml).lignes[0]).toEqual([[2538000, 1152000], [2538010, 1152010]]);
  });
  it('refuse une erreur du service avec son texte', () => {
    expect(() => lireGml('<ServiceExceptionReport><ServiceException>Couche inconnue</ServiceException></ServiceExceptionReport>')).toThrow(/Couche inconnue/);
  });
  it('ignore les coordonnées hors de Suisse', () => {
    expect(ordreEstNord(10, 20)).toBeNull();
    expect(ordreEstNord(2538000, 1152000)).toEqual([2538000, 1152000]);
  });
  it('garde ce qui est dans le cercle', () => {
    const donnees = { points: [[100000 + 2400000, 1100000], [2400000 + 100, 1100000]], lignes: [[[2400100, 1100000], [2400500, 1100000]], [[2402000, 1100000], [2402100, 1100000]]] };
    const r = garderDansLeCercle(donnees, { est: 2400000, nord: 1100000 }, 150);
    expect(r.points).toEqual([[2400100, 1100000]]);
    expect(r.lignes).toHaveLength(1);
  });
  it('fait la liste de points sans doublon, avec les sommets si pas de points', () => {
    const lignes = [[[2538000, 1152000], [2538010, 1152000], [2538000, 1152000]]];
    const points = pointsDuCadastre({ points: [], lignes });
    expect(points.map((p) => p.nom)).toEqual(['CAD-1', 'CAD-2']);
    expect(points[0]).toMatchObject({ est: 2538000, nord: 1152000, altitude: null });
    expect(pointsDuCadastre({ points: [[2538001, 1152001]], lignes })).toHaveLength(1);
  });
  it('fabrique un DXF que lirePlanDxf relit', () => {
    const { plan, erreur } = lirePlanDxf(dxfDuCadastre([[[2538000, 1152000], [2538010, 1152000], [2538010, 1152010]]]), 'Cadastre 1');
    expect(erreur).toBeUndefined();
    expect(plan.contenu.traits).toHaveLength(1);
    expect(plan.bornes.estMin).toBe(2538000);
  });
  it('rayon et nom de la liste', () => {
    expect(lireRayon('50')).toBe(50);
    expect(lireRayon('12,5')).toBe(12.5);
    expect(lireRayon('2')).toBeNull();
    expect(lireRayon('abc')).toBeNull();
    expect(nomDeLaListe(['Cadastre 1', 'x'])).toBe('Cadastre 2');
    expect(rectangleAutour({ est: 10, nord: 20 }, 5)).toEqual({ estMin: 5, nordMin: 15, estMax: 15, nordMax: 25 });
  });
  it('choisit les couches d\'après leur nom', () => {
    const caps = '<FeatureType><Name>ms:Liegenschaften_Grenzpunkt</Name></FeatureType><FeatureType><Name>ms:Liegenschaften_Liegenschaft</Name></FeatureType><FeatureType><Name>ms:Liegenschaften_ProjLiegenschaft</Name></FeatureType>';
    expect(choisirCouches(nomsDesCouches(caps))).toEqual({ points: 'ms:Liegenschaften_Grenzpunkt', surfaces: 'ms:Liegenschaften_Liegenschaft' });
  });
  it('reconnaît les codes courts MOpublic (geodienste.ch)', () => {
    const noms = ['ms:PLNA', 'ms:LCSF', 'ms:LCSFPROJ', 'ms:SOPT', 'ms:CPPT', 'ms:RESFPROJ', 'ms:RESF', 'ms:BPPT'];
    expect(choisirCouches(noms)).toEqual({ points: 'ms:BPPT', surfaces: 'ms:RESF' });
    expect(choisirCouches(['LCSF', 'RESF'])).toEqual({ points: null, surfaces: 'RESF' });
  });
  it('télécharge avec un faux service', async () => {
    const adresses = [];
    const chercher = async (adresse) => {
      adresses.push(adresse);
      const texte = adresse.includes('GetCapabilities') ? '<FeatureType><Name>ms:Grenzpunkt</Name></FeatureType>' : GML2;
      return { ok: true, status: 200, text: async () => texte };
    };
    const r = await telechargerCadastre({ est: 2538000, nord: 1152000 }, 50, 'VD', () => {}, chercher);
    expect(r.points).toHaveLength(1);
    expect(adresses[1]).toContain('BBOX=2537950.000,1151950.000,2538050.000,1152050.000,EPSG:2056');
  });
  it('dit les couches trouvées quand aucune ne convient', async () => {
    const chercher = async () => ({ ok: true, status: 200, text: async () => '<FeatureType><Name>ms:Autre</Name></FeatureType>' });
    await expect(telechargerCadastre({ est: 2538000, nord: 1152000 }, 50, 'VD', () => {}, chercher)).rejects.toThrow(/ms:Autre/);
  });
});
