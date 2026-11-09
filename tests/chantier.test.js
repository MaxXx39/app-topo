// Tests du Levé chantier (formules reprises du Recollement, validées le 30.10.2026).
import { describe, it, expect } from 'vitest';
import {
  LIBELLES_CHANTIER_DEPART, lireAttributsChantier, altitudesDuPoint, cadreDeTroisCoins, texteDuPoint, calqueChantier,
} from '../src/topo/chantier.js';

const lib = (a) => LIBELLES_CHANTIER_DEPART.find((l) => l.abreviation === a);

describe('lireAttributsChantier', () => {
  it('refuse sans nature', () => {
    expect(lireAttributsChantier(lib('T'), { mode: 'fe' }).erreur).toMatch(/nature/);
  });
  it('tuyau levé sur le dessus : le Ø est obligatoire', () => {
    expect(lireAttributsChantier(lib('T'), { nature: 'EU', mode: 'dessus' }).erreur).toMatch(/Ø/);
    expect(lireAttributsChantier(lib('T'), { nature: 'EU', mode: 'dessus', diametre: '300' }).attributs.diametre).toBe(300);
  });
  it('tuyau au fil d\'eau : Ø facultatif', () => {
    const r = lireAttributsChantier(lib('T'), { nature: 'EU', mode: 'fe' });
    expect(r.attributs).toEqual({ libelle: 'T', nature: 'EU', mode: 'fe' });
  });
  it('chambre : Ø du tuyau facultatif, profondeur lue avec la virgule, forme gardée', () => {
    const r = lireAttributsChantier(lib('CH'), { nature: 'EU', mode: 'tampon', profondeur: '2,4', forme: 'rect' });
    expect(r.attributs).toMatchObject({ profondeur: 2.4, forme: 'rect', mode: 'tampon' });
    expect(r.attributs.diametre).toBeUndefined();
  });
  it('refuse un nombre mal tapé', () => {
    expect(lireAttributsChantier(lib('CH'), { nature: 'EU', diametre: 'abc' }).erreur).toMatch(/Ø/);
    expect(lireAttributsChantier(lib('CH'), { nature: 'EU', mode: 'tampon', profondeur: '-1' }).erreur).toMatch(/profondeur/);
  });
  it('un mode inconnu revient au premier mode du libellé', () => {
    expect(lireAttributsChantier(lib('T'), { nature: 'EU', mode: 'tampon', diametre: 300 }).attributs.mode).toBe('dessus');
  });
  it('bordure sans mode', () => {
    expect(lireAttributsChantier(lib('BD'), { nature: 'Haute' }).attributs.mode).toBeUndefined();
  });
});

describe('altitudesDuPoint', () => {
  it('dessus : fil d\'eau = dessus − Ø extérieur', () => {
    const a = altitudesDuPoint(450.5, { mode: 'dessus', diametre: 315 });
    expect(a.altitude).toBeCloseTo(450.185, 9);
    expect(a.altitudeLevee).toBe(450.5);
    expect(a.filEau).toBeCloseTo(450.185, 9);
  });
  it('tampon + profondeur : radier gardé', () => {
    const a = altitudesDuPoint(433.1, { mode: 'tampon', profondeur: 2.4 });
    expect(a.radier).toBeCloseTo(430.7, 9);
    expect(a.altitude).toBeCloseTo(430.7, 9);
  });
  it('tampon sans profondeur : altitude levée', () => {
    expect(altitudesDuPoint(433.1, { mode: 'tampon' }).altitude).toBe(433.1);
  });
  it('fil d\'eau levé : c\'est l\'altitude', () => {
    expect(altitudesDuPoint(432.15, { mode: 'fe' }).filEau).toBe(432.15);
  });
  it('sans altitude : rien inventé', () => {
    expect(altitudesDuPoint(null, { mode: 'dessus', diametre: 300 }).altitude).toBeNull();
  });
});

describe('cadreDeTroisCoins', () => {
  it('rectangle 1.2 × 0.8 tourné de 30°', () => {
    const a = (deg) => (deg * Math.PI) / 180;
    const o = { est: 100, nord: 200, altitude: 433 };
    const u = { est: Math.sin(a(30)) * 1.2, nord: Math.cos(a(30)) * 1.2 };
    const v = { est: Math.cos(a(30)) * 0.8, nord: -Math.sin(a(30)) * 0.8 };
    const pts = [{ ...o, est: o.est + u.est, nord: o.nord + u.nord }, o, { ...o, est: o.est + v.est, nord: o.nord + v.nord }];
    const c = cadreDeTroisCoins(pts);
    expect(c.longueur).toBeCloseTo(1.2, 6);
    expect(c.largeur).toBeCloseTo(0.8, 6);
    expect(c.direction).toBeCloseTo(30, 4);
    expect(c.ecartAngleDroit).toBeLessThan(1e-6);
    expect(c.tampon).toBeCloseTo(433, 9);
  });
  it('refuse deux coins au même endroit', () => {
    const p = { est: 1, nord: 1, altitude: 1 };
    expect(() => cadreDeTroisCoins([p, p, { est: 2, nord: 1, altitude: 1 }])).toThrow();
  });
});

