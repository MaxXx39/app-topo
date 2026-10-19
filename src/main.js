// Point de départ de l'application : ce fichier construit la page.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { formaterNombre } from './topo/format.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurStocks } from './stocks/editeur.js';
import { echapper } from './outils/echapper.js';
import { calculerTousLesStocks, afficherResultats } from './stocks/resultats.js';
import { creerEcranLandXML } from './landxml/ecran.js';

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
  <section class="apres-import" hidden>
    <h2>2. Stocks et rôles des points</h2>
    <div id="stocks"></div>
  </section>
  <section class="apres-import" hidden>
    <h2>3. Plan</h2>
    <p class="aide">Un doigt pour déplacer, deux doigts pour zoomer (molette à l'ordinateur). Pendant une modification, touche un point pour l'ajouter ou le retirer.</p>
    <div id="plan"></div>
  </section>
  <section class="apres-import" hidden>
    <h2>4. Volumes (mode A : base mesurée)</h2>
    <div id="resultats"></div>
  </section>
  <section>
    <h2>5. Surface LandXML</h2>
    <div id="landxml"></div>
  </section>
  <div id="barre-edition" class="barre-edition" hidden></div>
`;

// La surface choisie servira de base en mode B (étape suivante).
creerEcranLandXML(document.querySelector('#landxml'), { quandChange: () => {} });

const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPoint: (nom) => editeur.toucherPoint(nom),
});
const editeur = creerEditeurStocks(document.querySelector('#stocks'), document.querySelector('#barre-edition'), {
  obtenirPoints: () => points,
  quandChange: () => recalculer(),
});

/** Recalcule les volumes, les affiche, et redessine le plan avec les triangles du stock actif. */
function recalculer() {
  const dessin = editeur.obtenirDessin();
  const resultats = calculerTousLesStocks(dessin.stocks, points);
  afficherResultats(document.querySelector('#resultats'), dessin.stocks, resultats);
  const resultatActif = resultats[dessin.stocks.indexOf(dessin.stockActif)];
  plan.redessiner({ ...dessin, triangles: resultatActif?.trianglesDessus ?? [] });
}

/** Montre les sections suivantes s'il y a des points, et cadre le plan sur ces points. */
function mettreAJourPlan() {
  for (const section of document.querySelectorAll('.apres-import')) section.hidden = points.length === 0;
  editeur.rafraichir();
  recalculer();
  if (points.length > 0) plan.afficherPoints(points);
}

document.querySelector('#fichier-points').addEventListener('change', async (evenement) => {
  const fichier = evenement.target.files[0];
  if (!fichier) return;
  const zone = document.querySelector('#resultat-import');
  try {
    const resultat = lirePoints(await fichier.text());
    points = resultat.points;
    zone.innerHTML = afficherResultat(fichier.name, resultat);
    mettreAJourPlan();
  } catch (erreur) {
    points = [];
    mettreAJourPlan();
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
      <details>
      <summary>Voir la liste des points (${pointsLus.length})</summary>
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
      </div>
      </details>`;
  }

  return html;
}
