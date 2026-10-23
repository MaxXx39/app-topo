import { describe, it, expect } from 'vitest';
import { englobant, aDessiner, dessinerPlansDxf } from '../src/plan/dxf-canvas.js';

describe('Plans DXF sur le canvas', () => {
  it('rectangle englobant d\'une polyligne', () => {
    expect(englobant([2, 3, -1, 8, 5, 4])).toEqual({ xMin: -1, yMin: 3, xMax: 5, yMax: 8 });
  });

  it('dessine seulement les objets visibles à l\'écran et assez grands', () => {
    const zone = { xMin: 0, yMin: 0, xMax: 100, yMax: 50 };
    // Dans la zone, 2 m à 10 px/m : dessiné.
    expect(aDessiner({ xMin: 10, yMin: 10, xMax: 12, yMax: 10 }, zone, 10)).toBe(true);
    // Hors de la zone : sauté.
    expect(aDessiner({ xMin: 120, yMin: 10, xMax: 130, yMax: 10 }, zone, 10)).toBe(false);
    // À cheval sur le bord : dessiné.
    expect(aDessiner({ xMin: 95, yMin: 40, xMax: 130, yMax: 60 }, zone, 10)).toBe(true);
    // 2 cm à 10 px/m = 0.2 pixel : trop petit, sauté.
    expect(aDessiner({ xMin: 10, yMin: 10, xMax: 10.02, yMax: 10 }, zone, 10)).toBe(false);
  });

  it('trace les traits visibles, de la couleur du plan si elle est choisie', () => {
    const appels = [];
    const ctx = new Proxy({}, {
      get: (cible, nom) => (nom in cible ? cible[nom] : (...args) => appels.push([nom, ...args])),
      set: (cible, nom, valeur) => { cible[nom] = valeur; appels.push(['=', nom, valeur]); return true; },
    });
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const plan = {
      id: 'p1',
      couleur: '#2563eb',
      origine: { est: 1000, nord: 2000 },
      calques: [{ nom: 'A', couleur: '#ff0000', visible: true }, { nom: 'B', couleur: '#00ff00', visible: false }],
      contenu: { traits: [{ c: 0, p: [0, 0, 10, 0] }, { c: 1, p: [0, 5, 10, 5] }, { c: 0, p: [5000, 0, 5010, 0] }] },
    };
    const vue = { echelle: 10, estCentre: 1005, nordCentre: 2000, largeur: 200, hauteur: 100 };
    dessinerPlansDxf(canvas, [plan], vue, 1);
    expect(canvas.width).toBe(200);
    expect(appels.filter(([nom]) => nom === 'moveTo')).toEqual([['moveTo', 0, 0]]); // seul le trait visible, à l'écran
    expect(appels).toContainEqual(['=', 'strokeStyle', '#2563eb']);
    // Plan caché : rien n'est tracé.
    appels.length = 0;
    dessinerPlansDxf(canvas, [{ ...plan, visible: false }], vue, 1);
    expect(appels.filter(([nom]) => nom === 'moveTo')).toHaveLength(0);
  });
});
