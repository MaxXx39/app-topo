// Forme des points sur le plan, choisie par libellé (0.97.0, demande du 29.10.2026, réglée en
// Expert dans « Libellés des points ») : rond, carré, triangle (pleins ou vides), croix, croix
// tournée à 45°, étoile, losange. '' = rond plein (la forme habituelle).

// [clé, nom] dans l'ordre de la liste de choix.
export const FORMES = [
  ['', 'rond plein'],
  ['rond-vide', 'rond vide'],
  ['carre', 'carré plein'],
  ['carre-vide', 'carré vide'],
  ['triangle', 'triangle plein'],
  ['triangle-vide', 'triangle vide'],
  ['losange', 'losange plein'],
  ['losange-vide', 'losange vide'],
  ['croix', 'croix'],
  ['croix-45', 'croix à 45°'],
  ['etoile', 'étoile'],
];

/** Vrai si la forme se dessine en trait seulement (vide, croix). */
export function formeEnTrait(forme) {
  return /-vide$/.test(forme ?? '') || forme === 'croix' || forme === 'croix-45';
}

/**
 * Tracé SVG (attribut d) d'une forme centrée en (x, y), de « rayon » r (pixels). Le rond n'a pas de
 * tracé ici (cercle SVG) : renvoie null pour '' et 'rond-vide'.
 */
export function cheminForme(forme, x, y, r) {
  const f = (v) => v.toFixed(1);
  const polygone = (sommets) => `M${sommets.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`;
  switch (String(forme ?? '').replace(/-vide$/, '')) {
    case 'carre':
      return polygone([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]);
    case 'triangle':
      return polygone([[x, y - r * 1.2], [x + r * 1.1, y + r * 0.8], [x - r * 1.1, y + r * 0.8]]);
    case 'losange':
      return polygone([[x, y - r * 1.3], [x + r * 1.3, y], [x, y + r * 1.3], [x - r * 1.3, y]]);
    case 'croix':
      return `M${f(x - r * 1.3)} ${f(y)}L${f(x + r * 1.3)} ${f(y)}M${f(x)} ${f(y - r * 1.3)}L${f(x)} ${f(y + r * 1.3)}`;
    case 'croix-45':
      return `M${f(x - r)} ${f(y - r)}L${f(x + r)} ${f(y + r)}M${f(x - r)} ${f(y + r)}L${f(x + r)} ${f(y - r)}`;
    case 'etoile': {
      const sommets = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rayon = i % 2 === 0 ? r * 1.5 : r * 0.65;
        sommets.push([x + rayon * Math.cos(angle), y + rayon * Math.sin(angle)]);
      }
      return polygone(sommets);
    }
    default:
      return null;
  }
}
