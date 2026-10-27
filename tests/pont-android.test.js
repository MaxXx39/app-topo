// Tests du pont vers l'appli Android (APK).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { enBase64, estDansAppliAndroid, enregistrerDansAndroid, journalNmeaDisponible, demarrerJournalNmea, lireJournalNmea } from '../src/android/pont.js';

describe('enBase64', () => {
  it('code des octets en base64', () => {
    expect(enBase64(new TextEncoder().encode('Stock 1;1636.197'))).toBe(btoa('Stock 1;1636.197'));
  });

  it('marche sur un gros fichier (plus de 32 768 octets)', () => {
    const octets = new Uint8Array(100_000).map((_, i) => i % 256);
    const retour = Uint8Array.from(atob(enBase64(octets)), (c) => c.charCodeAt(0));
    expect(retour).toEqual(octets);
  });
});

describe('appli Android', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it("n'est pas détectée dans un navigateur normal", () => {
    globalThis.window = {};
    expect(estDansAppliAndroid()).toBe(false);
  });

  it("reçoit le nom, le type et le contenu du fichier à enregistrer", async () => {
    const enregistrerFichier = vi.fn();
    globalThis.window = { AppliAndroid: { enregistrerFichier } };
    expect(estDansAppliAndroid()).toBe(true);
    await enregistrerDansAndroid(new Blob(['abc'], { type: 'text/csv;charset=utf-8' }), 'volumes.csv');
    expect(enregistrerFichier).toHaveBeenCalledWith('volumes.csv', 'text/csv;charset=utf-8', btoa('abc'));
  });

  it('journal NMEA : seulement avec une APK qui le sait ; durée et texte passent par le pont', () => {
    globalThis.window = { AppliAndroid: { prendrePoint() {} } };
    expect(journalNmeaDisponible()).toBe(false);
    const demarrer = vi.fn();
    globalThis.window = { AppliAndroid: { demarrerJournalNmea: demarrer, lireJournalNmea: () => '$GNGGA,1\r\n$GNETC,2\r\n' } };
    expect(journalNmeaDisponible()).toBe(true);
    demarrerJournalNmea(60);
    expect(demarrer).toHaveBeenCalledWith(60);
    expect(lireJournalNmea().split('\r\n')[1]).toBe('$GNETC,2');
  });
});
