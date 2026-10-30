// Robustesse du partage Drive (0.103.4) : réseau coupé, appareil absent plus de 15 minutes, changement
// de projet pendant qu'un autre appareil prend la main, déconnexion, Drive qui ne répond pas.
// La règle reste : la version de Drive l'emporte, et un appareil n'écrase jamais le travail d'un autre.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fauxDrive } from './faux-drive.js';
import { creerProjet } from '../src/projet/projet.js';
import { creerSynchro, choisirVersion, changeAilleurs } from '../src/partage/synchro.js';
import { erreurDeReseau } from '../src/partage/partage.js';

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

/** Tablette de test : comme l'appli, ouvrir un projet l'enregistre (sa date change). */
async function creerTablette({ choix = 'lecture' } = {}) {
  const { creerPartage } = await import('../src/partage/partage.js');
  const { nommerAppareil } = await import('../src/partage/memoire.js');
  nommerAppareil('Tablette Max');
  const etat = { ouvert: creerProjet('Essai'), choix, messages: [], ouvertures: 0, prises: 0 };
  etat.ouvert.modifieLe = new Date().toISOString();
  etat.partage = creerPartage({
    obtenirProjet: () => etat.ouvert,
    titreDe: (p) => p.nom,
    lireLocal: async (id) => (etat.ouvert.id === id ? etat.ouvert : null),
    ouvrirProjet: async (p) => {
      p.modifieLe = new Date().toISOString();
      etat.ouvert = p;
      etat.ouvertures += 1;
    },
    demanderPriseDeMain: async () => etat.choix,
    autoriserPrise: async () => true,
    quandMainPrise: () => {
      etat.prises += 1;
    },
    quandMainRendue: () => {},
    quandChange: () => {},
    message: (texte) => etat.messages.push(texte),
  });
  return etat;
}

/** Modification faite sur la tablette (comme l'appli : date, enregistrement, envoi dans 30 s). */
function modifier(t, changer) {
  changer(t.ouvert);
  t.ouvert.modifieLe = new Date().toISOString();
  t.partage.projetEnregistre();
}

