import { describe, it, expect } from 'vitest';
import { tranchesDeTalus, texteDePente } from '../src/topo/tranches-talus.js';

const bord = [
  { est: 0, nord: 0, nature: 'remblai', sommet: 0 },
  { est: 5, nord: 0, nature: 'remblai' },
  { est: 10, nord: 0, nature: 'remblai' },
  { est: 10, nord: 0, nature: 'deblai', sommet: 1 },
  { est: 10, nord: 5, nature: 'deblai' },
];
const entree = bord.map((p, i) => ({ est: p.est + (i < 3 ? 0 : 3), nord: p.nord - (i < 3 ? 3 : 0), nature: p.nature }));
const pentes = { remblai: { horizontal: 3, vertical: 2 }, deblai: { horizontal: 1, vertical: 1 } };

describe('tranches de talus', () => {
  it('écrit la pente H/V', () => {
    expect(texteDePente({ horizontal: 3, vertical: 2 })).toBe('3/2');
    expect(texteDePente({ horizontal: 1.25, vertical: 1 })).toBe('1,25/1');
  });
  it('une tranche par côté et par nature', () => {
    const t = tranchesDeTalus({ bord, entree }, pentes);
    expect(t.length).toBe(2);
    expect(t[0].nature).toBe('remblai');
    expect(t[0].pente).toBe('3/2');
    expect(t[1].nature).toBe('deblai');
    expect(t[1].pente).toBe('1/1');
  });
  it('remblai : haut = plateforme ; déblai : haut = entrée en terre', () => {
    const [remblai, deblai] = tranchesDeTalus({ bord, entree }, pentes);
    expect(remblai.haut[0]).toEqual({ est: 0, nord: 0 });
    expect(remblai.bas[0]).toEqual({ est: 0, nord: -3 });
    expect(deblai.haut[0]).toEqual({ est: 13, nord: 0 });
    expect(deblai.bas[0]).toEqual({ est: 10, nord: 0 });
  });
  it('rien sans talus ou avec erreur', () => {
    expect(tranchesDeTalus(null, pentes)).toEqual([]);
    expect(tranchesDeTalus({ erreur: 'x' }, pentes)).toEqual([]);
  });
});
