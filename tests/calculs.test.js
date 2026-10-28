// Tests des calculs de volume de l'onglet 2.2 Volumes (surface 1, ligne basse ou surface 2, zone).
import { describe, it, expect } from 'vitest';
import { creerSurface, surfaceImportee, calculerSurface } from '../src/topo/surface.js';
import { calculerVolumeSurface, volumeSurAltitude } from '../src/topo/volume.js';
import {
  creerCalcul,
  nouveauVolume,
  choisirSorte,
  nomDeVolumeLibre,
  calculerVolume,
  nettoyerCalculs,
  nomAutomatique,
  descriptionCalcul,
  grouperParNature,
  calculsAutomatiques,
} from '../src/volumes/calculs.js';
import { pt, pointsDeReference, surfaceDeReference, STOCKS_REFERENCE } from './outils.js';

const points = pointsDeReference();

/** Données de calcul comme dans l'appli : triangles de chaque surface, points du levé. */
function donneesDe(surfaces) {
  return {
    surfaces,
    triangulations: new Map(surfaces.map((s) => [s.id, calculerSurface(s, points)])),
    pointsDe: () => points,
  };
}

/** Surface importée : plan horizontal à "altitude", qui couvre largement tout le levé. */
function planHorizontal(nom, altitude) {
  const ests = points.map((p) => p.est);
  const nords = points.map((p) => p.nord);
  const [e0, e1, n0, n1] = [Math.min(...ests) - 10, Math.max(...ests) + 10, Math.min(...nords) - 10, Math.max(...nords) + 10];
  const coins = [pt('1', e0, n0, altitude), pt('2', e1, n0, altitude), pt('3', e1, n1, altitude), pt('4', e0, n1, altitude)];
  const lue = { nom, points: coins, triangles: [[coins[0], coins[1], coins[2]], [coins[0], coins[2], coins[3]]] };
  return surfaceImportee(lue, 'plan.xml', 'landxml');
}

/** Surface d'un stock de référence, avec sa nature. */
function stockDeReference(index) {
  return { ...surfaceDeReference(STOCKS_REFERENCE[index], points), nature: 'stock' };
}

describe('calcul prérempli d\'après la nature de la surface 1', () => {
  it('un stock : une seule surface (volume sur sa ligne basse)', () => {
    const stock = creerSurface('Stock 1', 'leve', 'stock');
    expect(creerCalcul(stock, [stock])).toMatchObject({ surface1Id: stock.id, uneSeule: true, surface2Id: null, nom: '' });
  });

  it('un terrassement : comparé au dernier terrain naturel', () => {
    const tn1 = creerSurface('TN mai', 'leve', 'terrain');
    const tn2 = creerSurface('TN juin', 'leve', 'terrain');
    const terrassement = creerSurface('Fouille', 'leve', 'terrassement');
    const surfaces = [tn1, tn2, terrassement];
    expect(creerCalcul(terrassement, surfaces)).toMatchObject({ uneSeule: false, surface2Id: tn2.id, zone: { type: 'toute' } });
  });

  it('un stock importé n\'a pas de ligne basse : comparé au terrain naturel', () => {
    const tn = planHorizontal('TN', 425);
    const stock = { ...planHorizontal('Stock', 430), nature: 'stock' };
    expect(creerCalcul(stock, [tn, stock])).toMatchObject({ uneSeule: false, surface2Id: tn.id });
  });
});

