import { describe, it, expect } from 'vitest';
import {
  creerPresentation, appliquerPresentation, synchroniserPresentation, dupliquerPresentation, renommerPresentation, supprimerPresentation,
  presentationActive, presentationsDe, quitterPresentation,
} from '../src/topo/presentations.js';

const plan = () => ({ echelle: 200, feuille: { format: 'a3', orientation: 'paysage', legende: true } });

describe('présentations (0.330.0)', () => {
  it('enregistrer : copie les réglages et l\'échelle, et devient la présentation choisie', () => {
    const p = plan();
    const a = creerPresentation(p, 'PIC A3');
    expect(a.feuille).toEqual({ format: 'a3', orientation: 'paysage', legende: true });
    expect(a.echelle).toBe(200);
    expect(p.presentationActive).toBe(a.id);
    expect(a.feuille).not.toBe(p.feuille); // une copie
  });
  it('modifier la feuille met la présentation choisie à jour toute seule (et pas les autres)', () => {
    const p = plan();
    const a = creerPresentation(p, 'A3');
    p.feuille = { ...p.feuille, format: 'a1' };
    p.echelle = 500;
    expect(synchroniserPresentation(p)).toBe(true);
    expect(a.feuille.format).toBe('a1');
    expect(a.echelle).toBe(500);
    expect(synchroniserPresentation(p)).toBe(false); // rien de neuf
  });
  it('ouvrir une présentation remet ses réglages et son échelle ; l\'autre reste intacte', () => {
    const p = plan();
    const a = creerPresentation(p, 'A3 1:200');
    quitterPresentation(p);
    p.feuille = { ...p.feuille, format: 'a1' };
    p.echelle = 500;
    const b = creerPresentation(p, 'A1 1:500');
    appliquerPresentation(p, a.id);
    expect(p.feuille.format).toBe('a3');
    expect(p.echelle).toBe(200);
    expect(b.feuille.format).toBe('a1');
    expect(presentationActive(p).id).toBe(a.id);
  });
  it('dupliquer : copie indépendante qui devient la choisie ; modifier la copie ne touche pas l\'original', () => {
    const p = plan();
    const a = creerPresentation(p, 'Base');
    const c = dupliquerPresentation(p);
    expect(c.nom).toBe('Base (copie)');
    expect(p.presentationActive).toBe(c.id);
    p.feuille = { ...p.feuille, nord: false };
    synchroniserPresentation(p);
    expect(c.feuille.nord).toBe(false);
    expect(a.feuille.nord).toBeUndefined();
  });
  it('noms : jamais deux pareils ; renommer ; supprimer la choisie garde les réglages du plan', () => {
    const p = plan();
    creerPresentation(p, 'X');
    const b = creerPresentation(p, 'x');
    expect(b.nom).toBe('x (2)');
    renommerPresentation(p, b.id, 'Autre');
    expect(b.nom).toBe('Autre');
    supprimerPresentation(p, b.id);
    expect(presentationsDe(p)).toHaveLength(1);
    expect(p.presentationActive).toBeUndefined();
    expect(p.feuille.format).toBe('a3');
  });
  it('sans présentation choisie, rien n\'est mis à jour', () => {
    const p = plan();
    expect(synchroniserPresentation(p)).toBe(false);
  });
});
