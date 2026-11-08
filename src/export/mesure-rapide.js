// Export d'une mesure rapide (0.158.0, validé le 08.11) :
// - PDF (A4 portrait) : le croquis de la mesure (points numérotés, longueur 2D de chaque côté),
//   le résumé (longueurs, Δh, pente ou périmètres et surfaces), puis les tableaux des points et des
//   côtés, sur autant de feuilles que nécessaire ;
// - DXF (R12, MN95) : calques MESURE_POINTS (points 3D), MESURE_NOMS (numéro / nom), MESURE_LIGNES
//   (polyligne 3D, fermée dès 3 points) et MESURE_TEXTES (longueur de chaque côté, résumé).
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { COULEURS } from './pdf.js';
import { ecrireDxf, xyz, texteCentre, texteAscii, polyligne3D } from './dxf.js';

const MARGE = 15; // mm
const VIOLET = [124, 58, 237];

const nombre = (valeur) => (valeur == null ? '—' : formaterNombre(valeur));
const pente = (valeur) => (valeur == null ? '—' : `${valeur.toFixed(2)} %`);

/** Lignes du résumé : [libellé, valeur]. */
export function lignesResume(mesure) {
  const { points, cotes, ferme } = mesure;
  if (points.length === 1) {
    const p = points[0];
    return [['Nom', p.nom || '—'], ['Est', nombre(p.est)], ['Nord', nombre(p.nord)], ['Altitude', nombre(p.altitude)]];
  }
  if (points.length === 2) {
    const c = cotes[0];
    return [
      ['Longueur 2D', `${nombre(c.longueur2d)} m`], ['Longueur 3D', `${nombre(c.longueur3d)} m`],
      ['Altitude 1', nombre(points[0].altitude)], ['Altitude 2', nombre(points[1].altitude)],
      ['Δh', `${nombre(c.deltaH)} m`], ['Pente', pente(c.pente)],
    ];
  }
  if (points.length >= 3) {
    return [
      ['Périmètre 2D', `${nombre(ferme.perimetre2d)} m`], ['Périmètre 3D', `${nombre(ferme.perimetre3d)} m`],
      ['Surface 2D', `${nombre(ferme.surface2d)} m²`], ['Surface 3D', `${nombre(ferme.surface3d)} m²`],
    ];
  }
  return [];
}

/** Nom affiché d'un point de la mesure : son nom s'il en a un, sinon son numéro. */
const nomDuPoint = (p, i) => p.nom || String(i + 1);

/** PDF de la mesure. { mesure, titre, cartouche: { affaire, date } } → Blob. */
export function pdfMesureRapide({ mesure, titre = 'Mesure rapide', cartouche = {} }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largeur = 210 - 2 * MARGE;
  let y = 18;
  doc.setTextColor(...COULEURS.texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titre, MARGE, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COULEURS.gris);
  doc.text([cartouche.affaire ? `Affaire ${cartouche.affaire}` : null, cartouche.date || null].filter(Boolean).join(' · '), 210 - MARGE, y, { align: 'right' });
  doc.setFillColor(...COULEURS.ambre);
  doc.rect(MARGE, y + 2, 24, 0.9, 'F');
  y += 8;
  y = croquis(doc, mesure, MARGE, y, largeur, 110) + 6;
  // Résumé.
  doc.setTextColor(...COULEURS.texte);
  doc.setFontSize(10);
  for (const [libelle, valeur] of lignesResume(mesure)) {
    doc.setFont('helvetica', 'normal');
    // Les polices du PDF n'ont pas « Δ » : « Diff. altitude ».
    doc.text(libelle.replace('Δh', 'Diff. altitude'), MARGE, y);
    doc.setFont('helvetica', 'bold');
    doc.text(valeur, MARGE + 45, y);
    y += 5.5;
  }
  y += 4;
  // Tableaux.
  y = tableau(doc, y, 'Points', ['N°', 'Nom', 'Est', 'Nord', 'Altitude'], [12, 48, 40, 40, 30],
    mesure.points.map((p, i) => [String(i + 1), p.nom || '—', nombre(p.est), nombre(p.nord), nombre(p.altitude)]));
  if (mesure.cotes.length > 0) {
    tableau(doc, y + 4, 'Côtés', ['Côté', 'Long. 2D', 'Long. 3D', 'Diff. alt.', 'Pente'], [30, 37, 37, 33, 33],
      mesure.cotes.map((c) => [`${c.de} - ${c.a}`, nombre(c.longueur2d), nombre(c.longueur3d), nombre(c.deltaH), pente(c.pente)]));
  }
  return doc.output('blob');
}

