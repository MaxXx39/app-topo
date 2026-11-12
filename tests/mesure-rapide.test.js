// Mesure rapide (0.158.0) : longueurs 2D / 3D, Δh, pente %, périmètres, surfaces 2D / 3D.
import { describe, it, expect } from 'vitest';
import { mesureRapide, valeursCote, surface2d, trianglesDuPolygone, anglesDeLaFigure } from '../src/topo/mesure-rapide.js';
import { arcAngle } from '../src/plan/mesure-rapide.js';
import { rangerMesureRapide, NOM_LEVE_MESURES_RAPIDES } from '../src/topo/mesure-rapide-levee.js';
import { pdfMesureRapide, dxfMesureRapide, lignesResume } from '../src/export/mesure-rapide.js';
import { creerProjet } from '../src/projet/projet.js';

const p = (est, nord, altitude = null) => ({ est, nord, altitude });

describe('un côté', () => {
  it('3-4-5 : 2D 5 m, Δh, pente, 3D', () => {
    const v = valeursCote(p(0, 0, 100), p(3, 4, 101));
    expect(v.longueur2d).toBeCloseTo(5, 9);
    expect(v.deltaH).toBeCloseTo(1, 9);
    expect(v.pente).toBeCloseTo(20, 9); // 1 ÷ 5 × 100
    expect(v.longueur3d).toBeCloseTo(Math.sqrt(26), 9);
  });
  it('pente négative quand ça descend', () => {
    expect(valeursCote(p(0, 0, 10), p(10, 0, 9)).pente).toBeCloseTo(-10, 9);
  });
  it('sans altitude : 3D, Δh et pente inconnus', () => {
    expect(valeursCote(p(0, 0), p(3, 4, 1))).toEqual({ longueur2d: 5, longueur3d: null, deltaH: null, pente: null });
  });
});

describe('mesure rapide', () => {
  it('1 point : aucun côté', () => {
    const m = mesureRapide([p(2500000, 1200000, 400)]);
    expect(m.cotes).toEqual([]);
    expect(m.ferme).toBeNull();
    expect(m.longueur2d).toBeNull();
  });
  it('2 points : un côté, pas de surface', () => {
    const m = mesureRapide([p(0, 0, 0), p(3, 4, 0)]);
    expect(m.cotes).toHaveLength(1);
    expect(m.cotes[0]).toMatchObject({ de: 1, a: 2 });
    expect(m.longueur2d).toBeCloseTo(5, 9);
    expect(m.ferme).toBeNull();
  });
  it('carré 10 m à plat : périmètre 40, surface 100 (2D = 3D)', () => {
    const m = mesureRapide([p(0, 0, 5), p(10, 0, 5), p(10, 10, 5), p(0, 10, 5)]);
    expect(m.cotes).toHaveLength(4);
    expect(m.cotes[3]).toMatchObject({ de: 4, a: 1 });
    expect(m.ferme.perimetre2d).toBeCloseTo(40, 9);
    expect(m.ferme.perimetre3d).toBeCloseTo(40, 9);
    expect(m.ferme.surface2d).toBeCloseTo(100, 9);
    expect(m.ferme.surface3d).toBeCloseTo(100, 9);
  });
  it('plan incliné à 100 % : surface 3D = 2D × √2', () => {
    // z = est : pente 100 % dans le sens Est.
    const m = mesureRapide([p(0, 0, 0), p(10, 0, 10), p(10, 10, 10), p(0, 10, 0)]);
    expect(m.ferme.surface2d).toBeCloseTo(100, 9);
    expect(m.ferme.surface3d).toBeCloseTo(100 * Math.SQRT2, 6);
    expect(m.ferme.perimetre3d).toBeCloseTo(20 + 20 * Math.SQRT2, 6);
  });
  it('forme en L (en creux) : surface juste, aussi dans l\'autre sens', () => {
    const l = [p(0, 0, 1), p(20, 0, 1), p(20, 10, 1), p(10, 10, 1), p(10, 20, 1), p(0, 20, 1)];
    expect(surface2d(l)).toBeCloseTo(300, 9);
    expect(mesureRapide(l).ferme.surface3d).toBeCloseTo(300, 6);
    expect(mesureRapide([...l].reverse()).ferme.surface3d).toBeCloseTo(300, 6);
    expect(trianglesDuPolygone(l)).toHaveLength(4);
  });
  it('un point sans altitude : surface 3D et périmètre 3D inconnus, 2D connus', () => {
    const m = mesureRapide([p(0, 0, 1), p(10, 0), p(10, 10, 1)]);
    expect(m.ferme.surface2d).toBeCloseTo(50, 9);
    expect(m.ferme.surface3d).toBeNull();
    expect(m.ferme.perimetre3d).toBeNull();
    expect(m.ferme.perimetre2d).toBeCloseTo(20 + 10 * Math.SQRT2, 9);
  });
});

