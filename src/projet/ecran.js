// Onglet « Projet » (le premier), court pour s'y retrouver d'un coup d'œil :
// - en haut, deux boutons : « + Nouveau projet » et « Gestion de projets » : une page à part (rien
//   d'autre de l'onglet), une seule liste, appareil et Drive : toucher = ouvrir, menu ⋮ = exporter,
//   dupliquer, supprimer ; fichier projet ; « ← » pour revenir ;
// - le projet ouvert : ses infos (affaire, lieu, nom facultatif) ;
// - ensuite (voir main.js) le bloc « Imports » (fichiers de points, plans DXF) ;
// - tout en bas, le partage par Google Drive (pas besoin de le voir tout le temps), puis la version.
// Le cartouche du PDF (dessiné par, date) se règle au moment du PDF (voir export/cartouche.js).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { estDansAppliAndroid } from '../android/pont.js';
import { titreProjet } from './projet.js';
import { verrouActif } from '../partage/synchro.js';

/**
 * Crée l'écran Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), changerCartouche(champ, valeur), exporterProjet(id),
 * nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier),
 * supprimerPartout(id) (cet appareil et Drive),
 * partage : connecterDrive(), deconnecterDrive(), nommerAppareil(nom), envoyerDrive(), reprendreLaMain(),
 * ouvrirDrive(dossierId), rafraichirDrive()
 * Renvoie { afficher(projet, resumes, partage) } ; partage : { etat (voir partage/partage.js), appareil: { id, nom } } ou null.
 */
