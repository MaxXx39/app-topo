import { describe, it, expect } from 'vitest';
import { lignesFichePoint, htmlFichePoint } from '../src/plan/fiche-point.js';

describe('fiche d\'un point touché', () => {
  it('ne montre que ce qui est connu', () => {
    const l = lignesFichePoint({ nom: 'P1', est: 2538000, nord: 1155000, altitude: 500.12 });
    expect(l).toEqual([['Est (m)', '2538000.000'], ['Nord (m)', '1155000.000'], ['Altitude (m)', '500.120']]);
  });
  it('montre les infos du récepteur, dont le PDOP, et la tablette', () => {
    const l = lignesFichePoint({ nom: 'P1', est: 1, nord: 2, altitude: 3, gnss: { prisLe: '2026-11-12T10:00:00Z', appareil: 'Tab 1', hdop: 0.8, pdop: 1.4, qualite: 4, nbSatellites: 22, ageCorrections: 1.2 } });
    const dict = Object.fromEntries(l);
    expect(dict.HDOP).toBe('0.8');
    expect(dict.PDOP).toBe('1.4');
    expect(dict.Qualité).toBe('RTK fixe');
    expect(dict.Tablette).toBe('Tab 1');
    expect(dict['Âge corrections (s)']).toBe('1.2');
    expect(dict.Nom).toBeUndefined();
  });
  it('protège les textes venant de l\'extérieur', () => {
    const html = htmlFichePoint({ nom: '<b>x</b>', liste: 'LV-<i>', lignes: [['a', '<u>']] });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<u>');
  });
});
