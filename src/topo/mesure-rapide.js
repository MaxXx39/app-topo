// Mesure rapide (0.158.0, demande du 08.11, formules validées le 08.11) : des points touchés sur le plan
// ou pris au GNSS, sans rien enregistrer ; on lit tout de suite :
// - 1 point : Est, Nord, altitude (et son nom s'il en a un) ;
// - 2 points et plus : pour chaque côté, longueur à plat (2D), longueur 3D = √(2D² + Δh²),
//   Δh = altitude d'arrivée − altitude de départ, pente = Δh ÷ longueur 2D × 100 (%) ;
// - 3 points et plus : la figure est fermée (le dernier point revient au premier) : périmètre 2D et 3D,
//   surface à plat (2D, formule du lacet) et surface inclinée (3D : somme des triangles de la figure) ;
// - 3 points et plus (0.214.0) : angle à chaque sommet, en degrés décimaux, à plat (2D). Ligne ouverte : angle entre les deux côtés
//   voisins (0 à 180°), aux points du milieu seulement. Figure fermée : angle intérieur de la figure à chaque sommet (0 à 360°,
//   plus de 180° pour un coin rentrant ; la somme fait (n − 2) × 180°).
// Coordonnées MN95 en mètres. Sans altitude, les valeurs 3D, Δh et pente sont null (jamais inventées).

/** Longueur à plat (m) entre deux points { est, nord }. */
export function longueur2d(a, b) {
  return Math.hypot(b.est - a.est, b.nord - a.nord);
}

const aAltitude = (p) => p.altitude != null && Number.isFinite(p.altitude);

/**
 * Valeurs d'un côté de a vers b : { longueur2d, longueur3d, deltaH, pente } (m, m, m, %).
 * longueur3d, deltaH et pente valent null si une altitude manque ; pente aussi si les points sont confondus en plan.
 */
export function valeursCote(a, b) {
  const l2d = longueur2d(a, b);
  if (!aAltitude(a) || !aAltitude(b)) return { longueur2d: l2d, longueur3d: null, deltaH: null, pente: null };
  const deltaH = b.altitude - a.altitude;
  return { longueur2d: l2d, longueur3d: Math.hypot(l2d, deltaH), deltaH, pente: l2d > 0 ? (deltaH / l2d) * 100 : null };
}

/**
 * Angles de la figure en degrés décimaux : tableau de n valeurs (null = pas d'angle à ce point). 3 points au moins, sinon tout est null.
 * Ligne ouverte : angle géométrique au point (0 à 180°) pour les points du milieu, null aux deux bouts. Figure fermée : angle intérieur
 * à chaque sommet. null aussi si deux points voisins sont confondus en plan.
 */
export function anglesDeLaFigure(points, fermee = true) {
  const n = points.length;
  const angles = new Array(n).fill(null);
  if (n < 3) return angles;
  let sens = 1; // +1 : figure dans le sens trigonométrique (Est, Nord), −1 : sens inverse
  if (fermee) {
    let double = 0;
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      double += a.est * b.nord - b.est * a.nord;
    }
    if (double < 0) sens = -1;
  }
  const debut = fermee ? 0 : 1;
  const fin = fermee ? n : n - 1;
  for (let i = debut; i < fin; i += 1) {
    const a = points[(i + n - 1) % n];
    const b = points[i];
    const c = points[(i + 1) % n];
    const [abE, abN, bcE, bcN] = [b.est - a.est, b.nord - a.nord, c.est - b.est, c.nord - b.nord];
    if (Math.hypot(abE, abN) === 0 || Math.hypot(bcE, bcN) === 0) continue;
    // Virage en b, de la direction a→b vers b→c (−180 à 180°, + à gauche).
    const virage = (Math.atan2(abE * bcN - abN * bcE, abE * bcE + abN * bcN) * 180) / Math.PI;
    angles[i] = fermee ? 180 - sens * virage : 180 - Math.abs(virage);
  }
  return angles;
}

/** Surface à plat (m², toujours positive) d'un polygone fermé (formule du lacet). */
export function surface2d(points) {
  let double = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    double += a.est * b.nord - b.est * a.nord;
  }
  return Math.abs(double) / 2;
}

