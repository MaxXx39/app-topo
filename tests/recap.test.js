import { describe, it, expect } from 'vitest';
import { semaineDe, ongletsDuRecap } from '../src/recap/recap.js';
import { journalVide, noter } from '../src/recap/journal.js';
import { creerXlsx, crc32, nomColonne } from '../src/recap/xlsx.js';

describe('recap des contrôles', () => {
  it('trouve la semaine ISO', () => {
    expect(semaineDe('2026-11-03')).toMatchObject({ annee: 2026, numero: 45, lundi: '2026-11-02', dimanche: '2026-11-08' });
    expect(semaineDe('2027-01-01')).toMatchObject({ annee: 2026, numero: 53 });
  });

  it('montre qui a contrôlé et qui a travaillé sans contrôle', () => {
    const projet = { id: 'p1', nom: '10203' };
    const t1 = journalVide({ id: 'a1', nom: 'Tablette 1' });
    const le = new Date(2026, 10, 3, 7, 45);
    noter(t1, projet, { type: 'controle', controle: { id: 'c1', type: 'mesure', nom: 'PC1', ecarts: { est: 0.0123, nord: 0, plan: 0.0123, hauteur: -0.02 }, le: le.toISOString() } }, le);
    noter(t1, projet, { type: 'point', controleRecent: true }, new Date(2026, 10, 3, 8, 0));
    const t2 = journalVide({ id: 'a2', nom: 'Tablette 2' });
    noter(t2, projet, { type: 'point', controleRecent: false }, new Date(2026, 10, 3, 9, 10));
    const onglets = ongletsDuRecap([t1, t2], new Date(2026, 10, 4, 6, 0));
    expect(onglets.map((o) => o.nom)).toEqual(['Synthèse', 'S45 2026']);
    const synthese = onglets[0].lignes.slice(4);
    expect(synthese).toEqual([
      ['S45 2026', '02.11.2026', '08.11.2026', 'Tablette 1', 1, '10203', 1, 0, 0, 0, 0],
      ['S45 2026', '02.11.2026', '08.11.2026', 'Tablette 2', 1, '10203', 0, 0, 1, 1, 0],
    ]);
    const semaine = onglets[1].lignes;
    const controle = semaine.find((l) => l[4] === 'PC1');
    expect(controle).toEqual(['03.11.2026', '07:45', '10203', 'Tablette 1', 'PC1', 0.012, 0, 0.012, -0.02, '', '']);
    expect(semaine.some((l) => l[3] === 'Tablette 2' && l[1] === '09:10')).toBe(true);
  });

  it('fabrique un fichier xlsx (zip) lisible', () => {
    const octets = creerXlsx([{ nom: 'Synthèse', lignes: [['a', 1.5, null, { v: 'b', style: 'gras' }]] }]);
    expect(octets[0]).toBe(0x50); // « PK »
    expect(octets[1]).toBe(0x4b);
    const texte = new TextDecoder().decode(octets);
    expect(texte).toContain('<sheet name="Synthèse"');
    expect(texte).toContain('<c r="B1" s="3"><v>1.5</v></c>');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(nomColonne(0)).toBe('A');
    expect(nomColonne(27)).toBe('AB');
  });
});