export function creerEcranProjet(conteneur, actions, conteneurSuite) {
  // Page « Gestion de projets » ouverte (à la place de tout l'onglet), et projet dont le menu ⋮ est ouvert.
  let panneau = null;
  let menuOuvert = null;
  let derniers = null; // dernier projet et liste affichés (pour redessiner après un clic)
  // Tri de la liste : 'date' (dernière modification, ici ou sur Drive) ou 'nom' (A → Z), retenu sur l'appareil.
  let triProjets = 'date';
  try {
    if (localStorage.getItem('topo-tri-projets') === 'nom') triProjets = 'nom';
  } catch {
    // Mémoire indisponible : tri par date.
  }

  function quandClic(evenement) {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action !== 'menu-projet') menuOuvert = null;
    if (action === 'panneau') {
      panneau = panneau === bouton.dataset.panneau ? null : bouton.dataset.panneau;
      if (derniers) dessiner(...derniers);
      conteneur.closest('.panneau')?.scrollIntoView({ block: 'start' });
      window.scrollTo(0, 0);
    } else if (action === 'trier') {
      triProjets = bouton.dataset.tri === 'nom' ? 'nom' : 'date';
      try {
        localStorage.setItem('topo-tri-projets', triProjets);
      } catch {
        // Mémoire indisponible : le tri vaut jusqu'à la fermeture de l'appli.
      }
      if (derniers) dessiner(...derniers);
    } else if (action === 'menu-projet') {
      menuOuvert = menuOuvert === id ? null : id;
      if (derniers) dessiner(...derniers);
    } else if (action === 'exporter') actions.exporterProjet(id);
    else if (action === 'nouveau') {
      panneau = null;
      actions.nouveauProjet();
    } else if (action === 'ouvrir') {
      panneau = null;
      actions.ouvrirProjet(id);
    } else if (action === 'ouvrir-drive') {
      panneau = null;
      actions.ouvrirDrive(id);
    } else if (['connecterDrive', 'deconnecterDrive', 'envoyerDrive', 'reprendreLaMain', 'rafraichirDrive'].includes(action)) {
      actions[action]();
    } else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
    else if (action === 'supprimer-partout') actions.supprimerPartout(id);
    if (['exporter', 'dupliquer'].includes(action) && derniers) dessiner(...derniers);
  }

  // On quitte les cases de l'écran : il se redessine avec les dernières données.
  function quandSortie() {
    setTimeout(() => {
      if (derniers && !conteneur.contains(document.activeElement) && !conteneurSuite.contains(document.activeElement)) dessiner(...derniers);
    }, 0);
  }

  async function quandChangement(evenement) {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.champ === 'nom-appareil') actions.nommerAppareil(cible.value.trim());
    else if (cible.dataset.cartouche) actions.changerCartouche(cible.dataset.cartouche, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      panneau = null;
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  }

  // Le haut (#projets) et le bas (#projets-suite : partage, version) réagissent de la même façon.
  for (const zone of [conteneur, conteneurSuite]) {
    zone.addEventListener('click', quandClic);
    zone.addEventListener('focusout', quandSortie);
    zone.addEventListener('change', quandChangement);
  }

  /** Dessine l'écran (projet ouvert, liste des projets de l'appareil). */
  function dessiner(projet, resumes, partage) {
    // On ne redessine pas pendant une saisie : la case perdrait le curseur.
    const enSaisie = (zone) => zone.contains(document.activeElement) && document.activeElement.matches('input');
    if (enSaisie(conteneur) || enSaisie(conteneurSuite)) return;
    const { affaire, lieu } = projet.cartouche;
    // Gestion de projets : une page à part, sans le projet ouvert, les imports ni le partage.
    const pageGestion = panneau === 'projets';
    conteneur.closest('.panneau')?.classList.toggle('page-gestion-projets', pageGestion);
    if (pageGestion) {
      conteneur.innerHTML = pageProjets(projet, resumes, partage, menuOuvert, triProjets);
      return;
    }
    conteneur.innerHTML = `
      <div class="actions-projets">
        <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
        <button type="button" class="bouton-secondaire" data-action="panneau" data-panneau="projets">Gestion de projets</button>
      </div>

      <section class="bloc-ouvert">
        <div class="bloc-entete">
          <span class="etiquette-entete">Projet ouvert ${bulle('projets')}</span>
          <span class="titre-projet-ouvert">${echapper(titreProjet(projet))}</span>
        </div>
        <div class="bloc-corps">
          <div class="champs-projet">
            <label>Affaire <input type="text" data-cartouche="affaire" value="${echapper(affaire ?? '')}" placeholder="ex. 10 203" /></label>
            <label>Lieu <input type="text" data-cartouche="lieu" value="${echapper(lieu ?? '')}" placeholder="ex. Gland" /></label>
            <label class="champ-large">Nom <span class="aide">(facultatif)</span> <input type="text" data-champ="nom-projet" value="${echapper(projet.nom ?? '')}" placeholder="ex : Rue Mont Blanc" /></label>
          </div>
        </div>
      </section>
    `;
    // Le partage par Google Drive est dans les réglages (roue de l'en-tête, version 0.54.0).
    conteneurSuite.innerHTML = `
      <p class="aide pied-projet">Version de l'appli : ${__VERSION_APPLI__}${estDansAppliAndroid() ? ' (appli Android)' : ''}</p>`;
  }

  return {
    /** Redessine l'écran. */
    afficher(projet, resumes, partage = null) {
      derniers = [projet, resumes, partage];
      // Un peu plus tard : quand on passe d'une case à l'autre (Affaire → Lieu), la case suivante a
      // alors le curseur et l'écran ne se redessine pas sous le doigt (ce qu'on tape serait perdu).
      requestAnimationFrame(() => dessiner(...derniers));
    },
  };
}

/**
 * Tous les projets, chacun une seule fois : ceux de cet appareil (📱) et ceux de Google Drive (☁),
 * réunis par leur identifiant. tri : 'date' (le plus récent d'abord, la date la plus récente entre
 * l'appareil et Drive) ou 'nom' (ordre alphabétique).
 */
