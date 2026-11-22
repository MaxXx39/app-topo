// Matériel (0.274.0) : copie du parc et de ses fichiers joints sur Drive (« App Topo › Matériel »).
import { describe, it, expect } from 'vitest';
import { creerSynchro } from '../src/partage/synchro.js';
import { fauxDrive } from './faux-drive.js';
import { parcVide, ajouterCategorie, ajouterArticle } from '../src/materiel/donnees.js';

const PC = { id: 'app-pc', nom: 'PC bureau' };
const TABLETTE = { id: 'app-tab', nom: 'Tablette 1' };

describe('parc sur Drive', () => {
  it('rien au départ, puis écrit et relu par un autre appareil', async () => {
    const drive = fauxDrive();
    const pc = creerSynchro(drive, PC);
    expect(await pc.lireMateriel()).toBeNull();
    expect(await pc.dateMateriel()).toBeNull();
    const parc = parcVide();
    const cat = ajouterCategorie(parc, 'Canne GPS');
    ajouterArticle(parc, { numero: '953', categorieId: cat.id, swiposMotDePasse: 'secret' });
    parc.modifieLe = '2026-11-22T10:00:00.000Z';
    await pc.ecrireMateriel(parc);
    const lu = await creerSynchro(drive, TABLETTE).lireMateriel();
    expect(lu.modifieLe).toBe('2026-11-22T10:00:00.000Z');
    expect(lu.parc.articles[0].numero).toBe('953');
    // Rangé dans App Topo › Matériel, un seul fichier même après un 2e envoi.
    parc.modifieLe = '2026-11-22T11:00:00.000Z';
    await pc.ecrireMateriel(parc);
    const dossier = [...drive.fichiers.values()].find((f) => f.name === 'Matériel');
    const racine = [...drive.fichiers.values()].find((f) => f.name === 'App Topo');
    expect(dossier.parents).toEqual([racine.id]);
    expect([...drive.fichiers.values()].filter((f) => f.name === 'materiel.json.gz')).toHaveLength(1);
    expect(await creerSynchro(drive, TABLETTE).dateMateriel()).toBe('2026-11-22T11:00:00.000Z');
  });

  it('fichiers joints : envoyés une fois, relus, mis à la corbeille', async () => {
    const drive = fauxDrive();
    const pc = creerSynchro(drive, PC);
    const photo = new Blob(['image'], { type: 'image/jpeg' });
    await pc.ecrireFichierMateriel('photo-1', 'photo-1.jpg', photo);
    await pc.ecrireFichierMateriel('photo-1', 'photo-1.jpg', photo);
    expect(drive.ecritures.filter((n) => n === 'photo-1.jpg')).toHaveLength(1);
    expect(await (await creerSynchro(drive, TABLETTE).lireFichierMateriel('photo-1')).text()).toBe('image');
    expect(await pc.lireFichierMateriel('inconnu')).toBeNull();
    await pc.supprimerFichierMateriel('photo-1');
    expect(await pc.lireFichierMateriel('photo-1')).toBeNull();
  });
});
