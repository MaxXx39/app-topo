// Export PDF : une feuille A4 paysage avec le plan à l'échelle, les volumes et un cartouche.
// Le plan est dessiné en traits (vectoriel) : il reste net à l'impression et au zoom.
// Toutes les mesures sur la feuille sont en millimètres.
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { placerEtiquettes, pointInterieur } from '../plan/etiquettes.js';
import { choisirEchelle, barreEchellePapier } from './echelle.js';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';
import { couleurRVB } from '../plan/couleurs.js';
import { FONDS, niveauDeZoom, tuilesPourZone } from '../plan/fond.js';

// Calques du plan imprimé, et leur état par défaut.
export const CALQUES_PDF = {
  triangles: true,
  noms: true,
  courbes: false,
  couleurs: false,
  photo: false,
  cadastre: false,
};
// Résolution de la photo aérienne dans le PDF (points par pouce).
const DPI_FOND = 150;

// Mise en page (A4 paysage : 297 × 210 mm).
const PAGE = { largeur: 297, hauteur: 210, marge: 8 };
const CADRE_PLAN = { x: 10, y: 10, largeur: 193, hauteur: 190 };
const COLONNE = { x: 207, largeur: 80 };

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
 * - stocks, resultats : comme dans resultats.js (un résultat par stock)
 * - points : tous les points importés
 * - cartouche : { affaire, date, dessinePar, fichierPoints }
 * - echelleImposee : dénominateur de l'échelle voulue (500 pour 1:500), ou null pour la choisir
 *   automatiquement (la plus détaillée qui fait tout tenir). Si le plan dépasse, il est coupé au cadre.
 * - calques : calques à imprimer (voir CALQUES_PDF)
 * - comparaisons : liste de { nom, resultat } ajoutée sous le tableau des volumes
 * Renvoie (après chargement éventuel de la photo aérienne)
 * { document, echelle, messageFond } : document jsPDF, échelle utilisée, et un message si le fond n'a pas pu être mis.
 */
export async function creerPdf({ stocks, resultats, points, cartouche, echelleImposee = null, calques = {}, comparaisons = [] }) {
  const choix = { ...CALQUES_PDF, ...calques };
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  // Cadre général de la feuille
  trait(doc, COULEURS.texte, 0.4);
  doc.rect(PAGE.marge, PAGE.marge, PAGE.largeur - 2 * PAGE.marge, PAGE.hauteur - 2 * PAGE.marge);
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur);

  const calcules = stocks.map((stock, i) => ({ stock, resultat: resultats[i] })).filter(({ resultat }) => resultat && !resultat.erreurs);
  const { echelle, messageFond, relief } = await dessinerPlan(doc, calcules, points, echelleImposee, choix);
  dessinerColonne(doc, calcules, { ...cartouche, echelle }, { choix, relief, comparaisons });
  return { document: doc, echelle, messageFond };
}

/**
 * Dessine le plan dans son cadre, à l'échelle normalisée qui fait tout tenir (ou imposée).
 * Renvoie { echelle, messageFond, relief } (relief : plage d'altitudes et équidistance, pour la légende).
 */
