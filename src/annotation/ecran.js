// Écran de l'application Annotation (0.177.0, Intermédiaire et Expert, demande du 09.11) : sous le plan, le choix
// de la façon de placer le point (Loupe = on le place sur le plan, GNSS = position du récepteur, Tablette = GPS
// interne s'il est assez précis), puis la fiche du point en cours (position, remarques, photos) et la liste des
// annotations du projet. Tout est rendu en HTML ; les actions passent par data-action (voir main.js « Annotation »).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';

const MODES = { loupe: 'Loupe', gnss: 'GNSS', tablette: 'Tablette' };
const SOURCES = { loupe: 'loupe', gnss: 'GNSS', tablette: 'GPS tablette' };
const ICONE_PHOTO = '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" />';

const nombre = (valeur) => (valeur == null ? '—' : formaterNombre(valeur));

/** Ligne de position d'un point : « E … · N … · H … · GNSS ±0.02 m ». */
export function textePosition(point) {
  const source = SOURCES[point.source] ?? '';
  const precision = point.precision != null ? ` ±${formaterNombre(point.precision)} m` : '';
  return `E ${nombre(point.est)} · N ${nombre(point.nord)} · H ${nombre(point.altitude)} · ${source}${precision}`;
}

/** Fiche du point en cours (nouveau ou modifié). photos : [{ id, miniature }]. */
function htmlFiche(b, photos) {
  const remarques = b.remarques.length > 0 ? b.remarques : [''];
  return `<div class="fiche-annotation">
      <div class="titre-fiche-annotation"><strong>${b.edition ? echapper(b.nom) : 'Nouveau point'}</strong>
        <span data-champ="position-annotation">${echapper(textePosition(b))}</span></div>
      <div class="remarques-annotation">
        ${remarques.map((r, i) => `<textarea rows="2" data-champ="remarque" data-index="${i}" placeholder="Remarque ${i + 1}" aria-label="Remarque ${i + 1}">${echapper(r)}</textarea>`).join('')}
        <button type="button" class="bouton-secondaire" data-action="ajouter-remarque">+ Remarque</button>
      </div>
      <div class="photos-annotation">
        ${photos.map((p) => `<span class="vignette-annotation"><button type="button" class="miniature" data-action="voir-photo-annotation" data-id="${echapper(p.id)}" aria-label="Voir la photo"><img src="${echapper(p.miniature ?? '')}" alt="" /></button>
          <button type="button" class="enlever" data-action="enlever-photo-annotation" data-id="${echapper(p.id)}" aria-label="Enlever la photo">×</button></span>`).join('')}
        <label class="bouton-secondaire bouton-photo-annotation" title="Ajouter une photo"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg> Photo
          <input type="file" data-champ="photo-annotation" accept="image/*" capture="environment" multiple hidden /></label>
      </div>
      <div class="boutons-annotation">
        <button type="button" class="bouton" data-action="enregistrer-annotation">${b.edition ? 'Enregistrer les changements' : 'Enregistrer le point'}</button>
        <button type="button" class="bouton-secondaire" data-action="fermer-annotation">${b.edition ? 'Fermer' : 'Annuler'}</button>
        ${b.edition ? '<button type="button" class="bouton-secondaire suppression-vraie" data-action="supprimer-annotation">Supprimer</button>' : ''}
      </div>
    </div>`;
}

/** Zone de position selon le mode choisi. */
function htmlPosition({ mode, manuel, gnss, tablette }) {
  if (mode === 'gnss') {
    return `<div class="position-annotation"><button type="button" class="bouton" data-action="prendre-gnss-annotation" ${gnss.pret ? '' : 'disabled'}>📍 Prendre la position du récepteur</button>
      <small>${gnss.pret ? 'RTK fixe, inclinaison prête' : 'Il faut le RTK fixe et l\'inclinaison prête'}</small></div>`;
  }
  if (mode === 'tablette') {
    return `<div class="position-annotation"><button type="button" class="bouton" data-action="prendre-tablette-annotation" ${tablette.ok ? '' : 'disabled'}>📍 Prendre la position de la tablette</button>
      <small data-champ="precision-tablette">${echapper(tablette.texte)}</small>
      <label class="reglage-precision-annotation">Précision demandée (m, au mieux) <input type="number" inputmode="decimal" min="0.5" max="50" step="0.5" value="${tablette.maximum}" data-champ="precision-tablette-max" /></label></div>`;
  }
  return `<div class="reglage-loupe reglage-loupe-annotation">
      <div class="fleches-loupe">
        <span></span><button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-annotation" data-valeur="haut" aria-label="Monter la croix">▲</button><span></span>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-annotation" data-valeur="gauche" aria-label="Croix à gauche">◀</button>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-annotation" data-valeur="bas" aria-label="Descendre la croix">▼</button>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacer-loupe-annotation" data-valeur="droite" aria-label="Croix à droite">▶</button>
      </div>
      <div class="zooms-loupe"><span>Zoom</span>
        ${[2, 4, 8].map((z) => `<button type="button" class="puce-choix ${manuel.zoom === z ? 'actif' : ''}" data-action="zoom-loupe-annotation" data-valeur="${z}">×${z}</button>`).join('')}
      </div>
    </div>`;
}

/**
 * HTML de l'écran. { modes: ['loupe', 'gnss', 'tablette'] permis, mode, brouillon (ou null), photos (du brouillon),
 * manuel: { zoom }, gnss: { pret }, tablette: { ok, texte }, liste: [{ nom, remarques, photos, source, premiere }] }.
 */
export function htmlAnnotation({ modes, mode, brouillon, photos = [], manuel, gnss, tablette, liste }) {
  const puces = modes.length > 1
    ? `<div class="modes-annotation" role="group" aria-label="Comment placer le point">${modes.map((m) => `<button type="button" class="puce-choix ${mode === m ? 'actif' : ''}" data-action="mode-annotation" data-valeur="${m}">${MODES[m]}</button>`).join('')}</div>`
    : '';
  const lignes = liste.map((a) => `<button type="button" class="ligne-annotation ${brouillon?.edition && brouillon.nom === a.nom ? 'actif' : ''}" data-action="ouvrir-annotation" data-nom="${echapper(a.nom)}">
      <strong>${echapper(a.nom)}</strong><span>${echapper(a.premiere || '—')}</span><small>${a.remarques} rem. · ${a.photos} photo(s) · ${echapper(SOURCES[a.source] ?? '')}</small></button>`).join('');
  return `<div class="ecran-annotation">
      <div class="entete-annotation">${puces}${bulle('annotation')}</div>
      ${!brouillon || (!brouillon.edition && mode === 'loupe') ? htmlPosition({ mode, manuel, gnss, tablette }) : ''}
      ${brouillon ? htmlFiche(brouillon, photos) : `<p class="invite-annotation"><strong>${mode === 'loupe' ? 'Touche le plan, place la croix, puis lève le doigt' : 'Prends la position, puis ajoute remarques et photos'}</strong></p>`}
      ${liste.length > 0 ? `<div class="liste-annotation"><div class="titre-liste-annotation"><strong>Annotations (${liste.length})</strong></div>${lignes}</div>` : ''}
    </div>`;
}
