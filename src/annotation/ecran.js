// Écran de l'application Annotation (0.177.0, Intermédiaire et Expert, demande du 09.11 ; 0.179.0 : bandeau comme Lever).
// Sous le plan : le réglage du GPS tablette (engrenage), le réglage fin de la loupe (mode Manuel), la fiche d'un point
// déjà enregistré (remarques, photos) et la liste des annotations triée par date. Le bandeau fixe en bas (photo, ↶,
// ID + remarque, Enreg. point) est construit par htmlBandeauAnnotation. Tout est rendu en HTML ; les actions passent
// par data-action (voir main.js « Annotation »).
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
      <div class="titre-fiche-annotation"><strong>${echapper(b.nom)}</strong>
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
        <button type="button" class="bouton" data-action="enregistrer-fiche-annotation">Enregistrer les changements</button>
        <button type="button" class="bouton-secondaire" data-action="fermer-annotation">Fermer</button>
        <button type="button" class="bouton-secondaire suppression-vraie" data-action="supprimer-annotation">Supprimer</button>
      </div>
    </div>`;
}

/** Réglage fin de la loupe (mode Manuel) : flèches et zoom. */
function htmlLoupe(manuel) {
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

/** Date et heure d'un point : « 09.11.2026 14:32 » (vide si inconnue). */
export function dateHeure(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n) => String(n).padStart(2, '0');
  return `${deux(d.getDate())}.${deux(d.getMonth() + 1)}.${d.getFullYear()} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/**
 * HTML du bandeau fixe du bas : photo | ↶ (efface le dernier point) | ID + remarque | Enreg. point.
 * { nom (affiché dans l'ID), remarque, photos (nombre de photos du prochain point), position (ou null : Enreg. grisé),
 * dernier (nom du dernier point enregistré, ou '') }.
 */
export function htmlBandeauAnnotation({ nom, remarque, photos, position, dernier }) {
  return `<div class="bandeau-annotation">
      <label class="pastille-annotation photo" title="Photo du prochain point (puis on peut dessiner dessus)" aria-label="Photo du prochain point">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg>${photos > 0 ? `<span class="badge-photos">${photos}</span>` : ''}
        <input type="file" data-champ="photo-annotation-bandeau" accept="image/*" capture="environment" multiple hidden /></label>
      <button type="button" class="pastille-annotation retour" data-action="effacer-dernier-annotation" ${dernier ? '' : 'disabled'}
        title="Effacer le dernier point${dernier ? ` (${echapper(dernier)})` : ''}" aria-label="Effacer le dernier point">↶</button>
      <div class="champs-annotation-bandeau">
        <label class="id-annotation"><span>ID annotation</span>
          <input type="text" data-champ="nom-annotation" value="${echapper(nom)}" autocomplete="off" aria-label="Nom de l'annotation" /></label>
        <input type="text" class="remarque-bandeau" data-champ="remarque-annotation" value="${echapper(remarque)}" placeholder="Remarque" autocomplete="off" aria-label="Remarque" />
      </div>
      <button type="button" class="bouton-enreg-annotation" data-action="enregistrer-annotation" ${position ? '' : 'disabled'} title="Enregistrer le point">
        <span>Enreg. point</span><small>${position ? echapper(SOURCES[position.source] ?? '') : 'prends une position'}</small></button>
    </div>`;
}

/**
 * HTML de l'écran. { mode ('loupe' quand « Manuel » est choisi dans la bande, sinon null), fiche (point rouvert, ou null),
 * photos (de la fiche), manuel: { zoom }, tablette: { texte, maximum }, reglages, tri ('recent' | 'ancien'),
 * liste: [{ nom, remarques, photos, source, premiere, date }] (déjà triée) }.
 */
export function htmlAnnotation({ mode, fiche, photos = [], manuel, tablette, liste, reglages = false, tri = 'recent' }) {
  const lignes = liste.map((a) => `<button type="button" class="ligne-annotation ${fiche?.nom === a.nom ? 'actif' : ''}" data-action="ouvrir-annotation" data-nom="${echapper(a.nom)}">
      <strong>${echapper(a.nom)}</strong><span>${echapper(a.premiere || '—')}</span><small>${echapper(a.date)} · ${a.remarques} rem. · ${a.photos} photo(s) · ${echapper(SOURCES[a.source] ?? '')}</small></button>`).join('');
  const invite = mode === 'loupe'
    ? 'Touche le plan, place la croix, puis lève le doigt'
    : 'Choisis Manuel, GNSS ou GPS tablette en bas';
  return `<div class="ecran-annotation">
      <div class="entete-annotation"><button type="button" class="bouton-engrenage-annotation ${reglages ? 'actif' : ''}" data-action="basculer-reglages-annotation" title="Réglage du GPS de la tablette" aria-label="Réglage du GPS de la tablette" aria-expanded="${reglages}">⚙</button>${bulle('annotation')}</div>
      ${reglages ? `<div class="reglages-annotation"><label class="reglage-precision-annotation">GPS tablette : précision demandée (m, au mieux)
        <input type="number" inputmode="decimal" min="0.5" max="50" step="0.5" value="${tablette.maximum}" data-champ="precision-tablette-max" /></label>
        <small class="precision-annotation" data-champ="precision-tablette">${echapper(tablette.texte)}</small></div>` : ''}
      ${mode === 'loupe' ? htmlLoupe(manuel) : ''}
      ${fiche ? htmlFiche(fiche, photos) : `<p class="invite-annotation"><strong>${invite}</strong></p>`}
      ${liste.length > 0 ? `<div class="liste-annotation"><div class="titre-liste-annotation"><strong>Annotations (${liste.length})</strong>
        <button type="button" class="bouton-lien" data-action="trier-annotation" title="Changer l'ordre de la liste">Trier par date : ${tri === 'recent' ? 'récent d\'abord ▾' : 'ancien d\'abord ▴'}</button></div>${lignes}</div>` : ''}
    </div>`;
}
