// Dessin : géométrie (cotes avec angles droits, rectangle, pente le long d'un côté).
import { describe, it, expect } from 'vitest';
import { contourParCotes, rectangle, ecartFermeture, altitudesEnPente, directionUnitaire } from '../src/topo/dessin.js';

const A = { est: 2500000, nord: 1100000 };
const versNord = { est: 2500000, nord: 1100010 };
const versEst = { est: 2500010, nord: 1100000 };
const arrondi = (sommets) => sommets.map((s) => ({ est: Math.round((s.est - A.est) * 1000) / 1000, nord: Math.round((s.nord - A.nord) * 1000) / 1000 }));

describe('contour par cotes (longueurs + angles droits)', () => {
  it('vers le nord, 10 m, à droite 5 m (vers l\'est), à droite 10 m (vers le sud)', () => {
    const { sommets } = contourParCotes(A, versNord, [{ longueur: 10 }, { longueur: 5, tourne: 'droite' }, { longueur: 10, tourne: 'droite' }]);
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 0, nord: 10 }, { est: 5, nord: 10 }, { est: 5, nord: 0 }]);
  });

  it('à gauche en partant vers l\'est : on monte vers le nord', () => {
    const { sommets } = contourParCotes(A, versEst, [{ longueur: 4 }, { longueur: 3, tourne: 'gauche' }]);
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 4, nord: 0 }, { est: 4, nord: 3 }]);
  });

  it('forme en L qui se referme : écart de fermeture nul', () => {
    const cotes = [
      { longueur: 10 }, { longueur: 4, tourne: 'droite' }, { longueur: 6, tourne: 'droite' },
      { longueur: 3, tourne: 'gauche' }, { longueur: 4, tourne: 'droite' }, { longueur: 7, tourne: 'droite' },
    ];
    const { sommets } = contourParCotes(A, versNord, cotes);
    expect(ecartFermeture(sommets)).toBeLessThan(1e-9);
  });

  it('erreurs claires : même point, longueur manquante, sens manquant', () => {
    expect(contourParCotes(A, A, [{ longueur: 1 }]).erreur).toMatch(/même endroit/);
    expect(contourParCotes(A, versNord, [{ longueur: 0 }]).erreur).toMatch(/côté 1/);
    expect(contourParCotes(A, versNord, [{ longueur: 1 }, { longueur: 2 }]).erreur).toMatch(/côté 2 : choisis/);
  });
});

describe('rectangle', () => {
  it('12 × 8 m, orienté vers l\'est, largeur à droite (vers le sud)', () => {
    const { sommets } = rectangle(A, versEst, 12, 8, 'droite');
    expect(arrondi(sommets)).toEqual([{ est: 0, nord: 0 }, { est: 12, nord: 0 }, { est: 12, nord: -8 }, { est: 0, nord: -8 }]);
  });

  it('orientation quelconque : côtés et angles droits respectés', () => {
    const { sommets } = rectangle(A, { est: A.est + 3, nord: A.nord + 4 }, 10, 5, 'gauche');
    const d = (p, q) => Math.hypot(q.est - p.est, q.nord - p.nord);
    expect(d(sommets[0], sommets[1])).toBeCloseTo(10, 9);
    expect(d(sommets[1], sommets[2])).toBeCloseTo(5, 9);
    expect(d(sommets[0], sommets[2])).toBeCloseTo(Math.hypot(10, 5), 9);
  });

  it('refuse une largeur nulle', () => {
    expect(rectangle(A, versEst, 10, 0).erreur).toBeTruthy();
  });
});

describe('pente le long d\'un côté', () => {
  const { sommets } = rectangle(A, versEst, 20, 10, 'gauche'); // 0,0 → 20,0 → 20,10 → 0,10
  it('2 % le long du 1er côté (vers l\'est), 450.000 au 1er sommet', () => {
    const h = altitudesEnPente(sommets, { altitude: 450, depuis: 0, cote: 0, pente: 2 });
    expect(h.map((v) => Math.round(v * 1000) / 1000)).toEqual([450, 450.4, 450.4, 450]);
  });

  it('pente nulle : plateforme horizontale', () => {
    expect(altitudesEnPente(sommets, { altitude: 451.2, pente: 0 })).toEqual([451.2, 451.2, 451.2, 451.2]);
  });

  it('direction unitaire nulle pour deux points confondus', () => {
    expect(directionUnitaire(A, A)).toBeNull();
  });
});

