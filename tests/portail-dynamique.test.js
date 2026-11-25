import { describe, it, expect } from 'vitest';
import { portailDynamique, reglagesPortail, PASSAGE_PORTAIL } from '../src/topo/portail-dynamique.js';
import { pointsDePrise } from '../src/topo/prise-bloc.js';
import { symboleDeLObjetPose } from '../src/topo/grue-mobile.js';

describe('portail réglable (0.320.2)', () => {
  it('passage limité aux valeurs permises, départ selon le genre', () => {
    expect(reglagesPortail({}).passage).toBe(PASSAGE_PORTAIL.portail.depart);
    expect(reglagesPortail({ genre: 'portillon' }).passage).toBe(1);
    expect(reglagesPortail({ genre: 'portillon', passage: 9 }).passage).toBe(PASSAGE_PORTAIL.portillon.max);
  });
  it('les 3 genres se dessinent, avec les poteaux à passage / 2 + 0,15 de l\'axe', () => {
    for (const genre of ['portail', 'portillon', 'coulissant']) {
      const s = portailDynamique({ genre, passage: 2 });
      expect(s.primitives.length).toBeGreaterThan(5);
      expect(s.prises).toEqual([[-1.15, 0], [1.15, 0], [0, 0]]);
      expect(s.cle).toBe('dyn:portail');
    }
  });
  it('deux largeurs = deux noms de bloc différents (DXF)', () => {
    expect(portailDynamique({ passage: 4 }).nom).not.toBe(portailDynamique({ passage: 5 }).nom);
  });
  it('les points de prise suivent la position et la rotation du bloc', () => {
    const o = { type: 'symbole', cle: 'dyn:portail', point: [100, 200], rotation: 90, genre: 'portail', passage: 4 };
    const pts = pointsDePrise(o, symboleDeLObjetPose([], o));
    expect(pts).toHaveLength(3);
    expect(pts[0][0]).toBeCloseTo(100, 6); // tourné de 90° : les poteaux sont alignés sur le nord
    expect(pts[0][1]).toBeCloseTo(200 - 2.15, 6);
  });
});
