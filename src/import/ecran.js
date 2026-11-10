// Onglet Projet (0.103.0, demande du 30.10.2026) : sous le projet ouvert, deux onglets côte à côte,
// « Import » (Expert) et « Exporter » (voir export/module.js), un seul ouvert à la fois ; dessous,
// « Contenu du projet », par catégories repliables (voir blocContenu) :
// Contrôle, Levés (une liste, nature en pastille), Points importés, Surfaces importées (Expert),
// Cadastre (points et lignes ensemble, 0.116.4), Plans DXF (Intermédiaire), Dessins (Intermédiaire).
// - « Import » : fichier de points, points de contrôle, plan DXF, surface (LandXML ou DXF 3D),
//   point tapé ;
// - la liste cochée est affichée sur le plan ; ses points se voient sous elle.
// Le levé avec le récepteur se fait dans l'onglet Terrain (src/leve/ecran.js).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { COULEURS_PLANS } from '../plan/dxf-canvas.js';
import { estEnMn95 } from '../topo/dxf-plan.js';
import { rotationLisible } from '../topo/recalage.js';
import { prefixeDuNom, sansPrefixe, estSurfaceFichier, origineSurface } from '../topo/surface.js';
import { PREFIXE_PDF } from '../topo/pdf-dxf.js';
import { htmlFormulairePoint, lireFormulairePoint, viderFormulairePoint } from '../outils/formulaire-point.js';
import { nomPointAjoute } from '../topo/points-ajoutes.js';
import { COULEURS_LISTES, planDuCadastre, couleurDuCadastre } from '../plan/listes-points.js';
import { choixCouleur as paletteCouleur } from '../outils/palette.js';
import { pointsDuDessin } from '../topo/dessin.js';
import { lireReseaux } from '../leve/reseaux.js';
import { dateHeureDuPoint, jourDuPoint, trierParDate } from '../topo/date-point.js';
import { nomDuType, resumeArchive } from '../projet/archives.js';
import { lireTypesDxf, couleurDuType } from '../topo/types-dxf.js';
import { CATEGORIES_POINTS, CATEGORIES_LEVES, COLONNES_POINTS, ordreColonnes, deplacerColonne, listesDuTableau, lignesDuTableau, trierLignes, texteDate, csvDuTableau } from './tableau-points.js';

/**
 * Crée le panneau « Import » dans "conteneur" et « Contenu du projet » dans "contenu". Les actions sont faites par main.js via "actions" :
 * archiver(type, id), restaurerArchive(id), supprimerArchive(id) (archives, 0.119.0, voir projet/archives.js),
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * importerPlanDxf(fichier), importerPlanPdf(fichier), voirPlanDxf(id), supprimerPlanDxf(id), reglerPlanDxf(id, { visible, couleur, nom }),
 * recalerPlanDxf(id), exporterPlanRecale(id), annulerRecalagePlan(id),
 * montrerCalqueDxf(id, n° du calque, visible),
 * montrerTousCalquesDxf(id, visible), ajouterPointTape({ nom, est, nord, altitude }) (renvoie
 * { erreur } ou rien), commencerPointage() (ajouter des points en touchant le plan DXF),
 * commencerCadastre() (cadastre autour d'un point, voir import/zone-cadastre.js),
 * commencerSurfaceSwisstopo() (tracer la zone sur le plan, voir import/zone-swisstopo.js),
 * importerPointsControle(fichier) (renvoie { erreur } ou rien), importerSurface(fichier) (renvoie
 * le message à afficher, en HTML), renommerSurfaceProjet(id, nom), supprimerSurfaceProjet(id).
 *
 * Renvoie { afficher(projet, dernierImport, dernierPlan) }.
 */
