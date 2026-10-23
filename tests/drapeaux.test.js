// Tests des drapeaux du début (vert) et de la fin (damier) d'une ligne à implanter.
import { describe, it, expect } from 'vitest';
import { svgDrapeau } from '../src/outils/drapeaux.js';

describe('drapeaux', () => {
  it('début : un drapeau vert ; fin : un damier de 8 cases', () => {
    expect(svgDrapeau('debut', 0, 0, 22)).toContain('#16a34a');
    const fin = svgDrapeau('fin', 0, 0, 22);
    expect(fin.match(/<rect /g)).toHaveLength(9); // 8 cases + le bord
    expect(fin).toContain('#111827');
  });
});
