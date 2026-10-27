// Petite fenêtre avec plusieurs boutons au choix (à la place de « OK / Annuler », qui ne dit pas
// clairement ce qui va se passer). Le premier bouton marqué « principal » est mis en avant.
import { echapper } from './echapper.js';

/**
 * Ouvre la fenêtre et attend le choix. boutons : [{ cle, texte, detail, principal }].
 * Renvoie la clé du bouton touché. signal (AbortSignal, facultatif) : la fenêtre se ferme toute
 * seule quand il est déclenché, et renvoie null.
 */
export function demanderChoix({ titre, texte = '', boutons, signal = null }) {
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
    signal?.addEventListener('abort', () => {
      if (fenetre.open) fenetre.close();
      resoudre(null);
    });
    document.body.append(fenetre);
    fenetre.showModal();
  });
}

/**
 * Petite fenêtre pour taper un texte (ex. renommer un levé) : « OK » ou « Annuler ».
 * Renvoie le texte tapé (sans espaces autour), ou null si annulé.
 */
export function demanderTexte({ titre, valeur = '' }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <input type="text" data-champ="texte" value="${echapper(valeur)}" aria-label="${echapper(titre)}" />
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button>
        <button type="button" class="bouton-secondaire" data-cle="annuler"><strong>Annuler</strong></button>
      </div>`;
    const champ = fenetre.querySelector('input');
    const finir = (cle) => {
      fenetre.close();
      resoudre(cle === 'ok' ? champ.value.trim() : null);
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    champ.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') finir('ok');
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('annuler');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
    champ.select();
  });
}

/**
 * Petite fenêtre avec plusieurs cases à remplir puis « OK » (ex. nouveau projet : affaire,
 * désignation). champs : [{ cle, titre, exemple, valeur (texte déjà là, facultatif) }]. Renvoie { cle: texte tapé } avec OK, ou null
 * si la fenêtre est fermée (✕, touche retour, Échap) : rien n'est fait.
 */
export function demanderChamps({ titre, champs }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix fenetre-champs';
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs">
        <h2>${echapper(titre)}</h2>
        <button type="button" class="bouton-retour" data-cle="fermer" title="Fermer" aria-label="Fermer">✕</button>
      </div>
      ${champs.map((c) => `<label>${echapper(c.titre)}<input type="text" data-champ="${echapper(c.cle)}" value="${echapper(c.valeur ?? '')}" placeholder="${echapper(c.exemple ?? '')}" /></label>`).join('')}
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button>
      </div>`;
    const finir = (cle) => {
      const valeurs = Object.fromEntries([...fenetre.querySelectorAll('input[data-champ]')].map((champ) => [champ.dataset.champ, champ.value.trim()]));
      fenetre.close();
      resoudre(cle === 'ok' ? valeurs : null);
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    fenetre.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter' && evenement.target.matches('input')) finir('ok');
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('fermer');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
    fenetre.querySelector('input')?.focus();
  });
}
