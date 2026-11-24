// Plateformes (0.300.0) : noms, pentes, interpolation, angles liés, Δ Z, triangles, talus avec berme, volume.
import { describe, it, expect } from 'vitest';
import {
  lettreSuivante, prochainNom, nouvellePlateforme, lireHV, sommetsResolus, changerAltitude, penteCote, altitudeParPente,
  interpolerContour, ajouterPointMilieu, appliquerDeltaZ, plateformesAccrochees, cotePartage, trianglesPlateforme,
  profilTalus, talusPlateforme, trianglesTalus, reglageDuCote, bermeDe, pointsEtFaces,
} from '../src/topo/plateforme.js';
import { trianglerAvecContraintes, volumeEntreSurfaces } from '../src/topo/volume.js';

const E = 2500000;
const N = 1117000;
const pfCarre = (alt = 105, cote = 20) => {
  const pf = nouvellePlateforme([], 'a');
  pf.sommets = [[0, 0], [cote, 0], [cote, cote], [0, cote]].map(([x, y], i) => ({ nom: `A-${i + 1}`, est: E + x, nord: N + y, alt, calc: false }));
  return pf;
};
const terrainPlat = (z) => () => z;
const trianglesTerrain = (z) => {
  const p = (x, y) => ({ est: E + x, nord: N + y, altitude: z });
  return [[p(-100, -100), p(100, -100), p(100, 100)], [p(-100, -100), p(100, 100), p(-100, 100)]];
};

describe('noms', () => {
  it('lettres A, B… puis AA ; points A-1, A-2…', () => {
    expect(lettreSuivante([])).toBe('A');
    expect(lettreSuivante([{ lettre: 'A' }, { lettre: 'C' }])).toBe('B');
    expect(lettreSuivante(Array.from({ length: 26 }, (_, i) => ({ lettre: String.fromCharCode(65 + i) })))).toBe('AA');
    const pf = pfCarre();
    expect(prochainNom(pf)).toBe('A-5');
  });
  it('pentes H:V lues', () => {
    expect(lireHV('3:2')).toEqual({ horizontal: 3, vertical: 2 });
    expect(lireHV('3/2')).toEqual({ horizontal: 3, vertical: 2 });
    expect(lireHV('1,5')).toEqual({ horizontal: 1.5, vertical: 1 });
    expect(lireHV('0:2')).toBeNull();
    expect(lireHV('abc')).toBeNull();
  });
});

describe('pentes et interpolation', () => {
  it('−2 % = descend du 1er point vers le suivant (ordre du contour)', () => {
    const pf = pfCarre(100);
    const s = sommetsResolus(pf, [pf]);
    expect(altitudeParPente(s, 0, -2)).toBeCloseTo(99.6, 9); // 20 m × −2 %
    changerAltitude([pf], pf, 'A-2', 99.6, true);
    expect(penteCote(sommetsResolus(pf, [pf]), 0)).toBeCloseTo(-2, 9);
  });
  it('les vides sont interpolés selon la longueur du contour', () => {
    const pf = pfCarre(null);
    pf.sommets[0].alt = 100; // A-1
    pf.sommets[2].alt = 104; // A-3 : A-2 est à mi-chemin (20 m de chaque côté)
    const r = interpolerContour(sommetsResolus(pf, [pf]));
    expect(r).toEqual([{ nom: 'A-2', alt: 102 }, { nom: 'A-4', alt: 102 }]);
  });
});

