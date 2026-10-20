// Onglet 1. Importer : fichiers de points (levés) et fonds de plan (DXF).
// Les surfaces LandXML / DXF s'importent dans l'onglet 2.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';

/**
 * Crée l'onglet Importer dans "conteneur". Les actions sont faites par main.js via "actions" :
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * importerFond(fichier), supprimerFond(id), montrerCalqueFond(id, calque, visible)
 * Renvoie { afficher(projet, dernierImport, messageFond) }.
 */
export function creerEcranImport(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton?.dataset.action === 'supprimer-leve') actions.supprimerLeve(bouton.dataset.id);
    if (bouton?.dataset.action === 'supprimer-fond') actions.supprimerFond(bouton.dataset.id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'leve-actif') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'nom-leve') actions.renommerLeve(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-points' && cible.files[0]) {
      await actions.importerPoints(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'fichier-fond' && cible.files[0]) {
      await actions.importerFond(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'calque-fond') {
      actions.montrerCalqueFond(cible.dataset.id, cible.dataset.calque, cible.checked);
    }
  });

  return {
    /**
     * Redessine l'onglet. dernierImport : résultat du dernier import de points, ou null ;
     * messageFond : HTML du résultat du dernier import de fond de plan, ou ''.
     */
    afficher(projet, dernierImport, messageFond = '') {
      conteneur.innerHTML = `
        <h2>1. Importer ${bulle('importer')}</h2>
        <label class="bouton">
          + Fichier de points (CSV, TXT)
          <input type="file" data-champ="fichier-points" accept=".csv,.txt,text/csv,text/plain" hidden />
        </label>
        ${dernierImport ? afficherImportPoints(dernierImport) : ''}

        <h3>Levés ${bulle('leves')}</h3>
        ${
          projet.leves.length > 0
            ? `<div class="liste-leves">${projet.leves
                .map(
                  (leve) => `
                <div class="carte-role ${leve.id === projet.leveActifId ? 'en-edition' : ''}">
                  <label class="case"><input type="radio" name="leve-actif" data-champ="leve-actif" value="${leve.id}" ${leve.id === projet.leveActifId ? 'checked' : ''} />
                    <input type="text" class="nom-leve" data-champ="nom-leve" data-id="${leve.id}" value="${echapper(leve.nom)}" aria-label="Nom du levé" /></label>
                  <div class="ligne-outils">
                    <span class="aide">${leve.points.length} points · ${projet.surfaces.filter((s) => s.leveId === leve.id).length} surface(s)</span>
                    <button type="button" class="bouton-lien" data-action="supprimer-leve" data-id="${leve.id}">supprimer</button>
                  </div>
                </div>`,
                )
                .join('')}</div>`
            : '<p class="vide">Aucun levé : importe un fichier de points.</p>'
        }
        ${listePointsDuLeve(projet)}

        <h3>Fond de plan (DXF) ${bulle('fondDxf')}</h3>
        <label class="bouton-secondaire">
          + Fond de plan (DXF)
          <input type="file" data-champ="fichier-fond" accept=".dxf" hidden />
        </label>
        ${messageFond}
        ${(projet.fonds ?? []).map(carteFond).join('')}
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

/** Carte d'un fond de plan : nom, contenu, et une case par calque pour l'afficher ou le cacher. */
function carteFond(fond) {
  const calques = [...new Set([...fond.traits, ...fond.textes].map((e) => e.calque))].sort((a, b) => a.localeCompare(b, 'fr'));
  const debut = prefixeCommun(calques).length;
  const nomCourt = (calque) => calque.slice(debut) || calque;
  const nombre = (calque) => fond.traits.filter((t) => t.calque === calque).length + fond.textes.filter((t) => t.calque === calque).length;
  return `
    <div class="carte-role carte-fond">
      <div class="titre-role">
        <strong>${echapper(fond.nom)}</strong>
        <button type="button" class="bouton-lien" data-action="supprimer-fond" data-id="${fond.id}">supprimer</button>
      </div>
      <p class="aide">${fond.traits.length} trait(s) · ${fond.textes.length} texte(s) · ${calques.length} calque(s). Décoche les calques inutiles (hachures, cotes…).</p>
      <div class="liste-calques-fond">
        ${calques
          .map(
            (calque) =>
              `<label class="case"><input type="checkbox" data-champ="calque-fond" data-id="${fond.id}" data-calque="${echapper(calque)}" ${fond.calquesCaches.includes(calque) ? '' : 'checked'} /> ${echapper(nomCourt(calque))} <span class="aide">(${nombre(calque)})</span></label>`,
          )
          .join('')}
      </div>
    </div>`;
}

/**
 * Début commun à tous les noms de calques (ex. « DWG_1989-100 - »), coupé après un séparateur,
 * pour n'afficher que la fin utile des noms (« RS_TALUS-HAUT »). '' s'il n'y en a pas.
 */
export function prefixeCommun(noms) {
  if (noms.length < 2) return '';
  let prefixe = noms[0];
  for (const nom of noms) while (!nom.startsWith(prefixe)) prefixe = prefixe.slice(0, -1);
  const coupure = Math.max(...[' ', '-', '_'].map((c) => prefixe.lastIndexOf(c)));
  return coupure >= 0 ? prefixe.slice(0, coupure + 1) : '';
}
