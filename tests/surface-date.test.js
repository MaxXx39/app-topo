import { describe, it, expect } from 'vitest';
import { dateDuJourCollee } from '../src/topo/surface.js';

describe('dateDuJourCollee', () => {
  it('écrit année, mois, jour collés', () => {
    expect(dateDuJourCollee(new Date(2026, 10, 9))).toBe('20261109');
    expect(dateDuJourCollee(new Date(2026, 0, 5))).toBe('20260105');
  });
});