export function creerEcranImport(conteneur, contenu, actions) {
  // Les deux zones reçoivent les mêmes écouteurs (boutons, champs, cases).
  const zones = [conteneur, contenu];
  const ecouter = (type, fonction, capture = false) => zones.forEach((zone) => zone.addEventListener(type, fonction, capture));
  // Catégories de « Contenu du projet » repliées par l'utilisateur (ouvertes au départ).
  const categoriesFermees = new Set();
  ecouter('toggle', (evenement) => {
    const categorie = evenement.target.dataset?.categorie;
    if (!categorie) return;
    if (evenement.target.open) categoriesFermees.delete(categorie);
    else categoriesFermees.add(categorie);
  }, true);
  let messageSurface = ''; // résultat du dernier import de surface (HTML)
  // Listes de calques ouvertes (gardées d'un dessin à l'autre) : identifiants des plans.
  const calquesOuverts = new Set();
  // « Point » ouvert (formulaire pour ajouter un point), et dernière erreur de saisie.
  let pointOuvert = false;
  let erreurPoint = '';
  let derniers = null;
  let messageControle = ''; // erreur du dernier import de points de contrôle
  // 0.186.0 : tri par date (récent d'abord ou ancien d'abord) et recherche d'un jour pour les listes de points (Intermédiaire).
  const filtreDate = { ordre: 'recent', jour: '', jourPoints: '' };
  // 0.191.0 : tableau « Points » : catégories choisies (null = départ : Levé), listes décochées, tri par colonne, jour.
  const tableauEtat = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '' };
  // 0.198.0 : ordre des colonnes du tableau (retenu par tablette) ; « Colonnes » montre les flèches de déplacement.
  const CLE_COLONNES = 'topo-colonnes-points';
  const lireOrdre = () => {
    try { return ordreColonnes(JSON.parse(localStorage.getItem(CLE_COLONNES) ?? '[]')); } catch { return ordreColonnes([]); }
  };
  const ecrireOrdre = (ordre) => {
    tableauEtat.ordre = ordre;
    try { localStorage.setItem(CLE_COLONNES, JSON.stringify(ordre.filter((c) => c !== 'nom'))); } catch { /* réglage non gardé : tant pis */ }
  };
  tableauEtat.ordre = lireOrdre();
  tableauEtat.organiser = false;
  // 0.197.0 : une page à la fois dans « Contenu » : 'points' (liste de points), 'plans', 'surfaces' ou 'archives'.
  let vue = 'points';
  ecouter('toggle', (evenement) => {
    if (evenement.target.classList?.contains('points-de-la-liste')) remplirTableauOuvert(evenement.target);
    const id = evenement.target.dataset?.calquesPlan;
    if (!id) return;
    if (evenement.target.open) calquesOuverts.add(id);
    else calquesOuverts.delete(id);
  }, true);

  ecouter('click', (evenement) => {
    // Pastille de couleur (liste de points, plan DXF) : voir outils/palette.js.
    const pastille = evenement.target.closest('[data-choix-couleur]');
    if (pastille) {
      const { champCouleur, id, choixCouleur: valeur } = pastille.dataset;
      pastille.closest('details')?.removeAttribute('open');
      if (champCouleur === 'couleur-liste') actions.colorerListe(id, valeur || null);
      else if (champCouleur === 'plan-couleur') actions.reglerPlanDxf(id, { couleur: valeur || null });
      return;
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, id } = bouton.dataset;
    if (action === 'modifier-types-dxf') {
      actions.modifierTypesDxf();
      return;
    }
    if (action === 'tp-categorie') {
      const choisies = categoriesChoisies(derniers?.[0], tableauEtat);
      if (choisies.has(bouton.dataset.cle)) choisies.delete(bouton.dataset.cle);
      else choisies.add(bouton.dataset.cle);
      tableauEtat.categories = choisies;
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-liste') {
      if (tableauEtat.listesDecochees.has(id)) tableauEtat.listesDecochees.delete(id);
      else tableauEtat.listesDecochees.add(id);
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-organiser') {
      tableauEtat.organiser = !tableauEtat.organiser;
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-colonne') {
      const sens = bouton.dataset.sens === 'premier' ? 'premier' : Number(bouton.dataset.sens);
      ecrireOrdre(deplacerColonne(tableauEtat.ordre, bouton.dataset.col, sens));
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-ordre-depart') {
      ecrireOrdre(ordreColonnes([]));
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-tri') {
      const colonne = bouton.dataset.col;
      if (tableauEtat.colonne === colonne) tableauEtat.asc = !tableauEtat.asc;
      else {
        tableauEtat.colonne = colonne;
        tableauEtat.asc = colonne !== 'date';
      }
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-effacer-jour') {
      tableauEtat.jour = '';
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'tp-exporter') {
      if (derniers) actions.exporterTableauPoints(csvDuTableau(lignesTriees(derniers[0], tableauEtat)), lignesTriees(derniers[0], tableauEtat).length);
      return;
    }
    if (action === 'trier-points-date') {
      triPoints = { liste: 'recent', recent: 'ancien', ancien: 'liste' }[triPoints];
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'effacer-jour-points') {
      filtreDate.jourPoints = '';
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'trier-listes-date') {
      filtreDate.ordre = filtreDate.ordre === 'recent' ? 'ancien' : 'recent';
      if (derniers) afficher(...derniers);
      return;
    }
    if (action === 'effacer-jour-listes') {
      filtreDate.jour = '';
      if (derniers) afficher(...derniers);
      return;
    }
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
    if (action === 'surface-swisstopo') {
      actions.commencerSurfaceSwisstopo();
      return;
    }
    if (action === 'cadastre-autour') {
      actions.commencerCadastre();
      return;
    }
    if (action === 'voir-photo') actions.voirPhoto(id);
    else if (action === 'archiver') actions.archiver(bouton.dataset.type, id);
    else if (action === 'restaurer-archive') actions.restaurerArchive(id);
    else if (action === 'supprimer-archive') actions.supprimerArchive(id);
    else if (action === 'supprimer-leve') actions.supprimerLeve(id);
    else if (action === 'supprimer-cadastre') actions.supprimerCadastre(id);
    else if (action === 'supprimer-surface-projet') actions.supprimerSurfaceProjet(id);
    else if (action === 'voir-plan') actions.voirPlanDxf(id);
    else if (action === 'supprimer-plan') actions.supprimerPlanDxf(id);
    else if (action === 'recaler-plan') actions.recalerPlanDxf(id);
    else if (action === 'annuler-recalage') actions.annulerRecalagePlan(id);
    else if (action === 'tous-calques') actions.montrerTousCalquesDxf(id, bouton.dataset.visible === 'oui');
  });

  ecouter('change', async (evenement) => {
    if (evenement.target.matches?.('[data-champ="tp-jour"]')) {
      tableauEtat.jour = evenement.target.value;
      if (derniers) afficher(...derniers);
      return;
    }
    if (evenement.target.matches?.('[data-champ="jour-points"]')) {
      filtreDate.jourPoints = evenement.target.value;
      if (derniers) afficher(...derniers);
      return;
    }
    if (evenement.target.matches?.('[data-champ="jour-listes"]')) {
      filtreDate.jour = evenement.target.value;
      if (derniers) afficher(...derniers);
      return;
    }
    const cible = evenement.target;
    if (cible.dataset.champ === 'fichier-controle' && cible.files[0]) {
      // Points de contrôle : sans code de sécurité depuis 0.90.0 (demande du 29.10.2026).
      const fichier = cible.files[0];
      cible.value = '';
      messageControle = (await actions.importerPointsControle(fichier))?.erreur ?? '';
      if (derniers) afficher(...derniers);
    } else if (cible.dataset.champ === 'couleur-liste') actions.colorerListe(cible.dataset.id, cible.value || null);
    else if (cible.dataset.champ === 'leve-actif') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'nom-leve') actions.renommerLeve(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'nom-surface-projet') actions.renommerSurfaceProjet(cible.dataset.id, cible.value.trim()); // (main remet le préfixe)
    else if (cible.dataset.champ === 'fichier-points' && cible.files[0]) {
      await actions.importerPoints(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'fichier-surface-projet' && cible.files[0]) {
      // Surface LandXML ou DXF 3D (avant 0.71.0 : dans Calculs › Surfaces).
      const fichier = cible.files[0];
      cible.value = '';
      messageSurface = (await actions.importerSurface(fichier)) ?? '';
      if (derniers) afficher(...derniers);
    } else if (cible.dataset.champ === 'fichier-plan' && cible.files[0]) {
      await actions.importerPlanDxf(cible.files[0]);
      cible.value = '';
    } else if (cible.dataset.champ === 'fichier-plan-pdf' && cible.files[0]) {
      const fichier = cible.files[0];
      cible.value = '';
      await actions.importerPlanPdf(fichier);
    } else if (cible.dataset.champ === 'cadastre-points') {
      actions.montrerPointsCadastre(cible.dataset.id, cible.checked);
    } else if (cible.dataset.champ === 'plan-visible') {
      actions.reglerPlanDxf(cible.dataset.id, { visible: cible.checked });
    } else if (cible.dataset.champ === 'plan-couleur') {
      actions.reglerPlanDxf(cible.dataset.id, { couleur: cible.value || null });
    } else if (cible.dataset.champ === 'plan-type') {
      actions.reglerPlanDxf(cible.dataset.id, { type: cible.value });
    } else if (cible.dataset.champ === 'plan-nom') {
      actions.reglerPlanDxf(cible.dataset.id, { nom: cible.value });
    } else if (cible.dataset.champ === 'calque-dxf') {
      actions.montrerCalqueDxf(cible.dataset.id, Number(cible.dataset.calque), cible.checked);
    }
  });

  // Touche Entrée dans le formulaire du point : comme « Ajouter ».
  ecouter('keydown', (evenement) => {
    if (evenement.key !== 'Enter' || !evenement.target.dataset.point) return;
    evenement.preventDefault();
    conteneur.querySelector('[data-action="ajouterPointTape"]')?.click();
  });

  /** 0.195.0 : ne montre dans le tableau « Points » que ces catégories (bouton liste d'une tuile du menu). */
  function choisirCategories(cles) {
    tableauEtat.categories = new Set(cles);
    tableauEtat.listesDecochees = new Set();
    if (derniers) afficher(...derniers);
  }
  /** 0.197.0 : page du contenu à montrer : 'points', 'plans', 'surfaces' ou 'archives'. */
  function choisirVue(quelle) {
    vue = ['points', 'plans', 'surfaces', 'archives'].includes(quelle) ? quelle : 'points';
    if (derniers) afficher(...derniers);
  }
  return { afficher, choisirCategories, choisirVue };

  /**
   * Redessine le bloc. dernierImport : résultat du dernier import de points, ou null ;
   * dernierPlan : message du dernier import de plan DXF ({ erreur } ou { avertissements }), ou null.
   */
  function afficher(projet, dernierImport, dernierPlan = null) {
      derniers = [projet, dernierImport, dernierPlan];
      // Pendant une saisie dans le formulaire du point, on ne redessine pas (le curseur serait perdu).
      if (conteneur.contains(document.activeElement) && document.activeElement.dataset?.point) return;
      const plans = projet.plansDxf ?? [];
      conteneur.innerHTML = `<div class="carte-section panneau-onglet-projet panneau-import">
          <p class="titre-panneau-projet">Importer ${bulle('imports')}</p>
          <p class="titre-groupe-import">Fichiers</p>
          <div class="boutons-imports">
            <label class="bouton-import">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="7" r="1.6" /><circle cx="8" cy="17" r="1.6" /><circle cx="17" cy="17" r="1.6" /></svg>
              <span><strong>Fichier de points</strong><span class="aide">CSV, TXT</span></span>
              <input type="file" data-champ="fichier-points" accept=".csv,.txt,.pts,.xyz,.dat,.asc,text/csv,text/plain" hidden />
            </label>
            <label class="bouton-import import-controle">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 19H3Z" /></svg>
              <span><strong>Points de contrôle</strong><span class="aide">CSV, TXT</span></span>
              <input type="file" data-champ="fichier-controle" accept=".csv,.txt,.pts,.xyz,.dat,.asc,text/csv,text/plain" hidden />
            </label>
            <label class="bouton-import">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21 21 3M3 9l6-6M15 21l6-6M3 15h6v6" /></svg>
              <span><strong>Plan DXF</strong><span class="aide">fond de plan</span></span>
              <input type="file" data-champ="fichier-plan" accept=".dxf,application/dxf" hidden />
            </label>
            <label class="bouton-import">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 17l3-5 3 3" /></svg>
              <span><strong>Plan PDF</strong><span class="aide">PDF en traits</span></span>
              <input type="file" data-champ="fichier-plan-pdf" accept=".pdf,application/pdf" hidden />
            </label>
            <label class="bouton-import">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 9 7l5 6 3-4 4 8z" /><path d="M3 17h18" /></svg>
              <span><strong>Surface</strong><span class="aide">LandXML, DXF 3D</span></span>
              <input type="file" data-champ="fichier-surface-projet" accept=".xml,.landxml,.dxf,application/xml,text/xml" hidden />
            </label>
            <button type="button" class="bouton-import ${pointOuvert ? 'actif' : ''}" data-action="ouvrir-point" aria-expanded="${pointOuvert}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle cx="12" cy="12" r="2.5" /></svg>
              <span><strong>Point</strong><span class="aide">tapé ou sur le DXF</span></span>
            </button>
          </div>
          <p class="titre-groupe-import">En ligne (swisstopo, cadastre)</p>
          <div class="boutons-imports">
            <button type="button" class="bouton-import bouton-swisstopo" data-action="surface-swisstopo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 19 9 8l4 6 3-4 6 9z" /><path d="M5 5h4v4H5z" /></svg>
              <span><strong>Surface Swisstopo</strong><span class="aide">swissALTI3D</span></span>
            </button>
            <button type="button" class="bouton-import bouton-swisstopo" data-action="cadastre-autour">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h9l7 4v8H4z" /><circle cx="12" cy="13" r="2" /></svg>
              <span><strong>Cadastre</strong><span class="aide">autour d'un point</span></span>
            </button>
          </div>
          ${messageControle ? `<p class="erreur">${echapper(messageControle)}</p>` : ''}
          ${pointOuvert ? `<div class="bloc-point-ajoute">
            ${htmlFormulairePoint(nomPointAjoute(projet))}
            <p class="erreur" data-vivant="erreur-point">${echapper(erreurPoint)}</p>
            ${plans.length > 0 ? '<button type="button" class="bouton-secondaire" data-action="pointer-dxf">Pointer sur le plan DXF</button>' : ''}
          </div>` : ''}
          ${dernierImport ? afficherImportPoints(dernierImport) : ''}
          ${dernierPlan ? messagePlan(dernierPlan) : ''}
          ${messageSurface}
        </div>`;
      tableauxEnAttente.clear();
      contenu.innerHTML = blocContenu(projet, calquesOuverts, categoriesFermees, filtreDate, tableauEtat, vue);
  }
}

