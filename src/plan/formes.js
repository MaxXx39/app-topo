// Forme des points sur le plan, choisie par libellé (0.97.0, demande du 29.10.2026, réglée en
// Expert dans « Libellés des points ») : rond, carré, triangle pointe en haut ou en bas (pleins ou vides), croix, croix
// tournée à 45°, étoile, losange. '' = rond plein (la forme habituelle).
// 0.206.0 (demande du 11.11) : le triangle vide pointe en haut est réservé aux points de contrôle (avec un x dedans) ;
// le triangle vide pointe en bas n'est plus proposé. Les anciens libellés qui les gardent les montrent encore.
// Annotation : une bulle (rectangle à bord arrondi avec une encoche), forme « bulle ».

// [clé, symbole] dans l'ordre de la liste de choix (le symbole est montré à la place du nom).
export const FORMES = [
  ['', '●'],
  ['rond-vide', '○'],
  ['carre', '■'],
  ['carre-vide', '□'],
  ['triangle', '▲'],
  ['triangle-bas', '▼'],
  ['losange', '◆'],
  ['losange-vide', '◇'],
  ['croix', '✚'],
  ['croix-45', '✖'],
  ['etoile', '★'],
];

/** Vrai si la forme se dessine en trait seulement (vide, croix, bulle). */
export function formeEnTrait(forme) {
  return /-vide$/.test(forme ?? '') || forme === 'croix' || forme === 'croix-45' || forme === 'bulle';
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
    case 'bulle': {
      // Bulle d'annotation (0.206.0) : rectangle à bord arrondi (rayon 0,5 r) avec une encoche (la pointe)
      // vers le bas à gauche. Largeur 2,8 r, de y - 1,1 r à y + 0,7 r ; la pointe descend jusqu'à y + 1,5 r.
      const g = x - 1.4 * r, d = x + 1.4 * r, h = y - 1.1 * r, b = y + 0.7 * r, k = 0.5 * r;
      return [
        `M${f(g + k)} ${f(h)}`,
        `L${f(d - k)} ${f(h)}Q${f(d)} ${f(h)} ${f(d)} ${f(h + k)}`,
        `L${f(d)} ${f(b - k)}Q${f(d)} ${f(b)} ${f(d - k)} ${f(b)}`,
        `L${f(x - 0.1 * r)} ${f(b)}L${f(x - 0.8 * r)} ${f(y + 1.5 * r)}L${f(x - 0.7 * r)} ${f(b)}`,
        `L${f(g + k)} ${f(b)}Q${f(g)} ${f(b)} ${f(g)} ${f(b - k)}`,
        `L${f(g)} ${f(h + k)}Q${f(g)} ${f(h)} ${f(g + k)} ${f(h)}Z`,
      ].join('');
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

/**
 * Point de contrôle (0.206.0) : triangle vide pointe en haut, avec un petit x dedans, de même taille r que les
 * autres formes. Renvoie les deux tracés : { triangle, croix } (à dessiner en trait, couleur du contrôle).
 */
export function cheminControle(x, y, r) {
  return {
    triangle: cheminForme('triangle', x, y, r),
    croix: cheminForme('croix-45', x, y + 0.2 * r, 0.45 * r),
  };
}

/** Symbole (●, ▲, ★…) d'une forme, pour les listes de choix. */
export function symboleDeForme(forme) {
  // U+FE0E : demande le dessin « texte » (qui prend la couleur), pas l'emoji de couleur fixe (tablettes Android).
  return `${(FORMES.find(([cle]) => cle === (forme ?? '')) ?? FORMES[0])[1]}\uFE0E`;
}
