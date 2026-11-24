// Calage de plans (0.298.0) : objets enlevés à la main au nettoyage (clic, rectangle, restaurer) et plan en image (PDF scanné).
import { describe, it, expect } from 'vitest';
import {
  recetteDeDepart, nettoyerPlan, cleObjet, objetSousLePoint, objetsDansZone, objetsEnleves, planVisible, planDesEnleves,
} from '../src/topo/nettoyage-plan.js';
import { planImagePdf } from '../src/topo/pdf-image.js';

const plan = {
  nom: 'essai',
  origine: { est: 100, nord: 200 },
  bornes: { estMin: 100, nordMin: 200, estMax: 130, nordMax: 220 },
  calques: [
    { nom: 'MURS', couleur: '#ff0000', visible: true },
    { nom: 'TEXTES', couleur: '#00ff00', visible: true },
  ],
  contenu: {
    traits: [
      { c: 0, k: null, p: [0, 0, 10, 0], f: false }, // A : en bas
      { c: 0, k: null, p: [0, 5, 10, 5], f: false }, // B : au milieu
      { c: 0, k: null, p: [20, 0, 30, 0], f: false }, // C : à droite
    ],
    pleins: [{ c: 0, k: null, p: [20, 10, 25, 10, 25, 15, 20, 15] }],
    cercles: [{ c: 0, k: null, x: 5, y: 15, r: 1 }],
    textes: [{ c: 1, k: null, x: 2, y: 2, h: 1, a: 0, t: 'Mur' }],
    points: [{ c: 0, k: null, x: 28, y: 18, z: 0 }],
  },
  compte: { objets: 7, ignores: {} },
};
const recette = () => recetteDeDepart(plan, '');
const cle = (genre, i) => cleObjet(plan, genre, plan.contenu[genre][i]);

describe('clé d\'un objet', () => {
  it('différente pour chaque objet, même calque', () => {
    const cles = [cle('traits', 0), cle('traits', 1), cle('traits', 2), cle('pleins', 0), cle('cercles', 0), cle('textes', 0), cle('points', 0)];
    expect(new Set(cles).size).toBe(7);
  });
  it('ne dépend pas de l\'origine du plan (nouvel indice lu avec une autre origine)', () => {
    const decale = { ...plan, origine: { est: 90, nord: 190 }, contenu: { ...plan.contenu, traits: [{ c: 0, k: null, p: [10, 10, 20, 10], f: false }] } };
    expect(cleObjet(decale, 'traits', decale.contenu.traits[0])).toBe(cle('traits', 0));
  });
  it('change avec le calque', () => {
    expect(cleObjet(plan, 'traits', { ...plan.contenu.traits[0], c: 1 })).not.toBe(cle('traits', 0));
  });
});

describe('objet sous le doigt', () => {
  it('le trait le plus proche, dans la tolérance', () => {
    expect(objetSousLePoint(plan, 105, 204.8, 0.5)).toMatchObject({ genre: 'traits', index: 1 });
    expect(objetSousLePoint(plan, 105, 202.5, 0.5)).toBeNull();
  });
  it('une surface pleine touchée dedans', () => {
    expect(objetSousLePoint(plan, 122, 212, 0.5)).toMatchObject({ genre: 'pleins', index: 0 });
  });
  it('un objet déjà enlevé n\'est pas proposé', () => {
    expect(objetSousLePoint(plan, 105, 204.8, 0.5, new Set([cle('traits', 1)]))).toBeNull();
  });
});

