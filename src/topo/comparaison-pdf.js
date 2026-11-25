// Comparer des PDF (0.282.0, décisions du 22.11) : calculs sans écran, repris de l'appli « PlanDiff Pro » fournie par
// l'utilisateur et adaptés à Topo. Testés dans tests/comparaison-pdf.test.js.
//
// Repères : chaque planche a pour repère la page du plan A (ancien indice), en POINTS PDF (1 pt = 1/72 pouce
// = 0,3528 mm), origine en haut à gauche, y vers le bas (comme pdf.js à l'échelle 1). Le plan B (nouvel indice) y est
// posé par un « alignement » { x, y, s, r } : point de B → point de A = s · R(r) · p + (x, y), r en degrés.
// Les images comparées sont des « masques d'encre » : 1 = pixel dessiné (pas blanc), 0 = papier.

export const MM_PAR_POINT = 25.4 / 72;
export const ALIGNEMENT_NEUTRE = { x: 0, y: 0, s: 1, r: 0 };

// --- Alignement ---

/** Point de B → point de A. */
export function appliquerAlignement({ x, y, s, r }, [px, py]) {
  const t = (r * Math.PI) / 180;
  return [s * (Math.cos(t) * px - Math.sin(t) * py) + x, s * (Math.sin(t) * px + Math.cos(t) * py) + y];
}

/** Matrice canvas [a, b, c, d, e, f] de l'alignement (B → A). */
export function matriceAlignement({ x, y, s, r }) {
  const t = (r * Math.PI) / 180;
  return [s * Math.cos(t), s * Math.sin(t), -s * Math.sin(t), s * Math.cos(t), x, y];
}

/** m1 · m2 (on applique m2 puis m1), matrices canvas. */
export function composer(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Alignement depuis une similitude du calage ({ echelle, rotationDeg, tx, ty }) dont les unités sont « f » points. */
export function alignementDepuisSimilitude(s, unite = 1) {
  return { x: s.tx / unite, y: s.ty / unite, s: s.echelle, r: ((s.rotationDeg + 180) % 360) - 180 };
}

// --- Masques d'encre ---

/** Masque d'encre d'une image RGBA (ImageData.data) : pixel non blanc (moyenne < seuil) = 1. */
export function masqueEncre(rgba, seuil = 235) {
  const n = rgba.length / 4;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = rgba[4 * i + 3];
    if (a < 16) continue;
    if ((rgba[4 * i] + rgba[4 * i + 1] + rgba[4 * i + 2]) / 3 < seuil) m[i] = 1;
  }
  return m;
}

/** Masque « grossi » de r pixels (carré de côté 2r + 1) : deux passes, en ligne puis en colonne. */
export function dilater(masque, w, h, r) {
  if (r <= 0) return masque;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    let compte = 0;
    const base = y * w;
    for (let x = 0; x < Math.min(r, w); x += 1) compte += masque[base + x];
    for (let x = 0; x < w; x += 1) {
      if (x + r < w) compte += masque[base + x + r];
      if (x - r - 1 >= 0) compte -= masque[base + x - r - 1];
      tmp[base + x] = compte > 0 ? 1 : 0;
    }
  }
  const sortie = new Uint8Array(w * h);
  for (let x = 0; x < w; x += 1) {
    let compte = 0;
    for (let y = 0; y < Math.min(r, h); y += 1) compte += tmp[y * w + x];
    for (let y = 0; y < h; y += 1) {
      if (y + r < h) compte += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) compte -= tmp[(y - r - 1) * w + x];
      sortie[y * w + x] = compte > 0 ? 1 : 0;
    }
  }
  return sortie;
}

/**
 * Image de la superposition (RGBA) : encre des deux plans (à la tolérance près) = gris ; seulement A = couleur de A
 * (supprimé) ; seulement B = couleur de B (ajouté) ; papier blanc. couleurs : { a, b, identique } = [r, g, b].
 * intensite (0 à 1) : force des couleurs. sansIdentiques : les traits identiques ne sont pas dessinés.
 */
