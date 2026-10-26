// Bloc « Imports » de l'onglet Projet : deux boutons (fichier de points, plan DXF), puis les levés
// du projet (le levé coché est affiché sur le plan ; chaque fichier de points devient un levé, les
// points pris avec le récepteur aussi) et les plans DXF (fonds de plan, calques à cocher).
// Le levé avec le récepteur se fait dans l'onglet Terrain (src/leve/ecran.js) ; les surfaces
// LandXML / DXF dans Calculs › Surfaces.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { COULEURS_PLANS } from '../plan/dxf-canvas.js';
import { estEnMn95 } from '../topo/dxf-plan.js';
import { rotationLisible } from '../topo/recalage.js';
import { htmlFormulairePoint, lireFormulairePoint, viderFormulairePoint } from '../outils/formulaire-point.js';
import { nomPointAjoute } from '../topo/points-ajoutes.js';

/**
 * Crée l'onglet Importer dans "conteneur". Les actions sont faites par main.js via "actions" :
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * importerPlanDxf(fichier), voirPlanDxf(id), supprimerPlanDxf(id), reglerPlanDxf(id, { visible, couleur, nom }),
 * recalerPlanDxf(id), exporterPlanRecale(id), annulerRecalagePlan(id),
 * montrerCalqueDxf(id, n° du calque, visible),
 * montrerTousCalquesDxf(id, visible), ajouterPointTape({ nom, est, nord, altitude }) (renvoie
 * { erreur } ou rien), commencerPointage() (ajouter des points en touchant le plan DXF)
 * Renvoie { afficher(projet, dernierImport, dernierPlan) }.
 */
