// Fiche d'un point touché sur le plan (0.220.0, demande du 12.11) : une petite fenêtre avec ce qu'on sait du point
// (coordonnées, date, tablette, précisions, qualité, satellites, HDOP, PDOP, âge des corrections, inclinaison, attributs du chantier).
// Les valeurs viennent de l'export des points (export/points.js) : jamais rien d'inventé, ce qui est vide n'est pas montré.
import { echapper } from '../outils/echapper.js';
import { TITRES_INFOS, TITRES_CHANTIER, infosDuPoint, infosChantier } from '../export/points.js';

/** Colonnes de l'export qu'on ne répète pas dans la fiche (nom : en titre ; rôle : propre au tableau). */
const SANS = new Set(['Nom', 'Rôle']);

/**
 * Lignes [titre, valeur] de la fiche d'un point : seulement celles qui ont une valeur.
 * tablette (nom de l'appareil qui a pris le point, facultatif) est ajoutée si le point en garde un.
 */
export function lignesFichePoint(point) {
  const infos = infosDuPoint(point);
  const lignes = TITRES_INFOS.map((titre, i) => [titre, String(infos[i] ?? '')]).filter(([titre, valeur]) => !SANS.has(titre) && valeur !== '');
  if (point.gnss?.appareil) lignes.push(['Tablette', point.gnss.appareil]);
  if (point.chantier) {
    const attributs = infosChantier(point);
    TITRES_CHANTIER.forEach((titre, i) => {
      if (String(attributs[i] ?? '') !== '') lignes.push([titre, String(attributs[i])]);
    });
  }
  return lignes;
}

/** HTML de la fiche. { nom, liste (nom de la liste du point, facultatif), lignes }. */
export function htmlFichePoint({ nom, liste, lignes }) {
  return `<div class="encadre-annotation fiche-point" role="dialog" aria-label="Point ${echapper(nom)}">
      <div class="entete-encadre-annotation"><strong>${echapper(nom)}</strong><span>${echapper(liste ?? '')}</span>
        <button type="button" class="fermer-encadre-annotation" data-action="fermer-fiche" aria-label="Fermer">×</button></div>
      <table class="table-fiche-point"><tbody>${lignes.map(([titre, valeur]) => `<tr><th>${echapper(titre)}</th><td>${echapper(valeur)}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

/** HTML de la petite fenêtre d'un calque touché (0.222.0). { planNom, calqueNom }. */
export function htmlFicheCalque({ planNom, calqueNom }) {
  return `<div class="encadre-annotation fiche-point" role="dialog" aria-label="Calque ${echapper(calqueNom)}">
      <div class="entete-encadre-annotation"><strong>${echapper(calqueNom || 'Calque sans nom')}</strong><span>${echapper(planNom ?? '')}</span>
        <button type="button" class="fermer-encadre-annotation" data-action="fermer-fiche" aria-label="Fermer">×</button></div>
      <button type="button" class="bouton" data-action="masquer-calque">Masquer ce calque</button>
    </div>`;
}