describe('pilote : gisement et distance', async () => {
  const { gisement, gisementNormal, pointSelonGisement, airePolygone, longueursCotes, altitudesDuDessin, nomDessin } = await import('../src/topo/dessin.js');

  it('gisement : nord 0, est 100, sud 200, ouest 300 gon', () => {
    expect(gisement(A, versNord)).toBeCloseTo(0, 9);
    expect(gisement(A, versEst)).toBeCloseTo(100, 9);
    expect(gisement(A, { est: A.est, nord: A.nord - 1 })).toBeCloseTo(200, 9);
    expect(gisement(A, { est: A.est - 1, nord: A.nord })).toBeCloseTo(300, 9);
    expect(gisement(A, { est: A.est + 1, nord: A.nord + 1 })).toBeCloseTo(50, 9);
    expect(gisement(A, A)).toBeNull();
  });

  it('gisement ramené entre 0 et 400', () => {
    expect(gisementNormal(420)).toBe(20);
    expect(gisementNormal(-100)).toBe(300);
  });

  it('point à 7.5 m au gisement 200 (plein sud)', () => {
    const p = pointSelonGisement(A, 200, 7.5);
    expect(p.est - A.est).toBeCloseTo(0, 9);
    expect(p.nord - A.nord).toBeCloseTo(-7.5, 9);
  });

  it('aller-retour : le gisement du point calculé est celui donné', () => {
    expect(gisement(A, pointSelonGisement(A, 137.25, 12))).toBeCloseTo(137.25, 9);
  });

  it('aire et côtés d\'un rectangle 12 × 8', () => {
    const { sommets } = rectangle(A, versEst, 12, 8, 'droite');
    expect(airePolygone(sommets)).toBeCloseTo(96, 9);
    expect(longueursCotes(sommets, true).map((l) => Math.round(l * 1000) / 1000)).toEqual([12, 8, 12, 8]);
    expect(longueursCotes(sommets, false)).toHaveLength(3);
  });

  it('altitudes : fixe, avec pente, par sommet', () => {
    const { sommets } = rectangle(A, versEst, 20, 10, 'gauche');
    const avec = (hauteur) => altitudesDuDessin({ sommets: sommets.map((s, i) => ({ ...s, altitude: 400 + i })), hauteur });
    expect(avec({ mode: 'fixe', altitude: 450, pente: null })).toEqual([450, 450, 450, 450]);
    expect(avec({ mode: 'fixe', altitude: 450, pente: { pourcent: 2, cote: 0, depuis: 0 } }).map((v) => Math.round(v * 1000) / 1000)).toEqual([450, 450.4, 450.4, 450]);
    expect(avec({ mode: 'sommets', altitude: 450 })).toEqual([400, 401, 402, 403]);
  });

  it('nom automatique : le numéro suivant de ce type', () => {
    expect(nomDessin('plateforme', [{ nom: 'Plateforme 1' }, { nom: 'Plateforme 3' }, { nom: 'Ligne 9' }])).toBe('Plateforme 4');
    expect(nomDessin('batiment', [])).toBe('Bâtiment 1');
  });
});

describe('implanter un dessin', async () => {
  const { pointsDuDessin, cotesDuDessin, coteSousLeDoigt, numeroDessin } = await import('../src/topo/dessin.js');
  const { sommets } = rectangle(A, versEst, 12, 8, 'gauche'); // 0,0 → 12,0 → 12,8 → 0,8
  const plateforme = { id: 'p', type: 'plateforme', numero: 2, sommets, hauteur: { mode: 'fixe', altitude: 450.2, pente: null } };
  const ligne = { id: 'l', type: 'ligne', sommets: sommets.slice(0, 3), hauteur: null };
  const dessins = [plateforme, ligne];

  it('noms courts : PF2-1… (numéro gardé), LI1-1… (place parmi les lignes)', () => {
    expect(pointsDuDessin(plateforme, dessins).map((p) => p.nom)).toEqual(['PF2-1', 'PF2-2', 'PF2-3', 'PF2-4']);
    expect(pointsDuDessin(ligne, dessins).map((p) => p.nom)).toEqual(['LI1-1', 'LI1-2', 'LI1-3']);
    expect(numeroDessin(ligne, dessins)).toBe(1);
  });

  it('altitude des points : celle de la plateforme', () => {
    expect(pointsDuDessin(plateforme, dessins).every((p) => p.altitude === 450.2)).toBe(true);
  });

  it('côtés : 4 pour la plateforme fermée, 2 pour la ligne, aucun pour des points', () => {
    expect(cotesDuDessin(plateforme, dessins).map((c) => c.nom)).toEqual(['PF2-1 → PF2-2', 'PF2-2 → PF2-3', 'PF2-3 → PF2-4', 'PF2-4 → PF2-1']);
    expect(cotesDuDessin(ligne, dessins)).toHaveLength(2);
    expect(cotesDuDessin({ type: 'points', sommets }, [])).toEqual([]);
  });

  it('côté sous le doigt : le plus proche, à la tolérance près', () => {
    const cotes = cotesDuDessin(plateforme, dessins);
    expect(coteSousLeDoigt({ est: A.est + 6, nord: A.nord + 0.3 }, 0.5, cotes).nom).toBe('PF2-1 → PF2-2');
    expect(coteSousLeDoigt({ est: A.est + 12.2, nord: A.nord + 4 }, 0.5, cotes).nom).toBe('PF2-2 → PF2-3');
    expect(coteSousLeDoigt({ est: A.est + 6, nord: A.nord + 4 }, 0.5, cotes)).toBeNull();
  });
});

