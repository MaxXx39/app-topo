import { describe, it, expect } from 'vitest';
import { journalVide, noter, aUnControleRecent } from '../src/recap/journal.js';

const projet = { id: 'p1', nom: '10203 Carrière' };
const H = 3600 * 1000;

describe('journal de l\'appareil', () => {
  it('compte ouvertures, points et implantations du jour', () => {
    const j = journalVide({ id: 'a1', nom: 'Tablette 1' });
    noter(j, projet, { type: 'ouverture' }, new Date(2026, 10, 3, 7, 30));
    noter(j, projet, { type: 'point', controleRecent: true }, new Date(2026, 10, 3, 8, 0));
    noter(j, projet, { type: 'implantation', controleRecent: true }, new Date(2026, 10, 3, 9, 0));
    expect(j.jours).toHaveLength(1);
    expect(j.jours[0]).toMatchObject({ jour: '2026-11-03', ouvertures: 1, points: 1, implantations: 1, sansControle: { points: 0, implantations: 0, depuis: null } });
  });

  it('note le travail fait sans contrôle, avec l\'heure du premier', () => {
    const j = journalVide();
    const premier = new Date(2026, 10, 3, 8, 0);
    noter(j, projet, { type: 'point', controleRecent: false }, premier);
    noter(j, projet, { type: 'point', controleRecent: false }, new Date(2026, 10, 3, 8, 5));
    expect(j.jours[0].sansControle).toEqual({ points: 2, implantations: 0, depuis: premier.toISOString() });
  });

  it('garde chaque contrôle avec ses écarts et sa couleur (jamais d\'avis)', () => {
    const j = journalVide();
    const le = new Date(2026, 10, 3, 7, 45).toISOString();
    noter(j, projet, { type: 'controle', controle: { id: 'c1', type: 'mesure', nom: 'PC1', ecarts: { est: 0.01, nord: -0.005, plan: 0.011, hauteur: 0.02 }, le } }, new Date(le));
    noter(j, projet, { type: 'controle', controle: { id: 'c2', type: 'refus', le } }, new Date(le));
    expect(j.controles).toHaveLength(2);
    expect(j.controles[0]).toMatchObject({ point: 'PC1', projet: '10203 Carrière', type: 'mesure' });
    // Sans couleur donnée : rien noté (le recap calculera avec 2 cm / 4 cm) ; jamais de « global » ni d'avis.
    expect(j.controles[0].resultat).toBeNull();
    expect(j.controles[0]).not.toHaveProperty('avis');
    expect(j.jours[0].controles).toBe(1);
  });

  it('oublie ce qui a plus de 12 semaines', () => {
    const j = journalVide();
    noter(j, projet, { type: 'ouverture' }, new Date(2026, 5, 1));
    noter(j, projet, { type: 'ouverture' }, new Date(2026, 10, 3));
    expect(j.jours.map((l) => l.jour)).toEqual(['2026-11-03']);
  });

  it('contrôle récent : même appareil, même jour, dans la durée', () => {
    const maintenant = new Date(2026, 10, 3, 12, 0);
    const c = (heure, appareil = 'T1', type = 'mesure') => ({ type, appareil, le: new Date(2026, 10, 3, heure, 0).toISOString() });
    expect(aUnControleRecent([c(9)], 'T1', maintenant, 4 * H)).toBe(true);
    expect(aUnControleRecent([c(7)], 'T1', maintenant, 4 * H)).toBe(false); // trop vieux
    expect(aUnControleRecent([c(9, 'T2')], 'T1', maintenant, 4 * H)).toBe(false); // autre appareil
    expect(aUnControleRecent([c(9, 'T1', 'refus')], 'T1', maintenant, 4 * H)).toBe(false);
    const hier = { type: 'mesure', appareil: 'T1', le: new Date(2026, 10, 2, 23, 0).toISOString() };
    expect(aUnControleRecent([hier], 'T1', new Date(2026, 10, 3, 0, 30), 4 * H)).toBe(false);
  });
});
