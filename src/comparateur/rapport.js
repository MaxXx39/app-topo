// Comparer des PDF (0.282.0) : rapport PDF avec pdf-lib (bibliothèque acceptée le 22.11, chargée seulement ici).
// Une page par planche, de la taille du plan A : la page du nouvel indice (B) posée en VECTORIEL (traits nets), par-dessus
// les différences en couleur (image transparente : rouge = supprimé, bleu = ajouté), les nuages numérotés et les
// annotations. Puis la liste des modifications sur des pages A3 paysage (avant → après, état, commentaire, qui).
import { texteWinAnsi, poseDeB, arcsDeNuage, titreModification } from '../topo/comparaison-pdf.js';
import { octetsDeBase64 } from './lecture.js';

const ETATS = { traiter: 'à traiter', validee: 'validée', ignoree: 'ignorée' };
const A3_PAYSAGE = [1190.55, 841.89];

/** Chemin SVG (y vers le bas) d'un nuage de révision autour d'un rectangle. */
export function cheminNuage(rect, pas = 12) {
  return arcsDeNuage(rect, pas).map(([cx, cy, r, a0, a1]) => {
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }).join(' ');
}

/**
 * Crée le rapport. planches : [{ planche, titre, docBOctets (octets du PDF de B), pageB, tailleA { largeur, hauteur },
 * tailleB, imageDifferences (octets PNG, transparent hors différences) }] ; comparaison ; options { modifications
 * (liste), avecIgnorees, avecCommentaires, avecPlanches } ; cartouche { affaire, projet, date }. Renvoie les octets.
 */
export async function creerRapport({ comparaison, planches, options, cartouche }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(texteWinAnsi(`Comparaison ${comparaison.nom}`));
  pdf.setCreator('Topo');
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ROUGE = rgb(0.86, 0.15, 0.15);
  const BLEU = rgb(0.15, 0.39, 0.92);
  const ORANGE = rgb(0.85, 0.47, 0.02);
  const VERT = rgb(0.08, 0.5, 0.24);
  const GRIS = rgb(0.4, 0.43, 0.47);
  const NUIT = rgb(0.106, 0.169, 0.212);
  const sources = new Map();
  const garder = (m) => options.avecIgnorees || m.etat !== 'ignoree';

  if (options.avecPlanches) {
    for (const p of planches) {
      const { largeur: WA, hauteur: HA } = p.tailleA;
      const page = pdf.addPage([WA, HA]);
      // Fond vectoriel : le plan B posé (comme avant), le plan A tel quel, ou rien (superposition grise en image).
      if (p.fond !== 'gris') {
        const parA = p.fond === 'a';
        const idFichier = parA ? p.fichierA : p.fichierB;
        const octetsFond = parA ? p.docAOctets : p.docBOctets;
        const numero = parA ? p.pageA : p.pageB;
        if (!sources.has(idFichier)) sources.set(idFichier, await PDFDocument.load(octetsFond, { ignoreEncryption: true }));
        const [embarquee] = await pdf.embedPages([sources.get(idFichier).getPage(numero - 1)]);
        if (parA) page.drawPage(embarquee, { x: 0, y: 0 });
        else {
          const pose = poseDeB(p.planche.alignement, HA, p.tailleB.hauteur);
          page.drawPage(embarquee, { x: pose.x, y: pose.y, xScale: pose.echelle, yScale: pose.echelle, rotate: { type: 'degrees', angle: pose.rotationDeg } });
        }
      }
      if (p.imageDifferences) {
        const img = await pdf.embedPng(p.imageDifferences);
        page.drawImage(img, { x: 0, y: 0, width: WA, height: HA });
      }
      // Différences en traits vectoriels (A seul / B seul), dans les couleurs choisies.
      const cA = rgb(...hexVersRgb(comparaison.couleurs?.a ?? '#dc2626'));
      const cB = rgb(...hexVersRgb(comparaison.couleurs?.b ?? '#2563eb'));
      for (const [liste, couleur] of [[p.traitsA ?? [], cA], [p.traitsB ?? [], cB]]) {
        for (const t of liste) page.drawLine({ start: { x: t[0], y: HA - t[1] }, end: { x: t[2], y: HA - t[3] }, thickness: 0.9, color: couleur });
      }
      // Nuages numérotés.
      for (const m of p.planche.modifications.filter(garder)) {
        const couleur = m.etat === 'validee' ? VERT : m.etat === 'ignoree' ? GRIS : ORANGE;
        page.drawSvgPath(cheminNuage(m, Math.max(6, Math.min(m.w, m.h) / 4)), { x: 0, y: HA, borderColor: couleur, borderWidth: 1.2 });
        const bx = m.x - 2;
        const by = HA - (m.y - 2);
        page.drawCircle({ x: bx, y: by, size: 7, color: couleur });
        const n = String(m.n);
        page.drawText(n, { x: bx - gras.widthOfTextAtSize(n, 7.5) / 2, y: by - 2.7, size: 7.5, font: gras, color: rgb(1, 1, 1) });
      }
      // Annotations.
      for (const a of p.planche.annotations ?? []) dessinerAnnotation(page, a, HA, { police, rgb, BLEU });
      // Bandeau du haut.
      const titre = texteWinAnsi(`${comparaison.nom} - ${p.titre}`);
      page.drawRectangle({ x: 8, y: HA - 22, width: Math.min(WA - 16, police.widthOfTextAtSize(titre, 8) + 120), height: 16, color: rgb(1, 1, 1), opacity: 0.9 });
      page.drawText(titre, { x: 12, y: HA - 17, size: 8, font: gras, color: NUIT });
      // Légende : carrés aux couleurs choisies pour A (supprimé) et B (ajouté) ; gris = identique (superposition grise).
      let lx = 18 + gras.widthOfTextAtSize(titre, 8);
      for (const [texte, couleur] of [['supprime (A)', cA], ['ajoute (B)', cB], ...(p.fond === 'gris' ? [['identique', GRIS]] : [])]) {
        page.drawRectangle({ x: lx, y: HA - 18, width: 7, height: 7, color: couleur });
        page.drawText(texte, { x: lx + 10, y: HA - 17, size: 7, font: police, color: GRIS });
        lx += 18 + police.widthOfTextAtSize(texte, 7);
      }
    }
  }

  // Liste des modifications (A3 paysage).
  const lignes = [];
  for (const p of planches) {
    for (const m of p.planche.modifications.filter(garder)) {
      lignes.push([
        String(m.n), p.titre, titreModification(m),
        (m.textes ?? []).map((t) => (t.avant && t.apres ? `${t.avant} -> ${t.apres}` : t.apres ? `+ ${t.apres}` : `- ${t.avant}`)).join(' ; '),
        ETATS[m.etat] ?? m.etat, options.avecCommentaires ? (m.commentaire ?? '') : '', m.par ?? '',
      ].map(texteWinAnsi));
    }
  }
  const colonnes = [['N°', 34], ['Planche', 180], ['Modification', 140], ['Avant -> après', 300], ['État', 70], ['Commentaire', 300], ['Par', 90]];
  const [W, H] = A3_PAYSAGE;
  const parPage = 34;
  const nbPages = Math.max(1, Math.ceil(lignes.length / parPage));
  for (let k = 0; k < nbPages; k += 1) {
    const page = pdf.addPage(A3_PAYSAGE);
    page.drawText(texteWinAnsi(`Comparaison : ${comparaison.nom}`), { x: 40, y: H - 50, size: 16, font: gras, color: NUIT });
    page.drawText(texteWinAnsi(`${lignes.length} modification(s) - A = ancien indice (supprimé), B = nouvel indice (ajouté)`), { x: 40, y: H - 70, size: 9, font: police, color: GRIS });
    let y = H - 100;
    let x = 40;
    for (const [nom, l] of colonnes) {
      page.drawText(texteWinAnsi(nom), { x, y, size: 9, font: gras, color: NUIT });
      x += l;
    }
    page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: W - 40, y: y - 5 }, thickness: 1, color: NUIT });
    y -= 20;
    for (const ligne of lignes.slice(k * parPage, (k + 1) * parPage)) {
      x = 40;
      ligne.forEach((texte, i) => {
        const largeur = colonnes[i][1] - 8;
        let t = texte;
        while (t && police.widthOfTextAtSize(t, 8.5) > largeur) t = t.slice(0, -2);
        if (t !== texte) t = `${t.slice(0, -1)}.`;
        page.drawText(t, { x, y, size: 8.5, font: i === 0 ? gras : police, color: NUIT });
        x += colonnes[i][1];
      });
      page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: W - 40, y: y - 5 }, thickness: 0.3, color: GRIS });
      y -= 19;
    }
    if (!lignes.length) page.drawText('Aucune modification.', { x: 40, y, size: 10, font: police, color: GRIS });
    // Cartouche.
    page.drawLine({ start: { x: 40, y: 40 }, end: { x: W - 40, y: 40 }, thickness: 1.5, color: NUIT });
    page.drawText(texteWinAnsi([cartouche.affaire, cartouche.projet, comparaison.nom].filter(Boolean).join(' - ')), { x: 40, y: 26, size: 8, font: police, color: NUIT });
    const droite = texteWinAnsi(`Topo - ${cartouche.date} - liste ${k + 1} / ${nbPages}`);
    page.drawText(droite, { x: W - 40 - police.widthOfTextAtSize(droite, 8), y: 26, size: 8, font: police, color: NUIT });
  }
  return pdf.save();
}

