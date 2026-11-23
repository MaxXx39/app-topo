import { describe, it, expect } from 'vitest';
import {
  nouveauPlanChantier, ajouterPhase, retirerPhase, ajouterObjet, retirerObjet, objetsVisibles, couleurObjet, aire, longueur,
  distanceAuSegment, dansPolygone, objetSousLePoint, deplacerObjet, bornesObjets, pointeDeFleche, lignesPourAccroche,
  resumeObjet, copiePlan, categorieZone, styleLigne, sommetSousLePoint, positionsLeLong, morceauxAvecTrous,
  decalerPolyligne, coteDuPoint, ligneLaPlusProche, centreZone, texteSurface, dimensionsFleche, metresParMm, epaisseurLigneMm,
  contourZoneMm, opaciteZone, pointsDe, LARGEUR_FLECHE,
} from '../src/topo/plan-chantier.js';
import { completerProjet } from '../src/projet/projet.js';

const E = 2500000;
const N = 1118000;
const carre = [[E, N], [E + 10, N], [E + 10, N + 10], [E, N + 10]];

describe('plan de chantier : modèle', () => {
  it('nouveau plan : une phase active, aucun objet', () => {
    const p = nouveauPlanChantier('PIC-01', 'installation', '2026-11-23T08:00:00.000Z');
    expect(p.nom).toBe('PIC-01');
    expect(p.genre).toBe('installation');
    expect(p.phases).toHaveLength(1);
    expect(p.phaseActive).toBe(p.phases[0].id);
    expect(p.objets).toEqual([]);
    expect(p.creeLe).toBe('2026-11-23T08:00:00.000Z');
  });

  it('phases : ajouter (devient active, couleur suivante), retirer avec ses objets, jamais la dernière', () => {
    const p = nouveauPlanChantier('P');
    const ph1 = p.phaseActive;
    const ph2 = ajouterPhase(p);
    expect(p.phaseActive).toBe(ph2.id);
    expect(ph2.nom).toBe('Phase 2');
    expect(ph2.couleur).not.toBe(p.phases[0].couleur);
    ajouterObjet(p, { type: 'zone', points: carre, categorie: 'stockage' });
    expect(p.objets[0].phase).toBe(ph2.id);
    expect(retirerPhase(p, ph2.id)).toBe(true);
    expect(p.objets).toHaveLength(0);
    expect(p.phaseActive).toBe(ph1);
    expect(retirerPhase(p, ph1)).toBe(false);
  });

  it('objets visibles : ceux des phases cochées seulement', () => {
    const p = nouveauPlanChantier('P');
    const a = ajouterObjet(p, { type: 'zone', points: carre });
    const ph2 = ajouterPhase(p);
    ajouterObjet(p, { type: 'fleche', points: [[E, N], [E + 5, N]] });
    expect(objetsVisibles(p)).toHaveLength(2);
    ph2.visible = false;
    expect(objetsVisibles(p).map((o) => o.id)).toEqual([a.id]);
    expect(retirerObjet(p, a.id)).toBe(true);
    expect(retirerObjet(p, a.id)).toBe(false);
  });

  it('couleur : celle de la catégorie / du style, ou celle de la phase', () => {
    const p = nouveauPlanChantier('P');
    const z = ajouterObjet(p, { type: 'zone', points: carre, categorie: 'stockage' });
    const l = ajouterObjet(p, { type: 'ligne', points: carre, style: 'cloture' });
    expect(couleurObjet(p, z)).toBe(categorieZone('stockage').couleur);
    expect(couleurObjet(p, l)).toBe(styleLigne('cloture').couleur);
    p.couleurs = 'phases';
    expect(couleurObjet(p, z)).toBe(p.phases[0].couleur);
    expect(categorieZone('inconnue').cle).toBe('installation');
    expect(styleLigne('inconnu').cle).toBe('libre');
  });
});

