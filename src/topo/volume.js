// Calcul du volume d'un stock entre la surface du dessus et la surface de base.
//
// Méthode (validée avec l'utilisateur) :
// 1. Chaque surface est triangulée (Delaunay avec contraintes) : les triangles ne
//    traversent ni le contour ni les lignes de rupture.
// 2. Seuls les triangles du dessus situés dans le contour sont gardés
//    (indispensable pour les stocks en forme de « L »).
// 3. On superpose les deux triangulations : chaque triangle du dessus est découpé
//    par les triangles de la base. Sur chaque morceau, l'écart de hauteur
//    (dessus - base) varie de façon linéaire, donc le volume se calcule exactement.
// 4. Remblai = volume où le dessus est au-dessus de la base,
//    déblai = volume où le dessus est au-dessous de la base.
//
// Unités : mètres (m), mètres carrés (m²), mètres cubes (m³).
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';
import { pointsDeBase } from './stocks.js';

/**
 * Calcule le volume d'un stock en mode A (base mesurée).
 * - stock : voir stocks.js
 * - points : tous les points importés { nom, est, nord, altitude }
 * Renvoie { erreurs } si le calcul est impossible, sinon :
 * { surfacePlan, remblai, deblai, surfaceRemblai, surfaceDeblai, surfaceNonCouverte,
 *   nombreTrianglesDessus, nombreTrianglesBase, trianglesDessus, trianglesBase }
 * Les triangles sont des listes de 3 points { nom, est, nord, altitude }.
 */
export function calculerVolumeStock(stock, points) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const erreurs = [];

  const tousLesNoms = [
    ...stock.contour,
    ...pointsDeBase(stock),
    ...stock.lignesRupture.flatMap((ligne) => ligne.noms),
    ...stock.pointsDessus,
  ];
  const absents = [...new Set(tousLesNoms.filter((nom) => !parNom.has(nom)))];
  if (absents.length > 0) erreurs.push(`point(s) absent(s) du fichier : ${absents.join(', ')}`);
  if (stock.contour.length < 3) erreurs.push('le contour doit avoir au moins 3 points');
  if (pointsDeBase(stock).length < 3) erreurs.push('la surface de base doit avoir au moins 3 points');
  if (erreurs.length > 0) return { erreurs };

  // Segments imposés : le contour (fermé) et les lignes de rupture.
  const segmentsContour = segmentsDeLigne(stock.contour, true);
  const segmentsLignes = stock.lignesRupture.flatMap((ligne) => segmentsDeLigne(ligne.noms, ligne.fermee));
  const contour = stock.contour.map((nom) => parNom.get(nom));

  // --- Surface du dessus : tous les points du stock ---
  const nomsDessus = [...new Set(tousLesNoms)];
  const dessus = trianglerAvecContraintes(nomsDessus, [...segmentsContour, ...segmentsLignes], parNom);
  if (dessus.erreurs) return { erreurs: dessus.erreurs };
  // On garde les triangles dont le centre est dans le contour. Comme les côtés du
  // contour sont imposés, un triangle est soit entièrement dedans, soit entièrement dehors.
  const trianglesDessus = dessus.triangles.filter((t) => pointDansPolygone(centre(t), contour));

  // --- Surface de base : les points du pied ---
  // Les côtés du contour sont imposés quand leurs deux points font partie de la base.
  const nomsBase = [...new Set(pointsDeBase(stock))];
  const ensembleBase = new Set(nomsBase);
  const segmentsBase = segmentsContour.filter(([a, b]) => ensembleBase.has(a) && ensembleBase.has(b));
  const base = trianglerAvecContraintes(nomsBase, segmentsBase, parNom);
  if (base.erreurs) return { erreurs: base.erreurs.map((e) => `surface de base : ${e}`) };
  const trianglesBase = base.triangles;

  // --- Superposition et volume ---
  const resultat = volumeEntreSurfaces(trianglesDessus, trianglesBase);

  return {
    ...resultat,
    surfaceContour: Math.abs(airePolygone(contour)),
    nombreTrianglesDessus: trianglesDessus.length,
    nombreTrianglesBase: trianglesBase.length,
    trianglesDessus,
    trianglesBase,
  };
}

