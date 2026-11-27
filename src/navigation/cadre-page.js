/**
 * Cadre commun des applis plein écran (Calage, Matériel, Plans de chantier, Plateformes, Comparer) :
 *  - le nom du projet en cours tout en haut (comme l'en-tête des autres applis) ;
 *  - un bouton « Applications » tout en bas à gauche (comme la bande du bas) : il fait « retour »
 *    (même action que la flèche ←, donc ferme la page et ouvre la page Applications).
 * Les pages se redessinent en entier : on remet le cadre s'il disparaît.
 */
import { echapper } from '../outils/echapper.js';

/** Recopie la pastille d'affaire de l'en-tête dans le bandeau de la page. */
function majAffaire(haut) {
  const source = document.querySelector('#pastille-affaire');
  const bouton = haut.querySelector('.pastille-affaire-page');
  if (!bouton || !source) return;
  bouton.hidden = source.hidden;
  bouton.textContent = source.textContent;
}

/** Nom du projet affiché dans l'en-tête de l'appli (vide si rien). */
function nomDuProjet() {
  return document.querySelector('#titre-projet')?.textContent?.trim() || 'Projet';
}

/**
 * Habille la page (dialog) : couleur = couleur de l'appli, titre = nom de l'appli.
 * Renvoie une fonction qui arrête la surveillance (à appeler à la fermeture).
 */
export function habillerPage(page, { couleur, titre, contenuBande = null }) {
  const poser = () => {
    if (!page.querySelector(':scope > .bandeau-projet-page')) {
      const haut = document.createElement('div');
      haut.className = 'bandeau-projet-page';
      haut.innerHTML = `<span class="projet-page-nom">${echapper(nomDuProjet())}</span><button type="button" class="pastille-affaire-page" hidden></button>`;
      page.prepend(haut);
      // 0.344.0 : l'affaire choisie se voit et se change aussi dans les applis plein écran (même menu que l'en-tête).
      haut.querySelector('.pastille-affaire-page').addEventListener('click', () => document.querySelector('#pastille-affaire')?.click());
      majAffaire(haut);
    }
    if (!page.querySelector(':scope > .bande-page')) {
      // 0.323.0 : même bouton que la bande des autres applis (Contrôle…) : « ☰ Nom », sans bandeau sombre derrière.
      const bas = document.createElement('div');
      bas.className = 'bande-appli bande-page';
      bas.innerHTML = `<div class="bouton-appli"><button type="button" class="partie-appli" data-action="retour" title="Menu des applications" aria-label="Menu des applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>${echapper(titre)}</span></button></div><div class="zone-bande-page" data-zone="bande-page">${contenuBande?.() ?? ''}</div>`;
      page.append(bas);
      brancherAppuiLong(page, bas.querySelector('.partie-appli'));
    }
  };
  // 0.327.0 : la page peut remplir la place à droite du bouton (ex. Plans de chantier : accroches, ortho, échelle…).
  page.majBandePage = () => {
    const zone = page.querySelector(':scope > .bande-page .zone-bande-page');
    if (zone && contenuBande) zone.innerHTML = contenuBande();
  };
  page.style.setProperty('--couleur-appli', couleur);
  page.style.setProperty('--texte-appli', '#ffffff');
  const observateur = new MutationObserver(() => {
    if (!page.isConnected) return observateur.disconnect();
    if (!page.querySelector(':scope > .bandeau-projet-page') || !page.querySelector(':scope > .bande-page')) poser();
  });
  observateur.observe(page, { childList: true });
  poser();
  const surAffaire = () => {
    const haut = page.querySelector(':scope > .bandeau-projet-page');
    if (!haut) return;
    majAffaire(haut);
    const nom = haut.querySelector('.projet-page-nom');
    if (nom) nom.textContent = nomDuProjet();
  };
  document.addEventListener('topo-affaire-changee', surAffaire);
  return () => {
    observateur.disconnect();
    document.removeEventListener('topo-affaire-changee', surAffaire);
  };
}

const DUREE_APPUI_LONG = 500; // ms, comme la bande des autres applis

/**
 * Appui long sur le bouton ☰ (0.327.0) : la roue des favoris s'ouvre (comme sur la bande des autres applis) ; le toucher qui suit
 * ne fait pas « retour ». Le choix d'un favori ferme la page puis ouvre l'application (voir navigation/bande.js).
 */
function brancherAppuiLong(page, bouton) {
  let minuterie = null;
  let fait = false;
  const arreter = () => clearTimeout(minuterie);
  bouton.addEventListener('pointerdown', () => {
    fait = false;
    arreter();
    minuterie = setTimeout(() => {
      fait = true;
      document.dispatchEvent(new CustomEvent('roue-favoris', { detail: { bouton, hote: page, quitter: () => { fait = false; bouton.click(); } } }));
    }, DUREE_APPUI_LONG);
  });
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave']) bouton.addEventListener(fin, arreter);
  bouton.addEventListener('contextmenu', (e) => e.preventDefault());
  // Capture : le clic qui finit l'appui long n'atteint pas le « retour » de la page.
  bouton.addEventListener('click', (e) => {
    if (!fait) return;
    fait = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
}
