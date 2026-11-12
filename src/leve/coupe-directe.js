// Dessin d'une coupe en direct (onglet Terrain, mode Implanter) : le profil de la surface sur
// quelques mètres de part et d'autre du récepteur, et le bout de canne dessus (SVG).
// 0.190.0 : cadre fixe, bout de canne au milieu ; échelle des hauteurs ×0,5 à ×3. 0.210.0 : cadre 25 % moins haut (hauteur = 0,6 × largeur).

// Largeur du dessin (unités du SVG, il s'adapte ensuite à la largeur de l'écran) et marges.
const LARGEUR = 340;
const MARGES = { gauche: 46, droite: 8, haut: 18, bas: 18 };
const RAPPORT_HAUTEUR = 0.6; // hauteur du cadre = 0,6 × sa largeur (0.210.0, demande du 11.11 : 3 m pour 5 m de large à ×1, avant 4 m)

// Grille (0.90.1, Expert) : un trait gris tous les mètres ; plus espacé (2, 5, 10 m…) si les traits
// seraient à moins de ECART_GRILLE_MIN unités du SVG l'un de l'autre.
const ECART_GRILLE_MIN = 9;

/**
 * Pas de la grille d'une coupe (m) : 1 m si les traits sont assez écartés à cette échelle
 * (pixelsParMetre : unités du SVG par mètre), sinon 2, 5, 10, 20, 50… m, le premier lisible.
 */
