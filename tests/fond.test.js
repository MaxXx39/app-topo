// Tests du découpage du fond de plan swisstopo en tuiles.
import { describe, it, expect } from 'vitest';
import { niveauDeZoom, tuilesPourZone, RESOLUTIONS, FONDS, emprise } from '../src/plan/fond.js';

describe('niveauDeZoom', () => {
  it('choisit une résolution au moins aussi fine que l\'écran', () => {
    expect(RESOLUTIONS[niveauDeZoom(0.3)]).toBe(0.25);
    expect(RESOLUTIONS[niveauDeZoom(10)]).toBe(10);
    expect(RESOLUTIONS[niveauDeZoom(0.6, 2)]).toBe(0.25); // écran haute définition
  });

  it('s\'arrête au niveau le plus détaillé (0.1 m)', () => {
    expect(niveauDeZoom(0.01)).toBe(28);
  });
});

describe('tuilesPourZone', () => {
  it('trouve la tuile qui contient un point (niveau 20, tuiles de 2560 m)', () => {
    // Est 2 600 000 : (2 600 000 - 2 420 000) / 2560 = 70.3 -> colonne 70
    // Nord 1 200 000 : (1 350 000 - 1 200 000) / 2560 = 58.6 -> ligne 58
    const [tuile] = tuilesPourZone({ estMin: 2600000, estMax: 2600000, nordMin: 1200000, nordMax: 1200000 }, 20);
    expect(tuile).toMatchObject({ colonne: 70, ligne: 58, cote: 2560 });
    expect(tuile.est).toBe(2420000 + 70 * 2560);
    expect(tuile.nord).toBe(1350000 - 58 * 2560);
  });

  it('couvre toute la zone des stocks d\'exemple', () => {
    const zone = { estMin: 2499320, estMax: 2499400, nordMin: 1124560, nordMax: 1124660 };
    const tuiles = tuilesPourZone(zone, 27); // 0.25 m/pixel : tuiles de 64 m
    for (const tuile of tuiles) expect(tuile.cote).toBe(64);
    const estMax = Math.max(...tuiles.map((t) => t.est + t.cote));
    const nordMin = Math.min(...tuiles.map((t) => t.nord - t.cote));
    expect(Math.min(...tuiles.map((t) => t.est))).toBeLessThanOrEqual(zone.estMin);
    expect(estMax).toBeGreaterThanOrEqual(zone.estMax);
    expect(Math.max(...tuiles.map((t) => t.nord))).toBeGreaterThanOrEqual(zone.nordMax);
    expect(nordMin).toBeLessThanOrEqual(zone.nordMin);
  });

  it('construit l\'adresse des tuiles swisstopo', () => {
    expect(FONDS.satellite.url(27, 1242, 3509)).toBe(
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/27/1242/3509.jpeg',
    );
  });

  it('cadastre en traits (WMS transparent) : image à la place exacte de la tuile', () => {
    // Niveau 27 : tuiles de 64 m. Colonne 1242 -> Est 2 420 000 + 1242 × 64 ; ligne 3509 -> Nord 1 350 000 - 3509 × 64.
    expect(emprise(27, 1242, 3509)).toEqual({ estMin: 2499488, nordMin: 1125360, estMax: 2499552, nordMax: 1125424 });
    const adresse = FONDS.cadastre.url(27, 1242, 3509);
    expect(adresse).toContain('LAYERS=ch.swisstopo-vd.amtliche-vermessung');
    expect(adresse).toContain('CRS=EPSG:2056&BBOX=2499488,1125360,2499552,1125424');
    expect(adresse).toContain('TRANSPARENT=true');
  });
});
