import { describe, it, expect } from 'vitest';
import { ajouterAnnotation, nomProposeAnnotation, dernierAnnotation, listeAnnotationDuJour, nomListeAnnotation, precisionSuffisante, nettoyerRemarques, supprimerAnnotation, trouverAnnotation } from '../src/topo/annotation.js';
import { prefixerNoms } from '../src/projet/projet.js';

const projetVide = () => ({ leves: [], surfaces: [], autres: [], metres: [], reseaux: [] });
const jour = new Date(2026, 10, 9, 10, 0);

describe('annotations', () => {
  it('liste du jour : Annot-AAAAMMJJ, créée une seule fois', () => {
    const projet = projetVide();
    const a = listeAnnotationDuJour(projet, jour);
    expect(a.nom).toBe('Annot-20261109');
    expect(listeAnnotationDuJour(projet, jour)).toBe(a);
    expect(projet.leves[0].nom).toBe('Annot-20261109');
    expect(nomListeAnnotation(jour)).toBe('Annot-20261109');
  });

  it('points A-1, A-2…, remarques nettoyées, photos rattachées', () => {
    const projet = projetVide();
    const r1 = ajouterAnnotation(projet, { est: 2500000, nord: 1100000, altitude: null, source: 'loupe', remarques: [' fissure ', '', 'à revoir'], photos: [{ id: 'p1' }] }, new Set(), jour);
    const r2 = ajouterAnnotation(projet, { est: 2500001, nord: 1100001, altitude: 400, source: 'gnss', precision: 0.02 }, new Set(), jour);
    expect(r1.point.nom).toBe('Annot-1');
    expect(r1.point.annotation.remarques).toEqual(['fissure', 'à revoir']);
    expect(r2.point.nom).toBe('Annot-2');
    expect(r1.liste.photos).toEqual([{ id: 'p1', point: 'Annot-1' }]);
    expect(r1.liste.points).toEqual(['Annot-1', 'Annot-2']);
  });

  it('un nom déjà pris est sauté', () => {
    const r = ajouterAnnotation(projetVide(), { est: 1, nord: 2, source: 'loupe' }, new Set(['Annot-1']), jour);
    expect(r.point.nom).toBe('Annot-2');
  });

  it('précision de la tablette : 3 m au plus', () => {
    expect(precisionSuffisante(2.9)).toBe(true);
    expect(precisionSuffisante(3)).toBe(true);
    expect(precisionSuffisante(3.1)).toBe(false);
    expect(precisionSuffisante(null)).toBe(false);
    expect(precisionSuffisante(4, 5)).toBe(true);
  });

  it('supprimer un point retire aussi ses photos', () => {
    const projet = projetVide();
    ajouterAnnotation(projet, { est: 1, nord: 2, source: 'loupe', photos: [{ id: 'p1' }] }, new Set(), jour);
    expect(trouverAnnotation(projet, 'Annot-1')).not.toBeNull();
    expect(supprimerAnnotation(projet, 'Annot-1')).toBe(true);
    expect(projet.autres[0].photos).toEqual([]);
    expect(supprimerAnnotation(projet, 'Annot-1')).toBe(false);
  });

  it('le préfixe « Anot- » est gardé à l\'ouverture (jamais LV-)', () => {
    const projet = projetVide();
    projet.surfaces = [];
    listeAnnotationDuJour(projet, jour);
    prefixerNoms(projet);
    expect(projet.autres[0].nom).toBe('Annot-20261109');
    expect(nettoyerRemarques(['a ', ' '])).toEqual(['a']);
  });

  it('nom tapé à la main : gardé, refusé s\'il existe déjà', () => {
    const projet = projetVide();
    const a = ajouterAnnotation(projet, { est: 1, nord: 2, source: 'loupe', nom: ' Mur nord ' }, new Set(), jour);
    expect(a.point.nom).toBe('Mur nord');
    expect(ajouterAnnotation(projet, { est: 1, nord: 2, source: 'loupe', nom: 'Mur nord' }, new Set(['Mur nord']), jour).erreur).toMatch(/existe déjà/);
    expect(nomProposeAnnotation(projet)).toBe('Annot-1');
  });

  it('dernier point = le plus récent ; les anciens A-n comptent dans la numérotation', () => {
    const projet = projetVide();
    ajouterAnnotation(projet, { est: 1, nord: 2, source: 'loupe' }, new Set(), new Date(2026, 10, 9, 10));
    ajouterAnnotation(projet, { est: 3, nord: 4, source: 'loupe' }, new Set(), new Date(2026, 10, 9, 11));
    expect(dernierAnnotation(projet).nom).toBe('Annot-2');
    projet.leves[0].points.push({ nom: 'A-7', est: 0, nord: 0, annotation: { le: '2026-11-08T00:00:00Z' } });
    expect(nomProposeAnnotation(projet)).toBe('Annot-8');
  });

  it('une liste « Anot-… » d\'avant est renommée « Annot-… » à l\'ouverture', () => {
    const projet = projetVide();
    const liste = listeAnnotationDuJour(projet, jour);
    liste.nom = 'Anot-20261108';
    prefixerNoms(projet);
    expect(liste.nom).toBe('Annot-20261108');
  });
});

import { cheminForme, formeEnTrait } from '../src/plan/formes.js';
import { csvPoints, infosAnnotation, avecAnnotation } from '../src/export/points.js';
import { genererDxf } from '../src/export/dxf.js';
import { pdfPoints } from '../src/export/pdf-points.js';

describe('annotations : nuage et exports', () => {
  const projet = projetVide();
  const { point } = ajouterAnnotation(projet, { est: 2500000, nord: 1100000, altitude: null, source: 'tablette', precision: 2.4, remarques: ['fissure', 'à revoir'] }, new Set(), jour);

  it('le nuage est un rond tracé à la main, en trait fin, de 14 px environ', () => {
    const d = cheminForme('nuage', 100, 100, 5);
    expect(d).toMatch(/^M/);
    const xs = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(16);
    expect(formeEnTrait('nuage')).toBe(true);
  });

  it('CSV : colonnes propres, remarques séparées par « | »', () => {
    expect(avecAnnotation([point])).toBe(true);
    const lignes = csvPoints([point]).trim().split('\r\n');
    expect(lignes[0]).toBe('Nom;Est (m);Nord (m);Altitude (m);Date;Heure;Prise;Précision (m);Remarques');
    expect(lignes[1]).toContain('GPS tablette;2.40;fissure | à revoir');
    expect(infosAnnotation(point)[2]).toBe('1100000.000');
  });

  it('DXF : les remarques sont sur le calque ANNOT_REMARQUES', () => {
    const dxf = genererDxf({ points: [point] });
    expect(dxf).toContain('ANNOT_REMARQUES');
    expect(dxf).toContain('fissure | à revoir');
  });

  it('PDF : se fabrique avec les colonnes des annotations', async () => {
    const blob = pdfPoints({ titre: 'Annot-20261109', points: [point] });
    expect(blob.size).toBeGreaterThan(500);
  });
});

import { htmlEncadreAnnotation } from '../src/annotation/encadre.js';
describe('encadré d\'une annotation', () => {
  it('montre le nom, les remarques et les photos, et échappe le texte', () => {
    const html = htmlEncadreAnnotation({ nom: 'Pt<1>', date: '09.11.2026 10:00', remarques: ['a & b'], photos: [{ id: 'p1', miniature: 'x.jpg' }] });
    expect(html).toContain('Pt&lt;1&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('data-id="p1"');
  });
});
