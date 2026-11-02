import { describe, it, expect } from 'vitest';
import { avecPrefixe, sansPrefixe, PREFIXE_LEVE, PREFIXE_SURFACE } from '../src/topo/surface.js';
import { selectionExport } from '../src/export/choix-export.js';

describe('préfixes fixes (0.104.0)', () => {
  it('sansPrefixe retire le début, majuscules ignorées', () => {
    expect(sansPrefixe('LV-Stock 1', PREFIXE_LEVE)).toBe('Stock 1');
    expect(sansPrefixe('lv-Stock 1', PREFIXE_LEVE)).toBe('Stock 1');
    expect(sansPrefixe('Stock 1', PREFIXE_LEVE)).toBe('Stock 1');
    expect(sansPrefixe('Surf-Dessin 2', PREFIXE_SURFACE)).toBe('Dessin 2');
  });
  it('le préfixe est toujours remis', () => {
    expect(avecPrefixe(sansPrefixe('Stock 1', PREFIXE_LEVE), PREFIXE_LEVE)).toBe('LV-Stock 1');
    expect(avecPrefixe('Surf-A', PREFIXE_SURFACE)).toBe('Surf-A');
  });
});

describe('Quoi exporter (cases)', () => {
  it('une case touchée l\'emporte sur « comme le plan »', () => {
    const groupes = [{ titre: 'T', elements: [{ id: 'a', nom: 'A', defaut: true }, { id: 'b', nom: 'B', defaut: false }] }];
    expect([...selectionExport(groupes, new Map())]).toEqual(['a']);
    expect([...selectionExport(groupes, new Map([['a', false], ['b', true]]))]).toEqual(['b']);
  });
});
