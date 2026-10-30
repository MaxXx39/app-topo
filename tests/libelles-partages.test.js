import { describe, it, expect } from 'vitest';
import { assemblerLibelles, partDesLibelles, abreviationsDepart, LIBELLES_DEPART } from '../src/leve/libelles.js';

describe('libellés partagés (0.95.0)', () => {
  it('garde toujours ceux de départ, avec leur couleur, puis ceux ajoutés', () => {
    const libelles = assemblerLibelles({
      ajoutes: { lignes: [['EAU', 'conduite d\'eau', '#2563eb'], ['HT', 'remplacé ?', '']] },
      couleurs: { lignes: { HT: '#dc2626' } },
    });
    expect(libelles.lignes[0]).toEqual(['HT', 'haut de talus', '#dc2626', '']);
    expect(libelles.lignes.at(-1)).toEqual(['EAU', 'conduite d\'eau', '#2563eb', '']);
    // Un ajouté qui porte le nom d'un libellé de départ est ignoré.
    expect(libelles.lignes.filter(([a]) => a === 'HT')).toHaveLength(1);
    expect(libelles.points).toHaveLength(LIBELLES_DEPART.points.length);
  });

  it('ne partage que les ajoutés, et la couleur et la forme des libellés de départ', async () => {
    const libelles = assemblerLibelles(null);
    libelles.points.push(['VAN', 'vanne', '', 'carre-vide']);
    libelles.points[0][2] = '#111827';
    libelles.points[1][3] = 'croix';
    const part = partDesLibelles(libelles);
    expect(part.ajoutes.points).toEqual([['VAN', 'vanne', '', 'carre-vide']]);
    expect(part.couleurs.points).toEqual({ TN: '#111827' });
    expect(part.formes.points).toEqual({ RG: 'croix' });
    const { formeDuNom } = await import('../src/leve/libelles.js');
    expect(formeDuNom('P-RG-4', assemblerLibelles(part))).toBe('croix');
    expect(formeDuNom('P-VAN-1', assemblerLibelles(part))).toBe('carre-vide');
    expect(formeDuNom('b12', assemblerLibelles(part))).toBe('');
    expect(assemblerLibelles(part).points.at(-1)[0]).toBe('VAN');
    expect(abreviationsDepart('aires').has('ENR')).toBe(true);
  });
});
