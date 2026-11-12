// Navigation 0.156.0 : liste des applications, application en cours, favoris de la roue (par tablette).
import { describe, it, expect } from 'vitest';
import { APPLIS, applisDisponibles, appliCourante, lireFavoris, ecrireFavoris, basculerFavori, FAVORIS_DEPART, MAX_FAVORIS, CLE_FAVORIS, lireOrdre, ecrireOrdre, ordonner, CLE_ORDRE } from '../src/navigation/applis.js';

/** Petite mémoire qui imite localStorage. */
function memoire(depart = {}) {
  const valeurs = { ...depart };
  return { getItem: (cle) => valeurs[cle] ?? null, setItem: (cle, valeur) => { valeurs[cle] = String(valeur); }, valeurs };
}
const mode = (niveau) => (demande) => ({ base: 0, intermediaire: 1, expert: 2 }[niveau] >= { intermediaire: 1, expert: 2 }[demande]);
const cles = (liste) => liste.map((a) => a.cle);

describe('applications proposées', () => {
  it('APK en Base : sans Calculs ni Guidage', () => {
    expect(cles(applisDisponibles({ avecRecepteur: true, aAcces: mode('base') }))).toEqual(['lever', 'implanter', 'controle', 'plan', 'recepteur']);
  });
  it('APK en Expert : toutes', () => {
    expect(cles(applisDisponibles({ avecRecepteur: true, aAcces: mode('expert') }))).toEqual(['lever', 'implanter', 'mesure', 'annotation', 'controle', 'guidage', 'calculs', 'plan', 'recepteur']);
  });
  it('site : pas d\'Implanter, de Guidage ni de Récepteur ; Contrôle dès Intermédiaire', () => {
    expect(cles(applisDisponibles({ avecRecepteur: false, aAcces: mode('base') }))).toEqual(['lever', 'plan']);
    expect(cles(applisDisponibles({ avecRecepteur: false, aAcces: mode('intermediaire') }))).toEqual(['lever', 'mesure', 'annotation', 'controle', 'calculs', 'plan']);
  });
});

describe('application en cours', () => {
  it('d\'après l\'onglet et le mode de Terrain', () => {
    expect(appliCourante('projets', 'lever')).toBe('projet');
    expect(appliCourante('terrain', 'lever')).toBe('lever');
    expect(appliCourante('terrain', 'controler')).toBe('implanter');
    expect(appliCourante('terrain', 'autocontrole')).toBe('controle');
    expect(appliCourante('terrain', 'lame')).toBe('guidage');
    expect(appliCourante('plan', 'lever')).toBe('plan');
    expect(appliCourante('mesure-rapide', 'lever')).toBe('mesure');
    expect(appliCourante('annotation', 'lever')).toBe('annotation');
  });
  it('plus d\'application Recollement ni Métré (0.212.0) : le Terrain reste le Levé', () => {
    expect(appliCourante('terrain', 'lever')).toBe('lever');
    expect(APPLIS.map((a) => a.cle)).not.toContain('recollement');
    expect(APPLIS.map((a) => a.cle)).not.toContain('metre');
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
  it('cocher, décocher, 4 au plus', () => {
    let liste = ['lever'];
    ({ liste } = basculerFavori(liste, 'plan'));
    expect(liste).toEqual(['lever', 'plan']);
    ({ liste } = basculerFavori(liste, 'lever'));
    expect(liste).toEqual(['plan']);
    const pleine = ['lever', 'implanter', 'plan', 'controle'];
    expect(pleine).toHaveLength(MAX_FAVORIS);
    expect(MAX_FAVORIS).toBe(4);
    expect(basculerFavori(pleine, 'calculs')).toEqual({ liste: pleine, refuse: true });
  });
});

describe('ordre des tuiles (appui long pour déplacer)', () => {
  const applis = ['lever', 'implanter', 'controle', 'plan'].map((cle) => ({ cle }));
  it('sans ordre retenu : ordre de départ', () => {
    expect(cles(ordonner(applis, []))).toEqual(['lever', 'implanter', 'controle', 'plan']);
  });
  it('ordre retenu d\'abord, les nouvelles à la fin dans l\'ordre de départ', () => {
    expect(cles(ordonner(applis, ['plan', 'lever']))).toEqual(['plan', 'lever', 'implanter', 'controle']);
    expect(cles(ordonner(applis, ['guidage', 'controle']))).toEqual(['controle', 'lever', 'implanter', 'plan']);
  });
  it('retenu sur l\'appareil', () => {
    const m = memoire();
    ecrireOrdre(['plan', 'lever'], m);
    expect(lireOrdre(m)).toEqual(['plan', 'lever']);
    expect(lireOrdre(memoire({ [CLE_ORDRE]: 'abîmé' }))).toEqual([]);
  });
});
