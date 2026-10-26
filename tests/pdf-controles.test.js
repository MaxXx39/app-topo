// PDF des autocontrôles (Terrain › Contrôler).
import { describe, it, expect } from 'vitest';
import { pdfControles } from '../src/export/pdf-controles.js';
import { creerProjet } from '../src/projet/projet.js';

/** Projet avec "nombre" contrôles verts et un refus. */
function projetAvecControles(nombre) {
  const projet = creerProjet();
  projet.cartouche.affaire = '10 203';
  projet.pointsControle.push({ id: 'p', nom: 'PF1', est: 2500000, nord: 1100000, altitude: 450 });
  for (let i = 0; i < nombre; i += 1) {
    projet.controles.push({
      id: `c${i}`, type: 'mesure', pointId: 'p', nom: 'PF1', le: new Date(2026, 9, 26, 7, i).toISOString(),
      connu: { est: 2500000, nord: 1100000, altitude: 450 }, mesure: { est: 2500000.01, nord: 1100000, altitude: 450.01 },
      ecarts: { est: 0.01, nord: 0, plan: 0.01, hauteur: 0.01 }, resultat: { plan: 'vert', hauteur: 'vert', global: 'vert' },
      gnss: { precisionH: 0.008, precisionV: 0.012, nbSatellites: 24 }, remarque: '',
    });
  }
  projet.controles.push({ id: 'r', type: 'refus', appareil: 'Tablette 1', le: new Date(2026, 9, 26, 12).toISOString() });
  return projet;
}

const pages = (texte) => (texte.match(/\/Type \/Page\b/g) ?? []).length;

describe('PDF des contrôles', () => {
  it('une feuille avec le titre, le point, le refus et le cartouche', async () => {
    const texte = await pdfControles(projetAvecControles(3)).text();
    expect(texte).toContain('Autocontr');
    expect(texte).toContain('PF1');
    expect(texte).toContain('REFUS');
    expect(texte).toContain('10 203');
    expect(pages(texte)).toBe(1);
  });

  it('plusieurs feuilles quand les contrôles ne tiennent pas sur une seule', async () => {
    expect(pages(await pdfControles(projetAvecControles(60)).text())).toBe(2);
  });
});
