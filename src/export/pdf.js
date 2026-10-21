// Export PDF : une feuille paysage (A4, ou A3 si le plan ne tient pas en A4 à l'échelle choisie)
// avec le plan à l'échelle, les volumes et un cartouche,
// puis une feuille par calcul limité au contour d'une surface (remblai / déblai en couleurs).
// Les photos des surfaces se placent dans la colonne de droite, sous la légende (sur une feuille
// à part seulement s'il n'y a pas la place).
// Le plan est dessiné en traits (vectoriel) : il reste net à l'impression et au zoom.
// Toutes les mesures sur la feuille sont en millimètres.
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { placerEtiquettes, pointInterieur } from '../plan/etiquettes.js';
import { choisirEchelle, barreEchellePapier, choisirFormat, miseEnPage } from './echelle.js';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';
import { couleurRVB } from '../plan/couleurs.js';
import { zonesRemblaiDeblai } from '../plan/ecarts.js';
import { FONDS, FONDS_SECOURS, niveauDeZoom, tuilesPourZone } from '../plan/fond.js';
import { grouperParNature } from '../volumes/calculs.js';
import { preparerDessinCoupe, texteEchellesCoupe } from '../coupes/dessin.js';
import { longueurCoupe } from '../topo/coupe.js';
// Logo Perrin, dans le fichier PDF (image JPEG de 406 × 104 pixels, écrite dans le code).
import logoPerrin from '../assets/logo-perrin.jpg?inline';

// Calques du plan imprimé, et leur état par défaut.
export const CALQUES_PDF = {
  triangles: true,
  noms: true,
  altitudes: false,
  ecarts: true,
  photos: true,
  courbes: false,
  couleurs: false,
  photo: false,
  photoAttenuee: true,
  cadastre: false,
};
// Résolution de la photo aérienne dans le PDF (points par pouce).
const DPI_FOND = 150;

// Cartouche en bas de la colonne : le logo (case de 12 mm), puis 6 lignes de 6 mm.
const HAUTEUR_LOGO_CARTOUCHE = 12;
const LOGO = { hauteur: 8, largeur: (8 * 406) / 104 }; // mm, proportions de l'image
const LIGNES_CARTOUCHE = 6;
const HAUTEUR_LIGNE_CARTOUCHE = 6;

// Mise en page de la feuille en cours (voir appliquerFormat) : feuille, cadre du plan,
// colonne de droite et haut du cartouche (mm). A4 paysage par défaut : 297 × 210 mm.
let PAGE;
let CADRE_PLAN;
let COLONNE;
let Y_CARTOUCHE;

/** Prend la mise en page d'un format de feuille ('a4' ou 'a3'), pour les dessins qui suivent. */
function appliquerFormat(format) {
  const mise = miseEnPage(format);
  PAGE = mise.page;
  CADRE_PLAN = mise.cadrePlan;
  COLONNE = mise.colonne;
  Y_CARTOUCHE = PAGE.hauteur - PAGE.marge - 2 - HAUTEUR_LOGO_CARTOUCHE - LIGNES_CARTOUCHE * HAUTEUR_LIGNE_CARTOUCHE;
}
appliquerFormat('a4');

const COULEURS = {
  texte: [27, 43, 54],
  gris: [95, 109, 119],
  ambre: [246, 171, 7],
  contour: [220, 38, 38],
  ligne: [234, 88, 12],
  triangle: [170, 178, 184],
};

/**
 * Crée le document PDF.
 * - stocks, resultats : calculs de volume de la feuille principale : surface 1 (nom = nom du calcul,
 *   description = phrase qui décrit le calcul) et volume (voir calculerVolumeSurface)
 * - points : tous les points importés
 * - cartouche : { affaire, date, dessinePar, fichierPoints }
 * - echelleImposee : dénominateur de l'échelle voulue (500 pour 1:500), ou null pour la choisir
 *   automatiquement (la plus détaillée qui fait tout tenir sur une A4). Avec une échelle imposée,
 *   la feuille passe en A3 si le plan ne tient pas en A4 ; s'il dépasse encore, il est coupé
 *   au cadre et un avertissement est renvoyé. Le plan est toujours centré sur les surfaces.
 * - calques : calques à imprimer (voir CALQUES_PDF)
 * - comparaisons : calculs dans le contour d'une surface, liste de { nom, description, resultat } (voir
 *   comparerSurfaces) : ajoutés sous le tableau des volumes, puis une feuille chacun
 * - photos : liste de { surface (nom), legende, date (ISO), image (JPEG), largeur, hauteur }, à placer
 *   sous la légende de la première feuille
 * - coupes : coupes à imprimer [{ nom, debut, fin, exageration, profils: [{ nom, nature, lignes }] }] :
 *   leur trait sur le plan, et une feuille « Coupes » (A4)
 * Renvoie (après chargement éventuel de la photo aérienne)
 * { document, echelle, format, messageFond } : document jsPDF, échelle utilisée, format de la
 * première feuille ('a4' ou 'a3'), et un message (fond non mis, plan coupé...) ou null.
 */
