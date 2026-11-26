import { describe, it, expect } from 'vitest';
import { miseEnPageFeuille, positionDeBoite, accrocherBoite, reglagesFeuille } from '../src/topo/feuille-chantier.js';

const recouvre = (a, b) => a && b && a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

describe('mise en page de la feuille (0.331.0)', () => {
  it('départ inchangé : cartouche bas droite, nord haut gauche, barre bas gauche', () => {
    const m = miseEnPageFeuille('a3', 'paysage', 0);
    expect(m.cartouche.x + m.cartouche.l).toBeCloseTo(m.cadre.x + m.cadre.l, 6);
    expect(m.cartouche.y + m.cartouche.h).toBeCloseTo(m.cadre.y + m.cadre.h, 6);
    expect(m.nord.x).toBeLessThan(m.cadre.x + m.cadre.l / 4);
    expect(m.nord.y).toBeLessThan(m.cadre.y + m.cadre.h / 4);
    expect(m.barre.x).toBeLessThan(m.cadre.x + m.cadre.l / 4);
    expect(m.barre.y).toBeGreaterThan(m.cadre.y + m.cadre.h * 0.8);
  });
  it('4 coins pour le cartouche ; la légende est collée du côté du plan', () => {
    const h = miseEnPageFeuille('a3', 'paysage', 4, { coin: 'hg' });
    expect(h.cartouche.x).toBe(h.cadre.x);
    expect(h.cartouche.y).toBe(h.cadre.y);
    expect(h.legende.y).toBeCloseTo(h.cartouche.y + h.cartouche.h, 6); // sous le cartouche
    const b = miseEnPageFeuille('a3', 'paysage', 4, { coin: 'bg' });
    expect(b.legende.y + b.legende.h).toBeCloseTo(b.cartouche.y, 6); // au-dessus
  });
  it('jamais deux éléments l\'un sur l\'autre au départ, quel que soit le coin du cartouche et de la situation', () => {
    for (const coin of ['bd', 'bg', 'hd', 'hg']) {
      for (const cs of ['hd', 'hg', 'bd', 'bg']) {
        const m = miseEnPageFeuille('a3', 'paysage', 6, { coin, situation: { actif: true, coin: cs, taille: 60 } });
        const boites = [m.cartouche, m.legende, m.boites.situation, m.boites.nord, m.boites.barre];
        for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) expect(recouvre(boites[i], boites[j]), `${coin}/${cs} ${i}-${j}`).toBeFalsy();
      }
    }
  });
  it('place choisie (fractions) retrouvée après un aller-retour', () => {
    const m = miseEnPageFeuille('a3', 'paysage', 0);
    const pos = positionDeBoite(m, { x: 100, y: 80, l: m.boites.barre.l, h: m.boites.barre.h });
    const m2 = miseEnPageFeuille('a3', 'paysage', 0, { positions: { barre: pos } });
    expect(m2.boites.barre.x).toBeCloseTo(100, 1);
    expect(m2.boites.barre.y).toBeCloseTo(80, 1);
  });
  it('accroche : les bords se collent au cadre et aux autres éléments', () => {
    const cadre = { x: 10, y: 10, l: 400, h: 280 };
    const c = accrocherBoite({ x: 11.2, y: 100, l: 30, h: 20 }, [{ x: 200, y: 50, l: 40, h: 40 }], cadre, 3);
    expect(c.x).toBeCloseTo(10, 6); // collée au bord gauche du cadre
    expect(c.y).toBe(100); // rien à moins de 3 mm
    const d = accrocherBoite({ x: 150, y: 52, l: 48.5, h: 20 }, [{ x: 200, y: 50, l: 40, h: 40 }], cadre, 3);
    expect(d.x + 48.5).toBeCloseTo(200, 6); // bord droit contre le bord gauche de l'autre
    expect(d.y).toBeCloseTo(50, 6); // bord haut aligné
  });
  it('réglages : coin du cartouche valide, positions vides au départ', () => {
    expect(reglagesFeuille({}).cartouche).toBe('bd');
    expect(reglagesFeuille({ feuille: { cartouche: 'zz' } }).cartouche).toBe('bd');
    expect(reglagesFeuille({ feuille: { cartouche: 'hg' } }).cartouche).toBe('hg');
    expect(reglagesFeuille({}).positions).toEqual({});
  });
});
