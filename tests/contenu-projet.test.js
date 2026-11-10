// « Contenu du projet » (0.186.1) : doit s'écrire sans erreur (une variable utilisée trop tôt l'avait laissé vide).
import { describe, it, expect } from 'vitest';
import { blocContenu } from '../src/import/ecran.js';
import { creerProjet } from '../src/projet/projet.js';

describe('blocContenu', () => {
  it('écrit les listes de points, triées par date, et filtre par jour', () => {
    const projet = creerProjet('t');
    projet.leves.push(
      { id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', jour: '2026-11-01', points: [] },
      { id: 'b', nom: 'B', direct: true, importeLe: '2026-11-05T10:00:00Z', jour: '2026-11-05', points: [] },
      { id: 'c', nom: 'C', importeLe: '2026-11-03T10:00:00Z', points: [] },
    );
    const html = blocContenu(projet, new Set(), new Set());
    expect(html).toContain('Levés');
    expect(html.indexOf('value="B"')).toBeLessThan(html.indexOf('value="A"'));
    const ancien = blocContenu(projet, new Set(), new Set(), { ordre: 'ancien', jour: '' });
    expect(ancien.indexOf('value="A"')).toBeLessThan(ancien.indexOf('value="B"'));
    const jour = blocContenu(projet, new Set(), new Set(), { ordre: 'recent', jour: '2026-11-01' });
    expect(jour).toContain('value="A"');
    expect(jour).not.toContain('value="B"');
  });
});
