// PDF du planning d'un mois pour la comptabilité (0.275.0), repris de l'appli d'origine (export_mois.py) :
// A4 paysage, colonnes catégorie (verticale) / N° MS à facturer / n° interne / un jour par colonne, barres
// « n° – chantier – responsable · n j » à la couleur de l'article, week-ends grisés, petits triangles en
// bout de barre quand l'affectation continue sur le mois voisin. Police : Helvetica (celle de jsPDF).
import { jsPDF } from 'jspdf';
import { MOIS, JOURS_COURTS } from './planning.js';
import { dateSuisse } from './donnees.js';

const MARGE = 22;
const H_TITRE = 30;
const H_TETE = 26;
const H_PIED = 16;
const L_CAT = 36;
const L_CODE = 36;
const L_NUM = 74;
const MIN_LIGNES_GROUPE = 3; // hauteur minimale d'une catégorie, pour que son nom reste lisible
const GRIS_WE = '#ECECEC';
const GRIS_CAT = '#E4E4E4';
const GRIS_CODE = '#D9D9D9';

/** Couleur '#rrggbb' assombrie (bord des barres). */
function fonce(hexa, facteur = 0.6) {
  const h = String(hexa).replace('#', '');
  return [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * facteur));
}

/**
 * PDF (Blob) du mois. donnees : donneesDuMois(parc, annee, mois) (sans la veille) ; edite : date du jour 'AAAA-MM-JJ'.
 */
