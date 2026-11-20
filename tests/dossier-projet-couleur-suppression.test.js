import { describe, it, expect } from 'vitest';
import { ajouterSousDossierProjet, changerCouleurSousDossierProjet, retirerSousDossierProjet, estDossierDuProjet, lireSousDossiers } from '../src/topo/sous-dossiers.js';

const listes = { sousDossiers: [] };
const nouveau = () => ({ leves: [{ id: 'l1', sousDossiers: ['TER.'] }, { id: 'l2' }], surfaces: [], plansDxf: [] });
// Le dossier est créé d'abord, puis on y range deux listes.
const rempli = () => {
  const p = nouveau();
  ajouterSousDossierProjet(p, 'Mon dossier', '#112233');
  p.leves[0].sousDossiers.push('Mon dossier');
  p.leves[1].sousDossiers = ['Mon dossier'];
  return p;
};

describe('dossier réservé au projet : couleur et suppression', () => {
  it('garde la couleur choisie à la création', () => {
    const p = nouveau();
    expect(ajouterSousDossierProjet(p, 'Mon dossier', '#112233')).toBe('Mon dossier');
    expect(lireSousDossiers(p, listes).find((d) => d.nom === 'Mon dossier').couleur).toBe('#112233');
  });
  it('change la couleur seulement d\'un dossier du projet, et seulement avec une vraie couleur', () => {
    const p = nouveau();
    ajouterSousDossierProjet(p, 'Mon dossier');
    expect(changerCouleurSousDossierProjet(p, 'Mon dossier', '#abcdef')).toBe(true);
    expect(changerCouleurSousDossierProjet(p, 'Mon dossier', 'rouge')).toBe(false);
    expect(changerCouleurSousDossierProjet(p, 'TER.', '#abcdef')).toBe(false);
  });
  it('supprime le dossier : les éléments restent, sans ce dossier', () => {
    const p = rempli();
    expect(retirerSousDossierProjet(p, 'Mon dossier')).toBe(2);
    expect(estDossierDuProjet(p, 'Mon dossier')).toBe(false);
    expect(p.leves[0].sousDossiers).toEqual(['TER.']);
    expect(p.leves[1].sousDossiers).toBeUndefined();
    expect(p.couleursDossiers).toEqual({});
    expect(lireSousDossiers(p, listes).some((d) => d.nom === 'Mon dossier')).toBe(false);
  });
  it('refuse de supprimer un dossier de départ', () => {
    expect(retirerSousDossierProjet(nouveau(), 'TER.')).toBe(-1);
  });
});
