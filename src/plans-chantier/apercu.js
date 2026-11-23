// Plans de chantier (0.288.0) : petits aperçus dessinés devant chaque genre de ligne et de zone (la « légende » de la
// liste de choix) : le trait avec son motif (poteaux, chevrons, ELEC ⚡…), ou un carré de la couleur et de la transparence.
// Chaque fonction rend un morceau de SVG (texte) prêt à poser dans la page.
import { STYLES_LIGNE, CATEGORIES_ZONE, opaciteZone } from '../topo/plan-chantier.js';

const L = 120; // largeur de l'aperçu d'une ligne
const H = 18;

/** Éclair (électricité) centré en (x, y), tenant dans un carré de 10 px. */
const eclair = (x, y) => {
  const u = 0.85;
  const p = [[6, -6], [1.5, 1], [5, 1], [3, 7], [9, -1], [5.5, -1]].map(([a, b]) => `${(x + (a - 5) * u).toFixed(1)},${(y + b * u).toFixed(1)}`);
  return `<polygon points="${p.join(' ')}"/>`;
};

/** Aperçu SVG d'un genre de ligne (style de STYLES_LIGNE) : le trait, ses tirets et son motif. */
export function apercuLigne(style, couleur = style.couleur) {
  const y = H / 2;
  const ep = Math.min(4, Math.max(1.2, style.epaisseurMm * 3.4));
  const dash = style.tirets.length ? ` stroke-dasharray="${style.tirets.map((t) => (t * 1.5).toFixed(1)).join(' ')}"` : '';
  const m = style.motif;
  let marques = '';
  const trou = (x, w) => `<rect x="${(x - w / 2).toFixed(1)}" y="2" width="${w.toFixed(1)}" height="${H - 4}" fill="var(--surface, #fff)"/>`;
  if (m?.type === 'poteau') {
    for (let x = 8; x < L; x += 18) marques += `<rect x="${x - 1.6}" y="${y - 5}" width="3.2" height="10" fill="#fff" stroke="${couleur}" stroke-width="1.2"/>`;
  } else if (m?.type === 'chevron') {
    for (const x of [22, 60, 98]) marques += `${trou(x, 14)}<polyline points="${x - 3},${y - 5} ${x + 3},${y} ${x - 3},${y + 5}" fill="none" stroke="${couleur}" stroke-width="1.8"/>`;
  } else if (m?.type === 'double') {
    for (const x of [32, 90]) {
      marques += `${trou(x, 22)}<polyline points="${x - 1},${y - 5} ${x - 6},${y} ${x - 1},${y + 5}" fill="none" stroke="${couleur}" stroke-width="1.8"/>`
        + `<polyline points="${x + 1},${y - 5} ${x + 6},${y} ${x + 1},${y + 5}" fill="none" stroke="${couleur}" stroke-width="1.8"/>`;
    }
  } else if (m?.type === 'texte') {
    const w = m.texte.length * 6 + (m.eclair ? 10 : 0) + 6;
    const xs = w > 50 ? [60] : [32, 90];
    for (const x of xs) {
      marques += trou(x, w);
      if (m.eclair) marques += `<g fill="${couleur}">${eclair(x - w / 2 + 8, y)}</g>`;
      marques += `<text x="${(x + (m.eclair ? 5 : 0)).toFixed(1)}" y="${y + 3.2}" text-anchor="middle" font-size="9.5" font-weight="600" font-family="system-ui, sans-serif" fill="${couleur}">${m.texte}</text>`;
    }
  }
  return `<svg class="apercu-genre" viewBox="0 0 ${L} ${H}" width="${L}" height="${H}" aria-hidden="true">`
    + `<path d="M2 ${y}H${L - 2}" stroke="${couleur}" stroke-width="${ep.toFixed(1)}"${dash} fill="none"/>${marques}</svg>`;
}

/** Aperçu SVG d'un genre de zone : un rectangle de sa couleur, fond transparent (opacité en %, 20 au départ), contour. */
export function apercuZone(categorie, opacite = 20) {
  const c = CATEGORIES_ZONE.find((x) => x.cle === categorie) ?? CATEGORIES_ZONE[0];
  const o = opaciteZone({ opacite });
  const contour = categorie === 'emprise' ? 2.6 : 1.4;
  return `<svg class="apercu-genre" viewBox="0 0 40 18" width="40" height="18" aria-hidden="true">`
    + `<rect x="2" y="2" width="36" height="14" rx="2" fill="${c.couleur}" fill-opacity="${o}" stroke="${c.couleur}" stroke-width="${contour}"/></svg>`;
}

/**
 * Liste de choix d'un genre, avec l'aperçu devant chaque nom. type : 'ligne' ou 'zone' ; valeur : la clé choisie ;
 * cible : 'outil' (réglage de l'outil) ou 'objet' (élément choisi) ; l'événement est géré par la page (data-genre).
 */
export function listeGenres(type, valeur, cible, echapper) {
  const genres = type === 'zone' ? CATEGORIES_ZONE : STYLES_LIGNE;
  return `<div class="liste-genres" role="listbox" aria-label="Genre de ${type === 'zone' ? 'zone' : 'ligne'}">${genres.map((g) => `
    <button type="button" role="option" aria-selected="${g.cle === valeur}" class="${g.cle === valeur ? 'actif' : ''}" data-genre="${type}" data-cible="${cible}" data-valeur="${g.cle}">
      ${type === 'zone' ? apercuZone(g.cle) : apercuLigne(g)}<span>${echapper(g.nom)}</span></button>`).join('')}</div>`;
}
