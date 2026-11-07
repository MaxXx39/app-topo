// Courbes de niveau et bandes de couleur selon l'altitude, calculées sur une surface en triangles.
//
// Sur chaque triangle, l'altitude varie de façon linéaire (plan passant par les 3 sommets).
// Une courbe de niveau traverse donc chaque triangle en ligne droite : on calcule ses
// deux points de passage sur les côtés du triangle.
//
// Règle pour les points pile à l'altitude d'une courbe : ils sont comptés « au-dessus ».
// Ainsi un côté posé exactement sur la courbe n'est dessiné qu'une seule fois.
//
// Unités : mètres (Est, Nord, altitude), mètres carrés (surfaces).

/**
 * Choisit une équidistance « ronde » (m) pour avoir environ 10 courbes entre
 * l'altitude la plus basse et la plus haute.
 */
export function equidistanceAuto(altitudeMin, altitudeMax) {
  const ecart = altitudeMax - altitudeMin;
  const valeurs = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  return valeurs.find((valeur) => ecart / valeur <= 12) ?? 100;
}

/** Altitudes la plus basse et la plus haute d'une liste de triangles (m). */
export function plageAltitudes(triangles) {
  let min = Infinity;
  let max = -Infinity;
  for (const triangle of triangles) {
    for (const sommet of triangle) {
      min = Math.min(min, sommet.altitude);
      max = Math.max(max, sommet.altitude);
    }
  }
  return { min, max };
}

/**
 * Courbes de niveau : renvoie une liste de segments { altitude, a, b }
 * (a et b = { est, nord } en m), une courbe tous les "equidistance" mètres.
 */
export function courbesDeNiveau(triangles, equidistance) {
  const segments = [];
  for (const triangle of triangles) {
    const altitudes = triangle.map((p) => p.altitude);
    const premier = Math.ceil(Math.min(...altitudes) / equidistance);
    const dernier = Math.floor(Math.max(...altitudes) / equidistance);
    for (let k = premier; k <= dernier; k++) {
      const niveau = arrondir(k * equidistance);
      const passages = [];
      for (let i = 0; i < 3; i++) {
        const p = triangle[i];
        const q = triangle[(i + 1) % 3];
        // Le côté p-q croise la courbe si un bout est au-dessus et l'autre en dessous.
        if (p.altitude >= niveau !== q.altitude >= niveau) {
          const t = (niveau - p.altitude) / (q.altitude - p.altitude);
          passages.push({ est: p.est + t * (q.est - p.est), nord: p.nord + t * (q.nord - p.nord) });
        }
      }
      if (passages.length === 2) segments.push({ altitude: niveau, a: passages[0], b: passages[1] });
    }
  }
  return segments;
}

/**
 * Bandes de couleur : découpe chaque triangle en morceaux compris entre deux courbes.
 * Renvoie une liste de { altitude, polygone } où altitude = bas de la bande (m)
 * et polygone = liste de { est, nord } (m).
 */
export function bandesDeNiveau(triangles, equidistance) {
  const bandes = [];
  for (const triangle of triangles) {
    const altitudes = triangle.map((p) => p.altitude);
    const premier = Math.floor(Math.min(...altitudes) / equidistance);
    const dernier = Math.floor(Math.max(...altitudes) / equidistance);
    for (let k = premier; k <= dernier; k++) {
      const bas = arrondir(k * equidistance);
      const haut = arrondir((k + 1) * equidistance);
      // On garde la partie du triangle au-dessus du bas, puis celle en dessous du haut.
      let morceau = couperSelonAltitude(triangle, bas, true);
      morceau = couperSelonAltitude(morceau, haut, false);
      if (morceau.length >= 3) {
        bandes.push({ altitude: bas, polygone: morceau.map((p) => ({ est: p.est, nord: p.nord })) });
      }
    }
  }
  return bandes;
}

/**
 * Garde la partie d'un polygone (sommets { est, nord, altitude }) située au-dessus
 * (garderDessus = vrai) ou en dessous d'une altitude donnée. L'altitude varie
 * linéairement le long des côtés.
 */