// Nature d'un levé : [nom affiché, couleur de la pastille] (mêmes couleurs que dans Lever).
const NATURES_LEVEES = {
  stock: ['Stock', '#b45309'],
  terrain: ['Terrain', '#15803d'],
  terrassement: ['Terrassement', '#2563eb'],
  recollement: ['Recollement (ancien)', '#db2777'],
  metre: ['Métré', '#0891b2'],
  chantier: ['Levé chantier', '#ea580c'],
  autres: ['Levé libre', '#475569'],
  surface: ['Surface', '#7c3aed'],
};

/**
 * Nature du levé qui utilise cette liste de points : { nom, couleur } (recollement : le réseau, à
 * sa couleur), ou null.
 */
function natureDeLaListe(projet, leve, couleursReseaux) {
  const reseau = (projet.reseaux ?? []).find((r) => r.leveId === leve.id);
  if (reseau) return { nom: `Recollement ${reseau.reseau}`, couleur: couleursReseaux.get(reseau.reseau) ?? '#6b7280' };
  const levee = [...projet.surfaces, ...(projet.metres ?? []), ...(projet.autres ?? [])].find((o) => o.leveId === leve.id);
  if (!levee) return null;
  const [nom, couleur] = NATURES_LEVEES[levee.nature ?? 'stock'] ?? NATURES_LEVEES.stock;
  return { nom, couleur };
}

