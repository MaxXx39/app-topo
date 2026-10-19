// Tests du calcul de volume.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';
import { creerStock, lireListeDeNoms } from '../src/topo/stocks.js';
import { calculerVolumeStock, ajouterPrisme } from '../src/topo/volume.js';
import { lireLandXML } from '../src/topo/landxml.js';

/** Fabrique un point { nom, est, nord, altitude }. */
const pt = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });

describe('cas de référence : levé du 20/05/2026 comparé à Mensura (tolérance 0,5 %)', () => {
  const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
  const noms = points.map((p) => p.nom);

  const cas = [
    { nom: 'Stock 1', contour: 'b1 à b17', ligne: 'h1 à h31', mensura: 1636.197, tolerance: 8.2 },
    { nom: 'Stock 2', contour: 'b100 à b116', ligne: 'h100 à h114', mensura: 648.979, tolerance: 3.2 },
    { nom: 'Stock 3', contour: 'b200 à b217', ligne: 'h200 à h216', mensura: 372.201, tolerance: 1.9 },
  ];

  for (const { nom, contour, ligne, mensura, tolerance } of cas) {
    it(`${nom} : remblai ${mensura} m³ ± ${tolerance} m³`, () => {
      const stock = creerStock(nom);
      stock.contour = lireListeDeNoms(contour, noms).noms;
      stock.lignesRupture = [{ noms: lireListeDeNoms(ligne, noms).noms, fermee: true }];
      const resultat = calculerVolumeStock(stock, points);

      expect(resultat.erreurs).toBeUndefined();
      expect(Math.abs(resultat.remblai - mensura)).toBeLessThanOrEqual(tolerance);
      expect(resultat.surfaceNonCouverte).toBe(0);
      // La surface calculée par les triangles doit être celle du contour.
      expect(resultat.surfacePlan).toBeCloseTo(resultat.surfaceContour, 6);
    });
  }
});

describe('volumes connus, vérifiables à la main', () => {
  it('pyramide : base carrée 10 m × 10 m, sommet à 3 m -> 100 m³', () => {
    const points = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0), pt('h', 5, 5, 3)];
    const stock = creerStock('Pyramide');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h'];
    const resultat = calculerVolumeStock(stock, points);
    expect(resultat.remblai).toBeCloseTo(100, 9); // 10 × 10 × 3 / 3
    expect(resultat.deblai).toBe(0);
    expect(resultat.surfacePlan).toBeCloseTo(100, 9);
    expect(resultat.nombreTrianglesDessus).toBe(4);
  });

  it('base inclinée : le volume se mesure depuis la base, pas depuis l\'altitude 0', () => {
    // Base qui monte de 0 à 2 m vers l'Est ; plateau à 5 m au-dessus de la base au centre.
    const points = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 2), pt('b3', 10, 10, 2), pt('b4', 0, 10, 0), pt('h', 5, 5, 6)];
    const stock = creerStock('Incliné');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h'];
    // Base à 1 m au centre : pyramide de 5 m de haut -> 10 × 10 × 5 / 3
    expect(calculerVolumeStock(stock, points).remblai).toBeCloseTo(500 / 3, 9);
  });

  it('stock en « L » : le creux du L n\'est pas compté', () => {
    // L de 3 carrés de 10 m × 10 m (300 m²), dessus plat à 2 m, base à 0 m.
    const contour = [
      pt('b1', 0, 0, 0), pt('b2', 20, 0, 0), pt('b3', 20, 10, 0),
      pt('b4', 10, 10, 0), pt('b5', 10, 20, 0), pt('b6', 0, 20, 0),
    ];
    const dessus = [pt('h1', 2, 2, 2), pt('h2', 18, 2, 2), pt('h3', 18, 8, 2), pt('h4', 8, 8, 2), pt('h5', 8, 18, 2), pt('h6', 2, 18, 2)];
    const stock = creerStock('L');
    stock.contour = contour.map((p) => p.nom);
    stock.lignesRupture = [{ noms: dessus.map((p) => p.nom), fermee: true }];
    const resultat = calculerVolumeStock(stock, [...contour, ...dessus]);
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

  it('remblai et déblai avec une base mesurée à part', () => {
    // Dessus : pyramide de 3 m sur un carré de 10 m (100 m³ au-dessus de 0).
    // Base : plan horizontal à 1 m, mesuré par 4 points autour du stock (100 m³ sous le dessus).
    // Le dessus passe sous la base près des bords : remblai - déblai = 100 - 100 = 0.
    const points = [
      pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0), pt('h', 5, 5, 3),
      pt('p1', -5, -5, 1), pt('p2', 15, -5, 1), pt('p3', 15, 15, 1), pt('p4', -5, 15, 1),
    ];
    const stock = creerStock('Base à part');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h'];
    stock.baseEgaleContour = false;
    stock.base = ['p1', 'p2', 'p3', 'p4'];
    const resultat = calculerVolumeStock(stock, points);
    expect(resultat.remblai).toBeGreaterThan(0);
    expect(resultat.deblai).toBeGreaterThan(0);
    expect(resultat.remblai - resultat.deblai).toBeCloseTo(0, 9);
    expect(resultat.surfaceRemblai + resultat.surfaceDeblai).toBeCloseTo(100, 9);
    expect(resultat.surfaceNonCouverte).toBe(0);
  });

  it('signale la surface non couverte par la base', () => {
    // Base qui ne couvre que la moitié Ouest du carré (50 m² non couverts).
    const points = [
      pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0), pt('h', 5, 5, 3),
      pt('p1', -1, -1, 0), pt('p2', 5, -1, 0), pt('p3', 5, 11, 0), pt('p4', -1, 11, 0),
    ];
    const stock = creerStock('Base partielle');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h'];
    stock.baseEgaleContour = false;
    stock.base = ['p1', 'p2', 'p3', 'p4'];
    expect(calculerVolumeStock(stock, points).surfaceNonCouverte).toBeCloseTo(50, 9);
  });
});