export async function creerPdf({ stocks, resultats, points, cartouche, echelleImposee = null, calques = {}, comparaisons = [], photos = [], coupes = [] }) {
  const choix = { ...CALQUES_PDF, ...calques };
  // Remblai / déblai et couleurs selon l'altitude ne se lisent pas l'un sur l'autre.
  if (choix.ecarts) choix.couleurs = false;
  const messages = [];
  // Le document est créé avec sa première feuille, dont le format dépend du plan.
  let doc = null;
  let premierFormat = null;
  const nouvelleFeuille = (format) => {
    appliquerFormat(format);
    if (!doc) {
      doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
      doc.setFont('helvetica', 'normal');
      premierFormat = format;
    } else {
      doc.addPage(format, 'landscape');
    }
  };
  /** Format de la feuille d'un plan (A4, sinon A3), et avertissement si le plan dépasse même l'A3. */
  const formatDuPlan = (zone) => {
    if (!zone) return 'a4';
    const { format, depasse } = choisirFormat(zone.estMax - zone.estMin, zone.nordMax - zone.nordMin, echelleImposee);
    const alerte = `à l'échelle 1:${echelleImposee}, le plan dépasse la feuille A3 : il est coupé au cadre (choisis une échelle plus petite)`;
    if (depasse && !messages.includes(alerte)) messages.push(alerte);
    return format;
  };

  const calcules = stocks.map((stock, i) => ({ stock, resultat: resultats[i] })).filter(({ resultat }) => resultat && !resultat.erreurs);
  const comparaisonsCalculees = comparaisons.filter(({ resultat }) => resultat && !resultat.erreurs && resultat.trianglesEcart?.length > 0);
  let echelle = null;
  // Photos encore à placer : sous la légende de la première feuille si elles y tiennent.
  let photosAPlacer = choix.photos ? photos : [];
  const placerPhotos = (yLibre) => {
    if (photosAPlacer.length > 0 && dessinerPhotosColonne(doc, photosAPlacer, yLibre)) photosAPlacer = [];
  };

  // Feuille des volumes (sauf s'il n'y a que des comparaisons)
  if (calcules.length > 0 || comparaisonsCalculees.length === 0) {
    const contenu = contenuDuPlan(calcules, points, coupes);
    nouvelleFeuille(formatDuPlan(contenu.zone));
    dessinerCadres(doc);
    const plan = await dessinerPlan(doc, calcules, contenu, echelleImposee, choix, coupes);
    const yLibre = dessinerColonne(doc, calcules, { ...cartouche, echelle: plan.echelle }, { choix, relief: plan.relief, ecarts: plan.legendeEcarts, comparaisons });
    placerPhotos(yLibre);
    echelle = plan.echelle;
    if (plan.messageFond) messages.push(plan.messageFond);
  }

  // Une feuille par calcul dans un contour : remblai (rouge) et déblai (jaune)
  for (const comparaison of comparaisonsCalculees) {
    nouvelleFeuille(formatDuPlan(zoneDe(comparaison.resultat.trianglesEcart.flat())));
    dessinerCadres(doc);
    const page = await dessinerPageComparaison(doc, comparaison, cartouche, echelleImposee, choix);
    placerPhotos(page.yLibre);
    echelle ??= page.echelle;
    if (page.messageFond && !messages.includes(page.messageFond)) messages.push(page.messageFond);
  }
  // Feuille des coupes (A4)
  const coupesDessinables = coupes.filter((coupe) => coupe.profils.some((p) => p.lignes.length > 0));
  if (coupesDessinables.length > 0) {
    nouvelleFeuille('a4');
    dessinerPageCoupes(doc, coupesDessinables, cartouche);
  }
  // Photos qui ne tiennent pas dans la colonne : 4 par feuille, à la suite
  for (let debut = 0; debut < photosAPlacer.length; debut += PHOTOS_PAR_PAGE) {
    nouvelleFeuille('a4');
    dessinerPagePhotos(doc, photosAPlacer.slice(debut, debut + PHOTOS_PAR_PAGE), cartouche);
  }
  return { document: doc, echelle, format: premierFormat, messageFond: messages.join(' ; ') || null };
}

/** Zone du terrain couverte par des points { est, nord } : { estMin, estMax, nordMin, nordMax } (m), ou null. */
function zoneDe(sommets) {
  if (sommets.length === 0) return null;
  const ests = sommets.map((p) => p.est);
  const nords = sommets.map((p) => p.nord);
  return { estMin: Math.min(...ests), estMax: Math.max(...ests), nordMin: Math.min(...nords), nordMax: Math.max(...nords) };
}

const PHOTOS_PAR_PAGE = 4;
const HAUTEUR_TEXTE_PHOTO = 3.2; // mm, sous chaque photo de la colonne
const HAUTEUR_MIN_PHOTO = 14; // mm : en dessous, les photos vont sur une feuille à part

/**
 * Place des photos dans une zone (mm) en les gardant le plus grandes possible : essaie 1, 2, 3...
 * colonnes et garde la disposition où la plus petite photo est la plus grande.
 * - photos : liste de { largeur, hauteur } (pixels, pour les proportions)
 * - zone : { x, y, largeur, hauteur } (mm)
 * Renvoie la position de chaque photo [{ x, y, largeur, hauteur }] (mm), ou null si elles
 * seraient trop petites (moins de HAUTEUR_MIN_PHOTO de haut).
 */
export function disposerPhotos(photos, zone, hauteurTexte = HAUTEUR_TEXTE_PHOTO, ecart = 2) {
  let meilleure = null;
  for (let colonnes = 1; colonnes <= photos.length; colonnes++) {
    const rangees = Math.ceil(photos.length / colonnes);
    const largeurCase = (zone.largeur - (colonnes - 1) * ecart) / colonnes;
    const hauteurCase = (zone.hauteur - (rangees - 1) * ecart) / rangees - hauteurTexte;
    if (largeurCase <= 0 || hauteurCase <= 0) continue;
    const cases = photos.map((photo, i) => {
      const facteur = Math.min(largeurCase / photo.largeur, hauteurCase / photo.hauteur);
      const largeur = photo.largeur * facteur;
      const hauteur = photo.hauteur * facteur;
      return {
        x: zone.x + (i % colonnes) * (largeurCase + ecart) + (largeurCase - largeur) / 2,
        y: zone.y + Math.floor(i / colonnes) * (hauteurCase + hauteurTexte + ecart),
        largeur,
        hauteur,
      };
    });
    const plusPetite = Math.min(...cases.map((c) => c.largeur * c.hauteur));
    if (!meilleure || plusPetite > meilleure.plusPetite) meilleure = { cases, plusPetite };
  }
  if (!meilleure || Math.min(...meilleure.cases.map((c) => c.hauteur)) < HAUTEUR_MIN_PHOTO) return null;
  return meilleure.cases;
}

/**
 * Photos dans la colonne de droite, entre "yHaut" (fin de la légende) et le cartouche.
 * Renvoie vrai si elles y tiennent (sinon rien n'est dessiné).
 */
function dessinerPhotosColonne(doc, photos, yHaut) {
  const zone = { x: COLONNE.x, y: yHaut + 4, largeur: COLONNE.largeur, hauteur: Y_CARTOUCHE - 3 - (yHaut + 4) };
  const cases = zone.hauteur > 0 ? disposerPhotos(photos, zone) : null;
  if (!cases) return false;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.texte);
  doc.text('Photos', COLONNE.x, yHaut + 2.5);
  photos.forEach((photo, i) => {
    const { x, y, largeur, hauteur } = cases[i];
    doc.addImage(photo.image, 'JPEG', x, y, largeur, hauteur);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    const texte = [photo.surface, photo.legende].filter(Boolean).join(' - ');
    doc.text(doc.splitTextToSize(texte, largeur)[0], x, y + hauteur + 2.3);
  });
  return true;
}