export function superposer(encreA, encreB, w, h, r, couleurs, { intensite = 1, sansIdentiques = false } = {}) {
  const grosA = dilater(encreA, w, h, r);
  const grosB = dilater(encreB, w, h, r);
  const sortie = new Uint8ClampedArray(w * h * 4).fill(255);
  const melanger = (c, i) => {
    sortie[4 * i] = 255 - (255 - c[0]) * intensite;
    sortie[4 * i + 1] = 255 - (255 - c[1]) * intensite;
    sortie[4 * i + 2] = 255 - (255 - c[2]) * intensite;
  };
  for (let i = 0; i < w * h; i += 1) {
    if (encreA[i] && !grosB[i]) melanger(couleurs.a, i);
    else if (encreB[i] && !grosA[i]) melanger(couleurs.b, i);
    else if ((encreA[i] || encreB[i]) && !sansIdentiques) {
      sortie[4 * i] = couleurs.identique[0];
      sortie[4 * i + 1] = couleurs.identique[1];
      sortie[4 * i + 2] = couleurs.identique[2];
    }
  }
  return sortie;
}

/** Une seule couleur pour l'encre d'un plan (rideau, clignotement) : RGBA. */
export function teinter(encre, couleur) {
  const sortie = new Uint8ClampedArray(encre.length * 4).fill(255);
  for (let i = 0; i < encre.length; i += 1) {
    if (!encre[i]) continue;
    sortie[4 * i] = couleur[0];
    sortie[4 * i + 1] = couleur[1];
    sortie[4 * i + 2] = couleur[2];
  }
  return sortie;
}

// --- Détection des zones modifiées ---

/**
 * Zones modifiées entre deux masques d'encre de même taille (pixels). r : tolérance (px) ; cellule : taille des
 * cases (px) ; ecart : cases vides permises entre deux morceaux d'une même zone ; minPixels : en dessous, c'est du
 * bruit ; masques : rectangles { x, y, w, h } à ignorer (px) ; cadre : { bord, fin, long } (px) pour écarter les
 * traits de cadre de la feuille (long et fin, collés au bord). Renvoie [{ x, y, w, h, supprimes, ajoutes }] (px).
 */
export function detecterZones(encreA, encreB, w, h, { r = 1, cellule = 8, ecart = 2, minPixels = 6, masques = [], cadre = null } = {}) {
  const grosA = dilater(encreA, w, h, r);
  const grosB = dilater(encreB, w, h, r);
  const cw = Math.ceil(w / cellule);
  const ch = Math.ceil(h / cellule);
  const supp = new Uint32Array(cw * ch);
  const ajou = new Uint32Array(cw * ch);
  const dansMasque = (x, y) => masques.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const s = encreA[i] && !grosB[i];
      const a = encreB[i] && !grosA[i];
      if (!s && !a) continue;
      if (masques.length && dansMasque(x, y)) continue;
      const c = Math.floor(y / cellule) * cw + Math.floor(x / cellule);
      if (s) supp[c] += 1;
      if (a) ajou[c] += 1;
    }
  }
  // Cases touchées, regroupées si elles sont à moins de « ecart » cases (composantes connexes).
  const vu = new Uint8Array(cw * ch);
  const zones = [];
  for (let c0 = 0; c0 < cw * ch; c0 += 1) {
    if (vu[c0] || !(supp[c0] + ajou[c0])) continue;
    const pile = [c0];
    vu[c0] = 1;
    let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1; let s = 0; let a = 0;
    while (pile.length) {
      const c = pile.pop();
      const cx = c % cw;
      const cy = Math.floor(c / cw);
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      s += supp[c];
      a += ajou[c];
      for (let dy = -ecart - 1; dy <= ecart + 1; dy += 1) {
        for (let dx = -ecart - 1; dx <= ecart + 1; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const n = ny * cw + nx;
          if (vu[n] || !(supp[n] + ajou[n])) continue;
          vu[n] = 1;
          pile.push(n);
        }
      }
    }
    if (s + a < minPixels) continue;
    const zone = { x: minX * cellule, y: minY * cellule, w: Math.min(w, (maxX + 1) * cellule) - minX * cellule, h: Math.min(h, (maxY + 1) * cellule) - minY * cellule, supprimes: s, ajoutes: a };
    if (cadre && estCadre(zone, w, h, cadre)) continue;
    zones.push(zone);
  }
  return zones;
}

/** Trait du cadre de la feuille (format de page changé) : long, fin et collé à un bord. */
function estCadre(z, w, h, { bord, fin, long }) {
  const horizontal = z.h < fin && z.w > long && (z.y < bord || z.y + z.h > h - bord);
  const vertical = z.w < fin && z.h > long && (z.x < bord || z.x + z.w > w - bord);
  return horizontal || vertical;
}