/**
 * Volume entre une surface du dessus et une surface de base, toutes deux en triangles.
 * Le calcul se fait sur l'emprise des triangles du dessus.
 * Renvoie { surfacePlan, remblai, deblai, surfaceRemblai, surfaceDeblai, surfaceNonCouverte } (m², m³).
 */
export function volumeEntreSurfaces(trianglesDessus, trianglesBase) {
  const resultat = { surfacePlan: 0, remblai: 0, deblai: 0, surfaceRemblai: 0, surfaceDeblai: 0, surfaceNonCouverte: 0 };
  const boitesBase = trianglesBase.map(boite);

  for (const triangleDessus of trianglesDessus) {
    const aireDessus = Math.abs(aireTriangle(triangleDessus));
    resultat.surfacePlan += aireDessus;
    const boiteDessus = boite(triangleDessus);
    let aireCouverte = 0;

    trianglesBase.forEach((triangleBase, index) => {
      if (!boitesSeTouchent(boiteDessus, boitesBase[index])) return;
      // Morceau commun aux deux triangles (vu en plan).
      const morceau = intersectionTriangles(triangleDessus, triangleBase);
      if (morceau.length < 3) return;
      aireCouverte += Math.abs(airePolygone(morceau));

      // Écart de hauteur dessus - base à chaque sommet du morceau (m).
      const ecarts = morceau.map(
        (p) => altitudeSurTriangle(triangleDessus, p.est, p.nord) - altitudeSurTriangle(triangleBase, p.est, p.nord),
      );
      // Le morceau est convexe : on le découpe en éventail de triangles.
      for (let i = 1; i < morceau.length - 1; i++) {
        const aire = Math.abs(aireTriangle([morceau[0], morceau[i], morceau[i + 1]]));
        ajouterPrisme(resultat, aire, ecarts[0], ecarts[i], ecarts[i + 1]);
      }
    });

    resultat.surfaceNonCouverte += Math.max(aireDessus - aireCouverte, 0);
  }

  // On ignore les restes d'arrondi de calcul (moins de 1 cm²).
  if (resultat.surfaceNonCouverte < 1e-4) resultat.surfaceNonCouverte = 0;
  return resultat;
}

/**
 * Ajoute le volume d'un prisme à base triangulaire (aire en m²) dont les hauteurs
 * aux 3 coins sont d1, d2, d3 (m, positives = remblai, négatives = déblai).
 * Si la hauteur change de signe dans le triangle, on le coupe exactement le long
 * de la ligne où elle vaut zéro.
 */
export function ajouterPrisme(resultat, aire, d1, d2, d3) {
  const total = (aire * (d1 + d2 + d3)) / 3;
  const positifs = [d1, d2, d3].filter((d) => d > 0).length;
  const negatifs = [d1, d2, d3].filter((d) => d < 0).length;

  if (negatifs === 0) {
    resultat.remblai += total;
    if (positifs > 0) resultat.surfaceRemblai += aire;
    return;
  }
  if (positifs === 0) {
    resultat.deblai += -total;
    resultat.surfaceDeblai += aire;
    return;
  }

  // Un coin est seul de son signe : on calcule la petite pointe autour de lui.
  const seulPositif = positifs === 1;
  const [seul, autre1, autre2] = seulPositif
    ? [[d1, d2, d3].find((d) => d > 0), ...[d1, d2, d3].filter((d) => !(d > 0))]
    : [[d1, d2, d3].find((d) => d < 0), ...[d1, d2, d3].filter((d) => !(d < 0))];
  const partAire = (seul * seul) / ((seul - autre1) * (seul - autre2));
  const volumePointe = (aire * partAire * seul) / 3;
  const volumeReste = total - volumePointe;

  if (seulPositif) {
    resultat.remblai += volumePointe;
    resultat.deblai += -volumeReste;
    resultat.surfaceRemblai += aire * partAire;
    resultat.surfaceDeblai += aire * (1 - partAire);
  } else {
    resultat.deblai += -volumePointe;
    resultat.remblai += volumeReste;
    resultat.surfaceDeblai += aire * partAire;
    resultat.surfaceRemblai += aire * (1 - partAire);
  }
}

/**
 * Triangulation de Delaunay avec segments imposés.
 * - noms : noms des points à trianguler
 * - segments : paires de noms [a, b] que les triangles doivent respecter
 * Renvoie { triangles } (chaque triangle = 3 points, sens inverse des aiguilles d'une montre)
 * ou { erreurs } avec un message compréhensible.
 */
