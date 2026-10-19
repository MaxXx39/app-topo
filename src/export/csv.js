// Export des volumes en CSV (ouvrable dans Excel).
// Séparateur : point-virgule (réglage suisse d'Excel). Séparateur décimal : le point.
import { formaterNombre } from '../topo/format.js';

/**
 * Construit le texte du fichier CSV : une ligne par stock calculé.
 * Colonnes : Stock ; Mode ; Surface (m²) ; Remblai (m³) ; Déblai (m³).
 * Les stocks dont le calcul est impossible sont ignorés.
 */
export function genererCsv(stocks, resultats) {
  const lignes = [['Stock', 'Mode', 'Surface (m²)', 'Remblai (m³)', 'Déblai (m³)']];
  stocks.forEach((stock, i) => {
    const r = resultats[i];
    if (!r || r.erreurs) return;
    lignes.push([stock.nom, r.mode, formaterNombre(r.surfacePlan), formaterNombre(r.remblai), formaterNombre(r.deblai)]);
  });
  return lignes.map((ligne) => ligne.map(champCsv).join(';')).join('\r\n') + '\r\n';
}

/** Met un champ entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champCsv(valeur) {
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}
