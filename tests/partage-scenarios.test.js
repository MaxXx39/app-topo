// Contrôle du partage Drive à deux appareils (0.103.3) : la tablette (partage complet) et le bureau
// (accès direct à Drive) se passent un projet. Chaque essai vérifie qui a la main et ce que Drive contient.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fauxDrive } from './faux-drive.js';
import { creerProjet } from '../src/projet/projet.js';
import { creerSynchro } from '../src/partage/synchro.js';

const commun = vi.hoisted(() => ({ drive: null }));
vi.mock('../src/partage/connexion.js', () => ({
  connexionPossible: () => true,
  creerConnexion: () => ({ obtenirJeton: async () => 'jeton' }),
}));
vi.mock('../src/partage/drive.js', async (original) => ({ ...(await original()), creerDrive: () => commun.drive }));

function memoire() {
  const donnees = {};
  return { getItem: (cle) => donnees[cle] ?? null, setItem: (cle, valeur) => (donnees[cle] = String(valeur)), removeItem: (cle) => delete donnees[cle] };
}
const BUREAU = { id: 'appareil-bureau', nom: 'PC bureau' };

async function attendre(condition) {
  const debut = performance.now();
  while (!condition() && performance.now() - debut < 5000) await new Promise((fin) => setImmediate(fin));
  expect(condition()).toBe(true);
}

/** Tablette de test : projet ouvert modifiable, réponses de la fenêtre « a la main » réglables. */
async function creerTablette({ projet = null, choix = 'lecture' } = {}) {
  const { creerPartage } = await import('../src/partage/partage.js');
  const { nommerAppareil } = await import('../src/partage/memoire.js');
  nommerAppareil('Tablette Max');
  const etat = { ouvert: projet ?? creerProjet('Essai'), choix, messages: [], fenetres: 0 };
  if (!etat.ouvert.modifieLe) etat.ouvert.modifieLe = '2026-10-30T08:00:00.000Z';
  etat.partage = creerPartage({
    obtenirProjet: () => etat.ouvert,
    titreDe: (p) => p.nom,
    lireLocal: async (id) => (etat.ouvert.id === id ? etat.ouvert : null),
    ouvrirProjet: async (p) => {
      etat.ouvert = p;
    },
    demanderPriseDeMain: async () => {
      etat.fenetres += 1;
      return etat.choix;
    },
    autoriserPrise: async () => true,
    quandMainPrise: () => {},
    quandMainRendue: () => {},
    quandChange: () => {},
    message: (texte) => etat.messages.push(texte),
  });
  return etat;
}

describe('partage Drive à deux appareils', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-30T10:00:00.000Z'));
    globalThis.localStorage = memoire();
    commun.drive = fauxDrive();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.localStorage;
  });

  it('projet créé au bureau, seulement sur Drive : la tablette l\'ouvre et a la main', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    await bureau.envoyer(cree, null, '858 826 - Backhorn');
    await bureau.rendreVerrou((await bureau.listerProjets())[0].dossierId);

    const t = await creerTablette();
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const [surDrive] = t.partage.etat.projetsDrive.filter((p) => p.projetId === cree.id);
    expect(surDrive).toBeTruthy();
    await t.partage.ouvrirDepuisDrive(surDrive.dossierId);
    expect(t.fenetres).toBe(0);
    expect(t.ouvert.id).toBe(cree.id);
    expect((await bureau.lireVerrou(surDrive.dossierId)).verrou).toMatchObject({ nom: 'Tablette Max' });
  });

  it('le bureau a la main : la tablette peut choisir « lecture » (rien n\'est envoyé) ou « prendre »', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    await bureau.envoyer(cree, null, 'Backhorn'); // le bureau garde la main

    const t = await creerTablette({ choix: 'lecture' });
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const { dossierId } = t.partage.etat.projetsDrive.find((p) => p.projetId === cree.id);
    await t.partage.ouvrirDepuisDrive(dossierId);
    expect(t.fenetres).toBe(1);
    expect(t.partage.etat.repris).toMatchObject({ nom: 'PC bureau', attente: false });
    t.partage.projetEnregistre();
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await bureau.lireVerrou(dossierId)).verrou).toMatchObject({ nom: 'PC bureau' });

    // Maintenant « prendre ».
    t.choix = 'prendre';
    await t.partage.ouvrirDepuisDrive(dossierId);
    expect(t.partage.etat.repris).toBeNull();
    expect((await bureau.lireVerrou(dossierId)).verrou).toMatchObject({ nom: 'Tablette Max' });
  });

  it('le bureau n\'a plus donné signe de vie depuis 15 minutes : la tablette ouvre sans rien demander', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    await bureau.envoyer(cree, null, 'Backhorn');
    await vi.advanceTimersByTimeAsync(16 * 60_000);

    const t = await creerTablette();
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const { dossierId } = t.partage.etat.projetsDrive.find((p) => p.projetId === cree.id);
    await t.partage.ouvrirDepuisDrive(dossierId);
    expect(t.fenetres).toBe(0);
    expect(t.partage.etat.repris).toBeNull();
  });

  it('fermer l\'appli (avantDeChanger) rend la main : le bureau ouvre sans fenêtre', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [surDrive] = await bureau.listerProjets();
    expect(surDrive.verrou).toMatchObject({ nom: 'Tablette Max' });
    await t.partage.avantDeChanger();
    expect((await bureau.lireVerrou(surDrive.dossierId)).verrou).toBeNull();
  });

  it('envoi interrompu au premier envoi : un dossier vide n\'est pas proposé dans la liste tant qu\'il est vide', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    // Coupure juste après la création du dossier.
    const ecrire = commun.drive.creerFichier;
    commun.drive.creerFichier = async () => {
      throw new Error('réseau coupé');
    };
    await expect(bureau.envoyer(cree, null, 'Backhorn')).rejects.toThrow('réseau coupé');
    commun.drive.creerFichier = ecrire;

    const t = await creerTablette();
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const entree = t.partage.etat.projetsDrive.find((p) => p.projetId === cree.id);
    // Le projet vide ne doit pas apparaître comme un projet ouvrable.
    expect(entree).toBeUndefined();
  });

  it('envoi interrompu puis refait : le projet complet apparaît dans la liste', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    const ecrire = commun.drive.creerFichier;
    commun.drive.creerFichier = async () => {
      throw new Error('réseau coupé');
    };
    await expect(bureau.envoyer(cree, null, 'Backhorn')).rejects.toThrow();
    commun.drive.creerFichier = ecrire;
    expect(await bureau.listerProjets()).toHaveLength(0);
    await bureau.envoyer(cree, null, 'Backhorn');
    const liste = await bureau.listerProjets();
    expect(liste).toHaveLength(1);
    expect([...commun.drive.fichiers.values()].filter((f) => f.name === 'Backhorn')).toHaveLength(1); // pas de doublon
  });

  it('même tablette mais identifiant changé (appli réinstallée) : l\'ancien verrou n\'empêche pas d\'ouvrir', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [surDrive] = await bureau.listerProjets();
    // Même nom d'appareil, autre identifiant : le verrou est « 9534 » pour la même tablette.
    expect(surDrive.verrou.nom).toBe('Tablette Max');
    const autre = creerSynchro(commun.drive, { id: 'nouvel-id', nom: 'Tablette Max' });
    const [vu] = await autre.listerProjets();
    expect(vu.verrou.nom).toBe('Tablette Max');
  });
});
