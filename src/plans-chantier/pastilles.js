// Plans de chantier (0.335.0, demande du 26.11) : pastilles Fond / Plan / Points posées sur le plan, en haut à gauche, comme dans
// les autres modules (mêmes classes `plan-calques`, `plan-puces`, `puce`, `menu-plans-dxf`). Ce fichier ne fait que fabriquer le HTML ;
// les gestes (cases, couleurs, appui long) sont dans `appli.js`.
// Appui long sur une pastille = tout montrer (si tout est caché) ou tout cacher ; appui long sur un calque = le geler
// (reste visible, mais plus aucune accroche dessus).
import { echapper } from '../outils/echapper.js';

const icone = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const PASTILLES = [
  ['fond', 'Fond', '<path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />'],
  ['plan', 'Plan', '<path d="M4 4h11l5 5v11H4z" /><path d="M15 4v5h5M8 13h8M8 17h5" />'],
  ['points', 'Points', '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />'],
];

/**
 * Pastilles + menu ouvert. ouvert : 'fond' | 'plan' | 'points' | null ; pales : { fond, plan, points } (vrai = tout est caché) ;
 * menus : { fond, plan, points } = HTML du contenu de chaque menu.
 */
export function htmlPastilles({ ouvert, pales, menus }) {
  return `<div class="plan-puces">${PASTILLES.map(([cle, texte, d]) => `<button type="button" class="puce ${pales[cle] ? 'pale' : ''} ${ouvert === cle ? 'ouvert' : ''}" data-pastille="${cle}" aria-expanded="${ouvert === cle}" title="Appui long : tout montrer / tout cacher">${icone(d)}${texte}</button>`).join('')}</div>
    ${ouvert ? `<div class="menu-plans-dxf menu-pastille" data-menu-pastille="${ouvert}">${menus[ouvert] ?? ''}</div>` : ''}`;
}

const caseHtml = (attr, valeur, texte, coche) => `<label class="case ligne-menu-plan"><input type="checkbox" ${attr}="${echapper(valeur)}" ${coche ? 'checked' : ''}> ${texte}</label>`;

/** Menu Fond (écran) : photo, carte nationale, cadastre, surfaces. */
export function htmlMenuFond(fond) {
  return [
    caseHtml('data-pastille-fond', 'ortho', 'Photo aérienne swisstopo', Boolean(fond.ortho)),
    caseHtml('data-pastille-fond', 'carte', 'Carte nationale swisstopo', Boolean(fond.carte)),
    caseHtml('data-pastille-fond', 'cadastre', 'Cadastre', Boolean(fond.cadastre)),
    caseHtml('data-pastille-fond', 'surfaces', 'Surfaces du projet', fond.surfaces !== false),
  ].join('');
}

/**
 * Menu Plan (écran) : plans = [{ id, nom, montre, calques: [{ i, nom, visible, couleur, gele }] }] ; deplie = id du plan dont on voit
 * les calques ; phase = { nom, propre } si le plan de chantier a plusieurs phases (choix de plans propre à la phase active).
 */
export function htmlMenuPlan({ plans, deplie, phase }) {
  if (!plans.length) return '<p class="aide-calage">Aucun plan dans le projet.</p>';
  return `${phase ? caseHtml('data-pastille-phase-propre', '1', `Choix propre à « ${echapper(phase.nom)} »`, phase.propre) : ''}
    ${plans.map((p) => `<div class="ligne-menu-plan">${caseHtml('data-pastille-plan', p.id, echapper(p.nom), p.montre)}
      ${p.calques.length ? `<button type="button" class="bouton-secondaire petit" data-pastille-deplier="${echapper(p.id)}" aria-expanded="${deplie === p.id}" title="Calques de ce plan">${deplie === p.id ? '▴' : '▾'} ${p.calques.length}</button>` : ''}</div>
      ${deplie === p.id ? `<ul class="liste-calques liste-calques-menu">${p.calques.map((c) => `<li data-calque-ligne="${echapper(p.id)}:${c.i}" title="Appui long : geler / dégeler (visible, sans accroche)">
        <label><input type="checkbox" data-pastille-calque="${echapper(p.id)}:${c.i}" ${c.visible ? 'checked' : ''}> ${echapper(c.nom)}${c.gele ? ' 🔒' : ''}</label>
        <input type="color" value="${c.couleur}" data-pastille-couleur="${echapper(p.id)}:${c.i}" aria-label="Couleur de ${echapper(c.nom)}"></li>`).join('')}</ul>` : ''}`).join('')}`;
}

/** Menu Points : noms + une case par liste de points levés. */
export function htmlMenuPoints({ listes, noms }) {
  if (!listes.length) return '<p class="aide-calage">Le projet n\'a aucun point levé.</p>';
  return `${caseHtml('data-pastille-points', '__noms', 'Écrire les noms des points', noms)}
    ${listes.map((l) => caseHtml('data-pastille-points', l.id, `${echapper(l.nom)} (${l.n})`, l.montre)).join('')}`;
}
