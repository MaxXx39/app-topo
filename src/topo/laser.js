// Test laser (0.269.0, Expert, demande du 17.11) : lever un point inaccessible avec le GNSS sur la canne
// et un distancemètre laser (Leica D510) fixé dessus. Le D510 donne la distance et l'angle vertical,
// jamais le cap : le cap vient du RX2 (phrase ETC) ou, sans cap, de deux stations (intersection de cercles).
// Tout en MN95 (Est, Nord, altitude), mètres ; angles en degrés.
//
// FORMULES À VALIDER PAR L'UTILISATEUR (rien de tout ceci n'a été essayé sur le terrain) :
// - azimut A → B = atan2(ΔEst, ΔNord), de 0 à 360°, compté depuis le Nord MN95 dans le sens des aiguilles ;
// - moyenne d'angles : moyenne « circulaire » (359° et 1° donnent 0°), écart-type des écarts à cette moyenne ;
// - correction du cap = moyenne de (cap lu − azimut vrai) de l'essai A ; azimut utilisé = cap lu − correction ;
// - origine du laser (arrière du boîtier) = pointe + hauteur le long de la canne (penchée si l'inclinaison
//   est connue) + décalage avant / droite, à l'horizontale, selon la direction de visée ;
// - point visé = origine + distance × cos(angle) à l'horizontale, + distance × sin(angle) en altitude.

const RAD = Math.PI / 180;

/** Angle ramené entre 0 (compris) et 360° (non compris). */
export function normaliser360(angle) {
  const a = ((angle % 360) + 360) % 360;
  return a === 360 ? 0 : a;
}

/** Écart a − b (degrés), ramené entre −180 et +180° (le plus court chemin). */
export function ecartAngle(a, b) {
  const d = normaliser360(a - b);
  return d > 180 ? d - 360 : d;
}

/** Azimut (degrés, 0 = Nord MN95, 90 = Est) de A vers B ({ est, nord }). */
export function azimut(a, b) {
  return normaliser360(Math.atan2(b.est - a.est, b.nord - a.nord) / RAD);
}

/** Distance horizontale (m) entre A et B. */
export function distance2d(a, b) {
  return Math.hypot(b.est - a.est, b.nord - a.nord);
}

/**
 * Moyenne d'angles (degrés) : moyenne « circulaire » (des sinus et des cosinus), pour que 359° et 1°
 * donnent 0° et pas 180°. Renvoie { moyenne (0–360), ecartType (degrés, écarts à la moyenne), n } ou null.
 */
export function moyenneAngles(angles) {
  const valeurs = angles.filter((a) => Number.isFinite(a));
  if (valeurs.length === 0) return null;
  const s = valeurs.reduce((t, a) => t + Math.sin(a * RAD), 0);
  const c = valeurs.reduce((t, a) => t + Math.cos(a * RAD), 0);
  const moyenne = normaliser360(Math.atan2(s, c) / RAD);
  const n = valeurs.length;
  const somme2 = valeurs.reduce((t, a) => t + ecartAngle(a, moyenne) ** 2, 0);
  return { moyenne, ecartType: n > 1 ? Math.sqrt(somme2 / (n - 1)) : 0, n };
}

/**
 * Essai A : écarts (cap lu − azimut vrai, en degrés entre −180 et +180) des stations faites.
 * Renvoie { moyenne (−180…+180), ecartType, mini, maxi, n } ou null.
 */
export function statistiquesEcarts(ecarts) {
  const m = moyenneAngles(ecarts);
  if (!m) return null;
  const moyenne = ecartAngle(m.moyenne, 0);
  const relatifs = ecarts.filter(Number.isFinite).map((e) => ecartAngle(e, 0));
  return { moyenne, ecartType: m.ecartType, mini: Math.min(...relatifs), maxi: Math.max(...relatifs), n: m.n };
}

/** Erreur de côté (m) que donne une erreur d'angle (degrés) à une distance (m). */
export function erreurLaterale(distance, erreurDeg) {
  return Math.abs(distance * Math.tan(erreurDeg * RAD));
}

/**
 * Origine du laser (arrière du boîtier, d'où le D510 compte la distance), en MN95.
 * station : { est, nord, altitude } = pointe de la canne (donnée par le RX2) ;
 * montage : { hauteur (m, au-dessus de la pointe, le long de la canne), droite (m, + = à droite de la canne
 *   en regardant la cible), avant (m, + = vers la cible) } ;
 * azimutVisee : direction de visée (degrés) ; inclinaison : { angle (°), direction (°, vers où penche le haut
 *   de la canne) } ou null (canne verticale).
 */
export function origineLaser(station, montage, azimutVisee, inclinaison = null) {
  const h = montage?.hauteur ?? 0;
  const droite = montage?.droite ?? 0;
  const avant = montage?.avant ?? 0;
  let haut = { est: 0, nord: 0, z: h };
  if (inclinaison && Number.isFinite(inclinaison.angle) && Number.isFinite(inclinaison.direction)) {
    const t = inclinaison.angle * RAD;
    const b = inclinaison.direction * RAD;
    haut = { est: h * Math.sin(t) * Math.sin(b), nord: h * Math.sin(t) * Math.cos(b), z: h * Math.cos(t) };
  }
  const a = azimutVisee * RAD;
  // Vers l'avant : (sin a, cos a) ; vers la droite : (cos a, −sin a).
  return {
    est: station.est + haut.est + avant * Math.sin(a) + droite * Math.cos(a),
    nord: station.nord + haut.nord + avant * Math.cos(a) - droite * Math.sin(a),
    altitude: (station.altitude ?? 0) + haut.z,
  };
}

