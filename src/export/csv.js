// Export des volumes en CSV (ouvrable dans Excel).
// Séparateur : point-virgule (réglage suisse d'Excel). Séparateur décimal : le point.
import { formaterNombre } from '../topo/format.js';

/**
 * Construit le texte du fichier CSV : une ligne par calcul de volume (onglet 2.2 Volumes).
 * - volumes : liste de { nom, base, resultat } ; base = « ligne basse » ou le nom de la surface 2
 * Colonnes : Nom ; Base ; Surface (m²) ; Remblai (m³) ; Déblai (m³).
 * Les calculs impossibles sont ignorés.
 */
export function genererCsv(volumes) {
  const lignes = [['Nom', 'Base', 'Surface (m²)', 'Remblai (m³)', 'Déblai (m³)']];
  for (const { nom, base, resultat: r } of volumes) {
    if (!r || r.erreurs) continue;
    lignes.push([nom, base, formaterNombre(r.surfacePlan), formaterNombre(r.remblai), formaterNombre(r.deblai)]);
  }
  return lignes.map((ligne) => ligne.map(champCsv).join(';')).join('\r\n') + '\r\n';
}

/** Met un champ entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champCsv(valeur) {
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}
