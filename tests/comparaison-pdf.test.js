// Comparer des PDF (0.282.0) : masques, superposition, zones modifiées, textes avant → après, appariements, mesures.
import { describe, it, expect } from 'vitest';
import {
  appliquerAlignement, matriceAlignement, composer, masqueEncre, dilater, superposer, detecterZones, genreDeZone,
  differencesTextes, listerModifications, titreModification, apparierPages, motsDeLaPage, nomSansIndice, apparierFichiers,
  mesurerLongueur, mesurerSurface, etalonner, arcsDeNuage, texteWinAnsi, poseDeB, alignementDepuisSimilitude,
} from '../src/topo/comparaison-pdf.js';

// Masque w × h avec des rectangles d'encre.
function masque(w, h, rects) {
  const m = new Uint8Array(w * h);
  for (const [x, y, l, H] of rects) for (let j = y; j < y + H; j += 1) for (let i = x; i < x + l; i += 1) m[j * w + i] = 1;
  return m;
}

describe('alignement', () => {
  it('point et matrice', () => {
    const al = { x: 10, y: 5, s: 2, r: 90 };
    const [x, y] = appliquerAlignement(al, [1, 0]);
    expect(x).toBeCloseTo(10, 9);
    expect(y).toBeCloseTo(7, 9);
    const m = composer(matriceAlignement(al), [1, 0, 0, 1, 1, 0]);
    expect(m[4]).toBeCloseTo(10, 9);
    expect(m[5]).toBeCloseTo(7, 9);
    expect(alignementDepuisSimilitude({ echelle: 1, rotationDeg: 359, tx: 3.5, ty: 0 }, 0.5).r).toBeCloseTo(-1, 9);
  });
});

describe('masques et superposition', () => {
  it('encre : pixel non blanc', () => {
    expect([...masqueEncre(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 200, 200, 200, 0]))]).toEqual([0, 1, 0]);
  });
  it('dilater de 1 px', () => {
    const d = dilater(masque(5, 5, [[2, 2, 1, 1]]), 5, 5, 1);
    expect(d.reduce((a, b) => a + b, 0)).toBe(9);
  });
  it('identique gris, A seul rouge, B seul bleu (tolérance 1 px)', () => {
    const A = masque(10, 3, [[0, 1, 3, 1], [6, 1, 1, 1]]);
    const B = masque(10, 3, [[1, 1, 3, 1], [9, 1, 1, 1]]);
    const img = superposer(A, B, 10, 3, 1, { a: [220, 38, 38], b: [37, 99, 235], identique: [150, 150, 150] });
    const px = (x, y) => [...img.slice(4 * (y * 10 + x), 4 * (y * 10 + x) + 3)];
    expect(px(0, 1)).toEqual([150, 150, 150]);
    expect(px(6, 1)).toEqual([220, 38, 38]);
    expect(px(9, 1)).toEqual([37, 99, 235]);
    expect(px(5, 0)).toEqual([255, 255, 255]);
  });
});

describe('zones modifiées', () => {
  const w = 200;
  const h = 100;
  const commun = [[10, 10, 150, 1], [10, 10, 1, 80]];
  const A = masque(w, h, [...commun, [40, 40, 10, 10], [150, 80, 5, 5]]);
  const B = masque(w, h, [...commun, [60, 40, 10, 10], [180, 20, 5, 5]]);
  it('deux zones proches regroupées, une éloignée à part', () => {
    const z = detecterZones(A, B, w, h, { r: 1, cellule: 4, ecart: 3, minPixels: 5 });
    expect(z).toHaveLength(3);
    const grande = z.find((q) => q.x <= 40 && q.x + q.w >= 70);
    expect(genreDeZone(grande)).toBe('modif');
  });
  it('zone à ignorer et cadre de la feuille', () => {
    const z = detecterZones(A, B, w, h, { r: 1, cellule: 4, ecart: 3, minPixels: 5, masques: [{ x: 140, y: 0, w: 60, h: 100 }] });
    expect(z).toHaveLength(1);
    const avecCadre = masque(w, h, [...commun, [0, 98, 200, 1]]);
    expect(detecterZones(masque(w, h, commun), avecCadre, w, h, { cellule: 4, cadre: { bord: 5, fin: 6, long: 100 } })).toHaveLength(0);
  });
  it('genres', () => {
    expect(genreDeZone({ supprimes: 10, ajoutes: 0 })).toBe('suppr');
    expect(genreDeZone({ supprimes: 0, ajoutes: 4 })).toBe('ajout');
    expect(genreDeZone({ supprimes: 100, ajoutes: 2 })).toBe('suppr');
  });
});

