// Grue Liebherr 172 EC-B 8 Litronic (0.310.0) : les nombres viennent de la fiche du constructeur ; ces tests relisent
// quelques lignes de la fiche (pages 4, 5, 7 à 13) et vérifient que le dessin respecte les cotes.
import { describe, it, expect } from 'vitest';
import { FLECHES, TOURS, ELEMENTS_FLECHE, DIMENSIONS, BLOCS } from '../src/topo/grue-liebherr-172-donnees.js';
import {
  chargeAuRayon, contrepoidsDe, poidsFleche, boutDeFleche, reglagesEcb172, hauteurChoisie, hauteursDe, tourDe, ficheEcb172, grueEcb172, flecheDe,
} from '../src/topo/grue-liebherr-172.js';
import { grueDeLObjet } from '../src/topo/grue-mobile.js';
import { dxfPlanChantier } from '../src/topo/plan-chantier-dxf.js';

const f = (nom) => FLECHES.find((x) => x.nom === nom);

describe('données de la fiche', () => {
  it('16 flèches ; LM 2 seulement de 40,0 à 62,5 m', () => {
    expect(FLECHES).toHaveLength(16);
    expect(FLECHES.filter((x) => x.lm2).map((x) => x.nom)).toEqual([40, 42.5, 45, 47.5, 50, 52.5, 55, 57.5, 60, 62.5]);
  });
  it('longueur nominale = somme des éléments − 0,4 m ; portée maximale = nom + 1,5 m (sauf 26,9 : 28,4)', () => {
    for (const x of FLECHES) {
      const somme = x.sections.reduce((s, i) => s + ELEMENTS_FLECHE[i].nom, 0);
      expect(somme - 0.4).toBeCloseTo(x.nom, 1);
      expect(x.rMax - x.nom).toBeCloseTo(1.5, 5);
    }
  });
  it('contrepoids : charge = 2,5 × A + 1,6 × B + 0,55 × E', () => {
    for (const x of FLECHES) expect(x.contrepoids.blocs.reduce((s, b) => s + BLOCS[b].t, 0)).toBeCloseTo(x.contrepoids.t, 6);
  });
  it('tableaux de charge décroissants, dernière colonne = nom de la flèche', () => {
    for (const x of FLECHES) {
      for (const tab of [x.lm1, x.lm2].filter(Boolean)) {
        expect(tab[tab.length - 1][0]).toBe(x.nom);
        for (let i = 1; i < tab.length; i++) expect(tab[i][1]).toBeLessThanOrEqual(tab[i - 1][1]);
      }
    }
  });
  it('hauteurs : croissantes dans chaque tour (sauf la valeur suspecte de la fiche, signalée)', () => {
    for (const t of TOURS) {
      const h = hauteursDe(t);
      for (let i = 1; i < h.length; i++) if (!h[i].suspect && !h[i - 1].suspect) expect(h[i].h).toBeGreaterThan(h[i - 1].h);
    }
    expect(hauteursDe(tourDe('hc290-far-b')).filter((x) => x.suspect)).toHaveLength(2);
  });
});

