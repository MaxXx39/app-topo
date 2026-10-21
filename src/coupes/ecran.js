// Coupes (onglet 2.2 Volumes, sous le récapitulatif) : 2 au maximum, A – A' et B – B'.
// Une coupe se trace en touchant le plan deux fois (début, puis fin) ; ses coordonnées se
// corrigent ensuite au clavier. Elle montre toutes les surfaces affichées qu'elle traverse.
import { formaterNombre } from '../topo/format.js';
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { nouvelIdentifiant } from '../topo/surface.js';
import { longueurCoupe } from '../topo/coupe.js';
import { preparerDessinCoupe, coupeEnSvg, texteEchellesCoupe, couleurCoupe } from './dessin.js';

export const COUPES_MAX = 2;
const NOMS_COUPES = ['A', 'B'];
// Taille du dessin à l'écran (mm de la viewBox, mis à la largeur de l'écran).
const DESSIN = { largeur: 120, hauteur: 80 };

/**
 * Crée l'écran des coupes dans "conteneur". Options :
 * - obtenirProjet() : projet ouvert (projet.coupes)
 * - obtenirProfils(coupe) : profils des surfaces traversées [{ nom, nature, lignes }] (voir profilSurface)
 * - commencerTrace(coupe) : demande au plan de toucher le début puis la fin de la coupe
 * - arreterTrace() : abandonne le tracé en cours
 * - traceEnCours() : { id, etape: 'debut' ou 'fin' } pendant un tracé, sinon null
 * - quandChange() : après chaque modification
 * Renvoie { afficher() }.
 */
export function creerEcranCoupes(conteneur, options) {
  const { obtenirProjet, obtenirProfils, commencerTrace, arreterTrace, traceEnCours, quandChange } = options;

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const projet = obtenirProjet();
    const coupe = projet.coupes.find((c) => c.id === bouton.dataset.id);
    const action = bouton.dataset.action;
    if (action === 'ajouter-coupe') {
      if (projet.coupes.length >= COUPES_MAX) return;
      const nom = NOMS_COUPES.find((n) => !projet.coupes.some((c) => c.nom === n));
      const nouvelle = { id: nouvelIdentifiant(), nom, debut: null, fin: null, exageration: 1, dansPdf: false };
      projet.coupes.push(nouvelle);
      quandChange();
      commencerTrace(nouvelle);
    } else if (action === 'retracer' && coupe) {
      commencerTrace(coupe);
    } else if (action === 'annuler-trace') {
      arreterTrace();
    } else if (action === 'supprimer-coupe' && coupe) {
      if (!confirm(`Supprimer la coupe ${coupe.nom} – ${coupe.nom}' ?`)) return;
      if (traceEnCours()?.id === coupe.id) arreterTrace();
      projet.coupes = projet.coupes.filter((c) => c !== coupe);
      quandChange();
    }
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    const coupe = obtenirProjet().coupes.find((c) => c.id === cible.dataset.id);
    if (!coupe) return;
    const champ = cible.dataset.champ;
    if (champ === 'exageration') coupe.exageration = Number(cible.value);
    else if (champ === 'pdf') coupe.dansPdf = cible.checked;
    else if (champ === 'coordonnee') {
      // Coordonnée corrigée au clavier (Est ou Nord du début ou de la fin, en m).
      const valeur = Number(cible.value.replace(',', '.'));
      const extremite = coupe[cible.dataset.bout];
      if (!extremite || cible.value.trim() === '' || !Number.isFinite(valeur)) {
        afficher();
        return;
      }
      extremite[cible.dataset.axe] = valeur;
    } else return;
    quandChange();
  });

  function afficher() {
    const projet = obtenirProjet();
    const trace = traceEnCours();
    conteneur.innerHTML = `
      ${titreSection('coupes', 'Coupes', bulle('coupes'))}
      ${projet.coupes.map((coupe) => carte(coupe, trace, obtenirProfils)).join('')}
      ${
        projet.coupes.length < COUPES_MAX
          ? '<button type="button" class="bouton-secondaire" data-action="ajouter-coupe">+ Ajouter une coupe</button>'
          : `<p class="aide">${COUPES_MAX} coupes au maximum.</p>`
      }`;
  }

  return { afficher };
}

