// Plans de chantier (0.299.0) : zones « Phase » et « Autre », trait du contour, hachures, « + » au milieu d'un côté.
import { describe, it, expect } from 'vitest';
import {
  CATEGORIES_ZONE, categorieZone, tiretsContour, hachureZone, hachureDeLaZone, milieuxDesCotes, ajouterPointAuMilieu,
  nouveauPlanChantier, ajouterObjet,
} from '../src/topo/plan-chantier.js';
import { pointDansPolygone } from '../src/topo/nettoyage-plan.js';
import { dxfPlanChantier } from '../src/topo/plan-chantier-dxf.js';

const carre = [[2500000, 1117000], [2500010, 1117000], [2500010, 1117010], [2500000, 1117010]];
// Point dans le carré, bord compris (à 1 mm près).
const dansCarre = ([x, y]) => x >= 2500000 - 0.001 && x <= 2500010 + 0.001 && y >= 1117000 - 0.001 && y <= 1117010 + 0.001;

describe('genres de zone', () => {
  it('Phase et Autre existent, avec leur couleur', () => {
    expect(CATEGORIES_ZONE.map((c) => c.cle)).toEqual(expect.arrayContaining(['phase', 'autre']));
    expect(categorieZone('phase').nom).toBe('Phase');
    expect(categorieZone('autre').couleur).toBe('#a855f7');
  });
});

describe('trait du contour', () => {
  it('continu par défaut, tirets en mm de papier sinon', () => {
    expect(tiretsContour({})).toEqual([]);
    expect(tiretsContour({ traitContour: 'tirets' })).toEqual([4, 2]);
    expect(tiretsContour({ traitContour: 'inconnu' })).toEqual([]);
  });
});

describe('hachures', () => {
  it('lignes horizontales tous les 2 m : 5 traits de 10 m dans le carré', () => {
    const h = hachureZone(carre, { motif: 'lignes', angle: 0, pas: 2 });
    // Lignes à N = 1117000 (bord), 002, 004, 006, 008 : la grille suit l'origine MN95.
    expect(h.segments).toHaveLength(5);
    for (const [x1, y1, x2, y2] of h.segments) {
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(10, 6);
      expect(y1).toBeCloseTo(y2, 6);
    }
  });
  it('tous les traits restent dans la zone, quel que soit l\'angle', () => {
    for (const motif of ['lignes', 'quadrillage', 'tirets', 'briques']) {
      const h = hachureZone(carre, { motif, angle: 30, pas: 1.5 });
      expect(h.segments.length).toBeGreaterThan(0);
      for (const [x1, y1, x2, y2] of h.segments) {
        expect(dansCarre([x1, y1])).toBe(true);
        expect(dansCarre([x2, y2])).toBe(true);
      }
    }
  });
  it('quadrillage = deux fois plus de traits que les lignes', () => {
    const l = hachureZone(carre, { motif: 'lignes', angle: 0, pas: 2 });
    const q = hachureZone(carre, { motif: 'quadrillage', angle: 0, pas: 2 });
    expect(q.segments).toHaveLength(2 * l.segments.length);
  });
  it('points : une grille de points dans la zone', () => {
    const tri = [[0, 0], [10, 0], [0, 10]];
    const h = hachureZone(tri, { motif: 'points', angle: 0, pas: 1 });
    expect(h.points.length).toBeGreaterThan(40);
    expect(h.points.every(([x, y]) => pointDansPolygone(x, y, tri) || x + y <= 10 + 1e-9)).toBe(true);
  });
  it('pas minuscule : élargi (jamais des millions de traits)', () => {
    const h = hachureZone(carre, { motif: 'points', angle: 0, pas: 0.001 });
    expect(h.points.length).toBeLessThanOrEqual(20000);
  });
  it('réglages de la zone : pas en mm de papier × échelle', () => {
    const plan = { echelle: 500 };
    expect(hachureDeLaZone(plan, { hachure: { motif: 'lignes', angle: 60, pasMm: 4 } })).toEqual({ motif: 'lignes', angle: 60, pas: 2 });
    expect(hachureDeLaZone(plan, { hachure: { motif: 'aucune' } })).toBeNull();
    expect(hachureDeLaZone(plan, {})).toBeNull();
  });
  it('DXF : les hachures sortent sur leur calque', () => {
    const plan = nouveauPlanChantier('Essai');
    ajouterObjet(plan, { type: 'zone', points: carre, categorie: 'autre', hachure: { motif: 'lignes', angle: 0, pasMm: 10 } });
    const texte = dxfPlanChantier(plan, []);
    expect(texte).toContain('ZONE_AUTRE_HACHURES');
    expect(texte.split(/\r?\nLINE\r?\n/).length - 1).toBe(5);
  });
});

describe('« + » au milieu d\'un côté', () => {
  it('une zone a un côté de plus (celui qui ferme) qu\'une ligne', () => {
    expect(milieuxDesCotes({ type: 'zone', points: carre })).toHaveLength(4);
    expect(milieuxDesCotes({ type: 'ligne', points: carre })).toHaveLength(3);
    expect(milieuxDesCotes({ type: 'texte', point: carre[0] })).toEqual([]);
    expect(milieuxDesCotes({ type: 'zone', points: carre })[3].milieu).toEqual([2500000, 1117005]);
  });
  it('le point est ajouté entre les deux sommets du côté', () => {
    expect(ajouterPointAuMilieu([[0, 0], [10, 0], [10, 10]], 0)).toEqual([[0, 0], [5, 0], [10, 0], [10, 10]]);
    // Côté qui ferme une zone : ajouté à la fin.
    expect(ajouterPointAuMilieu([[0, 0], [10, 0], [10, 10]], 2, true)).toEqual([[0, 0], [10, 0], [10, 10], [5, 5]]);
    // Côté qui n'existe pas (ligne ouverte) : rien ne change.
    expect(ajouterPointAuMilieu([[0, 0], [10, 0]], 1)).toEqual([[0, 0], [10, 0]]);
  });
});
