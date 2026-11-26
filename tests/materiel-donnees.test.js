import { describe, it, expect } from 'vitest';
import {
  parcVide, normaliserParc, normaliserNumeroChantier, cleNumero, cleNumeroDuProjet, chantierDuProjet, projetsSansChantier,
  lireDate, dateSuisse, lireMontant, montantSuisse, texteSurCouleur, ajouterCategorie, renommerCategorie, supprimerCategorie,
  deplacerCategorie, categoriesTriees, ajouterArticle, modifierArticle, supprimerArticle, deplacerArticle, articlesTries,
  champsDupliques, recolorerParc, valeurDuParc, filtrerArticles, ajouterChantier, modifierChantier, supprimerChantier,
  chantiersTries, responsables, nomsPourTablettes, PALETTE_MATERIEL,
} from '../src/materiel/donnees.js';

/** Petit parc d'essai : 2 catégories, 3 articles, 2 chantiers. */
function parcEssai() {
  const parc = parcVide();
  const gps = ajouterCategorie(parc, 'Canne GPS');
  const st = ajouterCategorie(parc, 'Station totale');
  ajouterArticle(parc, { numero: '953', categorieId: gps.id, designation: 'Canne RX2', codeCompta: '112', prixChf: '25000' });
  ajouterArticle(parc, { numero: '954', categorieId: gps.id, designation: 'Canne RX2', codeCompta: '112', prixChf: '25 000', statut: 'reparation' });
  ajouterArticle(parc, { numero: '811', categorieId: st.id, designation: 'Leica TS16', codeCompta: '104', prixChf: '40000', statut: 'reforme' });
  ajouterChantier(parc, { numero: '10203', nom: 'OFROU PAB', responsable: 'M. Dupont' });
  ajouterChantier(parc, { numero: '', nom: 'Dépôt', responsable: 'm. dupont' });
  return { parc, gps, st };
}

describe('n° de chantier', () => {
  it('écrit 5 ou 6 chiffres avec un espace avant les 3 derniers', () => {
    expect(normaliserNumeroChantier('10203')).toBe('10 203');
    expect(normaliserNumeroChantier(' 855325 ')).toBe('855 325');
    expect(normaliserNumeroChantier('GEO  MGO')).toBe('GEO MGO');
    expect(normaliserNumeroChantier('1234')).toBe('1234');
  });
  it('compare par les chiffres et lettres seulement', () => {
    expect(cleNumero('10 203')).toBe('10203');
    expect(cleNumero('10\'203')).toBe('10203');
    expect(cleNumero('geo-mgo')).toBe('GEOMGO');
  });
  it('lit le n° au début du nom du projet', () => {
    expect(cleNumeroDuProjet('10 203')).toBe('10203');
    expect(cleNumeroDuProjet('10203 Ofrou PAB')).toBe('10203');
    expect(cleNumeroDuProjet('10\'203 - PAB')).toBe('10203');
    expect(cleNumeroDuProjet('Affaire 10203')).toBe('');
    expect(cleNumeroDuProjet('')).toBe('');
  });
  it('relie un projet à son chantier et liste les projets sans chantier', () => {
    const { parc } = parcEssai();
    expect(chantierDuProjet(parc, '10203 OFROU').nom).toBe('OFROU PAB');
    expect(chantierDuProjet(parc, '10 204')).toBeNull();
    expect(projetsSansChantier(parc, ['10 203', '10 245 Gare', '10245', 'Essai'])).toEqual(['10 245 Gare']);
  });
});

describe('dates et montants', () => {
  it('lit les dates suisses et ISO', () => {
    expect(lireDate('31.10.2026')).toBe('2026-10-31');
    expect(lireDate('1.2.26')).toBe('2026-02-01');
    expect(lireDate('2026-11-22')).toBe('2026-11-22');
    expect(lireDate('')).toBe('');
    expect(() => lireDate('31.02.2026')).toThrow('n\'existe pas');
    expect(() => lireDate('demain')).toThrow('illisible');
    expect(dateSuisse('2026-10-31')).toBe('31.10.2026');
  });
  it('lit et écrit les montants en CHF', () => {
    expect(lireMontant('12\'500,5')).toBe(12500.5);
    expect(lireMontant('')).toBeNull();
    expect(() => lireMontant('-3')).toThrow();
    expect(montantSuisse(1234567.5)).toBe('1\'234\'567.50');
    expect(montantSuisse(null)).toBe('');
  });
  it('choisit un texte lisible sur la couleur', () => {
    expect(texteSurCouleur('#FFE08A')).toBe('#1d2733');
    expect(texteSurCouleur('#0a008f')).toBe('#ffffff');
  });
});

