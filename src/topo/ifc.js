// Maquette IFC (bâtiment, structure… dessiné dans Revit, ArchiCAD…) : coupes horizontales (plan) et
// verticales (coupes d'Implanter, de Réseaux, du Guidage).
//
// La lecture du fichier IFC lui-même se fait avec la bibliothèque web-ifc (voir import/ifc.js) ; ici,
// seulement les calculs sur la maquette déjà lue, rangée dans le projet ainsi :
// maquette : {
//   origine: { est, nord },            coin sud-ouest arrondi au mètre (m, MN95)
//   niveaux: [{ nom, altitude }],      étages du fichier (altitude du sol fini, m)
//   types:   ['Murs', 'Dalles', …],     un calque par type d'objet
//   objets:  [{ t (n° du type), n (nom), v: [x, y, z, x, y, z…], i: [a, b, c, a, b, c…] }]
// }
// v : sommets en millimètres entiers (x, y depuis l'origine ; z = altitude absolue) ; i : triangles
// (3 numéros de sommets chacun). Coordonnées Est, Nord, altitude, MN95, sans aucune conversion.

/** Calques des objets IFC : nom français et couleur, d'après le type IFC (en majuscules). */
export const TYPES_IFC = [
  { nom: 'Murs', couleur: '#dc2626', ifc: ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCWALLELEMENTEDCASE', 'IFCCURTAINWALL'] },
  { nom: 'Dalles', couleur: '#2563eb', ifc: ['IFCSLAB', 'IFCROOF', 'IFCCOVERING', 'IFCPLATE'] },
  { nom: 'Poteaux', couleur: '#7c3aed', ifc: ['IFCCOLUMN', 'IFCPILE', 'IFCMEMBER'] },
  { nom: 'Poutres', couleur: '#ea580c', ifc: ['IFCBEAM'] },
  { nom: 'Fondations', couleur: '#a16207', ifc: ['IFCFOOTING'] },
  { nom: 'Escaliers', couleur: '#0891b2', ifc: ['IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAMP', 'IFCRAMPFLIGHT', 'IFCRAILING'] },
  { nom: 'Portes et fenêtres', couleur: '#16a34a', ifc: ['IFCDOOR', 'IFCWINDOW'] },
  { nom: 'Autres', couleur: '#6b7280', ifc: [] },
];

/** Calque (nom français) d'un type IFC (ex. 'IfcWall' → 'Murs'), 'Autres' s'il n'est pas connu. */
export function calqueDuTypeIfc(typeIfc) {
  const type = String(typeIfc ?? '').toUpperCase();
  return (TYPES_IFC.find((t) => t.ifc.includes(type)) ?? TYPES_IFC.at(-1)).nom;
}

/** Couleur d'un calque IFC (nom français). */
export function couleurCalqueIfc(nom) {
  return (TYPES_IFC.find((t) => t.nom === nom) ?? TYPES_IFC.at(-1)).couleur;
}

// Hauteur de la coupe en plan au-dessus du niveau choisi (m), décidée le 17.11 : +1.00 m.
export const HAUTEUR_COUPE_NIVEAU = 1;

// Petit décalage de l'altitude (ou de la position) de coupe : évite les sommets pile sur le plan de
// coupe (cas fréquent : dessus d'une dalle exactement au niveau), qui donneraient des contours cassés.
const DECALAGE = 1e-6;

/**
 * Sommets d'un objet en mètres (Est, Nord, altitude), calculés une seule fois par objet.
 */
const sommetsEnCache = new WeakMap();
function sommetsEnMetres(objet, origine) {
  let s = sommetsEnCache.get(objet);
  if (!s) {
    s = new Float64Array(objet.v.length);
    for (let k = 0; k < objet.v.length; k += 3) {
      s[k] = origine.est + objet.v[k] / 1000;
      s[k + 1] = origine.nord + objet.v[k + 1] / 1000;
      s[k + 2] = objet.v[k + 2] / 1000;
    }
    sommetsEnCache.set(objet, s);
  }
  return s;
}

/** Boîte englobante d'un objet (m) : { estMin, nordMin, altMin, estMax, nordMax, altMax }, en cache. */
const boitesEnCache = new WeakMap();
export function boiteObjet(objet, origine) {
  let b = boitesEnCache.get(objet);
  if (!b) {
    const s = sommetsEnMetres(objet, origine);
    b = { estMin: Infinity, nordMin: Infinity, altMin: Infinity, estMax: -Infinity, nordMax: -Infinity, altMax: -Infinity };
    for (let k = 0; k < s.length; k += 3) {
      if (s[k] < b.estMin) b.estMin = s[k];
      if (s[k] > b.estMax) b.estMax = s[k];
      if (s[k + 1] < b.nordMin) b.nordMin = s[k + 1];
      if (s[k + 1] > b.nordMax) b.nordMax = s[k + 1];
      if (s[k + 2] < b.altMin) b.altMin = s[k + 2];
      if (s[k + 2] > b.altMax) b.altMax = s[k + 2];
    }
    boitesEnCache.set(objet, b);
  }
  return b;
}

/**
 * Coupe d'un maillage de triangles par une « fonction de côté » (valeur > 0 d'un côté du plan de coupe,
 * < 0 de l'autre) : renvoie les contours, chacun une liste de points (ce que renvoie "point").
 * - cote(k) : valeur pour le sommet n° k ; point(a, b, r) : point de coupe sur l'arête a–b, à la
 *   fraction r depuis a.
 * Les triangles qui partagent une arête donnent le même point sur cette arête : on enchaîne les
 * morceaux par leurs arêtes, ce qui ferme les contours sans erreur d'arrondi.
 * Renvoie [{ points, ferme }].
 */
export function couperMaillage(indices, cote, point) {
  const cleArete = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const points = new Map(); // arête -> point
  const voisins = new Map(); // arête -> [arêtes reliées]
  const relier = (x, y) => {
    if (!voisins.has(x)) voisins.set(x, []);
    voisins.get(x).push(y);
  };
  for (let k = 0; k + 2 < indices.length; k += 3) {
    const sommets = [indices[k], indices[k + 1], indices[k + 2]];
    const coupees = [];
    for (let j = 0; j < 3; j++) {
      const a = sommets[j];
      const b = sommets[(j + 1) % 3];
      const ca = cote(a);
      const cb = cote(b);
      if ((ca > 0) === (cb > 0)) continue;
      const cle = cleArete(a, b);
      if (!points.has(cle)) {
        // Toujours depuis le plus petit numéro : même point pour les deux triangles de l'arête.
        const [p, q, cp, cq] = a < b ? [a, b, ca, cb] : [b, a, cb, ca];
        points.set(cle, point(p, q, cp / (cp - cq)));
      }
      coupees.push(cle);
    }
    if (coupees.length === 2 && coupees[0] !== coupees[1]) {
      relier(coupees[0], coupees[1]);
      relier(coupees[1], coupees[0]);
    }
  }
  // Enchaînement : on part d'abord des bouts (arêtes à un seul voisin : contours ouverts), puis des boucles.
  const vues = new Set();
  const contours = [];
  const suivre = (depart) => {
    const chaine = [depart];
    vues.add(depart);
    let courante = depart;
    for (;;) {
      const suivante = (voisins.get(courante) ?? []).find((v) => !vues.has(v));
      if (suivante === undefined) break;
      vues.add(suivante);
      chaine.push(suivante);
      courante = suivante;
    }
    const ferme = chaine.length > 2 && (voisins.get(courante) ?? []).includes(depart);
    return { points: chaine.map((c) => points.get(c)), ferme };
  };
  for (const [cle, liste] of voisins) if (liste.length === 1 && !vues.has(cle)) contours.push(suivre(cle));
  for (const cle of voisins.keys()) if (!vues.has(cle)) contours.push(suivre(cle));
  return contours.filter((c) => c.points.length >= 2);
}

/**
 * Coupe horizontale de la maquette à l'altitude donnée (m), sous forme de contenu de plan (comme un
 * plan DXF, voir dxf-plan.js) : pour chaque objet coupé, son contour fermé (trait) et un aplat clair
 * (hachure). Coordonnées depuis maquette.origine (m, au millimètre). Calque = n° du type.
 * Renvoie { traits, pleins, cercles: [], textes: [], points: [] }.
 */
export function coupeHorizontale(maquette, altitude) {
  const traits = [];
  const pleins = [];
  const h = altitude + DECALAGE;
  const mm = (v) => Math.round(v * 1000) / 1000;
  const { origine } = maquette;
  for (const objet of maquette.objets ?? []) {
    const boite = boiteObjet(objet, origine);
    if (boite.altMin > h || boite.altMax < h) continue;
    const s = sommetsEnMetres(objet, origine);
    const contours = couperMaillage(
      objet.i,
      (k) => s[3 * k + 2] - h,
      (a, b, r) => [
        mm(s[3 * a] + r * (s[3 * b] - s[3 * a]) - origine.est),
        mm(s[3 * a + 1] + r * (s[3 * b + 1] - s[3 * a + 1]) - origine.nord),
      ],
    );
    for (const c of contours) c.points = sansPointsAlignes(c.points, c.ferme);
    const fermes = contours.filter((c) => c.ferme && c.points.length >= 3);
    for (const c of contours) traits.push({ c: objet.t, k: null, p: c.points.flat(), f: c.ferme });
    // Aplat : tous les contours fermés de l'objet ensemble (règle pair-impair : les trous restent vides).
    if (fermes.length > 0) pleins.push({ c: objet.t, k: null, p: fermes.flatMap((c) => c.points.flat()), h: fermes.map((c) => c.points.length) });
  }
  return { traits, pleins, cercles: [], textes: [], points: [] };
}

// Écart en dessous duquel un point est jugé sur la droite de ses voisins (m) : 0.5 mm.
const ALIGNE = 0.0005;

/**
 * Retire les points alignés avec leurs voisins (points [x, y], m) : la coupe d'une face faite de 2
 * triangles donne un point au milieu du côté, qui serait un faux « sommet » pour les accroches.
 */
export function sansPointsAlignes(points, ferme) {
  if (points.length < 3) return points;
  // p est-il sur la droite a–b (à moins de 0.5 mm) ?
  const aligne = (a, p, b) => {
    const longueur = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (longueur === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]) < ALIGNE;
    return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / longueur < ALIGNE;
  };
  // Un seul passage : chaque nouveau point peut faire tomber le précédent.
  const garde = [];
  for (const p of points) {
    garde.push(p);
    while (garde.length >= 3 && aligne(garde.at(-3), garde.at(-2), garde.at(-1))) garde.splice(-2, 1);
  }
  // Contour fermé : le raccord entre la fin et le début.
  if (ferme) {
    while (garde.length > 3 && aligne(garde.at(-2), garde.at(-1), garde[0])) garde.pop();
    while (garde.length > 3 && aligne(garde.at(-1), garde[0], garde[1])) garde.shift();
  }
  return garde;
}

