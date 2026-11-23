// Plans de chantier (0.293.0) : panneau de déviation suisse (plaque orange, texte noir, flèche noire), texte et sens au choix.
// C'est un symbole « dynamique » : sa largeur suit le texte ; le texte est dessiné tel quel (noir, gras), sans plaque blanche.
import { rectArrondi, plein, piece, texte, NOIR } from './symboles-outils.js';
import { versSymbole } from './symboles-retouches.js';

export const CLE_DEVIATION = 'dyn:deviation';
export const SENS_DEVIATION = [['droite', 'Flèche à droite'], ['gauche', 'Flèche à gauche'], ['tout', 'Tout droit']];
const ORANGE = '#f08c00';
const H = 0.5; // hauteur de la plaque (m)
const memoire = new Map();

/** Largeur de la zone de texte pour n lettres (m). */
const largeurTexte = (n) => Math.max(0.8, n * H * 0.36 + 0.3);

/**
 * Symbole d'un panneau de déviation { texte, sens ('droite' | 'gauche' | 'tout') } : { cle, nom, primitives, boite… }, centré.
 * Le texte garde sa taille propre (primitive `brut`) : il ne suit pas la taille des textes des symboles.
 */
export function panneauDeviation(o = {}) {
  const t = String(o.texte ?? '').trim() || 'Déviation';
  const sens = SENS_DEVIATION.some(([c]) => c === o.sens) ? o.sens : 'droite';
  const cle = `${t}|${sens}`;
  if (memoire.has(cle)) return memoire.get(cle);
  if (memoire.size > 80) memoire.clear();
  const W = largeurTexte(t.length);
  const prims = [];
  const s = sens === 'gauche' ? -1 : 1;
  if (sens === 'tout') {
    // Plaque rectangulaire + flèche noire vers le haut devant le texte.
    prims.push(...piece(ORANGE, 'peinture', rectArrondi(-W / 2 - 0.35, -H / 2, W / 2 + 0.35, H / 2, 0.03), NOIR));
    const fx = -W / 2 - 0.1;
    prims.push(plein(NOIR, 'trait', [[fx - 0.05, -0.18], [fx + 0.05, -0.18], [fx + 0.05, 0.03], [fx + 0.16, 0.03], [fx, 0.2], [fx - 0.16, 0.03], [fx - 0.05, 0.03]]));
    prims.push({ ...texte(t, 0.15, 0, H * 0.58, { k: NOIR }), brut: true });
  } else {
    // Plaque orange à liseré noir et pointe de flèche noire du côté du sens.
    const x0 = -W / 2;
    const x1 = W / 2;
    prims.push(...piece(ORANGE, 'peinture', rectArrondi(x0, -H / 2, x1, H / 2, 0.03), NOIR));
    prims.push(plein(NOIR, 'trait', [[s * x1, -H * 0.62], [s * (x1 + 0.34), 0], [s * x1, H * 0.62]].map(([x, y]) => [x, y])));
    prims.push({ ...texte(t, 0, 0, H * 0.58, { k: NOIR }), brut: true });
  }
  const sym = versSymbole(`Panneau deviation ${t.replace(/[^A-Za-z0-9]+/g, '_')} ${sens}`, 'Signalisation', prims, { prefixe: 'dyn:' });
  memoire.set(cle, { ...sym, cle: CLE_DEVIATION, nom: 'Panneau de déviation' });
  return memoire.get(cle);
}
