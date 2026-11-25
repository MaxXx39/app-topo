// Accroches d'une grue posée sur un plan de chantier (0.317.0, demande du 25.11) : les 4 coins de son châssis (carré d'appui),
// les milieux des côtés, les deux diagonales (leur croisement et leur milieu = l'axe de la tour) et l'axe de la tour (sommet).
import { reglagesGrue, appuisDuPied } from './grue-fiche.js';
import { versTerrainSymbole, coteChassis } from './symboles.js';

/** Côté du carré d'appui (m) d'une grue posée, ou null si on ne le sait pas (autres modèles). */
export function coteDuPiedDeLaGrue(o) {
  try {
    if (o.modele === 'fiche') return 2 * appuisDuPied(reglagesGrue(o).tour)[0][0];
    if (o.modele === 'tour' || o.modele === 'auto') return coteChassis(o.chassis);
  } catch {
    return null;
  }
  return null;
}

/** Lignes d'accroche [{ points: [{ est, nord, altitude }], ferme }] d'une grue (E, N en m). */
export function lignesChassisGrue(o) {
  const c = coteDuPiedDeLaGrue(o);
  if (!c) return [];
  const d = c / 2;
  const f = versTerrainSymbole(o);
  const pt = ([x, y]) => {
    const [est, nord] = f(x, y);
    return { est, nord, altitude: null };
  };
  return [
    { points: [[d, d], [d, -d], [-d, -d], [-d, d]].map(pt), ferme: true },
    { points: [[d, d], [-d, -d]].map(pt), ferme: false },
    { points: [[d, -d], [-d, d]].map(pt), ferme: false },
    { points: [[0, 0], [0.001, 0]].map(pt), ferme: false },
  ];
}
