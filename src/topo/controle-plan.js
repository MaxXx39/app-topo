// Contrôle d'un plan importé (0.218.0, demande du 12.11) : on touche un point du plan, puis le point connu qui lui correspond
// (point levé, de contrôle…) ; l'écart horizontal dit si le plan est bien en place.
// Seuils validés le 12.11 : ≤ 2 mm vert, de 2 à 15 mm orange, plus de 15 mm rouge. Coordonnées MN95 en mètres, écarts en millimètres.

export const SEUIL_VERT_MM = 2;
export const SEUIL_ORANGE_MM = 15;

/**
 * Écart du point du plan par rapport au point connu : { dEstMm, dNordMm, distanceMm } (millimètres, 1 décimale),
 * dEst / dNord = plan − connu. Renvoie null si une coordonnée manque.
 */
export function ecartControlePlan(pointPlan, pointConnu) {
  const nombres = [pointPlan?.est, pointPlan?.nord, pointConnu?.est, pointConnu?.nord];
  if (!nombres.every(Number.isFinite)) return null;
  const arrondi = (m) => Math.round(m * 10000) / 10;
  const dEst = pointPlan.est - pointConnu.est;
  const dNord = pointPlan.nord - pointConnu.nord;
  return { dEstMm: arrondi(dEst), dNordMm: arrondi(dNord), distanceMm: arrondi(Math.hypot(dEst, dNord)) };
}

/** Couleur du résultat : 'vert' (≤ 2 mm), 'orange' (≤ 15 mm), 'rouge' (au-delà). */
export function couleurControlePlan(distanceMm) {
  if (!Number.isFinite(distanceMm)) return 'rouge';
  if (distanceMm <= SEUIL_VERT_MM) return 'vert';
  return distanceMm <= SEUIL_ORANGE_MM ? 'orange' : 'rouge';
}

/** Texte d'un écart en millimètres : « 3.2 mm ». */
export function texteEcartMm(mm) {
  return `${(Math.round(mm * 10) / 10).toFixed(1)} mm`;
}

/**
 * Ce qui est gardé sur le plan après le contrôle : { le, pointPlan, connu (nom), dEstMm, dNordMm, distanceMm, couleur },
 * ou { le, saute: true, raison } quand le contrôle n'a pas été fait.
 */
export function resultatControlePlan(pointPlan, connu, maintenant = new Date()) {
  const ecart = ecartControlePlan(pointPlan, connu);
  if (!ecart) return null;
  return { le: maintenant.toISOString(), pointPlan: { est: pointPlan.est, nord: pointPlan.nord }, connu: connu.nom ?? '', ...ecart, couleur: couleurControlePlan(ecart.distanceMm) };
}

/** Résumé d'une ligne pour la liste des plans, ou '' si le plan n'a pas été contrôlé. */
export function resumeControlePlan(controle) {
  if (!controle) return '';
  if (controle.saute) return `Non contrôlé (${controle.raison})`;
  return `Contrôlé : écart ${texteEcartMm(controle.distanceMm)} sur ${controle.connu || 'un point connu'}`;
}