describe('enregistrer et exporter', () => {
  const triangle = [{ nom: 'A', ...p(2500000, 1200000, 400) }, p(2500010, 1200000, 401), p(2500010, 1200010, 402)];
  it('« Enregistrer » : levé libre LV-Mesures rapides, points MR-n-m, ligne fermée dès 3 points', () => {
    const projet = creerProjet();
    const r1 = rangerMesureRapide(projet, triangle);
    expect(r1.levee.nom).toBe(NOM_LEVE_MESURES_RAPIDES);
    expect(r1.levee.nature).toBe('autres');
    expect(r1.points.map((q) => q.nom)).toEqual(['MR-1-1', 'MR-1-2', 'MR-1-3']);
    expect(r1.levee.lignesRupture[0]).toMatchObject({ noms: ['MR-1-1', 'MR-1-2', 'MR-1-3'], fermee: true });
    const r2 = rangerMesureRapide(projet, [p(1, 2)]);
    expect(r2.levee).toBe(r1.levee); // même levé
    expect(r2.points[0]).toMatchObject({ nom: 'MR-2-1', altitude: null });
    expect(r1.levee.points).toEqual(['MR-2-1']); // un point seul = point isolé
    const leve = projet.leves.find((l) => l.id === r1.levee.leveId);
    expect(leve.points).toHaveLength(4);
    expect(rangerMesureRapide(projet, []).erreur).toBeTruthy();
  });
  it('résumé selon le nombre de points', () => {
    expect(lignesResume(mesureRapide(triangle.slice(0, 1))).map(([l]) => l)).toEqual(['Nom', 'Est', 'Nord', 'Altitude']);
    expect(lignesResume(mesureRapide(triangle.slice(0, 2))).map(([l]) => l)).toEqual(['Longueur 2D', 'Longueur 3D', 'Altitude 1', 'Altitude 2', 'Δh', 'Pente']);
    expect(lignesResume(mesureRapide(triangle)).map(([l]) => l)).toEqual(['Périmètre 2D', 'Périmètre 3D', 'Surface 2D', 'Surface 3D']);
    expect(lignesResume(mesureRapide(triangle.slice(0, 2)))[5][1]).toBe('10.00 %');
  });
  it('PDF et DXF fabriqués', async () => {
    const mesure = mesureRapide(triangle);
    const pdf = pdfMesureRapide({ mesure, titre: 'Essai', cartouche: { affaire: '10 203', date: '08.11.2026' } });
    expect(pdf.size).toBeGreaterThan(1000);
    const dxf = dxfMesureRapide(mesure);
    expect(dxf).toContain('MESURE_LIGNES');
    expect(dxf.match(/\r\nPOINT\r\n/g)).toHaveLength(3);
    expect(dxf).toContain('Surface 2D : 50.000 m2');
    expect(dxf).not.toMatch(/[^\x00-\x7f]/); // R12 : texte sans accent ni Δ
  });
});