describe('rectangle', () => {
  // Rectangle de (99, 199) à (111, 206) : A et B entièrement dedans, le texte aussi ; C dehors.
  const rect = [[99, 199], [111, 199], [111, 206], [99, 206]];
  it('de gauche à droite : seulement les objets entièrement dedans', () => {
    const cles = objetsDansZone(plan, rect, 'dedans');
    expect(cles.sort()).toEqual([cle('traits', 0), cle('traits', 1), cle('textes', 0)].sort());
  });
  it('de droite à gauche : aussi ceux qui touchent', () => {
    // Rectangle qui coupe A et B en leur milieu (x 104 à 106) : rien dedans, mais A et B touchent.
    const etroit = [[104, 199], [106, 199], [106, 206], [104, 206]];
    expect(objetsDansZone(plan, etroit, 'dedans')).toEqual([]);
    expect(objetsDansZone(plan, etroit, 'touche').sort()).toEqual([cle('traits', 0), cle('traits', 1)].sort());
  });
  it('un cercle pris entier seulement s\'il est entièrement dedans', () => {
    expect(objetsDansZone(plan, [[103, 213], [107, 213], [107, 217], [103, 217]], 'dedans')).toEqual([cle('cercles', 0)]);
    expect(objetsDansZone(plan, [[105, 213], [107, 213], [107, 217], [105, 217]], 'dedans')).toEqual([]);
    expect(objetsDansZone(plan, [[105, 213], [107, 213], [107, 217], [105, 217]], 'touche')).toEqual([cle('cercles', 0)]);
  });
});

describe('nettoyage avec des objets enlevés', () => {
  it('l\'objet enlevé disparaît, le reste de son calque reste', () => {
    const r = { ...recette(), enleves: [cle('traits', 1)] };
    const n = nettoyerPlan(plan, r);
    expect(n.contenu.traits).toHaveLength(2);
    expect(n.calques.map((c) => c.nom)).toContain('MURS');
    expect(n.compte.objets).toBe(6);
  });
  it('restaurer = retirer la clé de la liste', () => {
    const r = { ...recette(), enleves: [] };
    expect(nettoyerPlan(plan, r).compte.objets).toBe(7);
  });
  it('liste des enlevés, avec le calque et le texte', () => {
    const l = objetsEnleves(plan, [cle('textes', 0), cle('traits', 2), 'inconnu']);
    expect(l.map((o) => o.texte)).toEqual(['Texte « Mur » · TEXTES', 'Trait · MURS']);
  });
  it('plan montré = sans les enlevés ni les calques écartés ; plan des enlevés = eux seuls', () => {
    const r = { ...recette(), ecartes: ['TEXTES'], enleves: [cle('traits', 0)] };
    const v = planVisible(plan, r);
    expect(v.contenu.traits).toHaveLength(2);
    expect(v.contenu.textes).toHaveLength(0);
    const e = planDesEnleves(plan, r.enleves);
    expect(e.contenu.traits).toEqual([plan.contenu.traits[0]]);
    expect(e.contenu.cercles).toEqual([]);
  });
  it('recette ancienne sans « enleves » : rien d\'enlevé', () => {
    const { enleves, ...ancienne } = recette();
    expect(enleves).toEqual([]);
    expect(nettoyerPlan(plan, ancienne).compte.objets).toBe(7);
  });
});

describe('plan en image (PDF scanné)', () => {
  const image = planImagePdf({ nom: 'scan.pdf', largeurPt: 1190.55, hauteurPt: 841.89, donnees: 'data:image/jpeg;base64,AAAA', pixels: { largeur: 10, hauteur: 7 } });
  it('l\'image passe le nettoyage (taille de la feuille A3 en m)', () => {
    const n = nettoyerPlan(image, recetteDeDepart(image, 'PDF_scan - '));
    expect(n.contenu.image.donnees).toBe('data:image/jpeg;base64,AAAA');
    expect(n.compte.objets).toBe(1);
    expect(n.calques.map((c) => c.nom)).toEqual(['PDF_scan - PDF_IMAGE']);
    expect(image.bornes.estMax).toBeCloseTo(0.42, 3);
  });
  it('calque de l\'image écarté : plus rien', () => {
    const n = nettoyerPlan(image, { ...recetteDeDepart(image, ''), ecartes: ['PDF_IMAGE'] });
    expect(n.contenu.image).toBeUndefined();
    expect(n.compte.objets).toBe(0);
  });
});
