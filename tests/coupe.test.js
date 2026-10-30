// Tests des coupes (profils le long d'une ligne).
import { describe, it, expect } from 'vitest';
import { profilSurface, longueurCoupe, cotesLongueur, cotesAltitude } from '../src/topo/coupe.js';
import { pt, pointsDeReference, volumeDeReference, STOCKS_REFERENCE } from './outils.js';

// Carré de 10 m × 10 m en 2 triangles, en pente : altitude = 100 + Est local (1 m par m).
const coins = [pt('1', 0, 0, 100), pt('2', 10, 0, 110), pt('3', 10, 10, 110), pt('4', 0, 10, 100)];
const carre = [
  [coins[0], coins[1], coins[2]],
  [coins[0], coins[2], coins[3]],
];

describe('profilSurface', () => {
  it('traverse le carré d\'ouest en est : une seule ligne de 100 à 110 m', () => {
    const lignes = profilSurface(carre, { est: 0, nord: 5 }, { est: 10, nord: 5 });
    expect(lignes).toHaveLength(1);
    const ligne = lignes[0];
    expect(ligne[0]).toEqual({ distance: 0, altitude: 100 });
    expect(ligne.at(-1).distance).toBeCloseTo(10, 9);
    expect(ligne.at(-1).altitude).toBeCloseTo(110, 9);
    // Au milieu (passage d'un triangle à l'autre) : 105 m.
    const milieu = ligne.find((p) => Math.abs(p.distance - 5) < 1e-9);
    expect(milieu.altitude).toBeCloseTo(105, 9);
  });

  it('commence hors de la surface : le profil démarre où la surface commence', () => {
    const lignes = profilSurface(carre, { est: -5, nord: 5 }, { est: 5, nord: 5 });
    expect(lignes).toHaveLength(1);
    expect(lignes[0][0].distance).toBeCloseTo(5, 9);
    expect(lignes[0][0].altitude).toBeCloseTo(100, 9);
    expect(lignes[0].at(-1).distance).toBeCloseTo(10, 9);
    expect(lignes[0].at(-1).altitude).toBeCloseTo(105, 9);
  });

  it('ne traverse pas la surface : aucun profil', () => {
    expect(profilSurface(carre, { est: 20, nord: 0 }, { est: 30, nord: 10 })).toEqual([]);
  });

  it('surface avec un trou entre deux parties : deux lignes séparées', () => {
    const decale = carre.map((t) => t.map((p) => ({ ...p, est: p.est + 20 })));
    const lignes = profilSurface([...carre, ...decale], { est: 0, nord: 5 }, { est: 30, nord: 5 });
    expect(lignes).toHaveLength(2);
    expect(lignes[1][0].distance).toBeCloseTo(20, 9);
  });

  it('stock 2 de référence : profil continu, entre les altitudes du levé', () => {
    const points = pointsDeReference();
    const resultat = volumeDeReference(STOCKS_REFERENCE[1], points);
    const parNom = new Map(points.map((p) => [p.nom, p]));
    // Coupe de b100 à b108 (deux points du pied, de part et d'autre du stock).
    const debut = parNom.get('b100');
    const fin = parNom.get('b108');
    const lignes = profilSurface(resultat.trianglesDessus, debut, fin);
    expect(lignes.length).toBeGreaterThanOrEqual(1);
    const altitudes = lignes.flat().map((p) => p.altitude);
    const toutes = resultat.trianglesDessus.flat().map((p) => p.altitude);
    expect(Math.min(...altitudes)).toBeGreaterThanOrEqual(Math.min(...toutes) - 1e-6);
    expect(Math.max(...altitudes)).toBeLessThanOrEqual(Math.max(...toutes) + 1e-6);
    expect(lignes.at(-1).at(-1).distance).toBeLessThanOrEqual(longueurCoupe(debut, fin) + 1e-6);
  });
});

