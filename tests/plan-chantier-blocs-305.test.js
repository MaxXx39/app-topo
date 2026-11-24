// Plans de chantier (0.305.0) : tourelles des pelles à pneus / 5 t, goulotte de toupie, pompe à béton réglable, grue
// mobile repliée.
import { describe, it, expect } from 'vitest';
import base from '../src/plans-chantier/symboles-base.json';
import { symboleDeLObjetPose, grueMobile } from '../src/topo/grue-mobile.js';
import { pompeDynamique, CLE_POMPE } from '../src/topo/pompe-dynamique.js';

const bib = base.symboles;
const parNom = (n) => bib.find((s) => s.nom === n);

describe('tourelles orientables', () => {
  for (const nom of ['Pelle Pneu', 'Pelle Chenille 5t', 'Camion toupie (goulotte dépliée)']) {
    it(`${nom} : la tourelle tourne, le châssis reste`, () => {
      const s = parNom(nom);
      expect(s.pivote).toBeTruthy();
      const t = symboleDeLObjetPose(bib, { cle: s.cle, tourelle: 90 });
      expect(t.primitives).toHaveLength(s.primitives.length);
      const fixes = s.pivote.indices ? s.primitives.filter((_, i) => !s.pivote.indices.includes(i)) : s.primitives.slice(0, s.pivote.depuis);
      // Les primitives du châssis sont dessinées en premier, telles quelles.
      expect(t.primitives.slice(0, fixes.length)).toEqual(fixes);
      expect(t.boite).not.toEqual(s.boite);
    });
  }
  it('pelle 5 t : le godet passe sur le côté à 90°', () => {
    const s = parNom('Pelle Chenille 5t');
    const t = symboleDeLObjetPose(bib, { cle: s.cle, tourelle: 90 });
    // Sans rotation, le godet est devant (y < −1.8) ; tourné de 90° (sens trigonométrique), il part vers x > 0.
    expect(t.boite[2]).toBeGreaterThan(s.boite[2] + 1);
  });
});

describe('pompe à béton réglable', () => {
  it('blanche avec « Pompe », plus de rouge', () => {
    const p = pompeDynamique({ deploye: true, longueur: 28 });
    expect(p.cle).toBe(CLE_POMPE);
    expect(p.primitives.some((x) => x.g === 't' && x.t === 'Pompe')).toBe(true);
    expect(p.primitives.some((x) => /d63a3a/i.test(x.k ?? '') && x.mat !== 'feu')).toBe(false); // feux arrière rouges seulement
  });
  it('la longueur du mât allonge le dessin ; pliée, la longueur ne compte pas', () => {
    const court = pompeDynamique({ deploye: true, longueur: 20 });
    const long = pompeDynamique({ deploye: true, longueur: 42 });
    expect(long.boite[3] - court.boite[3]).toBeGreaterThan(15);
    expect(pompeDynamique({ deploye: false, longueur: 20 }).boite).toEqual(pompeDynamique({ deploye: false, longueur: 60 }).boite);
  });
  it('le mât tourne autour de son pivot (le camion reste)', () => {
    const droit = pompeDynamique({ deploye: true, longueur: 28, tourelle: 0 });
    const tourne = pompeDynamique({ deploye: true, longueur: 28, tourelle: 90 });
    expect(droit.boite[3]).toBeGreaterThan(20);
    expect(tourne.boite[3]).toBeLessThan(10);
    expect(tourne.boite[0]).toBeLessThan(-20);
  });
  it('passe par symboleDeLObjetPose', () => {
    expect(symboleDeLObjetPose(bib, { cle: CLE_POMPE, deploye: false }).nom).toBe('Pompe à béton (pliée)');
  });
});

describe('grue mobile repliée', () => {
  it('flèche couchée sur le porteur : bien plus courte que dépliée', () => {
    const dep = grueMobile({ tonnes: 100, fleche: 30 });
    const rep = grueMobile({ tonnes: 100, fleche: 30, repliee: true });
    expect(dep.boite[3] - dep.boite[1]).toBeGreaterThan(25);
    expect(rep.boite[3] - rep.boite[1]).toBeLessThan(15);
  });
});

describe('finisseur Super 800 (0.306.0)', () => {
  it('cotes de la fiche : 4,88 m de long, trémie ouverte 3,09 m ; le 1900 garde sa clé', () => {
    const s = parNom('Finisseur Super 800');
    expect(s.hauteur).toBeCloseTo(4.88, 2);
    expect(s.largeur).toBeCloseTo(3.09, 2);
    expect(bib.find((x) => x.cle === 'base:Finisseur').nom).toBe('Finisseur Super 1900');
  });
});
