import { describe, it, expect } from 'vitest';
import { contourDuExtrait, dansAnneau, grilleDuCercle, pasDeGrille, anneauxDuJson, egridsDuTexte, contoursDeReponse } from '../src/topo/cadastre.js';
import { telechargerRdppf, adressesGetEgrid, raisonDuService } from '../src/import/rdppf.js';

const carre = (e, n, c) => [[e, n], [e + c, n], [e + c, n + c], [e, n + c], [e, n]];

describe('cadastre RDPPF (Vaud)', () => {
  it('point dans un anneau', () => {
    expect(dansAnneau([5, 5], carre(0, 0, 10))).toBe(true);
    expect(dansAnneau([15, 5], carre(0, 0, 10))).toBe(false);
  });
  it('grille du cercle : centre d\'abord, dans le cercle', () => {
    const g = grilleDuCercle({ est: 0, nord: 0 }, 20, 10);
    expect(g[0]).toEqual([0, 0]);
    expect(g.every(([e, n]) => Math.hypot(e, n) <= 20)).toBe(true);
    expect(pasDeGrille(50)).toBe(10);
    expect(pasDeGrille(10)).toBe(8);
  });
  it('lit les anneaux d\'une réponse JSON (GeoJSON ou autre)', () => {
    const json = { GetEGRIDResponse: [{ egrid: 'CH155483804578', limit: { type: 'MultiPolygon', coordinates: [[carre(2538000, 1152000, 20)]] } }] };
    const anneaux = anneauxDuJson(json);
    expect(anneaux).toHaveLength(1);
    expect(anneaux[0][0]).toEqual([2538000, 1152000]);
    expect(egridsDuTexte(JSON.stringify(json))).toEqual(['CH155483804578']);
    expect(contoursDeReponse(JSON.stringify(json))).toHaveLength(1);
  });
  it('lit un contour WKT ou GML écrit dans un JSON', () => {
    expect(contoursDeReponse('{"limit":"MULTIPOLYGON (((2538000 1152000, 2538010 1152000, 2538010 1152010, 2538000 1152000)))"}')).toHaveLength(1);
    expect(contoursDeReponse('{"limit":"<gml:LinearRing><gml:posList>2538000 1152000 2538010 1152000 2538010 1152010</gml:posList></gml:LinearRing>"}')).toHaveLength(1);
  });
  it('lit une réponse XML (GML)', () => {
    const xml = '<GetEGRIDResponse><egrid>CH1</egrid><gml:LinearRing><gml:posList>2538000 1152000 2538010 1152000 2538010 1152010 2538000 1152000</gml:posList></gml:LinearRing></GetEGRIDResponse>';
    expect(contoursDeReponse(xml)).toHaveLength(1);
  });
  it('couvre le cercle sans redemander un point déjà dans une parcelle', async () => {
    const adresses = [];
    const chercher = async (adresse) => {
      adresses.push(adresse);
      if (!adresse.includes('EN=')) return { ok: false, status: 400, text: async () => 'non' };
      const [e, n] = /EN=([\d.]+),([\d.]+)/.exec(adresse).slice(1).map(Number);
      const ce = Math.floor(e / 40) * 40;
      const cn = Math.floor(n / 40) * 40;
      return { ok: true, status: 200, text: async () => JSON.stringify({ GetEGRIDResponse: [{ egrid: `CH${String(ce).slice(-6)}${String(cn).slice(-6)}`, limit: { coordinates: [[carre(ce, cn, 40)]] } }] }) };
    };
    const r = await telechargerRdppf({ est: 2538020, nord: 1152020 }, 30, () => {}, chercher, 'https://x');
    expect(r.lignes.length).toBeGreaterThanOrEqual(4);
    expect(adresses.length).toBeLessThan(grilleDuCercle({ est: 0, nord: 0 }, 30, pasDeGrille(30)).length);
  });
  it('contour de la parcelle dans un extrait (pas celui des restrictions)', () => {
    const extrait = { GetExtractByIdResponse: { extract: { RealEstate: { EGRID: 'CH1', Limit: { coordinates: [[carre(2538000, 1152000, 20)]] }, RestrictionOnLandownership: [{ Geometry: { coordinates: [[carre(2539000, 1153000, 5)]] } }] } } } };
    const anneaux = contourDuExtrait(JSON.stringify(extrait));
    expect(anneaux).toHaveLength(1);
    expect(anneaux[0][0]).toEqual([2538000, 1152000]);
    expect(contourDuExtrait('{"RealEstate":{"Limit":{"surface":{"exterior":{"posList":"2538000 1152000 2538010 1152000 2538010 1152010 2538000 1152000"}}}}}')).toHaveLength(1);
    const xml = '<Extract><RealEstate><Limit><gml:posList>2538000 1152000 2538010 1152000 2538010 1152010</gml:posList></Limit></RealEstate></Extract>';
    expect(contourDuExtrait(xml.replace('<gml:posList>', '<gml:LinearRing><gml:posList>').replace('</gml:posList>', '</gml:posList></gml:LinearRing>'))).toHaveLength(1);
  });
  it('Vaud : GetEGRID sans contour, puis l\'extrait de la parcelle', async () => {
    const adresses = [];
    const chercher = async (adresse) => {
      adresses.push(adresse);
      if (adresse.includes('getegrid')) return { ok: true, status: 200, text: async () => '{"Item":[{"egrid":"CH708045688314","number":"440"}]}' };
      if (adresse.includes('/extract/json/?EGRID=CH708045688314')) return { ok: true, status: 200, text: async () => JSON.stringify({ RealEstate: { Limit: { coordinates: [[carre(2537950, 1151950, 200)]] } } }) };
      return { ok: false, status: 500, text: async () => 'non' };
    };
    const r = await telechargerRdppf({ est: 2538020, nord: 1152020 }, 30, () => {}, chercher, 'https://x');
    expect(r.lignes).toHaveLength(1);
    expect(adresses.filter((a) => a.includes('extract'))).toHaveLength(1);
  });
  it('message clair si le service ne répond jamais', async () => {
    const chercher = async () => ({ ok: false, status: 404, text: async () => 'Not found' });
    await expect(telechargerRdppf({ est: 2538020, nord: 1152020 }, 30, () => {}, chercher, 'https://x')).rejects.toThrow(/RDPPF de Vaud : erreur 404/);
    const xml = '<ErrorResponse xmlns:xsd="x"><Message>Paramètre EN inconnu</Message></ErrorResponse>';
    expect(raisonDuService(xml)).toBe('« Paramètre EN inconnu »');
    let n = 0;
    const erreur500 = async () => { n++; return { ok: false, status: 500, text: async () => xml }; };
    await expect(telechargerRdppf({ est: 2538020, nord: 1152020 }, 30, () => {}, erreur500, 'https://x')).rejects.toThrow(/Paramètre EN inconnu.*getegrid\/json\/\?EN=/);
    expect(n).toBe(3);
    expect(adressesGetEgrid('b', 1, 2)[0]).toBe('b/getegrid/json/?EN=1.000,2.000&GEOMETRY=true');
  });
});