/**
 * « Contenu du projet » (0.103.0) : une catégorie repliable par sorte, dans l'ordre demandé
 * (Contrôle d'abord) ; une catégorie vide n'est pas montrée. fermees : catégories repliées.
 */
export function blocContenu(projet, calquesOuverts, fermees, filtreDate = { ordre: 'recent', jour: '' }, tableau = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '' }, vue = 'points') {
  // Cadastre (0.116.4) : points et lignes rangés ensemble dans leur catégorie.
  const cadastres = projet.leves.filter((l) => l.cadastre);
  const plansCadastre = new Set(cadastres.map((l) => planDuCadastre(projet, l)?.id).filter(Boolean));
  const surfacesProjet = projet.surfaces.filter((s) => estSurfaceFichier(s));
  const dessins = (projet.dessins ?? []).filter((d) => d.sommets.length > 0);
  const categorie = (cle, titre, nombre, html, mode = '') => (nombre > 0
    ? `<details class="categorie-contenu ${mode}" data-categorie="${cle}" ${fermees.has(cle) ? '' : 'open'}>
        <summary><span>${titre}</span><span class="nombre-categorie">${nombre}</span></summary>
        ${html}
      </details>`
    : '');
  // 0.197.0 : une page par bouton du menu (Liste de points, Plans, Surfaces importées, Archives), plus rien de mélangé.
  const pages = {
    points: ['Liste de points', () => (listesDuTableau(projet).length > 0 ? blocTableauPoints(projet, tableau) : '')],
    plans: ['Plans', () => [
      categorie('dxf', 'Plans DXF et PDF', (projet.plansDxf ?? []).filter((p) => !plansCadastre.has(p.id)).length, listePlansDxf(projet, calquesOuverts, plansCadastre)),
      categorie('cadastre', 'Cadastre', cadastres.length, cadastres.map((l) => ligneCadastre(projet, l)).join('')),
      categorie('dessins', 'Dessins', dessins.length, listesDessins(projet), 'seulement-intermediaire'),
    ].join('')],
    surfaces: ['Surfaces importées', () => surfacesProjet.map(ligneSurfaceProjet).join('')],
    archives: ['Archives', () => ((projet.archives ?? []).length > 0 ? listeArchives(projet) : '')],
  };
  const [titre, corps] = pages[vue] ?? pages.points;
  return `<div class="carte-section contenu-projet">
      ${titreSection('leves', titre, bulle('leves'))}
      ${corps() || '<p class="vide">Rien ici pour l\'instant.</p>'}
    </div>`;
}

/** Catégories choisies du tableau : au départ tous les levés (sinon la première catégorie qui a des points). */
function categoriesChoisies(projet, etat) {
  if (etat.categories) return etat.categories;
  const presentes = new Set(listesDuTableau(projet ?? { leves: [] }).map((l) => l.categorie));
  const leves = CATEGORIES_LEVES.filter((c) => presentes.has(c));
  return new Set(leves.length > 0 ? leves : [CATEGORIES_POINTS.map(([c]) => c).find((c) => presentes.has(c))].filter(Boolean));
}

/** Lignes du tableau pour l'état choisi (catégories, listes, jour), triées. */
function lignesTriees(projet, etat) {
  const lignes = lignesDuTableau(projet, { categories: categoriesChoisies(projet, etat), listesDecochees: etat.listesDecochees, jour: etat.jour });
  return trierLignes(lignes, etat.colonne, etat.asc);
}

// Au plus ce nombre de lignes à l'écran (le reste : filtrer par catégorie, liste ou jour, ou exporter).
const LIGNES_MAX_TABLEAU = 400;

/**
 * Tableau « Points » (0.191.0, Base) : boutons de catégories (plusieurs possibles, foncés quand ils sont choisis), puis les
 * listes de ces catégories (une puce par liste, on peut en décocher), un jour au choix, le tableau avec tri par colonne et
 * « Exporter la sélection (CSV) ».
 */
