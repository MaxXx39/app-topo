// Implantation d'un point (onglet Terrain, mode Implanter › Point) : trouver le point voulu sur le
// plan en le touchant (« accroche »), puis guider jusqu'à lui et noter les écarts une fois dessus.
//
// Cinq façons d'accrocher (choisies par l'utilisateur, 22.10.2026) :
// - 'point'   : un point du projet (levé, importé ou « À implanter »), pas ceux du plan DXF ;
// - 'sommet'  : le sommet (ou l'extrémité) de ligne le plus proche du doigt, et les points du plan DXF ;
// - 'milieu'  : le milieu du segment de ligne touché ;
// - 'ligne'   : l'endroit de la ligne le plus proche du doigt (projection sur le segment) ;
// - 'centre'  : le centre du cercle touché (sur le cercle ou dedans).
// Coordonnées MN95 Est, Nord (m) ; altitude (m) ou null si inconnue (plan en 2D).

export const MODES_ACCROCHE = ['point', 'sommet', 'milieu', 'ligne', 'centre'];

/**
 * Cherche le point accroché près de "position" ({ est, nord }), à moins de "tolerance" m.
 * sources = {
 *   lignes:  [{ points: [{ est, nord, altitude }] , ferme }],   (traits des plans DXF)
 *   cercles: [{ est, nord, rayon }],
 *   points:  [{ est, nord, altitude, nom }],                    (mode 'point' : points du projet ;
 *                                                                 mode 'sommet' : points du plan DXF)
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

  if (mode === 'sommet' || mode === 'point') {
    let meilleur = null;
    const essayer = (p, nom = null) => {
      const d = Math.hypot(position.est - p.est, position.nord - p.nord);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, p, nom };
    };
    for (const point of points) essayer(point, point.nom ?? null);
    if (mode === 'sommet') for (const ligne of lignes) for (const sommet of ligne.points) essayer(sommet);
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
 * Implantation d'une ligne : le trait du plan DXF le plus proche du doigt (à moins de "tolerance"
 * m), en entier (une polyligne fermée revient à son premier sommet), et le n° du segment touché.
 * Renvoie { sommets: [{ est, nord, altitude }], segment } ou null.
 */
export function accrocherTrait(position, tolerance, lignes = []) {
  let meilleur = null;
  for (const ligne of lignes) {
    const sommets = ligne.ferme && ligne.points.length >= 3 ? [...ligne.points, ligne.points[0]] : ligne.points;
    for (let i = 0; i + 1 < sommets.length; i++) {
      const { d } = projeterSurSegment(position, sommets[i], sommets[i + 1]);
      if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, sommets, segment: i };
    }
  }
  return meilleur ? { sommets: meilleur.sommets, segment: meilleur.segment } : null;
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

// Cibles affichées près du point (choix de l'utilisateur, 22.10.2026) : en dessous de 2 m, une
// cible dont le centre est le point ; elle « zoome » en dessous de 1 m, puis de 20 cm.
// [distance où elle commence (m), rayons des cercles (m), du plus grand au plus petit].
export const CIBLES = [
  { jusqua: 2, cercles: [2, 1.5, 1, 0.5] },
  { jusqua: 1, cercles: [1, 0.75, 0.5, 0.25] },
  { jusqua: 0.2, cercles: [0.2, 0.1, 0.05, 0.02] },
];
// Marge pour ne pas passer sans cesse d'une cible à l'autre quand on est juste à la limite (5 %).
const MARGE_CIBLE = 0.05;

/**
 * Cible à montrer pour une distance au point (m) : 0 = pas de cible (2 m ou plus), 1, 2 ou 3 =
 * numéro dans CIBLES. "precedente" (numéro affiché juste avant) évite de changer de cible tant
 * qu'on ne dépasse pas la limite de plus de 5 %.
 */
