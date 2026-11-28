import { describe, it, expect, beforeEach } from 'vitest';
import { affairesDe, ajouterAffaire, modifierAffaire, retirerAffaire, dansAffaire, definirAffaire, numeroAffaireActif, cartoucheActif, definirPastilles, rangerNouveauxDansAffaire, fusionnerProjet, migrerAffaires, nettoyerCategories, categoriesAffaires, CATEGORIES_DEPART, PRINCIPALE } from '../src/topo/affaires.js';

const projetDe = (affaire, id, categorie = 'GC') => ({ cartouche: { affaire, lieu: 'Paris' }, categoriePrincipale: categorie, nom: '', leves: [{ id: `${id}-l1`, nom: 'LV-1', points: [] }], surfaces: [{ id: `${id}-s1`, leveId: `${id}-l1` }], plansDxf: [{ id: `${id}-p1` }] });

describe('affaires d\'un projet (catégories et pastilles)', () => {
  beforeEach(() => definirAffaire(''));

  it('liste de départ : les 6 catégories, BÂT avec accent', () => {
    expect(CATEGORIES_DEPART).toEqual(['ACQ', 'BÂT', 'GC', 'NAT', 'T/R', 'Autres']);
    expect(categoriesAffaires({})).toEqual(CATEGORIES_DEPART);
    expect(categoriesAffaires({ categoriesAffaires: ['GC', 'gc', 'XYZ'] })).toEqual(['GC', 'XYZ']);
    expect(nettoyerCategories('a, b; A')).toEqual(['a', 'b']);
  });

  it('une affaire = numéro + catégorie, une seule par catégorie', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    expect(affairesDe(p).map((x) => x.categorie)).toEqual(['GC', 'BÂT']);
    expect(() => ajouterAffaire(p, '9999', 'GC')).toThrow(/une seule par catégorie/);
    expect(() => ajouterAffaire(p, '10203', 'NAT')).toThrow(/existe déjà/);
    expect(() => ajouterAffaire(p, '9999', '')).toThrow(/catégorie/);
    expect(modifierAffaire(p, b.id, '10 204', 'NAT')).toBe(true);
    expect(affairesDe(p)[1].categorie).toBe('NAT');
  });

  it('sans pastille : visible partout ; avec pastilles : seulement dans ces affaires', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    expect(dansAffaire(p, p.plansDxf[0], 'plan', PRINCIPALE)).toBe(true);
    definirPastilles(p, 'a-p1', ['BÂT']);
    expect(dansAffaire(p, p.plansDxf[0], 'plan', PRINCIPALE)).toBe(false);
    expect(dansAffaire(p, p.plansDxf[0], 'plan', b.id)).toBe(true);
    expect(dansAffaire(p, p.plansDxf[0], 'plan', '')).toBe(true);
    definirPastilles(p, 'a-p1', ['GC', 'BÂT']); // plusieurs pastilles : vu dans les deux
    expect(dansAffaire(p, p.plansDxf[0], 'plan', PRINCIPALE)).toBe(true);
    definirPastilles(p, 'a-p1', []);
    expect(p.plansDxf[0].pastilles).toBeUndefined();
  });

  it('une surface suit les pastilles de son levé', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    definirPastilles(p, 'a-l1', ['BÂT']);
    expect(dansAffaire(p, p.surfaces[0], 'surface', PRINCIPALE)).toBe(false);
    expect(dansAffaire(p, p.surfaces[0], 'surface', b.id)).toBe(true);
  });

  it('numéro et cartouche suivent l\'affaire choisie', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    expect(numeroAffaireActif(p, '')).toBe('8114');
    expect(cartoucheActif(p, b.id).affaire).toBe('10203');
    expect(cartoucheActif(p, b.id).lieu).toBe('Paris');
  });

  it('un nouvel élément reçoit la pastille de l\'affaire choisie ; en « Toutes » : aucune', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    const connus = new Set(['a-l1', 'a-s1', 'a-p1']);
    p.plansDxf.push({ id: 'neuf' });
    expect(rangerNouveauxDansAffaire(p, connus, b.id)).toBe(1);
    expect(p.plansDxf[1].pastilles).toEqual(['BÂT']);
    p.plansDxf.push({ id: 'neuf2' });
    expect(rangerNouveauxDansAffaire(p, connus, '')).toBe(0);
    expect(p.plansDxf[2].pastilles).toBeUndefined();
  });

  it('changer la catégorie d\'une affaire change les pastilles qui la portent', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    definirPastilles(p, 'a-p1', ['BÂT', 'GC']);
    modifierAffaire(p, b.id, '10203', 'NAT');
    expect(p.plansDxf[0].pastilles).toEqual(['NAT', 'GC']);
  });

  it('on ne retire qu\'une affaire dont plus rien n\'a la pastille', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    definirPastilles(p, 'a-p1', ['BÂT']);
    expect(retirerAffaire(p, b.id)).toMatch(/pastille/);
    definirPastilles(p, 'a-p1', []);
    expect(retirerAffaire(p, b.id)).toBeNull();
    expect(retirerAffaire(p, PRINCIPALE)).toMatch(/principale/);
  });

  it('fusionner : numéro + catégorie, éléments pastillés, pas de fusion d\'une copie', () => {
    const a = projetDe('8114', 'a');
    const b = projetDe('10203', 'b', 'BÂT');
    const { affaire, nombre } = fusionnerProjet(a, b, '10203', 'BÂT');
    expect(affaire.categorie).toBe('BÂT');
    expect(nombre).toBe(3);
    expect(a.leves).toHaveLength(2);
    expect(a.leves[1].pastilles).toEqual(['BÂT']);
    expect(a.leves[0].pastilles).toBeUndefined();
    expect(() => fusionnerProjet(a, projetDe('9999', 'b'), '9999', 'NAT')).toThrow(/en commun/);
    expect(a.affaires).toHaveLength(1);
  });

  it('migration de la 0.344.0 : affaireId devient une pastille', () => {
    const p = projetDe('8114', 'a');
    p.affaires = [{ id: 'x', numero: '10203', categorie: 'BÂT' }, { id: 'y', numero: '5' }];
    p.plansDxf[0].affaireId = 'x';
    p.leves[0].affaireId = 'y';
    expect(migrerAffaires(p)).toBe(2);
    expect(p.plansDxf[0].pastilles).toEqual(['BÂT']);
    expect(p.plansDxf[0].affaireId).toBeUndefined();
    expect(p.leves[0].pastilles).toEqual(['Autres']);
  });
});

