// Onglet 3. Volumes : liste des calculs de volume (surface 1 sur sa ligne basse, ou surface 1
// par rapport à une surface 2), tableau récapitulatif et détail de chaque calcul.
// L'export (PDF, CSV, DXF, LandXML) est ajouté sous cet écran par main.js.
import { formaterNombre } from '../topo/format.js';
import { estImportee } from '../topo/surface.js';
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { creerCalcul, preremplir, nomAutomatique, nomDuCalcul } from './calculs.js';

/**
 * Crée l'écran des volumes dans "conteneur". Options :
 * - obtenirProjet() : projet ouvert (projet.surfaces, projet.calculs)
 * - obtenirResultat(calcul) : volume calculé (voir calculerVolume dans calculs.js)
 * - etiquette(surface) : nom d'une surface dans les listes
 * - obtenirZones() : zones possibles [{ zone, nom }] (toute la surface 1, ou contour d'une surface)
 * - surfaceActive() : surface choisie dans l'onglet 2. Surfaces (proposée pour un nouveau calcul)
 * - obtenirMontre() : id du calcul colorié sur le plan ; montrer(id) : le choisir
 * - quandChange() : après chaque modification
 * Renvoie { afficher() }.
 */
export function creerEcranVolumes(conteneur, options) {
  const { obtenirProjet, obtenirResultat, etiquette, obtenirZones, surfaceActive, obtenirMontre, montrer, quandChange } = options;

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const projet = obtenirProjet();
    const action = bouton.dataset.action;
    if (action === 'montrer') {
      montrer(bouton.dataset.id);
      return;
    }
    if (action === 'ajouter-calcul') {
      projet.calculs.push(creerCalcul(surfaceActive() ?? projet.surfaces[0], projet.surfaces));
    } else if (action === 'supprimer-calcul') {
      const calcul = projet.calculs.find((c) => c.id === bouton.dataset.id);
      if (!calcul || !confirm(`Supprimer le calcul « ${nomDuCalcul(calcul, projet.surfaces)} » ?`)) return;
      projet.calculs = projet.calculs.filter((c) => c !== calcul);
    }
    quandChange();
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    const projet = obtenirProjet();
    const calcul = projet.calculs.find((c) => c.id === cible.dataset.id);
    if (!calcul) return;
    const champ = cible.dataset.champ;
    if (champ === 'nom') calcul.nom = cible.value.trim();
    else if (champ === 'surface1') {
      // Nouvelle surface 1 : la base est préremplie d'après sa nature (stock, terrain...).
      const surface = projet.surfaces.find((s) => s.id === cible.value);
      if (surface) preremplir(calcul, surface, projet.surfaces);
    } else if (champ === 'une-seule') calcul.uneSeule = cible.checked;
    else if (champ === 'surface2') calcul.surface2Id = cible.value || null;
    else if (champ === 'zone') calcul.zone = JSON.parse(cible.value);
    else return;
    quandChange();
  });

  return {
    afficher() {
      const projet = obtenirProjet();
      if (projet.surfaces.length === 0) {
        conteneur.innerHTML = '<p class="vide">Crée d\'abord une surface (onglet 2. Surfaces).</p>';
        return;
      }
      const lignes = projet.calculs.map((calcul) => ({ calcul, resultat: obtenirResultat(calcul), nom: nomDuCalcul(calcul, projet.surfaces) }));
      conteneur.innerHTML = `
        ${tableau(lignes, projet.surfaces)}
        <h3>Calculs ${bulle('base')}</h3>
        ${lignes.map((ligne) => carte(ligne, projet.surfaces, { etiquette, zones: obtenirZones(), montre: obtenirMontre() })).join('')}
        <button type="button" class="bouton-secondaire" data-action="ajouter-calcul">+ Nouveau calcul</button>`;
    },
  };
}

/** Base d'un calcul, en quelques mots : « ligne basse » ou le nom de la surface 2. */
export function texteBase(calcul, surfaces) {
  if (calcul.uneSeule) return 'ligne basse';
  return surfaces.find((s) => s.id === calcul.surface2Id)?.nom ?? '-';
}

