import { describe, it, expect } from 'vitest';
import { MODELE_LIEBHERR_81K, validerModele, MODELES_DE_BASE, lireCharges, texteCharges } from '../src/topo/grue-modele.js';
import { chargeAuRayon, flecheDe, grueFiche, porteeMax } from '../src/topo/grue-fiche.js';

const M = MODELE_LIEBHERR_81K;
const f = (nom) => flecheDe(M, nom);

describe('Liebherr 81 K.1 (fiche du 28.11)', () => {
  it('modèle livré, valable, 5 flèches de 31 à 48 m, 11 HSC de 17,4 à 40,4 m', () => {
    expect(MODELES_DE_BASE.map((m) => m.id)).toContain('liebherr-81k1');
    expect(validerModele(M)).toEqual([]);
    expect(M.fleches.map((x) => x.nom)).toEqual([31, 37, 42, 45, 48]);
    expect(M.tours[0].hauteurs.map(([, h]) => h)).toEqual([17.4, 19.8, 22.2, 24.6, 26.0, 28.4, 30.8, 33.2, 35.6, 38.0, 40.4]);
  });
  it('tableaux : charges qui ne remontent jamais, portée max = longueur de flèche', () => {
    for (const x of M.fleches) {
      for (const tab of [x.charges, x.charges2]) expect(lireCharges(texteCharges(tab)).erreurs).toEqual([]);
      expect(porteeMax(x)).toBe(x.nom);
    }
  });
  it('valeurs de la fiche (LM 1 et Load-Plus)', () => {
    expect(chargeAuRayon(f(48), 48).t).toBe(1.1); // LM 1 : 1100 kg à 48 m
    expect(chargeAuRayon(f(48), 48, 'lm2').t).toBe(1.35); // Load-Plus : 1350 kg
    expect(chargeAuRayon(f(45), 13).t).toBe(6); // 6 t de 3,0 à 13,3 m
    expect(chargeAuRayon(f(45), 14).t).toBe(5.22); // entre 13,3 et 15 m : la colonne 15 m (côté prudent)
    expect(chargeAuRayon(f(31), 31).t).toBe(2.9);
    expect(chargeAuRayon(f(37), 37, 'lm2').t).toBe(2.35);
    expect(chargeAuRayon(f(42), 30).t).toBe(2.4); // colonne 31 m
  });
  it('se dessine (cabine, rayon arrière 3,50 m)', () => {
    const s = grueFiche({ modeleGrue: M.id, fleche: 48, hauteur: 26 });
    expect(s.primitives.length).toBeGreaterThan(20);
    expect(JSON.stringify(s)).toContain('vitre');
  });
});