export function projetsReunis(resumes, partage, tri = 'date') {
  const parId = new Map();
  for (const r of resumes) parId.set(r.id, { id: r.id, titre: r.titre ?? r.nom, sousTitre: r.sousTitre, modifieLe: r.modifieLe, local: r, drive: null });
  if (partage?.etat.connecte) {
    for (const p of partage.etat.projetsDrive) {
      const deja = parId.get(p.projetId);
      if (deja) {
        deja.drive = p;
        if (String(p.modifieLe ?? '') > String(deja.modifieLe ?? '')) deja.modifieLe = p.modifieLe;
      } else parId.set(p.projetId, { id: p.projetId, titre: p.titre, sousTitre: '', modifieLe: p.modifieLe ?? '', local: null, drive: p });
    }
  }
  const liste = [...parId.values()];
  if (tri === 'nom') return liste.sort((a, b) => String(a.titre ?? '').localeCompare(String(b.titre ?? ''), 'fr', { numeric: true, sensitivity: 'base' }));
  return liste.sort((a, b) => String(b.modifieLe ?? '').localeCompare(String(a.modifieLe ?? '')));
}

/**
 * Page « Gestion de projets » : « ← » pour revenir, puis une seule liste. Toucher un projet l'ouvre ;
 * ⋮ : exporter, dupliquer, supprimer de cet appareil, supprimer partout (appareil et Drive).
 * Puis un fichier projet (.topo.json).
 */
function pageProjets(projet, resumes, partage, menuOuvert, tri) {
  const projets = projetsReunis(resumes, partage, tri);
  return `<div class="entete-page-projets">
    <button type="button" class="bouton-retour" data-action="panneau" data-panneau="projets" title="Retour au projet ouvert" aria-label="Retour au projet ouvert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
    <h2>Gestion de projets</h2>
    ${partage?.etat.connecte ? '<button type="button" class="bouton-retour" data-action="rafraichirDrive" title="Actualiser la liste de Google Drive" aria-label="Actualiser">↻</button>' : ''}
  </div>
  <section class="carte-section panneau-projets">
    <button type="button" class="bouton-secondaire bouton-nouveau-page" data-action="nouveau">+ Nouveau projet</button>
    <div class="tri-projets" role="group" aria-label="Trier">
      <span class="aide">Trier :</span>
      <button type="button" class="puce-choix ${tri === 'date' ? 'actif' : ''}" data-action="trier" data-tri="date">Récents</button>
      <button type="button" class="puce-choix ${tri === 'nom' ? 'actif' : ''}" data-action="trier" data-tri="nom">A → Z</button>
    </div>
    <div class="liste-projets">
      ${projets.map((p) => ligneProjet(p, p.id === projet.id, menuOuvert === p.id, partage)).join('')}
    </div>
    <label class="bouton-secondaire bouton-fichier">
      Ouvrir un fichier projet (.topo.json)
      <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
    </label>
  </section>`;
}

/** Une ligne : on la touche pour ouvrir le projet ; ⋮ ouvre le menu. */
function ligneProjet(p, estOuvert, menu, partage) {
  const date = p.modifieLe ? new Date(p.modifieLe).toLocaleDateString('fr-CH') : '';
  const ou = `${p.local ? '📱' : ''}${p.drive ? '☁' : ''}`;
  const verrou = p.drive?.verrou;
  const ailleurs = verrou && verrou.appareilId !== partage?.appareil.id && verrouActif(verrou);
  const details = [
    p.sousTitre ? echapper(p.sousTitre) : '',
    date,
    p.local ? `${compter(p.local.nombreLeves, 'levé')} · ${compter(p.local.nombreSurfaces, 'surface')}` : '',
    ailleurs ? `<span class="verrou-drive">ouvert sur ${echapper(verrou.nom)}</span>` : '',
  ].filter(Boolean).join(' · ');
  const ouvrir = estOuvert ? 'disabled' : p.local ? `data-action="ouvrir" data-id="${p.id}"` : `data-action="ouvrir-drive" data-id="${p.drive.dossierId}"`;
  return `<div class="ligne-projet ${estOuvert ? 'projet-ouvert' : ''}">
    <button type="button" class="infos-projet" ${ouvrir}>
      <strong><span class="ou-projet" title="${p.local ? 'sur cet appareil' : ''}${p.local && p.drive ? ' et ' : ''}${p.drive ? 'sur Google Drive' : ''}">${ou}</span> ${echapper(p.titre)}${estOuvert ? ' <span class="etiquette-ouvert">ouvert</span>' : ''}</strong>
      <span class="aide">${details}</span>
    </button>
    <button type="button" class="bouton-menu-projet" data-action="menu-projet" data-id="${p.id}" aria-expanded="${menu}" aria-label="Plus d'actions">⋮</button>
    ${menu ? `<div class="menu-projet">
      ${p.local ? `<button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporter" data-id="${p.id}">exporter (.topo.json)</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${p.id}">dupliquer</button>
        <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${p.id}">supprimer de cet appareil</button>` : ''}
      ${p.drive ? `<button type="button" class="bouton-lien" data-action="supprimer-partout" data-id="${p.id}">supprimer partout${p.local ? '' : ' (Drive)'}</button>` : ''}
    </div>` : ''}
  </div>`;
}

