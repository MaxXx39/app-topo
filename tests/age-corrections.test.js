// 0.213.0 : corrections NTRIP trop anciennes (plus de 2 secondes) : récepteur rouge, prise de point bloquée.
import { describe, expect, it } from 'vitest';
import { correctionsTropAnciennes, texteAgeCorrections, LIMITE_AGE_CORRECTIONS_S } from '../src/topo/age-corrections.js';

describe('âge des corrections', () => {
  it('la limite est de 2 secondes', () => {
    expect(LIMITE_AGE_CORRECTIONS_S).toBe(2);
  });

  it('trop ancien seulement au-delà de 2 s', () => {
    expect(correctionsTropAnciennes(1)).toBe(false);
    expect(correctionsTropAnciennes(2)).toBe(false);
    expect(correctionsTropAnciennes(2.1)).toBe(true);
    expect(correctionsTropAnciennes(15)).toBe(true);
  });

  it('âge inconnu : pas bloqué', () => {
    expect(correctionsTropAnciennes(null)).toBe(false);
    expect(correctionsTropAnciennes(undefined)).toBe(false);
    expect(correctionsTropAnciennes(Number.NaN)).toBe(false);
  });

  it('texte arrondi à la seconde', () => {
    expect(texteAgeCorrections(4.6)).toBe('corr. 5 s');
    expect(texteAgeCorrections(null)).toBe('');
  });
});