describe('plan de chantier : géométrie', () => {
  it('aire et longueur', () => {
    expect(aire(carre)).toBeCloseTo(100, 6);
    expect(aire([...carre].reverse())).toBeCloseTo(100, 6);
    expect(longueur(carre)).toBeCloseTo(30, 6);
    expect(longueur(carre, true)).toBeCloseTo(40, 6);
  });

  it('distance à un segment, point dans un polygone', () => {
    expect(distanceAuSegment([E + 5, N + 3], [E, N], [E + 10, N])).toBeCloseTo(3, 6);
    expect(distanceAuSegment([E - 4, N + 3], [E, N], [E + 10, N])).toBeCloseTo(5, 6);
    expect(dansPolygone([E + 5, N + 5], carre)).toBe(true);
    expect(dansPolygone([E + 15, N + 5], carre)).toBe(false);
  });

  it('objet sous le point : zone (dedans), piste (demi-largeur), texte, le dernier dessiné d\'abord', () => {
    const p = nouveauPlanChantier('P');
    const z = ajouterObjet(p, { type: 'zone', points: carre });
    const piste = ajouterObjet(p, { type: 'piste', points: [[E - 20, N + 30], [E + 20, N + 30]], largeur: 6 });
    const t = ajouterObjet(p, { type: 'texte', point: [E + 5, N + 5], texte: 'Base', taille: 1 });
    expect(objetSousLePoint(p.objets, [E + 5, N + 5], 0.2).id).toBe(t.id);
    expect(objetSousLePoint(p.objets, [E + 2, N + 8], 0.2).id).toBe(z.id);
    expect(objetSousLePoint(p.objets, [E, N + 32.5], 0.2).id).toBe(piste.id);
    expect(objetSousLePoint(p.objets, [E, N + 34], 0.2)).toBeNull();
  });

  it('déplacer et bornes', () => {
    const o = deplacerObjet({ type: 'zone', points: carre.map((q) => [...q]) }, 2, -1);
    expect(o.points[0]).toEqual([E + 2, N - 1]);
    const t = deplacerObjet({ type: 'texte', point: [E, N] }, 1, 1);
    expect(t.point).toEqual([E + 1, N + 1]);
    expect(bornesObjets([o, t])).toEqual({ estMin: E + 1, estMax: E + 12, nordMin: N - 1, nordMax: N + 9 });
    expect(bornesObjets([])).toBeNull();
  });

  it('pointe de flèche : sur le dernier point, de la bonne taille', () => {
    const [pointe, g, d] = pointeDeFleche([E, N], [E + 10, N], 2, 1.6);
    expect(pointe).toEqual([E + 10, N]);
    expect(g[0]).toBeCloseTo(E + 8, 6);
    expect(g[1]).toBeCloseTo(N + 0.8, 6);
    expect(d[1]).toBeCloseTo(N - 0.8, 6);
  });

  it('lignes pour l\'accroche : sans les textes, zones fermées', () => {
    const lignes = lignesPourAccroche([
      { type: 'zone', points: carre }, { type: 'texte', point: [E, N], texte: 'x' }, { type: 'ligne', points: [[E, N], [E + 1, N]] },
    ]);
    expect(lignes).toHaveLength(2);
    expect(lignes[0].ferme).toBe(true);
    expect(lignes[0].points[0]).toEqual({ est: E, nord: N, altitude: null });
  });

  it('résumé lisible', () => {
    expect(resumeObjet({ type: 'zone', points: carre, categorie: 'stockage' })).toBe('Zone · Stockage · 100.0 m²');
    expect(resumeObjet({ type: 'piste', points: [[E, N], [E + 25, N]], largeur: 4 })).toBe('Piste · 4.0 m de large · 25.0 m');
    expect(resumeObjet({ type: 'texte', texte: 'Base-vie' })).toBe('Texte « Base-vie »');
  });

  it('copie indépendante (Annuler)', () => {
    const p = nouveauPlanChantier('P');
    ajouterObjet(p, { type: 'zone', points: carre });
    const c = copiePlan(p);
    c.objets[0].points[0][0] = 0;
    expect(p.objets[0].points[0][0]).toBe(E);
  });
});

