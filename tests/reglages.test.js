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
    expect(lireReglages()).toMatchObject({ telephone: true, mode: 'expert' });
    expect(modeAppli()).toBe('expert');
  });

  it('anciens réglages (sans mode) : Intermédiaire, mode téléphone gardé', async () => {
    const { lireReglages } = await chargerReglages({ 'topo-reglages': JSON.stringify({ telephone: true }) });
    expect(lireReglages()).toMatchObject({ telephone: true, mode: 'intermediaire' });
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
    const fausseZone = { classList: { toggle() {} }, style: { setProperty() {} }, querySelector: () => null };
    globalThis.document = { body: fausseZone, querySelector: () => null };
    reglages.appliquerReglages({ telephone: false, mode: 'expert' });
    expect(reglages.modeAppli()).toBe('expert');
    delete globalThis.document;
  });
});

describe('tailles du plan (0.104.0)', () => {
  it('formes : +20 % au départ (rayon 4,2 au lieu de 3,5), texte normal = 0,75', async () => {
    const reglages = await chargerReglages({});
    expect(reglages.rayonFormes()).toBeCloseTo(4.2, 6);
    expect(reglages.echelleTexte()).toBe(0.75);
  });
  it('4 tailles choisies sur l\'appareil', async () => {
    const reglages = await chargerReglages({ 'topo-reglages': JSON.stringify({ tailleFormes: 'tres-grande', tailleTexte: 'petit' }) });
    expect(reglages.rayonFormes()).toBeCloseTo(4.2 * 1.8, 6);
    expect(reglages.echelleTexte()).toBe(0.6);
    expect(reglages.TAILLES_FORMES).toHaveLength(4);
    expect(reglages.TAILLES_TEXTE).toHaveLength(4);
  });
  it('taille inconnue : la normale', async () => {
    const reglages = await chargerReglages({ 'topo-reglages': JSON.stringify({ tailleFormes: 'xyz', tailleTexte: 'abc' }) });
    expect(reglages.echelleTexte()).toBe(1);
  });
});
