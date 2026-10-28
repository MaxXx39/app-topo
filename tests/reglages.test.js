// Réglages de cet appareil : mode Base / Intermédiaire / Expert (gardé dans la mémoire du navigateur).
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

describe('modes Base / Intermédiaire / Expert', () => {
  beforeEach(() => {
    delete globalThis.localStorage;
  });

  it('appareil neuf : mode Intermédiaire', async () => {
    const { lireReglages, modeAppli, estModeBase, aAcces } = await chargerReglages({});
    expect(lireReglages().mode).toBe('intermediaire');
    expect(modeAppli()).toBe('intermediaire');
    expect(estModeBase()).toBe(false);
    expect(aAcces('intermediaire')).toBe(true);
    expect(aAcces('expert')).toBe(false);
  });

  it('mode Base retenu : rien au-dessus de Base', async () => {
    const { estModeBase, aAcces } = await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'base' }) });
    expect(estModeBase()).toBe(true);
    expect(aAcces('base')).toBe(true);
    expect(aAcces('intermediaire')).toBe(false);
    expect(aAcces('expert')).toBe(false);
  });

  it('mode Expert retenu : tout est permis', async () => {
    const { aAcces } = await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'expert' }) });
    expect(aAcces('base') && aAcces('intermediaire') && aAcces('expert')).toBe(true);
  });

  it('ancien mode « Confirmé » : devient Expert', async () => {
    const { lireReglages, modeAppli } = await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'confirme', telephone: true }) });
    expect(lireReglages()).toEqual({ telephone: true, mode: 'expert' });
    expect(modeAppli()).toBe('expert');
  });

  it('anciens réglages (sans mode) : Intermédiaire, mode téléphone gardé', async () => {
    const { lireReglages } = await chargerReglages({ 'topo-reglages': JSON.stringify({ telephone: true }) });
    expect(lireReglages()).toEqual({ telephone: true, mode: 'intermediaire' });
  });

  it('onglet Lame : montré en Expert seulement (plus de case dans les réglages)', async () => {
    expect((await chargerReglages({})).lameActive()).toBe(false);
    expect((await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'expert' }) })).lameActive()).toBe(true);
    expect((await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'base' }) })).lameActive()).toBe(false);
  });

  it('mode inconnu ou mémoire illisible : Intermédiaire', async () => {
    expect((await chargerReglages({ 'topo-reglages': JSON.stringify({ mode: 'xyz' }) })).modeAppli()).toBe('intermediaire');
    expect((await chargerReglages({ 'topo-reglages': '{illisible' })).modeAppli()).toBe('intermediaire');
  });
});

describe('changement de mode dans les réglages', () => {
  it('écrire un mode le garde dans la mémoire du navigateur', async () => {
    const reglages = await chargerReglages({});
    const fausseZone = { classList: { toggle() {} }, querySelector: () => null };
    globalThis.document = { body: fausseZone, querySelector: () => null };
    reglages.appliquerReglages({ telephone: false, mode: 'expert' });
    expect(reglages.modeAppli()).toBe('expert');
    delete globalThis.document;
  });
});
