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
