// Drapeaux du début et de la fin d'une ligne à implanter (choix de l'utilisateur, 22.10.2026) :
// début = drapeau vert, fin = drapeau à damier (noir et blanc), comme une course.
// Dessinés en SVG, couleurs écrites dans « style » (plus fort que les règles de style du plan),
// sur le plan, dans le couloir et dans l'écran.

const VERT = '#16a34a';

/**
 * Drapeau (code SVG) dont le pied du mât est en (x, y), de "hauteur" unités.
 * type : 'debut' (vert) ou 'fin' (damier).
 */
export function svgDrapeau(type, x = 0, y = 0, hauteur = 22) {
  const haut = y - hauteur;
  const largeur = hauteur * 0.72;
  const hauteurTissu = hauteur * 0.5;
  const mat = `<path d="M${x} ${y}V${haut}" style="fill: none; stroke: #1b2b36; stroke-width: ${(hauteur / 11).toFixed(1)}px; stroke-linecap: round" />`;
  if (type === 'debut') {
    return `${mat}<path d="M${x} ${haut}h${largeur}l${-largeur * 0.22} ${hauteurTissu / 2}l${largeur * 0.22} ${hauteurTissu / 2}H${x}Z" style="fill: ${VERT}; stroke: #14532d; stroke-width: 1px" />`;
  }
  // Damier : 4 colonnes × 2 lignes, cases noires et blanches.
  const c = largeur / 4;
  const l = hauteurTissu / 2;
  let cases = '';
  for (let ligne = 0; ligne < 2; ligne++) {
    for (let colonne = 0; colonne < 4; colonne++) {
      const noire = (ligne + colonne) % 2 === 0;
      cases += `<rect x="${(x + colonne * c).toFixed(2)}" y="${(haut + ligne * l).toFixed(2)}" width="${c.toFixed(2)}" height="${l.toFixed(2)}" style="fill: ${noire ? '#111827' : '#ffffff'}; stroke: none" />`;
    }
  }
  return `${mat}${cases}<rect x="${x}" y="${haut}" width="${largeur.toFixed(2)}" height="${hauteurTissu.toFixed(2)}" style="fill: none; stroke: #111827; stroke-width: 1px" />`;
}

/** Petit drapeau à mettre dans du texte (écran Terrain). */
export function iconeDrapeau(type) {
  return `<svg class="icone-drapeau" viewBox="-2 -24 22 26" aria-hidden="true">${svgDrapeau(type, 0, 0, 22)}</svg>`;
}