describe('ligne ouverte (0.186.0)', () => {
  const pts = [p(0, 0, 0), p(10, 0, 1), p(10, 10, 2), p(0, 10, 3)];
  it('ouverte : 3 côtés, pas de fermeture ni de surface', () => {
    const m = mesureRapide(pts, { fermee: false });
    expect(m.cotes).toHaveLength(3);
    expect(m.ferme).toBeNull();
    expect(m.longueur2d).toBeCloseTo(30, 9);
    expect(lignesResume(m).map((l) => l[0])).toEqual(['Longueur 2D', 'Longueur 3D']);
  });
  it('fermée (défaut) : 4 côtés et surface', () => {
    const m = mesureRapide(pts);
    expect(m.cotes).toHaveLength(4);
    expect(m.ferme.surface2d).toBeCloseTo(100, 9);
  });
  it('enregistrée : ligne non fermée si la case est décochée', () => {
    const projet = creerProjet('t');
    const r = rangerMesureRapide(projet, pts, new Set(), { fermee: false });
    expect(r.levee.lignesRupture[0].fermee).toBe(false);
  });
});

describe('angles (0.214.0, degrés décimaux)', () => {
  const p = (est, nord) => ({ est, nord });
  const carreAntiHoraire = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

  it('moins de 3 points : pas d\'angle', () => {
    expect(anglesDeLaFigure([p(0, 0), p(1, 1)])).toEqual([null, null]);
    expect(mesureRapide([p(0, 0)]).angles).toEqual([null]);
  });

  it('carré fermé : 90° à chaque sommet, dans les deux sens de parcours', () => {
    for (const points of [carreAntiHoraire, [...carreAntiHoraire].reverse()]) {
      for (const a of anglesDeLaFigure(points, true)) expect(a).toBeCloseTo(90, 9);
    }
  });

  it('triangle fermé : la somme vaut 180°', () => {
    const angles = anglesDeLaFigure([p(0, 0), p(4, 0), p(0, 3)], true);
    expect(angles.reduce((t, a) => t + a, 0)).toBeCloseTo(180, 9);
    expect(angles[1]).toBeCloseTo(36.8699, 3);
  });

  it('figure en L : le coin rentrant fait 270° et la somme vaut (n − 2) × 180°', () => {
    const l = [p(0, 0), p(6, 0), p(6, 2), p(2, 2), p(2, 6), p(0, 6)];
    const angles = anglesDeLaFigure(l, true);
    expect(angles[3]).toBeCloseTo(270, 9);
    expect(angles.reduce((t, a) => t + a, 0)).toBeCloseTo(4 * 180, 9);
    expect(anglesDeLaFigure([...l].reverse(), true).reduce((t, a) => t + a, 0)).toBeCloseTo(4 * 180, 9);
  });

  it('ligne ouverte : angle seulement aux points du milieu, entre 0 et 180°', () => {
    const angles = anglesDeLaFigure([p(0, 0), p(10, 0), p(10, 10)], false);
    expect(angles[0]).toBeNull();
    expect(angles[2]).toBeNull();
    expect(angles[1]).toBeCloseTo(90, 9);
    // Tout droit : 180°.
    expect(anglesDeLaFigure([p(0, 0), p(5, 0), p(10, 0)], false)[1]).toBeCloseTo(180, 9);
  });

  it('points confondus : pas d\'angle (jamais inventé)', () => {
    expect(anglesDeLaFigure([p(0, 0), p(0, 0), p(5, 5)], false)[1]).toBeNull();
  });

  it('mesureRapide donne les angles selon figure fermée ou ligne ouverte', () => {
    expect(mesureRapide(carreAntiHoraire, { fermee: true }).angles).toHaveLength(4);
    expect(mesureRapide(carreAntiHoraire, { fermee: false }).angles[0]).toBeNull();
  });

  it('arc sur le plan : secteur et position du texte ; null si un côté est trop court', () => {
    const arc = arcAngle({ x: 100, y: 100 }, { x: 40, y: 100 }, { x: 100, y: 160 }, 90);
    expect(arc.chemin.startsWith('M100.0 100.0L')).toBe(true);
    expect(arc.chemin).toContain('A20.0 20.0 0 0');
    expect(arcAngle({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 50 }, 90)).toBeNull();
    // Coin rentrant : grand arc.
    expect(arcAngle({ x: 100, y: 100 }, { x: 40, y: 100 }, { x: 100, y: 160 }, 270).chemin).toContain('0 1 ');
  });
});
