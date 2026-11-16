import { describe, it, expect } from 'vitest';
import { estDansZoneGeVd, avertissementHorsZone } from '../src/topo/zone-ge-vd.js';
import { lirePoints } from '../src/topo/import-points.js';

describe('zone Genève–Vaud', () => {
  it('reconnaît un point de Gland et refuse un point en MN03', () => {
    expect(estDansZoneGeVd({ est: 2_508_000, nord: 1_141_000 })).toBe(true);
    expect(estDansZoneGeVd({ est: 508_000, nord: 141_000 })).toBe(false);
  });
  it('avertit seulement s\'il y a des points hors zone', () => {
    expect(avertissementHorsZone([{ nom: 'a', est: 2_508_000, nord: 1_141_000 }])).toBe('');
    expect(avertissementHorsZone([{ nom: 'b', est: 508_000, nord: 141_000 }])).toContain('1 point(s) hors');
  });
});

describe('point sans altitude', () => {
  it('est accepté avec 0.000 et signalé', () => {
    const r = lirePoints('p1;2508000;1141000;\np2;2508001;1141001;400.5');
    expect(r.erreurs).toEqual([]);
    expect(r.points[0]).toMatchObject({ nom: 'p1', altitude: 0, sansAltitude: true });
    expect(r.points[1].altitude).toBe(400.5);
    expect(r.avertissements.join(' ')).toContain('sans altitude');
  });
});
