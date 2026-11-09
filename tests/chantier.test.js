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
