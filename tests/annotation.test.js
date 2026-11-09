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
