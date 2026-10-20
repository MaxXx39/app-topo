// Tests du pointage sur le fond de plan DXF (accrochage aux coins, altitude tapée, noms).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireFondDXF, decoderTexteDXF } from '../src/fond/dxf-fond.js';
import { coinsAccrochables, lePlusProche, lireAltitude, nomSuivant } from '../src/fond/pointage.js';

const p = (est, nord) => ({ est, nord });

describe('coinsAccrochables', () => {
  const fond = {
    calquesCaches: ['Hachures'],
    traits: [
      { calque: 'Talus', points: [p(0, 0), p(10, 0), p(10, 5)], ferme: true },
      { calque: 'Talus', points: [p(10, 5), p(20, 5)], ferme: false }, // (10, 5) déjà pris
      { calque: 'Hachures', points: [p(50, 50), p(51, 51)], ferme: false }, // calque caché
      { calque: 'Axes', points: [p(1, 0), p(0, 1), p(-1, 0)], ferme: true, courbe: true, centre: p(0, 0) },
    ],
    textes: [],
  };

  it('sommets des calques visibles, centre des cercles, sans doublons', () => {
    expect(coinsAccrochables([fond])).toEqual([p(0, 0), p(10, 0), p(10, 5), p(20, 5)]);
  });

  it('plan de terrassement : des coins sur les hauts de talus', () => {
    const vrai = lireFondDXF(decoderTexteDXF(readFileSync(new URL('../exemples/20261019_Ter_100A.dxf', import.meta.url))));
    const seulTalus = { ...vrai, calquesCaches: vrai.calques.filter((c) => !c.endsWith('RS_TALUS-HAUT')) };
    const coins = coinsAccrochables([seulTalus]);
    expect(coins.length).toBeGreaterThan(57);
    // Chaque coin est un sommet d'une polyligne de talus.
    const sommets = new Set(vrai.traits.filter((t) => t.calque.endsWith('RS_TALUS-HAUT')).flatMap((t) => t.points.map((s) => `${s.est} ${s.nord}`)));
    expect(coins.every((c) => sommets.has(`${c.est} ${c.nord}`))).toBe(true);
  });
});

describe('lePlusProche', () => {
  const coins = [p(0, 0), p(10, 0), p(10, 5)];
  it('prend le coin le plus proche dans le rayon (m)', () => {
    expect(lePlusProche(coins, p(9.6, 0.3), 1)).toEqual(p(10, 0));
  });
  it('rien si aucun coin n\'est assez près', () => {
    expect(lePlusProche(coins, p(5, 2.5), 1)).toBeNull();
  });
});

describe('lireAltitude', () => {
  it('accepte le point et la virgule', () => {
    expect(lireAltitude('473.20')).toBe(473.2);
    expect(lireAltitude(' 473,085 ')).toBe(473.085);
    expect(lireAltitude('473')).toBe(473);
  });
  it('refuse ce qui n\'est pas une altitude', () => {
    expect(lireAltitude('')).toBeNull();
    expect(lireAltitude('abc')).toBeNull();
    expect(lireAltitude('473.2.1')).toBeNull();
  });
});

describe('nomSuivant', () => {
  it('P1 au début, puis après le plus grand numéro', () => {
    expect(nomSuivant([])).toBe('P1');
    expect(nomSuivant([{ nom: 'P1' }, { nom: 'P7' }, { nom: 'coin' }])).toBe('P8');
  });
});
