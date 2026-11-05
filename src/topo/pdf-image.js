/**
 * Plan PDF scanné (0.130.0) : la page devient une image posée en fond, comme un plan DXF.
 *
 * Un PDF scanné ou photographié n'a pas de traits, seulement une image. On « photographie » la
 * page (voir import/pdf.js, imageDeLaPage) et on range l'image dans le contenu d'un plan
 * (plan.contenu.image) : elle suit le plan partout (affichage, transparence, Drive, historique)
 * et se recale avec lui (topo/recalage.js) ; on la recale avec l'accroche « Manuel » (loupe).
 *
 * Repère du plan : le coin en bas à gauche de la page est en (0, 0), x vers la droite, y vers le
 * haut, en mètres : largeur = largeur de la feuille × échelle du plan (sans échelle : la feuille).
 */
import { POINT_PDF_EN_M } from './pdf-dxf.js';

/** Netteté de l'image : points par pouce (dpi). « Normale » au départ (validé le 05.11). */
export const NETTETES = [
  ['legere', 'Légère', 100],
  ['normale', 'Normale', 150],
  ['fine', 'Fine', 250],
];
export const NETTETE_DEPART = 'normale';

/** Nombre de pixels au plus (une tablette ne sait pas faire une image plus grande). */
export const PIXELS_MAX = 12_000_000;

/**
 * Agrandissement de la page pour la photographier (1 = 72 dpi) : la netteté choisie, réduite
 * si l'image dépasse PIXELS_MAX. Renvoie { facteur, reduite (vrai si on a dû réduire), dpi }.
 */
export function facteurDeRendu(largeurPt, hauteurPt, nettete = NETTETE_DEPART) {
  const dpiVoulu = (NETTETES.find(([cle]) => cle === nettete) ?? NETTETES[1])[2];
  let facteur = dpiVoulu / 72;
  const pixels = largeurPt * hauteurPt * facteur * facteur;
  const reduite = pixels > PIXELS_MAX;
  if (reduite) facteur = Math.sqrt(PIXELS_MAX / (largeurPt * hauteurPt));
  return { facteur, reduite, dpi: Math.round(facteur * 72) };
}

/**
 * Plan (même forme qu'un plan DXF lu) qui contient seulement l'image de la page.
 * - largeurPt, hauteurPt : taille de la page (points PDF) ;
 * - echelle : 500 pour 1:500, null = taille de la feuille ;
 * - donnees : l'image (adresse « data:image/jpeg;base64,… ») ; pixels : { largeur, hauteur }.
 */
export function planImagePdf({ nom, largeurPt, hauteurPt, echelle = null, donnees, pixels }) {
  const facteur = POINT_PDF_EN_M * (echelle ?? 1);
  const largeur = Math.round(largeurPt * facteur * 1000) / 1000;
  const hauteur = Math.round(hauteurPt * facteur * 1000) / 1000;
  return {
    nom,
    origine: { est: 0, nord: 0 },
    bornes: { estMin: 0, nordMin: 0, estMax: largeur, nordMax: hauteur },
    calques: [{ nom: 'PDF_IMAGE', couleur: '#000000', visible: true }],
    contenu: {
      traits: [],
      pleins: [],
      cercles: [],
      textes: [],
      points: [],
      image: { donnees, largeur, hauteur, pixels },
    },
    compte: { objets: 1, ignores: {} },
  };
}

/**
 * Les 4 coins de l'image dans le repère du plan, une fois la matrice appliquée
 * ([a, b, c, d, e, f] : x' = a·x + c·y + e, y' = b·x + d·y + f ; aucune = image telle quelle).
 */
export function coinsDeLImage(image) {
  const [a, b, c, d, e, f] = image.matrice ?? [1, 0, 0, 1, 0, 0];
  return [[0, 0], [image.largeur, 0], [image.largeur, image.hauteur], [0, image.hauteur]]
    .map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
}