/** Feuille de photos : titre, puis 2 × 2 photos avec leur légende (surface et légende). */
function dessinerPagePhotos(doc, photos, cartouche) {
  trait(doc, COULEURS.texte, 0.4);
  doc.rect(PAGE.marge, PAGE.marge, PAGE.largeur - 2 * PAGE.marge, PAGE.hauteur - 2 * PAGE.marge);
  doc.setTextColor(...COULEURS.texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Photos', 14, 17);
  doc.setFillColor(...COULEURS.ambre);
  doc.rect(14, 19, 24, 0.9, 'F');
  // Rappel de l'affaire et de la date en haut à droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COULEURS.gris);
  const entete = [cartouche.affaire ? `Affaire ${cartouche.affaire}` : null, cartouche.date || null].filter(Boolean).join(' · ');
  doc.text(entete, PAGE.largeur - 14, 17, { align: 'right' });

  // Grille 2 × 2 : chaque photo garde ses proportions dans sa case.
  const zone = { x: 14, y: 25, largeur: PAGE.largeur - 28, hauteur: PAGE.hauteur - 25 - 13 };
  const ecart = 6;
  const largeurCase = (zone.largeur - ecart) / 2;
  const hauteurCase = (zone.hauteur - ecart) / 2;
  const hauteurLegende = 7;
  photos.forEach((photo, i) => {
    const x = zone.x + (i % 2) * (largeurCase + ecart);
    const y = zone.y + Math.floor(i / 2) * (hauteurCase + ecart);
    const facteur = Math.min(largeurCase / photo.largeur, (hauteurCase - hauteurLegende) / photo.hauteur);
    const l = photo.largeur * facteur;
    const h = photo.hauteur * facteur;
    doc.addImage(photo.image, 'JPEG', x + (largeurCase - l) / 2, y, l, h);
    doc.setFontSize(8);
    doc.setTextColor(...COULEURS.texte);
    doc.setFont('helvetica', 'bold');
    const titre = doc.splitTextToSize([photo.surface, photo.legende].filter(Boolean).join(' - '), l)[0];
    doc.text(titre, x + (largeurCase - l) / 2, y + h + 4.5);
    doc.setFont('helvetica', 'normal');
  });
}

/** Cadre général de la feuille et cadre du plan. */
function dessinerCadres(doc) {
  trait(doc, COULEURS.texte, 0.4);
  doc.rect(PAGE.marge, PAGE.marge, PAGE.largeur - 2 * PAGE.marge, PAGE.hauteur - 2 * PAGE.marge);
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur);
}

/**
 * Échelle et passage terrain (m) -> feuille (mm) pour faire tenir la zone dans le cadre du plan.
 * zone = { estMin, estMax, nordMin, nordMax } (m). Le Nord est en haut de la feuille.
 */
function preparerProjection(zone, echelleImposee) {
  const echelle =
    echelleImposee ??
    choisirEchelle(
      zone.estMax - zone.estMin,
      zone.nordMax - zone.nordMin,
      CADRE_PLAN.largeur - 20,
      CADRE_PLAN.hauteur - 30, // place pour la barre d'échelle en bas
    );
  const mmParMetre = 1000 / echelle;
  const centre = { est: (zone.estMin + zone.estMax) / 2, nord: (zone.nordMin + zone.nordMax) / 2 };
  const milieuCadre = { x: CADRE_PLAN.x + CADRE_PLAN.largeur / 2, y: CADRE_PLAN.y + (CADRE_PLAN.hauteur - 10) / 2 };
  return {
    echelle,
    mmParMetre,
    versPapier: (p) => ({
      x: milieuCadre.x + (p.est - centre.est) * mmParMetre,
      y: milieuCadre.y - (p.nord - centre.nord) * mmParMetre,
    }),
    versTerrain: (x, y) => ({
      est: centre.est + (x - milieuCadre.x) / mmParMetre,
      nord: centre.nord - (y - milieuCadre.y) / mmParMetre,
    }),
  };
}

/** Remblai (rouge) et déblai (jaune) par paliers, sous le reste du dessin. Renvoie la légende, ou null. */
function dessinerEcartsPdf(doc, trianglesEcart, versPapier, palier) {
  if (trianglesEcart.length === 0) return null;
  const { zones, legende } = zonesRemblaiDeblai(trianglesEcart, palier);
  // Couleurs pleines (sans transparence) avec un contour de la même couleur : aucun trait
  // ne se voit entre deux morceaux voisins.
  for (const { couleur, polygone } of zones) {
    doc.setFillColor(...couleur);
    trait(doc, couleur, 0.05);
    polygonePlein(doc, polygone.map(versPapier), 'FD');
  }
  return legende;
}

/**
 * Fond swisstopo, puis découpe au cadre du plan.
 * Renvoie { messageFond, sources } : message du fond (ou null) et mentions des fonds dessinés.
 */
async function preparerCadrePlan(doc, projection, choix) {
  let fond = { message: null, sources: [] };
  if (choix.photo || choix.cadastre) fond = await dessinerFondPdf(doc, projection.versTerrain, projection.mmParMetre, choix);
  // Tout ce qui sort du cadre du plan est coupé (utile si l'échelle imposée est trop grande).
  doc.saveGraphicsState();
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur, null);
  doc.clip();
  doc.discardPath();
  return { messageFond: fond.message, sources: fond.sources };
}

/** Après le dessin du plan : fin de la découpe, barre d'échelle, Nord et mention des sources des fonds. */
function terminerCadrePlan(doc, echelle, sources) {
  doc.restoreGraphicsState();
  dessinerBarreEchelle(doc, echelle);
  dessinerNord(doc);
  if (sources.length > 0) {
    // Mention obligatoire de la source du fond
    doc.setFontSize(5.5);
    doc.setTextColor(...COULEURS.texte);
    doc.text(sources.join(' · '), CADRE_PLAN.x + CADRE_PLAN.largeur - 1.5, CADRE_PLAN.y + CADRE_PLAN.hauteur - 1.5, { align: 'right' });
  }
}

/**
 * Feuille d'une comparaison : plan du remblai / déblai (toujours en couleurs) et volumes.
 * Renvoie { echelle, messageFond }.
 */
