// Tests de l'implantation d'une ligne : abscisse, décalage, altitude, ligne parallèle.
import { describe, it, expect } from 'vitest';
import { longueurPolyligne, positionSurLigne, altitudeSurLigne, guidageLigne, ligneParallele, sommetsChoisis } from '../src/topo/ligne-implantation.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });
// Ligne en L : (0,0) → (10,0) → (10,10), avec des altitudes 400, 401, 403.
const L = [p(0, 0, 400), p(10, 0, 401), p(10, 10, 403)];

describe('position sur la ligne', () => {
  it('longueur, abscisse et décalage (+ à droite en allant vers la fin)', () => {
    expect(longueurPolyligne(L)).toBe(20);
    // Sur le 1er segment (vers l'est), 2 m au sud = à droite.
    expect(positionSurLigne(p(4, -2), L)).toMatchObject({ abscisse: 4, decalage: 2, segment: 0 });
    // Sur le 2e segment (vers le nord), 1 m à l'ouest = à gauche.
    expect(positionSurLigne(p(9, 5), L)).toMatchObject({ abscisse: 15, decalage: -1, segment: 1 });
  });

  it('avant le début et après la fin : on prolonge la ligne', () => {
    expect(positionSurLigne(p(-3, 1), L)).toMatchObject({ abscisse: -3, decalage: -1 });
    expect(positionSurLigne(p(11, 12), L)).toMatchObject({ abscisse: 22, decalage: 1 });
  });
});

describe('altitude de la ligne', () => {
  it('celle des sommets (DXF 3D), sinon celles tapées, null hors de la ligne', () => {
    expect(altitudeSurLigne(5, L)).toBeCloseTo(400.5);
    expect(altitudeSurLigne(15, L)).toBeCloseTo(402);
    expect(altitudeSurLigne(10, L, { debut: 410, fin: 420 })).toBeCloseTo(415);
    expect(altitudeSurLigne(5, [p(0, 0), p(10, 0)])).toBeNull();
    expect(altitudeSurLigne(-1, L)).toBeNull();
  });
});

describe('guidage vers la ligne', () => {
  it('écart au décalage voulu et point visé sur la ligne parallèle', () => {
    // Ligne parallèle à 1 m à droite (au sud du 1er segment) ; la canne est 0.3 m au sud.
    const g = guidageLigne(p(4, -0.3), L, { decalageVoulu: 1 });
    expect(g.ecart).toBeCloseTo(-0.7); // trop à gauche : aller à droite de 0.7 m
    expect(g.cible.est).toBeCloseTo(4);
    expect(g.cible.nord).toBeCloseTo(-1);
    expect(g.reste).toBeCloseTo(16);
    expect(g.altitude).toBeCloseTo(400.4);
  });

  it('ligne parallèle pour le plan, segment choisi et sens inversé', () => {
    const parallele = ligneParallele(L, 1);
    expect(parallele[0]).toMatchObject({ est: 0, nord: -1 });
    expect(parallele[1].est).toBeCloseTo(11);
    expect(parallele[1].nord).toBeCloseTo(-1);
    expect(parallele[2]).toMatchObject({ est: 11, nord: 10 });
    expect(sommetsChoisis(L, { segment: 1 })).toEqual([L[1], L[2]]);
    expect(sommetsChoisis(L, { inverse: true })).toEqual([L[2], L[1], L[0]]);
  });
});