describe('partage Drive : robustesse', () => {
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

  it('« Ouvrir un projet » au démarrage, puis un projet seulement sur Drive : les modifications partent sur Drive', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    await bureau.envoyer(cree, null, 'Backhorn');
    const [{ dossierId }] = await bureau.listerProjets();
    await bureau.rendreVerrou(dossierId);

    const t = await creerTablette();
    t.partage.demarrer({ choixEnAttente: true });
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    await t.partage.ouvrirDepuisDrive(dossierId);
    expect(t.ouvert.id).toBe(cree.id);

    modifier(t, (p) => (p.nom = 'Modifié sur la tablette'));
    await vi.advanceTimersByTimeAsync(31_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null && t.partage.etat.etat === 'a-jour');
    expect((await bureau.telecharger(dossierId)).projet.nom).toBe('Modifié sur la tablette');
  });

  it('« Ouvrir un projet » au démarrage puis retour sur le projet de départ : il est comparé et envoyé dès qu\'on travaille', async () => {
    const t = await creerTablette();
    t.partage.demarrer({ choixEnAttente: true });
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(60_000);
    const bureau = creerSynchro(commun.drive, BUREAU);
    expect(await bureau.listerProjets()).toHaveLength(0); // pas encore choisi : rien n'est envoyé

    t.partage.choixFait(); // on passe à un autre onglet (Lever, Plan…)
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const [surDrive] = await bureau.listerProjets();
    expect(surDrive.verrou).toMatchObject({ nom: 'Tablette Max' });

    modifier(t, (p) => (p.nom = 'Travail du jour'));
    await vi.advanceTimersByTimeAsync(31_000);
    await attendre(() => t.partage.etat.etat === 'a-jour');
    await attendre(() => commun.drive.fichiers.get(surDrive.dossierId).appProperties.modifieLe === t.ouvert.modifieLe);
    expect((await bureau.telecharger(surDrive.dossierId)).projet.nom).toBe('Travail du jour');
  });

  it('APK démarrée sans réseau : nouvel essai de connexion toutes les minutes', async () => {
    globalThis.window = { AppliAndroid: {} };
    try {
      const { retenirConnexion } = await import('../src/partage/memoire.js');
      retenirConnexion(true);
      const t = await creerTablette();
      commun.drive.panne.active = true;
      t.partage.demarrer();
      await attendre(() => t.partage.etat.etat === 'attente');
      expect(t.partage.etat.connecte).toBe(false);
      commun.drive.panne.active = false;
      await vi.advanceTimersByTimeAsync(61_000);
      await attendre(() => t.partage.etat.connecte && t.partage.etat.synchroEnCours === false);
      await vi.advanceTimersByTimeAsync(3_000);
      await attendre(() => t.partage.etat.derniereSynchro !== null);
    } finally {
      delete globalThis.window;
    }
  });

  it('site (pas l\'APK) : pas de nouvel essai tout seul (la fenêtre Google demande un geste)', async () => {
    const { retenirConnexion } = await import('../src/partage/memoire.js');
    retenirConnexion(true);
    const t = await creerTablette();
    commun.drive.panne.active = true;
    t.partage.demarrer();
    await attendre(() => t.partage.etat.etat === 'erreur');
    commun.drive.panne.active = false;
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(t.partage.etat.connecte).toBe(false);
  });

  it('deux connexions demandées en même temps : une seule a lieu', async () => {
    const t = await creerTablette();
    const premiere = t.partage.connecter();
    expect(t.partage.connecter()).toBe(premiere);
    await premiere;
    expect(t.partage.etat.synchroEnCours).toBe(false);
  });

  it('tablette hors ligne plus de 15 minutes, le bureau a travaillé puis rendu la main : la tablette prend sa version et ne l\'écrase pas', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [{ dossierId }] = await bureau.listerProjets();

    // Réseau coupé 16 minutes : le verrou de la tablette expire. Elle modifie quand même (hors ligne).
    commun.drive.panne.active = true;
    modifier(t, (p) => (p.cartouche.affaire = 'hors ligne'));
    await vi.advanceTimersByTimeAsync(16 * 60_000);
    commun.drive.panne.active = false;

    // Le bureau ouvre sans rien demander, travaille, envoie et rend la main.
    expect((await bureau.lireVerrou(dossierId)).verrou).toBeNull();
    await bureau.prendreVerrou(dossierId);
    const lu = await bureau.telecharger(dossierId);
    lu.projet.nom = 'Travail du bureau';
    lu.projet.modifieLe = new Date().toISOString();
    await bureau.envoyer(lu.projet, lu.memoire, 'Essai');
    await bureau.rendreVerrou(dossierId);

    // Le réseau revient pour la tablette : elle prend la version de Drive (la version de Drive l'emporte).
    await vi.advanceTimersByTimeAsync(61_000);
    await attendre(() => t.ouvert.nom === 'Travail du bureau');
    await attendre(() => t.partage.etat.etat === 'a-jour');
    expect((await bureau.telecharger(dossierId)).projet.nom).toBe('Travail du bureau');

    // Pas de rechargement en boucle ; la tablette a de nouveau la main et ses modifications partent.
    const ouvertures = t.ouvertures;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.ouvertures).toBe(ouvertures);
    modifier(t, (p) => (p.cartouche.lieu = 'Gland'));
    await vi.advanceTimersByTimeAsync(31_000);
    await attendre(() => t.partage.etat.etat === 'a-jour');
    const final = await bureau.telecharger(dossierId);
    expect(final.projet.nom).toBe('Travail du bureau');
    expect(final.projet.cartouche.lieu).toBe('Gland');
    expect((await bureau.lireVerrou(dossierId)).verrou).toMatchObject({ nom: 'Tablette Max' });
  });

  it('écran éteint plus de 15 minutes, personne n\'a touché au projet : la tablette garde sa version et la main', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const ouvertures = t.ouvertures;
    commun.drive.panne.active = true;
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    commun.drive.panne.active = false;
    await t.partage.verifierMaintenant();
    expect(t.ouvertures).toBe(ouvertures);
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [{ dossierId }] = await bureau.listerProjets();
    expect((await bureau.lireVerrou(dossierId)).verrou).toMatchObject({ nom: 'Tablette Max' });
  });

  it('retour au premier plan : une main prise pendant l\'absence se voit tout de suite', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [{ dossierId }] = await bureau.listerProjets();
    await bureau.prendreVerrou(dossierId);
    await t.partage.verifierMaintenant();
    expect(t.partage.etat.repris).toMatchObject({ nom: 'PC bureau', attente: true });
    expect(t.prises).toBe(1);
  });

  it('changer de projet pendant qu\'un autre appareil prend l\'ancien : le nouveau projet n\'est pas mis en lecture seule', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [{ dossierId }] = await bureau.listerProjets();
    await bureau.prendreVerrou(dossierId); // la tablette ne l'a pas encore vu

    const envoiDeLAncien = t.partage.avantDeChanger();
    t.ouvert = creerProjet('Deuxième');
    t.ouvert.modifieLe = new Date().toISOString();
    await t.partage.apresOuverture();
    await envoiDeLAncien;
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.etat === 'a-jour');
    expect(t.partage.etat.repris).toBeNull();
    expect(t.prises).toBe(0);
  });

  it('se déconnecter : ce qui n\'est pas encore parti est envoyé, puis la main est rendue', async () => {
    const t = await creerTablette();
    await t.partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null);
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [{ dossierId }] = await bureau.listerProjets();
    modifier(t, (p) => (p.nom = 'Dernier changement'));
    await t.partage.deconnecter();
    expect(t.partage.etat.connecte).toBe(false);
    expect((await bureau.telecharger(dossierId)).projet.nom).toBe('Dernier changement');
    expect((await bureau.lireVerrou(dossierId)).verrou).toBeNull();
  });

  it('main prise au bureau (« Prendre la main ») : les changements de la tablette partent, sans rechargement en boucle', async () => {
    const bureau = creerSynchro(commun.drive, BUREAU);
    const cree = creerProjet('Backhorn');
    cree.modifieLe = '2026-10-30T09:00:00.000Z';
    await bureau.envoyer(cree, null, 'Backhorn');
    const [{ dossierId }] = await bureau.listerProjets();
    const t = await creerTablette({ choix: 'prendre' });
    await t.partage.connecter();
    await attendre(() => t.partage.etat.etat === 'a-jour');
    await t.partage.ouvrirDepuisDrive(dossierId);
    const ouvertures = t.ouvertures;
    modifier(t, (p) => (p.nom = 'Tablette'));
    await vi.advanceTimersByTimeAsync(31_000);
    await attendre(() => t.partage.etat.derniereSynchro !== null && t.partage.etat.etat === 'a-jour');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.ouvertures).toBe(ouvertures);
    expect((await bureau.telecharger(dossierId)).projet.nom).toBe('Tablette');
  });
});