async function dessinerPageComparaison(doc, { nom, description, resultat }, cartouche, echelleImposee, choix) {
  const projection = preparerProjection(zoneDe(resultat.trianglesEcart.flat()), echelleImposee);
  const { messageFond, sources } = await preparerCadrePlan(doc, projection, choix);
  const legende = dessinerEcartsPdf(doc, resultat.trianglesEcart, projection.versPapier, choix.palier);
  terminerCadrePlan(doc, projection.echelle, sources);

  // Colonne de droite : titre, volumes, légende, cartouche
  const x = COLONNE.x;
  let y = dessinerTitre(doc, 'Volume entre deux surfaces');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(nom, COLONNE.largeur)[0], x, y);
  y += 4.5;
  if (description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COULEURS.gris);
    const texte = doc.splitTextToSize(description, COLONNE.largeur);
    doc.text(texte, x, y);
    y += texte.length * 2.8;
    doc.setTextColor(...COULEURS.texte);
  }
  y += 1.5;
  doc.setFontSize(7.5);
  const lignes = [
    ['Remblai', `${formaterNombre(resultat.remblai)} m³`, true],
    ['Déblai', `${formaterNombre(resultat.deblai)} m³`, true],
    ['Différence (remblai - déblai)', `${formaterNombre(resultat.remblai - resultat.deblai)} m³`, false],
    ['Surface calculée', `${formaterNombre(resultat.surfacePlan)} m²`, false],
  ];
  for (const [titre, valeur, gras] of lignes) {
    doc.setFont('helvetica', 'normal');
    doc.text(titre, x, y);
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    doc.text(valeur, x + COLONNE.largeur - 1, y, { align: 'right' });
    y += 4.6;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.gris);
  const remarques = [];
  if (resultat.surfaceNonCouverte > 0) remarques.push(`${formaterNombre(resultat.surfaceNonCouverte)} m² non couverts par la surface 2 (non comptés).`);
  if (resultat.surfaceZone - resultat.surfacePlan > 0.01) {
    remarques.push(`${formaterNombre(resultat.surfaceZone - resultat.surfacePlan)} m² de la zone non couverts par la surface 1 (non comptés).`);
  }
  y += 1;
  for (const remarque of remarques) {
    const texte = doc.splitTextToSize(remarque, COLONNE.largeur);
    doc.text(texte, x, y);
    y += texte.length * 2.8;
  }
  doc.setTextColor(...COULEURS.texte);
  if (legende) y = dessinerLegendeEcarts(doc, x, y + 3, legende);
  dessinerCartouche(doc, { ...cartouche, echelle: projection.echelle });
  return { echelle: projection.echelle, messageFond, yLibre: y };
}

/**
 * Ce que montre le plan principal : points du levé qui servent aux surfaces calculées (contour,
 * lignes, sommets des triangles), ou tous s'il n'y a aucune surface, et la zone du terrain à
 * dessiner (points montrés et triangles). Renvoie { parNom, pointsMontres, zone } (zone null si vide).
 */
function contenuDuPlan(calcules, points, coupes = []) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const sommets = calcules.flatMap(({ resultat }) => resultat.trianglesDessus.flat());
  const noms = new Set([
    ...calcules.flatMap(({ stock }) => [...(stock.contour ?? []), ...(stock.lignesRupture ?? []).flatMap((l) => l.noms)]),
    ...sommets.filter((p) => parNom.get(p.nom) === p).map((p) => p.nom),
  ]);
  const pointsMontres = noms.size > 0 ? [...noms].map((nom) => parNom.get(nom)).filter(Boolean) : points;
  // Les coupes doivent se voir en entier sur le plan.
  const boutsDesCoupes = coupes.flatMap((coupe) => [coupe.debut, coupe.fin]);
  return { parNom, pointsMontres, zone: zoneDe([...pointsMontres, ...sommets, ...boutsDesCoupes]) };
}

/**
 * Dessine le plan dans son cadre, à l'échelle normalisée qui fait tout tenir (ou imposée),
 * centré sur les surfaces. contenu : voir contenuDuPlan.
 * Renvoie { echelle, messageFond, relief, legendeEcarts } (relief : plage d'altitudes et
 * équidistance ; legendeEcarts : paliers remblai / déblai ; pour les légendes).
 */
async function dessinerPlan(doc, calcules, { parNom, pointsMontres, zone }, echelleImposee, choix, coupes = []) {
  if (!zone) return { echelle: echelleImposee ?? 500, messageFond: null, relief: null, legendeEcarts: null };
  const projection = preparerProjection(zone, echelleImposee);
  const { echelle, versPapier } = projection;
  const { messageFond, sources } = await preparerCadrePlan(doc, projection, choix);

  // Remblai (rouge) / déblai (jaune) par paliers : écart entre le dessus et la base de chaque stock
  const legendeEcarts = choix.ecarts
    ? dessinerEcartsPdf(doc, calcules.flatMap(({ resultat }) => resultat.trianglesEcart ?? []), versPapier, choix.palier)
    : null;

  // Couleurs selon l'altitude et courbes de niveau (surface du dessus des stocks)
  const tousTriangles = calcules.flatMap(({ resultat }) => resultat.trianglesDessus);
  let relief = null;
  if ((choix.couleurs || choix.courbes) && tousTriangles.length > 0) {
    const plage = plageAltitudes(tousTriangles);
    const equidistance = choix.equidistance ?? equidistanceAuto(plage.min, plage.max);
    relief = { plage, equidistance };
    if (choix.couleurs) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.7 }));
      for (const { altitude, polygone } of bandesDeNiveau(tousTriangles, equidistance)) {
        doc.setFillColor(...couleurRVB(altitude + equidistance / 2, plage));
        polygonePlein(doc, polygone.map(versPapier));
      }
      doc.restoreGraphicsState();
    }
    if (choix.courbes) {
      for (const { altitude, a, b } of courbesDeNiveau(tousTriangles, equidistance)) {
        const rang = altitude / (5 * equidistance);
        trait(doc, [107, 79, 42], Math.abs(rang - Math.round(rang)) < 1e-6 ? 0.25 : 0.1);
        const pa = versPapier(a);
        const pb = versPapier(b);
        doc.line(pa.x, pa.y, pb.x, pb.y);
      }
    }
  }

  // Triangles du dessus
  if (choix.triangles) {
    trait(doc, COULEURS.triangle, 0.08);
    for (const triangle of tousTriangles) {
      const [a, b, c] = triangle.map(versPapier);
      doc.line(a.x, a.y, b.x, b.y);
      doc.line(b.x, b.y, c.x, c.y);
      doc.line(c.x, c.y, a.x, a.y);
    }
  }

  // Lignes de rupture puis contours
  const polyligne = (listeNoms, fermee) => {
    const sommets = listeNoms.map((nom) => parNom.get(nom)).filter(Boolean).map(versPapier);
    for (let i = 0; i + 1 < sommets.length; i++) doc.line(sommets[i].x, sommets[i].y, sommets[i + 1].x, sommets[i + 1].y);
    if (fermee && sommets.length >= 3) doc.line(sommets.at(-1).x, sommets.at(-1).y, sommets[0].x, sommets[0].y);
  };
  trait(doc, COULEURS.ligne, 0.25);
  for (const { stock } of calcules) for (const ligne of stock.lignesRupture ?? []) polyligne(ligne.noms, ligne.fermee);
  trait(doc, COULEURS.contour, 0.35);
  for (const { stock } of calcules) polyligne(stock.contour ?? [], true);

  // Points et noms (placés sans chevauchement, comme sur l'écran)
  doc.setFillColor(...COULEURS.texte);
  const positions = pointsMontres.map(versPapier);
  for (const { x, y } of positions) doc.circle(x, y, 0.3, 'F');
  const tailleNom = echelle <= 250 ? 6 : 5; // points (typographiques)
  const hauteurNom = tailleNom * 0.3528; // 1 point = 0.3528 mm
  doc.setFontSize(tailleNom);
  doc.setTextColor(...COULEURS.texte);
  if (choix.noms || choix.altitudes) {
    // Étiquette de chaque point : son nom et / ou son altitude (m, 3 décimales), sur une ou deux lignes.
    const textes = pointsMontres.map((p) => [choix.noms ? p.nom : null, choix.altitudes ? formaterNombre(p.altitude) : null].filter(Boolean));
    const interligne = hauteurNom * 1.15;
    const places = placerEtiquettes(
      positions.map(({ x, y }, i) => ({
        x,
        y,
        largeur: Math.max(...textes[i].map((t) => doc.getTextWidth(t))),
        hauteur: hauteurNom + (textes[i].length - 1) * interligne,
      })),
      0.6,
    );
    places.forEach((place, i) => {
      if (!place) return;
      const lignes = textes[i];
      lignes.forEach((ligne, k) => {
        // Le nom en noir, l'altitude en gris en dessous.
        const estAltitude = choix.altitudes && k === lignes.length - 1;
        doc.setTextColor(...(estAltitude ? COULEURS.gris : COULEURS.texte));
        doc.text(ligne, place.x, place.y - (lignes.length - 1 - k) * interligne, { align: place.aGauche ? 'right' : 'left' });
      });
    });
    doc.setTextColor(...COULEURS.texte);
  }

  // Nom et volume de chaque stock, dans une étiquette blanche
  for (const { stock, resultat } of calcules) {
    const centreStock = pointInterieur(resultat.trianglesDessus);
    if (!centreStock) continue;
    const { x, y } = versPapier(centreStock);
    const lignes = [stock.nom, `Remblai ${formaterNombre(resultat.remblai)} m³`];
    if (resultat.deblai > 0) lignes.push(`Déblai ${formaterNombre(resultat.deblai)} m³`);
    // Étiquette plus petite aux petites échelles (1:1000 et plus), pour moins cacher le plan.
    const taille = echelle >= 1000 ? 5.5 : 7;
    const interligne = taille * 0.46;
    doc.setFontSize(taille);
    const largeur = Math.max(...lignes.map((l) => doc.getTextWidth(l))) + 3;
    const hauteur = lignes.length * interligne + 1.6;
    doc.setFillColor(255, 255, 255);
    trait(doc, COULEURS.contour, 0.25);
    doc.roundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, 1, 1, 'FD');
    lignes.forEach((ligne, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.text(ligne, x, y - hauteur / 2 + 0.8 + interligne * (i + 0.85), { align: 'center' });
    });
    doc.setFont('helvetica', 'normal');
  }
  dessinerTraitsCoupes(doc, coupes, versPapier);
  terminerCadrePlan(doc, echelle, sources);
  return { echelle, messageFond, relief, legendeEcarts };
}