describe('catégories', () => {
  it('refuse un nom en double et une catégorie non vide', () => {
    const { parc, gps, st } = parcEssai();
    expect(() => ajouterCategorie(parc, 'canne gps')).toThrow('existe déjà');
    expect(() => renommerCategorie(parc, st.id, 'Canne GPS')).toThrow('existe déjà');
    expect(() => supprimerCategorie(parc, gps.id)).toThrow('contient des articles');
    const vide = ajouterCategorie(parc, 'Divers');
    supprimerCategorie(parc, vide.id);
    expect(parc.categories).toHaveLength(2);
  });
  it('change l\'ordre', () => {
    const { parc, st } = parcEssai();
    deplacerCategorie(parc, st.id, -1);
    expect(categoriesTriees(parc).map((c) => c.nom)).toEqual(['Station totale', 'Canne GPS']);
    expect(articlesTries(parc).map((a) => a.numero)).toEqual(['811', '953', '954']);
  });
});

describe('articles', () => {
  it('refuse un n° interne déjà pris (majuscules ignorées) ou une catégorie absente', () => {
    const { parc, gps } = parcEssai();
    expect(() => ajouterArticle(parc, { numero: '953', categorieId: gps.id })).toThrow('déjà pris');
    expect(() => ajouterArticle(parc, { numero: '', categorieId: gps.id })).toThrow('obligatoire');
    expect(() => ajouterArticle(parc, { numero: '999', categorieId: 'x' })).toThrow('catégorie');
    expect(() => ajouterArticle(parc, { numero: '999', categorieId: gps.id, dateAchat: '32.01.2026' })).toThrow('Date d\'achat');
  });
  it('lit les champs et propose une couleur de la palette', () => {
    const { parc } = parcEssai();
    const a = parc.articles[0];
    expect(a.prixChf).toBe(25000);
    expect(a.couleur).toBe(PALETTE_MATERIEL[0]);
    expect(parc.articles[1].couleur).toBe(PALETTE_MATERIEL[1]);
    expect(a.documents).toEqual([]);
  });
  it('garde le mot de passe Swipos quand le champ n\'est pas envoyé', () => {
    const { parc, gps } = parcEssai();
    const a = ajouterArticle(parc, { numero: '955', categorieId: gps.id, swiposMotDePasse: 'secret' });
    modifierArticle(parc, a.id, { numero: '955', categorieId: gps.id, designation: 'Canne' });
    expect(a.swiposMotDePasse).toBe('secret');
    modifierArticle(parc, a.id, { numero: '955', categorieId: gps.id, swiposMotDePasse: '' });
    expect(a.swiposMotDePasse).toBe('');
  });
  it('accessoires : un seul niveau, jamais soi-même', () => {
    const { parc, gps } = parcEssai();
    const [canne, autre] = parc.articles;
    const batterie = ajouterArticle(parc, { numero: 'B1', categorieId: gps.id, parentId: canne.id });
    expect(() => ajouterArticle(parc, { numero: 'B2', categorieId: gps.id, parentId: batterie.id })).toThrow('un seul niveau');
    expect(() => modifierArticle(parc, canne.id, { numero: '953', categorieId: gps.id, parentId: canne.id })).toThrow('propre accessoire');
    expect(() => modifierArticle(parc, canne.id, { numero: '953', categorieId: gps.id, parentId: autre.id })).toThrow('a des accessoires');
    supprimerArticle(parc, canne.id);
    expect(batterie.parentId).toBeNull();
  });
  it('change de catégorie : à la fin de la nouvelle', () => {
    const { parc, st } = parcEssai();
    const a = parc.articles[0];
    modifierArticle(parc, a.id, { numero: '953', categorieId: st.id });
    expect(articlesTries(parc).map((x) => x.numero)).toEqual(['954', '811', '953']);
  });
  it('déplace dans sa catégorie seulement', () => {
    const { parc } = parcEssai();
    deplacerArticle(parc, parc.articles[1].id, -1);
    expect(articlesTries(parc).map((x) => x.numero)).toEqual(['954', '953', '811']);
    deplacerArticle(parc, parc.articles[2].id, -1); // seul dans sa catégorie : ne bouge pas
    expect(articlesTries(parc).map((x) => x.numero)).toEqual(['954', '953', '811']);
  });
  it('refuse de supprimer un article qui a des affectations et rend les fichiers à effacer', () => {
    const { parc } = parcEssai();
    const a = parc.articles[0];
    a.photo = 'f1';
    a.documents = [{ id: 'f2', nom: 'facture.pdf' }];
    parc.affectations.push({ id: 'af', articleId: a.id, chantierId: 'c' });
    expect(() => supprimerArticle(parc, a.id)).toThrow('Réformé');
    parc.affectations = [];
    expect(supprimerArticle(parc, a.id)).toEqual(['f1', 'f2']);
  });
  it('duplique sans n°, photo, documents ni mot de passe', () => {
    const { parc } = parcEssai();
    const copie = champsDupliques({ ...parc.articles[0], swiposMotDePasse: 'x', photo: 'p' });
    expect(copie.numero).toBe('');
    expect(copie.swiposMotDePasse).toBe('');
    expect(copie.photo).toBeUndefined();
    expect(copie.designation).toBe('Canne RX2');
  });
  it('recolore dans l\'ordre du planning', () => {
    const { parc } = parcEssai();
    recolorerParc(parc);
    expect(articlesTries(parc).map((a) => a.couleur)).toEqual(PALETTE_MATERIEL.slice(0, 3));
  });
  it('valeur du parc : actifs et en réparation seulement', () => {
    const { parc } = parcEssai();
    expect(valeurDuParc(parc)).toBe(50000);
  });
  it('filtre par texte, catégorie et statut', () => {
    const { parc, gps } = parcEssai();
    expect(filtrerArticles(parc, { texte: 'leica' }).map((a) => a.numero)).toEqual(['811']);
    expect(filtrerArticles(parc, { texte: 'canne 112' }).map((a) => a.numero)).toEqual(['953', '954']);
    expect(filtrerArticles(parc, { categorieId: gps.id, statut: 'reparation' }).map((a) => a.numero)).toEqual(['954']);
  });
});

