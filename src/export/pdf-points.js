// PDF d'une liste de points (0.104.2, Projet › Exporter › Listes de points) : un tableau avec toutes
// les infos connues de chaque point (mêmes colonnes que le CSV), sur A4 paysage, autant de feuilles
// que nécessaire. Option : des feuilles de photos à la suite (les photos rattachées aux points).
import { jsPDF } from 'jspdf';
import { TITRES_INFOS, infosDuPoint } from './points.js';
import { appliquerFormat, dessinerPagePhotos, PHOTOS_PAR_PAGE, COULEURS } from './pdf.js';

const MARGE = 10; // mm
const HAUTEUR_LIGNE = 5.2;
// Largeur et alignement des colonnes (mm ; total 277 = largeur utile de l'A4 paysage). g = gauche, d = droite.
const COLONNES = [
  ['g', 27], ['d', 24], ['d', 24], ['d', 19], ['g', 33], ['g', 19], ['g', 16], ['d', 14], ['d', 14], ['g', 19], ['d', 11], ['d', 11], ['d', 15], ['d', 13], ['g', 18],
];
const TITRES = [...TITRES_INFOS.map((t) => t.replace('Précision', 'Préc.').replace('Âge corrections', 'Âge corr.').replace('Satellites', 'Sat.')), 'Photo'];

/**
 * Crée le PDF. { titre (nom de la liste), points, roles (Map nom → rôle), cartouche ({ affaire, date }),
 * photos (facultatif : [{ point, image (JPEG), largeur, hauteur, legende, surface }]) }. Renvoie un Blob.
 */
export function pdfPoints({ titre, points, roles = new Map(), cartouche = {}, photos = [] }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const avecPhoto = new Set(photos.map((p) => p.point).filter(Boolean));
  let page = 0;
  const feuille = () => {
    if (page++ > 0) doc.addPage('a4', 'landscape');
    doc.setTextColor(...COULEURS.texte);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(page === 1 ? titre : `${titre} (suite)`, MARGE, 14);
    doc.setFillColor(...COULEURS.ambre);
    doc.rect(MARGE, 16, 24, 0.9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COULEURS.gris);
    const entete = [cartouche.affaire ? `Affaire ${cartouche.affaire}` : null, `${points.length} point(s)`, cartouche.date || null].filter(Boolean).join(' · ');
    doc.text(entete, 297 - MARGE, 14, { align: 'right' });
    return enteteTableau(doc, 24);
  };
  let y = feuille();
  for (const p of points) {
    if (y > 210 - MARGE - HAUTEUR_LIGNE) y = feuille();
    ligne(doc, y, [...infosDuPoint(p, roles), avecPhoto.has(p.nom) ? 'oui' : ''], false);
    y += HAUTEUR_LIGNE;
  }
  if (points.length === 0) {
    doc.setFontSize(9);
    doc.text('Aucun point.', MARGE + 2, y + 2);
  }
  // Feuilles de photos à la suite (case « avec les photos »).
  if (photos.length > 0) {
    appliquerFormat('a4');
    for (let debut = 0; debut < photos.length; debut += PHOTOS_PAR_PAGE) {
      doc.addPage('a4', 'landscape');
      dessinerPagePhotos(doc, photos.slice(debut, debut + PHOTOS_PAR_PAGE), cartouche);
    }
  }
  return doc.output('blob');
}

/** Ligne de titres du tableau (fond gris) ; renvoie le y de la première ligne de points. */
function enteteTableau(doc, y) {
  doc.setFillColor(232, 236, 239);
  doc.rect(MARGE, y - 3.8, 277, HAUTEUR_LIGNE, 'F');
  ligne(doc, y, TITRES, true);
  return y + HAUTEUR_LIGNE;
}

/** Une ligne de texte, une case par colonne (texte coupé s'il ne tient pas). */
function ligne(doc, y, textes, gras) {
  doc.setFont('helvetica', gras ? 'bold' : 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COULEURS.texte);
  let x = MARGE;
  COLONNES.forEach(([aligne, largeur], i) => {
    const texte = doc.splitTextToSize(String(textes[i] ?? ''), largeur - 2)[0] ?? '';
    doc.text(texte, aligne === 'd' ? x + largeur - 1 : x + 1, y, { align: aligne === 'd' ? 'right' : 'left' });
    x += largeur;
  });
  if (!gras) {
    doc.setDrawColor(225, 229, 232);
    doc.setLineWidth(0.1);
    doc.line(MARGE, y + 1.4, MARGE + 277, y + 1.4);
  }
}
