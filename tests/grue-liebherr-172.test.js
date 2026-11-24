// Grues d'après fiche technique (0.310.0 / 0.311.0) : les nombres viennent des fiches du constructeur ; ces tests relisent
// quelques lignes des fiches (Liebherr 172 EC-B pages 4, 5, 7 à 13 ; Condecta EURO 4513 page 2) et vérifient les cotes du dessin.
import { describe, it, expect } from 'vitest';
import { MODELE_LIEBHERR, MODELE_CONDECTA, modeleDe, lireCharges, lireHauteurs, validerModele, copierModele, texteCharges, texteHauteurs, definirModelesPerso, modeleVide } from '../src/topo/grue-modele.js';
import { ELEMENTS_FLECHE, DIMENSIONS, BLOCS } from '../src/topo/grue-liebherr-172-donnees.js';
import {
  chargeAuRayon, contrepoidsDe, poidsFleche, boutDeFleche, reglagesGrue, hauteurChoisie, hauteursDe, tourDe, ficheGrue, grueFiche, flecheDe, porteeMax, niveauxGrue,
} from '../src/topo/grue-fiche.js';
import { bornesPrimitives } from '../src/topo/blocs-dxf.js';
import { grueDeLObjet } from '../src/topo/grue-mobile.js';
import { dxfPlanChantier } from '../src/topo/plan-chantier-dxf.js';

const L = MODELE_LIEBHERR;
const C = MODELE_CONDECTA;
const FLECHES = L.fleches;
const TOURS = L.tours;
const f = (nom) => FLECHES.find((x) => x.nom === nom);
// Cadre du dessin sans les textes (leur largeur dépend de la police) : [xMin, yMin, xMax, yMax]
const cadre = (s) => { const b = bornesPrimitives(s.primitives.filter((p) => p.g !== 't')); return [b.xMin, b.yMin, b.xMax, b.yMax]; };
const fc = (nom) => C.fleches.find((x) => x.nom === nom);

describe('données Liebherr', () => {
  it('16 flèches ; tableau 2 seulement de 40,0 à 62,5 m', () => {
    expect(FLECHES).toHaveLength(16);
    expect(FLECHES.filter((x) => x.charges2).map((x) => x.nom)).toEqual([40, 42.5, 45, 47.5, 50, 52.5, 55, 57.5, 60, 62.5]);
  });
  it('longueur nominale = somme des éléments − 0,4 m ; portée maximale = nom + 1,5 m', () => {
    for (const x of FLECHES) {
      const somme = x.sections.reduce((s, i) => s + ELEMENTS_FLECHE[i].nom, 0);
      expect(somme - 0.4).toBeCloseTo(x.nom, 1);
      expect(x.rMax - x.nom).toBeCloseTo(1.5, 5);
    }
  });
  it('contrepoids : charge = 2,5 × A + 1,6 × B + 0,55 × E', () => {
    for (const x of FLECHES) expect(x.contrepoids.blocs.reduce((s, b) => s + BLOCS[b].t, 0)).toBeCloseTo(x.contrepoids.t, 6);
  });
  it('tableaux de charge décroissants, dernière portée = nom de la flèche', () => {
    for (const x of FLECHES) {
      for (const tab of [x.charges, x.charges2].filter(Boolean)) {
        expect(tab[tab.length - 1][0]).toBe(x.nom);
        for (let i = 1; i < tab.length; i++) expect(tab[i][1]).toBeLessThanOrEqual(tab[i - 1][1]);
      }
    }
  });
  it('HSC croissantes dans chaque tour (sauf la valeur suspecte de la fiche, signalée)', () => {
    for (const t of TOURS) {
      const h = hauteursDe(t);
      for (let i = 1; i < h.length; i++) if (!h[i].suspect && !h[i - 1].suspect) expect(h[i].h).toBeGreaterThan(h[i - 1].h);
    }
    expect(hauteursDe(tourDe(L, 'hc290-far-b')).filter((x) => x.suspect)).toHaveLength(2);
  });
});

