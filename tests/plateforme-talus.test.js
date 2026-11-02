import { describe, it, expect } from 'vitest';
import { talusDePlateforme } from '../src/topo/plateforme-talus.js';

const E0 = 2600000;
const N0 = 1200000;
// Plateforme carrée 10 × 10 m à l'altitude 100 m (sens trigonométrique).
const carre = [
  { nom: 'D1-1', est: E0, nord: N0, altitude: 100 },
  { nom: 'D1-2', est: E0 + 10, nord: N0, altitude: 100 },
  { nom: 'D1-3', est: E0 + 10, nord: N0 + 10, altitude: 100 },
  { nom: 'D1-4', est: E0, nord: N0 + 10, altitude: 100 },
];
const pentes = { remblai: { horizontal: 3, vertical: 2 }, deblai: { horizontal: 2, vertical: 1 } };
const plat = (z) => () => z;

describe('plateforme avec talus jusqu\'au terrain (0.108.0)', () => {
  it('remblai sur terrain plat : entrée en terre à 3 m (2 m de haut, pente 3/2)', () => {
    const t = talusDePlateforme(carre, pentes, plat(98), { pas: 2 });
    expect(t.erreur).toBeUndefined();
    for (const p of t.entree) {
      expect(p.nature).toBe('remblai');
      expect(p.altitude).toBeCloseTo(98, 3);
      const b = t.bord[p.bord];
      // Distance au bord de la plateforme : 3 m (sur les côtés), arête à 3 m de chaque côté aux coins.
      const dedansE = Math.max(E0 - p.est, p.est - (E0 + 10), 0);
      const dedansN = Math.max(N0 - p.nord, p.nord - (N0 + 10), 0);
      expect(Math.max(dedansE, dedansN)).toBeCloseTo(3, 3);
      expect(b.altitude).toBe(100);
    }
    // Coin sud-ouest : arête jusqu'à (E0 − 3, N0 − 3), angle vif.
    expect(t.entree.some((p) => Math.abs(p.est - (E0 - 3)) < 1e-3 && Math.abs(p.nord - (N0 - 3)) < 1e-3)).toBe(true);
    expect(t.aretes).toHaveLength(4);
  });

  it('déblai : le talus monte, pente 2/1 → 2 m pour 1 m', () => {
    const t = talusDePlateforme(carre, pentes, plat(101), { pas: 5 });
    const cote = t.entree.find((p) => t.bord[p.bord].sommet == null);
    expect(cote.nature).toBe('deblai');
    expect(cote.altitude).toBeCloseTo(101, 3);
    const b = t.bord[cote.bord];
    expect(Math.hypot(cote.est - b.est, cote.nord - b.nord)).toBeCloseTo(2, 3);
  });

  it('passage remblai / déblai le long d\'un côté : point commun à la plateforme et à l\'entrée en terre', () => {
    // Terrain en pente vers l'est : 99 m à l'ouest, 101 m à l'est ; la plateforme (100 m) le coupe au milieu.
    const t = talusDePlateforme(carre, pentes, (est) => 99 + 0.2 * (est - E0), { pas: 2 });
    const passages = t.entree.filter((p) => Math.abs(p.altitude - 100) < 1e-3 && Math.abs(p.est - (E0 + 5)) < 1e-3);
    expect(passages.length).toBe(2); // côtés sud et nord
    expect(t.entree.some((p) => p.nature === 'remblai')).toBe(true);
    expect(t.entree.some((p) => p.nature === 'deblai')).toBe(true);
  });

  it('erreurs compréhensibles', () => {
    expect(talusDePlateforme(carre.slice(0, 2), pentes, plat(98)).erreur).toMatch(/3 sommets/);
    expect(talusDePlateforme(carre, { remblai: pentes.remblai }, plat(98)).erreur).toMatch(/déblai/);
    expect(talusDePlateforme(carre, pentes, () => null).erreur).toMatch(/terrain absent/);
  });

  it('coin rentrant (plateforme en L) : pas de point caché derrière la noue', () => {
    const enL = [
      { est: E0, nord: N0, altitude: 100 }, { est: E0 + 20, nord: N0, altitude: 100 }, { est: E0 + 20, nord: N0 + 10, altitude: 100 },
      { est: E0 + 10, nord: N0 + 10, altitude: 100 }, { est: E0 + 10, nord: N0 + 20, altitude: 100 }, { est: E0, nord: N0 + 20, altitude: 100 },
    ];
    const t = talusDePlateforme(enL, pentes, plat(98), { pas: 1 });
    expect(t.erreur).toBeUndefined();
    // Coin rentrant en (E0 + 10, N0 + 10) : la noue va vers (E0 + 13, N0 + 13) ; aucune entrée en
    // terre dans le carré « derrière » (E0 + 10 à E0 + 13, N0 + 10 à N0 + 13) sauf sur la noue.
    for (const p of t.entree) {
      const x = p.est - (E0 + 10);
      const y = p.nord - (N0 + 10);
      if (x > 1e-6 && y > 1e-6 && x < 3 - 1e-6 && y < 3 - 1e-6) expect(Math.abs(x - y)).toBeLessThan(1e-6);
    }
  });
});

import { synchroniserLeveeDuDessin } from '../src/topo/leve-direct.js';

describe('levé « Surface » avec talus (0.108.0)', () => {
  it('points D1-BP-n et D1-ET-n, contour = entrée en terre, lignes de la plateforme et des arêtes ; refait sans talus', () => {
    const projet = { leves: [{ id: 'l', points: [{ nom: 'R1', est: 0, nord: 0, altitude: 0 }] }] };
    const surface = { leveId: 'l', contour: [], lignesRupture: [] };
    const talus = talusDePlateforme(carre, pentes, plat(98), { pas: 5 });
    synchroniserLeveeDuDessin(projet, surface, carre, talus);
    const noms = projet.leves[0].points.map((p) => p.nom);
    expect(noms).toContain('D1-BP-1');
    expect(noms).toContain('D1-ET-1');
    expect(noms).toContain('R1'); // point levé au GNSS : gardé
    expect(surface.contour.every((n) => n.startsWith('D1-ET-'))).toBe(true);
    expect(surface.lignesRupture.filter((l) => l.talus)).toHaveLength(5); // plateforme + 4 arêtes
    synchroniserLeveeDuDessin(projet, surface, carre, null);
    expect(surface.contour).toEqual(['D1-1', 'D1-2', 'D1-3', 'D1-4']);
    expect(projet.leves[0].points.map((p) => p.nom)).toEqual(['D1-1', 'D1-2', 'D1-3', 'D1-4', 'R1']);
    expect(surface.lignesRupture.some((l) => l.talus)).toBe(false);
  });
});
