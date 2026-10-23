// Dessin des plans DXF en fond de plan, sur un « canvas » (une image que l'on dessine d'un coup).
// Avec des milliers d'objets, c'est bien plus rapide que des objets SVG (version 0.51.0 : le plan
// saccadait avec un gros DXF) :
// - les objets sont rangés une fois par couleur, avec leur rectangle englobant (préparation en cache) ;
// - à chaque dessin, on ne trace que les objets visibles à l'écran (les autres sont sautés), et pas
//   ceux qui feraient moins d'un demi-pixel ;
// - textes de moins de 3 pixels de haut : pas dessinés (illisibles).
// Pendant un geste (glisser, pincer), l'image est seulement déplacée / agrandie (voir plan.js).

// Couleur d'un plan au choix (liste des plans) : '' = ses couleurs d'AutoCAD, sinon une seule
// couleur pour tout le plan (pour distinguer un plan de bordures d'un plan de terrassement…).
export const COULEURS_PLANS = [
  ['', 'Couleurs DXF'],
  ['#dc2626', 'Rouge'],
  ['#2563eb', 'Bleu'],
  ['#16a34a', 'Vert'],
  ['#ea580c', 'Orange'],
  ['#7c3aed', 'Violet'],
  ['#0891b2', 'Cyan'],
  ['#a16207', 'Brun'],
  ['#6b7280', 'Gris'],
  ['#000000', 'Noir'],
];

// Taille minimale d'un objet à l'écran pour le dessiner (pixels).
const TAILLE_MINIMALE = 0.5;
// Hauteur minimale d'un texte à l'écran pour l'écrire (pixels).
const TEXTE_MINIMAL = 3;
const ALIGNEMENTS = ['left', 'center', 'right'];
const LIGNES_DE_BASE = ['alphabetic', 'bottom', 'middle', 'top'];

// Préparation de chaque plan (objets rangés par couleur), refaite seulement si le plan, ses
// calques visibles ou sa couleur changent.
const preparations = new WeakMap();

/**
 * Objets d'un plan à dessiner, rangés par couleur : { traits: Map(couleur -> [objet]), pleins,
 * cercles, textes: [objet] }. Chaque trait reçoit son rectangle englobant (m, repère du plan).
 */
function preparer(plan) {
  const cle = `${plan.couleur || ''}|${plan.calques.map((c) => (c.visible ? 1 : 0)).join('')}`;
  const enCache = preparations.get(plan);
  if (enCache?.cle === cle) return enCache;
  const visible = (objet) => plan.calques[objet.c]?.visible !== false;
  // Couleur unique du plan (choisie dans la liste des plans), sinon celle d'AutoCAD.
  const couleur = (objet) => plan.couleur || objet.k || plan.calques[objet.c]?.couleur || '#000000';
  const ranger = (liste, objet, extra) => {
    const teinte = couleur(objet);
    if (!liste.has(teinte)) liste.set(teinte, []);
    liste.get(teinte).push({ ...objet, ...extra });
  };
  const { traits = [], cercles = [], pleins = [], textes = [] } = plan.contenu ?? {};
  const preparation = { cle, traits: new Map(), pleins: new Map(), cercles: new Map(), textes: [] };
  for (const trait of traits) if (visible(trait)) ranger(preparation.traits, trait, englobant(trait.p));
  for (const plein of pleins) if (visible(plein)) ranger(preparation.pleins, plein, englobant(plein.p));
  for (const cercle of cercles) {
    if (visible(cercle)) ranger(preparation.cercles, cercle, { xMin: cercle.x - cercle.r, yMin: cercle.y - cercle.r, xMax: cercle.x + cercle.r, yMax: cercle.y + cercle.r });
  }
  for (const texte of textes) if (visible(texte)) preparation.textes.push({ ...texte, teinte: couleur(texte) });
  preparations.set(plan, preparation);
  return preparation;
}

/** Rectangle englobant d'une suite de coordonnées [x, y, x, y…] (m). */
export function englobant(p) {
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
  return { xMin, yMin, xMax, yMax };
}

