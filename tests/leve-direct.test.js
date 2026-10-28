// Tests du levé direct avec le récepteur (appli Android) : noms (C-Stock-1-1, L-HT-1-1, P-RG-1…), rôles, annulation, volume.
import { describe, it, expect } from 'vitest';
import {
  creerLeveDirect,
  creerSurfaceDirecte,
  leveDuJour,
  prochainNom,
  nomsDuProjet,
  lireNomLeve,
  rolesPermis,
  ajouterPointDirect,
  annulerDernierPoint,
  nouvelleLigne,
  basculerFermeture,
  ligneEnCours,
  resumeStock,
  estLeveDirect,
  creerAutres,
  creerListeDeLevee,
  nommerListeDeLevee,
  leveDepuisFichier,
  creerLeveeDuDessin,
  synchroniserLeveeDuDessin,
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

/** Lève un point au nom proposé, dans ce rôle (et avec ce libellé) ; renvoie son nom. */
function lever(projet, leve, stock, role, libelle = 'HT', position = { est: 0, nord: 0, altitude: 0 }) {
  const nom = prochainNom(projet, stock, role, libelle);
  const { point } = ajouterPointDirect(leve, stock, role, { ...position, nom }, nomsDuProjet(projet));
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
    expect(creerSurfaceDirecte(projet, leve, 'stock').nom).toBe('Stock 2');
  });

  it('crée la surface de la nature choisie, avec son propre numéro', () => {
    const { projet, leve } = nouveauLeve();
    expect(creerSurfaceDirecte(projet, leve, 'terrain')).toMatchObject({ nom: 'Terrain 1', nature: 'terrain', tousLesPoints: false });
    expect(creerSurfaceDirecte(projet, leve, 'terrassement')).toMatchObject({ nom: 'Terrassement 1', nature: 'terrassement' });
    expect(creerSurfaceDirecte(projet, leve, 'terrain').nom).toBe('Terrain 2');
  });

  it('range les surfaces du même jour dans le même levé', () => {
    const projet = creerProjet('Essai');
    const matin = leveDuJour(projet, new Date(2026, 9, 22, 8, 0));
    expect(matin.nom).toBe('Levé RX2 2026-10-22');
    expect(leveDuJour(projet, new Date(2026, 9, 22, 16, 30))).toBe(matin);
    expect(leveDuJour(projet, new Date(2026, 9, 23, 7, 0)).nom).toBe('Levé RX2 2026-10-23');
    expect(projet.leves).toHaveLength(2);
  });

  it('nomme le contour C-Stock-<n>-<k>, les lignes L-<libellé>-<n>-<k>, les points P-<libellé>-<k>', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect([lever(projet, leve, stock, 'contour'), lever(projet, leve, stock, 'contour')]).toEqual(['C-Stock-1-1', 'C-Stock-1-2']);
    expect([lever(projet, leve, stock, 'ligne', 'HT'), lever(projet, leve, stock, 'ligne', 'HT')]).toEqual(['L-HT-1-1', 'L-HT-1-2']);
    nouvelleLigne(stock);
    expect(lever(projet, leve, stock, 'ligne', 'HT')).toBe('L-HT-2-1');
    expect([lever(projet, leve, stock, 'isole', 'RG'), lever(projet, leve, stock, 'isole', 'RG')]).toEqual(['P-RG-1', 'P-RG-2']);
    expect(lever(projet, leve, stock, 'isole', 'TN')).toBe('P-TN-1');
    expect(stock.contour).toEqual(['C-Stock-1-1', 'C-Stock-1-2']);
    expect(stock.lignesRupture.map((l) => [l.libelle, l.numero, l.noms])).toEqual([
      ['HT', 1, ['L-HT-1-1', 'L-HT-1-2']],
      ['HT', 2, ['L-HT-2-1']],
    ]);
    expect(stock.points).toEqual(['P-RG-1', 'P-RG-2', 'P-TN-1']);
    expect(resumeStock(stock)).toEqual({ contour: 2, lignes: 2, pointsLignes: 3, isoles: 3 });
  });

  it('un autre libellé commence une nouvelle ligne, avec son propre numéro', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'ligne', 'HT');
    lever(projet, leve, stock, 'ligne', 'HT');
    expect(lever(projet, leve, stock, 'ligne', 'BOR')).toBe('L-BOR-1-1');
    expect(stock.lignesRupture).toHaveLength(2);
    // Revenir sur HT : encore une nouvelle ligne, la n° 2 des hauts de talus.
    expect(lever(projet, leve, stock, 'ligne', 'HT')).toBe('L-HT-2-1');
  });

  it('compte les contours et les lignes dans tout le projet (autres surfaces, autres jours)', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'contour');
    lever(projet, leve, stock, 'ligne', 'HT');
    const stock2 = creerSurfaceDirecte(projet, leve, 'stock');
    expect(lever(projet, leve, stock2, 'contour')).toBe('C-Stock-2-1');
    expect(lever(projet, leve, stock2, 'ligne', 'HT')).toBe('L-HT-2-1');
    const demain = leveDuJour(projet, new Date(2026, 9, 23, 7, 0));
    const terrain = creerSurfaceDirecte(projet, demain, 'terrain');
    expect(lever(projet, demain, terrain, 'ligne', 'HT')).toBe('L-HT-3-1');
    expect(lever(projet, demain, terrain, 'isole', 'RG')).toBe('P-RG-1');
    expect(lever(projet, leve, stock, 'isole', 'RG')).toBe('P-RG-2');
    // Le 1er stock continue son contour.
    expect(lever(projet, leve, stock, 'contour')).toBe('C-Stock-1-2');
  });

  it('une ligne encore vide réserve son numéro', () => {
    const { projet, stock } = nouveauLeve();
    expect(prochainNom(projet, stock, 'ligne', 'HT')).toBe('L-HT-1-1');
    const { stock: autre } = { stock: creerSurfaceDirecte(projet, projet.leves[0], 'terrain') };
    expect(prochainNom(projet, autre, 'ligne', 'HT')).toBe('L-HT-2-1');
  });

  it('lit les noms du levé', () => {
    expect(lireNomLeve('C-Stock-2-5')).toEqual({ type: 'C', libelle: 'Stock', element: 2, numero: 5 });
    expect(lireNomLeve('L-HT-1-12')).toEqual({ type: 'L', libelle: 'HT', element: 1, numero: 12 });
    expect(lireNomLeve('P-RG-4')).toEqual({ type: 'P', libelle: 'RG', element: null, numero: 4 });
    expect(lireNomLeve('b100')).toBeNull();
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
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: 'C-Stock-1-1', est: 1, nord: 1, altitude: 1 }).erreur).toMatch(/déjà pris/);
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: 'P-RG-7', est: 1, nord: 1, altitude: 1 }, new Set(['P-RG-7'])).erreur).toMatch(/déjà pris/);
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: '  ', est: 1, nord: 1, altitude: 1 }).erreur).toBeTruthy();
    expect(ajouterPointDirect(leve, stock, 'contour', { nom: ' pied ', est: 1, nord: 1, altitude: 1 }).point.nom).toBe('pied');
    expect(prochainNom(projet, stock, 'contour')).toBe('C-Stock-1-2');
  });

  it('pas de contour pour un terrain naturel ou un terrassement', () => {
    const { projet, leve, stock } = nouveauLeve();
    expect(rolesPermis(stock)).toEqual(['contour', 'ligne', 'isole']);
    const terrain = creerSurfaceDirecte(projet, leve, 'terrain');
    const terrassement = creerSurfaceDirecte(projet, leve, 'terrassement');
    expect(rolesPermis(terrain)).toEqual(['ligne', 'isole']);
    expect(rolesPermis(terrassement)).toEqual(['ligne', 'isole']);
    expect(ajouterPointDirect(leve, terrain, 'contour', { nom: 'X9', est: 0, nord: 0, altitude: 0 }).erreur).toMatch(/pas de contour/);
    expect(lever(projet, leve, terrain, 'isole', 'TN')).toBe('P-TN-1');
  });

  it('annule le dernier point (levé et stock)', () => {
    const { projet, leve, stock } = nouveauLeve();
    lever(projet, leve, stock, 'contour');
    lever(projet, leve, stock, 'ligne');
    expect(annulerDernierPoint(leve, [stock]).nom).toBe('L-HT-1-1');
    expect(leve.points.map((p) => p.nom)).toEqual(['C-Stock-1-1']);
    expect(ligneEnCours(stock).noms).toEqual([]);
    expect(prochainNom(projet, stock, 'ligne', 'HT')).toBe('L-HT-1-1');
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
    for (const nom of lireListeDeNoms('b100 à b116', noms).noms) lever(projet, leve, stock, 'contour', null, parNom.get(nom));
    for (const nom of lireListeDeNoms('h100 à h114', noms).noms) lever(projet, leve, stock, 'ligne', 'HT', parNom.get(nom));
    // Dans Mensura, la ligne se retrouve par une plage de noms qui se suivent.
    expect(lireListeDeNoms('L-HT-1-1 à L-HT-1-15', leve.points.map((p) => p.nom)).noms).toEqual(stock.lignesRupture[0].noms);
    basculerFermeture(stock);
    expect(stock.contour).toHaveLength(17);
    const triangulation = calculerSurface(stock, leve.points);
    const volume = calculerVolumeSurface(stock, triangulation, leve.points);
    expect(volume.remblai).toBeCloseTo(648.979, 3);
  });
});