describe('erreur de réseau ou refus ?', () => {
  it('réseau : Drive injoignable, Drive qui ne répond pas, erreur réseau de Google', () => {
    expect(erreurDeReseau(new Error('Google Drive injoignable (réseau ?)'))).toBe(true);
    expect(erreurDeReseau(new Error('Google Drive ne répond pas (réseau trop lent ?)'))).toBe(true);
    expect(erreurDeReseau(new Error('connexion Google impossible (code 7) : network error'))).toBe(true);
  });
  it('pas le réseau : fenêtre annulée, refus de Drive', () => {
    expect(erreurDeReseau(new Error('connexion Google annulée'))).toBe(false);
    expect(erreurDeReseau(new Error('Google Drive a refusé (403)'))).toBe(false);
  });
});

describe('changement fait ailleurs (changeAilleurs)', () => {
  const MOI = 'app-moi';
  it('même date que lors du dernier échange : rien de nouveau', () => {
    expect(changeAilleurs({ modifieLe: 'A', envoyePar: 'autre' }, { distantVu: 'A' }, MOI)).toBe(false);
  });
  it('date changée par un autre appareil : changé ailleurs', () => {
    expect(changeAilleurs({ modifieLe: 'B', envoyePar: 'autre' }, { distantVu: 'A' }, MOI)).toBe(true);
  });
  it('date changée par cet appareil (réponse de Drive perdue) : pas changé ailleurs', () => {
    expect(changeAilleurs({ modifieLe: 'B', envoyePar: MOI }, { distantVu: 'A' }, MOI)).toBe(false);
  });
  it('ancien dossier sans envoyePar : on se fie à celui qui avait le verrou', () => {
    expect(changeAilleurs({ modifieLe: 'B', verrouPar: MOI }, { envoyeLe: 'A' }, MOI)).toBe(false);
    expect(changeAilleurs({ modifieLe: 'B' }, { envoyeLe: 'A' }, MOI)).toBe(true);
  });
  it('rien sur Drive : rien de changé ailleurs', () => {
    expect(changeAilleurs({}, null, MOI)).toBe(false);
  });
});

