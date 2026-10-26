// Réglages de cet appareil : mode Base / Confirmé (gardé dans la mémoire du navigateur).
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Petite mémoire du navigateur pour les tests (Node n'a pas de localStorage).
function memoire(contenu = {}) {
  const donnees = { ...contenu };
  return {
    getItem: (cle) => donnees[cle] ?? null,
    setItem: (cle, valeur) => {
      donnees[cle] = String(valeur);
    },
  };
}

// Le mode est gardé dans le module : on le recharge à chaque test.
async function chargerReglages(contenu) {
  globalThis.localStorage = memoire(contenu);
  vi.resetModules();
  return import('../src/reglages/reglages.js');
}

describe('mode Base / Confirmé', () => {
  beforeEach(() => {
    delete globalThis.localStorage;
  });

  it('appareil neuf : mode Confirmé', async () => {
    const { lireReglages, estModeBase } = await chargerReglages({});
    expect(lireReglages().mode).toBe('confirme');
    expect(estModeBase()).toBe(false);
  });

  it('mode Base retenu', async () => {
    const { estModeBase } = await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'base' }) });
    expect(estModeBase()).toBe(true);
  });

  it('anciens réglages (sans mode) : Confirmé, mode téléphone gardé', async () => {
    const { lireReglages } = await chargerReglages({ 'topo-reglages': JSON.stringify({ telephone: true }) });
    expect(lireReglages()).toEqual({ telephone: true, mode: 'confirme' });
  });

  it('mémoire illisible : Confirmé', async () => {
    const { estModeBase } = await chargerReglages({ 'topo-reglages': '{illisible' });
    expect(estModeBase()).toBe(false);
  });
});
