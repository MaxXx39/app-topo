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
