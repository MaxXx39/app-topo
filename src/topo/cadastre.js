// Cadastre autour d'un point (0.112.0, Projet › Import, Expert) : calculs sans réseau.
// Le service du canton (WFS, GML) donne les points limites et les parcelles ; ici on lit le GML,
// on garde ce qui est dans le cercle, et on fabrique la liste de points et un plan DXF des limites.
// Coordonnées : Est, Nord en MN95, mètres. Le cadastre n'a pas d'altitude (null).

export const RAYON_MIN = 5; // m
export const RAYON_MAX = 500; // m
export const RAYON_DEPART = 50; // m
export const PREFIXE_POINT = 'CAD-';
export const NOM_CALQUE = 'CADASTRE';

/** Rectangle MN95 autour du centre { est, nord } : { estMin, nordMin, estMax, nordMax }. */
export function rectangleAutour(centre, rayon) {
  return { estMin: centre.est - rayon, nordMin: centre.nord - rayon, estMax: centre.est + rayon, nordMax: centre.nord + rayon };
}

/** Rayon tapé (m) : nombre entre RAYON_MIN et RAYON_MAX (virgule acceptée), sinon null. */
export function lireRayon(texte) {
  const valeur = Number(String(texte ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(valeur) || valeur < RAYON_MIN || valeur > RAYON_MAX) return null;
  return valeur;
}

/** Remet une paire dans l'ordre Est, Nord (certains services donnent Nord, Est). Null si hors de Suisse. */
export function ordreEstNord(a, b) {
  const estOk = (v) => v >= 2400000 && v <= 2900000;
  const nordOk = (v) => v >= 1000000 && v <= 1400000;
  if (estOk(a) && nordOk(b)) return [a, b];
  if (nordOk(a) && estOk(b)) return [b, a];
  return null;
}

/** Paires [est, nord] d'une suite de nombres (dimension 2 ou 3). */
function pairesDeNombres(nombres, dimension) {
  const paires = [];
  for (let i = 0; i + 1 < nombres.length; i += dimension) {
    const paire = ordreEstNord(nombres[i], nombres[i + 1]);
    if (paire) paires.push(paire);
  }
  return paires;
}

/** Paires d'un morceau de GML (gml:coordinates « x,y x,y », gml:pos, gml:posList). */
function pairesDuMorceau(morceau) {
  const coordonnees = /<(?:\w+:)?coordinates\b[^>]*>([^<]*)<\/(?:\w+:)?coordinates>/.exec(morceau);
  if (coordonnees) {
    return coordonnees[1].trim().split(/\s+/).filter(Boolean).map((duo) => {
      const [x, y] = duo.split(',').map(Number);
      return ordreEstNord(x, y);
    }).filter(Boolean);
  }
  const liste = /<(?:\w+:)?posList\b([^>]*)>([^<]*)<\/(?:\w+:)?posList>/.exec(morceau);
  if (liste) {
    const dimension = Number(/srsDimension="(\d)"/.exec(liste[1])?.[1] ?? 2);
    return pairesDeNombres(liste[2].trim().split(/\s+/).map(Number), dimension);
  }
  const toutes = [...morceau.matchAll(/<(?:\w+:)?pos\b[^>]*>([^<]*)<\/(?:\w+:)?pos>/g)];
  return toutes.flatMap((m) => pairesDeNombres(m[1].trim().split(/\s+/).map(Number), 2));
}

/**
 * Lit un GML (réponse d'un WFS) : { points: [[est, nord]], lignes: [[[est, nord]…]] }.
 * Les contours de parcelles (LinearRing) et les lignes (LineString) deviennent des lignes ;
 * un contour dont le dernier sommet est le premier reste fermé. Lève une erreur claire si le
 * service répond par une erreur (ExceptionReport).
 */
export function lireGml(texte) {
  const erreur = /<(?:\w+:)?ExceptionText\b[^>]*>([\s\S]*?)<\/(?:\w+:)?ExceptionText>/.exec(texte)
    ?? /<(?:\w+:)?ServiceException\b[^>]*>([\s\S]*?)<\/(?:\w+:)?ServiceException>/.exec(texte);
  if (erreur) throw new Error(`le service répond : « ${erreur[1].trim().replace(/\s+/g, ' ').slice(0, 200)} »`);
  const points = [];
  const lignes = [];
  const forme = /<((?:\w+:)?(?:Point|LineString|LinearRing))\b[\s\S]*?<\/\1>/g;
  for (const trouve of texte.matchAll(forme)) {
    const type = trouve[1].replace(/^\w+:/, '');
    const paires = pairesDuMorceau(trouve[0]);
    if (type === 'Point') {
      if (paires[0]) points.push(paires[0]);
    } else if (paires.length >= 2) {
      lignes.push(paires);
    }
  }
  return { points, lignes };
}

/** Distance à plat (m) entre deux paires [est, nord]. */
function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Garde ce qui est dans le cercle (centre { est, nord }, rayon en m) : les points à moins de
 * "rayon", et les lignes dont au moins un sommet est dans le cercle (elles ne sont pas coupées).
 */
export function garderDansLeCercle(donnees, centre, rayon) {
  const c = [centre.est, centre.nord];
  const dedans = (p) => distance(p, c) <= rayon;
  return { points: donnees.points.filter(dedans), lignes: donnees.lignes.filter((ligne) => ligne.some(dedans)) };
}

const mm = (v) => Math.round(v * 1000) / 1000;

/**
 * Points limites de la liste : les points du service s'il y en a, sinon les sommets des lignes
 * (contours de parcelles). Sans doublon (au millimètre près), triés d'ouest en est puis du sud au
 * nord, nommés CAD-1, CAD-2… Altitude inconnue (null). Chaque point : { nom, est, nord, altitude, ligne }.
 */
export function pointsDuCadastre(donnees) {
  const sources = donnees.points.length > 0 ? donnees.points : donnees.lignes.flat();
  const vus = new Set();
  const uniques = [];
  for (const [est, nord] of sources) {
    const cle = `${mm(est)}|${mm(nord)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push([mm(est), mm(nord)]);
  }
  uniques.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return uniques.map(([est, nord], n) => ({ nom: `${PREFIXE_POINT}${n + 1}`, est, nord, altitude: null, ligne: n + 1 }));
}

/**
 * Texte d'un DXF (ASCII) avec les lignes du cadastre, calque « CADASTRE » : lu ensuite par
 * lirePlanDxf comme n'importe quel plan DXF (accroche Sommet, Milieu, Sur ligne comprise).
 */
export function dxfDuCadastre(lignes) {
  const sortie = ['0', 'SECTION', '2', 'ENTITIES'];
  for (const ligne of lignes) {
    sortie.push('0', 'POLYLINE', '8', NOM_CALQUE, '66', '1', '70', '0');
    for (const [est, nord] of ligne) sortie.push('0', 'VERTEX', '8', NOM_CALQUE, '10', String(mm(est)), '20', String(mm(nord)), '30', '0');
    sortie.push('0', 'SEQEND', '8', NOM_CALQUE);
  }
  sortie.push('0', 'ENDSEC', '0', 'EOF');
  return sortie.join('\n');
}

/** Nom de la liste de points : « Cadastre 1 », ou le numéro libre suivant. */
export function nomDeLaListe(nomsPris) {
  const pris = new Set(nomsPris.map((n) => String(n).toLowerCase()));
  let numero = 1;
  while (pris.has(`cadastre ${numero}`)) numero++;
  return `Cadastre ${numero}`;
}

/** Noms des couches du service qui conviennent : { points (limites), surfaces (parcelles) }. */
export function choisirCouches(noms) {
  const points = noms.find((n) => /grenzpunkt|point.?limite|pointlimite/i.test(n)) ?? null;
  const surfaces = noms.find((n) => /liegenschaft|bien.?fonds|immeuble|parcelle/i.test(n) && !/proj|punkt|point|grenz|lage|nummer|numero|selbst|recht|bauwerk/i.test(n)) ?? null;
  return { points, surfaces };
}

/** Noms des couches (FeatureType) d'un GetCapabilities WFS. */
export function nomsDesCouches(capabilities) {
  return [...capabilities.matchAll(/<FeatureType\b[\s\S]*?<Name>([^<]+)<\/Name>/g)].map((m) => m[1].trim());
}
