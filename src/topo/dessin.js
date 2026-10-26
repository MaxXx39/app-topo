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

// --- Pilote (comme Leica iCON) : depuis le dernier sommet, une direction et une distance ---

/**
 * Gisement de A vers B (gon) : 0 = Nord, sens des aiguilles d'une montre (100 = Est, 200 = Sud,
 * 300 = Ouest), entre 0 et 400. null si A et B sont au même endroit.
 */
export function gisement(a, b) {
  const de = b.est - a.est;
  const dn = b.nord - a.nord;
  if (Math.hypot(de, dn) < 1e-9) return null;
  const gon = (Math.atan2(de, dn) * 200) / Math.PI;
  return (gon + 400) % 400;
}

/** Gisement ramené entre 0 et 400 gon (ex. 420 → 20, −100 → 300). */
export function gisementNormal(gon) {
  return ((gon % 400) + 400) % 400;
}

/** Point à "distance" m de P dans la direction "gon" (gisement). Renvoie { est, nord }. */
export function pointSelonGisement(p, gon, distance) {
  const angle = (gon * Math.PI) / 200;
  return { est: p.est + distance * Math.sin(angle), nord: p.nord + distance * Math.cos(angle) };
}

/** Aire d'un polygone fermé (m², à plat), quel que soit le sens des sommets. */
export function airePolygone(sommets) {
  let double = 0;
  for (let i = 0; i < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    double += a.est * b.nord - b.est * a.nord;
  }
  return Math.abs(double) / 2;
}

/** Longueurs des côtés (m, à plat) ; un dessin fermé a aussi le côté du dernier sommet au premier. */
export function longueursCotes(sommets, ferme) {
  const longueurs = [];
  const nombre = ferme && sommets.length > 2 ? sommets.length : sommets.length - 1;
  for (let i = 0; i < nombre; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    longueurs.push(Math.hypot(b.est - a.est, b.nord - a.nord));
  }
  return longueurs;
}

/** Vrai si le dessin est une figure fermée (plateforme, bâtiment). */
export function estFerme(dessin) {
  return dessin.type === 'plateforme' || dessin.type === 'batiment';
}

/**
 * Altitudes des sommets d'un dessin (m, ou null) : par sommet (mode 'sommets'), ou une altitude
 * fixe, avec éventuellement une pente le long d'un côté (voir altitudesEnPente).
 */
export function altitudesDuDessin(dessin) {
  const { sommets, hauteur } = dessin;
  if (!hauteur || hauteur.mode === 'sommets' || hauteur.altitude == null) return sommets.map((s) => s.altitude ?? null);
  const pente = hauteur.pente;
  if (pente?.pourcent && sommets.length >= 2) {
    const cote = Math.min(pente.cote ?? 0, sommets.length - 1);
    const depuis = Math.min(pente.depuis ?? 0, sommets.length - 1);
    return altitudesEnPente(sommets, { altitude: hauteur.altitude, depuis, cote, pente: pente.pourcent }) ?? sommets.map(() => hauteur.altitude);
  }
  return sommets.map(() => hauteur.altitude);
}

// Natures de dessin : [clé, nom (aussi le début du nom automatique)].
export const TYPES_DESSIN = [
  ['plateforme', 'Plateforme'],
  ['batiment', 'Bâtiment'],
  ['ligne', 'Ligne'],
  ['points', 'Points'],
];

/** Nom automatique d'un nouveau dessin : « Plateforme 2 » (le numéro suivant de ce type). */
export function nomDessin(type, dessins) {
  const debut = TYPES_DESSIN.find(([cle]) => cle === type)?.[1] ?? 'Dessin';
  const numeros = dessins.map((d) => new RegExp(`^${debut} (\\d+)$`).exec(d.nom)?.[1]).filter(Boolean).map(Number);
  return `${debut} ${Math.max(0, ...numeros) + 1}`;
}

// --- Implanter un dessin : ses sommets sont des points, chacun de ses côtés une ligne ---

// Abréviations des noms de sommets (demande du 26.10.2026) : PF1-1 = plateforme 1, sommet 1.
export const ABREVIATIONS_DESSIN = { plateforme: 'PF', batiment: 'BAT', ligne: 'LI', points: 'PT' };

/**
 * Numéro d'un dessin dans son type (le 1 de « PF1-1 ») : celui gardé à la création, sinon sa
 * place parmi les dessins du même type.
 */
export function numeroDessin(dessin, dessins) {
  if (dessin.numero) return dessin.numero;
  return dessins.filter((d) => d.type === dessin.type).indexOf(dessin) + 1;
}

/**
 * Points d'un dessin, prêts à implanter : [{ nom (« PF1-1 »…), est, nord, altitude (m ou null) }],
 * l'altitude calculée (fixe, pente ou par sommet, voir altitudesDuDessin).
 */
export function pointsDuDessin(dessin, dessins) {
  const debut = `${ABREVIATIONS_DESSIN[dessin.type] ?? 'D'}${numeroDessin(dessin, dessins)}`;
  const altitudes = altitudesDuDessin(dessin);
  return dessin.sommets.map((s, i) => ({ nom: `${debut}-${i + 1}`, est: s.est, nord: s.nord, altitude: altitudes[i] ?? null }));
}

