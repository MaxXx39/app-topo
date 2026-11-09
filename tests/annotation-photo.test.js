import { describe, it, expect } from 'vitest';
import { rayonCercle, pointeFleche, dessinValide, epaisseurTrait, formeSousLeDoigt, deplacerForme } from '../src/photos/annotation.js';

describe('dessin sur une photo', () => {
  it('rayon du cercle en pixels', () => {
    expect(rayonCercle({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, 1000, 500)).toBeCloseTo(100);
    expect(rayonCercle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.7 }, 1000, 500)).toBeCloseTo(100);
  });

  it('la pointe de flèche est au bout et les deux branches reviennent en arrière', () => {
    const [gauche, bout, droite] = pointeFleche({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }, 1000, 1000, 50);
    expect(bout).toEqual({ x: 600, y: 500 });
    expect(gauche.x).toBeLessThan(600);
    expect(droite.x).toBeLessThan(600);
    expect(gauche.y).toBeCloseTo(1000 - droite.y); // symétriques de part et d'autre de l'axe
  });

  it('pas de flèche sans longueur, pointe raccourcie sur une flèche courte', () => {
    expect(pointeFleche({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 1000, 1000, 50)).toBe(null);
    const [gauche, bout] = pointeFleche({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, 1000, 1000, 50);
    expect(bout.x - gauche.x).toBeLessThan(10);
  });

  it('un simple toucher ne crée pas de dessin', () => {
    expect(dessinValide({ type: 'cercle', a: { x: 0.5, y: 0.5 }, b: { x: 0.5, y: 0.5 } }, 1000, 1000)).toBe(false);
    expect(dessinValide({ type: 'cercle', a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.5 } }, 1000, 1000)).toBe(true);
    expect(dessinValide({ type: 'trait', points: [{ x: 0, y: 0 }] }, 1000, 1000)).toBe(false);
    expect(dessinValide({ type: 'trait', points: [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }] }, 1000, 1000)).toBe(true);
  });

  it('épaisseur : 0,6 % du grand côté, au moins 3 pixels', () => {
    expect(epaisseurTrait(1600, 1200)).toBe(10);
    expect(epaisseurTrait(240, 180)).toBe(3);
  });

  it('dessin sous le doigt : le plus récent d\'abord, cercle par son intérieur, flèche et trait à la tolérance près', () => {
    const formes = [
      { type: 'cercle', a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.5 } },
      { type: 'fleche', a: { x: 0.1, y: 0.1 }, b: { x: 0.3, y: 0.1 } },
      { type: 'trait', points: [{ x: 0.5, y: 0.45 }, { x: 0.7, y: 0.45 }] },
    ];
    expect(formeSousLeDoigt(formes, { x: 0.52, y: 0.5 }, 1000, 1000, 10)).toBe(0);
    expect(formeSousLeDoigt(formes, { x: 0.2, y: 0.105 }, 1000, 1000, 10)).toBe(1);
    expect(formeSousLeDoigt(formes, { x: 0.55, y: 0.45 }, 1000, 1000, 10)).toBe(2); // dans le cercle aussi, mais le trait est plus récent
    expect(formeSousLeDoigt(formes, { x: 0.9, y: 0.9 }, 1000, 1000, 10)).toBe(-1);
  });

  it('déplacer garde la forme et la taille', () => {
    expect(deplacerForme({ type: 'cercle', couleur: 'r', a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.5 } }, 0.1, -0.2))
      .toEqual({ type: 'cercle', couleur: 'r', a: { x: 0.6, y: 0.3 }, b: { x: 0.7, y: 0.3 } });
    const trait = deplacerForme({ type: 'trait', points: [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }] }, 0.5, 0.5);
    expect(trait.points[0].x).toBeCloseTo(0.5);
    expect(trait.points[1].y).toBeCloseTo(0.6);
  });
});

import { dessinValide as dessinValideTexte, deplacerForme as deplacerTexte, formeSousLeDoigt as touchePourTexte, COULEURS_DESSIN as COULEURS } from '../src/photos/annotation.js';
describe('dessin sur photo : texte, bleu et noir (0.184.0)', () => {
  it('propose le bleu et le noir', () => {
    const noms = COULEURS.map(([nom]) => nom);
    expect(noms).toContain('bleu');
    expect(noms).toContain('noir');
  });
  it('un texte vide ne compte pas, un texte se déplace et se touche', () => {
    expect(dessinValideTexte({ type: 'texte', texte: '  ', a: { x: 0.5, y: 0.5 } }, 1000, 800)).toBe(false);
    const t = { type: 'texte', couleur: '#000000', texte: 'fissure', a: { x: 0.5, y: 0.5 } };
    expect(dessinValideTexte(t, 1000, 800)).toBe(true);
    expect(deplacerTexte(t, 0.1, 0).a.x).toBeCloseTo(0.6);
    expect(touchePourTexte([t], { x: 0.52, y: 0.5 }, 1000, 800, 10)).toBe(0);
    expect(touchePourTexte([t], { x: 0.9, y: 0.9 }, 1000, 800, 10)).toBe(-1);
  });
});