export function trianglerAvecContraintes(noms, segments, parNom) {
  const sommets = noms.map((nom) => parNom.get(nom));

  // Deux points à la même position (en plan) empêchent la triangulation.
  const positions = new Map();
  for (const sommet of sommets) {
    const cle = `${sommet.est.toFixed(4)} ${sommet.nord.toFixed(4)}`;
    if (positions.has(cle)) {
      return { erreurs: [`les points ${positions.get(cle)} et ${sommet.nom} sont à la même position en plan`] };
    }
    positions.set(cle, sommet.nom);
  }

  const croisement = chercherCroisement(segments, parNom);
  if (croisement) return { erreurs: [croisement] };

  // Coordonnées locales (autour du premier point) pour garder la précision des calculs.
  const origine = sommets[0];
  const coordonnees = sommets.map((p) => [p.est - origine.est, p.nord - origine.nord]);
  const index = new Map(noms.map((nom, i) => [nom, i]));

  const delaunay = Delaunator.from(coordonnees);
  try {
    const contraintes = segments.map(([a, b]) => [index.get(a), index.get(b)]);
    new Constrainautor(delaunay, contraintes);
  } catch (erreur) {
    return { erreurs: [`triangulation impossible avec les lignes imposées (${erreur.message})`] };
  }

  const triangles = [];
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    // Delaunator donne les triangles dans le sens des aiguilles d'une montre : on inverse.
    triangles.push([
      sommets[delaunay.triangles[i]],
      sommets[delaunay.triangles[i + 2]],
      sommets[delaunay.triangles[i + 1]],
    ]);
  }
  return { triangles };
}

/** Segments [a, b] reliant les noms d'une ligne, avec le retour au début si elle est fermée. */
function segmentsDeLigne(noms, fermee) {
  const segments = [];
  for (let i = 0; i + 1 < noms.length; i++) segments.push([noms[i], noms[i + 1]]);
  if (fermee && noms.length >= 3) segments.push([noms.at(-1), noms[0]]);
  return segments;
}

/**
 * Cherche deux segments imposés qui se croisent (ou se chevauchent).
 * Renvoie un message d'erreur, ou null si tout va bien.
 */
function chercherCroisement(segments, parNom) {
  // On enlève les segments en double (même ligne saisie deux fois, ou contour = ligne).
  const uniques = new Map();
  for (const [a, b] of segments) {
    if (a === b) continue;
    uniques.set([a, b].sort().join('\u0000'), [a, b]);
  }
  const liste = [...uniques.values()];

  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      const [a, b] = liste[i];
      const [c, d] = liste[j];
      const communs = [a, b].filter((nom) => nom === c || nom === d).length;
      const p1 = parNom.get(a);
      const p2 = parNom.get(b);
      const p3 = parNom.get(c);
      const p4 = parNom.get(d);
      if (communs === 0 && segmentsSeCroisent(p1, p2, p3, p4)) {
        return `les segments ${a}-${b} et ${c}-${d} se croisent : vérifie le contour et les lignes de rupture`;
      }
      if (communs === 1 && segmentsSeChevauchent(p1, p2, p3, p4)) {
        return `les segments ${a}-${b} et ${c}-${d} se superposent : vérifie l'ordre des points`;
      }
    }
  }
  return null;
}

// --- Petits outils de géométrie en plan (Est, Nord) ---

