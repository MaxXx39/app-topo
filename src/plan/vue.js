// Calculs de la vue du plan : passage des coordonnées terrain (Est, Nord en mètres)
// aux coordonnées de l'écran (en pixels), zoom et déplacement.
//
// Une "vue" est un objet { echelle, estCentre, nordCentre, largeur, hauteur, rotation } :
// - echelle : nombre de pixels pour 1 mètre
// - estCentre, nordCentre : point du terrain (m) affiché au centre de l'écran
// - largeur, hauteur : taille du plan à l'écran (pixels)
// - rotation (facultative, degrés) : direction du terrain affichée en haut de l'écran (azimut,
//   sens des aiguilles d'une montre depuis le nord) ; 0 ou absente = nord en haut. Sert au plan
//   qui tourne avec le RX2 (« devant en haut »).
// Sans rotation, sur l'écran, x va vers la droite (Est) et y vers le bas (donc vers le Sud).

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

/** Cosinus et sinus de la rotation de la vue. */
function angleDe(vue) {
  const r = ((vue.rotation ?? 0) * Math.PI) / 180;
  return { cos: Math.cos(r), sin: Math.sin(r) };
}

/**
 * Position à l'écran (pixels) d'un point du terrain (Est, Nord en mètres).
 */
export function versEcran(est, nord, vue) {
  const { cos, sin } = angleDe(vue);
  const dEst = est - vue.estCentre;
  const dNord = nord - vue.nordCentre;
  // On tourne le terrain pour que la direction "rotation" soit en haut.
  return {
    x: vue.largeur / 2 + (dEst * cos - dNord * sin) * vue.echelle,
    y: vue.hauteur / 2 - (dEst * sin + dNord * cos) * vue.echelle,
  };
}

/** Décalage à l'écran (pixels, x à droite, y en bas) → décalage sur le terrain (m, Est, Nord). */
function ecranVersDecalage(dx, dy, vue) {
  const { cos, sin } = angleDe(vue);
  const u = dx / vue.echelle;
  const v = -dy / vue.echelle;
  return { est: u * cos + v * sin, nord: -u * sin + v * cos };
}

/**
 * Position sur le terrain (Est, Nord en mètres) d'un point de l'écran (pixels).
 */
export function versTerrain(x, y, vue) {
  const d = ecranVersDecalage(x - vue.largeur / 2, y - vue.hauteur / 2, vue);
  return { est: vue.estCentre + d.est, nord: vue.nordCentre + d.nord };
}

/**
 * Déplace la vue quand on fait glisser le plan de (dx, dy) pixels.
 */
export function deplacer(vue, dx, dy) {
  const d = ecranVersDecalage(dx, dy, vue);
  return { ...vue, estCentre: vue.estCentre - d.est, nordCentre: vue.nordCentre - d.nord };
}

/**
 * Zoome d'un facteur (2 = deux fois plus gros) autour d'un point de l'écran (x, y),
 * qui reste immobile sous le doigt ou la souris.
 */
export function zoomer(vue, facteur, x, y) {
  const pointFixe = versTerrain(x, y, vue);
  const nouvelle = { ...vue, echelle: vue.echelle * facteur };
  const d = ecranVersDecalage(x - vue.largeur / 2, y - vue.hauteur / 2, nouvelle);
  return { ...nouvelle, estCentre: pointFixe.est - d.est, nordCentre: pointFixe.nord - d.nord };
}

/**
 * Zone du terrain vue à l'écran (rectangle Est / Nord qui contient les 4 coins, m) :
 * { estMin, estMax, nordMin, nordMax }. Plus grande que l'écran quand le plan est tourné.
 */
export function zoneVisible(vue) {
  const coins = [[0, 0], [vue.largeur, 0], [0, vue.hauteur], [vue.largeur, vue.hauteur]].map(([x, y]) => versTerrain(x, y, vue));
  return {
    estMin: Math.min(...coins.map((c) => c.est)),
    estMax: Math.max(...coins.map((c) => c.est)),
    nordMin: Math.min(...coins.map((c) => c.nord)),
    nordMax: Math.max(...coins.map((c) => c.nord)),
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
