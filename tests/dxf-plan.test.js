// Tests de la lecture d'un plan DXF (fond de plan) : lignes, polylignes avec arcs, cercles,
// textes, courbes, aplats, blocs, calques et couleurs.
import { describe, it, expect } from 'vitest';
import { lirePlanDxf, texteDuDxf, estEnMn95, pointsRenflement, pointsSpline, couleurAci, texteSansMiseEnForme } from '../src/topo/dxf-plan.js';

/** Fabrique un DXF texte à partir de paires [code, valeur]. */
const dxf = (...paires) => paires.flat().map(String).join('\n');
const section = (nom, ...contenu) => [[0, 'SECTION'], [2, nom], ...contenu, [0, 'ENDSEC']];

const E = 2507300;
const N = 1138600;
const FICHIER = dxf(
  ...section('HEADER', [9, '$ACADVER'], [1, 'AC1024']),
  ...section(
    'TABLES',
    [0, 'TABLE'], [2, 'LAYER'],
    [0, 'LAYER'], [2, 'EC projet axe'], [70, 0], [62, 5],
    [0, 'LAYER'], [2, 'Caché'], [70, 0], [62, -3],
    [0, 'ENDTAB'],
  ),
  ...section(
    'BLOCKS',
    [0, 'BLOCK'], [8, '0'], [2, 'CHAMBRE'], [10, 0], [20, 0],
    [0, 'CIRCLE'], [8, '0'], [10, 0], [20, 0], [40, 0.5],
    [0, 'ENDBLK'],
  ),
  ...section(
    'ENTITIES',
    [0, 'LINE'], [8, 'EC projet axe'], [10, E + 10], [20, N + 10], [30, 0], [11, E + 20], [21, N + 10], [31, 0],
    // Demi-cercle de rayon 5 entre (E, N) et (E + 10, N) : renflement 1, vers le sud (sens trigonométrique).
    [0, 'LWPOLYLINE'], [8, 'EC projet axe'], [90, 2], [70, 0], [10, E], [20, N], [42, 1], [10, E + 10], [20, N],
    [0, 'TEXT'], [8, 'EC projet axe'], [62, 1], [10, E + 5], [20, N + 5], [40, 0.25], [1, 'R=412.49 %%c160'], [50, 30],
    [0, 'MTEXT'], [8, 'Caché'], [10, E + 1], [20, N + 1], [40, 0.3], [71, 5], [1, '{\\fArial|b0;Bassin\\Pde rétention}'],
    [0, 'SOLID'], [8, 'EC projet axe'], [10, E], [20, N], [11, E + 1], [21, N], [12, E], [22, N + 1], [13, E + 1], [23, N + 1],
    [0, 'INSERT'], [8, 'EC projet axe'], [2, 'CHAMBRE'], [10, E + 30], [20, N + 30], [41, 2], [42, 2],
    [0, 'HATCH'], [8, 'EC projet axe'],
  ),
  [0, 'EOF'],
);