/** Tableau récapitulatif des volumes calculés, avec un total s'il y en a plusieurs. */
function tableau(lignes, surfaces) {
  const calculees = lignes.filter(({ resultat }) => resultat && !resultat.erreurs);
  if (calculees.length === 0) return '<p class="aide">Aucun volume calculé : crée un calcul ci-dessous.</p>';
  const total = (cle) => calculees.reduce((somme, { resultat }) => somme + resultat[cle], 0);
  return `
    <div class="tableau-defilant">
      <table>
        <thead><tr><th>Calcul</th><th>Base</th><th>Surface (m²)</th><th>Remblai (m³)</th><th>Déblai (m³)</th></tr></thead>
        <tbody>
          ${calculees
            .map(
              ({ calcul, resultat, nom }) => `<tr>
                <td>${echapper(nom)}</td>
                <td>${echapper(texteBase(calcul, surfaces))}</td>
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
    </div>`;
}

/** Carte d'un calcul : nom, surfaces, zone, puis le volume ou la raison pour laquelle il manque. */
function carte({ calcul, resultat }, surfaces, { etiquette, zones, montre }) {
  const surface1 = surfaces.find((s) => s.id === calcul.surface1Id);
  const options = (choisi, sauf = null) =>
    surfaces
      .filter((s) => s.id !== sauf)
      .map((s) => `<option value="${s.id}" ${s.id === choisi ? 'selected' : ''}>${echapper(etiquette(s))}</option>`)
      .join('');
  const importee = surface1 && estImportee(surface1);
  return `
    <div class="carte-role ${calcul.id === montre ? 'en-edition' : ''}">
      <div class="titre-role">
        <input type="text" data-champ="nom" data-id="${calcul.id}" value="${echapper(calcul.nom)}"
          placeholder="${echapper(nomAutomatique(calcul, surfaces))}" aria-label="Nom du calcul" />
        <button type="button" class="bouton-lien" data-action="supprimer-calcul" data-id="${calcul.id}">supprimer</button>
      </div>
      <label class="champ-large">Surface 1 (dessus, ou après)
        <select data-champ="surface1" data-id="${calcul.id}">${options(calcul.surface1Id)}</select>
      </label>
      <label class="case">
        <input type="checkbox" data-champ="une-seule" data-id="${calcul.id}" ${calcul.uneSeule ? 'checked' : ''} ${importee && !calcul.uneSeule ? 'disabled' : ''} />
        Une seule surface : volume sur sa ligne basse (points du contour)
      </label>
      ${
        calcul.uneSeule
          ? ''
          : `<label class="champ-large">Surface 2 (dessous, ou avant)
              <select data-champ="surface2" data-id="${calcul.id}">
                <option value="" ${calcul.surface2Id ? '' : 'selected'}>- choisir -</option>
                ${options(calcul.surface2Id, calcul.surface1Id)}
              </select>
            </label>
            <label class="champ-large">Zone
              <select data-champ="zone" data-id="${calcul.id}">
                ${zones.map((z) => `<option value="${echapper(JSON.stringify(z.zone))}" ${JSON.stringify(z.zone) === JSON.stringify(calcul.zone) ? 'selected' : ''}>${echapper(z.nom)}</option>`).join('')}
              </select>
            </label>`
      }
      ${detail(calcul, resultat, surfaces)}
      ${
        resultat && !resultat.erreurs
          ? calcul.id === montre
            ? '<p class="ok">✓ Remblai / déblai affiché sur le plan</p>'
            : `<button type="button" class="bouton-secondaire" data-action="montrer" data-id="${calcul.id}">Voir sur le plan</button>`
          : ''
      }
    </div>`;
}

/** Volume et valeurs intermédiaires, ou les raisons pour lesquelles il n'est pas calculable. */
function detail(calcul, r, surfaces) {
  if (!r) return '';
  if (r.erreurs) {
    return `<div class="erreur"><p><strong>Calcul impossible</strong></p><ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
  }
  const avertissements = [];
  if (r.surfaceNonCouverte > 0) {
    const base = calcul.uneSeule ? 'La ligne basse' : `La surface 2 « ${echapper(texteBase(calcul, surfaces))} »`;
    avertissements.push(`${base} ne couvre pas toute la surface 1 : ${formaterNombre(r.surfaceNonCouverte)} m² non couverts (non comptés dans le volume).`);
  }
  if (r.surfaceZone !== undefined && r.surfaceZone - r.surfacePlan > 0.01) {
    avertissements.push(`${formaterNombre(r.surfaceZone - r.surfacePlan)} m² de la zone ne sont pas couverts par la surface 1 (non comptés).`);
  }
  // Lignes du détail : seulement les valeurs connues pour ce calcul.
  const lignes = [
    ['Base', calcul.uneSeule ? 'ligne basse de la surface 1 (points du contour)' : `surface 2 « ${echapper(texteBase(calcul, surfaces))} »`],
    ['Surface en plan (triangles)', `${formaterNombre(r.surfacePlan)} m²`],
    r.surfaceContour !== undefined ? ['Surface du contour (polygone)', `${formaterNombre(r.surfaceContour)} m²`] : null,
    r.surfaceZone !== undefined ? ['Surface de la zone', `${formaterNombre(r.surfaceZone)} m²`] : null,
    r.nombreTrianglesDessus !== undefined ? ['Triangles de la surface 1', r.nombreTrianglesDessus] : null,
    r.nombreTrianglesBase !== undefined ? ['Triangles de la base', r.nombreTrianglesBase] : null,
    ['Volume au-dessus de la base (remblai)', `${formaterNombre(r.remblai)} m³`],
    ['Volume au-dessous de la base (déblai)', `${formaterNombre(r.deblai)} m³`],
    ['Différence (remblai - déblai)', `${formaterNombre(r.remblai - r.deblai)} m³`],
    ['Surface en remblai', `${formaterNombre(r.surfaceRemblai)} m²`],
    ['Surface en déblai', `${formaterNombre(r.surfaceDeblai)} m²`],
    ['Surface non couverte par la base', `${formaterNombre(r.surfaceNonCouverte)} m²`],
  ].filter(Boolean);
  return `
    <p class="ok">Remblai <strong>${formaterNombre(r.remblai)} m³</strong> · déblai <strong>${formaterNombre(r.deblai)} m³</strong></p>
    ${avertissements.map((texte) => `<div class="avertissement"><p>${texte}</p></div>`).join('')}
    <details class="detail-stock">
      <summary>Détail</summary>
      <table class="tableau-detail">
        ${lignes.map(([titre, valeur]) => `<tr><td>${titre}</td><td>${valeur}</td></tr>`).join('')}
      </table>
    </details>`;
}
