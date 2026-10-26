// Code qui protège certains réglages (nom de l'appareil, corrections NTRIP).
import { describe, it, expect } from 'vitest';
import { estBonCode } from '../src/outils/code.js';

describe('code des réglages protégés', () => {
  it('accepte 1196, même avec des espaces autour', () => {
    expect(estBonCode('1196')).toBe(true);
    expect(estBonCode(' 1196 ')).toBe(true);
  });

  it('refuse un autre code ou rien', () => {
    expect(estBonCode('1197')).toBe(false);
    expect(estBonCode('')).toBe(false);
    expect(estBonCode(null)).toBe(false);
    expect(estBonCode('11 96')).toBe(false);
  });
});
