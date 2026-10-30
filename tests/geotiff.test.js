import { describe, it, expect } from 'vitest';
import { emprisePhoto, enveloppeTiff, adresseMorceau } from '../src/export/geotiff.js';

describe('GeoTIFF swisstopo (0.98.0)', () => {
  it('emprise : rectangle des points élargi de la marge, aligné sur les pixels', () => {
    const e = emprisePhoto([{ est: 2500000.37, nord: 1100000.2 }, { est: 2500100, nord: 1100050.06 }, { nom: 'x' }], 30, 0.1);
    expect(e.estMin).toBeCloseTo(2499970.3, 6);
    expect(e.estMax).toBeCloseTo(2500130, 6);
    expect(e.nordMin).toBeCloseTo(1099970.2, 6);
    expect(e.nordMax).toBeCloseTo(1100080.1, 6);
    expect(e.largeur).toBe(1597);
    expect(e.hauteur).toBe(1099);
    expect(emprisePhoto([], 30, 0.1)).toBeNull();
  });

  it('en-tête TIFF petit-boutiste et clés MN95 (EPSG:2056)', () => {
    const { debut, fin, octets } = enveloppeTiff(10, 5, 2000, 2500000, 1100000, 0.25);
    const vd = new DataView(debut.buffer);
    expect(String.fromCharCode(debut[0], debut[1])).toBe('II');
    expect(vd.getUint16(2, true)).toBe(42);
    const debutIfd = vd.getUint32(4, true);
    expect(debutIfd).toBe(8 + 10 * 5 * 3);
    expect(octets).toBe(debutIfd + fin.length);
    const vf = new DataView(fin.buffer);
    expect(vf.getUint16(0, true)).toBe(13);
    // Dernières valeurs des clés GeoTIFF : 3072 (code du système) = 2056.
    const geo = Array.from({ length: 16 }, (_, i) => vf.getUint16(fin.length - 8 - 32 + i * 2, true));
    expect(geo.slice(-4)).toEqual([3072, 0, 1, 2056]);
  });

  it('adresse du service WMS en MN95', () => {
    const adresse = adresseMorceau(2500000, 1100000, 2500100, 1100050, 1000, 500);
    expect(adresse).toContain('SRS=EPSG%3A2056');
    expect(adresse).toContain('LAYERS=ch.swisstopo.swissimage');
    expect(adresse).toContain('WIDTH=1000');
  });
});
