// Nouvel indice d'un plan calé (0.280.0) : indice suivant, repères, contrôle « même origine » à 2 mm.
import { describe, it, expect } from 'vitest';
import { indiceSuivant, reperesDuPlan, partRetrouvee, controlerIndice } from '../src/topo/indice-plan.js';

const plan = (decalage = 0) => ({
  origine: { est: 1000, nord: 2000 },
  calques: [{ nom: 'MURS' }, { nom: 'COTES' }],
  contenu: {
    traits: [
      { c: 0, p: [0 + decalage, 0, 100 + decalage, 0, 100 + decalage, 50] },
      { c: 0, p: [10 + decalage, 10, 20 + decalage, 20] },
      { c: 1, p: [500, 500, 600, 600] },
    ],
  },
});

describe('indice suivant', () => {
  it('A → B, Z → ZA, 3 → 4, B2 → B3, 09 → 10', () => {
    expect(indiceSuivant('A')).toBe('B');
    expect(indiceSuivant('Z')).toBe('ZA');
    expect(indiceSuivant('3')).toBe('4');
    expect(indiceSuivant('B2')).toBe('B3');
    expect(indiceSuivant('09')).toBe('10');
    expect(indiceSuivant('')).toBe('A');
  });
});

describe('contrôle d\'un nouvel indice', () => {
  const reperes = reperesDuPlan(plan(), { ecartes: ['COTES'] });
  it('repères : calques gardés seulement, sans doublon', () => {
    expect(reperes).toHaveLength(5);
    expect(reperes[0]).toEqual([1000, 2000]);
  });
  it('même plan : 100 % ; plan en cm (échelle 0.01) décalé de 0.1 cm = 1 mm : retrouvé', () => {
    expect(partRetrouvee(reperes, plan(), 0.2)).toBe(1);
    expect(controlerIndice(reperes, plan(0.1), 0.01).memeOrigine).toBe(true);
  });
  it('plan décalé de 1 cm (1 unité en cm) : origine différente', () => {
    const r = controlerIndice(reperes, plan(1), 0.01);
    expect(r.memeOrigine).toBe(false);
    expect(r.part).toBe(0);
  });
});

// 0.307.0 : nom d'un plan calé (type fixe devant, indice derrière) ; textes multi-lignes explosés.
import { nomPlanCale, baseDuNomCale, typeDuFichier } from '../src/topo/indice-plan.js';
import { exploserTextes } from '../src/topo/nettoyage-plan.js';

describe('nom du plan calé', () => {
  it('DXF- / PDF- devant, _ind- derrière, sans doublon', () => {
    expect(nomPlanCale('DXF', 'Villa Dupont', 'B')).toBe('DXF-Villa Dupont_ind-B');
    expect(nomPlanCale('PDF', 'PDF-Façade_ind-A', 'C')).toBe('PDF-Façade_ind-C');
    expect(baseDuNomCale('DWG_plan_A_ind-2')).toBe('plan_A');
    expect(typeDuFichier('plan.dwg')).toBe('DXF');
    expect(typeDuFichier('plan.PDF')).toBe('PDF');
  });
});

describe('exploser les textes multi-lignes', () => {
  it('une ligne = un texte, interligne 5/3 de la hauteur, attache en haut', () => {
    const plan = { contenu: { textes: [{ c: 0, x: 0, y: 0, h: 0.3, a: 0, t: 'A B C', lignes: ['A', 'B', 'C'], ah: 0, av: 3 }, { c: 0, x: 5, y: 5, h: 1, a: 0, t: 'seul' }] } };
    const e = exploserTextes(plan);
    expect(e.contenu.textes.map((t) => t.t)).toEqual(['A', 'B', 'C', 'seul']);
    expect(e.contenu.textes[1].y).toBeCloseTo(-0.5, 6);
    expect(e.contenu.textes[2].y).toBeCloseTo(-1, 6);
    expect(e.contenu.textes[0].lignes).toBeUndefined();
    expect(exploserTextes(plan)).toBe(e); // même plan = même résultat
  });
});

import { lirePlanDxf } from '../src/topo/dxf-plan.js';
describe('MTEXT de plusieurs lignes', () => {
  it('les lignes sont gardées à part', () => {
    const dxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'MTEXT', '8', 'TXT', '10', '2500000', '20', '1117000', '40', '0.5', '71', '1', '1', '{\\fArial;Mur BA}\\Pép. 25 cm', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const { plan: p } = lirePlanDxf(dxf, 'essai');
    const t = p.contenu.textes[0];
    expect(t.lignes).toEqual(['Mur BA', 'ép. 25 cm']);
    expect(t.t).toBe('Mur BA ép. 25 cm');
  });
});