/** Carte d'une coupe : tracé, coordonnées, hauteurs ×1 / ×2, case PDF et dessin. */
function carte(coupe, trace, obtenirProfils) {
  const id = coupe.id;
  const enTrace = trace?.id === id;
  const titre = `<strong>Coupe ${echapper(coupe.nom)} – ${echapper(coupe.nom)}'</strong>`;
  if (enTrace || !coupe.debut || !coupe.fin) {
    const consigne = enTrace
      ? trace.etape === 'debut'
        ? `Touche sur le plan le <strong>début</strong> de la coupe (${echapper(coupe.nom)}).`
        : `Touche maintenant la <strong>fin</strong> de la coupe (${echapper(coupe.nom)}').`
      : 'Coupe pas encore tracée.';
    return `
      <div class="carte-role carte-coupe en-edition">
        <div class="titre-role">${titre}</div>
        <p>${consigne} <span class="aide">Près d'un point levé, la coupe s'accroche à ce point.</span></p>
        <div class="ligne-outils">
          ${enTrace ? '<button type="button" class="bouton-secondaire" data-action="annuler-trace">Annuler le tracé</button>' : `<button type="button" class="bouton-secondaire" data-action="retracer" data-id="${id}">Tracer sur le plan</button>`}
          <button type="button" class="bouton-lien" data-action="supprimer-coupe" data-id="${id}">supprimer</button>
        </div>
      </div>`;
  }

  const champ = (bout, axe) =>
    `<input type="text" inputmode="decimal" data-champ="coordonnee" data-id="${id}" data-bout="${bout}" data-axe="${axe}" value="${formaterNombre(coupe[bout][axe])}" aria-label="${axe === 'est' ? 'Est' : 'Nord'} du ${bout === 'debut' ? 'début' : 'de la fin'}" />`;
  const profils = obtenirProfils(coupe);
  const dessin = preparerDessinCoupe(coupe, profils, DESSIN.largeur, DESSIN.hauteur);
  const radio = (valeur) =>
    `<label class="case"><input type="radio" name="exageration-${id}" data-champ="exageration" data-id="${id}" value="${valeur}" ${coupe.exageration === valeur ? 'checked' : ''} /> ×${valeur}</label>`;
  return `
    <div class="carte-role carte-coupe">
      <div class="titre-role">${titre}<span class="aide">longueur ${formaterNombre(longueurCoupe(coupe.debut, coupe.fin))} m</span></div>
      <table class="coordonnees-coupe">
        <tr><th></th><th>Est (m)</th><th>Nord (m)</th></tr>
        <tr><td>${echapper(coupe.nom)}</td><td>${champ('debut', 'est')}</td><td>${champ('debut', 'nord')}</td></tr>
        <tr><td>${echapper(coupe.nom)}'</td><td>${champ('fin', 'est')}</td><td>${champ('fin', 'nord')}</td></tr>
      </table>
      <div class="ligne-outils">
        <span>Hauteurs :</span> ${radio(1)} ${radio(2)}
        <label class="case"><input type="checkbox" data-champ="pdf" data-id="${id}" ${coupe.dansPdf ? 'checked' : ''} /> dans le PDF</label>
      </div>
      ${
        dessin
          ? `${coupeEnSvg(dessin, DESSIN.largeur)}
            <p class="aide">${texteEchellesCoupe(dessin)}</p>
            <ul class="legende-coupe">
              ${dessin.courbes.map(({ nom, couleur }) => `<li><span style="background: rgb(${couleur.join(',')})"></span>${echapper(nom)}</li>`).join('')}
            </ul>`
          : '<p class="avertissement">La coupe ne traverse aucune surface affichée.</p>'
      }
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="retracer" data-id="${id}">Retracer sur le plan</button>
        <button type="button" class="bouton-lien" data-action="supprimer-coupe" data-id="${id}">supprimer</button>
      </div>
    </div>`;
}

export { couleurCoupe };
