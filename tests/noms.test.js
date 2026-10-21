// Tests des listes de noms : lecture des plages, écriture courte, séries, vérification d'une surface.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { lireListeDeNoms, ecrireListeDeNoms, verifierSurface, detecterSeries } from '../src/topo/noms.js';
import { creerSurface } from '../src/topo/surface.js';

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

describe('verifierSurface', () => {
  it('accepte le stock 2 de l\'exemple', () => {
    const surface = creerSurface('Stock 2', 'leve');
    surface.contour = lireListeDeNoms('b100 à b116', noms).noms;
    surface.lignesRupture = [{ noms: lireListeDeNoms('h100 à h114', noms).noms, fermee: true }];
    expect(verifierSurface(surface, noms)).toEqual([]);
  });

  it('signale un contour trop court, une ligne d\'un seul point et un doublon', () => {
    const surface = creerSurface('Essai', 'leve');
    surface.contour = ['b1', 'b1'];
    surface.lignesRupture = [{ noms: ['h1'], fermee: false }];
    const problemes = verifierSurface(surface, noms);
    expect(problemes.some((p) => p.includes('au moins 3 points (ou aucun)'))).toBe(true);
    expect(problemes.some((p) => p.includes('en double : b1'))).toBe(true);
    expect(problemes.some((p) => p.includes('ligne de rupture 1'))).toBe(true);
  });

  it('accepte une surface sans contour', () => {
    expect(verifierSurface(creerSurface('Terrain', 'leve'), noms)).toEqual([]);
  });

  it('signale les points absents du levé', () => {
    const surface = creerSurface('Essai', 'leve');
    surface.contour = ['b1', 'b2', 'zz'];
    expect(verifierSurface(surface, noms).at(-1)).toContain('zz');
  });
});

describe('detecterSeries', () => {
  it('trouve les 6 séries du fichier d\'exemple', () => {
    const series = detecterSeries(noms).map(ecrireListeDeNoms);
    expect(series).toEqual([
      'b1 à b17',
      'h1 à h31',
      'b100 à b116',
      'h100 à h114',
      'b200 à b217',
      'h200 à h216',
    ]);
  });

  it('coupe une série quand la numérotation saute', () => {
    expect(detecterSeries(['p1', 'p2', 'p3', 'p7', 'p8', 'x'])).toEqual([
      ['p1', 'p2', 'p3'],
      ['p7', 'p8'],
    ]);
  });
});

describe('verifierSurface - ligne fermée', () => {
  it('demande 3 points pour une ligne fermée', () => {
    const surface = creerSurface('Essai', 'leve');
    surface.contour = ['b1', 'b2', 'b3'];
    surface.lignesRupture = [{ noms: ['h1', 'h2'], fermee: true }];
    expect(verifierSurface(surface, noms)[0]).toContain('au moins 3 points (ligne fermée)');
  });
});

describe('liste écrite puis relue (« Terminé » reprend le texte du champ)', () => {
  it('redonne exactement les mêmes points, dans le même ordre', () => {
    const existants = ['b1', 'b2', 'b3', 'b4', 'b5', 'h1', 'h2', 'route3', '27', 'B10'];
    for (const liste of [['b5', 'b4', 'b3'], ['route3', '27'], ['b1', 'b2', 'b3', 'h2', 'h1', 'B10'], ['b2', 'b4', 'b1']]) {
      expect(lireListeDeNoms(ecrireListeDeNoms(liste), existants)).toEqual({ noms: liste, erreurs: [] });
    }
  });
});
