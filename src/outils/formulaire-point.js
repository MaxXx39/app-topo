// Petit formulaire « ajouter un point » (nom, Est, Nord, altitude facultative), le même dans
// Projet › Imports et dans Terrain › Implanter. Voir topo/points-ajoutes.js.
import { echapper } from './echapper.js';
import { lireNombreTape } from '../topo/points-ajoutes.js';

/** HTML du formulaire ; nomPropose : nom écrit en gris (P3…), pris si la case reste vide. */
export function htmlFormulairePoint(nomPropose) {
  return `<div class="formulaire-point" data-zone="formulaire-point">
    <label>Nom<input type="text" data-point="nom" placeholder="${echapper(nomPropose)}" autocomplete="off" autocapitalize="characters" /></label>
    <label>Est<input type="text" inputmode="decimal" data-point="est" placeholder="2 500 000.000" autocomplete="off" /></label>
    <label>Nord<input type="text" inputmode="decimal" data-point="nord" placeholder="1 100 000.000" autocomplete="off" /></label>
    <label>H<input type="text" inputmode="decimal" data-point="altitude" placeholder="facultative" autocomplete="off" /></label>
    <button type="button" class="bouton-secondaire" data-action="ajouterPointTape">Ajouter</button>
  </div>`;
}

/**
 * Valeurs tapées dans le formulaire (dans "racine") : { nom, est, nord, altitude } ou
 * { erreur } si un nombre est illisible ou manque.
 */
export function lireFormulairePoint(racine) {
  const valeur = (champ) => racine.querySelector(`[data-point="${champ}"]`)?.value ?? '';
  const est = lireNombreTape(valeur('est').replace(/\s/g, ''));
  const nord = lireNombreTape(valeur('nord').replace(/\s/g, ''));
  const altitude = lireNombreTape(valeur('altitude'));
  if (est == null || nord == null) return { erreur: 'Est et Nord : écris deux nombres, par exemple 2507360.125' };
  if (altitude === undefined) return { erreur: 'altitude illisible : écris un nombre, ou laisse vide' };
  return { nom: valeur('nom').trim(), est, nord, altitude };
}

/** Vide le formulaire après un ajout. */
export function viderFormulairePoint(racine, nomPropose) {
  for (const champ of racine.querySelectorAll('[data-point]')) champ.value = '';
  const nom = racine.querySelector('[data-point="nom"]');
  if (nom) nom.placeholder = nomPropose;
}