describe('plateformes accrochées', () => {
  // B partage le côté A-2 → A-3 de A.
  const deux = () => {
    const a = pfCarre(100);
    const b = nouvellePlateforme([a], 'b');
    b.sommets = [
      { nom: 'A-2', est: 0, nord: 0, alt: null, lien: { id: 'a', nom: 'A-2' } },
      { nom: 'B-1', est: E + 40, nord: N, alt: 101 },
      { nom: 'B-2', est: E + 40, nord: N + 20, alt: 101 },
      { nom: 'A-3', est: 0, nord: 0, alt: null, lien: { id: 'a', nom: 'A-3' } },
    ];
    return [a, b];
  };
  it('un angle lié prend la position et l\'altitude de l\'angle source ; détaché, il garde son altitude', () => {
    const [a, b] = deux();
    let s = sommetsResolus(b, [a, b]);
    expect(s[0]).toMatchObject({ est: E + 20, nord: N, alt: 100, lie: true });
    b.sommets[3].detache = true;
    b.sommets[3].alt = 99.5;
    s = sommetsResolus(b, [a, b]);
    expect(s[3]).toMatchObject({ est: E + 20, nord: N + 20, alt: 99.5, detache: true });
  });
  it('changer l\'altitude d\'un angle lié change la source', () => {
    const [a, b] = deux();
    changerAltitude([a, b], b, 'A-2', 102);
    expect(a.sommets[1].alt).toBe(102);
  });
  it('côté partagé reconnu (pas de talus), et « + » ajoute le point aux deux plateformes', () => {
    const [a, b] = deux();
    expect(cotePartage([a, b], a, 1)).toBe(true);
    expect(cotePartage([a, b], a, 0)).toBe(false);
    expect(reglageDuCote([a, b], a, 1)).toBeNull();
    const nom = ajouterPointMilieu([a, b], a, 1);
    expect(nom).toBe('A-5');
    expect(a.sommets.map((s) => s.nom)).toEqual(['A-1', 'A-2', 'A-5', 'A-3', 'A-4']);
    expect(a.sommets[2]).toMatchObject({ est: E + 20, nord: N + 10, alt: 100, calc: true });
    expect(b.sommets.map((s) => s.nom)).toEqual(['A-2', 'B-1', 'B-2', 'A-3', 'A-5']);
    expect(sommetsResolus(b, [a, b])[4]).toMatchObject({ est: E + 20, nord: N + 10, alt: 100 });
  });
  it('Δ Z : la plateforme seule, ou avec les accrochées', () => {
    let [a, b] = deux();
    appliquerDeltaZ([a, b], 'a', 0.5);
    expect(a.sommets[0].alt).toBe(100.5);
    expect(b.sommets[1].alt).toBe(101);
    expect(sommetsResolus(b, [a, b])[0].alt).toBe(100.5); // angle partagé : bouge avec A
    [a, b] = deux();
    expect([...plateformesAccrochees([a, b], 'a')].sort()).toEqual(['a', 'b']);
    appliquerDeltaZ([a, b], 'a', -1, true);
    expect(a.sommets[0].alt).toBe(99);
    expect(b.sommets[1].alt).toBe(100);
  });
});

describe('triangles', () => {
  it('contour + point intérieur + ligne de rupture', () => {
    const pf = pfCarre(100);
    pf.interieurs = [{ nom: 'A-5', est: E + 5, nord: N + 14, alt: 99 }];
    pf.ruptures = [['A-1', 'A-3']];
    const r = trianglesPlateforme(pf, [pf], trianglerAvecContraintes);
    expect(r.erreur).toBeUndefined();
    expect(r.triangles).toHaveLength(4);
    // La rupture A-1 → A-3 est un côté de triangle.
    expect(r.triangles.some((t) => t.some((p) => p.nom === 'A-1') && t.some((p) => p.nom === 'A-3'))).toBe(true);
  });
  it('altitude manquante : refusé avec le nom du point', () => {
    const pf = pfCarre(100);
    pf.sommets[2].alt = null;
    expect(trianglesPlateforme(pf, [pf], trianglerAvecContraintes).erreur).toContain('A-3');
  });
});