function couperSelonAltitude(polygone, niveau, garderDessus) {
  const dedans = (p) => (garderDessus ? p.altitude >= niveau : p.altitude <= niveau);
  const resultat = [];
  for (let i = 0; i < polygone.length; i++) {
    const p = polygone[i];
    const q = polygone[(i + 1) % polygone.length];
    if (dedans(p)) resultat.push(p);
    if (dedans(p) !== dedans(q)) {
      const t = (niveau - p.altitude) / (q.altitude - p.altitude);
      resultat.push({
        est: p.est + t * (q.est - p.est),
        nord: p.nord + t * (q.nord - p.nord),
        altitude: niveau,
      });
    }
  }
  return resultat;
}

/** Évite les restes d'arrondi (0.30000000000000004 -> 0.3). */
function arrondir(valeur) {
  return Math.round(valeur * 1e6) / 1e6;
}

// --- Courbes maîtresses et cotes (0.154.0, demande du 07.11) -----------------------------------
// Une courbe sur 5 est « maîtresse » (plus épaisse) ; seules les maîtresses portent leur altitude,
// écrite tous les 20 m le long de la courbe, dans son sens (jamais à l'envers).

/** Vrai si la courbe d'altitude "altitude" est une maîtresse (une sur 5) pour cette équidistance. */
export function estMaitresse(altitude, equidistance) {
  const rang = altitude / (5 * equidistance);
  return Math.abs(rang - Math.round(rang)) < 1e-6;
}

/**
 * Relie les segments d'une même altitude en lignes continues (bout à bout, au millimètre près).
 * segments : sortie de courbesDeNiveau. Renvoie [{ altitude, points: [{ est, nord }] }].
 */
export function chainerCourbes(segments) {
  const cle = (p) => `${Math.round(p.est * 1000)}|${Math.round(p.nord * 1000)}`;
  const parAltitude = new Map();
  for (const s of segments) {
    if (!parAltitude.has(s.altitude)) parAltitude.set(s.altitude, []);
    parAltitude.get(s.altitude).push(s);
  }
  const lignes = [];
  for (const [altitude, liste] of parAltitude) {
    // Index : bout → segments qui y touchent.
    const index = new Map();
    liste.forEach((s, i) => {
      for (const p of [s.a, s.b]) {
        const k = cle(p);
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(i);
      }
    });
    const pris = new Array(liste.length).fill(false);
    const suivant = (point) => (index.get(cle(point)) ?? []).find((j) => !pris[j]);
    for (let i = 0; i < liste.length; i++) {
      if (pris[i]) continue;
      pris[i] = true;
      const points = [liste[i].a, liste[i].b];
      // On prolonge d'un côté, puis de l'autre.
      for (const sens of ['fin', 'debut']) {
        for (;;) {
          const bout = sens === 'fin' ? points.at(-1) : points[0];
          const j = suivant(bout);
          if (j === undefined) break;
          pris[j] = true;
          const s = liste[j];
          const autre = cle(s.a) === cle(bout) ? s.b : s.a;
          if (sens === 'fin') points.push(autre);
          else points.unshift(autre);
        }
      }
      lignes.push({ altitude, points });
    }
  }
  return lignes;
}

/**
 * Places des cotes le long des lignes : la première à pas ÷ 2 du début, puis tous les "pas" m (une
 * ligne plus courte que pas ÷ 2 n'en a pas). Angle en degrés, sens trigonométrique depuis l'Est,
 * ramené entre −90 et 90 (texte jamais à l'envers). Renvoie [{ altitude, est, nord, angle }].
 */
export function cotesDesCourbes(lignes, pas = 20) {
  const cotes = [];
  for (const { altitude, points } of lignes) {
    let prochain = pas / 2;
    let parcouru = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const longueur = Math.hypot(b.est - a.est, b.nord - a.nord);
      while (longueur > 0 && parcouru + longueur >= prochain) {
        const t = (prochain - parcouru) / longueur;
        let angle = (Math.atan2(b.nord - a.nord, b.est - a.est) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        cotes.push({ altitude, est: a.est + t * (b.est - a.est), nord: a.nord + t * (b.nord - a.nord), angle });
        prochain += pas;
      }
      parcouru += longueur;
    }
  }
  return cotes;
}

/** Texte d'une cote : l'altitude avec les décimales utiles (412, 412.5, 412.25). */
export function texteCote(altitude) {
  return String(Math.round(altitude * 100) / 100);
}
