// Tests des lignes et du contour d'un levé : croisements, segment supprimé, point déjà levé
// ajouté à une ligne, point hors du contour d'un stock, point supprimé.
import { describe, it, expect } from 'vitest';
import {
  segmentsDuLevee,
  seCroisent,
  segmentCroise,
  supprimerSegment,
  ajouterPointExistant,
  horsDuContour,
  supprimerPointDuLevee,
  placeDuPoint,
  nomDeLigne,
} from '../src/topo/lignes-levee.js';

const p = (nom, est, nord) => ({ nom, est, nord, altitude: 400 });
// Stock carré 0..20 ; ligne L-HT-1 horizontale (nord 10) ; ligne L-BT-1 à commencer.
function stockEssai() {
  const points = [p('C1', 0, 0), p('C2', 20, 0), p('C3', 20, 20), p('C4', 0, 20), p('H1', 2, 10), p('H2', 10, 10), p('H3', 18, 10), p('B1', 10, 2), p('I1', 5, 5)];
  const surface = {
    nature: 'stock',
    contour: ['C1', 'C2', 'C3', 'C4'],
    lignesRupture: [
      { noms: ['H1', 'H2', 'H3'], fermee: false, libelle: 'HT', numero: 1 },
      { noms: ['B1'], fermee: false, libelle: 'BT', numero: 1 },
    ],
    points: ['I1'],
  };
  return { surface, parNom: new Map(points.map((q) => [q.nom, q])), leve: { points } };
}

describe('lignes du levé', () => {
  it('segments : contour fermé, lignes ouvertes', () => {
    const { surface } = stockEssai();
    const segments = segmentsDuLevee(surface);
    expect(segments.filter((s) => s.type === 'contour')).toHaveLength(4);
    expect(segments.filter((s) => s.type === 'ligne').map((s) => `${s.a}-${s.b}`)).toEqual(['H1-H2', 'H2-H3']);
  });

  it('croisement : vrai seulement si les segments se coupent (un bout commun ne compte pas)', () => {
    expect(seCroisent({ est: 0, nord: 0 }, { est: 10, nord: 10 }, { est: 0, nord: 10 }, { est: 10, nord: 0 })).toBe(true);
    expect(seCroisent({ est: 0, nord: 0 }, { est: 10, nord: 10 }, { est: 10, nord: 10 }, { est: 20, nord: 0 })).toBe(false);
    expect(seCroisent({ est: 0, nord: 0 }, { est: 5, nord: 5 }, { est: 0, nord: 10 }, { est: 10, nord: 0 })).toBe(false);
  });

  it('nouveau segment de L-BT-1 qui traverse L-HT-1 : le segment croisé est trouvé', () => {
    const { surface, parNom } = stockEssai();
    const croise = segmentCroise(surface, parNom, 'B1', { est: 11, nord: 15 });
    expect(croise).toMatchObject({ type: 'ligne', index: 0, a: 'H2', b: 'H3' });
    expect(segmentCroise(surface, parNom, 'B1', { est: 11, nord: 8 })).toBeNull();
    // Un segment qui part de H2 (bout commun) ne croise pas les segments de H2.
    expect(segmentCroise(surface, parNom, 'H2', { est: 10, nord: 15 })).toBeNull();
  });

  it('supprimer un segment : la ligne est coupée en deux, les points restent', () => {
    const { surface } = stockEssai();
    supprimerSegment(surface, 0, 1); // H2-H3
    expect(surface.lignesRupture.map((l) => l.noms)).toEqual([['H1', 'H2'], ['H3'], ['B1']]);
    expect(nomDeLigne(surface.lignesRupture[1], 1)).toBe('L-HT-1');
    // Ligne fermée : elle s'ouvre à cet endroit.
    const boucle = { lignesRupture: [{ noms: ['A', 'B', 'C', 'D'], fermee: true }] };
    supprimerSegment(boucle, 0, 1); // B-C
    expect(boucle.lignesRupture[0]).toMatchObject({ noms: ['C', 'D', 'A', 'B'], fermee: false });
  });

  it('point déjà levé ajouté à la ligne en cours : il garde son nom ; refusé s\'il est déjà dans une ligne', () => {
    const { surface } = stockEssai();
    expect(ajouterPointExistant(surface, 'ligne', 'I1')).toBeNull();
    expect(surface.lignesRupture[1].noms).toEqual(['B1', 'I1']);
    expect(surface.points).toEqual([]);
    expect(placeDuPoint(surface, 'I1')).toEqual({ type: 'ligne', index: 1 });
    expect(ajouterPointExistant(surface, 'ligne', 'H2')).toEqual({ erreur: 'H2 est déjà dans la ligne L-HT-1' });
    expect(ajouterPointExistant(surface, 'ligne', 'C1')).toEqual({ erreur: 'C1 est déjà dans le contour' });
  });

  it('stock : un point hors du contour est refusé ; les autres levés n\'ont pas de contour', () => {
    const { surface, parNom } = stockEssai();
    expect(horsDuContour(surface, parNom, { est: 10, nord: 10 })).toBe(false);
    expect(horsDuContour(surface, parNom, { est: 25, nord: 10 })).toBe(true);
    expect(horsDuContour({ ...surface, nature: 'terrain' }, parNom, { est: 25, nord: 10 })).toBe(false);
    expect(horsDuContour({ ...surface, contour: ['C1', 'C2'] }, parNom, { est: 25, nord: 10 })).toBe(false);
  });

  it('supprimer un point : il quitte le levé, et sa liste si rien d\'autre ne s\'en sert', () => {
    const { surface, leve } = stockEssai();
    expect(supprimerPointDuLevee(leve, surface, 'H2')).toBe(true);
    expect(surface.lignesRupture[0].noms).toEqual(['H1', 'H3']);
    expect(leve.points.some((q) => q.nom === 'H2')).toBe(false);
    // Utilisé par un autre levé : il reste dans la liste.
    const autre = { contour: [], lignesRupture: [], points: ['I1'] };
    supprimerPointDuLevee(leve, surface, 'I1', [surface, autre]);
    expect(surface.points).toEqual([]);
    expect(leve.points.some((q) => q.nom === 'I1')).toBe(true);
  });
});
