// Calage de plans (0.298.0, demande du 24.11) : un PDF comme plan reçu.
// PDF vectoriel (traits) : ses traits, textes et calques deviennent un plan comme un DXF (accroche sur les sommets, axes…) ;
// PDF scanné (sans traits) ou au choix : la page devient une image (on clique les points à vue, sans accroche).
// Pas d'échelle demandée : le plan est lu à la taille de la feuille (mètres de papier) et le calage trouve l'échelle.
import { chargerPdfjs, ouvrirPdf, contenuDeLaPage, imageDeLaPage } from '../import/pdf.js';
import { dxfDuPdf, precisionPdf } from '../topo/pdf-dxf.js';
import { lirePlanDxf } from '../topo/dxf-plan.js';
import { planImagePdf, facteurDeRendu, NETTETE_DEPART } from '../topo/pdf-image.js';

/** Vrai pour un nom de fichier PDF. */
export const estPdf = (nom) => /\.pdf$/i.test(nom ?? '');

/**
 * Lit la page d'un PDF pour le calage. « choisir » = fonctions async pour les choix de l'utilisateur :
 *  page(nombreDePages) → numéro (1…), ou null pour abandonner ;
 *  mode({ traits, images }) → 'traits' ou 'image', ou null (appelé seulement si la page a des traits).
 * « avancer(texte) » : texte d'attente. Renvoie { plan, page, mode, avertissements } ou null si abandon.
 */
export async function lirePdfPourCalage(octets, nom, choisir, avancer = () => {}) {
  avancer(`Ouverture du PDF « ${nom} »…`);
  const pdfjs = await chargerPdfjs();
  const doc = await ouvrirPdf(pdfjs, octets);
  try {
    let page = 1;
    if (doc.numPages > 1) {
      page = await choisir.page(doc.numPages);
      if (!page) return null;
    }
    avancer(`Lecture de la page ${page}…`);
    const contenu = await contenuDeLaPage(doc, page, pdfjs.OPS);
    const avecTraits = contenu.traits.length > 0 || contenu.textes.length > 0;
    if (!avecTraits && contenu.images === 0) throw new Error(`rien de dessiné sur la page ${page}`);
    let mode = 'image';
    if (avecTraits) {
      mode = await choisir.mode({ traits: contenu.traits.length, images: contenu.images });
      if (!mode) return null;
    }
    const avertissements = [];
    let plan;
    if (mode === 'traits') {
      const lecture = lirePlanDxf(dxfDuPdf(contenu), nom, { precision: precisionPdf(null) });
      if (lecture.erreur || !lecture.plan.bornes) throw new Error(lecture.erreur ?? 'aucun trait lisible');
      plan = lecture.plan;
      if (contenu.images > 0) avertissements.push(`${contenu.images} image(s) du PDF non reprise(s) : seuls les traits et les textes sont lus.`);
    } else {
      const rendu = facteurDeRendu(contenu.largeur, contenu.hauteur, NETTETE_DEPART);
      avancer(`Image de la page (${rendu.dpi} dpi)…`);
      const image = await imageDeLaPage(doc, page, rendu.facteur);
      plan = planImagePdf({ nom, largeurPt: image.largeurPt, hauteurPt: image.hauteurPt, donnees: image.donnees, pixels: image.pixels });
      avertissements.push('Plan en image : pas d\'accroche, cliquez les points à vue (zoomez bien).');
    }
    return { plan, page, mode, avertissements };
  } finally {
    doc.loadingTask?.destroy();
  }
}