function blocTableauPoints(projet, etat) {
  const choisies = categoriesChoisies(projet, etat);
  const listes = listesDuTableau(projet);
  const couleurs = new Map(CATEGORIES_POINTS.map(([cle, , couleur]) => [cle, couleur]));
  // Chaque liste garde sa couleur (celle choisie pour le levé, sinon celle de sa catégorie) : puces et points du tableau.
  const couleurDeListe = new Map(listes.map((l) => [l.id, projet.couleursListes?.[l.id] ?? couleurs.get(l.categorie)]));
  const nombreParCategorie = new Map();
  for (const l of listes) nombreParCategorie.set(l.categorie, (nombreParCategorie.get(l.categorie) ?? 0) + l.nombre);
  const boutons = CATEGORIES_POINTS.filter(([cle]) => nombreParCategorie.has(cle))
    .map(([cle, titre, couleur]) => `<button type="button" class="categorie-points ${choisies.has(cle) ? 'choisie' : ''}" style="--couleur-categorie: ${couleur}" data-action="tp-categorie" data-cle="${cle}" aria-pressed="${choisies.has(cle)}">${titre} <small>${nombreParCategorie.get(cle)}</small></button>`).join('');
  const dansLaSelection = listes.filter((l) => choisies.has(l.categorie));
  // 0.204.0 : les listes dans leur propre encadré titré (étiquettes pastel, sans pastille) ; les natures dans un autre.
  const puces = dansLaSelection.length > 0
    ? `<div class="encadre-points encadre-listes" role="group" aria-label="Listes de points à montrer"><p class="titre-encadre-points">Listes</p><div class="puces-listes">${dansLaSelection.map((l) => `<button type="button" class="puce-liste-points ${etat.listesDecochees.has(l.id) ? '' : 'choisie'}" style="--couleur-liste: ${couleurDeListe.get(l.id)}; --couleur-categorie: ${couleurs.get(l.categorie)}" data-action="tp-liste" data-id="${echapper(l.id)}" aria-pressed="${!etat.listesDecochees.has(l.id)}">${echapper(l.nom)} <small>${l.nombre}</small></button>`).join('')}</div></div>`
    : '';
  const lignes = lignesTriees(projet, etat);
  const titres = new Map(CATEGORIES_POINTS.map(([cle, titre]) => [cle, titre]));
  const n = (v) => (v == null ? '—' : formaterNombre(v));
  const ordre = ordreColonnes(etat.ordre);
  const titreDe = new Map(COLONNES_POINTS.map(([cle, titre]) => [cle, titre]));
  const mobiles = ordre.filter((c) => c !== 'nom');
  const fleches = (cle) => {
    if (cle === 'nom') return '';
    const i = mobiles.indexOf(cle);
    const bouton = (sens, texte, titre, inactif) => `<button type="button" class="bouton-fleche-colonne" data-action="tp-colonne" data-col="${cle}" data-sens="${sens}" aria-label="${titre} : ${titreDe.get(cle)}" title="${titre}" ${inactif ? 'disabled' : ''}>${texte}</button>`;
    return `<span class="fleches-colonne">${bouton('premier', '⏮', 'Tout à gauche (après le nom)', i === 0)}${bouton(-1, '◀', 'Vers la gauche', i === 0)}${bouton(1, '▶', 'Vers la droite', i === mobiles.length - 1)}</span>`;
  };
  const entete = ordre.map((cle) => `<th class="${etat.colonne === cle ? 'tri' : ''}${cle === 'nom' ? ' colonne-nom' : ''}">${etat.organiser
    ? `<span class="titre-colonne-organiser">${titreDe.get(cle)}</span>${fleches(cle)}`
    : `<button type="button" class="bouton-lien" data-action="tp-tri" data-col="${cle}">${titreDe.get(cle)}${etat.colonne === cle ? (etat.asc ? ' ▴' : ' ▾') : ''}</button>`}</th>`).join('');
  const cellules = (l) => ({
    nom: `<td class="colonne-nom" style="--couleur-categorie: ${couleurs.get(l.categorie)}"><span class="pastille-categorie" style="background: ${couleurDeListe.get(l.listeId) ?? couleurs.get(l.categorie)}" title="${echapper(titres.get(l.categorie) ?? '')}"></span>${echapper(l.nom)}</td>`,
    libelle: `<td>${echapper(l.libelle)}</td>`,
    est: `<td class="n">${n(l.est)}</td>`,
    nord: `<td class="n">${n(l.nord)}</td>`,
    altitude: `<td class="n">${n(l.altitude)}</td>`,
    precision: `<td class="n">${echapper(l.precision)}</td>`,
    date: `<td>${echapper(texteDate(l.date))}</td>`,
    tablette: `<td>${echapper(l.tablette)}</td>`,
    remarque: `<td>${echapper(l.remarque)}</td>`,
    photos: `<td>${l.photoId ? `<button type="button" class="bouton-lien" data-action="voir-photo" data-id="${l.photoId}" aria-label="Voir la photo de ${echapper(l.nom)}">📷 ${l.photos}</button>` : ''}</td>`,
    liste: `<td>${echapper(l.liste)}</td>`,
  });
  const corps = lignes.slice(0, LIGNES_MAX_TABLEAU).map((l) => { const c = cellules(l); return `<tr>${ordre.map((cle) => c[cle]).join('')}</tr>`; }).join('');
  const reste = lignes.length - LIGNES_MAX_TABLEAU;
  // Gestion des listes choisies (renommer, archiver / supprimer, couleur, photos) : elle était dans les anciennes catégories Levés / Points importés.
  const couleursReseaux = new Map(lireReseaux().map(([a, , c]) => [a, c]));
  const gerables = (projet.leves ?? []).filter((l) => !l.cadastre && dansLaSelection.some((d) => d.id === l.id));
  const gerer = gerables.length > 0 || (choisies.has('controle') && (projet.pointsControle ?? []).length > 0)
    ? `<details class="gerer-listes"><summary>Gérer les listes choisies</summary>${choisies.has('controle') && (projet.pointsControle ?? []).length > 0 ? listePointsControle(projet) : ''}<div class="liste-leves">${gerables.map((l) => ligneListe(projet, l, l.direct ? natureDeLaListe(projet, l, couleursReseaux) : null, { sansTableau: true })).join('')}</div></details>`
    : '';
  return `<div class="tableau-points-projet">
      <div class="encadre-points encadre-natures"><p class="titre-encadre-points">Natures</p><div class="categories-points" role="group" aria-label="Natures de points">${boutons}</div></div>
      ${puces}
      <div class="barre-tableau-points">
        <span class="aide">${lignes.length} point${lignes.length > 1 ? 's' : ''}</span>
        <label class="aide">Jour <input type="date" data-champ="tp-jour" value="${echapper(etat.jour)}" aria-label="Montrer les points d'un jour" /></label>
        ${etat.jour ? '<button type="button" class="bouton-lien" data-action="tp-effacer-jour">tout voir</button>' : ''}
        <button type="button" class="bouton-secondaire ${etat.organiser ? 'actif' : ''}" data-action="tp-organiser" aria-pressed="${etat.organiser}">${etat.organiser ? 'Terminé' : '⇄ Colonnes'}</button>
        ${etat.organiser ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="tp-ordre-depart">Remettre l\'ordre de départ</button>' : ''}
        <button type="button" class="bouton-secondaire bouton-exporter-tableau" data-action="tp-exporter" ${lignes.length === 0 ? 'disabled' : ''}>Exporter la sélection (CSV)</button>
      </div>
      <div class="tableau-defilant tableau-points-grand"><table><thead><tr>${entete}</tr></thead><tbody>${corps || '<tr><td colspan="11">Choisis une catégorie.</td></tr>'}</tbody></table></div>
      ${reste > 0 ? `<p class="aide">${reste} lignes de plus : choisis une liste ou un jour, ou exporte la sélection.</p>` : ''}
      ${gerer}
    </div>`;
}

