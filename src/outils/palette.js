// Choix d'une couleur sans texte (0.89.0) : une pastille à la couleur actuelle ; la toucher ouvre une
// rangée de pastilles. La pastille « sans couleur » (couleur normale : celle du rôle, du libellé ou
// du plan) est un rond à moitié rempli. Les boutons portent data-choix-couleur (la couleur, '' pour
// la couleur normale) et les attributs donnés (data-champ-couleur, data-id…) ; le code qui écoute les
// clics lit ces attributs (voir import/ecran.js et plan/plan.js).
import { echapper } from './echapper.js';

/**
 * couleur : couleur actuelle ('' ou null : normale) ; options : [[couleur, nom]] (le nom sert
 * seulement à la lecture d'écran) ; attributs : texte HTML posé sur chaque bouton ; nom : lecture d'écran.
 */
export function choixCouleur({ couleur, options, attributs = '', nom = 'Couleur' }) {
  const boutons = options.map(([valeur, titre]) => `<button type="button" class="pastille-couleur ${valeur ? '' : 'sans-couleur'} ${valeur === (couleur || '') ? 'choisie' : ''}" data-choix-couleur="${echapper(valeur)}" ${attributs} aria-label="${echapper(titre)}" ${valeur ? `style="background: ${echapper(valeur)}"` : ''}></button>`).join('');
  return `<details class="choix-couleur">
    <summary class="pastille-couleur ${couleur ? '' : 'sans-couleur'}" aria-label="${echapper(nom)}" ${couleur ? `style="background: ${echapper(couleur)}"` : ''}></summary>
    <div class="palette-flottante">${boutons}</div>
  </details>`;
}
