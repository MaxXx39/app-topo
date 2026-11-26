import { describe, it, expect } from 'vitest';
import { reglagesElements, barreDeLaFeuille, miseEnPageFeuille, optionsMiseEnPage, reglagesFeuille } from '../src/topo/feuille-chantier.js';

describe('éléments de la feuille (cartouche, nord, échelle, légende)', () => {
  it('valeurs de départ', () => {
    const r = reglagesElements({});
    expect(r).toMatchObject({ cartoucheActif: true, nordStyle: 'boussole', nordTaille: 100, barreStyle: 'alternee', barreLongueur: 0, legendeColonnes: 'auto' });
  });
  it('valeurs absurdes ramenées aux bornes', () => {
    const r = reglagesElements({ nordTaille: '900', barreTaille: '-4', nordStyle: 'x', nordCouleur: 'rouge', barreLongueur: 'abc', legendeColonnes: '9' });
    expect(r).toMatchObject({ nordTaille: 250, barreTaille: 50, nordStyle: 'boussole', nordCouleur: '#1b2b36', barreLongueur: 0, legendeColonnes: 'auto' });
  });
  it('barre : longueur choisie, ou automatique si elle ne tient pas', () => {
    expect(barreDeLaFeuille(200, 70, 10)).toEqual({ metres: 10, mm: 50 });
    expect(barreDeLaFeuille(200, 70, 100).metres).toBeLessThanOrEqual(14);
    expect(barreDeLaFeuille(200, 70).metres).toBeGreaterThan(0);
  });
  it('sans cartouche : plus de cartouche, la légende prend sa place ; nord plus grand', () => {
    const base = miseEnPageFeuille('a3', 'paysage', 4, {});
    const sans = miseEnPageFeuille('a3', 'paysage', 4, { cartoucheActif: false });
    expect(base.cartouche.h).toBeGreaterThan(0);
    expect(sans.cartouche.h).toBe(0);
    const grand = miseEnPageFeuille('a3', 'paysage', 4, { nordTaille: 200 });
    expect(grand.nord.t).toBeCloseTo(base.nord.t * 2, 5);
    expect(miseEnPageFeuille('a3', 'paysage', 12, { legendeColonnes: '1' }).legende.colonnes).toBe(1);
  });
  it('optionsMiseEnPage reprend les réglages de la feuille', () => {
    const o = optionsMiseEnPage(reglagesFeuille({ feuille: { cartoucheActif: false, nordTaille: 150 } }));
    expect(o).toMatchObject({ cartoucheActif: false, nordTaille: 150 });
  });
});
