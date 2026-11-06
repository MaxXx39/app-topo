import { describe, it, expect } from 'vitest';
import { creerPlanDao, refaireContenuDao, cercleParTroisPoints, pointsDeLArc, coinsDuRectangle } from '../src/topo/dao.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });

describe('DAO', () => {
  it('cercle par 3 points', () => {
    const c = cercleParTroisPoints(p(10, 0), p(0, 10), p(-10, 0));
    expect(c.est).toBeCloseTo(0, 9);
    expect(c.nord).toBeCloseTo(0, 9);
    expect(c.rayon).toBeCloseTo(10, 9);
    expect(cercleParTroisPoints(p(0, 0), p(1, 1), p(2, 2))).toBeNull();
  });
  it('arc qui passe par le milieu (demi-cercle par le nord)', () => {
    const pts = pointsDeLArc(p(10, 0, 400), p(0, 10), p(-10, 0, 402));
    expect(pts[0].est).toBeCloseTo(10, 6);
    expect(pts.at(-1).est).toBeCloseTo(-10, 6);
    expect(Math.max(...pts.map((x) => x.nord))).toBeCloseTo(10, 1);
    expect(pts.at(-1).altitude).toBeCloseTo(402, 6);
  });
  it('arc qui passe par le sud quand le milieu y est', () => {
    const pts = pointsDeLArc(p(10, 0), p(0, -10), p(-10, 0));
    expect(Math.min(...pts.map((x) => x.nord))).toBeCloseTo(-10, 1);
  });
  it('rectangle par deux coins', () => {
    expect(coinsDuRectangle(p(0, 0), p(4, 3)).map((c) => [c.est, c.nord])).toEqual([[0, 0], [4, 0], [4, 3], [0, 3]]);
  });
  it('contenu en repère local, bornes et calques', () => {
    const plan = creerPlanDao('d1', { est: 2500000.7, nord: 1200000.2 });
    plan.calques.push({ nom: 'B', couleur: '#000', visible: true });
    plan.dao.objets.push({ sorte: 'ligne', calque: 0, points: [p(2500001, 1200001, 400), p(2500011, 1200001, 401)] });
    plan.dao.objets.push({ sorte: 'cercle', calque: 1, points: [p(2500005, 1200005), p(2500007, 1200005)] });
    plan.dao.objets.push({ sorte: 'texte', calque: 0, texte: 'Mur', points: [p(2500003, 1200003)] });
    refaireContenuDao(plan);
    expect(plan.origine).toEqual({ est: 2500000, nord: 1200000 });
    expect(plan.contenu.traits[0]).toEqual({ c: 0, k: null, p: [1, 1, 11, 1], f: false, z: [400, 401] });
    expect(plan.contenu.cercles[0]).toEqual({ c: 1, k: null, x: 5, y: 5, r: 2 });
    expect(plan.contenu.textes[0].t).toBe('Mur');
    expect(plan.bornes).toEqual({ estMin: 2500001, nordMin: 1200001, estMax: 2500011, nordMax: 1200007 });
  });
});

import { objetSousLeDoigt, transformerObjet, translation, rotation, miroir, decalerObjet, prolongerJusqua } from '../src/topo/dao.js';

describe('DAO étape 2 : modifier', () => {
  const ligne = { sorte: 'ligne', points: [p(0, 0, 400), p(10, 0, 401)] };
  const cercle = { sorte: 'cercle', points: [p(20, 20), p(22, 20)] };
  it('objet sous le doigt', () => {
    expect(objetSousLeDoigt([ligne, cercle], p(5, 0.3), 0.5)).toBe(0);
    expect(objetSousLeDoigt([ligne, cercle], p(20, 22.2), 0.5)).toBe(1);
    expect(objetSousLeDoigt([ligne, cercle], p(50, 50), 0.5)).toBe(-1);
  });
  it('déplacer, tourner (horaire), miroir', () => {
    expect(transformerObjet(ligne, translation(p(0, 0), p(1, 2))).points[1]).toEqual({ est: 11, nord: 2, altitude: 401 });
    // 90° horaire autour de (0,0) : l'est (10, 0) passe au sud (0, -10).
    expect(transformerObjet(ligne, rotation(p(0, 0), 90, true)).points[1]).toMatchObject({ est: 0, nord: -10 });
    expect(transformerObjet(ligne, rotation(p(0, 0), 90, false)).points[1]).toMatchObject({ est: 0, nord: 10 });
    // Miroir par l'axe nord-sud passant par x = 5.
    expect(transformerObjet(ligne, miroir(p(5, 0), p(5, 10))).points[1]).toMatchObject({ est: 0, nord: 0 });
  });
  it('décaler une ligne (droite = sud en allant vers l\'est) et un cercle', () => {
    expect(decalerObjet(ligne, 2).points.map((x) => [x.est, x.nord])).toEqual([[0, -2], [10, -2]]);
    const grand = decalerObjet(cercle, 1);
    expect(Math.hypot(grand.points[1].est - 20, grand.points[1].nord - 20)).toBeCloseTo(3, 6);
    expect(decalerObjet(cercle, -5)).toBeNull();
  });
  it('prolonger jusqu\'à une limite, et couper', () => {
    const mur = [p(15, -5), p(15, 5)];
    const long = prolongerJusqua(ligne, p(9, 0), mur);
    expect(long.points[1]).toEqual({ est: 15, nord: 0, altitude: 401.5 });
    const court = prolongerJusqua(ligne, p(9, 0), [p(6, -5), p(6, 5)]);
    expect(court.points[1].est).toBe(6);
    expect(prolongerJusqua(ligne, p(9, 0), [p(0, 5), p(10, 5)])).toBeNull();
  });
});

