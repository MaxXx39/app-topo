// Tests des listes partagées (adresses mail, réglages swipos).
import { describe, it, expect, beforeEach, vi } from 'vitest';

function memoire() {
  const donnees = {};
  return { getItem: (cle) => donnees[cle] ?? null, setItem: (cle, valeur) => (donnees[cle] = String(valeur)) };
}

async function charger() {
  globalThis.localStorage = memoire();
  vi.resetModules();
  return import('../src/reglages/listes-partagees.js');
}

describe('listes partagées', () => {
  beforeEach(() => {
    delete globalThis.localStorage;
  });

  it('adresses valides seulement, sans double ; swipos avec serveur et utilisateur, port 2101 par défaut', async () => {
    const { nettoyerListes, estAdresseMail } = await charger();
    expect(estAdresseMail('bureau@geometre.ch')).toBe(true);
    expect(estAdresseMail('bureau@geometre')).toBe(false);
    const listes = nettoyerListes({
      adresses: [' bureau@geometre.ch ', 'bureau@geometre.ch', 'pas une adresse'],
      swipos: [{ utilisateur: 'max', hote: 'www.swipos.ch', port: '', pointDeMontage: 'MSM_GISGEO_LV95LHN95', motDePasse: 'secret' }, { utilisateur: '', hote: 'x' }],
    });
    expect(listes.adresses).toEqual(['bureau@geometre.ch']);
    expect(listes.swipos).toHaveLength(1);
    expect(listes.swipos[0]).toMatchObject({ utilisateur: 'max', hote: 'www.swipos.ch', port: 2101, motDePasse: 'secret' });
  });

  it('enregistrées sur l\'appareil avec leur date ; les écouteurs sont prévenus', async () => {
    const { ecrireListesPartagees, lireListesPartagees, surChangementListes } = await charger();
    const vus = [];
    surChangementListes((listes, { depuisDrive }) => vus.push([listes.adresses.length, depuisDrive]));
    ecrireListesPartagees({ adresses: ['a@b.ch'], swipos: [] }, { modifieLe: '2026-10-27T10:00:00.000Z' });
    expect(lireListesPartagees()).toMatchObject({ adresses: ['a@b.ch'], modifieLe: '2026-10-27T10:00:00.000Z' });
    expect(vus).toEqual([[1, false]]);
  });

  it('version à garder : la plus récente', async () => {
    const { versionAGarder } = await charger();
    expect(versionAGarder('2026-10-27T10:00:00Z', '2026-10-27T09:00:00Z')).toBe('local');
    expect(versionAGarder('2026-10-27T08:00:00Z', '2026-10-27T09:00:00Z')).toBe('drive');
    expect(versionAGarder(null, '2026-10-27T09:00:00Z')).toBe('drive');
    expect(versionAGarder('2026-10-27T09:00:00Z', null)).toBe('local');
    expect(versionAGarder(null, null)).toBeNull();
  });

  it('fusion partie par partie : une modification ne fait pas perdre les dossiers (0.136.0)', async () => {
    const { fusionnerListes } = await charger();
    const dossiers = { liste: [{ id: 'd1', nom: 'Maxime' }], projets: {} };
    // Drive : dossiers créés sur le site à 10 h. Téléphone : adresse ajoutée à 11 h, sans dossiers.
    const distant = { adresses: [], swipos: [], dossiers, dates: { dossiers: '2026-11-05T10:00:00.000Z' }, modifieLe: '2026-11-05T10:00:00.000Z' };
    const local = { adresses: ['a@b.ch'], swipos: [], dates: { adresses: '2026-11-05T11:00:00.000Z' }, modifieLe: '2026-11-05T11:00:00.000Z' };
    const { listes, changeLocal, changeDistant } = fusionnerListes(local, distant);
    expect(listes.dossiers).toEqual(dossiers);
    expect(listes.adresses).toEqual(['a@b.ch']);
    expect(listes.modifieLe).toBe('2026-11-05T11:00:00.000Z');
    expect(changeLocal).toBe(true);
    expect(changeDistant).toBe(true);
    // Refaite avec le résultat : plus rien à changer.
    const encore = fusionnerListes(listes, listes);
    expect([encore.changeLocal, encore.changeDistant]).toEqual([false, false]);
  });

  it('fusion : listes sans dates (avant 0.136.0), la plus récente gagne comme avant', async () => {
    const { fusionnerListes } = await charger();
    const vieux = { adresses: ['x@y.ch'], swipos: [], modifieLe: '2026-10-27T09:00:00.000Z' };
    const recent = { adresses: ['z@y.ch'], swipos: [], modifieLe: '2026-10-27T10:00:00.000Z' };
    expect(fusionnerListes(vieux, recent).listes.adresses).toEqual(['z@y.ch']);
    expect(fusionnerListes(recent, vieux).listes.adresses).toEqual(['z@y.ch']);
  });

  it('une modification ici date seulement la partie changée', async () => {
    const { ecrireListesPartagees, lireListesPartagees } = await charger();
    ecrireListesPartagees({ adresses: ['a@b.ch'], swipos: [] }, { modifieLe: '2026-11-05T10:00:00.000Z' });
    ecrireListesPartagees({ ...lireListesPartagees(), dossiers: { liste: [{ id: 'd1', nom: 'Maxime' }], projets: {} } }, { modifieLe: '2026-11-05T11:00:00.000Z' });
    const lues = lireListesPartagees();
    expect(lues.dates.adresses).toBe('2026-11-05T10:00:00.000Z');
    expect(lues.dates.dossiers).toBe('2026-11-05T11:00:00.000Z');
  });
});
