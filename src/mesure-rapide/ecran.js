// Écran de la Mesure rapide (0.158.0, dès Intermédiaire, demande du 08.11) : sous le plan, la barre
// d'accroche (0.159.0 : la même qu'Implanter, à icônes : Point, Sommet, Milieu, Sur ligne, Croisement,
// Centre, Perp. (Expert), Manuel (loupe) et, dans l'appli Android, GNSS = lever au récepteur), le résumé en gros (1 point : X Y Z et
// nom ; 2 points : longueurs, altitudes, Δh, pente ; 3 points et plus : périmètres et surfaces), puis
// les tableaux des points et des côtés, page par page s'il y a trop de lignes. 0.161.0 : les boutons
// (↶ Annuler + nom du dernier point, RAZ, Enreg., Export) sont dans la bande du bas (voir main.js).
// Rien n'est enregistré tant qu'on ne touche pas « Enregistrer ». Le tout est rendu en HTML ;
// les actions passent par data-action (voir main.js « Mesure rapide »).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { lignesResume } from '../export/mesure-rapide.js';
import { bulle } from '../aide/bulles.js';

export const LIGNES_PAR_PAGE = 6;

const nombre = (valeur) => (valeur == null ? '—' : formaterNombre(valeur));
const pente = (valeur) => (valeur == null ? '—' : `${valeur.toFixed(2)} %`);

/** Nombre de pages d'un tableau de n lignes. */
export function nombreDePages(n, parPage = LIGNES_PAR_PAGE) {
  return Math.max(1, Math.ceil(n / parPage));
}

/** Tableau d'une page, avec ◀ page ▶ s'il y en a plusieurs. */
function tableauPagine(cle, titre, entetes, lignes, page) {
  if (lignes.length === 0) return '';
  const pages = nombreDePages(lignes.length);
  const p = Math.min(Math.max(0, page), pages - 1);
  const morceau = lignes.slice(p * LIGNES_PAR_PAGE, (p + 1) * LIGNES_PAR_PAGE);
  const navigation = pages > 1
    ? `<span class="pages-mesure">
        <button type="button" class="bouton-secondaire" data-action="page-mesure" data-tableau="${cle}" data-sens="-1" ${p === 0 ? 'disabled' : ''} aria-label="Page précédente">◀</button>
        ${p + 1} / ${pages}
        <button type="button" class="bouton-secondaire" data-action="page-mesure" data-tableau="${cle}" data-sens="1" ${p === pages - 1 ? 'disabled' : ''} aria-label="Page suivante">▶</button>
      </span>`
    : '';
  return `<div class="tableau-mesure-rapide">
      <div class="titre-tableau-mesure"><strong>${titre}</strong>${navigation}</div>
      <table data-tableau="${cle}"><thead><tr>${entetes.map((t) => `<th>${t}</th>`).join('')}</tr></thead>
      <tbody>${morceau.map((ligne) => `<tr>${ligne.map((v) => `<td>${echapper(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>`;
}

/**
 * HTML de l'écran. { mesure (voir topo/mesure-rapide.js), accroche, accroches: [[cle, mot, nom, dessin]],
 * pages: { points, cotes } }.
 */
export function htmlMesureRapide({ mesure, accroche, accroches, pages, manuel = { candidat: false, zoom: 4 }, accrochesOuvertes = false }) {
  const n = mesure.points.length;
  const boutons = accroches.map(([cle, mot, nom, dessin]) => `<button type="button" class="bouton-accroche ${accroche === cle ? 'actif' : ''}" data-action="accroche-mesure" data-valeur="${cle}" title="${nom}" aria-label="${nom}" aria-pressed="${accroche === cle}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg><span class="mot-accroche">${mot}</span></button>`).join('');
  const resume = n > 0
    ? `<div class="resume-mesure-rapide">${lignesResume(mesure).map(([libelle, valeur]) => `<div><span>${echapper(libelle)}</span><strong>${echapper(valeur)}</strong></div>`).join('')}</div>`
    : `<p class="invite-mesure-rapide"><strong>${accroche === 'gnss' ? 'Touche « + Point GNSS » en bas' : 'Touche un point sur le plan'}</strong></p>`;
  const points = tableauPagine('points', `Points (${n})`, ['N°', 'Nom', 'Est', 'Nord', 'H'],
    mesure.points.map((p, i) => [String(i + 1), p.nom || '—', nombre(p.est), nombre(p.nord), nombre(p.altitude)]), pages.points);
  const cotes = tableauPagine('cotes', `Côtés (${mesure.cotes.length})`, ['Côté', 'L 2D', 'L 3D', 'Δh', 'Pente'],
    mesure.cotes.map((c) => [`${c.de} → ${c.a}`, nombre(c.longueur2d), nombre(c.longueur3d), nombre(c.deltaH), pente(c.pente)]), pages.cotes);
  return `<div class="ecran-mesure-rapide">
      <div class="barre-accroche barre-accroche-mesure ${accrochesOuvertes ? 'ouverte' : ''}">
        <div class="accroches" role="group" aria-label="Accroche : ce que l'on prend">${boutons}
          <button type="button" class="bouton-deplier-accroches" data-action="basculer-accroches-mesure" title="${accrochesOuvertes ? 'Cacher' : 'Voir'} les noms" aria-label="${accrochesOuvertes ? 'Cacher' : 'Voir'} les noms des accroches" aria-expanded="${accrochesOuvertes}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${accrochesOuvertes ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" /></svg></button>
        </div>
        ${bulle('mesureRapide')}
      </div>
      ${accroche === 'manuel' ? `<div class="reglage-loupe reglage-loupe-mesure">
          <div class="fleches-loupe">
            <span></span><button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-mesure" data-valeur="haut" aria-label="Monter la croix">▲</button><span></span>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-mesure" data-valeur="gauche" aria-label="Croix à gauche">◀</button>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-mesure" data-valeur="bas" aria-label="Descendre la croix">▼</button>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-mesure" data-valeur="droite" aria-label="Croix à droite">▶</button>
          </div>
          <div class="zooms-loupe"><span>Zoom</span>
            ${[2, 4, 8].map((z) => `<button type="button" class="puce-choix ${manuel.zoom === z ? 'actif' : ''}" data-action="zoom-loupe-mesure" data-valeur="${z}">×${z}</button>`).join('')}
          </div>
          <button type="button" class="bouton ajouter-manuel-mesure" data-action="ajouter-manuel-mesure" ${manuel.candidat ? '' : 'disabled'}>+ Ajouter ce point</button>
        </div>` : ''}
      ${resume}
      ${cotes}
      ${points}
    </div>`;
}