describe('libellés des noms de points', () => {
  it('lit une liste tapée : abréviation puis signification, sans doublon', async () => {
    const { lireTexteLibelles, ecrireTexteLibelles, nettoyerAbreviation, LIBELLES_DEPART } = await import('../src/leve/libelles.js');
    expect(lireTexteLibelles('HT haut de talus\n\n bor  bordure \nHT encore\nh-t haut')).toEqual([
      ['HT', 'haut de talus'],
      ['BOR', 'bordure'],
    ]);
    expect(nettoyerAbreviation('c an')).toBe('CAN');
    expect(lireTexteLibelles(ecrireTexteLibelles(LIBELLES_DEPART.lignes))).toEqual(LIBELLES_DEPART.lignes);
  });
});

describe('couleur des libellés', () => {
  it('trouve la couleur d\'un point ou d\'une ligne d\'après son libellé', async () => {
    const { couleurDuNom, couleurDeLigne } = await import('../src/leve/libelles.js');
    const libelles = {
      lignes: [['HT', 'haut de talus', '#2563eb'], ['BT', 'bas de talus']],
      points: [['RG', 'regard', '#111827'], ['TN', 'terrain', '']],
      aires: [['ENR', 'enrobé', '#6b7280']],
    };
    expect(couleurDuNom('P-RG-3', libelles)).toBe('#111827');
    expect(couleurDuNom('L-HT-1-2', libelles)).toBe('#2563eb');
    expect(couleurDuNom('A-ENR-2-1', libelles)).toBe('#6b7280');
    expect(couleurDuNom('P-TN-1', libelles)).toBeNull();
    expect(couleurDuNom('L-BT-1-1', libelles)).toBeNull();
    expect(couleurDuNom('b100', libelles)).toBeNull();
    expect(couleurDeLigne({ libelle: 'HT', noms: [] }, libelles)).toBe('#2563eb');
    expect(couleurDeLigne({ noms: ['L-HT-4-1', 'L-HT-4-2'] }, libelles)).toBe('#2563eb');
  });
});

