import { describe, it, expect } from 'vitest';
import { cartouchePersoDe, textesCartouche as textesCartoucheT } from '../src/topo/feuille-chantier.js';
describe('Cartouche sur mesure (0.361.0)', () => {
  const champs = { affaire: 'A', projet: '', titre: 'T', phase: '', echelle: 200, format: 'A3', date: '1.1.2026', indice: 'A', auteur: 'Moi' };
  it('sans réglage : cartouche standard', () => { expect(cartouchePersoDe(null)).toBeNull(); });
  it('complète l\'ordre et borne les tailles', () => {
    const p = cartouchePersoDe({ ordre: ['date', 'date', 'inconnu'], champs: { date: { taille: 99 }, titre: { taille: 1 }, auteur: { visible: false } } });
    expect(p.ordre[0]).toBe('date');
    expect(p.ordre).toHaveLength(9);
    expect(p.champs.date.taille).toBe(16);
    expect(p.champs.titre.taille).toBe(4);
    expect(p.champs.auteur.visible).toBe(false);
  });
  it('écrit dans l\'ordre choisi, masque, et tient dans le cartouche', () => {
    const cart = { x: 0, y: 0, l: 100, h: 36 };
    const perso = cartouchePersoDe({ ordre: ['date', 'titre'], champs: { auteur: { visible: false }, titre: { taille: 16 } } });
    const t = textesCartoucheT(cart, 1, champs, perso);
    expect(t[0].texte).toContain('Date');
    expect(t[1].texte).toBe('T');
    expect(t.some((x) => x.texte.includes('Dessiné'))).toBe(false);
    for (let i = 1; i < t.length; i++) expect(t[i].y).toBeGreaterThan(t[i - 1].y);
    expect(t[t.length - 1].y).toBeLessThan(36);
  });
});
