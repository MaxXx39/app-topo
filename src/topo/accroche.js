// Implantation d'un point (onglet Terrain, mode Contrôler › Point) : trouver le point voulu sur le
// plan en le touchant (« accroche »), puis guider jusqu'à lui et noter les écarts une fois dessus.
//
// Quatre façons d'accrocher (choisies par l'utilisateur, 22.10.2026) :
// - 'sommet'  : le sommet (ou l'extrémité) de ligne le plus proche du doigt ; aussi les points des
//               plans DXF, les points levés et les points « À implanter » ;
// - 'milieu'  : le milieu du segment de ligne touché ;
// - 'ligne'   : l'endroit de la ligne le plus proche du doigt (projection sur le segment) ;
// - 'centre'  : le centre du cercle touché (sur le cercle ou dedans).
// Coordonnées MN95 Est, Nord (m) ; altitude (m) ou null si inconnue (plan en 2D).

export const MODES_ACCROCHE = ['sommet', 'milieu', 'ligne', 'centre'];

/**
 * Cherche le point accroché près de "position" ({ est, nord }), à moins de "tolerance" m.
 * sources = {
 *   lignes:  [{ points: [{ est, nord, altitude }] , ferme }],   (traits des plans DXF)
 *   cercles: [{ est, nord, rayon }],
 *   points:  [{ est, nord, altitude, nom }],                    (points DXF, levés, à implanter)
 * }
 * Renvoie { est, nord, altitude (ou null), mode, nom (pour un point existant) } ou null.
 */
export function accrocher(mode, position, tolerance, { lignes = [], cercles = [], points = [] }) {
  if (mode === 'centre') {
    let meilleur = null;
    for (const cercle of cercles) {
      const d = Math.hypot(position.est - cercle.est, position.nord - cercle.nord);
      // Dans le cercle, ou sur son bord à la tolérance près ; le plus proche du centre ou du bord.
      if (d > cercle.rayon + tolerance) continue;
      const proximite = Math.min(d, Math.abs(d - cercle.rayon));
      if (!meilleur || proximite < meilleur.proximite) meilleur = { proximite, cercle };
    }
    return meilleur ? { est: meilleur.cercle.est, nord: meilleur.cercle.nord, altitude: meilleur.cercle.altitude ?? null, mode } : null;
  }

  if (mode === 'sommet') {
    let meilleur = null;
    const essayer = (p, nom = null) => {
      const d = Math.hypot(position.est - p.est, position.nord - p.nord);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, p, nom };
    };
    for (const point of points) essayer(point, point.nom ?? null);
    for (const ligne of lignes) for (const sommet of ligne.points) essayer(sommet);
    return meilleur ? { est: meilleur.p.est, nord: meilleur.p.nord, altitude: meilleur.p.altitude ?? null, mode, nom: meilleur.nom } : null;
  }

  // 'milieu' et 'ligne' : le segment le plus proche du doigt.
  let meilleur = null;
  for (const ligne of lignes) {
    const sommets = ligne.points;
    const nombre = ligne.ferme ? sommets.length : sommets.length - 1;
    for (let i = 0; i < nombre; i++) {
      const a = sommets[i];
      const b = sommets[(i + 1) % sommets.length];
      const { d, t } = projeterSurSegment(position, a, b);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, t, a, b };
    }
  }
  if (!meilleur) return null;
  const t = mode === 'milieu' ? 0.5 : meilleur.t;
  const { a, b } = meilleur;
  const altitude = a.altitude != null && b.altitude != null ? a.altitude + (b.altitude - a.altitude) * t : null;
  return { est: a.est + (b.est - a.est) * t, nord: a.nord + (b.nord - a.nord) * t, altitude, mode };
}

/**
 * Projection d'un point sur le segment a-b : t (0 en a, 1 en b) et distance d (m) entre le point
 * et sa projection.
 */
export function projeterSurSegment(p, a, b) {
  const dx = b.est - a.est;
  const dy = b.nord - a.nord;
  const longueur2 = dx * dx + dy * dy;
  const t = longueur2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.est - a.est) * dx + (p.nord - a.nord) * dy) / longueur2));
  return { t, d: Math.hypot(p.est - (a.est + dx * t), p.nord - (a.nord + dy * t)) };
}

/**
 * Ce qu'il reste à faire pour aller de la position à la cible (m) :
 * - nord, est : écarts sur la carte (positifs vers le nord, vers l'est) ;
 * - avance, droite : les mêmes dans la direction regardée (azimut en degrés depuis le nord, sens
 *   des aiguilles d'une montre) : avance > 0 devant, < 0 derrière ; droite > 0 à droite, < 0 à gauche ;
 *   null si l'orientation n'est pas connue ;
 * - distance : distance en plan ; direction : azimut de la cible vu de la position (°).
 */
export function guidage(position, cible, azimut = null) {
  const est = cible.est - position.est;
  const nord = cible.nord - position.nord;
  const distance = Math.hypot(est, nord);
  const direction = ((Math.atan2(est, nord) * 180) / Math.PI + 360) % 360;
  if (azimut == null) return { est, nord, distance, direction, avance: null, droite: null };
  const a = (azimut * Math.PI) / 180;
  return {
    est,
    nord,
    distance,
    direction,
    avance: est * Math.sin(a) + nord * Math.cos(a),
    droite: est * Math.cos(a) - nord * Math.sin(a),
  };
}

