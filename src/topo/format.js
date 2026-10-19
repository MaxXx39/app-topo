// Fonctions d'affichage des nombres, comme dans Mensura.

/**
 * Écrit un nombre avec 3 décimales et le point comme séparateur décimal.
 * Sert pour les coordonnées (m), les surfaces (m²) et les volumes (m³).
 * Exemple : 1636.1966 -> "1636.197"
 */
export function formaterNombre(valeur) {
  return valeur.toFixed(3);
}
