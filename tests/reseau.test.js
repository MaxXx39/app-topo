// Tests du recollement de réseaux (formules validées par l'utilisateur le 30.10.2026).
import { describe, it, expect } from 'vitest';
import { filDEauDepuisDessus, penteTroncon, profondeurChambre, radierChambre, chambreDepuisTroisCoins } from '../src/topo/reseau.js';
import {
  creerRecollement, ajouterPointReseau, prochainNomReseau, conduiteEnCours, nouvelleConduite, tronconsConduite,
  dernierTroncon, mesuresOuvrage, annulerDernierPointReseau, estOuvrage,
} from '../src/topo/reseau.js';
import { assemblerReseaux, partDesReseaux, RESEAUX_DEPART } from '../src/leve/reseaux.js';

describe('recollement de réseaux', () => {
  it('fil d\'eau = altitude du dessus − diamètre extérieur', () => {
    expect(filDEauDepuisDessus(450.5, 315)).toBeCloseTo(450.185, 9);
  });

  it('pente négative quand ça descend, avec le sens d\'écoulement', () => {
    const a = { est: 0, nord: 0, filEau: 450 };
    const b = { est: 30, nord: 40, filEau: 449 }; // 50 m à plat, descend de 1 m
    const descend = penteTroncon(a, b);
    expect(descend.distance).toBeCloseTo(50, 9);
    expect(descend.pente).toBeCloseTo(-2, 9);
    expect(descend.sens).toBe('a-b');
    const monte = penteTroncon(b, a);
    expect(monte.pente).toBeCloseTo(2, 9);
    expect(monte.sens).toBe('b-a');
    expect(penteTroncon(a, { ...b, filEau: 450 }).sens).toBe('plat');
  });

  it('pas de pente sans fil d\'eau ou au même endroit', () => {
    expect(penteTroncon({ est: 0, nord: 0 }, { est: 1, nord: 0, filEau: 1 }).pente).toBeNull();
    expect(penteTroncon({ est: 0, nord: 0, filEau: 1 }, { est: 0, nord: 0, filEau: 2 }).pente).toBeNull();
  });

  it('profondeur : calculée si tampon et radier, sinon tapée ; radier déduit', () => {
    expect(profondeurChambre({ tampon: 452, radier: 449.5, saisie: 9 })).toBeCloseTo(2.5, 9);
    expect(profondeurChambre({ tampon: 452, saisie: 2.4 })).toBe(2.4);
    expect(profondeurChambre({})).toBeNull();
    expect(radierChambre({ tampon: 452, saisie: 2.4 })).toBeCloseTo(449.6, 9);
    expect(radierChambre({ tampon: 452, radier: 449.5, saisie: 2.4 })).toBe(449.5);
    expect(radierChambre({ saisie: 2.4 })).toBeNull();
  });

  it('chambre rectangulaire : 3 coins dans n\'importe quel ordre', () => {
    const coins = [{ est: 0, nord: 0, altitude: 450 }, { est: 2, nord: 0, altitude: 450.02 }, { est: 2, nord: 1, altitude: 450.01 }];
    const ordres = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2]];
    for (const ordre of ordres) {
      const c = chambreDepuisTroisCoins(ordre.map((i) => coins[i]));
      expect(c.centre.est).toBeCloseTo(1, 9);
      expect(c.centre.nord).toBeCloseTo(0.5, 9);
      expect([c.cote1, c.cote2].sort()).toEqual([1, 2]);
      expect(c.tampon).toBeCloseTo(450.01, 9);
      expect(c.ecartAngleDroit).toBeLessThan(1e-6);
      expect(c.coins.some((k) => Math.abs(k.est) < 1e-9 && Math.abs(k.nord - 1) < 1e-9)).toBe(true); // 4e coin
    }
  });

  it('refuse un nombre de coins faux ou deux coins confondus', () => {
    expect(() => chambreDepuisTroisCoins([])).toThrow();
    const p = { est: 0, nord: 0, altitude: 1 };
    expect(() => chambreDepuisTroisCoins([p, p, { est: 1, nord: 1, altitude: 1 }])).toThrow();
  });
});

/** Projet minimal avec une liste de points vide et un levé de recollement EU. */
function projetEssai() {
  const leve = { id: 'l1', nom: 'LV-EU 1', points: [] };
  const projet = { leves: [leve], reseaux: [] };
  const recollement = creerRecollement(projet, leve, 'EU');
  return { projet, leve, recollement };
}

/** Lève un point avec le nom proposé. */
function lever(essai, element, est, nord, altitude, autres = {}) {
  const { projet, leve, recollement } = essai;
  const nom = prochainNomReseau(projet, recollement, element, autres.forme);
  return ajouterPointReseau(projet, leve, recollement, { nom, est, nord, altitude }, { element, ...autres });
}