/**
 * Coupe verticale de la maquette le long du segment debut → fin ({ est, nord }, m) : contours dans le
 * repère de la coupe, { x: distance depuis le début (m), z: altitude (m) }, gardés seulement entre 0 et
 * la longueur du segment (les morceaux qui dépassent sont coupés aux deux bouts).
 * Renvoie [{ type (nom du calque), couleur, points: [{ x, z }], ferme }].
 */
export function coupeVerticale(maquette, debut, fin) {
  const longueur = Math.hypot(fin.est - debut.est, fin.nord - debut.nord);
  if (!maquette || longueur === 0) return [];
  const ux = (fin.est - debut.est) / longueur;
  const uy = (fin.nord - debut.nord) / longueur;
  const { origine } = maquette;
  const estMin = Math.min(debut.est, fin.est);
  const estMax = Math.max(debut.est, fin.est);
  const nordMin = Math.min(debut.nord, fin.nord);
  const nordMax = Math.max(debut.nord, fin.nord);
  const resultat = [];
  for (const objet of maquette.objets ?? []) {
    const b = boiteObjet(objet, origine);
    if (b.estMax < estMin || b.estMin > estMax || b.nordMax < nordMin || b.nordMin > nordMax) continue;
    const s = sommetsEnMetres(objet, origine);
    // Côté : distance (signée) à la droite de coupe ; position : distance le long de la coupe.
    const contours = couperMaillage(
      objet.i,
      (k) => -(s[3 * k] - debut.est) * uy + (s[3 * k + 1] - debut.nord) * ux + DECALAGE,
      (a, b2, r) => {
        const e = s[3 * a] + r * (s[3 * b2] - s[3 * a]);
        const n = s[3 * a + 1] + r * (s[3 * b2 + 1] - s[3 * a + 1]);
        return { x: (e - debut.est) * ux + (n - debut.nord) * uy, z: s[3 * a + 2] + r * (s[3 * b2 + 2] - s[3 * a + 2]) };
      },
    );
    const type = maquette.types?.[objet.t] ?? 'Autres';
    for (const c of contours) {
      const points = c.ferme ? couperPolygoneEnX(c.points, 0, longueur) : couperLigneEnX(c.points, 0, longueur);
      for (const morceau of c.ferme ? (points.length >= 3 ? [points] : []) : points) {
        resultat.push({ type, couleur: couleurCalqueIfc(type), points: morceau, ferme: c.ferme });
      }
    }
  }
  return resultat;
}

