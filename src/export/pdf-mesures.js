// PDF des mesures (onglet Calculs › Mesures) : à part du PDF des volumes, il ne montre aucun volume.
// Une feuille paysage (A4, ou A3 si le plan ne tient pas en A4 à l'échelle choisie) :
// le plan à gauche (mesures en cyan pointillé), à droite le tableau des mesures, la légende
// et le cartouche. S'il y a trop de mesures pour la colonne, la suite va sur une feuille à part.
// Toutes les mesures sur la feuille sont en millimètres.
import { jsPDF } from 'jspdf';
import { choisirFormat } from './echelle.js';
import { courbesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';
import { nomsDeLaMesure } from '../topo/mesure.js';
import { VALEURS, NOM_TYPE, lignesEtiquette, texteMorceau, placeEtiquetteMesure, couleurDeMesure, rvbDeCouleur } from '../mesures/valeurs.js';
import {
  appliquerFormat,
  COULEURS,
  zoneDe,
  dessinerCadres,
  preparerProjection,
  preparerCadrePlan,
  terminerCadrePlan,
  polygonePlein,
  dessinerTitre,
  dessinerCartouche,
  dessinerPointsPdf,
  dessinerPagePhotos,
  PHOTOS_PAR_PAGE,
  trait,
} from './pdf.js';

// Cases du PDF des mesures, et leur état par défaut.
export const CALQUES_PDF_MESURES = {
  noms: true,
  altitudes: false,
  valeurs: true, // valeurs cochées de chaque mesure, et ses morceaux, écrites sur le plan
  courbes: false,
  photo: false,
  photoAttenuee: true,
  cadastre: false,
  photos: true, // photos des mesures, 4 par feuille à la fin
};
const couleur = (mesure) => rvbDeCouleur(couleurDeMesure(mesure));
const couleurFoncee = (mesure) => rvbDeCouleur(couleurDeMesure(mesure), 0.8);
const COULEUR_COURBES = [107, 79, 42];

/**
 * Crée le PDF des mesures.
 * - mesures : [{ mesure, resultat }] (mesures calculées, voir calculerMesure)
 * - points : points du levé
 * - cartouche : { affaire, date, dessinePar, fichierPoints }
 * - echelleImposee : dénominateur de l'échelle (500 pour 1:500), ou null pour la choisir
 * - calques : cases cochées (voir CALQUES_PDF_MESURES)
 * Renvoie { document, echelle, format, messageFond } (comme creerPdf).
 */
export async function creerPdfMesures({ mesures, points, cartouche, echelleImposee = null, calques = {} }) {
  const choix = { ...CALQUES_PDF_MESURES, ...calques };
  const messages = [];

  // Points montrés : ceux des mesures (sommets et points des triangles des aires).
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const noms = new Set(mesures.flatMap(({ mesure, resultat }) => [...nomsDeLaMesure(mesure), ...(resultat.triangles ?? []).flat().map((p) => p.nom)]));
  const pointsMontres = [...noms].map((nom) => parNom.get(nom)).filter(Boolean);
  const zone = zoneDe(pointsMontres);

  let format = 'a4';
  if (zone && echelleImposee) {
    const choixFormat = choisirFormat(zone.estMax - zone.estMin, zone.nordMax - zone.nordMin, echelleImposee);
    format = choixFormat.format;
    if (choixFormat.depasse) messages.push(`à l'échelle 1:${echelleImposee}, le plan dépasse la feuille A3 : il est coupé au cadre (choisis une échelle plus petite)`);
  }
  const mise = appliquerFormat(format);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  doc.setFont('helvetica', 'normal');
  dessinerCadres(doc);

  // Plan
  let echelle = echelleImposee ?? 500;
  let equidistance = null;
  if (zone) {
    const projection = preparerProjection(zone, echelleImposee);
    echelle = projection.echelle;
    const { messageFond, sources } = await preparerCadrePlan(doc, projection, choix);
    if (messageFond) messages.push(messageFond);
    equidistance = dessinerPlanMesures(doc, mesures, pointsMontres, projection, choix);
    terminerCadrePlan(doc, echelle, sources);
  }

  // Colonne de droite : titre, mesures, légende, cartouche
  const x = mise.colonne.x;
  let y = dessinerTitre(doc, 'Mesures');
  const yMax = mise.yCartouche - 22; // place pour la légende au-dessus du cartouche
  const restantes = ecrireMesures(doc, mesures, x, y, mise.colonne.largeur, yMax);
  y = restantes.y;
  if (mesures.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Aucune mesure calculée.', x, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }
  if (restantes.suite.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...COULEURS.gris);
    doc.text(`Suite (${restantes.suite.length} mesure(s)) sur la feuille suivante.`, x, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }
  dessinerLegende(doc, x, Math.max(y + 2, yMax), mise.colonne.largeur, equidistance);
  dessinerCartouche(doc, { ...cartouche, echelle });

  // Mesures qui ne tiennent pas dans la colonne : feuilles A4 à la suite, en 3 colonnes.
  let suite = restantes.suite;
  while (suite.length > 0) {
    const page = appliquerFormat('a4');
    doc.addPage('a4', 'landscape');
    trait(doc, COULEURS.texte, 0.4);
    doc.rect(page.page.marge, page.page.marge, page.page.largeur - 2 * page.page.marge, page.page.hauteur - 2 * page.page.marge);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COULEURS.texte);
    doc.text('Mesures (suite)', 14, 17);
    doc.setFillColor(...COULEURS.ambre);
    doc.rect(14, 19, 24, 0.9, 'F');
    const largeur = (page.page.largeur - 28 - 2 * 8) / 3;
    for (let colonne = 0; colonne < 3 && suite.length > 0; colonne++) {
      suite = ecrireMesures(doc, suite, 14 + colonne * (largeur + 8), 27, largeur, page.page.hauteur - 14).suite;
    }
  }
  // Photos des mesures : 4 par feuille A4, à la fin.
  const photos = choix.photos ? mesures.flatMap(({ mesure }) => (mesure.photos ?? []).map((photo) => ({ ...photo, surface: mesure.nom }))) : [];
  for (let debut = 0; debut < photos.length; debut += PHOTOS_PAR_PAGE) {
    appliquerFormat('a4');
    doc.addPage('a4', 'landscape');
    dessinerPagePhotos(doc, photos.slice(debut, debut + PHOTOS_PAR_PAGE), cartouche);
  }
  return { document: doc, echelle, format, messageFond: messages.join(' ; ') || null };
}

/**
 * Plan des mesures : courbes de niveau (sur les aires), mesures en cyan pointillé, points et noms,
 * puis les valeurs. Renvoie l'équidistance des courbes dessinées (m), ou null.
 */
function dessinerPlanMesures(doc, mesures, pointsMontres, { versPapier, echelle }, choix) {
  // Courbes de niveau sur les triangles des aires
  const triangles = mesures.flatMap(({ resultat }) => resultat.triangles ?? []);
  let equidistance = null;
  if (choix.courbes && triangles.length > 0) {
    const plage = plageAltitudes(triangles);
    equidistance = equidistanceAuto(plage.min, plage.max);
    for (const { altitude, a, b } of courbesDeNiveau(triangles, equidistance)) {
      const rang = altitude / (5 * equidistance);
      trait(doc, COULEUR_COURBES, Math.abs(rang - Math.round(rang)) < 1e-6 ? 0.25 : 0.1);
      const pa = versPapier(a);
      const pb = versPapier(b);
      doc.line(pa.x, pa.y, pb.x, pb.y);
    }
  }

  // Aires : fond léger de leur couleur, puis contours, lignes de rupture et longueurs en pointillé
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.12 }));
  for (const { mesure, resultat } of mesures) {
    if (mesure.type !== 'aire') continue;
    doc.setFillColor(...couleur(mesure));
    polygonePlein(doc, resultat.sommets.map(versPapier));
  }
  doc.restoreGraphicsState();
  const parNom = new Map(pointsMontres.map((p) => [p.nom, p]));
  const polyligne = (sommets, fermee) => {
    const papier = sommets.map(versPapier);
    for (let i = 0; i + 1 < papier.length; i++) doc.line(papier[i].x, papier[i].y, papier[i + 1].x, papier[i + 1].y);
    if (fermee && papier.length >= 3) doc.line(papier.at(-1).x, papier.at(-1).y, papier[0].x, papier[0].y);
  };
  for (const { mesure, resultat } of mesures) {
    if (mesure.type === 'aire') {
      trait(doc, couleur(mesure), 0.15);
      doc.setLineDashPattern([0.8, 0.8], 0);
      for (const ligne of mesure.lignesRupture) polyligne(ligne.noms.map((nom) => parNom.get(nom)).filter(Boolean), ligne.fermee);
    }
    trait(doc, couleur(mesure), 0.4);
    if (mesure.type === 'nombre') {
      // Points comptés : un rond de la couleur de la mesure autour de chacun.
      doc.setLineDashPattern([], 0);
      for (const point of resultat.sommets) {
        const p = versPapier(point);
        doc.circle(p.x, p.y, 1.4, 'S');
      }
      continue;
    }
    doc.setLineDashPattern([2, 1], 0);
    polyligne(resultat.sommets, mesure.type === 'aire');
  }
  doc.setLineDashPattern([], 0);

  dessinerPointsPdf(doc, pointsMontres, versPapier, echelle, choix);

  // Valeurs : texte de chaque morceau (le long du trait), puis l'étiquette de chaque mesure.
  const taille = echelle >= 1000 ? 5.5 : 6.5;
  for (const { mesure, resultat } of mesures) {
    if (choix.valeurs && mesure.afficher?.morceaux) {
      doc.setFontSize(taille - 1);
      doc.setTextColor(...couleurFoncee(mesure));
      for (const morceau of resultat.morceaux) {
        const a = versPapier(morceau.debut);
        const b = versPapier(morceau.fin);
        // Angle du trait sur la feuille, le texte restant toujours lisible (jamais à l'envers).
        let angle = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const radians = (angle * Math.PI) / 180;
        const texte = texteMorceau(mesure, morceau);
        // Le texte commence une demi-largeur avant le milieu du trait (le long du trait),
        // un peu au-dessus. (jsPDF ne sait pas centrer un texte tourné : on calcule le départ.)
        const demiLargeur = doc.getTextWidth(texte) / 2;
        const x = (a.x + b.x) / 2 - Math.cos(radians) * demiLargeur - Math.sin(radians) * 0.8;
        const y = (a.y + b.y) / 2 + Math.sin(radians) * demiLargeur - Math.cos(radians) * 0.8;
        doc.text(texte, x, y, { angle });
      }
    }
    const lignes = choix.valeurs ? lignesEtiquette(mesure, resultat) : [mesure.nom];
    const { x, y } = versPapier(placeEtiquetteMesure(mesure, resultat));
    const interligne = taille * 0.46;
    doc.setFontSize(taille);
    const largeur = Math.max(...lignes.map((l) => doc.getTextWidth(l))) + 3;
    const hauteur = lignes.length * interligne + 1.6;
    doc.setFillColor(255, 255, 255);
    trait(doc, couleur(mesure), 0.25);
    doc.roundedRect(x - largeur / 2, y - hauteur / 2, largeur, hauteur, 1, 1, 'FD');
    lignes.forEach((ligne, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.setTextColor(...(i === 0 ? couleurFoncee(mesure) : COULEURS.texte));
      doc.text(ligne, x, y - hauteur / 2 + 0.8 + interligne * (i + 0.85), { align: 'center' });
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COULEURS.texte);
  }
  return equidistance;
}

