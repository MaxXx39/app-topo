import { describe, it, expect } from 'vitest';
import { ordreColonnes, deplacerColonne, categorieDeListe, listesDuTableau, lignesDuTableau, trierLignes, csvDuTableau } from '../src/import/tableau-points.js';

function projetExemple() {
  return {
    pointsControle: [{ id: 'c1', nom: 'CTRL-1', est: 10, nord: 20, altitude: 400 }],
    photosControle: [{ id: 'phc', pointId: 'c1', point: 'CTRL-1' }],
    leves: [
      { id: 'l1', nom: 'LV-1', direct: true, points: [
        { nom: 'P-HT-1', est: 1, nord: 2, altitude: 3, gnss: { prisLe: '2026-11-09T08:00:00', precisionH: 0.012, precisionV: 0.02, appareil: '9533' } },
        { nom: 'P-2', est: 2, nord: 3, altitude: null, creeLe: '2026-11-10T09:00:00', creePar: '9534' },
      ] },
      { id: 'l2', nom: 'LV-2', direct: true, points: [{ nom: 'P-3', est: 5, nord: 6, altitude: 7, gnss: { prisLe: '2026-11-08T10:00:00' } }] },
      { id: 'i1', nom: 'points.csv', direct: false, points: [{ nom: 'IMP-1', est: 8, nord: 9, altitude: 1 }] },
      { id: 'a1', nom: 'Annot-20261109', direct: true, points: [{ nom: 'Annot-1', est: 3, nord: 4, altitude: null, annotation: { source: 'gnss', precision: 0.5, le: '2026-11-09T12:00:00', remarques: ['fissure', 'à revoir'], appareil: '9533' } }] },
      { id: 'h1', nom: 'LV-Chant 1', direct: true, points: [{ nom: 'P-CH-1', est: 4, nord: 5, altitude: 1, chantier: { libelle: 'CH', nature: 'EU', remarque: 'regard' }, gnss: { prisLe: '2026-11-10T10:00:00' } }] },
    ],
    surfaces: [],
    autres: [{ id: 'oa', nature: 'annotation', leveId: 'a1', photos: [{ id: 'pha', point: 'Annot-1' }] }, { id: 'oc', nature: 'chantier', leveId: 'h1', photos: [] }],
  };
}

describe('tableau des points (0.191.0)', () => {
  it('range chaque liste dans sa catégorie', () => {
    const p = projetExemple();
    const cat = (id) => categorieDeListe(p, p.leves.find((l) => l.id === id));
    expect([cat('l1'), cat('i1'), cat('a1'), cat('h1')]).toEqual(['libre', 'import', 'annotation', 'chantier']);
    expect(listesDuTableau(p).map((l) => l.id)).toEqual(['controle', 'l1', 'l2', 'i1', 'a1', 'h1']);
  });

  it('0.197.0 : un levé est rangé par sa nature ; le cadastre n\'est pas dans le tableau', () => {
    const p = projetExemple();
    p.leves.push(
      { id: 's1', nom: 'LV-Stock 1', direct: true, points: [{ nom: 'S-1', est: 1, nord: 1, altitude: 1 }] },
      { id: 't1', nom: 'LV-Terrain 1', direct: true, points: [{ nom: 'T-1', est: 1, nord: 1, altitude: 1 }] },
      { id: 'k1', nom: 'Cadastre', cadastre: true, direct: true, points: [{ nom: 'K-1', est: 1, nord: 1, altitude: 1 }] },
    );
    p.surfaces.push({ id: 'os', nature: 'stock', leveId: 's1' }, { id: 'ot', nature: 'terrain', leveId: 't1' });
    const cat = (id) => categorieDeListe(p, p.leves.find((l) => l.id === id));
    expect([cat('s1'), cat('t1'), cat('k1')]).toEqual(['stock', 'terrain', null]);
    expect(listesDuTableau(p).some((l) => l.id === 'k1')).toBe(false);
    expect(lignesDuTableau(p, { categories: new Set(['stock', 'terrain']) }).map((l) => l.nom).sort()).toEqual(['S-1', 'T-1']);
  });

  it('plusieurs catégories, et on peut décocher une liste', () => {
    const p = projetExemple();
    expect(lignesDuTableau(p, { categories: new Set(['libre']) }).map((l) => l.nom).sort()).toEqual(['P-2', 'P-3', 'P-HT-1']);
    expect(lignesDuTableau(p, { categories: new Set(['libre', 'import']), listesDecochees: new Set(['l2']) }).map((l) => l.nom).sort()).toEqual(['IMP-1', 'P-2', 'P-HT-1']);
    expect(lignesDuTableau(p, { categories: new Set(['controle']) })[0]).toMatchObject({ nom: 'CTRL-1', photos: 1, photoId: 'phc' });
  });

  it('libellé, précision, tablette, remarque, photo', () => {
    const p = projetExemple();
    const l = Object.fromEntries(lignesDuTableau(p, { categories: new Set(['libre', 'annotation', 'chantier']) }).map((x) => [x.nom, x]));
    expect(l['P-HT-1']).toMatchObject({ libelle: 'HT', precision: '0.012 / 0.020', tablette: '9533' });
    expect(l['P-2']).toMatchObject({ tablette: '9534', date: '2026-11-10T09:00:00' }); // point tapé : date de création
    expect(l['Annot-1']).toMatchObject({ remarque: 'fissure | à revoir', photos: 1, tablette: '9533' });
    expect(l['P-CH-1']).toMatchObject({ libelle: 'CH', remarque: 'regard' });
    expect(l['P-3'].tablette).toBe(''); // ancien point : rien d'inventé
  });

  it('jour choisi : seuls les points datés de ce jour', () => {
    const p = projetExemple();
    const noms = lignesDuTableau(p, { categories: new Set(['libre', 'import']), jour: '2026-11-09' }).map((l) => l.nom);
    expect(noms).toEqual(['P-HT-1']);
  });

  it('tri par colonne : les valeurs vides restent à la fin', () => {
    const p = projetExemple();
    const lignes = lignesDuTableau(p, { categories: new Set(['libre']) });
    expect(trierLignes(lignes, 'altitude', true).map((l) => l.nom)).toEqual(['P-HT-1', 'P-3', 'P-2']);
    expect(trierLignes(lignes, 'altitude', false).map((l) => l.nom)).toEqual(['P-3', 'P-HT-1', 'P-2']);
    expect(trierLignes(lignes, 'date', false).map((l) => l.nom)).toEqual(['P-2', 'P-HT-1', 'P-3']);
  });

  it('CSV : titres, 3 décimales, guillemets', () => {
    const p = projetExemple();
    p.leves[0].points[0].nom = 'P;1';
    const csv = csvDuTableau(trierLignes(lignesDuTableau(p, { categories: new Set(['libre']) }), 'nom', true));
    const [titres, ...lignes] = csv.trim().split('\r\n');
    expect(titres).toBe('Nom;Libellé;E;N;H;Préc. H / V;Date;Tablette;Remarque;Photo;Liste;Catégorie');
    expect(lignes.some((l) => l.startsWith('"P;1";'))).toBe(true);
    expect(csv).toContain('1.000;');
  });
});