/** Croquis de la mesure dans le cadre (x, y, l, h) mm, à l'échelle, nord en haut. Renvoie le bas du cadre. */
function croquis(doc, { points, cotes }, x, y, l, h) {
  doc.setDrawColor(...COULEURS.triangle);
  doc.setLineWidth(0.2);
  doc.rect(x, y, l, h);
  const est = points.map((p) => p.est);
  const nord = points.map((p) => p.nord);
  const [eMin, eMax, nMin, nMax] = [Math.min(...est), Math.max(...est), Math.min(...nord), Math.max(...nord)];
  const etendue = Math.max(eMax - eMin, nMax - nMin, 1);
  const echelle = Math.min((l - 24) / Math.max(eMax - eMin, etendue * 0.2), (h - 24) / Math.max(nMax - nMin, etendue * 0.2));
  const versPage = (p) => [x + l / 2 + (p.est - (eMin + eMax) / 2) * echelle, y + h / 2 - (p.nord - (nMin + nMax) / 2) * echelle];
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.5);
  doc.setFontSize(7);
  for (const c of cotes) {
    const [x1, y1] = versPage(points[c.de - 1]);
    const [x2, y2] = versPage(points[c.a - 1]);
    doc.line(x1, y1, x2, y2);
    doc.setTextColor(...VIOLET);
    doc.text(nombre(c.longueur2d), (x1 + x2) / 2, (y1 + y2) / 2 - 1, { align: 'center' });
  }
  doc.setFillColor(...VIOLET);
  doc.setTextColor(...COULEURS.texte);
  points.forEach((p, i) => {
    const [px, py] = versPage(p);
    doc.circle(px, py, 1, 'F');
    doc.text(nomDuPoint(p, i), px + 1.8, py - 1.8);
  });
  // Nord.
  doc.setDrawColor(...COULEURS.texte);
  doc.line(x + l - 8, y + 14, x + l - 8, y + 5);
  doc.line(x + l - 8, y + 5, x + l - 10, y + 8);
  doc.line(x + l - 8, y + 5, x + l - 6, y + 8);
  doc.text('N', x + l - 8, y + 18, { align: 'center' });
  return y + h;
}

/** Tableau avec titre ; nouvelle feuille si besoin (en-têtes répétés). Renvoie le y après le tableau. */
function tableau(doc, y, titre, entetes, colonnes, lignes) {
  const hauteurLigne = 5.5;
  const entete = (yy, suite) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COULEURS.texte);
    doc.text(suite ? `${titre} (suite)` : titre, MARGE, yy);
    yy += 5;
    doc.setFontSize(8.5);
    let xx = MARGE;
    entetes.forEach((t, i) => {
      doc.text(t, xx + 1, yy);
      xx += colonnes[i];
    });
    doc.setDrawColor(...COULEURS.texte);
    doc.line(MARGE, yy + 1.5, MARGE + colonnes.reduce((a, b) => a + b, 0), yy + 1.5);
    doc.setFont('helvetica', 'normal');
    return yy + hauteurLigne;
  };
  if (y > 297 - MARGE - 20) {
    doc.addPage('a4', 'portrait');
    y = 18;
  }
  y = entete(y, false);
  for (const ligne of lignes) {
    if (y > 297 - MARGE) {
      doc.addPage('a4', 'portrait');
      y = entete(18, true);
    }
    let xx = MARGE;
    ligne.forEach((valeur, i) => {
      doc.text(String(valeur), xx + 1, y);
      xx += colonnes[i];
    });
    y += hauteurLigne;
  }
  return y;
}

/** Texte du DXF de la mesure (MN95 ; altitude inconnue écrite à 0). */
export function dxfMesureRapide(mesure) {
  const calques = new Map([['MESURE_POINTS', 6], ['MESURE_NOMS', 8], ['MESURE_LIGNES', 6], ['MESURE_TEXTES', 6]]);
  const entites = [];
  mesure.points.forEach((p, i) => {
    entites.push(['0', 'POINT', '8', 'MESURE_POINTS', ...xyz(p, 0)]);
    entites.push(['0', 'TEXT', '8', 'MESURE_NOMS', ...xyz({ est: p.est + 0.2, nord: p.nord + 0.2, altitude: p.altitude }, 0), '40', '0.3', '1', texteAscii(nomDuPoint(p, i))]);
  });
  if (mesure.points.length >= 2) {
    entites.push(...polyligne3D(mesure.points, mesure.points.length >= 3, 'MESURE_LIGNES'));
    for (const c of mesure.cotes) {
      const a = mesure.points[c.de - 1];
      const b = mesure.points[c.a - 1];
      let angle = (Math.atan2(b.nord - a.nord, b.est - a.est) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const milieu = { est: (a.est + b.est) / 2, nord: (a.nord + b.nord) / 2, altitude: 0 };
      entites.push(texteCentre(milieu, 0.25, angle, texteAscii(`${formaterNombre(c.longueur2d)} m`), 'MESURE_TEXTES'));
    }
  }
  // Résumé : sous le point le plus au sud-ouest, une ligne de texte par valeur.
  const depart = { est: Math.min(...mesure.points.map((p) => p.est)), nord: Math.min(...mesure.points.map((p) => p.nord)) - 1, altitude: 0 };
  lignesResume(mesure).forEach(([libelle, valeur], i) => {
    entites.push(['0', 'TEXT', '8', 'MESURE_TEXTES', ...xyz({ ...depart, nord: depart.nord - i * 0.5 }, 0), '40', '0.3', '1', texteAscii(`${libelle.replace('Δh', 'Dh')} : ${valeur}`)]);
  });
  return ecrireDxf(calques, entites);
}