describe('choisirVersion avec la date de Drive vue au dernier échange', () => {
  it('Drive pas changé, projet enregistré ici après le téléchargement : version de l\'appareil', () => {
    expect(choisirVersion({ local: '2026-10-30T10:05', envoyeLe: '2026-10-30T10:05', distant: '2026-10-30T09:00', distantVu: '2026-10-30T09:00' })).toBe('local');
  });
  it('Drive changé ailleurs, rien ici : version de Drive', () => {
    expect(choisirVersion({ local: '2026-10-30T10:05', envoyeLe: '2026-10-30T10:05', distant: '2026-10-30T09:30', distantVu: '2026-10-30T09:00' })).toBe('distant');
  });
  it('changé des deux côtés : conflit', () => {
    expect(choisirVersion({ local: '2026-10-30T10:30', envoyeLe: '2026-10-30T10:05', distant: '2026-10-30T09:30', distantVu: '2026-10-30T09:00' })).toBe('conflit');
  });
});

describe('Drive qui ne répond pas', () => {
  it('une demande sans réponse finit en erreur lisible (pas d\'attente sans fin)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { creerDrive: vraiDrive } = await vi.importActual('../src/partage/drive.js');
      const drive = vraiDrive({ obtenirJeton: async () => 'jeton', envoyerRequete: () => new Promise(() => {}) });
      const essai = drive.lister('x');
      const verif = expect(essai).rejects.toThrow('Google Drive ne répond pas');
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      await verif;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('jeton Google demandé à l\'APK', () => {
  it('sans réponse d\'Android, la connexion échoue avec un message (pas d\'attente sans fin)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    globalThis.window = { AppliAndroid: { demanderJetonDrive: () => {} } };
    try {
      const { jetonAndroid } = await vi.importActual('../src/partage/connexion.js');
      const verif = expect(jetonAndroid(false)).rejects.toThrow('Google ne répond pas');
      await vi.advanceTimersByTimeAsync(3 * 60_000);
      await verif;
      expect(globalThis.window.recevoirJetonDrive).toBeNull();
    } finally {
      vi.useRealTimers();
      delete globalThis.window;
    }
  });

  it('réponse d\'Android : le jeton est rendu', async () => {
    globalThis.window = { AppliAndroid: { demanderJetonDrive: () => setTimeout(() => globalThis.window.recevoirJetonDrive({ ok: true, jeton: 'abc' }), 0) } };
    try {
      const { jetonAndroid } = await vi.importActual('../src/partage/connexion.js');
      expect(await jetonAndroid(false)).toBe('abc');
    } finally {
      delete globalThis.window;
    }
  });
});