/** Genre d'une zone : 'suppr' (seulement de l'ancien), 'ajout' (seulement du nouveau) ou 'modif' (les deux). */
export function genreDeZone({ supprimes, ajoutes }) {
  if (supprimes && ajoutes) return Math.min(supprimes, ajoutes) / Math.max(supprimes, ajoutes) < 0.08 ? (supprimes > ajoutes ? 'suppr' : 'ajout') : 'modif';
  return supprimes ? 'suppr' : 'ajout';
}

// --- Textes : avant → après ---

/** Deux textes « proches » : même longueur à 3 près et au moins la moitié des caractères en commun. */
export function textesSemblables(a, b) {
  if (Math.abs(a.length - b.length) > 3) return false;
  const reste = [...b];
  let communs = 0;
  for (const c of a) {
    const i = reste.indexOf(c);
    if (i >= 0) {
      communs += 1;
      reste.splice(i, 1);
    }
  }
  return communs >= Math.max(a.length, b.length) / 2;
}

/**
 * Textes changés entre A et B (déjà dans le repère de A) : [{ genre: 'modif' | 'suppr' | 'ajout', avant, apres, x, y,
 * w, h }]. Textes : { t, x, y, w, h } (boîte, points). Un texte identique tout près = inchangé ; un texte semblable
 * tout près = modifié (« 2.50 → 2.65 ») ; sinon supprimé / ajouté.
 */
export function differencesTextes(textesA, textesB, dansMasque = () => false) {
  const A = textesA.filter((t) => t.t.trim() && !dansMasque(t.x + t.w / 2, t.y + t.h / 2));
  const B = textesB.filter((t) => t.t.trim() && !dansMasque(t.x + t.w / 2, t.y + t.h / 2));
  const pris = new Uint8Array(B.length);
  const sortie = [];
  const centre = (t) => [t.x + t.w / 2, t.y + t.h / 2];
  for (const a of A) {
    const [ax, ay] = centre(a);
    const rayon = Math.max(4.25, a.h * 0.9); // 1,5 mm au moins
    let meme = -1;
    let proche = -1;
    let dMin = Infinity;
    for (let i = 0; i < B.length; i += 1) {
      if (pris[i]) continue;
      const [bx, by] = centre(B[i]);
      const d = Math.hypot(bx - ax, by - ay);
      if (d > rayon) continue;
      if (B[i].t === a.t) {
        meme = i;
        break;
      }
      if (d < dMin && textesSemblables(a.t, B[i].t)) {
        dMin = d;
        proche = i;
      }
    }
    if (meme >= 0) {
      pris[meme] = 1;
      continue;
    }
    if (proche >= 0) {
      pris[proche] = 1;
      const b = B[proche];
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      sortie.push({ genre: 'modif', avant: a.t, apres: b.t, x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y });
    } else sortie.push({ genre: 'suppr', avant: a.t, apres: '', x: a.x, y: a.y, w: a.w, h: a.h });
  }
  B.forEach((b, i) => {
    if (!pris[i]) sortie.push({ genre: 'ajout', avant: '', apres: b.t, x: b.x, y: b.y, w: b.w, h: b.h });
  });
  return sortie;
}

/** Vrai si deux rectangles { x, y, w, h } se touchent (marge en plus). */
export function seTouchent(p, q, marge = 0) {
  return p.x - marge <= q.x + q.w && q.x - marge <= p.x + p.w && p.y - marge <= q.y + q.h && q.y - marge <= p.y + p.h;
}

/**
 * Liste des modifications d'une planche : zones (points) + textes changés. Un texte dans une zone lui est rattaché ;
 * un texte seul devient sa propre modification. Numérotées de haut en bas, puis de gauche à droite (n à partir de
 * « depart »). Renvoie [{ n, x, y, w, h, genre, textes: [{ avant, apres }] }].
 */
export function listerModifications(zones, textes, depart = 1) {
  const liste = zones.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h, genre: genreDeZone(z), textes: [] }));
  for (const t of textes) {
    const zone = liste.find((z) => seTouchent(z, t, 1));
    if (zone) zone.textes.push({ avant: t.avant, apres: t.apres });
    else liste.push({ x: t.x, y: t.y, w: t.w, h: t.h, genre: t.genre, textes: [{ avant: t.avant, apres: t.apres }] });
  }
  liste.sort((p, q) => (Math.abs(p.y - q.y) > 20 ? p.y - q.y : p.x - q.x));
  return liste.map((m, i) => ({ n: depart + i, ...m }));
}