describe('textes avant → après', () => {
  const t = (txt, x, y) => ({ t: txt, x, y, w: 20, h: 8 });
  it('cote modifiée, texte supprimé, texte ajouté, texte inchangé', () => {
    const d = differencesTextes([t('2.50', 100, 100), t('BA C25/30', 300, 50), t('Axe 6', 10, 10)], [t('2.65', 101, 100), t('Axe 6', 10, 10), t('Note 3', 500, 500)]);
    expect(d).toEqual([
      expect.objectContaining({ genre: 'modif', avant: '2.50', apres: '2.65' }),
      expect.objectContaining({ genre: 'suppr', avant: 'BA C25/30' }),
      expect.objectContaining({ genre: 'ajout', apres: 'Note 3' }),
    ]);
  });
  it('liste numérotée : un texte dans une zone lui est rattaché', () => {
    const zones = [{ x: 90, y: 90, w: 40, h: 30, supprimes: 5, ajoutes: 6 }];
    const textes = [{ genre: 'modif', avant: '2.50', apres: '2.65', x: 100, y: 100, w: 20, h: 8 }, { genre: 'ajout', avant: '', apres: 'Note', x: 10, y: 10, w: 10, h: 5 }];
    const l = listerModifications(zones, textes);
    expect(l.map((m) => m.n)).toEqual([1, 2]);
    expect(l[1].textes).toEqual([{ avant: '2.50', apres: '2.65' }]);
    expect(titreModification(l[1])).toBe('Texte / cote modifié');
    expect(titreModification(l[0])).toBe('Ajout');
  });
});

describe('appariements', () => {
  it('pages par leurs mots (ordre changé), puis par rang', () => {
    const A = [motsDeLaPage(['Coffrage dalle rez', 'Plan 01']), motsDeLaPage(['Armature radier', 'Plan 02']), motsDeLaPage(['Divers'])];
    const B = [motsDeLaPage(['Armature radier', 'Plan 02 indice D']), motsDeLaPage(['Coffrage dalle rez', 'Plan 01 indice D']), motsDeLaPage(['Autre'])];
    expect(apparierPages(A, B)).toEqual([{ a: 1, b: 2 }, { a: 2, b: 1 }, { a: 3, b: 3 }]);
  });
  it('noms sans indice et dossiers', () => {
    expect(nomSansIndice('Coffrage_rez_C.pdf')).toBe('coffrage rez');
    expect(nomSansIndice('2629-12 ind. D.pdf')).toBe('2629 12');
    expect(nomSansIndice('Plan B2.pdf')).toBe('plan');
    expect(apparierFichiers(['Coffrage_rez_C.pdf', 'Radier_C.pdf'], ['Radier_D.pdf', 'Coffrage_rez_D.pdf', 'Neuf_A.pdf'])).toEqual([
      { a: 'Coffrage_rez_C.pdf', b: 'Coffrage_rez_D.pdf' }, { a: 'Radier_C.pdf', b: 'Radier_D.pdf' }, { a: null, b: 'Neuf_A.pdf' },
    ]);
  });
});

describe('mesures et rapport', () => {
  it('longueur, surface, étalonnage', () => {
    expect(mesurerLongueur([0, 0], [72, 0]).papierMm).toBeCloseTo(25.4, 9);
    const k = etalonner([0, 0], [100, 0], 5);
    expect(k).toBe(0.05);
    expect(mesurerLongueur([0, 0], [0, 40], k).reelleM).toBeCloseTo(2, 9);
    expect(mesurerSurface([[0, 0], [100, 0], [100, 100], [0, 100]], k).reelleM2).toBeCloseTo(25, 9);
  });
  it('nuage : des arcs sur les 4 côtés', () => {
    expect(arcsDeNuage({ x: 0, y: 0, w: 48, h: 24 }, 12)).toHaveLength(12);
  });
  it('texte pour le PDF et pose de la page B', () => {
    expect(texteWinAnsi('2.50 → 2.65 − ok')).toBe('2.50 -> 2.65 - ok');
    expect(poseDeB({ x: 0, y: 0, s: 1, r: 0 }, 842, 842)).toEqual({ x: 0, y: 0, echelle: 1, rotationDeg: -0 });
    const p = poseDeB({ x: 10, y: -5, s: 1, r: 0 }, 842, 842);
    expect([p.x, p.y]).toEqual([10, 5]);
  });
});

import { projetVersFichiers, fichiersVersProjet, sansContenu } from '../src/partage/fichiers.js';
import { creerHistorique, memoriser, annuler } from '../src/projet/historique.js';

describe('rangement des PDF des comparaisons', () => {
  const projet = () => ({ id: 'p', comparaisons: [{ id: 'c1', nom: 'Coffrage', fichiers: [{ id: 'f1', cote: 'A', nom: 'a.pdf', donnees: 'JVBERi0xLjQ=' }] }] });
  it('Drive : chaque PDF dans son fichier, remis à la relecture', () => {
    const f = projetVersFichiers(projet());
    expect(f.get('projet.json.gz').comparaisons[0].fichiers[0].donnees).toBeNull();
    expect(f.get('pdf-f1.json.gz')).toEqual({ donnees: 'JVBERi0xLjQ=' });
    expect(fichiersVersProjet(f).comparaisons[0].fichiers[0].donnees).toBe('JVBERi0xLjQ=');
    expect(sansContenu('pdf-f1.json.gz', { donnees: null })).toBe(true);
  });
  it('historique : le PDF n\'est pas recopié à chaque étape mais revient à l\'annulation', () => {
    const h = creerHistorique();
    const p = projet();
    memoriser(h, p);
    expect(h.actuel).not.toContain('JVBERi0xLjQ=');
    p.comparaisons[0].nom = 'Coffrage rez';
    memoriser(h, p);
    expect(annuler(h).comparaisons[0].fichiers[0].donnees).toBe('JVBERi0xLjQ=');
  });
});