export function pdfDuMois(donnees, edite) {
  const { annee, mois, n, jours, groupes } = donnees;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: `Planning du matériel – ${MOIS[mois - 1]} ${annee}` });

  const x0 = MARGE;
  const x1 = largeurPage - MARGE;
  const xCode = x0 + L_CAT;
  const xNum = xCode + L_CODE;
  const xJours = xNum + L_NUM;
  const lJour = (x1 - xJours) / n;
  const xj = (j) => xJours + (j - 1) * lJour;
  const tTete = MARGE + H_TITRE;
  const tLignes = tTete + H_TETE;
  const tFin = hauteurPage - MARGE - H_PIED;

  const police = (style, taille) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(taille);
  };
  const largeur = (texte, style, taille) => {
    police(style, taille);
    return doc.getTextWidth(texte);
  };
  const ecrire = (x, y, texte, style, taille, { centre = false, droite = false, couleur = [0, 0, 0] } = {}) => {
    police(style, taille);
    doc.setTextColor(...couleur);
    doc.text(texte, x, y, { align: centre ? 'center' : droite ? 'right' : 'left' });
  };
  const trait = (xa, ya, xb, yb, epaisseur, couleur = [0, 0, 0]) => {
    doc.setDrawColor(...couleur);
    doc.setLineWidth(epaisseur);
    doc.line(xa, ya, xb, yb);
  };
  const rect = (x, y, w, h, fond) => {
    doc.setFillColor(fond);
    doc.rect(x, y, w, h, 'F');
  };
  const couper = (texte, style, taille, place) => {
    if (largeur(texte, style, taille) <= place) return texte;
    let t = texte;
    while (t && largeur(`${t}…`, style, taille) > place) t = t.slice(0, -1);
    return t ? `${t}…` : '';
  };
  const triangle = (xPointe, yMilieu, sens, couleur) => {
    doc.setFillColor(...couleur);
    doc.triangle(xPointe, yMilieu, xPointe - sens * 4.5, yMilieu - 3.2, xPointe - sens * 4.5, yMilieu + 3.2, 'F');
  };

  // Morceaux de texte d'une barre qui tiennent dans « place » (ou [] si même le n° ne tient pas).
  const grisResp = [77, 77, 77];
  const texteBarre = (b, taille, place) => {
    const jours = [` · ${b.nbJours} j`, 'normal', taille, [0, 0, 0]];
    const resp = b.responsable ? [` – ${b.responsable}`, 'italic', taille - 0.8, grisResp] : null;
    const essais = resp ? [[[b.principal, 'normal', taille, [0, 0, 0]], resp, jours]] : [];
    essais.push([[b.principal, 'normal', taille, [0, 0, 0]], jours]);
    for (const morceaux of essais) {
      if (morceaux.reduce((s, m) => s + largeur(m[0], m[1], m[2]), 0) <= place) return morceaux;
    }
    const reste = place - largeur(jours[0], 'normal', taille);
    const court = couper(b.principal, 'normal', taille, reste);
    return reste > 18 && court ? [[court, 'normal', taille, [0, 0, 0]], jours] : [];
  };
  const dessinerMorceaux = (x, y, morceaux, centre) => {
    const total = morceaux.reduce((s, m) => s + largeur(m[0], m[1], m[2]), 0);
    let xx = centre ? x - total / 2 : x;
    for (const [texte, style, taille, couleur] of morceaux) {
      ecrire(xx, y, texte, style, taille, { couleur });
      xx += largeur(texte, style, taille);
    }
  };

  // Titre
  const titre = `${MOIS[mois - 1].toUpperCase()} ${annee}`;
  ecrire(x0, MARGE + 17, titre, 'bold', 17);
  ecrire(x0 + largeur(titre, 'bold', 17) + 10, MARGE + 17, 'Planning du matériel – à facturer par chantier', 'normal', 9, { couleur: [89, 89, 89] });

  // Hauteurs : chaque catégorie a au moins MIN_LIGNES_GROUPE unités.
  const unites = groupes.length ? groupes.map((g) => Math.max(g.articles.length, MIN_LIGNES_GROUPE)) : [1];
  const hUnite = (tFin - tLignes) / unites.reduce((s, u) => s + u, 0);

  // Fonds : week-ends, colonne code, en-tête
  for (const jour of jours) if (jour.semaine >= 5) rect(xj(jour.j), tTete, lJour, tFin - tTete, GRIS_WE);
  rect(xCode, tTete, L_CODE, tFin - tTete, GRIS_CODE);
  ecrire(xCode + L_CODE / 2, tTete + 11, 'N° MS', 'bold', 6.5, { centre: true });
  ecrire(xCode + L_CODE / 2, tTete + 19, 'à facturer', 'normal', 6.5, { centre: true });
  ecrire(xNum + 3, tTete + 16, 'N° interne', 'bold', 6.5);
  for (const jour of jours) {
    const xc = xj(jour.j) + lJour / 2;
    ecrire(xc, tTete + 11, String(jour.j), 'bold', 8.5, { centre: true });
    ecrire(xc, tTete + 20.5, JOURS_COURTS[jour.semaine], 'normal', 6.5, { centre: true, couleur: [77, 77, 77] });
  }
  // Séparations des jours (traits plus marqués le lundi)
  for (const jour of jours.slice(1)) {
    const lundi = jour.semaine === 0;
    trait(xj(jour.j), tTete, xj(jour.j), tFin, lundi ? 0.6 : 0.25, lundi ? [115, 115, 115] : [184, 184, 184]);
  }

  // Articles et barres
  let t = tLignes;
  const limites = [tLignes];
  groupes.forEach((g, ig) => {
    const hLigne = (hUnite * unites[ig]) / g.articles.length;
    const tGroupe = t;
    g.articles.forEach(({ article, barres }, i) => {
      rect(xNum, t, L_NUM, hLigne, article.couleur);
      ecrire(xCode + L_CODE / 2, t + hLigne / 2 + 2.8, couper(article.codeCompta, 'normal', 8, L_CODE - 3), 'normal', 8, { centre: true });
      let taille = 8.5;
      while (taille > 6 && largeur(article.numero, 'bold', taille) > L_NUM - 5) taille -= 0.25;
      ecrire(xNum + 3, t + hLigne / 2 + taille / 3, couper(article.numero, 'bold', taille, L_NUM - 5), 'bold', taille);
      const margeV = Math.min(2.2, hLigne * 0.12);
      barres.forEach((b) => {
        const bx1 = xj(b.j1) + 0.8;
        const bx2 = xj(b.j2 + 1) - 0.8;
        const bh = hLigne - 2 * margeV;
        doc.setFillColor(article.couleur);
        doc.setDrawColor(...fonce(article.couleur));
        doc.setLineWidth(0.7);
        doc.roundedRect(bx1, t + margeV, bx2 - bx1, bh, 2, 2, 'FD');
        const milieu = t + hLigne / 2;
        if (b.avant) triangle(bx1 + 2, milieu, -1, fonce(article.couleur));
        if (b.apres) triangle(bx2 - 2, milieu, 1, fonce(article.couleur));
        const tailleB = bh >= 11 ? 7 : 6;
        const retrait = 8 * (Number(b.avant) + Number(b.apres));
        const yTexte = milieu + tailleB * 0.35;
        const morceaux = texteBarre(b, tailleB, bx2 - bx1 - 4 - retrait);
        if (morceaux.length) {
          dessinerMorceaux((bx1 + bx2) / 2 + 4 * (Number(b.avant) - Number(b.apres)), yTexte, morceaux, true);
        } else {
          // Barre trop courte : texte à droite si les jours suivants sont libres.
          const suivante = barres.find((x) => x.j1 > b.j2);
          const dehors = texteBarre(b, tailleB - 0.5, (suivante ? xj(suivante.j1) : x1) - bx2 - 3);
          if (dehors.length) dessinerMorceaux(bx2 + 2, yTexte, dehors, false);
          else dessinerMorceaux((bx1 + bx2) / 2, yTexte, [[couper(`${b.nbJours} j`, 'normal', tailleB, bx2 - bx1 - 2), 'normal', tailleB, [0, 0, 0]]], true);
        }
      });
      t += hLigne;
      if (i < g.articles.length - 1) trait(xCode, t, x1, t, 0.3, [153, 153, 153]);
    });
    // Nom de la catégorie, vertical, sur fond gris clair
    const hGroupe = t - tGroupe;
    rect(x0, tGroupe, L_CAT, hGroupe, GRIS_CAT);
    let taille = 7.5;
    police('bold', taille);
    let lignes = doc.splitTextToSize(g.categorie.nom, hGroupe - 6);
    while (lignes.length * (taille + 1) > L_CAT - 4 && taille > 5) {
      taille -= 0.5;
      police('bold', taille);
      lignes = doc.splitTextToSize(g.categorie.nom, hGroupe - 6);
    }
    const bloc = lignes.length * (taille + 1);
    lignes.forEach((ligne, k) => {
      const w = largeur(ligne, 'bold', taille);
      doc.setTextColor(0, 0, 0);
      doc.text(ligne, x0 + L_CAT / 2 - bloc / 2 + (k + 1) * (taille + 1) - 2, tGroupe + hGroupe / 2 + w / 2, { angle: 90 });
    });
    limites.push(t);
  });

  // Cadres
  for (const y of limites) trait(x0, y, x1, y, 0.8);
  trait(xCode, tTete, xCode, tFin, 0.5);
  trait(xNum, tTete, xNum, tFin, 0.5);
  trait(xJours, tTete, xJours, tFin, 0.8);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(x0, tTete, x1 - x0, tFin - tTete, 'S');

  // Pied de page
  const gris = [102, 102, 102];
  triangle(x0 + 1, tFin + 9, -1, gris);
  triangle(x0 + 13, tFin + 9, 1, gris);
  ecrire(x0 + 17, tFin + 11, 'en bout de barre : l\'affectation continue le mois précédent / suivant   ·   j = nombre de jours dans le mois   ·   fond gris = week-end', 'normal', 6.5, { couleur: gris });
  ecrire(x1, tFin + 11, `Édité le ${dateSuisse(edite)}`, 'normal', 6.5, { droite: true, couleur: gris });
  return doc.output('blob');
}
