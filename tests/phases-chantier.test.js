import { describe, it, expect } from 'vitest';
import { deplacerPhase, dupliquerPhase, renommerPhase } from '../src/topo/phases-chantier.js';

const plan = () => ({ phases: [{ id: 'a', nom: 'A', couleur: '#111', visible: true }, { id: 'b', nom: 'B', couleur: '#222', visible: true }], phaseActive: 'a', objets: [{ id: 'o1', phase: 'a', type: 'ligne' }, { id: 'o2', phase: 'b', type: 'ligne' }] });

describe('phases d\'un plan de chantier (0.338.0)', () => {
  it('monter / descendre une phase, sans sortir de la liste', () => {
    const p = plan();
    expect(deplacerPhase(p, 'b', -1)).toBe(true);
    expect(p.phases.map((x) => x.id)).toEqual(['b', 'a']);
    expect(deplacerPhase(p, 'b', -1)).toBe(false);
    expect(deplacerPhase(p, 'a', 1)).toBe(false);
  });
  it('dupliquer : copie juste après, avec ses éléments (nouveaux identifiants)', () => {
    const p = plan();
    const c = dupliquerPhase(p, 'a');
    expect(p.phases.map((x) => x.nom)).toEqual(['A', 'A (copie)', 'B']);
    expect(p.phaseActive).toBe(c.id);
    const copies = p.objets.filter((o) => o.phase === c.id);
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe('o1');
    expect(p.objets.filter((o) => o.phase === 'a')).toHaveLength(1); // l'original reste
    expect(dupliquerPhase(p, 'inconnue')).toBeNull();
  });
  it('renommer : texte vide refusé', () => {
    const p = plan();
    expect(renommerPhase(p, 'a', '  Terrassement  ')).toBe(true);
    expect(p.phases[0].nom).toBe('Terrassement');
    expect(renommerPhase(p, 'a', '   ')).toBe(false);
  });
});