/** Surface 3D (m²) d'un triangle de points { est, nord, altitude } : moitié du produit vectoriel. */
function surfaceTriangle3d(a, b, c) {
  const u = [b.est - a.est, b.nord - a.nord, b.altitude - a.altitude];
  const v = [c.est - a.est, c.nord - a.nord, c.altitude - a.altitude];
  return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
}

/** Vrai si p est dans le triangle abc (en plan, bords compris). */
function dansTriangle(p, a, b, c) {
  const signe = (u, v, w) => (u.est - w.est) * (v.nord - w.nord) - (v.est - w.est) * (u.nord - w.nord);
  const d1 = signe(p, a, b);
  const d2 = signe(p, b, c);
  const d3 = signe(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/**
 * Triangles d'un polygone simple (« oreilles » : on coupe un coin après l'autre), en plan ; marche
 * aussi pour une figure en creux (forme en L). Renvoie des triplets d'indices.
 */
export function trianglesDuPolygone(points) {
  const restants = points.map((_, i) => i);
  // Sens trigonométrique pour reconnaître les coins saillants.
  let double = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    double += a.est * b.nord - b.est * a.nord;
  }
  if (double < 0) restants.reverse();
  const triangles = [];
  let garde = 0;
  while (restants.length > 3 && garde < 10000) {
    garde += 1;
    let coupe = false;
    for (let k = 0; k < restants.length; k += 1) {
      const [ia, ib, ic] = [restants[(k + restants.length - 1) % restants.length], restants[k], restants[(k + 1) % restants.length]];
      const [a, b, c] = [points[ia], points[ib], points[ic]];
      const saillant = (b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est) > 0;
      if (!saillant) continue;
      if (restants.some((i) => i !== ia && i !== ib && i !== ic && dansTriangle(points[i], a, b, c))) continue;
      triangles.push([ia, ib, ic]);
      restants.splice(k, 1);
      coupe = true;
      break;
    }
    // Figure qui se croise (aucune oreille) : on finit en éventail depuis le premier point.
    if (!coupe) {
      for (let k = 1; k < restants.length - 1; k += 1) triangles.push([restants[0], restants[k], restants[k + 1]]);
      return triangles;
    }
  }
  if (restants.length === 3) triangles.push([...restants]);
  return triangles;
}

/**
 * Mesure rapide de la liste de points (dans l'ordre où ils ont été choisis). Renvoie
 * { points, cotes: [{ de, a, longueur2d, longueur3d, deltaH, pente }], longueur2d, longueur3d,
 *   ferme: { perimetre2d, perimetre3d, surface2d, surface3d } ou null }.
 * de / a = numéros des points (1, 2…). 2 points : un côté. 3 points et plus : la figure est fermée
 * (dernier côté = du dernier point au premier). longueur2d / longueur3d = total des côtés (le périmètre si fermée).
 */
export function mesureRapide(points, { fermee = true } = {}) {
  const n = points.length;
  const cotes = [];
  // 0.186.0 : dès 3 points, figure fermée (défaut) ou ligne ouverte 1-2-3-4 (sans côté de fermeture ni surface).
  const ouverte = n >= 3 && !fermee;
  const nombreCotes = n >= 3 && !ouverte ? n : Math.max(0, n - 1);
  for (let i = 0; i < nombreCotes; i += 1) {
    const j = (i + 1) % n;
    cotes.push({ de: i + 1, a: j + 1, ...valeursCote(points[i], points[j]) });
  }
  const somme = (cle) => (cotes.some((c) => c[cle] == null) ? null : cotes.reduce((total, c) => total + c[cle], 0));
  const total2d = cotes.length > 0 ? somme('longueur2d') : null;
  const total3d = cotes.length > 0 ? somme('longueur3d') : null;
  let ferme = null;
  if (n >= 3 && !ouverte) {
    const avecAltitudes = points.every(aAltitude);
    ferme = {
      perimetre2d: total2d,
      perimetre3d: total3d,
      surface2d: surface2d(points),
      surface3d: avecAltitudes ? trianglesDuPolygone(points).reduce((total, [a, b, c]) => total + surfaceTriangle3d(points[a], points[b], points[c]), 0) : null,
    };
  }
  return { points, cotes, longueur2d: total2d, longueur3d: total3d, ferme, ouverte, angles: anglesDeLaFigure(points, !ouverte) };
}
