/**
 * Plan PDF → texte DXF (0.129.0).
 *
 * Un PDF « vectoriel » (exporté d'AutoCAD, de Mensura…) contient ses traits sous forme de chemins :
 * « aller à », « ligne vers », « courbe vers », « fermer ». On les lit (voir import/pdf.js), puis on
 * les écrit ici en DXF texte pour qu'ils passent par le même lecteur que les plans DXF : affichage,
 * accroche, recalage, export du DXF recalé et Drive marchent alors comme pour un DXF.
 *
 * Unités : le PDF compte en « points » (1 point = 1/72 de pouce = 0,3528 mm sur la feuille).
 * Avec l'échelle du plan (1:500 → 500), 1 point = 0,0254 ÷ 72 × 500 m sur le terrain.
 * Le plan n'est pas en MN95 : il faut ensuite le recaler (étapes du recalage).
 */

/** Longueur d'un point PDF sur la feuille, en mètres. */
export const POINT_PDF_EN_M = 0.0254 / 72;

/** Nombre de segments droits pour remplacer une courbe (Bézier) du PDF. */
const SEGMENTS_COURBE = 8;

/** Codes des morceaux d'un chemin de pdf.js (DrawOPS). */
export const MORCEAUX = { allerA: 0, ligneVers: 1, courbeVers: 2, courbeQuadVers: 3, fermer: 4 };

/** Calques utilisés quand le PDF n'a pas de calques à lui. */
export const CALQUE_TRAITS = 'PDF_TRAITS';
export const CALQUE_REMPLIS = 'PDF_REMPLIS';
export const CALQUE_TEXTES = 'PDF_TEXTES';

// ---------------------------------------------------------------------------------------------
// Matrices [a, b, c, d, e, f] : un point (x, y) devient (a·x + c·y + e, b·x + d·y + f).

export const IDENTITE = [1, 0, 0, 1, 0, 0];

