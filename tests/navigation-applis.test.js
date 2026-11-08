// Navigation 0.156.0 : liste des applications, application en cours, favoris de la roue (par tablette).
import { describe, it, expect } from 'vitest';
import { applisDisponibles, appliCourante, lireFavoris, ecrireFavoris, basculerFavori, FAVORIS_DEPART, MAX_FAVORIS, CLE_FAVORIS } from '../src/navigation/applis.js';

/** Petite mémoire qui imite localStorage. */
function memoire(depart = {}) {
  const valeurs = { ...depart };
  return { getItem: (cle) => valeurs[cle] ?? null, setItem: (cle, valeur) => { valeurs[cle] = String(valeur); }, valeurs };
}
const mode = (niveau) => (demande) => ({ base: 0, intermediaire: 1, expert: 2 }[niveau] >= { intermediaire: 1, expert: 2 }[demande]);
const cles = (liste) => liste.map((a) => a.cle);

describe('applications proposées', () => {
  it('APK en Base : sans Calculs ni Guidage', () => {
    expect(cles(applisDisponibles({ avecRecepteur: true, aAcces: mode('base') }))).toEqual(['lever', 'implanter', 'controle', 'plan', 'recepteur', 'reglages']);
  });
  it('APK en Expert : toutes', () => {
    expect(cles(applisDisponibles({ avecRecepteur: true, aAcces: mode('expert') }))).toEqual(['lever', 'implanter', 'controle', 'guidage', 'calculs', 'plan', 'recepteur', 'reglages']);
  });
  it('site : pas d\'Implanter, de Guidage ni de Récepteur ; Contrôle dès Intermédiaire', () => {
    expect(cles(applisDisponibles({ avecRecepteur: false, aAcces: mode('base') }))).toEqual(['lever', 'plan', 'reglages']);
    expect(cles(applisDisponibles({ avecRecepteur: false, aAcces: mode('intermediaire') }))).toEqual(['lever', 'controle', 'calculs', 'plan', 'reglages']);
  });
});

describe('application en cours', () => {
  it('d\'après l\'onglet et le mode de Terrain', () => {
    expect(appliCourante('projets', 'lever')).toBe('projet');
    expect(appliCourante('terrain', 'lever')).toBe('lever');
    expect(appliCourante('terrain', 'controler')).toBe('implanter');
    expect(appliCourante('terrain', 'autocontrole')).toBe('controle');
    expect(appliCourante('terrain', 'lame')).toBe('guidage');
    expect(appliCourante('mesures', 'lame')).toBe('calculs');
    expect(appliCourante('plan', 'lever')).toBe('plan');
  });
});

describe('favoris de la roue', () => {
  it('au départ : Lever, Implanter, Plan', () => {
    expect(lireFavoris(memoire())).toEqual(FAVORIS_DEPART);
    expect(FAVORIS_DEPART).toEqual(['lever', 'implanter', 'plan']);
  });
  it('retenus sur l\'appareil, clés inconnues ignorées', () => {
    const m = memoire();
    ecrireFavoris(['controle', 'calculs'], m);
    expect(JSON.parse(m.valeurs[CLE_FAVORIS])).toEqual(['controle', 'calculs']);
    expect(lireFavoris(memoire({ [CLE_FAVORIS]: '["lever","inconnue","plan"]' }))).toEqual(['lever', 'plan']);
    expect(lireFavoris(memoire({ [CLE_FAVORIS]: 'abîmé' }))).toEqual(FAVORIS_DEPART);
  });
  it('cocher, décocher, 5 au plus', () => {
    let liste = ['lever'];
    ({ liste } = basculerFavori(liste, 'plan'));
    expect(liste).toEqual(['lever', 'plan']);
    ({ liste } = basculerFavori(liste, 'lever'));
    expect(liste).toEqual(['plan']);
    const pleine = ['lever', 'implanter', 'plan', 'controle', 'calculs'];
    expect(pleine).toHaveLength(MAX_FAVORIS);
    expect(basculerFavori(pleine, 'reglages')).toEqual({ liste: pleine, refuse: true });
  });
});
