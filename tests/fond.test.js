// Tests du découpage du fond de plan swisstopo en tuiles.
import { describe, it, expect } from 'vitest';
import { niveauDeZoom, tuilesPourZone, RESOLUTIONS, FONDS, estUnTrait } from '../src/plan/fond.js';

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

  it('cadastre : tuiles WMTS du plan cadastral, dont on ne garde que les traits', () => {
    expect(FONDS.cadastre.url(27, 1242, 3509)).toBe(
      'https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/2056/27/1242/3509.png',
    );
    expect(FONDS.cadastre.traitsSeulement).toBe(true);
  });

  it('un trait est un pixel sombre et visible', () => {
    expect(estUnTrait(0, 0, 0, 255)).toBe(true); // limite de parcelle noire
    expect(estUnTrait(160, 20, 20, 255)).toBe(true); // contour de bâtiment rouge foncé
    expect(estUnTrait(255, 255, 255, 255)).toBe(false); // fond blanc
    expect(estUnTrait(250, 200, 200, 255)).toBe(false); // bâtiment rose clair
    expect(estUnTrait(0, 0, 0, 0)).toBe(false); // transparent
  });
});
