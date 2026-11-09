import { describe, it, expect } from 'vitest';
import { ajouterAnnotation, listeAnnotationDuJour, nomListeAnnotation, precisionSuffisante, nettoyerRemarques, supprimerAnnotation, trouverAnnotation } from '../src/topo/annotation.js';
import { prefixerNoms } from '../src/projet/projet.js';

const projetVide = () => ({ leves: [], surfaces: [], autres: [], metres: [], reseaux: [] });
const jour = new Date(2026, 10, 9, 10, 0);

describe('annotations', () => {
  it('liste du jour : Anot-AAAAMMJJ, créée une seule fois', () => {
    const projet = projetVide();
    const a = listeAnnotationDuJour(projet, jour);
    expect(a.nom).toBe('Anot-20261109');
    expect(listeAnnotationDuJour(projet, jour)).toBe(a);
    expect(projet.leves[0].nom).toBe('Anot-20261109');
    expect(nomListeAnnotation(jour)).toBe('Anot-20261109');
  });

  it('points A-1, A-2…, remarques nettoyées, photos rattachées', () => {
    const projet = projetVide();
    const r1 = ajouterAnnotation(projet, { est: 2500000, nord: 1100000, altitude: null, source: 'loupe', remarques: [' fissure ', '', 'à revoir'], photos: [{ id: 'p1' }] }, new Set(), jour);
    const r2 = ajouterAnnotation(projet, { est: 2500001, nord: 1100001, altitude: 400, source: 'gnss', precision: 0.02 }, new Set(), jour);
    expect(r1.point.nom).toBe('A-1');
    expect(r1.point.annotation.remarques).toEqual(['fissure', 'à revoir']);
    expect(r2.point.nom).toBe('A-2');
    expect(r1.liste.photos).toEqual([{ id: 'p1', point: 'A-1' }]);
    expect(r1.liste.points).toEqual(['A-1', 'A-2']);
  });

  it('un nom déjà pris est sauté', () => {
    const r = ajouterAnnotation(projetVide(), { est: 1, nord: 2, source: 'loupe' }, new Set(['A-1']), jour);
    expect(r.point.nom).toBe('A-2');
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
    expect(trouverAnnotation(projet, 'A-1')).not.toBeNull();
    expect(supprimerAnnotation(projet, 'A-1')).toBe(true);
    expect(projet.autres[0].photos).toEqual([]);
    expect(supprimerAnnotation(projet, 'A-1')).toBe(false);
  });

  it('le préfixe « Anot- » est gardé à l\'ouverture (jamais LV-)', () => {
    const projet = projetVide();
    projet.surfaces = [];
    listeAnnotationDuJour(projet, jour);
    prefixerNoms(projet);
    expect(projet.autres[0].nom).toBe('Anot-20261109');
    expect(nettoyerRemarques(['a ', ' '])).toEqual(['a']);
  });
});
