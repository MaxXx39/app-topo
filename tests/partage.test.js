// Tests du partage des projets par Google Drive, avec un faux Drive en mémoire.
import { describe, it, expect } from 'vitest';
import { creerSynchro, choisirVersion, verrouActif, NOM_RACINE, NOM_PROJETS } from '../src/partage/synchro.js';
import { projetVersFichiers, fichiersVersProjet, comprimer, decomprimer, FICHIER_PROJET } from '../src/partage/fichiers.js';
import { creerDrive } from '../src/partage/drive.js';
import { fauxDrive } from './faux-drive.js';
import { creerProjet } from '../src/projet/projet.js';

/** Projet d'essai avec un plan DXF et une photo. */
function projetEssai() {
  const projet = creerProjet('Essai');
  projet.modifieLe = '2026-10-23T08:00:00.000Z';
  projet.cartouche.affaire = '10 203';
  projet.plansDxf = [{ id: 'p1', nom: 'plan.dxf', calques: [], contenu: { traits: [{ c: 0, p: [0, 0, 10, 10] }] } }];
  projet.surfaces = [{ id: 's1', nom: 'Stock 1', photos: [{ id: 'ph1', legende: 'vue', image: 'data:image/jpeg;base64,AAAA', miniature: 'data:image/jpeg;base64,BB' }] }];
  projet.mesures = [{ id: 'm1', nom: 'Mur', photos: [{ id: 'ph2', legende: 'mur', image: 'data:image/jpeg;base64,CC', miniature: 'data:image/jpeg;base64,DD' }] }, { id: 'm2', nom: 'Sans photo' }];
  return projet;
}

const MAX = { id: 'appareil-max', nom: 'Tablette Max' };
const BUREAU = { id: 'appareil-bureau', nom: 'PC bureau' };

describe('fichiers du projet', () => {
  it('découpe le projet (plans et photos à part) et le recompose à l\'identique', async () => {
    const projet = projetEssai();
    const fichiers = projetVersFichiers(projet);
    expect([...fichiers.keys()].sort()).toEqual(['photo-ph1.json.gz', 'photo-ph2.json.gz', 'plan-p1.json.gz', FICHIER_PROJET]);
    expect(fichiers.get(FICHIER_PROJET).mesures[0].photos[0].image).toBeNull();
    expect(fichiers.get(FICHIER_PROJET).plansDxf[0].contenu).toBeNull();
    // Aller-retour par la compression.
    const relus = new Map();
    for (const [nom, objet] of fichiers) relus.set(nom, await decomprimer(await comprimer(objet)));
    expect(fichiersVersProjet(relus)).toEqual(projet);
  });
});

