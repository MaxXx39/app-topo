// Placement des étiquettes (noms des points) sur le plan sans qu'elles se chevauchent.
// Tout est en pixels de l'écran.

/**
 * Choisit la position de chaque étiquette pour éviter les chevauchements.
 * - etiquettes : liste de { x, y, largeur, hauteur } (x, y = position du point)
 *   dans l'ordre de priorité (les premières sont placées en premier).
 * On essaie d'abord à droite au-dessus du point, puis à gauche, puis en dessous.
 * Si aucune place n'est libre, l'étiquette est cachée.
 * Renvoie, pour chaque étiquette, { x, y, aGauche } (coin bas-gauche du texte) ou null si cachée.
 */
export function placerEtiquettes(etiquettes, ecart = 5) {
  const occupees = [];
  return etiquettes.map(({ x, y, largeur, hauteur }) => {
    const essais = [
      { gauche: x + ecart, haut: y - ecart - hauteur, aGauche: false }, // à droite, au-dessus
      { gauche: x - ecart - largeur, haut: y - ecart - hauteur, aGauche: true }, // à gauche, au-dessus
      { gauche: x + ecart, haut: y + ecart, aGauche: false }, // à droite, en dessous
      { gauche: x - ecart - largeur, haut: y + ecart, aGauche: true }, // à gauche, en dessous
    ];
    for (const essai of essais) {
      const boite = { gauche: essai.gauche, haut: essai.haut, droite: essai.gauche + largeur, bas: essai.haut + hauteur };
      if (!occupees.some((autre) => seChevauchent(boite, autre))) {
        occupees.push(boite);
        return { x: essai.aGauche ? essai.gauche + largeur : essai.gauche, y: boite.bas, aGauche: essai.aGauche };
      }
    }
    return null;
  });
}

function seChevauchent(a, b) {
  return a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;
}

/**
 * Un point bien à l'intérieur d'une surface faite de triangles (pour y écrire une étiquette).
 * On prend le centre du triangle le plus proche du centre de gravité de la surface :
 * il est toujours dans la surface, même pour un stock en forme de « L ».
 * Renvoie { est, nord } (m), ou null s'il n'y a pas de triangle.
 */
export function pointInterieur(triangles) {
  if (triangles.length === 0) return null;
  let aireTotale = 0;
  let estMoyen = 0;
  let nordMoyen = 0;
  const centres = triangles.map(([a, b, c]) => {
    const aire = Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
    const centre = { est: (a.est + b.est + c.est) / 3, nord: (a.nord + b.nord + c.nord) / 3 };
    aireTotale += aire;
    estMoyen += centre.est * aire;
    nordMoyen += centre.nord * aire;
    return centre;
  });
  if (aireTotale === 0) return centres[0];
  estMoyen /= aireTotale;
  nordMoyen /= aireTotale;
  let meilleur = centres[0];
  for (const centre of centres) {
    if (Math.hypot(centre.est - estMoyen, centre.nord - nordMoyen) < Math.hypot(meilleur.est - estMoyen, meilleur.nord - nordMoyen)) {
      meilleur = centre;
    }
  }
  return meilleur;
}