describe('calculerVolume', () => {
  it('cas de référence : une seule surface = volumes Mensura (tolérance 0,5 %)', () => {
    const stocks = STOCKS_REFERENCE.map((_, i) => stockDeReference(i));
    const donnees = donneesDe(stocks);
    stocks.forEach((stock, i) => {
      const resultat = calculerVolume(creerCalcul(stock, stocks), donnees);
      expect(resultat.erreurs).toBeUndefined();
      expect(Math.abs(resultat.remblai - STOCKS_REFERENCE[i].mensura)).toBeLessThanOrEqual(STOCKS_REFERENCE[i].tolerance);
    });
  });

  it('deux surfaces : même volume que la base B (surface 2 sous la surface 1)', () => {
    const stock = stockDeReference(1);
    const tn = planHorizontal('TN', 425);
    const donnees = donneesDe([stock, tn]);
    const calcul = { ...creerCalcul(stock, [stock, tn]), uneSeule: false, surface2Id: tn.id };

    const resultat = calculerVolume(calcul, donnees);
    const attendu = calculerVolumeSurface(stock, donnees.triangulations.get(stock.id), points, {
      nom: 'TN',
      triangles: donnees.triangulations.get(tn.id).triangles,
    });
    expect(resultat.erreurs).toBeUndefined();
    expect(resultat.mode).toBe('B');
    expect(resultat.remblai).toBeCloseTo(attendu.remblai, 6);
    // Le stock est tout entier au-dessus de 425 m : pas de déblai.
    expect(resultat.deblai).toBe(0);
    expect(resultat.surfaceNonCouverte).toBe(0);
  });

  it('deux surfaces dans le contour d\'un stock : même volume que sur toute la surface du stock', () => {
    const stock = stockDeReference(1);
    const tn = planHorizontal('TN', 425);
    const donnees = donneesDe([stock, tn]);
    const surToute = calculerVolume({ ...creerCalcul(stock, [stock, tn]), uneSeule: false, surface2Id: tn.id }, donnees);
    const dansContour = calculerVolume(
      { ...creerCalcul(stock, [stock, tn]), uneSeule: false, surface2Id: tn.id, zone: { type: 'surface', surfaceId: stock.id } },
      donnees,
    );
    expect(dansContour.erreurs).toBeUndefined();
    expect(dansContour.remblai).toBeCloseTo(surToute.remblai, 6);
    expect(dansContour.surfaceZone).toBeCloseTo(surToute.surfaceContour, 6);
  });

  it('messages clairs quand le calcul est impossible', () => {
    const stock = stockDeReference(1);
    const tn = planHorizontal('TN', 425);
    const donnees = donneesDe([stock, tn]);
    const deuxSurfaces = { ...creerCalcul(stock, [stock]), uneSeule: false };
    expect(calculerVolume({ ...deuxSurfaces, surface2Id: null }, donnees).erreurs[0]).toContain('choisis la surface de référence');
    expect(calculerVolume({ ...deuxSurfaces, surface2Id: stock.id }, donnees).erreurs[0]).toContain('deux surfaces différentes');
    expect(calculerVolume({ ...deuxSurfaces, surface1Id: 'disparue' }, donnees).erreurs[0]).toContain('choisis la surface comparée');
    expect(calculerVolume({ ...creerCalcul(tn, [tn]), uneSeule: true }, donnees).erreurs[0]).toContain('pas de ligne de contour');
    expect(calculerVolume(nouveauVolume(), donnees).erreurs[0]).toContain('stock seul ou comparaison');
    expect(calculerVolume({ ...creerCalcul(stock, [stock]), base: 'altitude', altitude: null }, donnees).erreurs[0]).toContain('altitude');
  });

  it('stock seul depuis une altitude : même volume qu\'au-dessus d\'un plan horizontal importé', () => {
    const stock = stockDeReference(1);
    const tn = planHorizontal('TN', 425);
    const donnees = donneesDe([stock, tn]);
    const surPlan = calculerVolume({ ...creerCalcul(stock, [stock, tn]), uneSeule: false, surface2Id: tn.id }, donnees);
    const surAltitude = calculerVolume({ ...creerCalcul(stock, [stock]), base: 'altitude', altitude: 425 }, donnees);
    expect(surAltitude.erreurs).toBeUndefined();
    expect(surAltitude.mode).toBe('Z');
    expect(surAltitude.remblai).toBeCloseTo(surPlan.remblai, 6);
    expect(surAltitude.deblai).toBe(0);
    expect(surAltitude.surfacePlan).toBeCloseTo(surPlan.surfacePlan, 6);
    // Altitude très haute : tout le stock est sous le plan, tout en déblai.
    const enDessous = calculerVolume({ ...creerCalcul(stock, [stock]), base: 'altitude', altitude: 500 }, donnees);
    expect(enDessous.remblai).toBe(0);
    expect(enDessous.deblai).toBeGreaterThan(0);
  });
});