describe('chantiers', () => {
  it('même n° écrit autrement = même chantier ; sans n° : nom unique', () => {
    const { parc } = parcEssai();
    expect(() => ajouterChantier(parc, { numero: '10 203', nom: 'Autre' })).toThrow('existe déjà');
    expect(() => ajouterChantier(parc, { numero: '', nom: 'dépôt' })).toThrow('sans numéro');
    expect(() => ajouterChantier(parc, { numero: '1', nom: '' })).toThrow('obligatoire');
    const c = ajouterChantier(parc, { numero: '855325', nom: 'Route', facturable: false });
    expect(c.numero).toBe('855 325');
    expect(c.facturable).toBe(false);
    modifierChantier(parc, c.id, { numero: '855 325', nom: 'Route cantonale', archive: true });
    expect(c.archive).toBe(true);
  });
  it('refuse de supprimer un chantier qui a des affectations', () => {
    const { parc } = parcEssai();
    const c = parc.chantiers[0];
    parc.affectations.push({ id: 'af', articleId: 'a', chantierId: c.id });
    expect(() => supprimerChantier(parc, c.id)).toThrow('archivez');
  });
  it('trie : actifs, avec n°, puis par n°', () => {
    const { parc } = parcEssai();
    ajouterChantier(parc, { numero: '10198', nom: 'Route', archive: true });
    ajouterChantier(parc, { numero: '9 100', nom: 'Vieux' });
    expect(chantiersTries(parc).map((c) => c.nom)).toEqual(['Vieux', 'OFROU PAB', 'Dépôt', 'Route']);
  });
  it('responsables sans doublon', () => {
    const { parc } = parcEssai();
    ajouterChantier(parc, { numero: '1', nom: 'A', responsable: 'Mme Martin' });
    expect(responsables(parc)).toEqual(['M. Dupont', 'Mme Martin']);
  });
});

