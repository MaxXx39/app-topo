// Fonctions d'affichage des nombres, comme dans Mensura.

/**
 * Écrit un nombre avec 3 décimales et le point comme séparateur décimal.
 * Sert pour les coordonnées (m), les surfaces (m²) et les volumes (m³).
 * Exemple : 1636.1966 -> "1636.197"
 */
export function formaterNombre(valeur) {
  // Valeur inconnue (altitude d'un point ajouté sans altitude…) : un tiret.
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return '—';
  return fixe3(valeur);
}

/** Nombre à 3 décimales, sans jamais « -0.000 » (une valeur toute proche de zéro s'écrit 0.000). */
export function fixe3(valeur) {
  const texte = valeur.toFixed(3);
  return texte === '-0.000' ? '0.000' : texte;
}
