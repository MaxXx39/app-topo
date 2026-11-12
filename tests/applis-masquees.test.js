import { describe, it, expect } from 'vitest';
import { lireMasquees, ecrireMasquees, changerMasquee, sansMasquees } from '../src/navigation/applis.js';

const memoire = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

describe('applications masquées', () => {
  it('masque puis fait revenir', () => {
    let l = changerMasquee([], 'annotation', true);
    l = changerMasquee(l, 'annotation', true); // deux fois : une seule entrée
    expect(l).toEqual(['annotation']);
    l = changerMasquee(l, 'controle', true);
    expect(changerMasquee(l, 'annotation', false)).toEqual(['controle']);
  });
  it('garde la liste sur la tablette', () => {
    const m = memoire();
    expect(lireMasquees(m)).toEqual([]);
    ecrireMasquees(['a', 'b'], m);
    expect(lireMasquees(m)).toEqual(['a', 'b']);
    m.setItem('topo-applis-masquees', 'pas du json');
    expect(lireMasquees(m)).toEqual([]);
  });
  it('retire les applications masquées en gardant l\'ordre', () => {
    const applis = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
    expect(sansMasquees(applis, ['b']).map((x) => x.cle)).toEqual(['a', 'c']);
  });
});
