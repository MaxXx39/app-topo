// Onglet Projet (0.103.0, demande du 30.10.2026) : sous le projet ouvert, deux onglets côte à côte,
// « Import » (Expert) et « Exporter » (voir export/module.js), un seul ouvert à la fois ; dessous,
// « Contenu du projet », par catégories repliables (voir blocContenu) :
// Contrôle, Levés (une liste, nature en pastille), Points importés, Surfaces importées (Expert),
// Plans DXF (Intermédiaire), Dessins (Intermédiaire).
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
import { prefixeDuNom, sansPrefixe } from '../topo/surface.js';
import { htmlFormulairePoint, lireFormulairePoint, viderFormulairePoint } from '../outils/formulaire-point.js';
import { nomPointAjoute } from '../topo/points-ajoutes.js';
import { COULEURS_LISTES } from '../plan/listes-points.js';
import { choixCouleur as paletteCouleur } from '../outils/palette.js';
import { pointsDuDessin } from '../topo/dessin.js';
import { lireReseaux } from '../leve/reseaux.js';

/**
 * Crée le panneau « Import » dans "conteneur" et « Contenu du projet » dans "contenu". Les actions sont faites par main.js via "actions" :
 * importerPoints(fichier), choisirLeve(id), renommerLeve(id, nom), supprimerLeve(id),
 * importerPlanDxf(fichier), voirPlanDxf(id), supprimerPlanDxf(id), reglerPlanDxf(id, { visible, couleur, nom }),
 * recalerPlanDxf(id), exporterPlanRecale(id), annulerRecalagePlan(id),
 * montrerCalqueDxf(id, n° du calque, visible),
 * montrerTousCalquesDxf(id, visible), ajouterPointTape({ nom, est, nord, altitude }) (renvoie
 * { erreur } ou rien), commencerPointage() (ajouter des points en touchant le plan DXF),
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
  ecouter('toggle', (evenement) => {
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
    if (action === 'voir-photo') actions.voirPhoto(id);
    else if (action === 'supprimer-leve') actions.supprimerLeve(id);
    else if (action === 'supprimer-surface-projet') actions.supprimerSurfaceProjet(id);
    else if (action === 'voir-plan') actions.voirPlanDxf(id);
    else if (action === 'supprimer-plan') actions.supprimerPlanDxf(id);
    else if (action === 'recaler-plan') actions.recalerPlanDxf(id);
    else if (action === 'annuler-recalage') actions.annulerRecalagePlan(id);
    else if (action === 'tous-calques') actions.montrerTousCalquesDxf(id, bouton.dataset.visible === 'oui');
  });

  ecouter('change', async (evenement) => {
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
  ecouter('keydown', (evenement) => {
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
      conteneur.innerHTML = `<div class="carte-section panneau-onglet-projet panneau-import">
          <p class="titre-panneau-projet">Importer ${bulle('imports')}</p>
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
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 9 7l5 6 3-4 4 8z" /><path d="M3 17h18" /></svg>
              <span><strong>Surface</strong><span class="aide">LandXML, DXF 3D</span></span>
              <input type="file" data-champ="fichier-surface-projet" accept=".xml,.landxml,.dxf,application/xml,text/xml" hidden />
            </label>
            <button type="button" class="bouton-import ${pointOuvert ? 'actif' : ''}" data-action="ouvrir-point" aria-expanded="${pointOuvert}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle cx="12" cy="12" r="2.5" /></svg>
              <span><strong>Point</strong><span class="aide">tapé ou sur le DXF</span></span>
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
      contenu.innerHTML = blocContenu(projet, calquesOuverts, categoriesFermees);
  }
}

// Nature d'un levé : [nom affiché, couleur de la pastille] (mêmes couleurs que dans Lever).
const NATURES_LEVEES = {
  stock: ['Stock', '#b45309'],
  terrain: ['Terrain', '#15803d'],
  terrassement: ['Terrassement', '#2563eb'],
  recollement: ['Recollement (ancien)', '#db2777'],
  metre: ['Métré', '#0891b2'],
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
function blocContenu(projet, calquesOuverts, fermees) {
  const listes = projet.leves.filter((l) => !l.direct);
  // Levés : le plus récent en haut.
  const levees = projet.leves.filter((l) => l.direct).sort((a, b) => String(b.importeLe ?? '').localeCompare(String(a.importeLe ?? '')));
  const surfacesProjet = projet.surfaces.filter((s) => s.type === 'landxml' || s.type === 'dxf');
  const dessins = (projet.dessins ?? []).filter((d) => d.sommets.length > 0);
  const couleursReseaux = new Map(lireReseaux().map(([a, , c]) => [a, c]));
  const categorie = (cle, titre, nombre, html, mode = '') => (nombre > 0
    ? `<details class="categorie-contenu ${mode}" data-categorie="${cle}" ${fermees.has(cle) ? '' : 'open'}>
        <summary><span>${titre}</span><span class="nombre-categorie">${nombre}</span></summary>
        ${html}
      </details>`
    : '');
  const contenu = [
    categorie('controle', 'Contrôle', (projet.pointsControle ?? []).length, listePointsControle(projet)),
    categorie('leves', 'Levés', levees.length, `<div class="liste-leves">${levees.map((l) => ligneListe(projet, l, natureDeLaListe(projet, l, couleursReseaux))).join('')}</div>`),
    categorie('points', 'Points importés', listes.length, `<div class="liste-leves">${listes.map((l) => ligneListe(projet, l)).join('')}</div>`),
    categorie('surfaces', 'Surfaces importées', surfacesProjet.length, surfacesProjet.map(ligneSurfaceProjet).join(''), 'seulement-expert'),
    categorie('dxf', 'Plans DXF', (projet.plansDxf ?? []).length, listePlansDxf(projet, calquesOuverts), 'seulement-intermediaire'),
    categorie('dessins', 'Dessins', dessins.length, listesDessins(projet), 'seulement-intermediaire'),
  ].join('');
  return `<div class="carte-section contenu-projet">
      ${titreSection('leves', 'Contenu du projet', bulle('leves'))}
      ${contenu || '<p class="vide">Rien dans ce projet pour l\'instant.</p>'}
    </div>`;
}

/**
 * Une liste de points : case pour l'afficher, nom (celui d'un levé se change dans Terrain › Lever),
 * couleur, nombre de points (et date de création pour un levé), supprimer, voir les points.
 */
