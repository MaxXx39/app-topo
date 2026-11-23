// Plans de chantier 0.289.0 : convertisseur de blocs DXF, symboles modernisés, grues, base-vie à étage, feuille, DXF.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireBlocsDxf, blocIgnore, bornesPrimitives } from '../src/topo/blocs-dxf.js';
import {
  bibliothequeDepuisBlocs, materiau, adoucir, nuance, categorieDuBloc, separerRayon, transformeEscalier, primitivesEtage,
  symboleGrue, flechesDisponibles, chassisDisponibles, symboleChassis, surLeSymbole, rotationVers, versTerrainSymbole,
  versSymbole, poigneeRotation, coinsSymbole, equipementsVehicule, CLE_CONTENEUR, ARDOISE, BLANC_BLOC,
} from '../src/topo/symboles.js';
import {
  nouveauPlanChantier, ajouterObjet, objetSousLePoint, deplacerObjet, resumeObjet, bordsDesTriangles, ajouterPhase, estPose,
} from '../src/topo/plan-chantier.js';
import {
  miseEnPageFeuille, pagesDeLaFeuille, elementsLegende, textesCartouche, vueDuCadre, reglagesFeuille, centreDeDepart, objetsDeLaPage,
} from '../src/topo/feuille-chantier.js';
import { dxfPlanChantier, trianguler, aciProche, blocDuPose } from '../src/topo/plan-chantier-dxf.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';
import { entreesBibliotheque, filtrerEntrees, ajouterSymbolesProjet } from '../src/plans-chantier/bibliotheque.js';

const BIB = JSON.parse(readFileSync(new URL('../src/plans-chantier/symboles-base.json', import.meta.url), 'utf8')).symboles;

/** Petit DXF : un bloc « Benne » (contour + hachure à trou + texte), un bloc « Engin » qui l'insère tourné, un leader. */
function dxfDeBlocs() {
  const l = [
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'B', '62', '3', '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS',
    '0', 'BLOCK', '8', '0', '2', 'Benne', '70', '0', '10', '0', '20', '0',
    '0', 'LWPOLYLINE', '8', '0', '62', '0', '90', '4', '70', '1', '10', '0', '20', '0', '10', '4', '20', '0', '10', '4', '20', '2', '10', '0', '20', '2',
    '0', 'HATCH', '8', 'B', '2', 'SOLID', '70', '1', '91', '2',
    '92', '2', '72', '0', '73', '1', '93', '4', '10', '0', '20', '0', '10', '4', '20', '0', '10', '4', '20', '2', '10', '0', '20', '2', '97', '0',
    '92', '2', '72', '0', '73', '1', '93', '4', '10', '1', '20', '0.5', '10', '3', '20', '0.5', '10', '3', '20', '1.5', '10', '1', '20', '1.5', '97', '0',
    '0', 'TEXT', '8', '0', '62', '7', '10', '2', '20', '1', '40', '0.5', '1', 'BENNE', '72', '1', '73', '2', '11', '2', '21', '1',
    '0', 'ENDBLK',
    '0', 'BLOCK', '8', '0', '2', 'Engin', '70', '0', '10', '0', '20', '0',
    '0', 'INSERT', '8', '0', '2', 'Benne', '10', '10', '20', '0', '50', '90',
    '0', 'CIRCLE', '8', '0', '62', '1', '10', '0', '20', '0', '40', '1',
    '0', 'ENDBLK',
    '0', 'BLOCK', '8', '0', '2', 'MENSURA_LEADER1', '70', '0', '10', '0', '20', '0',
    '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1', '21', '1', '0', 'ENDBLK',
    '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'ENDSEC', '0', 'EOF',
  ];
  return l.join('\n');
}

