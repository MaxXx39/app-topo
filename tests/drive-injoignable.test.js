import { describe, it, expect } from 'vitest';
import { creerDrive } from '../src/partage/drive.js';
import { creerSynchro } from '../src/partage/synchro.js';
import { fauxDrive } from './faux-drive.js';
import { creerProjet } from '../src/projet/projet.js';

// Réponse de fetch simulée : json() / blob() qui réussissent ou échouent.
const reponse = ({ status = 200, corps = {}, coupee = false } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => {
    if (coupee) throw new TypeError('Failed to fetch');
    return corps;
  },
  blob: async () => {
    if (coupee) throw new TypeError('Failed to fetch');
    return new Blob(['x']);
  },
});

describe('Drive injoignable', () => {
  it('donne un message en français au lieu de « Failed to fetch »', async () => {
    const drive = creerDrive({
      obtenirJeton: async () => 'jeton',
      envoyerRequete: async () => {
        throw new TypeError('Failed to fetch');
      },
      pauses: [],
    });
    await expect(drive.lister('x')).rejects.toThrow('Google Drive injoignable (réseau ?)');
  });

  it('réponse coupée en cours de route (0.103.5) : la lecture est refaite, puis réussit', async () => {
    let essais = 0;
    const drive = creerDrive({
      obtenirJeton: async () => 'jeton',
      envoyerRequete: async () => {
        essais += 1;
        return reponse({ corps: { id: 'a', name: 'projet' }, coupee: essais < 3 });
      },
      pauses: [0, 0],
    });
    expect(await drive.decrire('a')).toMatchObject({ name: 'projet' });
    expect(essais).toBe(3);
  });

  it('réponse toujours coupée : message clair (plus de « Failed to fetch »)', async () => {
    const drive = creerDrive({ obtenirJeton: async () => 'jeton', envoyerRequete: async () => reponse({ coupee: true }), pauses: [0, 0] });
    await expect(drive.lire('a')).rejects.toThrow('réponse de Google Drive coupée en cours de route (réseau ?)');
  });

  it('Drive surchargé (503) : refait ; refus (403) : pas refait', async () => {
    let essais = 0;
    const drive = creerDrive({
      obtenirJeton: async () => 'jeton',
      envoyerRequete: async () => {
        essais += 1;
        return reponse(essais === 1 ? { status: 503 } : { corps: { files: [] } });
      },
      pauses: [0, 0],
    });
    expect(await drive.lister('x')).toEqual([]);
    essais = 0;
    const refus = creerDrive({ obtenirJeton: async () => 'jeton', envoyerRequete: async () => (essais++, reponse({ status: 403 })), pauses: [0, 0] });
    await expect(refus.lister('x')).rejects.toThrow('Google Drive a refusé (403)');
    expect(essais).toBe(1);
  });

  it('une écriture qui échoue n\'est pas refaite ici (l\'envoi complet est refait plus tard)', async () => {
    let essais = 0;
    const drive = creerDrive({
      obtenirJeton: async () => 'jeton',
      envoyerRequete: async () => {
        essais += 1;
        throw new TypeError('Failed to fetch');
      },
      pauses: [0, 0],
    });
    await expect(drive.modifier('a', { nom: 'b' })).rejects.toThrow('injoignable');
    expect(essais).toBe(1);
  });

  it('plan DXF jamais lu (réseau) : le projet s\'ouvre sans lui, et il est nommé (0.103.6)', async () => {
    const drive = fauxDrive();
    const synchro = creerSynchro(drive, { id: 'app-a', nom: 'A' });
    const projet = creerProjet('Essai');
    projet.modifieLe = '2026-10-30T10:00:00.000Z';
    projet.plansDxf = [{ id: 'p1', nom: 'Ter A.dxf', contenu: { entites: [] } }];
    const { memoire } = await synchro.envoyer(projet, null, 'Essai');
    const lire = drive.lire;
    drive.lire = async (id) => {
      if (drive.fichiers.get(id).name.startsWith('plan-')) throw new Error('réponse de Google Drive coupée en cours de route (réseau ?)');
      return lire(id);
    };
    const lu = await synchro.telecharger(memoire.dossierId);
    expect(lu.illisibles).toEqual(['plan DXF « Ter A.dxf »']);
    expect(lu.projet.plansDxf[0].contenu).toBeNull();
  });
});