function ligneListe(projet, leve, nature = null) {
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
        <button type="button" class="bouton-lien" data-action="supprimer-leve" data-id="${leve.id}">supprimer</button>
      </div>
      ${tableauPoints(leve.points, 'Voir les points')}
      ${photosDesPoints(photosDuLeve(projet, leve))}
    </div>`;
}

/** Photos rattachées aux points d'un levé (rangées avec le levé, voir Lever), seulement celles d'un point de la liste. */
function photosDuLeve(projet, leve) {
  const proprietaire = [...(projet.surfaces ?? []), ...(projet.metres ?? []), ...(projet.autres ?? []), ...(projet.reseaux ?? [])].find((o) => o.leveId === leve.id);
  const noms = new Set(leve.points.map((p) => p.nom));
  return (proprietaire?.photos ?? []).filter((photo) => photo.point && noms.has(photo.point));
}

/** Photos des points (miniatures repliables : toucher une photo l'ouvre en grand, avec le nom du point). */
function photosDesPoints(photos) {
  if (photos.length === 0) return '';
  return `<details class="photos-de-la-liste">
      <summary>Photos des points (${photos.length})</summary>
      <div class="liste-photos">${photos.map((photo) => `<figure class="photo">
          <button type="button" class="miniature-photo" data-action="voir-photo" data-id="${photo.id}" aria-label="Voir la photo de ${echapper(photo.point)}"><img src="${photo.miniature}" alt="${echapper(photo.legende || photo.point)}" /></button>
          <span class="point-photo">📷 ${echapper(photo.point)}</span>
          ${photo.legende ? `<span class="aide">${echapper(photo.legende)}</span>` : ''}
        </figure>`).join('')}</div>
    </details>`;
}

/** Surface importée (LandXML, DXF 3D) : nom à changer, fichier d'origine, supprimer. */
function ligneSurfaceProjet(surface) {
  return `<div class="ligne-leve liste-surface-projet">
      <div class="champ-prefixe"><span class="prefixe-nom">${echapper(prefixeDuNom(surface))}</span><input type="text" class="nom-leve" data-champ="nom-surface-projet" data-id="${surface.id}" value="${echapper(sansPrefixe(surface.nom, prefixeDuNom(surface)))}" aria-label="Nom de la surface (après ${echapper(prefixeDuNom(surface))})" /></div>
      <div class="ligne-outils">
        <span class="aide">${[surface.type === 'dxf' ? 'DXF' : 'LandXML', surface.nomFichier].filter(Boolean).map(echapper).join(' · ')} · ${surface.faces?.length ?? 0} triangles</span>
        <button type="button" class="bouton-lien" data-action="supprimer-surface-projet" data-id="${surface.id}">supprimer</button>
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
function tableauPoints(points, titre) {
  if (points.length === 0) return '';
  const n = (valeur) => (valeur == null ? '—' : formaterNombre(valeur));
  return `
    <details class="points-de-la-liste">
      <summary>${titre} (${points.length})</summary>
      <div class="tableau-defilant">
        <table>
          <thead><tr><th>Nom</th><th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th></tr></thead>
          <tbody>
            ${points.map((p) => `<tr><td>${echapper(p.nom)}</td><td>${n(p.est)}</td><td>${n(p.nord)}</td><td>${n(p.altitude)}</td></tr>`).join('')}
          </tbody>
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
      <div class="ligne-outils"><span class="aide">${points.length} points · dessin</span></div>
      ${tableauPoints(points, 'Voir les points')}
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
      ${tableauPoints(points, 'Voir les points de contrôle')}
      ${photosDesPoints((projet.photosControle ?? []).filter((photo) => points.some((p) => p.id === photo.pointId)))}
    </div>`;
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
          ${paletteCouleur({ couleur: plan.couleur, options: COULEURS_PLANS, attributs: `data-champ-couleur="plan-couleur" data-id="${plan.id}"`, nom: 'Couleur du plan' })}
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