describe('talus', () => {
  const pentes = { deblai: { horizontal: 3, vertical: 2 }, remblai: { horizontal: 2, vertical: 1 } };
  it('profil avec berme : talus ①, berme plate, talus ③', () => {
    const berme = { hauteur: 3, largeur: 2, p3: { horizontal: 2, vertical: 1 } };
    expect(profilTalus(105, 6, 'remblai', pentes.remblai, berme)).toEqual({ z: 102, partie: 1 });
    expect(profilTalus(105, 7, 'remblai', pentes.remblai, berme)).toEqual({ z: 102, partie: 'berme' });
    expect(profilTalus(105, 10, 'remblai', pentes.remblai, berme).z).toBeCloseTo(101, 9);
    expect(profilTalus(95, 3, 'deblai', pentes.deblai, null).z).toBeCloseTo(97, 9);
  });
  it('remblai 2:1 de 5 m sur terrain plat : entrée en terre à 10 m du bord', () => {
    const pf = pfCarre(105);
    const r = talusPlateforme(sommetsResolus(pf, [pf]), () => ({ pentes }), null, terrainPlat(100), { pas: 5 });
    expect(r.erreurs).toEqual([]);
    expect(r.ferme).toBe(true);
    const milieu = r.colonnes.find((c) => c.sommet == null);
    expect(milieu.nature).toBe('remblai');
    const [bord, pied] = [milieu.points[0], milieu.points.at(-1)];
    expect(Math.hypot(pied.est - bord.est, pied.nord - bord.nord)).toBeCloseTo(10, 2);
    expect(pied.altitude).toBeCloseTo(100, 2);
  });
  it('déblai 3:2 de 5 m : 7,5 m ; avec berme (3 m, largeur 2 m) en remblai : 12 m et 4 points', () => {
    const bas = pfCarre(95);
    let r = talusPlateforme(sommetsResolus(bas, [bas]), () => ({ pentes }), null, terrainPlat(100), { pas: 5 });
    let c = r.colonnes.find((x) => x.sommet == null);
    expect(c.nature).toBe('deblai');
    expect(Math.hypot(c.points.at(-1).est - c.points[0].est, c.points.at(-1).nord - c.points[0].nord)).toBeCloseTo(7.5, 2);
    const haut = pfCarre(105);
    haut.berme = { on: true, hauteur: 3, largeur: 2, deb: '3:2', rem: '2:1' };
    r = talusPlateforme(sommetsResolus(haut, [haut]), () => ({ pentes }), bermeDe(haut), terrainPlat(100), { pas: 5 });
    c = r.colonnes.find((x) => x.sommet == null);
    expect(c.points).toHaveLength(4);
    expect(Math.hypot(c.points.at(-1).est - c.points[0].est, c.points.at(-1).nord - c.points[0].nord)).toBeCloseTo(12, 2);
    expect(c.points[1].altitude).toBeCloseTo(102, 6);
  });
  it('volume plateforme + talus = calcul à la main (20 × 20 m à +5 m, talus 2:1 : 4 666,67 m³)', () => {
    const pf = pfCarre(105);
    const tri = trianglesPlateforme(pf, [pf], trianglerAvecContraintes).triangles;
    const talus = talusPlateforme(sommetsResolus(pf, [pf]), () => ({ pentes }), null, terrainPlat(100), { pas: 2 });
    const t2 = trianglesTalus(talus);
    const v = volumeEntreSurfaces([...tri, ...t2], trianglesTerrain(100));
    // ∫₀⁵ (20 + 2 × 2 × (5 − z))² dz = 4666.67 m³ (tolérance 0,5 %)
    expect(v.remblai).toBeGreaterThan(4666.67 * 0.995);
    expect(v.remblai).toBeLessThan(4666.67 * 1.005);
    expect(v.deblai).toBeCloseTo(0, 3);
    const pf2 = pointsEtFaces([...tri, ...t2], 'A-');
    expect(pf2.faces.length).toBe(tri.length + t2.length);
  });
  it('côté sans talus : pas de colonne sur ce côté', () => {
    const pf = pfCarre(105);
    pf.talus['A-1'] = { on: false, deb: '3:2', rem: '2:1' };
    const r = talusPlateforme(sommetsResolus(pf, [pf]), (i) => reglageDuCote([pf], pf, i), null, terrainPlat(100), { pas: 5 });
    expect(r.ferme).toBe(false);
    // Aucune colonne au milieu du côté A-1 → A-2 (nord = N).
    expect(r.colonnes.some((c) => c.sommet == null && Math.abs(c.points[0].nord - N) < 1e-6)).toBe(false);
    expect(trianglesTalus(r).length).toBeGreaterThan(0);
  });
});

// --- 0.302.0 : berme par côté, groupes, étapes, profil, volume du terrain à la fin ---
import { unitesPlateformes, ordreDesEtapes, profilLeLong, volumeTerrainAFin } from '../src/topo/plateforme.js';