describe('levé libre', () => {
  it('nommé « Levé libre N », en comptant les anciens « Autres N »', () => {
    const projet = { autres: [{ nom: 'Autres 1' }, { nom: 'Levé libre 2' }] };
    expect(creerAutres(projet, { id: 'l1' }).nom).toBe('Levé libre 3');
    expect(creerAutres({}, { id: 'l1' }).nom).toBe('Levé libre 1');
  });
});

describe('supprimer un levé du Terrain', async () => {
  const { supprimerLevee, pointsDeLaLevee } = await import('../src/topo/leve-direct.js');

  it('enlève la surface et ses points, garde ceux d\'une autre surface du même jour', () => {
    const { projet, leve, stock } = nouveauLeve();
    const a = lever(projet, leve, stock, 'contour');
    const b = lever(projet, leve, stock, 'contour');
    const autre = creerSurfaceDirecte(projet, leve, 'terrain');
    const c = lever(projet, leve, autre, 'ligne');
    autre.points.push(b); // b sert aussi au terrain naturel
    expect(pointsDeLaLevee(projet, stock.id)).toEqual([a]);
    expect(supprimerLevee(projet, stock.id)).toEqual({ nom: 'Stock 1', points: 1 });
    expect(projet.surfaces.map((s) => s.nom)).toEqual(['Terrain 1']);
    expect(leve.points.map((p) => p.nom)).toEqual([b, c]);
    // Dernière surface du levé : le levé du jour, vide, part aussi.
    supprimerLevee(projet, autre.id);
    expect(projet.leves).toHaveLength(0);
    expect(supprimerLevee(projet, 'inconnu')).toBeNull();
  });
});

