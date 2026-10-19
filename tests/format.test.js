// Tests de l'affichage des nombres.
import { describe, it, expect } from 'vitest';
import { formaterNombre } from '../src/topo/format.js';

describe('formaterNombre', () => {
  it('arrondit à 3 décimales', () => {
    expect(formaterNombre(1636.1966)).toBe('1636.197');
  });

  it('complète avec des zéros', () => {
    expect(formaterNombre(427.6)).toBe('427.600');
  });

  it('utilise le point comme séparateur décimal', () => {
    expect(formaterNombre(2499349.955)).toBe('2499349.955');
  });
});
