// Affichage des volumes de chaque stock.
import { calculerVolumeStock } from '../topo/volume.js';
import { formaterNombre } from '../topo/format.js';
import { echapper } from '../outils/echapper.js';

/**
 * Calcule les volumes de tous les stocks.
 * obtenirSurfaceBase(stock) : surface de base { nom, triangles } en mode B (ou null).
 * Renvoie une liste de résultats, dans le même ordre que les stocks.
 */
export function calculerTousLesStocks(stocks, points, obtenirSurfaceBase) {
  return stocks.map((stock) => calculerVolumeStock(stock, points, obtenirSurfaceBase(stock)));
}

/** Affiche le tableau des volumes et le détail de chaque stock dans "conteneur". */
export function afficherResultats(conteneur, stocks, resultats) {
  if (stocks.length === 0) {
    conteneur.innerHTML = '<p class="aide">Crée un stock pour voir son volume.</p>';
    return;
  }

  const lignes = stocks
    .map((stock, i) => {
      const r = resultats[i];
      if (r.erreurs) {
        return `<tr><td>${echapper(stock.nom)}</td><td colspan="4" class="incomplet">incomplet</td></tr>`;
      }
      return `<tr>
        <td>${echapper(stock.nom)}</td>
        <td>${r.mode}</td>
        <td>${formaterNombre(r.surfacePlan)}</td>
        <td><strong>${formaterNombre(r.remblai)}</strong></td>
        <td>${formaterNombre(r.deblai)}</td>
      </tr>`;
    })
    .join('');

  const details = stocks.map((stock, i) => detailStock(stock, resultats[i])).join('');

  conteneur.innerHTML = `
    <div class="tableau-defilant">
      <table>
        <thead><tr><th>Stock</th><th>Mode</th><th>Surface (m²)</th><th>Remblai (m³)</th><th>Déblai (m³)</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    ${details}`;
}

/** Valeurs intermédiaires d'un stock, ou les raisons pour lesquelles il n'est pas calculable. */
function detailStock(stock, r) {
  if (r.erreurs) {
    return `
      <div class="erreur">
        <p><strong>${echapper(stock.nom)} : calcul impossible</strong></p>
        <ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul>
      </div>`;
  }
  const nonCouvert =
    r.surfaceNonCouverte > 0
      ? `<div class="avertissement"><p><strong>${echapper(stock.nom)} :</strong> ${r.mode === 'B' ? `la surface LandXML « ${echapper(r.nomBase)} »` : 'la surface de base'} ne couvre pas tout le contour. Surface non couverte : ${formaterNombre(r.surfaceNonCouverte)} m² (non comptée dans le volume).</p></div>`
      : '';
  return `
    <details class="detail-stock">
      <summary>Détail : ${echapper(stock.nom)}</summary>
      <table class="tableau-detail">
        <tr><td>Surface de base</td><td>${r.mode === 'B' ? `mode B : LandXML « ${echapper(r.nomBase)} »` : 'mode A : points du pied'}</td></tr>
        <tr><td>Surface en plan (triangles)</td><td>${formaterNombre(r.surfacePlan)} m²</td></tr>
        <tr><td>Surface du contour (polygone)</td><td>${formaterNombre(r.surfaceContour)} m²</td></tr>
        <tr><td>Triangles du dessus</td><td>${r.nombreTrianglesDessus}</td></tr>
        <tr><td>Triangles de la base</td><td>${r.nombreTrianglesBase}</td></tr>
        <tr><td>Volume au-dessus de la base (remblai)</td><td>${formaterNombre(r.remblai)} m³</td></tr>
        <tr><td>Volume au-dessous de la base (déblai)</td><td>${formaterNombre(r.deblai)} m³</td></tr>
        <tr><td>Surface en remblai</td><td>${formaterNombre(r.surfaceRemblai)} m²</td></tr>
        <tr><td>Surface en déblai</td><td>${formaterNombre(r.surfaceDeblai)} m²</td></tr>
        <tr><td>Surface non couverte par la base</td><td>${formaterNombre(r.surfaceNonCouverte)} m²</td></tr>
      </table>
    </details>
    ${nonCouvert}`;
}

/** Tableau des comparaisons (volume ajouté / enlevé entre deux surfaces). */
export function afficherComparaisons(conteneur, comparaisons, resultats) {
  if (comparaisons.length === 0) {
    conteneur.innerHTML = '';
    return;
  }
  const lignes = comparaisons
    .map((c, i) => {
      const r = resultats[i];
      if (!r || r.erreurs) return `<tr><td>${echapper(c.nom)}</td><td colspan="3" class="incomplet">impossible</td></tr>`;
      return `<tr><td>${echapper(c.nom)}</td><td>${formaterNombre(r.surfacePlan)}</td><td><strong>${formaterNombre(r.remblai)}</strong></td><td><strong>${formaterNombre(r.deblai)}</strong></td></tr>`;
    })
    .join('');
  conteneur.innerHTML = `
    <h3>Comparaisons</h3>
    <div class="tableau-defilant">
      <table>
        <thead><tr><th>Comparaison</th><th>Surface (m²)</th><th>Ajouté (m³)</th><th>Enlevé (m³)</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>`;
}
