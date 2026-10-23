// Onglet « Projet » (le premier), court pour s'y retrouver d'un coup d'œil :
// - en haut, trois boutons : « + Nouveau projet », « Ouvrir un projet » (projets de l'appareil ou
//   fichier projet), « Gestion de projets » (exporter, dupliquer, supprimer) ;
// - le projet ouvert : ses infos (affaire, lieu, nom facultatif) et « Continuer » ;
// - le partage par Google Drive (nom de l'appareil, connexion, état de l'envoi) ;
// - ensuite (voir main.js) le bloc « Imports » (fichiers de points, plans DXF), puis la version.
// Le cartouche du PDF (dessiné par, date) se règle au moment du PDF (voir export/cartouche.js).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { estDansAppliAndroid } from '../android/pont.js';
import { titreProjet } from './projet.js';

/**
 * Crée l'écran Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), changerCartouche(champ, valeur), continuer(), exporterProjet(id),
 * nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier),
 * partage : connecterDrive(), deconnecterDrive(), nommerAppareil(nom), envoyerDrive(), reprendreLaMain(),
 * ouvrirDrive(dossierId), rafraichirDrive()
 * Renvoie { afficher(projet, resumes, partage) } ; partage : { etat (voir partage/partage.js), appareil: { id, nom } } ou null.
 */
export function creerEcranProjet(conteneur, actions, conteneurSuite) {
  // Panneau ouvert sous les trois boutons du haut : 'ouvrir', 'gestion' ou null.
  let panneau = null;
  let derniers = null; // dernier projet et liste affichés (pour redessiner après un clic)

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action === 'panneau') {
      panneau = panneau === bouton.dataset.panneau ? null : bouton.dataset.panneau;
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
  });

  // On quitte les cases de l'écran : il se redessine avec les dernières données.
  conteneur.addEventListener('focusout', () => {
    setTimeout(() => {
      if (derniers && !conteneur.contains(document.activeElement)) dessiner(...derniers);
    }, 0);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.champ === 'nom-appareil') actions.nommerAppareil(cible.value.trim());
    else if (cible.dataset.cartouche) actions.changerCartouche(cible.dataset.cartouche, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      panneau = null;
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  /** Dessine l'écran (projet ouvert, liste des projets de l'appareil). */
  function dessiner(projet, resumes, partage) {
    // On ne redessine pas pendant une saisie : la case perdrait le curseur.
    if (conteneur.contains(document.activeElement) && document.activeElement.matches('input')) return;
    const { affaire, lieu } = projet.cartouche;
    conteneur.innerHTML = `
      <div class="actions-projets">
        <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
        <button type="button" class="bouton-secondaire ${panneau === 'ouvrir' ? 'actif' : ''}" data-action="panneau" data-panneau="ouvrir" aria-expanded="${panneau === 'ouvrir'}">Ouvrir un projet</button>
        <button type="button" class="bouton-secondaire ${panneau === 'gestion' ? 'actif' : ''}" data-action="panneau" data-panneau="gestion" aria-expanded="${panneau === 'gestion'}">Gestion de projets</button>
      </div>
      ${panneau === 'ouvrir' ? panneauOuvrir(projet, resumes, partage) : ''}
      ${panneau === 'gestion' ? panneauGestion(projet, resumes) : ''}

      <section class="bloc-ouvert">
        <div class="bloc-entete">
          <span class="etiquette-entete">Projet ouvert ${bulle('projets')}</span>
          <span class="titre-projet-ouvert">${echapper(titreProjet(projet))}</span>
        </div>
        <div class="bloc-corps">
          <div class="champs-projet">
            <label>Affaire <input type="text" data-cartouche="affaire" value="${echapper(affaire ?? '')}" placeholder="ex. 10 203" /></label>
            <label>Lieu <input type="text" data-cartouche="lieu" value="${echapper(lieu ?? '')}" placeholder="ex. Gland" /></label>
            <label class="champ-large">Nom <span class="aide">(facultatif)</span> <input type="text" data-champ="nom-projet" value="${echapper(projet.nom ?? '')}" placeholder="ex. Stocks gravière" /></label>
          </div>
          <button type="button" class="bouton bouton-large" data-action="continuer">Continuer →</button>
        </div>
      </section>
      ${partage ? blocPartage(partage) : ''}
    `;
    conteneurSuite.innerHTML = `<p class="aide pied-projet">Version de l'appli : ${__VERSION_APPLI__}${estDansAppliAndroid() ? ' (appli Android)' : ''}</p>`;
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

/** Une ligne de la liste des projets : titre, nom, date et nombres, puis les boutons. */
function ligneProjet(resume, boutons) {
  return `<div class="ligne-projet">
    <div class="infos-projet">
      <strong>${echapper(resume.titre ?? resume.nom)}</strong>
      <span class="aide">${resume.sousTitre ? `${echapper(resume.sousTitre)} · ` : ''}${new Date(resume.modifieLe).toLocaleDateString('fr-CH')} · ${compter(resume.nombreLeves, 'levé')} · ${compter(resume.nombreSurfaces, 'surface')}</span>
    </div>
    <div class="ligne-outils">${boutons}</div>
  </div>`;
}

/** « Ouvrir un projet » : les projets de Drive (si connecté), ceux de l'appareil, puis un fichier projet (.topo.json). */
function panneauOuvrir(projet, resumes, partage) {
  const autres = resumes.filter((r) => r.id !== projet.id);
  const drive = partage?.etat.connecte ? partage.etat.projetsDrive.filter((p) => p.projetId !== projet.id) : null;
  return `<section class="carte-section panneau-projets">
    ${titreSection('projets', 'Ouvrir un projet')}
    ${drive ? `<p class="titre-section">Sur Google Drive <button type="button" class="bouton-lien bouton-lien-neutre" data-action="rafraichirDrive">actualiser</button></p>
      <div class="liste-projets">
        ${drive.length > 0 ? drive.map((p) => ligneProjetDrive(p, partage.appareil.id)).join('') : '<p class="vide">Aucun autre projet sur Drive.</p>'}
      </div>
      <p class="titre-section">Sur cet appareil</p>` : ''}
    <div class="liste-projets">
      ${autres.length > 0
        ? autres.map((r) => ligneProjet(r, `<button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>`)).join('')
        : '<p class="vide">Aucun autre projet sur cet appareil.</p>'}
    </div>
    <p class="titre-section">Depuis un fichier (.topo.json)</p>
    <label class="bouton-secondaire bouton-fichier">
      Ouvrir un fichier projet
      <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
    </label>
  </section>`;
}

/** « Gestion de projets » : tous les projets de l'appareil, à exporter, dupliquer ou supprimer. */
function panneauGestion(projet, resumes) {
  return `<section class="carte-section panneau-projets">
    ${titreSection('fichier', 'Gestion de projets')}
    <div class="liste-projets">
      ${resumes.map((r) => ligneProjet(r, `
        ${r.id === projet.id ? '<span class="etiquette-ouvert">ouvert</span>' : ''}
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporter" data-id="${r.id}">exporter</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${r.id}">dupliquer</button>
        <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>`)).join('')}
    </div>
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
