// Code de sécurité qui protège certains réglages (nom de l'appareil, corrections NTRIP) pour qu'un utilisateur
// ne les change pas par erreur (demande du 26.10.2026). C'est une simple barrière : le code est
// écrit dans l'appli, ce n'est pas une vraie sécurité.

const CODE = '1196';

/** Vrai si le texte tapé est le bon code (espaces autour ignorés). */
export function estBonCode(texte) {
  return String(texte ?? '').trim() === CODE;
}

/**
 * Fenêtre « Code de sécurité » par-dessus l'écran : renvoie une promesse, vraie si le bon code est tapé, fausse
 * si on annule. Un code faux est signalé et la fenêtre reste ouverte.
 */
export function demanderCode(titre) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-reglages fenetre-code';
    fenetre.innerHTML = `
      <form method="dialog">
        <h2>${titre}</h2>
        <label class="champ-code">Code de sécurité
          <input type="password" inputmode="numeric" autocomplete="off" data-champ="code" />
        </label>
        <p class="erreur" data-vivant="erreur-code" hidden>Code de sécurité faux</p>
        <div class="ligne-outils">
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="annuler">annuler</button>
          <button class="bouton" data-action="valider">Valider</button>
        </div>
      </form>`;
    const champ = fenetre.querySelector('[data-champ="code"]');
    const erreur = fenetre.querySelector('[data-vivant="erreur-code"]');
    let bon = false;
    fenetre.querySelector('form').addEventListener('submit', (evenement) => {
      if (estBonCode(champ.value)) {
        bon = true;
        return; // la fenêtre se ferme (method="dialog")
      }
      evenement.preventDefault();
      erreur.hidden = false;
      champ.value = '';
      champ.focus();
    });
    fenetre.querySelector('[data-action="annuler"]').addEventListener('click', () => fenetre.close());
    fenetre.addEventListener('close', () => {
      fenetre.remove();
      resoudre(bon);
    });
    document.body.append(fenetre);
    fenetre.showModal();
    champ.focus();
  });
}
