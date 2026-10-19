// Tests des couleurs remblai / déblai par paliers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { zonesRemblaiDeblai, choisirPalier, ecartsExtremes } from '../src/plan/ecarts.js';
import { calculerVolumeStock, volumeEntreSurfaces } from '../src/topo/volume.js';
import { creerStock } from '../src/topo/stocks.js';
import { lirePoints } from '../src/topo/import-points.js';
import { lireListeDeNoms } from '../src/topo/stocks.js';

const pt = (nom, est, nord, altitude) => ({ nom, est, nord, altitude });
/** Aire d'un polygone { est, nord } (m²), calculée autour du premier sommet (précision en MN95). */
const aire = (polygone) => {
  const o = polygone[0];
  let somme = 0;
  for (let i = 0; i < polygone.length; i++) {
    const a = polygone[i];
    const b = polygone[(i + 1) % polygone.length];
    somme += (a.est - o.est) * (b.nord - o.nord) - (b.est - o.est) * (a.nord - o.nord);
  }
  return Math.abs(somme) / 2;
};

describe('triangles d\'écart du calcul de volume', () => {
  // Pyramide : base carrée 10 m × 10 m à 0 m, sommet à 3 m.
  const points = [pt('b1', 0, 0, 0), pt('b2', 10, 0, 0), pt('b3', 10, 10, 0), pt('b4', 0, 10, 0), pt('h', 5, 5, 3)];
  const stock = creerStock('Pyramide');
  stock.contour = ['b1', 'b2', 'b3', 'b4'];
  stock.pointsDessus = ['h'];
  const resultat = calculerVolumeStock(stock, points);

  it('couvrent toute la surface en plan, avec l\'écart dessus - base comme hauteur', () => {
    const aireTotale = resultat.trianglesEcart.reduce((somme, t) => somme + aire(t), 0);
    expect(aireTotale).toBeCloseTo(100, 6);
    expect(ecartsExtremes(resultat.trianglesEcart)).toEqual({ remblai: 3, deblai: 0 });
  });

  it('sont négatifs là où le dessus est sous la base (déblai)', () => {
    const dessus = [[pt('a', 0, 0, 5), pt('b', 10, 0, 5), pt('c', 0, 10, 5)]];
    const base = [[pt('a', 0, 0, 7), pt('b', 10, 0, 7), pt('c', 0, 10, 7)]];
    const { trianglesEcart } = volumeEntreSurfaces(dessus, base);
    expect(ecartsExtremes(trianglesEcart)).toEqual({ remblai: 0, deblai: 2 });
  });
});

describe('zones remblai / déblai par paliers', () => {
  // Plan incliné de -1 m à +2 m sur 30 m : déblai jusqu'à 1 m, remblai jusqu'à 2 m.
  const triangles = [
    [pt('a', 0, 0, -1), pt('b', 30, 0, 2), pt('c', 30, 10, 2)],
    [pt('a', 0, 0, -1), pt('c', 30, 10, 2), pt('d', 0, 10, -1)],
  ];

  it('palier automatique : au plus 6 classes de chaque côté', () => {
    expect(choisirPalier(triangles)).toBe(0.5);
    expect(choisirPalier(triangles, '0.25')).toBe(0.25);
  });

  it('les zones couvrent toute la surface, sans manque ni double compte', () => {
    const { zones } = zonesRemblaiDeblai(triangles, '0.5');
    const total = zones.reduce((somme, z) => somme + aire(z.polygone), 0);
    expect(total).toBeCloseTo(300, 6);
  });

  it('légende : 4 classes de remblai et 2 de déblai, du plus clair au plus foncé', () => {
    const { legende } = zonesRemblaiDeblai(triangles, '0.5');
    expect(legende.remblai.map((c) => [c.de, c.a])).toEqual([[0, 0.5], [0.5, 1], [1, 1.5], [1.5, 2]]);
    expect(legende.deblai.map((c) => [c.de, c.a])).toEqual([[0, 0.5], [0.5, 1]]);
    // Rouge pour le remblai (plus de rouge que de bleu), le plus fort est le plus foncé.
    const [premier, dernier] = [legende.remblai[0].couleur, legende.remblai.at(-1).couleur];
    expect(premier[0]).toBeGreaterThan(premier[2]);
    expect(dernier.reduce((a, b) => a + b)).toBeLessThan(premier.reduce((a, b) => a + b));
    // Jaune pour le déblai (rouge et vert forts, peu de bleu).
    const jaune = legende.deblai[0].couleur;
    expect(jaune[2]).toBeLessThan(jaune[1]);
  });

  it('chaque zone prend la couleur de son palier', () => {
    const { zones, legende } = zonesRemblaiDeblai(triangles, '0.5');
    const couleurs = new Set(zones.map((z) => z.couleur.join()));
    const attendues = new Set([...legende.remblai, ...legende.deblai].map((c) => c.couleur.join()));
    expect(couleurs).toEqual(attendues);
  });

  it('cas de référence Stock 1 : remblai seulement (base = points du pied)', () => {
    const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
    const noms = points.map((p) => p.nom);
    const stock = creerStock('Stock 1');
    stock.contour = lireListeDeNoms('b1 à b17', noms).noms;
    stock.lignesRupture = [{ noms: lireListeDeNoms('h1 à h31', noms).noms, fermee: true }];
    const resultat = calculerVolumeStock(stock, points);
    const { zones, legende } = zonesRemblaiDeblai(resultat.trianglesEcart);
    expect(legende.deblai).toEqual([]);
    expect(zones.reduce((somme, z) => somme + aire(z.polygone), 0)).toBeCloseTo(resultat.surfacePlan, 3);
  });
});
