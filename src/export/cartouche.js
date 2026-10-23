// Cartouche du PDF, réglé au moment du PDF (plus dans l'onglet Projet) : « Dessiné par » (retenu
// sur cet appareil, pour tous les projets) et la date (vide : date du jour). L'affaire et le lieu
// viennent des infos du projet (onglet Projet).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';

const CLE_DESSINE_PAR = 'topo-dessine-par';

/** « Dessiné par » retenu sur l'appareil ('' s'il n'y en a pas). */
function dessineParRetenu() {
  try {
    return localStorage.getItem(CLE_DESSINE_PAR) ?? '';
  } catch {
    return '';
  }
}

/** Cases du cartouche (HTML), à mettre dans un écran d'export. */
export function champsCartouche() {
  return `<div class="champs-cartouche">
      <p class="titre-choix">Cartouche ${bulle('cartouche')}</p>
      <label>Dessiné par <input type="text" data-cartouche-pdf="dessinePar" value="${echapper(dessineParRetenu())}" placeholder="ex. MGO" /></label>
      <label>Date <input type="date" data-cartouche-pdf="date" /></label>
    </div>`;
}

/**
 * Lit les cases du cartouche dans "conteneur" et retient « Dessiné par » sur l'appareil.
 * Renvoie { dessinePar, date ('AAAA-MM-JJ', la date du jour si la case est vide) }.
 */
export function lireCartouche(conteneur) {
  const valeur = (champ) => conteneur.querySelector(`[data-cartouche-pdf="${champ}"]`)?.value.trim() ?? '';
  const dessinePar = valeur('dessinePar');
  try {
    localStorage.setItem(CLE_DESSINE_PAR, dessinePar);
  } catch {
    // Mémoire du navigateur indisponible : « Dessiné par » ne sera simplement pas retenu.
  }
  return { dessinePar, date: valeur('date') || new Date().toISOString().slice(0, 10) };
}