describe('plateforme → surface', async () => {
  const { trianglesPolygone, surfaceDuDessin, airePolygone: aire } = await import('../src/topo/dessin.js');
  const aireTriangles = (sommets, faces) => faces.reduce((s, [i, j, k]) => s + aire([sommets[i], sommets[j], sommets[k]]), 0);

  it('rectangle : 2 triangles qui couvrent l\'aire', () => {
    const { sommets } = rectangle(A, versEst, 12, 8, 'gauche');
    const faces = trianglesPolygone(sommets);
    expect(faces).toHaveLength(2);
    expect(aireTriangles(sommets, faces)).toBeCloseTo(96, 6);
  });

  it('forme en L (coin rentrant), dans les deux sens de rotation', () => {
    const { sommets } = contourParCotes(A, versNord, [
      { longueur: 10 }, { longueur: 4, tourne: 'droite' }, { longueur: 6, tourne: 'droite' },
      { longueur: 3, tourne: 'gauche' }, { longueur: 4, tourne: 'droite' },
    ]);
    // 0,0 → 0,10 → 4,10 → 4,4 → 7,4 → 7,0 (le 7e côté ferme)
    const aireL = aire(sommets);
    expect(aireL).toBeCloseTo(52, 6);
    for (const contour of [sommets, [...sommets].reverse()]) {
      const faces = trianglesPolygone(contour);
      expect(faces).toHaveLength(contour.length - 2);
      expect(aireTriangles(contour, faces)).toBeCloseTo(aireL, 6);
    }
  });

  it('contour qui se croise (nœud papillon) : refusé', () => {
    const p = (e, n) => ({ est: A.est + e, nord: A.nord + n });
    expect(trianglesPolygone([p(0, 0), p(10, 10), p(10, 0), p(0, 10)])).toBeNull();
  });

  it('surface d\'une plateforme : points nommés avec altitude, faces ; erreurs claires', () => {
    const { sommets } = rectangle(A, versEst, 12, 8, 'gauche');
    const plateforme = { type: 'plateforme', numero: 1, sommets, hauteur: { mode: 'fixe', altitude: 450.2, pente: null } };
    const surface = surfaceDuDessin(plateforme, [plateforme]);
    expect(surface.points.map((x) => x.nom)).toEqual(['PF1-1', 'PF1-2', 'PF1-3', 'PF1-4']);
    expect(surface.faces).toHaveLength(2);
    expect(surfaceDuDessin({ ...plateforme, hauteur: { mode: 'fixe', altitude: null } }, [plateforme]).erreur).toMatch(/altitude manquante/);
    expect(surfaceDuDessin({ ...plateforme, type: 'ligne' }, []).erreur).toBeTruthy();
  });
});

describe('volume : terrain naturel contre plateforme dessinée', async () => {
  const { surfaceDuDessin } = await import('../src/topo/dessin.js');
  const { calculerSurface } = await import('../src/topo/surface.js');
  const { calculerVolume } = await import('../src/volumes/calculs.js');

  it('plateforme 12 × 8 m à 450.50 sur un terrain plat à 450.00 : 48.000 m³ de remblai', () => {
    // Terrain naturel plat à 450.00, plus grand que la plateforme (surface importée : points et faces).
    const p = (nom, e, n) => ({ nom, est: A.est + e, nord: A.nord + n, altitude: 450 });
    const tn = { id: 'tn', nom: 'TN', type: 'landxml', nature: 'terrain', points: [p('t1', -10, -10), p('t2', 30, -10), p('t3', 30, 20), p('t4', -10, 20)], faces: [[0, 1, 2], [0, 2, 3]] };
    const { sommets } = rectangle(A, versEst, 12, 8, 'gauche');
    const dessin = { type: 'plateforme', numero: 1, sommets, hauteur: { mode: 'fixe', altitude: 450.5, pente: null } };
    const pf = { id: 'pf', nom: 'Plateforme 1', type: 'dessin', nature: 'terrassement', ...surfaceDuDessin(dessin, [dessin]) };
    const surfaces = [tn, pf];
    const triangulations = new Map(surfaces.map((s) => [s.id, calculerSurface(s, [])]));
    const resultat = calculerVolume({ uneSeule: false, surface1Id: 'pf', surface2Id: 'tn', zone: { type: 'toute' } }, { surfaces, triangulations, pointsDe: () => [] });
    expect(resultat.erreurs).toBeUndefined();
    expect(resultat.remblai).toBeCloseTo(48, 3);
    expect(resultat.deblai).toBeCloseTo(0, 6);
  });
});
