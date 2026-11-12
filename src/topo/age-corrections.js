// Âge des corrections NTRIP (0.213.0, demande du 12.11, Base) : au-delà de 2 secondes, le récepteur passe au rouge
// et on ne peut plus prendre ni implanter de point (les corrections ne sont plus assez fraîches).
// L'âge vient de la phrase GGA du récepteur (champ « âge des données différentielles », en secondes).

/** Âge maximal accepté (secondes). */
export const LIMITE_AGE_CORRECTIONS_S = 2;

/** Vrai si les corrections sont trop anciennes : âge connu et supérieur à la limite. Âge inconnu (null) : faux. */
export function correctionsTropAnciennes(age, limite = LIMITE_AGE_CORRECTIONS_S) {
  return typeof age === 'number' && Number.isFinite(age) && age > limite;
}

/** Texte court de l'âge pour l'écran : « corr. 5 s » (arrondi à la seconde). */
export function texteAgeCorrections(age) {
  return Number.isFinite(age) ? `corr. ${Math.round(age)} s` : '';
}
