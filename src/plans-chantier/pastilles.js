// Plans de chantier (0.335.0, demande du 26.11) : pastilles Fond / Plan / Points posées sur le plan, en haut à gauche, comme dans
// les autres modules (mêmes classes `plan-calques`, `plan-puces`, `puce`, `menu-plans-dxf`). Ce fichier ne fait que fabriquer le HTML ;
// les gestes (cases, couleurs, appui long) sont dans `appli.js`.
// Appui long sur une pastille = tout montrer (si tout est caché) ou tout cacher. Menus comme dans Lever : réglettes « Trans. »,
// Geler / Isoler / Tout réafficher (on touche des éléments du plan, puis « Valider »).
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

const reglette = (cle, valeur, texte = 'Trans.') => `<label class="reglette-transparence"><b>${texte}</b><input type="range" min="0" max="${cle.startsWith('plan:') ? 100 : 90}" step="5" value="${valeur}" data-pastille-trans="${echapper(cle)}"><span data-vivant-trans="${echapper(cle)}">${valeur} %</span></label>`;

/**
 * Menu Fond (comme Lever) : photo aérienne, carte nationale, cadastre, surfaces ; une réglette « Trans. » (en %) sous la photo
 * et sous la carte. valeurs : { paleur, paleurCarte } en %.
 */
export function htmlMenuFond(fond, valeurs = {}) {
  return [
    caseHtml('data-pastille-fond', 'ortho', 'Photo aérienne swisstopo', Boolean(fond.ortho)),
    fond.ortho ? reglette('photo', valeurs.paleur ?? 0) : '',
    caseHtml('data-pastille-fond', 'carte', 'Carte nationale swisstopo', Boolean(fond.carte)),
    fond.carte ? reglette('carte', valeurs.paleurCarte ?? 0) : '',
    caseHtml('data-pastille-fond', 'cadastre', 'Cadastre', Boolean(fond.cadastre)),
    caseHtml('data-pastille-fond', 'surfaces', 'Surfaces du projet', fond.surfaces !== false),
  ].join('');
}

/**
 * Menu Plan (comme Lever) : boutons Geler / Isoler / Tout réafficher ; puis pour chaque plan : case, réglette « Trans. », couleur
 * (↺ = couleur d'origine) et ▾ qui montre ses calques (case + couleur). plans = [{ id, nom, montre, transparence, couleur, calques:
 * [{ i, nom, visible, couleur }] }] ; deplie = id du plan dont on voit les calques ; phase = { nom, propre } s'il y a plusieurs phases.
 */
export function htmlMenuPlan({ plans, deplie, phase }) {
  if (!plans.length) return '<p class="aide-calage">Aucun plan dans le projet.</p>';
  return `<div class="ligne-gel">
      <button type="button" class="bouton-gel" data-gel-calques="geler" title="Geler : cacher le calque des éléments touchés">Geler</button>
      <button type="button" class="bouton-gel" data-gel-calques="isoler" title="Isoler : ne garder que le calque des éléments touchés">Isoler</button>
      <button type="button" class="bouton-gel" data-gel-calques="reafficher" title="Tout réafficher : tous les calques cachés reviennent">↺ Tout réafficher</button></div>
    ${phase ? caseHtml('data-pastille-phase-propre', '1', `Choix propre à « ${echapper(phase.nom)} »`, phase.propre) : ''}
    ${plans.map((p) => `<div class="plan-menu">
      <div class="ligne-menu-plan">${caseHtml('data-pastille-plan', p.id, echapper(p.nom), p.montre)}
        ${p.calques.length ? `<button type="button" class="bouton-secondaire petit" data-pastille-deplier="${echapper(p.id)}" aria-expanded="${deplie === p.id}" title="Calques de ce plan">${deplie === p.id ? '▴' : '▾'} ${p.calques.length}</button>` : ''}</div>
      ${reglette(`plan:${p.id}`, p.transparence)}
      <div class="ligne-menu-plan"><input type="color" value="${p.couleur}" data-pastille-plan-couleur="${echapper(p.id)}" aria-label="Couleur de ${echapper(p.nom)}"><button type="button" class="bouton-secondaire petit" data-pastille-plan-origine="${echapper(p.id)}" title="Couleur d'origine">↺</button></div>
      ${deplie === p.id ? `<ul class="liste-calques liste-calques-menu">${p.calques.map((c) => `<li>
        <label><input type="checkbox" data-pastille-calque="${echapper(p.id)}:${c.i}" ${c.visible ? 'checked' : ''}> ${echapper(c.nom)}</label>
        <input type="color" value="${c.couleur}" data-pastille-couleur="${echapper(p.id)}:${c.i}" aria-label="Couleur de ${echapper(c.nom)}"></li>`).join('')}</ul>` : ''}</div>`).join('')}`;
}

/** Menu Points : noms + une case par liste de points levés. */
export function htmlMenuPoints({ listes, noms }) {
  if (!listes.length) return '<p class="aide-calage">Le projet n\'a aucun point levé.</p>';
  return `${caseHtml('data-pastille-points', '__noms', 'Écrire les noms des points', noms)}
    ${listes.map((l) => caseHtml('data-pastille-points', l.id, `${echapper(l.nom)} (${l.n})`, l.montre)).join('')}`;
}