async function dessinerPlan(doc, calcules, points, echelleImposee, choix) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  // Points à montrer : ceux des stocks calculés (ou tous s'il n'y a aucun stock).
  const noms = new Set(
    calcules.flatMap(({ stock }) => [
      ...stock.contour,
      ...stock.base,
      ...stock.lignesRupture.flatMap((l) => l.noms),
      ...stock.pointsDessus,
    ]),
  );
  const pointsMontres = noms.size > 0 ? [...noms].map((nom) => parNom.get(nom)).filter(Boolean) : points;
  if (pointsMontres.length === 0) return { echelle: 500, messageFond: null, relief: null };

  // Zone du terrain à dessiner, avec une marge de 10 mm autour sur le papier.
  const ests = pointsMontres.map((p) => p.est);
  const nords = pointsMontres.map((p) => p.nord);
  const zone = { estMin: Math.min(...ests), estMax: Math.max(...ests), nordMin: Math.min(...nords), nordMax: Math.max(...nords) };
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
  // Passage terrain (m) -> feuille (mm). Le Nord est en haut de la feuille.
  const versPapier = (p) => ({
    x: milieuCadre.x + (p.est - centre.est) * mmParMetre,
    y: milieuCadre.y - (p.nord - centre.nord) * mmParMetre,
  });

  // Fond swisstopo (photo aérienne, cadastre) : une image posée sous le dessin.
  let messageFond = null;
  if (choix.photo || choix.cadastre) {
    const versTerrain = (x, y) => ({
      est: centre.est + (x - milieuCadre.x) / mmParMetre,
      nord: centre.nord - (y - milieuCadre.y) / mmParMetre,
    });
    messageFond = await dessinerFondPdf(doc, versTerrain, mmParMetre, choix);
  }

  // Tout ce qui sort du cadre du plan est coupé (utile si l'échelle imposée est trop grande).
  doc.saveGraphicsState();
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur, null);
  doc.clip();
  doc.discardPath();

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
  for (const { stock } of calcules) for (const ligne of stock.lignesRupture) polyligne(ligne.noms, ligne.fermee);
  trait(doc, COULEURS.contour, 0.35);
  for (const { stock } of calcules) polyligne(stock.contour, true);

  // Points et noms (placés sans chevauchement, comme sur l'écran)
  doc.setFillColor(...COULEURS.texte);
  const positions = pointsMontres.map(versPapier);
  for (const { x, y } of positions) doc.circle(x, y, 0.3, 'F');
  const tailleNom = echelle <= 250 ? 6 : 5; // points (typographiques)
  const hauteurNom = tailleNom * 0.3528; // 1 point = 0.3528 mm
  doc.setFontSize(tailleNom);
  doc.setTextColor(...COULEURS.texte);
  if (choix.noms) {
    const places = placerEtiquettes(
      positions.map(({ x, y }, i) => ({ x, y, largeur: doc.getTextWidth(pointsMontres[i].nom), hauteur: hauteurNom })),
      0.6,
    );
    places.forEach((place, i) => {
      if (place) doc.text(pointsMontres[i].nom, place.x, place.y, { align: place.aGauche ? 'right' : 'left' });
    });
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
  doc.restoreGraphicsState();

  dessinerBarreEchelle(doc, echelle);
  dessinerNord(doc);
  if ((choix.photo || choix.cadastre) && !messageFond) {
    // Mention obligatoire de la source du fond
    doc.setFontSize(5.5);
    doc.setTextColor(...COULEURS.texte);
    const source = [choix.photo ? '© swisstopo' : null, choix.cadastre ? 'Cadastre © cantons' : null].filter(Boolean).join(' · ');
    doc.text(source, CADRE_PLAN.x + CADRE_PLAN.largeur - 1.5, CADRE_PLAN.y + CADRE_PLAN.hauteur - 1.5, { align: 'right' });
  }
  return { echelle, messageFond, relief };
}

/**
 * Photo aérienne et/ou cadastre swisstopo sous le plan : les tuiles sont chargées,
 * assemblées dans une image de la taille du cadre, puis posées dans le PDF.
 * Renvoie null si tout va bien, sinon un message (pas de connexion...).
 */
