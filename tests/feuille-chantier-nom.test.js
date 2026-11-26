import { describe, it, expect } from 'vitest';
import { nomChantierCartouche, situationDe, reglagesFeuille } from '../src/topo/feuille-chantier.js';

describe('cartouche et situation (0.329.0)', () => {
  it('nom du chantier : celui tapé, sinon « affaire - désignation »', () => {
    expect(nomChantierCartouche({ affaire: '10 203', lieu: 'Gland, plateforme' }, 'Projet')).toBe('10 203 - Gland, plateforme');
    expect(nomChantierCartouche({ affaire: '10 203' }, 'Projet')).toBe('10 203');
    expect(nomChantierCartouche({}, '10 203 Ofrou')).toBe('10 203 Ofrou');
    expect(nomChantierCartouche({ affaire: '10 203', lieu: 'Gland' }, 'P', '  PIC Gland phase 2 ')).toBe('PIC Gland phase 2');
    expect(nomChantierCartouche(null, '')).toBe('');
  });
  it('situation : transparence 0 à 90 %, épaisseur 0,2 à 3 mm, valeurs de départ inchangées', () => {
    expect(situationDe({})).toMatchObject({ transparence: 0, epaisseur: 0.5 });
    expect(situationDe({ transparence: '60', epaisseur: 1.5 })).toMatchObject({ transparence: 60, epaisseur: 1.5 });
    expect(situationDe({ transparence: 200, epaisseur: 99 })).toMatchObject({ transparence: 90, epaisseur: 3 });
    expect(situationDe({ epaisseur: 0 }).epaisseur).toBe(0.5);
  });
  it('réglages de la feuille : chantier vide au départ', () => {
    expect(reglagesFeuille({}).chantier).toBe('');
    expect(reglagesFeuille({ feuille: { chantier: 'X' } }).chantier).toBe('X');
  });
});
