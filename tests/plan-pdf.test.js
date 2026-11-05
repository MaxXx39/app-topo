// Plan PDF (0.129.0) : traits d'un PDF → DXF → plan, comme un plan DXF.
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { traitsDuChemin, dxfDuPdf, lireEchelle, multiplier, MORCEAUX, POINT_PDF_EN_M } from '../src/topo/pdf-dxf.js';
import { contenuDeLaPage } from '../src/import/pdf.js';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';

const { allerA, ligneVers, courbeVers, fermer } = MORCEAUX;

/** Ouvre un PDF fait par jsPDF (dans les tests, pdf.js tourne sans travailleur à part). */
async function lireJsPdf(doc) {
  const octets = new Uint8Array(doc.output('arraybuffer'));
  return pdfjs.getDocument({ data: octets, verbosity: 0 }).promise;
}

describe('échelle tapée', () => {
  it('comprend 500, 1:500, 1/500 et vide', () => {
    expect(lireEchelle('500')).toEqual({ echelle: 500 });
    expect(lireEchelle('1:500')).toEqual({ echelle: 500 });
    expect(lireEchelle(' 1 / 1000 ')).toEqual({ echelle: 1000 });
    expect(lireEchelle("1:2'500")).toEqual({ echelle: 2500 });
    expect(lireEchelle('')).toEqual({ echelle: null });
  });
  it('refuse un texte qui n\'est pas une échelle', () => {
    expect(lireEchelle('abc').erreur).toMatch(/pas comprise/);
    expect(lireEchelle('-5').erreur).toMatch(/pas comprise/);
  });
});

describe('chemins du PDF en traits', () => {
  it('rectangle fermé : 4 sommets, fermé', () => {
    const traits = traitsDuChemin([allerA, 0, 0, ligneVers, 10, 0, ligneVers, 10, 5, ligneVers, 0, 5, fermer]);
    expect(traits).toEqual([{ points: [[0, 0], [10, 0], [10, 5], [0, 5]], ferme: true }]);
  });
  it('deux morceaux séparés par un « aller à » = deux traits', () => {
    const traits = traitsDuChemin([allerA, 0, 0, ligneVers, 1, 0, allerA, 5, 5, ligneVers, 6, 5]);
    expect(traits).toHaveLength(2);
    expect(traits[1].points).toEqual([[5, 5], [6, 5]]);
  });
  it('courbe : remplacée par des segments, du départ jusqu\'à la fin', () => {
    const [trait] = traitsDuChemin([allerA, 0, 0, courbeVers, 0, 10, 10, 10, 10, 0]);
    expect(trait.points.length).toBeGreaterThan(5);
    expect(trait.points[0]).toEqual([0, 0]);
    const fin = trait.points[trait.points.length - 1];
    expect(fin[0]).toBeCloseTo(10, 9);
    expect(fin[1]).toBeCloseTo(0, 9);
    // Au milieu, la courbe monte à 7,5 (formule de Bézier : 3/4 de la hauteur des points de contrôle).
    const plusHaut = Math.max(...trait.points.map(([, y]) => y));
    expect(plusHaut).toBeCloseTo(7.5, 6);
  });
  it('la matrice est appliquée (déplacement et agrandissement)', () => {
    const matrice = multiplier([1, 0, 0, 1, 100, 200], [2, 0, 0, 2, 0, 0]); // ×2 puis +100 / +200
    const [trait] = traitsDuChemin([allerA, 1, 1, ligneVers, 3, 1], matrice);
    expect(trait.points).toEqual([[102, 202], [106, 202]]);
  });
  it('un point seul n\'est pas un trait', () => {
    expect(traitsDuChemin([allerA, 1, 1])).toEqual([]);
  });
});

describe('DXF du PDF', () => {
  it('au 1:500, 72 points (1 pouce) = 12,7 m', () => {
    const dxf = dxfDuPdf({ traits: [{ points: [[0, 0], [72, 0]], ferme: false, calque: 'Bordures', couleur: '#ff0000' }] }, 500);
    const { plan } = lirePlanDxf(dxf, 'essai.pdf');
    expect(plan.bornes.estMax - plan.bornes.estMin).toBeCloseTo(12.7, 3);
    expect(plan.calques).toEqual([{ nom: 'Bordures', couleur: '#ff0000', visible: true }]);
    expect(72 * POINT_PDF_EN_M * 500).toBeCloseTo(12.7, 9);
  });
  it('sans échelle : taille de la feuille en mètres (72 points = 2,54 cm)', () => {
    const dxf = dxfDuPdf({ traits: [{ points: [[0, 0], [72, 0]], ferme: false, calque: 'A' }] }, null);
    const { plan } = lirePlanDxf(dxf, 'essai.pdf');
    expect(plan.bornes.estMax - plan.bornes.estMin).toBeCloseTo(0.0254, 4);
  });
  it('calque éteint dans le PDF = calque caché ; textes dans PDF_TEXTES', () => {
    const dxf = dxfDuPdf({
      traits: [{ points: [[0, 0], [10, 10]], ferme: false, calque: 'Cotes' }],
      textes: [{ x: 5, y: 5, hauteur: 7, angle: 90, texte: 'Mur\nnord' }],
      calques: [{ nom: 'Cotes', visible: false }],
    }, 100);
    const { plan } = lirePlanDxf(dxf, 'essai.pdf');
    expect(plan.calques.find((c) => c.nom === 'Cotes').visible).toBe(false);
    const [texte] = plan.contenu.textes;
    expect(texte.t).toBe('Mur nord');
    expect(texte.a).toBe(90);
    expect(plan.calques[texte.c].nom).toBe('PDF_TEXTES');
  });
  it('nom de calque avec des signes interdits par AutoCAD : remplacés', () => {
    const dxf = dxfDuPdf({ traits: [{ points: [[0, 0], [1, 1]], ferme: false, calque: 'EC/projet:axe' }] }, 1);
    expect(lirePlanDxf(dxf, 'a.pdf').plan.calques[0].nom).toBe('EC_projet_axe');
  });
});

