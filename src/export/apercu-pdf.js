// Aperçu d'un PDF avant de l'exporter (0.151.0, demande du 06.11) : les pages sont dessinées par
// pdf.js (déjà utilisé pour lire les plans PDF, téléchargé à la première fois), car la tablette ne
// sait pas montrer un PDF dans une fenêtre de l'appli. Boutons « Exporter » (retour à la fenêtre
// Exporter : Enregistrer, mail…) et « Fermer ».
// Zoom (0.152.0) : pincer à deux doigts, boutons − / + (×1 à ×6), un doigt pour se déplacer ; les
// pages sont redessinées plus finement quand le zoom s'arrête.
import { echapper } from '../outils/echapper.js';

const PAGES_MAX = 12; // au-delà, seules les premières pages sont montrées
const ZOOM_MAX = 6;
const PIXELS_MAX = 12_000_000; // par page redessinée (mémoire des tablettes)

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
        <div class="zoom-apercu-pdf" role="group" aria-label="Zoom">
          <button type="button" class="bouton-secondaire" data-zoom="moins" aria-label="Dézoomer">−</button>
          <span data-zone="zoom">×1</span>
          <button type="button" class="bouton-secondaire" data-zoom="plus" aria-label="Zoomer">+</button>
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
    const zoom = brancherZoom(fenetre);
    fenetre.addEventListener('click', (e) => {
      const bouton = e.target.closest('button[data-zoom]');
      if (bouton) zoom.changer(bouton.dataset.zoom === 'plus' ? zoom.valeur() * 1.5 : zoom.valeur() / 1.5);
    });
    dessinerPages(fenetre, blob, zoom).catch((erreur) => {
      const etat = fenetre.querySelector('[data-zone="etat"]');
      if (etat) etat.textContent = `Aperçu impossible : ${erreur.message}. Tu peux quand même exporter.`;
    });
  });
}

/** Dessine les pages du PDF dans la fenêtre, l'une sous l'autre, à la largeur de la fenêtre. */
async function dessinerPages(fenetre, blob, zoom) {
  const { chargerPdfjs, ouvrirPdf } = await import('../import/pdf.js');
  const pdfjs = await chargerPdfjs();
  const doc = await ouvrirPdf(pdfjs, new Uint8Array(await blob.arrayBuffer()));
  const zone = fenetre.querySelector('.pages-apercu-pdf');
  const etat = zone.querySelector('[data-zone="etat"]');
  const nb = Math.min(doc.numPages, PAGES_MAX);
  etat.textContent = doc.numPages > 1 ? `${doc.numPages} pages${doc.numPages > PAGES_MAX ? ` (les ${PAGES_MAX} premières montrées)` : ''}` : '';
  const largeurVoulue = Math.max(300, zone.clientWidth - 16);
  for (let numero = 1; numero <= nb; numero++) {
    if (!fenetre.isConnected) return; // fenêtre fermée pendant le dessin
    const page = await doc.getPage(numero);
    const base = page.getViewport({ scale: 1 });
    const toile = document.createElement('canvas');
    toile.className = 'page-apercu-pdf';
    zone.append(toile);
    const vue = { page, base, toile, largeur: largeurVoulue, finesse: 0 };
    zoom.ajouterPage(vue);
    await rendre(vue, 1);
  }
  zoom.quandArrete((valeur) => zoom.pages().forEach((vue) => rendre(vue, valeur)));
  fenetre.addEventListener('close', () => doc.destroy?.());
}

/** Dessine une page assez finement pour le zoom "facteur" (rien à faire si elle l'est déjà). */
async function rendre(vue, facteur) {
  const densite = Math.min(window.devicePixelRatio || 1, 2);
  let echelle = (vue.largeur / vue.base.width) * densite * facteur;
  const pixels = vue.base.width * vue.base.height * echelle * echelle;
  if (pixels > PIXELS_MAX) echelle *= Math.sqrt(PIXELS_MAX / pixels);
  if (echelle <= vue.finesse * 1.05) return;
  vue.finesse = echelle;
  const v = vue.page.getViewport({ scale: echelle });
  // Dessin dans une toile à part, puis copie : pas de page blanche pendant le dessin.
  const toile = document.createElement('canvas');
  toile.width = Math.round(v.width);
  toile.height = Math.round(v.height);
  await vue.page.render({ canvasContext: toile.getContext('2d'), viewport: v }).promise;
  if (vue.finesse !== echelle) return; // un dessin plus fin a été demandé entre-temps
  vue.toile.width = toile.width;
  vue.toile.height = toile.height;
  vue.toile.getContext('2d').drawImage(toile, 0, 0);
}

/**
 * Zoom de l'aperçu : largeur des pages × valeur (1 à ZOOM_MAX), en gardant le même endroit au milieu
 * (ou sous les doigts). Pincer à deux doigts (événements tactiles), Ctrl + molette sur ordinateur.
 */
function brancherZoom(fenetre) {
  const zone = fenetre.querySelector('.pages-apercu-pdf');
  const texte = fenetre.querySelector('[data-zone="zoom"]');
  const pages = [];
  let valeur = 1;
  let rappel = null;
  let minuterie = null;
  const poser = () => {
    for (const vue of pages) vue.toile.style.width = `${Math.round(vue.largeur * valeur)}px`;
    zone.classList.toggle('zoome', valeur > 1.01);
    texte.textContent = `×${valeur < 1.95 ? valeur.toFixed(1).replace('.0', '') : Math.round(valeur)}`;
  };
  // Change le zoom en gardant fixe le point (x, y) de la zone (px, par rapport à la zone visible).
  const changer = (nouveau, x = zone.clientWidth / 2, y = zone.clientHeight / 2) => {
    const borne = Math.min(ZOOM_MAX, Math.max(1, nouveau));
    if (Math.abs(borne - valeur) < 1e-3) return;
    const rapport = borne / valeur;
    const cibleX = (zone.scrollLeft + x) * rapport - x;
    const cibleY = (zone.scrollTop + y) * rapport - y;
    valeur = borne;
    poser();
    zone.scrollLeft = cibleX;
    zone.scrollTop = cibleY;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => rappel?.(valeur), 300);
  };
  // Pincer : distance entre les deux doigts.
  let pince = null;
  const ecart = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const milieu = (t) => {
    const r = zone.getBoundingClientRect();
    return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top };
  };
  zone.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pince = { ecart: ecart(e.touches), valeur };
  }, { passive: true });
  zone.addEventListener('touchmove', (e) => {
    if (!pince || e.touches.length !== 2) return;
    e.preventDefault();
    const { x, y } = milieu(e.touches);
    changer(pince.valeur * (ecart(e.touches) / pince.ecart), x, y);
  }, { passive: false });
  zone.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pince = null;
  });
  zone.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = zone.getBoundingClientRect();
    changer(valeur * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  return {
    valeur: () => valeur,
    changer: (nouveau) => changer(nouveau),
    ajouterPage: (vue) => {
      pages.push(vue);
      poser();
    },
    pages: () => pages,
    quandArrete: (fonction) => {
      rappel = fonction;
    },
  };
}