/** Titre court d'une modification : « Cote / texte modifié », « Ajout », « Suppression », « Modification ». */
export function titreModification(m) {
  if (m.textes?.length && m.textes.every((t) => t.avant && t.apres)) return 'Texte / cote modifié';
  return { ajout: 'Ajout', suppr: 'Suppression', modif: 'Modification' }[m.genre] ?? 'Modification';
}

// --- Appariement des planches et des fichiers ---

/** Mots d'une page (3 lettres ou plus, en minuscules) : sert à reconnaître la même planche. */
export function motsDeLaPage(textes) {
  const mots = new Set();
  for (const t of textes) for (const m of String(t.t ?? t).toLowerCase().split(/[^a-z0-9àâäçéèêëîïôöùûü]+/)) if (m.length >= 3) mots.add(m);
  return mots;
}

const jaccard = (p, q) => {
  if (!p.size || !q.size) return 0;
  let communs = 0;
  for (const m of p) if (q.has(m)) communs += 1;
  return communs / (p.size + q.size - communs);
};

/**
 * Apparie les pages de A et de B ([Set de mots] chacun) : d'abord les paires les plus semblables (au moins 20 % de mots
 * communs), puis les restes par leur numéro. Renvoie [{ a, b }] (numéros à partir de 1 ; a ou b null = page seule).
 */
export function apparierPages(motsA, motsB, seuil = 0.2) {
  const paires = [];
  for (let i = 0; i < motsA.length; i += 1) for (let j = 0; j < motsB.length; j += 1) paires.push({ i, j, s: jaccard(motsA[i], motsB[j]) });
  paires.sort((p, q) => q.s - p.s || Math.abs(p.i - p.j) - Math.abs(q.i - q.j));
  const prisA = new Set();
  const prisB = new Set();
  const res = [];
  for (const p of paires) {
    if (p.s < seuil) break;
    if (prisA.has(p.i) || prisB.has(p.j)) continue;
    prisA.add(p.i);
    prisB.add(p.j);
    res.push({ a: p.i + 1, b: p.j + 1 });
  }
  // Les autres : même rang parmi les pages restantes.
  const restesA = motsA.map((_, i) => i).filter((i) => !prisA.has(i));
  const restesB = motsB.map((_, j) => j).filter((j) => !prisB.has(j));
  for (let k = 0; k < Math.max(restesA.length, restesB.length); k += 1) {
    res.push({ a: restesA[k] !== undefined ? restesA[k] + 1 : null, b: restesB[k] !== undefined ? restesB[k] + 1 : null });
  }
  return res.sort((p, q) => (p.a ?? 999) - (q.a ?? 999));
}

/**
 * Nom d'un plan sans son indice ni son extension : « Coffrage_rez_C.pdf » → « coffrage rez » ; « 2629-12 ind. D.pdf »
 * → « 2629 12 ». Sert à apparier deux dossiers et à reconnaître le même plan d'un indice à l'autre.
 */
export function nomSansIndice(nom) {
  let base = String(nom).replace(/\.[^.]+$/, '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  // « ind. D », « indice 3 », « rev B » à la fin ; sinon une ou deux lettres (+ un chiffre) seules à la fin (« _C », « B2 »).
  const sans = base.replace(/\s+(ind|indice|rev|revision|révision)\s*[a-z0-9]{1,3}$/, '');
  if (sans !== base) return sans.trim();
  const court = base.replace(/\s+[a-z]{1,2}\d?$/, '');
  return (court || base).trim();
}

/** Apparie deux listes de fichiers par leur nom sans indice. Renvoie [{ a, b }] (noms ; null = fichier seul). */
export function apparierFichiers(nomsA, nomsB) {
  const restesB = [...nomsB];
  const res = [];
  for (const a of nomsA) {
    const cle = nomSansIndice(a);
    const k = restesB.findIndex((b) => nomSansIndice(b) === cle);
    if (k >= 0) res.push({ a, b: restesB.splice(k, 1)[0] });
    else res.push({ a, b: null });
  }
  for (const b of restesB) res.push({ a: null, b });
  return res;
}

// --- Annotations : mesures ---

/** Longueur entre deux points (points PDF) : { papierMm, reelleM } (reelleM si l'étalonnage est connu, m par point). */
export function mesurerLongueur([x1, y1], [x2, y2], metresParPoint = null) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  return { papierMm: d * MM_PAR_POINT, reelleM: metresParPoint ? d * metresParPoint : null };
}