describe('cotes', () => {
  it('longueur divisée en 5', () => {
    expect(cotesLongueur(50)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('point bas, point haut et 3 altitudes entre les deux', () => {
    expect(cotesAltitude(420, 428)).toEqual([420, 422, 424, 426, 428]);
  });
});

describe('preparerDessinCoupe', async () => {
  const { preparerDessinCoupe, texteEchellesCoupe } = await import('../src/coupes/dessin.js');
  const coupe = { nom: 'A', debut: { est: 0, nord: 5 }, fin: { est: 10, nord: 5 }, exageration: 1 };
  const profils = [{ nom: 'Pente', nature: 'terrain', lignes: profilSurface(carre, coupe.debut, coupe.fin) }];

  it('choisit l\'échelle la plus détaillée où la coupe tient en longueur et en hauteur', () => {
    // 10 m de long et 10 m de haut dans 150 × 46 mm : 1:250 (40 mm de haut) ; dans 150 × 116 mm : 1:100.
    expect(preparerDessinCoupe(coupe, profils, 171, 60).echelle).toBe(250);
    const dessin = preparerDessinCoupe(coupe, profils, 171, 130);
    expect(dessin.echelle).toBe(100);
    expect(dessin.titre).toBe('Coupe A – A\'');
    expect(texteEchellesCoupe(dessin)).toBe('Longueurs 1:100 · hauteurs 1:100');
    // 6 cotes de longueur (tous les 2 m), 5 cotes d'altitude (100 à 110 m)
    expect(dessin.cotesX.map((c) => c.texte)).toEqual(['0.000', '2.000', '4.000', '6.000', '8.000', '10.000']);
    expect(dessin.cotesY.map((c) => c.texte)).toEqual(['100.000', '102.500', '105.000', '107.500', '110.000']);
    // Le profil reste dans le cadre
    for (const p of dessin.courbes[0].lignes.flat()) {
      expect(p.x).toBeGreaterThanOrEqual(dessin.cadre.x - 1e-9);
      expect(p.x).toBeLessThanOrEqual(dessin.cadre.x + dessin.cadre.largeur + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(dessin.cadre.y - 1e-9);
      expect(p.y).toBeLessThanOrEqual(dessin.cadre.y + dessin.cadre.hauteur + 1e-9);
    }
  });

  it('hauteurs ×2 : échelle des hauteurs deux fois plus grande', () => {
    const dessin = preparerDessinCoupe({ ...coupe, exageration: 2 }, profils, 171, 60);
    expect(dessin.echelleHauteurs).toBe(dessin.echelle / 2);
    expect(texteEchellesCoupe(dessin)).toContain('(×2)');
  });

  it('aucune surface traversée : rien à dessiner', () => {
    expect(preparerDessinCoupe(coupe, [{ nom: 'x', nature: 'stock', lignes: [] }], 171, 60)).toBeNull();
  });
});

describe('grille des coupes en direct (0.90.1)', () => {
  it('pas de 1 m s\'il est lisible, sinon 2, 5, 10 m…', async () => {
    const { pasDeGrille, valeursGrille, svgCoupeDirecte } = await import('../src/leve/coupe-directe.js');
    expect(pasDeGrille(28.6)).toBe(1); // 10 m de coupe sur 286 unités
    expect(pasDeGrille(5)).toBe(2);
    expect(pasDeGrille(2)).toBe(5);
    expect(pasDeGrille(0.5)).toBe(20);
    expect(valeursGrille(-5, 5, 1)).toHaveLength(11);
    expect(valeursGrille(449.37, 451.2, 1)).toEqual([450, 451]);
    const lignes = [[{ distance: 0, altitude: 450 }, { distance: 10, altitude: 451 }]];
    const avec = svgCoupeDirecte({ lignes, demiLongueur: 5, altitudeCanne: 450.5, classe: null, titre: 'A', gauche: 'g', droite: 'd', grille: true });
    const sans = svgCoupeDirecte({ lignes, demiLongueur: 5, altitudeCanne: 450.5, classe: null, titre: 'A', gauche: 'g', droite: 'd' });
    expect((avec.match(/class="grille-coupe"/g) ?? []).length).toBeGreaterThan(10);
    expect(sans).not.toContain('grille-coupe');
  });
});
