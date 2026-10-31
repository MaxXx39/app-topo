import { describe, it, expect } from 'vitest';
import { creerPdf } from '../src/export/pdf.js';

describe('PDF sans volume (0.104.1)', () => {
  it('un levé seul (points) donne un PDF', async () => {
    const points = [{ nom: 'P1', est: 2600100, nord: 1200100, altitude: 500 }, { nom: 'P2', est: 2600150, nord: 1200160, altitude: 501 }];
    const { document, format } = await creerPdf({ stocks: [], resultats: [], points, cartouche: { affaire: 'x', lieu: '', date: '', dessinePar: '', fichierPoints: 'LV-1' } });
    expect(format).toBe('a4');
    expect(document.getNumberOfPages()).toBe(1);
  });
});

import { pdfPoints } from '../src/export/pdf-points.js';
import { csvPoints, infosDuPoint, TITRES_INFOS } from '../src/export/points.js';

describe('PDF d\'une liste de points (0.104.2)', () => {
  const points = Array.from({ length: 60 }, (_, i) => ({ nom: `P-${i + 1}`, est: 2600100 + i, nord: 1200100 + i, altitude: 500 + i / 10, gnss: { prisLe: '2026-10-30T10:00:00Z', precisionH: 0.012, qualite: 4, nbSatellites: 20 } }));
  it('un tableau sur plusieurs feuilles', async () => {
    const blob = pdfPoints({ titre: 'LV-Stock 1', points, cartouche: { affaire: '10203', date: '31.10.2026' } });
    expect(blob.size).toBeGreaterThan(1000);
  });
  it('mêmes colonnes que le CSV', () => {
    expect(infosDuPoint(points[0])).toHaveLength(TITRES_INFOS.length);
    expect(csvPoints(points.slice(0, 1)).split('\r\n')[1].split(';')[0]).toBe('P-1');
  });
});
