// Tests du calcul de volume.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ajouterPrisme, calculerVolumeSurface } from '../src/topo/volume.js';
import { lireListeDeNoms } from '../src/topo/noms.js';
import { calculerSurface } from '../src/topo/surface.js';
import { lireLandXML } from '../src/topo/landxml.js';
import { pt, surfaceDe, volumeDe, pointsDeReference, STOCKS_REFERENCE, volumeDeReference } from './outils.js';

describe('cas de référence : levé du 20/05/2026 comparé à Mensura (tolérance 0,5 %)', () => {
  // Surface créée comme dans l'appli : contour, ligne de rupture fermée, tous les points du levé,
  // volume sur les points du contour (base A).
  const points = pointsDeReference();

  for (const stock of STOCKS_REFERENCE) {
    it(`${stock.nom} : remblai ${stock.mensura} m³ ± ${stock.tolerance} m³`, () => {
      const resultat = volumeDeReference(stock, points);

      expect(resultat.erreurs).toBeUndefined();
      expect(Math.abs(resultat.remblai - stock.mensura)).toBeLessThanOrEqual(stock.tolerance);
      expect(resultat.surfaceNonCouverte).toBe(0);
      // La surface calculée par les triangles doit être celle du contour.
      expect(resultat.surfacePlan).toBeCloseTo(resultat.surfaceContour, 6);
    });
  }
});

describe('volumes connus, vérifiables à la main', () => {
  const carre = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0)];

  it('pyramide : base carrée 10 m × 10 m, sommet à 3 m -> 100 m³', () => {
    const points = [...carre, pt('h', 5, 5, 3)];
    const resultat = volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'], points: ['h'] }, points);
    expect(resultat.remblai).toBeCloseTo(100, 9); // 10 × 10 × 3 / 3
    expect(resultat.deblai).toBe(0);
    expect(resultat.surfacePlan).toBeCloseTo(100, 9);
    expect(resultat.nombreTrianglesDessus).toBe(4);
    expect(resultat.mode).toBe('A');
  });

  it('« tous les points du levé » ne garde que ceux dans le contour', () => {
    // Un point loin du contour ne change rien au volume de la pyramide.
    const points = [...carre, pt('h', 5, 5, 3), pt('loin', 50, 50, 20)];
    expect(volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'] }, points).remblai).toBeCloseTo(100, 9);
  });

  it('base inclinée : le volume se mesure depuis la base, pas depuis l\'altitude 0', () => {
    // Base qui monte de 0 à 2 m vers l'Est ; plateau à 5 m au-dessus de la base au centre.
    const points = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 2), pt('b3', 10, 10, 2), pt('b4', 0, 10, 0), pt('h', 5, 5, 6)];
    // Base à 1 m au centre : pyramide de 5 m de haut -> 10 × 10 × 5 / 3
    expect(volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'], points: ['h'] }, points).remblai).toBeCloseTo(500 / 3, 9);
  });

  it('forme en « L » : le creux du L n\'est pas compté', () => {
    // L de 3 carrés de 10 m × 10 m (300 m²), dessus plat à 2 m, base à 0 m.
    const contour = [
      pt('b1', 0, 0, 0), pt('b2', 20, 0, 0), pt('b3', 20, 10, 0),
      pt('b4', 10, 10, 0), pt('b5', 10, 20, 0), pt('b6', 0, 20, 0),
    ];
    const dessus = [pt('h1', 2, 2, 2), pt('h2', 18, 2, 2), pt('h3', 18, 8, 2), pt('h4', 8, 8, 2), pt('h5', 8, 18, 2), pt('h6', 2, 18, 2)];
    const resultat = volumeDe(
      { contour: contour.map((p) => p.nom), lignes: [{ noms: dessus.map((p) => p.nom), fermee: true }] },
      [...contour, ...dessus],
    );
    expect(resultat.surfacePlan).toBeCloseTo(300, 9);
    expect(resultat.surfaceContour).toBeCloseTo(300, 9);
    expect(resultat.surfaceNonCouverte).toBe(0);
    expect(resultat.deblai).toBe(0);
    // Le volume doit rester sous 300 m² × 2 m (aucun triangle dans le creux du L).
    expect(resultat.remblai).toBeGreaterThan(0);
    expect(resultat.remblai).toBeLessThan(600);
  });

  it('coupe exactement un triangle où l\'écart change de signe', () => {
    const resultat = { remblai: 0, deblai: 0, surfaceRemblai: 0, surfaceDeblai: 0 };
    // Triangle de 50 m², écarts +1, -1, -1 : la pointe positive fait 1/4 de l'aire.
    ajouterPrisme(resultat, 50, 1, -1, -1);
    expect(resultat.surfaceRemblai).toBeCloseTo(12.5, 9);
    expect(resultat.remblai).toBeCloseTo(12.5 / 3, 9);
    expect(resultat.surfaceDeblai).toBeCloseTo(37.5, 9);
    expect(resultat.remblai - resultat.deblai).toBeCloseTo(-50 / 3, 9); // 50 × (1 - 1 - 1) / 3
  });

  it('remblai et déblai avec une base B : surface « Pied » mesurée à part', () => {
    // Dessus : pyramide de 3 m sur un carré de 10 m (100 m³ au-dessus de 0).
    // Base : surface créée avec 4 points à 1 m autour du stock (100 m³ sous le dessus).
    // Le dessus passe sous la base près des bords : remblai - déblai = 100 - 100 = 0.
    const points = [...carre, pt('h', 5, 5, 3), pt('p1', -5, -5, 1), pt('p2', 15, -5, 1), pt('p3', 15, 15, 1), pt('p4', -5, 15, 1)];
    const pied = { nom: 'Pied', triangles: calculerSurface(surfaceDe({ points: ['p1', 'p2', 'p3', 'p4'] }), points).triangles };
    const resultat = volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'], points: ['h'] }, points, pied);
    expect(resultat.mode).toBe('B');
    expect(resultat.nomBase).toBe('Pied');
    expect(resultat.remblai).toBeGreaterThan(0);
    expect(resultat.deblai).toBeGreaterThan(0);
    expect(resultat.remblai - resultat.deblai).toBeCloseTo(0, 9);
    expect(resultat.surfaceRemblai + resultat.surfaceDeblai).toBeCloseTo(100, 9);
    expect(resultat.surfaceNonCouverte).toBe(0);
  });

  it('signale la surface non couverte par la base', () => {
    // Base qui ne couvre que la moitié Ouest du carré (50 m² non couverts).
    const points = [...carre, pt('h', 5, 5, 3), pt('p1', -1, -1, 0), pt('p2', 5, -1, 0), pt('p3', 5, 11, 0), pt('p4', -1, 11, 0)];
    const demi = { nom: 'Demi', triangles: calculerSurface(surfaceDe({ points: ['p1', 'p2', 'p3', 'p4'] }), points).triangles };
    expect(volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'], points: ['h'] }, points, demi).surfaceNonCouverte).toBeCloseTo(50, 9);
  });
});

