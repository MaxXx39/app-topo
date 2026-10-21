// Choix des points d'une liste (contour, ligne de rupture, points isolés, points d'une mesure),
// partagé par l'onglet 2.1 Surfaces et l'onglet 3. Mesures. Trois façons de choisir :
// les séries du fichier, une liste de noms tapée (« b100 à b116 »), ou des cases à cocher.
// (Toucher les points sur le plan est géré par chaque écran.)
//
// Boutons et champs créés (à écouter par l'écran) : data-action="utiliser-serie" (data-index),
// data-champ="liste" (liste tapée : prise avec Entrée ou « Terminé », dans la barre de modification),
// data-case="<nom>", data-zone="cases" (liste des cases).
import { detecterSeries, ecrireListeDeNoms } from '../topo/noms.js';
import { bulle } from '../aide/bulles.js';
import { echapper } from '../outils/echapper.js';

/**
 * HTML des outils de choix des points d'une liste en cours de modification.
 * - liste : noms déjà choisis (dans l'ordre)
 * - points : points du levé
 * - nomsUtilises : noms déjà utilisés ailleurs (leurs séries sont affichées en plus discret)
 * - messages : erreurs de la dernière liste tapée
 * - casesOuvertes : vrai si la liste des cases doit rester ouverte
 * - enTete : HTML ajouté sous le titre (par exemple la case « ligne fermée »)
 * - plusDeChoix : vrai pour un écran plus simple (onglet 3. Mesures) : seule la liste de noms reste
 *   visible, les séries et les cases à cocher sont rangées dans « Plus de choix »
 */
export function htmlChoixPoints({ liste, points, nomsUtilises = new Set(), messages = [], casesOuvertes = false, enTete = '', plusDeChoix = false }) {
  const series = detecterSeries(points.map((p) => p.nom));
  const htmlSeries =
    series.length > 0
      ? `<p class="aide">Séries du fichier :</p>
        <div class="series">
          ${series
            .map(
              (serie, index) =>
                `<button type="button" class="pastille ${serie.every((nom) => nomsUtilises.has(nom)) ? 'utilisee' : ''}" data-action="utiliser-serie" data-index="${index}">${echapper(ecrireListeDeNoms(serie))} <span class="aide">(${serie.length})</span></button>`,
            )
            .join('')}
        </div>`
      : '';
  const htmlListe = `
      <label class="champ-liste">
        Liste de noms (ex. « b100 à b116, b120 »), puis « Terminé »
        <input type="text" data-champ="liste" value="${echapper(ecrireListeDeNoms(liste))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
      </label>
      ${messages.length > 0 ? `<div class="erreur"><ul>${messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}`;
  const listeCases = `
        <div class="liste-cases">
          ${points
            .map((p) => {
              const rang = liste.indexOf(p.nom);
              return `<label class="case"><input type="checkbox" data-case="${echapper(p.nom)}" ${rang >= 0 ? 'checked' : ''} /> ${echapper(p.nom)}${rang >= 0 ? ` <span class="rang">${rang + 1}</span>` : ''}</label>`;
            })
            .join('')}
        </div>`;

  if (plusDeChoix) {
    return `
      ${enTete}
      ${htmlListe}
      <details data-zone="cases" ${casesOuvertes ? 'open' : ''}>
        <summary>Plus de choix (séries, cases à cocher) ${bulle('choisirPoints')}</summary>
        ${htmlSeries}
        ${listeCases}
      </details>`;
  }
  return `
      <p class="titre-choix">Choisir les points ${bulle('choisirPoints')}</p>
      ${enTete}
      ${htmlSeries}
      ${htmlListe}
      <details data-zone="cases" ${casesOuvertes ? 'open' : ''}>
        <summary>Ou cocher dans la liste des points</summary>
        ${listeCases}
      </details>`;
}

/** Résumé d'une liste de noms : « b1 à b17 (17 pt) », ou « aucun point ». */
export function resumeListe(liste) {
  return liste.length > 0 ? `${echapper(ecrireListeDeNoms(liste))} <span class="aide">(${liste.length} pt)</span>` : '<span class="aide">aucun point</span>';
}
