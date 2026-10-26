// Tests de l'implantation d'un talus : pente, entrée en terre (sol plat ou surface), guidage, zone.
import { describe, it, expect } from 'vitest';
import {
  talusComplet,
  penteSignee,
  altitudeTalus,
  entreeEnTerreSolPlat,
  entreeEnTerreSurface,
  guidageTalus,
  zoneTalus,
  sourceAltitudeLigne,
  textePente,
} from '../src/topo/talus.js';

// Ligne droite d'ouest en est, à l'altitude 100 m : sa droite (en regardant vers la fin) est le sud.
const E0 = 2500000;
const N0 = 1120000;
const ligne = [
  { est: E0, nord: N0, altitude: 100 },
  { est: E0 + 10, nord: N0, altitude: 100 },
];
const altitudeLigne = sourceAltitudeLigne(ligne);
const haut32 = { horizontal: 3, vertical: 2, ligneEst: 'haut', cote: 'droite', longueur: null };

describe('pente du talus', () => {
  it('talus complet seulement avec H et V positifs', () => {
    expect(talusComplet(haut32)).toBe(true);
    expect(talusComplet({ ...haut32, vertical: 0 })).toBe(false);
    expect(talusComplet({ ...haut32, horizontal: null })).toBe(false);
  });

  it('descend depuis le haut, monte depuis le bas', () => {
    expect(penteSignee(haut32)).toBeCloseTo(-2 / 3, 9);
    expect(penteSignee({ ...haut32, ligneEst: 'bas' })).toBeCloseTo(2 / 3, 9);
    expect(altitudeTalus(100, 3, haut32)).toBeCloseTo(98, 9);
    expect(altitudeTalus(100, 3, { ...haut32, ligneEst: 'bas' })).toBeCloseTo(102, 9);
  });

  it('écrit la pente H/V', () => {
    expect(textePente(haut32)).toBe('3/2');
    expect(textePente({ horizontal: 1.5, vertical: 1 })).toBe('1.5/1');
    expect(textePente({ horizontal: null, vertical: 1 })).toBe('—');
  });
});

describe('entrée en terre', () => {
  it('sol plat : |altitude ligne − sol| × H ÷ V, du bon côté seulement', () => {
    expect(entreeEnTerreSolPlat(100, 97, haut32)).toBeCloseTo(4.5, 9);
    expect(entreeEnTerreSolPlat(100, 102, { ...haut32, ligneEst: 'bas' })).toBeCloseTo(3, 9);
    // Talus qui descend, sol plus haut que la ligne : jamais de rencontre.
    expect(entreeEnTerreSolPlat(100, 101, haut32)).toBeNull();
  });

  it('sur une surface en pente : au millimètre', () => {
    // Terrain qui descend de 0.2 m par m en s'éloignant vers le sud, à 98 m sous la ligne.
    const terrain = (est, nord) => 98 + 0.2 * (nord - N0);
    const d = entreeEnTerreSurface({ est: E0 + 5, nord: N0 }, { est: 0, nord: -1 }, 100, haut32, terrain);
    // 100 − 2/3 d = 98 − 0.2 d  →  d = 2 / (2/3 − 0.2) = 4.2857 m
    expect(d).toBeCloseTo(2 / (2 / 3 - 0.2), 3);
  });

  it('sur une surface : rien si le talus ne la rencontre pas', () => {
    const terrain = () => 120;
    expect(entreeEnTerreSurface({ est: E0, nord: N0 }, { est: 0, nord: -1 }, 100, haut32, terrain, 50)).toBeNull();
    expect(entreeEnTerreSurface({ est: E0, nord: N0 }, { est: 0, nord: -1 }, 100, haut32, () => null, 50)).toBeNull();
  });
});

