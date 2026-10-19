// Point de départ de l'application : ce fichier construit la page.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { formaterNombre } from './topo/format.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurStocks } from './stocks/editeur.js';
import { echapper } from './outils/echapper.js';
import { calculerTousLesStocks, afficherResultats } from './stocks/resultats.js';
import { creerEcranLandXML } from './landxml/ecran.js';
import { creerEcranExport } from './export/ecran.js';

// Les points du dernier fichier importé (utilisés par les étapes suivantes).
let points = [];
let nomFichierPoints = '';
// Derniers volumes calculés (pour l'export).
let derniersResultats = [];

const app = document.querySelector('#app');

// Petites icônes des onglets (traits simples).
const ICONES = {
  points: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />',
  stocks: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  landxml: '<path d="M4 4h10l6 6v10H4zM14 4v6h6" />',
};
const ONGLETS = [
  { nom: 'points', titre: 'Points' },
  { nom: 'stocks', titre: 'Stocks' },
  { nom: 'plan', titre: 'Plan' },
  { nom: 'volumes', titre: 'Volumes' },
  { nom: 'landxml', titre: 'LandXML' },
];

app.innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau" data-onglet="points">
        <h2>Importer les points</h2>
        <p class="aide">Fichier CSV exporté d'Emlid Flow, ou fichier TXT (nom, Est, Nord, altitude séparés par des tabulations).</p>
        <label class="bouton">
          Choisir un fichier
          <input type="file" id="fichier-points" accept=".csv,.txt,text/csv,text/plain" hidden />
        </label>
        <div id="resultat-import"></div>
      </section>
      <section class="panneau" data-onglet="stocks">
        <h2>Stocks et rôles des points</h2>
        <div class="apres-import" hidden><div id="stocks"></div></div>
        <p class="vide avant-import">Importe d'abord un fichier de points (onglet Points).</p>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>Volumes</h2>
        <div class="apres-import" hidden>
          <div id="resultats"></div>
          <div id="export" class="carte-export"></div>
        </div>
        <p class="vide avant-import">Importe d'abord un fichier de points (onglet Points).</p>
      </section>
      <section class="panneau" data-onglet="landxml">
        <h2>Surface LandXML</h2>
        <div id="landxml"></div>
      </section>
      <div id="barre-edition" class="barre-edition" hidden></div>
    </div>
    <section class="panneau panneau-plan" data-onglet="plan">
      <div id="plan" class="apres-import" hidden></div>
      <p class="vide plan-vide avant-import">Le plan s'affichera après l'import des points.</p>
    </section>
  </div>
  <nav class="onglets" aria-label="Onglets">
    ${ONGLETS.map(
      (o) => `<button type="button" data-onglet="${o.nom}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[o.nom]}</svg>
        <span>${o.titre}</span>
      </button>`,
    ).join('')}
  </nav>
`;

/** Affiche un onglet. Sur ordinateur, le plan reste toujours visible à droite. */
function afficherOnglet(nom) {
  for (const element of document.querySelectorAll('[data-onglet]')) {
    element.classList.toggle('actif', element.dataset.onglet === nom);
  }
  document.body.dataset.onglet = nom;
  window.scrollTo(0, 0);
}
document.querySelector('.onglets').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-onglet]');
  if (bouton) afficherOnglet(bouton.dataset.onglet);
});
afficherOnglet('points');

// La surface LandXML choisie sert de base aux stocks en mode B.
const ecranLandXML = creerEcranLandXML(document.querySelector('#landxml'), {
  quandChange: () => {
    editeur.rafraichir();
    recalculer();
  },
});

const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPoint: (nom) => editeur.toucherPoint(nom),
  quandToucherStock: (index) => editeur.choisirStock(index),
});
const editeur = creerEditeurStocks(document.querySelector('#stocks'), document.querySelector('#barre-edition'), {
  obtenirPoints: () => points,
  quandChange: () => recalculer(),
  allerAuPlan: () => afficherOnglet('plan'),
  obtenirSurfaceLandXML: () => ecranLandXML.surfaceChoisie(),
});

creerEcranExport(document.querySelector('#export'), {
  obtenirDonnees: () => ({
    stocks: editeur.obtenirDessin().stocks,
    resultats: derniersResultats,
    points,
    fichierPoints: nomFichierPoints,
  }),
});

/** Recalcule les volumes, les affiche, et redessine le plan avec les triangles du stock actif. */
function recalculer() {
  const dessin = editeur.obtenirDessin();
  const resultats = calculerTousLesStocks(dessin.stocks, points, ecranLandXML.surfaceChoisie());
  derniersResultats = resultats;
  afficherResultats(document.querySelector('#resultats'), dessin.stocks, resultats);
  document.querySelector('#etat').textContent =
    points.length > 0 ? `${points.length} points · ${dessin.stocks.length} stock(s)` : 'Volumes de stocks';
  plan.redessiner({ ...dessin, resultats });
}

/** Montre les sections suivantes s'il y a des points, et cadre le plan sur ces points. */
function mettreAJourPlan() {
  for (const element of document.querySelectorAll('.apres-import')) element.hidden = points.length === 0;
  for (const element of document.querySelectorAll('.avant-import')) element.hidden = points.length > 0;
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
    nomFichierPoints = fichier.name;
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