describe('volumeSurAltitude', () => {
  // Triangle rectangle de 10 m × 10 m (50 m² en plan).
  const triangle = (a1, a2, a3) => [pt('a', 0, 0, a1), pt('b', 10, 0, a2), pt('c', 0, 10, a3)];

  it('triangle à 1 m au-dessus du plan : 50 m³ de remblai', () => {
    const r = volumeSurAltitude([triangle(101, 101, 101)], 100);
    expect(r.surfacePlan).toBeCloseTo(50, 9);
    expect(r.remblai).toBeCloseTo(50, 9);
    expect(r.deblai).toBe(0);
  });

  it('triangle à 2 m au-dessous du plan : 100 m³ de déblai', () => {
    const r = volumeSurAltitude([triangle(98, 98, 98)], 100);
    expect(r.remblai).toBe(0);
    expect(r.deblai).toBeCloseTo(100, 9);
  });

  it('triangle qui traverse le plan : remblai et déblai séparés, somme = volume net', () => {
    const r = volumeSurAltitude([triangle(99, 101, 102)], 100);
    // Volume net = aire × moyenne des écarts = 50 × (-1 + 1 + 2) / 3.
    expect(r.remblai - r.deblai).toBeCloseTo(100 / 3, 9);
    expect(r.remblai).toBeGreaterThan(0);
    expect(r.deblai).toBeGreaterThan(0);
  });
});

describe('sorte d\'un nouveau volume', () => {
  const stock = creerSurface('Stock 1', 'leve', 'stock');
  const tn = creerSurface('TN', 'leve', 'terrain');
  const fouille = creerSurface('Fouille', 'leve', 'terrassement');
  const surfaces = [tn, stock, fouille];

  it('stock seul : le premier stock, base sur le contour, nom du stock', () => {
    const volume = nouveauVolume();
    choisirSorte(volume, 'stock', surfaces, [volume]);
    expect(volume).toMatchObject({ uneSeule: true, surface1Id: stock.id, base: 'contour', surface2Id: null, nom: '' });
    expect(nomAutomatique(volume, surfaces)).toBe('Stock 1');
  });

  it('comparaison : nom « Volume N » libre, référence = dernier terrain naturel', () => {
    const calculs = [{ nom: 'Volume 1' }];
    const volume = nouveauVolume();
    choisirSorte(volume, 'comparaison', surfaces, [...calculs, volume]);
    expect(volume).toMatchObject({ uneSeule: false, surface2Id: tn.id, nom: 'Volume 2' });
    expect(nomDeVolumeLibre([])).toBe('Volume 1');
  });
});

