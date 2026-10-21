// Onglet 2.2 Volumes : d'abord les volumes (bouton « + Ajouter un volume », puis une carte par
// volume : stock seul ou comparaison de 2 surfaces), ensuite le tableau récapitulatif.
// L'export (PDF, CSV, DXF, LandXML) est ajouté sous cet écran par main.js.
import { formaterNombre } from '../topo/format.js';
import { estImportee } from '../topo/surface.js';
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { nouveauVolume, choisirSorte, nomAutomatique, nomDuCalcul, grouperParNature } from './calculs.js';

/**
 * Crée l'écran des volumes dans "conteneur". Options :
 * - obtenirProjet() : projet ouvert (projet.surfaces, projet.calculs)
 * - obtenirResultat(calcul) : volume calculé (voir calculerVolume dans calculs.js)
 * - etiquette(surface) : nom d'une surface dans les listes
 * - obtenirMontre() : id du calcul colorié sur le plan ; montrer(id) : le choisir
 * - quandChange() : après chaque modification
 * Renvoie { afficher() }.
 */
export function creerEcranVolumes(conteneur, options) {
  const { obtenirProjet, obtenirResultat, etiquette, obtenirMontre, montrer, quandChange } = options;
  let nouveauId = null; // volume qui vient d'être ajouté : on le fait défiler jusqu'à l'écran

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const projet = obtenirProjet();
    const action = bouton.dataset.action;
    if (action === 'montrer') {
      montrer(bouton.dataset.id);
      return;
    }
    if (action === 'ajouter-volume') {
      const volume = nouveauVolume();
      projet.calculs.push(volume);
      nouveauId = volume.id;
    } else if (action === 'supprimer-calcul') {
      const calcul = projet.calculs.find((c) => c.id === bouton.dataset.id);
      if (!calcul || !confirm(`Supprimer le volume « ${nomDuCalcul(calcul, projet.surfaces)} » ?`)) return;
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
    else if (champ === 'sorte') choisirSorte(calcul, cible.value, projet.surfaces, projet.calculs);
    else if (champ === 'stock') {
      calcul.surface1Id = cible.value || null;
      // Un stock importé n'a pas de ligne de contour : sa base est forcément une altitude.
      const stock = projet.surfaces.find((s) => s.id === calcul.surface1Id);
      if (stock && estImportee(stock)) calcul.base = 'altitude';
    } else if (champ === 'base') calcul.base = cible.value;
    else if (champ === 'altitude') {
      const valeur = Number(cible.value.replace(',', '.'));
      calcul.altitude = cible.value.trim() !== '' && Number.isFinite(valeur) ? valeur : null;
    } else if (champ === 'reference') calcul.surface2Id = cible.value || null;
    else if (champ === 'comparee') calcul.surface1Id = cible.value || null;
    else return;
    // Modifié à la main : l'appli ne le changera plus (voir calculsAutomatiques).
    calcul.auto = false;
    quandChange();
  });

  return {
    afficher() {
      const projet = obtenirProjet();
      if (projet.surfaces.length === 0) {
        conteneur.innerHTML = '<p class="vide">Crée d\'abord une surface (onglet 2.1 Surfaces).</p>';
        return;
      }
      const lignes = projet.calculs.map((calcul) => ({ calcul, resultat: obtenirResultat(calcul), nom: nomDuCalcul(calcul, projet.surfaces) }));
      conteneur.innerHTML = `
        <div class="ligne-outils">
          <button type="button" class="bouton" data-action="ajouter-volume">+ Ajouter un volume</button>
          ${bulle('base')}
        </div>
        ${lignes.map((ligne) => carte(ligne, projet.surfaces, { etiquette, montre: obtenirMontre() })).join('')}
        <h3>Récapitulatif</h3>
        ${tableau(lignes, projet.surfaces)}`;
      if (nouveauId) {
        conteneur.querySelector(`[data-carte="${nouveauId}"]`)?.scrollIntoView({ block: 'center' });
        nouveauId = null;
      }
    },
  };
}