describe('données Condecta EURO 4513', () => {
  it('5 flèches, nombre de paires de charges relevé sur la fiche', () => {
    expect(C.fleches.map((x) => [x.nom, x.charges.length])).toEqual([[28, 16], [35, 21], [40, 23], [43, 25], [45, 25]]);
  });
  it('charge maximale de 6 t, portée maximale = longueur de la flèche, charges décroissantes', () => {
    for (const x of C.fleches) {
      expect(x.charges[0][1]).toBe(6);
      expect(porteeMax(x)).toBe(x.nom);
      for (let i = 1; i < x.charges.length; i++) {
        expect(x.charges[i][1]).toBeLessThanOrEqual(x.charges[i - 1][1]);
        expect(x.charges[i][0]).toBeGreaterThan(x.charges[i - 1][0]);
      }
    }
  });
  it('lectures du tableau de la page 2 (portée en m → charge en t)', () => {
    expect(chargeAuRayon(fc(45), 12).t).toBe(6); // avant la 1re portée : charge maximale
    expect(chargeAuRayon(fc(45), 12.35).t).toBe(6);
    expect(chargeAuRayon(fc(45), 20).t).toBe(3.2); // portée suivante : 20,72 m
    expect(chargeAuRayon(fc(45), 30).t).toBe(2); // portée suivante : 30,68 m (2000 kg)
    expect(chargeAuRayon(fc(45), 45).t).toBe(1.25);
    expect(chargeAuRayon(fc(28), 28).t).toBe(3);
    expect(chargeAuRayon(fc(40), 40).t).toBe(1.6);
    expect(chargeAuRayon(fc(43), 43).t).toBe(1.35);
    expect(chargeAuRayon(fc(35), 35).t).toBe(2.05);
  });
  it('tableau récapitulatif de la fiche : charge 6000 kg et 3000 kg à ces portées', () => {
    const r6 = { 28: 15.54, 35: 14.17, 40: 13.28, 43: 12.53, 45: 12.35 };
    const r3 = { 28: 28.0, 35: 25.36, 40: 23.65, 43: 22.21, 45: 21.87 };
    for (const n of [28, 35, 40, 43, 45]) {
      expect(fc(n).charges[0]).toEqual([r6[n], 6]);
      expect(fc(n).charges.find(([, t]) => t === 3)[0]).toBe(r3[n]);
    }
  });
  it('contrepoids de la fiche : 32,81 t jusqu\'à HSC 27 m, 34,74 t à 30 m', () => {
    const t = C.tours[0];
    const h = (e) => hauteursDe(t).find((x) => x.etiquette === e);
    expect(contrepoidsDe(fc(40), h('18')).t).toBe(32.81);
    expect(contrepoidsDe(fc(40), h('27')).t).toBe(32.81);
    expect(contrepoidsDe(fc(40), h('30')).t).toBe(34.74);
  });
  it('dessin : flèche jusqu\'à la portée, contre-flèche de 2,75 m, pied 4,5 m coté, dimensions estimées signalées', () => {
    const s = grueFiche({ modeleGrue: C.id, fleche: 45, tour: 'euro4513', hauteur: 24 });
    expect(cadre(s)[2]).toBeGreaterThan(44.9); // le crochet à 45 m déborde de 0,28 m (rayon du crochet)
    expect(cadre(s)[2]).toBeLessThan(45.4);
    expect(cadre(s)[0]).toBeGreaterThan(-8); // pas de contre-flèche de 13 m
    expect(s.primitives.some((p) => p.g === 't' && p.t === '4.50 m')).toBe(true); // pied coté
    const fiche = ficheGrue({ modeleGrue: C.id, fleche: 45, tour: 'euro4513', hauteur: 24 });
    expect(fiche.pasDansLaFiche.join(' ')).toMatch(/estimées/);
    expect(fiche.lignes.find((l) => l.titre === 'Contrepoids').valeur).toBe('32.81 t');
  });
});

