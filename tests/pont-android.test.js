// Tests du pont vers l'appli Android (APK).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { enBase64, estDansAppliAndroid, enregistrerDansAndroid } from '../src/android/pont.js';

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
});