describe('synchronisation avec Drive', () => {
  it('premier envoi : « App Topo › Configuration Projet », dossier du projet, 3 fichiers, verrou à cet appareil', async () => {
    const drive = fauxDrive();
    const { memoire } = await creerSynchro(drive, MAX).envoyer(projetEssai(), null, '10 203 - Gland');
    const parNom = (nom) => [...drive.fichiers.values()].find((f) => f.name === nom);
    expect(NOM_RACINE).toBe('App Topo');
    expect(NOM_PROJETS).toBe('Configuration Projet');
    expect(parNom(NOM_RACINE).parents).toEqual([]);
    expect(parNom(NOM_PROJETS).parents).toEqual([parNom(NOM_RACINE).id]);
    expect(parNom('10 203 - Gland').parents).toEqual([parNom(NOM_PROJETS).id]);
    // Un 2e appareil retrouve les mêmes dossiers (pas de doublon).
    await creerSynchro(drive, BUREAU).listerProjets();
    expect([...drive.fichiers.values()].filter((f) => f.name === NOM_PROJETS)).toHaveLength(1);
    expect(drive.ecritures.at(-1)).toBe(FICHIER_PROJET); // le projet en dernier
    const dossier = drive.fichiers.get(memoire.dossierId);
    expect(dossier.appProperties).toMatchObject({ titre: '10 203 - Gland', verrouPar: MAX.id, verrouNom: 'Tablette Max' });
  });

  it('envoi suivant : seulement les fichiers changés ; plan enlevé mis à la corbeille', async () => {
    const drive = fauxDrive();
    const synchro = creerSynchro(drive, MAX);
    const projet = projetEssai();
    const { memoire } = await synchro.envoyer(projet);
    drive.ecritures.length = 0;
    projet.nom = 'Essai modifié';
    const deuxieme = await synchro.envoyer(projet, memoire);
    expect(drive.ecritures).toEqual([FICHIER_PROJET]);
    projet.plansDxf = [];
    await synchro.envoyer(projet, deuxieme.memoire);
    const plan = [...drive.fichiers.values()].find((f) => f.name === 'plan-p1.json.gz');
    expect(plan.trashed).toBe(true);
  });

  it('un autre appareil liste, télécharge et prend la main ; l\'envoi du premier est alors refusé', async () => {
    const drive = fauxDrive();
    const projet = projetEssai();
    const { memoire } = await creerSynchro(drive, MAX).envoyer(projet, null, 'Essai');
    const bureau = creerSynchro(drive, BUREAU);
    const liste = await bureau.listerProjets();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ projetId: projet.id, titre: 'Essai', verrou: { appareilId: MAX.id, nom: 'Tablette Max' } });

    const lu = await bureau.telecharger(liste[0].dossierId);
    expect(lu.projet).toEqual(projet);
    await bureau.prendreVerrou(liste[0].dossierId);

    const refus = await creerSynchro(drive, MAX).envoyer(projet, memoire);
    expect(refus.repris).toMatchObject({ nom: 'PC bureau' });
    // Le bureau rend le projet : Max peut de nouveau envoyer.
    await bureau.rendreVerrou(liste[0].dossierId);
    expect((await creerSynchro(drive, MAX).envoyer(projet, memoire)).memoire).toBeTruthy();
  });

  it('listes partagées : écrites dans « App Topo », relues par un autre appareil', async () => {
    const drive = fauxDrive();
    const max = creerSynchro(drive, MAX);
    expect(await max.lireListes()).toBeNull();
    const listes = { adresses: ['bureau@geometre.ch'], swipos: [], modifieLe: '2026-10-27T10:00:00.000Z' };
    await max.ecrireListes(listes);
    const lu = await creerSynchro(drive, BUREAU).lireListes();
    expect(lu).toEqual({ listes, modifieLe: '2026-10-27T10:00:00.000Z' });
    const fichier = [...drive.fichiers.values()].find((f) => f.name === 'listes-partagees.json.gz');
    expect(drive.fichiers.get(fichier.parents[0]).name).toBe(NOM_RACINE);
    // 2e écriture : le même fichier est mis à jour.
    await max.ecrireListes({ ...listes, adresses: [], modifieLe: '2026-10-27T11:00:00.000Z' });
    expect([...drive.fichiers.values()].filter((f) => f.name === 'listes-partagees.json.gz')).toHaveLength(1);
    expect((await max.lireListes()).listes.adresses).toEqual([]);
  });

  it('verrou relu toutes les 30 s : qui a la main ; rendu, il est libre', async () => {
    const drive = fauxDrive();
    const projet = projetEssai();
    const max = creerSynchro(drive, MAX);
    const { memoire } = await max.envoyer(projet, null, 'Essai');
    const bureau = creerSynchro(drive, BUREAU);
    expect((await bureau.lireVerrou(memoire.dossierId)).verrou).toMatchObject({ appareilId: MAX.id, nom: 'Tablette Max' });
    // Le bureau prend la main : Max le voit à sa prochaine lecture.
    await bureau.prendreVerrou(memoire.dossierId);
    expect((await max.lireVerrou(memoire.dossierId)).verrou).toMatchObject({ nom: 'PC bureau' });
    // Le bureau rend la main : libre.
    await bureau.rendreVerrou(memoire.dossierId);
    expect((await max.lireVerrou(memoire.dossierId)).verrou).toBeNull();
    // Verrou sans signe de vie depuis 2 heures : compte comme libre.
    await bureau.prendreVerrou(memoire.dossierId);
    drive.fichiers.get(memoire.dossierId).appProperties.verrouVu = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect((await max.lireVerrou(memoire.dossierId)).verrou).toBeNull();
  });

  it('verrou sans signe de vie depuis 15 minutes : le projet est libre', async () => {
    const maintenant = Date.parse('2026-10-23T10:00:00.000Z');
    expect(verrouActif(null)).toBe(false);
    expect(verrouActif({ vu: '2026-10-23T09:50:00.000Z' }, maintenant)).toBe(true);
    expect(verrouActif({ vu: '2026-10-23T09:44:00.000Z' }, maintenant)).toBe(false);
    expect(verrouActif({ depuis: '2026-10-23T08:00:00.000Z' }, maintenant)).toBe(false); // ancien verrou sans « vu »

    // Tablette éteinte depuis 2 heures : le bureau envoie sans être refusé, et prend le verrou.
    const drive = fauxDrive();
    const projet = projetEssai();
    const { memoire } = await creerSynchro(drive, MAX).envoyer(projet, null, 'Essai');
    const dossier = drive.fichiers.get(memoire.dossierId);
    dossier.appProperties.verrouVu = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const bureau = creerSynchro(drive, BUREAU);
    expect((await bureau.envoyer(projet, null)).memoire).toBeTruthy();
    expect(dossier.appProperties.verrouPar).toBe(BUREAU.id);
    // Max se réveille : son signe de vie voit que le bureau a la main.
    expect((await creerSynchro(drive, MAX).signeDeVie(memoire.dossierId)).repris).toMatchObject({ nom: 'PC bureau' });
    // Le signe de vie du bureau garde le verrou à son nom.
    expect(await bureau.signeDeVie(memoire.dossierId)).toEqual({});
    // Suppression : le dossier va à la corbeille, il n'est plus listé.
    await bureau.supprimerProjet(memoire.dossierId);
    expect(await bureau.listerProjets()).toHaveLength(0);
  });

  it('quelle version ouvrir : locale, Drive, ou conflit', () => {
    const t = (h) => `2026-10-23T${h}:00:00.000Z`;
    expect(choisirVersion({ local: t('08'), envoyeLe: t('08'), distant: null })).toBe('local');
    expect(choisirVersion({ local: null, envoyeLe: null, distant: t('08') })).toBe('distant');
    expect(choisirVersion({ local: t('08'), envoyeLe: t('08'), distant: t('10') })).toBe('distant');
    expect(choisirVersion({ local: t('09'), envoyeLe: t('08'), distant: t('08') })).toBe('local');
    expect(choisirVersion({ local: t('09'), envoyeLe: t('08'), distant: t('10') })).toBe('conflit');
    expect(choisirVersion({ local: t('09'), envoyeLe: null, distant: t('10') })).toBe('conflit');
  });
});

describe('accès REST à Drive', () => {
  it('renouvelle le jeton une fois après un refus 401, et donne un message lisible en cas d\'erreur', async () => {
    const jetons = [];
    const reponses = [
      new Response('', { status: 401 }),
      new Response(JSON.stringify({ files: [{ id: 'x', name: 'a' }] }), { status: 200 }),
      new Response(JSON.stringify({ error: { message: 'quota dépassé' } }), { status: 403 }),
    ];
    const drive = creerDrive({
      obtenirJeton: async (renouveler) => {
        jetons.push(renouveler);
        return 'jeton';
      },
      envoyerRequete: async () => reponses.shift(),
    });
    expect(await drive.lister("name = 'a'")).toEqual([{ id: 'x', name: 'a' }]);
    expect(jetons).toEqual([false, true]);
    await expect(drive.lire('x')).rejects.toThrow('Google Drive a refusé (403 : quota dépassé)');
  });
});
