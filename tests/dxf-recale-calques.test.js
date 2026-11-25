import { describe, it, expect } from 'vitest';
import { nomsDeCalques, genererDxfPlan } from '../src/export/dxf-recale.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';
import { nettoyerPlan, recetteDeDepart } from '../src/topo/nettoyage-plan.js';

describe('noms de calques exportés (0.320.1)', () => {
  it('des calques à long préfixe commun restent distincts et ≤ 31 caractères', () => {
    const prefixe = 'DXF-AZ17006_15_IMPLANTATION_longue_version - ';
    const calques = ['MURS', 'AXES', 'Cotations', 'Textes', 'MURS'].map((n) => ({ nom: prefixe + n, couleur: '#ff0000' }));
    const noms = nomsDeCalques(calques);
    expect(new Set(noms.map((n) => n.toUpperCase())).size).toBe(5);
    expect(noms.every((n) => n.length <= 31)).toBe(true);
    expect(noms[0]).toMatch(/MURS$/);
    expect(noms[1]).toMatch(/AXES$/);
  });
  it('un nom court reste lisible (majuscules, sans accent)', () => {
    expect(nomsDeCalques([{ nom: 'Béton armé' }, { nom: 'MURS' }])).toEqual(['BETON_ARME', 'MURS']);
  });
  it('le fichier a un calque et une couleur par calque', () => {
    const plan = {
      origine: { est: 2500000, nord: 1120000 },
      calques: [{ nom: 'A', couleur: '#ff0000' }, { nom: 'B', couleur: '#00ff00' }],
      contenu: { traits: [{ c: 0, p: [0, 0, 1, 0], k: '#ff0000' }, { c: 1, p: [0, 1, 1, 1] }] },
    };
    const t = genererDxfPlan(plan).split('\r\n');
    expect(t.filter((l, i) => t[i - 1] === '2' && (l === 'A' || l === 'B'))).toEqual(['A', 'B']);
    expect(t).toContain('62');
  });
  it('plan nettoyé avec le préfixe « DXF-nom - » : les calques et les couleurs sortent distincts', () => {
    const L = (l, c, y) => ['0', 'LINE', '8', l, '62', String(c), '10', '2500000', '20', String(1120000 + y), '30', '0', '11', '2500010', '21', String(1120000 + y), '31', '0'];
    const noms = ['MURS_PORTEURS', 'AXES_STRUCTURE', 'COTATIONS_ARCHI'];
    const texte = ['0', 'SECTION', '2', 'ENTITIES', ...noms.flatMap((n, i) => L(n, i + 1, i * 5)), '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const lu = lirePlanDxf(texte, 'x.dxf').plan;
    const net = nettoyerPlan(lu, recetteDeDepart(lu, 'DXF-AZ17006_15_IMPLANTATION_longue_version - '));
    const plan = net.plan ?? net;
    const t = genererDxfPlan({ origine: plan.origine, calques: plan.calques, contenu: plan.contenu }).split('\r\n');
    const calquesTable = t.filter((l, i) => t[i - 1] === '2' && t[i - 2] === 'LAYER');
    expect(new Set(calquesTable).size).toBe(3);
    const couleurs = t.filter((l, i) => t[i - 1] === '62');
    expect(['1', '2', '3'].every((c) => couleurs.includes(c))).toBe(true); // couleur de chaque objet gardée
  });
});