describe('charge au rayon (lecture de la fiche Liebherr)', () => {
  it('flèche 62,5 m, tableau 1 : colonnes de la page 5', () => {
    expect(chargeAuRayon(f(62.5), 62.5).t).toBe(1.6);
    expect(chargeAuRayon(f(62.5), 40).t).toBe(2.9);
    expect(chargeAuRayon(f(62.5), 16).t).toBe(8);
    expect(chargeAuRayon(f(62.5), 18).t).toBe(7.29);
  });
  it('charge maximale 8 t de 2,6 m à la limite de la fiche (16,5 m pour 62,5 m)', () => {
    expect(chargeAuRayon(f(62.5), 3)).toMatchObject({ t: 8, source: 'plein', jusqua: 16.5 });
    expect(chargeAuRayon(f(55), 20)).toMatchObject({ t: 8, source: 'plein' });
    expect(chargeAuRayon(f(55), 21).t).toBe(7.3);
  });
  it('entre deux portées : la portée suivante (prudent), jamais une valeur calculée', () => {
    const c = chargeAuRayon(f(50), 46);
    expect(c.source).toBe('colonne');
    expect(c.colonne).toBe(47.5);
    expect(c.t).toBe(3.25);
  });
  it('tableau 2 : valeurs de la page 5 ; inexistant sous 40 m → tableau 1', () => {
    expect(chargeAuRayon(f(62.5), 62.5, 'lm2').t).toBe(1.8);
    expect(chargeAuRayon(f(40), 40, 'lm2').t).toBe(4.6);
    expect(reglagesGrue({ fleche: 30, mode: 'lm2' }).mode).toBe('lm1');
  });
  it('charge en bout de flèche = dessin de la page 4', () => {
    const bouts = { 24.4: 7.45, 26.9: 6.7, 30: 5.95, 32.5: 5.45, 35: 5, 37.5: 4.65, 40: 4.3, 42.5: 3.9, 45: 3.65, 47.5: 3.25, 50: 3.05, 52.5: 2.65, 55: 2.5, 57.5: 2, 60: 1.9, 62.5: 1.6 };
    for (const [nom, t] of Object.entries(bouts)) expect(chargeAuRayon(f(Number(nom)), Number(nom)).t).toBe(t);
  });
  it('rayon hors de la plage : ramené entre 2,6 m et la portée', () => {
    expect(chargeAuRayon(f(40), 100).rayon).toBe(40);
    expect(chargeAuRayon(f(40), 0).rayon).toBe(2.6);
  });
});

describe('contrepoids, poids, HSC', () => {
  it('62,5 m = 7 × A = 17,50 t ; 55,0 m = 6 × A + 1 × E = 15,55 t', () => {
    expect(contrepoidsDe(f(62.5))).toMatchObject({ t: 17.5, texte: '7 × A' });
    expect(contrepoidsDe(f(55))).toMatchObject({ t: 15.55, texte: '6 × A + 1 × E' });
  });
  it('poids de la flèche 62,5 m = 9 160 kg', () => {
    expect(poidsFleche(L, f(62.5))).toBe(9160);
  });
  it('HSC recopiées : 16 HC 175 UC-0460m, rang 5 = 27,3 m ; 21 HC 290 UC-0800, rang 8 = 54,1 m', () => {
    expect(hauteursDe(tourDe(L, 'hc175-uc460m')).find((h) => h.etiquette === '5').h).toBe(27.3);
    expect(hauteursDe(tourDe(L, 'hc290-uc800')).find((h) => h.etiquette === '8').h).toBe(54.1);
    expect(hauteurChoisie(tourDe(L, 'hc290-uc800'), 54).h).toBe(54.1);
  });
  it('au-dessus de 50 m : alerte de la fiche ; Z du pied → Z du crochet et du haut de la grue', () => {
    const fiche = ficheGrue({ fleche: 50, tour: 'hc290-uc800', hauteur: 62.4 });
    expect(fiche.lignes.find((l) => l.titre.startsWith('HSC')).alerte).toMatch(/50 m/);
    expect(ficheGrue({ fleche: 50, tour: 'hc175-uc460m', hauteur: 27.3 }).lignes.find((l) => l.titre.startsWith('HSC')).alerte).toBeNull();
    const nv = niveauxGrue(reglagesGrue({ fleche: 50, tour: 'hc175-uc460m', hauteur: 27.3, zPied: 100 }));
    expect(nv.pied).toBe(100);
    expect(nv.crochet).toBeCloseTo(127.3, 6);
    expect(nv.flecheBas).toBeCloseTo(127.3 + 2.9, 6);
    expect(nv.haut).toBeCloseTo(127.3 + 2.9 + 1.69 + 2.5, 6);
  });
});

