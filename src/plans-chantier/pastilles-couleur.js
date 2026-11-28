// Choix d'une couleur par pastilles (0.360.0) à la place des noms en texte.
// Une liste cachée garde le réglage (les écouteurs « change » existants la lisent) ; toucher une
// pastille change la liste cachée puis envoie « change » (voir le clic dans appli.js).
import { echapper } from '../outils/echapper.js';

/** attribut : 'data-detail' | 'data-reglage' | 'data-prop' ; options : [[couleur, nom]] ('' = couleur normale). */
export function pastillesCouleur(attribut, cle, options, valeur) {
  const v = valeur ?? '';
  const liste = options.map(([c, t]) => `<option value="${echapper(c)}" ${c === v ? 'selected' : ''}>${echapper(t)}</option>`).join('');
  const boutons = options.map(([c, t]) => `<button type="button" class="pastille-couleur ${c ? '' : 'sans-couleur'} ${c === v ? 'choisie' : ''}" data-pastille-valeur="${echapper(c)}" title="${echapper(t)}" aria-label="${echapper(t)}" ${c ? `style="background: ${echapper(c)}"` : ''}></button>`).join('');
  return `<span class="pastilles-select"><select hidden ${attribut}="${cle}">${liste}</select><span class="palette-flottante">${boutons}</span></span>`;
}
