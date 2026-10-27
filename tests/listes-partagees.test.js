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
});
