// « Contenu du projet » (0.186.1) : doit s'écrire sans erreur (une variable utilisée trop tôt l'avait laissé vide).
import { describe, it, expect } from 'vitest';
import { blocContenu } from '../src/import/ecran.js';
import { creerProjet } from '../src/projet/projet.js';

describe('blocContenu', () => {
  it('0.193.0 : plus de catégories Contrôle / Levés / Points importés en double ; la gestion est sous le tableau', () => {
    const projet = creerProjet('t');
    const pt = { nom: 'P1', est: 1, nord: 2, altitude: 3 };
    projet.leves.push(
      { id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [pt] },
      { id: 'b', nom: 'B', direct: true, importeLe: '2026-11-02T10:00:00Z', points: [{ ...pt, nom: 'P3' }] },
      { id: 'c', nom: 'C', importeLe: '2026-11-03T10:00:00Z', points: [{ ...pt, nom: 'P2' }] },
    );
    projet.couleursListes = { a: '#ff0000' };
    const html = blocContenu(projet, new Set(), new Set());
    expect(html).not.toContain('data-categorie="leves"');
    expect(html).not.toContain('data-categorie="points"');
    expect(html).not.toContain('data-categorie="controle"');
    expect(html).toContain('data-categorie="tableau-points"');
    expect(html).toContain('Gérer les listes choisies');
    expect(html).toContain('--couleur-liste: #ff0000'); // la liste garde sa couleur
  });

  it('0.191.0 : propose le tableau « Points » (catégories, jour, tri, export)', () => {
    const projet = creerProjet('t');
    projet.leves.push({ id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [{ nom: 'P1', est: 1, nord: 2, altitude: 3, gnss: { prisLe: '2026-11-01T10:00:00Z' } }] });
    const html = blocContenu(projet, new Set(), new Set());
    expect(html).toContain('Points (tableau)');
    expect(html).toContain('data-action="tp-categorie"');
    expect(html).toContain('data-champ="tp-jour"');
    expect(html).toContain('data-action="tp-tri"');
    expect(html).toContain('data-action="tp-exporter"');
    expect(html).toContain('>P1<');
  });
});