/**
 * Côtés d'un dessin, chacun une ligne à implanter : [{ nom (« PF1-1 → PF1-2 »), sommets: [a, b] }] ;
 * un dessin fermé a aussi le côté du dernier sommet au premier ; un dessin « points » n'en a pas.
 */
export function cotesDuDessin(dessin, dessins) {
  if (dessin.type === 'points') return [];
  const points = pointsDuDessin(dessin, dessins);
  const nombre = estFerme(dessin) && points.length > 2 ? points.length : points.length - 1;
  const cotes = [];
  for (let i = 0; i < nombre; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    cotes.push({ nom: `${a.nom} → ${b.nom}`, sommets: [a, b] });
  }
  return cotes;
}

/** Distance (m) d'une position au segment [a, b]. */
function distanceAuSegment(p, a, b) {
  const de = b.est - a.est;
  const dn = b.nord - a.nord;
  const carre = de * de + dn * dn;
  const t = carre === 0 ? 0 : Math.max(0, Math.min(1, ((p.est - a.est) * de + (p.nord - a.nord) * dn) / carre));
  return Math.hypot(p.est - (a.est + t * de), p.nord - (a.nord + t * dn));
}

/** Côté (voir cotesDuDessin) le plus proche de "position", à moins de "tolerance" m ; ou null. */
export function coteSousLeDoigt(position, tolerance, cotes) {
  let meilleur = null;
  for (const cote of cotes) {
    const d = distanceAuSegment(position, cote.sommets[0], cote.sommets[1]);
    if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, cote };
  }
  return meilleur?.cote ?? null;
}

// --- Plateforme ou bâtiment → surface de terrassement (Calculs › Surfaces) ---

/** Aire signée (m²) : positive si les sommets tournent dans le sens inverse des aiguilles d'une montre. */
function aireSignee(sommets) {
  let double = 0;
  for (let i = 0; i < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    double += a.est * b.nord - b.est * a.nord;
  }
  return double / 2;
}

/** Vrai si deux côtés non voisins du contour fermé se coupent. */
export function contourSeCroise(sommets) {
  const n = sommets.length;
  const cote = (a, b, c) => Math.sign((b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // côtés voisins : ils se touchent au sommet commun
      const [a, b] = [sommets[i], sommets[(i + 1) % n]];
      const [c, d] = [sommets[j], sommets[(j + 1) % n]];
      if (cote(a, b, c) * cote(a, b, d) < 0 && cote(c, d, a) * cote(c, d, b) < 0) return true;
    }
  }
  return false;
}

/**
 * Triangles d'un polygone simple (même en forme de L), par la méthode des « oreilles » : on coupe
 * un à un les coins saillants qui ne contiennent aucun autre sommet. Renvoie [[i, j, k]] (numéros
 * des sommets), ou null si le contour se croise (aucune oreille trouvée).
 */
export function trianglesPolygone(sommets) {
  const n = sommets.length;
  if (n < 3 || contourSeCroise(sommets)) return null;
  const sens = aireSignee(sommets) >= 0 ? 1 : -1;
  const restants = sommets.map((_, i) => i);
  const triangles = [];
  const produit = (a, b, c) => ((b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est)) * sens;
  const dedans = (p, a, b, c) => produit(a, b, p) > 1e-12 && produit(b, c, p) > 1e-12 && produit(c, a, p) > 1e-12;
  let garde = 0;
  while (restants.length > 3 && garde++ < n * n) {
    let coupe = false;
    for (let k = 0; k < restants.length; k++) {
      const [ia, ib, ic] = [restants[(k + restants.length - 1) % restants.length], restants[k], restants[(k + 1) % restants.length]];
      const [a, b, c] = [sommets[ia], sommets[ib], sommets[ic]];
      if (produit(a, b, c) <= 1e-12) continue; // coin rentrant (ou plat)
      if (restants.some((i) => i !== ia && i !== ib && i !== ic && dedans(sommets[i], a, b, c))) continue;
      triangles.push([ia, ib, ic]);
      restants.splice(k, 1);
      coupe = true;
      break;
    }
    if (!coupe) return null;
  }
  if (restants.length === 3) triangles.push(restants.slice());
  return triangles;
}

/**
 * Surface d'une plateforme ou d'un bâtiment : { points: [{ nom, est, nord, altitude }], faces:
 * [[i, j, k]] } (même forme qu'une surface importée), ou { erreur } (moins de 3 sommets, une
 * altitude manque, contour qui se croise).
 */
export function surfaceDuDessin(dessin, dessins) {
  if (!estFerme(dessin) || dessin.sommets.length < 3) return { erreur: 'il faut au moins 3 sommets' };
  const points = pointsDuDessin(dessin, dessins);
  const sans = points.filter((p) => p.altitude == null).map((p) => p.nom);
  if (sans.length > 0) return { erreur: `altitude manquante : ${sans.join(', ')}` };
  const faces = trianglesPolygone(points);
  if (!faces) return { erreur: 'le contour se croise' };
  return { points, faces };
}
