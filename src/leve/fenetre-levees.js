// Fenêtre « Changer » de l'onglet Terrain › Lever (0.69.0) : les levés (surfaces levées, métrés,
// levés libres), chacun écrit à la couleur de sa nature ; le toucher le reprend. En mode Expert,
// une croix rouge le supprime (avec ses points), après confirmation.
import { echapper } from '../outils/echapper.js';

/**
 * Ouvre la fenêtre. levees : [{ id, nom, nature }] ; actuel : id du levé en cours ; titres : nom de
 * chaque nature ; supprimable : vrai pour montrer les croix ; choisir(id) ; supprimer(id) (demande
 * elle-même la confirmation, renvoie vrai si le levé est supprimé).
 */
export function ouvrirChoixLevees({ levees, actuel, titres, supprimable, choisir, supprimer }) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-levees';
  const dessiner = (liste) => {
    fenetre.innerHTML = `
      <h2>Reprendre un levé</h2>
      <div class="liste-levees">
        ${liste.map((l) => `<div class="ligne-levee nature-${l.nature}">
          <button type="button" class="${l.id === actuel ? 'bouton' : 'bouton-secondaire'} choisir-levee" data-choisir="${l.id}">
            <strong>${echapper(l.nom)}</strong><span>${echapper(titres[l.nature] ?? '')}</span></button>
          ${supprimable ? `<button type="button" class="croix-levee" data-supprimer="${l.id}" title="Supprimer ce levé" aria-label="Supprimer ${echapper(l.nom)}">✕</button>` : ''}
        </div>`).join('')}
      </div>
      <div class="ligne-outils"><button type="button" class="bouton-secondaire" data-fermer>Annuler</button></div>`;
  };
  let liste = levees;
  dessiner(liste);
  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button');
    if (!bouton) return;
    if (bouton.dataset.choisir) {
      fenetre.close();
      choisir(bouton.dataset.choisir);
    } else if (bouton.dataset.supprimer) {
      if (!supprimer(bouton.dataset.supprimer)) return;
      liste = liste.filter((l) => l.id !== bouton.dataset.supprimer);
      if (liste.length === 0) fenetre.close();
      else dessiner(liste);
    } else if ('fermer' in bouton.dataset) fenetre.close();
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}
