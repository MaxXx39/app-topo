// Seuil de précision (0.322.0, demande du 26.11) : si la précision horizontale OU verticale du récepteur dépasse 3,5 cm,
// la position n'est plus considérée comme FIXE : l'appli la traite comme AUTONOME (affichage rouge, prise de point refusée
// partout, comme pour les corrections trop anciennes). La précision vient du message GST (null si le récepteur n'en envoie pas :
// alors on ne change rien, jamais de précision inventée).

/** Précision maximale acceptée pour un point FIXE (m). */
export const LIMITE_PRECISION_M = 0.035;

/** Vrai si H ou V dépasse la limite. */
export function precisionTropMauvaise(precisionH, precisionV, limite = LIMITE_PRECISION_M) {
  const depasse = (v) => typeof v === 'number' && Number.isFinite(v) && v > limite;
  return depasse(precisionH) || depasse(precisionV);
}

/**
 * État du récepteur avec la règle appliquée : si le statut est FIXE (4) ou FLOTTANT (5) et la précision trop mauvaise,
 * qualite passe à 1 (AUTONOME) ; `qualiteRecepteur` garde la valeur envoyée par le récepteur et `precisionTropMauvaise` vaut true.
 */
export function appliquerSeuilPrecision(etat) {
  if (!etat || (etat.qualite !== 4 && etat.qualite !== 5)) return etat;
  if (!precisionTropMauvaise(etat.precisionH, etat.precisionV)) return etat;
  return { ...etat, qualite: 1, libelleQualite: 'AUTONOME', qualiteRecepteur: etat.qualite, precisionTropMauvaise: true };
}