describe('une liste de points par levé (0.77.0)', () => {
  it('chaque levé a sa liste, à son nom, avec sa date de création ; renommer le levé renomme la liste', () => {
    const projet = creerProjet();
    const maintenant = new Date('2026-10-27T09:30:00');
    const liste1 = creerListeDeLevee(projet, maintenant);
    const stock = creerSurfaceDirecte(projet, liste1, 'stock');
    nommerListeDeLevee(projet, stock);
    const liste2 = creerListeDeLevee(projet, maintenant);
    const libre = creerAutres(projet, liste2);
    nommerListeDeLevee(projet, libre);
    expect(projet.leves.map((l) => l.nom)).toEqual(['Stock 1', 'Levé libre 1']);
    expect(liste1.importeLe).toBe(maintenant.toISOString());
    expect(estLeveDirect(liste1)).toBe(true);
    stock.nom = 'Stock gravier';
    nommerListeDeLevee(projet, stock);
    expect(liste1.nom).toBe('Stock gravier');
    // Une ancienne liste du jour (partagée par plusieurs levés) ne change pas de nom.
    const ancienne = creerLeveDirect(projet, maintenant);
    const ancienStock = creerSurfaceDirecte(projet, ancienne, 'stock');
    nommerListeDeLevee(projet, ancienStock);
    expect(ancienne.nom).toMatch(/^Levé RX2 2026-10-27/);
  });
});

describe('fichier importé comme levé (0.77.0)', () => {
  it('la liste du fichier devient celle d\'un levé, nommé d\'après le fichier, avec tous ses points', () => {
    const projet = creerProjet();
    const leve = { id: 'l1', nom: '20260520_Stock.csv', importeLe: '2026-10-27T08:00:00.000Z', points: [{ nom: '1', est: 0, nord: 0, altitude: 0 }] };
    projet.leves.push(leve);
    const surface = leveDepuisFichier(projet, leve, 'terrain');
    expect(surface).toMatchObject({ nom: '20260520_Stock', nature: 'terrain', leveId: 'l1', tousLesPoints: true });
    expect(leve).toMatchObject({ nom: '20260520_Stock', direct: true, dediee: true });
    expect(projet.surfaces).toEqual([surface]);
  });
});

describe('surface d\'un dessin = levé « Surface » (0.77.0)', () => {
  it('sa liste a les sommets du dessin (contour) ; le dessin change, les points du RX2 restent', () => {
    const projet = creerProjet();
    const sommets = [
      { nom: 'D1-1', est: 0, nord: 0, altitude: 400 },
      { nom: 'D1-2', est: 10, nord: 0, altitude: 400 },
      { nom: 'D1-3', est: 10, nord: 10, altitude: 400 },
    ];
    const surface = creerLeveeDuDessin(projet, { id: 'd1' }, sommets);
    expect(surface).toMatchObject({ nom: 'Surface 1', nature: 'surface', dessinId: 'd1', contour: ['D1-1', 'D1-2', 'D1-3'], tousLesPoints: false });
    const leve = projet.leves.find((l) => l.id === surface.leveId);
    expect(leve).toMatchObject({ nom: 'Surface 1', dediee: true, direct: true });
    expect(leve.points.map((p) => p.nom)).toEqual(['D1-1', 'D1-2', 'D1-3']);
    // Un point levé au RX2, puis le dessin change (un sommet déplacé, un ajouté).
    leve.points.push({ nom: 'P-TN-1', est: 5, nord: 2, altitude: 401 });
    synchroniserLeveeDuDessin(projet, surface, [...sommets.slice(0, 2), { nom: 'D1-3', est: 12, nord: 10, altitude: 400 }, { nom: 'D1-4', est: 0, nord: 10, altitude: 400 }]);
    expect(leve.points.map((p) => p.nom)).toEqual(['D1-1', 'D1-2', 'D1-3', 'D1-4', 'P-TN-1']);
    expect(leve.points[2].est).toBe(12);
    expect(surface.contour).toEqual(['D1-1', 'D1-2', 'D1-3', 'D1-4']);
    // Un sommet enlevé du dessin part de la liste.
    synchroniserLeveeDuDessin(projet, surface, sommets.slice(0, 3));
    expect(leve.points.map((p) => p.nom)).toEqual(['D1-1', 'D1-2', 'D1-3', 'P-TN-1']);
    expect(creerLeveeDuDessin(projet, { id: 'd2' }, sommets).nom).toBe('Surface 2');
  });
});
