// Forme des points sur le plan, choisie par libellé (0.97.0, demande du 29.10.2026, réglée en
// Expert dans « Libellés des points ») : rond, carré, triangle pointe en haut ou en bas (pleins ou vides), croix, croix
// tournée à 45°, étoile, losange. '' = rond plein (la forme habituelle).

// [clé, symbole] dans l'ordre de la liste de choix (le symbole est montré à la place du nom).
export const FORMES = [
  ['', '●'],
  ['rond-vide', '○'],
  ['carre', '■'],
  ['carre-vide', '□'],
  ['triangle', '▲'],
  ['triangle-vide', '△'],
  ['triangle-bas', '▼'],
  ['triangle-bas-vide', '▽'],
  ['losange', '◆'],
  ['losange-vide', '◇'],
  ['croix', '✚'],
  ['croix-45', '✖'],
  ['etoile', '★'],
];

/** Vrai si la forme se dessine en trait seulement (vide, croix). */
export function formeEnTrait(forme) {
  return /-vide$/.test(forme ?? '') || forme === 'croix' || forme === 'croix-45' || forme === 'nuage';
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
    case 'triangle-bas':
      return polygone([[x, y + r * 1.2], [x + r * 1.1, y - r * 0.8], [x - r * 1.1, y - r * 0.8]]);
    case 'losange':
      return polygone([[x, y - r * 1.3], [x + r * 1.3, y], [x, y + r * 1.3], [x - r * 1.3, y]]);
    case 'nuage': {
      // Rond tracé à la main (0.180.1, demande du 09.11) : une boucle en trait fin, un peu irrégulière, qui
      // se croise à la fin. Taille fixe de 14 px de large, comme le triangle des points de contrôle.
      const R = 7;
      const sommets = [];
      const pas = 28;
      for (let i = 0; i <= pas; i++) {
        const t = (i / pas) * (Math.PI * 2 + 0.5);
        const rayon = R * (1 + 0.07 * Math.sin(3 * t + 1) + 0.04 * Math.cos(5 * t));
        sommets.push([x + rayon * Math.cos(t - Math.PI / 2), y + rayon * 0.9 * Math.sin(t - Math.PI / 2)]);
      }
      return `M${sommets.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}`;
    }
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

/** Symbole (●, ▲, ★…) d'une forme, pour les listes de choix. */
export function symboleDeForme(forme) {
  // U+FE0E : demande le dessin « texte » (qui prend la couleur), pas l'emoji de couleur fixe (tablettes Android).
  return `${(FORMES.find(([cle]) => cle === (forme ?? '')) ?? FORMES[0])[1]}\uFE0E`;
}