describe('messages d\'erreur', () => {
  const carre = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0)];

  it('signale une ligne de rupture qui croise le contour', () => {
    const points = [...carre, pt('h1', 5, 5, 2), pt('h2', 15, 5, 2)];
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.lignesRupture = [{ noms: ['h1', 'h2'], fermee: false }];
    const resultat = calculerVolumeStock(stock, points);
    expect(resultat.erreurs[0]).toContain('se croisent');
    // Les deux segments fautifs sont rendus pour être dessinés en rouge sur le plan.
    expect(resultat.segmentsEnErreur).toHaveLength(2);
    expect(resultat.segmentsEnErreur.flat()).toContain('h2');
  });

  it('signale un contour dans le désordre (qui se croise lui-même)', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b3', 'b2', 'b4'];
    expect(calculerVolumeStock(stock, carre).erreurs[0]).toContain('se croisent');
  });

  it('signale deux points à la même position', () => {
    const points = [...carre, pt('h1', 10, 10, 3)];
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h1'];
    expect(calculerVolumeStock(stock, points).erreurs[0]).toContain('même position');
  });

  it('signale un point absent du fichier', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'zz'];
    expect(calculerVolumeStock(stock, carre).erreurs[0]).toContain('zz');
  });
});

describe('mode B : base LandXML (fichier 20260520_Stock.xml, plan horizontal à 431.000 m)', () => {
  const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
  const noms = points.map((p) => p.nom);
  const [surface] = lireLandXML(readFileSync(new URL('../exemples/20260520_Stock.xml', import.meta.url), 'utf-8')).surfaces;

  const cas = [
    ['Stock 1', 'b1 à b17', 'h1 à h31'],
    ['Stock 2', 'b100 à b116', 'h100 à h114'],
    ['Stock 3', 'b200 à b217', 'h200 à h216'],
  ];

  for (const [nom, contour, ligne] of cas) {
    it(`${nom} : remblai - déblai = volume sous le dessus - 431 m × surface`, () => {
      const stock = creerStock(nom);
      stock.contour = lireListeDeNoms(contour, noms).noms;
      stock.lignesRupture = [{ noms: lireListeDeNoms(ligne, noms).noms, fermee: true }];
      stock.modeBase = 'landxml';
      const resultat = calculerVolumeStock(stock, points, surface);

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

  it('signale la surface non couverte quand le LandXML ne recouvre qu\'une partie du stock', () => {
    // Surface LandXML qui ne couvre que la moitié Ouest d'un carré de 10 m (50 m² non couverts).
    const p = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });
    const carre = [p('b1', 0, 0, 0), p('b2', 10, 0, 0), p('b3', 10, 10, 0), p('b4', 0, 10, 0), p('h', 5, 5, 3)];
    const demi = { nom: 'Demi', triangles: [[p('1', -1, -1, 0), p('2', 5, -1, 0), p('3', 5, 11, 0)], [p('1', -1, -1, 0), p('3', 5, 11, 0), p('4', -1, 11, 0)]] };
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b3', 'b4'];
    stock.pointsDessus = ['h'];
    stock.modeBase = 'landxml';
    expect(calculerVolumeStock(stock, carre, demi).surfaceNonCouverte).toBeCloseTo(50, 9);
  });

  it('demande une surface LandXML en mode B', () => {
    const stock = creerStock('Essai');
    stock.contour = ['b1', 'b2', 'b3'];
    stock.modeBase = 'landxml';
    expect(calculerVolumeStock(stock, points, null).erreurs[0]).toContain('LandXML');
  });
});
