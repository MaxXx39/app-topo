// Tests des projets (création, levés, fichier projet).
import { describe, it, expect } from 'vitest';
import {
  creerProjet,
  ajouterLeve,
  leveActif,
  dupliquerProjet,
  ecrireFichierProjet,
  lireFichierProjet,
  resumerProjet,
} from '../src/projet/projet.js';
import { creerSurface } from '../src/topo/surface.js';

const point = (nom) => ({ nom, est: 2499349.955, nord: 1124567.41, altitude: 427.654 });

describe('projets', () => {
  it('ajoute des levés et garde le dernier comme levé actif', () => {
    const projet = creerProjet('10 203');
    ajouterLeve(projet, 'leve-mai.csv', [point('b1')]);
    const juin = ajouterLeve(projet, 'leve-juin.csv', [point('p1')]);
    expect(projet.leves).toHaveLength(2);
    expect(leveActif(projet)).toBe(juin);
  });

  it('le fichier projet se relit à l\'identique (points, surfaces)', () => {
    const projet = creerProjet('10 203');
    const leve = ajouterLeve(projet, 'stock.csv', [point('b1')]);
    projet.surfaces.push(creerSurface('Stock 1', leve.id));
    const { projet: relu, erreur } = lireFichierProjet(ecrireFichierProjet(projet));
    expect(erreur).toBeUndefined();
    expect(relu).toEqual(projet);
  });

  it('refuse un fichier qui n\'est pas un projet', () => {
    expect(lireFichierProjet('pas du json').erreur).toContain('illisible');
    expect(lireFichierProjet('{"a":1}').erreur).toContain('pas un fichier projet');
  });

  it('complète un fichier projet ancien ou incomplet', () => {
    const { projet } = lireFichierProjet('{"format":"topo-projet","version":1,"id":"x","nom":"Vieux","leves":[{"id":"l","nom":"a.csv","points":[]}]}');
    expect(projet.surfaces).toEqual([]);
    expect(projet.cartouche).toEqual({ affaire: '', dessinePar: '' });
  });

  it('duplique un projet avec un nouvel identifiant', () => {
    const projet = creerProjet('A');
    ajouterLeve(projet, 'a.csv', [point('b1')]);
    const copie = dupliquerProjet(projet, 'A (copie)');
    expect(copie.id).not.toBe(projet.id);
    expect(copie.leves).toEqual(projet.leves);
    copie.leves[0].points.push(point('b2'));
    expect(projet.leves[0].points).toHaveLength(1); // l'original n'est pas touché
  });

  it('résume un projet pour la liste', () => {
    const projet = creerProjet('A');
    projet.surfaces.push(creerSurface('S', ajouterLeve(projet, 'a.csv', []).id));
    expect(resumerProjet(projet)).toMatchObject({ nom: 'A', nombreLeves: 1, nombreSurfaces: 1 });
  });

  it('donne une base de volume aux surfaces d\'un ancien fichier', () => {
    const { projet } = lireFichierProjet(
      '{"format":"topo-projet","version":1,"id":"x","nom":"V","leves":[],"surfaces":[{"id":"s","nom":"S","type":"points","contour":[]},{"id":"t","nom":"T","type":"landxml"}]}',
    );
    expect(projet.surfaces[0].volume).toEqual({ base: 'contour', surfaceId: null });
    expect(projet.surfaces[1].volume).toEqual({ base: 'aucune', surfaceId: null });
  });
});