/** Une annotation sur la page du rapport (points du repère de A, y vers le bas ; hauteur HA pour retourner). */
function dessinerAnnotation(page, a, HA, { police, rgb, BLEU }) {
  const c = a.couleur ? rgb(...hexVersRgb(a.couleur)) : BLEU;
  const P = (p) => ({ x: p[0], y: HA - p[1] });
  const pts = a.points ?? [];
  if (a.genre === 'nuage' && pts.length === 2) {
    const [p, q] = pts;
    const rect = { x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.abs(q[0] - p[0]), h: Math.abs(q[1] - p[1]) };
    page.drawSvgPath(cheminNuage(rect, Math.max(6, Math.min(rect.w, rect.h) / 4)), { x: 0, y: HA, borderColor: c, borderWidth: 1.2 });
  } else if ((a.genre === 'fleche' || a.genre === 'distance') && pts.length === 2) {
    page.drawLine({ start: P(pts[0]), end: P(pts[1]), thickness: 1, color: c });
    if (a.genre === 'fleche') {
      const [p, q] = pts;
      const t = Math.atan2(q[1] - p[1], q[0] - p[0]);
      for (const d of [-0.4, 0.4]) page.drawLine({ start: P(q), end: P([q[0] - 8 * Math.cos(t + d), q[1] - 8 * Math.sin(t + d)]), thickness: 1, color: c });
    }
  } else if (a.genre === 'surface' && pts.length >= 3) {
    page.drawSvgPath(`M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`, { x: 0, y: HA, borderColor: c, borderWidth: 1, color: c, opacity: 0.12 });
  }
  if (a.texte && pts.length) {
    const p = pts[pts.length - 1];
    page.drawText(texteWinAnsi(a.texte), { x: p[0] + 4, y: HA - p[1] + 4, size: 8, font: police, color: c });
  }
}

function hexVersRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Octets du PDF d'un fichier de la comparaison. */
export const octetsDuFichier = (fichier) => octetsDeBase64(fichier.donnees);
