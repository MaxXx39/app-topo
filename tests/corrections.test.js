// Tests du texte de l'état des corrections par internet.
import { describe, it, expect } from 'vitest';
import { etatCorrections, formaterOctets } from '../src/leve/corrections.js';

describe('état des corrections', () => {
  it('arrêtées : par Emlid Flow ; reçues : quantité ; trop vieilles : attente', () => {
    expect(etatCorrections(null).texte).toBe('par Emlid Flow');
    expect(etatCorrections({ etat: 'recoit', octets: 12500, age: 1 })).toEqual({ texte: 'swipos direct · 13 ko', classe: 'ok' });
    expect(etatCorrections({ etat: 'recoit', octets: 12500, age: 15 }).classe).toBe('attente');
    expect(etatCorrections({ etat: 'erreur', message: 'identifiant ou mot de passe refusé' })).toEqual({ texte: 'identifiant ou mot de passe refusé', classe: 'erreur' });
  });

  it('octets', () => {
    expect(formaterOctets(850)).toBe('850 o');
    expect(formaterOctets(1_400_000)).toBe('1.4 Mo');
  });
});
