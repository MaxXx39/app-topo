import { describe, it, expect } from 'vitest';
import { plansDeLaFeuille, reglagesFeuille } from '../src/topo/feuille-chantier.js';

describe('plans de la feuille (0.317.0)', () => {
  const A = { id: 'a', nom: 'A', transparence: 0 };
  const B = { id: 'b', nom: 'B', transparence: 0 };
  const C = { id: 'c', nom: 'C', transparence: 20 };
  const tous = [A, B, C];

  it('sans réglage : les plans de l\'écran', () => {
    expect(plansDeLaFeuille(tous, [A, B], null)).toEqual([A, B]);
    expect(reglagesFeuille({}).plans).toBeNull();
  });
  it('cases propres à la feuille, plan caché à l\'écran montré sur la feuille', () => {
    const r = { a: { visible: false }, c: { visible: true, opacite: 80 } };
    const res = plansDeLaFeuille(tous, [A, B], r);
    expect(res.map((p) => p.id)).toEqual(['b', 'c']); // B suit l'écran, A décoché, C coché
    expect(res[1]).toBe(C); // opacité 80 % = transparence 20 % : déjà celle du plan, pas de copie
  });
  it('opacité réglée : copie avec la transparence, la même copie à chaque appel', () => {
    const r = { a: { visible: true, opacite: 40 } };
    const x = plansDeLaFeuille(tous, [A], r)[0];
    expect(x.transparence).toBe(60);
    expect(A.transparence).toBe(0);
    expect(plansDeLaFeuille(tous, [A], r)[0]).toBe(x);
  });
});
