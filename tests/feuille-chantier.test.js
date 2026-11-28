import { describe, it, expect } from 'vitest';
import { cartouchePersoDe, textesCartouche as textesCartoucheT, texteCartoucheDe, hauteurTexteCartouche, listeLogos, miseEnPageFeuille } from '../src/topo/feuille-chantier.js';
describe('Cartouche sur mesure (0.361.0)', () => {
  const champs = { affaire: 'A', projet: '', titre: 'T', phase: '', echelle: 200, format: 'A3', date: '1.1.2026', indice: 'A', auteur: 'Moi' };
  it('sans réglage : cartouche standard', () => { expect(cartouchePersoDe(null)).toBeNull(); });
  it('borne les tailles et garde la visibilité', () => {
    const p = cartouchePersoDe({ champs: { date: { taille: 99 }, titre: { taille: 1 }, auteur: { visible: false } } });
    expect(p.champs.date.taille).toBe(16);
    expect(p.champs.titre.taille).toBe(4);
    expect(p.champs.auteur.visible).toBe(false);
    expect(p.champs.affaire.taille).toBe(8);
  });
  it('mêmes positions qu\'avant, seules la taille et la visibilité changent', () => {
    const cart = { x: 0, y: 0, l: 100, h: 36 };
    const base = textesCartoucheT(cart, 1, champs);
    const perso = cartouchePersoDe({ champs: { auteur: { visible: false }, titre: { taille: 12 } } });
    const t = textesCartoucheT(cart, 1, champs, perso);
    expect(t.some((x) => x.texte.includes('Dessiné'))).toBe(false);
    const titre = t.find((x) => x.texte === 'T');
    expect(titre.taille).toBe(12);
    expect(titre.y).toBe(base.find((x) => x.texte === 'T').y);
    expect(titre.x).toBe(base.find((x) => x.texte === 'T').x);
  });
});

describe('Logos, texte du dessus et couleurs (0.362.0)', () => {
  it('liste des logos : ancien réglage, aucun, plusieurs (4 au plus)', () => {
    expect(listeLogos({})).toEqual(['perrin']);
    expect(listeLogos({ logo: 'aucun' })).toEqual([]);
    expect(listeLogos({ logo: 'ronchi' })).toEqual(['ronchi']);
    expect(listeLogos({ logos: ['perrin', 'natalini', 'a', 'b', 'c'] })).toHaveLength(4);
    expect(listeLogos({ logos: [] })).toEqual([]);
  });
  it('texte du dessus : bornes et hauteur', () => {
    const t = texteCartoucheDe({ texte: 'Ligne 1\nLigne 2', taille: 99, opaciteFond: 150, couleur: 'rouge' });
    expect(t.taille).toBe(20);
    expect(t.opaciteFond).toBe(100);
    expect(t.couleur).toBe('#1b2b36');
    expect(hauteurTexteCartouche(texteCartoucheDe({}), 1)).toBe(0);
    expect(hauteurTexteCartouche(t, 1)).toBeGreaterThan(hauteurTexteCartouche({ ...t, texte: 'Ligne 1' }, 1));
  });
  it('le texte se pose contre le cartouche et la légende se décale sans recouvrement', () => {
    const tc = texteCartoucheDe({ texte: 'Attention' });
    const m = miseEnPageFeuille('a3', 'paysage', 3, { texteCartouche: tc });
    expect(m.texteCartouche.y + m.texteCartouche.h).toBeCloseTo(m.cartouche.y, 6);
    expect(m.legende.y + m.legende.h).toBeCloseTo(m.texteCartouche.y, 6);
    const haut = miseEnPageFeuille('a3', 'paysage', 3, { coin: 'hd', texteCartouche: tc });
    expect(haut.texteCartouche.y).toBeCloseTo(haut.cartouche.y + haut.cartouche.h, 6);
    expect(miseEnPageFeuille('a3', 'paysage', 3, {}).texteCartouche).toBeNull();
  });
  it('couleur d\'une information', () => {
    const cart = { x: 0, y: 0, l: 100, h: 36 };
    const perso = cartouchePersoDe({ champs: { titre: { couleur: '#ff0000' } } });
    const t = textesCartoucheT(cart, 1, { affaire: 'A', projet: '', titre: 'T', phase: '', echelle: 200, format: 'A3', date: 'd', indice: 'A', auteur: '' }, perso);
    expect(t.find((x) => x.texte === 'T').couleur).toBe('#ff0000');
    expect(t.find((x) => x.texte === 'A').couleur).toBe('#1b2b36');
  });
});
