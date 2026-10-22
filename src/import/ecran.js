// Bloc « Levés » de l'onglet Projet : les levés du projet (le levé coché est affiché sur le plan) et
// l'import d'un fichier de points (chaque fichier devient un levé). Le levé avec le récepteur se fait
// dans l'onglet Terrain (src/leve/ecran.js) ; les surfaces LandXML / DXF dans Calculs › Surfaces.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';

/**
 * Crée l'onglet Importer dans "conteneur". Les actions sont faites par main.js via "actions" :
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * importerPlanDxf(fichier), voirPlanDxf(id), supprimerPlanDxf(id), montrerCalqueDxf(id, n° du calque, visible),
 * montrerTousCalquesDxf(id, visible)
 * Renvoie { afficher(projet, dernierImport, dernierPlan) }.
 */
export function creerEcranImport(conteneur, actions) {
  // Listes de calques ouvertes (gardées d'un dessin à l'autre) : identifiants des plans.
  const calquesOuverts = new Set();
  conteneur.addEventListener('toggle', (evenement) => {
    const id = evenement.target.dataset?.calquesPlan;
    if (!id) return;
    if (evenement.target.open) calquesOuverts.add(id);
    else calquesOuverts.delete(id);
  }, true);

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, id } = bouton.dataset;
    if (action === 'supprimer-leve') actions.supprimerLeve(id);
    else if (action === 'voir-plan') actions.voirPlanDxf(id);
    else if (action === 'supprimer-plan') actions.supprimerPlanDxf(id);
    else if (action === 'tous-calques') actions.montrerTousCalquesDxf(id, bouton.dataset.visible === 'oui');
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'leve-actif') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'nom-leve') actions.renommerLeve(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-points' && cible.files[0]) {
      await actions.importerPoints(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'fichier-plan' && cible.files[0]) {
      await actions.importerPlanDxf(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'calque-dxf') {
      actions.montrerCalqueDxf(cible.dataset.id, Number(cible.dataset.calque), cible.checked);
    }
  });

  return {
    /**
     * Redessine le bloc. dernierImport : résultat du dernier import de points, ou null ;
     * dernierPlan : message du dernier import de plan DXF ({ erreur } ou { avertissements }), ou null.
     */
    afficher(projet, dernierImport, dernierPlan = null) {
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

        <section class="carte-section">
          ${titreSection('fichier', 'Plans DXF (fond de plan)')}
          <p class="aide">Plan d'AutoCAD ou de Mensura en MN95, affiché sous le levé (implantation). Un DWG doit d'abord être enregistré en DXF.</p>
          ${listePlansDxf(projet, calquesOuverts)}
          <label class="bouton-secondaire bouton-fichier">
            + Importer un plan DXF
            <input type="file" data-champ="fichier-plan" accept=".dxf,application/dxf" hidden />
          </label>
          ${dernierPlan ? messagePlan(dernierPlan) : ''}
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

/** Plans DXF du projet : nom, nombre d'objets, voir / supprimer, et la liste des calques à cocher. */
function listePlansDxf(projet, calquesOuverts) {
  const plans = projet.plansDxf ?? [];
  if (plans.length === 0) return '';
  return `<div class="liste-plans-dxf">${plans
    .map((plan) => {
      const prefixe = prefixeCommun(plan.calques.map((c) => c.nom));
      const visibles = plan.calques.filter((c) => c.visible).length;
      return `<div class="ligne-plan-dxf">
        <strong>${echapper(plan.nom)}</strong>
        <div class="ligne-outils">
          <span class="aide">${plan.compte?.objets ?? 0} objets · ${visibles} / ${plan.calques.length} calques affichés</span>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="voir-plan" data-id="${plan.id}">voir</button>
          <button type="button" class="bouton-lien" data-action="supprimer-plan" data-id="${plan.id}">supprimer</button>
        </div>
        <details data-calques-plan="${plan.id}" ${calquesOuverts.has(plan.id) ? 'open' : ''}>
          <summary>Calques</summary>
          <div class="ligne-outils">
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="tous-calques" data-id="${plan.id}" data-visible="oui">tous</button>
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="tous-calques" data-id="${plan.id}" data-visible="non">aucun</button>
          </div>
          <div class="calques-dxf">
            ${plan.calques
              .map((calque, numero) => `<label class="case"><input type="checkbox" data-champ="calque-dxf" data-id="${plan.id}" data-calque="${numero}" ${calque.visible ? 'checked' : ''} />
                <span class="pastille-calque" style="background:${echapper(calque.couleur)}"></span>${echapper(calque.nom.slice(prefixe.length) || calque.nom)}</label>`)
              .join('')}
          </div>
        </details>
      </div>`;
    })
    .join('')}</div>`;
}

/**
 * Début commun aux noms des calques, jusqu'au dernier « - » (« DWG_24142-002f - EC projet axe »
 * → « DWG_24142-002f - ») : enlevé dans la liste pour qu'elle reste lisible.
 */
function prefixeCommun(noms) {
  if (noms.length < 2) return '';
  let commun = noms[0];
  for (const nom of noms) while (!nom.startsWith(commun)) commun = commun.slice(0, -1);
  const coupe = commun.lastIndexOf(' - ');
  return coupe >= 0 ? commun.slice(0, coupe + 3) : '';
}

/** Message du dernier import de plan DXF. */
function messagePlan({ erreur, nom, avertissements = [] }) {
  if (erreur) return `<p class="erreur">Impossible de lire « ${echapper(nom)} » : ${echapper(erreur)}</p>`;
  return avertissements.length > 0 ? `<div class="avertissement"><ul>${avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : '';
}