import { pastillesVisibles } from '../src/topo/affaires.js';
import { resumerProjet, completerProjet, creerProjet } from '../src/projet/projet.js';

describe('affaires : listes visibles et lignes d\'« Ouvrir » (0.351.0)', () => {
  it('une liste sans pastille se voit partout ; avec pastille, seulement dans son affaire', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203', 'BÂT');
    expect(pastillesVisibles(p, [], b.id)).toBe(true);
    expect(pastillesVisibles(p, ['GC'], b.id)).toBe(false);
    expect(pastillesVisibles(p, ['GC', 'BÂT'], b.id)).toBe(true);
    expect(pastillesVisibles(p, ['GC'], '')).toBe(true);
  });

  it('le résumé d\'un projet à plusieurs affaires ne dépend pas de l\'affaire choisie', () => {
    const p = completerProjet({ ...creerProjet(''), cartouche: { affaire: '8114', lieu: 'Paris' }, categoriePrincipale: 'GC', affaires: [{ id: 'b', numero: '10203', categorie: 'BÂT' }] });
    definirAffaire('b');
    const r = resumerProjet(p);
    definirAffaire('');
    expect(r.titre).toBe('8114 / 10203 - Paris');
    expect(r.lieu).toBe('Paris');
    expect(r.affaires.map((a) => a.numero)).toEqual(['8114', '10203']);
  });
});
