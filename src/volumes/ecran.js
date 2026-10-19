// Onglet 3. Volumes : pour chaque surface, choix de la base et volume (remblai, déblai).
// L'export (PDF, CSV, DXF, LandXML) est ajouté sous cet écran par main.js.
import { formaterNombre } from '../topo/format.js';
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';

/**
 * Crée l'écran des volumes dans "conteneur".
 * - obtenirLignes() : [{ surface, resultat, bases }] pour les surfaces affichées, où
 *   resultat = volume (voir calculerVolumeSurface : null, { erreurs } ou le résultat)
 *   bases = surfaces qui peuvent servir de base [{ id, nom }]
 * - quandChange() : après un changement de base
 * Renvoie { afficher() }.
 */
export function creerEcranVolumes(conteneur, { obtenirLignes, quandChange }) {
  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ !== 'base') return;
    const ligne = obtenirLignes().find((l) => l.surface.id === cible.dataset.id);
    if (!ligne) return;
    const valeur = cible.value;
    ligne.surface.volume = valeur.startsWith('surface:')
      ? { base: 'surface', surfaceId: valeur.slice('surface:'.length) }
      : { base: valeur, surfaceId: null };
    quandChange();
  });

  return {
    afficher() {
      const lignes = obtenirLignes();
      if (lignes.length === 0) {
        conteneur.innerHTML = '<p class="vide">Crée d\'abord une surface (onglet 2. Surfaces).</p>';
        return;
      }
      conteneur.innerHTML = `
        ${tableau(lignes)}
        <h3>Base de chaque surface ${bulle('base')}</h3>
        ${lignes.map(carte).join('')}`;
    },
  };
}

/** Tableau récapitulatif des volumes calculés, avec un total s'il y en a plusieurs. */
function tableau(lignes) {
  const calculees = lignes.filter(({ resultat }) => resultat && !resultat.erreurs);
  if (calculees.length === 0) return '<p class="aide">Aucun volume calculé : choisis une base ci-dessous.</p>';
  const total = (cle) => calculees.reduce((somme, { resultat }) => somme + resultat[cle], 0);
  return `
    <div class="tableau-defilant">
      <table>
        <thead><tr><th>Surface</th><th>Base</th><th>Surface (m²)</th><th>Remblai (m³)</th><th>Déblai (m³)</th></tr></thead>
        <tbody>
          ${calculees
            .map(
              ({ surface, resultat }) => `<tr>
                <td>${echapper(surface.nom)}</td>
                <td>${resultat.mode}</td>
                <td>${formaterNombre(resultat.surfacePlan)}</td>
                <td><strong>${formaterNombre(resultat.remblai)}</strong></td>
                <td><strong>${formaterNombre(resultat.deblai)}</strong></td>
              </tr>`,
            )
            .join('')}
          ${
            calculees.length > 1
              ? `<tr class="total"><td>Total</td><td></td><td>${formaterNombre(total('surfacePlan'))}</td><td><strong>${formaterNombre(total('remblai'))}</strong></td><td><strong>${formaterNombre(total('deblai'))}</strong></td></tr>`
              : ''
          }
        </tbody>
      </table>
    </div>
    <p class="aide">Base A : points du contour (le pied). Base B : une autre surface.</p>`;
}

/** Carte d'une surface : choix de la base, puis le volume ou la raison pour laquelle il manque. */
function carte({ surface, resultat, bases }) {
  const choix = surface.volume?.base === 'surface' ? `surface:${surface.volume.surfaceId}` : (surface.volume?.base ?? 'aucune');
  const options = [
    ['contour', 'A : points du contour (le pied)'],
    ...bases.filter((b) => b.id !== surface.id).map((b) => [`surface:${b.id}`, `B : surface « ${b.nom} »`]),
    ['aucune', 'Pas de volume'],
  ];
  return `
    <div class="carte-role">
      <div class="titre-role"><strong>${echapper(surface.nom)}</strong></div>
      <label class="champ-large">Base
        <select data-champ="base" data-id="${surface.id}">
          ${options.map(([valeur, texte]) => `<option value="${echapper(valeur)}" ${valeur === choix ? 'selected' : ''}>${echapper(texte)}</option>`).join('')}
        </select>
      </label>
      ${detail(surface, resultat)}
    </div>`;
}

/** Volume et valeurs intermédiaires, ou les raisons pour lesquelles il n'est pas calculable. */
function detail(surface, r) {
  if (!r) return '';
  if (r.erreurs) {
    return `<div class="erreur"><p><strong>Calcul impossible</strong></p><ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
  }
  const nonCouvert =
    r.surfaceNonCouverte > 0
      ? `<div class="avertissement"><p>${r.mode === 'B' ? `La surface « ${echapper(r.nomBase)} »` : 'La base'} ne couvre pas toute la surface : ${formaterNombre(r.surfaceNonCouverte)} m² non couverts (non comptés dans le volume).</p></div>`
      : '';
  return `
    <p class="ok">Remblai <strong>${formaterNombre(r.remblai)} m³</strong> · déblai <strong>${formaterNombre(r.deblai)} m³</strong></p>
    ${nonCouvert}
    <details class="detail-stock">
      <summary>Détail</summary>
      <table class="tableau-detail">
        <tr><td>Base</td><td>${r.mode === 'B' ? `B : surface « ${echapper(r.nomBase)} »` : 'A : points du contour'}</td></tr>
        <tr><td>Surface en plan (triangles)</td><td>${formaterNombre(r.surfacePlan)} m²</td></tr>
        <tr><td>Surface du contour (polygone)</td><td>${formaterNombre(r.surfaceContour)} m²</td></tr>
        <tr><td>Triangles du dessus</td><td>${r.nombreTrianglesDessus}</td></tr>
        <tr><td>Triangles de la base</td><td>${r.nombreTrianglesBase}</td></tr>
        <tr><td>Volume au-dessus de la base (remblai)</td><td>${formaterNombre(r.remblai)} m³</td></tr>
        <tr><td>Volume au-dessous de la base (déblai)</td><td>${formaterNombre(r.deblai)} m³</td></tr>
        <tr><td>Surface en remblai</td><td>${formaterNombre(r.surfaceRemblai)} m²</td></tr>
        <tr><td>Surface en déblai</td><td>${formaterNombre(r.surfaceDeblai)} m²</td></tr>
        <tr><td>Surface non couverte par la base</td><td>${formaterNombre(r.surfaceNonCouverte)} m²</td></tr>
      </table>
    </details>`;
}