describe('liste de chaque point (0.192.0)', () => {
  it('première liste cochée qui contient le point, ignore les listes cachées', async () => {
    const { listeDesPoints } = await import('../src/plan/listes-points.js');
    const p1 = { nom: 'P1' };
    const p2 = { nom: 'P2' };
    const projet = { leves: [{ id: 'a', points: [p1] }, { id: 'b', points: [p1, p2] }] };
    const listes = [{ id: 'a', visible: false, leveId: 'a', noms: null }, { id: 'b', visible: true, leveId: 'b', noms: null }];
    const carte = listeDesPoints(projet, listes);
    expect(carte.get(p1)).toBe('b');
    expect(carte.get(p2)).toBe('b');
  });
});

describe('ordre des colonnes (0.198.0)', () => {
  it('« Nom » reste à gauche, les colonnes oubliées ou inconnues sont rangées', () => {
    expect(ordreColonnes([])[0]).toBe('nom');
    expect(ordreColonnes(['photos', 'inconnue', 'photos', 'nom', 'est']).slice(0, 3)).toEqual(['nom', 'photos', 'est']);
    expect(ordreColonnes(['photos']).length).toBe(11);
    expect(ordreColonnes(null)[0]).toBe('nom');
  });

  it('déplacer une colonne : gauche, droite, tout à gauche ; Nom ne bouge pas', () => {
    const depart = ordreColonnes([]);
    expect(deplacerColonne(depart, 'photos', 'premier').slice(0, 2)).toEqual(['nom', 'photos']);
    expect(deplacerColonne(depart, 'libelle', 1).slice(0, 3)).toEqual(['nom', 'est', 'libelle']);
    expect(deplacerColonne(depart, 'libelle', -1)).toEqual(depart); // déjà la première après le nom
    expect(deplacerColonne(depart, 'liste', 1)).toEqual(depart); // déjà la dernière
    expect(deplacerColonne(depart, 'nom', 'premier')).toEqual(depart);
  });

  it('l\'export CSV garde toujours l\'ordre de départ', () => {
    const csv = csvDuTableau([]);
    expect(csv.split('\r\n')[0]).toBe('Nom;Libellé;E;N;H;Préc. H / V;Date;Tablette;Remarque;Photo;Liste;Catégorie');
  });
});
