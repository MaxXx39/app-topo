// Comparaisons de deux surfaces (deux levés) : formulaire et résultats.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { nouvelIdentifiant } from '../topo/surface.js';

/**
 * Crée la section des comparaisons dans "conteneur".
 * - obtenirProjet() : projet ouvert
 * - obtenirChoix() : surfaces comparables [{ ref, nom }] (surfaces du projet et dessus des stocks)
 * - obtenirZones() : zones possibles [{ zone, nom }] (toute la surface, ou contour d'un stock)
 * - obtenirResultat(comparaison) : résultat calculé (voir topo/comparaison.js)
 * - quandChange() : après chaque modification
 */
export function creerEcranComparaisons(conteneur, { obtenirProjet, obtenirChoix, obtenirZones, obtenirResultat, quandChange }) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const projet = obtenirProjet();
    if (bouton.dataset.action === 'ajouter-comparaison') {
      const choix = obtenirChoix();
      projet.comparaisons.push({
        id: nouvelIdentifiant(),
        nom: `Comparaison ${projet.comparaisons.length + 1}`,
        avant: choix[0]?.ref ?? null,
        apres: choix[1]?.ref ?? choix[0]?.ref ?? null,
        zone: { type: 'toute' },
      });
    } else if (bouton.dataset.action === 'supprimer-comparaison') {
      projet.comparaisons = projet.comparaisons.filter((c) => c.id !== bouton.dataset.id);
    }
    quandChange();
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    const comparaison = obtenirProjet().comparaisons.find((c) => c.id === cible.dataset.id);
    if (!comparaison) return;
    if (cible.dataset.champ === 'nom') comparaison.nom = cible.value.trim() || comparaison.nom;
    else if (cible.dataset.champ === 'avant') comparaison.avant = cible.value;
    else if (cible.dataset.champ === 'apres') comparaison.apres = cible.value;
    else if (cible.dataset.champ === 'zone') comparaison.zone = JSON.parse(cible.value);
    quandChange();
  });

  return {
    afficher() {
      const projet = obtenirProjet();
      const choix = obtenirChoix();
      const zones = obtenirZones();
      const options = (valeur) =>
        choix.map((c) => `<option value="${echapper(c.ref)}" ${c.ref === valeur ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('');
      conteneur.innerHTML = `
        <h3>Comparer deux surfaces</h3>
        <p class="aide">Volume ajouté et volume enlevé entre deux dates.</p>
        ${projet.comparaisons
          .map((c) => {
            const r = obtenirResultat(c);
            return `
            <div class="carte-role">
              <div class="titre-role">
                <input type="text" data-champ="nom" data-id="${c.id}" value="${echapper(c.nom)}" aria-label="Nom de la comparaison" />
                <button type="button" class="bouton-lien" data-action="supprimer-comparaison" data-id="${c.id}">supprimer</button>
              </div>
              <div class="champs-export">
                <label>Avant <select data-champ="avant" data-id="${c.id}">${options(c.avant)}</select></label>
                <label>Après <select data-champ="apres" data-id="${c.id}">${options(c.apres)}</select></label>
                <label>Zone
                  <select data-champ="zone" data-id="${c.id}">
                    ${zones.map((z) => `<option value="${echapper(JSON.stringify(z.zone))}" ${JSON.stringify(z.zone) === JSON.stringify(c.zone) ? 'selected' : ''}>${echapper(z.nom)}</option>`).join('')}
                  </select>
                </label>
              </div>
              ${resumeResultat(r)}
            </div>`;
          })
          .join('')}
        <button type="button" class="bouton-secondaire" data-action="ajouter-comparaison" ${choix.length < 2 ? 'disabled' : ''}>+ Nouvelle comparaison</button>
        ${choix.length < 2 ? '<p class="aide">Il faut au moins deux surfaces (surfaces du projet ou stocks calculés).</p>' : ''}
      `;
    },
  };
}

/** Résultat d'une comparaison en quelques lignes. */
function resumeResultat(r) {
  if (!r) return '';
  if (r.erreurs) return `<div class="erreur"><ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
  return `
    <table class="tableau-detail">
      <tr><td>Volume ajouté (remblai)</td><td><strong>${formaterNombre(r.remblai)} m³</strong></td></tr>
      <tr><td>Volume enlevé (déblai)</td><td><strong>${formaterNombre(r.deblai)} m³</strong></td></tr>
      <tr><td>Différence (ajouté − enlevé)</td><td>${formaterNombre(r.remblai - r.deblai)} m³</td></tr>
      <tr><td>Surface comparée</td><td>${formaterNombre(r.surfacePlan)} m²</td></tr>
    </table>
    ${r.surfaceNonCouverte > 0 ? `<div class="avertissement"><p>${formaterNombre(r.surfaceNonCouverte)} m² ne sont pas couverts par la surface « avant » (non comptés).</p></div>` : ''}
    ${r.surfaceZone - r.surfacePlan > 0.01 ? `<div class="avertissement"><p>${formaterNombre(r.surfaceZone - r.surfacePlan)} m² de la zone ne sont pas couverts par la surface « après » (non comptés).</p></div>` : ''}`;
}