describe('convertisseur de blocs DXF', () => {
  const { blocs, erreur } = lireBlocsDxf(dxfDeBlocs());
  it('lit les blocs nommés, dans l\'ordre de dessin, sans les MENSURA_LEADER', () => {
    expect(erreur).toBeNull();
    expect(blocs.map((b) => b.nom)).toEqual(['Benne', 'Engin']);
    expect(blocs[0].primitives.map((p) => p.g)).toEqual(['l', 'h', 't']);
    expect(blocIgnore('MENSURA_LEADER12')).toBe(true);
    expect(blocIgnore('*D12')).toBe(true);
  });
  it('couleurs : du bloc (0 et 7), du calque, ACI ; hachure à trou = 2 contours', () => {
    const [l, h, t] = blocs[0].primitives;
    expect(l.k).toBe('BB');
    expect(h.k).toBe('#00ff00');
    expect(h.p).toHaveLength(2);
    expect(h.m).toBe(false);
    expect(t).toMatchObject({ k: 'BB', t: 'BENNE', ah: 1, av: 2, x: 2, y: 1 });
  });
  it('bloc imbriqué : inséré tourné de 90° et déplacé', () => {
    const b = bornesPrimitives(blocs[1].primitives.filter((p) => p.g === 'h'));
    expect(b.xMin).toBeCloseTo(8, 6); // la benne tournée : x de 10 − 2 à 10, y de 0 à 4
    expect(b.xMax).toBeCloseTo(10, 6);
    expect(b.yMax).toBeCloseTo(4, 6);
    const texte = blocs[1].primitives.find((p) => p.g === 't');
    expect(texte.a).toBeCloseTo(90, 6);
  });
  it('refuse un fichier sans blocs', () => {
    expect(lireBlocsDxf('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF').erreur).toMatch(/pas de blocs/);
  });
});

describe('modernisation', () => {
  it('matériaux d\'après la couleur d\'origine', () => {
    expect(materiau('#80bfff', true)[0]).toBe('vitre');
    expect(materiau('#333333', true)[0]).toBe('caoutchouc');
    expect(materiau('#adadad', true)[0]).toBe('metal');
    expect(materiau('#ffbf00', true)[0]).toBe('peinture');
    expect(materiau('#806040', true)[0]).toBe('gravats');
    expect(materiau('BB', true)).toEqual(['blanc', BLANC_BLOC]);
    expect(materiau('BB', false)).toEqual(['trait', ARDOISE]);
  });
  it('couleurs adoucies et nuances', () => {
    expect(adoucir('#ff0000')).not.toBe('#ff0000');
    expect(nuance('#808080', 1)).toBe('#ffffff');
    expect(nuance('#808080', -1)).toBe('#000000');
  });
  it('catégories', () => {
    expect(categorieDuBloc('Camion Toupie')).toBe('Véhicules');
    expect(categorieDuBloc('Pelle Chenille 5t')).toBe('Engins');
    expect(categorieDuBloc('Cône')).toBe('Sécurité');
    expect(categorieDuBloc('Base Vie Bureau')).toBe('Base-vie');
    expect(categorieDuBloc('Grue Tour sans chassis 40m')).toBe('Grues');
  });
  it('phares, feux et rétroviseurs : camions et chargeuse seulement', () => {
    const b = { xMin: -1.3, yMin: -4, xMax: 1.3, yMax: 4 };
    const e = equipementsVehicule('Camion Benne Plein', b);
    expect(e.filter((p) => p.mat === 'phare')).toHaveLength(2);
    expect(e.filter((p) => p.mat === 'feu')).toHaveLength(2);
    expect(equipementsVehicule('Chargeuse', b).length).toBeGreaterThan(0);
    expect(equipementsVehicule('Voiture Grise', b)).toEqual([]);
    expect(equipementsVehicule('Pelle Pneu', b)).toEqual([]);
  });
  it('bibliothèque : centrée, grue séparée de son rayon, parties cachées', () => {
    const { blocs } = lireBlocsDxf(dxfDeBlocs());
    const bib = bibliothequeDepuisBlocs(blocs, 'projet:');
    expect(bib[0].cle).toBe('projet:Benne');
    const b = bornesPrimitives(bib[0].primitives);
    expect((b.xMin + b.xMax) / 2).toBeCloseTo(0, 3);
    expect((b.yMin + b.yMax) / 2).toBeCloseTo(0, 3);
    const { grue, rayon } = separerRayon([{ g: 'c', r: 25 }, { g: 't', t: '25m' }, { g: 'c', r: 0.5 }, { g: 't', t: 'Flèche 25m' }]);
    expect(rayon).toHaveLength(2);
    expect(grue).toHaveLength(2);
  });
});

