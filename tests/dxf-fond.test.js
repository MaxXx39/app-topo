// Tests de la lecture d'un DXF comme fond de plan (exemple : plan de terrassement 20261019_Ter_100A.dxf).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { prefixeCommun } from '../src/import/ecran.js';
import { lireFondDXF, emprise, pointsArc, decoderTexteDXF } from '../src/fond/dxf-fond.js';

const texte = decoderTexteDXF(readFileSync(new URL('../exemples/20261019_Ter_100A.dxf', import.meta.url)));
const fond = lireFondDXF(texte);
const parCalque = (calque) => fond.traits.filter((t) => t.calque === calque);

describe('lireFondDXF - plan de terrassement', () => {
  it('lit les lignes, polylignes, cercles et textes, sans erreur', () => {
    expect(fond.erreurs).toEqual([]);
    // 600 LINE + 140 LWPOLYLINE + 13 CIRCLE
    expect(fond.traits).toHaveLength(600 + 140 + 13);
    expect(fond.textes.length).toBeGreaterThan(100);
  });

  it('garde les calques du dessin, dont les hauts de talus (57 polylignes)', () => {
    expect(fond.calques).toContain('DWG_1989-100 - RS_TALUS-HAUT');
    expect(parCalque('DWG_1989-100 - RS_TALUS-HAUT')).toHaveLength(57);
  });

  it('lit les coordonnées X = Est, Y = Nord (MN95)', () => {
    const zone = emprise(fond);
    expect(zone.estMin).toBeGreaterThan(2512350);
    expect(zone.estMax).toBeLessThan(2512420);
    expect(zone.nordMin).toBeGreaterThan(1145700);
    expect(zone.nordMax).toBeLessThan(1145760);
    expect(fond.avertissements).toEqual([]);
  });

  it('garde les accents (fichier en Windows-1252)', () => {
    expect(fond.textes.some((t) => t.texte === 'Béton')).toBe(true);
  });

  it('lit les textes de niveau avec leur position', () => {
    const niveau = fond.textes.find((t) => t.texte === '472.10');
    expect(niveau.est).toBeCloseTo(2512395.838, 3);
    expect(niveau.nord).toBeCloseTo(1145724.972, 3);
  });
});

describe('lireFondDXF - petits cas', () => {
  const dxf = (...entites) => ['0', 'SECTION', '2', 'ENTITIES', ...entites.flat(), '0', 'ENDSEC', '0', 'EOF'].join('\n');

  it('polyligne fermée et bloc non lu', () => {
    const lu = lireFondDXF(
      dxf(['0', 'LWPOLYLINE', '8', 'Murs', '70', '1', '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '5'], ['0', 'INSERT', '8', 'Arbres']),
    );
    expect(lu.traits[0]).toEqual({ calque: 'Murs', ferme: true, points: [{ est: 0, nord: 0 }, { est: 10, nord: 0 }, { est: 10, nord: 5 }] });
    expect(lu.avertissements[0]).toContain('bloc (INSERT)');
  });

  it('refuse un DXF binaire et signale un fichier vide', () => {
    expect(lireFondDXF('AutoCAD Binary DXF\r\n').erreurs[0]).toContain('binaire');
    expect(lireFondDXF(dxf()).erreurs[0]).toContain('aucune ligne');
  });
});

describe('pointsArc', () => {
  it('quart de cercle de rayon 2 autour de (0, 0) : de (2, 0) à (0, 2)', () => {
    const points = pointsArc({ est: 0, nord: 0 }, 2, 0, 90);
    expect(points[0].est).toBeCloseTo(2, 9);
    expect(points.at(-1).est).toBeCloseTo(0, 9);
    expect(points.at(-1).nord).toBeCloseTo(2, 9);
  });
});

describe('prefixeCommun (noms courts des calques)', () => {
  it('retire le début commun, coupé après un séparateur', () => {
    expect(prefixeCommun(['DWG_1989-100 - RS_TALUS-HAUT', 'DWG_1989-100 - RS_AXES', 'DWG_1989-100 - 0'])).toBe('DWG_1989-100 - ');
    expect(prefixeCommun(['RS_AXES', 'RS_ARBRES'])).toBe('RS_');
    expect(prefixeCommun(['Murs', 'Talus'])).toBe('');
    expect(prefixeCommun(['Seul'])).toBe('');
  });
});
