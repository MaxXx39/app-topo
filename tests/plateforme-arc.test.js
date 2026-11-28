import { describe, it, expect } from 'vitest';
import { nouvellePlateforme, courberCoteEnArc, redresserArc, baseArc, arcsValides, facettesDArcs, poigneesArcsPf, FACETTES_ARC } from '../src/topo/plateforme.js';

function carre() {
  const pf = nouvellePlateforme([], 'p1');
  pf.sommets = [
    { nom: 'A-1', est: 0, nord: 0, alt: 100, calc: false },
    { nom: 'A-2', est: 10, nord: 0, alt: 101, calc: false },
    { nom: 'A-3', est: 10, nord: 10, alt: 101, calc: false },
    { nom: 'A-4', est: 0, nord: 10, alt: 100, calc: false },
  ];
  return pf;
}

describe('arc sur un côté de plateforme', () => {
  it('remplace le côté par des facettes avec altitude répartie', () => {
    const pf = carre();
    const erreur = courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, -2], baseArc(pf));
    expect(erreur).toBeNull();
    expect(pf.sommets.length).toBe(4 + FACETTES_ARC - 1);
    expect(arcsValides(pf)).toHaveLength(1);
    expect(facettesDArcs(pf).size).toBe(FACETTES_ARC - 1);
    const facettes = pf.sommets.slice(1, FACETTES_ARC);
    // les altitudes montent de 100 à 101 sans jamais redescendre
    for (let k = 1; k < facettes.length; k += 1) expect(facettes[k].alt).toBeGreaterThanOrEqual(facettes[k - 1].alt);
    expect(facettes[0].alt).toBeGreaterThan(100);
    expect(facettes.at(-1).alt).toBeLessThan(101);
    expect(poigneesArcsPf(pf)).toHaveLength(1);
  });

  it('recourber repart de la base : pas de facettes en double', () => {
    const pf = carre();
    courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, -2], baseArc(pf));
    const base = baseArc(pf);
    courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, -4], base);
    expect(pf.sommets.length).toBe(4 + FACETTES_ARC - 1);
    expect(pf.arcs).toHaveLength(1);
  });

  it('points alignés : pas d\'arc et le côté reste droit', () => {
    const pf = carre();
    const erreur = courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, 0], baseArc(pf));
    expect(erreur).toMatch(/alignés/);
    expect(pf.sommets).toHaveLength(4);
  });

  it('un arc dont une facette a été retirée n\'est plus valable', () => {
    const pf = carre();
    courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, -2], baseArc(pf));
    pf.sommets.splice(3, 1);
    expect(arcsValides(pf)).toHaveLength(0);
  });
});

describe('revenir au segment (0.358.0)', () => {
  it('double-clic sur la poignée : les facettes et leurs talus partent, le côté est droit', () => {
    const pf = carre();
    courberCoteEnArc([pf], pf, 'A-1', 'A-2', [5, -2], baseArc(pf));
    expect(redresserArc(pf, 'A-1', 'A-2')).toBe(true);
    expect(pf.sommets.map((s) => s.nom)).toEqual(['A-1', 'A-2', 'A-3', 'A-4']);
    expect(arcsValides(pf)).toHaveLength(0);
    expect(Object.keys(pf.talus ?? {}).every((n) => ['A-1', 'A-2', 'A-3', 'A-4'].includes(n))).toBe(true);
    expect(redresserArc(pf, 'A-1', 'A-2')).toBe(false);
  });
});
