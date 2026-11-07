// Silhouettes des machines dans les coupes du Guidage (0.155.0, maquette « essai 1 » validée le 07.11) :
// gris clair, derrière le terrain et l'outil, pour comprendre ce que montre la coupe.
// Chaque dessin est fait autour du bas de l'outil en (0, 0), y vers le bas (SVG) ; le tranchant va de
// x = −40 à 40 (bouts G et D, ou Arr et Av pour le râteau). Vue « gd » : de derrière ; vue « long » :
// de côté, l'avant à droite.

const vitre = (x, y, w, h) => `<rect class="vitre-silhouette" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;

const DESSINS = {
  grader: {
    // Lame sur toute la largeur, roues arrière aux bords, moteur et cabine au milieu.
    gd: `<path d="M-40 -16 q40 -8 80 0 v16 h-80z"/>
      <rect x="-40" y="-40" width="15" height="34" rx="6"/><rect x="25" y="-40" width="15" height="34" rx="6"/>
      <rect x="-26" y="-28" width="52" height="6"/>
      <rect x="-30" y="-60" width="60" height="22" rx="4"/><rect x="-20" y="-98" width="40" height="40" rx="5"/>${vitre(-14, -92, 28, 16)}`,
    // Lame au milieu sous le long châssis, tandem arrière à gauche, roue avant à droite.
    long: `<path d="M-7 0 q-4 -14 2 -24 h10 q-6 10 -2 24z"/><rect x="-3" y="-44" width="6" height="22"/>
      <rect x="-110" y="-50" width="215" height="10" rx="4"/>
      <circle cx="-92" cy="-14" r="14"/><circle cx="-60" cy="-14" r="14"/><circle cx="90" cy="-14" r="14"/>
      <rect x="-125" y="-66" width="30" height="18" rx="3"/><rect x="-92" y="-98" width="38" height="50" rx="5"/>${vitre(-86, -92, 26, 18)}`,
  },
  bull: {
    // Chenilles aux bords, corps et cabine ; la lame (devant) un peu visible derrière.
    gd: `<rect x="-40" y="-36" width="80" height="36" rx="2" opacity=".5"/>
      <rect x="-38" y="-30" width="18" height="30" rx="6"/><rect x="20" y="-30" width="18" height="30" rx="6"/>
      <rect x="-28" y="-62" width="56" height="34" rx="5"/><rect x="-18" y="-100" width="36" height="40" rx="5"/>${vitre(-13, -94, 26, 16)}`,
    // Bas de la lame en (0, 0), poussoirs et machine en arrière (à gauche).
    long: `<path d="M3 0 q-14 -28 -4 -58 l8 2 q-10 28 4 56z"/><rect x="-36" y="-34" width="34" height="6"/>
      <rect x="-140" y="-26" width="112" height="24" rx="12"/><rect x="-130" y="-58" width="98" height="32" rx="4"/>
      <rect x="-112" y="-96" width="44" height="40" rx="5"/>${vitre(-106, -90, 32, 18)}`,
  },
  rateau: {
    // Lame de nivelage : caisson de G à D, haut du rouleau (devant), platine d'attache, bras.
    gd: `<rect x="-38" y="-30" width="76" height="8" rx="4" opacity=".55"/>
      <rect x="-40" y="-20" width="80" height="20" rx="1"/>
      <rect x="-14" y="-30" width="28" height="10"/><path d="M-10 -30 v-16 h20 v16z"/>
      <path d="M-8 -46 l-4 -64 h24 l-4 64z"/>`,
    // De côté : cadre bas de Arr à Av, rouleau à l'avant, attache, bras de la pelle.
    long: `<rect x="-40" y="-14" width="72" height="14" rx="1"/>
      <circle cx="44" cy="-15" r="15"/>
      <rect x="-14" y="-28" width="28" height="14"/><path d="M-12 -28 l4 -18 h16 l4 18z"/>
      <path d="M-4 -44 l-26 -66 l14 -6 l26 66z"/><path d="M-30 -110 l-90 -24 l4 -12 l92 22z"/>`,
  },
};

/**
 * Silhouette (SVG) d'une machine ('grader', 'bull', 'rateau') pour une coupe ('gd' ou 'long'), posée
 * au point (x, y) de la coupe, tournée de "angle" degrés, à l'échelle "echelle" (1 = 80 px de tranchant).
 */
export function silhouetteOutil(machine, vue, { x, y, angle = 0, echelle = 1 }) {
  const dessin = DESSINS[machine]?.[vue];
  if (!dessin) return '';
  return `<g class="silhouette-outil" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${echelle.toFixed(3)})">${dessin}</g>`;
}
