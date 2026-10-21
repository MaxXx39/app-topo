// Tests des exports (CSV, échelle du plan imprimé).
import { describe, it, expect } from 'vitest';
import { genererCsv } from '../src/export/csv.js';
import { choisirEchelle, barreEchellePapier, choisirFormat, miseEnPage } from '../src/export/echelle.js';
import { disposerPhotos } from '../src/export/pdf.js';
import { pointsDeReference, surfaceDeReference, volumeDeReference, STOCKS_REFERENCE } from './outils.js';

describe('genererCsv', () => {
  const volumes = [
    { nom: 'Stock 1', base: 'ligne basse', resultat: { surfacePlan: 758.6381, remblai: 1636.1966, deblai: 0 } },
    { nom: 'Stock; 2', base: 'TN', resultat: { surfacePlan: 436.969, remblai: 0, deblai: 1006.2471 } },
    { nom: 'Incomplet', base: '-', resultat: { erreurs: ['contour trop court'] } },
  ];
  const lignes = genererCsv(volumes).trim().split('\r\n');

  it('écrit l\'en-tête et une ligne par calcul réussi', () => {
    expect(lignes).toEqual([
      'Nom;Base;Surface (m²);Remblai (m³);Déblai (m³)',
      'Stock 1;ligne basse;758.638;1636.197;0.000',
      '"Stock; 2";TN;436.969;0.000;1006.247',
    ]);
  });
});