describe('charge au rayon (lecture de la fiche)', () => {
  it('flèche 62,5 m, LM 1 : colonnes de la page 5', () => {
    expect(chargeAuRayon(f(62.5), 62.5).t).toBe(1.6);
    expect(chargeAuRayon(f(62.5), 40).t).toBe(2.9);
    expect(chargeAuRayon(f(62.5), 16).t).toBe(8);
    expect(chargeAuRayon(f(62.5), 18).t).toBe(7.29);
  });
  it('charge maximale 8 t de 2,6 m à la limite de la fiche (16,5 m pour 62,5 m)', () => {
    expect(chargeAuRayon(f(62.5), 3)).toMatchObject({ t: 8, source: 'plein', jusqua: 16.5 });
    expect(chargeAuRayon(f(55), 20)).toMatchObject({ t: 8, source: 'plein' }); // 2,6 – 20,2 m
    expect(chargeAuRayon(f(55), 21).t).toBe(7.3); // colonne 22,0 m
  });
  it('entre deux colonnes : la colonne suivante (prudent), jamais une valeur calculée', () => {
    const c = chargeAuRayon(f(50), 46);
    expect(c.source).toBe('colonne');
    expect(c.colonne).toBe(47.5);
    expect(c.t).toBe(3.25);
  });
  it('LM 2 : valeurs de la page 5 ; LM 2 inexistant sous 40 m → LM 1', () => {
    expect(chargeAuRayon(f(62.5), 62.5, 'lm2').t).toBe(1.8);
    expect(chargeAuRayon(f(40), 40, 'lm2').t).toBe(4.6);
    expect(reglagesEcb172({ fleche: 30, mode: 'lm2' }).mode).toBe('lm1');
  });
  it('charge en bout de flèche = dessin de la page 4', () => {
    const bouts = { 24.4: 7.45, 26.9: 6.7, 30: 5.95, 32.5: 5.45, 35: 5, 37.5: 4.65, 40: 4.3, 42.5: 3.9, 45: 3.65, 47.5: 3.25, 50: 3.05, 52.5: 2.65, 55: 2.5, 57.5: 2, 60: 1.9, 62.5: 1.6 };
    for (const [nom, t] of Object.entries(bouts)) expect(chargeAuRayon(f(Number(nom)), Number(nom)).t).toBe(t);
  });
  it('rayon hors de la plage : ramené entre 2,6 m et la flèche', () => {
    expect(chargeAuRayon(f(40), 100).rayon).toBe(40);
    expect(chargeAuRayon(f(40), 0).rayon).toBe(2.6);
  });
});

describe('contrepoids, poids, hauteurs', () => {
  it('62,5 m = 7 × A = 17,50 t ; 55,0 m = 6 × A + 1 × E = 15,55 t ; 45 kW : pas dans la fiche', () => {
    expect(contrepoidsDe(f(62.5))).toMatchObject({ t: 17.5, texte: '7 × A' });
    expect(contrepoidsDe(f(55))).toMatchObject({ t: 15.55, texte: '6 × A + 1 × E' });
    expect(contrepoidsDe(f(55), 45)).toBeNull();
  });
  it('poids de la flèche 62,5 m = 9 160 kg (somme des poids individuels)', () => {
    expect(poidsFleche(f(62.5))).toBe(9160);
  });
  it('hauteurs sous crochet recopiées : 16 HC 175 UC-0460m, 5 éléments = 27,3 m ; 21 HC 290 UC-0800, 8 = 54,1 m', () => {
    expect(hauteursDe(tourDe('hc175-uc460m')).find((h) => h.etiquette === '5').h).toBe(27.3);
    expect(hauteursDe(tourDe('hc290-uc800')).find((h) => h.etiquette === '8').h).toBe(54.1);
    expect(hauteurChoisie(tourDe('hc290-uc800'), 54).h).toBe(54.1);
  });
  it('au-dessus de 50 m : alerte de la fiche', () => {
    const fiche = ficheEcb172({ fleche: 50, tour: 'hc290-uc800', hauteur: 62.4 });
    expect(fiche.lignes.find((l) => l.titre === 'Hauteur sous crochet').alerte).toMatch(/50 m/);
    expect(ficheEcb172({ fleche: 50, tour: 'hc175-uc460m', hauteur: 27.3 }).lignes.find((l) => l.titre === 'Hauteur sous crochet').alerte).toBeNull();
  });
});

