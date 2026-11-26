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

import { rotationPourAligner, rotationDeFeuille, vueDuCadre } from '../src/topo/feuille-chantier.js';

describe('rotation de la feuille (0.332.0)', () => {
  it('une ligne déjà horizontale ne tourne pas ; une ligne nord-sud tourne de 90°', () => {
    expect(rotationPourAligner(0)).toBe(0);
    expect(rotationPourAligner(180)).toBe(0); // même ligne, sens inverse
    expect(Math.abs(rotationPourAligner(90))).toBe(90);
  });
  it('une ligne montante à 26,57° devient horizontale : la rotation la ramène à l\'horizontale', () => {
    const r = rotationPourAligner(26.57);
    expect(r).toBeCloseTo(-26.57, 2); // le plan tourne dans le sens des aiguilles : la direction du terrain en haut est à −26,57°
    // vérifié : après rotation r, l'angle de la ligne sur la feuille = angle − (−r) …
    const surFeuille = 26.57 + r; // angle de la ligne sur la feuille, depuis la droite (sens inverse des aiguilles)
    expect(Math.abs(surFeuille)).toBeLessThan(0.01);
  });
  it('vertical : la ligne montante à 60° devient verticale', () => {
    const r = rotationPourAligner(60, true);
    expect(Math.abs(60 + r - 90) % 180).toBeLessThan(0.01);
  });
  it('rotation tapée : virgule acceptée, ramenée à −180…180, texte absurde = 0', () => {
    expect(rotationDeFeuille('15,5')).toBe(15.5);
    expect(rotationDeFeuille(190)).toBe(-170);
    expect(rotationDeFeuille(-360)).toBe(0);
    expect(rotationDeFeuille('abc')).toBe(0);
    expect(rotationDeFeuille(undefined)).toBe(0);
  });
  it('la vue du cadre porte la rotation', () => {
    expect(vueDuCadre({ echelle: 200 }, { l: 100, h: 50 }, 2, [0, 0], 30).rotation).toBe(30);
    expect(vueDuCadre({ echelle: 200 }, { l: 100, h: 50 }, 2, [0, 0]).rotation).toBe(0);
  });
});
