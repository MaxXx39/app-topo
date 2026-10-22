// Bloc « Levés » de l'onglet Projet : les levés du projet (le levé coché est affiché sur le plan) et
// l'import d'un fichier de points (chaque fichier devient un levé). Le levé avec le récepteur se fait
// dans l'onglet Terrain (src/leve/ecran.js) ; les surfaces LandXML / DXF dans Calculs › Surfaces.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';

/**
 * Crée l'onglet Importer dans "conteneur". Les actions sont faites par main.js via "actions" :
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id)
 * Renvoie { afficher(projet, dernierImport) }.
 */
export function creerEcranImport(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action="supprimer-leve"]');
    if (bouton) actions.supprimerLeve(bouton.dataset.id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'leve-actif') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'nom-leve') actions.renommerLeve(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-points' && cible.files[0]) {
      await actions.importerPoints(cible.files[0]);
      cible.value = '';
    }
  });

  return {
    /** Redessine le bloc. dernierImport : résultat du dernier import de points, ou null. */
    afficher(projet, dernierImport) {
      conteneur.innerHTML = `
        <section class="carte-section">
          ${titreSection('leves', 'Levés', bulle('leves'))}
          ${
            projet.leves.length > 0
              ? `<div class="liste-leves">${projet.leves
                  .map(
                    (leve) => `
                  <div class="ligne-leve ${leve.id === projet.leveActifId ? 'actif' : ''}">
                    <label class="case"><input type="radio" name="leve-actif" data-champ="leve-actif" value="${leve.id}" ${leve.id === projet.leveActifId ? 'checked' : ''} aria-label="Afficher ce levé" />
                      <input type="text" class="nom-leve" data-champ="nom-leve" data-id="${leve.id}" value="${echapper(leve.nom)}" aria-label="Nom du levé" /></label>
                    <div class="ligne-outils">
                      <span class="aide">${leve.points.length} points · ${projet.surfaces.filter((s) => s.leveId === leve.id).length} surface(s)</span>
                      <button type="button" class="bouton-lien" data-action="supprimer-leve" data-id="${leve.id}">supprimer</button>
                    </div>
                  </div>`,
                  )
                  .join('')}</div>`
              : '<p class="vide">Aucun levé pour l\'instant.</p>'
          }
          <label class="bouton-secondaire bouton-fichier">
            + Importer un fichier de points (CSV, TXT)
            <input type="file" data-champ="fichier-points" accept=".csv,.txt,text/csv,text/plain" hidden />
          </label>
          ${dernierImport ? afficherImportPoints(dernierImport) : ''}
          ${listePointsDuLeve(projet)}
        </section>
      `;
    },
  };
}

/** Résultat d'un import de points : nombre de points, lignes illisibles, avertissements. */
function afficherImportPoints({ nomFichier, format, points, erreurs, avertissements }) {
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
