// 0.214.0 : bandeau au-dessus de la règle du Guidage : MONTER / DESCENDRE seulement hors de la tolérance orange.
import { describe, expect, it } from 'vitest';
import { bandeauRegle } from '../src/leve/lame-ecran.js';

describe('bandeau de la règle du Guidage', () => {
  it('rouge : monter, avec la valeur en cm', () => {
    const html = bandeauRegle({ ecart: 0.07, classe: 'rouge' }, 'G');
    expect(html).toContain('monter');
    expect(html).toContain('MONTER');
    expect(html).toContain('7.0 cm');
    expect(html).toContain('>G<');
  });

  it('rouge : descendre quand l\'écart est négatif', () => {
    const html = bandeauRegle({ ecart: -0.062, classe: 'rouge' }, 'D');
    expect(html).toContain('descendre');
    expect(html).toContain('6.2 cm');
  });

  it('dans la tolérance orange : aucune direction, pour que l\'affichage ne saute pas', () => {
    for (const ecart of [0.03, -0.03]) {
      const html = bandeauRegle({ ecart, classe: 'orange' }, 'G');
      expect(html).toContain('proche');
      expect(html).not.toContain('MONTER');
      expect(html).not.toContain('DESCENDRE');
    }
  });

  it('vert : OK ; sans écart : tiret', () => {
    expect(bandeauRegle({ ecart: 0.01, classe: 'vert' }, 'G')).toContain('OK');
    expect(bandeauRegle(null, 'G')).toContain('attente');
    expect(bandeauRegle({ ecart: null }, 'G')).toContain('hors');
  });
});