/**
 * Écrit les mesures l'une sous l'autre dans une colonne (x, y, largeur en mm), jusqu'à yMax :
 * le nom et la sorte, puis les valeurs cochées. Renvoie { y, suite } : position de la ligne
 * suivante et mesures qui n'ont pas tenu.
 */
function ecrireMesures(doc, mesures, x, y, largeur, yMax) {
  const interligne = 3.6;
  for (let i = 0; i < mesures.length; i++) {
    const { mesure, resultat } = mesures[i];
    const valeurs = VALEURS[mesure.type].filter((v) => mesure.afficher?.[v.cle]);
    const hauteur = (1 + Math.max(valeurs.length, 1)) * interligne + 1.5;
    if (y + hauteur > yMax) return { y, suite: mesures.slice(i) };
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...couleurFoncee(mesure));
    doc.text(doc.splitTextToSize(mesure.nom, largeur - 16)[0], x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COULEURS.gris);
    doc.text(NOM_TYPE[mesure.type], x + largeur - 1, y, { align: 'right' });
    y += interligne;
    doc.setFontSize(7);
    doc.setTextColor(...COULEURS.texte);
    if (valeurs.length === 0) {
      doc.setTextColor(...COULEURS.gris);
      doc.text('(aucune valeur cochée)', x + 2, y);
      y += interligne;
    }
    for (const valeur of valeurs) {
      doc.text(valeur.titre, x + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(valeur.ecrire(resultat), x + largeur - 1, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += interligne;
    }
    trait(doc, COULEURS.triangle, 0.1);
    doc.line(x, y - 2.2, x + largeur, y - 2.2);
    y += 1.5;
  }
  return { y, suite: [] };
}

/** Légende (en gris : chaque mesure a sa couleur) : longueur, aire, courbes de niveau, et ce que veulent dire 2D et 3D. */
function dessinerLegende(doc, x, y, largeur, equidistance) {
  doc.setFontSize(6.5);
  doc.setTextColor(...COULEURS.texte);
  trait(doc, COULEURS.gris, 0.5);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(x, y - 1, x + 6, y - 1);
  doc.text('Mesure de longueur', x + 8, y);
  doc.setFillColor(232, 235, 237);
  doc.rect(x, y + 1.6, 6, 2.6, 'FD');
  doc.setLineDashPattern([], 0);
  doc.text('Mesure d\'aire', x + 8, y + 3.8);
  y += 7.4;
  if (equidistance) {
    trait(doc, COULEUR_COURBES, 0.3);
    doc.line(x, y - 1, x + 6, y - 1);
    doc.text(`Courbes de niveau (équidistance ${equidistance} m)`, x + 8, y);
    y += 3.8;
  }
  doc.setFontSize(6);
  doc.setTextColor(...COULEURS.gris);
  const note = '2D : à plat. 3D : en tenant compte des altitudes (aire 3D : somme des triangles). Pente = dénivelé ÷ longueur 2D × 100.';
  doc.text(doc.splitTextToSize(note, largeur), x, y + 0.5);
  doc.setTextColor(...COULEURS.texte);
}
