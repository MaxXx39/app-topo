// Petite fenêtre avec plusieurs boutons au choix (à la place de « OK / Annuler », qui ne dit pas
// clairement ce qui va se passer). Le premier bouton marqué « principal » est mis en avant.
import { echapper } from './echapper.js';

/**
 * Ouvre la fenêtre et attend le choix. boutons : [{ cle, texte, detail, principal }].
 * Renvoie la clé du bouton touché.
 */
export function demanderChoix({ titre, texte = '', boutons }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      ${texte ? `<p>${echapper(texte)}</p>` : ''}
      <div class="boutons-choix">
        ${boutons.map((b) => `<button type="button" class="${b.principal ? 'bouton' : 'bouton-secondaire'}" data-cle="${echapper(b.cle)}">
          <strong>${echapper(b.texte)}</strong>${b.detail ? `<span>${echapper(b.detail)}</span>` : ''}</button>`).join('')}
      </div>`;
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (!bouton) return;
      fenetre.close();
      resoudre(bouton.dataset.cle);
    });
    // Touche « retour » ou Échap : le premier bouton (le choix mis en avant).
    fenetre.addEventListener('cancel', (evenement) => evenement.preventDefault());
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
  });
}
