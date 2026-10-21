// Choix de l'échelle du plan imprimé.

// Échelles normalisées proposées (1:100, 1:200, ...).
export const ECHELLES = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 25000, 50000];

/**
 * Plus grande échelle (le plus de détails) pour laquelle une zone du terrain tient sur le papier.
 * - largeurTerrain, hauteurTerrain : taille de la zone à dessiner (m)
 * - largeurPapier, hauteurPapier : place disponible sur la feuille (mm)
 * Renvoie le dénominateur de l'échelle (500 pour 1:500).
 * À l'échelle 1:E, 1 m sur le terrain mesure 1000 / E mm sur le papier.
 */
export function choisirEchelle(largeurTerrain, hauteurTerrain, largeurPapier, hauteurPapier) {
  return (
    ECHELLES.find(
      (echelle) => (largeurTerrain * 1000) / echelle <= largeurPapier && (hauteurTerrain * 1000) / echelle <= hauteurPapier,
    ) ?? ECHELLES.at(-1)
  );
}

/**
 * Longueur « ronde » (1, 2 ou 5 × 10^n m) pour la barre d'échelle du plan imprimé,
 * la plus grande qui ne dépasse pas longueurMaxMm sur le papier.
 * Renvoie { metres, mm }.
 */
export function barreEchellePapier(echelle, longueurMaxMm = 50) {
  const metresMax = (longueurMaxMm * echelle) / 1000;
  const puissance = 10 ** Math.floor(Math.log10(metresMax));
  let metres = puissance;
  for (const multiple of [1, 2, 5]) if (multiple * puissance <= metresMax) metres = multiple * puissance;
  return { metres, mm: (metres * 1000) / echelle };
}

// Formats de feuille (paysage), en mm.
export const FORMATS_PAPIER = {
  a4: { largeur: 297, hauteur: 210 },
  a3: { largeur: 420, hauteur: 297 },
};
// Largeur de la colonne de droite du PDF (titre, volumes, légende, cartouche), en mm.
export const LARGEUR_COLONNE = 80;

/**
 * Mise en page d'une feuille paysage (mm) : la feuille, le cadre du plan à gauche et la
 * colonne de droite. Sur une A4 : plan de 193 × 190 mm ; sur une A3 : 316 × 277 mm.
 */
export function miseEnPage(format) {
  const feuille = FORMATS_PAPIER[format];
  const colonneX = feuille.largeur - 10 - LARGEUR_COLONNE;
  return {
    page: { largeur: feuille.largeur, hauteur: feuille.hauteur, marge: 8 },
    cadrePlan: { x: 10, y: 10, largeur: colonneX - 4 - 10, hauteur: feuille.hauteur - 20 },
    colonne: { x: colonneX, largeur: LARGEUR_COLONNE },
  };
}

/**
 * Place pour le dessin dans le cadre du plan (mm) : on garde une marge autour,
 * et de la place en bas pour la barre d'échelle.
 */
export function placeDuDessin(format) {
  const { cadrePlan } = miseEnPage(format);
  return { largeur: cadrePlan.largeur - 20, hauteur: cadrePlan.hauteur - 30 };
}

/**
 * Format de la feuille pour dessiner une zone du terrain à une échelle donnée :
 * A4 si le plan y tient, sinon A3 ; si même l'A3 est trop petite, A3 et depasse = vrai
 * (le plan est alors coupé au cadre). Échelle automatique (null) : toujours A4.
 * - largeurTerrain, hauteurTerrain : taille de la zone (m) ; echelle : 500 pour 1:500
 * Renvoie { format: 'a4' ou 'a3', depasse }.
 */
export function choisirFormat(largeurTerrain, hauteurTerrain, echelle) {
  if (!echelle) return { format: 'a4', depasse: false };
  for (const format of ['a4', 'a3']) {
    const place = placeDuDessin(format);
    if ((largeurTerrain * 1000) / echelle <= place.largeur && (hauteurTerrain * 1000) / echelle <= place.hauteur) {
      return { format, depasse: false };
    }
  }
  return { format: 'a3', depasse: true };
}
