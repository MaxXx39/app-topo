// Aperçu d'un PDF avant de l'exporter (0.151.0, demande du 06.11) : les pages sont dessinées par
// pdf.js (déjà utilisé pour lire les plans PDF, téléchargé à la première fois), car la tablette ne
// sait pas montrer un PDF dans une fenêtre de l'appli. Boutons « Exporter » (retour à la fenêtre
// Exporter : Enregistrer, mail…) et « Fermer ».
import { echapper } from '../outils/echapper.js';

const PAGES_MAX = 12; // au-delà, seules les premières pages sont montrées

/**
 * Montre le PDF "blob" dans une fenêtre plein écran. titre : nom du fichier ; resume : texte mis en
 * évidence (ex. « A3 paysage · échelle 1:500 ») ou null.
 * Renvoie une promesse : vrai si on touche « Exporter », faux si on ferme.
 */
export function montrerApercuPdf(blob, { titre, resume = null } = {}) {
  return new Promise((fin) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-apercu-pdf';
    fenetre.innerHTML = `
      <div class="entete-apercu-pdf">
        <div class="titres-apercu-pdf">
          <strong>Aperçu</strong>
          <span class="nom-apercu-pdf">${echapper(titre ?? '')}</span>
          ${resume ? `<span class="resume-apercu-pdf">${echapper(resume)}</span>` : ''}
        </div>
        <button type="button" class="bouton" data-cle="exporter">Exporter</button>
        <button type="button" class="bouton-secondaire" data-cle="fermer">Fermer</button>
      </div>
      <div class="pages-apercu-pdf"><p class="aide" data-zone="etat">Préparation de l'aperçu…</p></div>`;
    let reponse = false;
    fenetre.addEventListener('click', (e) => {
      const bouton = e.target.closest('button[data-cle]');
      if (!bouton) return;
      reponse = bouton.dataset.cle === 'exporter';
      fenetre.close();
    });
    fenetre.addEventListener('close', () => {
      fenetre.remove();
      fin(reponse);
    });
    document.body.append(fenetre);
    fenetre.showModal();
    dessinerPages(fenetre, blob).catch((erreur) => {
      const etat = fenetre.querySelector('[data-zone="etat"]');
      if (etat) etat.textContent = `Aperçu impossible : ${erreur.message}. Tu peux quand même exporter.`;
    });
  });
}

/** Dessine les pages du PDF dans la fenêtre, l'une sous l'autre, à la largeur de la fenêtre. */
async function dessinerPages(fenetre, blob) {
  const { chargerPdfjs, ouvrirPdf } = await import('../import/pdf.js');
  const pdfjs = await chargerPdfjs();
  const doc = await ouvrirPdf(pdfjs, new Uint8Array(await blob.arrayBuffer()));
  const zone = fenetre.querySelector('.pages-apercu-pdf');
  const etat = zone.querySelector('[data-zone="etat"]');
  const nb = Math.min(doc.numPages, PAGES_MAX);
  etat.textContent = doc.numPages > 1 ? `${doc.numPages} pages${doc.numPages > PAGES_MAX ? ` (les ${PAGES_MAX} premières montrées)` : ''}` : '';
  const largeurVoulue = Math.max(300, zone.clientWidth - 16);
  const densite = Math.min(window.devicePixelRatio || 1, 2);
  for (let numero = 1; numero <= nb; numero++) {
    if (!fenetre.isConnected) return; // fenêtre fermée pendant le dessin
    const page = await doc.getPage(numero);
    const base = page.getViewport({ scale: 1 });
    const vue = page.getViewport({ scale: (largeurVoulue / base.width) * densite });
    const toile = document.createElement('canvas');
    toile.className = 'page-apercu-pdf';
    toile.width = Math.round(vue.width);
    toile.height = Math.round(vue.height);
    toile.style.width = `${Math.round(vue.width / densite)}px`;
    zone.append(toile);
    await page.render({ canvasContext: toile.getContext('2d'), viewport: vue }).promise;
  }
  doc.destroy?.();
}
