// Pont de l'appli Windows (windows/Topo/pont-windows.js) : le petit script que Topo.exe glisse dans la page
// pour fabriquer window.AppliAndroid. On le fait tourner ici avec une fausse fenêtre Windows.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../windows/Topo/pont-windows.js', import.meta.url), 'utf-8');

/** Lance le script dans une fausse page ; renvoie la page et les messages partis vers Windows. */
function lancer(depart = {}) {
  const messages = [];
  const page = { chrome: { webview: { postMessage: (m) => messages.push(m) } } };
  page.top = page;
  // Même remplacement que Fenetre.ScriptDuPont (C#).
  const script = source.replace('/*DEPART*/ {}', JSON.stringify(depart));
  new Function('window', script)(page);
  return { page, messages };
}

describe('pont de l\'appli Windows', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('offre les mêmes fonctions que l\'APK Android', () => {
    const { page } = lancer();
    const kotlin = readFileSync(new URL('../android/app/src/main/java/ch/apptopo/PontAndroid.kt', import.meta.url), 'utf-8');
    const fonctionsAndroid = [...kotlin.matchAll(/@JavascriptInterface\s+fun (\w+)/g)].map((m) => m[1]);
    expect(fonctionsAndroid.length).toBeGreaterThan(20);
    for (const nom of fonctionsAndroid) expect(typeof page.AppliAndroid[nom], nom).toBe('function');
    expect(page.AppliAndroid.estWindows).toBe(true);
  });

  it('ne fait rien hors de l\'appli Windows, ni si le pont existe déjà', () => {
    const page = {};
    page.top = page;
    new Function('window', source)(page);
    expect(page.AppliAndroid).toBeUndefined();
  });

  it('envoie les ordres à Windows avec leurs valeurs', () => {
    const { page, messages } = lancer();
    page.AppliAndroid.choisirRecepteur();
    page.AppliAndroid.enregistrerFichier('a.csv', 'text/csv', 'QUJD');
    page.AppliAndroid.partagerFichierMail('a.pdf', 'application/pdf', 'QUJD', 'x@y.ch');
    page.AppliAndroid.lireAdresse(7, 'https://geodienste.ch/x');
    expect(messages).toEqual([
      { fonction: 'choisirRecepteur', args: [] },
      { fonction: 'enregistrerFichier', args: ['a.csv', 'text/csv', 'QUJD'] },
      { fonction: 'partagerFichier', args: ['a.pdf', 'application/pdf', 'QUJD', 'x@y.ch'] },
      { fonction: 'lireAdresse', args: [7, 'https://geodienste.ch/x'] },
    ]);
  });

  it('prendre un point : refusé sans position, accepté avec une position fraîche, refusé après 1 s', () => {
    const { page } = lancer();
    expect(JSON.parse(page.AppliAndroid.prendrePoint())).toEqual({ ok: false, raison: 'Pas de position récente du récepteur' });
    const point = JSON.stringify({ ok: true, point: { est: 2509500.921, nord: 1141119.69, altitude: 414.856 } });
    const etats = [];
    page.recevoirEtatRecepteur = (etat) => etats.push(etat);
    page.__topoWindows.etat({ connecte: true }, point, { connecte: false }, 'copie', null, '');
    expect(etats).toEqual([{ connecte: true }]);
    expect(page.AppliAndroid.prendrePoint()).toBe(point);
    vi.advanceTimersByTime(900);
    expect(JSON.parse(page.AppliAndroid.prendrePoint()).ok).toBe(true);
    vi.advanceTimersByTime(200);
    expect(JSON.parse(page.AppliAndroid.prendrePoint()).ok).toBe(false);
  });

  it('transmet l\'état du 2e récepteur et la position de la tablette', () => {
    const { page } = lancer();
    const recus = [];
    page.recevoirEtatRecepteur2 = (etat, mode) => recus.push(['r2', etat.connecte, mode]);
    page.recevoirPositionTablette = (position) => recus.push(['tablette', position]);
    page.__topoWindows.etat({}, '{}', { connecte: true }, 'ntrip', { est: 1, nord: 2, precision: 3 }, '');
    expect(recus).toEqual([['r2', true, 'ntrip'], ['tablette', { est: 1, nord: 2, precision: 3 }]]);
  });

  it('réglages des corrections : valeurs de départ, puis tenus à jour', () => {
    const reglages1 = JSON.stringify({ hote: '', port: 2101, pointDeMontage: 'M', utilisateur: '', motDePasseEnregistre: false, actives: false });
    const { page, messages } = lancer({ reglages1, modele: 'Handheld CC180' });
    expect(page.AppliAndroid.lireReglagesCorrections()).toBe(reglages1);
    expect(page.AppliAndroid.modeleAppareil()).toBe('Handheld CC180');
    page.AppliAndroid.demarrerCorrections(JSON.stringify({ hote: 'swipos.ch', port: 2101, pointDeMontage: 'M', utilisateur: 'u', motDePasse: 'secret' }));
    const apres = JSON.parse(page.AppliAndroid.lireReglagesCorrections());
    expect(apres).toMatchObject({ hote: 'swipos.ch', utilisateur: 'u', actives: true, motDePasseEnregistre: true });
    expect(JSON.stringify(apres)).not.toContain('secret'); // le mot de passe ne reste jamais dans la page
    expect(messages[0].fonction).toBe('demarrerCorrections');
    page.AppliAndroid.arreterCorrections();
    expect(JSON.parse(page.AppliAndroid.lireReglagesCorrections()).actives).toBe(false);
    page.__topoWindows.reglages(1, '{"actives":true}');
    expect(page.AppliAndroid.lireReglagesCorrections()).toBe('{"actives":true}');
  });

  it('journal NMEA : vidé au démarrage, puis rempli par morceaux', () => {
    const { page } = lancer();
    page.__topoWindows.etat({}, '{}', {}, 'copie', null, 'vieille ligne\r\n');
    page.AppliAndroid.demarrerJournalNmea(30);
    expect(page.AppliAndroid.lireJournalNmea()).toBe('');
    page.__topoWindows.etat({}, '{}', {}, 'copie', null, '$GNGGA,1\r\n');
    page.__topoWindows.etat({}, '{}', {}, 'copie', null, '$GNETC,2\r\n');
    expect(page.AppliAndroid.lireJournalNmea()).toBe('$GNGGA,1\r\n$GNETC,2\r\n');
  });
});
