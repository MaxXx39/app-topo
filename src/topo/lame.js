// Guidage de lame (grader) avec 2 RX2 (0.70.0, mode Confirmé). Un RX2 sur un mât au-dessus de
// chaque coin de lame ; la hauteur du mât est la hauteur de canne dans Emlid Flow, avec la
// compensation d'inclinaison : la position reçue est celle du coin de lame.
// Formules validées par l'utilisateur (26.10.2026) :
// - écart d'un coin = altitude de la surface au coin − altitude du coin (m ; positif = monter la lame) ;
// - dévers = (altitude coin droit − altitude coin gauche) ÷ distance à plat entre les coins × 100
//   (% ; positif = le côté droit est plus haut) ;
// - dévers voulu = même calcul avec les altitudes de la surface aux deux coins.
// Coordonnées MN95 Est, Nord, altitude (m).

// Tolérances de l'écart (m) : vert jusqu'à 2 cm, orange jusqu'à 5 cm, rouge au-delà.
export const TOLERANCES_LAME = { vert: 0.02, orange: 0.05 };
// En dessous de cette distance (m) entre les coins, les deux récepteurs sont « au même endroit ».
const LARGEUR_MIN = 0.1;

/** Couleur d'un écart (m) : 'vert', 'orange', 'rouge', ou null (pas d'écart : hors de la surface). */
export function classeEcartLame(ecart, tolerances = TOLERANCES_LAME) {
  if (ecart == null) return null;
  const valeur = Math.abs(ecart);
  if (valeur <= tolerances.vert + 1e-9) return 'vert';
  if (valeur <= tolerances.orange + 1e-9) return 'orange';
  return 'rouge';
}

/** Dévers (%) de gauche à droite : (altitude droite − altitude gauche) ÷ distance à plat × 100. */
export function deversEntre(gauche, droite, altitudeGauche = gauche.altitude, altitudeDroite = droite.altitude) {
  const largeur = Math.hypot(droite.est - gauche.est, droite.nord - gauche.nord);
  if (largeur < LARGEUR_MIN || altitudeGauche == null || altitudeDroite == null) return null;
  return ((altitudeDroite - altitudeGauche) / largeur) * 100;
}

/**
 * Guidage de la lame. gauche, droite : coins { est, nord, altitude } ; altitudeSurface(est, nord) :
 * altitude de la surface (m) ou null hors de la surface ; tolerances : { vert, orange } (m).
 * Renvoie { largeur (m), gauche: { ecart, classe, altitudeSurface }, droite: { … }, devers,
 * deversVoulu (%), ecartDevers (devers voulu − devers, %) } ou { erreur }.
 */
export function guidageLame({ gauche, droite, altitudeSurface, tolerances = TOLERANCES_LAME }) {
  const largeur = Math.hypot(droite.est - gauche.est, droite.nord - gauche.nord);
  if (largeur < LARGEUR_MIN) return { erreur: 'les deux récepteurs sont au même endroit' };
  const coin = (p) => {
    const surface = altitudeSurface(p.est, p.nord);
    const ecart = surface == null ? null : surface - p.altitude;
    return { ecart, classe: classeEcartLame(ecart, tolerances), altitudeSurface: surface };
  };
  const g = coin(gauche);
  const d = coin(droite);
  const devers = deversEntre(gauche, droite);
  const deversVoulu = deversEntre(gauche, droite, g.altitudeSurface, d.altitudeSurface);
  return { largeur, gauche: g, droite: d, devers, deversVoulu, ecartDevers: deversVoulu == null ? null : deversVoulu - devers };
}

/**
 * Coupe vue de derrière la lame : la ligne des coins prolongée de "marge" m de chaque côté.
 * Renvoie { debut, fin } (MN95) : le début à gauche.
 */
export function ligneDeCoupeLame(gauche, droite, marge = 1) {
  const largeur = Math.hypot(droite.est - gauche.est, droite.nord - gauche.nord);
  if (largeur < LARGEUR_MIN) return null;
  const ue = (droite.est - gauche.est) / largeur;
  const un = (droite.nord - gauche.nord) / largeur;
  return {
    debut: { est: gauche.est - ue * marge, nord: gauche.nord - un * marge },
    fin: { est: droite.est + ue * marge, nord: droite.nord + un * marge },
  };
}