describe('disposerPhotos', () => {
  const zone = { x: 0, y: 0, largeur: 80, hauteur: 60 };
  it('une photo prend toute la largeur si elle tient en hauteur', () => {
    const [position] = disposerPhotos([{ largeur: 4000, hauteur: 2000 }], zone, 3, 2);
    expect(position.largeur).toBeCloseTo(80, 6);
    expect(position.hauteur).toBeCloseTo(40, 6);
  });

  it('deux photos en largeur : côte à côte, chacune dans sa moitié', () => {
    const cases = disposerPhotos([{ largeur: 4, hauteur: 3 }, { largeur: 4, hauteur: 3 }], { x: 0, y: 0, largeur: 80, hauteur: 30 }, 3, 2);
    expect(cases[0].y).toBe(cases[1].y);
    expect(cases[1].x).toBeGreaterThan(cases[0].x + cases[0].largeur);
  });

  it('renvoie null si les photos seraient trop petites', () => {
    expect(disposerPhotos(Array.from({ length: 30 }, () => ({ largeur: 4, hauteur: 3 })), zone)).toBeNull();
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

describe('choisirFormat', () => {
  it('garde l\'A4 en échelle automatique', () => {
    expect(choisirFormat(500, 500, null)).toEqual({ format: 'a4', depasse: false });
  });

  it('A4 si le plan y tient, sinon A3, sinon A3 avec avertissement', () => {
    // Place du dessin : A4 173 × 160 mm, A3 296 × 247 mm.
    expect(choisirFormat(59, 91, 1000)).toEqual({ format: 'a4', depasse: false }); // 59 × 91 mm
    expect(choisirFormat(59, 91, 500)).toEqual({ format: 'a3', depasse: false }); // 118 × 182 mm
    expect(choisirFormat(59, 91, 200)).toEqual({ format: 'a3', depasse: true }); // 295 × 455 mm
  });

  it('mise en page : même colonne de droite, plan plus grand en A3', () => {
    expect(miseEnPage('a4').cadrePlan).toEqual({ x: 10, y: 10, largeur: 193, hauteur: 190 });
    expect(miseEnPage('a4').colonne).toEqual({ x: 207, largeur: 80 });
    expect(miseEnPage('a3').cadrePlan).toEqual({ x: 10, y: 10, largeur: 316, hauteur: 277 });
  });
});

describe('barreEchellePapier', () => {
  it('choisit une longueur ronde', () => {
    expect(barreEchellePapier(500, 50)).toEqual({ metres: 20, mm: 40 }); // 50 mm = 25 m -> 20 m
    expect(barreEchellePapier(1000, 50)).toEqual({ metres: 50, mm: 50 });
  });
});

describe('creerPdf - levé du 20/05/2026', async () => {
  const { creerPdf } = await import('../src/export/pdf.js');
  const points = pointsDeReference();
  const stocks = STOCKS_REFERENCE.map((stock) => surfaceDeReference(stock, points));
  const resultats = STOCKS_REFERENCE.map((stock) => volumeDeReference(stock, points));
  const cartouche = { affaire: '10 203', date: '20.05.2026', dessinePar: 'MGO', fichierPoints: 'stock.csv' };
  const { document, echelle } = await creerPdf({ stocks, resultats, points, cartouche });
  const contenu = document.output();

  it('choisit 1:1000 pour les 3 stocks (59 m × 91 m : 182 mm de haut à 1:500, trop pour le cadre)', () => {
    expect(echelle).toBe(1000);
    expect(contenu).toContain('1:1000');
  });

  it('met le logo Perrin dans le cartouche (une image dans le PDF)', () => {
    expect(contenu).toContain('/Subtype /Image');
  });

  it('utilise l\'échelle imposée : à 1:500 le plan ne tient pas en A4, la feuille passe en A3', async () => {
    const impose = await creerPdf({ stocks, resultats, points, cartouche, echelleImposee: 500 });
    expect(impose.echelle).toBe(500);
    expect(impose.format).toBe('a3');
    expect(Math.round(impose.document.internal.pageSize.getWidth())).toBe(420);
    expect(impose.document.output()).toContain('1:500');
    expect(impose.messageFond).toBeNull();
  });

  it('avertit si le plan dépasse même l\'A3', async () => {
    const impose = await creerPdf({ stocks, resultats, points, cartouche, echelleImposee: 200 });
    expect(impose.format).toBe('a3');
    expect(impose.messageFond).toContain('dépasse la feuille A3');
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

describe('creerPdf - calques', async () => {
  const { creerPdf } = await import('../src/export/pdf.js');
  const points = pointsDeReference();
  const stock = surfaceDeReference(STOCKS_REFERENCE[1], points);
  const resultats = [volumeDeReference(STOCKS_REFERENCE[1], points)];

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

  it('ajoute une feuille par calcul dans un contour, avec ses volumes et sa légende', async () => {
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
    const { document } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, comparaisons: [{ nom: 'Avant / après', description: 'Stock 2 par rapport au plan 425', resultat }] });
    expect(document.getNumberOfPages()).toBe(2);
    const contenu = document.output();
    expect(contenu).toContain('Volume entre deux surfaces');
    expect(contenu).toContain('Stock 2 par rapport au plan 425');
    const { formaterNombre } = await import('../src/topo/format.js');
    expect(contenu).toContain(formaterNombre(resultat.remblai));
  });

  it('met les photos dans la colonne, sous la légende ; sur des feuilles à part si elles n\'y tiennent pas', async () => {
    // Petite image JPEG de 8 × 6 pixels (couleur ambre).
    const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC/ARI6f//Z';
    const photo = (i) => ({ surface: 'Stock 2', legende: `Vue ${i}`, date: '2026-05-20T08:00:00Z', image, largeur: 8, hauteur: 6 });
    const { document } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, photos: [1, 2].map(photo) });
    expect(document.getNumberOfPages()).toBe(1); // tout sur la feuille des volumes
    expect(document.output()).toContain('Stock 2 - Vue 2');
    expect(document.output()).not.toContain('20.05.2026'); // pas de date sous les photos
    // Trop de photos pour la colonne : 4 par feuille, à la suite.
    const beaucoup = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, photos: Array.from({ length: 30 }, (_, i) => photo(i + 1)) });
    expect(beaucoup.document.getNumberOfPages()).toBe(9); // volumes + 8 feuilles (30 photos, 4 par feuille)
    const sans = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, photos: [photo(1)], calques: { photos: false } });
    expect(sans.document.getNumberOfPages()).toBe(1);
  });

  it('crée le PDF sans le fond quand la photo est impossible (pas de navigateur)', async () => {
    const { messageFond } = await creerPdf({ stocks: [stock], resultats, points, cartouche: {}, calques: { photo: true } });
    expect(messageFond).toBeTruthy();
  });
});