/** Base d'un calcul, en quelques mots : « ligne basse », « altitude 425.000 » ou le nom de la référence. */
export function texteBase(calcul, surfaces) {
  if (calcul.uneSeule && calcul.base === 'altitude') {
    return Number.isFinite(calcul.altitude) ? `altitude ${formaterNombre(calcul.altitude)}` : 'altitude ?';
  }
  if (calcul.uneSeule) return 'ligne basse';
  return surfaces.find((s) => s.id === calcul.surface2Id)?.nom ?? '-';
}

/**
 * Tableau récapitulatif des volumes calculés, rangés par nature de la surface 1 (stocks,
 * terrains naturels, terrassements), avec un total par nature quand il y en a plusieurs.
 */
function tableau(lignes, surfaces) {
  const calculees = lignes
    .filter(({ resultat }) => resultat && !resultat.erreurs)
    .map((ligne) => ({ ...ligne, nature: surfaces.find((s) => s.id === ligne.calcul.surface1Id)?.nature }));
  if (calculees.length === 0) return '<p class="aide">Aucun volume calculé : ajoute un volume ci-dessus.</p>';
  return `
    <div class="tableau-defilant">
      <table>
        <thead><tr><th>Volume</th><th>Base</th><th>Surface (m²)</th><th>Remblai (m³)</th><th>Déblai (m³)</th></tr></thead>
        <tbody>
          ${grouperParNature(calculees)
            .map(({ lignes: groupe, total }) =>
              [
                ...groupe.map(
                  ({ calcul, resultat, nom }) => `<tr>
                    <td>${echapper(nom)}</td>
                    <td>${echapper(texteBase(calcul, surfaces))}</td>
                    <td>${formaterNombre(resultat.surfacePlan)}</td>
                    <td><strong>${formaterNombre(resultat.remblai)}</strong></td>
                    <td><strong>${formaterNombre(resultat.deblai)}</strong></td>
                  </tr>`,
                ),
                total
                  ? `<tr class="total"><td>${total.titre}</td><td></td><td>${formaterNombre(total.surfacePlan)}</td><td><strong>${formaterNombre(total.remblai)}</strong></td><td><strong>${formaterNombre(total.deblai)}</strong></td></tr>`
                  : '',
              ].join(''),
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

/**
 * Carte d'un volume : sorte (stock seul ou comparaison), nom, surfaces et base,
 * puis le volume ou la raison pour laquelle il manque.
 */
function carte({ calcul, resultat }, surfaces, { etiquette, montre }) {
  const options = (liste, choisi) =>
    `<option value="" ${choisi ? '' : 'selected'}>- choisir -</option>` +
    liste.map((s) => `<option value="${s.id}" ${s.id === choisi ? 'selected' : ''}>${echapper(etiquette(s))}</option>`).join('');
  const id = calcul.id;
  const sorte = calcul.uneSeule === true ? 'stock' : calcul.uneSeule === false ? 'comparaison' : null;
  const radioSorte = (valeur, titre) =>
    `<label class="case"><input type="radio" name="sorte-${id}" data-champ="sorte" data-id="${id}" value="${valeur}" ${sorte === valeur ? 'checked' : ''} /> ${titre}</label>`;

  let reglages = '';
  if (sorte === 'stock') {
    const stocks = surfaces.filter((s) => s.nature === 'stock');
    const stock = surfaces.find((s) => s.id === calcul.surface1Id);
    const importe = stock && estImportee(stock);
    const radioBase = (valeur, titre, desactive = false) =>
      `<label class="case"><input type="radio" name="base-${id}" data-champ="base" data-id="${id}" value="${valeur}" ${calcul.base === valeur ? 'checked' : ''} ${desactive ? 'disabled' : ''} /> ${titre}</label>`;
    reglages = `
      <label class="champ-large">Stock
        <select data-champ="stock" data-id="${id}">${options(stocks, calcul.surface1Id)}</select>
      </label>
      ${stocks.length === 0 ? '<p class="aide">Aucune surface « Stock » dans le projet (onglet 2.1 Surfaces, « C\'est : Stock »).</p>' : ''}
      <div class="choix-base" role="radiogroup" aria-label="Base du volume">
        <span>Base :</span>
        ${radioBase('contour', 'depuis la ligne du contour', importe)}
        ${radioBase('altitude', 'depuis une altitude')}
      </div>
      ${
        calcul.base === 'altitude'
          ? `<label class="champ-altitude">Altitude de la base (m)
              <input type="text" inputmode="decimal" data-champ="altitude" data-id="${id}" value="${Number.isFinite(calcul.altitude) ? formaterNombre(calcul.altitude) : ''}" placeholder="ex. 425.000" />
            </label>`
          : ''
      }`;
  } else if (sorte === 'comparaison') {
    reglages = `
      <label class="champ-large">1. Surface de référence (dessous, avant : ex. terrain naturel)
        <select data-champ="reference" data-id="${id}">${options(surfaces.filter((s) => s.id !== calcul.surface1Id), calcul.surface2Id)}</select>
      </label>
      <label class="champ-large">2. Surface comparée (dessus, après : ex. terrassement)
        <select data-champ="comparee" data-id="${id}">${options(surfaces.filter((s) => s.id !== calcul.surface2Id), calcul.surface1Id)}</select>
      </label>
      <p class="aide">Remblai : la surface 2 est au-dessus de la référence ; déblai : au-dessous. Calculé là où les deux surfaces se recouvrent.</p>
      ${calcul.zone?.type === 'surface' ? `<p class="aide">Limité au contour de « ${echapper(surfaces.find((s) => s.id === calcul.zone.surfaceId)?.nom ?? '?')} » (réglage d'une ancienne version).</p>` : ''}`;
  }

  return `
    <div class="carte-role carte-volume ${calcul.id === montre ? 'en-edition' : ''}" data-carte="${id}">
      <div class="choix-sorte" role="radiogroup" aria-label="Sorte de volume">
        ${radioSorte('stock', 'Stock seul')}
        ${radioSorte('comparaison', 'Comparaison de 2 surfaces')}
      </div>
      ${
        sorte
          ? `<label class="champ-large">Nom du volume
              <input type="text" data-champ="nom" data-id="${id}" value="${echapper(calcul.nom)}"
                placeholder="${echapper(nomAutomatique(calcul, surfaces))}" />
            </label>
            ${reglages}
            ${detail(calcul, resultat, surfaces)}
            ${
              resultat && !resultat.erreurs
                ? calcul.id === montre
                  ? '<p class="ok">✓ Remblai / déblai affiché sur le plan</p>'
                  : `<button type="button" class="bouton-secondaire" data-action="montrer" data-id="${id}">Voir sur le plan</button>`
                : ''
            }`
          : ''
      }
      <div class="ligne-outils pied-role"><button type="button" class="bouton-lien" data-action="supprimer-calcul" data-id="${id}">supprimer ce volume</button></div>
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
    const base = calcul.uneSeule ? 'La ligne basse' : `La référence « ${echapper(texteBase(calcul, surfaces))} »`;
    const dessus = calcul.uneSeule ? 'le stock' : 'la surface comparée';
    avertissements.push(`${base} ne couvre pas tout ${dessus} : ${formaterNombre(r.surfaceNonCouverte)} m² non couverts (non comptés dans le volume).`);
  }
  if (r.surfaceZone !== undefined && r.surfaceZone - r.surfacePlan > 0.01) {
    avertissements.push(`${formaterNombre(r.surfaceZone - r.surfacePlan)} m² de la zone ne sont pas couverts par la surface comparée (non comptés).`);
  }
  // Lignes du détail : seulement les valeurs connues pour ce calcul.
  const lignes = [
    ['Base', calcul.uneSeule ? (calcul.base === 'altitude' ? `plan horizontal à ${echapper(texteBase(calcul, surfaces))} m` : 'ligne du contour (points du pied)') : `référence « ${echapper(texteBase(calcul, surfaces))} »`],
    ['Surface en plan (triangles)', `${formaterNombre(r.surfacePlan)} m²`],
    r.surfaceContour !== undefined ? ['Surface du contour (polygone)', `${formaterNombre(r.surfaceContour)} m²`] : null,
    r.surfaceZone !== undefined ? ['Surface de la zone', `${formaterNombre(r.surfaceZone)} m²`] : null,
    r.nombreTrianglesDessus !== undefined ? ['Triangles du dessus', r.nombreTrianglesDessus] : null,
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