describe('noms et nettoyage des calculs', () => {
  const stock = creerSurface('Stock 1', 'leve', 'stock');
  const tn = creerSurface('TN', 'leve', 'terrain');
  const terrassement = creerSurface('Fouille', 'leve', 'terrassement');
  const surfaces = [stock, tn, terrassement];

  it('nom automatique et description (avec la nature des surfaces)', () => {
    const calculStock = creerCalcul(stock, surfaces);
    const calculFouille = creerCalcul(terrassement, surfaces);
    expect(nomAutomatique(calculStock, surfaces)).toBe('Stock 1');
    expect(nomAutomatique(calculFouille, surfaces)).toBe('Fouille / TN');
    expect(descriptionCalcul(calculStock, surfaces)).toBe('« Stock 1 » (stock) sur sa ligne basse');
    expect(descriptionCalcul({ ...calculFouille, zone: { type: 'surface', surfaceId: stock.id } }, surfaces)).toBe(
      '« Fouille » (terrassement) par rapport à « TN » (terrain), dans le contour de « Stock 1 »',
    );
  });

  it('une surface supprimée : ses calculs disparaissent, les choix qui la désignent sont vidés', () => {
    const calculStock = creerCalcul(stock, surfaces);
    const calculFouille = { ...creerCalcul(terrassement, surfaces), zone: { type: 'surface', surfaceId: tn.id } };
    const restants = nettoyerCalculs([calculStock, calculFouille], [stock, terrassement]);
    expect(restants).toEqual([calculStock, calculFouille]);
    expect(calculFouille.surface2Id).toBeNull();
    expect(calculFouille.zone).toEqual({ type: 'toute' });
    expect(nettoyerCalculs([calculStock, calculFouille], [terrassement])).toEqual([calculFouille]);
  });
});

describe('grouperParNature', () => {
  const volume = (remblai, deblai) => ({ surfacePlan: 100, remblai, deblai });
  it('range les lignes par nature et fait un total par nature (jamais stocks + terrassements)', () => {
    const groupes = grouperParNature([
      { nom: 'Fouille', nature: 'terrassement', resultat: volume(10, 500) },
      { nom: 'Stock 1', nature: 'stock', resultat: volume(1636.197, 0) },
      { nom: 'Stock 2', nature: 'stock', resultat: volume(648.979, 0) },
    ]);
    expect(groupes.map((g) => g.nature)).toEqual(['stock', 'terrassement']);
    expect(groupes[0].lignes.map((l) => l.nom)).toEqual(['Stock 1', 'Stock 2']);
    expect(groupes[0].total.titre).toBe('Total stocks');
    expect(groupes[0].total.remblai).toBeCloseTo(2285.176, 6);
    expect(groupes[0].total.surfacePlan).toBe(200);
    // Un seul terrassement : pas de ligne de total.
    expect(groupes[1].total).toBeNull();
    // Deux volumes du même stock : pas de total.
    const doublon = grouperParNature([
      { calcul: { surface1Id: 's1' }, nature: 'stock', resultat: volume(10, 0) },
      { calcul: { surface1Id: 's1' }, nature: 'stock', resultat: volume(12, 0) },
    ]);
    expect(doublon[0].total).toBeNull();
  });
});

describe('calculsAutomatiques', () => {
  it('suit la nature de la surface, sans toucher aux calculs modifiés à la main', () => {
    const surface = creerSurface('Stock 4', 'leve', 'stock');
    const tn = creerSurface('TN', 'leve', 'terrain');
    const surfaces = [surface];

    // Nouvelle surface (un stock) : un calcul sur sa ligne basse.
    let calculs = calculsAutomatiques([], surfaces, surface);
    expect(calculs).toHaveLength(1);
    expect(calculs[0]).toMatchObject({ auto: true, uneSeule: true });

    // Elle devient un terrassement : son calcul automatique disparaît (les comparaisons s'ajoutent à la main).
    surface.nature = 'terrassement';
    expect(calculsAutomatiques(calculs, surfaces, surface)).toHaveLength(0);

    // Un terrain naturel n'a pas de calcul automatique non plus.
    surfaces.push(tn);
    expect(calculsAutomatiques([], surfaces, tn)).toHaveLength(0);

    // Un calcul modifié à la main reste, même si la surface devient un terrain naturel.
    surface.nature = 'stock';
    calculs = calculsAutomatiques([], surfaces, surface);
    calculs[0].auto = false;
    surface.nature = 'terrain';
    expect(calculsAutomatiques(calculs, surfaces, surface)).toEqual(calculs);
  });
});
