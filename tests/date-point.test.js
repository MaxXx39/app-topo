import { describe, it, expect } from 'vitest';
import { dateDuPoint, jourDuPoint, trierParDate, dateHeureDuPoint } from '../src/topo/date-point.js';

const gnss = (nom, iso) => ({ nom, gnss: { prisLe: iso } });

describe('date d\'un point', () => {
  it('GNSS, annotation, ou rien', () => {
    expect(dateDuPoint(gnss('a', '2026-11-10T10:00:00.000Z'))).toBe('2026-11-10T10:00:00.000Z');
    expect(dateDuPoint({ annotation: { le: '2026-11-09T08:00:00.000Z' } })).toBe('2026-11-09T08:00:00.000Z');
    expect(dateDuPoint({ nom: 'x' })).toBeNull();
    expect(jourDuPoint({ nom: 'x' })).toBeNull();
    expect(dateHeureDuPoint({ nom: 'x' })).toBe('—');
  });
  it('jour local au format du champ date', () => {
    expect(jourDuPoint(gnss('a', new Date(2026, 10, 10, 12, 0).toISOString()))).toBe('2026-11-10');
  });
});

describe('tri par date', () => {
  const pts = [{ nom: 'sans1' }, gnss('b', '2026-11-02T10:00:00Z'), gnss('a', '2026-11-01T10:00:00Z'), { nom: 'sans2' }, gnss('c', '2026-11-03T10:00:00Z')];
  it('récent d\'abord, sans date à la fin', () => {
    expect(trierParDate(pts, 'recent').map((p) => p.nom)).toEqual(['c', 'b', 'a', 'sans1', 'sans2']);
  });
  it('ancien d\'abord, sans date à la fin', () => {
    expect(trierParDate(pts, 'ancien').map((p) => p.nom)).toEqual(['a', 'b', 'c', 'sans1', 'sans2']);
  });
  it('sans tri : ordre de la liste', () => {
    expect(trierParDate(pts, 'liste').map((p) => p.nom)).toEqual(['sans1', 'b', 'a', 'sans2', 'c']);
  });
});
