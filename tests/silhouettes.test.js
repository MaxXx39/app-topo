// Silhouettes des machines dans les coupes du Guidage (0.155.0).
import { describe, it, expect } from 'vitest';
import { silhouetteOutil } from '../src/leve/silhouettes.js';

describe('silhouetteOutil', () => {
  it('pose le dessin au bon endroit, tourné et à l\'échelle', () => {
    const svg = silhouetteOutil('grader', 'gd', { x: 150, y: 120, angle: 5.7, echelle: 1.25 });
    expect(svg).toContain('translate(150.0 120.0) rotate(5.70) scale(1.250)');
    expect(svg).toContain('silhouette-outil');
  });
  it('les 3 machines et les 2 vues existent ; machine inconnue : rien', () => {
    for (const machine of ['grader', 'bull', 'rateau']) for (const vue of ['gd', 'long']) expect(silhouetteOutil(machine, vue, { x: 0, y: 0 })).not.toBe('');
    expect(silhouetteOutil('pelle', 'gd', { x: 0, y: 0 })).toBe('');
  });
});
