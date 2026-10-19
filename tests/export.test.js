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
  const { document, echelle } = await creerPdf({ stocks, resultats, points, cartouche });
  const contenu = document.output();

  it('choisit 1:1000 pour les 3 stocks (59 m × 91 m : 182 mm de haut à 1:500, trop pour le cadre)', () => {
    expect(echelle).toBe(1000);
    expect(contenu).toContain('1:1000');
  });

  it('utilise l\'échelle imposée par l\'utilisateur', async () => {
    const impose = await creerPdf({ stocks, resultats, points, cartouche, echelleImposee: 500 });
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

describe('genererCsv - comparaisons', () => {
  it('ajoute les comparaisons après une ligne vide', () => {
    const texte = genererCsv([], [], [{ nom: 'Mai → juin', resultat: { surfacePlan: 400, remblai: 200, deblai: 12.3456 } }]);
    expect(texte.trim().split('\r\n')).toEqual([
      'Stock;Mode;Surface (m²);Remblai (m³);Déblai (m³)',
      '',
      'Comparaison;Surface (m²);Ajouté (m³);Enlevé (m³)',
      'Mai → juin;400.000;200.000;12.346',
    ]);
  });
});

describe('creerPdf - calques', async () => {
  const { readFileSync } = await import('node:fs');
  const { lirePoints } = await import('../src/topo/import-points.js');
  const { creerStock, lireListeDeNoms } = await import('../src/topo/stocks.js');
  const { calculerVolumeStock } = await import('../src/topo/volume.js');
  const { creerPdf } = await import('../src/export/pdf.js');
  const { points } = lirePoints(readFileSync(new URL('../exemples/stock_export.txt', import.meta.url), 'utf-8'));
  const noms = points.map((p) => p.nom);
  const stock = creerStock('Stock 2');
  stock.contour = lireListeDeNoms('b100 à b116', noms).noms;
  stock.lignesRupture = [{ noms: lireListeDeNoms('h100 à h114', noms).noms, fermee: true }];
  const resultats = [calculerVolumeStock(stock, points)];

  it('ajoute courbes et couleurs dans la légende, et les comparaisons', async () => {
    const { document } = await creerPdf({
      stocks: [stock],
      resultats,
      points,
      cartouche: {},
      calques: { courbes: true, couleurs: true, noms: false },
      comparaisons: [{ nom: 'Mai - juin', resultat: { remblai: 12.5, deblai: 3, surfacePlan: 100 } }],
    });
    const contenu = document.output();
    expect(contenu).toContain('Courbes de niveau');
    expect(contenu).toContain('Mai - juin');
    expect(contenu).toContain('12.500');
    expect(contenu).not.toContain('(b100)'); // noms des points décochés
  });

  it('colorie le remblai / déblai par défaut, avec sa légende par paliers', async () => {
    const { document } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {} });
    // (les lettres accentuées sont codées autrement dans le PDF : on cherche la fin du titre)
    expect(document.output()).toContain('en m, palier');
    const sans = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, calques: { ecarts: false } });
    expect(sans.document.output()).not.toContain('en m, palier');
  });

  it('ajoute une feuille par comparaison, avec ses volumes et sa légende', async () => {
    const { comparerSurfaces } = await import('../src/topo/comparaison.js');
    // « Avant » : plan horizontal à 425 m sous le stock ; « après » : le dessus du stock.
    const sommets = resultats[0].trianglesDessus.flat();
    const ests = sommets.map((p) => p.est);
    const nords = sommets.map((p) => p.nord);
    const [e0, e1, n0, n1] = [Math.min(...ests) - 1, Math.max(...ests) + 1, Math.min(...nords) - 1, Math.max(...nords) + 1];
    const plan = [
      [{ est: e0, nord: n0, altitude: 425 }, { est: e1, nord: n0, altitude: 425 }, { est: e1, nord: n1, altitude: 425 }],
      [{ est: e0, nord: n0, altitude: 425 }, { est: e1, nord: n1, altitude: 425 }, { est: e0, nord: n1, altitude: 425 }],
    ];
    const resultat = comparerSurfaces(plan, resultats[0].trianglesDessus);
    const { document } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, comparaisons: [{ nom: 'Avant / après', resultat }] });
    expect(document.getNumberOfPages()).toBe(2);
    const contenu = document.output();
    expect(contenu).toContain('Comparaison de surfaces');
    const { formaterNombre } = await import('../src/topo/format.js');
    expect(contenu).toContain(formaterNombre(resultat.remblai));
  });

  it('crée le PDF sans le fond quand la photo est impossible (pas de navigateur)', async () => {
    const { messageFond } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, calques: { photo: true } });
    expect(messageFond).toBeTruthy();
  });
});