export function pasDeGrille(pixelsParMetre, ecartMin = ECART_GRILLE_MIN) {
  for (const pas of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (pas * pixelsParMetre >= ecartMin) return pas;
  return 1000;
}

/** Traits de la grille entre debut et fin (m), tous les "pas" m : valeurs multiples du pas. */
export function valeursGrille(debut, fin, pas) {
  const valeurs = [];
  for (let v = Math.ceil(debut / pas) * pas; v <= fin + 1e-9; v += pas) valeurs.push(Math.round(v * 1000) / 1000);
  return valeurs;
}

/**
 * Code SVG d'une coupe en direct.
 * - lignes : profil de la surface (résultat de profilSurface), distances de 0 à 2 × demiLongueur
 * - demiLongueur : m de chaque côté de la position (le récepteur est au milieu)
 * - altitudeCanne : altitude du bout de canne (m), ou null si elle n'est pas fiable
 * - classe : couleur de l'écart ('vert-clair', 'jaune-orange', 'rouge', 'bleu') ou null
 * - exageration : 1 (hauteurs à l'échelle) ou 2 (hauteurs deux fois plus grandes)
 * - sens : 'perpendiculaire' ou 'axe' (couleur du dessin, la même que son trait sur le plan)
 * - titre, gauche, droite : textes (ex. « Perpendiculaire », « gauche », « droite »)
 * - grille : vrai pour la grille grise en longueur et en hauteur (Expert)
 */
export function svgCoupeDirecte({ lignes, lignesBase = null, delta = 0, demiLongueur, altitudeCanne, classe, exageration = 1, sens = '', titre, gauche, droite, grille = true }) {
  // 0.190.0 (maquette B du 10.11) : cadre FIXE (hauteur = 0,6 × largeur : 3 m pour 5 m, 6 m pour 10 m…), le bout de canne
  // toujours au milieu ; seule l'échelle change (largeur 5 / 10 / 20 m…, hauteurs ×0,5, ×0,75, ×1, ×1,5, ×2, ×3).
  const longueur = 2 * demiLongueur;
  const largeurUtile = LARGEUR - MARGES.gauche - MARGES.droite;
  const hauteurUtile = Math.round(largeurUtile * RAPPORT_HAUTEUR);
  const pixelsParMetreX = largeurUtile / longueur;
  const pixelsParMetre = pixelsParMetreX * (Number(exageration) > 0 ? Number(exageration) : 1);
  const altitudes = [...lignes.flat().map((p) => p.altitude), ...(lignesBase ?? []).flat().map((p) => p.altitude), ...(altitudeCanne != null ? [altitudeCanne] : [])];
  const bas0 = altitudes.length > 0 ? Math.min(...altitudes) : 0;
  const haut0 = altitudes.length > 0 ? Math.max(...altitudes) : 1;
  const hauteur = hauteurUtile + MARGES.haut + MARGES.bas;
  const classes = `coupe-directe ${sens ? `coupe-${sens}` : ''}`;
  const entete = `<text x="${MARGES.gauche}" y="12" class="titre-coupe">${titre}</text>
    <text x="${MARGES.gauche}" y="${hauteur - 4}" class="cote">${gauche}</text>
    <text x="${LARGEUR - MARGES.droite}" y="${hauteur - 4}" class="cote" text-anchor="end">${droite}</text>`;
  if (lignes.length === 0) {
    return `<svg viewBox="0 0 ${LARGEUR} ${hauteur}" class="${classes}">${entete}
      <text x="${LARGEUR / 2}" y="${hauteur / 2}" text-anchor="middle" class="vide-coupe">Pas de surface ici</text></svg>`;
  }

  // Altitudes montrées : centrées sur le bout de canne (sinon sur le milieu du relief).
  const etendue = hauteurUtile / pixelsParMetre;
  const centre = altitudeCanne != null ? altitudeCanne : (haut0 + bas0) / 2;
  const haut = centre + etendue / 2;
  const bas = centre - etendue / 2;
  const x = (distance) => MARGES.gauche + (distance / longueur) * largeurUtile;
  const y = (altitude) => MARGES.haut + (haut - altitude) * pixelsParMetre;
  const yBas = MARGES.haut + hauteurUtile;
  const cadre = `coupe-cadre-${sens || 'x'}`;
  // Grille : en longueur depuis la position du récepteur (milieu), en hauteur sur les altitudes rondes.
  let traitsGrille = '';
  if (grille) {
    const pasX = pasDeGrille(largeurUtile / longueur);
    const pasY = pasDeGrille(pixelsParMetre);
    const enLongueur = valeursGrille(-demiLongueur, demiLongueur, pasX).map((d) => `<line x1="${x(d + demiLongueur).toFixed(1)}" y1="${MARGES.haut}" x2="${x(d + demiLongueur).toFixed(1)}" y2="${yBas}" class="grille-coupe" />`);
    const enHauteur = valeursGrille(bas, haut, pasY).map((h) => `<line x1="${MARGES.gauche}" y1="${y(h).toFixed(1)}" x2="${LARGEUR - MARGES.droite}" y2="${y(h).toFixed(1)}" class="grille-coupe" />`);
    traitsGrille = `<g class="grille-coupe">${[...enLongueur, ...enHauteur].join('')}</g>`;
  }

  const profils = lignes
    .map((ligne) => {
      const points = ligne.map((p) => `${x(p.distance).toFixed(1)},${y(p.altitude).toFixed(1)}`);
      const fond = `${x(ligne[0].distance).toFixed(1)},${yBas} ${points.join(' ')} ${x(ligne[ligne.length - 1].distance).toFixed(1)},${yBas}`;
      return `<polygon points="${fond}" class="sous-profil" /><polyline points="${points.join(' ')}" class="profil" />`;
    })
    .join('');

  // Delta Z (0.152.0) : la surface de base en gris pointillé, sous la surface décalée.
  const base = (lignesBase ?? []).map((ligne) => `<polyline points="${ligne.map((p) => `${x(p.distance).toFixed(1)},${y(p.altitude).toFixed(1)}`).join(' ')}" class="profil-base" />`).join('');
  const texteDelta = delta ? `<text x="${LARGEUR - MARGES.droite}" y="26" class="cote texte-delta-surface" text-anchor="end">Δ ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(3)} m</text>` : '';

  // Le récepteur au milieu : trait vertical (sa position) et bout de canne (au bord s'il sort du dessin).
  const milieu = x(demiLongueur);
  let canne = `<line x1="${milieu}" y1="${MARGES.haut}" x2="${milieu}" y2="${yBas}" class="axe-canne" />`;
  if (altitudeCanne != null) {
    const yCanne = Math.min(Math.max(y(altitudeCanne), MARGES.haut), yBas);
    const dehors = yCanne !== y(altitudeCanne);
    canne += `<circle cx="${milieu}" cy="${yCanne.toFixed(1)}" r="5" class="canne ${classe ?? ''} ${dehors ? 'hors-cadre' : ''}" />`;
  }

  return `<svg viewBox="0 0 ${LARGEUR} ${hauteur.toFixed(0)}" class="${classes}">
    <defs><clipPath id="${cadre}"><rect x="${MARGES.gauche}" y="${MARGES.haut}" width="${largeurUtile}" height="${hauteurUtile}" /></clipPath></defs>
    ${entete}
    <text x="${MARGES.gauche - 4}" y="${MARGES.haut + 4}" class="cote" text-anchor="end">${haut.toFixed(2)}</text>
    <text x="${MARGES.gauche - 4}" y="${yBas}" class="cote" text-anchor="end">${bas.toFixed(2)}</text>
    <line x1="${MARGES.gauche}" y1="${yBas}" x2="${LARGEUR - MARGES.droite}" y2="${yBas}" class="base-coupe" />
    <text x="${milieu}" y="${hauteur - 4}" class="cote" text-anchor="middle">${demiLongueur} m | ${demiLongueur} m</text>
    ${traitsGrille}
    ${texteDelta}
    <g clip-path="url(#${cadre})">${base}${profils}</g>
    ${canne}
  </svg>`;
}

/**
 * Boutons d'échelle d'une coupe (0.190.0, maquette B du 10.11, dès Intermédiaire) : « − 10 m + » (largeur de la coupe, la hauteur
 * suit : 0,6 × la largeur) et ▲ ×1,5 ▼ (échelle des hauteurs). Posés sur la coupe, hors de la zone qui se redessine
 * 5 fois par seconde (sinon un appui serait perdu).
 */
export function controlesEchelleCoupe(texteLargeur, exageration, actionLargeur, actionHauteur, idLargeur = '') {
  const texte = (n) => String(n).replace('.', ',');
  return `<div class="echelle-coupe largeur-coupe seulement-intermediaire" role="group" aria-label="Largeur de la coupe">
      <button type="button" data-action="${actionLargeur}" data-valeur="-1" aria-label="Coupe moins large">−</button><span ${idLargeur ? `data-vivant="${idLargeur}"` : ''}>${texteLargeur}</span><button type="button" data-action="${actionLargeur}" data-valeur="1" aria-label="Coupe plus large">+</button></div>
    <div class="echelle-coupe hauteur-coupe seulement-intermediaire" role="group" aria-label="Échelle des hauteurs">
      <button type="button" data-action="${actionHauteur}" data-valeur="1" aria-label="Hauteurs plus grandes">▲</button><span>×${texte(exageration)}</span><button type="button" data-action="${actionHauteur}" data-valeur="-1" aria-label="Hauteurs plus petites">▼</button></div>`;
}