/**
 * Vrai si l'objet (rectangle englobant) touche la zone visible et fait au moins un demi-pixel.
 * zone : rectangle visible dans le repère du plan (m) ; echelle : pixels par mètre.
 */
export function aDessiner(objet, zone, echelle) {
  if (objet.xMax < zone.xMin || objet.xMin > zone.xMax || objet.yMax < zone.yMin || objet.yMin > zone.yMax) return false;
  return Math.max(objet.xMax - objet.xMin, objet.yMax - objet.yMin) * echelle >= TAILLE_MINIMALE;
}

/**
 * Dessine les plans DXF sur le canvas. vue : { echelle (px/m), estCentre, nordCentre, largeur,
 * hauteur } (voir vue.js) ; densite : pixels de l'écran par pixel CSS. Seuls les plans visibles
 * (plan.visible !== false) sont dessinés.
 */
export function dessinerPlansDxf(canvas, plans, vue, densite = 1) {
  const largeur = Math.round(vue.largeur * densite);
  const hauteur = Math.round(vue.hauteur * densite);
  if (canvas.width !== largeur || canvas.height !== hauteur) {
    canvas.width = largeur;
    canvas.height = hauteur;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, largeur, hauteur);
  const e = vue.echelle;
  for (const plan of plans) {
    if (plan.visible === false || !plan.contenu) continue;
    const preparation = preparer(plan);
    // Position de l'origine du plan à l'écran (px CSS), puis zone visible dans le repère du plan.
    const tx = vue.largeur / 2 + (plan.origine.est - vue.estCentre) * e;
    const ty = vue.hauteur / 2 - (plan.origine.nord - vue.nordCentre) * e;
    const zone = { xMin: -tx / e, xMax: (vue.largeur - tx) / e, yMin: (ty - vue.hauteur) / e, yMax: ty / e };
    // Repère du plan (m, nord vers le haut) -> pixels de l'écran.
    ctx.setTransform(densite * e, 0, 0, -densite * e, densite * tx, densite * ty);
    ctx.lineWidth = 1 / e; // 1 pixel, quel que soit le zoom
    ctx.lineJoin = 'round';
    for (const [teinte, liste] of preparation.pleins) {
      ctx.beginPath();
      for (const plein of liste) {
        if (!aDessiner(plein, zone, e)) continue;
        const p = plein.p;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.closePath();
      }
      ctx.fillStyle = teinte;
      ctx.fill();
    }
    for (const [teinte, liste] of preparation.traits) {
      ctx.beginPath();
      for (const trait of liste) {
        if (!aDessiner(trait, zone, e)) continue;
        const p = trait.p;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        if (trait.f) ctx.closePath();
      }
      ctx.strokeStyle = teinte;
      ctx.stroke();
    }
    for (const [teinte, liste] of preparation.cercles) {
      ctx.beginPath();
      for (const cercle of liste) {
        if (!aDessiner(cercle, zone, e)) continue;
        ctx.moveTo(cercle.x + cercle.r, cercle.y);
        ctx.arc(cercle.x, cercle.y, cercle.r, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = teinte;
      ctx.stroke();
    }
    // Textes : écrits droit, à leur angle, s'ils sont assez grands et à l'écran.
    for (const texte of preparation.textes) {
      const taille = texte.h * e;
      if (taille < TEXTE_MINIMAL) continue;
      const x = tx + texte.x * e;
      const y = ty - texte.y * e;
      if (x < -taille * 20 || x > vue.largeur + taille * 20 || y < -taille * 2 || y > vue.hauteur + taille * 2) continue;
      ctx.setTransform(densite, 0, 0, densite, densite * x, densite * y);
      if (texte.a) ctx.rotate((-texte.a * Math.PI) / 180);
      ctx.font = `${taille}px sans-serif`;
      ctx.textAlign = ALIGNEMENTS[texte.ah] ?? 'left';
      ctx.textBaseline = LIGNES_DE_BASE[texte.av] ?? 'alphabetic';
      ctx.fillStyle = texte.teinte;
      ctx.fillText(texte.t, 0, 0);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
