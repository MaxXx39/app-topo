import { describe, it, expect } from 'vitest';
import { versionDuTitre, estPlusRecente, versionPubliee, apkPublie, exePublie } from '../src/outils/mise-a-jour.js';

describe('mise à jour de l\'APK', () => {
  it('lit la version dans le titre de la release', () => {
    expect(versionDuTitre('APK Android - dernière version (0.119.0, n° 412, main)')).toBe('0.119.0');
    expect(versionDuTitre('APK Android - dernière version (0.118.3, n° 12, claude/x)')).toBe('0.118.3');
    expect(versionDuTitre('sans numéro')).toBe(null);
  });

  it('compare les versions chiffre par chiffre', () => {
    expect(estPlusRecente('0.119.0', '0.118.3')).toBe(true);
    expect(estPlusRecente('0.118.10', '0.118.9')).toBe(true);
    expect(estPlusRecente('0.118.3', '0.118.3')).toBe(false);
    expect(estPlusRecente('0.117.9', '0.118.0')).toBe(false);
    expect(estPlusRecente(null, '0.118.0')).toBe(false);
  });

  it('renvoie null sans réseau, la version sinon', async () => {
    expect(await versionPubliee(async () => { throw new Error('hors ligne'); })).toBe(null);
    const lire = async () => ({ ok: true, json: async () => ({ name: 'APK Android - dernière version (0.120.1, n° 5, main)' }) });
    expect(await versionPubliee(lire)).toBe('0.120.1');
  });

  it('donne le lien du fichier qui porte le numéro de version, sinon le lien fixe', async () => {
    const avec = async () => ({ ok: true, json: async () => ({ name: 'APK (0.120.1, n° 5, main)', assets: [{ name: 'Topo.apk', browser_download_url: 'https://x/Topo.apk' }, { name: 'Topo-0.120.1.apk', browser_download_url: 'https://x/Topo-0.120.1.apk' }] }) });
    expect(await apkPublie(avec)).toEqual({ version: '0.120.1', adresse: 'https://x/Topo-0.120.1.apk' });
    const sans = async () => ({ ok: true, json: async () => ({ name: 'APK (0.120.1, n° 5, main)', assets: [] }) });
    expect((await apkPublie(sans)).adresse).toMatch(/Topo\.apk$/);
  });

  it('appli Windows : lit la release « windows-derniere-version » et donne le Topo-<version>.exe', async () => {
    const adresses = [];
    const avec = async (adresse) => {
      adresses.push(adresse);
      return { ok: true, json: async () => ({ name: 'Windows - dernière version (0.237.0, n° 3, main)', assets: [{ name: 'Topo.exe', browser_download_url: 'https://x/Topo.exe' }, { name: 'Topo-0.237.0.exe', browser_download_url: 'https://x/Topo-0.237.0.exe' }] }) };
    };
    expect(await exePublie(avec)).toEqual({ version: '0.237.0', adresse: 'https://x/Topo-0.237.0.exe' });
    expect(adresses[0]).toMatch(/windows-derniere-version$/);
    const sans = async () => ({ ok: true, json: async () => ({ name: 'Windows (0.237.0, n° 3, main)', assets: [] }) });
    expect((await exePublie(sans)).adresse).toMatch(/windows-derniere-version\/Topo\.exe$/);
  });
});
