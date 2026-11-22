// Xrefs (0.280.0, calage de plans) : un xref vide est rempli avec le fichier fourni ; calques « xref|calque ».
import { describe, it, expect } from 'vitest';
import { lirePlanDxf, nomXref } from '../src/topo/dxf-plan.js';

const dxf = (lignes) => lignes.join('\n');
const hote = dxf([
  '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
  '0', 'LAYER', '2', 'XREF_ARCHI', '62', '7', '70', '0',
  '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'BLOCKS',
  '0', 'BLOCK', '8', '0', '2', 'Archi', '70', '4', '10', '0', '20', '0', '1', 'C:\\Projets\\Archi\\Murs.dwg',
  '0', 'ENDBLK',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '8', 'PLAN', '10', '0', '20', '0', '11', '1', '21', '0',
  '0', 'INSERT', '8', 'XREF_ARCHI', '2', 'Archi', '10', '100', '20', '200',
  '0', 'ENDSEC', '0', 'EOF',
]);
const murs = dxf([
  '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
  '0', 'LAYER', '2', 'MURS', '62', '1', '70', '0',
  '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '8', 'MURS', '10', '0', '20', '0', '11', '10', '21', '0',
  '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '0', '21', '5',
  '0', 'ENDSEC', '0', 'EOF',
]);

describe('xrefs', () => {
  it('nom du fichier d\'un xref', () => {
    expect(nomXref('C:\\Projets\\Archi\\Murs.dwg')).toBe('murs');
  });
  it('xref introuvable : signalé, rien de dessiné', () => {
    const { plan } = lirePlanDxf(hote, 'hote.dxf');
    expect(plan.compte.xrefs).toEqual([expect.objectContaining({ nom: 'Archi', etat: 'introuvable' })]);
    expect(plan.contenu.traits).toHaveLength(1);
  });
  it('xref fourni : ses objets à leur place, calques préfixés, calque 0 = calque de l\'insertion', () => {
    const { plan } = lirePlanDxf(hote, 'hote.dxf', { xrefs: new Map([['murs', murs]]) });
    expect(plan.compte.xrefs[0].etat).toBe('lu');
    expect(plan.contenu.traits).toHaveLength(3);
    const noms = plan.calques.map((c) => c.nom);
    expect(noms).toContain('Archi|MURS');
    expect(noms).toContain('XREF_ARCHI');
    const mur = plan.contenu.traits.find((t) => plan.calques[t.c].nom === 'Archi|MURS');
    expect(plan.origine.est + mur.p[0]).toBe(100);
    expect(plan.origine.est + mur.p[2]).toBe(110);
    expect(plan.calques.find((c) => c.nom === 'Archi|MURS').couleur).not.toBe('#000000');
  });
});
