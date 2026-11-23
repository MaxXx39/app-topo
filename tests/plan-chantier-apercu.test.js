import { describe, it, expect } from 'vitest';
import { apercuLigne, apercuZone, listeGenres } from '../src/plans-chantier/apercu.js';
import { STYLES_LIGNE, CATEGORIES_ZONE, styleLigne } from '../src/topo/plan-chantier.js';

const echapper = (t) => String(t);

describe('aperçus des genres de ligne et de zone', () => {
  it('chaque genre de ligne a un aperçu SVG dessiné', () => {
    for (const s of STYLES_LIGNE) {
      const svg = apercuLigne(s);
      expect(svg).toContain('<svg');
      expect(svg).toContain(s.couleur);
    }
  });
  it('les motifs se voient : poteaux, chevrons, texte, éclair', () => {
    expect(apercuLigne(styleLigne('cloture'))).toContain('<rect');
    expect(apercuLigne(styleLigne('flecheSimple'))).toContain('<polyline');
    expect(apercuLigne(styleLigne('flecheDouble')).match(/<polyline/g)).toHaveLength(4);
    expect(apercuLigne(styleLigne('eau'))).toContain('>EAU<');
    const elec = apercuLigne(styleLigne('elec'));
    expect(elec).toContain('>ELEC<');
    expect(elec).toContain('<polygon');
  });
  it('un trait en tirets garde ses tirets', () => {
    expect(apercuLigne(styleLigne('conduite'))).toContain('stroke-dasharray');
    expect(apercuLigne(styleLigne('libre'))).not.toContain('stroke-dasharray');
  });
  it('aperçu d\'une zone : couleur, transparence', () => {
    const svg = apercuZone('stockage', 60);
    expect(svg).toContain(CATEGORIES_ZONE.find((c) => c.cle === 'stockage').couleur);
    expect(svg).toContain('fill-opacity="0.6"');
  });
  it('liste de choix : un bouton par genre, le genre courant marqué', () => {
    const html = listeGenres('ligne', 'eau', 'objet', echapper);
    expect(html.match(/data-genre="ligne"/g)).toHaveLength(STYLES_LIGNE.length);
    expect(html).toContain('aria-selected="true"');
    expect(listeGenres('zone', 'stockage', 'outil', echapper).match(/data-genre="zone"/g)).toHaveLength(CATEGORIES_ZONE.length);
  });
});