describe('projet : plans de chantier et comparaisons gardés à l\'ouverture', () => {
  it('plansChantier ajouté s\'il manque, gardé s\'il existe', () => {
    expect(completerProjet({ nom: 'x', calculs: [] }).plansChantier).toEqual([]);
    const p = nouveauPlanChantier('PIC');
    expect(completerProjet({ nom: 'x', calculs: [], plansChantier: [p] }).plansChantier[0].nom).toBe('PIC');
  });
  it('comparaisons de PDF (0.282.0) : plus effacées en rouvrant le projet', () => {
    const c = { id: 'c1', nom: 'Coffrage', fichiers: [], planches: [] };
    expect(completerProjet({ nom: 'x', calculs: [], comparaisons: [c] }).comparaisons).toEqual([c]);
  });
  it('projet de la version 1 : ses anciennes comparaisons de volumes deviennent des calculs', () => {
    const complet = completerProjet({ nom: 'x', surfaces: [], comparaisons: [{ id: 'v1', nom: 'avant/après', avant: 'surface:a', apres: 'surface:b' }] });
    expect(complet.comparaisons).toBeUndefined();
    expect(complet.calculs.map((k) => k.id)).toContain('v1');
  });
});

describe('plan de chantier 0.287.0 : couleurs, poignées, lignes à motifs, flèches', () => {
  it('couleur choisie pour un élément, sauf en « une couleur par phase »', () => {
    const p = nouveauPlanChantier('P');
    const z = ajouterObjet(p, { type: 'zone', points: carre, categorie: 'stockage', couleur: '#123456' });
    expect(couleurObjet(p, z)).toBe('#123456');
    p.couleurs = 'phases';
    expect(couleurObjet(p, z)).toBe(p.phases[0].couleur);
  });
  it('ancien genre « câble » = électricité', () => {
    expect(styleLigne('cable').cle).toBe('elec');
    expect(styleLigne('elec').motif.eclair).toBe(true);
  });
  it('sommet sous le point (poignée) : le plus proche à la tolérance, sinon -1', () => {
    const o = { type: 'zone', points: carre };
    expect(sommetSousLePoint(o, [E + 10.1, N + 0.1], 0.5)).toBe(1);
    expect(sommetSousLePoint(o, [E + 5, N + 5], 0.5)).toBe(-1);
  });
  it('repères réguliers le long d\'une ligne, même en tournant', () => {
    const r = positionsLeLong([[0, 0], [10, 0], [10, 10]], 4);
    expect(r.map((q) => [q.x, q.y])).toEqual([[2, 0], [6, 0], [10, 0], [10, 4], [10, 8]]);
    expect(r[3].angle).toBeCloseTo(Math.PI / 2, 6);
    expect(positionsLeLong([[0, 0], [1, 0]], 0)).toEqual([]);
  });
  it('morceaux de ligne sans les trous des motifs', () => {
    expect(morceauxAvecTrous([[0, 0], [10, 0], [10, 10]], [4, 12], 1)).toEqual([[[0, 0], [3, 0]], [[5, 0], [10, 0], [10, 1]], [[10, 3], [10, 10]]]);
    expect(morceauxAvecTrous([[0, 0], [10, 0]], [], 1)).toEqual([[[0, 0], [10, 0]]]);
  });
  it('flèche : touchée à sa demi-largeur, résumé avec la largeur', () => {
    const f = { type: 'fleche', points: [[E, N], [E + 20, N]], largeur: 2 };
    expect(objetSousLePoint([f], [E + 10, N + 1.1], 0.2)).toBe(f);
    expect(objetSousLePoint([f], [E + 10, N + 1.5], 0.2)).toBeNull();
    expect(resumeObjet(f)).toBe('Flèche · 20.0 m');
  });
});