/**
 * Polygone (liste de { x, z }) gardé entre xMin et xMax (méthode de Sutherland-Hodgman : on coupe par
 * le bord gauche puis par le bord droit). Renvoie la liste des points restants (vide si tout est dehors).
 */
export function couperPolygoneEnX(points, xMin, xMax) {
  const couper = (liste, dedans, bord) => {
    const sortie = [];
    for (let k = 0; k < liste.length; k++) {
      const p = liste[k];
      const q = liste[(k + 1) % liste.length];
      if (dedans(p)) sortie.push(p);
      if (dedans(p) !== dedans(q)) {
        const r = (bord - p.x) / (q.x - p.x);
        sortie.push({ x: bord, z: p.z + r * (q.z - p.z) });
      }
    }
    return sortie;
  };
  const gauche = couper(points, (p) => p.x >= xMin, xMin);
  return couper(gauche, (p) => p.x <= xMax, xMax);
}

/** Ligne ouverte gardée entre xMin et xMax : renvoie les morceaux restants (listes de { x, z }). */
export function couperLigneEnX(points, xMin, xMax) {
  const morceaux = [];
  let courant = [];
  const finir = () => {
    if (courant.length >= 2) morceaux.push(courant);
    courant = [];
  };
  // Chaque segment a → b est raccourci à la bande ; un segment raccourci au bout de sortie ferme le morceau.
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k];
    const b = points[k + 1];
    const dx = b.x - a.x;
    let t0 = 0;
    let t1 = 1;
    if (dx === 0) {
      if (a.x < xMin || a.x > xMax) {
        finir();
        continue;
      }
    } else {
      const ta = (xMin - a.x) / dx;
      const tb = (xMax - a.x) / dx;
      t0 = Math.max(0, Math.min(ta, tb));
      t1 = Math.min(1, Math.max(ta, tb));
    }
    if (t0 > t1) {
      finir();
      continue;
    }
    const en = (t) => ({ x: a.x + t * dx, z: a.z + t * (b.z - a.z) });
    if (t0 > 0 || courant.length === 0) {
      finir();
      courant.push(t0 > 0 ? en(t0) : a);
    }
    courant.push(t1 < 1 ? en(t1) : b);
    if (t1 < 1) finir();
  }
  finir();
  return morceaux;
}

