import { describe, it, expect } from 'vitest';
import { contourDeSurface, talusParCotes, trianglesDuTalus, tronconsAImplanter, surfaceAvecTalus, tranchesDesCotes } from '../src/topo/talus-cotes.js';

const E0 = 2600000;
const N0 = 1200000;
const p = (e, n, z = 100, nom) => ({ nom, est: E0 + e, nord: N0 + n, altitude: z });
// Plateforme carrée 10 × 10 m à 100 m, sens trigonométrique : côté 0 = sud, 1 = est, 2 = nord, 3 = ouest.
const carre = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
const plat = (z) => () => z;
const r = (horizontal, vertical, autres = {}) => ({ horizontal, vertical, sens: 'auto', longueur: null, altitudeSol: null, ...autres });
const proche = (a, e, n, z) => {
  expect(a.est - E0).toBeCloseTo(e, 3);
  expect(a.nord - N0).toBeCloseTo(n, 3);
  if (z != null) expect(a.altitude).toBeCloseTo(z, 3);
};

describe('contour d\'une surface importée', () => {
  it('trouve le bord extérieur de triangles, dans le sens trigonométrique', () => {
    const [a, b, c, d] = carre;
    const centre = p(5, 5);
    // 4 triangles autour du centre, donnés dans le désordre et dans les deux sens.
    const contour = contourDeSurface([[a, b, centre], [c, centre, b], [c, d, centre], [a, centre, d]]);
    expect(contour).toHaveLength(4);
    let aire = 0;
    contour.forEach((s, i) => {
      const t = contour[(i + 1) % 4];
      aire += (s.est - E0) * (t.nord - N0) - (t.est - E0) * (s.nord - N0);
    });
    expect(aire / 2).toBeCloseTo(100, 6);
  });

  it('laisse de côté un trou', () => {
    // Grand carré 0-30 fait de 8 trapèzes autour d'un trou 10-20 (sans triangles au milieu).
    const ext = [p(0, 0), p(30, 0), p(30, 30), p(0, 30)];
    const int = [p(10, 10), p(20, 10), p(20, 20), p(10, 20)];
    const triangles = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      triangles.push([ext[i], ext[j], int[j]], [ext[i], int[j], int[i]]);
    }
    const contour = contourDeSurface(triangles);
    expect(contour.map((s) => s.est - E0).sort((x, y) => x - y)).toEqual([0, 0, 30, 30]);
  });
});

