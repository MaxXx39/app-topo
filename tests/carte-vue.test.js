// 0.216.0 : calculs de la carte des projets (MN95, pixels par mètre).
import { describe, expect, it } from 'vitest';
import { deplacerVue, fondSelonLargeur, vueSurCentres, versEcran, versTerrain, zoneVisible, zoomerVue } from '../src/projet/carte-vue.js';

const [L, H] = [800, 600];

describe('carte des projets : vue', () => {
  it('terrain → écran → terrain : retour au même point ; le centre de la vue est au milieu', () => {
    const vue = { est: 2509468, nord: 1141162, echelle: 0.5 };
    expect(versEcran(vue, L, H, 2509468, 1141162)).toEqual({ x: 400, y: 300 });
    const { x, y } = versEcran(vue, L, H, 2509600, 1141000);
    const retour = versTerrain(vue, L, H, x, y);
    expect(retour.est).toBeCloseTo(2509600, 6);
    expect(retour.nord).toBeCloseTo(1141000, 6);
    // Le nord est en haut : un point plus au nord a un y plus petit.
    expect(versEcran(vue, L, H, 2509468, 1141262).y).toBeLessThan(300);
  });

  it('zone visible : largeur / échelle', () => {
    const z = zoneVisible({ est: 1000, nord: 2000, echelle: 2 }, L, H);
    expect(z.estMax - z.estMin).toBeCloseTo(400, 9);
    expect(z.nordMax - z.nordMin).toBeCloseTo(300, 9);
  });

  it('fond : photo aérienne jusqu\'à 2 km de large, puis carte nationale', () => {
    expect(fondSelonLargeur({ echelle: 1 }, L)).toBe('satellite'); // 800 m
    expect(fondSelonLargeur({ echelle: 800 / 2000 }, L)).toBe('satellite'); // 2 000 m exactement
    expect(fondSelonLargeur({ echelle: 800 / 2001 }, L)).toBe('carte');
  });

  it('cadrage : tous les centres visibles avec une marge ; un seul centre : environ 1 km', () => {
    const centres = [{ est: 2500000, nord: 1100000 }, { est: 2600000, nord: 1150000 }];
    const vue = vueSurCentres(centres, L, H);
    for (const c of centres) {
      const { x, y } = versEcran(vue, L, H, c.est, c.nord);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(L);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(H);
    }
    expect(vueSurCentres([centres[0]], L, H).echelle).toBeCloseTo(0.8, 9);
    expect(vueSurCentres([], L, H).est).toBe(2660000); // aucune position : la Suisse entière
  });

  it('zoom : le point sous le doigt ne bouge pas ; limites d\'échelle', () => {
    const vue = { est: 2509468, nord: 1141162, echelle: 0.5 };
    const avant = versTerrain(vue, L, H, 600, 200);
    const zoom = zoomerVue(vue, 2, 600, 200, L, H);
    const apres = versTerrain(zoom, L, H, 600, 200);
    expect(apres.est).toBeCloseTo(avant.est, 6);
    expect(apres.nord).toBeCloseTo(avant.nord, 6);
    expect(zoom.echelle).toBe(1);
    expect(zoomerVue(vue, 1e9, 0, 0, L, H).echelle).toBe(10);
    expect(zoomerVue(vue, 1e-9, 0, 0, L, H).echelle).toBe(0.00025);
  });

  it('déplacement : glisser le doigt vers la droite fait voir ce qui est à l\'ouest', () => {
    const vue = { est: 1000, nord: 1000, echelle: 2 };
    const glisse = deplacerVue(vue, 100, 0);
    expect(glisse.est).toBe(950);
    expect(deplacerVue(vue, 0, 100).nord).toBe(1050);
  });
});
