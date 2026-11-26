import { describe, it, expect } from 'vitest';
import { appliquerSeuilPrecision, precisionTropMauvaise } from '../src/topo/seuil-precision.js';

describe('seuil de précision 3,5 cm', () => {
  it('H ou V au-dessus de 0,035 = trop mauvais ; 0,035 pile accepté ; null jamais inventé', () => {
    expect(precisionTropMauvaise(0.036, 0.01)).toBe(true);
    expect(precisionTropMauvaise(0.01, 0.0351)).toBe(true);
    expect(precisionTropMauvaise(0.035, 0.035)).toBe(false);
    expect(precisionTropMauvaise(null, null)).toBe(false);
  });
  it('FIXE avec H = 4 cm devient AUTONOME et garde la valeur du récepteur', () => {
    const r = appliquerSeuilPrecision({ qualite: 4, libelleQualite: 'FIXE', precisionH: 0.04, precisionV: 0.02 });
    expect(r.qualite).toBe(1);
    expect(r.libelleQualite).toBe('AUTONOME');
    expect(r.qualiteRecepteur).toBe(4);
  });
  it('FIXE précis ou autre statut : inchangé', () => {
    const fixe = { qualite: 4, precisionH: 0.01, precisionV: 0.02 };
    expect(appliquerSeuilPrecision(fixe)).toBe(fixe);
    const auto = { qualite: 1, precisionH: 0.5 };
    expect(appliquerSeuilPrecision(auto)).toBe(auto);
  });
});