describe('talus côté par côté (0.135.0)', () => {
  it('remblai sur terrain plat : entrée en terre à 3 m (2 m de haut, pente 3/2)', () => {
    const t = talusParCotes(carre, { 0: r(3, 2) }, { altitudeTerrain: plat(98), pas: 2 });
    const [cote] = t.cotes;
    expect(cote.etat).toBe('ok');
    expect(cote.nature).toBe('remblai');
    for (const q of cote.points) {
      expect(q.entree.nord - N0).toBeCloseTo(-3, 3);
      expect(q.entree.altitude).toBeCloseTo(98, 3);
    }
    // Côté seul : le talus s'arrête à la perpendiculaire des sommets.
    proche(cote.points[0].entree, 0, -3);
    proche(cote.points.at(-1).entree, 10, -3);
  });

  it('déblai : le talus monte jusqu\'au terrain', () => {
    const t = talusParCotes(carre, { 1: r(2, 1) }, { altitudeTerrain: plat(101) });
    const [cote] = t.cotes;
    expect(cote.nature).toBe('deblai');
    proche(cote.points[0].entree, 12, 0, 101);
  });

  it('deux côtés voisins de pentes différentes : arête qui n\'est plus au milieu de l\'angle', () => {
    // Sud 3/2 (3 m pour 2 m) et ouest 1/1 (2 m pour 2 m) : coin sud-ouest de l'entrée en terre en (−2, −3).
    const t = talusParCotes(carre, { 0: r(3, 2), 3: r(1, 1) }, { altitudeTerrain: plat(98) });
    const sud = t.cotes.find((c) => c.cote === 0);
    const ouest = t.cotes.find((c) => c.cote === 3);
    proche(sud.points[0].entree, -2, -3, 98);
    proche(ouest.points.at(-1).entree, -2, -3, 98);
    expect(sud.points[0].arete).toBe(true);
    // Le coin sud-est n'a pas de voisin avec talus : perpendiculaire.
    proche(sud.points.at(-1).entree, 10, -3);
  });

  it('tous les côtés pareils : arêtes à 45°', () => {
    const tous = { 0: r(3, 2), 1: r(3, 2), 2: r(3, 2), 3: r(3, 2) };
    const t = talusParCotes(carre, tous, { altitudeTerrain: plat(98) });
    expect(t.cotes).toHaveLength(4);
    proche(t.cotes[1].points[0].entree, 13, -3);
    proche(t.cotes[2].points[0].entree, 13, 13);
    expect(trianglesDuTalus(t).length).toBeGreaterThan(8);
  });

  it('longueur fixe : le talus s\'arrête avant le terrain', () => {
    const t = talusParCotes(carre, { 0: r(3, 2, { longueur: 1.5 }) }, { altitudeTerrain: plat(98) });
    proche(t.cotes[0].points[0].entree, 0, -1.5, 99);
  });

  it('sans terrain de référence : longueur, sol plat tapé, ou à chercher sur le terrain', () => {
    const longueur = talusParCotes(carre, { 0: r(1, 1, { sens: 'remblai', longueur: 2 }) });
    proche(longueur.cotes[0].points[0].entree, 0, -2, 98);
    const sol = talusParCotes(carre, { 0: r(2, 1, { sens: 'remblai', altitudeSol: 99 }) });
    proche(sol.cotes[0].points[0].entree, 0, -2, 99);
    const aChercher = talusParCotes(carre, { 0: r(2, 1, { sens: 'deblai' }) });
    expect(aChercher.cotes[0].etat).toBe('aChercher');
    expect(aChercher.cotes[0].points).toEqual([]);
    const auto = talusParCotes(carre, { 0: r(2, 1) });
    expect(auto.cotes[0].etat).toBe('erreur');
    expect(auto.cotes[0].message).toMatch(/remblai ou déblai/);
  });

  it('auto sur un terrain en pente : passage du remblai au déblai le long du côté', () => {
    // Terrain qui monte vers l'est : 95 à l'ouest, 105 à E0 + 10.
    const terrain = (e) => 95 + (e - E0);
    const t = talusParCotes(carre, { 0: r(1, 1) }, { altitudeTerrain: terrain, pas: 1 });
    const cote = t.cotes[0];
    expect(cote.nature).toBe('mixte');
    const passage = cote.points.find((q) => Math.abs(q.bord.est - E0 - 5) < 1e-3);
    expect(passage.distance).toBeCloseTo(0, 3);
  });

  it('angle rentrant sans talus voisin : le talus s\'arrête contre le côté voisin', () => {
    // Forme en L (sens trigonométrique) ; le sommet (5, 5) est rentrant.
    const l = [p(0, 0), p(10, 0), p(10, 5), p(5, 5), p(5, 10), p(0, 10)];
    // Côté 3 : (5, 5) → (5, 10), normale vers l'est ; talus de 3 m. Le côté 2 (sans talus) va de (10, 5) à (5, 5).
    const t = talusParCotes(l, { 3: r(3, 2) }, { altitudeTerrain: plat(98) });
    const cote = t.cotes[0];
    // Au sommet rentrant, le bout du talus suit le côté voisin (vers l'est, le long de N = 5).
    proche(cote.points[0].entree, 8, 5, 98);
    proche(cote.points.at(-1).entree, 8, 10, 98);
  });

  it('tronçons à implanter : côtés voisins réglés pareil = une ligne', () => {
    const tr = tronconsAImplanter(carre, { 0: r(3, 2), 1: r(3, 2), 3: r(1, 1) });
    expect(tr).toHaveLength(2);
    const long = tr.find((x) => x.cotes.length === 2);
    expect(long.cotes).toEqual([0, 1]);
    expect(long.sommets).toHaveLength(3);
    expect(tronconsAImplanter(carre, { 0: r(3, 2), 1: r(3, 2), 2: r(3, 2), 3: r(3, 2) })[0].sommets).toHaveLength(5);
  });

  it('surface finale : surface importée gardée + points T-BP / T-ET et triangles du talus', () => {
    const points = carre.map((q, i) => ({ ...q, nom: `S${i + 1}` }));
    const faces = [[0, 1, 2], [0, 2, 3]];
    const t = talusParCotes(carre, { 0: r(3, 2) }, { altitudeTerrain: plat(98), pas: 5 });
    const s = surfaceAvecTalus(points, faces, t);
    // Les 2 sommets du côté sont déjà dans la surface : seul le milieu est un nouveau point du bord.
    expect(s.points.filter((q) => q.nom.startsWith('T-BP')).map((q) => q.nom)).toEqual(['T-BP-1']);
    expect(s.points.filter((q) => q.nom.startsWith('T-ET'))).toHaveLength(3);
    expect(s.faces.slice(0, 2)).toEqual(faces);
    expect(s.faces).toHaveLength(2 + 4);
    // Aire en plan du talus : 10 m × 3 m.
    let aire = 0;
    for (const f of s.faces.slice(2)) {
      const [a, b, c] = f.map((k) => s.points[k]);
      aire += Math.abs((b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est)) / 2;
    }
    expect(aire).toBeCloseTo(30, 3);
  });

  it('barbules : une tranche par côté, du haut vers le bas, avec la pente', () => {
    const reglages = { 0: r(3, 2, { sens: 'remblai', longueur: 3 }), 2: r(3, 2, { sens: 'deblai', longueur: 2 }) };
    const t = talusParCotes(carre, reglages);
    const tranches = tranchesDesCotes(t, reglages);
    expect(tranches).toHaveLength(2);
    const remblai = tranches.find((x) => x.nature === 'remblai');
    expect(remblai.pente).toBe('3/2');
    expect(remblai.haut[0].nord - N0).toBeCloseTo(0, 3);
    const deblai = tranches.find((x) => x.nature === 'deblai');
    // Déblai : le haut est le bout du talus (2 m au nord), le bas est le bord de la surface.
    expect(deblai.haut[0].nord - N0).toBeCloseTo(12, 3);
    expect(deblai.bas[0].nord - N0).toBeCloseTo(10, 3);
  });

  it('tronçons à implanter en auto : coupés au passage du remblai au déblai', () => {
    // Terrain qui monte vers l'est (moins vite que le talus) : le côté sud passe du remblai (ouest) au déblai (est) à E0 + 5.
    const terrain = (e) => 97.5 + (e - E0) / 2;
    const reglages = { 0: r(1, 1), 1: r(1, 1) };
    const t = talusParCotes(carre, reglages, { altitudeTerrain: terrain, pas: 1 });
    const tr = tronconsAImplanter(carre, reglages, t);
    expect(tr.map((x) => x.nature)).toEqual(['remblai', 'deblai']);
    expect(tr[0].sommets.at(-1).est - E0).toBeCloseTo(5, 2);
    expect(tr[1].cotes).toEqual([0, 1]);
    // Sans résultat de calcul : nature inconnue, un seul tronçon.
    expect(tronconsAImplanter(carre, reglages).map((x) => x.nature)).toEqual([null]);
  });
});
