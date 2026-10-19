// Écran « Mes projets » (ouvert depuis l'en-tête) : projet ouvert, liste des projets, fichier projet.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';

/**
 * Crée l'écran Mes projets dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), exporterProjet(), nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id),
 * supprimerProjet(id), importerFichierProjet(fichier)
 * Renvoie { afficher(projet, resumes) }.
 */
export function creerEcranProjet(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action === 'exporter') actions.exporterProjet();
    else if (action === 'nouveau') actions.nouveauProjet();
    else if (action === 'ouvrir') actions.ouvrirProjet(id);
    else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  return {
    /** Redessine l'écran. */
    afficher(projet, resumes) {
      conteneur.innerHTML = `
        <h2>Mes projets ${bulle('projets')}</h2>
        <div class="ligne-outils">
          <label class="champ-large">Nom du projet ouvert
            <input type="text" data-champ="nom-projet" value="${echapper(projet.nom)}" />
          </label>
        </div>
        <div class="ligne-outils">
          <button type="button" class="bouton" data-action="nouveau">+ Nouveau projet</button>
          <button type="button" class="bouton-secondaire" data-action="exporter">Exporter le fichier projet</button>
        </div>

        <div class="liste-projets">
          ${resumes
            .map(
              (r) => `
            <div class="carte-role ${r.id === projet.id ? 'en-edition' : ''}">
              <div class="titre-role">
                <strong>${echapper(r.nom)}</strong>
                <span class="aide">${new Date(r.modifieLe).toLocaleDateString('fr-CH')}</span>
              </div>
              <p class="aide">${r.nombreLeves} levé(s) · ${r.nombreStocks} stock(s) · ${r.nombreSurfaces} surface(s)</p>
              <div class="ligne-outils">
                ${r.id === projet.id ? '<span class="ok">Ouvert</span>' : `<button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>`}
                <button type="button" class="bouton-secondaire" data-action="dupliquer" data-id="${r.id}">Dupliquer</button>
                <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>
              </div>
            </div>`,
            )
            .join('')}
        </div>
        <label class="bouton-secondaire bouton-fichier">
          Ouvrir un fichier projet (.topo.json)
          <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
        </label>
      `;
    },
  };
}
