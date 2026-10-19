// Tests de l'historique (Annuler / Rétablir).
import { describe, it, expect } from 'vitest';
import { creerHistorique, reinitialiser, memoriser, annuler, retablir, peutAnnuler, peutRetablir } from '../src/projet/historique.js';

/** Petit projet de test. */
const projet = (nom, stocks = []) => ({ id: 'p1', nom, modifieLe: '2026-10-19', stocks });

describe('historique : annuler et rétablir', () => {
  it('annule puis rétablit une modification', () => {
    const h = creerHistorique();
    reinitialiser(h, projet('A'));
    expect(peutAnnuler(h)).toBe(false);

    memoriser(h, projet('B'));
    expect(peutAnnuler(h)).toBe(true);
    expect(annuler(h).nom).toBe('A');
    expect(peutRetablir(h)).toBe(true);
    expect(retablir(h).nom).toBe('B');
    expect(peutRetablir(h)).toBe(false);
  });

  it('annule plusieurs fois de suite, dans l\'ordre inverse', () => {
    const h = creerHistorique();
    reinitialiser(h, projet('A'));
    memoriser(h, projet('B'));
    memoriser(h, projet('C'));
    expect(annuler(h).nom).toBe('B');
    expect(annuler(h).nom).toBe('A');
    expect(annuler(h)).toBeNull();
  });

  it('ne retient pas une « modification » sans changement (seule la date d\'enregistrement change)', () => {
    const h = creerHistorique();
    reinitialiser(h, projet('A'));
    expect(memoriser(h, { ...projet('A'), modifieLe: '2026-10-20' })).toBe(false);
    expect(peutAnnuler(h)).toBe(false);
  });

  it('une nouvelle modification après une annulation efface ce qui pouvait être rétabli', () => {
    const h = creerHistorique();
    reinitialiser(h, projet('A'));
    memoriser(h, projet('B'));
    annuler(h);
    memoriser(h, projet('C'));
    expect(peutRetablir(h)).toBe(false);
    expect(annuler(h).nom).toBe('A');
  });

  it('garde au plus "limite" retours en arrière', () => {
    const h = creerHistorique(3);
    reinitialiser(h, projet('0'));
    for (let i = 1; i <= 5; i++) memoriser(h, projet(String(i)));
    expect(annuler(h).nom).toBe('4');
    expect(annuler(h).nom).toBe('3');
    expect(annuler(h).nom).toBe('2');
    expect(annuler(h)).toBeNull();
  });

  it('renvoie une copie : modifier le projet rendu ne change pas l\'historique', () => {
    const h = creerHistorique();
    reinitialiser(h, projet('A', ['s1']));
    memoriser(h, projet('B', ['s1', 's2']));
    const copie = annuler(h);
    copie.stocks.push('s9');
    expect(retablir(h).stocks).toEqual(['s1', 's2']);
    expect(annuler(h).stocks).toEqual(['s1']);
  });
});