import { deltaZObjet, sansAltitudes, projeterObjet, altitudesEntre, decalerAvecPente, versPolyligne } from '../src/topo/dao.js';

describe('DAO étape 3 : outils topo', () => {
  const poly = { sorte: 'polyligne', points: [p(0, 0, 400), p(10, 0, 401), p(10, 10, null)] };
  it('delta Z et 2D', () => {
    expect(deltaZObjet(poly, -0.25).points.map((x) => x.altitude)).toEqual([399.75, 400.75, null]);
    expect(sansAltitudes(poly).points.every((x) => x.altitude === null)).toBe(true);
  });
  it('projeter sur une surface plane inclinée, avec et sans points ajoutés', () => {
    const surface = (est, nord) => 500 + est / 10 + nord / 100;
    expect(projeterObjet(poly, surface).points.map((x) => x.altitude)).toEqual([500, 501, 501.1]);
    const dense = projeterObjet({ sorte: 'ligne', points: [p(0, 0), p(10, 0)] }, surface, 2.5);
    expect(dense.sorte).toBe('polyligne');
    expect(dense.points.map((x) => x.est)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(dense.points[2].altitude).toBe(500.5);
    // Hors surface : l'altitude d'avant reste.
    expect(projeterObjet(poly, () => null).points[0].altitude).toBe(400);
  });
  it('altitudes entre 2 valeurs, en proportion de la distance', () => {
    expect(altitudesEntre(poly, 400, 402).points.map((x) => x.altitude)).toEqual([400, 401, 402]);
  });
  it('décaler avec pente : 2 m à droite, pente −50 % → 1 m plus bas', () => {
    const r = decalerAvecPente({ sorte: 'ligne', points: [p(0, 0, 400), p(10, 0, 400)] }, 2, -50);
    expect(r.points.map((x) => [x.nord, x.altitude])).toEqual([[-2, 399], [-2, 399]]);
    expect(decalerAvecPente({ sorte: 'ligne', points: [p(0, 0), p(10, 0)] }, 2, 10)).toBeNull();
  });
  it('rectangle → polyligne fermée', () => {
    const r = versPolyligne({ sorte: 'rectangle', points: [p(0, 0), p(2, 1)] });
    expect(r.sorte).toBe('polyligne');
    expect(r.ferme).toBe(true);
    expect(r.points).toHaveLength(4);
  });
});

import { valeursCote } from '../src/topo/dao.js';

describe('DAO étape 4 : cotes et étiquettes', () => {
  it('valeurs d\'une cote : longueur à plat, Δh, pente, angle lisible', () => {
    const v = valeursCote(p(0, 0, 400), p(-3, -4, 401));
    expect(v.longueur).toBe(5);
    expect(v.dh).toBe(1);
    expect(v.pente).toBe(20);
    expect(v.angle).toBeGreaterThanOrEqual(-90);
    expect(v.angle).toBeLessThanOrEqual(90);
    expect(valeursCote(p(0, 0), p(10, 0)).dh).toBeNull();
  });
  it('cote et étiquette dans le contenu', () => {
    const plan = creerPlanDao('d', { est: 0, nord: 0 });
    plan.dao.objets.push({ sorte: 'cote', calque: 0, hauteur: 0.5, points: [p(0, 0), p(12.3456, 0)] });
    plan.dao.objets.push({ sorte: 'etiquette', calque: 0, hauteur: 0.5, points: [p(5, 5, 431.2)] });
    refaireContenuDao(plan);
    expect(plan.contenu.traits).toHaveLength(5); // cote : trait + 2 bouts ; étiquette : croix (2)
    expect(plan.contenu.textes.map((t) => t.t)).toEqual(['12.346', 'E 5.000  N 5.000', 'H 431.200']);
  });
});