describe('bibliothèque livrée (Base_2023.dxf)', () => {
  it('59 symboles proposés, grues et châssis réglables', () => {
    expect(BIB.filter((s) => !s.cache)).toHaveLength(59);
    expect(flechesDisponibles(BIB, 'tour')).toEqual([25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
    expect(flechesDisponibles(BIB, 'auto')).toEqual([20, 25, 30, 35, 40, 45, 50]);
    expect(chassisDisponibles(BIB)).toEqual(['3.80', '4.20', '4.50', '4.60', '6']);
    expect(symboleGrue(BIB, 'tour', 42).fleche).toBe(40);
    expect(symboleChassis(BIB, 'aucun')).toBeNull();
    expect(symboleChassis(BIB, '4.50').chassis).toBe('4.50');
  });
  it('la grue garde sa tour au point de base, son rayon à part (cercle de la longueur de la flèche)', () => {
    const g = symboleGrue(BIB, 'tour', 40);
    expect(g.rayon.some((p) => p.g === 'c' && Math.abs(p.r - 40) < 0.01)).toBe(true);
    expect(g.primitives.some((p) => p.g === 'c' && p.r >= 8)).toBe(false);
  });
  it('conteneur 6,04 × 2,47 m centré', () => {
    const c = BIB.find((s) => s.cle === CLE_CONTENEUR);
    expect(c.largeur).toBeCloseTo(6.04, 2);
    expect(c.hauteur).toBeCloseTo(2.47, 2);
    expect(c.boite[0]).toBeCloseTo(-3.02, 2);
  });
  it('entrées du panneau : grues, base-vie à étage, recherche sans accents', () => {
    const e = entreesBibliotheque(BIB);
    expect(e.map((x) => x.cle)).toEqual(expect.arrayContaining(['grue:tour', 'grue:auto', 'etage', 'base:WC']));
    expect(e.some((x) => x.cle.startsWith('base:Grue '))).toBe(false);
    expect(filtrerEntrees(e, '', 'cone').map((x) => x.nom)).toEqual(['Cône']);
    expect(filtrerEntrees(e, 'Véhicules').every((x) => x.categorie === 'Véhicules')).toBe(true);
  });
  it('symboles importés : ajoutés, ou remplacés s\'ils ont le même nom', () => {
    const projet = {};
    expect(ajouterSymbolesProjet(projet, [{ cle: 'projet:A' }, { cle: 'projet:B' }])).toEqual({ ajoutes: 2, remplaces: 0 });
    expect(ajouterSymbolesProjet(projet, [{ cle: 'projet:A', nom: 'neuf' }])).toEqual({ ajoutes: 0, remplaces: 1 });
    expect(projet.symboles).toHaveLength(2);
  });
});

describe('base-vie à étage : 8 poses de l\'escalier', () => {
  it('4 coins × 2 sens (miroirs et échange des axes)', () => {
    const L = 6;
    const W = 2.5;
    expect(transformeEscalier(0, L, W)(1, -0.5)).toEqual([1, -0.5]);
    expect(transformeEscalier(1, L, W)(1, -0.5)).toEqual([-0.5, 1]); // le long du petit côté
    expect(transformeEscalier(2, L, W)(1, -0.5)).toEqual([5, -0.5]); // coin bas droit
    expect(transformeEscalier(4, L, W)(1, -0.5)).toEqual([5, 3]); // coin haut droit
    expect(transformeEscalier(6, L, W)(1, -0.5)).toEqual([1, 3]); // coin haut gauche
  });
  it('l\'escalier reste collé au conteneur, à son coin, dans chaque pose', () => {
    const c = BIB.find((s) => s.cle === CLE_CONTENEUR);
    for (let pose = 0; pose < 8; pose++) {
      const { dessous, rez, etage } = primitivesEtage(BIB, pose);
      expect(rez).toBe(c.primitives);
      expect(etage.length).toBe(c.primitives.length);
      const b = bornesPrimitives(dessous);
      // L'escalier (3,8 × 3,25 m) déborde du conteneur d'au plus 0,8 m (le palier) d'un côté.
      expect(b.xMax - b.xMin + b.yMax - b.yMin).toBeCloseTo(3.8 + 3.25, 1);
      const coinX = Math.floor(pose / 2) === 1 || Math.floor(pose / 2) === 2 ? 1 : -1;
      const coinY = Math.floor(pose / 2) >= 2 ? 1 : -1;
      expect(Math.sign(coinX > 0 ? b.xMax : b.xMin)).toBe(coinX);
      expect(Math.sign(coinY > 0 ? b.yMax : b.yMin)).toBe(coinY);
    }
  });
});

describe('symbole posé : toucher, tourner, déplacer', () => {
  const s = { boite: [-3, -1, 3, 1] };
  const o = { type: 'symbole', point: [100, 200], rotation: 90, cle: 'x' };
  it('repères terrain ↔ symbole (rotation trigonométrique)', () => {
    expect(versTerrainSymbole(o)(3, 0).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([100, 203]);
    expect(versSymbole(o, [100, 203]).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([3, 0]);
  });
  it('dans la boîte tournée', () => {
    expect(surLeSymbole(o, s, [100.5, 202.5])).toBe(true);
    expect(surLeSymbole(o, s, [102.5, 200])).toBe(false);
    expect(coinsSymbole(o, s)).toHaveLength(4);
  });
  it('poignée de rotation devant le symbole, rotation vers un point', () => {
    const p = poigneeRotation(o, s);
    expect(p[0]).toBeCloseTo(100, 6);
    expect(p[1]).toBeGreaterThan(203);
    expect(rotationVers(o, [90, 200])).toBe(180);
    expect(rotationVers(o, [100, 190])).toBe(270);
  });
  it('dans le plan de chantier : choisi, déplacé, résumé', () => {
    const plan = nouveauPlanChantier('PIC', 'installation', '2026-11-23T10:00:00Z');
    expect(plan.fond.ortho).toBe(true);
    const g = ajouterObjet(plan, { type: 'grue', point: [0, 0], modele: 'tour', fleche: 40, chassis: '4.50' });
    const x = ajouterObjet(plan, { type: 'symbole', point: [10, 0], cle: 'base:WC' });
    expect(estPose(g)).toBe(true);
    expect(objetSousLePoint(plan.objets, [10.2, 0.1], 0.5, () => true).id).toBe(x.id);
    expect(objetSousLePoint(plan.objets, [50, 50], 0.5, (ob, p) => ob.id === g.id && Math.hypot(...p) < 100).id).toBe(g.id);
    deplacerObjet(x, 1, 2);
    expect(x.point).toEqual([11, 2]);
    expect(resumeObjet(g)).toBe('Grue à tour · flèche 40 m · châssis 4.50');
    expect(resumeObjet(x)).toBe('WC');
    expect(resumeObjet({ type: 'symbole', cle: CLE_CONTENEUR, etage: { pose: 0 } })).toBe('Base-vie à étage');
  });
});

describe('fond : bords des surfaces', () => {
  it('seuls les côtés d\'un seul triangle', () => {
    const p = (est, nord) => ({ est, nord });
    const bords = bordsDesTriangles([[p(0, 0), p(1, 0), p(1, 1)], [p(0, 0), p(1, 1), p(0, 1)]]);
    expect(bords).toHaveLength(4);
  });
});

describe('feuille', () => {
  it('A3 paysage : cadre, cartouche en bas à droite, légende au-dessus', () => {
    const m = miseEnPageFeuille('a3', 'paysage', 4);
    expect(m.page).toEqual({ largeur: 420, hauteur: 297 });
    expect(m.k).toBe(1);
    expect(m.cartouche.x + m.cartouche.l).toBeCloseTo(m.cadre.x + m.cadre.l, 6);
    expect(m.cartouche.y + m.cartouche.h).toBeCloseTo(m.cadre.y + m.cadre.h, 6);
    expect(m.legende.y + m.legende.h).toBeCloseTo(m.cartouche.y, 6);
    expect(miseEnPageFeuille('a1', 'portrait').page).toEqual({ largeur: 594, hauteur: 841 });
    expect(miseEnPageFeuille('a4').k).toBeCloseTo(297 / 420, 6);
  });
  it('une page par phase, avec les phases « sur toutes les pages »', () => {
    const plan = nouveauPlanChantier('Phasage', 'phasage');
    const p1 = plan.phases[0];
    p1.commune = true;
    const p2 = ajouterPhase(plan);
    const p3 = ajouterPhase(plan);
    plan.feuille = { pages: 'phases' };
    const pages = pagesDeLaFeuille(plan);
    expect(pages.map((x) => x.titre)).toEqual([p2.nom, p3.nom]);
    expect(pages[0].phases).toEqual([p1.id, p2.id]);
    ajouterObjet(plan, { type: 'zone', phase: p1.id, points: [[0, 0], [1, 0], [1, 1]], categorie: 'emprise' });
    ajouterObjet(plan, { type: 'zone', phase: p3.id, points: [[0, 0], [1, 0], [1, 1]], categorie: 'stockage' });
    expect(objetsDeLaPage(plan, pages[0])).toHaveLength(1);
    expect(objetsDeLaPage(plan, pages[1])).toHaveLength(2);
    plan.feuille.pages = 'une';
    expect(pagesDeLaFeuille(plan)).toHaveLength(1);
  });
  it('légende : chaque genre une fois, zones d\'abord', () => {
    const objets = [
      { type: 'symbole', cle: 'base:WC' }, { type: 'ligne', style: 'cloture' }, { type: 'zone', categorie: 'stockage' },
      { type: 'ligne', style: 'cloture' }, { type: 'zone', categorie: 'stockage' }, { type: 'grue', modele: 'tour', fleche: 40 },
      { type: 'fleche' }, { type: 'symbole', cle: CLE_CONTENEUR, etage: { pose: 1 } },
    ];
    const l = elementsLegende(objets, (c) => c.replace('base:', ''));
    expect(l.map((x) => x.nom)).toEqual(['Stockage', 'Clôture de chantier', 'Sens de circulation', 'WC', 'Grue à tour, flèche 40 m', 'Base-vie à étage']);
  });
  it('cartouche : textes dans la partie droite ; vue du cadre à l\'échelle', () => {
    const k = { x: 200, y: 250, l: 135, h: 36 };
    const t = textesCartouche(k, 1, { affaire: '10 203', projet: 'Gland', titre: 'PIC', phase: '', echelle: 200, format: 'A3 paysage', date: '23.11.2026', indice: 'B', auteur: '' });
    expect(t.map((x) => x.texte)).toEqual(['10 203', 'Gland', 'PIC', 'Échelle 1:200', 'Format A3 paysage', 'Date 23.11.2026', 'Indice B']);
    expect(Math.min(...t.map((x) => x.x))).toBeGreaterThan(k.x + k.l * 0.4);
    const v = vueDuCadre({ echelle: 200 }, { l: 400, h: 277 }, 2, [2500000, 1118000]);
    expect(v.echelle).toBe(10); // 2 px / mm × 1000 / 200
    expect(v.largeur).toBe(800);
  });
  it('réglages de départ et centre', () => {
    const plan = nouveauPlanChantier('PIC');
    expect(reglagesFeuille(plan)).toMatchObject({ format: 'a3', orientation: 'paysage', pages: 'une', logo: 'perrin', indice: 'A' });
    expect(centreDeDepart(plan, [])).toBeNull();
    ajouterObjet(plan, { type: 'zone', points: [[0, 0], [10, 0], [10, 4]], categorie: 'stockage' });
    expect(centreDeDepart(plan)).toEqual([5, 2]);
  });
});

describe('export DXF', () => {
  it('triangulation d\'un polygone (carré, L)', () => {
    expect(trianguler([0, 0, 2, 0, 2, 2, 0, 2])).toHaveLength(2);
    const l = trianguler([0, 0, 3, 0, 3, 1, 1, 1, 1, 3, 0, 3]);
    const aire = l.reduce((s, [ax, ay, bx, by, cx, cy]) => s + Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2, 0);
    expect(aire).toBeCloseTo(5, 9);
  });
  it('couleurs AutoCAD proches', () => {
    expect(aciProche('#ff0000')).toBe(1);
    expect(aciProche('#0000ff')).toBe(5);
    expect(aciProche('#000000')).toBe(250);
  });
  it('plan → DXF relu par Topo : calques par phase, symboles en blocs, rayon de grue à part', () => {
    const plan = nouveauPlanChantier('PIC');
    ajouterObjet(plan, { type: 'zone', points: [[2500000, 1118000], [2500030, 1118000], [2500030, 1118020]], categorie: 'stockage', afficherSurface: true });
    ajouterObjet(plan, { type: 'ligne', points: [[2500000, 1118000], [2500040, 1118000]], style: 'elec' });
    ajouterObjet(plan, { type: 'grue', point: [2500010, 1118010], modele: 'tour', fleche: 40, chassis: '4.50', rotation: 30 });
    ajouterObjet(plan, { type: 'symbole', point: [2500020, 1118005], cle: 'base:WC', rotation: 45 });
    ajouterObjet(plan, { type: 'symbole', point: [2500025, 1118015], cle: CLE_CONTENEUR, etage: { pose: 3, textes: ['1er', 'Rez'] } });
    const texte = dxfPlanChantier(plan, BIB);
    expect(texte).toContain('PC_GRUE_TOUR_40M_4_50');
    expect(texte).toContain('PC_BASE_VIE_ETAGE_P4');
    expect((texte.match(/\r\nINSERT\r\n/g) ?? []).length).toBe(3);
    const { plan: relu } = lirePlanDxf(texte, 'pic.dxf');
    const calques = relu.calques.map((c) => c.nom);
    expect(calques).toEqual(expect.arrayContaining(['PC_PHASE_1_ZONE_STOCKAGE', 'PC_PHASE_1_ELECTRICITE', 'PC_PHASE_1_GRUES', 'PC_GRUES_RAYON', 'PC_PHASE_1_SYMBOLES']));
    expect(relu.contenu.textes.map((t) => t.t)).toEqual(expect.arrayContaining(['ELEC', '1er', 'Rez', '300 m2']));
    expect(relu.contenu.cercles.some((c) => Math.abs(c.r - 40) < 0.01)).toBe(true);
    expect(blocDuPose({ type: 'symbole', cle: 'inconnu' }, BIB)).toBeNull();
  });
});
