// Tests des exports du recollement de réseaux (CSV, DXF, LandXML, PDF).
import { describe, it, expect } from 'vitest';
import { creerRecollement, ajouterPointReseau, prochainNomReseau, traceDuRecollement, nomsDuRecollement } from '../src/topo/reseau.js';
import { genererCsvReseaux, genererDxfReseaux, ecrireLandXMLReseaux, pdfReseaux } from '../src/export/reseaux.js';

/** Un réseau EU : chambre ronde (radier 450), tuyau Ø 315 PVC, chambre rectangulaire (prof. 2.4). */
function reseauEssai() {
  const leve = { id: 'l1', nom: 'LV-EU 1', points: [] };
  const projet = { leves: [leve], reseaux: [] };
  const r = creerRecollement(projet, leve, 'EU');
  const lever = (element, est, nord, altitude, autres = {}) => {
    const nom = prochainNomReseau(projet, r, element, autres.forme);
    return ajouterPointReseau(projet, leve, r, { nom, est, nord, altitude }, { element, ...autres });
  };
  lever('chambre', 2600000, 1200000, 452, { diametre: 1000, materiau: 'Béton' }).ouvrage.radier = 450;
  lever('tuyau', 2600010, 1200000, 450.115, { diametre: 315, materiau: 'PVC', profondeurFouille: 2.6 });
  for (const [e, n] of [[2600020, 1200000], [2600021, 1200000], [2600021, 1200001]]) lever('chambre', e, n, 451.8, { forme: 'rect' });
  r.ouvrages[1].profondeurSaisie = 2.4;
  const noms = new Set(nomsDuRecollement(r));
  return { nom: r.nom, reseau: 'EU', couleur: '#dc2626', trace: traceDuRecollement(r, leve), points: leve.points.filter((p) => noms.has(p.nom)) };
}

describe('exports du recollement', () => {
  it('CSV : ouvrages, tronçons (pente, écoulement) et points avec attributs', () => {
    const csv = genererCsvReseaux([reseauEssai()]);
    expect(csv).toContain('EU;LV-EU 1;CH-EU-1;Chambre;ronde;2600000.000;1200000.000;452.000;450.000;2.000;1000;Béton;');
    expect(csv).toContain('EU;T-EU-1;CH-EU-1;T-EU-1-1;10.000;450.000;449.800;-2.00;vers T-EU-1-1;315;PVC');
    expect(csv).toContain('EU;T-EU-1-1;Tuyau;2600010.000;1200000.000;450.115;449.800;315;PVC;2.600;');
    expect(csv).toContain('CH-EU-2;Chambre;rectangulaire');
  });

  it('DXF : un calque par réseau, tronçons au fil d\'eau, cercle de la chambre', () => {
    const dxf = genererDxfReseaux([reseauEssai()]);
    for (const calque of ['RES_EU', 'RES_EU_OUVRAGES', 'RES_EU_POINTS', 'RES_EU_TEXTES']) expect(dxf).toContain(`\r\n${calque}\r\n`);
    expect(dxf).toContain('LINE\r\n8\r\nRES_EU\r\n10\r\n2600000.000\r\n20\r\n1200000.000\r\n30\r\n450.000');
    expect(dxf).toContain('CIRCLE\r\n8\r\nRES_EU_OUVRAGES');
    expect(dxf).toContain('-2.00 % >');
  });

  it('LandXML : PipeNetwork, Struct (Nord Est) et Pipe dans le sens de l\'écoulement', () => {
    const xml = ecrireLandXMLReseaux([reseauEssai()], 'Essai');
    expect(xml).toContain('<PipeNetwork name="LV-EU 1" pipeNetType="sanitary">');
    expect(xml).toContain('<Struct name="CH-EU-1" desc="chambre" elevRim="452.000" elevSump="450.000">');
    expect(xml).toContain('<Center>1200000.000 2600000.000</Center>');
    expect(xml).toContain('<CircStruct diameter="1.000" material="Béton" />');
    expect(xml).toContain('<RectStruct length="1.000" width="1.000" />');
    expect(xml).toContain('refStart="CH-EU-1" refEnd="T-EU-1-1" length="10.000" slope="0.02000"');
    expect(xml).toContain('<CircPipe diameter="0.315" material="PVC" />');
  });

  it('PDF : un fichier est produit', async () => {
    const blob = pdfReseaux([reseauEssai()], { affaire: '10 203', lieu: 'Essai', date: '30.10.2026' });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
