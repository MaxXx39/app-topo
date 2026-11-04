import { describe, it, expect } from 'vitest';
import { nettoyerDossiers, regrouperParDossier, ajouterDossier, renommerDossier, supprimerDossier, rangerProjet, dossierDuProjet, SANS_DOSSIER } from '../src/projet/dossiers.js';

const base = () => nettoyerDossiers({ liste: [{ id: 'g', nom: 'Germain' }, { id: 'm', nom: 'Maxime' }], projets: { p1: 'm', p2: 'g', p9: 'x' } });

describe('dossiers de projets', () => {
  it('nettoie : pas de nom vide, pas de doublon, rangement vers un dossier inconnu oublié', () => {
    const d = nettoyerDossiers({ liste: [{ id: 'a', nom: 'Maxime' }, { id: 'b', nom: ' maxime ' }, { id: 'c', nom: '' }], projets: { p1: 'a', p2: 'b' } });
    expect(d.liste).toEqual([{ id: 'a', nom: 'Maxime' }]);
    expect(d.projets).toEqual({ p1: 'a' });
    expect(base().projets).toEqual({ p1: 'm', p2: 'g' });
  });

  it('regroupe : dossiers de A à Z (vides compris), puis Sans dossier', () => {
    const d = ajouterDossier(base(), 'Annexe', 'a').dossiers;
    const groupes = regrouperParDossier([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], d);
    expect(groupes.map((g) => [g.nom, g.projets.map((p) => p.id)])).toEqual([
      ['Annexe', []],
      ['Germain', ['p2']],
      ['Maxime', ['p1']],
      ['Sans dossier', ['p3']],
    ]);
  });

  it('pas de groupe « Sans dossier » vide', () => {
    expect(regrouperParDossier([{ id: 'p1' }], base()).map((g) => g.nom)).toEqual(['Germain', 'Maxime']);
  });

  it('ajouter et renommer refusent un nom vide ou déjà pris', () => {
    expect(ajouterDossier(base(), '  ').erreur).toBeTruthy();
    expect(ajouterDossier(base(), 'maxime').erreur).toMatch(/existe déjà/);
    expect(renommerDossier(base(), 'g', 'Maxime').erreur).toMatch(/existe déjà/);
    expect(renommerDossier(base(), 'g', 'Germain P.').dossiers.liste.find((d) => d.id === 'g').nom).toBe('Germain P.');
  });

  it('supprimer : refusé tant que le dossier contient un projet existant', () => {
    expect(supprimerDossier(base(), 'm', ['p1', 'p2']).erreur).toMatch(/1 projet/);
    // p1 n'existe plus nulle part : le dossier peut partir
    const { dossiers } = supprimerDossier(base(), 'm', ['p2']);
    expect(dossiers.liste.map((d) => d.id)).toEqual(['g']);
    expect(dossiers.projets).toEqual({ p2: 'g' });
  });

  it('ranger et sortir un projet', () => {
    let d = rangerProjet(base(), 'p3', 'g');
    expect(dossierDuProjet(d, 'p3')).toBe('g');
    d = rangerProjet(d, 'p3', SANS_DOSSIER);
    expect(dossierDuProjet(d, 'p3')).toBe(SANS_DOSSIER);
    expect(dossierDuProjet(rangerProjet(d, 'p3', 'inconnu'), 'p3')).toBe(SANS_DOSSIER);
  });
});
