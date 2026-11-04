import { describe, it, expect } from 'vitest';
import { creerCapAuto, decisionCapAuto } from '../src/plan/cap-auto.js';

describe('cap automatique du plan', () => {
  it('prêt : cap ; pas prêt : suivi avec le nord en haut', () => {
    const memoire = creerCapAuto();
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'libre' })).toEqual({ revenir: 'suivre' }); // tout premier état
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'suivre' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'suivre' })).toBe('cap');
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'cap' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'cap' })).toEqual({ revenir: 'suivre' });
  });

  it('prêt dès le début, même si le plan était libre : cap', () => {
    const memoire = creerCapAuto();
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'libre' })).toBe('cap');
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'libre' })).toBe(null); // l'utilisateur a bougé le plan : on ne reprend pas
  });

  it('déjà en cap ou plan occupé : rien à faire', () => {
    const memoire = creerCapAuto();
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'cap' })).toBe(null);
    const autre = creerCapAuto();
    expect(decisionCapAuto(autre, { pret: true, suivi: 'libre', occupe: true })).toBe(null);
  });
});
