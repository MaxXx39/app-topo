// Export « Cadastre · Swisstopo · photo » (0.121.0, Projet › Exporter, Expert) : un seul DXF avec un calque
// par élément : CADASTRE_LIGNES (lignes des limites), CADASTRE_POINTS et CADASTRE_NOMS (points CAD-n),
// SWISSTOPO_3D (surface swisstopo en faces 3D, X = Est, Y = Nord, Z = altitude, MN95, mètres).
import { genererDxfPlan } from './dxf-recale.js';
import { ecrireDxf, xyz, texteAscii } from './dxf.js';

/** Entités (lignes de code DXF) d'un texte DXF complet : ce qui est entre ENTITIES et ENDSEC. */
export function entitesDeDxf(texte) {
  const lignes = texte.split(/\r?\n/);
  const debut = lignes.indexOf('ENTITIES');
  if (debut < 0) return [];
  const fin = lignes.indexOf('ENDSEC', debut);
  // On enlève le « 0 » (SECTION) devant « ENTITIES » et celui qui précède « ENDSEC ».
  return lignes.slice(debut + 1, fin - 1);
}

/**
 * Texte du DXF. cadastres : [{ leve (points CAD-n), plan (plan DXF des limites, ou null) }] ;
 * swisstopo : [{ triangles : [[p, p, p]] }] (points { est, nord, altitude }).
 * Chaque calque n'existe que s'il a du contenu.
 */
export function genererDxfPaquet({ cadastres = [], swisstopo = [] }) {
  const calques = new Map();
  const entites = [];
  for (const { leve, plan } of cadastres) {
    if (plan) {
      // Tout le plan sur un seul calque : CADASTRE_LIGNES.
      const unSeulCalque = {
        ...plan,
        calques: [{ nom: 'CADASTRE_LIGNES', couleur: '#7c3aed' }],
        contenu: { traits: (plan.contenu?.traits ?? []).map((t) => ({ ...t, c: 0 })) },
      };
      const lignes = entitesDeDxf(genererDxfPlan(unSeulCalque));
      if (lignes.length > 0) {
        calques.set('CADASTRE_LIGNES', 6);
        entites.push(lignes);
      }
    }
    for (const p of leve?.points ?? []) {
      calques.set('CADASTRE_POINTS', 3);
      calques.set('CADASTRE_NOMS', 7);
      entites.push(['0', 'POINT', '8', 'CADASTRE_POINTS', ...xyz(p, 0)]);
      entites.push(['0', 'TEXT', '8', 'CADASTRE_NOMS', ...xyz({ ...p, est: p.est + 0.2, nord: p.nord + 0.2 }, 0), '40', '0.3', '1', texteAscii(String(p.nom))]);
    }
  }
  for (const { triangles } of swisstopo) {
    for (const [a, b, c] of triangles ?? []) {
      calques.set('SWISSTOPO_3D', 8);
      entites.push(['0', '3DFACE', '8', 'SWISSTOPO_3D', ...xyz(a, 0), ...xyz(b, 1), ...xyz(c, 2), ...xyz(c, 3)]);
    }
  }
  return ecrireDxf(calques, entites);
}
