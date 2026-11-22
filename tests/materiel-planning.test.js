import { describe, it, expect } from 'vitest';
import { parcVide, ajouterCategorie, ajouterArticle, ajouterChantier, supprimerArticle } from '../src/materiel/donnees.js';
import {
  ajouterJours, nombreDeJours, jourSemaine, joursDuMois, moisVoisin, bornesDuMois, chevauchements, affectationDuJour,
  historiqueArticle, affectationsFinissantLe, finsProches, poserAffectation, supprimerAffectation, rendreAuDepot,
  couperAffectation, prolongerAffectations, remettreAffectations, donneesDuMois, responsableDe, nomFichierMois,
  ErreurChevauchement, aujourdhui,
} from '../src/materiel/planning.js';

/** Parc d'essai : 2 cannes, 1 station, 2 chantiers. */
function essai() {
  const parc = parcVide();
  const gps = ajouterCategorie(parc, 'Canne GPS');
  const st = ajouterCategorie(parc, 'Station totale');
  const a953 = ajouterArticle(parc, { numero: '953', categorieId: gps.id });
  const a954 = ajouterArticle(parc, { numero: '954', categorieId: gps.id });
  const a811 = ajouterArticle(parc, { numero: '811', categorieId: st.id, statut: 'reforme' });
  const pab = ajouterChantier(parc, { numero: '10203', nom: 'OFROU PAB', responsable: 'M. Dupont' });
  const nyon = ajouterChantier(parc, { numero: '10245', nom: 'Gare Nyon' });
  const poser = (article, chantier, debut, fin, mode = null) => poserAffectation(parc, { articleId: article.id, chantierId: chantier.id, debut, fin }, null, mode);
  return { parc, a953, a954, a811, pab, nyon, poser };
}
const periodes = (parc, article) => historiqueArticle(parc, article.id).map((af) => `${af.debut}/${af.fin}`).reverse();

describe('dates', () => {
  it('compte les jours sans être gêné par l\'heure d\'été', () => {
    expect(ajouterJours('2026-03-28', 2)).toBe('2026-03-30');
    expect(ajouterJours('2026-11-01', -1)).toBe('2026-10-31');
    expect(nombreDeJours('2026-10-19', '2026-11-13')).toBe(26);
    expect(nombreDeJours('2026-11-02', '2026-11-02')).toBe(1);
    expect(jourSemaine('2026-11-23')).toBe(0); // lundi
    expect(jourSemaine('2026-11-22')).toBe(6); // dimanche
    expect(joursDuMois(2028, 2)).toBe(29);
    expect(moisVoisin(2026, 1, -1)).toEqual({ annee: 2025, mois: 12 });
    expect(bornesDuMois(2026, 11)).toEqual({ debut: '2026-11-01', fin: '2026-11-30' });
    expect(aujourdhui(new Date(2026, 10, 22, 23, 30))).toBe('2026-11-22');
  });
});

