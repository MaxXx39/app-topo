import { describe, it, expect } from 'vitest';
import { cartouchePersoDe, textesCartouche as textesCartoucheT } from '../src/topo/feuille-chantier.js';
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
