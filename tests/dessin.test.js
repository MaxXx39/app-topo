// Dessin : géométrie (cotes avec angles droits, rectangle, pente le long d'un côté).
import { describe, it, expect } from 'vitest';
import { contourParCotes, rectangle, ecartFermeture, altitudesEnPente, directionUnitaire } from '../src/topo/dessin.js';

const A = { est: 2500000, nord: 1100000 };
const versNord = { est: 2500000, nord: 1100010 };
const versEst = { est: 2500010, nord: 1100000 };
const arrondi = (sommets) => sommets.map((s) => ({ est: Math.round((s.est - A.est) * 1000) / 1000, nord: Math.round((s.nord - A.nord) * 1000) / 1000 }));

describe('contour par cotes (longueurs + angles droits)', () => {
  it('vers le nord, 10 m, à droite 5 m (vers l\'est), à droite 10 m (vers le sud)', () => {
    const { sommets } = contourParCotes(A, versNord, [{ longueur: 10 }, { longueur: 5, tourne: 'droite' }, { longueur: 10, tourne: 'droite' }]);
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 0, nord: 10 }, { est: 5, nord: 10 }, { est: 5, nord: 0 }]);
  });

  it('à gauche en partant vers l\'est : on monte vers le nord', () => {
    const { sommets } = contourParCotes(A, versEst, [{ longueur: 4 }, { longueur: 3, tourne: 'gauche' }]);
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 4, nord: 0 }, { est: 4, nord: 3 }]);
  });

  it('forme en L qui se referme : écart de fermeture nul', () => {
    const cotes = [
      { longueur: 10 }, { longueur: 4, tourne: 'droite' }, { longueur: 6, tourne: 'droite' },
      { longueur: 3, tourne: 'gauche' }, { longueur: 4, tourne: 'droite' }, { longueur: 7, tourne: 'droite' },
    ];
    const { sommets } = contourParCotes(A, versNord, cotes);
    expect(ecartFermeture(sommets)).toBeLessThan(1e-9);
  });

  it('erreurs claires : même point, longueur manquante, sens manquant', () => {
    expect(contourParCotes(A, A, [{ longueur: 1 }]).erreur).toMatch(/même endroit/);
    expect(contourParCotes(A, versNord, [{ longueur: 0 }]).erreur).toMatch(/côté 1/);
    expect(contourParCotes(A, versNord, [{ longueur: 1 }, { longueur: 2 }]).erreur).toMatch(/côté 2 : choisis/);
  });
});

describe('rectangle', () => {
  it('12 × 8 m, orienté vers l\'est, largeur à droite (vers le sud)', () => {
    const { sommets } = rectangle(A, versEst, 12, 8, 'droite');
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 12, nord: 0 }, { est: 12, nord: -8 }, { est: 0, nord: -8 }]);
  });

  it('orientation quelconque : côtés et angles droits respectés', () => {
    const { sommets } = rectangle(A, { est: A.est + 3, nord: A.nord + 4 }, 10, 5, 'gauche');
    const d = (p, q) => Math.hypot(q.est - p.est, q.nord - p.nord);
    expect(d(sommets[0], sommets[1])).toBeCloseTo(10, 9);
    expect(d(sommets[1], sommets[2])).toBeCloseTo(5, 9);
    expect(d(sommets[0], sommets[2])).toBeCloseTo(Math.hypot(10, 5), 9);
  });

  it('refuse une largeur nulle', () => {
    expect(rectangle(A, versEst, 10, 0).erreur).toBeTruthy();
  });
});

describe('pente le long d\'un côté', () => {
  const { sommets } = rectangle(A, versEst, 20, 10, 'gauche'); // 0,0 → 20,0 → 20,10 → 0,10
  it('2 % le long du 1er côté (vers l\'est), 450.000 au 1er sommet', () => {
    const h = altitudesEnPente(sommets, { altitude: 450, depuis: 0, cote: 0, pente: 2 });
    expect(h.map((v) => Math.round(v * 1000) / 1000)).toEqual([450, 450.4, 450.4, 450]);
  });

  it('pente nulle : plateforme horizontale', () => {
    expect(altitudesEnPente(sommets, { altitude: 451.2, pente: 0 })).toEqual([451.2, 451.2, 451.2, 451.2]);
  });

  it('direction unitaire nulle pour deux points confondus', () => {
    expect(directionUnitaire(A, A)).toBeNull();
  });
});
