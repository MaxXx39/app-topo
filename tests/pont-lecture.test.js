import { describe, it, expect, afterEach } from 'vitest';
import { lectureAndroidDisponible, lireParAndroid } from '../src/android/pont.js';

describe('lecture d\'une adresse par Android (cadastre)', () => {
  afterEach(() => {
    delete globalThis.window;
  });
  it('passe par AppliAndroid.lireAdresse et rend une réponse comme fetch', async () => {
    globalThis.window = {
      AppliAndroid: {
        lireAdresse: (numero, adresse) => setTimeout(() => window.recevoirAdresse(numero, { ok: true, statut: 200, texte: `lu ${adresse}` }), 0),
      },
    };
    expect(lectureAndroidDisponible()).toBe(true);
    const reponse = await lireParAndroid('https://www.rdppf.vd.ch/x');
    expect(reponse.ok).toBe(true);
    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toBe('lu https://www.rdppf.vd.ch/x');
  });
  it('transmet une erreur d\'Android', async () => {
    globalThis.window = { AppliAndroid: { lireAdresse: (numero) => setTimeout(() => window.recevoirAdresse(numero, { erreur: 'adresse non autorisée' }), 0) } };
    await expect(lireParAndroid('https://autre.ch')).rejects.toThrow(/non autorisée/);
  });
});
