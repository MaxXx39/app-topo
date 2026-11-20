// Appareil photo sous Windows : reconnaît le bouton photo touché (le champ ou son « label »).
import { describe, it, expect } from 'vitest';
import { champPhotoTouche } from '../src/outils/camera-windows.js';

describe('champPhotoTouche', () => {
  const champ = { id: 'champ' };
  it('trouve le champ quand on touche le bouton (label)', () => {
    const etiquette = { querySelector: () => champ };
    const icone = { closest: (sel) => (sel === 'label' ? etiquette : null) };
    expect(champPhotoTouche(icone)).toBe(champ);
  });
  it('trouve le champ touché directement', () => {
    expect(champPhotoTouche({ closest: (sel) => (sel.startsWith('input') ? champ : null) })).toBe(champ);
  });
  it('ignore les autres boutons et les cibles vides', () => {
    expect(champPhotoTouche({ closest: () => null })).toBe(null);
    expect(champPhotoTouche(null)).toBe(null);
    const etiquette = { querySelector: () => null };
    expect(champPhotoTouche({ closest: (sel) => (sel === 'label' ? etiquette : null) })).toBe(null);
  });
});
