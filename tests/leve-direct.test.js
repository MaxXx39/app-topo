// Tests du levé direct avec le récepteur (appli Android) : noms (B1, H2, C3…, puis B101…), rôles, annulation, volume.
import { describe, it, expect } from 'vitest';
import {
  creerLeveDirect,
  creerSurfaceDirecte,
  leveDuJour,
  prochainNom,
  nomsDuProjet,
  rolesPermis,
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
  const stock = creerSurfaceDirecte(projet, leve, 'stock');
  return { projet, leve, stock };
}

/** Lève un point au nom proposé, dans ce rôle ; renvoie son nom. */
function lever(projet, leve, stock, role, position = { est: 0, nord: 0, altitude: 0 }) {
  const { point } = ajouterPointDirect(leve, stock, role, { ...position, nom: prochainNom(projet, stock, role) }, nomsDuProjet(projet));
  return point.nom;
}

describe('levé direct', () => {
  it('crée un levé daté et un stock numéroté', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect(leve.nom).toBe('Levé RX2 2026-10-21');
    expect(estLeveDirect(leve)).toBe(true);
    expect(projet.leveActifId).toBe(leve.id);
    expect(stock).toMatchObject({ nom: 'Stock 1', nature: 'stock', leveId: leve.id, tousLesPoints: false, premierNumero: 1 });
    expect(creerLeveDirect(projet, new Date('2026-10-21T15:00:00Z')).nom).toBe('Levé RX2 2026-10-21 (2)');
    expect(creerSurfaceDirecte(projet, leve, 'stock').nom).toBe('Stock 2');
  });

  it('crée la surface de la nature choisie, avec son propre numéro', () => {
    const { projet, leve } = nouveauLeve();
    expect(creerSurfaceDirecte(projet, leve, 'terrain')).toMatchObject({ nom: 'Terrain naturel 1', nature: 'terrain', tousLesPoints: false });
    expect(creerSurfaceDirecte(projet, leve, 'terrassement')).toMatchObject({ nom: 'Terrassement 1', nature: 'terrassement' });
    expect(creerSurfaceDirecte(projet, leve, 'terrain').nom).toBe('Terrain naturel 2');
  });

  it('range les surfaces du même jour dans le même levé', () => {
    const projet = creerProjet('Essai');
    const matin = leveDuJour(projet, new Date(2026, 9, 22, 8, 0));
    expect(matin.nom).toBe('Levé RX2 2026-10-22');
    expect(leveDuJour(projet, new Date(2026, 9, 22, 16, 30))).toBe(matin);
    expect(leveDuJour(projet, new Date(2026, 9, 23, 7, 0)).nom).toBe('Levé RX2 2026-10-23');
    expect(projet.leves).toHaveLength(2);
  });

  it('nomme B, H ou C selon le rôle, avec un numéro qui continue : B1, B2, H3…', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect([lever(projet, leve, stock, 'contour'), lever(projet, leve, stock, 'contour')]).toEqual(['B1', 'B2']);
    expect([lever(projet, leve, stock, 'ligne'), lever(projet, leve, stock, 'ligne')]).toEqual(['H3', 'H4']);
    nouvelleLigne(stock);
    expect(lever(projet, leve, stock, 'ligne')).toBe('H5');
    expect(lever(projet, leve, stock, 'isole')).toBe('C6');
    expect(stock.contour).toEqual(['B1', 'B2']);
    expect(stock.lignesRupture.map((l) => l.noms)).toEqual([['H3', 'H4'], ['H5']]);
    expect(stock.points).toEqual(['C6']);
    expect(resumeStock(stock)).toEqual({ contour: 2, lignes: 2, pointsLignes: 3, isoles: 1 });
  });

  it('chaque nouvelle surface du projet prend la centaine suivante : 101, puis 201…', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'contour');
    lever(projet, leve, stock, 'contour');
    const stock2 = creerSurfaceDirecte(projet, leve, 'stock');
    expect(stock2.premierNumero).toBe(101);
    expect(lever(projet, leve, stock2, 'contour')).toBe('B101');
    // Une surface encore vide réserve sa centaine.
    const terrain = creerSurfaceDirecte(projet, leve, 'terrain');
    expect(terrain.premierNumero).toBe(201);
    // Un autre jour (autre levé), même projet : pas de doublon, on continue.
    const demain = leveDuJour(projet, new Date(2026, 9, 23, 7, 0));
    expect(creerSurfaceDirecte(projet, demain, 'stock').premierNumero).toBe(301);
    // La 1re surface continue dans sa centaine.
    expect(lever(projet, leve, stock, 'isole')).toBe('C3');
  });

  it('saute les noms déjà pris dans le projet (points importés, autres levés)', () => {
    const { projet, leve, stock } = nouveauLeve();
    projet.leves.push({ id: 'importe', nom: 'stock.csv', points: [{ nom: '1', est: 0, nord: 0, altitude: 0 }, { nom: '2', est: 1, nord: 0, altitude: 0 }] });
    expect(prochainNom(projet, stock, 'contour')).toBe('B3');
    // Les noms importés comptent pour la centaine d'une nouvelle surface.
    projet.leves[1].points.push({ nom: '250', est: 2, nord: 0, altitude: 0 });
    expect(creerSurfaceDirecte(projet, leve, 'stock').premierNumero).toBe(301);
  });

  it('donne une centaine à une surface levée avant cette règle', () => {
    const { projet, leve, stock } = nouveauLeve();
    delete stock.premierNumero;
    expect(prochainNom(projet, stock, 'ligne')).toBe('H1');
    expect(stock.premierNumero).toBe(1);
  });

  it('ne crée pas de ligne vide et ferme la ligne en cours', () => {
    const { projet, leve, stock } = nouveauLeve();
    nouvelleLigne(stock);
    expect(stock.lignesRupture).toHaveLength(1);
    lever(projet, leve, stock, 'ligne');
    basculerFermeture(stock);
    expect(ligneEnCours(stock).fermee).toBe(true);
    basculerFermeture(stock);
    expect(ligneEnCours(stock).fermee).toBe(false);
  });

  it('refuse un nom vide ou déjà pris dans le projet, et accepte un nom choisi', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'contour');
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: 'B1', est: 1, nord: 1, altitude: 1 }).erreur).toMatch(/déjà pris/);
    // Même numéro avec une autre lettre : refusé aussi (pas de doublon de numéro).
    expect(ajouterPointDirect(leve, stock, 'ligne', { nom: 'H1', est: 1, nord: 1, altitude: 1 }).erreur).toMatch(/numéro 1/);
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: 'P7', est: 1, nord: 1, altitude: 1 }, new Set(['P7'])).erreur).toMatch(/déjà pris/);
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: '  ', est: 1, nord: 1, altitude: 1 }).erreur).toBeTruthy();
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: ' pied ', est: 1, nord: 1, altitude: 1 }).point.nom).toBe('pied');
    expect(prochainNom(projet, stock, 'contour')).toBe('B2');
  });

  it('pas de contour pour un terrain naturel ou un terrassement', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect(rolesPermis(stock)).toEqual(['contour', 'ligne', 'isole']);
    const terrain = creerSurfaceDirecte(projet, leve, 'terrain');
    const terrassement = creerSurfaceDirecte(projet, leve, 'terrassement');
    expect(rolesPermis(terrain)).toEqual(['ligne', 'isole']);
    expect(rolesPermis(terrassement)).toEqual(['ligne', 'isole']);
    expect(ajouterPointDirect(leve, terrain, 'contour', { nom: 'B9', est: 0, nord: 0, altitude: 0 }).erreur).toMatch(/pas de contour/);
    expect(lever(projet, leve, terrain, 'isole')).toBe('C101');
  });

  it('annule le dernier point (levé et stock)', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'contour');
    lever(projet, leve, stock, 'ligne');
    expect(annulerDernierPoint(leve, [stock]).nom).toBe('H2');
    expect(leve.points.map((p) => p.nom)).toEqual(['B1']);
    expect(ligneEnCours(stock).noms).toEqual([]);
    expect(prochainNom(projet, stock, 'ligne')).toBe('H2');
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
    const { projet, leve, stock } = nouveauLeve();
    for (const nom of lireListeDeNoms('b100 à b116', noms).noms) lever(projet, leve, stock, 'contour', parNom.get(nom));
    for (const nom of lireListeDeNoms('h100 à h114', noms).noms) lever(projet, leve, stock, 'ligne', parNom.get(nom));
    basculerFermeture(stock);
    expect(stock.contour).toHaveLength(17);
    const triangulation = calculerSurface(stock, leve.points);
    const volume = calculerVolumeSurface(stock, triangulation, leve.points);
    expect(volume.remblai).toBeCloseTo(648.979, 3);
  });
});