describe('berme côté par côté', () => {
  const pentes = { deb: '3:2', rem: '2:1' };
  it('« aucune » sur un côté, « propre » sur un autre, sinon celle de la plateforme', () => {
    const pf = pfCarre(105);
    pf.berme = { on: true, hauteur: 3, largeur: 2, deb: '3:2', rem: '2:1' };
    pf.talus = { 'A-1': { on: true, ...pentes, berme: { mode: 'aucune' } }, 'A-2': { on: true, ...pentes, berme: { mode: 'propre', hauteur: 1, largeur: 4, deb: '3:2', rem: '2:1' } }, 'A-3': { on: true, ...pentes }, 'A-4': { on: true, ...pentes } };
    const r = talusPlateforme(sommetsResolus(pf, [pf]), (i) => reglageDuCote([pf], pf, i), bermeDe(pf), terrainPlat(100), { pas: 5 });
    const milieu = (est, nord) => r.colonnes.find((c) => c.sommet == null && Math.abs(c.points[0].est - est) < 1e-6 && Math.abs(c.points[0].nord - nord) < 1e-6);
    const lg = (c) => Math.hypot(c.points.at(-1).est - c.points[0].est, c.points.at(-1).nord - c.points[0].nord);
    // Côté A-1 → A-2 (sud) sans berme : 5 m × 2 = 10 m, 2 points.
    expect(milieu(E + 10, N).points).toHaveLength(2);
    expect(lg(milieu(E + 10, N))).toBeCloseTo(10, 2);
    // Côté A-2 → A-3 (est), berme propre 1 m / 4 m : 1×2 + 4 + 4×2 = 14 m.
    expect(lg(milieu(E + 20, N + 10))).toBeCloseTo(14, 2);
    // Côté A-3 → A-4 (nord), berme de la plateforme 3 m / 2 m : 6 + 2 + 4 = 12 m.
    expect(lg(milieu(E + 10, N + 20))).toBeCloseTo(12, 2);
  });
});

describe('groupes et étapes', () => {
  it('une plateforme dans un groupe ne compte plus seule ; groupe vide ignoré', () => {
    const a = { id: 'a', nom: 'A', groupeId: 'g1' };
    const b = { id: 'b', nom: 'B', groupeId: 'g1' };
    const c = { id: 'c', nom: 'C', terrainId: 'tn' };
    const u = unitesPlateformes([a, b, c], [{ id: 'g1', nom: 'Radier', terrainId: 'sa' }, { id: 'g2', nom: 'Vide' }]);
    expect(u.map((x) => [x.id, x.type, x.membres.length, x.terrainId])).toEqual([['g1', 'groupe', 2, 'sa'], ['c', 'plateforme', 1, 'tn']]);
  });
  it('ordre : une étape posée sur une autre vient après elle ; boucle signalée', () => {
    const u = [{ id: 'g', nom: 'G', terrainId: 's-a' }, { id: 'a', nom: 'A', terrainId: 'tn' }, { id: 'd', nom: 'D', terrainId: 's-g' }];
    const surf = { g: 's-g', a: 's-a', d: 's-d' };
    expect(ordreDesEtapes(u, (id) => surf[id]).ordre.map((x) => x.id)).toEqual(['a', 'g', 'd']);
    const boucle = [{ id: 'x', nom: 'X', terrainId: 's-y' }, { id: 'y', nom: 'Y', terrainId: 's-x' }];
    expect(ordreDesEtapes(boucle, (id) => `s-${id}`).cycle.sort()).toEqual(['X', 'Y']);
  });
  it('profil le long d\'une coupe', () => {
    const p = profilLeLong((e) => 100 + (e - E) * 0.1, [E, N], [E + 10, N], 1);
    expect(p).toHaveLength(11);
    expect(p[10]).toEqual({ d: 10, z: 101 });
  });
  it('terrain → fin : la dernière étape qui couvre le point compte', () => {
    // Étape 1 : 10 × 10 m à 98 (sur terrain plat à 100) ; étape 2 : 5 × 10 m à 101 posée dessus.
    const e1 = (e, n) => (e >= E && e <= E + 10 && n >= N && n <= N + 10 ? 98 : null);
    const e2 = (e, n) => (e >= E && e <= E + 5 && n >= N && n <= N + 10 ? 101 : null);
    const v = volumeTerrainAFin([e1, e2], () => 100, { estMin: E, estMax: E + 10, nordMin: N, nordMax: N + 10 }, 0.5);
    expect(v.deblai).toBeCloseTo(100, 6); // 50 m² × 2 m
    expect(v.remblai).toBeCloseTo(50, 6); // 50 m² × 1 m
  });
});
