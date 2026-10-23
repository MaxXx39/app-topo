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

  it('garde les photos à part et les remet quand on annule', () => {
    const h = creerHistorique();
    const photo = { id: 'ph1', legende: '', image: 'data:image/jpeg;base64,GRANDE', miniature: 'data:image/jpeg;base64,PETITE' };
    const avec = { id: 'p1', nom: 'A', surfaces: [{ id: 's', photos: [photo] }] };
    reinitialiser(h, avec);
    // Les étapes ne contiennent pas les images (l'historique reste léger).
    expect(h.actuel).not.toContain('GRANDE');
    memoriser(h, { ...avec, surfaces: [{ id: 's', photos: [] }] });
    const revenu = annuler(h);
    expect(revenu.surfaces[0].photos[0]).toEqual(photo);
  });
});

describe('historique et plans DXF', () => {
  it('ne recopie pas le contenu d\'un plan DXF à chaque étape, et le remet en place', async () => {
    const { creerHistorique, reinitialiser, memoriser, annuler } = await import('../src/projet/historique.js');
    const { creerProjet } = await import('../src/projet/projet.js');
    const historique = creerHistorique();
    const projet = creerProjet('Essai');
    const contenu = { traits: [{ c: 0, k: null, p: new Array(10000).fill(1.5), f: false }], pleins: [], cercles: [], textes: [], points: [] };
    projet.plansDxf.push({ id: 'p1', nom: 'plan.dxf', calques: [{ nom: 'axe', couleur: '#000000', visible: true }], contenu });
    reinitialiser(historique, projet);
    projet.plansDxf[0].calques[0].visible = false;
    memoriser(historique, projet);
    expect(historique.actuel.length).toBeLessThan(2000);
    const avant = annuler(historique);
    expect(avant.plansDxf[0].calques[0].visible).toBe(true);
    expect(avant.plansDxf[0].contenu.traits[0].p).toHaveLength(10000);
  });
});
