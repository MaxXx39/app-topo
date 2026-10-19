// Export PDF : une feuille A4 paysage avec le plan à l'échelle, les volumes et un cartouche.
// Le plan est dessiné en traits (vectoriel) : il reste net à l'impression et au zoom.
// Toutes les mesures sur la feuille sont en millimètres.
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { placerEtiquettes, pointInterieur } from '../plan/etiquettes.js';
import { choisirEchelle, barreEchellePapier } from './echelle.js';

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
 * Renvoie { document, echelle } (document jsPDF, et dénominateur de l'échelle utilisée).
 */
export function creerPdf({ stocks, resultats, points, cartouche, echelleImposee = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  // Cadre général de la feuille
  trait(doc, COULEURS.texte, 0.4);
  doc.rect(PAGE.marge, PAGE.marge, PAGE.largeur - 2 * PAGE.marge, PAGE.hauteur - 2 * PAGE.marge);
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur);

  const calcules = stocks.map((stock, i) => ({ stock, resultat: resultats[i] })).filter(({ resultat }) => resultat && !resultat.erreurs);
  const echelle = dessinerPlan(doc, calcules, points, echelleImposee);
  dessinerColonne(doc, calcules, { ...cartouche, echelle });
  return { document: doc, echelle };
}

/** Dessine le plan dans son cadre, à l'échelle normalisée qui fait tout tenir. Renvoie l'échelle. */
function dessinerPlan(doc, calcules, points, echelleImposee) {
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
  if (pointsMontres.length === 0) return 500;

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

  // Tout ce qui sort du cadre du plan est coupé (utile si l'échelle imposée est trop grande).
  doc.saveGraphicsState();
  doc.rect(CADRE_PLAN.x, CADRE_PLAN.y, CADRE_PLAN.largeur, CADRE_PLAN.hauteur, null);
  doc.clip();
  doc.discardPath();

  // Triangles du dessus
  trait(doc, COULEURS.triangle, 0.08);
  for (const { resultat } of calcules) {
    for (const triangle of resultat.trianglesDessus) {
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
  const places = placerEtiquettes(
    positions.map(({ x, y }, i) => ({ x, y, largeur: doc.getTextWidth(pointsMontres[i].nom), hauteur: hauteurNom })),
    0.6,
  );
  places.forEach((place, i) => {
    if (place) doc.text(pointsMontres[i].nom, place.x, place.y, { align: place.aGauche ? 'right' : 'left' });
  });

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
  return echelle;
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
function dessinerColonne(doc, calcules, cartouche) {
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
    [COULEURS.triangle, 'Triangulation du dessus'],
  ];
  for (const [couleur, texte] of legende) {
    trait(doc, couleur, 0.5);
    doc.line(x, y - 1, x + 6, y - 1);
    doc.text(texte, x + 8, y);
    y += 3.4;
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
