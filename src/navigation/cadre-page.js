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
    if (!page.querySelector(':scope > .bande-page')) {
      // 0.323.0 : même bouton que la bande des autres applis (Contrôle…) : « ☰ Nom », sans bandeau sombre derrière.
      const bas = document.createElement('div');
      bas.className = 'bande-appli bande-page';
      bas.innerHTML = `<div class="bouton-appli"><button type="button" class="partie-appli" data-action="retour" title="Menu des applications" aria-label="Menu des applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>${echapper(titre)}</span></button></div>`;
      page.append(bas);
    }
  };
  page.style.setProperty('--couleur-appli', couleur);
  page.style.setProperty('--texte-appli', '#ffffff');
  const observateur = new MutationObserver(() => {
    if (!page.isConnected) return observateur.disconnect();
    if (!page.querySelector(':scope > .bandeau-projet-page') || !page.querySelector(':scope > .bande-page')) poser();
  });
  observateur.observe(page, { childList: true });
  poser();
  return () => observateur.disconnect();
}
