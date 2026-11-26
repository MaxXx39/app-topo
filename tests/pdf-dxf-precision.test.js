import { describe, it, expect } from 'vitest';
import { dxfDuPdf, precisionPdf } from '../src/topo/pdf-dxf.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';

// Une petite forme (voiture de 12 × 5 points PDF) dans un plan SANS échelle (feuille de 0,3 m) : elle ne doit pas être écrasée
// par l'arrondi au millimètre (0.326.0, PDF « Le Petit Poucet »).
describe('PDF sans échelle : petits détails gardés', () => {
  const traits = [{ points: [[100, 100], [103.3, 101.1], [106.7, 100.4], [112, 105.2]], ferme: false, calque: 'a', couleur: '#000000', rempli: false }];
  it('avec la précision du PDF, les points restent distincts (< 0,01 mm de papier d\'écart)', () => {
    const { plan } = lirePlanDxf(dxfDuPdf({ traits }), 'p.dxf', { precision: precisionPdf(null) });
    const p = plan.contenu.traits[0].p;
    const ptEnM = 0.0254 / 72;
    // distance du 2e point au 1er : 3,3 pt de large, 1,1 pt de haut
    expect(p[2] - p[0]).toBeCloseTo(3.3 * ptEnM, 5);
    expect(p[3] - p[1]).toBeCloseTo(1.1 * ptEnM, 5);
  });
  it('à l\'ancienne précision (mm), le même détail est écrasé : c\'est le défaut corrigé', () => {
    const { plan } = lirePlanDxf(dxfDuPdf({ traits }), 'p.dxf');
    const p = plan.contenu.traits[0].p;
    expect(Math.abs((p[3] - p[1]) - 1.1 * 0.0254 / 72)).toBeGreaterThan(0.0002);
  });
  it('avec une échelle, précision au millimètre comme avant', () => {
    expect(precisionPdf(500)).toBe(1000);
    expect(precisionPdf(null)).toBe(1_000_000);
  });
});
