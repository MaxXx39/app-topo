// 0.214.0 : mesure de 5, 15 ou 30 secondes : moyenne des lectures, refus complet si une lecture est refusée.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demarrerMesure, moyennerPoints, DUREES_MESURE } from '../src/topo/mesure-duree.js';

describe('moyenne des lectures', () => {
  it('moyenne en Est, Nord et altitude ; plus mauvaise précision ; écart maximal', () => {
    const lectures = [
      { est: 100, nord: 200, altitude: 450, precisionH: 0.010, precisionV: 0.02 },
      { est: 100.02, nord: 200, altitude: 450.04, precisionH: 0.012, precisionV: 0.018 },
    ];
    const m = moyennerPoints(lectures, 5);
    expect(m.est).toBeCloseTo(100.01, 9);
    expect(m.nord).toBeCloseTo(200, 9);
    expect(m.altitude).toBeCloseTo(450.02, 9);
    expect(m.precisionH).toBe(0.012);
    expect(m.precisionV).toBe(0.02);
    expect(m.mesureDuree).toMatchObject({ dureeS: 5, lectures: 2 });
    expect(m.mesureDuree.ecartMaxPlan).toBeCloseTo(0.01, 9);
  });

  it('mini et maxi de chaque coordonnée (fenêtre de résultat)', () => {
    const m = moyennerPoints([{ est: 100, nord: 200, altitude: 450 }, { est: 100.02, nord: 199.99, altitude: 450.04 }], 5);
    expect(m.mesureDuree.limites.est).toEqual({ min: 100, max: 100.02 });
    expect(m.mesureDuree.limites.nord).toEqual({ min: 199.99, max: 200 });
    expect(m.mesureDuree.limites.altitude).toEqual({ min: 450, max: 450.04 });
  });

  it('une lecture sans altitude : altitude null (jamais inventée)', () => {
    expect(moyennerPoints([{ est: 1, nord: 1, altitude: 10 }, { est: 1, nord: 1, altitude: null }], 5).altitude).toBeNull();
  });

  it('durées proposées : 5, 15 et 30 secondes', () => {
    expect(DUREES_MESURE).toEqual([5, 15, 30]);
  });
});

describe('mesure dans le temps', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('une lecture au départ puis une par seconde : 6 lectures pour 5 s, décompte 5 → 0', () => {
    let n = 0;
    const tics = [];
    let fin = null;
    demarrerMesure({ dureeS: 5, prendre: () => ({ ok: true, point: { est: n++, nord: 0, altitude: 1 } }), quandTic: (r) => tics.push(r), quandFin: (r) => { fin = r; } });
    vi.advanceTimersByTime(5000);
    expect(tics).toEqual([5, 4, 3, 2, 1, 0]);
    expect(fin.ok).toBe(true);
    expect(fin.point.mesureDuree.lectures).toBe(6);
    expect(fin.point.est).toBeCloseTo(2.5, 9);
  });

  it('RTK perdu en cours de mesure : refus complet, plus aucune lecture', () => {
    let n = 0;
    let fin = null;
    demarrerMesure({ dureeS: 15, prendre: () => (++n === 4 ? { ok: false, raison: 'RTK fixe perdu' } : { ok: true, point: { est: 0, nord: 0, altitude: 1 } }), quandFin: (r) => { fin = r; } });
    vi.advanceTimersByTime(20000);
    expect(fin).toEqual({ ok: false, raison: 'RTK fixe perdu' });
    expect(n).toBe(4);
  });

  it('refus dès la première lecture : fin tout de suite', () => {
    let fin = null;
    demarrerMesure({ dureeS: 5, prendre: () => ({ ok: false, raison: 'pas de position' }), quandFin: (r) => { fin = r; } });
    expect(fin).toEqual({ ok: false, raison: 'pas de position' });
  });

  it('annuler arrête tout, sans point', () => {
    let fin = null;
    const mesure = demarrerMesure({ dureeS: 30, prendre: () => ({ ok: true, point: { est: 0, nord: 0, altitude: 1 } }), quandFin: (r) => { fin = r; } });
    vi.advanceTimersByTime(3000);
    mesure.annuler();
    vi.advanceTimersByTime(40000);
    expect(fin).toEqual({ ok: false, annule: true });
  });
});
