// Onglet « Projet » (le premier), court pour s'y retrouver d'un coup d'œil :
// - en haut, deux boutons : « + Nouveau projet » et « Mes projets » (liste : toucher = ouvrir,
//   menu ⋮ = exporter, dupliquer, supprimer ; projets de Google Drive ; fichier projet) ;
// - le projet ouvert : ses infos (affaire, lieu, nom facultatif) et « Continuer » ;
// - ensuite (voir main.js) le bloc « Imports » (fichiers de points, plans DXF) ;
// - tout en bas, le partage par Google Drive (pas besoin de le voir tout le temps), puis la version.
// Le cartouche du PDF (dessiné par, date) se règle au moment du PDF (voir export/cartouche.js).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { estDansAppliAndroid } from '../android/pont.js';
import { titreProjet, projetSansTitre, EXEMPLE_TITRE } from './projet.js';

/**
 * Crée l'écran Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), changerCartouche(champ, valeur), continuer(), exporterProjet(id),
 * nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier),
 * partage : connecterDrive(), deconnecterDrive(), nommerAppareil(nom), envoyerDrive(), reprendreLaMain(),
 * ouvrirDrive(dossierId), rafraichirDrive()
 * Renvoie { afficher(projet, resumes, partage) } ; partage : { etat (voir partage/partage.js), appareil: { id, nom } } ou null.
 */
export function creerEcranProjet(conteneur, actions, conteneurSuite) {
  // Panneau « Mes projets » ouvert sous les boutons du haut, et projet dont le menu ⋮ est ouvert.
  let panneau = null;
  let menuOuvert = null;
  let derniers = null; // dernier projet et liste affichés (pour redessiner après un clic)

  function quandClic(evenement) {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action !== 'menu-projet') menuOuvert = null;
    if (action === 'panneau') {
      panneau = panneau === bouton.dataset.panneau ? null : bouton.dataset.panneau;
      if (derniers) dessiner(...derniers);
    } else if (action === 'menu-projet') {
      menuOuvert = menuOuvert === id ? null : id;
      if (derniers) dessiner(...derniers);
    } else if (action === 'continuer') actions.continuer();
    else if (action === 'exporter') actions.exporterProjet(id);
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
    conteneur.innerHTML = `
      <div class="actions-projets">
        <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
        <button type="button" class="bouton-secondaire ${panneau === 'projets' ? 'actif' : ''}" data-action="panneau" data-panneau="projets" aria-expanded="${panneau === 'projets'}">Mes projets ${panneau === 'projets' ? '▴' : '▾'}</button>
      </div>
      ${panneau === 'projets' ? panneauProjets(projet, resumes, partage, menuOuvert) : ''}

      <section class="bloc-ouvert">
        <div class="bloc-entete">
          <span class="etiquette-entete">Projet ouvert ${bulle('projets')}</span>
          ${projetSansTitre(projet)
            ? `<span class="titre-projet-ouvert titre-exemple">${EXEMPLE_TITRE}</span>`
            : `<span class="titre-projet-ouvert">${echapper(titreProjet(projet))}</span>`}
        </div>
        <div class="bloc-corps">
          <div class="champs-projet">
            <label>Affaire <input type="text" data-cartouche="affaire" value="${echapper(affaire ?? '')}" placeholder="ex. 10 203" /></label>
            <label>Lieu <input type="text" data-cartouche="lieu" value="${echapper(lieu ?? '')}" placeholder="ex. Gland" /></label>
            <label class="champ-large">Nom <span class="aide">(facultatif)</span> <input type="text" data-champ="nom-projet" value="${echapper(projet.nom ?? '')}" placeholder="ex : Rue Mont Blanc" /></label>
          </div>
          <button type="button" class="bouton bouton-large" data-action="continuer">Continuer →</button>
        </div>
      </section>
    `;
    conteneurSuite.innerHTML = `${partage ? blocPartage(partage) : ''}
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
 * Une ligne de la liste des projets : on la touche pour ouvrir le projet ; le menu ⋮ propose
 * exporter, dupliquer, supprimer.
 */
function ligneProjet(resume, estOuvert, menu) {
  return `<div class="ligne-projet ${estOuvert ? 'projet-ouvert' : ''}">
    <button type="button" class="infos-projet" ${estOuvert ? 'disabled' : `data-action="ouvrir" data-id="${resume.id}"`}>
      <strong>${echapper(resume.titre ?? resume.nom)}${estOuvert ? ' <span class="etiquette-ouvert">ouvert</span>' : ''}</strong>
      <span class="aide">${resume.sousTitre ? `${echapper(resume.sousTitre)} · ` : ''}${new Date(resume.modifieLe).toLocaleDateString('fr-CH')} · ${compter(resume.nombreLeves, 'levé')} · ${compter(resume.nombreSurfaces, 'surface')}</span>
    </button>
    <button type="button" class="bouton-menu-projet" data-action="menu-projet" data-id="${resume.id}" aria-expanded="${menu}" aria-label="Plus d'actions">⋮</button>
    ${menu ? `<div class="menu-projet">
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporter" data-id="${resume.id}">exporter (.topo.json)</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${resume.id}">dupliquer</button>
      <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${resume.id}">supprimer</button>
    </div>` : ''}
  </div>`;
}

/**
 * « Mes projets » : les projets de l'appareil (toucher la ligne = ouvrir ; menu ⋮ = exporter,
 * dupliquer, supprimer), ceux de Google Drive (si connecté), puis un fichier projet (.topo.json).
 */
function panneauProjets(projet, resumes, partage, menuOuvert) {
  const drive = partage?.etat.connecte ? partage.etat.projetsDrive.filter((p) => p.projetId !== projet.id) : null;
  return `<section class="carte-section panneau-projets">
    ${titreSection('projets', 'Mes projets')}
    <div class="liste-projets">
      ${resumes.map((r) => ligneProjet(r, r.id === projet.id, menuOuvert === r.id)).join('')}
    </div>
    ${drive ? `<p class="titre-section">Sur Google Drive <button type="button" class="bouton-lien bouton-lien-neutre" data-action="rafraichirDrive">actualiser</button></p>
      <div class="liste-projets">
        ${drive.length > 0 ? drive.map((p) => ligneProjetDrive(p, partage.appareil.id)).join('') : '<p class="vide">Aucun autre projet sur Drive.</p>'}
      </div>` : ''}
    <label class="bouton-secondaire bouton-fichier">
      Ouvrir un fichier projet (.topo.json)
      <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
    </label>
  </section>`;
}

/** Un projet de Drive : titre, date, « ouvert sur … » s'il est verrouillé par un autre appareil. */
function ligneProjetDrive(p, monAppareil) {
  const date = p.modifieLe ? new Date(p.modifieLe).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const ailleurs = p.verrou && p.verrou.appareilId !== monAppareil;
  return `<div class="ligne-projet">
    <div class="infos-projet">
      <strong>${echapper(p.titre)}</strong>
      <span class="aide">${date}${ailleurs ? ` · <span class="verrou-drive">ouvert sur ${echapper(p.verrou.nom)}</span>` : ''}</span>
    </div>
    <div class="ligne-outils"><button type="button" class="bouton-secondaire" data-action="ouvrir-drive" data-id="${p.dossierId}">Ouvrir</button></div>
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

/** Bloc « Partage » : nom de l'appareil, connexion à Drive, état de l'envoi du projet ouvert. */
function blocPartage({ etat, appareil }) {
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
