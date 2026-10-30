// Tests du métré levé avec le récepteur : noms des points, mesures créées toutes seules.
import { describe, it, expect } from 'vitest';
import { creerProjet } from '../src/projet/projet.js';
import { leveDuJour } from '../src/topo/leve-direct.js';
import { creerMetre, prochainNomMetre, ajouterPointMetre, nouvelElementMetre, retirerPointDesMesures, resumeMetre } from '../src/topo/metre.js';
import { calculerMesure } from '../src/topo/mesure.js';

/** Prend un point du métré avec le nom proposé. */
function prendre(projet, leve, metre, role, libelle, est, nord, altitude = 400) {
  const nom = prochainNomMetre(projet, metre, role, libelle);
  return ajouterPointMetre(projet, leve, metre, role, libelle, { nom, est, nord, altitude });
}

describe('métré', () => {
  it('une aire levée devient une mesure « ENR 1 », de 100 m² pour un carré de 10 m', () => {
    const projet = creerProjet();
    const leve = leveDuJour(projet);
    const metre = creerMetre(projet, leve);
    expect(metre.nom).toBe('LV-Métré 1');
    expect(prochainNomMetre(projet, metre, 'aire', 'ENR')).toBe('A-ENR-1-1');
    for (const [e, n] of [[0, 0], [10, 0], [10, 10], [0, 10]]) prendre(projet, leve, metre, 'aire', 'ENR', e, n);
    expect(projet.mesures).toHaveLength(1);
    const [aire] = projet.mesures;
    expect(aire).toMatchObject({ nom: 'ENR 1', type: 'aire', libelle: 'ENR', numero: 1, metreId: metre.id });
    expect(aire.contour).toEqual(['A-ENR-1-1', 'A-ENR-1-2', 'A-ENR-1-3', 'A-ENR-1-4']);
    expect(calculerMesure(aire, leve.points).a2d).toBeCloseTo(100);
  });

  it('« Nouvelle » ou un autre libellé commence une autre aire ; numéros comptés dans le projet', () => {
    const projet = creerProjet();
    const leve = leveDuJour(projet);
    const metre = creerMetre(projet, leve);
    prendre(projet, leve, metre, 'aire', 'ENR', 0, 0);
    nouvelElementMetre(projet, metre, 'aire');
    expect(prochainNomMetre(projet, metre, 'aire', 'ENR')).toBe('A-ENR-2-1');
    prendre(projet, leve, metre, 'aire', 'ENR', 5, 5);
    prendre(projet, leve, metre, 'aire', 'GAZ', 9, 9);
    expect(projet.mesures.map((m) => m.nom)).toEqual(['ENR 1', 'ENR 2', 'GAZ 1']);
  });

  it('longueur (L-BOR-1-1…) et points comptés (une mesure « Nombre » par libellé)', () => {
    const projet = creerProjet();
    const leve = leveDuJour(projet);
    const metre = creerMetre(projet, leve);
    prendre(projet, leve, metre, 'longueur', 'BOR', 0, 0);
    prendre(projet, leve, metre, 'longueur', 'BOR', 30, 40);
    prendre(projet, leve, metre, 'compte', 'RG', 1, 1);
    prendre(projet, leve, metre, 'compte', 'RG', 2, 2);
    prendre(projet, leve, metre, 'compte', 'POT', 3, 3);
    const [bordure, regards, poteaux] = projet.mesures;
    expect(bordure).toMatchObject({ nom: 'BOR 1', type: 'longueur', points: ['L-BOR-1-1', 'L-BOR-1-2'] });
    expect(calculerMesure(bordure, leve.points).l2d).toBeCloseTo(50);
    expect(regards).toMatchObject({ nom: 'RG', type: 'nombre', points: ['P-RG-1', 'P-RG-2'] });
    expect(calculerMesure(regards, leve.points).nombre).toBe(2);
    expect(poteaux.nom).toBe('POT');
    expect(resumeMetre(projet, metre)).toBe('0 aire · 1 longueur · 3 points comptés');
  });

  it('refuse un nom déjà pris ; annuler le seul point d\'une mesure l\'enlève', () => {
    const projet = creerProjet();
    const leve = leveDuJour(projet);
    const metre = creerMetre(projet, leve);
    prendre(projet, leve, metre, 'compte', 'RG', 1, 1);
    expect(ajouterPointMetre(projet, leve, metre, 'compte', 'RG', { nom: 'P-RG-1', est: 0, nord: 0, altitude: 0 }).erreur).toContain('déjà pris');
    const point = leve.points.pop();
    retirerPointDesMesures(projet, point.nom);
    expect(projet.mesures).toHaveLength(0);
  });
});
