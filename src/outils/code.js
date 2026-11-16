// Code de sécurité qui protège certains réglages (nom de l'appareil, corrections NTRIP) pour qu'un utilisateur
// ne les change pas par erreur (demande du 26.10.2026). C'est une simple barrière : le code est
// écrit dans l'appli, ce n'est pas une vraie sécurité.
import { echapper } from './echapper.js';

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
    // 0.243.0 (audit, lot 6) : même cadre que les autres fenêtres (gros champ centré, deux gros boutons).
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix fenetre-code';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <input type="password" inputmode="numeric" autocomplete="off" class="champ-code-gros" data-champ="code" aria-label="Code de sécurité" placeholder="Code de sécurité" />
      <p class="erreur" data-vivant="erreur-code" hidden>Code de sécurité faux</p>
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="valider"><strong>Valider</strong></button>
        <button type="button" class="bouton-secondaire" data-cle="annuler"><strong>Fermer</strong></button>
      </div>`;
    const champ = fenetre.querySelector('[data-champ="code"]');
    const erreur = fenetre.querySelector('[data-vivant="erreur-code"]');
    let bon = false;
    const valider = () => {
      if (estBonCode(champ.value)) {
        bon = true;
        fenetre.close();
        return;
      }
      erreur.hidden = false;
      champ.value = '';
      champ.focus();
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (!bouton) return;
      if (bouton.dataset.cle === 'valider') valider();
      else fenetre.close();
    });
    champ.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') {
        evenement.preventDefault();
        valider();
      }
    });
    fenetre.addEventListener('close', () => {
      fenetre.remove();
      resoudre(bon);
    });
    document.body.append(fenetre);
    fenetre.showModal();
    champ.focus();
  });
}