/** Aire d'un polygone (points PDF) : { papierMm2, reelleM2 }. */
export function mesurerSurface(points, metresParPoint = null) {
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  const pts2 = Math.abs(a) / 2;
  return { papierMm2: pts2 * MM_PAR_POINT ** 2, reelleM2: metresParPoint ? pts2 * metresParPoint ** 2 : null };
}

/** Étalonnage : mètres par point PDF d'après une longueur cliquée et sa vraie longueur (m). */
export function etalonner(p1, p2, longueurReelleM) {
  const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  return d > 0 && longueurReelleM > 0 ? longueurReelleM / d : null;
}

/** Contour d'un nuage de révision autour d'un rectangle : arcs de « pas » points. Renvoie [[cx, cy, rayon, debut, fin]]. */
export function arcsDeNuage({ x, y, w, h }, pas = 12) {
  const arcs = [];
  const cote = (x1, y1, x2, y2, angleDehors) => {
    const L = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(L / pas));
    for (let i = 0; i < n; i += 1) {
      const cx = x1 + ((i + 0.5) / n) * (x2 - x1);
      const cy = y1 + ((i + 0.5) / n) * (y2 - y1);
      arcs.push([cx, cy, L / n / 2, angleDehors - Math.PI / 2, angleDehors + Math.PI / 2]);
    }
  };
  cote(x, y, x + w, y, -Math.PI / 2);
  cote(x + w, y, x + w, y + h, 0);
  cote(x + w, y + h, x, y + h, Math.PI / 2);
  cote(x, y + h, x, y, Math.PI);
  return arcs;
}

// --- Rapport ---

/** Texte pour les polices standard des PDF (WinAnsi) : flèches et signes absents remplacés. */
export function texteWinAnsi(texte) {
  return String(texte ?? '')
    .replace(/→/g, '->').replace(/[−–—]/g, '-').replace(/[«»]/g, '"').replace(/[’‘]/g, "'").replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff€]/g, '?');
}

/**
 * Où poser la page B dans le rapport (pdf-lib, y vers le haut) sur une page de la taille de A : { x, y, echelle,
 * rotationDeg } pour drawPage. hauteurA, hauteurB : hauteurs des pages (points). Dans le repère du PDF (y vers le haut),
 * la rotation change de signe.
 */
export function poseDeB(alignement, hauteurA, hauteurB) {
  const [vx, vy] = appliquerAlignement(alignement, [0, hauteurB]); // coin bas gauche de B, dans le repère de A
  return { x: vx, y: hauteurA - vy, echelle: alignement.s, rotationDeg: -alignement.r };
}

// --- 0.316.0 : recalage sur axes, accroche, différences vectorielles ---

/** Point de A → point de B (inverse de appliquerAlignement). */
export function inverserAlignement({ x, y, s, r }, [qx, qy]) {
  const t = (-r * Math.PI) / 180;
  const dx = (qx - x) / s;
  const dy = (qy - y) / s;
  return [Math.cos(t) * dx - Math.sin(t) * dy, Math.sin(t) * dx + Math.cos(t) * dy];
}

/**
 * Recalage « sur axes » : un trait de A (axeA = [x1, y1, x2, y2], repère de A) et un trait de B (axeB, repère d'ORIGINE de
 * B) doivent coïncider. B est tourné pour que les deux traits soient parallèles (rotation la plus petite, ±90°) et
 * déplacé perpendiculairement au trait ; sa position le long du trait ne change pas (un point la fixe ensuite).
 * garderEchelle : l'échelle actuelle est gardée (toujours le cas ici : un trait ne donne pas d'échelle).
 */
