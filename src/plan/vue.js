// Calculs de la vue du plan : passage des coordonnées terrain (Est, Nord en mètres)
// aux coordonnées de l'écran (en pixels), zoom et déplacement.
//
// Une "vue" est un objet { echelle, estCentre, nordCentre, largeur, hauteur } :
// - echelle : nombre de pixels pour 1 mètre
// - estCentre, nordCentre : point du terrain (m) affiché au centre de l'écran
// - largeur, hauteur : taille du plan à l'écran (pixels)
// Sur l'écran, x va vers la droite (Est) et y vers le bas (donc vers le Sud).

/**
 * Calcule la vue qui montre tous les points, avec une marge autour (pixels).
 */
export function cadrerSurPoints(points, largeur, hauteur, marge = 30) {
  if (points.length === 0) {
    return { echelle: 1, estCentre: 0, nordCentre: 0, largeur, hauteur };
  }
  const ests = points.map((p) => p.est);
  const nords = points.map((p) => p.nord);
  const estMin = Math.min(...ests);
  const estMax = Math.max(...ests);
  const nordMin = Math.min(...nords);
  const nordMax = Math.max(...nords);

  // On évite une division par zéro si tous les points sont alignés ou confondus.
  const etendueEst = Math.max(estMax - estMin, 1);
  const etendueNord = Math.max(nordMax - nordMin, 1);
  const largeurUtile = Math.max(largeur - 2 * marge, 1);
  const hauteurUtile = Math.max(hauteur - 2 * marge, 1);

  return {
    echelle: Math.min(largeurUtile / etendueEst, hauteurUtile / etendueNord),
    estCentre: (estMin + estMax) / 2,
    nordCentre: (nordMin + nordMax) / 2,
    largeur,
    hauteur,
  };
}

/**
 * Position à l'écran (pixels) d'un point du terrain (Est, Nord en mètres).
 */
export function versEcran(est, nord, vue) {
  return {
    x: vue.largeur / 2 + (est - vue.estCentre) * vue.echelle,
    y: vue.hauteur / 2 - (nord - vue.nordCentre) * vue.echelle,
  };
}

/**
 * Position sur le terrain (Est, Nord en mètres) d'un point de l'écran (pixels).
 */
export function versTerrain(x, y, vue) {
  return {
    est: vue.estCentre + (x - vue.largeur / 2) / vue.echelle,
    nord: vue.nordCentre - (y - vue.hauteur / 2) / vue.echelle,
  };
}

/**
 * Déplace la vue quand on fait glisser le plan de (dx, dy) pixels.
 */
export function deplacer(vue, dx, dy) {
  return {
    ...vue,
    estCentre: vue.estCentre - dx / vue.echelle,
    nordCentre: vue.nordCentre + dy / vue.echelle,
  };
}

/**
 * Zoome d'un facteur (2 = deux fois plus gros) autour d'un point de l'écran (x, y),
 * qui reste immobile sous le doigt ou la souris.
 */
export function zoomer(vue, facteur, x, y) {
  const pointFixe = versTerrain(x, y, vue);
  const echelle = vue.echelle * facteur;
  return {
    ...vue,
    echelle,
    estCentre: pointFixe.est - (x - vue.largeur / 2) / echelle,
    nordCentre: pointFixe.nord + (y - vue.hauteur / 2) / echelle,
  };
}

/**
 * Choisit une longueur "ronde" (1, 2 ou 5 × 10^n mètres) pour la barre d'échelle,
 * la plus grande possible sans dépasser la longueur maximale donnée en pixels.
 * Renvoie { metres, pixels }.
 */
export function barreEchelle(echelle, pixelsMax = 120) {
  const metresMax = pixelsMax / echelle;
  let puissance = 10 ** Math.floor(Math.log10(metresMax));
  let metres = puissance;
  for (const multiple of [1, 2, 5]) {
    if (multiple * puissance <= metresMax) metres = multiple * puissance;
  }
  return { metres, pixels: metres * echelle };
}
