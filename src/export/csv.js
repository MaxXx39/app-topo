// Export des volumes, et à part celui des mesures, en CSV (ouvrable dans Excel).
// Séparateur : point-virgule (réglage suisse d'Excel). Séparateur décimal : le point.
import { formaterNombre } from '../topo/format.js';
import { ecrireListeDeNoms } from '../topo/noms.js';
import { NOM_TYPE } from '../mesures/valeurs.js';

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

/**
 * Construit le texte du fichier CSV des mesures (onglet 3. Mesures), sans aucun volume.
 * - mesures : liste de { mesure, resultat } (mesures calculées)
 * Un tableau avec une ligne par mesure (toutes ses valeurs, cochées ou non), puis, après une
 * ligne vide, le détail : une ligne par morceau (longueur) ou par côté (aire).
 * Pente en % (2 décimales), longueurs en m, aires en m² (3 décimales).
 */
export function genererCsvMesures(mesures) {
  const nombre = (valeur) => (valeur === undefined ? '' : formaterNombre(valeur));
  const pente = (valeur) => (valeur === null || valeur === undefined ? '' : valeur.toFixed(2));
  const lignes = [
    ['Nom', 'Type', 'Points', 'Longueur 2D (m)', 'Longueur 3D (m)', 'Dénivelé (m)', 'Pente (%)', 'Aire 2D (m²)', 'Aire 3D (m²)', 'Périmètre 2D (m)', 'Périmètre 3D (m)'],
  ];
  for (const { mesure, resultat: r } of mesures) {
    if (!r || r.erreurs) continue;
    const points = ecrireListeDeNoms(mesure.type === 'longueur' ? mesure.points : mesure.contour);
    lignes.push([mesure.nom, NOM_TYPE[mesure.type], points, nombre(r.l2d), nombre(r.l3d), nombre(r.denivele), pente(r.pente), nombre(r.a2d), nombre(r.a3d), nombre(r.p2d), nombre(r.p3d)]);
  }
  lignes.push([]);
  lignes.push(['Mesure', 'Morceau', 'De', 'À', 'Longueur 2D (m)', 'Longueur 3D (m)', 'Dénivelé (m)', 'Pente (%)']);
  for (const { mesure, resultat: r } of mesures) {
    if (!r || r.erreurs) continue;
    r.morceaux.forEach((m, i) => {
      lignes.push([mesure.nom, i + 1, m.debut.nom, m.fin.nom, nombre(m.l2d), nombre(m.l3d), nombre(m.denivele), pente(m.pente)]);
    });
  }
  return lignes.map((ligne) => ligne.map(champCsv).join(';')).join('\r\n') + '\r\n';
}

/** Met un champ entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champCsv(valeur) {
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}
