import { describe, it, expect } from 'vitest';
import { nomFichierExport, dateDuJour } from '../src/outils/nom-fichier.js';

describe('nom des fichiers exportés', () => {
  it('suit le modèle affaire_contenu_date', () => {
    expect(nomFichierExport('10 203 - Gland', 'points', '2026-11-16')).toBe('10_203_-_Gland_points_2026-11-16');
  });
  it('remplace les caractères interdits et complète une affaire vide', () => {
    expect(nomFichierExport('', 'volumes', '2026-11-16')).toBe('projet_volumes_2026-11-16');
    expect(nomFichierExport('a/b:c', 'x', '2026-01-02')).toBe('a_b_c_x_2026-01-02');
  });
  it('donne la date du jour au bon format', () => {
    expect(dateDuJour(new Date(2026, 10, 5))).toBe('2026-11-05');
  });
});
