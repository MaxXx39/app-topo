// Onglet Projet : projet ouvert, levés (fichiers de points), liste des projets, fichier projet.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';

/**
 * Crée l'onglet Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * exporterProjet(), nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id),
 * importerFichierProjet(fichier)
 * Renvoie { afficher(projet, resumes, dernierImport) }.
 */
export function creerEcranProjet(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action === 'exporter') actions.exporterProjet();
    else if (action === 'nouveau') actions.nouveauProjet();
    else if (action === 'ouvrir') actions.ouvrirProjet(id);
    else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
    else if (action === 'supprimer-leve') actions.supprimerLeve(id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.champ === 'leve-actif') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'nom-leve') actions.renommerLeve(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-points' && cible.files[0]) {
      await actions.importerPoints(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  return {
    /** Redessine l'onglet. dernierImport : résultat du dernier import de points (ou null). */
    afficher(projet, resumes, dernierImport) {
      conteneur.innerHTML = `
        <h2>Projet</h2>
        <div class="ligne-outils">
          <label class="champ-large">Nom du projet
            <input type="text" data-champ="nom-projet" value="${echapper(projet.nom)}" />
          </label>
        </div>
        <p class="aide">Enregistré automatiquement sur cet appareil.</p>
        <div class="ligne-outils">
          <button type="button" class="bouton-secondaire" data-action="exporter">Exporter le fichier projet</button>
          <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
        </div>

        <h3>Levés (fichiers de points)</h3>
        <p class="aide">Un levé = un fichier de points (CSV Emlid ou TXT). Les stocks appartiennent au levé affiché. Plusieurs levés permettent de comparer deux dates.</p>
        ${
          projet.leves.length > 0
            ? `<div class="liste-leves">${projet.leves
                .map(
                  (leve) => `
                <div class="carte-role ${leve.id === projet.leveActifId ? 'en-edition' : ''}">
                  <label class="case"><input type="radio" name="leve-actif" data-champ="leve-actif" value="${leve.id}" ${leve.id === projet.leveActifId ? 'checked' : ''} />
                    <input type="text" class="nom-leve" data-champ="nom-leve" data-id="${leve.id}" value="${echapper(leve.nom)}" aria-label="Nom du levé" /></label>
                  <div class="ligne-outils">
                    <span class="aide">${leve.points.length} points · ${leve.stocks.length} stock(s)</span>
                    <button type="button" class="bouton-lien" data-action="supprimer-leve" data-id="${leve.id}">supprimer</button>
                  </div>
                </div>`,
                )
                .join('')}</div>`
            : '<p class="vide">Aucun levé : importe un fichier de points.</p>'
        }
        <label class="bouton">
          + Importer un fichier de points
          <input type="file" data-champ="fichier-points" accept=".csv,.txt,text/csv,text/plain" hidden />
        </label>
        ${dernierImport ? afficherImport(dernierImport) : ''}
        ${listePointsDuLeve(projet)}

        <h3>Mes projets</h3>
        <div class="liste-projets">
          ${resumes
            .map(
              (r) => `
            <div class="carte-role ${r.id === projet.id ? 'en-edition' : ''}">
              <div class="titre-role">
                <strong>${echapper(r.nom)}</strong>
                <span class="aide">${new Date(r.modifieLe).toLocaleDateString('fr-CH')}</span>
              </div>
              <p class="aide">${r.nombreLeves} levé(s) · ${r.nombreStocks} stock(s) · ${r.nombreSurfaces} surface(s)</p>
              <div class="ligne-outils">
                ${r.id === projet.id ? '<span class="ok">Ouvert</span>' : `<button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>`}
                <button type="button" class="bouton-secondaire" data-action="dupliquer" data-id="${r.id}">Dupliquer</button>
                <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>
              </div>
            </div>`,
            )
            .join('')}
        </div>
        <label class="bouton-secondaire bouton-fichier">
          Ouvrir un fichier projet (.topo.json)
          <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
        </label>
        <p class="aide">Pour passer du téléphone à l'ordinateur : « Exporter le fichier projet », envoie-le-toi (mail, Drive…), puis « Ouvrir un fichier projet » sur l'autre appareil.</p>
      `;
    },
  };
}

/** Résultat du dernier import : nombre de points, lignes illisibles, avertissements. */
function afficherImport({ nomFichier, format, points, erreurs, avertissements }) {
  let html = `<p class="resume"><strong>${points.length} point(s) lu(s)</strong> dans « ${echapper(nomFichier)} » (format ${format}).</p>`;
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
  return html;
}

/** Tableau repliable des points du levé affiché. */
function listePointsDuLeve(projet) {
  const leve = projet.leves.find((l) => l.id === projet.leveActifId);
  if (!leve || leve.points.length === 0) return '';
  return `
    <details>
      <summary>Voir les points du levé « ${echapper(leve.nom)} » (${leve.points.length})</summary>
      <div class="tableau-defilant">
        <table>
          <thead><tr><th>Nom</th><th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th></tr></thead>
          <tbody>
            ${leve.points
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
