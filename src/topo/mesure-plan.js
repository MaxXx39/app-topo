// Mesure rapide du plan de chantier (0.334.0, demande du 26.11) : on touche des points sur le plan, on lit tout de suite
// la longueur, l'angle ou la surface. Rien n'est enregistré ni imprimé. Les formules sont celles de la Mesure rapide du levé
// (`mesure-rapide.js`, validées le 08.11) : longueur à plat, angle en degrés décimaux, surface par la formule du lacet.
// Points : [est, nord] en mètres (MN95).
import { mesureRapide } from './mesure-rapide.js';

export const MODES_MESURE = [['longueur', 'Longueur'], ['angle', 'Angle'], ['surface', 'Surface']];

/** Nombre de points qui terminent une mesure : l'angle en demande 3 (le suivant repart de zéro), les autres sont libres. */
export const POINTS_ANGLE = 3;

const fixe = (x, n) => (Math.abs(x) < 0.5 * 10 ** -n ? 0 : x).toFixed(n);

/**
 * Résultat d'une mesure : { lignes: ['Longueur : 12.345 m', …] } (texte à afficher), ou { lignes: [] } s'il manque des points.
 * mode : 'longueur' (ligne ouverte, total + dernier côté) | 'angle' (3 points, sommet = le 2e) | 'surface' (figure fermée, 3 points au moins).
 */
export function resultatMesure(mode, points) {
  const pts = points.map(([est, nord]) => ({ est, nord }));
  if (mode === 'longueur') {
    if (pts.length < 2) return { lignes: [] };
    const m = mesureRapide(pts, { fermee: false });
    const dernier = m.cotes[m.cotes.length - 1];
    return { lignes: [`Longueur : ${fixe(m.longueur2d, 3)} m`, ...(pts.length > 2 ? [`Dernier côté : ${fixe(dernier.longueur2d, 3)} m`] : [])] };
  }
  if (mode === 'angle') {
    if (pts.length < POINTS_ANGLE) return { lignes: [] };
    const angle = mesureRapide(pts.slice(0, POINTS_ANGLE), { fermee: false }).angles[1];
    if (angle === null) return { lignes: ['Angle impossible : deux points sont confondus.'] };
    return { lignes: [`Angle : ${fixe(angle, 2)}°`] };
  }
  if (pts.length < 3) return { lignes: [] };
  const m = mesureRapide(pts, { fermee: true });
  return { lignes: [`Surface : ${fixe(m.ferme.surface2d, 2)} m²`, `Périmètre : ${fixe(m.ferme.perimetre2d, 3)} m`] };
}