/**
 * Photo aérienne et/ou cadastre swisstopo sous le plan : les tuiles sont chargées,
 * assemblées dans une image de la taille du cadre, puis posées dans le PDF.
 * Chaque couche est indépendante : si le cadastre ne se charge pas, la photo reste.
 * Renvoie { message, sources } : message (pas de connexion, cadastre remplacé...) ou null,
 * et la mention de la source de chaque fond dessiné.
 */
async function dessinerFondPdf(doc, versTerrain, mmParMetre, choix) {
  if (typeof document === 'undefined') return { message: 'fond non disponible ici', sources: [] };
  const pixelsParMm = DPI_FOND / 25.4;
  const largeurPx = Math.round(CADRE_PLAN.largeur * pixelsParMm);
  const hauteurPx = Math.round(CADRE_PLAN.hauteur * pixelsParMm);
  const hautGauche = versTerrain(CADRE_PLAN.x, CADRE_PLAN.y);
  const basDroite = versTerrain(CADRE_PLAN.x + CADRE_PLAN.largeur, CADRE_PLAN.y + CADRE_PLAN.hauteur);
  const metresParPixel = 1 / (mmParMetre * pixelsParMm);
  const z = niveauDeZoom(metresParPixel);
  const tuiles = tuilesPourZone({ estMin: hautGauche.est, estMax: basDroite.est, nordMin: basDroite.nord, nordMax: hautGauche.nord }, z);
  if (tuiles.length > 200) return { message: 'fond non mis : plan trop étendu pour la photo aérienne', sources: [] };

  const toile = document.createElement('canvas');
  toile.width = largeurPx;
  toile.height = hauteurPx;
  const contexte = toile.getContext('2d');
  contexte.fillStyle = '#ffffff';
  contexte.fillRect(0, 0, largeurPx, hauteurPx);

  const couches = [choix.photo ? 'satellite' : null, choix.cadastre ? 'cadastre' : null].filter(Boolean);
  const NOMS_COUCHES = { satellite: 'photo aérienne', cadastre: 'cadastre' };
  const messages = [];
  const sources = [];
  for (const couche of couches) {
    let source = FONDS[couche];
    let images = await chargerTuiles(tuiles, source);
    // Fond de secours (cadastre en couleurs) si aucune tuile n'a pu être chargée,
    // ou si le serveur n'a renvoyé que des images vides (entièrement transparentes).
    if (FONDS_SECOURS[couche] && images.filter(Boolean).every(estVide)) {
      source = FONDS_SECOURS[couche];
      images = await chargerTuiles(tuiles, source);
      if (images.some(Boolean)) messages.push('cadastre en traits vide ou indisponible : cadastre en couleurs mis à la place');
    }
    const manquantes = images.filter((image) => !image).length;
    if (manquantes === images.length) {
      messages.push(`${NOMS_COUCHES[couche]} non disponible (pas de connexion ?)`);
      continue;
    }
    if (manquantes > 0) messages.push(`${NOMS_COUCHES[couche]} : ${manquantes} tuile(s) sur ${images.length} non chargée(s)`);
    // Photo aérienne atténuée : posée à 50 % sur le fond blanc, le plan se lit mieux par-dessus.
    contexte.globalAlpha = couche === 'satellite' && choix.photoAttenuee ? 0.5 : 1;
    tuiles.forEach((tuile, i) => {
      if (!images[i]) return;
      const x = (tuile.est - hautGauche.est) * mmParMetre * pixelsParMm;
      const y = (hautGauche.nord - tuile.nord) * mmParMetre * pixelsParMm;
      const cote = tuile.cote * mmParMetre * pixelsParMm;
      contexte.drawImage(images[i], x, y, cote + 0.5, cote + 0.5);
    });
    contexte.globalAlpha = 1;
    sources.push(source.attribution);
  }
  if (sources.length > 0) {
    try {
      doc.addImage(toile.toDataURL('image/jpeg', 0.85), 'JPEG', CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur);
    } catch {
      return { message: 'fond swisstopo refusé par le navigateur : PDF créé sans le fond', sources: [] };
    }
  }
  return { message: messages.join(' ; ') || null, sources };
}