describe('lecture d\'un vrai PDF (fait par jsPDF)', () => {
  it('lignes, rectangle, aplat et texte retrouvés à la bonne place et à l\'échelle', async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setDrawColor(255, 0, 0);
    doc.line(72, 72, 144, 72); // 1 pouce, en haut de la page
    doc.rect(200, 200, 50, 30);
    doc.setFillColor(0, 0, 255);
    doc.rect(300, 300, 20, 20, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 10, 10, 'F'); // blanc : ignoré
    doc.text('Chambre 12', 100, 400);
    const pdf = await lireJsPdf(doc);
    const contenu = await contenuDeLaPage(pdf, 1, pdfjs.OPS);

    expect(contenu.traits).toHaveLength(3);
    const [ligne, cadre, aplat] = contenu.traits;
    expect(ligne.couleur).toBe('#ff0000');
    // y vers le haut : 72 points sous le haut de la page.
    expect(ligne.points[0][0]).toBeCloseTo(72, 3);
    expect(ligne.points[0][1]).toBeCloseTo(contenu.hauteur - 72, 3);
    expect(cadre.ferme).toBe(true);
    expect(cadre.points).toHaveLength(4);
    expect(aplat.rempli).toBe(true);
    expect(aplat.calque).toBe('PDF_REMPLIS');
    expect(contenu.textes.map((t) => t.texte)).toEqual(['Chambre 12']);

    const { plan } = lirePlanDxf(dxfDuPdf(contenu, 500), 'essai.pdf');
    const premier = plan.contenu.traits[0].p;
    expect(Math.hypot(premier[2] - premier[0], premier[3] - premier[1])).toBeCloseTo(12.7, 3);
    expect(plan.calques.map((c) => c.nom)).toEqual(['PDF_TRAITS', 'PDF_REMPLIS', 'PDF_TEXTES']);
    await pdf.loadingTask.destroy();
  });

  it('PDF scanné (seulement une image) : aucun trait, l\'image est comptée', async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    doc.addImage({ data: pixels, width: 4, height: 4 }, 'RGBA', 0, 0, 500, 700);
    const pdf = await lireJsPdf(doc);
    const contenu = await contenuDeLaPage(pdf, 1, pdfjs.OPS);
    expect(contenu.traits).toHaveLength(0);
    expect(contenu.images).toBe(1);
    await pdf.loadingTask.destroy();
  });
});

describe('calques d\'un PDF d\'AutoCAD (contenu optionnel)', () => {
  it('chaque trait prend le calque où il est dessiné, visibilité gardée', async () => {
    const OPS = pdfjs.OPS;
    // Faux document : 2 calques, « Axe » visible et « Cotes » éteint.
    const groupes = { g1: { name: 'Axe', visible: true }, g2: { name: 'Cotes', visible: false } };
    const doc = {
      getOptionalContentConfig: async () => ({ getGroup: (id) => groupes[id], isVisible: ({ id }) => groupes[id].visible }),
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100, transform: [1, 0, 0, -1, 0, 100] }),
        getOperatorList: async () => ({
          fnArray: [OPS.beginMarkedContentProps, OPS.constructPath, OPS.endMarkedContent, OPS.beginMarkedContentProps, OPS.constructPath, OPS.endMarkedContent, OPS.constructPath],
          argsArray: [
            ['OC', { type: 'OCG', id: 'g1' }], [OPS.stroke, [new Float32Array([allerA, 0, 0, ligneVers, 10, 0])], null], null,
            ['OC', { type: 'OCG', id: 'g2' }], [OPS.stroke, [new Float32Array([allerA, 0, 5, ligneVers, 10, 5])], null], null,
            [OPS.stroke, [new Float32Array([allerA, 0, 9, ligneVers, 10, 9])], null],
          ],
        }),
        getTextContent: async () => ({ items: [] }),
        cleanup: () => {},
      }),
    };
    const contenu = await contenuDeLaPage(doc, 1, OPS);
    expect(contenu.traits.map((t) => t.calque)).toEqual(['Axe', 'Cotes', 'PDF_TRAITS']);
    expect(contenu.calques).toEqual([{ nom: 'Axe', visible: true }, { nom: 'Cotes', visible: false }]);
  });
});

describe('préfixe fixe « PDF- » (0.132.0)', () => {
  it('ajouté à l\'ouverture aux plans PDF déjà importés, pas aux plans DXF', async () => {
    const { prefixerNoms } = await import('../src/projet/projet.js');
    const projet = {
      surfaces: [], leves: [],
      plansDxf: [
        { id: 'a', nom: 'plan-essai.pdf (page 1)', pdf: { page: 1 } },
        { id: 'b', nom: 'PDF-deja', pdf: { page: 1 } },
        { id: 'c', nom: 'Bordures' },
      ],
    };
    prefixerNoms(projet);
    expect(projet.plansDxf.map((p) => p.nom)).toEqual(['PDF-plan-essai.pdf (page 1)', 'PDF-deja', 'Bordures']);
  });
});