async function dessinerFondPdf(doc, versTerrain, mmParMetre, choix) {
  if (typeof document === 'undefined') return 'fond non disponible ici';
  const pixelsParMm = DPI_FOND / 25.4;
  const largeurPx = Math.round(CADRE_PLAN.largeur * pixelsParMm);
  const hauteurPx = Math.round(CADRE_PLAN.hauteur * pixelsParMm);
  const hautGauche = versTerrain(CADRE_PLAN.x, CADRE_PLAN.y);
  const basDroite = versTerrain(CADRE_PLAN.x + CADRE_PLAN.largeur, CADRE_PLAN.y + CADRE_PLAN.hauteur);
  const metresParPixel = 1 / (mmParMetre * pixelsParMm);
  const z = niveauDeZoom(metresParPixel);
  const tuiles = tuilesPourZone({ estMin: hautGauche.est, estMax: basDroite.est, nordMin: basDroite.nord, nordMax: hautGauche.nord }, z);
  if (tuiles.length > 200) return 'fond non mis : plan trop étendu pour la photo aérienne';

  const toile = document.createElement('canvas');
  toile.width = largeurPx;
  toile.height = hauteurPx;
  const contexte = toile.getContext('2d');
  contexte.fillStyle = '#ffffff';
  contexte.fillRect(0, 0, largeurPx, hauteurPx);

  const couches = [choix.photo ? 'satellite' : null, choix.cadastre ? 'cadastre' : null].filter(Boolean);
  try {
    for (const couche of couches) {
      const images = await Promise.all(tuiles.map((t) => chargerImage(FONDS[couche].url(t.z, t.colonne, t.ligne))));
      tuiles.forEach((tuile, i) => {
        const x = (tuile.est - hautGauche.est) * mmParMetre * pixelsParMm;
        const y = (hautGauche.nord - tuile.nord) * mmParMetre * pixelsParMm;
        const cote = tuile.cote * mmParMetre * pixelsParMm;
        contexte.drawImage(images[i], x, y, cote + 0.5, cote + 0.5);
      });
    }
    doc.addImage(toile.toDataURL('image/jpeg', 0.85), 'JPEG', CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur);
    return null;
  } catch {
    return 'fond swisstopo non disponible (pas de connexion ?) : PDF créé sans le fond';
  }
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

/** Polygone rempli (sans contour), sommets en mm sur la feuille. */
function polygonePlein(doc, sommets) {
  const [premier, ...suivants] = sommets;
  const ecarts = suivants.map((p, i) => {
    const precedent = i === 0 ? premier : suivants[i - 1];
    return [p.x - precedent.x, p.y - precedent.y];
  });
  doc.lines(ecarts, premier.x, premier.y, [1, 1], 'F', true);
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

/** Colonne de droite : titre, tableau des volumes, remarques et cartouche. */
function dessinerColonne(doc, calcules, cartouche, { choix, relief, comparaisons }) {
  const x = COLONNE.x;
  let y = 17;
  doc.setTextColor(...COULEURS.texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Volumes de stocks', x, y);
  doc.setFillColor(...COULEURS.ambre);
  doc.rect(x, y + 2, 24, 0.9, 'F');

  // Tableau : Stock | Mode | Surface | Remblai | Déblai
  y += 9;
  const colonnes = [
    { titre: 'Stock', largeur: 21, aligne: 'left' },
    { titre: 'Mode', largeur: 8, aligne: 'left' },
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
  let totalRemblai = 0;
  let totalDeblai = 0;
  let totalSurface = 0;
  for (const { stock, resultat } of calcules) {
    const nom = stock.nom.length > 14 ? `${stock.nom.slice(0, 13)}…` : stock.nom;
    ecrireLigne([nom, resultat.mode, formaterNombre(resultat.surfacePlan), formaterNombre(resultat.remblai), formaterNombre(resultat.deblai)]);
    totalRemblai += resultat.remblai;
    totalDeblai += resultat.deblai;
    totalSurface += resultat.surfacePlan;
  }
  if (calcules.length > 1) {
    doc.line(x, y - 3, x + COLONNE.largeur, y - 3);
    ecrireLigne(['Total', '', formaterNombre(totalSurface), formaterNombre(totalRemblai), formaterNombre(totalDeblai)], true);
  }
  if (calcules.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Aucun stock calculé.', x, y);
    y += 4.4;
  }

  // Comparaisons (volume ajouté / enlevé entre deux surfaces)
  const comparaisonsCalculees = comparaisons.filter(({ resultat }) => resultat && !resultat.erreurs);
  if (comparaisonsCalculees.length > 0) {
    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(...COULEURS.gris);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparaison', x, y);
    doc.text('Ajouté m³', x + 63, y, { align: 'right' });
    doc.text('Enlevé m³', x + COLONNE.largeur - 1, y, { align: 'right' });
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

  // Remarques : mode de calcul et surfaces non couvertes
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.gris);
  const remarques = [
    'Mode A : base = points du pied. Mode B : base = surface LandXML.',
    ...calcules
      .filter(({ resultat }) => resultat.mode === 'B')
      .map(({ stock, resultat }) => `${stock.nom} : base LandXML « ${resultat.nomBase} ».`),
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

  // Cartouche en bas à droite
  const lignesCartouche = [
    ['Affaire', cartouche.affaire || '-'],
    ['Date', cartouche.date || '-'],
    ['Dessiné par', cartouche.dessinePar || '-'],
    ['Échelle', `1:${cartouche.echelle}`],
    ['Coordonnées', 'MN95 (m)'],
    ['Fichier de points', cartouche.fichierPoints || '-'],
  ];
  const hauteurLigne = 6;
  const yCartouche = PAGE.hauteur - PAGE.marge - 2 - lignesCartouche.length * hauteurLigne;
  trait(doc, COULEURS.texte, 0.3);
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

/** Choisit la couleur et l'épaisseur (mm) des traits. */
function trait(doc, couleur, epaisseur) {
  doc.setDrawColor(...couleur);
  doc.setLineWidth(epaisseur);
}