/** Vrai si une image (tuile) est entièrement transparente : rien n'y est dessiné. */
function estVide(image) {
  const toile = document.createElement('canvas');
  toile.width = 64;
  toile.height = 64;
  const contexte = toile.getContext('2d');
  contexte.drawImage(image, 0, 0, 64, 64);
  try {
    const { data } = contexte.getImageData(0, 0, 64, 64);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return false;
    return true;
  } catch {
    return false; // image non lisible : on ne peut pas savoir, on la garde
  }
}

/**
 * Charge les tuiles d'un fond. Renvoie une image par tuile, ou null pour celles qui
 * n'ont pas pu être chargées (le reste du fond est quand même dessiné).
 */
async function chargerTuiles(tuiles, fond) {
  const resultats = await Promise.allSettled(tuiles.map((t) => chargerImage(fond.url(t.z, t.colonne, t.ligne))));
  return resultats.map((r) => (r.status === 'fulfilled' ? r.value : null));
}

/** Charge une image (tuile) en autorisant son usage dans le PDF. */
function chargerImage(adresse) {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error(`image non chargée : ${adresse}`));
    image.src = adresse;
  });
}

/** Polygone rempli (style 'F' : sans contour, 'FD' : avec contour), sommets en mm sur la feuille. */
function polygonePlein(doc, sommets, style = 'F') {
  const [premier, ...suivants] = sommets;
  const ecarts = suivants.map((p, i) => {
    const precedent = i === 0 ? premier : suivants[i - 1];
    return [p.x - precedent.x, p.y - precedent.y];
  });
  doc.lines(ecarts, premier.x, premier.y, [1, 1], style, true);
}