describe('dessin à l\'échelle', () => {
  it('de l\'arrière des contrepoids (−14,5 m) au bout de la flèche (nom + 1,46 m = portée maximale de la fiche à 4 cm)', () => {
    for (const nom of [24.4, 40, 62.5]) {
      const s = grueEcb172({ fleche: nom });
      expect(s.boite[0]).toBeCloseTo(-DIMENSIONS.arriereTotal, 2);
      expect(s.boite[2]).toBeCloseTo(boutDeFleche(f(nom)), 2);
      expect(Math.abs(s.boite[2] - flecheDe(nom).rMax)).toBeLessThan(0.05);
    }
  });
  it('la flèche est faite des éléments de la fiche, bout à bout (largeur 1,20 m)', () => {
    const s = grueEcb172({ fleche: 30 });
    const bords = s.primitives.filter((p) => p.g === 'h' && p.mat === 'peinture' && p.b && Math.abs(p.b[3] - p.b[1] - 1.2) < 1e-6 && p.b[0] >= 1.05).map((p) => [p.b[0], p.b[2]]).sort((a, b) => a[0] - b[0]);
    expect(bords.map((b) => Math.round((b[1] - b[0]) * 10) / 10)).toEqual([11.7, 5.6, 11.7, 1.4]); // ① ② ③ ⑨
    expect(bords[0][0]).toBeCloseTo(1.06, 2);
  });
  it('les réglages changent le dessin et le bloc DXF ; un même réglage donne le même objet', () => {
    const a = grueEcb172({ fleche: 40, rayonCrochet: 20 });
    const b = grueEcb172({ fleche: 40, rayonCrochet: 30 });
    expect(a.nomBloc).not.toBe(b.nomBloc);
    expect(grueEcb172({ fleche: 40, rayonCrochet: 20 })).toBe(a);
    expect(a.nomBloc.length).toBeLessThanOrEqual(24);
  });
  it('le texte du crochet donne le rayon et la charge', () => {
    const s = grueEcb172({ fleche: 45, rayonCrochet: 46.5 });
    expect(s.primitives.some((p) => p.g === 't' && p.t === 'r 45.0 m · 3.65 t')).toBe(true);
  });
  it('la rotation de la flèche tourne le haut, pas le pied', () => {
    const a = grueEcb172({ fleche: 40, tour: 'hc175-uc460m' });
    const b = grueEcb172({ fleche: 40, tour: 'hc175-uc460m', rotationFleche: 90 });
    expect(b.boite[3]).toBeGreaterThan(a.boite[3] + 30);
    expect(b.boite[2]).toBeLessThan(a.boite[2] - 20);
  });
  it('cercles : principal à la portée du crochet, cercles du tableau avec leur charge', () => {
    const s = grueEcb172({ fleche: 50, cercles: 'principaux' });
    expect(s.rayon.filter((p) => p.g === 'c').map((p) => p.r)).toEqual([50, 30, 40]);
    expect(s.rayon.find((p) => p.g === 't' && p.t.startsWith('40 m')).t).toBe('40 m · 3.99 t');
    expect(grueEcb172({ fleche: 50, cercles: 'aucun' }).rayon.filter((p) => p.g === 'c')).toHaveLength(1);
    expect(grueEcb172({ fleche: 50, cercles: 'tous' }).rayon.filter((p) => p.g === 'c').length).toBeGreaterThan(8);
  });
  it('branchée aux plans de chantier et au DXF', () => {
    const o = { id: 'g1', type: 'grue', modele: 'ecb172', point: [2500000, 1120000], rotation: 30, fleche: 45, tour: 'hc175-uc460m', hauteur: 27.3, rayon: true, phase: 'p1' };
    expect(grueDeLObjet([], o).modele).toBe('ecb172');
    const plan = { id: 'x', nom: 'Essai', genre: 'pic', phases: [{ id: 'p1', nom: 'Phase 1', couleur: '#2563eb', visible: true }], phaseActive: 'p1', couleurs: 'objets', objets: [o], fond: {} };
    const dxf = dxfPlanChantier(plan, []);
    expect(dxf).toContain('GRUE_ECB172_45M_');
    expect(dxf).toContain('CIRCLE');
  });
});
