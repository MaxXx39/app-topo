import { describe, it, expect } from 'vitest';
import { creerSuiviOrientation } from '../src/leve/orientation.js';

const etatSansIncl = { connecte: true, recu: true, inclinaisonPrete: false, cap: 80, position: { est: 2500000, nord: 1120000 } };

describe('orientation : boussole de la tablette quand l\'inclinaison est perdue', () => {
  it('inclinaison prête : le cap du GNSS passe avant la boussole', () => {
    const s = creerSuiviOrientation('rx2');
    const r = s.ajouter({ ...etatSansIncl, inclinaisonPrete: true }, 1000, 200);
    expect(r.source).toBe('rx2');
    expect(r.azimut).toBe(80);
  });
  it('inclinaison perdue : la boussole remplace le cap GNSS', () => {
    const s = creerSuiviOrientation('rx2');
    const r = s.ajouter(etatSansIncl, 1000, 200);
    expect(r.source).toBe('boussole');
    expect(r.azimut).toBe(200);
  });
  it('sans boussole : comportement d\'avant (rien sans marche)', () => {
    const s = creerSuiviOrientation('rx2');
    expect(s.ajouter(etatSansIncl, 1000).azimut).toBeNull();
  });
  it('source « marche » choisie : la boussole n\'est pas utilisée', () => {
    const s = creerSuiviOrientation('marche');
    expect(s.ajouter(etatSansIncl, 1000, 200).azimut).toBeNull();
  });
});
