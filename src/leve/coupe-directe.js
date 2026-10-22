// Dessin d'une coupe en direct (onglet Terrain, mode Contrôler) : le profil de la surface sur
// quelques mètres de part et d'autre du récepteur, et le bout de canne dessus (SVG).
// Les hauteurs sont agrandies pour bien voir le relief : le facteur est écrit sur le dessin.

// Taille du dessin (unités du SVG, il s'adapte ensuite à la largeur de l'écran) et marges.
const LARGEUR = 340;
const HAUTEUR = 150;
const MARGES = { gauche: 46, droite: 8, haut: 18, bas: 18 };
// Hauteur minimale montrée (m), pour qu'une surface toute plate ne soit pas grossie à l'excès.
const HAUTEUR_MIN = 0.5;

/**
 * Code SVG d'une coupe en direct.
 * - lignes : profil de la surface (résultat de profilSurface), distances de 0 à 2 × demiLongueur
 * - demiLongueur : m de chaque côté de la position (le récepteur est au milieu)
 * - altitudeCanne : altitude du bout de canne (m), ou null si elle n'est pas fiable
 * - classe : couleur de l'écart ('vert-clair', 'vert-fonce', 'rouge', 'bleu') ou null
 * - titre, gauche, droite : textes (ex. « Perpendiculaire », « gauche », « droite »)
 */
export function svgCoupeDirecte({ lignes, demiLongueur, altitudeCanne, classe, titre, gauche, droite }) {
  const longueur = 2 * demiLongueur;
  const altitudes = [...lignes.flat().map((p) => p.altitude), ...(altitudeCanne != null ? [altitudeCanne] : [])];
  const entete = `<text x="${MARGES.gauche}" y="12" class="titre-coupe">${titre}</text>
    <text x="${MARGES.gauche}" y="${HAUTEUR - 4}" class="cote">${gauche}</text>
    <text x="${LARGEUR - MARGES.droite}" y="${HAUTEUR - 4}" class="cote" text-anchor="end">${droite}</text>`;
  if (lignes.length === 0 || altitudes.length === 0) {
    return `<svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" class="coupe-directe">${entete}
      <text x="${LARGEUR / 2}" y="${HAUTEUR / 2}" text-anchor="middle" class="vide-coupe">Pas de surface ici</text></svg>`;
  }

  // Altitudes montrées : du point le plus bas au plus haut, avec un peu de marge.
  let bas = Math.min(...altitudes);
  let haut = Math.max(...altitudes);
  if (haut - bas < HAUTEUR_MIN) {
    const milieu = (haut + bas) / 2;
    bas = milieu - HAUTEUR_MIN / 2;
    haut = milieu + HAUTEUR_MIN / 2;
  }
  const marge = (haut - bas) * 0.1;
  bas -= marge;
  haut += marge;

  const largeurUtile = LARGEUR - MARGES.gauche - MARGES.droite;
  const hauteurUtile = HAUTEUR - MARGES.haut - MARGES.bas;
  const x = (distance) => MARGES.gauche + (distance / longueur) * largeurUtile;
  const y = (altitude) => MARGES.haut + ((haut - altitude) / (haut - bas)) * hauteurUtile;
  // Agrandissement des hauteurs par rapport aux longueurs (1 = même échelle).
  const exageration = (hauteurUtile / (haut - bas)) / (largeurUtile / longueur);

  const profils = lignes
    .map((ligne) => {
      const points = ligne.map((p) => `${x(p.distance).toFixed(1)},${y(p.altitude).toFixed(1)}`);
      const fond = `${x(ligne[0].distance).toFixed(1)},${y(bas).toFixed(1)} ${points.join(' ')} ${x(ligne[ligne.length - 1].distance).toFixed(1)},${y(bas).toFixed(1)}`;
      return `<polygon points="${fond}" class="sous-profil" /><polyline points="${points.join(' ')}" class="profil" />`;
    })
    .join('');

  // Le récepteur au milieu : trait vertical (sa position), bout de canne et altitude de la surface.
  const milieu = x(demiLongueur);
  let canne = `<line x1="${milieu}" y1="${MARGES.haut}" x2="${milieu}" y2="${HAUTEUR - MARGES.bas}" class="axe-canne" />`;
  if (altitudeCanne != null) {
    canne += `<circle cx="${milieu}" cy="${y(altitudeCanne).toFixed(1)}" r="5" class="canne ${classe ?? ''}" />`;
  }

  return `<svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" class="coupe-directe">
    ${entete}
    <text x="${LARGEUR - MARGES.droite}" y="12" class="cote" text-anchor="end">hauteurs ×${formaterExageration(exageration)}</text>
    <text x="${MARGES.gauche - 4}" y="${MARGES.haut + 4}" class="cote" text-anchor="end">${haut.toFixed(2)}</text>
    <text x="${MARGES.gauche - 4}" y="${HAUTEUR - MARGES.bas}" class="cote" text-anchor="end">${bas.toFixed(2)}</text>
    <line x1="${MARGES.gauche}" y1="${HAUTEUR - MARGES.bas}" x2="${LARGEUR - MARGES.droite}" y2="${HAUTEUR - MARGES.bas}" class="base-coupe" />
    <text x="${milieu}" y="${HAUTEUR - 4}" class="cote" text-anchor="middle">${demiLongueur} m | ${demiLongueur} m</text>
    ${profils}
    ${canne}
  </svg>`;
}

/** Agrandissement des hauteurs, arrondi pour être lu d'un coup d'œil (×1, ×2.5, ×12…). */
export function formaterExageration(facteur) {
  if (facteur >= 10) return String(Math.round(facteur));
  return String(Math.round(facteur * 10) / 10);
}
