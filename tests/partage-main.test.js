// Une seule main par projet (0.76.0) : la tablette a la main, le bureau la prend (la tablette est
// mise en attente, en lecture seule), puis la rend (la tablette reprend la version de Drive et la main).
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

// Petite mémoire du navigateur (Node n'a pas de localStorage).
function memoire() {
  const donnees = {};
  return { getItem: (cle) => donnees[cle] ?? null, setItem: (cle, valeur) => (donnees[cle] = String(valeur)), removeItem: (cle) => delete donnees[cle] };
}

const BUREAU = { id: 'appareil-bureau', nom: 'PC bureau' };

/**
 * Laisse tourner les tâches de fond (compression…) jusqu'à ce que condition() soit vraie (5 s au
 * plus, en temps réel : la date du test est simulée, pas performance.now()).
 */
async function attendre(condition) {
  const debut = performance.now();
  while (!condition() && performance.now() - debut < 5000) await new Promise((fin) => setImmediate(fin));
  expect(condition()).toBe(true);
}

describe('une seule main par projet', () => {
  beforeEach(() => {
    // Seulement les minuteries et la date (la compression des fichiers a besoin des vraies tâches de fond).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    globalThis.localStorage = memoire();
    commun.drive = fauxDrive();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.localStorage;
  });

  it('la tablette perd la main (attente, rien n\'est envoyé), puis la reprend quand le bureau la rend', async () => {
    const { creerPartage } = await import('../src/partage/partage.js');
    const { nommerAppareil } = await import('../src/partage/memoire.js');
    nommerAppareil('Tablette Max');
    let ouvert = creerProjet('Essai');
    ouvert.modifieLe = '2026-10-27T08:00:00.000Z';
    const evenements = [];
    const partage = creerPartage({
      obtenirProjet: () => ouvert,
      titreDe: (p) => p.nom,
      lireLocal: async () => ouvert,
      ouvrirProjet: async (p) => {
        ouvert = p;
      },
      demanderPriseDeMain: async () => 'lecture',
      autoriserPrise: async () => true,
      quandMainPrise: (verrou) => evenements.push(`prise par ${verrou.nom}`),
      quandMainRendue: (nom) => evenements.push(`rendue par ${nom}`),
      quandChange: () => {},
      message: () => {},
    });

    // Connexion, puis premier envoi : la tablette a la main.
    await partage.connecter();
    await vi.advanceTimersByTimeAsync(3_000);
    await attendre(() => partage.etat.etat === 'a-jour');
    const bureau = creerSynchro(commun.drive, BUREAU);
    const [surDrive] = await bureau.listerProjets();
    expect(surDrive.verrou).toMatchObject({ nom: 'Tablette Max' });

    // Le bureau prend la main : en 30 s au plus, la tablette est en attente (lecture seule).
    await bureau.prendreVerrou(surDrive.dossierId);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(evenements).toEqual(['prise par PC bureau']);
    expect(partage.etat.repris).toMatchObject({ projetId: ouvert.id, nom: 'PC bureau', attente: true });

    // Le bureau travaille et envoie, puis rend la main.
    const lu = await bureau.telecharger(surDrive.dossierId);
    lu.projet.nom = 'Essai complété au bureau';
    lu.projet.modifieLe = '2026-10-27T09:00:00.000Z';
    await bureau.envoyer(lu.projet, lu.memoire, 'Essai');
    await bureau.rendreVerrou(surDrive.dossierId);

    // En 30 s au plus : la tablette reprend la version de Drive et la main.
    await vi.advanceTimersByTimeAsync(30_000);
    await attendre(() => evenements.length === 2);
    expect(evenements).toEqual(['prise par PC bureau', 'rendue par PC bureau']);
    expect(ouvert.nom).toBe('Essai complété au bureau');
    expect(partage.etat.repris).toBeNull();
    expect((await bureau.lireVerrou(surDrive.dossierId)).verrou).toMatchObject({ nom: 'Tablette Max' });
  });
});
