import { describe, it, expect } from 'vitest';
import { creerDrive } from '../src/partage/drive.js';

describe('Drive injoignable', () => {
  it('donne un message en français au lieu de « Failed to fetch »', async () => {
    const drive = creerDrive({
      obtenirJeton: async () => 'jeton',
      envoyerRequete: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(drive.lister('x')).rejects.toThrow('Google Drive injoignable (réseau ?)');
  });
});
