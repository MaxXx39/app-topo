import { describe, it, expect } from 'vitest';
import { htmlLame } from '../src/leve/lame-ecran.js';

// 0.117.3 : une surface choisie puis supprimée (ou venant d'un autre projet) ne doit pas
// empêcher de choisir la seule surface qui reste : « — choisir — » revient en tête de liste.
describe('liste des surfaces avec un choix oublié', () => {
  const donnees = (surfaceId) => ({ surfaces: [{ id: 'a', etiquette: 'LV-Terrain 1' }], surfaceId, tolerances: {}, machine: 'grader' });

  it('propose « — surface à suivre — » quand la surface choisie n\'existe plus', () => {
    const html = htmlLame(donnees('supprimee'));
    expect(html).toContain('— surface à suivre —');
  });

  it('ne le propose plus quand la surface choisie existe', () => {
    const html = htmlLame(donnees('a'));
    expect(html).not.toContain('— surface à suivre —');
  });
});
