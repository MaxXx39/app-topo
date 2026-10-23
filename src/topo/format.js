// Fonctions d'affichage des nombres, comme dans Mensura.

/**
 * Écrit un nombre avec 3 décimales et le point comme séparateur décimal.
 * Sert pour les coordonnées (m), les surfaces (m²) et les volumes (m³).
 * Exemple : 1636.1966 -> "1636.197"
 */
export function formaterNombre(valeur) {
  // Valeur inconnue (altitude d'un point ajouté sans altitude…) : un tiret.
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return '—';
  return valeur.toFixed(3);
}
