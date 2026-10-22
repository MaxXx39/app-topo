// Onglet « Projet » (le premier), court pour s'y retrouver d'un coup d'œil :
// - en haut, trois boutons : « + Nouveau projet », « Ouvrir un projet » (projets de l'appareil ou
//   fichier projet), « Gestion de projets » (exporter, dupliquer, supprimer) ;
// - le projet ouvert : ses infos (affaire, lieu, nom facultatif) et « Continuer » ;
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
 * nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier)
 * Renvoie { afficher(projet, resumes) }.
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
    } else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.cartouche) actions.changerCartouche(cible.dataset.cartouche, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      panneau = null;
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  /** Dessine l'écran (projet ouvert, liste des projets de l'appareil). */
  function dessiner(projet, resumes) {
    // On ne redessine pas pendant une saisie : la case perdrait le curseur.
    if (conteneur.contains(document.activeElement) && document.activeElement.matches('input')) return;
    const { affaire, lieu } = projet.cartouche;
    conteneur.innerHTML = `
      <div class="actions-projets">
        <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
        <button type="button" class="bouton-secondaire ${panneau === 'ouvrir' ? 'actif' : ''}" data-action="panneau" data-panneau="ouvrir" aria-expanded="${panneau === 'ouvrir'}">Ouvrir un projet</button>
        <button type="button" class="bouton-secondaire ${panneau === 'gestion' ? 'actif' : ''}" data-action="panneau" data-panneau="gestion" aria-expanded="${panneau === 'gestion'}">Gestion de projets</button>
      </div>
      ${panneau === 'ouvrir' ? panneauOuvrir(projet, resumes) : ''}
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
    `;
    conteneurSuite.innerHTML = `<p class="aide pied-projet">Version de l'appli : ${__VERSION_APPLI__}${estDansAppliAndroid() ? ' (appli Android)' : ''}</p>`;
  }

  return {
    /** Redessine l'écran. */
    afficher(projet, resumes) {
      derniers = [projet, resumes];
      dessiner(projet, resumes);
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

/** « Ouvrir un projet » : les autres projets de l'appareil, puis un fichier projet (.topo.json). */
function panneauOuvrir(projet, resumes) {
  const autres = resumes.filter((r) => r.id !== projet.id);
  return `<section class="carte-section panneau-projets">
    ${titreSection('projets', 'Ouvrir un projet')}
    <div class="liste-projets">
      ${autres.length > 0
        ? autres.map((r) => ligneProjet(r, `<button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>`)).join('')
        : '<p class="vide">Aucun autre projet sur cet appareil.</p>'}
    </div>
    <p class="titre-section">Depuis un fichier projet</p>
    <p class="aide">Fichier .topo.json exporté d'un autre appareil (téléphone, ordinateur).</p>
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
    <p class="aide">Exporter = fichier projet (.topo.json), pour passer d'un appareil à l'autre ou le garder.</p>
    <div class="liste-projets">
      ${resumes.map((r) => ligneProjet(r, `
        ${r.id === projet.id ? '<span class="etiquette-ouvert">ouvert</span>' : ''}
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporter" data-id="${r.id}">exporter</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${r.id}">dupliquer</button>
        <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>`)).join('')}
    </div>
  </section>`;
}

// Mots féminins (« aucune surface ») ; les autres sont masculins (« aucun levé »).
const FEMININS = ['surface', 'mesure'];

/** « 1 levé », « 3 levés », « aucun levé », « aucune surface ». */
function compter(nombre, mot) {
  if (nombre === 0) return `${FEMININS.includes(mot) ? 'aucune' : 'aucun'} ${mot}`;
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}
