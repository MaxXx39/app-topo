/**
 * Cadre commun des applis plein écran (Calage, Matériel, Plans de chantier, Plateformes, Comparer) :
 *  - le nom du projet en cours tout en haut (comme l'en-tête des autres applis) ;
 *  - un bouton « Applications » tout en bas à gauche (comme la bande du bas) : il fait « retour »
 *    (même action que la flèche ←, donc ferme la page et ouvre la page Applications).
 * Les pages se redessinent en entier : on remet le cadre s'il disparaît.
 */
import { echapper } from '../outils/echapper.js';

/** Nom du projet affiché dans l'en-tête de l'appli (vide si rien). */
function nomDuProjet() {
  return document.querySelector('#titre-projet')?.textContent?.trim() || 'Projet';
}

/**
 * Habille la page (dialog) : couleur = couleur de l'appli, titre = nom de l'appli.
 * Renvoie une fonction qui arrête la surveillance (à appeler à la fermeture).
 */
export function habillerPage(page, { couleur, titre }) {
  const poser = () => {
    if (!page.querySelector(':scope > .bandeau-projet-page')) {
      const haut = document.createElement('div');
      haut.className = 'bandeau-projet-page';
      haut.innerHTML = `<span class="projet-page-nom">${echapper(nomDuProjet())}</span>`;
      page.prepend(haut);
    }
    if (!page.querySelector(':scope > .bande-bas-page')) {
      const bas = document.createElement('div');
      bas.className = 'bande-bas-page';
      bas.innerHTML = `<button type="button" class="bouton-appli-page" data-action="retour" aria-label="Applications : retour au menu"><span class="grille-appli-page" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${echapper(titre)}</span></button>`;
      page.append(bas);
    }
  };
  page.style.setProperty('--couleur-appli-page', couleur);
  const observateur = new MutationObserver(() => {
    if (!page.isConnected) return observateur.disconnect();
    if (!page.querySelector(':scope > .bandeau-projet-page') || !page.querySelector(':scope > .bande-bas-page')) poser();
  });
  observateur.observe(page, { childList: true });
  poser();
  return () => observateur.disconnect();
}