describe('parc lu et listes des tablettes', () => {
  it('un parc illisible devient un parc vide', () => {
    expect(normaliserParc(null)).toEqual(parcVide());
    expect(normaliserParc({ articles: [{ id: 'a' }, null], categories: 'x' }).articles[0].documents).toEqual([]);
  });
  it('les tablettes ne voient ni prix ni mot de passe, ni les articles réformés', () => {
    const { parc } = parcEssai();
    parc.articles[0].swiposMotDePasse = 'secret';
    const noms = nomsPourTablettes(parc);
    expect(noms.articles).toEqual([
      { numero: '953', designation: 'Canne RX2 - 953', categorie: 'Canne GPS' },
      { numero: '954', designation: 'Canne RX2 - 954', categorie: 'Canne GPS' },
    ]);
    expect(JSON.stringify(noms)).not.toContain('secret');
    expect(noms.responsables).toEqual(['M. Dupont']);
  });
});

describe('copie Drive du parc', async () => {
  const { choixSynchro, lireEtatDrive, ecrireEtatDrive } = await import('../src/materiel/stockage.js');
  it('choisit envoyer / prendre / conflit / rien', () => {
    expect(choixSynchro(null, { vu: null, aEnvoyer: false })).toBe('rien');
    expect(choixSynchro(null, { vu: null, aEnvoyer: true })).toBe('envoyer');
    expect(choixSynchro('d1', { vu: 'd1', aEnvoyer: true })).toBe('envoyer');
    expect(choixSynchro('d1', { vu: 'd1', aEnvoyer: false })).toBe('rien');
    expect(choixSynchro('d2', { vu: 'd1', aEnvoyer: false })).toBe('prendre');
    expect(choixSynchro('d2', { vu: null, aEnvoyer: false })).toBe('prendre');
    expect(choixSynchro('d2', { vu: 'd1', aEnvoyer: true })).toBe('conflit');
  });
  it('garde l\'état sur l\'appareil', () => {
    const memoire = new Map();
    const stockage = { getItem: (c) => memoire.get(c) ?? null, setItem: (c, v) => memoire.set(c, v) };
    expect(lireEtatDrive(stockage)).toEqual({ vu: null, aEnvoyer: false });
    ecrireEtatDrive({ vu: 'd1', aEnvoyer: true }, stockage);
    expect(lireEtatDrive(stockage)).toEqual({ vu: 'd1', aEnvoyer: true });
  });
});

describe('désignation en 3 champs (0.324.0)', () => {
  it('Marque - Modèle - Autre - N° interne, parties vides sautées', async () => {
    const { designationArticle } = await import('../src/materiel/donnees.js');
    expect(designationArticle({ marque: 'Emlid', modele: 'Reach RX2', autre: 'Canne GPS', numero: '953' })).toBe('Emlid - Reach RX2 - Canne GPS - 953');
    expect(designationArticle({ marque: 'Leica', modele: '', autre: '', numero: 'Icon 1' })).toBe('Leica - Icon 1');
  });
  it('ancien parc : la désignation libre devient « Autre » ; marques et modèles proposés', async () => {
    const { normaliserParc, marquesDuParc, modelesDuParc } = await import('../src/materiel/donnees.js');
    const parc = normaliserParc({ articles: [
      { id: 'a', numero: '953', designation: 'Canne RX2', marque: 'Emlid', modele: 'RX2' },
      { id: 'b', numero: '1', designation: '', marque: 'leica', modele: 'iCON' },
      { id: 'c', numero: '2', designation: '', marque: 'Hilti', modele: 'PLT400' },
    ] });
    expect(parc.articles[0].autre).toBe('Canne RX2');
    expect(parc.articles[0].designation).toBe('Emlid - RX2 - Canne RX2 - 953');
    expect(marquesDuParc(parc)).toEqual(['Emlid', 'Hilti', 'leica']);
    expect(modelesDuParc(parc, 'Hilti')[0]).toBe('PLT400');
  });
});
