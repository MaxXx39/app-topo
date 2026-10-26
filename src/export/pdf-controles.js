// PDF des autocontrôles (Terrain › Contrôle) : une feuille A4 paysage, le tableau des contrôles à
// gauche (dans le cadre du plan), à droite les tolérances, un résumé et le cartouche. Autant de
// feuilles que nécessaire si les contrôles ne tiennent pas sur une seule.
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { dateHeure } from '../topo/controle.js';
import { appliquerFormat, dessinerCadres, dessinerTitre, dessinerCartouche, COULEURS } from './pdf.js';

const COULEUR_RESULTAT = { vert: [21, 128, 61], orange: [234, 88, 12], rouge: [220, 38, 38] };
const MOT_RESULTAT = { vert: 'OK', orange: 'Limite', rouge: 'Hors tol.' };
const HAUTEUR_LIGNE = 5; // mm
// Colonnes du tableau (largeurs en mm, total adapté au cadre du plan A4 : environ 200 mm).
const COLONNES = [
  { titre: 'Date', largeur: 24, aligne: 'left' },
  { titre: 'Point', largeur: 20, aligne: 'left' },
  { titre: 'dE m', largeur: 14, aligne: 'right' },
  { titre: 'dN m', largeur: 14, aligne: 'right' },
  { titre: 'Plan m', largeur: 14, aligne: 'right' },
  { titre: 'dH m', largeur: 14, aligne: 'right' },
  { titre: 'Résultat', largeur: 17, aligne: 'left' },
  { titre: 'Préc. H/V m', largeur: 21, aligne: 'right' },
  { titre: 'Sat', largeur: 8, aligne: 'right' },
  { titre: 'Remarque', largeur: 42, aligne: 'left' },
];

/** Crée le PDF des contrôles du projet (les plus anciens d'abord). Renvoie un Blob. */
export function pdfControles(projet) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const controles = [...projet.controles].sort((a, b) => (a.le < b.le ? -1 : 1));
  const cartouche = {
    affaire: projet.cartouche?.affaire,
    lieu: projet.cartouche?.lieu,
    date: dateHeure(new Date().toISOString()).slice(0, 10),
    dessinePar: '',
    texteEchelle: '-',
    fichierPoints: `${projet.pointsControle.length} point(s) de contrôle`,
  };
  let mise = nouvelleFeuille(doc, projet, controles, cartouche, true);
  let y = enteteTableau(doc, mise);
  for (const controle of controles) {
    if (y > mise.cadrePlan.y + mise.cadrePlan.hauteur - 4) {
      doc.addPage('a4', 'landscape');
      mise = nouvelleFeuille(doc, projet, controles, cartouche, false);
      y = enteteTableau(doc, mise);
    }
    ligneControle(doc, mise, y, controle);
    y += HAUTEUR_LIGNE;
  }
  if (controles.length === 0) {
    doc.setFontSize(9);
    doc.text('Aucun contrôle enregistré.', mise.cadrePlan.x + 4, y + 2);
  }
  return doc.output('blob');
}

/** Cadres, colonne de droite (titre, tolérances, résumé) et cartouche d'une feuille. */
function nouvelleFeuille(doc, projet, controles, cartouche, premiere) {
  const mise = appliquerFormat('a4');
  dessinerCadres(doc);
  let y = dessinerTitre(doc, premiere ? 'Autocontrôles' : 'Autocontrôles (suite)');
  const x = mise.colonne.x;
  const t = projet.tolerancesControle;
  const cm = (m) => `${Math.round(m * 1000) / 10} cm`;
  doc.setFontSize(8);
  doc.setTextColor(...COULEURS.texte);
  doc.setFont('helvetica', 'bold');
  doc.text('Tolérances', x, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  for (const [titre, tol] of [['Plan', t.plan], ['Hauteur', t.hauteur]]) {
    doc.text(`${titre} : vert jusqu'à ${cm(tol.vert)}, orange jusqu'à ${cm(tol.orange)}`, x, y);
    y += 4.5;
  }
  y += 3;
  const mesures = controles.filter((c) => c.type === 'mesure');
  const compte = (couleur) => mesures.filter((c) => c.resultat.global === couleur).length;
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé', x, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  for (const [texte, couleur] of [
    [`${mesures.length} contrôle(s)`, COULEURS.texte],
    [`${compte('vert')} OK · ${compte('orange')} limite · ${compte('rouge')} hors tolérance`, COULEURS.texte],
    [`${controles.length - mesures.length} refus du contrôle`, controles.length > mesures.length ? COULEUR_RESULTAT.rouge : COULEURS.texte],
  ]) {
    doc.setTextColor(...couleur);
    doc.text(texte, x, y);
    y += 4.5;
  }
  doc.setTextColor(...COULEURS.texte);
  dessinerCartouche(doc, cartouche);
  return mise;
}

/** Titres des colonnes, en haut du cadre. Renvoie la position (mm) de la première ligne. */
function enteteTableau(doc, mise) {
  const y = mise.cadrePlan.y + 7;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COULEURS.gris);
  ecrire(doc, mise, y, COLONNES.map((c) => c.titre));
  doc.setDrawColor(...COULEURS.gris);
  doc.setLineWidth(0.15);
  doc.line(mise.cadrePlan.x + 2, y + 1.5, mise.cadrePlan.x + mise.cadrePlan.largeur - 2, y + 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COULEURS.texte);
  return y + HAUTEUR_LIGNE + 0.5;
}

/** Une ligne du tableau : un contrôle (couleur du résultat) ou un refus (en rouge). */
function ligneControle(doc, mise, y, c) {
  doc.setFontSize(7);
  if (c.type === 'refus') {
    doc.setTextColor(...COULEUR_RESULTAT.rouge);
    ecrire(doc, mise, y, [dateHeure(c.le), 'REFUS', '', '', '', '', 'Refusé', '', '', c.appareil ? `appareil : ${c.appareil}` : '']);
    doc.setTextColor(...COULEURS.texte);
    return;
  }
  const n = (valeur) => (valeur == null ? '-' : formaterNombre(valeur));
  const g = c.gnss ?? {};
  const valeurs = [
    dateHeure(c.le), c.nom, n(c.ecarts.est), n(c.ecarts.nord), n(c.ecarts.plan), n(c.ecarts.hauteur),
    MOT_RESULTAT[c.resultat.global], `${n(g.precisionH)} / ${n(g.precisionV)}`, g.nbSatellites ?? '-', c.remarque ?? '',
  ];
  ecrire(doc, mise, y, valeurs, { 4: c.resultat.plan, 5: c.resultat.hauteur, 6: c.resultat.global });
}

/** Écrit une ligne de valeurs dans les colonnes ; couleurs : { n° de colonne: 'vert' | 'orange' | 'rouge' }. */
function ecrire(doc, mise, y, valeurs, couleurs = {}) {
  let x = mise.cadrePlan.x + 3;
  COLONNES.forEach((colonne, i) => {
    const texte = doc.splitTextToSize(String(valeurs[i] ?? ''), colonne.largeur - 1)[0] ?? '';
    const couleur = COULEUR_RESULTAT[couleurs[i]];
    if (couleur) {
      doc.setTextColor(...couleur);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(texte, colonne.aligne === 'right' ? x + colonne.largeur - 1.5 : x, y, { align: colonne.aligne });
    if (couleur) {
      doc.setTextColor(...COULEURS.texte);
      doc.setFont('helvetica', 'normal');
    }
    x += colonne.largeur;
  });
}