describe('lecture d\'un plan DXF', () => {
  const { plan } = lirePlanDxf(FICHIER, 'essai.dxf');

  it('range les objets par rapport à une origine au mètre, au millimètre près', () => {
    expect(plan.origine).toEqual({ est: E, nord: N - 5 }); // le demi-cercle descend à 5 m sous N
    const ligne = plan.contenu.traits[0];
    expect(ligne.p).toEqual([10, 15, 20, 15]);
  });

  it('découpe un arc de polyligne (renflement) en petits segments sur le bon cercle', () => {
    const arc = plan.contenu.traits[1];
    const points = [];
    for (let i = 0; i < arc.p.length; i += 2) points.push([arc.p[i], arc.p[i + 1]]);
    // Tous les points à 5 m du centre (5, 5 dans le repère du plan), et au sud du diamètre.
    for (const [x, y] of points) {
      expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(5, 3);
      expect(y).toBeLessThanOrEqual(5.001);
    }
    expect(points.at(-1)).toEqual([10, 5]);
  });

  it('lit les textes (symboles, angle, MTEXT sans mise en forme)', () => {
    const [texte, mtexte] = plan.contenu.textes;
    expect(texte).toMatchObject({ t: 'R=412.49 Ø160', h: 0.25, a: 30, k: '#ff0000' });
    expect(mtexte).toMatchObject({ t: 'Bassin de rétention', ah: 1, av: 2 });
  });

  it('calques : couleur de la table, calque éteint caché', () => {
    expect(plan.calques.find((c) => c.nom === 'EC projet axe')).toMatchObject({ couleur: '#0000ff', visible: true });
    expect(plan.calques.find((c) => c.nom === 'Caché')).toMatchObject({ visible: false });
  });

  it('aplats, blocs insérés (agrandis) et objets non lus comptés', () => {
    expect(plan.contenu.pleins[0].p).toEqual([0, 5, 1, 5, 1, 6, 0, 6]);
    const chambre = plan.contenu.cercles[0];
    expect(chambre).toMatchObject({ x: 30, y: 35, r: 1 });
    // Le cercle du bloc est sur le calque 0 : il prend le calque de l'insertion.
    expect(plan.calques[chambre.c].nom).toBe('EC projet axe');
    expect(plan.compte.ignores).toEqual({ HATCH: 1 });
  });

  it('reconnaît un plan en MN95', () => {
    expect(estEnMn95(plan.bornes)).toBe(true);
    expect(estEnMn95({ estMin: 0, nordMin: 0, estMax: 120, nordMax: 80 })).toBe(false);
  });

  it('refuse un fichier qui n\'est pas un dessin', () => {
    expect(lirePlanDxf('bonjour').erreur).toBeTruthy();
    expect(lirePlanDxf('AutoCAD Binary DXF\r\n').erreur).toMatch(/binaire/);
  });
});

describe('outils du DXF', () => {
  it('quart de cercle par renflement (tan 22.5°)', () => {
    const points = pointsRenflement([1, 0], [0, 1], Math.tan(Math.PI / 8));
    for (const [x, y] of points) expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
    expect(points[0]).toEqual([1, 0]);
  });

  it('courbe de Bézier (B-spline de degré 3 à 4 points) : passe par ses extrémités', () => {
    const points = pointsSpline(3, [[0, 0], [1, 2], [3, 2], [4, 0]], [0, 0, 0, 0, 1, 1, 1, 1]);
    expect(points[0][0]).toBeCloseTo(0);
    expect(points.at(-1)[0]).toBeCloseTo(4, 6);
    // Milieu d'une Bézier cubique : (P0 + 3 P1 + 3 P2 + P3) / 8.
    const milieu = points[Math.floor(points.length / 2)];
    expect(milieu[0]).toBeCloseTo(2, 6);
    expect(milieu[1]).toBeCloseTo(1.5, 6);
  });

  it('couleurs AutoCAD : de base, gris, et 7 dessiné en noir', () => {
    expect(couleurAci(1)).toBe('#ff0000');
    expect(couleurAci(7)).toBe('#000000');
    expect(couleurAci(250)).toBe('#333333');
    expect(couleurAci(10)).toBe('#ff0000');
  });

  it('enlève la mise en forme d\'un MTEXT', () => {
    expect(texteSansMiseEnForme('{\\H0.5x;Chambre\\PØ80}')).toBe('Chambre Ø80');
  });

  it('jeu de caractères : UTF-8 pour un DXF récent, Windows pour un ancien', () => {
    const recent = new TextEncoder().encode('  9\n$ACADVER\n  1\nAC1024\n  1\nrétention\n');
    expect(texteDuDxf(recent)).toContain('rétention');
    const ancien = Uint8Array.from([...new TextEncoder().encode('  9\n$ACADVER\n  1\nAC1015\n  1\nr'), 0xe9, ...new TextEncoder().encode('tention\n')]);
    expect(texteDuDxf(ancien)).toContain('rétention');
  });
});