describe('levé de recollement', () => {
  it('nomme le levé par réseau : LV-EU 1, LV-EU 2', () => {
    const { projet, leve, recollement } = projetEssai();
    expect(recollement.nom).toBe('LV-EU 1');
    expect(creerRecollement(projet, leve, 'EU').nom).toBe('LV-EU 2');
    expect(creerRecollement(projet, leve, 'EC').nom).toBe('LV-EC 1');
  });

  it('chambre ronde, tuyau, coude, chambre : une conduite avec pentes', () => {
    const essai = projetEssai();
    const ch1 = lever(essai, 'chambre', 0, 0, 452, { diametre: 1000 });
    expect(ch1.point.nom).toBe('CH-EU-1');
    ch1.ouvrage.radier = 450;
    const t1 = lever(essai, 'tuyau', 10, 0, 450.115, { diametre: 315, materiau: 'PVC' }); // fil d'eau 449.8
    expect(t1.point.nom).toBe('T-EU-1-1');
    expect(t1.conduite.noeuds[0]).toEqual({ ouvrage: ch1.ouvrage.id }); // part de la dernière chambre
    expect(lever(essai, 'coude', 20, 0, 449.915, { diametre: 315 }).point.nom).toBe('T-EU-1-2'); // 449.6
    const ch2 = lever(essai, 'chambre', 30, 0, 451.8);
    ch2.ouvrage.profondeurSaisie = 2.4; // radier 449.4
    const troncons = tronconsConduite(essai.recollement, essai.leve, conduiteEnCours(essai.recollement));
    expect(troncons).toHaveLength(3);
    for (const t of troncons) {
      expect(t.pente).toBeCloseTo(-2, 6);
      expect(t.sens).toBe('a-b');
    }
    expect(dernierTroncon(essai.recollement, essai.leve).b.nom).toBe('CH-EU-2');
    expect(mesuresOuvrage(ch2.ouvrage).radier).toBeCloseTo(449.4, 9);
    expect(mesuresOuvrage(ch1.ouvrage).profondeur).toBeCloseTo(2, 9);
    expect(essai.leve.points[1]).toMatchObject({ element: 'tuyau', diametre: 315, materiau: 'PVC' });
  });

  it('chambre rectangulaire : 3 coins, puis centre et tampon', () => {
    const essai = projetEssai();
    expect(lever(essai, 'chambre', 0, 0, 450, { forme: 'rect' }).point.nom).toBe('CH-EU-1-1');
    expect(prochainNomReseau(essai.projet, essai.recollement, 'chambre', 'rect')).toBe('CH-EU-1-2');
    lever(essai, 'chambre', 2, 1, 450, { forme: 'rect' });
    const fin = lever(essai, 'chambre', 2, 0, 450.03, { forme: 'rect' });
    expect(fin.ouvrage.nom).toBe('CH-EU-1');
    expect(fin.ouvrage.centre.est).toBeCloseTo(1, 9);
    expect(fin.ouvrage.tampon).toBeCloseTo(450.01, 9);
    expect(essai.recollement.enCours.ouvrage).toBeNull();
    expect(prochainNomReseau(essai.projet, essai.recollement, 'chambre', 'rect')).toBe('CH-EU-2-1');
  });

  it('nouvelle conduite : nouveau numéro, depuis l\'ouvrage choisi', () => {
    const essai = projetEssai();
    const ch = lever(essai, 'chambre', 0, 0, 452);
    lever(essai, 'tuyau', 5, 0, 451);
    nouvelleConduite(essai.recollement, ch.ouvrage.id);
    expect(lever(essai, 'branchement', 0, 5, 451).point.nom).toBe('T-EU-2-1');
    expect(conduiteEnCours(essai.recollement).noeuds[0]).toEqual({ ouvrage: ch.ouvrage.id });
  });

  it('refuse un nom déjà pris ou vide', () => {
    const essai = projetEssai();
    lever(essai, 'chambre', 0, 0, 452);
    const { projet, leve, recollement } = essai;
    expect(ajouterPointReseau(projet, leve, recollement, { nom: 'CH-EU-1', est: 1, nord: 1, altitude: 1 }, { element: 'tuyau' }).erreur).toMatch(/déjà pris/);
    expect(ajouterPointReseau(projet, leve, recollement, { nom: ' ', est: 1, nord: 1, altitude: 1 }, { element: 'tuyau' }).erreur).toBeTruthy();
  });

  it('annule le dernier point (point de conduite, coin de chambre)', () => {
    const essai = projetEssai();
    lever(essai, 'chambre', 0, 0, 452);
    lever(essai, 'tuyau', 5, 0, 451);
    annulerDernierPointReseau(essai.recollement, essai.leve);
    expect(conduiteEnCours(essai.recollement).noeuds).toHaveLength(1);
    lever(essai, 'regard', 0, 0, 450, { forme: 'rect' });
    lever(essai, 'regard', 1, 0, 450, { forme: 'rect' });
    lever(essai, 'regard', 1, 1, 450, { forme: 'rect' });
    annulerDernierPointReseau(essai.recollement, essai.leve);
    const regard = essai.recollement.ouvrages.at(-1);
    expect(regard.points).toHaveLength(2);
    expect(regard.centre).toBeNull();
    expect(essai.recollement.enCours.ouvrage).toBe(regard.id);
    expect(estOuvrage('grille')).toBe(true);
    expect(estOuvrage('coude')).toBe(false);
  });

  it('liste des réseaux : couleur des départs modifiable, ajoutés gardés', () => {
    const liste = assemblerReseaux({ ajoutes: [['FO', 'fibre', '#111827'], ['EU', 'doublon', '']], couleurs: { EU: '#7c3aed' } });
    expect(liste).toHaveLength(RESEAUX_DEPART.length + 1);
    expect(liste[0]).toEqual(['EU', 'eaux usées', '#7c3aed']);
    expect(partDesReseaux(liste)).toEqual({ ajoutes: [['FO', 'fibre', '#111827']], couleurs: { EU: '#7c3aed' } });
  });
});
