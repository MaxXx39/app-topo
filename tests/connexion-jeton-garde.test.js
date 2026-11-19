import { describe, it, expect } from 'vitest';
import { creerConnexion, lireJetonGarde } from '../src/partage/connexion.js';

function fausseMemoire(depart = {}) {
  const m = { ...depart };
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
}

describe('jeton Drive gardé dans le navigateur', () => {
  it('reprend un jeton encore valable sans rien redemander', async () => {
    const memoire = fausseMemoire({ 'topo-jeton-drive': JSON.stringify({ jeton: 'abc', finValidite: Date.now() + 600_000 }) });
    expect(await creerConnexion({ memoire }).obtenirJeton()).toBe('abc');
  });
  it('ignore un jeton périmé ou illisible', () => {
    const vieux = fausseMemoire({ 'topo-jeton-drive': JSON.stringify({ jeton: 'abc', finValidite: Date.now() - 1 }) });
    expect(lireJetonGarde(vieux)).toBeNull();
    expect(lireJetonGarde(fausseMemoire({ 'topo-jeton-drive': 'pas du json' }))).toBeNull();
    expect(lireJetonGarde(null)).toBeNull();
  });
  it('oublier() efface le jeton gardé', () => {
    const memoire = fausseMemoire({ 'topo-jeton-drive': JSON.stringify({ jeton: 'abc', finValidite: Date.now() + 600_000 }) });
    creerConnexion({ memoire }).oublier();
    expect(lireJetonGarde(memoire)).toBeNull();
  });
});
