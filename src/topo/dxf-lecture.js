// Lecture d'un fichier DXF (texte) : surfaces en triangles 3D.
//
// Un DXF est une suite de paires de lignes : un code (nombre) puis une valeur.
// On lit, dans la section des entités :
// - les faces 3D (3DFACE) : 3 ou 4 sommets (codes 10/20/30, 11/21/31, 12/22/32, 13/23/33) ;
//   une face à 4 sommets différents est coupée en 2 triangles ;
// - les maillages « polyface » (POLYLINE avec le drapeau 64) : sommets puis faces numérotées.
// Coordonnées : X = Est, Y = Nord, Z = altitude (m), sans aucune conversion.
// Une surface est créée par calque (le nom du calque devient le nom de la surface).

/**
 * Lit le texte d'un fichier DXF.
 * Renvoie { surfaces: [{ nom, points, triangles }], erreurs, avertissements }
 * où points = [{ nom, est, nord, altitude }] et triangles = listes de 3 de ces points.
 */
export function lireDXF(texte) {
  if (texte.startsWith('AutoCAD Binary DXF')) {
    return { surfaces: [], erreurs: ['DXF binaire non lu : enregistre le fichier en DXF « texte » (ASCII)'], avertissements: [] };
  }
  const paires = lirePaires(texte);
  const entites = entitesDuFichier(paires);
  const parCalque = new Map(); // nom du calque -> { points: Map(clé -> point), triangles }
  let facesIgnorees = 0;

  const ajouterFace = (calque, sommets) => {
    if (!parCalque.has(calque)) parCalque.set(calque, { points: new Map(), triangles: [] });
    const surface = parCalque.get(calque);
    // Une face à 4 sommets (le 4e différent du 3e) devient 2 triangles.
    const unique = sommets.filter((s, i) => i < 3 || !memePosition(s, sommets[2]));
    const triangles = unique.length === 4 ? [[unique[0], unique[1], unique[2]], [unique[0], unique[2], unique[3]]] : [unique.slice(0, 3)];
    for (const triangle of triangles) {
      // Un triangle sans surface en plan (vertical ou aplati) ne sert pas au calcul.
      if (Math.abs(aireEnPlan(triangle)) < 1e-9) {
        facesIgnorees++;
        continue;
      }
      surface.triangles.push(triangle.map((s) => pointUnique(surface.points, s)));
    }
  };

  for (let i = 0; i < entites.length; i++) {
    const entite = entites[i];
    if (entite.type === '3DFACE') {
      const sommets = [0, 1, 2, 3].map((k) => sommetDe(entite, k)).filter(Boolean);
      if (sommets.length >= 3) ajouterFace(entite.calque, sommets);
    } else if (entite.type === 'POLYLINE' && (entier(entite.codes.get('70')) & 64) !== 0) {
      // Maillage polyface : les VERTEX qui suivent, jusqu'à SEQEND.
      const sommets = [];
      for (i++; i < entites.length && entites[i].type === 'VERTEX'; i++) {
        const vertex = entites[i];
        const drapeau = entier(vertex.codes.get('70'));
        if ((drapeau & 64) !== 0) {
          sommets.push(sommetDe(vertex, 0));
        } else if ((drapeau & 128) !== 0) {
          // Face : numéros des sommets (à partir de 1, négatif = arête cachée).
          const numeros = ['71', '72', '73', '74'].map((code) => Math.abs(entier(vertex.codes.get(code)))).filter((n) => n > 0);
          const face = numeros.map((n) => sommets[n - 1]).filter(Boolean);
          if (face.length >= 3) ajouterFace(entite.calque, face);
        }
      }
    }
  }

  const surfaces = [...parCalque].map(([calque, { points, triangles }]) => ({
    nom: calque,
    points: [...points.values()],
    triangles,
  }));
  const erreurs = surfaces.length === 0 ? ['aucune face 3D (3DFACE ou maillage polyface) trouvée dans le fichier'] : [];
  const avertissements = [];
  if (facesIgnorees > 0) avertissements.push(`${facesIgnorees} face(s) verticale(s) ou aplatie(s) ignorée(s)`);
  if (surfaces.some((s) => s.points.some((p) => p.est < p.nord))) {
    avertissements.push('certaines coordonnées ont X plus petit que Y : en MN95, X = Est (environ 2 600 000) et Y = Nord (environ 1 200 000). Vérifie que le fichier est bien en MN95.');
  }
  return { surfaces, erreurs, avertissements };
}

/** Découpe le texte en paires { code, valeur }. */
function lirePaires(texte) {
  const lignes = texte.split(/\r?\n/);
  const paires = [];
  for (let i = 0; i + 1 < lignes.length; i += 2) {
    paires.push({ code: lignes[i].trim(), valeur: lignes[i + 1].trim() });
  }
  return paires;
}

/**
 * Entités de la section ENTITIES : { type, calque, codes } où codes = Map(code -> valeur)
 * (pour chaque code, la première valeur rencontrée).
 */
function entitesDuFichier(paires) {
  const entites = [];
  let dansEntites = false;
  let courante = null;
  for (let i = 0; i < paires.length; i++) {
    const { code, valeur } = paires[i];
    if (code === '0' && valeur === 'SECTION' && paires[i + 1]?.code === '2') {
      dansEntites = paires[i + 1].valeur === 'ENTITIES';
      continue;
    }
    if (!dansEntites) continue;
    if (code === '0') {
      if (valeur === 'ENDSEC') {
        dansEntites = false;
        courante = null;
        continue;
      }
      courante = { type: valeur, calque: '0', codes: new Map() };
      entites.push(courante);
    } else if (courante) {
      if (code === '8') courante.calque = valeur;
      if (!courante.codes.has(code)) courante.codes.set(code, valeur);
    }
  }
  return entites;
}

/** Sommet numéro k d'une entité (codes 10+k, 20+k, 30+k), ou null s'il manque. */
function sommetDe(entite, k) {
  const est = Number(entite.codes.get(String(10 + k)));
  const nord = Number(entite.codes.get(String(20 + k)));
  const altitude = Number(entite.codes.get(String(30 + k)) ?? 0);
  if (!Number.isFinite(est) || !Number.isFinite(nord) || !Number.isFinite(altitude)) return null;
  return { est, nord, altitude };
}

/** Un seul point par position (les triangles voisins partagent leurs sommets). */
function pointUnique(points, { est, nord, altitude }) {
  const cle = `${est.toFixed(4)} ${nord.toFixed(4)} ${altitude.toFixed(4)}`;
  if (!points.has(cle)) points.set(cle, { nom: String(points.size + 1), est, nord, altitude });
  return points.get(cle);
}

const memePosition = (a, b) => Math.abs(a.est - b.est) < 1e-6 && Math.abs(a.nord - b.nord) < 1e-6 && Math.abs(a.altitude - b.altitude) < 1e-6;

/** Aire signée en plan d'un triangle (m²), calculée autour du premier sommet. */
function aireEnPlan([a, b, c]) {
  return ((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
}

const entier = (valeur) => Number.parseInt(valeur ?? '0', 10) || 0;