export function alignementSurAxes(alignement, axeA, axeB) {
  const [ax, ay] = [axeA[2] - axeA[0], axeA[3] - axeA[1]];
  const [bx, by] = [axeB[2] - axeB[0], axeB[3] - axeB[1]];
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (!la || !lb) return null;
  // Rotation = direction de A / direction de B (nombres complexes unitaires), côté du sens le plus proche de la rotation nulle.
  let [ur, ui] = [(ax * bx + ay * by) / (la * lb), (ay * bx - ax * by) / (la * lb)];
  if (ur < 0) [ur, ui] = [-ur, -ui];
  const s = alignement.s;
  const r = (Math.atan2(ui, ur) * 180) / Math.PI;
  const tourne = { ...alignement, r };
  // Milieu du trait de B ramené dans A, puis corrigé de sa distance au trait de A (perpendiculairement).
  const milieuB = appliquerAlignement({ x: 0, y: 0, s, r }, [(axeB[0] + axeB[2]) / 2, (axeB[1] + axeB[3]) / 2]);
  const courant = [milieuB[0] + alignement.x, milieuB[1] + alignement.y];
  const [nx, ny] = [-ay / la, ax / la];
  const d = (courant[0] - axeA[0]) * nx + (courant[1] - axeA[1]) * ny;
  return { ...tourne, x: alignement.x - d * nx, y: alignement.y - d * ny };
}

/** Décale B le long du trait de A pour que le point b (repère de B) tombe en face du point a (repère de A). */
export function alignementLeLongDeLAxe(alignement, axeA, a, b) {
  const [ax, ay] = [axeA[2] - axeA[0], axeA[3] - axeA[1]];
  const l = Math.hypot(ax, ay);
  if (!l) return null;
  const [ux, uy] = [ax / l, ay / l];
  const bA = appliquerAlignement(alignement, b);
  const d = (a[0] - bA[0]) * ux + (a[1] - bA[1]) * uy;
  return { ...alignement, x: alignement.x + d * ux, y: alignement.y + d * uy };
}

/**
 * Accroche d'un point p sur des segments [[x1, y1, x2, y2]] : l'extrémité la plus proche à moins de tol (« sommet »),
 * sinon le point le plus proche sur un trait à moins de tol (« ligne », avec le trait). Renvoie null si rien.
 */
export function accrocherSegments(segments, p, tol) {
  let sommet = null;
  let dSommet = tol;
  let ligne = null;
  let dLigne = tol;
  for (const s of segments) {
    for (let k = 0; k < 4; k += 2) {
      const d = Math.hypot(s[k] - p[0], s[k + 1] - p[1]);
      if (d < dSommet) {
        dSommet = d;
        sommet = { type: 'sommet', point: [s[k], s[k + 1]], segment: s };
      }
    }
    const [dx, dy] = [s[2] - s[0], s[3] - s[1]];
    const n = dx * dx + dy * dy;
    if (!n) continue;
    const t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / n));
    const q = [s[0] + t * dx, s[1] + t * dy];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < dLigne) {
      dLigne = d;
      ligne = { type: 'ligne', point: q, segment: s };
    }
  }
  return sommet ?? ligne;
}

/**
 * Parties des traits `segments` ([x1, y1, x2, y2], unités du plan) qui ne sont PAS couvertes par l'encre de l'autre plan
 * (masque dilaté à la tolérance, w × h pixels, k pixels par unité). Renvoie les morceaux à dessiner en vectoriel :
 * [[x1, y1, x2, y2]] (même unités). Un morceau = suite d'échantillons non couverts (pas de 1 pixel).
 */
export function morceauxDifferents(segments, masqueAutre, w, h, k) {
  const sortie = [];
  const couvert = (x, y) => {
    const px = Math.round(x * k);
    const py = Math.round(y * k);
    if (px < 0 || py < 0 || px >= w || py >= h) return true; // hors page : pas une différence
    return masqueAutre[py * w + px] === 1;
  };
  for (const s of segments) {
    const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
    const n = Math.max(1, Math.ceil(L * k));
    let debut = null;
    let fin = null;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = s[0] + t * (s[2] - s[0]);
      const y = s[1] + t * (s[3] - s[1]);
      if (!couvert(x, y)) {
        if (!debut) debut = [x, y];
        fin = [x, y];
      } else if (debut) {
        sortie.push([debut[0], debut[1], fin[0], fin[1]]);
        debut = null;
      }
    }
    if (debut) sortie.push([debut[0], debut[1], fin[0], fin[1]]);
  }
  return sortie.filter((m) => Math.hypot(m[2] - m[0], m[3] - m[1]) > 0);
}