/**
 * Coupe verticale le long d'une suite de points (profil en long d'une ligne) : les coupes de chaque
 * segment, mises bout à bout (x = distance cumulée depuis le 1er point, m).
 * - sommets : [{ est, nord }]
 */
export function coupeVerticaleLeLong(maquette, sommets) {
  const resultat = [];
  let cumul = 0;
  for (let k = 0; k + 1 < sommets.length; k++) {
    const a = sommets[k];
    const b = sommets[k + 1];
    for (const c of coupeVerticale(maquette, a, b)) resultat.push({ ...c, points: c.points.map((p) => ({ x: p.x + cumul, z: p.z })) });
    cumul += Math.hypot(b.est - a.est, b.nord - a.nord);
  }
  return resultat;
}

/**
 * Altitude de la coupe en plan d'après le choix de la tablette :
 * - choix : { sorte: 'niveau', niveau (nom) } → altitude du niveau + 1.00 m ;
 *           { sorte: 'altitude', altitude (m) } → cette altitude ;
 *           { sorte: 'recepteur' } → altitude du bout de canne (altitudeCanne, m) ;
 * Sans choix (ou niveau inconnu) : le premier niveau au-dessus du terrain le plus bas, sinon le milieu
 * de la maquette. Renvoie { altitude, texte } ou { altitude: null, texte } (récepteur sans position).
 */