describe('messages d\'erreur', () => {
  const carre = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0)];

  it('signale une ligne de rupture qui croise le contour', () => {
    const points = [...carre, pt('h1', 5, 5, 2), pt('h2', 15, 5, 2)];
    const resultat = volumeDe({ contour: ['b1', 'b2', 'b3', 'b4'], lignes: [{ noms: ['h1', 'h2'], fermee: false }], points: [] }, points);
    expect(resultat.erreurs[0]).toContain('se croisent');
    // Les deux segments fautifs sont rendus pour être dessinés en rouge sur le plan.
    expect(resultat.segmentsEnErreur).toHaveLength(2);
    expect(resultat.segmentsEnErreur.flat()).toContain('h2');
  });

  it('signale un contour dans le désordre (qui se croise lui-même)', () => {
    expect(volumeDe({ contour: ['b1', 'b3', 'b2', 'b4'], points: [] }, carre).erreurs[0]).toContain('se croisent');
  });

  it('signale un point absent du levé', () => {
    expect(volumeDe({ contour: ['b1', 'b2', 'zz'], points: [] }, carre).erreurs[0]).toContain('zz');
  });

  it('base A : demande un contour', () => {
    const points = [...carre, pt('h', 5, 5, 3)];
    expect(volumeDe({ points: ['b1', 'b2', 'b3', 'b4', 'h'] }, points).erreurs[0]).toContain('contour');
  });

  it('pas de volume si la base est « aucune »', () => {
    const surface = surfaceDe({ contour: ['b1', 'b2', 'b3', 'b4'], base: 'aucune' });
    expect(calculerVolumeSurface(surface, calculerSurface(surface, carre), carre)).toBeNull();
  });
});

describe('base B : surface LandXML (fichier 20260520_Stock.xml, plan horizontal à 431.000 m)', () => {
  const points = pointsDeReference();
  const noms = points.map((p) => p.nom);
  const [lue] = lireLandXML(readFileSync(new URL('../exemples/20260520_Stock.xml', import.meta.url), 'utf-8')).surfaces;
  const plan431 = { nom: lue.nom, triangles: lue.triangles };

  for (const { nom, contour, ligne } of STOCKS_REFERENCE) {
    it(`${nom} : remblai - déblai = volume sous le dessus - 431 m × surface`, () => {
      const resultat = volumeDe(
        { contour: lireListeDeNoms(contour, noms).noms, lignes: [{ noms: lireListeDeNoms(ligne, noms).noms, fermee: true }] },
        points,
        plan431,
      );

      expect(resultat.erreurs).toBeUndefined();
      expect(resultat.mode).toBe('B');
      expect(resultat.nombreTrianglesBase).toBe(2);
      expect(resultat.surfaceNonCouverte).toBe(0);
      // Contrôle indépendant : volume entre le dessus et l'altitude 0, calculé
      // triangle par triangle (surface × altitude moyenne des 3 sommets).
      let volumeSousDessus = 0;
      for (const [a, b, c] of resultat.trianglesDessus) {
        const aire = Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
        volumeSousDessus += (aire * (a.altitude + b.altitude + c.altitude)) / 3;
      }
      expect(resultat.remblai - resultat.deblai).toBeCloseTo(volumeSousDessus - 431 * resultat.surfacePlan, 6);
      // Le dessus des stocks est presque partout sous 431 m : surtout du déblai.
      expect(resultat.deblai).toBeGreaterThan(resultat.remblai);
    });
  }

  it('demande la surface de base quand elle manque', () => {
    const carre = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0)];
    const surface = surfaceDe({ contour: ['b1', 'b2', 'b3'], base: 'surface' });
    expect(calculerVolumeSurface(surface, calculerSurface(surface, carre), carre, null).erreurs[0]).toContain('choisis la surface de base');
  });
});
