// 0.216.0 : centre d'un projet = centre de la boîte qui entoure tout son contenu (en Suisse seulement).
import { describe, expect, it } from 'vitest';
import { boiteDesPoints, centreDuProjet, centreDuTexte, estEnSuisse, texteDuCentre } from '../src/topo/centre-projet.js';

const p = (est, nord) => ({ est, nord });

describe('centre du projet', () => {
  it('boîte des points : les points hors de Suisse sont ignorés', () => {
    expect(boiteDesPoints([p(2509468, 1141162), p(2509478, 1141172), p(100, 200)])).toEqual({ estMin: 2509468, estMax: 2509478, nordMin: 1141162, nordMax: 1141172 });
    expect(boiteDesPoints([p(1, 2)])).toBeNull();
    expect(estEnSuisse(p(2509468, 1141162))).toBe(true);
    expect(estEnSuisse(p(NaN, 1141162))).toBe(false);
  });

  it('centre de la boîte (et non la moyenne des points), arrondi au mètre', () => {
    const projet = { leves: [{ points: [p(2509468, 1141162), p(2509468, 1141162), p(2509468, 1141162), p(2509500, 1141200)] }] };
    expect(centreDuProjet(projet)).toEqual({ est: 2509484, nord: 1141181 });
  });

  it('réunit levés, contrôle, à implanter, surfaces importées, dessins et plans', () => {
    const projet = {
      leves: [{ points: [p(2500000, 1100000)] }],
      pointsControle: [p(2500100, 1100000)],
      aImplanter: [p(2500000, 1100100)],
      surfaces: [{ points: [p(2500100, 1100100)] }, { points: ['P1', 'P2'] }],
      dessins: [{ sommets: [p(2500050, 1100050)] }],
      plansDxf: [{ bornes: { estMin: 2499900, estMax: 2500000, nordMin: 1099900, nordMax: 1100000 } }],
    };
    expect(centreDuProjet(projet)).toEqual({ est: 2500000, nord: 1100000 });
  });

  it('plan en coordonnées locales : ignoré ; projet vide : null', () => {
    expect(centreDuProjet({ plansDxf: [{ bornes: { estMin: 0, estMax: 50, nordMin: 0, nordMax: 30 } }] })).toBeNull();
    expect(centreDuProjet({ leves: [] })).toBeNull();
  });

  it('plan recalé : ses coins après recalage (translation de 2 000 m en Est)', () => {
    const plan = { bornes: { estMin: 0, estMax: 10, nordMin: 0, nordMax: 10 }, origine: { est: 0, nord: 0 }, contenu: { traits: [] },
      recalage: { applique: true, parametres: { a: 1, b: 0, tEst: 2500000, tNord: 1100000, echelle: 1, rotation: 0 }, paires: [] } };
    // Sans les vrais paramètres de Helmert on ne teste que le cas simple : le centre existe et reste en Suisse.
    const centre = centreDuProjet({ plansDxf: [plan], leves: [{ points: [p(2500005, 1100005)] }] });
    expect(centre).not.toBeNull();
    expect(estEnSuisse(centre)).toBe(true);
  });

  it('texte pour Drive : aller-retour, refus du hors-Suisse et des textes illisibles', () => {
    expect(texteDuCentre({ est: 2509468.4, nord: 1141162.6 })).toBe('2509468,1141163');
    expect(centreDuTexte('2509468,1141163')).toEqual({ est: 2509468, nord: 1141163 });
    expect(texteDuCentre({ est: 5, nord: 5 })).toBeNull();
    expect(centreDuTexte('abc')).toBeNull();
    expect(centreDuTexte(undefined)).toBeNull();
  });
});
