// Guidage de lame (grader) avec 2 RX2 (0.70.0, mode Confirmé). Un RX2 sur un mât au-dessus de
// chaque coin de lame ; la hauteur du mât est la hauteur de canne dans Emlid Flow, avec la
// compensation d'inclinaison : la position reçue est celle du coin de lame.
// Formules validées par l'utilisateur (26.10.2026) :
// - écart d'un coin = altitude de la surface au coin − altitude du coin (m ; positif = monter la lame) ;
// - dévers = (altitude coin droit − altitude coin gauche) ÷ distance à plat entre les coins × 100
//   (% ; positif = le côté droit est plus haut) ;
// - dévers voulu = même calcul avec les altitudes de la surface aux deux coins.
// Coordonnées MN95 Est, Nord, altitude (m).
import { profilSurface } from './coupe.js';

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

// --- Bords de la surface dans le prolongement de la lame (0.75.0, demande du 27.10.2026) ---

/**
 * Bord de la surface à gauche et à droite de la lame, sur la ligne des deux coins prolongée de
 * "portee" m de chaque côté. triangles : triangles de la surface ({ est, nord, altitude } × 3).
 * Pour chaque côté : { distance (m), altitude (m, surface au bord) } ou null (pas de surface).
 * - coin dans la surface : distance positive = longueur de surface qui reste au-delà du coin ;
 * - coin hors de la surface : distance négative = distance jusqu'au bord le plus proche sur
 *   cette ligne (décision de l'utilisateur, 27.10.2026 : « distance négative »).
 */
export function bordsDeLaLame(gauche, droite, triangles, portee = 500) {
  const largeur = Math.hypot(droite.est - gauche.est, droite.nord - gauche.nord);
  if (largeur < LARGEUR_MIN) return null;
  const ue = (droite.est - gauche.est) / largeur;
  const un = (droite.nord - gauche.nord) / largeur;
  const debut = { est: gauche.est - ue * portee, nord: gauche.nord - un * portee };
  const fin = { est: droite.est + ue * portee, nord: droite.nord + un * portee };
  // Parties de la ligne dans la surface, distances comptées depuis le coin gauche (vers la droite).
  const parties = profilSurface(triangles, debut, fin).map((morceau) => ({
    debut: { distance: morceau[0].distance - portee, altitude: morceau[0].altitude },
    fin: { distance: morceau[morceau.length - 1].distance - portee, altitude: morceau[morceau.length - 1].altitude },
  }));
  const tolerance = 1e-6;
  // Bord d'un coin (à la distance t du coin gauche ; vers = -1 à gauche, +1 à droite).
  const bord = (t, vers) => {
    const partie = parties.find((p) => p.debut.distance <= t + tolerance && t - tolerance <= p.fin.distance);
    if (partie) {
      // Dans la surface : le bout de la partie du côté extérieur.
      const bout = vers < 0 ? partie.debut : partie.fin;
      return { distance: Math.abs(bout.distance - t), altitude: bout.altitude };
    }
    // Hors de la surface : le bord le plus proche sur la ligne, en négatif.
    const bouts = parties.flatMap((p) => [p.debut, p.fin]).sort((a, b) => Math.abs(a.distance - t) - Math.abs(b.distance - t));
    return bouts[0] ? { distance: -Math.abs(bouts[0].distance - t), altitude: bouts[0].altitude } : null;
  };
  return { gauche: bord(0, -1), droite: bord(largeur, 1) };
}

// --- Profil en long (0.73.0) : la surface devant (et un peu derrière) la lame, dans le sens de marche ---

/**
 * Point du profil : coin gauche, coin droit, ou milieu de la lame (moyenne des deux coins, Est,
 * Nord et altitude). choix : 'gauche', 'droite' ou 'milieu'.
 */
export function pointDeProfil(gauche, droite, choix = 'milieu') {
  if (choix === 'gauche') return { ...gauche };
  if (choix === 'droite') return { ...droite };
  return { est: (gauche.est + droite.est) / 2, nord: (gauche.nord + droite.nord) / 2, altitude: (gauche.altitude + droite.altitude) / 2 };
}

/**
 * Direction « vers l'avant » quand la niveleuse est arrêtée : perpendiculaire à la lame, en
 * regardant depuis la cabine (gauche à gauche, droite à droite). Vecteur unitaire { est, nord }, ou null.
 */
export function avantDeLaLame(gauche, droite) {
  const largeur = Math.hypot(droite.est - gauche.est, droite.nord - gauche.nord);
  if (largeur < LARGEUR_MIN) return null;
  // Vers la droite (gauche → droite) tourné d'un quart de tour à gauche = vers l'avant.
  return { est: -(droite.nord - gauche.nord) / largeur, nord: (droite.est - gauche.est) / largeur };
}

/** Vecteur unitaire { est, nord } d'un azimut (degrés, 0 = nord, sens des aiguilles d'une montre). */
export function vecteurAzimut(azimut) {
  const angle = (azimut * Math.PI) / 180;
  return { est: Math.sin(angle), nord: Math.cos(angle) };
}

/**
 * Tronçons d'un profil (morceaux de profilSurface, distances en m, altitudes en m) : les segments
 * qui se suivent sont regroupés tant que leur pente ne change pas de plus de "seuil" % ; chaque
 * changement plus grand est une rupture de pente. Renvoie [{ debut, fin (distances, m), pente (%) }]
 * et ruptures : [distance (m)] (entre deux tronçons d'un même morceau).
 */
export function tronconsProfil(morceaux, seuil = 0.5) {
  const troncons = [];
  const ruptures = [];
  for (const morceau of morceaux) {
    let depart = null; // premier point du tronçon en cours
    let penteDepart = null; // pente du premier segment du tronçon
    for (let i = 1; i < morceau.length; i++) {
      const a = morceau[i - 1];
      const b = morceau[i];
      const longueur = b.distance - a.distance;
      if (longueur < 1e-6) continue;
      const pente = ((b.altitude - a.altitude) / longueur) * 100;
      if (depart && Math.abs(pente - penteDepart) > seuil) {
        troncons.push(tronconEntre(depart, a));
        ruptures.push(a.distance);
        depart = null;
      }
      if (!depart) {
        depart = a;
        penteDepart = pente;
      }
      if (i === morceau.length - 1) troncons.push(tronconEntre(depart, b));
    }
  }
  return { troncons, ruptures };
}

/** Tronçon de a à b : { debut, fin (m), pente (%) }. */
function tronconEntre(a, b) {
  return { debut: a.distance, fin: b.distance, pente: ((b.altitude - a.altitude) / (b.distance - a.distance)) * 100 };
}
