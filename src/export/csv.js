// Export des volumes en CSV (ouvrable dans Excel).
// Séparateur : point-virgule (réglage suisse d'Excel). Séparateur décimal : le point.
import { formaterNombre } from '../topo/format.js';

/**
 * Construit le texte du fichier CSV : une ligne par surface dont le volume est calculé.
 * Colonnes : Nom ; Base (A ou B) ; Surface (m²) ; Remblai (m³) ; Déblai (m³).
 * Les surfaces dont le calcul est impossible sont ignorées.
 * comparaisons : liste de { nom, resultat } ajoutée à la suite (voir topo/comparaison.js).
 */
export function genererCsv(stocks, resultats, comparaisons = []) {
  const lignes = [['Nom', 'Base', 'Surface (m²)', 'Remblai (m³)', 'Déblai (m³)']];
  stocks.forEach((stock, i) => {
    const r = resultats[i];
    if (!r || r.erreurs) return;
    lignes.push([stock.nom, r.mode, formaterNombre(r.surfacePlan), formaterNombre(r.remblai), formaterNombre(r.deblai)]);
  });
  // Comparaisons, après une ligne vide.
  const calculees = comparaisons.filter(({ resultat }) => resultat && !resultat.erreurs);
  if (calculees.length > 0) {
    lignes.push([], ['Comparaison', 'Surface (m²)', 'Ajouté (m³)', 'Enlevé (m³)']);
    for (const { nom, resultat } of calculees) {
      lignes.push([nom, formaterNombre(resultat.surfacePlan), formaterNombre(resultat.remblai), formaterNombre(resultat.deblai)]);
    }
  }
  return lignes.map((ligne) => ligne.map(champCsv).join(';')).join('\r\n') + '\r\n';
}

/** Met un champ entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champCsv(valeur) {
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}
