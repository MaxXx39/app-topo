// Tests des coupes de réseaux en SVG : le texte contient les bons éléments (tuyaux, tranchée, terrain, pentes).
import { describe, it, expect } from 'vitest';
import { nouveauReseau, coupeEnTravers, croisementsSurAxe } from '../src/topo/reseau.js';
import { svgCoupeEnTravers, svgCoupeAxe, exagerationAuto } from '../src/reseaux/coupe-svg.js';

const s = (est, nord, fe) => ({ est, nord, fe });
const eu = nouveauReseau({ type: 'EU', nom: 'EU-1', diametre: 0.315, sommets: [s(0, 0, 100), s(10, 0, 101), s(20, 0, 99)], tranchee: { hauteur: 0.15, largeur: 0.8, talus: 0.5 } });
const ec = nouveauReseau({ type: 'EC', nom: 'EC-1', diametre: 0.25, sommets: [s(4, -2, 98.5), s(4, 2, 98.5)] });

describe('coupe en travers (SVG)', () => {
  // EC parallèle à EU, 1,5 m au sud : la coupe en travers à x = 4 la croise.
  const ecParallele = nouveauReseau({ type: 'EC', nom: 'EC-1', diametre: 0.25, sommets: [s(2, -1.5, 98.5), s(6, -1.5, 98.5)] });
  it('un cercle par tuyau, la tranchée, le terrain et le FE écrit', () => {
    const coupe = coupeEnTravers([eu, ecParallele], eu.id, 4, 4);
    const svg = svgCoupeEnTravers({ coupe, terrain: [{ x: 0, z: 102 }, { x: 8, z: 102 }], terrainEn: () => 102 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/class="tuyau-coupe"/g)).toHaveLength(2);
    expect(svg).toContain('class="tranchee-coupe"');
    expect(svg).toContain('class="terrain-coupe"');
    expect(svg).toContain('EU-1 · Ø315 · FE 100.400');
    expect(svg).toContain('EC-1 · Ø250 · FE 98.500');
  });

  it('sans tranchée ni surface : seulement les tuyaux', () => {
    const sans = { ...eu, tranchee: null };
    const svg = svgCoupeEnTravers({ coupe: coupeEnTravers([sans], sans.id, 4, 4) });
    expect(svg).not.toContain('tranchee-coupe');
    expect(svg).not.toContain('terrain-coupe');
    expect(svg).toContain('tuyau-coupe');
  });

  it('pas de coupe : texte vide', () => {
    expect(svgCoupeEnTravers({ coupe: null })).toBe('');
  });
});

describe('coupe dans l\'axe (SVG)', () => {
  it('bande du tuyau, fond de tranchée, FE de chaque sommet, pente de chaque segment', () => {
    const { svg, exageration } = svgCoupeAxe({ reseau: eu, terrain: [[{ d: 0, z: 102 }, { d: 20, z: 101.5 }]], croisements: croisementsSurAxe([eu, ec], eu.id) });
    expect(svg).toContain('class="tuyau-coupe"');
    expect(svg).toContain('class="fond-tranchee-coupe"');
    expect(svg.match(/class="fe-coupe"/g)).toHaveLength(3);
    expect(svg).toContain('↗ +10.00 %');
    expect(svg).toContain('↘ −20.00 %');
    expect(svg).toContain('EC-1');
    expect(exageration).toBeGreaterThanOrEqual(1);
  });

  it('l\'exagération des hauteurs est le plus grand facteur qui tient', () => {
    // 20 m sur 696 px (≈ 34.8 px/m), 3 m de haut, 276 px utiles : ×1 = 104 px, ×2 = 209 px, ×3 = 313 px (trop).
    expect(exagerationAuto(20, 98, 101)).toBe(2);
    expect(exagerationAuto(20, 100, 100.01)).toBe(20);
  });
});
