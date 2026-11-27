import { describe, it, expect, beforeEach } from 'vitest';
import { affairesDe, ajouterAffaire, renommerAffaire, retirerAffaire, affaireDe, dansAffaire, definirAffaire, numeroAffaireActif, cartoucheActif, deplacerVersAffaire, rangerNouveauxDansAffaire, fusionnerProjet, PRINCIPALE } from '../src/topo/affaires.js';

const projetDe = (affaire, id) => ({ cartouche: { affaire, lieu: 'Gland' }, nom: '', leves: [{ id: `${id}-l1`, nom: 'LV-1', points: [] }], surfaces: [{ id: `${id}-s1`, leveId: `${id}-l1` }], plansDxf: [{ id: `${id}-p1` }] });

describe('affaires d\'un projet', () => {
  beforeEach(() => definirAffaire(''));

  it('la principale est celle du cartouche, les autres s\'ajoutent sans doublon', () => {
    const p = projetDe('8114', 'a');
    expect(affairesDe(p).map((a) => a.numero)).toEqual(['8114']);
    const b = ajouterAffaire(p, '10203');
    expect(affairesDe(p)).toHaveLength(2);
    expect(() => ajouterAffaire(p, '10203')).toThrow(/existe déjà/);
    expect(() => ajouterAffaire(p, '8114')).toThrow(/existe déjà/);
    expect(renommerAffaire(p, b.id, '10 204')).toBe(true);
    renommerAffaire(p, PRINCIPALE, '8 115');
    expect(p.cartouche.affaire).toBe('8 115');
  });

  it('un élément sans affaire est dans la principale ; une surface suit son levé', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203');
    expect(affaireDe(p, p.plansDxf[0], 'plan')).toBe(PRINCIPALE);
    deplacerVersAffaire(p, 'a-l1', b.id);
    expect(affaireDe(p, p.surfaces[0], 'surface')).toBe(b.id);
    expect(deplacerVersAffaire(p, 'a-l1', PRINCIPALE)).toBe(true);
    expect(p.leves[0].affaireId).toBeUndefined();
    expect(deplacerVersAffaire(p, 'inconnu', b.id)).toBe(false);
  });

  it('le filtre : Toutes montre tout, une affaire montre la sienne', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203');
    p.plansDxf[0].affaireId = b.id;
    expect(dansAffaire(p, p.plansDxf[0], 'plan', '')).toBe(true);
    expect(dansAffaire(p, p.plansDxf[0], 'plan', PRINCIPALE)).toBe(false);
    expect(dansAffaire(p, p.plansDxf[0], 'plan', b.id)).toBe(true);
  });

  it('numéro et cartouche suivent l\'affaire choisie', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203');
    expect(numeroAffaireActif(p, '')).toBe('8114');
    expect(cartoucheActif(p, b.id).affaire).toBe('10203');
    expect(cartoucheActif(p, b.id).lieu).toBe('Gland');
  });

  it('un nouvel élément reçoit l\'affaire choisie', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203');
    const connus = new Set(['a-l1', 'a-s1', 'a-p1']);
    p.plansDxf.push({ id: 'neuf' });
    expect(rangerNouveauxDansAffaire(p, connus, b.id)).toBe(1);
    expect(p.plansDxf[1].affaireId).toBe(b.id);
  });

  it('on ne retire qu\'une affaire vide', () => {
    const p = projetDe('8114', 'a');
    const b = ajouterAffaire(p, '10203');
    p.plansDxf[0].affaireId = b.id;
    expect(retirerAffaire(p, b.id)).toMatch(/contient encore/);
    p.plansDxf[0].affaireId = undefined;
    expect(retirerAffaire(p, b.id)).toBeNull();
    expect(retirerAffaire(p, PRINCIPALE)).toMatch(/principale/);
  });

  it('fusionner : le projet devient une affaire, rien ne se perd, pas de fusion d\'une copie', () => {
    const a = projetDe('8114', 'a');
    const b = projetDe('10203', 'b');
    const { affaire, nombre } = fusionnerProjet(a, b);
    expect(affaire.numero).toBe('10203');
    expect(nombre).toBe(3);
    expect(a.leves).toHaveLength(2);
    expect(a.leves[1].affaireId).toBe(affaire.id);
    expect(a.leves[0].affaireId).toBeUndefined();
    expect(() => fusionnerProjet(a, projetDe('9999', 'b'))).toThrow(/en commun/);
    expect(a.affaires).toHaveLength(1);
  });
});
