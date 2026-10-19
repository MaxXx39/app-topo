// Tests des exports (CSV, échelle du plan imprimé).
import { describe, it, expect } from 'vitest';
import { genererCsv } from '../src/export/csv.js';
import { choisirEchelle, barreEchellePapier } from '../src/export/echelle.js';

describe('genererCsv', () => {
  const stocks = [{ nom: 'Stock 1' }, { nom: 'Stock; 2' }, { nom: 'Incomplet' }];
  const resultats = [
    { mode: 'A', surfacePlan: 758.6381, remblai: 1636.1966, deblai: 0 },
    { mode: 'B', surfacePlan: 436.969, remblai: 0, deblai: 1006.2471 },
    { erreurs: ['contour trop court'] },
  ];
  const lignes = genererCsv(stocks, resultats).trim().split('\r\n');

  it('écrit l\'en-tête et une ligne par stock calculé', () => {
    expect(lignes).toEqual([
      'Stock;Mode;Surface (m²);Remblai (m³);Déblai (m³)',
      'Stock 1;A;758.638;1636.197;0.000',
      '"Stock; 2";B;436.969;0.000;1006.247',
    ]);
  });
});

describe('choisirEchelle', () => {
  it('prend l\'échelle la plus détaillée qui tient sur la feuille', () => {
    // 90 m × 110 m sur 180 mm × 180 mm : 1:500 donne 180 × 220 mm (trop haut), 1:1000 donne 90 × 110 mm.
    expect(choisirEchelle(90, 110, 180, 180)).toBe(1000);
    // 30 m × 20 m : 1:200 donne 150 × 100 mm.
    expect(choisirEchelle(30, 20, 180, 180)).toBe(200);
  });
});

describe('barreEchellePapier', () => {
  it('choisit une longueur ronde', () => {
    expect(barreEchellePapier(500, 50)).toEqual({ metres: 20, mm: 40 }); // 50 mm = 25 m -> 20 m
    expect(barreEchellePapier(1000, 50)).toEqual({ metres: 50, mm: 50 });
  });
});

describe('creerPdf - levé du 20/05/2026', async () => {
  const { readFileSync } = await import('node:fs');
  const { lirePoints } = await import('../src/topo/import-points.js');
  const { creerStock, lireListeDeNoms } = await import('../src/topo/stocks.js');
  const { calculerVolumeStock } = await import('../src/topo/volume.js');
  const { creerPdf } = await import('../src/export/pdf.js');

  const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
  const noms = points.map((p) => p.nom);
  const stocks = [
    ['Stock 1', 'b1 à b17', 'h1 à h31'],
    ['Stock 2', 'b100 à b116', 'h100 à h114'],
    ['Stock 3', 'b200 à b217', 'h200 à h216'],
  ].map(([nom, contour, ligne]) => {
    const stock = creerStock(nom);
    stock.contour = lireListeDeNoms(contour, noms).noms;
    stock.lignesRupture = [{ noms: lireListeDeNoms(ligne, noms).noms, fermee: true }];
    return stock;
  });
  const resultats = stocks.map((stock) => calculerVolumeStock(stock, points));
  const cartouche = { affaire: '10 203', date: '20.05.2026', dessinePar: 'MGO', fichierPoints: 'stock.csv' };
  const { document, echelle } = creerPdf({ stocks, resultats, points, cartouche });
  const contenu = document.output();

  it('choisit 1:1000 pour les 3 stocks (59 m × 91 m : 182 mm de haut à 1:500, trop pour le cadre)', () => {
    expect(echelle).toBe(1000);
    expect(contenu).toContain('1:1000');
  });

  it('utilise l\'échelle imposée par l\'utilisateur', () => {
    const impose = creerPdf({ stocks, resultats, points, cartouche, echelleImposee: 500 });
    expect(impose.echelle).toBe(500);
    expect(impose.document.output()).toContain('1:500');
  });

  it('écrit les volumes et le cartouche', () => {
    expect(contenu).toContain('1636.197');
    expect(contenu).toContain('648.979');
    expect(contenu).toContain('372.201');
    expect(contenu).toContain('10 203');
    expect(contenu).toContain('MGO');
  });

  it('fait une seule page A4 paysage', () => {
    expect(document.getNumberOfPages()).toBe(1);
    expect(Math.round(document.internal.pageSize.getWidth())).toBe(297);
  });
});
