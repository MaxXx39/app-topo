import { describe, it, expect } from 'vitest';
import { assemblerLibelles, partDesLibelles, libellesManquants, COULEURS_HABITUELLES, LIBELLES_DEPART } from '../src/leve/libelles.js';

describe('libellés modifiables en Expert (0.105.5)', () => {
  it('sans liste complète : départ + ajoutés comme avant', () => {
    const l = assemblerLibelles({ ajoutes: { lignes: [['XX', 'autre', '#dc2626', '']] } });
    expect(l.lignes.map(([a]) => a)).toContain('HT');
    expect(l.lignes.map(([a]) => a)).toContain('XX');
  });
  it('liste complète : un libellé de départ peut être enlevé ou renommé', () => {
    const l = assemblerLibelles({ complet: { lignes: [['MON', 'mon libellé', '', ''], ['HT', 'haut', '#16a34a', '']] } });
    expect(l.lignes.map(([a]) => a)).toEqual(['MON', 'HT']);
    expect(l.lignes[1][2]).toBe('#4ade80'); // l'ancien vert suit
    expect(l.points.length).toBe(LIBELLES_DEPART.points.length); // les autres sortes restent au départ
  });
  it('enregistrer puis relire donne la même liste', () => {
    const l = assemblerLibelles({});
    l.points = l.points.filter(([a]) => a !== 'RG');
    const relu = assemblerLibelles(partDesLibelles(l));
    expect(relu.points.some(([a]) => a === 'RG')).toBe(false);
  });
  it('libellés manquants recréés d\'après les noms de points', () => {
    const l = assemblerLibelles({ complet: { lignes: [['HT', '', '', '']], points: [], aires: [] } });
    const m = libellesManquants(['L-HT-1-1', 'L-BOR-2-3', 'P-RG-4', 'L-1-3', 'P-5', 'C-Stock-1-1', 'A-ENR-1-2', 'P-RG-5'], l);
    expect(m).toEqual({ lignes: ['BOR'], points: ['RG'], aires: ['ENR'] });
  });
  it('couleurs habituelles par sorte', () => {
    expect(COULEURS_HABITUELLES.lignes).toBe('#ea580c');
  });
});

import { definirLibellesProjet, lireLibelles, lireLibellesDetail, recreerLibellesManquants } from '../src/leve/libelles.js';

describe('libellés par défaut et libellés du projet (0.105.6)', () => {
  it('les libellés du projet s\'ajoutent après ceux par défaut', () => {
    definirLibellesProjet({ lignes: [['ZZ', 'occasionnel', '#dc2626', ''], ['HT', 'doublon', '', '']], points: [], aires: [] });
    const l = lireLibelles();
    expect(l.lignes.at(-1)[0]).toBe('ZZ');
    expect(l.lignes.filter(([a]) => a === 'HT')).toHaveLength(1);
    const detail = lireLibellesDetail().lignes;
    expect(detail.find(([a]) => a === 'HT')[4]).toBe(true);
    expect(detail.find(([a]) => a === 'ZZ')[4]).toBe(false);
    definirLibellesProjet({});
  });
  it('un libellé recréé est pour ce projet seulement', () => {
    definirLibellesProjet({});
    const propres = recreerLibellesManquants(['L-QQQ-1-1', 'P-RG-1']);
    expect(propres.lignes.map(([a]) => a)).toEqual(['QQQ']);
    expect(lireLibellesDetail().lignes.find(([a]) => a === 'QQQ')[4]).toBe(false);
    definirLibellesProjet({});
  });
});
