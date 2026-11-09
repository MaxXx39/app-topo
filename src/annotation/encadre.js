// Encadré d'une annotation touchée sur le plan (0.183.0) : nom, date, remarques et photos, avec « Modifier » (fiche complète).
import { echapper } from '../outils/echapper.js';

/** HTML de l'encadré. { nom, date, remarques: [texte], photos: [{ id, miniature }] }. */
export function htmlEncadreAnnotation({ nom, date, remarques, photos }) {
  return `<div class="encadre-annotation" role="dialog" aria-label="Annotation ${echapper(nom)}">
      <div class="entete-encadre-annotation"><strong>${echapper(nom)}</strong><span>${echapper(date)}</span>
        <button type="button" class="fermer-encadre-annotation" data-action="fermer-encadre" aria-label="Fermer">×</button></div>
      ${remarques.length > 0 ? `<ul>${remarques.map((r) => `<li>${echapper(r)}</li>`).join('')}</ul>` : ''}
      ${photos.length > 0 ? `<div class="photos-encadre-annotation">${photos.map((p) => `<button type="button" class="miniature" data-action="photo-encadre" data-id="${echapper(p.id)}" aria-label="Voir la photo"><img src="${echapper(p.miniature ?? '')}" alt="" /></button>`).join('')}</div>` : ''}
      <button type="button" class="bouton-secondaire" data-action="modifier-encadre">Modifier</button>
    </div>`;
}
