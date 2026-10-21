// Onglet « Projet » (le premier) : projet ouvert et son cartouche, liste des projets, fichier projet.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';

/**
 * Crée l'écran Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), changerCartouche(champ, valeur), continuer(), exporterProjet(), nouveauProjet(),
 * ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier)
 * Renvoie { afficher(projet, resumes) }.
 */
export function creerEcranProjet(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action === 'continuer') actions.continuer();
    else if (action === 'exporter') actions.exporterProjet();
    else if (action === 'nouveau') actions.nouveauProjet();
    else if (action === 'ouvrir') actions.ouvrirProjet(id);
    else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.cartouche) actions.changerCartouche(cible.dataset.cartouche, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  return {
    /** Redessine l'écran. */
    afficher(projet, resumes) {
      // On ne redessine pas pendant une saisie : la case perdrait le curseur.
      if (conteneur.contains(document.activeElement) && document.activeElement.matches('input')) return;
      const autres = resumes.filter((r) => r.id !== projet.id);
      const resumeOuvert = resumes.find((r) => r.id === projet.id);
      conteneur.innerHTML = `
        <h2>Projet ${bulle('projets')}</h2>
        <div class="carte-role carte-projet-ouvert">
          <div class="titre-role"><strong>Projet ouvert</strong>
            ${resumeOuvert ? `<span class="aide">${resumeOuvert.nombreLeves} levé(s) · ${resumeOuvert.nombreSurfaces} surface(s)</span>` : ''}
          </div>
          <label class="champ-large">Nom du projet
            <input type="text" data-champ="nom-projet" value="${echapper(projet.nom)}" />
          </label>
          <p class="titre-choix">Cartouche du PDF ${bulle('cartouche')}</p>
          <div class="champs-export">
            <label>Affaire <input type="text" data-cartouche="affaire" value="${echapper(projet.cartouche.affaire ?? '')}" placeholder="ex. 10 203" /></label>
            <label>Dessiné par <input type="text" data-cartouche="dessinePar" value="${echapper(projet.cartouche.dessinePar ?? '')}" placeholder="ex. MGO" /></label>
            <label>Date (vide : date du jour) <input type="date" data-cartouche="date" value="${echapper(projet.cartouche.date ?? '')}" /></label>
          </div>
          <div class="ligne-outils">
            <button type="button" class="bouton" data-action="continuer">Continuer →</button>
            <button type="button" class="bouton-secondaire" data-action="exporter">Exporter le fichier projet</button>
          </div>
        </div>

        <div class="ligne-outils">
          <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
          <label class="bouton-secondaire bouton-fichier">
            Ouvrir un fichier projet (.topo.json)
            <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
          </label>
        </div>

        ${autres.length > 0 ? '<h3>Autres projets sur cet appareil</h3>' : ''}
        <div class="liste-projets">
          ${autres
            .map(
              (r) => `
            <div class="carte-role">
              <div class="titre-role">
                <strong>${echapper(r.nom)}</strong>
                <span class="aide">${new Date(r.modifieLe).toLocaleDateString('fr-CH')}</span>
              </div>
              <p class="aide">${r.nombreLeves} levé(s) · ${r.nombreSurfaces} surface(s)</p>
              <div class="ligne-outils">
                <button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>
                <button type="button" class="bouton-secondaire" data-action="dupliquer" data-id="${r.id}">Dupliquer</button>
                <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>
              </div>
            </div>`,
            )
            .join('')}
        </div>
        ${
          resumeOuvert
            ? `<p class="ligne-outils">
                <button type="button" class="bouton-secondaire" data-action="dupliquer" data-id="${projet.id}">Dupliquer le projet ouvert</button>
                <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${projet.id}">supprimer le projet ouvert</button>
              </p>`
            : ''
        }
      `;
    },
  };
}
