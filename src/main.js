// Point de départ de l'application : ce fichier construit la page.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { formaterNombre } from './topo/format.js';

// Les points du dernier fichier importé (utilisés par les étapes suivantes).
let points = [];

const app = document.querySelector('#app');

app.innerHTML = `
  <section>
    <h2>1. Importer les points</h2>
    <p>Fichier CSV exporté d'Emlid Flow, ou fichier TXT (nom, Est, Nord, altitude séparés par des tabulations).</p>
    <label class="bouton">
      Choisir un fichier
      <input type="file" id="fichier-points" accept=".csv,.txt,text/csv,text/plain" hidden />
    </label>
    <div id="resultat-import"></div>
  </section>
`;

document.querySelector('#fichier-points').addEventListener('change', async (evenement) => {
  const fichier = evenement.target.files[0];
  if (!fichier) return;
  const zone = document.querySelector('#resultat-import');
  try {
    const resultat = lirePoints(await fichier.text());
    points = resultat.points;
    zone.innerHTML = afficherResultat(fichier.name, resultat);
  } catch (erreur) {
    points = [];
    zone.innerHTML = `<p class="erreur">Impossible de lire le fichier « ${echapper(fichier.name)} » : ${echapper(erreur.message)}</p>`;
  }
  // Permet de choisir à nouveau le même fichier après l'avoir modifié.
  evenement.target.value = '';
});

/** Construit l'affichage du résultat de l'import : résumé, problèmes, tableau. */
function afficherResultat(nomFichier, resultat) {
  const { format, points: pointsLus, erreurs, avertissements } = resultat;

  let html = `<p class="resume"><strong>${pointsLus.length} point(s) lu(s)</strong> dans « ${echapper(nomFichier)} » (format ${format}).</p>`;

  if (erreurs.length > 0) {
    html += `<div class="erreur"><p><strong>${erreurs.length} ligne(s) illisible(s), non importée(s) :</strong></p><ul>`;
    html += erreurs.map((e) => `<li>ligne ${e.ligne} : ${echapper(e.message)}</li>`).join('');
    html += '</ul></div>';
  }

  if (avertissements.length > 0) {
    html += '<div class="avertissement"><p><strong>À vérifier :</strong></p><ul>';
    html += avertissements.map((a) => `<li>${echapper(a)}</li>`).join('');
    html += '</ul></div>';
  }

  if (pointsLus.length > 0) {
    html += `
      <div class="tableau-defilant">
        <table>
          <thead><tr><th>Nom</th><th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th></tr></thead>
          <tbody>
            ${pointsLus
              .map(
                (p) =>
                  `<tr><td>${echapper(p.nom)}</td><td>${formaterNombre(p.est)}</td><td>${formaterNombre(p.nord)}</td><td>${formaterNombre(p.altitude)}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  return html;
}

/** Protège un texte venant d'un fichier avant de l'afficher dans la page. */
function echapper(texte) {
  return String(texte)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
