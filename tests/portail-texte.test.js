// 0.320.6 : texte sous le portail = sous le bas de la boîte du symbole.
import { describe, it, expect } from 'vitest';
import { portailDynamique } from '../src/topo/portail-dynamique.js';

describe('portail : texte sous le bloc', () => {
  it('la boîte du portail a un bas (yMin) pour y poser le texte', () => {
    const p = portailDynamique({ genre: 'portail', passage: 5 });
    expect(p.boite).toBeTruthy(); // [xMin, yMin, xMax, yMax]
    expect(p.boite.length).toBe(4);
  });
});