/**
 * Une liste de points : case pour l'afficher, nom (celui d'un levé se change dans Terrain › Lever),
 * couleur, nombre de points (et date de création pour un levé), supprimer, voir les points.
 */
function ligneListe(projet, leve, nature = null, { sansTableau = false } = {}) {
  const actif = leve.id === projet.leveActifId;
  const pastille = nature ? `<span class="pastille-nature" style="--couleur-nature: ${nature.couleur}">${echapper(nature.nom)}</span>` : '';
  const date = leve.direct && leve.importeLe ? ` · créé le ${new Date(leve.importeLe).toLocaleDateString('fr-CH')}` : '';
  const nom = leve.dediee
    ? `<strong class="nom-leve">${echapper(leve.nom)}</strong>`
    : `<input type="text" class="nom-leve" data-champ="nom-leve" data-id="${leve.id}" value="${echapper(leve.nom)}" aria-label="Nom de la liste" />`;
  return `<div class="ligne-leve ${actif ? 'actif' : ''}">
      <label class="case"><input type="radio" name="leve-actif" data-champ="leve-actif" value="${leve.id}" ${actif ? 'checked' : ''} aria-label="Afficher cette liste" />${nom}</label>
      ${pastille}
      ${choixCouleur(leve.id, projet.couleursListes?.[leve.id])}
      <div class="ligne-outils">
        <span class="aide">${leve.points.length} points${date}</span>
        <button type="button" class="bouton-lien bouton-lien-neutre seulement-expert" data-action="archiver" data-type="leve" data-id="${leve.id}">archiver</button>
        <button type="button" class="bouton-lien archive-comme-suppression" data-action="archiver" data-type="leve" data-id="${leve.id}">supprimer</button>
        <button type="button" class="bouton-lien suppression-vraie" data-action="supprimer-leve" data-id="${leve.id}">supprimer</button>
      </div>
      ${sansTableau ? '' : tableauPoints(leve.points, 'Voir les points')}
      ${photosDesPoints(photosDuLeve(projet, leve))}
    </div>`;
}

/** Un cadastre (0.116.4) : nom, une seule couleur (lignes, points, noms), cases Lignes / Points, voir, supprimer. */
function ligneCadastre(projet, leve) {
  const planDxf = planDuCadastre(projet, leve);
  const pointsVisibles = !(projet.listesCachees ?? []).includes(leve.id);
  return `<div class="ligne-leve ligne-cadastre">
      <strong class="nom-leve">${echapper(leve.nom)}</strong>
      <span class="couleur-liste">${paletteCouleur({ couleur: couleurDuCadastre(planDxf), options: COULEURS_LISTES, attributs: `data-champ-couleur="couleur-liste" data-id="${leve.id}"`, nom: 'Couleur du cadastre' })}</span>
      <div class="cases-cadastre">
        ${planDxf ? `<label class="case"><input type="checkbox" data-champ="plan-visible" data-id="${planDxf.id}" ${planDxf.visible !== false ? 'checked' : ''} /> Lignes</label>` : ''}
        <label class="case"><input type="checkbox" data-champ="cadastre-points" data-id="${leve.id}" ${pointsVisibles ? 'checked' : ''} /> Points</label>
      </div>
      <div class="ligne-outils">
        <span class="aide">${leve.points.length} points${planDxf ? ` · ${planDxf.compte?.objets ?? 0} lignes` : ''}</span>
        ${planDxf ? `<button type="button" class="bouton-lien bouton-lien-neutre" data-action="voir-plan" data-id="${planDxf.id}">voir</button>` : ''}
        <button type="button" class="bouton-lien bouton-lien-neutre seulement-expert" data-action="archiver" data-type="cadastre" data-id="${leve.id}">archiver</button>
        <button type="button" class="bouton-lien archive-comme-suppression" data-action="archiver" data-type="cadastre" data-id="${leve.id}">supprimer</button>
        <button type="button" class="bouton-lien suppression-vraie" data-action="supprimer-cadastre" data-id="${leve.id}">supprimer</button>
      </div>
      ${tableauPoints(leve.points, 'Voir les points')}
    </div>`;
}

/** Photos rattachées aux points d'un levé (rangées avec le levé, voir Lever), seulement celles d'un point de la liste. */
function photosDuLeve(projet, leve) {
  const proprietaire = [...(projet.surfaces ?? []), ...(projet.metres ?? []), ...(projet.autres ?? []), ...(projet.reseaux ?? [])].find((o) => o.leveId === leve.id);
  const noms = new Set(leve.points.map((p) => p.nom));
  // 0.140.0 : aussi les photos de tout le levé (sans point), en premier.
  const photos = proprietaire?.photos ?? [];
  return [...photos.filter((photo) => !photo.point && !photo.attentePoint), ...photos.filter((photo) => photo.point && noms.has(photo.point))];
}

/** Photos des points (miniatures repliables : toucher une photo l'ouvre en grand, avec le nom du point). */
function photosDesPoints(photos) {
  if (photos.length === 0) return '';
  return `<details class="photos-de-la-liste">
      <summary>Photos (${photos.length})</summary>
      <div class="liste-photos">${photos.map((photo) => `<figure class="photo">
          <button type="button" class="miniature-photo" data-action="voir-photo" data-id="${photo.id}" aria-label="Voir la photo de ${echapper(photo.point ?? 'tout le levé')}"><img src="${photo.miniature}" alt="${echapper(photo.legende || photo.point || 'Photo du levé')}" /></button>
          <span class="point-photo">📷 ${echapper(photo.point ?? 'tout le levé')}</span>
          ${photo.legende ? `<span class="aide">${echapper(photo.legende)}</span>` : ''}
        </figure>`).join('')}</div>
    </details>`;
}

