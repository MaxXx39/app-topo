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

// Formats de feuille (paysage), en mm. 0.151.0 : A2, A1 et A0 en plus.
export const FORMATS_PAPIER = {
  a4: { largeur: 297, hauteur: 210 },
  a3: { largeur: 420, hauteur: 297 },
  a2: { largeur: 594, hauteur: 420 },
  a1: { largeur: 841, hauteur: 594 },
  a0: { largeur: 1189, hauteur: 841 },
};
// Du plus petit au plus grand : l'ordre dans lequel on essaie les feuilles.
export const ORDRE_PAPIERS = ['a4', 'a3', 'a2', 'a1', 'a0'];
// Largeur de la colonne de droite du PDF (titre, volumes, légende, cartouche), en mm.
export const LARGEUR_COLONNE = 80;

/** Taille de la feuille (mm) selon l'orientation ('paysage' ou 'portrait'). */
export function tailleFeuille(format, orientation = 'paysage') {
  const { largeur, hauteur } = FORMATS_PAPIER[format] ?? FORMATS_PAPIER.a4;
  return orientation === 'portrait' ? { largeur: hauteur, hauteur: largeur } : { largeur, hauteur };
}

/**
 * Mise en page d'une feuille (mm) : la feuille, le cadre du plan à gauche et la colonne de droite.
 * Sur une A4 paysage : plan de 193 × 190 mm ; sur une A3 paysage : 316 × 277 mm.
 */
export function miseEnPage(format, orientation = 'paysage') {
  const feuille = tailleFeuille(format, orientation);
  const colonneX = feuille.largeur - 10 - LARGEUR_COLONNE;
  return {
    page: { largeur: feuille.largeur, hauteur: feuille.hauteur, marge: 8, orientation },
    cadrePlan: { x: 10, y: 10, largeur: colonneX - 4 - 10, hauteur: feuille.hauteur - 20 },
    colonne: { x: colonneX, largeur: LARGEUR_COLONNE },
  };
}

/**
 * Place pour le dessin dans le cadre du plan (mm) : on garde une marge autour,
 * et de la place en bas pour la barre d'échelle.
 */
export function placeDuDessin(format, orientation = 'paysage') {
  const { cadrePlan } = miseEnPage(format, orientation);
  return { largeur: cadrePlan.largeur - 20, hauteur: cadrePlan.hauteur - 30 };
}

/** Vrai si une zone du terrain (m) tient sur la feuille à l'échelle 1:echelle. */
function tient(largeurTerrain, hauteurTerrain, echelle, format, orientation) {
  const place = placeDuDessin(format, orientation);
  return (largeurTerrain * 1000) / echelle <= place.largeur && (hauteurTerrain * 1000) / echelle <= place.hauteur;
}

/**
 * Format de la feuille pour dessiner une zone du terrain (0.151.0 : trois façons de choisir) :
 * - papier et échelle « auto » (papier 'auto', echelle null) : A4 ; l'échelle sera la plus
 *   détaillée qui fait tout tenir (choisirEchelle) ;
 * - papier choisi, échelle auto : ce papier ; l'échelle sera la plus détaillée qui y tient ;
 * - papier auto, échelle choisie : la plus petite feuille (A4 → A0) où le plan tient à cette échelle ;
 *   si même l'A0 est trop petite : A0 et depasse = vrai (plan coupé au cadre) ;
 * - les deux choisis : ce papier, depasse = vrai si le plan n'y tient pas.
 * - largeurTerrain, hauteurTerrain : taille de la zone (m) ; echelle : 500 pour 1:500, ou null
 * Renvoie { format: 'a4'…'a0', depasse }.
 */
export function choisirFormat(largeurTerrain, hauteurTerrain, echelle, { papier = 'auto', orientation = 'paysage', papiers = ORDRE_PAPIERS } = {}) {
  if (papier && papier !== 'auto') {
    return { format: papier, depasse: Boolean(echelle) && !tient(largeurTerrain, hauteurTerrain, echelle, papier, orientation) };
  }
  if (!echelle) return { format: 'a4', depasse: false };
  for (const format of papiers) {
    if (tient(largeurTerrain, hauteurTerrain, echelle, format, orientation)) return { format, depasse: false };
  }
  return { format: papiers.at(-1), depasse: true };
}

/**
 * Feuille que donnera le PDF (0.152.0, annoncée avant l'export) : zone du terrain (m) et choix
 * { papier ('auto', 'a4'…), orientation, echelleImposee (ou null) }. Mêmes règles que creerPdf :
 * format par choisirFormat, échelle imposée ou la plus détaillée qui tient dans la place du dessin.
 * Renvoie { format, orientation, echelle, depasse }, ou null sans zone.
 */
export function feuillePrevue(zone, { papier = 'auto', orientation = 'paysage', echelleImposee = null } = {}) {
  if (!zone) return null;
  const largeur = zone.estMax - zone.estMin;
  const hauteur = zone.nordMax - zone.nordMin;
  const { format, depasse } = choisirFormat(largeur, hauteur, echelleImposee, { papier, orientation });
  const place = placeDuDessin(format, orientation);
  const echelle = echelleImposee ?? choisirEchelle(largeur, hauteur, place.largeur, place.hauteur);
  return { format, orientation, echelle, depasse };
}
