import { describe, it, expect } from 'vitest';
import { assemblerLibelles, partDesLibelles, abreviationsDepart, LIBELLES_DEPART } from '../src/leve/libelles.js';

describe('libellés partagés (0.95.0)', () => {
  it('garde toujours ceux de départ, avec leur couleur, puis ceux ajoutés', () => {
    const libelles = assemblerLibelles({
      ajoutes: { lignes: [['EAU', 'conduite d\'eau', '#2563eb'], ['HT', 'remplacé ?', '']] },
      couleurs: { lignes: { HT: '#dc2626' } },
    });
    expect(libelles.lignes[0]).toEqual(['HT', 'haut de talus', '#dc2626']);
    expect(libelles.lignes.at(-1)).toEqual(['EAU', 'conduite d\'eau', '#2563eb']);
    // Un ajouté qui porte le nom d'un libellé de départ est ignoré.
    expect(libelles.lignes.filter(([a]) => a === 'HT')).toHaveLength(1);
    expect(libelles.points).toHaveLength(LIBELLES_DEPART.points.length);
  });

  it('ne partage que les ajoutés et les couleurs des libellés de départ', () => {
    const libelles = assemblerLibelles(null);
    libelles.points.push(['VAN', 'vanne', '']);
    libelles.points[0][2] = '#111827';
    const part = partDesLibelles(libelles);
    expect(part.ajoutes.points).toEqual([['VAN', 'vanne', '']]);
    expect(part.couleurs.points).toEqual({ TN: '#111827' });
    expect(assemblerLibelles(part).points.at(-1)[0]).toBe('VAN');
    expect(abreviationsDepart('aires').has('ENR')).toBe(true);
  });
});