describe('poser une affectation', () => {
  it('contrôle les champs', () => {
    const { parc, a953, pab } = essai();
    expect(() => poserAffectation(parc, { articleId: 'x', chantierId: pab.id, debut: '1.11.26', fin: '2.11.26' })).toThrow('article');
    expect(() => poserAffectation(parc, { articleId: a953.id, chantierId: 'x', debut: '1.11.26', fin: '2.11.26' })).toThrow('chantier');
    expect(() => poserAffectation(parc, { articleId: a953.id, chantierId: pab.id, debut: '5.11.26', fin: '2.11.26' })).toThrow('après');
    expect(() => poserAffectation(parc, { articleId: a953.id, chantierId: pab.id, debut: '', fin: '2.11.26' })).toThrow('obligatoires');
    const af = poserAffectation(parc, { articleId: a953.id, chantierId: pab.id, debut: '02.11.2026', fin: '13.11.2026', responsable: ' Mme Martin ' });
    expect(af).toMatchObject({ debut: '2026-11-02', fin: '2026-11-13', responsable: 'Mme Martin' });
  });
  it('chevauchement : refusé sans choix, puis couper ou remplacer', () => {
    const { parc, a953, a954, pab, nyon, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-20');
    poser(a954, pab, '2026-11-02', '2026-11-20');
    let erreur = null;
    try {
      poser(a953, nyon, '2026-11-10', '2026-11-12');
    } catch (e) {
      erreur = e;
    }
    expect(erreur).toBeInstanceOf(ErreurChevauchement);
    expect(erreur.conflits).toHaveLength(1);
    expect(parc.affectations).toHaveLength(2); // rien n'a changé
    poser(a953, nyon, '2026-11-10', '2026-11-12', 'couper');
    expect(periodes(parc, a953)).toEqual(['2026-11-02/2026-11-09', '2026-11-10/2026-11-12', '2026-11-13/2026-11-20']);
    poser(a954, nyon, '2026-11-10', '2026-11-12', 'remplacer');
    expect(periodes(parc, a954)).toEqual(['2026-11-10/2026-11-12']);
  });
  it('déplacer une affectation sur elle-même n\'est pas un chevauchement', () => {
    const { parc, a953, pab, poser } = essai();
    const af = poser(a953, pab, '2026-11-02', '2026-11-06');
    poserAffectation(parc, { ...af, debut: '2026-11-04', fin: '2026-11-08' }, af.id);
    expect(periodes(parc, a953)).toEqual(['2026-11-04/2026-11-08']);
  });
});

describe('rendre, couper, changer de chantier, prolonger', () => {
  it('rendre au dépôt', () => {
    const { parc, a953, pab, poser } = essai();
    const af = poser(a953, pab, '2026-11-02', '2026-11-20');
    expect(() => rendreAuDepot(parc, af.id, '01.11.2026')).toThrow('avant le début');
    expect(() => rendreAuDepot(parc, af.id, '20.11.2026')).toThrow('déjà');
    rendreAuDepot(parc, af.id, '10.11.2026');
    expect(af.fin).toBe('2026-11-10');
    expect(affectationDuJour(parc, a953.id, '2026-11-11')).toBeNull();
  });
  it('couper en deux et changer de chantier à partir d\'un jour', () => {
    const { parc, a953, pab, nyon, poser } = essai();
    const af = poser(a953, pab, '2026-11-02', '2026-11-20');
    expect(() => couperAffectation(parc, af.id, '02.11.2026')).toThrow('après le premier jour');
    const seul = poser(a953, pab, '2026-11-25', '2026-11-25');
    expect(() => couperAffectation(parc, seul.id, '25.11.2026')).toThrow('un seul jour');
    const suite = couperAffectation(parc, af.id, '10.11.2026', { chantierId: nyon.id, responsable: 'Mme Martin' });
    expect(af.fin).toBe('2026-11-09');
    expect(suite).toMatchObject({ debut: '2026-11-10', fin: '2026-11-20', chantierId: nyon.id, responsable: 'Mme Martin' });
    const moitie = couperAffectation(parc, suite.id, '15.11.2026');
    expect(moitie.chantierId).toBe(nyon.id);
    expect(moitie.responsable).toBe('Mme Martin');
  });
  it('prolonger s\'arrête la veille de l\'affectation suivante', () => {
    const { parc, a953, a954, pab, nyon, poser } = essai();
    const x = poser(a953, pab, '2026-10-19', '2026-10-31');
    poser(a953, nyon, '2026-11-12', '2026-11-20');
    const y = poser(a954, pab, '2026-10-01', '2026-10-31');
    const z = poser(a954, pab, '2026-12-01', '2026-12-02');
    expect(affectationsFinissantLe(parc, '2026-10-31').map((af) => af.id)).toEqual([x.id, y.id]);
    const r = prolongerAffectations(parc, [x.id, y.id, z.id], '30.11.2026');
    expect(r).toEqual({ prolongees: 2, raccourcies: ['953 (jusqu\'au 11.11)'], ignorees: 1 });
    expect(x.fin).toBe('2026-11-11');
    expect(y.fin).toBe('2026-11-30');
  });
  it('responsable : le sien, sinon celui du chantier', () => {
    const { parc, a953, pab, poser } = essai();
    const af = poser(a953, pab, '2026-11-02', '2026-11-03');
    expect(responsableDe(parc, af)).toBe('M. Dupont');
    af.responsable = 'Mme Martin';
    expect(responsableDe(parc, af)).toBe('Mme Martin');
  });
  it('fins proches (7 jours)', () => {
    const { parc, a953, a954, pab, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-25');
    poser(a954, pab, '2026-11-02', '2026-12-25');
    expect(finsProches(parc, '2026-11-22').map((af) => af.articleId)).toEqual([a953.id]);
  });
});

describe('annuler', () => {
  it('remet la copie, sauf si un article a disparu', () => {
    const { parc, a953, a954, pab, poser } = essai();
    const copie = parc.affectations.map((af) => ({ ...af }));
    const af = poser(a953, pab, '2026-11-02', '2026-11-03');
    remettreAffectations(parc, copie);
    expect(parc.affectations).toEqual([]);
    poser(a954, pab, '2026-11-02', '2026-11-03');
    const copie2 = parc.affectations.map((x) => ({ ...x }));
    supprimerAffectation(parc, parc.affectations[0].id);
    supprimerArticle(parc, a954.id);
    expect(() => remettreAffectations(parc, copie2)).toThrow('supprimé');
    expect(af.id).toBeTruthy();
  });
});

describe('données du mois', () => {
  it('barres coupées au mois, triangles, jours, articles inactifs affectés gardés', () => {
    const { parc, a953, a954, a811, pab, nyon, poser } = essai();
    poser(a953, pab, '2026-10-19', '2026-11-13');
    poser(a953, nyon, '2026-11-25', '2026-12-04');
    poser(a811, pab, '2026-11-05', '2026-11-06');
    const d = donneesDuMois(parc, 2026, 11);
    expect(d.n).toBe(30);
    expect(d.jours[0]).toEqual({ j: 1, iso: '2026-11-01', semaine: 6 });
    expect(d.groupes.map((g) => g.articles.map((x) => x.article.numero))).toEqual([['953', '954'], ['811']]);
    const [b1, b2] = d.groupes[0].articles[0].barres;
    expect(b1).toMatchObject({ j1: 1, j2: 13, avant: true, apres: false, principal: '10 203 – OFROU PAB', responsable: 'M. Dupont', nbJours: 13 });
    expect(b2).toMatchObject({ j1: 25, j2: 30, avant: false, apres: true, nbJours: 6 });
    // Un article réformé sans affectation ce mois-là n'apparaît pas (sauf « inactifs »).
    expect(donneesDuMois(parc, 2026, 10).groupes).toHaveLength(1);
    expect(donneesDuMois(parc, 2026, 10, { inactifs: true }).groupes).toHaveLength(2);
    expect(a954.statut).toBe('actif');
  });
  it('avec la veille : le dernier jour du mois d\'avant est le jour 0', () => {
    const { parc, a953, pab, poser } = essai();
    poser(a953, pab, '2026-10-19', '2026-10-31');
    const d = donneesDuMois(parc, 2026, 11, { avecVeille: true });
    expect(d.jours[0]).toMatchObject({ j: 0, iso: '2026-10-31' });
    expect(d.groupes[0].articles[0].barres[0]).toMatchObject({ j1: 0, j2: 0, avant: true, apres: false });
  });
  it('nom des fichiers pour la compta', () => {
    expect(nomFichierMois(2026, 3, 'pdf')).toBe('2026_03.pdf');
  });
  it('chevauchements trouvés dans l\'ordre', () => {
    const { parc, a953, pab, nyon, poser } = essai();
    poser(a953, nyon, '2026-11-10', '2026-11-12');
    poser(a953, pab, '2026-11-02', '2026-11-05');
    expect(chevauchements(parc, a953.id, '2026-11-01', '2026-11-30').map((af) => af.debut)).toEqual(['2026-11-02', '2026-11-10']);
  });
});
