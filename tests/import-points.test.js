// Tests de la lecture des fichiers de points (CSV Emlid et TXT).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lirePoints } from '../src/topo/import-points.js';

const lireExemple = (nom) => readFileSync(new URL(`../exemples/${nom}`, import.meta.url), 'utf-8');

describe('lirePoints - fichiers d\'exemple du levé du 20/05/2026', () => {
  const csv = lirePoints(lireExemple('stock.csv'));
  const txt = lirePoints(lireExemple('stock_export.txt'));

  it('reconnaît le format de chaque fichier', () => {
    expect(csv.format).toBe('CSV Emlid');
    expect(txt.format).toBe('TXT');
  });

  it('lit les 115 points sans erreur', () => {
    expect(csv.points).toHaveLength(115);
    expect(txt.points).toHaveLength(115);
    expect(csv.erreurs).toEqual([]);
    expect(txt.erreurs).toEqual([]);
    expect(csv.avertissements).toEqual([]);
  });

  it('lit le point b1 dans l\'ordre Est, Nord, altitude', () => {
    expect(csv.points[0]).toMatchObject({ nom: 'b1', est: 2499349.955, nord: 1124567.41, altitude: 427.654 });
    expect(txt.points[0]).toMatchObject({ nom: 'b1', est: 2499349.955, nord: 1124567.41, altitude: 427.654 });
  });

  it('donne les mêmes points avec le CSV et le TXT', () => {
    const sansLigne = (p) => ({ nom: p.nom, est: p.est, nord: p.nord, altitude: p.altitude });
    expect(csv.points.map(sansLigne)).toEqual(txt.points.map(sansLigne));
  });
});

describe('lirePoints - lignes illisibles', () => {
  it('signale une ligne TXT illisible avec son numéro, et lit les autres', () => {
    const texte = 'p1\t100.000\t200.000\t10.000\np2\t100.000\tabc\t10.000\np3\t101.000\t201.000\t11.000';
    const resultat = lirePoints(texte);
    expect(resultat.points.map((p) => p.nom)).toEqual(['p1', 'p3']);
    expect(resultat.erreurs).toEqual([{ ligne: 2, message: 'point « p2 » : Nord illisible(s)' }]);
  });

  it('signale une ligne TXT incomplète', () => {
    const resultat = lirePoints('p1\t100.000\t200.000');
    expect(resultat.erreurs[0].ligne).toBe(1);
    expect(resultat.points).toHaveLength(0);
  });

  it('refuse la virgule comme séparateur décimal', () => {
    const resultat = lirePoints('p1\t100,5\t200.000\t10.000');
    expect(resultat.erreurs[0].message).toContain('Est');
  });

  it('ignore les lignes vides', () => {
    const resultat = lirePoints('\np1\t1\t2\t3\n\n');
    expect(resultat.points).toHaveLength(1);
    expect(resultat.erreurs).toEqual([]);
  });

  it('signale une colonne manquante dans un CSV', () => {
    const resultat = lirePoints('Name,Easting,Northing\np1,1,2');
    expect(resultat.erreurs[0].message).toContain('Elevation');
  });

  it('lit un CSV avec une description entre guillemets contenant une virgule', () => {
    const texte = 'Name,Description,Easting,Northing,Elevation\np1,"tas, côté nord",100.5,200.25,10.125';
    const resultat = lirePoints(texte);
    expect(resultat.points[0]).toMatchObject({ nom: 'p1', est: 100.5, nord: 200.25, altitude: 10.125 });
  });

  it('signale les noms en double sans supprimer de point', () => {
    const resultat = lirePoints('p1\t1\t2\t3\np1\t4\t5\t6');
    expect(resultat.points).toHaveLength(2);
    expect(resultat.avertissements[0]).toContain('lignes 1, 2');
  });
});
