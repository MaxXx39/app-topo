// Tests de l'implantation d'un point : accroche (sommet, milieu, sur la ligne, centre), guidage, écarts.
import { describe, it, expect } from 'vitest';
import { accrocher, projeterSurSegment, guidage, ecartsImplantation, classeDistance, nomPointAImplanter, sourcesDesPlans, csvImplantations } from '../src/topo/accroche.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });
// Une ligne en L : (0,0) → (10,0) → (10,10), et une chambre de rayon 0.4 en (5, 5).
const SOURCES = {
  lignes: [{ points: [p(0, 0, 400), p(10, 0, 401), p(10, 10)], ferme: false }],
  cercles: [{ est: 5, nord: 5, rayon: 0.4 }],
  points: [{ est: 2, nord: 3, altitude: 402, nom: 'P-RG-1' }],
};

describe('accroche', () => {
  it('sommet : le sommet de ligne ou le point le plus proche, dans la tolérance', () => {
    expect(accrocher('sommet', p(9.8, 0.3), 0.5, SOURCES)).toMatchObject({ est: 10, nord: 0, altitude: 401, mode: 'sommet', nom: null });
    expect(accrocher('sommet', p(2.1, 3.1), 0.5, SOURCES)).toMatchObject({ est: 2, nord: 3, altitude: 402, nom: 'P-RG-1' });
    expect(accrocher('sommet', p(5, 2), 0.5, SOURCES)).toBeNull();
  });

  it('milieu : le milieu du segment touché (altitude au milieu si les deux bouts en ont une)', () => {
    expect(accrocher('milieu', p(2, 0.2), 0.5, SOURCES)).toMatchObject({ est: 5, nord: 0, altitude: 400.5 });
    expect(accrocher('milieu', p(10.2, 7), 0.5, SOURCES)).toMatchObject({ est: 10, nord: 5, altitude: null });
  });

  it('sur la ligne : l\'endroit de la ligne le plus proche du doigt', () => {
    const r = accrocher('ligne', p(3, 0.3), 0.5, SOURCES);
    expect(r.est).toBeCloseTo(3);
    expect(r.nord).toBeCloseTo(0);
    expect(r.altitude).toBeCloseTo(400.3);
    expect(accrocher('ligne', p(3, 1), 0.5, SOURCES)).toBeNull();
  });

  it('centre : le centre du cercle, en touchant dedans ou son bord', () => {
    expect(accrocher('centre', p(5.1, 5.2), 0.3, SOURCES)).toMatchObject({ est: 5, nord: 5, mode: 'centre' });
    expect(accrocher('centre', p(5.6, 5), 0.3, SOURCES)).toMatchObject({ est: 5, nord: 5 });
    expect(accrocher('centre', p(6, 5), 0.3, SOURCES)).toBeNull();
  });

  it('projection sur un segment, bornée à ses extrémités', () => {
    expect(projeterSurSegment(p(5, 2), p(0, 0), p(10, 0))).toEqual({ t: 0.5, d: 2 });
    expect(projeterSurSegment(p(-3, 4), p(0, 0), p(10, 0))).toEqual({ t: 0, d: 5 });
  });
});

describe('guidage et écarts', () => {
  it('Nord / Est, et Avance / Droite selon la direction regardée', () => {
    const position = p(100, 100);
    const cible = p(101, 102); // 2 m au nord, 1 m à l'est
    const sansCap = guidage(position, cible);
    expect(sansCap).toMatchObject({ est: 1, nord: 2, avance: null, droite: null });
    expect(sansCap.distance).toBeCloseTo(Math.sqrt(5));
    const versNord = guidage(position, cible, 0);
    expect(versNord.avance).toBeCloseTo(2);
    expect(versNord.droite).toBeCloseTo(1);
    // En regardant vers l'est : la cible est 1 m devant et 2 m à gauche.
    const versEst = guidage(position, cible, 90);
    expect(versEst.avance).toBeCloseTo(1);
    expect(versEst.droite).toBeCloseTo(-2);
    expect(guidage(position, p(100, 90)).direction).toBeCloseTo(180);
  });

  it('écarts d\'implantation = mesuré − voulu', () => {
    const e = ecartsImplantation(p(10, 20, 412.49), p(10.012, 19.995, 412.47));
    expect(e.dEst).toBeCloseTo(0.012);
    expect(e.dNord).toBeCloseTo(-0.005);
    expect(e.distance).toBeCloseTo(0.013);
    expect(e.dAltitude).toBeCloseTo(-0.02);
    expect(ecartsImplantation(p(10, 20), p(10, 20, 412)).dAltitude).toBeNull();
  });

  it('couleur de la distance qui reste et nom des points à implanter', () => {
    expect(classeDistance(0.015)).toBe('vert-clair');
    expect(classeDistance(0.05)).toBe('jaune-orange');
    expect(classeDistance(0.3)).toBe('loin');
    expect(nomPointAImplanter([])).toBe('I-1');
    expect(nomPointAImplanter([{ nom: 'I-2' }, { nom: 'Chambre' }, { nom: 'I-7' }])).toBe('I-8');
  });
});

describe('plans DXF et export', () => {
  it('prend les objets des calques visibles près du doigt, en MN95', () => {
    const plan = {
      origine: { est: 2500000, nord: 1100000 },
      calques: [{ visible: true }, { visible: false }],
      contenu: {
        traits: [
          { c: 0, p: [0, 0, 10, 0], f: false, z: [400, 401] },
          { c: 0, p: [100, 100, 110, 100], f: false },
          { c: 1, p: [0, 1, 10, 1], f: false },
        ],
        cercles: [{ c: 0, x: 5, y: 2, r: 0.5 }],
        points: [{ c: 0, x: 4, y: 0.5, z: 0 }],
      },
    };
    const sources = sourcesDesPlans([plan], { est: 2500005, nord: 1100000.5 }, 1);
    expect(sources.lignes).toHaveLength(1);
    expect(sources.lignes[0].points[1]).toEqual({ est: 2500010, nord: 1100000, altitude: 401 });
    expect(sources.cercles).toEqual([{ est: 2500005, nord: 1100002, rayon: 0.5 }]);
    expect(sources.points).toEqual([{ est: 2500004, nord: 1100000.5, altitude: null }]);
    expect(accrocher('milieu', { est: 2500004, nord: 1100000.2 }, 1, sources)).toMatchObject({ est: 2500005, nord: 1100000, altitude: 400.5 });
  });

  it('CSV des implantations', () => {
    const texte = csvImplantations([{
      nom: 'I-1',
      cible: { est: 10, nord: 20, altitude: null },
      mesure: { est: 10.012, nord: 19.995, altitude: 412.47 },
      ecarts: ecartsImplantation({ est: 10, nord: 20, altitude: null }, { est: 10.012, nord: 19.995, altitude: 412.47 }),
      le: '2026-10-22T10:00:00.000Z',
    }]);
    expect(texte.split('\r\n')[1]).toBe('I-1;10.000;20.000;;10.012;19.995;412.470;0.012;-0.005;0.013;;2026-10-22T10:00:00.000Z');
  });
});