describe('textes et calques', () => {
  it('texte du point', () => {
    expect(texteDuPoint({ diametre: 300 }, { filEau: 432.15 })).toBe('Ø300 · FE 432.150');
    expect(texteDuPoint({ profondeur: 2.4 }, { radier: 429.8 })).toBe('Prof. 2.40 · Radier 429.800');
  });
  it('calque DXF', () => {
    expect(calqueChantier('Cap de vanne', 'Éclairage')).toBe('CHANT_CAP_DE_VANNE_ECLAIRAGE');
    expect(calqueChantier('Tuyau', 'EU')).toBe('CHANT_TUYAU_EU');
  });
});

import { csvPoints, avecChantier } from '../src/export/points.js';
import { genererDxf } from '../src/export/dxf.js';
import { pdfPoints } from '../src/export/pdf-points.js';

describe('export du Levé chantier', () => {
  const points = [
    { nom: 'L-T-1-1', est: 100, nord: 200, altitude: 432.15, chantier: { libelle: 'T', nature: 'EU', mode: 'dessus', diametre: 300, altitudeLevee: 432.45, filEau: 432.15, materiau: 'PVC' } },
    { nom: 'L-T-1-2', est: 105, nord: 201, altitude: 432.1, chantier: { libelle: 'T', nature: 'EU', mode: 'dessus', diametre: 300, altitudeLevee: 432.4, filEau: 432.1, materiau: 'PVC' } },
    { nom: 'P-CH-1', est: 110, nord: 202, altitude: 430.7, chantier: { libelle: 'CH', nature: 'EU', mode: 'tampon', forme: 'ronde', profondeur: 2.4, altitudeLevee: 433.1, radier: 430.7 } },
  ];
  it('CSV : colonnes d\'attributs seulement s\'il y a des points chantier', () => {
    expect(avecChantier(points)).toBe(true);
    const lignes = csvPoints(points).trim().split('\r\n');
    expect(lignes[0]).toContain('Fil d\'eau (m);Radier (m)');
    expect(lignes[1]).toContain(';T;EU;;300;;432.450;432.150;;;PVC;;');
    expect(csvPoints([{ nom: 'P-1', est: 1, nord: 2, altitude: 3 }])).not.toContain('Libellé');
  });
  it('DXF : calque par libellé et nature, texte et ligne', () => {
    const dxf = genererDxf({ points, chantier: { lignes: [{ noms: ['L-T-1-1', 'L-T-1-2'], fermee: false, libelle: 'T', nature: 'EU' }], cadres: [] } });
    expect(dxf).toContain('CHANT_TUYAU_EU');
    expect(dxf).toContain('CHANT_TUYAU_EU_TXT');
    expect(dxf).toContain('Ø300 · FE 432.150');
    expect(dxf).toContain('CHANT_CHAMBRE_EU_TXT');
    expect(dxf).toContain('Prof. 2.40 · Radier 430.700');
  });
  it('PDF : se fabrique avec les colonnes chantier', () => {
    const blob = pdfPoints({ titre: 'LV-Chant 1', points });
    expect(blob.size).toBeGreaterThan(1000);
  });
});

import { couleurDeNature, LIBELLES_CHANTIER_DEPART as DEPART } from '../src/topo/chantier.js';

describe('forme du libellé, couleur de la nature', () => {
  it('couleur de départ, personnalisée ou grise', () => {
    expect(couleurDeNature('EU')).toBe('#dc2626');
    expect(couleurDeNature('EU', { EU: '#112233' })).toBe('#112233');
    expect(couleurDeNature('Inconnue')).toBe('#6b7280');
  });
  it('chaque libellé de départ a une forme et un nom court', () => {
    expect(DEPART.map((l) => l.court)).toEqual(['Chamb.', 'Gril.', 'Tuyau', 'Cap de v.', 'Born.', 'Cabl.', 'Four.', 'Bord.']);
    expect(new Set(DEPART.map((l) => l.forme)).size).toBe(DEPART.length);
  });
});

import { DIAMETRES_LISTE, GAINES_LISTE } from '../src/topo/chantier.js';

describe('gaines, nombre et listes de diamètres', () => {
  it('listes demandées le 09.11', () => {
    expect(DIAMETRES_LISTE).toEqual([80, 100, 125, 160, 200, 250, 315, 400, 500, 600, 800, 1000]);
    expect(GAINES_LISTE).toEqual([[80, 92], [100, 112], [120, 132], [148, 163], [195, 214]]);
  });
  it('fourreau levé sur le dessus : gaine obligatoire, Ø extérieur = fil d\'eau', () => {
    const fo = LIBELLES_CHANTIER_DEPART.find((l) => l.abreviation === 'FO');
    expect(lireAttributsChantier(fo, { nature: 'Elec', mode: 'dessus' }).erreur).toMatch(/gaine/);
    const r = lireAttributsChantier(fo, { nature: 'Elec', mode: 'dessus', gaine: '100/112', nombre: '3' });
    expect(r.attributs).toMatchObject({ diametre: 112, diametreInterieur: 100, nombre: 3 });
    expect(altitudesDuPoint(432.5, r.attributs).filEau).toBeCloseTo(432.388, 9);
  });
  it('câble : gaine et nombre facultatifs, texte « Ø112 ×3 »', () => {
    const cb = LIBELLES_CHANTIER_DEPART.find((l) => l.abreviation === 'CB');
    const r = lireAttributsChantier(cb, { nature: 'Swisscom', gaine: '120/132', nombre: 2 });
    expect(texteDuPoint(r.attributs, {})).toBe('Ø132 ×2');
    expect(lireAttributsChantier(cb, { nature: 'Swisscom' }).attributs.diametre).toBeUndefined();
  });
});
