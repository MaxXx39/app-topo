import { describe, it, expect } from 'vitest';
import { creerCapAuto, decisionCapAuto } from '../src/plan/cap-auto.js';

describe('cap automatique du plan', () => {
  it('passe en cap quand le GNSS devient prêt, revient à l\'orientation d\'avant ensuite', () => {
    const memoire = creerCapAuto();
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'suivre' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'suivre' })).toBe('cap');
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'cap' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'cap' })).toEqual({ revenir: 'suivre' });
  });

  it('ne revient pas si l\'utilisateur a changé l\'orientation lui-même', () => {
    const memoire = creerCapAuto();
    decisionCapAuto(memoire, { pret: true, suivi: 'libre' });
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'suivre' })).toBe(null); // nord en haut choisi
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'suivre' })).toBe(null);
  });

  it('ne repasse pas en cap tant que le GNSS reste prêt', () => {
    const memoire = creerCapAuto();
    decisionCapAuto(memoire, { pret: true, suivi: 'libre' });
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'libre' })).toBe(null);
  });

  it('déjà en cap ou plan occupé : rien à faire', () => {
    const memoire = creerCapAuto();
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'cap' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: false, suivi: 'cap' })).toBe(null);
    expect(decisionCapAuto(memoire, { pret: true, suivi: 'libre', occupe: true })).toBe(null);
  });
});
