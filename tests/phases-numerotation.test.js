import { describe, it, expect } from 'vitest';
import { nouveauPlanChantier, ajouterPhase, ajouterObjet, objetsVisibles } from '../src/topo/plan-chantier.js';
import { libellePhase, nomSansNumero, renommerPhase, deplacerPhase } from '../src/topo/phases-chantier.js';

describe('numéro des phases (0.354.0)', () => {
  it('le numéro vient du rang et suit l\'ordre', () => {
    const plan = nouveauPlanChantier('Essai', 'pic', '2026-11-28');
    const p1 = plan.phases[0];
    renommerPhase(plan, p1.id, 'Terrassement');
    const p2 = ajouterPhase(plan, 'Bâtiment');
    expect(libellePhase(plan, p1)).toBe('1 - Terrassement');
    expect(libellePhase(plan, p2)).toBe('2 - Bâtiment');
    deplacerPhase(plan, p2.id, -1);
    expect(libellePhase(plan, p2)).toBe('1 - Bâtiment');
    expect(libellePhase(plan, p1)).toBe('2 - Terrassement');
  });
  it('un numéro tapé à la main est retiré', () => {
    expect(nomSansNumero('3 - Gros œuvre')).toBe('Gros œuvre');
    expect(nomSansNumero('Phase 4')).toBe('Phase');
  });
  it('« Toutes » montre les éléments de toutes les phases', () => {
    const plan = nouveauPlanChantier('Essai', 'pic', '2026-11-28');
    ajouterObjet(plan, { type: 'texte', point: [0, 0], texte: 'a' });
    const p2 = ajouterPhase(plan, 'B');
    ajouterObjet(plan, { type: 'texte', point: [1, 1], texte: 'b' });
    plan.phaseActive = plan.phases[0].id;
    expect(objetsVisibles(plan)).toHaveLength(1);
    plan.voirToutes = true;
    expect(objetsVisibles(plan)).toHaveLength(2);
    expect(p2.id).toBeTruthy();
  });
  it('les points levés ne sont pas affichés au départ', () => {
    expect(nouveauPlanChantier('Essai', 'pic', '2026-11-28').fond.points).toBe(false);
  });
});