/** Barre d'échelle en bas à gauche du plan : 4 cases noires et blanches, et l'échelle écrite. */
function dessinerBarreEchelle(doc, echelle) {
  const { metres, mm } = barreEchellePapier(echelle, 60);
  const x = CADRE_PLAN.x + 6;
  const y = CADRE_PLAN.y + CADRE_PLAN.hauteur - 9;
  trait(doc, COULEURS.texte, 0.2);
  for (let i = 0; i < 4; i++) {
    doc.setFillColor(...(i % 2 === 0 ? COULEURS.texte : [255, 255, 255]));
    doc.rect(x + (i * mm) / 4, y, mm / 4, 1.6, 'FD');
  }
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.texte);
  doc.text('0', x, y - 1, { align: 'center' });
  doc.text(`${metres} m`, x + mm, y - 1, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Échelle 1:${echelle}`, x + mm + 6, y + 1.6);
  doc.setFont('helvetica', 'normal');
}

/** Flèche du Nord en haut à droite du plan. */
function dessinerNord(doc) {
  const x = CADRE_PLAN.x + CADRE_PLAN.largeur - 10;
  const y = CADRE_PLAN.y + 8;
  doc.setFillColor(...COULEURS.texte);
  doc.triangle(x, y - 4, x - 2.2, y + 3, x + 2.2, y + 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('N', x, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
}

/** Titre de la colonne de droite, souligné en ambre. Renvoie la position (mm) de la ligne suivante. */
function dessinerTitre(doc, titre) {
  const y = 17;
  doc.setTextColor(...COULEURS.texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titre, COLONNE.x, y);
  doc.setFillColor(...COULEURS.ambre);
  doc.rect(COLONNE.x, y + 2, 24, 0.9, 'F');
  return y + 9;
}

/**
 * Légende remblai / déblai : une rangée de cases par côté, avec la valeur de chaque palier.
 * Renvoie la position (mm) de la ligne suivante.
 */
function dessinerLegendeEcarts(doc, x, y, legende) {
  const largeur = COLONNE.largeur - 8;
  for (const [titre, classes] of [['Remblai', legende.remblai], ['Déblai', legende.deblai]]) {
    if (classes.length === 0) continue;
    doc.setFontSize(6.5);
    doc.setTextColor(...COULEURS.texte);
    doc.setFont('helvetica', 'bold');
    doc.text(`${titre} (épaisseur en m, palier ${legende.palier} m)`, x, y);
    doc.setFont('helvetica', 'normal');
    y += 1.5;
    const pas = largeur / classes.length;
    classes.forEach((classe, i) => {
      doc.setFillColor(...classe.couleur);
      doc.rect(x + i * pas, y, pas, 3, 'F');
    });
    // Valeur de chaque limite de palier (une sur deux s'il y a beaucoup de paliers)
    doc.setFontSize(5.5);
    const saut = pas < 5 ? 2 : 1;
    const limites = [0, ...classes.map((c) => c.a)];
    limites.forEach((valeur, i) => {
      if (i % saut !== 0 && i !== limites.length - 1) return;
      const ancre = i === 0 ? 'left' : i === limites.length - 1 ? 'right' : 'center';
      doc.text(String(Math.round(valeur * 1000) / 1000), x + i * pas, y + 5.5, { align: ancre });
    });
    y += 9;
  }
  return y;
}

/** Colonne de droite : titre, tableau des volumes, remarques, légendes et cartouche. */
function dessinerColonne(doc, calcules, cartouche, { choix, relief, ecarts, comparaisons }) {
  const x = COLONNE.x;
  let y = dessinerTitre(doc, 'Volumes');

  // Tableau : Nom | Base | Surface | Remblai | Déblai
  const colonnes = [
    { titre: 'Nom', largeur: 21, aligne: 'left' },
    { titre: 'Base', largeur: 8, aligne: 'left' },
    { titre: 'Surface m²', largeur: 17, aligne: 'right' },
    { titre: 'Remblai m³', largeur: 17, aligne: 'right' },
    { titre: 'Déblai m³', largeur: 17, aligne: 'right' },
  ];
  const ecrireLigne = (valeurs, gras) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    let cx = x;
    colonnes.forEach((colonne, i) => {
      const tx = colonne.aligne === 'right' ? cx + colonne.largeur - 1 : cx;
      doc.text(String(valeurs[i]), tx, y, { align: colonne.aligne });
      cx += colonne.largeur;
    });
    y += 4.4;
  };
  doc.setFontSize(7);
  doc.setTextColor(...COULEURS.gris);
  ecrireLigne(colonnes.map((c) => c.titre), true);
  trait(doc, COULEURS.gris, 0.15);
  doc.line(x, y - 3, x + COLONNE.largeur, y - 3);
  doc.setTextColor(...COULEURS.texte);
  // Lignes rangées par nature de la surface 1, avec un total par nature (jamais un total
  // qui additionne des stocks et des terrassements).
  const groupes = grouperParNature(calcules.map((ligne) => ({ ...ligne, nature: ligne.stock.nature })));
  for (const { lignes, total } of groupes) {
    for (const { stock, resultat } of lignes) {
      const nom = stock.nom.length > 14 ? `${stock.nom.slice(0, 13)}…` : stock.nom;
      ecrireLigne([nom, resultat.mode, formaterNombre(resultat.surfacePlan), formaterNombre(resultat.remblai), formaterNombre(resultat.deblai)]);
    }
    if (total) {
      doc.line(x, y - 3, x + COLONNE.largeur, y - 3);
      ecrireLigne([total.titre, '', formaterNombre(total.surfacePlan), formaterNombre(total.remblai), formaterNombre(total.deblai)], true);
    }
  }
  if (calcules.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Aucun stock calculé.', x, y);
    y += 4.4;
  }

  // Calculs dans le contour d'une surface (une feuille chacun, à la suite)
  const comparaisonsCalculees = comparaisons.filter(({ resultat }) => resultat && !resultat.erreurs);
  if (comparaisonsCalculees.length > 0) {
    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(...COULEURS.gris);
    doc.setFont('helvetica', 'bold');
    doc.text('Dans un contour', x, y);
    doc.text('Remblai m³', x + 63, y, { align: 'right' });
    doc.text('Déblai m³', x + COLONNE.largeur - 1, y, { align: 'right' });
    y += 4.4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COULEURS.texte);
    for (const { nom, resultat } of comparaisonsCalculees) {
      doc.text(nom.length > 26 ? `${nom.slice(0, 25)}…` : nom, x, y);
      doc.text(formaterNombre(resultat.remblai), x + 63, y, { align: 'right' });
      doc.text(formaterNombre(resultat.deblai), x + COLONNE.largeur - 1, y, { align: 'right' });
      y += 4.4;
    }
  }

  // Remarques : base de chaque calcul, avec la nature des surfaces, et surfaces non couvertes
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.gris);
  const remarques = [
    'Base A : ligne basse (points du contour). Base Z : plan à une altitude. Base B : comparaison à une surface de référence.',
    ...calcules
      .filter(({ stock }) => stock.description)
      .map(({ stock }) => `${stock.nom} : ${stock.description}.`),
    ...calcules
      .filter(({ resultat }) => resultat.surfaceNonCouverte > 0)
      .map(({ stock, resultat }) => `Attention ${stock.nom} : ${formaterNombre(resultat.surfaceNonCouverte)} m² non couverts par la base.`),
  ];
  for (const remarque of remarques) {
    const lignes = doc.splitTextToSize(remarque, COLONNE.largeur);
    doc.text(lignes, x, y);
    y += lignes.length * 2.8;
  }

  // Légende
  y += 3;
  const legende = [
    [COULEURS.contour, 'Contour du stock'],
    [COULEURS.ligne, 'Ligne de rupture'],
    choix.triangles ? [COULEURS.triangle, 'Triangulation du dessus'] : null,
    choix.courbes && relief ? [[107, 79, 42], `Courbes de niveau (équidistance ${relief.equidistance} m)`] : null,
  ].filter(Boolean);
  for (const [couleur, texte] of legende) {
    trait(doc, couleur, 0.5);
    doc.line(x, y - 1, x + 6, y - 1);
    doc.text(texte, x + 8, y);
    y += 3.4;
  }
  if (choix.couleurs && relief) {
    // Échelle des couleurs : du plus bas au plus haut
    const largeur = 50;
    const pas = 20;
    for (let i = 0; i < pas; i++) {
      const altitude = relief.plage.min + ((i + 0.5) / pas) * (relief.plage.max - relief.plage.min);
      doc.setFillColor(...couleurRVB(altitude, relief.plage));
      doc.rect(x + (i * largeur) / pas, y - 2, largeur / pas + 0.1, 2.5, 'F');
    }
    doc.text(formaterNombre(relief.plage.min), x, y + 3);
    doc.text(`${formaterNombre(relief.plage.max)} m`, x + largeur, y + 3, { align: 'right' });
    y += 7;
  }
  if (ecarts) y = dessinerLegendeEcarts(doc, x, y + 1, ecarts);

  dessinerCartouche(doc, cartouche);
  // Fin de la légende : les photos peuvent se placer en dessous.
  return y;
}

/** Cartouche en bas à droite : logo, puis affaire, date, dessiné par, échelle, coordonnées, fichier. */
function dessinerCartouche(doc, cartouche) {
  const x = COLONNE.x;
  // Cartouche en bas à droite
  const lignesCartouche = [
    ['Affaire', cartouche.affaire || '-'],
    ['Date', cartouche.date || '-'],
    ['Dessiné par', cartouche.dessinePar || '-'],
    ['Échelle', cartouche.texteEchelle ?? `1:${cartouche.echelle}`],
    ['Coordonnées', 'MN95 (m)'],
    ['Fichier de points', cartouche.fichierPoints || '-'],
  ];
  const hauteurLigne = HAUTEUR_LIGNE_CARTOUCHE;
  trait(doc, COULEURS.texte, 0.3);
  // Case du logo, en haut du cartouche
  doc.rect(x, Y_CARTOUCHE, COLONNE.largeur, HAUTEUR_LOGO_CARTOUCHE);
  doc.addImage(logoPerrin, 'JPEG', x + 2, Y_CARTOUCHE + (HAUTEUR_LOGO_CARTOUCHE - LOGO.hauteur) / 2, LOGO.largeur, LOGO.hauteur);
  const yCartouche = Y_CARTOUCHE + HAUTEUR_LOGO_CARTOUCHE;
  doc.rect(x, yCartouche, COLONNE.largeur, lignesCartouche.length * hauteurLigne);
  lignesCartouche.forEach(([titre, valeur], i) => {
    const yl = yCartouche + i * hauteurLigne;
    if (i > 0) doc.line(x, yl, x + COLONNE.largeur, yl);
    doc.setFontSize(6);
    doc.setTextColor(...COULEURS.gris);
    doc.setFont('helvetica', 'normal');
    doc.text(titre, x + 1.5, yl + 2.4);
    doc.setFontSize(8);
    doc.setTextColor(...COULEURS.texte);
    doc.setFont('helvetica', 'bold');
    const texte = doc.splitTextToSize(String(valeur), COLONNE.largeur - 3)[0];
    doc.text(texte, x + 1.5, yl + 5.2);
  });
  doc.setFont('helvetica', 'normal');
}

/** Trait de chaque coupe sur le plan (tirets bleu nuit), avec son nom à chaque bout (A et A'). */
function dessinerTraitsCoupes(doc, coupes, versPapier) {
  for (const coupe of coupes) {
    const a = versPapier(coupe.debut);
    const b = versPapier(coupe.fin);
    trait(doc, COULEURS.texte, 0.4);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(a.x, a.y, b.x, b.y);
    doc.setLineDashPattern([], 0);
    const longueur = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const [ux, uy] = [(b.x - a.x) / longueur, (b.y - a.y) / longueur];
    doc.setFillColor(...COULEURS.texte);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COULEURS.texte);
    for (const [bout, texte, sens] of [[a, coupe.nom, -1], [b, `${coupe.nom}'`, 1]]) {
      doc.circle(bout.x, bout.y, 0.6, 'F');
      doc.text(texte, bout.x + sens * ux * 3.5, bout.y + sens * uy * 3.5 + 1.2, { align: 'center' });
    }
    doc.setFont('helvetica', 'normal');
  }
}

