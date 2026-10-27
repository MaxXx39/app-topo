// Tests de l'export d'une liste de points : TXT, CSV avec toutes les infos, DXF.
import { describe, it, expect } from 'vitest';
import { txtPoints, csvPoints, dxfPoints } from '../src/export/points.js';
import { lirePoints } from '../src/topo/import-points.js';

const points = [
  {
    nom: 'C-Stock-1-1',
    est: 2500000.1234,
    nord: 1150000.5,
    altitude: 400.25,
    gnss: { qualite: 4, nbSatellites: 21, hdop: 0.62, ageCorrections: 1.2, inclinaison: 3.4, precisionH: 0.012, precisionV: 0.018, prisLe: '2026-10-27T08:15:30.000Z' },
  },
  { nom: 'P;1', est: 2500010, nord: 1150010, altitude: null },
];

describe('export d\'une liste de points', () => {
  it('TXT : nom, Est, Nord, altitude séparés par des tabulations ; il se relit', () => {
    const texte = txtPoints(points);
    expect(texte.split('\r\n')[0]).toBe('C-Stock-1-1\t2500000.123\t1150000.500\t400.250');
    expect(texte.split('\r\n')[1]).toBe('P;1\t2500010.000\t1150010.000\t');
    const relu = lirePoints(txtPoints([points[0]]));
    expect(relu.points[0]).toMatchObject({ nom: 'C-Stock-1-1', est: 2500000.123, nord: 1150000.5, altitude: 400.25 });
  });

  it('CSV : en-tête, rôle, date, heure, précisions, qualité RTK, satellites…', () => {
    const lignes = csvPoints(points, new Map([['C-Stock-1-1', 'contour']])).trim().split('\r\n');
    expect(lignes[0]).toBe('Nom;Est (m);Nord (m);Altitude (m);Rôle;Date;Heure;Précision H (m);Précision V (m);Qualité;Satellites;HDOP;Âge corrections (s);Inclinaison (°)');
    const champs = lignes[1].split(';');
    expect(champs.slice(0, 5)).toEqual(['C-Stock-1-1', '2500000.123', '1150000.500', '400.250', 'contour']);
    expect(champs.slice(7)).toEqual(['0.012', '0.018', 'RTK fixe', '21', '0.6', '1.2', '3.4']);
    // Un nom avec un point-virgule est mis entre guillemets.
    expect(lignes[2].startsWith('"P;1";2500010.000;1150010.000;;')).toBe(true);
  });

  it('DXF : les points et leurs noms', () => {
    const texte = dxfPoints(points);
    expect(texte).toContain('POINTS');
    expect(texte).toContain('C-Stock-1-1');
    expect(texte.trim().endsWith('EOF')).toBe(true);
  });
});
