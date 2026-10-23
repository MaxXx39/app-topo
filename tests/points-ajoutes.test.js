import { describe, it, expect } from 'vitest';
import { ajouterPointAjoute, nomPointAjoute, lireNombreTape, leveDesPointsAjoutes } from '../src/topo/points-ajoutes.js';

const projetVide = () => ({ leves: [], leveActifId: null, aImplanter: [] });

describe('Points ajoutés (tapés ou pris sur un plan DXF)', () => {
  it('lit un nombre tapé, avec le point ou la virgule', () => {
    expect(lireNombreTape('2507360.125')).toBe(2507360.125);
    expect(lireNombreTape(' 427,5 ')).toBe(427.5);
    expect(lireNombreTape('')).toBeNull();
    expect(lireNombreTape('12a')).toBeUndefined();
  });

  it('range les points dans le levé « Points ajoutés », créé au premier point', () => {
    const projet = projetVide();
    const { point } = ajouterPointAjoute(projet, { nom: '', est: 2507360, nord: 1140620, altitude: null, source: 'dxf' });
    expect(point).toEqual({ nom: 'P1', est: 2507360, nord: 1140620, altitude: null, ajoute: 'dxf' });
    const leve = leveDesPointsAjoutes(projet);
    expect(leve.nom).toBe('Points ajoutés');
    expect(projet.leveActifId).toBe(leve.id); // seul levé du projet : il est affiché
    ajouterPointAjoute(projet, { nom: 'Angle', est: 1, nord: 2, altitude: 427.1 });
    expect(leve.points).toHaveLength(2);
    expect(projet.leves).toHaveLength(1);
  });

  it('propose le premier nom P libre du projet et refuse un nom déjà pris', () => {
    const projet = projetVide();
    projet.leves.push({ id: 'a', nom: 'levé', points: [{ nom: 'P1', est: 0, nord: 0, altitude: 0 }] });
    projet.leveActifId = 'a';
    expect(nomPointAjoute(projet)).toBe('P2');
    expect(ajouterPointAjoute(projet, { nom: 'P1', est: 1, nord: 1 }).erreur).toMatch(/existe déjà/);
    expect(ajouterPointAjoute(projet, { nom: 'X', est: Number.NaN, nord: 1 }).erreur).toMatch(/Est et Nord/);
    expect(projet.leveActifId).toBe('a'); // le levé affiché ne change pas
  });
});