describe('plan de chantier 0.288.0 : décalage, flèche, surface, unités du papier', () => {
  it('décalage d\'une ligne : à gauche (+) ou à droite (−) en suivant son sens', () => {
    expect(decalerPolyligne([[0, 0], [10, 0]], 2)).toEqual([[0, 2], [10, 2]]);
    expect(decalerPolyligne([[0, 0], [10, 0]], -0.5)).toEqual([[0, -0.5], [10, -0.5]]);
    expect(decalerPolyligne([[0, 0], [10, 0], [10, 10]], 1)).toEqual([[0, 1], [9, 1], [9, 10]]); // le coin se croise
  });
  it('décalage d\'un contour fermé : reste fermé, dedans ou dehors', () => {
    const anneau = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]; // sens inverse des aiguilles : la gauche est dedans
    expect(decalerPolyligne(anneau, 1)).toEqual([[1, 1], [9, 1], [9, 9], [1, 9], [1, 1]]);
    expect(decalerPolyligne(anneau, -1)).toEqual([[-1, -1], [11, -1], [11, 11], [-1, 11], [-1, -1]]);
  });
  it('côté du clic par rapport à la ligne', () => {
    expect(coteDuPoint([[0, 0], [10, 0]], [5, 3])).toBe(1);
    expect(coteDuPoint([[0, 0], [10, 0]], [5, -3])).toBe(-1);
    expect(coteDuPoint([[10, 0], [0, 0]], [5, 3])).toBe(-1); // ligne dessinée dans l'autre sens
  });
  it('ligne la plus proche (traits du plan DXF ou éléments dessinés), refermée si elle est fermée', () => {
    const l = (pts, ferme = false) => ({ points: pts.map(([est, nord]) => ({ est, nord })), ferme });
    const lignes = [l([[0, 0], [10, 0]]), l([[0, 5], [10, 5], [10, 8], [0, 8]], true)];
    expect(ligneLaPlusProche(lignes, [5, 0.2], 0.5)).toEqual([[0, 0], [10, 0]]);
    expect(ligneLaPlusProche(lignes, [5, 8.1], 0.5)).toHaveLength(5);
    expect(ligneLaPlusProche(lignes, [5, 3], 0.5)).toBeNull();
  });
  it('flèche : largeur 0,2 m au départ, échelle de la pointe, anciennes flèches gardées', () => {
    expect(dimensionsFleche({})).toEqual({ largeur: 0.2, echelle: 1, longueurPointe: 1.2, largeurPointe: 0.9 });
    const d = dimensionsFleche({ echelle: 2 });
    expect(d.longueurPointe).toBeCloseTo(2.4, 6);
    expect(d.largeurPointe).toBeCloseTo(1.8, 6);
    expect(dimensionsFleche({ largeur: 0.9, pointe: 2.5 }).longueurPointe).toBeCloseTo(2.5, 6);
    expect(LARGEUR_FLECHE).toBe(0.2);
  });
  it('surface d\'une zone : centre et texte en m²', () => {
    expect(centreZone([[0, 0], [10, 0], [10, 4], [0, 4]])).toEqual([5, 2]);
    expect(texteSurface([[0, 0], [10, 0], [10, 31.25], [0, 31.25]])).toBe('313 m²');
  });
  it('unités du papier : 1 mm = échelle / 1000 m, épaisseurs et opacité par défaut ou choisies', () => {
    expect(metresParMm({})).toBe(0.2);
    expect(metresParMm({ echelle: 500 })).toBe(0.5);
    expect(epaisseurLigneMm({ style: 'cloture' })).toBe(0.3);
    expect(epaisseurLigneMm({ style: 'cloture', epaisseurMm: 0.7 })).toBe(0.7);
    expect(contourZoneMm({ categorie: 'emprise' })).toBe(0.7);
    expect(contourZoneMm({ categorie: 'stockage', contourMm: 1 })).toBe(1);
    expect(opaciteZone({})).toBe(0.2);
    expect(opaciteZone({ opacite: 60 })).toBe(0.6);
    expect(opaciteZone({ opacite: 150 })).toBe(1);
  });
  it('flèche simple et double, anciens genres « barrière » et « limite » conservés', () => {
    expect(styleLigne('flecheSimple').motif.type).toBe('chevron');
    expect(styleLigne('flecheDouble').motif.type).toBe('double');
    expect(styleLigne('barriere').cle).toBe('flecheSimple');
    expect(styleLigne('limite').cle).toBe('flecheDouble');
  });
  it('texte avec ligne de repère : le point visé fait partie de ses points, il reste en place si le texte bouge', () => {
    const t = { type: 'texte', point: [E, N], texte: 'Base', repere: [E + 5, N + 5] };
    expect(pointsDe(t)).toEqual([[E, N], [E + 5, N + 5]]);
    deplacerObjet(t, 2, 0);
    expect(t.point).toEqual([E + 2, N]);
    expect(t.repere).toEqual([E + 5, N + 5]);
    expect(bornesObjets([t]).estMax).toBe(E + 5);
  });
  it('nouveau plan : échelle 1:200', () => {
    expect(nouveauPlanChantier('P').echelle).toBe(200);
  });
});
