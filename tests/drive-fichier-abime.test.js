// Fichier abîmé dans le dossier Drive d'un projet (0.103.6) : cas vu sur la tablette, plan DXF
// « Axe a caller » illisible → « Failed to fetch » et projet impossible à ouvrir.
import { describe, it, expect } from 'vitest';
import { fauxDrive } from './faux-drive.js';
import { creerProjet } from '../src/projet/projet.js';
import { creerSynchro } from '../src/partage/synchro.js';
import { comprimer, decomprimer, sansContenu } from '../src/partage/fichiers.js';

const A = { id: 'app-a', nom: 'PC bureau' };
const B = { id: 'app-b', nom: 'Tablette Max' };
const nomPlan = 'plan-p1.json.gz';

/** Projet avec un plan DXF, envoyé par A ; renvoie { drive, synchroA, projet, memoire, fichierPlan }. */
async function projetAvecPlan() {
  const drive = fauxDrive();
  const synchroA = creerSynchro(drive, A);
  const projet = creerProjet('Backhorn');
  projet.modifieLe = '2026-10-30T10:00:00.000Z';
  projet.plansDxf = [{ id: 'p1', nom: '20261028 Axe a caller.dxf', contenu: { entites: [{ type: 'ligne' }] } }];
  const { memoire } = await synchroA.envoyer(projet, null, 'Backhorn');
  const fichierPlan = [...drive.fichiers.values()].find((f) => f.name === nomPlan);
  return { drive, synchroA, projet, memoire, fichierPlan };
}

describe('décompression d\'un fichier de Drive', () => {
  it('fichier vide : message clair', async () => {
    await expect(decomprimer(new Blob([]))).rejects.toThrow('fichier vide sur Drive');
  });
  it('gzip coupé : message clair (plus de « Failed to fetch »)', async () => {
    const entier = new Uint8Array(await (await comprimer({ a: 'x'.repeat(5000) })).arrayBuffer());
    await expect(decomprimer(new Blob([entier.slice(0, 30)]))).rejects.toThrow('fichier abîmé sur Drive');
  });
  it('JSON déjà décomprimé en route : lu tel quel', async () => {
    expect(await decomprimer(new Blob(['{"a":1}']))).toEqual({ a: 1 });
  });
  it('fichier normal : lu', async () => {
    expect(await decomprimer(await comprimer({ a: 1 }))).toEqual({ a: 1 });
  });
  it('sansContenu : plan sans contenu, photo sans image ; jamais le projet', () => {
    expect(sansContenu('plan-1.json.gz', null)).toBe(true);
    expect(sansContenu('photo-1.json.gz', { image: null, miniature: null })).toBe(true);
    expect(sansContenu('photo-1.json.gz', { image: 'data:', miniature: null })).toBe(false);
    expect(sansContenu('projet.json.gz', null)).toBe(false);
  });
});

describe('plan DXF abîmé sur Drive', () => {
  it('le projet s\'ouvre quand même, sans le dessin de ce plan, et le message le nomme', async () => {
    const { drive, memoire, fichierPlan } = await projetAvecPlan();
    fichierPlan.contenu = new Blob([]); // envoi interrompu : fichier vide
    const lu = await creerSynchro(drive, B).telecharger(memoire.dossierId);
    expect(lu.projet.plansDxf[0].contenu).toBeNull();
    expect(lu.illisibles).toEqual(['plan DXF « 20261028 Axe a caller.dxf »']);
  });

  it('l\'appareil qui l\'a ouvert sans le plan n\'écrase pas la copie de Drive', async () => {
    const { drive, memoire, fichierPlan } = await projetAvecPlan();
    const original = fichierPlan.contenu;
    fichierPlan.contenu = new Blob(['abîmé']);
    const b = creerSynchro(drive, B);
    const lu = await b.telecharger(memoire.dossierId);
    lu.projet.nom = 'Modifié sur la tablette';
    await b.prendreVerrou(memoire.dossierId);
    expect((await b.envoyer(lu.projet, lu.memoire, 'Backhorn')).memoire).toBeTruthy();
    expect(await fichierPlan.contenu.text()).toBe('abîmé'); // pas remplacé par un plan vide
    fichierPlan.contenu = original;
    const relu = await b.telecharger(memoire.dossierId);
    expect(relu.projet.nom).toBe('Modifié sur la tablette');
    expect(relu.projet.plansDxf[0].contenu).toEqual({ entites: [{ type: 'ligne' }] });
  });

  it('l\'appareil qui a le plan complet répare tout seul un fichier vide sur Drive', async () => {
    const { drive, synchroA, projet, memoire, fichierPlan } = await projetAvecPlan();
    fichierPlan.contenu = new Blob([]);
    projet.modifieLe = '2026-10-30T11:00:00.000Z';
    await synchroA.envoyer(projet, memoire, 'Backhorn'); // le plan n'a pas changé ici, mais il est renvoyé
    const lu = await creerSynchro(drive, B).telecharger(memoire.dossierId);
    expect(lu.illisibles).toEqual([]);
    expect(lu.projet.plansDxf[0].contenu).toEqual({ entites: [{ type: 'ligne' }] });
  });

  it('plan en double (un vide, un bon) : le bon est lu, puis le double est enlevé au prochain envoi', async () => {
    const { drive, synchroA, projet, memoire, fichierPlan } = await projetAvecPlan();
    const vide = await drive.creerFichier(nomPlan, fichierPlan.parents[0], new Blob([]));
    const lu = await creerSynchro(drive, B).telecharger(memoire.dossierId);
    expect(lu.illisibles).toEqual([]);
    expect(lu.projet.plansDxf[0].contenu).toEqual({ entites: [{ type: 'ligne' }] });
    projet.modifieLe = '2026-10-30T11:00:00.000Z';
    await synchroA.envoyer(projet, memoire, 'Backhorn');
    const restants = [...drive.fichiers.values()].filter((f) => f.name === nomPlan && !f.trashed);
    expect(restants).toHaveLength(1);
    expect(drive.fichiers.get(vide.id).trashed || restants[0].id === vide.id).toBe(true);
    expect((await creerSynchro(drive, B).telecharger(memoire.dossierId)).illisibles).toEqual([]);
  });

  it('fichier du projet abîmé : ouverture impossible, le message le dit', async () => {
    const { drive, memoire } = await projetAvecPlan();
    [...drive.fichiers.values()].find((f) => f.name === 'projet.json.gz').contenu = new Blob([]);
    await expect(creerSynchro(drive, B).telecharger(memoire.dossierId)).rejects.toThrow('fichier du projet : fichier vide sur Drive');
  });
});
