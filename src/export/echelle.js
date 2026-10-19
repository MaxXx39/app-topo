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
