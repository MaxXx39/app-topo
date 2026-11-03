// Relais du cadastre (site internet) : seules les demandes au service de Vaud passent par le relais.
import { describe, it, expect } from 'vitest';
import { adresseParRelais } from '../src/import/relais.js';

describe('adresse par le relais du cadastre', () => {
  const relais = 'https://cadastre-topo.exemple.workers.dev/';
  it('le service RDPPF de Vaud passe par le relais (adresse encodée)', () => {
    const adresse = 'https://www.rdppf.vd.ch/ws/RdppfSVC.svc/getegrid/xml/?EN=2538000,1152000';
    expect(adresseParRelais(adresse, relais)).toBe(`https://cadastre-topo.exemple.workers.dev/?url=${encodeURIComponent(adresse)}`);
  });
  it('geodienste.ch et les autres adresses ne changent pas', () => {
    const adresse = 'https://geodienste.ch/db/av_0/fra?SERVICE=WFS';
    expect(adresseParRelais(adresse, relais)).toBe(adresse);
  });
  it('sans relais, rien ne change', () => {
    const adresse = 'https://www.rdppf.vd.ch/ws/RdppfSVC.svc/getegrid/xml/?EN=1,2';
    expect(adresseParRelais(adresse, '')).toBe(adresse);
  });
});
