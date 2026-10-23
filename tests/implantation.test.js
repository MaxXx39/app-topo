// Tests du contrôle sur le terrain : orientation, altitude sur une surface, écart, couleurs, coupes.
import { describe, it, expect } from 'vitest';
import {
  normaliserAzimut,
  azimutEntre,
  directionDeMarche,
  altitudeSurSurface,
  ecartSurface,
  classeEcart,
  extremitesCoupe,
} from '../src/topo/implantation.js';
import { profilSurface } from '../src/topo/coupe.js';
import { pt } from './outils.js';

// Un plan incliné de 10 × 10 m : altitude = 400 + Est local / 10 (pente de 10 % vers l'est).
const A = pt('A', 2600000, 1200000, 400);
const B = pt('B', 2600010, 1200000, 401);
const C = pt('C', 2600010, 1200010, 401);
const D = pt('D', 2600000, 1200010, 400);
const TRIANGLES = [
  [A, B, C],
  [A, C, D],
];

describe('orientation', () => {
  it('compte les azimuts depuis le nord, dans le sens des aiguilles d\'une montre', () => {
    const centre = { est: 0, nord: 0 };
    expect(azimutEntre(centre, { est: 0, nord: 5 })).toBeCloseTo(0);
    expect(azimutEntre(centre, { est: 5, nord: 0 })).toBeCloseTo(90);
    expect(azimutEntre(centre, { est: 0, nord: -5 })).toBeCloseTo(180);
    expect(azimutEntre(centre, { est: -5, nord: 0 })).toBeCloseTo(270);
    expect(normaliserAzimut(-30)).toBe(330);
    expect(normaliserAzimut(370)).toBe(10);
  });

  it('donne la direction de marche, ou rien si l\'on est arrêté', () => {
    const marche = [
      { est: 0, nord: 0, temps: 0 },
      { est: 1, nord: 1, temps: 1000 },
      { est: 2, nord: 2, temps: 2000 },
    ];
    expect(directionDeMarche(marche)).toBeCloseTo(45);
    const arret = [
      { est: 0, nord: 0, temps: 0 },
      { est: 0.2, nord: 0.1, temps: 2000 },
    ];
    expect(directionDeMarche(arret)).toBeNull();
    // Positions trop anciennes : on ne garde que les 5 dernières secondes.
    const vieux = [
      { est: 0, nord: 0, temps: 0 },
      { est: 0.3, nord: 0, temps: 9000 },
      { est: 0.4, nord: 0, temps: 10000 },
    ];
    expect(directionDeMarche(vieux)).toBeNull();
    expect(directionDeMarche([])).toBeNull();
  });
});

describe('altitude sur une surface et écart', () => {
  it('interpole l\'altitude dans le triangle sous le point', () => {
    expect(altitudeSurSurface(TRIANGLES, 2600005, 1200002)).toBeCloseTo(400.5, 6);
    expect(altitudeSurSurface(TRIANGLES, 2600002.5, 1200008)).toBeCloseTo(400.25, 6);
    // Sur un sommet et sur une arête.
    expect(altitudeSurSurface(TRIANGLES, 2600010, 1200010)).toBeCloseTo(401, 6);
    expect(altitudeSurSurface(TRIANGLES, 2600005, 1200005)).toBeCloseTo(400.5, 6);
  });

  it('ne répond rien en dehors de la surface', () => {
    expect(altitudeSurSurface(TRIANGLES, 2600011, 1200005)).toBeNull();
    expect(altitudeSurSurface([], 2600005, 1200005)).toBeNull();
  });

  it('écart positif : il faut monter ; négatif : il faut descendre', () => {
    expect(ecartSurface(400.5, 400.3)).toBeCloseTo(0.2);
    expect(ecartSurface(400.5, 400.62)).toBeCloseTo(-0.12);
  });

  it('colore l\'écart selon les limites de ±2 cm et ±5 cm', () => {
    expect(classeEcart(0)).toBe('vert-clair');
    expect(classeEcart(0.02)).toBe('vert-clair');
    expect(classeEcart(-0.02)).toBe('vert-clair');
    expect(classeEcart(0.021)).toBe('jaune-orange');
    expect(classeEcart(-0.05)).toBe('jaune-orange');
    expect(classeEcart(0.05)).toBe('jaune-orange');
    expect(classeEcart(0.051)).toBe('rouge');
    expect(classeEcart(-0.051)).toBe('bleu');
    expect(classeEcart(1.2)).toBe('rouge');
  });
});

