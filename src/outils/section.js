// Titres des blocs, les mêmes dans tous les onglets : une petite icône (traits, comme les icônes
// des onglets) puis le titre. Chaque bloc est un encadré « carte-section » (voir style.css).

// Dessins des icônes (SVG, carré de 24 × 24).
const ICONES = {
  importer: '<path d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5" />',
  leves: '<circle cx="6" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="7" r="1.6" /><circle cx="8" cy="17" r="1.6" /><circle cx="17" cy="17" r="1.6" />',
  ajouter: '<path d="M12 5v14M5 12h14" />',
  surfaces: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  recapitulatif: '<path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14" />',
  coupes: '<path d="M3 17c4-8 7-8 9-4s5 4 9-4M3 21h18" />',
  exporter: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16" />',
  mesures: '<path d="M3 16 16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2" />',
  cartouche: '<path d="M4 4h16v16H4zM4 15h16M10 15v5" />',
  fichier: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14l3 3 3-3" />',
  projets: '<path d="M3 7h6l2 2h10v10H3z" />',
  // Lever avec le récepteur : une canne GNSS (antenne en haut, pointe en bas).
  lever: '<path d="M12 8v13M8 5a4 2 0 0 0 8 0a4 2 0 0 0-8 0M10 21h4" />',
};

/** Icône (SVG) d'un titre de bloc. */
export function iconeSection(cle) {
  return `<svg class="icone-section" viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle] ?? ''}</svg>`;
}

/** Titre d'un bloc : icône, titre, puis éventuellement une bulle d'aide (HTML). */
export function titreSection(cle, titre, aide = '') {
  return `<h3 class="titre-bloc">${iconeSection(cle)}<span>${titre}</span>${aide ? ` ${aide}` : ''}</h3>`;
}
