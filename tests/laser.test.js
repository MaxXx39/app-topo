import { describe, it, expect } from 'vitest';
import {
  normaliser360, ecartAngle, azimut, moyenneAngles, statistiquesEcarts, erreurLaterale,
  origineLaser, composantesLaser, pointParCap, intersectionCercles, pointParDeuxStations, ecartsPoints,
} from '../src/topo/laser.js';

const S = { est: 2500000, nord: 1118000, altitude: 400 };
const proche = (a, b, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('angles', () => {
  it('ramène entre 0 et 360 et donne le plus court écart', () => {
    expect(normaliser360(-10)).toBe(350);
    expect(normaliser360(720)).toBe(0);
    expect(ecartAngle(1, 359)).toBe(2);
    expect(ecartAngle(359, 1)).toBe(-2);
  });
  it('azimut : Nord 0, Est 90, Sud 180, Ouest 270', () => {
    expect(azimut(S, { est: S.est, nord: S.nord + 10 })).toBe(0);
    proche(azimut(S, { est: S.est + 10, nord: S.nord }), 90);
    proche(azimut(S, { est: S.est, nord: S.nord - 10 }), 180);
    proche(azimut(S, { est: S.est - 10, nord: S.nord }), 270);
  });
  it('moyenne circulaire : 359 et 1 donnent 0, pas 180', () => {
    const m = moyenneAngles([359, 1]);
    proche(ecartAngle(m.moyenne, 0), 0);
    proche(m.ecartType, Math.SQRT2);
    expect(moyenneAngles([])).toBeNull();
  });
  it('statistiques de l\'essai A (écarts autour de −1°)', () => {
    const s = statistiquesEcarts([-0.8, -1.2, -1.0]);
    proche(s.moyenne, -1, 1e-9);
    proche(s.ecartType, 0.2, 1e-9);
    proche(s.mini, -1.2, 1e-9);
    proche(s.maxi, -0.8, 1e-9);
  });
  it('erreur de côté : 0,17° à 10 m ≈ 3 cm', () => {
    proche(erreurLaterale(10, 0.17), 0.0297, 1e-4);
  });
});

describe('origine du laser', () => {
  it('canne verticale, sans décalage : juste la hauteur', () => {
    const o = origineLaser(S, { hauteur: 1.5 }, 37);
    proche(o.est, S.est); proche(o.nord, S.nord); proche(o.altitude, 401.5);
  });
  it('décalage avant / droite selon la visée vers l\'Est', () => {
    const o = origineLaser(S, { hauteur: 0, avant: 0.1, droite: 0.05 }, 90);
    proche(o.est, S.est + 0.1); proche(o.nord, S.nord - 0.05);
  });
  it('canne penchée de 5° vers le Nord : le haut avance au Nord', () => {
    const o = origineLaser(S, { hauteur: 2 }, 0, { angle: 5, direction: 0 });
    proche(o.nord - S.nord, 2 * Math.sin(5 * Math.PI / 180));
    proche(o.altitude - S.altitude, 2 * Math.cos(5 * Math.PI / 180));
  });
});

describe('point par le cap', () => {
  it('10 m à l\'horizontale vers l\'Est, laser à 1.5 m', () => {
    const p = pointParCap({ station: S, distance: 10, angleVertical: 0, cap: 90 }, { hauteur: 1.5 });
    proche(p.est, S.est + 10); proche(p.nord, S.nord); proche(p.altitude, 401.5);
  });
  it('angle de 30° : horizontale = d cos, dénivelée = d sin', () => {
    const k = composantesLaser(10, 30);
    proche(k.horizontale, 8.660254); proche(k.denivelee, 5);
    const p = pointParCap({ station: S, distance: 10, angleVertical: 30, cap: 0 }, { hauteur: 1 });
    proche(p.nord, S.nord + 8.660254); proche(p.altitude, 406);
  });
  it('correction de l\'essai A : cap lu 92°, correction +2° → visée à 90°', () => {
    const p = pointParCap({ station: S, distance: 10, angleVertical: 0, cap: 92 }, { hauteur: 0 }, 2);
    proche(p.azimut, 90); proche(p.est, S.est + 10);
  });
  it('dit ce qui manque', () => {
    expect(pointParCap({ station: S, distance: 10, cap: null }, {}).erreur).toMatch(/cap/);
    expect(pointParCap({ station: S, distance: 0, cap: 10 }, {}).erreur).toMatch(/distance/);
  });
});

describe('intersection de deux cercles', () => {
  it('triangle 3-4-5 : les deux solutions', () => {
    const c1 = { est: 0, nord: 0 };
    const c2 = { est: 5, nord: 0 };
    const r = intersectionCercles(c1, 3, c2, 4);
    // En allant vers l'Est, la gauche est au Nord.
    proche(r.gauche.est, 1.8); proche(r.gauche.nord, 2.4);
    proche(r.droite.est, 1.8); proche(r.droite.nord, -2.4);
    proche(r.angle, 90);
  });
  it('distances trop courtes : message, sauf à 2 cm près (un seul point)', () => {
    expect(intersectionCercles({ est: 0, nord: 0 }, 2, { est: 5, nord: 0 }, 2).erreur).toMatch(/il manque 1.000 m/);
    const r = intersectionCercles({ est: 0, nord: 0 }, 2.49, { est: 5, nord: 0 }, 2.5);
    proche(r.gauche.nord, 0); proche(r.gauche.est, 2.49, 0.01);
  });
});

describe('point par deux stations (essai B)', () => {
  // Point P connu, deux stations ; on fabrique les mesures exactes puis on retrouve P.
  const P = { est: S.est + 8, nord: S.nord + 6, altitude: 403 };
  const S1 = S;
  const S2 = { est: S.est + 12, nord: S.nord - 2, altitude: 400.5 };
  const montage = { hauteur: 1.6, droite: 0.05, avant: 0.08 };
  const mesureVers = (station) => {
    // Visée : direction depuis l'origine (qui dépend elle-même de la visée) : on la trouve par tours.
    let az = azimut(station, P);
    let o = null;
    for (let i = 0; i < 20; i += 1) { o = origineLaser(station, montage, az); az = azimut(o, P); }
    const h = Math.hypot(P.est - o.est, P.nord - o.nord);
    const dz = P.altitude - o.altitude;
    return { station, distance: Math.hypot(h, dz), angleVertical: Math.atan2(dz, h) * 180 / Math.PI };
  };
  it('retrouve P au mm avec les décalages du montage', () => {
    const m1 = mesureVers(S1);
    const m2 = mesureVers(S2);
    // P est à gauche en allant de S1 vers S2.
    const r = pointParDeuxStations([m1, m2], montage, 'gauche');
    proche(r.est, P.est, 1e-4); proche(r.nord, P.nord, 1e-4); proche(r.altitude, P.altitude, 1e-4);
    proche(r.ecartAltitude, 0, 1e-4);
    expect(r.angle).toBeGreaterThan(30);
    const autre = pointParDeuxStations([m1, m2], montage, 'droite');
    expect(ecartsPoints(P, autre).d2d).toBeGreaterThan(1);
  });
  it('il faut les deux stations', () => {
    expect(pointParDeuxStations([{ station: S, distance: 5 }, null], {}).erreur).toMatch(/deux stations/);
  });
});

import { rangerPointLaser, csvTestLaser, NOM_LEVE_TEST_LASER } from '../src/topo/laser-levee.js';
import { moyenneLectures, lireNombre, azimutVraiVers } from '../src/laser/appli.js';

describe('enregistrement et CSV', () => {
  it('range TL-1 puis TL-2 dans « LV-Test laser »', () => {
    const projet = { leves: [], autres: [], surfaces: [] };
    const r1 = rangerPointLaser(projet, { est: 2500000.12345, nord: 1118000, altitude: 401, methode: 'cap' });
    const r2 = rangerPointLaser(projet, { est: 2500001, nord: 1118001, altitude: null });
    expect(r1.levee.nom).toBe(NOM_LEVE_TEST_LASER);
    expect(r1.point.nom).toBe('TL-1');
    expect(r1.point.est).toBe(2500000.123);
    expect(r2.point.nom).toBe('TL-2');
    expect(r2.point.altitude).toBeNull();
    expect(rangerPointLaser(projet, null).erreur).toBeTruthy();
  });
  it('CSV : « ; », point décimal, angles à 3 décimales, vide sans valeur', () => {
    const csv = csvTestLaser([{ essai: 'Cap', nom: 'TL-1', est: 2500000.1, cap: 92.5, remarque: 'a;b' }]);
    const [tete, ligne] = csv.trim().split('\r\n');
    expect(tete.split(';')[0]).toBe('Heure');
    expect(ligne).toContain('2500000.100');
    expect(ligne).toContain('92.500');
    expect(ligne).toContain('"a;b"');
  });
});

describe('lectures de 5 s', () => {
  it('moyenne des positions, cap circulaire, inclinaison', () => {
    const lectures = Array.from({ length: 12 }, (_, i) => ({
      position: { est: 100 + (i % 2) * 0.002, nord: 200, altitude: 400 }, cap: i % 2 ? 359 : 1, inclinaison: 2, directionInclinaison: 90,
    }));
    const r = moyenneLectures(lectures);
    proche(r.station.est, 100.001); proche(ecartAngle(r.cap, 0), 0);
    proche(r.inclinaison.angle, 2); proche(r.inclinaison.direction, 90);
  });
  it('refuse avec moins de 10 positions', () => {
    expect(moyenneLectures([{ position: { est: 1, nord: 1 } }]).erreur).toMatch(/trop peu/);
  });
  it('lit les nombres tapés (virgule acceptée)', () => {
    expect(lireNombre('12,5')).toBe(12.5);
    expect(lireNombre('-3.2')).toBe(-3.2);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
  });
  it('essai A : azimut depuis le laser décalé de 10 cm à droite, cible à 20 m au Nord', () => {
    const az = azimutVraiVers({ est: 0, nord: 0 }, { est: 0, nord: 20 }, { droite: 0.1 }, null);
    // Le laser est à droite (Est) : il doit viser un peu à gauche (vers l'Ouest) : ≈ −0,29°.
    proche(ecartAngle(az, 0), -Math.atan2(0.1, 20) * 180 / Math.PI, 1e-3);
  });
});
