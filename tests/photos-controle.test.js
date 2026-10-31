import { describe, it, expect } from 'vitest';
import { projetVersFichiers, fichiersVersProjet } from '../src/partage/fichiers.js';

describe('photos des points de contrôle (0.105.0)', () => {
  it('l\'image part dans son fichier et revient à la réouverture', () => {
    const projet = { surfaces: [], plansDxf: [], pointsControle: [{ id: 'c1', nom: 'C1' }], photosControle: [{ id: 'ph1', point: 'C1', pointId: 'c1', image: 'data:image/jpeg;base64,AAA', miniature: 'data:image/jpeg;base64,BB' }] };
    const fichiers = projetVersFichiers(projet);
    const dansProjet = [...fichiers.values()].find((f) => f.photosControle);
    expect(dansProjet.photosControle[0].image).toBeNull();
    expect(projet.photosControle[0].image).toBe('data:image/jpeg;base64,AAA'); // projet inchangé
    const relu = fichiersVersProjet(fichiers);
    expect(relu.photosControle[0].image).toBe('data:image/jpeg;base64,AAA');
    expect(relu.photosControle[0].pointId).toBe('c1');
  });
});
