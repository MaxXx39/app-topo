// Dessin dans l'appli (Calculs › Dessin, demande du 26.10.2026) : calculs de géométrie, sans écran.
// - Cotes : on part d'un point A, dans la direction d'un point de référence B (A → B) ; le 1er côté
//   suit A → B, chaque côté suivant tourne de 90° à droite ou à gauche (en regardant le plan,
//   nord en haut), avec sa longueur.
// - Rectangle : un angle A, la longueur sur A → B, la largeur à droite ou à gauche.
// - Pente d'une plateforme : une altitude en un sommet, une pente en % le long d'un côté.
// Coordonnées en MN95 (m) : { est, nord } ; altitudes en m.

/** Vecteur unitaire de A vers B ({ est, nord }), ou null si A et B sont au même endroit. */
export function directionUnitaire(a, b) {
  const de = b.est - a.est;
  const dn = b.nord - a.nord;
  const longueur = Math.hypot(de, dn);
  return longueur < 1e-9 ? null : { est: de / longueur, nord: dn / longueur };
}

/** Direction tournée de 90° : à droite (sens des aiguilles d'une montre) ou à gauche. */
function tourner(direction, sens) {
  return sens === 'droite' ? { est: direction.nord, nord: -direction.est } : { est: -direction.nord, nord: direction.est };
}

/**
 * Contour par cotes : sommets [{ est, nord }] en partant de A. cotes : [{ longueur (m), tourne }] ;
 * le 1er côté suit A → B (son « tourne » est ignoré), puis chaque côté tourne de 90° ('droite' ou
 * 'gauche') par rapport au précédent. Le dernier sommet calculé est gardé même s'il retombe sur A
 * (voir ecartFermeture). Renvoie { sommets } ou { erreur }.
 */
export function contourParCotes(a, b, cotes) {
  let direction = directionUnitaire(a, b);
  if (!direction) return { erreur: 'le point de départ et le point de référence sont au même endroit' };
  const sommets = [{ est: a.est, nord: a.nord }];
  for (const [i, cote] of cotes.entries()) {
    if (!(cote.longueur > 0)) return { erreur: `côté ${i + 1} : longueur manquante ou nulle` };
    if (i > 0) {
      if (!['droite', 'gauche'].includes(cote.tourne)) return { erreur: `côté ${i + 1} : choisis à droite ou à gauche` };
      direction = tourner(direction, cote.tourne);
    }
    const dernier = sommets.at(-1);
    sommets.push({ est: dernier.est + direction.est * cote.longueur, nord: dernier.nord + direction.nord * cote.longueur });
  }
  return { sommets };
}

/**
 * Écart de fermeture d'un contour par cotes (m) : distance entre le dernier sommet et le premier.
 * 0 si le contour revient exactement à son départ.
 */
export function ecartFermeture(sommets) {
  if (sommets.length < 2) return 0;
  const premier = sommets[0];
  const dernier = sommets.at(-1);
  return Math.hypot(dernier.est - premier.est, dernier.nord - premier.nord);
}

/**
 * Rectangle : angle A, longueur (m) sur A → B, largeur (m) à droite ou à gauche de A → B.
 * Renvoie { sommets } (4 sommets, dans l'ordre du tour) ou { erreur }.
 */
export function rectangle(a, b, longueur, largeur, cote = 'droite') {
  if (!(longueur > 0) || !(largeur > 0)) return { erreur: 'longueur et largeur : deux nombres plus grands que 0' };
  const resultat = contourParCotes(a, b, [{ longueur }, { longueur: largeur, tourne: cote }, { longueur, tourne: cote }]);
  return resultat.erreur ? resultat : { sommets: resultat.sommets };
}

/**
 * Altitudes des sommets d'une plateforme en pente : altitude (m) au sommet n° "depuis", pente (%,
 * positive = monte) le long du côté n° "cote" (du sommet n° cote vers le suivant, le dernier côté
 * fermant sur le premier sommet). Chaque sommet prend l'altitude de son projeté sur cette direction.
 * Renvoie [altitude] ou null si le côté n'a pas de longueur.
 */
export function altitudesEnPente(sommets, { altitude, depuis = 0, cote = 0, pente = 0 }) {
  const direction = directionUnitaire(sommets[cote], sommets[(cote + 1) % sommets.length]);
  if (!direction) return null;
  const origine = sommets[depuis];
  return sommets.map((s) => altitude + (pente / 100) * ((s.est - origine.est) * direction.est + (s.nord - origine.nord) * direction.nord));
}