/** Surface importée (LandXML, DXF 3D, Swisstopo) : nom à changer, fichier d'origine, supprimer. */
function ligneSurfaceProjet(surface) {
  return `<div class="ligne-leve liste-surface-projet">
      <div class="champ-prefixe"><span class="prefixe-nom">${echapper(prefixeDuNom(surface))}</span><input type="text" class="nom-leve" data-champ="nom-surface-projet" data-id="${surface.id}" value="${echapper(sansPrefixe(surface.nom, prefixeDuNom(surface)))}" aria-label="Nom de la surface (après ${echapper(prefixeDuNom(surface))})" /></div>
      <div class="ligne-outils">
        <span class="aide">${[origineSurface(surface), surface.nomFichier].filter(Boolean).map(echapper).join(' · ')} · ${surface.faces?.length ?? 0} triangles</span>
        <button type="button" class="bouton-lien bouton-lien-neutre seulement-expert" data-action="archiver" data-type="surface" data-id="${surface.id}">archiver</button>
        <button type="button" class="bouton-lien archive-comme-suppression" data-action="archiver" data-type="surface" data-id="${surface.id}">supprimer</button>
        <button type="button" class="bouton-lien suppression-vraie" data-action="supprimer-surface-projet" data-id="${surface.id}">supprimer</button>
      </div>
    </div>`;
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

/** Couleur de la liste sur le plan (rouge réservé aux points de contrôle). */
function choixCouleur(id, couleur) {
  return `<span class="couleur-liste seulement-intermediaire">${paletteCouleur({ couleur, options: COULEURS_LISTES, attributs: `data-champ-couleur="couleur-liste" data-id="${id}"`, nom: 'Couleur de la liste' })}</span>`;
}

/** Tableau repliable de points (nom, Est, Nord, altitude), sous leur liste. */
// 0.126.0 (vitesse) : les lignes du tableau ne sont écrites qu'à l'ouverture de « Voir les points »
// (avant : 8 000 lignes cachées refaites à chaque point levé). Points en attente, par numéro de tableau.
const tableauxEnAttente = new Map();
let numeroTableau = 0;

/** Lignes HTML d'un tableau de points (nom, [liste], Est, Nord, altitude, [date et heure]). */
export function lignesTableauPoints(points, { date = false, avecListe = false } = {}) {
  const n = (valeur) => (valeur == null ? '—' : formaterNombre(valeur));
  return points.map((p) => `<tr><td>${echapper(p.nom)}</td>${avecListe ? `<td>${echapper(p.listeNom ?? '')}</td>` : ''}<td>${n(p.est)}</td><td>${n(p.nord)}</td><td>${n(p.altitude)}</td>${date ? `<td class="seulement-intermediaire">${echapper(dateHeureDuPoint(p))}</td>` : ''}</tr>`).join('');
}

/** Remplit le tableau d'un « Voir les points » qu'on vient d'ouvrir (appelé par l'écouteur « toggle »). */
function remplirTableauOuvert(details) {
  const corps = details.querySelector('tbody[data-tableau]');
  if (!details.open || !corps || corps.dataset.rempli) return;
  const attente = tableauxEnAttente.get(corps.dataset.tableau);
  corps.innerHTML = attente ? lignesTableauPoints(attente.points(), attente) : '';
  corps.dataset.rempli = '1';
}

// 0.187.0 : tri des points par date (bouton « Date » de l'en-tête des tableaux) : 'liste' (ordre de la liste),
// 'recent' ou 'ancien' ; les points sans date (importés, tapés) restent à la fin.
let triPoints = 'liste';
const TEXTE_TRI = { liste: 'Date', recent: 'Date ▾', ancien: 'Date ▴' };

/**
 * Tableau repliable de points. options : date (colonne Date, Intermédiaire), avecListe (colonne Liste,
 * pour « tous les points »). points peut être une liste ou une fonction (calculée à l'ouverture).
 */
function tableauPoints(points, titre, { date = true, avecListe = false, total = null, parDate = false } = {}) {
  // parDate : tri par date d'office (liste de tous les points), « Date » garde alors le plus récent d'abord.
  const ordre = () => (parDate && triPoints === 'liste' ? 'recent' : triPoints);
  const nombre = total ?? (typeof points === 'function' ? 0 : points.length);
  if (typeof points !== 'function' && points.length === 0) return '';
  numeroTableau += 1;
  const fournir = typeof points === 'function' ? points : () => points;
  tableauxEnAttente.set(String(numeroTableau), { points: () => (date ? trierParDate(fournir(), ordre()) : fournir()), date, avecListe });
  const colonneDate = date
    ? `<th class="seulement-intermediaire"><button type="button" class="bouton-lien" data-action="trier-points-date" title="Trier les points par date">${TEXTE_TRI[ordre()]}</button></th>`
    : '';
  return `
    <details class="points-de-la-liste">
      <summary>${titre}${nombre ? ` (${nombre})` : ''}</summary>
      <div class="tableau-defilant">
        <table>
          <thead><tr><th>Nom</th>${avecListe ? '<th>Liste</th>' : ''}<th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th>${colonneDate}</tr></thead>
          <tbody data-tableau="${numeroTableau}"></tbody>
        </table>
      </div>
    </details>`;
}

/** Points des dessins (Calculs › Dessin) : une liste par dessin, en violet (PF1-1, D1-1…). */
function listesDessins(projet) {
  const dessins = (projet.dessins ?? []).filter((d) => d.sommets.length > 0);
  return dessins
    .map((dessin) => {
      const points = pointsDuDessin(dessin, projet.dessins);
      return `<div class="ligne-leve liste-dessin">
      <strong>${echapper(dessin.nom)}</strong>
      <div class="ligne-outils"><span class="aide">${points.length} points · dessin</span>
        <button type="button" class="bouton-lien bouton-lien-neutre seulement-expert" data-action="archiver" data-type="dessin" data-id="${dessin.id}">archiver</button>
        <button type="button" class="bouton-lien archive-comme-suppression" data-action="archiver" data-type="dessin" data-id="${dessin.id}">supprimer</button></div>
      ${tableauPoints(points, 'Voir les points', { date: false })}
    </div>`;
    })
    .join('');
}

/** Points de contrôle (Terrain › Contrôle) : une liste à part, en rouge, sous les listes de points. */
function listePointsControle(projet) {
  const points = projet.pointsControle ?? [];
  if (points.length === 0) return '';
  return `<div class="ligne-leve liste-controle">
      <strong>Points de contrôle</strong>
      <div class="ligne-outils"><span class="aide">${points.length} points</span></div>
      ${tableauPoints(points, 'Voir les points de contrôle', { date: false })}
      ${photosDesPoints((projet.photosControle ?? []).filter((photo) => points.some((p) => p.id === photo.pointId)))}
    </div>`;
}

/** Type d'un plan DXF (0.194.0) : petite pastille avec son nom ; en Expert, une liste pour le changer. */
function typeDuPlan(plan, types) {
  const pastille = plan.type ? `<span class="pastille-type-dxf" style="background: ${couleurDuType(plan.type, types)}">${echapper(plan.type)}</span>` : '';
  const options = [['', '— aucun —'], ...types.map((t) => [t.nom, t.nom])];
  if (plan.type && !types.some((t) => t.nom === plan.type)) options.push([plan.type, plan.type]);
  const liste = `<label class="type-plan-dxf seulement-expert">Type <select data-champ="plan-type" data-id="${plan.id}">${options.map(([v, t]) => `<option value="${echapper(v)}" ${v === (plan.type ?? '') ? 'selected' : ''}>${echapper(t)}</option>`).join('')}</select></label>`;
  return `<div class="ligne-type-dxf">${pastille}${liste}</div>`;
}

/** Plans DXF du projet : nom, nombre d'objets, voir / supprimer, et la liste des calques à cocher. */
function listePlansDxf(projet, calquesOuverts, caches = new Set()) {
  const plans = (projet.plansDxf ?? []).filter((p) => !caches.has(p.id));
  if (plans.length === 0) return '';
  const types = lireTypesDxf();
  return `<div class="liste-plans-dxf"><div class="ligne-outils seulement-expert"><button type="button" class="bouton-lien bouton-lien-neutre" data-action="modifier-types-dxf">Modifier les types</button></div>${plans
    .map((plan) => {
      const prefixe = prefixeCommun(plan.calques.map((c) => c.nom));
      const visibles = plan.calques.filter((c) => c.visible).length;
      return `<div class="ligne-plan-dxf ${plan.visible === false ? 'plan-cache' : ''}">
        <div class="entete-plan-dxf">
          <label class="oeil-plan" title="Afficher / cacher le plan"><input type="checkbox" data-champ="plan-visible" data-id="${plan.id}" ${plan.visible !== false ? 'checked' : ''} aria-label="Afficher le plan" /></label>
          ${plan.pdf
    // Plan PDF (0.132.0) : préfixe « PDF- » fixe à gauche du nom, comme « LV- » et « Surf- ».
    ? `<div class="champ-prefixe"><span class="prefixe-nom">${echapper(PREFIXE_PDF)}</span><input type="text" class="nom-plan-dxf" data-champ="plan-nom" data-id="${plan.id}" value="${echapper(sansPrefixe(plan.nom, PREFIXE_PDF))}" aria-label="Nom du plan (après ${echapper(PREFIXE_PDF)})" /></div>`
    : `<input type="text" class="nom-plan-dxf" data-champ="plan-nom" data-id="${plan.id}" value="${echapper(plan.nom)}" aria-label="Nom du plan" />`}
          ${paletteCouleur({ couleur: plan.couleur, options: COULEURS_PLANS, attributs: `data-champ-couleur="plan-couleur" data-id="${plan.id}"`, nom: 'Couleur du plan' })}
        </div>
        ${typeDuPlan(plan, types)}
        <div class="ligne-outils">
          <span class="aide">${plan.compte?.objets ?? 0} objets · ${visibles} / ${plan.calques.length} calques affichés</span>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="voir-plan" data-id="${plan.id}">voir</button>
          <button type="button" class="bouton-lien bouton-lien-neutre seulement-intermediaire" data-action="recaler-plan" data-id="${plan.id}">recaler</button>
          <button type="button" class="bouton-lien bouton-lien-neutre seulement-expert" data-action="archiver" data-type="plan" data-id="${plan.id}">archiver</button>
        <button type="button" class="bouton-lien archive-comme-suppression" data-action="archiver" data-type="plan" data-id="${plan.id}">supprimer</button>
        <button type="button" class="bouton-lien suppression-vraie" data-action="supprimer-plan" data-id="${plan.id}">supprimer</button>
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

/**
 * Éléments archivés (0.119.0, Intermédiaire ; suppression définitive : Expert) : le plus récent en haut, avec « restaurer » (remis dans le
 * projet tel quel) et « supprimer » (pour de bon).
 */
function listeArchives(projet) {
  const archives = [...(projet.archives ?? [])].sort((a, b) => String(b.archiveLe ?? '').localeCompare(String(a.archiveLe ?? '')));
  return `<div class="liste-leves">${archives.map((archive) => {
    const date = archive.archiveLe ? new Date(archive.archiveLe).toLocaleDateString('fr-CH') : '';
    const resume = resumeArchive(archive);
    return `<div class="ligne-leve ligne-archive">
        <strong class="nom-leve">${echapper(archive.nom ?? '')}</strong>
        <span class="pastille-nature" style="--couleur-nature: #64748b">${echapper(nomDuType(archive.type))}</span>
        <div class="ligne-outils">
          <span class="aide">${[resume, date ? `archivé le ${date}` : ''].filter(Boolean).map(echapper).join(' · ')}</span>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="restaurer-archive" data-id="${archive.id}">restaurer</button>
          <button type="button" class="bouton-lien seulement-expert" data-action="supprimer-archive" data-id="${archive.id}">supprimer</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

/** Recalage d'un plan : recalé (paramètres, export, annuler), ou « pas en MN95 », ou rien. */
function etatRecalage(plan) {
  const r = plan.recalage;
  if (r?.applique) {
    const { gon } = rotationLisible(r.parametres.rotation);
    const ppm = (r.parametres.echelle - 1) * 1e6;
    return `<p class="etat-recalage recale">✓ Recalé en MN95 (${r.paires.filter((p) => p.actif !== false).length} points · rotation ${gon.toFixed(4)} gon · échelle ${ppm >= 0 ? '+' : ''}${ppm.toFixed(0)} ppm)
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