/** Aire signée d'un triangle (m²) : positive si les points tournent dans le sens inverse des aiguilles d'une montre. */
function aireTriangle([a, b, c]) {
  return ((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
}

/** Aire signée d'un polygone (m²), formule des trapèzes. */
export function airePolygone(sommets) {
  let aire = 0;
  for (let i = 0; i < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    aire += (a.est - b.est) * (a.nord + b.nord);
  }
  return aire / 2;
}

function centre([a, b, c]) {
  return { est: (a.est + b.est + c.est) / 3, nord: (a.nord + b.nord + c.nord) / 3 };
}

/** Vrai si le point est à l'intérieur du polygone (méthode du rayon). */
export function pointDansPolygone(point, polygone) {
  let dedans = false;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const a = polygone[i];
    const b = polygone[j];
    if (a.nord > point.nord !== b.nord > point.nord) {
      const estCroisement = a.est + ((point.nord - a.nord) / (b.nord - a.nord)) * (b.est - a.est);
      if (point.est < estCroisement) dedans = !dedans;
    }
  }
  return dedans;
}

/** Altitude (m) au point (est, nord) sur le plan qui passe par les 3 sommets du triangle. */
function altitudeSurTriangle([a, b, c], est, nord) {
  const aire = aireTriangle([a, b, c]);
  const poidsA = aireTriangle([{ est, nord }, b, c]) / aire;
  const poidsB = aireTriangle([a, { est, nord }, c]) / aire;
  const poidsC = 1 - poidsA - poidsB;
  return poidsA * a.altitude + poidsB * b.altitude + poidsC * c.altitude;
}

/**
 * Partie commune (en plan) de deux triangles, sous forme de polygone convexe.
 * Méthode de Sutherland-Hodgman : on coupe le premier triangle par chaque côté du second.
 */
function intersectionTriangles(triangle, decoupe) {
  let polygone = triangle.map((p) => ({ est: p.est, nord: p.nord }));
  const sens = Math.sign(aireTriangle(decoupe));
  for (let i = 0; i < 3 && polygone.length > 0; i++) {
    const a = decoupe[i];
    const b = decoupe[(i + 1) % 3];
    // Côté "intérieur" du bord a-b : distance signée positive.
    const cote = (p) => sens * ((b.est - a.est) * (p.nord - a.nord) - (b.nord - a.nord) * (p.est - a.est));
    const entree = polygone;
    polygone = [];
    for (let j = 0; j < entree.length; j++) {
      const p = entree[j];
      const q = entree[(j + 1) % entree.length];
      const cp = cote(p);
      const cq = cote(q);
      if (cp >= 0) polygone.push(p);
      if ((cp > 0 && cq < 0) || (cp < 0 && cq > 0)) {
        const t = cp / (cp - cq);
        polygone.push({ est: p.est + t * (q.est - p.est), nord: p.nord + t * (q.nord - p.nord) });
      }
    }
  }
  return polygone;
}

function boite(triangle) {
  const ests = triangle.map((p) => p.est);
  const nords = triangle.map((p) => p.nord);
  return { estMin: Math.min(...ests), estMax: Math.max(...ests), nordMin: Math.min(...nords), nordMax: Math.max(...nords) };
}

function boitesSeTouchent(a, b) {
  return a.estMin <= b.estMax && b.estMin <= a.estMax && a.nordMin <= b.nordMax && b.nordMin <= a.nordMax;
}

/** Orientation de c par rapport à la droite a-b : >0 à gauche, <0 à droite, 0 alignés. */
function orientation(a, b, c) {
  return (b.est - a.est) * (c.nord - a.nord) - (b.nord - a.nord) * (c.est - a.est);
}

/** Vrai si les segments p1-p2 et p3-p4 (sans point commun) se croisent ou se touchent. */
function segmentsSeCroisent(p1, p2, p3, p4) {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  // Cas où un point est exactement sur l'autre segment.
  return (
    (o1 === 0 && surSegment(p1, p2, p3)) ||
    (o2 === 0 && surSegment(p1, p2, p4)) ||
    (o3 === 0 && surSegment(p3, p4, p1)) ||
    (o4 === 0 && surSegment(p3, p4, p2))
  );
}

/** Vrai si deux segments qui partagent un point sont alignés et se superposent. */
function segmentsSeChevauchent(p1, p2, p3, p4) {
  if (orientation(p1, p2, p3) !== 0 || orientation(p1, p2, p4) !== 0) return false;
  const autres = [p3, p4].filter((p) => p !== p1 && p !== p2);
  const miens = [p1, p2].filter((p) => p !== p3 && p !== p4);
  return autres.some((p) => surSegment(p1, p2, p)) || miens.some((p) => surSegment(p3, p4, p));
}

/** Vrai si c (aligné avec a-b) est entre a et b. */
function surSegment(a, b, c) {
  return (
    Math.min(a.est, b.est) <= c.est &&
    c.est <= Math.max(a.est, b.est) &&
    Math.min(a.nord, b.nord) <= c.nord &&
    c.nord <= Math.max(a.nord, b.nord)
  );
}