export function creerEcranImport(conteneur, actions) {
  // Listes de calques ouvertes (gardées d'un dessin à l'autre) : identifiants des plans.
  const calquesOuverts = new Set();
  // « Point » ouvert (formulaire pour ajouter un point), et dernière erreur de saisie.
  let pointOuvert = false;
  let erreurPoint = '';
  let derniers = null;
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
    if (action === 'ouvrir-point') {
      pointOuvert = !pointOuvert;
      erreurPoint = '';
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'ajouterPointTape') {
      const valeurs = lireFormulairePoint(conteneur);
      erreurPoint = valeurs.erreur ?? actions.ajouterPointTape(valeurs)?.erreur ?? '';
      const zone = conteneur.querySelector('[data-vivant="erreur-point"]');
      if (zone) zone.textContent = erreurPoint;
      // Ajouté : cases vidées pour le suivant (le curseur reste dans le formulaire).
      if (!erreurPoint && derniers) viderFormulairePoint(conteneur, nomPointAjoute(derniers[0]));
      return;
    }
    if (action === 'pointer-dxf') {
      actions.commencerPointage();
      return;
    }
    if (action === 'supprimer-leve') actions.supprimerLeve(id);
    else if (action === 'voir-plan') actions.voirPlanDxf(id);
    else if (action === 'supprimer-plan') actions.supprimerPlanDxf(id);
    else if (action === 'recaler-plan') actions.recalerPlanDxf(id);
    else if (action === 'exporter-plan-recale') actions.exporterPlanRecale(id);
    else if (action === 'annuler-recalage') actions.annulerRecalagePlan(id);
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
    } else if (cible.dataset.champ === 'plan-visible') {
      actions.reglerPlanDxf(cible.dataset.id, { visible: cible.checked });
    } else if (cible.dataset.champ === 'plan-couleur') {
      actions.reglerPlanDxf(cible.dataset.id, { couleur: cible.value || null });
    } else if (cible.dataset.champ === 'plan-nom') {
      actions.reglerPlanDxf(cible.dataset.id, { nom: cible.value });
    } else if (cible.dataset.champ === 'calque-dxf') {
      actions.montrerCalqueDxf(cible.dataset.id, Number(cible.dataset.calque), cible.checked);
    }
  });

  // Touche Entrée dans le formulaire du point : comme « Ajouter ».
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Enter' || !evenement.target.dataset.point) return;
    evenement.preventDefault();
    conteneur.querySelector('[data-action="ajouterPointTape"]')?.click();
  });

  return { afficher };

  /**
   * Redessine le bloc. dernierImport : résultat du dernier import de points, ou null ;
   * dernierPlan : message du dernier import de plan DXF ({ erreur } ou { avertissements }), ou null.
   */
  function afficher(projet, dernierImport, dernierPlan = null) {
      derniers = [projet, dernierImport, dernierPlan];
      // Pendant une saisie dans le formulaire du point, on ne redessine pas (le curseur serait perdu).
      if (conteneur.contains(document.activeElement) && document.activeElement.dataset?.point) return;
      const plans = projet.plansDxf ?? [];
      conteneur.innerHTML = `
        <section class="carte-section">
          ${titreSection('importer', 'Imports', bulle('imports'))}
          <div class="boutons-imports">
            <label class="bouton-import">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="7" r="1.6" /><circle cx="8" cy="17" r="1.6" /><circle cx="17" cy="17" r="1.6" /></svg>
              <span><strong>Fichier de points</strong><span class="aide">CSV, TXT</span></span>
              <input type="file" data-champ="fichier-points" accept=".csv,.txt,.pts,.xyz,.dat,.asc,text/csv,text/plain" hidden />
            </label>
            <label class="bouton-import seulement-confirme">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21 21 3M3 9l6-6M15 21l6-6M3 15h6v6" /></svg>
              <span><strong>Plan DXF</strong><span class="aide">fond de plan</span></span>
              <input type="file" data-champ="fichier-plan" accept=".dxf,application/dxf" hidden />
            </label>
            <button type="button" class="bouton-import ${pointOuvert ? 'actif' : ''}" data-action="ouvrir-point" aria-expanded="${pointOuvert}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle cx="12" cy="12" r="2.5" /></svg>
              <span><strong>Point</strong><span class="aide">tapé ou sur le DXF</span></span>
            </button>
          </div>
          ${pointOuvert ? `<div class="bloc-point-ajoute">
            ${htmlFormulairePoint(nomPointAjoute(projet))}
            <p class="erreur" data-vivant="erreur-point">${echapper(erreurPoint)}</p>
            ${plans.length > 0 ? '<button type="button" class="bouton-secondaire seulement-confirme" data-action="pointer-dxf">Pointer sur le plan DXF</button>' : ''}
          </div>` : ''}
          ${dernierImport ? afficherImportPoints(dernierImport) : ''}
          ${dernierPlan ? messagePlan(dernierPlan) : ''}

          <p class="titre-section">Levés ${bulle('leves')}</p>
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
          ${listePointsDuLeve(projet)}

          ${plans.length > 0 ? `<div class="seulement-confirme"><p class="titre-section">Plans DXF</p>${listePlansDxf(projet, calquesOuverts)}</div>` : ''}
        </section>
      `;
  }
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
      return `<div class="ligne-plan-dxf ${plan.visible === false ? 'plan-cache' : ''}">
        <div class="entete-plan-dxf">
          <label class="oeil-plan" title="Afficher / cacher le plan"><input type="checkbox" data-champ="plan-visible" data-id="${plan.id}" ${plan.visible !== false ? 'checked' : ''} aria-label="Afficher le plan" /></label>
          <input type="text" class="nom-plan-dxf" data-champ="plan-nom" data-id="${plan.id}" value="${echapper(plan.nom)}" aria-label="Nom du plan" />
          <select data-champ="plan-couleur" data-id="${plan.id}" aria-label="Couleur du plan" style="color: ${plan.couleur || 'inherit'}">
            ${COULEURS_PLANS.map(([valeur, titre]) => `<option value="${valeur}" ${(plan.couleur || '') === valeur ? 'selected' : ''}>${valeur ? '●' : '◐'} ${titre}</option>`).join('')}
          </select>
        </div>
        <div class="ligne-outils">
          <span class="aide">${plan.compte?.objets ?? 0} objets · ${visibles} / ${plan.calques.length} calques affichés</span>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="voir-plan" data-id="${plan.id}">voir</button>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="recaler-plan" data-id="${plan.id}">recaler</button>
          <button type="button" class="bouton-lien" data-action="supprimer-plan" data-id="${plan.id}">supprimer</button>
        </div>
        ${etatRecalage(plan)}
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

/** Recalage d'un plan : recalé (paramètres, export, annuler), ou « pas en MN95 », ou rien. */
function etatRecalage(plan) {
  const r = plan.recalage;
  if (r?.applique) {
    const { gon } = rotationLisible(r.parametres.rotation);
    const ppm = (r.parametres.echelle - 1) * 1e6;
    return `<p class="etat-recalage recale">✓ Recalé en MN95 (${r.paires.filter((p) => p.actif !== false).length} points · rotation ${gon.toFixed(4)} gon · échelle ${ppm >= 0 ? '+' : ''}${ppm.toFixed(0)} ppm)
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporter-plan-recale" data-id="${plan.id}">exporter le DXF recalé</button>
      <button type="button" class="bouton-lien" data-action="annuler-recalage" data-id="${plan.id}">annuler le recalage</button></p>`;
  }
  return plan.bornes && !estEnMn95(plan.bornes) ? '<p class="etat-recalage">Pas en MN95 : « recaler »</p>' : '';
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
