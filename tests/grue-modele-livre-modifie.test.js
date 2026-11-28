import { describe, it, expect, afterEach } from 'vitest';
import { tousLesModeles, definirModelesPerso, modeleDe, estModeleGenerique, modeleLivre, MODELES_DE_BASE } from '../src/topo/grue-modele.js';

afterEach(() => definirModelesPerso([]));

describe('modèle de grue livré modifié (0.355.0)', () => {
  it('la version du projet (même id, base) remplace le modèle livré', () => {
    const livre = MODELES_DE_BASE[0];
    const modifie = { ...JSON.parse(JSON.stringify(livre)), nom: 'Liebherr modifiée', base: true };
    delete modifie.integre;
    definirModelesPerso([modifie]);
    expect(tousLesModeles()).toHaveLength(MODELES_DE_BASE.length);
    expect(modeleDe(livre.id).nom).toBe('Liebherr modifiée');
    expect(estModeleGenerique(modeleDe(livre.id))).toBe(false);
    expect(modeleLivre(livre.id).nom).toBe(livre.nom);
  });
  it('un modèle créé par l\'utilisateur est générique', () => {
    definirModelesPerso([{ id: 'grue-x', nom: 'Ma grue' }]);
    expect(tousLesModeles()).toHaveLength(MODELES_DE_BASE.length + 1);
    expect(estModeleGenerique(modeleDe('grue-x'))).toBe(true);
    expect(estModeleGenerique(MODELES_DE_BASE[0])).toBe(false);
  });
});

describe('dessin d\'une grue créée par l\'utilisateur (0.355.0)', () => {
  it('grue à tour : une cabine est dessinée même sans dimensions de cabine', async () => {
    const { grueFiche } = await import('../src/topo/grue-fiche.js');
    const { modeleVide } = await import('../src/topo/grue-modele.js');
    const m = { ...modeleVide('Ma tour'), id: 'grue-tour-test' };
    definirModelesPerso([m]);
    const s = JSON.stringify(grueFiche({ modeleGrue: m.id, fleche: 40 }));
    expect(s).toContain('vitre');
  });
  it('automontante : pas de contre-flèche', async () => {
    const { grueFiche } = await import('../src/topo/grue-fiche.js');
    const { modeleVide } = await import('../src/topo/grue-modele.js');
    const tour = { ...modeleVide('Ma tour'), id: 'grue-a' };
    const auto = { ...modeleVide('Mon auto'), id: 'grue-b', type: 'automontante' };
    definirModelesPerso([tour, auto]);
    const { bornesPrimitives } = await import('../src/topo/blocs-dxf.js');
    const bornesX = (id) => bornesPrimitives(grueFiche({ modeleGrue: id, fleche: 40 }).primitives.filter((p) => p.g !== 't')).xMin;
    expect(bornesX('grue-a')).toBeLessThan(-5); // contre-flèche de 10 m derrière
    expect(bornesX('grue-b')).toBeGreaterThan(-5);
  });
});