/**
 * Écarts d'une implantation : position mesurée − position voulue (m), comme dans un rapport
 * d'implantation : dEst, dNord, distance en plan, et dAltitude si l'altitude voulue est connue.
 */
export function ecartsImplantation(cible, mesure) {
  const dEst = mesure.est - cible.est;
  const dNord = mesure.nord - cible.nord;
  return {
    dEst,
    dNord,
    distance: Math.hypot(dEst, dNord),
    dAltitude: cible.altitude != null && mesure.altitude != null ? mesure.altitude - cible.altitude : null,
  };
}

/**
 * Couleur de la distance qui reste jusqu'au point (m) : vert clair jusqu'à 2 cm, jaune orangé
 * jusqu'à 5 cm, sinon bleu nuit (encore loin). Renvoie 'vert-clair', 'jaune-orange' ou 'loin'.
 */
export function classeDistance(distance) {
  const valeur = Math.round(distance * 10000) / 10000;
  if (valeur <= 0.02) return 'vert-clair';
  if (valeur <= 0.05) return 'jaune-orange';
  return 'loin';
}

/** Nom proposé pour un nouveau point à implanter : I-1, I-2… (le plus grand du projet + 1). */
export function nomPointAImplanter(points) {
  let plusGrand = 0;
  for (const { nom } of points) {
    const trouve = /^I-(\d+)$/.exec(nom);
    if (trouve) plusGrand = Math.max(plusGrand, Number(trouve[1]));
  }
  return `I-${plusGrand + 1}`;
}

/**
 * Traits, cercles et points des plans DXF (calques visibles seulement) près de "position", à moins
 * de "rayon" m, en coordonnées MN95, prêts pour accrocher() (voir topo/dxf-plan.js pour le format).
 * Une altitude 0 veut dire « pas d'altitude » (plan en 2D).
 */
export function sourcesDesPlans(plans, position, rayon) {
  const lignes = [];
  const cercles = [];
  const points = [];
  const altitude = (z) => (z ? z : null);
  for (const plan of plans) {
    if (!plan.contenu) continue;
    const { est: e0, nord: n0 } = plan.origine;
    const visible = (objet) => plan.calques[objet.c]?.visible !== false;
    // Zone touchée, dans le repère du plan.
    const x = position.est - e0;
    const y = position.nord - n0;
    const pres = (xMin, yMin, xMax, yMax) => xMin <= x + rayon && xMax >= x - rayon && yMin <= y + rayon && yMax >= y - rayon;
    for (const trait of plan.contenu.traits ?? []) {
      if (!visible(trait)) continue;
      const p = trait.p;
      let xMin = Infinity;
      let yMin = Infinity;
      let xMax = -Infinity;
      let yMax = -Infinity;
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < xMin) xMin = p[i];
        if (p[i] > xMax) xMax = p[i];
        if (p[i + 1] < yMin) yMin = p[i + 1];
        if (p[i + 1] > yMax) yMax = p[i + 1];
      }
      if (!pres(xMin, yMin, xMax, yMax)) continue;
      const sommets = [];
      for (let i = 0; i < p.length; i += 2) sommets.push({ est: e0 + p[i], nord: n0 + p[i + 1], altitude: altitude(trait.z?.[i / 2]) });
      lignes.push({ points: sommets, ferme: Boolean(trait.f) });
    }
    for (const cercle of plan.contenu.cercles ?? []) {
      if (!visible(cercle) || !pres(cercle.x - cercle.r, cercle.y - cercle.r, cercle.x + cercle.r, cercle.y + cercle.r)) continue;
      cercles.push({ est: e0 + cercle.x, nord: n0 + cercle.y, rayon: cercle.r });
    }
    for (const point of plan.contenu.points ?? []) {
      if (!visible(point) || !pres(point.x, point.y, point.x, point.y)) continue;
      points.push({ est: e0 + point.x, nord: n0 + point.y, altitude: altitude(point.z) });
    }
  }
  return { lignes, cercles, points };
}

/**
 * Lignes CSV (point-virgule, comme les autres exports) des implantations enregistrées :
 * nom, position voulue, position mesurée, écarts (m, 3 décimales), date.
 */
export function csvImplantations(implantations) {
  const n = (valeur) => (valeur == null ? '' : valeur.toFixed(3));
  const texte = (valeur) => (/[;"\r\n]/.test(valeur) ? `"${valeur.replaceAll('"', '""')}"` : valeur);
  const lignes = ['Nom;Est voulu;Nord voulu;Altitude voulue;Est mesuré;Nord mesuré;Altitude mesurée;dEst;dNord;Distance;dAltitude;Date'];
  for (const { nom, cible, mesure, ecarts, le } of implantations) {
    lignes.push([texte(nom ?? ''), n(cible.est), n(cible.nord), n(cible.altitude), n(mesure.est), n(mesure.nord), n(mesure.altitude), n(ecarts.dEst), n(ecarts.dNord), n(ecarts.distance), n(ecarts.dAltitude), le ?? ''].join(';'));
  }
  return `${lignes.join('\r\n')}\r\n`;
}
