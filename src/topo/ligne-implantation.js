// Implantation d'une ligne (onglet Terrain › Implanter › Ligne) : où est la canne par rapport à
// une ligne (polyligne du plan DXF, un de ses segments, ou suite de points du projet).
// La ligne a un sens : du début (premier sommet) vers la fin (dernier sommet).
// - abscisse : distance le long de la ligne depuis le début (m) ; négative avant le début,
//   plus grande que la longueur après la fin (on prolonge le premier ou le dernier segment) ;
// - décalage : distance perpendiculaire à la ligne (m), positive à droite (en regardant vers la
//   fin), négative à gauche ;
// - ligne parallèle : on peut implanter à une distance fixe de la ligne (décalage voulu, + à droite).
// Coordonnées MN95 Est, Nord (m), altitudes (m).

/** Longueur en plan d'une polyligne (m). */
export function longueurPolyligne(sommets) {
  let total = 0;
  for (let i = 0; i + 1 < sommets.length; i++) total += Math.hypot(sommets[i + 1].est - sommets[i].est, sommets[i + 1].nord - sommets[i].nord);
  return total;
}

/**
 * Position de "p" par rapport à la ligne : { abscisse (m), decalage (m, + à droite), longueur (m),
 * segment (n° du segment le plus proche), projete: { est, nord } (pied de la perpendiculaire),
 * droite: { est, nord } (direction « à droite » de ce segment, longueur 1) }.
 */
export function positionSurLigne(p, sommets) {
  let meilleur = null;
  let cumul = 0;
  const dernier = sommets.length - 2;
  for (let i = 0; i <= dernier; i++) {
    const a = sommets[i];
    const b = sommets[i + 1];
    const dx = b.est - a.est;
    const dy = b.nord - a.nord;
    const longueur = Math.hypot(dx, dy);
    if (longueur === 0) continue;
    const t = ((p.est - a.est) * dx + (p.nord - a.nord) * dy) / (longueur * longueur);
    // Avant le début ou après la fin : on prolonge le premier ou le dernier segment.
    const tBorne = Math.max(i === 0 ? -Infinity : 0, Math.min(i === dernier ? Infinity : 1, t));
    const projete = { est: a.est + dx * tBorne, nord: a.nord + dy * tBorne };
    const distance = Math.hypot(p.est - projete.est, p.nord - projete.nord);
    if (!meilleur || distance < meilleur.distance - 1e-9) {
      // À droite du segment : produit vectoriel négatif (le sens des aiguilles d'une montre).
      const cote = dx * (p.nord - a.nord) - dy * (p.est - a.est);
      meilleur = {
        distance,
        abscisse: cumul + tBorne * longueur,
        decalage: (cote > 0 ? -1 : 1) * distance,
        segment: i,
        projete,
        droite: { est: dy / longueur, nord: -dx / longueur },
      };
    }
    cumul += longueur;
  }
  if (!meilleur) return null;
  const { distance, ...resultat } = meilleur;
  return { ...resultat, longueur: cumul };
}

/**
 * Altitude de la ligne à cette abscisse (m), ou null : altitudes tapées au début et à la fin
 * (pente constante entre les deux), sinon celles des sommets (plan DXF en 3D). null avant le
 * début et après la fin.
 */
export function altitudeSurLigne(abscisse, sommets, altitudesTapees = {}) {
  const longueur = longueurPolyligne(sommets);
  if (abscisse < 0 || abscisse > longueur) return null;
  const { debut, fin } = altitudesTapees;
  if (debut != null && fin != null) return longueur > 0 ? debut + ((fin - debut) * abscisse) / longueur : debut;
  if (sommets.some((s) => s.altitude == null)) return null;
  let cumul = 0;
  for (let i = 0; i + 1 < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[i + 1];
    const l = Math.hypot(b.est - a.est, b.nord - a.nord);
    if (abscisse <= cumul + l || i + 2 === sommets.length) {
      const t = l > 0 ? (abscisse - cumul) / l : 0;
      return a.altitude + (b.altitude - a.altitude) * t;
    }
    cumul += l;
  }
  return sommets[0].altitude;
}

/**
 * Guidage vers la ligne (ou sa parallèle à "decalageVoulu" m, + à droite) :
 * { abscisse, longueur, reste (jusqu'à la fin, m), decalage (de la canne par rapport à la ligne),
 *   ecart (décalage − décalage voulu : > 0 la canne est trop à droite, il faut aller à gauche),
 *   cible: { est, nord, altitude } (point de la ligne voulue en face de la canne), altitude (ou null) }.
 */
export function guidageLigne(position, sommets, { decalageVoulu = 0, altitudes = {} } = {}) {
  const sur = positionSurLigne(position, sommets);
  if (!sur) return null;
  const altitude = altitudeSurLigne(sur.abscisse, sommets, altitudes);
  return {
    abscisse: sur.abscisse,
    longueur: sur.longueur,
    reste: sur.longueur - sur.abscisse,
    decalage: sur.decalage,
    ecart: sur.decalage - decalageVoulu,
    segment: sur.segment,
    cible: {
      est: sur.projete.est + sur.droite.est * decalageVoulu,
      nord: sur.projete.nord + sur.droite.nord * decalageVoulu,
      altitude,
    },
    altitude,
  };
}

/**
 * Ligne parallèle, pour le plan : chaque sommet déplacé de "decalage" m (+ à droite), les angles
 * pris à l'intersection des segments décalés.
 */
export function ligneParallele(sommets, decalage) {
  if (!decalage) return sommets;
  const normales = [];
  for (let i = 0; i + 1 < sommets.length; i++) {
    const dx = sommets[i + 1].est - sommets[i].est;
    const dy = sommets[i + 1].nord - sommets[i].nord;
    const l = Math.hypot(dx, dy) || 1;
    normales.push({ est: dy / l, nord: -dx / l });
  }
  return sommets.map((s, i) => {
    const avant = normales[i - 1] ?? normales[i];
    const apres = normales[i] ?? normales[i - 1];
    // Direction du coin : moyenne des deux normales, allongée pour garder la distance.
    const moyenne = { est: avant.est + apres.est, nord: avant.nord + apres.nord };
    const produit = moyenne.est * apres.est + moyenne.nord * apres.nord;
    const facteur = produit > 1e-6 ? decalage / produit : decalage;
    return { ...s, est: s.est + moyenne.est * facteur, nord: s.nord + moyenne.nord * facteur };
  });
}

/** Sommets d'une ligne choisie : toute la polyligne ou un seul segment, dans le sens voulu. */
export function sommetsChoisis(sommets, { segment = null, inverse = false } = {}) {
  const choisis = segment == null ? sommets : sommets.slice(segment, segment + 2);
  return inverse ? [...choisis].reverse() : choisis;
}
