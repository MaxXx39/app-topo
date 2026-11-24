// Vue de côté (0.311.0) : traversée d'un bâtiment par la ligne de coupe, grue projetée avec son Z de pied.
import { describe, it, expect } from 'vitest';
import { traverseePolygone, lignesDeCoupe, coupeChantier, formesGrue } from '../src/topo/coupe-chantier.js';
import { svgCoupe } from '../src/plans-chantier/coupe.js';

const carre = [[130, 40], [150, 40], [150, 60], [130, 60]];
const grue = { id: 'g', type: 'grue', modele: 'fiche', point: [100, 50], rotation: 0, fleche: 40, tour: 'hc175-uc460m', hauteur: 27.3, zPied: 100 };
const batiment = { id: 'z', type: 'zone', categorie: 'batiment', zBas: 100, zHaut: 112, points: carre, etiquette: 'Bât A' };
// Terrain en pente : 2 triangles, 98 m à l'ouest (E 0) et 102 m à l'est (E 200) ; plateforme plate à 100 m
const P = (est, nord, altitude) => ({ est, nord, altitude });
const terrain = { id: 't', nom: 'Terrain', type: 'surface', triangles: [[P(0, 0, 98), P(200, 0, 102), P(200, 100, 102)], [P(0, 0, 98), P(200, 100, 102), P(0, 100, 98)]] };
const plateforme = { id: 'p', nom: 'Surf-Plateforme A', type: 'plateforme', triangles: [[P(120, 40, 100), P(160, 40, 100), P(160, 60, 100)], [P(120, 40, 100), P(160, 60, 100), P(120, 60, 100)]] };

describe('traversée d\'un polygone par une ligne', () => {
  it('ligne qui traverse un carré de 20 m : un intervalle de 20 m', () => {
    expect(traverseePolygone([120, 50], [160, 50], carre)).toEqual([[10, 30]]);
  });
  it('ligne qui s\'arrête dans le carré : jusqu\'au bout de la ligne', () => {
    const r = traverseePolygone([120, 50], [140, 50], carre);
    expect(r).toHaveLength(1);
    expect(r[0][0]).toBeCloseTo(10, 6);
    expect(r[0][1]).toBeCloseTo(20, 6);
  });
  it('ligne qui passe à côté : rien', () => {
    expect(traverseePolygone([120, 70], [160, 70], carre)).toEqual([]);
  });
});

describe('coupe d\'un plan de chantier', () => {
  it('l\'axe d\'une grue d\'après fiche est proposé, avec les lignes de construction', () => {
    const l = lignesDeCoupe({ objets: [grue, { id: 'c', type: 'construction', points: [[0, 0], [10, 0]] }] });
    expect(l.map((x) => x.id)).toEqual(['grue:g', 'constr:c']);
    expect(l[0].a[0]).toBeLessThan(100);
    expect(l[0].b[0]).toBeGreaterThan(139);
  });
  it('bâtiment (zone du genre Bâtiment avec Z bas et Z haut) coupé le long de l\'axe de la grue ; une autre zone, même avec des Z, n\'apparaît pas', () => {
    const plan = { objets: [grue, batiment, { id: 'y', type: 'zone', categorie: 'batiment', points: carre }, { id: 'w', type: 'zone', categorie: 'stockage', zBas: 1, zHaut: 5, points: carre }] };
    const c = coupeChantier(plan, lignesDeCoupe(plan)[0]);
    expect(c.batiments).toHaveLength(1);
    expect(c.batiments[0]).toMatchObject({ zBas: 100, zHaut: 112, nom: 'Bât A' });
    expect(c.zMin).toBe(100);
    expect(c.zMax).toBeGreaterThan(130); // haut de la grue
  });
  it('la grue : pied au Z donné, flèche de la tour à la flèche, crochet à Z pied + HSC', () => {
    const l = { a: [90, 50], b: [150, 50] };
    const { formes, niveaux, s0 } = formesGrue(grue, l.a, [1, 0]);
    expect(s0).toBeCloseTo(10, 6);
    expect(niveaux.crochet).toBeCloseTo(127.3, 6);
    const fleche = formes.find((f) => f.genre === 'fleche');
    const xs = fleche.pts.map((p) => p[0]);
    expect(Math.max(...xs) - s0).toBeCloseTo(40 + 1.5, 0); // portée maximale de la flèche
    const crochet = formes.find((f) => f.genre === 'crochet');
    expect(Math.min(...crochet.pts.map((p) => p[1]))).toBeCloseTo(127.3, 6);
  });
  it('une flèche perpendiculaire à la coupe apparaît très raccourcie', () => {
    const { formes, s0 } = formesGrue({ ...grue, rotation: 90 }, [90, 50], [1, 0]);
    const f = formes.find((x) => x.genre === 'fleche');
    expect(Math.max(...f.pts.map((p) => p[0])) - s0).toBeLessThan(5); // flèche à 90° de la ligne de coupe : vue presque de bout
  });
  it('dessin SVG : bâtiment, grue et Z écrits', () => {
    const plan = { objets: [grue, batiment] };
    const svg = svgCoupe(coupeChantier(plan, lignesDeCoupe(plan)[0]), 700, 230);
    expect(svg).toContain('Bât A');
    expect(svg).toContain("HSC 27.3 m");
    expect(svg).toContain('Z 100.00');
  });

  it('terrain et plateforme : profil le long de la coupe, sur le Z de la coupe', () => {
    const plan = { objets: [grue, batiment] };
    const c = coupeChantier(plan, { a: [90, 50], b: [150, 50] }, [terrain, plateforme]);
    expect(c.surfaces.map((x) => [x.nom, x.type])).toEqual([['Terrain', 'terrain'], ['Surf-Plateforme A', 'plateforme']]);
    const t = c.surfaces[0].lignes[0];
    expect(t[0][0]).toBeCloseTo(0, 6);
    expect(t[0][1]).toBeCloseTo(99.8, 6); // E 90 → 98 + 90 × 4 / 200
    expect(t[t.length - 1][1]).toBeCloseTo(98 + (150 * 4) / 200, 6);
    const pf = c.surfaces[1].lignes[0];
    expect(pf[0][0]).toBeCloseTo(30, 6); // la plateforme commence à E 120
    expect(pf[pf.length - 1][0]).toBeCloseTo(60, 6);
    expect(pf.every((p) => p[1] === 100)).toBe(true);
    expect(coupeChantier(plan, { a: [90, 50], b: [150, 50] }, [{ ...terrain, triangles: [] }]).surfaces).toEqual([]);
    const svg = svgCoupe(c, 700, 230);
    expect(svg).toContain('Surf-Plateforme A');
    expect(svg).toContain('#15803d');
    expect(svg).toContain('#b45309');
  });
  it('les lignes de coupe tracées sont proposées en premier, les autres constructions ensuite', () => {
    const l = lignesDeCoupe({ objets: [grue, { id: 'c1', type: 'construction', points: [[0, 0], [10, 0]] }, { id: 'c2', type: 'construction', coupe: true, points: [[5, 5], [60, 5]] }] });
    expect(l.map((x) => x.id)).toEqual(['constr:c2', 'grue:g', 'constr:c1']);
    expect(l[0]).toMatchObject({ nom: 'Coupe 1 (tracée)', a: [5, 5], b: [60, 5] });
  });
});