describe('coupes en direct', () => {
  const position = { est: 2600005, nord: 1200005 };

  it('dans l\'axe : de derrière vers devant', () => {
    const { debut, fin } = extremitesCoupe(position, 90, 5, 'axe');
    expect(debut.est).toBeCloseTo(2600000);
    expect(debut.nord).toBeCloseTo(1200005);
    expect(fin.est).toBeCloseTo(2600010);
    expect(fin.nord).toBeCloseTo(1200005);
  });

  it('perpendiculaire : de la gauche vers la droite (en regardant vers le nord : ouest → est)', () => {
    const { debut, fin } = extremitesCoupe(position, 0, 5, 'perpendiculaire');
    expect(debut.est).toBeCloseTo(2600000);
    expect(fin.est).toBeCloseTo(2600010);
    expect(debut.nord).toBeCloseTo(1200005);
    expect(fin.nord).toBeCloseTo(1200005);
  });

  it('le profil de la coupe passe par l\'altitude de la surface sous la position', () => {
    const { debut, fin } = extremitesCoupe(position, 0, 5, 'perpendiculaire');
    const [ligne] = profilSurface(TRIANGLES, debut, fin);
    expect(ligne[0]).toMatchObject({ distance: 0 });
    expect(ligne[0].altitude).toBeCloseTo(400);
    expect(ligne[ligne.length - 1].altitude).toBeCloseTo(401);
    // Au milieu de la coupe (5 m) : la même altitude que sous la position.
    const milieu = ligne.find((p) => Math.abs(p.distance - 5) < 1e-6);
    expect(milieu.altitude).toBeCloseTo(altitudeSurSurface(TRIANGLES, position.est, position.nord), 6);
  });
});

describe('suivi de l\'orientation', () => {
  const etat = (est, nord, cap = null, prete = true) => ({ connecte: true, recu: true, position: { est, nord, altitude: 400 }, inclinaisonPrete: prete, cap });

  it('prend le cap du RX2 quand il existe, sinon la direction de marche', async () => {
    const { creerSuiviOrientation } = await import('../src/leve/orientation.js');
    const suivi = creerSuiviOrientation('rx2');
    expect(suivi.ajouter(etat(0, 0, 120), 0)).toMatchObject({ azimut: 120, source: 'rx2', cap: 120 });
    // Inclinaison pas prête : le cap n'est pas fiable, on marche vers l'est.
    suivi.ajouter(etat(0, 0, null, false), 1000);
    expect(suivi.ajouter(etat(2, 0, 300, false), 2000)).toMatchObject({ source: 'marche', cap: null });
    expect(suivi.ajouter(etat(2, 0, 300, false), 2000).azimut).toBeCloseTo(90);
  });

  it('source « marche » : ignore le cap du RX2, et garde la dernière orientation un moment', async () => {
    const { creerSuiviOrientation } = await import('../src/leve/orientation.js');
    const suivi = creerSuiviOrientation('marche');
    suivi.ajouter(etat(0, 0, 45), 0);
    expect(suivi.ajouter(etat(0, 3, 45), 1000).azimut).toBeCloseTo(0);
    // Arrêt : on garde le nord 10 s, puis plus rien.
    expect(suivi.ajouter(etat(0, 3, 45), 7000).azimut).toBeCloseTo(0);
    expect(suivi.ajouter(etat(0, 3, 45), 20000).azimut).toBeNull();
  });
});

describe('dessin des coupes en direct', () => {
  it('hauteurs à l\'échelle (×1) par défaut, ×2 au choix, avec la couleur de la coupe', async () => {
    const { svgCoupeDirecte } = await import('../src/leve/coupe-directe.js');
    const lignes = [[{ distance: 0, altitude: 400 }, { distance: 4, altitude: 400.5 }]];
    const commun = { lignes, demiLongueur: 2, altitudeCanne: 400.2, classe: 'rouge', titre: 'Perpendiculaire', gauche: 'g', droite: 'd' };
    const x1 = svgCoupeDirecte({ ...commun, sens: 'perpendiculaire' });
    expect(x1).toContain('hauteurs ×1');
    expect(x1).toContain('coupe-perpendiculaire');
    expect(x1).toContain('canne rouge');
    const x2 = svgCoupeDirecte({ ...commun, exageration: 2, sens: 'axe' });
    expect(x2).toContain('hauteurs ×2');
    // Hauteur du dessin : 4 m de long sur 286 unités, soit 71.5 par mètre ; relief 0.7 m (avec les
    // marges) : 50 → minimum 80 en ×1 ; ×2 : 100.
    const hauteur = (svg) => Number(/viewBox="0 0 340 (\d+)"/.exec(svg)[1]);
    expect(hauteur(x1)).toBe(116);
    expect(hauteur(x2)).toBe(136);
  });

  it('sans surface : un message', async () => {
    const { svgCoupeDirecte } = await import('../src/leve/coupe-directe.js');
    expect(svgCoupeDirecte({ lignes: [], demiLongueur: 5, altitudeCanne: null, titre: 'Axe', gauche: '', droite: '' })).toContain('Pas de surface ici');
  });
});
