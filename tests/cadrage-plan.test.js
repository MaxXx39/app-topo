import { describe, it, expect } from 'vitest';
import { groupePrincipal } from '../src/topo/cadrage-plan.js';

const trait = (x1, y1, x2, y2) => ({ p: [x1, y1, x2, y2] });

describe('groupePrincipal (0.319.10)', () => {
  it('écarte les traits dessinés près de 0,0 quand le plan est en MN95', () => {
    const traits = [];
    for (let i = 0; i < 40; i++) traits.push(trait(i, i % 5, i + 1, (i % 5) + 2)); // plan : 0..41 m autour de l'origine (2 500 000 ; 1 120 000)
    traits.push(trait(-2500000, -1120000, -2499997, -1119998), trait(-2499999, -1120000, -2499998, -1119999));
    const g = groupePrincipal({ origine: { est: 2500000, nord: 1120000 }, contenu: { traits } });
    expect(g.ecartes).toBe(2);
    expect(g.bornes.estMin).toBeGreaterThan(2499990);
    expect(g.bornes.estMax).toBeLessThan(2500100);
  });
  it('rien à écarter : null', () => {
    const traits = Array.from({ length: 30 }, (_, i) => trait(i, 0, i + 1, 1));
    expect(groupePrincipal({ origine: { est: 0, nord: 0 }, contenu: { traits } })).toBeNull();
  });
  it('trop peu d\'objets : null', () => {
    expect(groupePrincipal({ origine: { est: 0, nord: 0 }, contenu: { traits: [trait(0, 0, 1, 1), trait(9e6, 9e6, 9e6 + 1, 9e6)] } })).toBeNull();
  });
  it('petit plan avec 2 traits à 0,0 sur 7 : écartés', () => {
    const traits = [trait(0, 0, 60, 0), trait(60, 0, 60, 30), trait(60, 30, 20, 45), trait(20, 45, 0, 30), trait(0, 30, 0, 0), trait(-2500000, -1120000, -2499997, -1119998), trait(-2499997, -1119998, -2499999, -1119995)];
    expect(groupePrincipal({ origine: { est: 2500000, nord: 1120000 }, contenu: { traits } }).ecartes).toBe(2);
  });
});
