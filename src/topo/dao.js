// DAO « mini Mensura », étape 1 (0.147.0, Expert, liste du 05.11 point 9) : dessiner des lignes,
// polylignes, rectangles, cercles, arcs, points et textes en MN95. Le dessin est un plan du projet
// (projet.plansDxf, champ `dao`) : il est affiché, accroché, montré / caché et partagé comme un DXF.
// Chaque objet est gardé tel quel dans `plan.dao.objets` ; le contenu du plan (traits, cercles,
// textes, points, repère local depuis `plan.origine`) en est refait à chaque modification.
// Coordonnées : Est, Nord, altitude (m, MN95).

export const NOM_DAO = 'DAO';
export const OUTILS_DAO = [
  ['ligne', 'Ligne', 2],
  ['polyligne', 'Polyligne', Infinity],
  ['rectangle', 'Rectangle', 2],
  ['cercle', 'Cercle', 2],
  ['arc', 'Arc 3 pts', 3],
  ['point', 'Point', 1],
  ['texte', 'Texte', 1],
];
export const COULEURS_CALQUES_DAO = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#111827'];

const mm = (v) => Math.round(v * 1000) / 1000;

/** Nombre de points d'un outil (Infinity : polyligne, finie par « Terminer »). */
export function pointsDeLOutil(sorte) {
  return OUTILS_DAO.find(([cle]) => cle === sorte)?.[2] ?? 2;
}

/** Plan DAO vide, repère local autour de "depart" { est, nord }. */
export function creerPlanDao(id, depart) {
  return {
    id,
    nom: NOM_DAO,
    dao: { objets: [] },
    origine: { est: Math.floor(depart.est), nord: Math.floor(depart.nord) },
    bornes: null,
    calques: [{ nom: 'DAO', couleur: COULEURS_CALQUES_DAO[0], visible: true }],
    contenu: { traits: [], pleins: [], cercles: [], textes: [], points: [] },
    compte: { objets: 0, ignores: {} },
    importeLe: new Date().toISOString(),
  };
}

/**
 * Centre et rayon du cercle qui passe par 3 points (m), ou null s'ils sont alignés.
 */
export function cercleParTroisPoints(a, b, c) {
  const d = 2 * (a.est * (b.nord - c.nord) + b.est * (c.nord - a.nord) + c.est * (a.nord - b.nord));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.est ** 2 + a.nord ** 2;
  const b2 = b.est ** 2 + b.nord ** 2;
  const c2 = c.est ** 2 + c.nord ** 2;
  const est = (a2 * (b.nord - c.nord) + b2 * (c.nord - a.nord) + c2 * (a.nord - b.nord)) / d;
  const nord = (a2 * (c.est - b.est) + b2 * (a.est - c.est) + c2 * (b.est - a.est)) / d;
  return { est, nord, rayon: Math.hypot(a.est - est, a.nord - nord) };
}

/**
 * Arc de "debut" à "fin" en passant par "milieu" : points tous les 5° environ (au moins 8 morceaux).
 * Altitudes : de celle du début à celle de la fin, en proportion de l'angle (null si l'une manque).
 */
export function pointsDeLArc(debut, milieu, fin) {
  const cercle = cercleParTroisPoints(debut, milieu, fin);
  if (!cercle) return [debut, fin];
  const angle = (p) => Math.atan2(p.nord - cercle.nord, p.est - cercle.est);
  const a0 = angle(debut);
  const tourner = (a) => ((a - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // 0 à 2π, sens trigonométrique
  let balayage = tourner(angle(fin));
  // Le milieu doit être sur l'arc : sinon on tourne dans l'autre sens.
  if (tourner(angle(milieu)) > balayage) balayage -= 2 * Math.PI;
  const n = Math.max(8, Math.ceil(Math.abs(balayage) / (Math.PI / 36)));
  const zDebut = debut.altitude;
  const zFin = fin.altitude;
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + balayage * t;
    points.push({ est: cercle.est + cercle.rayon * Math.cos(a), nord: cercle.nord + cercle.rayon * Math.sin(a), altitude: zDebut != null && zFin != null ? zDebut + (zFin - zDebut) * t : null });
  }
  return points;
}

/** Les 4 coins d'un rectangle (côtés Est / Nord) donné par deux coins opposés (fermé ensuite). */
export function coinsDuRectangle(a, b) {
  return [a, { est: b.est, nord: a.nord, altitude: null }, b, { est: a.est, nord: b.nord, altitude: null }];
}

/**
 * Refait le contenu du plan (repère local depuis plan.origine) à partir des objets ; "provisoire" :
 * objet en cours de dessin, ajouté à la fin pour qu'on le voie. Met aussi à jour bornes et compte.
 */
export function refaireContenuDao(plan, provisoire = null) {
  const o = plan.origine;
  const contenu = { traits: [], pleins: [], cercles: [], textes: [], points: [] };
  let estMin = Infinity;
  let nordMin = Infinity;
  let estMax = -Infinity;
  let nordMax = -Infinity;
  const borner = (p, marge = 0) => {
    estMin = Math.min(estMin, p.est - marge);
    estMax = Math.max(estMax, p.est + marge);
    nordMin = Math.min(nordMin, p.nord - marge);
    nordMax = Math.max(nordMax, p.nord + marge);
  };
  const trait = (points, c, ferme = false) => {
    if (points.length < 2) return;
    points.forEach((p) => borner(p));
    const z = points.every((p) => p.altitude != null) ? points.map((p) => mm(p.altitude)) : null;
    contenu.traits.push({ c, k: null, p: points.flatMap((p) => [mm(p.est - o.est), mm(p.nord - o.nord)]), f: ferme, ...(z ? { z } : {}) });
  };
  for (const objet of [...plan.dao.objets, ...(provisoire ? [provisoire] : [])]) {
    const c = Math.min(objet.calque ?? 0, plan.calques.length - 1);
    const [a, b, d] = objet.points;
    if (objet.sorte === 'ligne' || objet.sorte === 'polyligne') trait(objet.points, c, Boolean(objet.ferme));
    else if (objet.sorte === 'rectangle' && b) trait(coinsDuRectangle(a, b), c, true);
    else if (objet.sorte === 'arc' && d) trait(pointsDeLArc(a, b, d), c);
    else if (objet.sorte === 'arc' && b) trait([a, b], c);
    else if (objet.sorte === 'cercle' && b) {
      const r = Math.hypot(b.est - a.est, b.nord - a.nord);
      borner(a, r);
      contenu.cercles.push({ c, k: null, x: mm(a.est - o.est), y: mm(a.nord - o.nord), r: mm(r) });
    } else if (objet.sorte === 'point' && a) {
      borner(a);
      contenu.points.push({ c, k: null, x: mm(a.est - o.est), y: mm(a.nord - o.nord), z: a.altitude != null ? mm(a.altitude) : 0 });
    } else if (objet.sorte === 'texte' && a && objet.texte) {
      borner(a);
      contenu.textes.push({ c, k: null, x: mm(a.est - o.est), y: mm(a.nord - o.nord), h: objet.hauteur ?? 0.5, a: 0, t: objet.texte, ah: 0, av: 0 });
    }
  }
  plan.contenu = contenu;
  plan.bornes = Number.isFinite(estMin) ? { estMin, nordMin, estMax, nordMax } : null;
  plan.compte = { objets: plan.dao.objets.length, ignores: {} };
  return plan;
}
