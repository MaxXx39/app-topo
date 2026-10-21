// Onglet « Projet » (le premier) : des blocs bien séparés pour s'y retrouver d'un coup d'œil :
// le projet ouvert (bandeau bleu nuit, étapes du travail à toucher, « Continuer »), le cartouche
// du PDF, le fichier projet, puis les autres projets de l'appareil.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';

/**
 * Crée l'écran Projet dans "conteneur". Les actions sont faites par main.js via "actions" :
 * renommer(nom), changerCartouche(champ, valeur), continuer(), allerA(onglet), exporterProjet(),
 * nouveauProjet(), ouvrirProjet(id), dupliquerProjet(id), supprimerProjet(id), importerFichierProjet(fichier)
 * Renvoie { afficher(projet, resumes) }.
 */
export function creerEcranProjet(conteneur, actions) {
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    const action = bouton.dataset.action;
    if (action === 'continuer') actions.continuer();
    else if (action === 'exporter') actions.exporterProjet();
    else if (action === 'nouveau') actions.nouveauProjet();
    else if (action === 'ouvrir') actions.ouvrirProjet(id);
    else if (action === 'dupliquer') actions.dupliquerProjet(id);
    else if (action === 'supprimer-projet') actions.supprimerProjet(id);
    else if (action === 'aller') actions.allerA(bouton.dataset.aller);
  });

  conteneur.addEventListener('change', async (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'nom-projet') actions.renommer(cible.value.trim());
    else if (cible.dataset.cartouche) actions.changerCartouche(cible.dataset.cartouche, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-projet' && cible.files[0]) {
      await actions.importerFichierProjet(cible.files[0]);
      cible.value = '';
    }
  });

  return {
    /** Redessine l'écran. */
    afficher(projet, resumes) {
      // On ne redessine pas pendant une saisie : la case perdrait le curseur.
      if (conteneur.contains(document.activeElement) && document.activeElement.matches('input')) return;
      const autres = resumes.filter((r) => r.id !== projet.id);
      const resumeOuvert = resumes.find((r) => r.id === projet.id);
      conteneur.innerHTML = `
        <h2>Projet ${bulle('projets')}</h2>

        <section class="projet-ouvert">
          <div class="projet-entete">
            <span class="etiquette-entete">Projet ouvert</span>
            <input type="text" class="nom-projet" data-champ="nom-projet" value="${echapper(projet.nom)}" aria-label="Nom du projet" />
          </div>
          <div class="projet-corps">
            <p class="titre-section">Où en est le projet</p>
            <div class="etapes-projet">${tuilesEtapes(projet)}</div>
            <button type="button" class="bouton bouton-large" data-action="continuer">Continuer →</button>
          </div>
        </section>

        <section class="carte-section">
          <h3>${icone(ICONES.cartouche)}Cartouche du PDF ${bulle('cartouche')}</h3>
          <div class="champs-export">
            <label>Affaire <input type="text" data-cartouche="affaire" value="${echapper(projet.cartouche.affaire ?? '')}" placeholder="ex. 10 203" /></label>
            <label>Dessiné par <input type="text" data-cartouche="dessinePar" value="${echapper(projet.cartouche.dessinePar ?? '')}" placeholder="ex. MGO" /></label>
            <label>Date (vide : date du jour) <input type="date" data-cartouche="date" value="${echapper(projet.cartouche.date ?? '')}" /></label>
          </div>
        </section>

        <section class="carte-section">
          <h3>${icone(ICONES.fichier)}Fichier projet</h3>
          <p class="aide">Pour passer du téléphone à l'ordinateur (et l'inverse).</p>
          <div class="ligne-outils">
            <button type="button" class="bouton-secondaire" data-action="exporter">Exporter le fichier projet</button>
            <label class="bouton-secondaire bouton-fichier">
              Ouvrir un fichier projet
              <input type="file" data-champ="fichier-projet" accept=".json,application/json" hidden />
            </label>
          </div>
        </section>

        <section class="carte-section">
          <h3>${icone(ICONES.projets)}Mes projets sur cet appareil</h3>
          <button type="button" class="bouton-secondaire" data-action="nouveau">+ Nouveau projet</button>
          ${autres.length === 0 ? '<p class="aide">Aucun autre projet pour l\'instant.</p>' : ''}
          <div class="liste-projets">
            ${autres
              .map(
                (r) => `
              <div class="ligne-projet">
                <div class="infos-projet">
                  <strong>${echapper(r.nom)}</strong>
                  <span class="aide">${new Date(r.modifieLe).toLocaleDateString('fr-CH')} · ${compter(r.nombreLeves, 'levé')} · ${compter(r.nombreSurfaces, 'surface')}</span>
                </div>
                <div class="ligne-outils">
                  <button type="button" class="bouton-secondaire" data-action="ouvrir" data-id="${r.id}">Ouvrir</button>
                  <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${r.id}">dupliquer</button>
                  <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${r.id}">supprimer</button>
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </section>

        <div class="pied-projet">
          ${
            resumeOuvert
              ? `<p class="ligne-outils">Projet ouvert :
                  <button type="button" class="bouton-lien bouton-lien-neutre" data-action="dupliquer" data-id="${projet.id}">dupliquer</button>
                  <button type="button" class="bouton-lien" data-action="supprimer-projet" data-id="${projet.id}">supprimer</button>
                </p>`
              : ''
          }
          <p class="aide">Version de l'appli : ${__VERSION_APPLI__}</p>
        </div>
      `;
    },
  };
}

// Petits dessins des titres de section (traits, comme les icônes des onglets).
const ICONES = {
  cartouche: '<path d="M4 4h16v16H4zM4 15h16M10 15v5" />',
  fichier: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14l3 3 3-3" />',
  projets: '<path d="M3 7h6l2 2h10v10H3z" />',
};

/** Icône (SVG) placée devant un titre de section. */
function icone(dessin) {
  return `<svg class="icone-section" viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg>`;
}

// Mots féminins (« aucune surface ») ; les autres sont masculins (« aucun levé »).
const FEMININS = ['surface', 'mesure'];

/** « 1 levé », « 3 levés », « aucun levé », « aucune surface ». */
function compter(nombre, mot) {
  if (nombre === 0) return `${FEMININS.includes(mot) ? 'aucune' : 'aucun'} ${mot}`;
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}

/**
 * Tuiles des étapes du travail (1. Importer, 2.1 Surfaces, 2.2 Volumes, 3. Mesures) : ce qu'il y a
 * déjà dans le projet ; on touche une tuile pour aller à son onglet.
 */
function tuilesEtapes(projet) {
  const etapes = [
    { onglet: 'importer', numero: '1', titre: '1. Importer', nombre: projet.leves.length, mot: 'levé' },
    { onglet: 'surfaces', numero: '2.1', titre: '2.1 Surfaces', nombre: projet.surfaces.length, mot: 'surface' },
    { onglet: 'volumes', numero: '2.2', titre: '2.2 Volumes', nombre: projet.calculs.length, mot: 'volume' },
    { onglet: 'mesures', numero: '3', titre: '3. Mesures', nombre: projet.mesures.length, mot: 'mesure' },
  ];
  return etapes
    .map(
      (e) => `<button type="button" class="tuile-etape ${e.nombre > 0 ? 'faite' : ''}" data-action="aller" data-aller="${e.onglet}">
        <span class="numero-etape">${e.nombre > 0 ? '✓' : e.numero}</span>
        <span class="titre-etape">${e.titre}</span>
        <span class="compte-etape">${compter(e.nombre, e.mot)}</span>
      </button>`,
    )
    .join('');
}
