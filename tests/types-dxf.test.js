import { describe, it, expect, beforeEach } from 'vitest';
import { nettoyerTypes, lireTypesDxf, couleurDuType, TYPES_DXF_DEPART } from '../src/topo/types-dxf.js';
import { nettoyerListes, fusionnerListes } from '../src/reglages/listes-partagees.js';

describe('types de plans DXF (0.194.0)', () => {
  it('liste de départ : GEOOFF, GEOPERRIN, TER, CANA, Autres, chacun sa couleur', () => {
    const types = lireTypesDxf({});
    expect(types.map((t) => t.nom)).toEqual(TYPES_DXF_DEPART);
    expect(new Set(types.map((t) => t.couleur)).size).toBe(5);
  });

  it('nettoyage : virgules ou lignes, sans doublon ni vide', () => {
    expect(nettoyerTypes('TER, cana ;\nTER,  , GEO')).toEqual(['TER', 'cana', 'GEO']);
    expect(nettoyerTypes(['A', 'a', ' B '])).toEqual(['A', 'B']);
  });

  it('la liste partagée remplace celle de départ ; un type inconnu est gris', () => {
    const types = lireTypesDxf({ typesDxf: ['EAU', 'GAZ'] });
    expect(types.map((t) => t.nom)).toEqual(['EAU', 'GAZ']);
    expect(couleurDuType('XYZ', types)).toBe('#6b7280');
  });

  it('partagée par Drive : gardée, fusionnée par sa date', () => {
    const local = { typesDxf: ['A'], dates: { typesDxf: '2026-11-10T08:00:00Z' } };
    const distant = { typesDxf: ['A', 'B'], dates: { typesDxf: '2026-11-10T09:00:00Z' } };
    expect(nettoyerListes(local).typesDxf).toEqual(['A']);
    expect(fusionnerListes(local, distant).listes.typesDxf).toEqual(['A', 'B']);
  });
});