/**
 * Feuille « Coupes » : les coupes l'une sous l'autre dans le cadre de gauche ; à droite le titre,
 * les échelles de chaque coupe, la légende des surfaces et le cartouche.
 */
function dessinerPageCoupes(doc, coupes, cartouche) {
  dessinerCadres(doc);
  const hauteurCoupe = CADRE_PLAN.hauteur / coupes.length;
  const dessins = coupes.map((coupe, i) => {
    const zone = { x: CADRE_PLAN.x + 3, y: CADRE_PLAN.y + i * hauteurCoupe + 4, largeur: CADRE_PLAN.largeur - 6, hauteur: hauteurCoupe - 8 };
    const dessin = preparerDessinCoupe(coupe, coupe.profils, zone.largeur, zone.hauteur);
    if (i > 0) {
      trait(doc, COULEURS.gris, 0.2);
      doc.line(CADRE_PLAN.x, CADRE_PLAN.y + i * hauteurCoupe, CADRE_PLAN.x + CADRE_PLAN.largeur, CADRE_PLAN.y + i * hauteurCoupe);
    }
    // Le dessin, ajusté au relief, est centré en hauteur dans sa part de la feuille.
    dessinerCoupePdf(doc, dessin, zone.x, zone.y + (zone.hauteur - dessin.hauteurTotale) / 2);
    return { coupe, dessin };
  });

  // Colonne de droite : titre, échelles, légende, cartouche
  const x = COLONNE.x;
  let y = dessinerTitre(doc, 'Coupes');
  for (const { coupe, dessin } of dessins) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COULEURS.texte);
    doc.text(dessin.titre, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COULEURS.gris);
    doc.text(`${texteEchellesCoupe(dessin)} · longueur ${formaterNombre(longueurCoupe(coupe.debut, coupe.fin))} m`, x, y + 3.2);
    y += 8;
  }
  // Légende : une couleur par surface traversée
  const legende = new Map();
  for (const { dessin } of dessins) for (const { nom, couleur } of dessin.courbes) if (!legende.has(nom)) legende.set(nom, couleur);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.texte);
  doc.text('Surfaces', x, y);
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  for (const [nom, couleur] of legende) {
    trait(doc, couleur, 0.6);
    doc.line(x, y - 0.8, x + 6, y - 0.8);
    doc.text(doc.splitTextToSize(nom, COLONNE.largeur - 9)[0], x + 8, y);
    y += 3.6;
  }
  doc.setFontSize(6);
  doc.setTextColor(...COULEURS.gris);
  doc.text(doc.splitTextToSize('Altitudes et longueurs en m. Coupes tracées sur le plan (A – A\', B – B\').', COLONNE.largeur), x, y + 2);
  const texteEchelle = dessins.map(({ dessin }) => `1:${dessin.echelle}`).join(' / ');
  dessinerCartouche(doc, { ...cartouche, texteEchelle });
}

/** Dessine une coupe préparée par preparerDessinCoupe (mesures en mm), décalée de (ox, oy). */
function dessinerCoupePdf(doc, dessin, ox, oy) {
  const { cadre } = dessin;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const xFin = dessin.cotesX.at(-1).x; // fin de la coupe (A')
  // Quadrillage léger aux cotes
  trait(doc, [221, 226, 230], 0.1);
  for (const { x } of dessin.cotesX) doc.line(X(x), Y(cadre.y), X(x), Y(cadre.y + cadre.hauteur));
  for (const { y } of dessin.cotesY) doc.line(X(cadre.x), Y(y), X(xFin), Y(y));
  // Axes
  trait(doc, COULEURS.texte, 0.25);
  doc.line(X(cadre.x), Y(cadre.y), X(cadre.x), Y(cadre.y + cadre.hauteur));
  doc.line(X(cadre.x), Y(cadre.y + cadre.hauteur), X(xFin), Y(cadre.y + cadre.hauteur));
  // Cotes de longueur (en bas) et d'altitude (à gauche)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COULEURS.gris);
  for (const { x, texte } of dessin.cotesX) doc.text(texte, X(x), Y(cadre.y + cadre.hauteur + 3.6), { align: 'center' });
  for (const { y, texte } of dessin.cotesY) doc.text(texte, X(cadre.x - 1), Y(y + 0.9), { align: 'right' });
  // Noms des extrémités (A et A') et titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COULEURS.texte);
  for (const { x, texte } of dessin.extremites) doc.text(texte, X(x), Y(cadre.y - 1.5), { align: 'center' });
  doc.setFontSize(7);
  doc.text(`${dessin.titre}   ${texteEchellesCoupe(dessin)}`, X(cadre.x + cadre.largeur), Y(cadre.y - 1.5), { align: 'right' });
  doc.setFont('helvetica', 'normal');
  // Profils des surfaces
  for (const { couleur, lignes } of dessin.courbes) {
    trait(doc, couleur, 0.45);
    for (const ligne of lignes) {
      for (let i = 0; i + 1 < ligne.length; i++) doc.line(X(ligne[i].x), Y(ligne[i].y), X(ligne[i + 1].x), Y(ligne[i + 1].y));
    }
  }
}

/** Choisit la couleur et l'épaisseur (mm) des traits. */
function trait(doc, couleur, epaisseur) {
  doc.setDrawColor(...couleur);
  doc.setLineWidth(epaisseur);
}
