import { describe, it, expect } from 'vitest';
import { ligneDecalee, rangerLigneDecalee, NOM_LEVE_DECALAGES } from '../src/topo/ligne-decalee.js';
import { creerProjet } from '../src/projet/projet.js';

describe('ligneDecalee', () => {
  const droite = [{ est: 0, nord: 0, altitude: 10 }, { est: 10, nord: 0, altitude: 11 }];
  it('vers l\'est : droite = vers le sud, Z ajouté', () => {
    const r = ligneDecalee(droite, 2, 0.5);
    expect(r.fermee).toBe(false);
    expect(r.sommets).toEqual([{ est: 0, nord: -2, altitude: 10.5 }, { est: 10, nord: -2, altitude: 11.5 }]);
  });
  it('gauche = vers le nord, sans altitude reste sans altitude', () => {
    const r = ligneDecalee([{ est: 0, nord: 0, altitude: null }, { est: 10, nord: 0, altitude: null }], -1.5, 1);
    expect(r.sommets[0]).toEqual({ est: 0, nord: 1.5, altitude: null });
  });
  it('carré fermé (sens horaire), décalé de 1 à droite = vers l\'intérieur, coins justes', () => {
    const carre = [{ est: 0, nord: 0 }, { est: 0, nord: 10 }, { est: 10, nord: 10 }, { est: 10, nord: 0 }, { est: 0, nord: 0 }].map((p) => ({ ...p, altitude: 5 }));
    const r = ligneDecalee(carre, 1, 0);
    expect(r.fermee).toBe(true);
    expect(r.sommets.map((s) => [s.est, s.nord])).toEqual([[1, 1], [1, 9], [9, 9], [9, 1]]);
  });
});

describe('rangerLigneDecalee', () => {
  it('crée le levé libre une fois, numérote les lignes', () => {
    const projet = creerProjet('Essai');
    const a = rangerLigneDecalee(projet, ligneDecalee([{ est: 0, nord: 0, altitude: 1 }, { est: 5, nord: 0, altitude: 1 }], 1));
    const b = rangerLigneDecalee(projet, ligneDecalee([{ est: 0, nord: 0, altitude: 1 }, { est: 5, nord: 0, altitude: 1 }], 2));
    expect(projet.autres.filter((x) => x.nom === NOM_LEVE_DECALAGES)).toHaveLength(1);
    expect(a.ligne.noms).toEqual(['L-dec-1-1', 'L-dec-1-2']);
    expect(b.ligne.noms).toEqual(['L-dec-2-1', 'L-dec-2-2']);
    expect(a.levee.lignesRupture).toHaveLength(2);
    expect(projet.leves.find((l) => l.id === a.levee.leveId).points).toHaveLength(4);
  });
});
