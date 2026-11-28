import { describe, it, expect } from 'vitest';
import { enregistrerGabarit, utiliserGabarit, supprimerGabarit, gabaritsDe, presentationsDe } from '../src/topo/presentations.js';

describe('gabarits de présentation (0.338.0)', () => {
  it('enregistrer un gabarit dans le projet, puis l\'utiliser sur un autre plan', () => {
    const projet = {};
    const plan1 = { id: 'p1', feuille: { format: 'a1', orientation: 'portrait' }, echelle: 100, phases: [] };
    const g = enregistrerGabarit(projet, plan1, 'Standard');
    expect(gabaritsDe(projet)).toHaveLength(1);
    expect(g.feuille.format).toBe('a1');
    const plan2 = { id: 'p2', feuille: { format: 'a3' }, echelle: 500 };
    utiliserGabarit(plan2, g);
    expect(plan2.feuille.format).toBe('a1');
    expect(plan2.echelle).toBe(100);
    expect(presentationsDe(plan2)).toHaveLength(1);
    expect(plan2.feuille).not.toBe(g.feuille); // copie indépendante
  });
  it('nom déjà pris : (2) ; suppression du gabarit', () => {
    const projet = {};
    const plan = { feuille: {}, echelle: 200 };
    enregistrerGabarit(projet, plan, 'A');
    const b = enregistrerGabarit(projet, plan, 'A');
    expect(b.nom).toBe('A (2)');
    supprimerGabarit(projet, b.id);
    expect(gabaritsDe(projet).map((x) => x.nom)).toEqual(['A']);
  });
});

import { ajouterGabaritPartage, utiliserGabaritPartage, feuilleSansChantier } from '../src/topo/presentations.js';
import { nettoyerListes, fusionnerListes } from '../src/reglages/listes-partagees.js';

describe('gabarits pour tous les projets (0.365.0)', () => {
  const feuille = { format: 'a1', cartouche: 'hg', titrePage: { actif: true }, logos: ['perrin', 'ronchi'], centre: [2500000, 1118000], details: [{ id: 'd1' }], plans: { x: { visible: true } }, phase: 'ph1', rotation: 30, titre: 'Plan A', chantier: 'Rue X', date: '1.1', indice: 'C', positions: { nord: { fx: 0.1, fy: 0.1 }, 'det:d1': { fx: 0.5, fy: 0.5 } } };
  it('le gabarit garde la mise en page, pas ce qui appartient au chantier', () => {
    const f = feuilleSansChantier(feuille);
    expect(f).toMatchObject({ format: 'a1', cartouche: 'hg', titrePage: { actif: true }, logos: ['perrin', 'ronchi'], positions: { nord: { fx: 0.1, fy: 0.1 } } });
    for (const c of ['centre', 'details', 'plans', 'phase', 'rotation', 'titre', 'chantier', 'date', 'indice']) expect(f[c]).toBeUndefined();
    expect(f.positions['det:d1']).toBeUndefined();
  });
  it('enregistrer puis utiliser : le plan garde son endroit, ses détails, son titre', () => {
    const { liste, gabarit } = ajouterGabaritPartage([], { feuille, echelle: 250 }, 'Standard');
    expect(liste).toHaveLength(1);
    expect(ajouterGabaritPartage(liste, { feuille, echelle: 250 }, 'standard').gabarit.nom).toBe('standard (2)');
    const autre = { feuille: { format: 'a3', centre: [2600000, 1200000], titre: 'Plan B', details: [{ id: 'd9' }], positions: { 'det:d9': { fx: 0.2, fy: 0.3 } } }, echelle: 500 };
    utiliserGabaritPartage(autre, gabarit);
    expect(autre.feuille).toMatchObject({ format: 'a1', cartouche: 'hg', centre: [2600000, 1200000], titre: 'Plan B', details: [{ id: 'd9' }] });
    expect(autre.feuille.positions).toEqual({ nord: { fx: 0.1, fy: 0.1 }, 'det:d9': { fx: 0.2, fy: 0.3 } });
    expect(autre.echelle).toBe(250);
  });
  it('partie « gabarits » des listes partagées : gardée et fusionnée comme les autres', () => {
    const g = { id: 'g1', nom: 'A', feuille: {}, echelle: 200 };
    expect(nettoyerListes({ gabarits: [g, { nom: 'sans id' }] }).gabarits).toEqual([g]);
    const local = { gabarits: [g], dates: { gabarits: '2026-11-28T10:00:00Z' } };
    const distant = { gabarits: [g, { ...g, id: 'g2', nom: 'B' }], dates: { gabarits: '2026-11-28T11:00:00Z' } };
    expect(fusionnerListes(local, distant).listes.gabarits).toHaveLength(2);
  });
});
