// Plan PDF scanné en image et accroche « Manuel » (0.130.0).
import { describe, it, expect } from 'vitest';
import { facteurDeRendu, planImagePdf, coinsDeLImage, PIXELS_MAX } from '../src/topo/pdf-image.js';
import { calculerHelmert, planRecale, appliquerHelmert } from '../src/topo/recalage.js';
import { cibleDeplacee, departDeLaLoupe } from '../src/plan/loupe.js';
import { accrochesProposees } from '../src/recalage/barre.js';

describe('netteté de l\'image', () => {
  it('Normale = 150 dpi sur une page A4', () => {
    const { facteur, reduite, dpi } = facteurDeRendu(595, 842, 'normale');
    expect(dpi).toBe(150);
    expect(facteur).toBeCloseTo(150 / 72, 9);
    expect(reduite).toBe(false);
  });
  it('page A0 en Fine : réduite pour rester sous le maximum de pixels', () => {
    const { facteur, reduite, dpi } = facteurDeRendu(2384, 3370, 'fine');
    expect(reduite).toBe(true);
    expect(dpi).toBeLessThan(250);
    expect(2384 * 3370 * facteur * facteur).toBeCloseTo(PIXELS_MAX, -3);
  });
});

describe('plan image', () => {
  it('au 1:500, une feuille A4 (595 × 842 points) fait 104,9 × 148,5 m', () => {
    const plan = planImagePdf({ nom: 'scan.pdf', largeurPt: 595.28, hauteurPt: 841.89, echelle: 500, donnees: 'data:image/jpeg;base64,AAAA', pixels: { largeur: 1240, hauteur: 1754 } });
    expect(plan.contenu.image.largeur).toBeCloseTo(105.0, 1);
    expect(plan.contenu.image.hauteur).toBeCloseTo(148.5, 1);
    expect(plan.bornes).toEqual({ estMin: 0, nordMin: 0, estMax: plan.contenu.image.largeur, nordMax: plan.contenu.image.hauteur });
  });

  it('recalé : les coins de l\'image suivent la transformation de Helmert', () => {
    const lu = planImagePdf({ nom: 'scan.pdf', largeurPt: 72, hauteurPt: 144, echelle: 1000, donnees: 'x', pixels: { largeur: 1, hauteur: 2 } });
    // 72 points au 1:1000 = 25,4 m ; 144 points = 50,8 m.
    // Calage : (0, 0) → (2 500 000, 1 100 000) et (25,4, 0) → (2 500 000, 1 100 025,4) : rotation de 100 gon, échelle 1.
    const paires = [
      { x: 0, y: 0, est: 2500000, nord: 1100000 },
      { x: 25.4, y: 0, est: 2500000, nord: 1100025.4 },
    ];
    const parametres = calculerHelmert(paires);
    const recale = planRecale({ ...lu, recalage: { applique: true, parametres } });
    const { origine, contenu: { image } } = recale;
    const coins = coinsDeLImage(image).map(([x, y]) => [x + origine.est, y + origine.nord]);
    const attendus = [[0, 0], [25.4, 0], [25.4, 50.8], [0, 50.8]].map(([x, y]) => appliquerHelmert(parametres, x, y));
    coins.forEach(([e, n], i) => {
      expect(e).toBeCloseTo(attendus[i].est, 6);
      expect(n).toBeCloseTo(attendus[i].nord, 6);
    });
    // Le coin haut droit de la feuille part vers l'ouest (rotation d'un quart de tour à gauche).
    expect(attendus[2].est).toBeCloseTo(2500000 - 50.8, 6);
    expect(recale.bornes.estMin).toBeCloseTo(2500000 - 50.8, 3);
    expect(recale.bornes.nordMax).toBeCloseTo(1100025.4, 3);
    // Le plan d'origine n'est pas touché (le recalage s'annule).
    expect(lu.contenu.image.matrice).toBeUndefined();
  });
});

describe('loupe', () => {
  it('tirer la main de 10 px vers la droite déplace la cible de 10 px à l\'échelle de la vue', () => {
    const vue = { echelle: 2, estCentre: 1000, nordCentre: 2000, largeur: 400, hauteur: 600, rotation: 0 };
    const cible = cibleDeplacee({ est: 1000, nord: 2000 }, 10, -4, vue);
    expect(cible.est).toBeCloseTo(1005, 9); // 10 px ÷ 2 px/m
    expect(cible.nord).toBeCloseTo(2002, 9); // vers le haut de l'écran = nord
  });
});

describe('accroches du recalage', () => {
  it('« Manuel » seulement pour un plan PDF ; PDF scanné : Manuel et Point', () => {
    const cles = (pdf) => accrochesProposees(pdf).map(([cle]) => cle);
    expect(cles(null)).not.toContain('manuel');
    expect(cles('traits')).toEqual(['sommet', 'milieu', 'ligne', 'croisement', 'centre', 'point', 'manuel']);
    expect(cles('image')).toEqual(['manuel', 'point']);
  });
});

describe('place de départ de la loupe', () => {
  it('tablette : au milieu de la partie libre au-dessus de la barre', () => {
    expect(departDeLaLoupe(800, 1100, 740)).toEqual({ x: 400, y: 370 });
  });
  it('téléphone (barre haute) : la main reste au-dessus de la barre', () => {
    const { x, y } = departDeLaLoupe(390, 740, 380);
    expect(x).toBe(195);
    expect(y + 116 + 34).toBeLessThanOrEqual(380);
    expect(y).toBeGreaterThanOrEqual(72);
  });
});
