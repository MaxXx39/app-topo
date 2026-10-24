// Fenêtre de modification d'une liste de libellés (crayon à droite des libellés, onglet Terrain) :
// un tableau Abrév. | Description | Couleur, qui défile, et en bas, toujours visible, la barre
// « + Ajouter · annuler · ENREGISTRER » (demande du 24.10.2026).
import { echapper } from '../outils/echapper.js';
import { nettoyerAbreviation, COULEURS_LIBELLES } from './libelles.js';

/**
 * Ouvre la fenêtre. liste : [[abréviation, description, couleur]] ; enregistrer(liste) reçoit la
 * liste modifiée (lignes sans abréviation enlevées, une abréviation en double gardée une fois).
 */
export function ouvrirFenetreLibelles({ titre, liste, enregistrer }) {
  let lignes = liste.map(([a, d, c]) => [a, d, c ?? '']);
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-libelles';

  /** Lignes du tableau telles qu'elles sont tapées (vides comprises). */
  const lire = () => [...fenetre.querySelectorAll('tbody tr')].map((ligne) => [
    nettoyerAbreviation(ligne.querySelector('[data-libelle="abreviation"]').value),
    ligne.querySelector('[data-libelle="description"]').value.trim(),
    ligne.querySelector('[data-libelle="couleur"]').value,
  ]);

  function dessiner() {
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <div class="corps-libelles">
        <table class="table-libelles">
          <thead><tr><th>Abrév.</th><th>Description</th><th>Couleur</th><th></th></tr></thead>
          <tbody>
            ${lignes.map(([abreviation, description, couleur], i) => `<tr>
              <td><input type="text" data-libelle="abreviation" value="${echapper(abreviation)}" maxlength="8" autocapitalize="characters" aria-label="Abréviation" /></td>
              <td><input type="text" data-libelle="description" value="${echapper(description)}" aria-label="Description" /></td>
              <td><select data-libelle="couleur" aria-label="Couleur" style="${couleur ? `border-left: 12px solid ${couleur}` : ''}">
                ${COULEURS_LIBELLES.map(([c, nom]) => `<option value="${c}" ${c === couleur ? 'selected' : ''}>${nom}</option>`).join('')}
              </select></td>
              <td><button type="button" class="bouton-lien" data-action="enlever" data-valeur="${i}" aria-label="Enlever">×</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ajouter">+ Ajouter un libellé</button>
      </div>
      <div class="pied-libelles">
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="annuler">annuler</button>
        <button type="button" class="bouton bouton-enregistrer" data-action="enregistrer">Enregistrer</button>
      </div>`;
  }

  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, valeur } = bouton.dataset;
    if (action === 'ajouter' || action === 'enlever') {
      lignes = lire();
      if (action === 'ajouter') lignes.push(['', '', '']);
      else lignes.splice(Number(valeur), 1);
      dessiner();
      if (action === 'ajouter') fenetre.querySelector('tbody tr:last-child input')?.focus();
    } else if (action === 'annuler') fenetre.close();
    else if (action === 'enregistrer') {
      const propre = lire().filter(([abreviation], i, toutes) => abreviation && toutes.findIndex(([a]) => a === abreviation) === i);
      fenetre.close();
      enregistrer(propre);
    }
  });
  fenetre.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.libelle === 'couleur') cible.style.borderLeft = cible.value ? `12px solid ${cible.value}` : '';
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
