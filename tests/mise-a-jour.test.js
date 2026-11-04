import { describe, it, expect } from 'vitest';
import { versionDuTitre, estPlusRecente, versionPubliee } from '../src/outils/mise-a-jour.js';

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
});