export function altitudeDeCoupe(maquette, choix, altitudeCanne = null) {
  const niveaux = maquette?.niveaux ?? [];
  if (choix?.sorte === 'altitude' && Number.isFinite(choix.altitude)) return { altitude: choix.altitude, texte: `${choix.altitude.toFixed(2)} m` };
  if (choix?.sorte === 'recepteur') {
    return Number.isFinite(altitudeCanne)
      ? { altitude: altitudeCanne, texte: `récepteur ${altitudeCanne.toFixed(2)} m` }
      : { altitude: null, texte: 'récepteur (pas de position)' };
  }
  const niveau = niveaux.find((n) => n.nom === choix?.niveau) ?? niveaux[0];
  if (niveau) return { altitude: niveau.altitude + HAUTEUR_COUPE_NIVEAU, texte: `${niveau.nom} + ${HAUTEUR_COUPE_NIVEAU.toFixed(2)} m` };
  const alts = (maquette?.objets ?? []).flatMap((o) => [boiteObjet(o, maquette.origine).altMin, boiteObjet(o, maquette.origine).altMax]);
  const milieu = alts.length ? (Math.min(...alts) + Math.max(...alts)) / 2 : 0;
  return { altitude: milieu, texte: `${milieu.toFixed(2)} m` };
}

/** Emprise en plan de la maquette (m) : { estMin, nordMin, estMax, nordMax }, ou null si vide. */
export function bornesMaquette(maquette) {
  const b = { estMin: Infinity, nordMin: Infinity, estMax: -Infinity, nordMax: -Infinity };
  for (const objet of maquette.objets ?? []) {
    const o = boiteObjet(objet, maquette.origine);
    b.estMin = Math.min(b.estMin, o.estMin);
    b.nordMin = Math.min(b.nordMin, o.nordMin);
    b.estMax = Math.max(b.estMax, o.estMax);
    b.nordMax = Math.max(b.nordMax, o.nordMax);
  }
  return Number.isFinite(b.estMin) ? b : null;
}

/**
 * Range les objets lus (sommets en mètres, MN95) en maquette compacte (voir en tête du fichier).
 * - objets : [{ type (ex. 'IfcWall'), nom, sommets: [e, n, z, …] (m), triangles: [a, b, c, …] }]
 * Les sommets au même endroit (au millimètre) sont fusionnés : les triangles voisins partagent alors
 * leurs arêtes (nécessaire pour fermer les contours des coupes).
 */
export function rangerMaquette(objets, niveaux = []) {
  let estMin = Infinity;
  let nordMin = Infinity;
  for (const o of objets) {
    for (let k = 0; k < o.sommets.length; k += 3) {
      if (o.sommets[k] < estMin) estMin = o.sommets[k];
      if (o.sommets[k + 1] < nordMin) nordMin = o.sommets[k + 1];
    }
  }
  const origine = Number.isFinite(estMin) ? { est: Math.floor(estMin), nord: Math.floor(nordMin) } : { est: 0, nord: 0 };
  const types = [];
  const rangees = [];
  for (const o of objets) {
    const calque = calqueDuTypeIfc(o.type);
    let t = types.indexOf(calque);
    if (t < 0) t = types.push(calque) - 1;
    const v = [];
    const numeros = new Map();
    const nouveau = [];
    for (let k = 0; k < o.sommets.length; k += 3) {
      const x = Math.round((o.sommets[k] - origine.est) * 1000);
      const y = Math.round((o.sommets[k + 1] - origine.nord) * 1000);
      const z = Math.round(o.sommets[k + 2] * 1000);
      const cle = `${x},${y},${z}`;
      if (!numeros.has(cle)) {
        numeros.set(cle, v.length / 3);
        v.push(x, y, z);
      }
      nouveau.push(numeros.get(cle));
    }
    const i = [];
    for (let k = 0; k + 2 < o.triangles.length; k += 3) {
      const a = nouveau[o.triangles[k]];
      const b = nouveau[o.triangles[k + 1]];
      const c = nouveau[o.triangles[k + 2]];
      if (a !== b && b !== c && a !== c) i.push(a, b, c); // triangle aplati au millimètre : sauté
    }
    if (i.length > 0) rangees.push({ t, n: o.nom ?? '', v, i });
  }
  return { origine, niveaux: [...niveaux].sort((a, b) => a.altitude - b.altitude), types, objets: rangees };
}

