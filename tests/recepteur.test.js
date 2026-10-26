// Couleur du bouton « Récepteur » selon l'état reçu de l'appli Android.
import { describe, it, expect } from 'vitest';
import { couleurRecepteur } from '../src/leve/recepteur.js';

describe('couleurRecepteur', () => {
  const recu = { connecte: true, recu: true };
  it('gris non connecté, vert RTK fixe + inclinaison prête, orange flottant ou inclinaison pas prête, rouge autonome', () => {
    expect(couleurRecepteur(null)).toBe('gris');
    expect(couleurRecepteur({ connecte: false })).toBe('gris');
    expect(couleurRecepteur({ connecte: true, recu: false })).toBe('gris');
    expect(couleurRecepteur({ ...recu, qualite: 4, inclinaisonPrete: true })).toBe('vert');
    expect(couleurRecepteur({ ...recu, qualite: 4, inclinaisonPrete: false })).toBe('orange');
    expect(couleurRecepteur({ ...recu, qualite: 5, inclinaisonPrete: true })).toBe('orange');
    expect(couleurRecepteur({ ...recu, qualite: 1, inclinaisonPrete: true })).toBe('rouge');
  });
});
