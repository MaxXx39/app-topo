// Barre du bas pendant le pointage sur le fond de plan : consigne, puis nom et altitude
// du coin touché (clavier numérique sur téléphone).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';

/**
 * Crée la barre dans "element". Les actions sont faites par main.js :
 * valider(nom, altitudeTapee), annuler(), supprimer(), terminer().
 * Renvoie { afficher(etat) } avec etat = { actif, nombrePoints, choix, erreur } où
 * choix = { est, nord, nom, altitude, existant } (coin touché) ou null.
 */
export function creerBarrePointage(element, actions) {
  element.addEventListener('click', (evenement) => {
    const action = evenement.target.closest('button[data-action]')?.dataset.action;
    if (action === 'valider-point') valider();
    else if (action === 'annuler-point') actions.annuler();
    else if (action === 'supprimer-point') actions.supprimer();
    else if (action === 'terminer-pointage') actions.terminer();
  });
  // Entrée dans un champ = Valider.
  element.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.matches('input')) valider();
  });

  function valider() {
    actions.valider(element.querySelector('[data-champ="nom-point"]').value, element.querySelector('[data-champ="altitude-point"]').value);
  }

  return {
    afficher({ actif, nombrePoints, choix, erreur }) {
      element.hidden = !actif;
      if (!actif) return;
      if (!choix) {
        element.innerHTML = `
          <div class="barre-texte"><strong>Pointage</strong> : touche un coin du plan (${nombrePoints} point(s) dessiné(s))</div>
          <div class="ligne-outils"><button type="button" class="bouton" data-action="terminer-pointage">Terminé</button></div>`;
        return;
      }
      element.innerHTML = `
        <div class="barre-texte"><strong>${choix.existant ? `Point ${echapper(choix.nom)}` : 'Nouveau point'}</strong> · E ${formaterNombre(choix.est)} · N ${formaterNombre(choix.nord)}</div>
        <div class="champs-pointage">
          <label>Nom <input type="text" data-champ="nom-point" value="${echapper(choix.nom)}" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
          <label>Altitude (m) <input type="text" data-champ="altitude-point" inputmode="decimal" value="${choix.altitude === null ? '' : formaterNombre(choix.altitude)}" autocomplete="off" /></label>
        </div>
        ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
        <div class="ligne-outils">
          <button type="button" class="bouton" data-action="valider-point">Valider</button>
          <button type="button" class="bouton-secondaire" data-action="annuler-point">Annuler</button>
          ${choix.existant ? '<button type="button" class="bouton-lien" data-action="supprimer-point">supprimer le point</button>' : ''}
        </div>`;
      // L'altitude est prête à être tapée (le texte proposé est sélectionné). Un court instant
      // après : sur téléphone, la fin du toucher sur le plan reprendrait sinon le curseur.
      const champ = element.querySelector('[data-champ="altitude-point"]');
      setTimeout(() => {
        champ.focus();
        champ.select();
      }, 50);
    },
  };
}