/** Distance (m) d'un point (x, y) au segment a–b (points [x, y]) en plan. */
function distanceAuSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/**
 * Objet de la maquette touché sur la coupe en plan, et altitudes de son dessus et de son dessous pile
 * à cet endroit (0.263.0, implanter un coin d'IFC : « Dessus / Dessous » dans la fiche du point).
 * - est, nord : point accroché (m) ; altitudeCoupe : altitude de la coupe en plan (m), ou null ;
 * - tolerance : distance au contour coupé pour dire « c'est cet objet » (m, 2 cm).
 * Dessus / dessous = la plus haute / la plus basse des faces non verticales de l'objet au-dessus du
 * point (une face qui passe à moins de "tolerance" compte : un coin est sur le bord des faces).
 * Renvoie { nom, type, dessus, dessous } (m) ou null si aucun objet coupé ne passe là.
 */
export function altitudesObjetEn(maquette, est, nord, altitudeCoupe, tolerance = 0.02) {
  if (!maquette) return null;
  const { origine } = maquette;
  const h = altitudeCoupe == null ? null : altitudeCoupe + DECALAGE;
  let meilleur = null;
  for (const objet of maquette.objets ?? []) {
    const b = boiteObjet(objet, origine);
    if (est < b.estMin - tolerance || est > b.estMax + tolerance || nord < b.nordMin - tolerance || nord > b.nordMax + tolerance) continue;
    if (h != null && (b.altMin > h || b.altMax < h)) continue;
    const s = sommetsEnMetres(objet, origine);
    let distance = 0;
    if (h != null) {
      // Distance du point au contour de l'objet coupé à l'altitude de la coupe.
      distance = Infinity;
      const contours = couperMaillage(objet.i, (k) => s[3 * k + 2] - h, (a, c, r) => [s[3 * a] + r * (s[3 * c] - s[3 * a]), s[3 * a + 1] + r * (s[3 * c + 1] - s[3 * a + 1])]);
      for (const { points, ferme } of contours) {
        for (let k = 0; k + 1 < points.length + (ferme ? 1 : 0); k++) {
          const p = points[k];
          const q = points[(k + 1) % points.length];
          distance = Math.min(distance, distanceAuSegment(est, nord, p[0], p[1], q[0], q[1]));
        }
      }
      if (distance > tolerance) continue;
    }
    if (meilleur && meilleur.distance <= distance) continue;
    const altitudes = altitudesDesFacesEn(objet, s, est, nord, tolerance);
    if (altitudes.length === 0) continue;
    meilleur = { distance, nom: objet.n ?? '', type: maquette.types?.[objet.t] ?? 'Autres', dessus: Math.max(...altitudes), dessous: Math.min(...altitudes) };
  }
  if (!meilleur) return null;
  const mm = (v) => Math.round(v * 1000) / 1000;
  return { nom: meilleur.nom, type: meilleur.type, dessus: mm(meilleur.dessus), dessous: mm(meilleur.dessous) };
}

/** Altitudes (m) des faces non verticales de l'objet au point (est, nord), à "tolerance" près en plan. */
function altitudesDesFacesEn(objet, s, est, nord, tolerance) {
  const altitudes = [];
  for (let k = 0; k + 2 < objet.i.length; k += 3) {
    const [a, b, c] = [objet.i[k], objet.i[k + 1], objet.i[k + 2]];
    const [ax, ay, az] = [s[3 * a], s[3 * a + 1], s[3 * a + 2]];
    const [bx, by, bz] = [s[3 * b], s[3 * b + 1], s[3 * b + 2]];
    const [cx, cy, cz] = [s[3 * c], s[3 * c + 1], s[3 * c + 2]];
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); // 2 × aire en plan (signée)
    if (Math.abs(det) < 1e-8) continue; // face verticale : pas d'altitude « au-dessus » du point
    // Coordonnées barycentriques du point dans le triangle (en plan).
    const u = ((bx - est) * (cy - nord) - (cx - est) * (by - nord)) / det;
    const v = ((cx - est) * (ay - nord) - (ax - est) * (cy - nord)) / det;
    const w = 1 - u - v;
    const dedans = u >= 0 && v >= 0 && w >= 0;
    if (!dedans && Math.min(distanceAuSegment(est, nord, ax, ay, bx, by), distanceAuSegment(est, nord, bx, by, cx, cy), distanceAuSegment(est, nord, cx, cy, ax, ay)) > tolerance) continue;
    altitudes.push(u * az + v * bz + w * cz); // plan de la face, prolongé de quelques mm au bord
  }
  return altitudes;
}