describe('dessin à l\'échelle', () => {
  it('de l\'arrière des contrepoids (−14,5 m) au bout de la flèche (portée maximale de la fiche à 5 cm)', () => {
    for (const nom of [24.4, 40, 62.5]) {
      const s = grueFiche({ fleche: nom });
      expect(cadre(s)[0]).toBeCloseTo(-DIMENSIONS.arriereTotal, 2);
      expect(cadre(s)[2]).toBeCloseTo(boutDeFleche(L, f(nom)), 2);
      expect(Math.abs(cadre(s)[2] - flecheDe(L, nom).rMax)).toBeLessThan(0.05);
    }
  });
  it('la flèche est faite des éléments de la fiche, bout à bout (largeur 1,20 m)', () => {
    const s = grueFiche({ fleche: 30 });
    const bords = s.primitives.filter((p) => p.g === 'h' && p.mat === 'peinture' && p.b && Math.abs(p.b[3] - p.b[1] - 1.2) < 1e-6 && p.b[0] >= 1.05).map((p) => [p.b[0], p.b[2]]).sort((a, b) => a[0] - b[0]);
    expect(bords.map((b) => Math.round((b[1] - b[0]) * 10) / 10)).toEqual([11.7, 5.6, 11.7, 1.4]);
    expect(bords[0][0]).toBeCloseTo(1.06, 2);
  });
  it('les réglages changent le dessin et le bloc DXF ; un même réglage donne le même objet', () => {
    const a = grueFiche({ fleche: 40, rayonCrochet: 20 });
    const b = grueFiche({ fleche: 40, rayonCrochet: 30 });
    expect(a.nomBloc).not.toBe(b.nomBloc);
    expect(grueFiche({ fleche: 40, rayonCrochet: 20 })).toBe(a);
    expect(a.nomBloc.length).toBeLessThanOrEqual(24);
  });
  it('le texte du crochet donne le rayon et la charge ; on peut le cacher et changer sa couleur', () => {
    const s = grueFiche({ fleche: 45, rayonCrochet: 46.5 });
    expect(s.primitives.some((p) => p.g === 't' && p.t === 'r 45.0 m · 3.65 t')).toBe(true);
    expect(grueFiche({ fleche: 45, afficherCharge: false }).primitives.some((p) => p.g === 't' && p.t.startsWith('r '))).toBe(false);
    expect(grueFiche({ fleche: 45, afficherHsc: false }).primitives.some((p) => p.g === 't' && p.t.startsWith('HSC'))).toBe(false);
    const c = grueFiche({ fleche: 45, couleurTexte: '#112233' });
    expect(c.rayon.filter((p) => p.g === 't').every((p) => p.k === '#112233' && p.perso)).toBe(true);
    expect(c.primitives.find((p) => p.g === 't' && p.t.startsWith('r ')).k).toBe('#112233');
  });
  it('la rotation de la flèche tourne le haut, pas le pied', () => {
    const a = grueFiche({ fleche: 40, tour: 'hc175-uc460m' });
    const b = grueFiche({ fleche: 40, tour: 'hc175-uc460m', rotationFleche: 90 });
    expect(cadre(b)[3]).toBeGreaterThan(cadre(a)[3] + 30);
    expect(cadre(b)[2]).toBeLessThan(cadre(a)[2] - 20);
  });
  it('cercles : principal à la portée du crochet, cercles du tableau avec leur charge', () => {
    const s = grueFiche({ fleche: 50, cercles: 'principaux' });
    expect(s.rayon.filter((p) => p.g === 'c').map((p) => p.r)).toEqual([50, 30, 40]);
    expect(s.rayon.find((p) => p.g === 't' && p.t.startsWith('40 m')).t).toBe('40 m · 3.99 t');
    expect(grueFiche({ fleche: 50, cercles: 'aucun' }).rayon.filter((p) => p.g === 'c')).toHaveLength(1);
    expect(grueFiche({ fleche: 50, cercles: 'tous' }).rayon.filter((p) => p.g === 'c').length).toBeGreaterThan(8);
  });
  it('pied toujours coté ; 4 massifs carrés (2 m au départ) sous les appuis, cotés', () => {
    const s = grueFiche({ fleche: 40, tour: 'hc175-uc460m' });
    expect(s.primitives.some((p) => p.g === 't' && p.t === '4.60 m')).toBe(true);
    expect(s.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6')).toHaveLength(0); // pas de massif sans la case
    const m = grueFiche({ fleche: 40, tour: 'hc175-uc460m', massifs: true });
    const gris = m.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6');
    expect(gris).toHaveLength(4);
    for (const g of gris) {
      expect(g.b[2] - g.b[0]).toBeCloseTo(2, 3);
      expect(g.b[3] - g.b[1]).toBeCloseTo(2, 3);
    }
    // centrés sur les 4 coins du carré d'appui de 4,60 m
    expect(gris.map((g) => [(g.b[0] + g.b[2]) / 2, (g.b[1] + g.b[3]) / 2].map((v) => Math.round(v * 100) / 100)).sort()).toEqual([[-2.3, -2.3], [-2.3, 2.3], [2.3, -2.3], [2.3, 2.3]]);
    expect(m.primitives.filter((p) => p.g === 't' && p.t === '2.00 m')).toHaveLength(2); // cote au-dessus et à droite
    const g3 = grueFiche({ fleche: 40, tour: 'hc175-uc460m', massifs: true, massifL: 3 });
    expect(g3.primitives.some((p) => p.g === 't' && p.t === '3.00 m')).toBe(true);
    expect(g3.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6')[0].b[2] - g3.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6')[0].b[0]).toBeCloseTo(3, 3);
  });
  it('les massifs suivent l\'orientation du pied (pas de la flèche) ; ancrage fixe : 4 massifs aux coins du mât', () => {
    const fa = grueFiche({ fleche: 40, tour: 'hc175-far', massifs: true });
    expect(fa.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6')).toHaveLength(4);
    const a = grueFiche({ fleche: 40, tour: 'hc175-uc460m', massifs: true });
    const b = grueFiche({ fleche: 40, tour: 'hc175-uc460m', massifs: true, rotationFleche: 90 });
    const pos = (x) => x.primitives.filter((p) => p.g === 'h' && p.k === '#b9bfc6').map((g) => g.b.join());
    expect(pos(b)).toEqual(pos(a));
  });
  it('branchée aux plans de chantier et au DXF', () => {
    const o = { id: 'g1', type: 'grue', modele: 'fiche', modeleGrue: L.id, point: [2500000, 1120000], rotation: 30, fleche: 45, tour: 'hc175-uc460m', hauteur: 27.3, rayon: true, phase: 'p1' };
    expect(grueDeLObjet([], o).modele).toBe('fiche');
    const plan = { id: 'x', nom: 'Essai', genre: 'pic', phases: [{ id: 'p1', nom: 'Phase 1', couleur: '#2563eb', visible: true }], phaseActive: 'p1', couleurs: 'objets', objets: [o], fond: {} };
    const dxf = dxfPlanChantier(plan, []);
    expect(dxf).toMatch(/GRUE_[0-9A-Z]{4}_45M_/);
    expect(dxf).toContain('CIRCLE');
  });
});

describe('modèles de l\'utilisateur et éditeur', () => {
  it('lecture des charges tapées (portée:charge), tri, erreurs compréhensibles', () => {
    expect(lireCharges('30:2, 20:5,25:3.5').liste).toEqual([[20, 5], [25, 3.5], [30, 2]]);
    expect(lireCharges('20:5, abc').erreurs[0]).toMatch(/portée:charge/);
    expect(lireCharges('20:2, 30:5').erreurs[0]).toMatch(/augmente/);
    expect(texteCharges([[20, 5], [25, 3.5]])).toBe('20:5, 25:3.5');
  });
  it('lecture des HSC tapées', () => {
    expect(lireHauteurs('18, 21, rang 3:14.8').liste).toEqual([['18', 18], ['21', 21], ['rang 3', 14.8]]);
    expect(lireHauteurs('x').erreurs).toHaveLength(1);
    expect(texteHauteurs([['18', 18], ['rang 3', 14.8]])).toBe('18, rang 3:14.8');
  });
  it('contrôle d\'un modèle : un neuf est valide ; sans flèche ni tour il est refusé', () => {
    expect(validerModele(modeleVide())).toEqual([]);
    const m = modeleVide();
    m.fleches = [];
    m.tours = [];
    expect(validerModele(m).length).toBeGreaterThanOrEqual(2);
  });
  it('un modèle du projet est utilisable (registre) et se dessine', () => {
    const m = copierModele(C, 'Ma grue');
    m.fleches = [{ nom: 30, rMax: 30, charges: [[10, 4], [20, 2], [30, 1]] }];
    definirModelesPerso([m]);
    expect(modeleDe(m.id).nom).toBe('Ma grue');
    const s = grueFiche({ modeleGrue: m.id, fleche: 30, tour: 'euro4513', hauteur: 21 });
    expect(s.fleche).toBe(30);
    expect(chargeAuRayon(m.fleches[0], 15).t).toBe(2);
    definirModelesPerso([]);
    expect(modeleDe(m.id).id).toBe(L.id); // modèle supprimé : retour au modèle livré
  });
});
