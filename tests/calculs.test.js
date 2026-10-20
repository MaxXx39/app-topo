// Tests des calculs de volume de l'onglet 3. Volumes (surface 1, ligne basse ou surface 2, zone).
import { describe, it, expect } from 'vitest';
import { creerSurface, surfaceImportee, calculerSurface } from '../src/topo/surface.js';
import { calculerVolumeSurface } from '../src/topo/volume.js';
import {
  creerCalcul,
  calculerVolume,
  nettoyerCalculs,
  nomAutomatique,
  descriptionCalcul,
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
    expect(calculerVolume({ ...deuxSurfaces, surface2Id: null }, donnees).erreurs[0]).toContain('choisis la surface 2');
    expect(calculerVolume({ ...deuxSurfaces, surface2Id: stock.id }, donnees).erreurs[0]).toContain('deux surfaces différentes');
    expect(calculerVolume({ ...deuxSurfaces, surface1Id: 'disparue' }, donnees).erreurs[0]).toContain('choisis la surface 1');
    expect(calculerVolume({ ...creerCalcul(tn, [tn]), uneSeule: true }, donnees).erreurs[0]).toContain('pas de ligne basse');
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
      '« Fouille » (terrassement) par rapport à « TN » (terrain naturel), dans le contour de « Stock 1 »',
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
