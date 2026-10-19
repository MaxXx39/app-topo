// Tests des stocks : lecture des plages de noms et vérification des rôles.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { creerStock, lireListeDeNoms, ecrireListeDeNoms, verifierStock, pointsDeBase } from '../src/topo/stocks.js';

const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
const noms = points.map((p) => p.nom);

describe('lireListeDeNoms', () => {
  it('lit une plage « b100 à b116 » dans l\'ordre', () => {
    const resultat = lireListeDeNoms('b100 à b116', noms);
    expect(resultat.noms).toHaveLength(17);
    expect(resultat.noms[0]).toBe('b100');
    expect(resultat.noms[16]).toBe('b116');
    expect(resultat.erreurs).toEqual([]);
  });

  it('lit une plage à l\'envers', () => {
    expect(lireListeDeNoms('b3 à b1', noms).noms).toEqual(['b3', 'b2', 'b1']);
  });

  it('accepte « a » sans accent et plusieurs morceaux', () => {
    expect(lireListeDeNoms('b1 a b3, h7; b10', noms).noms).toEqual(['b1', 'b2', 'b3', 'h7', 'b10']);
  });

  it('signale les points introuvables et garde les autres', () => {
    const resultat = lireListeDeNoms('b15 à b19, x1', noms);
    expect(resultat.noms).toEqual(['b15', 'b16', 'b17']);
    expect(resultat.erreurs).toHaveLength(2);
    expect(resultat.erreurs[0]).toContain('b18, b19');
    expect(resultat.erreurs[1]).toContain('x1');
  });

  it('refuse une plage entre deux débuts différents', () => {
    expect(lireListeDeNoms('b1 à h5', noms).erreurs[0]).toContain('plage');
  });

  it('gère les numéros écrits avec des zéros devant', () => {
    expect(lireListeDeNoms('p008 à p010', ['p008', 'p009', 'p010']).noms).toEqual(['p008', 'p009', 'p010']);
  });
});

describe('ecrireListeDeNoms', () => {
  it('regroupe les numéros qui se suivent', () => {
    expect(ecrireListeDeNoms(['b1', 'b2', 'b3', 'h7', 'h9', 'h8'])).toBe('b1 à b3, h7, h9, h8');
    expect(ecrireListeDeNoms(['b5', 'b4', 'b3'])).toBe('b5 à b3');
    expect(ecrireListeDeNoms(['x', 'y'])).toBe('x, y');
    expect(ecrireListeDeNoms([])).toBe('');
  });

  it('se relit en donnant la même liste', () => {
    const liste = ['b100', 'b101', 'b102', 'b110', 'h3', 'h2', 'h1', 'b1'];
    expect(lireListeDeNoms(ecrireListeDeNoms(liste), noms).noms).toEqual(liste);
  });
});

describe('verifierStock', () => {
  it('accepte le stock 2 de l\'exemple', () => {
    const stock = creerStock('Stock 2');
    stock.contour = lireListeDeNoms('b100 à b116', noms).noms;
    stock.lignesRupture = [lireListeDeNoms('h100 à h114', noms).noms];
    expect(verifierStock(stock, noms)).toEqual([]);
    expect(pointsDeBase(stock)).toEqual(stock.contour);
  });

  it('signale un contour trop court, une ligne d\'un seul point et un doublon', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b1'];
    stock.lignesRupture = [['h1']];
    const problemes = verifierStock(stock, noms);
    expect(problemes.some((p) => p.includes('en double : b1'))).toBe(true);
    expect(problemes.some((p) => p.includes('ligne de rupture 1'))).toBe(true);
  });

  it('signale une base vide quand elle n\'est pas égale au contour', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b3'];
    stock.baseEgaleContour = false;
    expect(verifierStock(stock, noms)).toContain('la surface de base doit avoir au moins 3 points');
  });

  it('signale les points absents du fichier', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'zz'];
    expect(verifierStock(stock, noms).at(-1)).toContain('zz');
  });
});