/** Matrice qui applique d'abord "m2" puis "m1". */
export function multiplier(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Point (x, y) transformé par la matrice "m". */
export function appliquer(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// ---------------------------------------------------------------------------------------------
// Chemins

/** Points d'une courbe de Bézier cubique, sans le point de départ. */
function pointsCourbe([x0, y0], [x1, y1], [x2, y2], [x3, y3]) {
  const points = [];
  for (let i = 1; i <= SEGMENTS_COURBE; i++) {
    const t = i / SEGMENTS_COURBE;
    const u = 1 - t;
    points.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
  return points;
}

/** Ajoute un point s'il n'est pas le même que le dernier. */
function ajouterPoint(points, point) {
  const dernier = points[points.length - 1];
  if (!dernier || Math.abs(dernier[0] - point[0]) > 1e-9 || Math.abs(dernier[1] - point[1]) > 1e-9) points.push(point);
}

/**
 * Découpe un chemin de pdf.js (suite de nombres : code puis coordonnées) en traits.
 * "matrice" : transformation vers la page (points PDF, y vers le haut).
 * Renvoie [{ points: [[x, y], ...], ferme }] (au moins 2 points chacun ; courbes en segments droits).
 */
export function traitsDuChemin(donnees, matrice = IDENTITE) {
  const traits = [];
  let courant = null; // { points, ferme }
  let position = null; // dernier point, avant transformation
  const finir = () => {
    if (courant && courant.points.length >= 2) traits.push(courant);
    courant = null;
  };
  const versPage = ([x, y]) => appliquer(matrice, x, y);
  for (let i = 0; i < donnees.length;) {
    const code = donnees[i++];
    if (code === MORCEAUX.allerA) {
      finir();
      position = [donnees[i], donnees[i + 1]];
      i += 2;
      courant = { points: [versPage(position)], ferme: false };
    } else if (code === MORCEAUX.ligneVers) {
      position = [donnees[i], donnees[i + 1]];
      i += 2;
      courant ??= { points: [], ferme: false };
      ajouterPoint(courant.points, versPage(position));
    } else if (code === MORCEAUX.courbeVers) {
      const c1 = [donnees[i], donnees[i + 1]];
      const c2 = [donnees[i + 2], donnees[i + 3]];
      const fin = [donnees[i + 4], donnees[i + 5]];
      i += 6;
      courant ??= { points: [], ferme: false };
      for (const p of pointsCourbe(position ?? c1, c1, c2, fin)) ajouterPoint(courant.points, versPage(p));
      position = fin;
    } else if (code === MORCEAUX.courbeQuadVers) {
      // Courbe à 1 point de contrôle : on la récrit en courbe à 2 points de contrôle.
      const depart = position ?? [donnees[i], donnees[i + 1]];
      const c = [donnees[i], donnees[i + 1]];
      const fin = [donnees[i + 2], donnees[i + 3]];
      i += 4;
      const c1 = [depart[0] + (2 / 3) * (c[0] - depart[0]), depart[1] + (2 / 3) * (c[1] - depart[1])];
      const c2 = [fin[0] + (2 / 3) * (c[0] - fin[0]), fin[1] + (2 / 3) * (c[1] - fin[1])];
      courant ??= { points: [], ferme: false };
      for (const p of pointsCourbe(depart, c1, c2, fin)) ajouterPoint(courant.points, versPage(p));
      position = fin;
    } else if (code === MORCEAUX.fermer) {
      if (courant) {
        // Dernier point = premier : on l'enlève, le trait est simplement « fermé ».
        const [premier] = courant.points;
        const dernier = courant.points[courant.points.length - 1];
        if (courant.points.length > 2 && Math.abs(premier[0] - dernier[0]) < 1e-9 && Math.abs(premier[1] - dernier[1]) < 1e-9) courant.points.pop();
        courant.ferme = courant.points.length > 2;
        const debut = courant.points[0];
        finir();
        // Après « fermer », on repart du premier point du trait.
        courant = debut ? { points: [debut], ferme: false } : null;
      }
    } else {
      break; // code inconnu : on s'arrête là pour ce chemin
    }
  }
  finir();
  return traits;
}

// ---------------------------------------------------------------------------------------------
// Échelle

/**
 * Lit l'échelle tapée : « 500 », « 1:500 », « 1/500 », « 1 : 1000 ».
 * Vide → null (pas d'échelle : le recalage la trouvera). Renvoie { echelle } ou { erreur }.
 */
export function lireEchelle(texte) {
  const propre = String(texte ?? '').replace(/\s+/g, '').replace(/'/g, '');
  if (propre === '') return { echelle: null };
  const nombre = Number(propre.replace(/^1[:/]/, '').replace(',', '.'));
  if (!Number.isFinite(nombre) || nombre <= 0 || nombre > 1000000) return { erreur: `échelle « ${texte} » pas comprise (exemple : 500 pour 1:500)` };
  return { echelle: nombre };
}

// ---------------------------------------------------------------------------------------------
// Écriture DXF

/** Nom de calque accepté par AutoCAD (sans < > / \ " : ; ? * | = `). */
export function nomDeCalque(nom) {
  const propre = String(nom ?? '').replace(/[<>/\\":;?*|=`\r\n]/g, '_').trim();
  return propre || CALQUE_TRAITS;
}

/** Couleur « #rrggbb » → nombre de la couleur vraie DXF (code 420), ou null. */
function couleurVraie(couleur) {
  if (typeof couleur !== 'string' || !/^#[0-9a-f]{6}$/i.test(couleur)) return null;
  return parseInt(couleur.slice(1), 16);
}

/** Nombre écrit avec 4 décimales au plus (le lecteur arrondit ensuite au millimètre). */
const nb = (v) => String(Math.round(v * 10000) / 10000);

/** Texte d'un TEXT DXF : une seule ligne, sans caractères de contrôle. */
const texteSurUneLigne = (t) => String(t).replace(/[\r\n\t]+/g, ' ').trim();

/**
 * Écrit le contenu lu d'une page PDF en DXF texte.
 * - "traits" : [{ points (points PDF), ferme, calque, couleur ('#rrggbb' ou null), rempli }]
 * - "textes" : [{ x, y, hauteur, angle (degrés), texte }] (points PDF)
 * - "calques" : [{ nom, visible }] (calques du PDF, dans l'ordre)
 * - "echelle" : 500 pour un plan au 1:500, null = coordonnées de la feuille en mètres.
 */
export function dxfDuPdf({ traits = [], textes = [], calques = [] }, echelle = null) {
  const facteur = POINT_PDF_EN_M * (echelle ?? 1);
  const m = (v) => nb(v * facteur);

  // Calques : ceux du PDF, puis ceux de départ s'ils servent ; couleur = premier trait du calque.
  const couleurDuCalque = new Map();
  for (const trait of traits) {
    const nom = nomDeCalque(trait.calque);
    if (!couleurDuCalque.has(nom) && trait.couleur) couleurDuCalque.set(nom, trait.couleur);
  }
  const listeCalques = [];
  const vus = new Set();
  const ajouterCalque = (nom, visible = true) => {
    const propre = nomDeCalque(nom);
    if (vus.has(propre)) return;
    vus.add(propre);
    listeCalques.push({ nom: propre, visible });
  };
  for (const calque of calques) ajouterCalque(calque.nom, calque.visible !== false);
  for (const trait of traits) ajouterCalque(trait.calque);
  if (textes.length > 0) ajouterCalque(CALQUE_TEXTES);

  const sortie = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER'];
  for (const { nom, visible } of listeCalques) {
    const vraie = couleurVraie(couleurDuCalque.get(nom));
    // Couleur négative = calque éteint (comme dans AutoCAD).
    sortie.push('0', 'LAYER', '2', nom, '70', '0', '62', visible ? '7' : '-7');
    if (vraie !== null) sortie.push('420', String(vraie));
  }
  sortie.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  for (const trait of traits) {
    if (trait.points.length < 2) continue;
    const calque = nomDeCalque(trait.calque);
    sortie.push('0', 'LWPOLYLINE', '8', calque);
    const vraie = couleurVraie(trait.couleur);
    if (vraie !== null) sortie.push('420', String(vraie));
    sortie.push('90', String(trait.points.length), '70', trait.ferme ? '1' : '0');
    for (const [x, y] of trait.points) sortie.push('10', m(x), '20', m(y));
  }
  for (const texte of textes) {
    const contenu = texteSurUneLigne(texte.texte);
    if (!contenu) continue;
    sortie.push('0', 'TEXT', '8', CALQUE_TEXTES, '10', m(texte.x), '20', m(texte.y), '40', m(Math.max(texte.hauteur, 0.1)), '1', contenu);
    if (Math.abs(texte.angle ?? 0) > 0.001) sortie.push('50', nb(texte.angle));
  }
  sortie.push('0', 'ENDSEC', '0', 'EOF');
  return sortie.join('\n');
}