describe('guidage du talus', () => {
  it('sol plat : il faut s\'éloigner de la ligne, monter / descendre par rapport au talus', () => {
    const g = guidageTalus({ est: E0 + 5, nord: N0 - 2, altitude: 97 }, ligne, haut32, { altitudeLigne });
    expect(g.message).toBeNull();
    expect(g.solPlat).toBe(true);
    expect(g.distance).toBeCloseTo(2, 9);
    expect(g.distanceVoulue).toBeCloseTo(4.5, 9);
    expect(g.ecartDistance).toBeCloseTo(-2.5, 9); // < 0 : s'éloigner
    expect(g.altitudeTalusCanne).toBeCloseTo(100 - 4 / 3, 9);
    expect(g.cible.est).toBeCloseTo(E0 + 5, 9);
    expect(g.cible.nord).toBeCloseTo(N0 - 4.5, 9);
    expect(g.cible.altitude).toBeCloseTo(97, 9);
    expect(g.auBord).toBe(false);
  });

  it('talus à gauche depuis le bas : canne déjà à l\'entrée en terre', () => {
    const reglages = { ...haut32, ligneEst: 'bas', cote: 'gauche' };
    const g = guidageTalus({ est: E0 + 5, nord: N0 + 3, altitude: 102 }, ligne, reglages, { altitudeLigne });
    expect(g.distance).toBeCloseTo(3, 9);
    expect(g.ecartDistance).toBeCloseTo(0, 9);
    expect(g.cible.nord).toBeCloseTo(N0 + 3, 9);
  });

  it('canne de l\'autre côté de la ligne : distance négative, pas d\'altitude du talus', () => {
    const g = guidageTalus({ est: E0 + 5, nord: N0 + 1, altitude: 97 }, ligne, haut32, { altitudeLigne });
    expect(g.distance).toBeCloseTo(-1, 9);
    expect(g.altitudeTalusCanne).toBeNull();
    expect(g.ecartDistance).toBeCloseTo(-5.5, 9);
  });

  it('longueur donnée et terrain plus loin : on vise le bord, avec la hauteur qui manque', () => {
    const g = guidageTalus({ est: E0 + 5, nord: N0 - 2, altitude: 97 }, ligne, { ...haut32, longueur: 3 }, { altitudeLigne });
    expect(g.auBord).toBe(true);
    expect(g.distanceVoulue).toBe(3);
    expect(g.manque).toBeCloseTo(1, 9); // bord du talus à 98 m, sol à 97 m
    expect(g.cible.altitude).toBeCloseTo(98, 9);
  });

  it('longueur donnée et terrain plus près : on vise l\'entrée en terre', () => {
    const g = guidageTalus({ est: E0 + 5, nord: N0 - 2, altitude: 97 }, ligne, { ...haut32, longueur: 6 }, { altitudeLigne });
    expect(g.auBord).toBe(false);
    expect(g.distanceVoulue).toBeCloseTo(4.5, 9);
  });

  it('avec une surface de terrain : l\'altitude de la canne ne change pas l\'entrée en terre', () => {
    const terrain = () => 97;
    const a = guidageTalus({ est: E0 + 5, nord: N0 - 2, altitude: 97 }, ligne, haut32, { altitudeLigne, altitudeTerrain: terrain });
    const b = guidageTalus({ est: E0 + 5, nord: N0 - 2, altitude: 99.5 }, ligne, haut32, { altitudeLigne, altitudeTerrain: terrain });
    expect(a.solPlat).toBe(false);
    expect(a.distanceVoulue).toBeCloseTo(4.5, 3);
    expect(b.distanceVoulue).toBeCloseTo(4.5, 3);
  });

  it('messages : pente à régler, terrain du mauvais côté, altitude de la ligne inconnue', () => {
    const position = { est: E0 + 5, nord: N0 - 2, altitude: 101 };
    expect(guidageTalus(position, ligne, { ...haut32, vertical: null }, { altitudeLigne }).message).toMatch(/Pente/);
    expect(guidageTalus(position, ligne, haut32, { altitudeLigne }).message).toMatch(/plus haut/);
    const sansAltitude = ligne.map(({ est, nord }) => ({ est, nord }));
    expect(guidageTalus(position, sansAltitude, haut32, { altitudeLigne: sourceAltitudeLigne(sansAltitude) }).message).toMatch(/Altitude/);
  });

  it('altitude de la ligne : tapée au début et à la fin, ou donnée par une surface', () => {
    const sansAltitude = ligne.map(({ est, nord }) => ({ est, nord }));
    const tapee = sourceAltitudeLigne(sansAltitude, { debut: 100, fin: 101 });
    expect(tapee(5, { est: E0 + 5, nord: N0 })).toBeCloseTo(100.5, 9);
    expect(tapee(20, { est: E0 + 20, nord: N0 })).toBeCloseTo(101, 9); // après la fin : altitude de la fin
    const parSurface = sourceAltitudeLigne(ligne, {}, () => 95);
    expect(parSurface(5, { est: E0 + 5, nord: N0 })).toBe(95);
  });
});

describe('zone du talus (plan)', () => {
  it('bord à l\'entrée en terre tout le long', () => {
    const zone = zoneTalus(ligne, haut32, { altitudeLigne, altitudeTerrain: () => 97 });
    expect(zone.ligne.length).toBe(zone.bord.length);
    expect(zone.ligne.length).toBeGreaterThan(5);
    for (const p of zone.bord) expect(p.nord).toBeCloseTo(N0 - 4.5, 3);
  });

  it('sans surface : le bord à la longueur donnée, sinon rien', () => {
    const zone = zoneTalus(ligne, { ...haut32, longueur: 2 }, { altitudeLigne });
    for (const p of zone.bord) expect(p.nord).toBeCloseTo(N0 - 2, 9);
    expect(zoneTalus(ligne, haut32, { altitudeLigne })).toBeNull();
  });
});
