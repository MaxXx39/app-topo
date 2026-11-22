// Matériel (0.275.0) : PDF et Excel du mois, sauvegarde .zip.
import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { parcVide, ajouterCategorie, ajouterArticle, ajouterChantier } from '../src/materiel/donnees.js';
import { poserAffectation, donneesDuMois } from '../src/materiel/planning.js';
import { pdfDuMois } from '../src/materiel/pdf-mois.js';
import { excelDuMois, serieExcel } from '../src/materiel/excel-mois.js';
import { creerSauvegarde, lireSauvegarde, lireZip, nomSauvegarde } from '../src/materiel/sauvegarde.js';
import { zipper } from '../src/recap/xlsx.js';

function essai() {
  const parc = parcVide();
  const gps = ajouterCategorie(parc, 'Canne GPS');
  const st = ajouterCategorie(parc, 'Station totale');
  const a = ajouterArticle(parc, { numero: '953', categorieId: gps.id, codeCompta: '112' });
  ajouterArticle(parc, { numero: '954', categorieId: gps.id, codeCompta: '112' });
  const s = ajouterArticle(parc, { numero: '811', categorieId: st.id, codeCompta: '104' });
  const pab = ajouterChantier(parc, { numero: '10203', nom: 'OFROU PAB', responsable: 'M. Dupont' });
  const court = ajouterChantier(parc, { numero: '10195', nom: 'Un nom de chantier assez long pour ne pas tenir' });
  poserAffectation(parc, { articleId: a.id, chantierId: pab.id, debut: '2026-10-19', fin: '2026-11-13' });
  poserAffectation(parc, { articleId: a.id, chantierId: court.id, debut: '2026-11-20', fin: '2026-11-20' });
  poserAffectation(parc, { articleId: s.id, chantierId: pab.id, debut: '2026-11-25', fin: '2026-12-10' });
  return parc;
}
const texte = (octets) => new TextDecoder().decode(octets);

describe('PDF du mois', () => {
  it('une page A4 paysage avec le titre et les chantiers', async () => {
    const blob = pdfDuMois(donneesDuMois(essai(), 2026, 11), '2026-11-22');
    const contenu = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(contenu.startsWith('%PDF')).toBe(true);
    expect(contenu.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(contenu).toContain('NOVEMBRE 2026');
    expect(contenu).toContain('10 203 – OFROU PAB'); // « – » codé WinAnsi dans le PDF, relu en windows-1252
    expect(contenu).toContain('M. Dupont');
    expect(contenu).toContain('22.11.2026');
  });
});

describe('Excel du mois', () => {
  it('dates en n° de série Excel', () => {
    expect(serieExcel('2026-11-01')).toBe(46327);
    expect(serieExcel('1900-03-01')).toBe(61);
  });
  it('disposition de l\'ancien fichier : fusions, couleurs, textes', async () => {
    const fichiers = await lireZip(excelDuMois(donneesDuMois(essai(), 2026, 11)));
    const feuille = texte(fichiers.get('xl/worksheets/sheet1.xml'));
    const styles = texte(fichiers.get('xl/styles.xml'));
    const classeur = texte(fichiers.get('xl/workbook.xml'));
    expect(classeur).toContain('name="Novembre 2026"');
    expect(classeur).toContain('_xlnm.Print_Area');
    expect(feuille).toContain('<mergeCell ref="D1:AG1"/>'); // titre au-dessus des 30 jours
    expect(feuille).toContain('<mergeCell ref="D4:P4"/>'); // 953 du 1 au 13
    expect(feuille).toContain('<mergeCell ref="A4:A5"/>'); // catégorie Canne GPS
    expect(feuille).not.toContain('W4:W4'); // une barre d'un jour n'est pas fusionnée
    expect(feuille).toContain('10 203 – OFROU PAB');
    expect(feuille).toContain(' – M. Dupont');
    expect(feuille).toContain('<v>46327</v>');
    expect(feuille).toContain('state="frozen"');
    expect(styles).toContain('formatCode="dd.mm.yyyy"');
    expect(styles).toContain('textRotation="90"');
    expect(styles).toContain(`FF${essai().articles[0].couleur.slice(1)}`);
    // XML bien formé : chaque balise ouverte est fermée (contrôle simple sur les lignes).
    expect((feuille.match(/<row /g) ?? []).length).toBe((feuille.match(/<\/row>/g) ?? []).length);
  });
});

describe('sauvegarde', () => {
  it('aller-retour : parc, photos et documents', async () => {
    const parc = essai();
    parc.modifieLe = '2026-11-22T10:00:00.000Z';
    const octets = creerSauvegarde(parc, [{ id: 'photo-1', nom: 'photo-1.jpg', type: 'image/jpeg', octets: new Uint8Array([1, 2, 3]) }]);
    const relu = await lireSauvegarde(octets);
    expect(relu.parc.articles.map((a) => a.numero)).toEqual(['953', '954', '811']);
    expect(relu.parc.affectations).toHaveLength(3);
    expect(relu.parc.modifieLe).toBe('2026-11-22T10:00:00.000Z');
    expect(relu.fichiers).toEqual([{ id: 'photo-1', nom: 'photo-1.jpg', type: 'image/jpeg', octets: new Uint8Array([1, 2, 3]) }]);
    expect(nomSauvegarde('2026-11-22')).toBe('materiel_sauvegarde_2026-11-22.zip');
  });
  it('refuse un fichier qui n\'est pas une sauvegarde', async () => {
    await expect(lireSauvegarde(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow('pas un fichier .zip');
    await expect(lireSauvegarde(zipper([['autre.txt', new Uint8Array([65])]]))).rejects.toThrow('parc.json manque');
  });
  it('lit aussi un zip compressé (deflate), comme un .xlsx', async () => {
    const zip = zipper([['a.txt', new TextEncoder().encode('bonjour bonjour bonjour')]]);
    // Remplace le contenu stocké par sa version compressée (méthode 8), comme le fait Excel.
    const brut = new TextEncoder().encode('bonjour bonjour bonjour');
    const comprime = new Uint8Array(deflateRawSync(brut));
    const nom = new TextEncoder().encode('a.txt');
    const local = new Uint8Array(30 + nom.length + comprime.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(8, 8, true);
    vl.setUint32(18, comprime.length, true);
    vl.setUint32(22, brut.length, true);
    vl.setUint16(26, nom.length, true);
    local.set(nom, 30);
    local.set(comprime, 30 + nom.length);
    const central = new Uint8Array(46 + nom.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(10, 8, true);
    vc.setUint32(20, comprime.length, true);
    vc.setUint32(24, brut.length, true);
    vc.setUint16(28, nom.length, true);
    vc.setUint32(42, 0, true);
    central.set(nom, 46);
    const finRep = new Uint8Array(22);
    const vf = new DataView(finRep.buffer);
    vf.setUint32(0, 0x06054b50, true);
    vf.setUint16(8, 1, true);
    vf.setUint16(10, 1, true);
    vf.setUint32(12, central.length, true);
    vf.setUint32(16, local.length, true);
    const tout = new Uint8Array([...local, ...central, ...finRep]);
    expect(texte((await lireZip(tout)).get('a.txt'))).toBe('bonjour bonjour bonjour');
    expect(zip.length).toBeGreaterThan(0);
  });
});
