// Tests du levé direct avec le récepteur (appli Android) : noms, rôles, annulation, volume.
import { describe, it, expect } from 'vitest';
import {
  creerLeveDirect,
  creerStockDirect,
  prochainNom,
  ajouterPointDirect,
  annulerDernierPoint,
  nouvelleLigne,
  basculerFermeture,
  ligneEnCours,
  resumeStock,
  estLeveDirect,
} from '../src/topo/leve-direct.js';
import { creerProjet } from '../src/projet/projet.js';
import { calculerSurface } from '../src/topo/surface.js';
import { calculerVolumeSurface } from '../src/topo/volume.js';
import { lireListeDeNoms } from '../src/topo/noms.js';
import { pointsDeReference } from './outils.js';

/** Projet avec un levé direct et un stock vide. */
function nouveauLeve() {
  const projet = creerProjet('Essai');
  const leve = creerLeveDirect(projet, new Date('2026-10-21T10:00:00Z'));
  const stock = creerStockDirect(projet, leve);
  return { projet, leve, stock };
}

/** Lève un point au nom proposé, dans ce rôle ; renvoie son nom. */
function lever(leve, stock, role, position = { est: 0, nord: 0, altitude: 0 }) {
  const { point } = ajouterPointDirect(leve, stock, role, { ...position, nom: prochainNom(leve, stock, role) });
  return point.nom;
}

describe('levé direct', () => {
  it('crée un levé daté et un stock numéroté', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect(leve.nom).toBe('Levé RX2 2026-10-21');
    expect(estLeveDirect(leve)).toBe(true);
    expect(projet.leveActifId).toBe(leve.id);
    expect(stock).toMatchObject({ nom: 'Stock 1', nature: 'stock', leveId: leve.id, tousLesPoints: false });
    expect(creerLeveDirect(projet, new Date('2026-10-21T15:00:00Z')).nom).toBe('Levé RX2 2026-10-21 (2)');
    expect(creerStockDirect(projet, leve).nom).toBe('Stock 2');
  });

  it('nomme les points B, H<ligne>-<n> et C, comme Emlid Stock', () => {
    const { leve, stock } = nouveauLeve();
    expect([lever(leve, stock, 'contour'), lever(leve, stock, 'contour')]).toEqual(['B1', 'B2']);
    expect([lever(leve, stock, 'ligne'), lever(leve, stock, 'ligne')]).toEqual(['H1-1', 'H1-2']);
    nouvelleLigne(stock);
    expect(lever(leve, stock, 'ligne')).toBe('H2-1');
    expect(lever(leve, stock, 'isole')).toBe('C1');
    expect(stock.contour).toEqual(['B1', 'B2']);
    expect(stock.lignesRupture.map((l) => l.noms)).toEqual([['H1-1', 'H1-2'], ['H2-1']]);
    expect(stock.points).toEqual(['C1']);
    expect(resumeStock(stock)).toEqual({ contour: 2, lignes: 2, pointsLignes: 3, isoles: 1 });
  });

  it('continue la numérotation du levé dans un 2e stock', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(leve, stock, 'contour');
    lever(leve, stock, 'ligne');
    const stock2 = creerStockDirect(projet, leve);
    expect(prochainNom(leve, stock2, 'contour')).toBe('B2');
    expect(prochainNom(leve, stock2, 'ligne')).toBe('H2-1');
  });

  it('ne crée pas de ligne vide et ferme la ligne en cours', () => {
    const { leve, stock } = nouveauLeve();
    nouvelleLigne(stock);
    expect(stock.lignesRupture).toHaveLength(1);
    lever(leve, stock, 'ligne');
    basculerFermeture(stock);
    expect(ligneEnCours(stock).fermee).toBe(true);
    basculerFermeture(stock);
    expect(ligneEnCours(stock).fermee).toBe(false);
  });

  it('refuse un nom vide ou déjà pris, et accepte un nom choisi', () => {
    const { leve, stock } = nouveauLeve();
    lever(leve, stock, 'contour');
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: 'B1', est: 1, nord: 1, altitude: 1 }).erreur).toMatch(/déjà pris/);
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: '  ', est: 1, nord: 1, altitude: 1 }).erreur).toBeTruthy();
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: ' pied ', est: 1, nord: 1, altitude: 1 }).point.nom).toBe('pied');
    expect(prochainNom(leve, stock, 'contour')).toBe('B2');
  });

  it('annule le dernier point (levé et stock)', () => {
    const { leve, stock } = nouveauLeve();
    lever(leve, stock, 'contour');
    lever(leve, stock, 'ligne');
    expect(annulerDernierPoint(leve, [stock]).nom).toBe('H1-1');
    expect(leve.points.map((p) => p.nom)).toEqual(['B1']);
    expect(ligneEnCours(stock).noms).toEqual([]);
    expect(prochainNom(leve, stock, 'ligne')).toBe('H1-1');
    annulerDernierPoint(leve, [stock]);
    expect(annulerDernierPoint(leve, [stock])).toBeNull();
    expect(stock.contour).toEqual([]);
  });

  it('redonne le volume Mensura du stock 2 (648.979 m³) levé point par point', () => {
    // Le stock 2 du levé du 20/05/2026, repris comme s'il était levé avec le récepteur :
    // b100 à b116 en contour, h100 à h114 en ligne de rupture fermée. Les points des autres
    // stocks ne sont pas levés pour lui : seuls ses propres points comptent.
    const reference = pointsDeReference();
    const noms = reference.map((p) => p.nom);
    const parNom = new Map(reference.map((p) => [p.nom, p]));
    const { leve, stock } = nouveauLeve();
    for (const nom of lireListeDeNoms('b100 à b116', noms).noms) lever(leve, stock, 'contour', parNom.get(nom));
    for (const nom of lireListeDeNoms('h100 à h114', noms).noms) lever(leve, stock, 'ligne', parNom.get(nom));
    basculerFermeture(stock);
    expect(stock.contour).toHaveLength(17);
    const triangulation = calculerSurface(stock, leve.points);
    const volume = calculerVolumeSurface(stock, triangulation, leve.points);
    expect(volume.remblai).toBeCloseTo(648.979, 3);
  });
});