/**
 * Maquette recalée (0.263.0, IFC pas en MN95, recalage par paires de points comme un plan DXF) : chaque
 * sommet passe par "transformer(est, nord)" → { est, nord } (m, MN95) ; les altitudes ne changent pas.
 * Les objets et les niveaux sont les mêmes ; l'origine est recalculée (coin sud-ouest au mètre).
 */
export function recalerMaquette(maquette, transformer) {
  const { origine } = maquette;
  const absolus = maquette.objets.map((objet) => {
    const p = new Float64Array(objet.v.length);
    for (let k = 0; k < objet.v.length; k += 3) {
      const { est, nord } = transformer(origine.est + objet.v[k] / 1000, origine.nord + objet.v[k + 1] / 1000);
      p[k] = est;
      p[k + 1] = nord;
      p[k + 2] = objet.v[k + 2];
    }
    return p;
  });
  let estMin = Infinity;
  let nordMin = Infinity;
  for (const p of absolus) {
    for (let k = 0; k < p.length; k += 3) {
      if (p[k] < estMin) estMin = p[k];
      if (p[k + 1] < nordMin) nordMin = p[k + 1];
    }
  }
  const nouvelle = Number.isFinite(estMin) ? { est: Math.floor(estMin), nord: Math.floor(nordMin) } : { est: 0, nord: 0 };
  const objets = maquette.objets.map((objet, n) => {
    const p = absolus[n];
    const v = new Array(p.length);
    for (let k = 0; k < p.length; k += 3) {
      v[k] = Math.round((p[k] - nouvelle.est) * 1000);
      v[k + 1] = Math.round((p[k + 1] - nouvelle.nord) * 1000);
      v[k + 2] = p[k + 2];
    }
    return { ...objet, v };
  });
  return { ...maquette, origine: nouvelle, objets };
}

/** Couleur d'un calque IFC en [R, V, B] (0 à 255), pour la vue 3D. */
export function rvbCalqueIfc(nom) {
  const hex = couleurCalqueIfc(nom).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Triangle (3 points { est, nord, altitude }) gardé sous l'altitude "haut" (m) : la partie au-dessus
 * est coupée. Renvoie 0, 1 ou 2 triangles (le morceau gardé peut être un quadrilatère).
 */
export function trianglesSous(triangle, haut) {
  const dessous = triangle.filter((p) => p.altitude <= haut).length;
  if (dessous === 3) return [triangle];
  if (dessous === 0) return [];
  // Polygone gardé : on parcourt les côtés, on garde les sommets dessous et les points de coupe.
  const garde = [];
  for (let k = 0; k < 3; k++) {
    const p = triangle[k];
    const q = triangle[(k + 1) % 3];
    if (p.altitude <= haut) garde.push(p);
    if ((p.altitude <= haut) !== (q.altitude <= haut)) {
      const r = (haut - p.altitude) / (q.altitude - p.altitude);
      garde.push({ est: p.est + r * (q.est - p.est), nord: p.nord + r * (q.nord - p.nord), altitude: haut });
    }
  }
  return garde.length === 3 ? [garde] : [[garde[0], garde[1], garde[2]], [garde[0], garde[2], garde[3]]];
}

/**
 * Triangles de la maquette pour la vue 3D (0.264.0) : [{ t: [p, q, r] ({ est, nord, altitude }, m), couleur: [R, V, B] }].
 * - cachees : noms des calques décochés (pas montrés) ;
 * - haut : altitude au-dessus de laquelle tout est coupé (case « Couper à la coupe IFC »), ou null.
 */
export function trianglesMaquette(maquette, { cachees = new Set(), haut = null } = {}) {
  const sortie = [];
  if (!maquette) return sortie;
  for (const objet of maquette.objets ?? []) {
    const type = maquette.types?.[objet.t] ?? 'Autres';
    if (cachees.has(type)) continue;
    if (haut != null && boiteObjet(objet, maquette.origine).altMin > haut) continue;
    const couleur = rvbCalqueIfc(type);
    const s = sommetsEnMetres(objet, maquette.origine);
    const point = (k) => ({ est: s[3 * k], nord: s[3 * k + 1], altitude: s[3 * k + 2] });
    for (let k = 0; k + 2 < objet.i.length; k += 3) {
      const t = [point(objet.i[k]), point(objet.i[k + 1]), point(objet.i[k + 2])];
      for (const morceau of haut == null ? [t] : trianglesSous(t, haut)) sortie.push({ t: morceau, couleur });
    }
  }
  return sortie;
}