/** Distance horizontale et dénivelée (m) d'une mesure du laser : distance (m, inclinée) et angle (°, + = vers le haut). */
export function composantesLaser(distance, angleVertical) {
  const a = (angleVertical ?? 0) * RAD;
  return { horizontale: distance * Math.cos(a), denivelee: distance * Math.sin(a) };
}

/**
 * Point visé avec le cap du RX2. mesure : { station, distance, angleVertical, cap (°, moyenne lue),
 * inclinaison } ; correctionCap : moyenne de l'essai A (cap − azimut vrai), 0 si pas faite.
 * Renvoie { est, nord, altitude, azimut, horizontale, origine } ou { erreur }.
 */
export function pointParCap(mesure, montage, correctionCap = 0) {
  const { station, distance, angleVertical, cap, inclinaison } = mesure;
  if (!station) return { erreur: 'station pas prise' };
  if (!Number.isFinite(cap)) return { erreur: 'pas de cap lu' };
  if (!(distance > 0)) return { erreur: 'distance du laser manquante' };
  const az = normaliser360(cap - (correctionCap ?? 0));
  const origine = origineLaser(station, montage, az, inclinaison);
  const { horizontale, denivelee } = composantesLaser(distance, angleVertical);
  return {
    est: origine.est + horizontale * Math.sin(az * RAD),
    nord: origine.nord + horizontale * Math.cos(az * RAD),
    altitude: origine.altitude + denivelee,
    azimut: az,
    horizontale,
    origine,
  };
}

/**
 * Intersection de deux cercles en plan (centres { est, nord }, rayons en m). Renvoie { gauche, droite, angle }
 * (gauche / droite en allant du centre 1 vers le centre 2 ; angle = angle d'intersection en degrés,
 * le mieux autour de 90°) ou { erreur }. Cercles qui se touchent presque (à 2 cm près) : un seul point.
 */
export function intersectionCercles(c1, r1, c2, r2, tolerance = 0.02) {
  const d = distance2d(c1, c2);
  if (d < 0.01) return { erreur: 'les deux stations sont au même endroit' };
  const ue = (c2.est - c1.est) / d;
  const un = (c2.nord - c1.nord) / d;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  let h2 = r1 * r1 - a * a;
  if (h2 < 0) {
    const manque = d > r1 + r2 ? d - (r1 + r2) : Math.abs(r1 - r2) - d;
    if (manque > tolerance) return { erreur: `les deux distances ne se croisent pas (il manque ${manque.toFixed(3)} m)` };
    h2 = 0;
  }
  const h = Math.sqrt(h2);
  const base = { est: c1.est + a * ue, nord: c1.nord + a * un };
  // À gauche de la direction (ue, un) : (−un, ue).
  const gauche = { est: base.est - h * un, nord: base.nord + h * ue };
  const droite = { est: base.est + h * un, nord: base.nord - h * ue };
  const angle = r1 > 0 && r2 > 0 ? Math.abs(ecartAngle(azimut(gauche, c1), azimut(gauche, c2))) : 0;
  return { gauche, droite, angle };
}

/**
 * Essai B : point visé depuis deux stations, sans cap. mesures : [m1, m2] avec { station, distance,
 * angleVertical, inclinaison } ; cote : 'gauche' ou 'droite' (en allant de la station 1 vers la 2).
 * Le décalage du laser dépend de la direction de visée, inconnue au départ : on calcule, on vise le point
 * trouvé, on recalcule (5 tours suffisent largement pour quelques cm de décalage).
 * Renvoie { est, nord, altitude, altitude1, altitude2, ecartAltitude, angle, origines } ou { erreur }.
 */
export function pointParDeuxStations(mesures, montage, cote = 'gauche') {
  const [m1, m2] = mesures;
  if (!m1?.station || !m2?.station) return { erreur: 'il faut les deux stations' };
  if (!(m1.distance > 0) || !(m2.distance > 0)) return { erreur: 'distance du laser manquante' };
  const k1 = composantesLaser(m1.distance, m1.angleVertical);
  const k2 = composantesLaser(m2.distance, m2.angleVertical);
  let o1 = origineLaser(m1.station, { hauteur: montage?.hauteur ?? 0 }, 0, m1.inclinaison);
  let o2 = origineLaser(m2.station, { hauteur: montage?.hauteur ?? 0 }, 0, m2.inclinaison);
  let resultat = null;
  for (let tour = 0; tour < 5; tour += 1) {
    resultat = intersectionCercles(o1, k1.horizontale, o2, k2.horizontale);
    if (resultat.erreur) return resultat;
    const p = resultat[cote];
    o1 = origineLaser(m1.station, montage, azimut(o1, p), m1.inclinaison);
    o2 = origineLaser(m2.station, montage, azimut(o2, p), m2.inclinaison);
  }
  resultat = intersectionCercles(o1, k1.horizontale, o2, k2.horizontale);
  if (resultat.erreur) return resultat;
  const p = resultat[cote];
  const altitude1 = o1.altitude + k1.denivelee;
  const altitude2 = o2.altitude + k2.denivelee;
  return {
    est: p.est,
    nord: p.nord,
    altitude: (altitude1 + altitude2) / 2,
    altitude1,
    altitude2,
    ecartAltitude: altitude1 - altitude2,
    angle: resultat.angle,
    origines: [o1, o2],
  };
}

/** Écarts de B par rapport à A (référence) : { dEst, dNord, d2d, dAlt } (m ; dAlt null sans altitude). */
export function ecartsPoints(a, b) {
  const dEst = b.est - a.est;
  const dNord = b.nord - a.nord;
  const dAlt = Number.isFinite(a.altitude) && Number.isFinite(b.altitude) ? b.altitude - a.altitude : null;
  return { dEst, dNord, d2d: Math.hypot(dEst, dNord), dAlt };
}