// Textes et couleurs de l'état du partage.
const ETATS_PARTAGE = {
  deconnecte: ['non connecté', ''],
  connexion: ['connexion…', 'etat-attente'],
  'a-jour': ['à jour', 'etat-ok'],
  envoi: ['envoi…', 'etat-attente'],
  attente: ['pas envoyé (nouvel essai bientôt)', 'etat-attente'],
  repris: ['ouvert sur un autre appareil', 'etat-erreur'],
  erreur: ['erreur', 'etat-erreur'],
};

/**
 * Bloc « Partage » : nom de l'appareil, connexion à Drive, état de l'envoi du projet ouvert.
 * Affiché dans la fenêtre des réglages (voir reglages/reglages.js) ; boutons data-action :
 * connecterDrive, deconnecterDrive, envoyerDrive, reprendreLaMain ; case data-champ="nom-appareil".
 */
export function blocPartage({ etat, appareil }) {
  const [texte, classe] = ETATS_PARTAGE[etat.etat] ?? ['?', ''];
  const heure = etat.etat === 'a-jour' && etat.derniereSynchro ? ` · ${etat.derniereSynchro.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}` : '';
  const reprise = etat.etat === 'repris' && etat.repris
    ? `<p class="avertissement">Ouvert sur <strong>${echapper(etat.repris.nom)}</strong> : tes modifications ne partent plus sur Drive.
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="reprendreLaMain">prendre la main</button></p>`
    : '';
  return `<section class="carte-section bloc-partage">
    ${titreSection('partage', 'Partage (Google Drive)', bulle('partage'))}
    ${etat.possible ? '' : '<p class="aide">Pas encore réglé sur cet appareil.</p>'}
    <label class="nom-appareil">Cet appareil <input type="text" data-champ="nom-appareil" value="${echapper(appareil.nom)}" placeholder="ex. Tablette Max" /></label>
    ${etat.possible ? `<div class="ligne-outils">
      ${etat.connecte
        ? `<span class="etat-partage ${classe}">${texte}${heure}</span>
           ${etat.etat === 'repris' ? '' : '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="envoyerDrive">envoyer maintenant</button>'}
           <button type="button" class="bouton-lien" data-action="deconnecterDrive">se déconnecter</button>`
        : `<button type="button" class="bouton-secondaire" data-action="connecterDrive" ${appareil.nom ? '' : 'disabled'}>Se connecter à Google Drive</button>`}
    </div>` : ''}
    ${etat.message && !['a-jour', 'deconnecte'].includes(etat.etat) ? `<p class="${etat.etat === 'erreur' ? 'erreur' : 'aide'}">${echapper(etat.message)}</p>` : ''}
    ${reprise}
  </section>`;
}

// Mots féminins (« aucune surface ») ; les autres sont masculins (« aucun levé »).
const FEMININS = ['surface', 'mesure'];

/** « 1 levé », « 3 levés », « aucun levé », « aucune surface ». */
function compter(nombre, mot) {
  if (nombre === 0) return `${FEMININS.includes(mot) ? 'aucune' : 'aucun'} ${mot}`;
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}
