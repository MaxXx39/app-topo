// Tests de la liste à cocher des exports.
import { describe, it, expect } from 'vitest';
import { selectionExport } from '../src/export/choix-export.js';

describe('quoi exporter', () => {
  const groupes = [
    { titre: 'Surfaces', elements: [{ id: 's1', nom: 'Stock 1', defaut: true }, { id: 's2', nom: 'Stock 2', defaut: false }] },
    { titre: 'Dessins', elements: [{ id: 'd1', nom: 'Dessin 1', defaut: true }] },
  ];
  it('part de ce qui est affiché', () => {
    expect([...selectionExport(groupes, new Map())]).toEqual(['s1', 'd1']);
  });
  it('les cases touchées l\'emportent', () => {
    expect([...selectionExport(groupes, new Map([['s1', false], ['s2', true]]))]).toEqual(['s2', 'd1']);
  });
});