export function cibleSelonDistance(distance, precedente = 0) {
  let numero = 0;
  CIBLES.forEach((cible, i) => {
    if (distance < cible.jusqua) numero = i + 1;
  });
  if (numero === precedente) return numero;
  // Changement : seulement si on est bien entré dans la nouvelle zone (ou bien sorti de l'ancienne).
  if (numero > precedente) {
    const limite = CIBLES[numero - 1].jusqua;
    return distance < limite * (1 - MARGE_CIBLE) ? numero : precedente;
  }
  const limiteAncienne = CIBLES[precedente - 1].jusqua;
  return distance >= limiteAncienne * (1 + MARGE_CIBLE) ? numero : precedente;
}

// Couleur du rond de la canne dans la cible (choix de l'utilisateur, 22.10.2026) : rouge à plus
// de 1 m, orange de 1 m à 20 cm, puis de l'orange au vert peu à peu jusqu'à 3 cm, vert en dessous.
const ROUGE_CANNE = [220, 38, 38];
const ORANGE_CANNE = [249, 115, 22];
const VERT_CANNE = [22, 163, 74];

/** Couleur (« rgb(…) ») du rond de la canne selon la distance qui reste jusqu'au point (m). */
export function couleurCanne(distance) {
  const ecrire = (rvb) => `rgb(${rvb.map((v) => Math.round(v)).join(', ')})`;
  if (distance > 1) return ecrire(ROUGE_CANNE);
  if (distance > 0.2) return ecrire(ORANGE_CANNE);
  if (distance <= 0.03) return ecrire(VERT_CANNE);
  // Entre 20 cm (orange) et 3 cm (vert) : mélange proportionnel.
  const t = (0.2 - distance) / (0.2 - 0.03);
  return ecrire(ORANGE_CANNE.map((v, i) => v + (VERT_CANNE[i] - v) * t));
}

/**
 * Écarts à montrer selon le guidage choisi :
 * - 'rx2' : « avance / recule », « droite / gauche » selon la direction regardée (cap du RX2, ou
 *   sens de la marche ; sans orientation : comme 'nseo') ;
 * - 'nseo' : nord / sud, est / ouest (on se tourne vers le nord : devant = nord, derrière = sud).
 * Renvoie { haut, droite } (m) : ce qui est devant / en haut de la cible (> 0) et à droite (> 0),
 * et nordEnHaut (vrai si la cible et la flèche sont orientées nord en haut).
 */
export function ecartsGuidage(g, mode) {
  if (mode === 'rx2' && g.avance != null) return { haut: g.avance, droite: g.droite, nordEnHaut: false };
  return { haut: g.nord, droite: g.est, nordEnHaut: true };
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
 * nom, position voulue, position mesurée, écarts (m, 3 décimales), date ; pour une ligne, aussi
 * l'abscisse et le décalage (m).
 */
export function csvImplantations(implantations) {
  const n = (valeur) => (valeur == null ? '' : valeur.toFixed(3));
  const texte = (valeur) => (/[;"\r\n]/.test(valeur) ? `"${valeur.replaceAll('"', '""')}"` : valeur);
  const lignes = ['Nom;Est voulu;Nord voulu;Altitude voulue;Est mesuré;Nord mesuré;Altitude mesurée;dEst;dNord;Distance;dAltitude;Date;Abscisse;Décalage'];
  for (const { nom, cible, mesure, ecarts, le, ligne } of implantations) {
    // Ligne : abscisse (depuis le début) et décalage (+ à droite) en plus ; vides pour un point.
    lignes.push([texte(nom ?? ''), n(cible.est), n(cible.nord), n(cible.altitude), n(mesure.est), n(mesure.nord), n(mesure.altitude), n(ecarts.dEst), n(ecarts.dNord), n(ecarts.distance), n(ecarts.dAltitude), le ?? '', n(ligne?.abscisse), n(ligne?.decalage)].join(';'));
  }
  return `${lignes.join('\r\n')}\r\n`;
}
