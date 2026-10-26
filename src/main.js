// Point de départ de l'application : ce fichier construit la page et relie les écrans entre eux.
//
// Tout est rangé dans le "projet" ouvert (voir projet/projet.js), enregistré automatiquement
// sur l'appareil après chaque modification.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { lireLandXML } from './topo/landxml.js';
import { lireDXF } from './topo/dxf-lecture.js';
import { texteDuDxf, lirePlanDxf, estEnMn95 } from './topo/dxf-plan.js';
import { formaterNombre } from './topo/format.js';
import { calculerSurface, surfaceImportee, cleTriangle, estImportee, nomNature, nouvelIdentifiant } from './topo/surface.js';
import { calculsAutomatiques, calculerVolume, nettoyerCalculs, nomDuCalcul, descriptionCalcul } from './volumes/calculs.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurSurfaces } from './surfaces/editeur.js';
import { creerEcranVolumes, texteBase } from './volumes/ecran.js';
import { preparerPhoto } from './photos/photo.js';
import { creerEcranExport, telecharger } from './export/ecran.js';
import { creerEcranProjet, blocPartage } from './projet/ecran.js';
import { creerEcranImport } from './import/ecran.js';
import { creerEcranCoupes } from './coupes/ecran.js';
import { creerEcranMesures } from './mesures/ecran.js';
import { creerEcranDessin } from './dessin/ecran.js';
import { ouvrirFenetrePointTape } from './leve/fenetres-points.js';
import { gisement, gisementNormal, pointSelonGisement, rectangle, airePolygone, longueursCotes, estFerme, altitudesDuDessin, nomDessin } from './topo/dessin.js';
import { creerEcranExportMesures } from './export/ecran-mesures.js';
import { calculerMesure } from './topo/mesure.js';
import { NOM_TYPE } from './mesures/valeurs.js';
import { profilSurface } from './topo/coupe.js';
import { echapper } from './outils/echapper.js';
import {
  creerProjet,
  ajouterLeve,
  leveActif,
  dupliquerProjet,
  ecrireFichierProjet,
  lireFichierProjet,
  completerProjet,
  resumerProjet,
  titreProjet,
  nomAutomatique,
  sousTitreProjet,
  nomDeFichierProjet,
} from './projet/projet.js';
import * as stockage from './projet/stockage.js';
import { creerPartage } from './partage/partage.js';
import * as historique from './projet/historique.js';
import { bulle, installerAide } from './aide/bulles.js';
import { creerEcranLeve, mettreAJourBandeaux, LONGUEURS_COUPE } from './leve/ecran.js';
import { creerBoutonRecepteur } from './leve/recepteur.js';
import { creerSuiviOrientation } from './leve/orientation.js';
import { ecouterBoussole } from './leve/boussole.js';
import { lireLibelles, enregistrerLibelles } from './leve/libelles.js';
import { altitudeSurSurface, ecartSurface, classeEcart, extremitesCoupe, chercheurAltitude } from './topo/implantation.js';
import { guidageTalus, zoneTalus, sourceAltitudeLigne, talusComplet, textePente } from './topo/talus.js';
import { guidageLigne, sommetsChoisis, longueurPolyligne, ligneParallele } from './topo/ligne-implantation.js';
import { MODES_ACCROCHE, accrocher, accrocherTrait, sourcesDesPlans, guidage, ecartsImplantation, classeDistance, nomPointAImplanter, csvImplantations } from './topo/accroche.js';
import {
  estLeveDirect,
  leveDuJour,
  creerSurfaceDirecte,
  creerAutres,
  prochainNom,
  nomsDuProjet,
  rolesPermis,
  ajouterPointDirect,
  annulerDernierPoint,
  nouvelleLigne,
  basculerFermeture,
  ligneEnCours,
  resumeStock,
} from './topo/leve-direct.js';
import { creerMetre, prochainNomMetre, ajouterPointMetre, nouvelElementMetre, mesureEnCours, retirerPointDesMesures, resumeMetre } from './topo/metre.js';
import { regleToucheVolume, recepteurDisponible, ecouterRecepteur, choisirRecepteur, reconnecterRecepteur, deconnecterRecepteur, prendrePointRecepteur } from './android/pont.js';
import { correctionsDisponibles, lireReglagesCorrections, demarrerCorrections, arreterCorrections, estDansAppliAndroid } from './android/pont.js';
import { appliquerReglages, estModeBase, ouvrirReglages } from './reglages/reglages.js';
import { sonValidation, sonRefus } from './outils/son.js';
import { ecartsControle, resultatControle, estControleReussi, controleNecessaire, lireTolerances, csvControles, ajouterPointsControle } from './topo/controle.js';
import { pdfControles } from './export/pdf-controles.js';
import { listesDePoints, pointsDesListes, montrerListe, mesuresVisibles, LISTE_CONTROLE } from './plan/listes-points.js';
import { calculerHelmert, planRecale } from './topo/recalage.js';
import { nomSuivant } from './topo/noms.js';
import { demanderChoix } from './outils/choix.js';
import { genererDxfPlan, octetsDxf } from './export/dxf-recale.js';
import { creerBarreRecalage } from './recalage/barre.js';
import { ajouterPointAjoute, nomPointAjoute, lireNombreTape } from './topo/points-ajoutes.js';

// --- État de l'application ---
let projet = creerProjet(); // projet ouvert
let resumes = []; // liste des projets enregistrés (pour l'onglet Projet)
let partage = null; // partage des projets par Google Drive (voir partage/partage.js), créé plus bas
let dernierImport = null; // résultat du dernier import de points
let dernierPlan = null; // message du dernier import de plan DXF
let surfacesCalculees = new Map(); // id de surface -> triangles (résultat de calculerSurface)
let resultatsCalculs = new Map(); // id de calcul -> volume (résultat de calculerVolume)
let resultatsMesures = new Map(); // id de mesure -> longueurs, aires (résultat de calculerMesure)
let ongletContexte = 'projets'; // dernier onglet (hors plan) : décide de ce que montre le plan
let calculMontre = null; // id du calcul colorié sur le plan (bouton « Voir sur le plan »)
let traceCoupe = null; // coupe en train d'être tracée sur le plan : { id, etape: 'debut' ou 'fin', debut }
// Calculs › Dessin : dessin en cours avec l'outil « pilote » (voir dessin/ecran.js), ou null :
// { dessinId, toucher ('sommet' ou 'direction' : ce que fait un toucher sur le plan), direction
// (gisement en gon, ou null), distance (texte tapé), reference (nom du point visé, ou null) }.
let pilote = null;
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir
// Levé avec le récepteur (appli Android) : levé et stock en cours, rôle du prochain point.
const leveDirect = { stockId: null, role: 'contour' };
// Libellés des noms de points (L-HT-1-3, P-RG-2…), gardés sur l'appareil (voir leve/libelles.js).
let libelles = lireLibelles();
let etatRecepteur = null; // dernier état reçu du récepteur (voir android/pont.js)
// Onglet Terrain : mode (Lever ou Contrôler) et réglages du contrôle, retenus sur l'appareil.
const CLE_TERRAIN = 'topo-terrain';
const terrain = {
  mode: 'lever',
  surfaceId: null,
  vueCoupes: 'les2',
  demiLongueur: 5,
  exagerationCoupe: 1,
  sourceOrientation: 'rx2',
  libelleLigne: 'HT', // dernier libellé choisi pour une ligne de rupture
  libellePoint: 'TN', // et pour un point isolé (ou compté)
  libelleAire: 'ENR', // et pour une aire d'un métré
  implantation: 'surface', // mode Implanter : implanter une surface ou un point
  accroche: 'point', // implantation d'un point : point du projet, sommet, milieu, sur la ligne ou centre (voir topo/accroche.js)
  guidage: 'rx2', // guidage vers le point : 'rx2' (avance / droite selon le cap du RX2) ou 'nseo' (nord / est)
  accrocheLigne: 'trait', // implantation d'une ligne : 'trait' (ligne du plan DXF) ou une accroche de point
  // Implantation d'un talus (voir topo/talus.js) : derniers réglages, repris pour le talus suivant.
  talus: { horizontal: null, vertical: null, ligneEst: 'haut', cote: 'droite', longueur: null, terrainId: null, altitudeSurfaceId: null },
  ...lireReglagesTerrain(),
};
// Implantation d'un point : point choisi en touchant le plan ({ est, nord, altitude, nom, mode }) et
// point à implanter en cours ({ id (point de la liste « À implanter », ou null), nom, est, nord, altitude }).
// Implantation d'une ligne : points choisis pour la faire (pointsLigne : [{ est, nord, altitude, nom }])
// et ligne en cours (ligne : { nom, sommets, segmentTouche, segment (n° ou null : toute la ligne),
// inverse, decalage (m, + à droite), altitudes: { debut, fin } (tapées, ou null) }).
// Talus : la ligne est implanter.ligne, ses réglages terrain.talus ; talusId : talus de « Mes talus »
// ouvert (ses changements y sont gardés), ou null.
const implanter = { choix: null, cible: null, pointsLigne: [], ligne: null, talusId: null };
// Mode Contrôler (autocontrôle) : point de contrôle vers lequel on guide ({ id, nom, est, nord, altitude }) ou null.
const autocontrole = { cible: null };
const suiviOrientation = creerSuiviOrientation(terrain.sourceOrientation);

function lireReglagesTerrain() {
  try {
    return JSON.parse(localStorage.getItem(CLE_TERRAIN)) ?? {};
  } catch {
    return {};
  }
}

function retenirReglagesTerrain() {
  try {
    localStorage.setItem(CLE_TERRAIN, JSON.stringify(terrain));
  } catch {
    // Mémoire du navigateur indisponible : les réglages ne seront simplement pas retenus.
  }
}

// --- Mise en page : onglets ---
// Projet (le chantier : levés importés, cartouche, fichier projet), Terrain (levé avec le récepteur,
// seulement dans l'appli Android), Calculs (Surfaces, Volumes, Mesures : un seul affiché à la fois,
// choisi en haut de l'onglet) et Plan (en plein écran sur téléphone, toujours à droite sur ordinateur).
const ICONES = {
  projets: '<path d="M3 7h6l2 2h10v10H3z" />',
  // Terrain : une canne GNSS (antenne en haut, pointe en bas).
  terrain: '<path d="M12 8v13M8 5a4 2 0 0 0 8 0a4 2 0 0 0-8 0M10 21h4" />',
  calculs: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
};
// Main ouverte (on a la main sur le projet), dessinée en traits comme les autres icônes.
const ICONE_MAIN = '<path d="M18 11V6a2 2 0 0 0-4 0v5" /><path d="M14 10V4a2 2 0 0 0-4 0v6" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />';

const ONGLETS = [
  { nom: 'projets', titre: 'Projet' },
  ...(recepteurDisponible() ? [{ nom: 'terrain', titre: 'Terrain' }] : []),
  { nom: 'calculs', titre: 'Calculs' },
  { nom: 'plan', titre: 'Plan' },
];
// Les trois parties de l'onglet Calculs (ce sont aussi les noms de leurs panneaux) : Surfaces et
// Volumes vont ensemble (un même cadre), Mesures / métrés est à part.
const PARTIES_CALCULS = [
  ['surfaces', 'Surfaces'],
  ['volumes', 'Volumes'],
  ['mesures', 'Mesures / métrés'],
  ['dessin', 'Dessin'],
];
const boutonPartie = ([cle, titre]) => `<button type="button" data-partie="${cle}">${titre}</button>`;
const estPartieCalculs = (nom) => PARTIES_CALCULS.some(([cle]) => cle === nom);
let partieCalculs = 'surfaces'; // dernière partie affichée dans Calculs

/** Bouton d'un onglet (icône + titre). */
const boutonOnglet = (o) => `<button type="button" data-onglet="${o.nom}" class="onglet-${o.nom}">
    <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[o.nom]}</svg>
    <span>${o.titre}</span>
  </button>`;

document.querySelector('#app').innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau panneau-projet" data-onglet="projets">
        <div id="projets"></div>
        <div id="importer"></div>
        <div id="projets-suite"></div>
      </section>
      <section class="panneau" data-onglet="terrain">
        <div id="leve-direct"></div>
      </section>
      <nav class="parties-calculs" aria-label="Calculs">
        <div class="groupe-surfaces-volumes" role="group" aria-label="Surfaces et volumes">
          ${PARTIES_CALCULS.slice(0, 2).map(boutonPartie).join('')}
        </div>
        <div class="groupe-mesures">${boutonPartie(PARTIES_CALCULS[2])}</div>
        <div class="groupe-dessin">${boutonPartie(PARTIES_CALCULS[3])}</div>
      </nav>
      <section class="panneau" data-onglet="surfaces">
        <h2>Surfaces ${bulle('surfaces')}</h2>
        <p class="vide sans-points">Aucun point dans le projet.</p>
        <div id="message-import-surface"></div>
        <div id="surfaces"></div>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>Volumes ${bulle('volumes')}</h2>
        <div id="volumes"></div>
        <div id="coupes" class="carte-section"></div>
        <div id="export" class="carte-section"></div>
      </section>
      <section class="panneau" data-onglet="mesures">
        <h2>Mesures / métrés ${bulle('mesures')}</h2>
        <div id="mesures"></div>
        <div id="export-mesures" class="carte-section"></div>
      </section>
      <section class="panneau" data-onglet="dessin">
        <h2>Dessin ${bulle('dessin')}</h2>
        <div id="dessins"></div>
      </section>
      <div id="barre-surfaces" class="barre-edition" hidden></div>
      <div id="barre-mesures" class="barre-edition" hidden></div>
    </div>
    <section class="panneau panneau-plan" data-onglet="plan">
      <div id="plan"></div>
    </section>
  </div>
  <nav class="onglets" aria-label="Onglets">${ONGLETS.map(boutonOnglet).join('')}</nav>
`;

/**
 * Affiche un onglet ('projets', 'terrain', 'plan') ou une partie de Calculs ('surfaces',
 * 'volumes', 'mesures' ; 'calculs' : la dernière partie affichée). Sur ordinateur, le plan reste
 * toujours visible à droite.
 */
function afficherOnglet(demande) {
  const nom = demande === 'calculs' ? partieCalculs : demande;
  if (estPartieCalculs(nom)) partieCalculs = nom;
  for (const panneau of document.querySelectorAll('.panneau[data-onglet]')) {
    panneau.classList.toggle('actif', panneau.dataset.onglet === nom);
  }
  const ongletVisible = estPartieCalculs(nom) ? 'calculs' : nom;
  for (const bouton of document.querySelectorAll('.onglets button[data-onglet]')) {
    bouton.classList.toggle('actif', bouton.dataset.onglet === ongletVisible);
  }
  for (const bouton of document.querySelectorAll('.parties-calculs button')) {
    bouton.classList.toggle('actif', bouton.dataset.partie === nom);
  }
  document.body.dataset.onglet = nom;
  if (nom !== 'plan' && nom !== 'dessin') pilote = null;
  if (nom !== 'plan' && nom !== ongletContexte) {
    // Les mesures sont à part : on ne modifie pas une surface (ou une coupe) et une mesure en même temps.
    if (nom === 'mesures') {
      editeurSurfaces.arreterModification();
      if (traceCoupe) arreterTrace();
    } else {
      ecranMesures.arreterModification();
    }
    ongletContexte = nom;
    recalculer();
  }
  mettreAJourToucheVolume();
  window.scrollTo(0, 0);
}
document.querySelector('.onglets').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-onglet]');
  if (bouton) afficherOnglet(bouton.dataset.onglet);
});
document.querySelector('.parties-calculs').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-partie]');
  if (bouton) afficherOnglet(bouton.dataset.partie);
});
installerAide(document.querySelector('#bouton-aide'));
// Toucher le projet ouvert (en-tête) : on va à l'onglet Projet.
document.querySelector('#entete-projet').addEventListener('click', () => afficherOnglet('projets'));

// Réglages de cet appareil (roue ⚙) : mode Base / Confirmé, mode téléphone, bulles d'aide, nom de l'appareil.
appliquerReglages();
// L'étoile de l'en-tête (mode Base ☆ / Confirmé ★) ouvre aussi les réglages.
document.querySelector('#bouton-mode').addEventListener('click', () => document.querySelector('#bouton-reglages').click());
// Fenêtre des réglages ouverte (pour y redessiner l'état du partage Drive), ou null.
let fenetreReglages = null;
document.querySelector('#bouton-reglages').addEventListener('click', () => {
  fenetreReglages = ouvrirReglages({
    aideActive: document.body.classList.contains('aide-active'),
    basculerAide: () => document.querySelector('#bouton-aide').click(),
    fermerAppli: estDansAppliAndroid() && typeof window.AppliAndroid.fermerAppli === 'function' ? fermerAppli : null,
    changerMode: () => {
      adapterAuMode();
      recalculer();
    },
    // Partage par Google Drive (dans les réglages depuis la version 0.54.0).
    partage: partage
      ? {
          html: (options) => blocPartage({ etat: partage.etat, appareil: partage.appareil() }, options),
          actions: {
            connecterDrive: () => partage.connecter(),
            deconnecterDrive: () => partage.deconnecter(),
            envoyerDrive: () => partage.envoyerMaintenant(),
            reprendreLaMain: () => partage.reprendreLaMain(),
            nommerAppareil: (nom) => {
              partage.nommerAppareil(nom);
              fenetreReglages?.rafraichir();
            },
          },
        }
      : null,
  });
});

/**
 * Mode Base : on quitte ce qui y est caché (onglet Calculs, implantation d'un talus). Rien n'est
 * supprimé : en repassant en Confirmé, tout est là.
 */
function adapterAuMode() {
  if (!estModeBase()) return;
  if (estPartieCalculs(document.body.dataset.onglet)) afficherOnglet('projets');
  if (terrain.implantation === 'talus') {
    terrain.implantation = 'ligne';
    retenirReglagesTerrain();
  }
}

/**
 * Fermer l'appli (bouton des réglages ⚙, appli Android seulement) : le projet part d'abord sur
 * Drive et son verrou est rendu (5 s au plus).
 */
async function fermerAppli() {
  if (!confirm('Fermer l\'appli ?')) return;
  afficherMessage('Fermeture…', null);
  await Promise.race([partage?.avantDeChanger(), new Promise((fin) => setTimeout(fin, 5000))]);
  window.AppliAndroid.fermerAppli();
}

// --- Accès aux données du projet ---

const pointsDuLeve = (id) => projet.leves.find((l) => l.id === id)?.points ?? [];

/** Triangles d'une surface du projet (ou [] si elle n'est pas calculable). */
const trianglesDeSurface = (id) => surfacesCalculees.get(id)?.triangles ?? [];

/** Surfaces affichées : celles du levé coché, et les surfaces importées (LandXML, DXF). */
function surfacesAffichees() {
  const leve = leveActif(projet);
  return projet.surfaces.filter((s) => estImportee(s) || s.leveId === leve?.id);
}

/**
 * Nom d'une surface dans les listes : avec sa nature (si son nom ne la dit pas déjà),
 * son format si elle est importée, et son levé s'il y en a plusieurs.
 */
function etiquetteSurface(surface) {
  const nature = nomNature(surface.nature);
  const precisions = [];
  if (nature && !surface.nom.toLowerCase().includes(nature.toLowerCase())) precisions.push(nature.toLowerCase());
  if (estImportee(surface)) precisions.push(surface.type === 'dxf' ? 'DXF' : 'LandXML');
  const texte = precisions.length > 0 ? `${surface.nom} (${precisions.join(', ')})` : surface.nom;
  const leve = projet.leves.find((l) => l.id === surface.leveId);
  return projet.leves.length > 1 && leve ? `${texte} · ${leve.nom}` : texte;
}

/**
 * Calcul de volume dessiné sur une surface (couleurs remblai / déblai et étiquette du volume) :
 * celui montré avec « Voir sur le plan » s'il porte sur cette surface, sinon le premier calculé.
 */
function calculDuPlan(surface) {
  const calculable = (c) => c.surface1Id === surface.id && resultatsCalculs.get(c.id) && !resultatsCalculs.get(c.id).erreurs;
  return projet.calculs.find((c) => c.id === calculMontre && calculable(c)) ?? projet.calculs.find(calculable) ?? null;
}

// --- Écrans ---

const ecranImport = creerEcranImport(document.querySelector('#importer'), {
  importerPointsControle: (fichier) => importerPointsControle(fichier),
  importerPoints: async (fichier) => {
    try {
      const resultat = lirePoints(await fichier.text());
      dernierImport = { ...resultat, nomFichier: fichier.name };
      if (resultat.points.length > 0) ajouterLeve(projet, fichier.name, resultat.points);
    } catch (erreur) {
      dernierImport = { nomFichier: fichier.name, format: '?', points: [], erreurs: [{ ligne: '-', message: erreur.message }], avertissements: [] };
    }
    modifie({ recadrer: true });
  },
  choisirLeve: (id) => {
    projet.leveActifId = id;
    montrerUneSurfaceDuLeve();
    modifie({ recadrer: true });
  },
  renommerLeve: (id, nom) => {
    const leve = projet.leves.find((l) => l.id === id);
    if (leve && nom) leve.nom = nom;
    modifie();
  },
  importerPlanDxf: async (fichier) => {
    afficherMessage(`Lecture du plan « ${fichier.name} »…`, null);
    // On laisse le message s'afficher avant la lecture (quelques secondes pour un gros plan).
    await new Promise((fin) => setTimeout(fin, 30));
    try {
      const { plan: lu, erreur } = lirePlanDxf(texteDuDxf(new Uint8Array(await fichier.arrayBuffer())), fichier.name);
      if (erreur || !lu.bornes) {
        dernierPlan = { nom: fichier.name, erreur: erreur ?? 'aucun objet dessiné trouvé' };
        afficherMessage('Plan non importé');
        recalculer();
        return;
      }
      const avertissements = [];
      if (!estEnMn95(lu.bornes)) {
        avertissements.push('Ce plan ne semble pas être en MN95 (Est 2 480 000 à 2 840 000, Nord 1 070 000 à 1 300 000) : touche « recaler » sur le plan pour le mettre en MN95.');
      }
      const ignores = Object.entries(lu.compte.ignores);
      if (ignores.length > 0) avertissements.push(`Non affiché(s) : ${ignores.map(([type, n]) => `${n} ${type}`).join(', ')} (hachures, images… : seuls les traits, textes, cercles et aplats sont lus).`);
      projet.plansDxf.push({ id: nouvelIdentifiant(), importeLe: new Date().toISOString(), ...lu });
      dernierPlan = { nom: fichier.name, avertissements };
      afficherMessage(`Plan « ${fichier.name} » importé : ${lu.compte.objets} objets`, 4000);
      modifie();
    } catch (erreur) {
      dernierPlan = { nom: fichier.name, erreur: erreur.message };
      afficherMessage('Plan non importé');
      recalculer();
    }
  },
  voirPlanDxf: (id) => {
    const choisi = projet.plansDxf.find((p) => p.id === id);
    if (!choisi) return;
    if (estTelephone()) afficherOnglet('plan');
    requestAnimationFrame(() => plan.cadrerSurPlans([planRecale(choisi)]));
  },
  supprimerPlanDxf: (id) => {
    const choisi = projet.plansDxf.find((p) => p.id === id);
    if (!choisi || !confirm(`Supprimer le plan « ${choisi.nom} » du projet ?`)) return;
    projet.plansDxf = projet.plansDxf.filter((p) => p.id !== id);
    dernierPlan = null;
    modifie();
  },
  reglerPlanDxf: (id, changements) => reglerPlanDxf(id, changements),
  recalerPlanDxf: (id) => commencerRecalage(id),
  annulerRecalagePlan: (id) => annulerRecalage(id),
  exporterPlanRecale: (id) => {
    const choisi = projet.plansDxf.find((p) => p.id === id);
    if (!choisi?.recalage?.applique) return;
    const nom = String(choisi.nom).replace(/\.dxf$/i, '');
    telecharger(new Blob([octetsDxf(genererDxfPlan(planRecale(choisi)))], { type: 'application/dxf' }), `${nom}_MN95.dxf`);
  },
  // Point tapé (nom, Est, Nord, altitude facultative) : rangé dans le levé « Points ajoutés ».
  ajouterPointTape: (valeurs) => {
    const { point, erreur } = ajouterPointAjoute(projet, { ...valeurs, source: 'tape' });
    if (erreur) return { erreur };
    afficherMessage(`Point ${point.nom} ajouté`, 2500);
    modifie();
    return null;
  },
  commencerPointage: () => commencerPointage(),
  montrerCalqueDxf: (id, numero, visible) => {
    const calque = projet.plansDxf.find((p) => p.id === id)?.calques[numero];
    if (!calque) return;
    calque.visible = visible;
    modifie();
  },
  montrerTousCalquesDxf: (id, visible) => {
    for (const calque of projet.plansDxf.find((p) => p.id === id)?.calques ?? []) calque.visible = visible;
    modifie();
  },
  supprimerLeve: (id) => {
    const leve = projet.leves.find((l) => l.id === id);
    const surfacesDuLeve = projet.surfaces.filter((s) => s.leveId === id);
    const mesuresDuLeve = projet.mesures.filter((m) => m.leveId === id);
    const texteMesures = mesuresDuLeve.length > 0 ? ` et ses ${mesuresDuLeve.length} mesure(s)` : '';
    if (!leve || !confirm(`Supprimer le levé « ${leve.nom} », ses ${surfacesDuLeve.length} surface(s)${texteMesures} ?`)) return;
    projet.leves = projet.leves.filter((l) => l.id !== id);
    projet.surfaces = projet.surfaces.filter((s) => s.leveId !== id);
    projet.mesures = projet.mesures.filter((m) => m.leveId !== id);
    projet.metres = projet.metres.filter((m) => m.leveId !== id);
    projet.autres = projet.autres.filter((a) => a.leveId !== id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    editeurSurfaces.charger(projet.surfaces);
    modifie({ recadrer: true });
  },
});

// --- Levé avec le récepteur Emlid (seulement dans l'appli Android) ---
// Sur le terrain, on lève une surface (stock, terrain naturel ou terrassement). Ses points vont
// dans le levé du jour (créé tout seul, comme un fichier importé) et, selon leur rôle, dans la
// surface (voir topo/leve-direct.js) : surfaces, volumes, mesures et exports marchent pareil.

/**
 * Surface levée en cours (dans un levé fait avec le récepteur), ou levé « Autres » en cours (même
 * forme qu'une surface, voir creerAutres), ou null.
 */
function stockEnCours() {
  const surface = projet.surfaces.find((s) => s.id === leveDirect.stockId) ?? projet.autres.find((a) => a.id === leveDirect.stockId);
  const leve = projet.leves.find((l) => l.id === surface?.leveId);
  return surface && estLeveDirect(leve) ? surface : null;
}
/** Métré levé en cours (aires, longueurs, points comptés ; voir topo/metre.js), ou null. */
function metreEnCours() {
  return projet.metres.find((m) => m.id === leveDirect.stockId) ?? null;
}

/** Levé (fait avec le récepteur) de la surface ou du métré en cours, ou null. */
function leveEnCours() {
  const enCours = stockEnCours() ?? metreEnCours();
  return enCours ? projet.leves.find((l) => l.id === enCours.leveId) ?? null : null;
}

/** Surfaces levées avec le récepteur (celles qu'on peut reprendre dans l'onglet Terrain). */
function surfacesLevees() {
  const directs = new Set(projet.leves.filter(estLeveDirect).map((l) => l.id));
  return projet.surfaces.filter((s) => directs.has(s.leveId));
}

/** Affiche la surface en cours sur le plan et dans Calculs › Surfaces (son levé devient le levé affiché). */
function montrerStockEnCours() {
  const index = projet.surfaces.indexOf(stockEnCours());
  if (index >= 0) editeurSurfaces.choisir(index);
}

/** Reprend une surface levée s'il n'y en a pas en cours (celle du levé affiché, sinon la dernière). */
function reprendreLeveDirect() {
  if (stockEnCours() || metreEnCours()) return;
  const levees = surfacesLevees();
  leveDirect.stockId = (levees.filter((s) => s.leveId === projet.leveActifId).at(-1) ?? levees.at(-1))?.id ?? null;
}

/**
 * Nouvelle surface levée (dans le levé du jour) : un stock a tout de suite son calcul de volume.
 * Un métré n'est pas une surface : ses aires, longueurs et points comptés deviennent des mesures.
 */
function ajouterSurfaceLevee(nature) {
  if (nature === 'autres') {
    const leve = leveDuJour(projet);
    const autres = creerAutres(projet, leve);
    projet.leveActifId = leve.id;
    leveDirect.stockId = autres.id;
    leveDirect.role = 'isole';
    modifie({ recadrer: true });
    return;
  }
  if (nature === 'metre') {
    const leve = leveDuJour(projet);
    const metre = creerMetre(projet, leve);
    projet.leveActifId = leve.id;
    leveDirect.stockId = metre.id;
    leveDirect.role = 'aire';
    modifie({ recadrer: true });
    return;
  }
  const surface = creerSurfaceDirecte(projet, leveDuJour(projet), nature);
  projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
  leveDirect.stockId = surface.id;
  // Un stock commence par son contour ; un terrain naturel ou un terrassement par des points isolés.
  leveDirect.role = surface.nature === 'stock' ? 'contour' : 'isole';
  editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
  montrerStockEnCours();
  modifie({ recadrer: true });
}

// Bouton « Récepteur » de la barre du bas (appli Android) : couleur selon l'état, fenêtre pour
// connecter / couper le récepteur et régler les corrections NTRIP (voir leve/recepteur.js).
const boutonRecepteur = recepteurDisponible()
  ? creerBoutonRecepteur(document.querySelector('.onglets'), {
      choisirRecepteur,
      reconnecter: reconnecterRecepteur,
      deconnecter: deconnecterRecepteur,
      // Corrections par internet (swipos) : seulement avec un APK qui sait le faire.
      lireReglagesCorrections: () => (correctionsDisponibles() ? lireReglagesCorrections() : null),
      demarrerCorrections: (reglages) => {
        demarrerCorrections(reglages);
        afficherMessage('Corrections : connexion à swipos…');
      },
      arreterCorrections: () => {
        arreterCorrections();
        afficherMessage('Corrections arrêtées : Emlid Flow peut reprendre');
      },
    })
  : null;

const ecranLeve = recepteurDisponible()
  ? creerEcranLeve(document.querySelector('#leve-direct'), {
      ouvrirRecepteur: () => boutonRecepteur.ouvrir(),
      nouvelleSurface: (nature) => ajouterSurfaceLevee(nature),
      choisirStock: (id) => {
        leveDirect.stockId = id;
        // Métré ou « Autres » : pas une surface ; on affiche les points de son levé.
        const horsSurface = metreEnCours() ?? projet.autres.find((a) => a.id === id);
        if (horsSurface) projet.leveActifId = horsSurface.leveId;
        else montrerStockEnCours();
        recalculer({ recadrer: Boolean(horsSurface) });
      },
      choisirRole: (role) => {
        leveDirect.role = role;
        recalculer();
      },
      nouvelleLigne: () => {
        const metre = metreEnCours();
        if (metre) {
          nouvelElementMetre(projet, metre, leveDirect.role);
          recalculer();
          return;
        }
        const stock = stockEnCours();
        if (!stock) return;
        nouvelleLigne(stock);
        modifie();
      },
      basculerFermeture: () => {
        const stock = stockEnCours();
        if (!stock) return;
        basculerFermeture(stock);
        modifie();
      },
      prendrePoint: (nom) => {
        const leve = leveEnCours();
        const stock = stockEnCours();
        const metre = metreEnCours();
        if (!leve || !(stock || metre)) return;
        // Position vérifiée par l'appli Android au moment du toucher : RTK fixe et inclinaison prête.
        const reponse = prendrePointRecepteur();
        if (!reponse.ok) {
          afficherMessage(`Point refusé : ${reponse.raison}`, 4000);
          return;
        }
        const { est, nord, altitude, ...gnss } = reponse.point;
        const point = { est, nord, altitude, gnss: { ...gnss, prisLe: new Date().toISOString() } };
        const resultat = metre
          ? ajouterPointMetre(projet, leve, metre, leveDirect.role, libelleDuRole(), { ...point, nom: nom.trim() || prochainNomMetre(projet, metre, leveDirect.role, libelleDuRole()) })
          : ajouterPointDirect(leve, stock, leveDirect.role, { ...point, nom: nom.trim() || prochainNom(projet, stock, leveDirect.role, libelleDuRole()) }, nomsDuProjet(projet));
        if (resultat.erreur) {
          afficherMessage(`Point refusé : ${resultat.erreur}`, 4000);
          return;
        }
        navigator.vibrate?.(60);
        sonValidation();
        afficherMessage(`Point ${resultat.point.nom} pris`);
        modifie();
      },
      choisirLibelle: (abreviation) => {
        if (leveDirect.role === 'aire') terrain.libelleAire = abreviation;
        else if (['ligne', 'longueur'].includes(leveDirect.role)) terrain.libelleLigne = abreviation;
        else terrain.libellePoint = abreviation;
        retenirReglagesTerrain();
        recalculer();
      },
      enregistrerLibelles: (nouveaux) => {
        if (nouveaux.lignes.length === 0 || nouveaux.points.length === 0 || nouveaux.aires.length === 0) {
          alert('Il faut au moins un libellé pour les lignes, un pour les points et un pour les aires.');
          recalculer();
          return;
        }
        libelles = nouveaux;
        enregistrerLibelles(libelles);
        afficherMessage('Libellés enregistrés');
        recalculer();
      },
      choisirMode: (mode) => {
        terrain.mode = ['controler', 'autocontrole'].includes(mode) ? mode : 'lever';
        retenirReglagesTerrain();
        if (terrain.mode === 'controler') montrerSurfaceControle();
        recalculer();
      },
      choisirImplantation: (quoi) => {
        const permises = estModeBase() ? ['point', 'ligne'] : ['point', 'ligne', 'talus'];
        terrain.implantation = permises.includes(quoi) ? quoi : 'surface';
        retenirReglagesTerrain();
        recalculer();
      },
      // --- Implantation d'une ligne ---
      retirerDernierPointLigne: () => {
        implanter.pointsLigne.pop();
        montrerImplantation();
      },
      implanterPointsLigne: () => {
        const points = implanter.pointsLigne;
        if (points.length < 2) return;
        const nom = (p, i) => p.nom ?? `P${i + 1}`;
        implanter.ligne = nouvelleLigneAImplanter(`${nom(points[0], 0)} → ${nom(points.at(-1), points.length - 1)}`, points, null);
        implanter.talusId = null;
        implanter.pointsLigne = [];
        montrerImplantation();
      },
      changerLigne: () => {
        implanter.ligne = null;
        implanter.talusId = null;
        montrerImplantation();
      },
      choisirSegment: (choix) => {
        const ligne = implanter.ligne;
        if (!ligne) return;
        const nombre = ligne.sommets.length - 1;
        if (choix === 'tout') ligne.segment = null;
        else if (choix === 'segment') ligne.segment = ligne.segmentTouche ?? 0;
        else if (ligne.segment != null) ligne.segment = Math.max(0, Math.min(nombre - 1, ligne.segment + (choix === 'suivant' ? 1 : -1)));
        garderTalusOuvert();
        montrerImplantation();
      },
      inverserLigne: () => {
        if (!implanter.ligne) return;
        implanter.ligne.inverse = !implanter.ligne.inverse;
        garderTalusOuvert();
        montrerImplantation();
      },
      // Décalage parallèle et altitudes tapées (début, fin) : des nombres, ou vide.
      reglerLigne: (champ, texte) => {
        const ligne = implanter.ligne;
        if (!ligne) return;
        const lue = lireAltitude(texte);
        if (lue === undefined) return;
        if (champ === 'decalage') ligne.decalage = lue ?? 0;
        else ligne.altitudes[champ] = lue;
        garderTalusOuvert();
        montrerImplantation();
      },
      // --- Implantation d'un talus (réglages : voir topo/talus.js) ---
      // Champs tapés (pente H, V, longueur : des nombres, ou vide) et choix (haut / bas, côté, surfaces).
      reglerTalus: (champ, valeur) => {
        const reglages = terrain.talus;
        if (['horizontal', 'vertical', 'longueur'].includes(champ)) {
          const lue = lireNombrePositif(valeur, champ === 'longueur' ? 'Longueur' : 'Pente');
          if (lue === undefined) {
            montrerImplantation();
            return;
          }
          reglages[champ] = lue;
        } else if (champ === 'ligneEst') reglages.ligneEst = valeur === 'bas' ? 'bas' : 'haut';
        else if (champ === 'cote') reglages.cote = valeur === 'gauche' ? 'gauche' : 'droite';
        else if (champ === 'terrainId' || champ === 'altitudeSurfaceId') reglages[champ] = valeur || null;
        else return;
        retenirReglagesTerrain();
        garderTalusOuvert();
        montrerImplantation();
      },
      // « Mes talus » : garder le talus en cours (ligne et réglages) dans le projet, sous un nom.
      enregistrerTalus: () => {
        if (!implanter.ligne) return;
        const propose = `Talus ${projet.talus.length + 1}`;
        const nom = prompt('Nom du talus', propose);
        if (nom == null) return;
        const talus = { id: nouvelIdentifiant(), nom: nom.trim() || propose, ...copieDuTalus() };
        projet.talus.push(talus);
        implanter.talusId = talus.id;
        afficherMessage(`${talus.nom} gardé dans « Mes talus »`, 2500);
        modifie();
      },
      ouvrirTalus: (id) => {
        const talus = projet.talus.find((t) => t.id === id);
        if (!talus) return;
        const { nom, sommets, segment, inverse, altitudes } = talus.ligne;
        implanter.ligne = { ...nouvelleLigneAImplanter(nom, sommets.map((p) => ({ ...p })), null), segment, inverse, altitudes: { ...altitudes } };
        implanter.pointsLigne = [];
        implanter.talusId = talus.id;
        terrain.talus = { ...terrain.talus, ...talus.reglages };
        retenirReglagesTerrain();
        montrerImplantation();
      },
      supprimerTalus: (id) => {
        const talus = projet.talus.find((t) => t.id === id);
        if (!talus || !confirm(`Enlever ${talus.nom} de « Mes talus » ?`)) return;
        projet.talus = projet.talus.filter((t) => t.id !== id);
        if (implanter.talusId === id) implanter.talusId = null;
        modifie();
      },
      choisirAccroche: (mode) => {
        if (enImplantationDeLigne()) {
          terrain.accrocheLigne = mode === 'trait' || MODES_ACCROCHE.includes(mode) ? mode : 'trait';
          retenirReglagesTerrain();
          montrerImplantation();
          return;
        }
        terrain.accroche = MODES_ACCROCHE.includes(mode) ? mode : 'point';
        retenirReglagesTerrain();
        montrerImplantation();
      },
      choisirGuidage: (mode) => {
        terrain.guidage = mode === 'nseo' ? 'nseo' : 'rx2';
        retenirReglagesTerrain();
        montrerImplantation();
      },
      // Fenêtre « Liste » de la barre d'accroche : les points du projet, liste par liste.
      groupesPoints: () => groupesDePointsParListe(),
      // Nom d'un point du projet tapé (ou choisi dans la liste) : il devient le point choisi.
      trouverPoint: (nom) => {
        const cherche = nom.trim();
        if (!cherche) return;
        const trouve = pointsDuProjet().find((p) => p.nom === cherche) ?? pointsDuProjet().find((p) => p.nom.toLowerCase() === cherche.toLowerCase());
        if (!trouve) {
          afficherMessage(`Aucun point « ${cherche} » dans le projet`, 3000);
          return;
        }
        const choisi = { est: trouve.est, nord: trouve.nord, altitude: trouve.altitude ?? null, nom: trouve.nom, mode: 'point' };
        // Ligne : le point s'ajoute à la ligne en préparation (début, fin, puis les suivants).
        if (enImplantationDeLigne()) ajouterPointLigne(choisi);
        else implanter.choix = choisi;
        montrerImplantation();
      },
      oublierChoix: () => {
        implanter.choix = null;
        montrerImplantation();
      },
      implanterChoix: ({ nom, altitude }) => {
        const lue = lireAltitude(altitude);
        if (!implanter.choix || lue === undefined) return;
        const { est, nord } = implanter.choix;
        implanter.cible = { id: null, nom: nom.trim() || nomProposeImplantation(), est, nord, altitude: lue };
        implanter.choix = null;
        montrerImplantation();
      },
      creerPointAImplanter: ({ nom, altitude }) => {
        const lue = lireAltitude(altitude);
        if (!implanter.choix || lue === undefined) return;
        const choisi = nom.trim() || nomProposeImplantation();
        if (projet.aImplanter.some((p) => p.nom === choisi)) {
          alert(`Le point ${choisi} est déjà dans la liste « À implanter » : choisis un autre nom.`);
          return;
        }
        projet.aImplanter.push({ id: nouvelIdentifiant(), nom: choisi, est: implanter.choix.est, nord: implanter.choix.nord, altitude: lue });
        implanter.choix = null;
        afficherMessage(`${choisi} ajouté à la liste « À implanter »`);
        modifie();
      },
      implanterPoint: (id) => {
        const point = projet.aImplanter.find((p) => p.id === id);
        if (!point) return;
        implanter.cible = { ...point };
        implanter.choix = null;
        montrerImplantation();
      },
      supprimerPointAImplanter: (id) => {
        const point = projet.aImplanter.find((p) => p.id === id);
        if (!point || !confirm(`Enlever ${point.nom} de la liste « À implanter » ?`)) return;
        projet.aImplanter = projet.aImplanter.filter((p) => p.id !== id);
        if (implanter.cible?.id === id) implanter.cible = null;
        modifie();
      },
      // Point tapé (Terrain › Implanter › + Point) : ajouté au projet, puis choisi pour l'implanter.
      ajouterPointTape: (valeurs) => {
        const { point, erreur } = ajouterPointAjoute(projet, { ...valeurs, source: 'tape' });
        if (erreur) return { erreur };
        implanter.choix = { ...point };
        afficherMessage(`Point ${point.nom} ajouté`, 2500);
        modifie();
        return null;
      },
      // Point accroché sur le DXF : gardé dans le projet (levé « Points ajoutés »).
      garderPointChoisi: (nom) => {
        if (!implanter.choix) return;
        const { est, nord, altitude } = implanter.choix;
        const { point, erreur } = ajouterPointAjoute(projet, { nom: nom.trim() || nomPointAjoute(projet), est, nord, altitude, source: 'dxf' });
        if (erreur) {
          alert(`Point non ajouté : ${erreur}.`);
          return;
        }
        implanter.choix = { ...implanter.choix, nom: point.nom };
        afficherMessage(`Point ${point.nom} ajouté au projet`, 2500);
        modifie();
      },
      arreterImplantation: () => {
        implanter.cible = null;
        montrerImplantation();
      },
      // Point suivant (P1 → P2…, voir nomSuivant) : implanté tout de suite.
      implanterSuivant: () => {
        const nom = nomSuivant(implanter.cible?.nom, pointsDuProjet().map((p) => p.nom));
        const point = pointsDuProjet().find((p) => p.nom === nom);
        if (!point) return;
        const dansLaListe = projet.aImplanter.find((p) => p.nom === nom);
        implanter.cible = { id: dansLaListe?.id ?? null, nom, est: point.est, nord: point.nord, altitude: point.altitude ?? null };
        implanter.choix = null;
        montrerImplantation();
        requestAnimationFrame(cadrerSurImplantation);
      },
      enregistrerImplantation: () => {
        if (enAutocontrole()) {
          enregistrerControle();
          return;
        }
        if (enTalus()) {
          enregistrerImplantationTalus();
          return;
        }
        if (enImplantationDeLigne()) {
          enregistrerImplantationLigne();
          return;
        }
        const cible = implanter.cible;
        if (!cible) return;
        // Position vérifiée par l'appli Android : RTK fixe et inclinaison prête, comme pour un point levé.
        const reponse = prendrePointRecepteur();
        if (!reponse.ok) {
          afficherMessage(`Implantation refusée : ${reponse.raison}`, 4000);
          return;
        }
        const { est, nord, altitude, ...gnss } = reponse.point;
        const mesure = { est, nord, altitude, gnss };
        const ecarts = ecartsImplantation(cible, mesure);
        const le = new Date().toISOString();
        projet.implantations.push({ id: nouvelIdentifiant(), nom: cible.nom, aImplanterId: cible.id, cible: { est: cible.est, nord: cible.nord, altitude: cible.altitude }, mesure, ecarts, le });
        navigator.vibrate?.(60);
        sonValidation();
        const hauteur = ecarts.dAltitude != null ? ` · dH ${formaterNombre(ecarts.dAltitude)} m` : '';
        afficherMessage(`${cible.nom} implanté : écart ${formaterNombre(ecarts.distance)} m${hauteur}`, 4000);
        modifie();
      },
      exporterImplantations: () => {
        telecharger(new Blob(['\ufeff' + csvImplantations(projet.implantations)], { type: 'text/csv;charset=utf-8' }), `${nomDeFichierProjet(projet)}_implantations.csv`);
      },
      // --- Mode Contrôler (autocontrôle sur les points de contrôle du projet) ---
      controlerPoint: (id) => {
        const point = projet.pointsControle.find((p) => p.id === id);
        if (!point) return;
        autocontrole.cible = { ...point };
        montrerImplantation();
        requestAnimationFrame(cadrerSurImplantation);
      },
      arreterControle: () => {
        autocontrole.cible = null;
        montrerImplantation();
      },
      remarqueControle: (id, texte) => {
        const controle = projet.controles.find((c) => c.id === id);
        if (!controle) return;
        controle.remarque = texte.trim();
        modifie();
      },
      exporterControles: (format) => {
        const nom = `${nomDeFichierProjet(projet)}_controles`;
        if (format === 'pdf') telecharger(pdfControles(projet), `${nom}.pdf`);
        else telecharger(new Blob(['\ufeff' + csvControles(projet.controles)], { type: 'text/csv;charset=utf-8' }), `${nom}.csv`);
      },
      enregistrerTolerances: (textes) => {
        const { tolerances, erreur } = lireTolerances(textes);
        if (erreur) return { erreur };
        projet.tolerancesControle = tolerances;
        afficherMessage('Tolérances enregistrées');
        modifie();
        return null;
      },
      ajouterPointControle: (nom) => {
        const point = pointsDuProjet().find((p) => p.nom === nom);
        if (!point) return { erreur: `point ${nom} introuvable` };
        return ajouterAuxPointsControle([point]);
      },
      ajouterPointControleTape: (valeurs) => {
        if (!valeurs.nom) return { erreur: 'donne un nom au point' };
        return ajouterAuxPointsControle([valeurs]);
      },
      importerPointsControle: (fichier) => importerPointsControle(fichier),
      supprimerPointControle: (id) => {
        const point = projet.pointsControle.find((p) => p.id === id);
        if (!point || !confirm(`Enlever ${point.nom} des points de contrôle ?`)) return;
        projet.pointsControle = projet.pointsControle.filter((p) => p.id !== id);
        if (autocontrole.cible?.id === id) autocontrole.cible = null;
        modifie();
      },
      choisirSurfaceControle: (id) => {
        terrain.surfaceId = id || null;
        retenirReglagesTerrain();
        montrerSurfaceControle();
        recalculer();
      },
      choisirVueCoupes: (vue) => {
        terrain.vueCoupes = ['les2', 'perpendiculaire', 'axe'].includes(vue) ? vue : 'les2';
        retenirReglagesTerrain();
        recalculer();
      },
      choisirLongueurCoupe: (metres) => {
        terrain.demiLongueur = LONGUEURS_COUPE.includes(Number(metres)) ? Number(metres) : 5;
        retenirReglagesTerrain();
        recalculer();
      },
      choisirExagerationCoupe: (facteur) => {
        terrain.exagerationCoupe = Number(facteur) === 2 ? 2 : 1;
        retenirReglagesTerrain();
        recalculer();
      },
      choisirSourceOrientation: (source) => {
        terrain.sourceOrientation = source === 'marche' ? 'marche' : 'rx2';
        suiviOrientation.changerSource(terrain.sourceOrientation);
        retenirReglagesTerrain();
        recalculer();
      },
      annulerDernierPoint: () => {
        const leve = leveEnCours();
        const dernier = leve?.points[leve.points.length - 1];
        if (!dernier || !confirm(`Effacer le dernier point (${dernier.nom}) ?`)) return;
        annulerDernierPoint(leve, [...projet.surfaces, ...projet.autres]);
        retirerPointDesMesures(projet, dernier.nom); // aire, longueur ou point compté d'un métré
        afficherMessage(`Point ${dernier.nom} effacé`);
        modifie();
      },
    })
  : null;

/** Date d'un levé fait avec le récepteur, à la suisse (« 22.10.2026 »). */
function jourDuLeve(leveId) {
  const leve = projet.leves.find((l) => l.id === leveId);
  return (leve?.jour ?? leve?.importeLe?.slice(0, 10) ?? '').split('-').reverse().join('.');
}

/** Remblai (m³) du stock levé, ou null s'il n'est pas encore calculable. */
function volumeDuStock(stock) {
  const calcul = calculDuPlan(stock);
  const resultat = calcul ? resultatsCalculs.get(calcul.id) : null;
  return resultat && !resultat.erreurs ? resultat.remblai : null;
}

/**
 * Altitude tapée pour un point à implanter : un nombre (m), ou null si le champ est vide.
 * Renvoie undefined (et prévient) si elle est illisible.
 */
function lireAltitude(texte) {
  const nettoye = String(texte ?? '').trim().replace(',', '.');
  if (!nettoye) return null;
  const altitude = Number(nettoye);
  if (Number.isFinite(altitude)) return altitude;
  alert(`Altitude « ${texte} » illisible : écris un nombre, par exemple 412.350, ou laisse vide.`);
  return undefined;
}

/** Nom proposé pour le point choisi : le sien (point levé, point à implanter), sinon I-1, I-2… */
function nomProposeImplantation() {
  return implanter.choix?.nom ?? nomPointAImplanter([...projet.aImplanter, ...projet.implantations]);
}

/**
 * Implantation d'un point : toucher le plan accroche un point (seulement depuis l'onglet Terrain).
 * Les points « À implanter » restent visibles sur le plan dans les autres onglets.
 */
function envoyerImplantationAuPlan() {
  const accrocheActive = ((enImplantationDePoint() || enImplantationDeLigne()) && ongletContexte === 'terrain') || pointage.actif || Boolean(recalage.planId);
  const enLigne = accrocheActive && !pointage.actif && enImplantationDeLigne();
  const sommets = enLigne && implanter.ligne ? sommetsDeLaLigne() : null;
  // Lignes des levés « Autres » cochés dans le menu « Points » (ce ne sont pas des surfaces).
  const lignesAutres = lignesDesAutres();
  // Points de contrôle : dessinés si leur case « Points de contrôle » est cochée (menu Afficher).
  const pointsControle = (projet.listesCachees ?? []).includes(LISTE_CONTROLE) ? [] : projet.pointsControle;
  // Mode Contrôler : le point de contrôle vers lequel on guide est la cible du plan.
  const cibleControle = enAutocontrole() && ongletContexte === 'terrain' ? autocontrole.cible : null;
  // Dessins (Calculs › Dessin) : toujours sur le plan ; le dessin en cours avec son pilote.
  const avecPilote = piloteActif();
  plan.afficherImplantation(accrocheActive || avecPilote || projet.aImplanter.length > 0 || lignesAutres.length > 0 || pointsControle.length > 0 || cibleControle || projet.dessins.length > 0
    ? {
        actif: accrocheActive || avecPilote,
        dessins: projet.dessins,
        actifId: avecPilote ? pilote.dessinId : null,
        pilote: avecPilote ? { direction: pilote.direction, distance: lireNombreTape(pilote.distance) ?? null } : null,
        aImplanter: projet.aImplanter,
        pointsControle,
        lignesAutres,
        choix: recalage.planId ? (recalage.choix ? { est: recalage.choix.x, nord: recalage.choix.y } : null) : pointage.actif ? pointage.choix : accrocheActive && !enLigne ? implanter.choix : null,
        cible: cibleControle ?? (accrocheActive && !enLigne ? implanter.cible : null),
        // Ligne : la ligne choisie (début, fin), sa parallèle s'il y a un décalage, les points en préparation.
        ligne: sommets ? { sommets, parallele: implanter.ligne.decalage && !enTalus() ? ligneParallele(sommets, implanter.ligne.decalage) : null, talus: enTalus() ? { zone: zoneDuTalus(), cote: terrain.talus.cote, ligneEst: terrain.talus.ligneEst } : null } : null,
        pointsLigne: enLigne ? implanter.pointsLigne : [],
      }
    : null);
}

/** Lignes des levés « Autres » visibles : [{ sommets: [{ est, nord }], fermee }]. */
function lignesDesAutres() {
  const cachees = new Set(projet.listesCachees ?? []);
  const lignes = [];
  for (const autres of projet.autres) {
    if (cachees.has(autres.id)) continue;
    const parNom = new Map((projet.leves.find((l) => l.id === autres.leveId)?.points ?? []).map((p) => [p.nom, p]));
    for (const ligne of autres.lignesRupture) {
      const sommets = ligne.noms.map((nom) => parNom.get(nom)).filter(Boolean);
      if (sommets.length >= 2) lignes.push({ sommets, fermee: Boolean(ligne.fermee) });
    }
  }
  return lignes;
}

/**
 * Point choisi ou point à implanter changé (rien d'autre dans le projet) : on met à jour l'écran
 * Terrain et l'implantation sur le plan, sans tout recalculer ni redessiner (plus rapide).
 */
function montrerImplantation() {
  // Écran de guidage (classe vue-implantation, mise par l'écran Terrain) avant et après.
  const avant = document.body.classList.contains('vue-implantation');
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
  ecranLeve?.afficher(donneesLeve());
  mettreAJourToucheVolume();
  // Début du guidage : le plan (devenu plus grand) se cadre sur le point ou la ligne et la canne.
  if (!avant && document.body.classList.contains('vue-implantation')) requestAnimationFrame(() => requestAnimationFrame(cadrerSurImplantation));
}

/** Cadre le plan sur ce qu'on implante (point ou ligne) et la position du récepteur. */
function cadrerSurImplantation() {
  let coins = implanter.ligne && ['ligne', 'talus'].includes(terrain.implantation) ? [...implanter.ligne.sommets] : implanter.cible ? [implanter.cible] : [];
  if (enAutocontrole()) coins = autocontrole.cible ? [autocontrole.cible] : [];
  const position = etatRecepteur?.connecte && etatRecepteur.recu ? etatRecepteur.position : null;
  // La canne aussi, si elle est assez près (sinon le point serait tout petit à l'écran).
  if (position && coins.length > 0 && Math.hypot(position.est - coins[0].est, position.nord - coins[0].nord) < 300) coins.push(position);
  plan.cadrerSur(coins, 10);
}

/**
 * Implantation d'une ligne : cotes dessinées sur le plan (voir plan.js, dessinerCotesLigne) :
 * la ligne implantée (ou sa parallèle), la position le long (abscisse depuis le début, reste
 * jusqu'à la fin) et l'écart de la canne ; ou null.
 */
function cotesLigne(implantationLigne) {
  const l = implantationLigne?.ligne;
  if (!l || implantationLigne.message || !implanter.ligne) return null;
  const sommets = sommetsDeLaLigne();
  const trace = implanter.ligne.decalage ? ligneParallele(sommets, implanter.ligne.decalage) : sommets;
  return { sommets: trace, abscisse: l.abscisse, longueur: l.longueur, ecart: l.ecart };
}

/**
 * Talus : mêmes cotes que pour une ligne (position le long de la ligne), et sur le trait canne →
 * entrée en terre, la distance qui reste à faire ; ou null.
 */
function cotesTalus(implantationTalus) {
  const g = implantationTalus?.talus;
  if (!g || implantationTalus.message || !implanter.ligne) return null;
  return { sommets: sommetsDeLaLigne(), abscisse: g.abscisse, longueur: g.longueur, ecart: g.ecartDistance };
}

/** Mesures dessinées sur le plan hors de l'onglet des mesures : [{ mesure, resultat }]. */
function mesuresDuPlan(listes) {
  if (ongletContexte === 'terrain' && terrain.mode === 'controler') return [];
  const choisies = new Set(mesuresVisibles(projet, listes));
  const enCours = ongletContexte === 'terrain' && terrain.mode === 'lever' ? metreEnCours() : null;
  if (enCours) for (const m of projet.mesures) if (m.metreId === enCours.id) choisies.add(m);
  return [...choisies].map((mesure) => ({ mesure, resultat: resultatsMesures.get(mesure.id) }));
}

/** Vrai pendant l'implantation d'un point (Terrain › Implanter › Point). */
function enImplantationDePoint() {
  return Boolean(ecranLeve) && terrain.mode === 'controler' && terrain.implantation === 'point';
}

/**
 * Vrai pendant l'implantation d'une ligne (Terrain › Implanter › Ligne), ou d'un talus (on choisit
 * sa ligne de la même façon).
 */
function enImplantationDeLigne() {
  return Boolean(ecranLeve) && terrain.mode === 'controler' && ['ligne', 'talus'].includes(terrain.implantation);
}

// --- Calculs › Dessin (outil « pilote », voir dessin/ecran.js et topo/dessin.js) ---

/** Vrai pendant un dessin avec le pilote (dans Calculs › Dessin, plan compris). */
function piloteActif() {
  return Boolean(pilote) && ongletContexte === 'dessin' && projet.dessins.some((d) => d.id === pilote.dessinId);
}

/** Dessin du projet par son identifiant. */
const dessinDe = (id) => projet.dessins.find((d) => d.id === id);

/** Pilote pour dessiner "dessin" : toucher le plan pose un sommet au début, puis donne la direction. */
function nouveauPilote(dessin) {
  return { dessinId: dessin.id, toucher: dessin.sommets.length > 0 && dessin.type !== 'points' ? 'direction' : 'sommet', direction: null, distance: '', reference: null };
}

const auMillimetre = (valeur) => (valeur == null ? null : Math.round(valeur * 1000) / 1000);

/** Ajoute un sommet au dessin en cours ({ est, nord, altitude }) ; après le départ, toucher = direction. */
function ajouterSommetDessin(point) {
  const dessin = dessinDe(pilote?.dessinId);
  if (!dessin) return;
  dessin.sommets.push({ est: auMillimetre(point.est), nord: auMillimetre(point.nord), altitude: auMillimetre(point.altitude ?? null) });
  if (dessin.sommets.length === 1 && dessin.type !== 'points') pilote.toucher = 'direction';
  modifie();
}

/**
 * Toucher le plan pendant un dessin : on s'accroche à un point du projet, à un sommet d'un dessin,
 * ou à un sommet du plan DXF (sinon l'endroit touché) ; puis sommet ou direction selon le pilote.
 */
function toucherPourDessin(position, tolerance) {
  const dessin = dessinDe(pilote.dessinId);
  const pointsProches = [...pointsDuProjet(), ...projet.dessins.flatMap((d) => d.sommets.map((s, i) => ({ ...s, nom: `${d.nom} · ${i + 1}` })))];
  const trouve = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsProches })
    ?? accrocher('sommet', position, tolerance, sourcesDesPlans(plansDuProjet(), position, tolerance));
  const point = trouve ?? { ...position, altitude: null };
  if (pilote.toucher === 'direction' && dessin.sommets.length > 0) {
    const gon = gisement(dessin.sommets.at(-1), point);
    if (gon == null) return;
    pilote.direction = gon;
    pilote.reference = trouve?.nom ?? null;
    recalculer();
    return;
  }
  ajouterSommetDessin(point);
}

/**
 * Direction ou distance tapée : seul le plan est mis à jour (pointillés du pilote), pas l'écran,
 * pour ne pas perdre la case où l'on tape.
 */
function montrerPilote() {
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/** Données de l'écran Calculs › Dessin : les dessins (côtés, aire, altitudes) et le pilote. */
function donneesDessin() {
  return {
    dessins: projet.dessins.map((d) => {
      const ferme = estFerme(d) && d.sommets.length >= 3;
      return { ...d, perimetre: longueursCotes(d.sommets, ferme).reduce((somme, l) => somme + l, 0), aire: ferme ? airePolygone(d.sommets) : 0, altitudes: altitudesDuDessin(d) };
    }),
    pilote,
    recepteur: recepteurDisponible(),
  };
}

const ecranDessin = creerEcranDessin(document.querySelector('#dessins'), {
  nouveauDessin: (type) => {
    const dessin = { id: nouvelIdentifiant(), nom: nomDessin(type, projet.dessins), type, sommets: [], hauteur: { mode: 'fixe', altitude: null, pente: null } };
    projet.dessins.push(dessin);
    pilote = nouveauPilote(dessin);
    modifie();
  },
  dessiner: (id) => {
    const dessin = dessinDe(id);
    if (!dessin) return;
    pilote = nouveauPilote(dessin);
    recalculer();
  },
  terminerDessin: () => {
    pilote = null;
    recalculer();
  },
  supprimerDessin: (id) => {
    const dessin = dessinDe(id);
    if (!dessin || !confirm(`Supprimer « ${dessin.nom} » ?`)) return;
    projet.dessins = projet.dessins.filter((d) => d.id !== id);
    if (pilote?.dessinId === id) pilote = null;
    modifie();
  },
  renommerDessin: (id, nom) => {
    const dessin = dessinDe(id);
    if (!dessin || !nom) return;
    dessin.nom = nom;
    modifie();
  },
  choisirToucher: (mode) => {
    if (!pilote) return;
    pilote.toucher = mode === 'direction' ? 'direction' : 'sommet';
    recalculer();
  },
  reglerDirection: (texte) => {
    if (!pilote) return;
    const valeur = lireNombreTape(texte);
    if (valeur === undefined) {
      afficherMessage('Direction illisible : un nombre en gon (0 = Nord, 100 = Est)', 4000);
      return;
    }
    if (valeur == null) return;
    const gon = gisementNormal(valeur);
    // Même valeur (arrondie à l'écran) : on garde la direction exacte et le point visé.
    if (pilote.direction != null && Math.abs(gon - pilote.direction) < 0.00005) return;
    pilote.direction = gon;
    pilote.reference = null;
    montrerPilote();
  },
  tournerDirection: (sens) => {
    if (pilote?.direction == null) return;
    pilote.direction = gisementNormal(pilote.direction + (sens === 'droite' ? 100 : -100));
    pilote.reference = null;
    recalculer();
  },
  reglerDistance: (texte) => {
    if (!pilote || pilote.distance === texte.trim()) return;
    pilote.distance = texte.trim();
    montrerPilote();
  },
  ajouterSommetPilote: () => {
    const dessin = dessinDe(pilote?.dessinId);
    const distance = lireNombreTape(pilote?.distance);
    if (!dessin || dessin.sommets.length === 0) return;
    if (pilote.direction == null) {
      afficherMessage('Donne d\'abord la direction : touche le plan, ou tape un gisement en gon', 4000);
      return;
    }
    if (!(distance > 0)) {
      afficherMessage('Distance illisible : un nombre de mètres plus grand que 0', 4000);
      return;
    }
    ajouterSommetDessin({ ...pointSelonGisement(dessin.sommets.at(-1), pilote.direction, distance), altitude: null });
  },
  ouvrirSommetTape: () => {
    ouvrirFenetrePointTape({
      nomPropose: 'facultatif',
      ajouter: ({ est, nord, altitude }) => {
        ajouterSommetDessin({ est, nord, altitude });
        return null;
      },
    });
  },
  sommetRx2: () => {
    const reponse = prendrePointRecepteur();
    if (!reponse.ok) {
      afficherMessage(`Point refusé : ${reponse.raison}`, 4000);
      return;
    }
    sonValidation();
    ajouterSommetDessin(reponse.point);
  },
  directionRx2: () => {
    const dessin = dessinDe(pilote?.dessinId);
    const reponse = prendrePointRecepteur();
    if (!reponse.ok) {
      afficherMessage(`Point refusé : ${reponse.raison}`, 4000);
      return;
    }
    const gon = dessin?.sommets.length ? gisement(dessin.sommets.at(-1), reponse.point) : null;
    if (gon == null) {
      afficherMessage('Le RX2 est sur le dernier sommet : éloigne-toi dans la direction voulue', 4000);
      return;
    }
    sonValidation();
    pilote.direction = gon;
    pilote.reference = 'RX2';
    recalculer();
  },
  rectangleDessin: ({ longueur, largeur, cote }) => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin || dessin.sommets.length !== 1 || pilote.direction == null) return;
    const a = dessin.sommets[0];
    const { sommets, erreur } = rectangle(a, pointSelonGisement(a, pilote.direction, 1), lireNombreTape(longueur), lireNombreTape(largeur), cote);
    if (erreur) {
      afficherMessage(`Rectangle : ${erreur}`, 4000);
      return;
    }
    dessin.sommets = sommets.map((s, i) => (i === 0 ? a : { est: auMillimetre(s.est), nord: auMillimetre(s.nord), altitude: null }));
    modifie();
  },
  annulerSommet: () => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin?.sommets.length) return;
    dessin.sommets.pop();
    if (dessin.sommets.length === 0) pilote.toucher = 'sommet';
    modifie();
  },
  choisirModeHauteur: (valeur) => {
    const [id, mode] = valeur.split(':');
    const dessin = dessinDe(id);
    if (!dessin) return;
    dessin.hauteur.mode = mode === 'sommets' ? 'sommets' : 'fixe';
    modifie();
  },
  reglerHauteur: (id, champ, texte) => {
    const dessin = dessinDe(id);
    if (!dessin) return;
    const h = dessin.hauteur;
    if (champ === 'cote' || champ === 'depuis') {
      h.pente = { pourcent: h.pente?.pourcent ?? 0, cote: h.pente?.cote ?? 0, depuis: h.pente?.depuis ?? 0, [champ]: Number(texte) };
      modifie();
      return;
    }
    const valeur = lireNombreTape(texte);
    if (valeur === undefined) {
      afficherMessage(`${champ === 'altitude' ? 'Altitude' : 'Pente'} illisible : écris un nombre, ou laisse vide`, 4000);
      return;
    }
    if (champ === 'altitude') h.altitude = valeur;
    else h.pente = valeur ? { cote: h.pente?.cote ?? 0, depuis: h.pente?.depuis ?? 0, pourcent: valeur } : null;
    modifie();
  },
  altitudeSommet: (id, numero, texte) => {
    const sommet = dessinDe(id)?.sommets[numero];
    const valeur = lireNombreTape(texte);
    if (!sommet) return;
    if (valeur === undefined) {
      afficherMessage(`Altitude du sommet ${numero + 1} illisible : écris un nombre, ou laisse vide`, 4000);
      return;
    }
    sommet.altitude = valeur;
    modifie();
  },
});

/** Vrai pendant l'autocontrôle (Terrain › Contrôle). */
function enAutocontrole() {
  return Boolean(ecranLeve) && terrain.mode === 'autocontrole';
}

/**
 * Ajoute des points à la liste des points de contrôle (sans nom en double) : message, puis
 * { erreur } si certains n'ont pas été ajoutés, sinon null.
 */
function ajouterAuxPointsControle(points) {
  const { ajoutes, deja, sansNom } = ajouterPointsControle(projet.pointsControle, points, nouvelIdentifiant);
  if (ajoutes > 0) {
    afficherMessage(`${ajoutes} point(s) de contrôle ajouté(s)`);
    modifie();
  }
  const refus = [deja.length > 0 ? `déjà dans la liste : ${deja.slice(0, 5).join(', ')}${deja.length > 5 ? '…' : ''}` : '', sansNom > 0 ? `${sansNom} point(s) sans nom` : ''].filter(Boolean);
  return refus.length > 0 ? { erreur: `Pas ajouté(s) : ${refus.join(' ; ')}` } : null;
}

/**
 * Fichier de points (CSV, TXT) ajouté aux points de contrôle (Projet › Import › « Points de contrôle »,
 * ou Terrain › Contrôle › ⚙). Renvoie { erreur } ou null.
 */
async function importerPointsControle(fichier) {
  try {
    const { points, erreurs } = lirePoints(await fichier.text());
    const reponse = ajouterAuxPointsControle(points);
    if (erreurs.length > 0) return { erreur: `${erreurs.length} ligne(s) illisible(s), non importée(s) : ${erreurs.slice(0, 5).map((e) => `ligne ${e.ligne}`).join(', ')}${erreurs.length > 5 ? '…' : ''}` };
    return reponse;
  } catch (erreur) {
    return { erreur: `impossible de lire « ${fichier.name} » : ${erreur.message}` };
  }
}

/** Nom de cet appareil (partage Drive), noté dans chaque contrôle ; '' s'il n'est pas donné. */
function nomDeLAppareil() {
  return partage?.appareil()?.nom ?? '';
}

/**
 * « Enregistrer le contrôle » : position vérifiée par l'appli Android (RTK fixe, inclinaison prête),
 * écarts avec le point connu, couleur selon les tolérances du projet ; puis retour à la liste.
 */
function enregistrerControle() {
  const point = autocontrole.cible;
  if (!point) return;
  const reponse = prendrePointRecepteur();
  if (!reponse.ok) {
    afficherMessage(`Contrôle refusé : ${reponse.raison}`, 4000);
    return;
  }
  const { est, nord, altitude, ...gnss } = reponse.point;
  const mesure = { est, nord, altitude };
  const ecarts = ecartsControle(point, mesure);
  const resultat = resultatControle(ecarts, projet.tolerancesControle);
  projet.controles.push({
    id: nouvelIdentifiant(),
    type: 'mesure',
    pointId: point.id,
    nom: point.nom,
    connu: { est: point.est, nord: point.nord, altitude: point.altitude ?? null },
    mesure,
    ecarts,
    resultat,
    gnss,
    appareil: nomDeLAppareil(),
    remarque: '',
    le: new Date().toISOString(),
  });
  if (resultat.global === 'rouge') {
    navigator.vibrate?.([80, 80, 80]);
    sonRefus();
  } else {
    navigator.vibrate?.(60);
    sonValidation();
  }
  const mots = { vert: 'OK', orange: 'limite', rouge: 'HORS TOLÉRANCE' };
  const hauteur = ecarts.hauteur != null ? ` · haut. ${formaterNombre(ecarts.hauteur)} m` : '';
  afficherMessage(`${point.nom} : ${mots[resultat.global]} (plan ${formaterNombre(ecarts.plan)} m${hauteur})`, 5000);
  autocontrole.cible = null;
  modifie();
}

/**
 * Rappel du contrôle, à la connexion du RX2 (ou à l'ouverture d'un projet, RX2 déjà connecté) :
 * s'il n'y a pas eu de contrôle réussi aujourd'hui, ou depuis 4 h (voir topo/controle.js).
 * « Oui » ouvre Terrain › Contrôle ; « Non » note le refus dans le projet (CSV, PDF, Drive).
 */
let rappelEnCours = false;
async function proposerControle() {
  if (!ecranLeve || rappelEnCours || !controleNecessaire(projet.controles)) return;
  rappelEnCours = true;
  const projetDuRappel = projet;
  const aujourdHui = projet.controles.some((c) => estControleReussi(c) && new Date(c.le).toDateString() === new Date().toDateString());
  const texte = aujourdHui ? 'Dernier contrôle réussi il y a plus de 4 h.' : 'Aucun contrôle réussi aujourd\'hui.';
  // Pas de point de contrôle dans le projet : le rappel attire quand même l'attention, avec OK
  // seulement (rien n'est noté ; demande du 26.10.2026).
  if (projet.pointsControle.length === 0) {
    await demanderChoix({ titre: 'Faire le contrôle ?', texte: `${texte} Aucun point de contrôle dans ce projet.`, boutons: [{ cle: 'ok', texte: 'OK', principal: true }] });
    rappelEnCours = false;
    return;
  }
  const choix = await demanderChoix({
    titre: 'Faire le contrôle ?',
    texte,
    boutons: [
      { cle: 'oui', texte: 'Oui, faire le contrôle', principal: true },
      { cle: 'non', texte: 'Non' },
    ],
  });
  rappelEnCours = false;
  if (projet !== projetDuRappel) return; // un autre projet a été ouvert entre-temps
  if (choix === 'oui') {
    terrain.mode = 'autocontrole';
    retenirReglagesTerrain();
    afficherOnglet('terrain');
    recalculer();
    return;
  }
  projet.controles.push({ id: nouvelIdentifiant(), type: 'refus', appareil: nomDeLAppareil(), le: new Date().toISOString() });
  afficherMessage('Refus enregistré : le géomètre sera au courant', 5000);
  modifie();
}

/** Données de l'écran Terrain › Contrôle (voir leve/controle-ecran.js). */
function donneesAutocontrole() {
  const controles = projet.controles;
  const dates = controles.filter(estControleReussi).map((c) => c.le).sort();
  return {
    points: projet.pointsControle.map((p) => {
      const dernier = [...controles].reverse().find((c) => c.type === 'mesure' && c.pointId === p.id);
      return { ...p, dernier: dernier ? { global: dernier.resultat.global, le: dernier.le } : null };
    }),
    cible: autocontrole.cible,
    tolerances: projet.tolerancesControle,
    controles: [...controles].sort((a, b) => (a.le < b.le ? 1 : -1)).slice(0, 30),
    nbControles: controles.length,
    necessaire: controleNecessaire(controles),
    dernierReussi: dates.at(-1) ?? null,
  };
}

/** Vrai pendant l'implantation d'un talus (Terrain › Implanter › Talus). */
function enTalus() {
  return Boolean(ecranLeve) && terrain.mode === 'controler' && terrain.implantation === 'talus';
}

/** Nouvelle ligne à implanter (toute la ligne, dans le sens des sommets, sans décalage). */
function nouvelleLigneAImplanter(nom, sommets, segmentTouche) {
  return { nom, sommets, segmentTouche, segment: null, inverse: false, decalage: 0, altitudes: { debut: null, fin: null } };
}

/** Sommets de la ligne à implanter : toute la ligne ou le segment choisi, dans le sens choisi. */
function sommetsDeLaLigne() {
  const { sommets, segment, inverse } = implanter.ligne;
  return sommetsChoisis(sommets, { segment, inverse });
}

/**
 * Implantation d'une ligne, à chaque état du récepteur : décalage par rapport à la ligne (ou à sa
 * parallèle), position le long, altitude. Gris si la position n'est pas fiable.
 */
function calculerImplantationLigne(etat) {
  const ligne = implanter.ligne;
  if (!ligne) return null;
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };
  const g = guidageLigne(position, sommetsDeLaLigne(), { decalageVoulu: ligne.decalage, altitudes: altitudesDesBouts() });
  if (!g) return { message: 'Ligne sans longueur' };
  const fiable = Boolean(etat.autorise);
  const ecartAltitude = fiable && g.altitude != null ? ecartSurface(g.altitude, position.altitude) : null;
  return {
    ligne: g,
    classe: fiable ? classeDistance(Math.abs(g.ecart)) : 'pas-fiable',
    ecartAltitude,
    classeAltitude: ecartAltitude == null ? null : classeEcart(ecartAltitude),
    message: null,
  };
}

/** « Enregistrer l'implantation » sur une ligne : position mesurée, abscisse, décalage, écarts. */
function enregistrerImplantationLigne() {
  const ligne = implanter.ligne;
  if (!ligne) return;
  const reponse = prendrePointRecepteur();
  if (!reponse.ok) {
    afficherMessage(`Implantation refusée : ${reponse.raison}`, 4000);
    return;
  }
  const { est, nord, altitude, ...gnss } = reponse.point;
  const mesure = { est, nord, altitude, gnss };
  const g = guidageLigne(mesure, sommetsDeLaLigne(), { decalageVoulu: ligne.decalage, altitudes: altitudesDesBouts() });
  const ecarts = ecartsImplantation(g.cible, mesure);
  projet.implantations.push({
    id: nouvelIdentifiant(),
    nom: `${ligne.nom} · ${formaterNombre(g.abscisse)}`,
    type: 'ligne',
    cible: g.cible,
    mesure,
    ecarts,
    ligne: { nom: ligne.nom, abscisse: g.abscisse, decalage: g.ecart },
    le: new Date().toISOString(),
  });
  navigator.vibrate?.(60);
  sonValidation();
  const cote = Math.abs(g.ecart) < 0.0005 ? 'sur la ligne' : `${formaterNombre(Math.abs(g.ecart))} m ${g.ecart > 0 ? 'à droite' : 'à gauche'}`;
  const hauteur = ecarts.dAltitude != null ? ` · dH ${formaterNombre(ecarts.dAltitude)} m` : '';
  afficherMessage(`Implanté à ${formaterNombre(g.abscisse)} m du début, ${cote}${hauteur}`, 4000);
  modifie();
}

// --- Implantation d'un talus (Terrain › Implanter › Talus ; calculs dans topo/talus.js) ---

/**
 * Nombre positif tapé (pente, longueur, m) : le nombre, ou null si le champ est vide.
 * Renvoie undefined (et prévient) s'il est illisible ou pas plus grand que 0.
 */
function lireNombrePositif(texte, quoi) {
  const nettoye = String(texte ?? '').trim().replace(',', '.');
  if (!nettoye) return null;
  const nombre = Number(nettoye);
  if (Number.isFinite(nombre) && nombre > 0) return nombre;
  alert(`${quoi} « ${texte} » illisible : écris un nombre plus grand que 0, ou laisse vide.`);
  return undefined;
}

/** Ligne et réglages du talus en cours, pour « Mes talus » (copies : rien n'est partagé). */
function copieDuTalus() {
  const { nom, sommets, segment, inverse, altitudes } = implanter.ligne;
  return {
    ligne: { nom, sommets: sommets.map((p) => ({ est: p.est, nord: p.nord, altitude: p.altitude ?? null, ...(p.nom ? { nom: p.nom } : {}) })), segment, inverse, altitudes: { ...altitudes } },
    reglages: { ...terrain.talus },
  };
}

/** Talus de « Mes talus » ouvert : ses changements (sens, segment, altitudes, réglages) y sont gardés. */
function garderTalusOuvert() {
  if (!enTalus() || !implanter.talusId || !implanter.ligne) return;
  const talus = projet.talus.find((t) => t.id === implanter.talusId);
  if (!talus) return;
  Object.assign(talus, copieDuTalus());
  enregistrerBientot();
}

// Recherche rapide de l'altitude d'une surface (voir chercheurAltitude), préparée une fois par surface calculée.
const chercheursAltitude = new WeakMap();
function altitudeDeSurface(id) {
  const triangles = id ? trianglesDeSurface(id) : [];
  if (triangles.length === 0) return null;
  if (!chercheursAltitude.has(triangles)) chercheursAltitude.set(triangles, chercheurAltitude(triangles));
  return chercheursAltitude.get(triangles);
}

/** Ce qu'il faut pour calculer le talus : sa ligne, l'altitude de la ligne et celle du terrain (ou null). */
function donneesTalus() {
  const sommets = sommetsDeLaLigne();
  const reglages = terrain.talus;
  return {
    sommets,
    reglages,
    altitudeLigne: sourceAltitudeLigne(sommets, altitudesDesBouts(), altitudeDeSurface(reglages.altitudeSurfaceId)),
    altitudeTerrain: altitudeDeSurface(reglages.terrainId),
  };
}

/** Talus en mots, pour le CSV et les messages : « 3/2 haut droite ». */
function texteTalus(reglages) {
  return `${textePente(reglages)} ${reglages.ligneEst} ${reglages.cote}`;
}

/**
 * Implantation d'un talus, à chaque état du récepteur : entrée en terre (s'éloigner / se
 * rapprocher de la ligne), monter / descendre par rapport au talus, profil en travers.
 */
function calculerImplantationTalus(etat) {
  if (!implanter.ligne) return null;
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };
  const { sommets, reglages, altitudeLigne, altitudeTerrain } = donneesTalus();
  const g = guidageTalus(position, sommets, reglages, { altitudeLigne, altitudeTerrain });
  if (g.message) return { message: g.message, talus: g };
  const fiable = Boolean(etat.autorise);
  const ecartAltitude = fiable && g.altitudeTalusCanne != null ? ecartSurface(g.altitudeTalusCanne, position.altitude) : null;
  // Profil du terrain en travers (de la ligne vers le talus), pour la coupe : surface, sinon rien.
  const debut = Math.min(0, g.distance) - 1;
  const fin = Math.max(g.distanceVoulue, g.distance, 0) + 1;
  const profil = [];
  if (altitudeTerrain) {
    const pas = (fin - debut) / 60;
    for (let d = debut; d <= fin + 1e-9; d += pas) {
      const altitude = altitudeTerrain(g.pied.est + g.direction.est * d, g.pied.nord + g.direction.nord * d);
      if (altitude != null) profil.push({ distance: d, altitude });
    }
  }
  return {
    talus: g,
    reglages,
    classe: fiable ? classeDistance(Math.abs(g.ecartDistance)) : 'pas-fiable',
    ecartAltitude,
    classeAltitude: ecartAltitude == null ? null : classeEcart(ecartAltitude),
    altitudeCanne: fiable ? position.altitude : null,
    profil,
    message: null,
  };
}

/** « Enregistrer l'implantation » d'un talus : l'entrée en terre (ou le bord du talus) et les écarts. */
function enregistrerImplantationTalus() {
  if (!implanter.ligne) return;
  const reponse = prendrePointRecepteur();
  if (!reponse.ok) {
    afficherMessage(`Implantation refusée : ${reponse.raison}`, 4000);
    return;
  }
  const { est, nord, altitude, ...gnss } = reponse.point;
  const mesure = { est, nord, altitude, gnss };
  const { sommets, reglages, altitudeLigne, altitudeTerrain } = donneesTalus();
  const g = guidageTalus(mesure, sommets, reglages, { altitudeLigne, altitudeTerrain });
  if (g.message) {
    afficherMessage(`Implantation refusée : ${g.message}`, 4000);
    return;
  }
  const ecarts = ecartsImplantation(g.cible, mesure);
  const nomTalus = projet.talus.find((t) => t.id === implanter.talusId)?.nom ?? implanter.ligne.nom;
  const sur = g.auBord ? 'bord du talus' : 'entrée en terre';
  const accord = g.auBord ? 'enregistré' : 'enregistrée';
  projet.implantations.push({
    id: nouvelIdentifiant(),
    nom: `${nomTalus} · ${sur} · ${formaterNombre(g.abscisse)}`,
    type: 'talus',
    cible: g.cible,
    mesure,
    ecarts,
    ligne: { nom: implanter.ligne.nom, abscisse: g.abscisse, decalage: g.distance * (reglages.cote === 'gauche' ? -1 : 1) },
    talus: { texte: texteTalus(reglages), distanceVoulue: g.distanceVoulue, auBord: g.auBord, solPlat: g.solPlat },
    le: new Date().toISOString(),
  });
  navigator.vibrate?.(60);
  sonValidation();
  afficherMessage(`${sur[0].toUpperCase()}${sur.slice(1)} ${accord} (+${formaterNombre(g.abscisse)} m) : écart ${formaterNombre(ecarts.distance)} m`, 4000);
  modifie();
}

// Zone du talus sur le plan : calculée seulement quand la ligne, ses réglages ou les surfaces changent.
let zoneTalusMemoire = { cle: null, zone: null };
function zoneDuTalus() {
  if (!enTalus() || !implanter.ligne || !talusComplet(terrain.talus)) return null;
  const donnees = donneesTalus();
  const { reglages } = donnees;
  const cle = JSON.stringify([donnees.sommets, reglages, altitudesDesBouts()]);
  const surfaces = [trianglesDeSurface(reglages.terrainId), trianglesDeSurface(reglages.altitudeSurfaceId)];
  if (zoneTalusMemoire.cle !== cle || zoneTalusMemoire.surfaces?.some((t, i) => t !== surfaces[i])) {
    const longueur = longueurPolyligne(donnees.sommets);
    zoneTalusMemoire = { cle, surfaces, zone: zoneTalus(donnees.sommets, reglages, { ...donnees, pas: Math.max(0.5, longueur / 200) }) };
  }
  return zoneTalusMemoire.zone;
}

/** Toucher du plan pendant l'implantation d'une ligne : une ligne du DXF, ou un point de plus. */
function toucherPourLigne(position, tolerance) {
  const mm = (p) => ({ ...p, est: Math.round(p.est * 1000) / 1000, nord: Math.round(p.nord * 1000) / 1000, altitude: p.altitude != null ? Math.round(p.altitude * 1000) / 1000 : null });
  if (terrain.accrocheLigne === 'trait') {
    const trouve = accrocherTrait(position, tolerance, sourcesDesPlans(plansDuProjet(), position, tolerance).lignes);
    if (!trouve) {
      afficherMessage('Aucune ligne DXF sous le doigt', 3000);
      return;
    }
    const sommets = trouve.sommets.map(mm);
    const nombre = sommets.length - 1;
    implanter.ligne = nouvelleLigneAImplanter(`Ligne DXF (${nombre} segment${nombre > 1 ? 's' : ''})`, sommets, trouve.segment);
    implanter.talusId = null;
    implanter.pointsLigne = [];
  } else {
    const sources = terrain.accrocheLigne === 'point'
      ? { lignes: [], cercles: [], points: pointsDuProjet() }
      : sourcesDesPlans(plansDuProjet(), position, tolerance);
    const trouve = accrocher(terrain.accrocheLigne, position, tolerance, sources);
    if (!trouve) {
      afficherMessage('Rien sous le doigt', 3000);
      return;
    }
    ajouterPointLigne(mm(trouve));
  }
  montrerImplantation();
}

/** Ajoute un point à la ligne en préparation (sauf s'il est à la même place que le précédent). */
function ajouterPointLigne(point) {
  const precedent = implanter.pointsLigne.at(-1);
  if (precedent && Math.hypot(precedent.est - point.est, precedent.nord - point.nord) < 0.001) {
    afficherMessage('Même point que le précédent : pas ajouté', 2500);
    return;
  }
  implanter.pointsLigne.push(point);
}

/**
 * Points du projet que l'on peut implanter : ceux de tous les levés (importés ou levés avec le
 * récepteur) et les points « À implanter ». Un nom pris deux fois : le premier trouvé.
 */
function pointsDuProjet() {
  const vus = new Set();
  const liste = [];
  for (const point of [...projet.leves.flatMap((l) => l.points), ...projet.aImplanter, ...projet.pointsControle]) {
    if (vus.has(point.nom)) continue;
    vus.add(point.nom);
    liste.push(point);
  }
  return liste;
}

/**
 * Toucher du plan pendant l'implantation d'un point : on cherche le point selon l'accroche choisie
 * (« Point » : les points du projet ; les autres : le plan DXF).
 */
function toucherPourImplantation(position, tolerance) {
  if (piloteActif()) {
    toucherPourDessin(position, tolerance);
    return;
  }
  if (recalage.planId) {
    toucherPourRecalage(position, tolerance);
    return;
  }
  if (pointage.actif) {
    toucherPourPointage(position, tolerance);
    return;
  }
  if (enImplantationDeLigne()) {
    toucherPourLigne(position, tolerance);
    return;
  }
  const sources = terrain.accroche === 'point'
    ? { lignes: [], cercles: [], points: pointsDuProjet() }
    : sourcesDesPlans(plansDuProjet(), position, tolerance);
  const trouve = accrocher(terrain.accroche, position, tolerance, sources);
  if (!trouve) {
    const quoi = { point: 'aucun point du projet', sommet: 'aucun sommet', milieu: 'aucune ligne', ligne: 'aucune ligne', centre: 'aucun cercle' }[terrain.accroche];
    afficherMessage(`${quoi[0].toUpperCase()}${quoi.slice(1)} sous le doigt`, 3000);
    return;
  }
  const mm = (valeur) => Math.round(valeur * 1000) / 1000;
  implanter.choix = { ...trouve, est: mm(trouve.est), nord: mm(trouve.nord), altitude: trouve.altitude != null ? mm(trouve.altitude) : null };
  montrerImplantation();
}

// --- Recalage d'un plan DXF (Projet › Imports › Recaler ; calculs dans topo/recalage.js) ---
// recalage : { planId (plan en cours de recalage, ou null), accroche, choix ({ x, y } : point
// touché sur le DXF d'origine), source ('projet', 'tape', 'rx2'), paires (points de calage
// { x, y, est, nord, nom, actif }) }. Pendant le recalage, ce plan est montré tel qu'il a été lu.
// toucherProjet : vrai quand on touche le plan pour prendre un point du projet (ses coordonnées MN95).
const recalage = { planId: null, accroche: 'sommet', choix: null, source: 'projet', paires: [], toucherProjet: false };
let barreRecalage = null;

/** Plans DXF du projet tels qu'on les utilise : recalés (sauf celui qu'on est en train de recaler). */
function plansDuProjet() {
  return (projet.plansDxf ?? []).map((p) => (p.id === recalage.planId ? p : planRecale(p)));
}

function commencerRecalage(id) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi) return;
  if (pointage.actif) arreterPointage();
  recalage.planId = id;
  recalage.choix = null;
  recalage.paires = (choisi.recalage?.paires ?? []).map((p) => ({ ...p }));
  barreRecalage ??= creerBarreRecalage(document.querySelector('#plan .plan-cadre'), {
    choisirAccroche: (mode) => {
      recalage.accroche = mode;
      montrerRecalage();
    },
    choisirSource: (source) => {
      recalage.source = source;
      recalage.toucherProjet = false;
      montrerRecalage();
    },
    // Prendre le point du projet en le touchant sur le plan : le plan montre les points du projet.
    toucherPointProjet: () => {
      const points = pointsDuProjet();
      if (points.length === 0) {
        afficherMessage('Aucun point dans le projet', 3000);
        return;
      }
      recalage.toucherProjet = true;
      plan.cadrerSur(points, 10);
      montrerRecalage();
    },
    annulerToucherProjet: () => {
      recalage.toucherProjet = false;
      const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
      if (choisi) plan.cadrerSurPlans([choisi]);
      montrerRecalage();
    },
    ajouterPaire: ajouterPaireCalage,
    prendreAuRx2: () => {
      // Même règle qu'un point levé : RTK fixe et inclinaison prête.
      const reponse = prendrePointRecepteur();
      if (!reponse.ok) {
        sonRefus();
        afficherMessage(`Point refusé : ${reponse.raison}`, 4000);
        return;
      }
      ajouterPaireCalage({ est: reponse.point.est, nord: reponse.point.nord, nom: `RX2 ${new Date().toLocaleTimeString('fr-CH')}` });
    },
    basculerPaire: (index, actif) => {
      recalage.paires[index].actif = actif;
      montrerRecalage();
    },
    enleverPaire: (index) => {
      recalage.paires.splice(index, 1);
      montrerRecalage();
    },
    appliquer: appliquerRecalage,
    annulerRecalage: () => annulerRecalage(recalage.planId),
    fermer: () => {
      const enregistrees = JSON.stringify(projet.plansDxf.find((p) => p.id === recalage.planId)?.recalage?.paires ?? []);
      if (JSON.stringify(recalage.paires) !== enregistrees && !confirm('Fermer sans appliquer ? Les points de calage ajoutés seront perdus.')) return;
      arreterRecalage();
    },
  });
  if (estTelephone()) afficherOnglet('plan');
  recalculer();
  requestAnimationFrame(() => plan.cadrerSurPlans([choisi]));
  montrerRecalage();
}

function arreterRecalage() {
  recalage.planId = null;
  recalage.choix = null;
  recalage.toucherProjet = false;
  barreRecalage?.enlever();
  barreRecalage = null;
  recalculer();
}

/** Redessine la barre du recalage et la croix du point touché. */
function montrerRecalage() {
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  if (!choisi || !barreRecalage) return;
  barreRecalage.afficher({
    nomPlan: choisi.nom,
    accroche: recalage.accroche,
    choix: recalage.choix,
    source: recalage.source,
    groupesPoints: groupesDePoints(),
    toucherProjet: recalage.toucherProjet,
    rx2: recepteurDisponible(),
    paires: recalage.paires,
    dejaRecale: Boolean(choisi.recalage?.applique),
  });
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/**
 * Points du projet rangés comme dans « Afficher » (fichier importé, surface, métré, Autres, points
 * ajoutés), puis « À implanter » : [{ titre, noms }] (fenêtre « Liste » de Terrain › Implanter).
 * Un point peut être dans plusieurs listes (fichier et surface).
 */
function groupesDePointsParListe() {
  const groupes = [];
  for (const liste of listesDePoints(projet)) {
    if (!liste.leveId) continue;
    const leve = projet.leves.find((l) => l.id === liste.leveId);
    const noms = [...new Set((leve?.points ?? []).map((p) => p.nom).filter((nom) => !liste.noms || liste.noms.has(nom)))];
    if (noms.length > 0) groupes.push({ titre: liste.nom, noms });
  }
  if (projet.aImplanter.length > 0) groupes.push({ titre: 'À implanter', noms: projet.aImplanter.map((p) => p.nom) });
  // Points de contrôle : une liste à part, en rouge (voir fenetres-points.js).
  if (projet.pointsControle.length > 0) groupes.push({ titre: 'Points de contrôle', noms: projet.pointsControle.map((p) => p.nom), classe: 'groupe-controle' });
  return groupes;
}

/**
 * Points du projet rangés par levé (pour la liste du recalage) : [{ titre, noms }], sans nom
 * en double (comme pointsDuProjet).
 */
function groupesDePoints() {
  const vus = new Set();
  const groupes = [...projet.leves.map((l) => ({ titre: l.nom, points: l.points })), { titre: 'À implanter', points: projet.aImplanter }];
  return groupes
    .map(({ titre, points }) => ({ titre, noms: points.map((p) => p.nom).filter((nom) => !vus.has(nom) && vus.add(nom)) }))
    .filter((g) => g.noms.length > 0);
}

/**
 * Toucher le plan pendant le recalage : on accroche un point du DXF d'origine ; ou, après « Sur le
 * plan », un point du projet (ses coordonnées MN95), qui devient tout de suite un point de calage.
 */
function toucherPourRecalage(position, tolerance) {
  if (recalage.toucherProjet) {
    const point = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsDuProjet() });
    if (!point) {
      afficherMessage('Aucun point du projet sous le doigt', 3000);
      return;
    }
    recalage.toucherProjet = false;
    ajouterPaireCalage({ nomPoint: point.nom });
    const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
    if (choisi) plan.cadrerSurPlans([choisi]);
    return;
  }
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  const trouve = accrocher(recalage.accroche, position, tolerance, sourcesDesPlans([choisi], position, tolerance));
  if (!trouve) {
    afficherMessage('Rien à accrocher sous le doigt', 3000);
    return;
  }
  recalage.choix = { x: trouve.est, y: trouve.nord };
  montrerRecalage();
}

/**
 * Ajoute un point de calage : le point touché sur le DXF et ses coordonnées MN95 (un point du
 * projet par son nom, ou Est / Nord tapés ou pris au RX2).
 */
function ajouterPaireCalage({ nomPoint, est, nord, nom }) {
  if (!recalage.choix) return;
  let mn95;
  if (recalage.source === 'projet') {
    const point = pointsDuProjet().find((p) => p.nom === String(nomPoint ?? '').trim());
    if (!point) {
      afficherMessage(`Point « ${nomPoint} » introuvable dans le projet`, 4000);
      return;
    }
    mn95 = { est: point.est, nord: point.nord, nom: point.nom };
  } else {
    const e = typeof est === 'number' ? est : lireNombreTape(String(est).replace(/\s/g, ''));
    const n = typeof nord === 'number' ? nord : lireNombreTape(String(nord).replace(/\s/g, ''));
    if (e == null || n == null) {
      afficherMessage('Est et Nord : écris deux nombres', 4000);
      return;
    }
    mn95 = { est: e, nord: n, nom: nom ?? `E ${formaterNombre(e)} / N ${formaterNombre(n)}` };
  }
  recalage.paires.push({ x: recalage.choix.x, y: recalage.choix.y, est: mn95.est, nord: mn95.nord, nom: mn95.nom, actif: true });
  recalage.choix = null;
  sonValidation();
  montrerRecalage();
}

/** « Appliquer » : le plan est recalé (ses points de calage et les paramètres sont gardés). */
function appliquerRecalage() {
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  const helmert = calculerHelmert(recalage.paires);
  if (!choisi || helmert.erreur) return;
  const { a, b, tEst, tNord, echelle, rotation } = helmert;
  choisi.recalage = { paires: recalage.paires.map((p) => ({ ...p })), parametres: { a, b, tEst, tNord, echelle, rotation }, applique: true, le: new Date().toISOString() };
  arreterRecalage();
  modifie();
  afficherMessage(`Plan « ${choisi.nom} » recalé`, 3000);
  requestAnimationFrame(() => plan.cadrerSurPlans([planRecale(choisi)]));
}

/** Annule le recalage : le plan revient tel qu'il a été lu (les points de calage restent, pour refaire). */
function annulerRecalage(id) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi?.recalage || !confirm(`Annuler le recalage de « ${choisi.nom} » ? Le plan revient tel qu'il a été lu.`)) return;
  choisi.recalage.applique = false;
  if (recalage.planId) arreterRecalage();
  modifie();
}

// --- Points ajoutés en touchant le plan DXF (Projet › Imports › Point › Pointer sur le plan DXF) ---
// pointage : { actif, accroche ('sommet', 'milieu', 'ligne', 'centre'), choix (point touché, à
// contrôler et valider : { est, nord, altitude }) }. Le plan ne bouge pas : une croix montre le
// point, on vérifie, on donne son nom, puis « Valider ».
const pointage = { actif: false, accroche: 'sommet', choix: null };
const ACCROCHES_POINTAGE = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['centre', 'Centre']];

/** Début du pointage : une barre sur le plan (accroche, Terminé) ; sur téléphone, on va au plan. */
function commencerPointage() {
  pointage.actif = true;
  pointage.choix = null;
  dessinerBarrePointage();
  if (estTelephone()) afficherOnglet('plan');
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

function arreterPointage() {
  pointage.actif = false;
  pointage.choix = null;
  document.querySelector('.barre-pointage')?.remove();
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/** Barre posée en bas du plan pendant le pointage : accroche, puis le point touché (nom, H, Valider). */
function dessinerBarrePointage() {
  let barre = document.querySelector('.barre-pointage');
  if (!barre) {
    barre = document.createElement('div');
    barre.className = 'barre-pointage';
    barre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-action]');
      if (!bouton) return;
      const action = bouton.dataset.action;
      if (action === 'accroche-pointage') {
        pointage.accroche = bouton.dataset.valeur;
        dessinerBarrePointage();
      } else if (action === 'valider-pointage') validerPointage();
      else if (action === 'oublier-pointage') {
        pointage.choix = null;
        dessinerBarrePointage();
        envoyerImplantationAuPlan();
        plan.rafraichirImplantation();
      } else if (action === 'fin-pointage') arreterPointage();
    });
    barre.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') validerPointage();
    });
    document.querySelector('#plan .plan-cadre').append(barre);
  }
  const c = pointage.choix;
  barre.innerHTML = `<div class="ligne-barre-pointage">
      ${ACCROCHES_POINTAGE.map(([cle, titre]) => `<button type="button" class="puce-choix ${pointage.accroche === cle ? 'actif' : ''}" data-action="accroche-pointage" data-valeur="${cle}">${titre}</button>`).join('')}
      <button type="button" class="bouton" data-action="fin-pointage">Terminé</button>
    </div>
    ${c ? `<div class="choix-pointage">
      <span class="coordonnees-pointage">E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}</span>
      <label>Nom<input type="text" data-pointage="nom" value="${echapper(nomPointAjoute(projet))}" autocomplete="off" autocapitalize="characters" /></label>
      <label>H<input type="text" inputmode="decimal" data-pointage="altitude" value="${c.altitude != null ? c.altitude.toFixed(3) : ''}" placeholder="facultative" /></label>
      <button type="button" class="bouton" data-action="valider-pointage">Valider</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="oublier-pointage">annuler</button>
    </div>` : '<p class="aide-pointage">Touche le plan DXF</p>'}`;
}

/** Toucher du plan pendant le pointage : le point accroché est montré (croix), à valider. */
function toucherPourPointage(position, tolerance) {
  const trouve = accrocher(pointage.accroche, position, tolerance, sourcesDesPlans(plansDuProjet(), position, tolerance));
  if (!trouve) {
    const quoi = { sommet: 'Aucun sommet', milieu: 'Aucune ligne', ligne: 'Aucune ligne', centre: 'Aucun cercle' }[pointage.accroche];
    afficherMessage(`${quoi} sous le doigt`, 3000);
    return;
  }
  const mm = (valeur) => Math.round(valeur * 1000) / 1000;
  pointage.choix = { est: mm(trouve.est), nord: mm(trouve.nord), altitude: trouve.altitude != null ? mm(trouve.altitude) : null };
  dessinerBarrePointage();
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/** « Valider » : le point montré devient un point ajouté, avec le nom et l'altitude tapés. */
function validerPointage() {
  if (!pointage.choix) return;
  const barre = document.querySelector('.barre-pointage');
  const nom = barre.querySelector('[data-pointage="nom"]').value;
  const altitude = lireNombreTape(barre.querySelector('[data-pointage="altitude"]').value);
  if (altitude === undefined) {
    afficherMessage('Altitude illisible : écris un nombre, ou laisse vide', 4000);
    return;
  }
  const { point, erreur } = ajouterPointAjoute(projet, { ...pointage.choix, nom, altitude, source: 'dxf' });
  if (erreur) {
    afficherMessage(`Point non ajouté : ${erreur}`, 4000);
    return;
  }
  pointage.choix = null;
  sonValidation();
  afficherMessage(`Point ${point.nom} ajouté${point.altitude != null ? ` · H ${formaterNombre(point.altitude)}` : ''}`, 2500);
  dessinerBarrePointage();
  modifie();
}

/**
 * Implantation d'un point, à chaque état du récepteur : ce qu'il reste à faire pour être dessus.
 * Sans position fiable (pas de RTK fixe ou inclinaison pas prête), le guidage est donné en gris,
 * avec la raison : il aide à s'approcher, mais on ne peut pas enregistrer.
 */
function calculerImplantation(etat, orientation, cible = implanter.cible) {
  if (!cible) return null;
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };
  const g = guidage(position, cible, orientation.azimut);
  const fiable = Boolean(etat.autorise);
  const ecartAltitude = fiable && cible.altitude != null ? ecartSurface(cible.altitude, position.altitude) : null;
  return {
    guidage: { ...g, azimut: orientation.azimut },
    classe: fiable ? classeDistance(g.distance) : 'pas-fiable',
    ecartAltitude,
    classeAltitude: ecartAltitude == null ? null : classeEcart(ecartAltitude),
    message: null,
  };
}

/**
 * Touche « volume − » : elle prend le point seulement dans l'onglet Terrain, en mode Lever, avec une
 * surface en cours ; ailleurs, elle règle le volume comme d'habitude. Point refusé : message et
 * double vibration (on ne regarde pas forcément l'écran).
 */
let toucheVolumeActive = null;
function mettreAJourToucheVolume() {
  if (!ecranLeve) return;
  const dansTerrain = document.body.dataset.onglet === 'terrain';
  const lever = dansTerrain && terrain.mode === 'lever' && Boolean(stockEnCours() || metreEnCours());
  const implanterAvecTouche = dansTerrain && ((enImplantationDePoint() && Boolean(implanter.cible)) || (enImplantationDeLigne() && Boolean(implanter.ligne)) || (enAutocontrole() && Boolean(autocontrole.cible)));
  const actif = lever || implanterAvecTouche;
  if (actif === toucheVolumeActive) return;
  toucheVolumeActive = actif;
  regleToucheVolume(actif, () => {
    const enImplantation = enImplantationDePoint() || enImplantationDeLigne() || enAutocontrole();
    const refus = enImplantation ? ecranLeve.enregistrerDepuisTouche() : ecranLeve.prendreDepuisTouche();
    if (refus) {
      navigator.vibrate?.([80, 80, 80]);
      sonRefus();
      afficherMessage(`${enAutocontrole() ? 'Contrôle refusé' : enImplantation ? 'Implantation refusée' : 'Point refusé'} : ${refus}`, 4000);
    }
  });
}

/** Libellé utilisé pour le rôle en cours (dans la liste ; sinon le premier de la liste). */
function libelleDuRole() {
  if (leveDirect.role === 'contour') return null;
  const sorte = leveDirect.role === 'aire' ? 'aires' : ['ligne', 'longueur'].includes(leveDirect.role) ? 'lignes' : 'points';
  const liste = libelles[sorte];
  const voulu = { aires: terrain.libelleAire, lignes: terrain.libelleLigne, points: terrain.libellePoint }[sorte];
  return liste.some(([abreviation]) => abreviation === voulu) ? voulu : liste[0][0];
}

/** Rôles d'un point levé dans un métré. */
const ROLES_DU_METRE = ['aire', 'longueur', 'compte'];

/** Ce que montre l'onglet Terrain (voir leve/ecran.js). */
function donneesLeve() {
  reprendreLeveDirect();
  const metre = metreEnCours();
  if (metre) return donneesMetre(metre);
  // Terrain naturel ou terrassement : pas de contour, on passe aux points isolés.
  if (!rolesPermis(stockEnCours()).includes(leveDirect.role)) leveDirect.role = 'isole';
  const leve = leveEnCours();
  const stock = stockEnCours();
  // D'abord le nom proposé : pour une ligne, il prépare la ligne en cours (libellé, numéro).
  const nomPropose = stock ? prochainNom(projet, stock, leveDirect.role, libelleDuRole()) : '';
  const ligne = stock ? ligneEnCours(stock) : null;
  const numeroLigne = stock ? stock.lignesRupture.indexOf(ligne) + 1 : 0;
  return {
    ...donneesCommunes(),
    leve,
    stock,
    role: leveDirect.role,
    ligne: ligne ? { libelle: ligne.libelle, numero: ligne.numero ?? numeroLigne, nbPoints: ligne.noms.length, fermee: ligne.fermee } : null,
    nomPropose,
    rolesPermis: rolesPermis(stock),
    dernierPoint: leve?.points[leve.points.length - 1]?.nom ?? null,
    resume: stock ? resumeStock(stock) : null,
    volume: stock ? volumeDuStock(stock) : null,
  };
}

/** Données de l'onglet Terrain pour un métré : rôles aire / longueur / point compté, mesure en cours. */
function donneesMetre(metre) {
  if (!ROLES_DU_METRE.includes(leveDirect.role)) leveDirect.role = 'aire';
  const leve = leveEnCours();
  const libelle = libelleDuRole();
  const nomPropose = prochainNomMetre(projet, metre, leveDirect.role, libelle);
  const enCours = leveDirect.role === 'compte' ? null : mesureEnCours(projet, metre, leveDirect.role);
  const memeElement = enCours && enCours.libelle === libelle;
  return {
    ...donneesCommunes(),
    leve,
    stock: metre,
    metre,
    role: leveDirect.role,
    rolesPermis: ROLES_DU_METRE,
    nomPropose,
    // Aire ou longueur en cours (son libellé, son numéro tiré du nom proposé, ses points).
    elementMetre: leveDirect.role === 'compte' ? null : {
      libelle,
      numero: Number(nomPropose.split('-').at(-2)),
      nbPoints: memeElement ? (enCours.contour ?? enCours.points).length : 0,
    },
    ligne: null,
    dernierPoint: leve?.points[leve.points.length - 1]?.nom ?? null,
    resumeTexte: resumeMetre(projet, metre),
    resume: null,
    volume: null,
  };
}

/** Données de l'onglet Terrain communes aux surfaces et aux métrés. */
function donneesCommunes() {
  return {
    // Surfaces levées et métrés, avec la date de leur levé (« Stock 2 · 22.10.2026 »).
    stocks: [...surfacesLevees(), ...projet.metres, ...projet.autres].map((s) => ({ id: s.id, nom: `${s.nom} · ${jourDuLeve(s.leveId)}`, nature: s.nature ?? 'stock' })),
    libelles,
    libelleLigne: terrain.libelleLigne,
    libellePoint: terrain.libellePoint,
    libelleAire: terrain.libelleAire,
    mode: terrain.mode,
    controle: terrain,
    autocontrole: donneesAutocontrole(),
    surfaces: projet.surfaces.map((s) => ({ id: s.id, etiquette: etiquetteSurface(s) })),
    implanter: {
      accroche: terrain.accroche,
      choix: implanter.choix,
      cible: implanter.cible,
      nomPropose: nomProposeImplantation(),
      // Nom du point suivant à implanter (P1 → P2), ou null.
      suivant: implanter.cible?.nom && enImplantationDePoint() ? nomSuivant(implanter.cible.nom, pointsDuProjet().map((p) => p.nom)) : null,
      aImplanter: projet.aImplanter.map((p) => {
        const derniere = [...projet.implantations].reverse().find((i) => i.aImplanterId === p.id);
        return { ...p, fait: derniere ? { distance: derniere.ecarts.distance, dAltitude: derniere.ecarts.dAltitude } : null };
      }),
      nbImplantations: projet.implantations.length,
      nomsPoints: enImplantationDePoint() || enImplantationDeLigne() ? pointsDuProjet().map((p) => p.nom) : [],
      accrocheLigne: terrain.accrocheLigne,
      pointsLigne: implanter.pointsLigne,
      ligne: implanter.ligne ? resumeLigne() : null,
      // Talus : réglages, talus de « Mes talus » ouvert (nom) et la liste.
      talus: {
        reglages: terrain.talus,
        complet: talusComplet(terrain.talus),
        texte: textePente(terrain.talus),
        ouvert: projet.talus.find((t) => t.id === implanter.talusId)?.nom ?? null,
        mesTalus: projet.talus.map((t) => ({ id: t.id, nom: t.nom, texte: `${textePente(t.reglages)} · ${t.reglages.ligneEst === 'bas' ? 'depuis le bas' : 'depuis le haut'} · à ${t.reglages.cote}` })),
      },
      nomPointAjoute: nomPointAjoute(projet),
      // Point choisi qui est déjà un point du projet (pas de « + Point du projet »).
      choixDuProjet: Boolean(implanter.choix?.nom && pointsDuProjet().some((p) => p.nom === implanter.choix.nom)),
    },
  };
}

/**
 * Altitudes du début et de la fin de la ligne à implanter (m) : celles tapées, sinon celles des
 * points eux-mêmes (un point du projet choisi pour la ligne a souvent une altitude, même si un
 * autre point de la ligne n'en a pas). { debut, fin }, chacune pouvant être null.
 */
function altitudesDesBouts() {
  const sommets = sommetsDeLaLigne();
  const tapees = implanter.ligne.altitudes;
  // Tous les sommets ont une altitude (DXF 3D…) : on suit leurs altitudes, sommet par sommet.
  if (tapees.debut == null && tapees.fin == null && sommets.every((s) => s.altitude != null)) return tapees;
  return { debut: tapees.debut ?? sommets[0]?.altitude ?? null, fin: tapees.fin ?? sommets.at(-1)?.altitude ?? null };
}

/** Ligne à implanter pour l'écran Terrain : nom, longueur, segments, sens, début, fin, réglages. */
function resumeLigne() {
  const ligne = implanter.ligne;
  const sommets = sommetsDeLaLigne();
  return {
    nom: ligne.nom,
    longueur: longueurPolyligne(sommets),
    nbSegments: ligne.sommets.length - 1,
    segment: ligne.segment,
    inverse: ligne.inverse,
    decalage: ligne.decalage,
    altitudes: altitudesDesBouts(),
    altitudesDuPlan: sommets.every((s) => s.altitude != null),
    debut: sommets[0],
    fin: sommets.at(-1),
  };
}

/**
 * Réglages d'un plan DXF (liste des plans, ou menu « Plans » du plan) : visible (œil), couleur
 * (null = celles du DXF) et nom court (« Bordures »).
 */
function reglerPlanDxf(id, { visible, couleur, nom }) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi) return;
  if (visible !== undefined) choisi.visible = visible;
  if (couleur !== undefined) choisi.couleur = couleur;
  if (nom !== undefined && nom.trim()) choisi.nom = nom.trim();
  modifie();
}

/** Mode Contrôler : la surface choisie devient la surface affichée (plan, Calculs › Surfaces). */
function montrerSurfaceControle() {
  const index = projet.surfaces.findIndex((s) => s.id === terrain.surfaceId);
  if (index >= 0) editeurSurfaces.choisir(index);
}

/**
 * Mode Contrôler, à chaque état du récepteur : de combien monter ou descendre pour être sur la
 * surface choisie, et les coupes autour du récepteur. L'écart n'est donné que si le point serait
 * accepté par la règle de prise de point (RTK fixe et inclinaison prête) ; sinon, la raison.
 */
function calculerControle(etat, orientation) {
  const surface = projet.surfaces.find((s) => s.id === terrain.surfaceId);
  if (!surface) return { message: 'Choisis une surface' };
  const triangles = trianglesDeSurface(surface.id);
  if (triangles.length === 0) return { message: 'Cette surface n\'a pas encore de triangles' };
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };

  const altitudeSurface = altitudeSurSurface(triangles, position.est, position.nord);
  const fiable = Boolean(etat.autorise);
  let message = null;
  if (!fiable) message = etat.raison ?? 'Position pas fiable';
  else if (altitudeSurface == null) message = 'Hors surface';
  const ecart = message ? null : ecartSurface(altitudeSurface, position.altitude);

  // Coupes : sans orientation connue, on les oriente nord-sud et est-ouest.
  const azimut = orientation.azimut ?? 0;
  const coupes = {};
  for (const sens of ['perpendiculaire', 'axe']) {
    const { debut, fin } = extremitesCoupe(position, azimut, terrain.demiLongueur, sens);
    coupes[sens] = {
      debut,
      fin,
      lignes: profilSurface(triangles, debut, fin),
      demiLongueur: terrain.demiLongueur,
      altitudeCanne: fiable ? position.altitude : null,
    };
  }
  if (orientation.azimut == null) {
    Object.assign(coupes.perpendiculaire, { titre: 'Ouest-est (orientation inconnue)', gauche: '← ouest', droite: 'est →' });
    Object.assign(coupes.axe, { titre: 'Sud-nord (orientation inconnue)', gauche: '← sud', droite: 'nord →' });
  }
  return {
    ecart,
    classe: ecart == null ? null : classeEcart(ecart),
    altitudeSurface,
    altitudeCanne: position.altitude,
    message,
    coupes,
  };
}

// Boussole de la tablette (implantation : savoir où est le nord) : l'aiguille tourne au plus une
// fois par image affichée.
if (ecranLeve) {
  let capEnAttente = null;
  ecouterBoussole((cap) => {
    if (capEnAttente === null) {
      requestAnimationFrame(() => {
        ecranLeve.mettreAJourBoussole(capEnAttente);
        capEnAttente = null;
      });
    }
    capEnAttente = cap;
  });
}

// État du récepteur, 5 fois par seconde : bandeaux, bloc de levé, position sur le plan.
if (recepteurDisponible()) {
  ecouterRecepteur((etat) => {
    // RX2 qui vient de se connecter : rappel du contrôle s'il en faut un (voir proposerControle).
    const vientDeSeConnecter = Boolean(etat.connecte) && !etatRecepteur?.connecte;
    etatRecepteur = etat;
    if (vientDeSeConnecter) proposerControle();
    mettreAJourBandeaux(etat);
    boutonRecepteur?.mettreAJour(etat);
    const orientation = suiviOrientation.ajouter(etat, performance.now());
    const enPoint = enImplantationDePoint();
    const enLigne = enImplantationDeLigne();
    const controle = terrain.mode === 'controler' && !enPoint && !enLigne ? calculerControle(etat, orientation) : null;
    let implantation = enPoint ? calculerImplantation(etat, orientation) : null;
    if (enAutocontrole() && autocontrole.cible) implantation = calculerImplantation(etat, orientation, autocontrole.cible);
    const talus = enTalus();
    const implantationLigne = enLigne && !talus ? calculerImplantationLigne(etat) : null;
    const implantationTalus = talus ? calculerImplantationTalus(etat) : null;
    ecranLeve.mettreAJourRecepteur(etat, { orientation, controle, implantation, implantationLigne, implantationTalus });
    const position = etat.connecte && etat.recu ? etat.position : null;
    // Coupes affichées (mode Implanter) : leur trait en pointillés sur le plan.
    const vues = { les2: ['perpendiculaire', 'axe'], perpendiculaire: ['perpendiculaire'], axe: ['axe'] }[terrain.vueCoupes] ?? [];
    const traits = controle?.coupes ? vues.map((sens) => ({ sens, debut: controle.coupes[sens].debut, fin: controle.coupes[sens].fin })) : [];
    // Ligne : trait en pointillés jusqu'au point de la ligne en face de la canne.
    // Talus : trait jusqu'à l'entrée en terre (ou au bord du talus) en face de la canne.
    const vers = implantationLigne?.ligne?.cible ?? (implantationTalus?.message ? null : implantationTalus?.talus?.cible) ?? null;
    const cotes = implantationTalus ? cotesTalus(implantationTalus) : cotesLigne(implantationLigne);
    plan.afficherPosition(position ? { est: position.est, nord: position.nord, prete: Boolean(etat.inclinaisonPrete), azimut: orientation.azimut, coupes: traits, vers, cotesLigne: cotes } : null);
  });
}

const ecranProjet = creerEcranProjet(document.querySelector('#projets'), {
  renommer: (nom) => {
    projet.nom = nom; // facultatif : le projet se reconnaît à son affaire et son lieu
    modifie();
  },
  changerCartouche: (champ, valeur) => {
    projet.cartouche[champ] = valeur;
    modifie();
  },
  exporterProjet: async (id) => {
    const lu = id === projet.id ? projet : await stockage.lireProjet(id);
    if (!lu) return;
    const complet = completerProjet(lu);
    telecharger(new Blob([ecrireFichierProjet(complet)], { type: 'application/json' }), `${nomDeFichierProjet(complet)}.topo.json`);
  },
  // Nouveau projet : on reste sur l'onglet Projet, curseur dans « Affaire ».
  nouveauProjet: async () => {
    await changerDeProjet(() => ouvrir(nouveauProjetSansNom(), { changerOnglet: false }));
    afficherOnglet('projets');
    document.querySelector('#projets [data-cartouche="affaire"]')?.focus();
  },
  ouvrirProjet: async (id) => {
    const lu = await stockage.lireProjet(id);
    if (lu) await changerDeProjet(() => ouvrir(completerProjet(lu)));
  },
  dupliquerProjet: async (id) => {
    const lu = id === projet.id ? projet : await stockage.lireProjet(id);
    if (lu) await changerDeProjet(() => ouvrir(dupliquerProjet(completerProjet(lu), lu.nom ? `${lu.nom} (copie)` : 'copie'), { changerOnglet: false }));
  },
  supprimerProjet: async (id) => {
    const resume = resumes.find((r) => r.id === id);
    const surDrive = partage?.etat.projetsDrive.some((p) => p.projetId === id);
    if (!resume || !confirm(`Supprimer le projet « ${resume.titre} » de cet appareil ?${surDrive ? '\n\nLa copie sur Google Drive reste.' : ''}`)) return;
    await supprimerDeLAppareil(id);
  },
  // Supprimer partout : sur cet appareil et sur Google Drive (dossier mis à la corbeille de Drive).
  supprimerPartout: async (id) => {
    const surDrive = partage?.etat.projetsDrive.find((p) => p.projetId === id);
    const titre = resumes.find((r) => r.id === id)?.titre ?? surDrive?.titre ?? 'ce projet';
    if (!confirm(`Supprimer « ${titre} » partout : sur cet appareil ET sur Google Drive (pour tous les appareils) ?`)) return;
    if (resumes.some((r) => r.id === id)) await supprimerDeLAppareil(id);
    try {
      await partage?.supprimerDeDrive(id);
      afficherMessage(`« ${titre} » supprimé partout`, 3000);
    } catch (erreur) {
      alert(`Suppression sur Google Drive impossible : ${erreur.message}.`);
    }
  },
  importerFichierProjet: async (fichier) => {
    const { projet: lu, erreur } = lireFichierProjet(await fichier.text());
    if (erreur) {
      alert(`Impossible d'ouvrir « ${fichier.name} » : ${erreur}.`);
      return;
    }
    if (resumes.some((r) => r.id === lu.id) && !confirm(`Le projet « ${titreProjet(lu)} » existe déjà sur cet appareil. Le remplacer par le fichier ?`)) {
      return;
    }
    await changerDeProjet(() => ouvrir(lu));
  },
  // --- Partage par Google Drive ---
  connecterDrive: () => partage.connecter(),
  deconnecterDrive: () => partage.deconnecter(),
  nommerAppareil: (nom) => partage.nommerAppareil(nom),
  envoyerDrive: () => partage.envoyerMaintenant(),
  reprendreLaMain: () => partage.reprendreLaMain(),
  ouvrirDrive: (dossierId) => partage.ouvrirDepuisDrive(dossierId),
  rafraichirDrive: () => partage.rafraichirListe().catch((erreur) => afficherMessage(`Drive : ${erreur.message}`, 4000)),
}, document.querySelector('#projets-suite'));

/** Supprime un projet de cet appareil ; si c'était le projet ouvert, on en ouvre un autre. */
async function supprimerDeLAppareil(id) {
  await stockage.supprimerProjet(id);
  if (id === projet.id) {
    const restants = (await stockage.listerProjets()).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
    await ouvrir(restants[0] ? completerProjet(restants[0]) : nouveauProjetSansNom(), { changerOnglet: false });
    partage?.apresOuverture();
  }
  await rafraichirListe();
  afficherEcranProjet();
}

/** Onglet Projet, avec l'état du partage par Drive. */
function afficherEcranProjet() {
  ecranProjet.afficher(projet, resumes, partage ? { etat: partage.etat, appareil: partage.appareil() } : null);
}

/**
 * Ouvre un autre projet (action "ouvrirAutre") : le projet ouvert est d'abord envoyé sur Drive et
 * rendu (verrou), puis le nouveau est comparé à sa version de Drive.
 */
async function changerDeProjet(ouvrirAutre) {
  partage?.avantDeChanger(); // en arrière-plan : l'autre projet s'ouvre sans attendre internet
  await ouvrirAutre();
  partage?.apresOuverture();
}

partage = creerPartage({
  obtenirProjet: () => projet,
  titreDe: (p) => titreProjet(p),
  lireLocal: async (id) => {
    const lu = await stockage.lireProjet(id);
    return lu ? completerProjet(lu) : null;
  },
  enregistrerLocal: async (lu) => {
    const complet = completerProjet(lu);
    await stockage.enregistrerProjet(complet);
    mettreAJourResume(complet);
  },
  ouvrirProjet: (nouveau) => ouvrir(completerProjet(nouveau), { changerOnglet: false }),
  garderCopie: async (local) => {
    const copie = dupliquerProjet(completerProjet(local), `${titreProjet(local)} (copie)`);
    await stockage.enregistrerProjet(copie);
    mettreAJourResume(copie);
    return copie;
  },
  // Projet modifié ici et sur Drive : 2 boutons, « Repartir depuis Drive » mis en avant.
  choisirVersionConflit: (titre) => demanderChoix({
    titre: `« ${titre} » a changé ici et sur Drive`,
    boutons: [
      { cle: 'drive', texte: 'Repartir depuis Drive', detail: 'les changements faits ici sont perdus', principal: true },
      { cle: 'copie', texte: 'Créer une copie', detail: 'ta version devient un nouveau projet ; Drive ne change pas' },
    ],
  }),
  quandChange: () => {
    afficherEcranProjet();
    mettreAJourEtatEntete();
    fenetreReglages?.rafraichir();
  },
  message: (texte) => afficherMessage(texte, 4000),
});

// L'appli passe en arrière-plan (on change d'appli, on éteint l'écran) : on envoie tout de suite.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') partage.envoyerMaintenant();
});

const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPosition: toucherPourCoupe,
  // Un point touché va à la liste en cours : celle d'une mesure (onglet Calculs › Mesures) ou d'une surface.
  quandToucherPoint: (nom) => (ongletContexte === 'mesures' ? ecranMesures.toucherPoint(nom) : editeurSurfaces.toucherPoint(nom)),
  quandToucherMesure: (id) => ecranMesures.choisir(id),
  quandToucherStock: (index) => editeurSurfaces.choisir(index),
  quandToucherTriangle: (triangle) => editeurSurfaces.basculerTriangle(cleTriangle(triangle)),
  quandToucherImplantation: toucherPourImplantation,
  quandReglerPlanDxf: (id, changements) => reglerPlanDxf(id, changements),
  // Menu « Points » : cocher / décocher une liste de points ('*' : toutes). Pas une modification
  // du travail (rien à annuler) : on redessine et on enregistre.
  quandMontrerListe: (id, visible) => {
    if (id === '*') projet.listesCachees = visible ? [] : listesDePoints(projet).map((l) => l.id);
    else montrerListe(projet, id, visible);
    recalculer();
    enregistrer();
  },
});

const editeurSurfaces = creerEditeurSurfaces(document.querySelector('#surfaces'), document.querySelector('#barre-surfaces'), {
  obtenirPoints: (surface) => (estImportee(surface) ? [] : pointsDuLeve(surface.leveId)),
  // Nouvelle surface, ou nature changée : un stock a tout de suite son calcul de volume (sur sa
  // ligne basse), un terrassement aussi (par rapport au dernier terrain naturel). Voir volumes/calculs.js.
  quandNatureChange: (surface) => {
    projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
  },
  importerFichier: importerSurface,
  quandChange: () => {
    // Une surface d'un autre levé est choisie : ce levé devient le levé affiché.
    const surface = editeurSurfaces.objetActif();
    if (surface && !estImportee(surface) && surface.leveId && surface.leveId !== projet.leveActifId) {
      projet.leveActifId = surface.leveId;
    }
    modifie();
  },
  leveActifId: () => leveActif(projet)?.id ?? null,
  decrire: decrireSurface,
  etiquette: etiquetteSurface,
  ajouterPhotos: async (surface, fichiers) => {
    // La conversion d'une photo HEIC prend quelques secondes : le message reste affiché jusqu'à la fin.
    afficherMessage('Préparation de la photo…', null);
    const erreurs = [];
    for (const fichier of fichiers) {
      try {
        surface.photos = [...(surface.photos ?? []), await preparerPhoto(fichier)];
      } catch (erreur) {
        erreurs.push(`${fichier.name} : ${erreur.message}`);
      }
    }
    if (erreurs.length > 0) afficherMessage(`Photo refusée. ${erreurs.join(' ; ')}`, 8000);
    else afficherMessage(`${fichiers.length} photo(s) ajoutée(s)`);
    modifie();
  },
});
editeurSurfaces.charger(projet.surfaces);

/** Après un changement de levé : on montre une surface de ce levé (s'il en a une). */
function montrerUneSurfaceDuLeve() {
  const active = editeurSurfaces.objetActif();
  if (active && (estImportee(active) || active.leveId === projet.leveActifId)) return;
  const index = projet.surfaces.findIndex((s) => s.leveId === projet.leveActifId);
  if (index >= 0) editeurSurfaces.choisir(index);
}

// --- Import d'une surface LandXML ou DXF : chaque surface du fichier devient une surface du projet ---
// Sa nature (stock, terrain naturel, terrassement) est ensuite demandée, comme pour une nouvelle surface.
async function importerSurface(fichier) {
  const zone = document.querySelector('#message-import-surface');
  try {
    const texte = await fichier.text();
    const type = /\.dxf$/i.test(fichier.name) ? 'dxf' : 'landxml';
    const { surfaces, erreurs, avertissements } = type === 'dxf' ? lireDXF(texte) : lireLandXML(texte);
    for (const surface of surfaces) {
      projet.surfaces.push({ ...surfaceImportee(surface, fichier.name, type), nature: null });
    }
    const messages = [...erreurs, ...avertissements];
    zone.innerHTML = `<p class="resume"><strong>${surfaces.length} surface(s)</strong> importée(s) de « ${echapper(fichier.name)} ».</p>
      ${messages.length > 0 ? `<div class="avertissement"><ul>${messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}`;
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    if (surfaces.length > 0) editeurSurfaces.choisir(projet.surfaces.length - 1);
  } catch (erreur) {
    zone.innerHTML = `<p class="erreur">Impossible de lire « ${echapper(fichier.name)} » : ${echapper(erreur.message)}</p>`;
  }
  modifie({ recadrer: true });
}

const ecranVolumes = creerEcranVolumes(document.querySelector('#volumes'), {
  obtenirProjet: () => projet,
  obtenirResultat: (calcul) => resultatsCalculs.get(calcul.id),
  etiquette: etiquetteSurface,
  obtenirMontre: () => calculMontre,
  montrer: (id) => {
    calculMontre = id;
    // La surface 1 d'un autre levé : ce levé devient le levé affiché, pour la voir sur le plan.
    const calcul = projet.calculs.find((c) => c.id === id);
    const surface = projet.surfaces.find((s) => s.id === calcul?.surface1Id);
    if (surface && !estImportee(surface) && surface.leveId !== projet.leveActifId) {
      projet.leveActifId = surface.leveId;
      modifie({ recadrer: true });
    } else {
      recalculer();
    }
    // Sur téléphone, on passe au plan ; sur ordinateur, il est déjà visible à droite.
    if (!window.matchMedia('(min-width: 900px)').matches) afficherOnglet('plan');
  },
  quandChange: () => modifie(),
});

// --- Coupes : tracées en touchant le plan deux fois (début, puis fin) ---

/** Profils des surfaces affichées le long d'une coupe : [{ nom, nature, lignes }] (voir profilSurface). */
function profilsDeCoupe(coupe) {
  return surfacesAffichees().map((s) => ({ nom: s.nom, nature: s.nature, lignes: profilSurface(trianglesDeSurface(s.id), coupe.debut, coupe.fin) }));
}

const estTelephone = () => !window.matchMedia('(min-width: 900px)').matches;

/** Commence le tracé d'une coupe : les deux prochains touchers du plan donnent son début et sa fin. */
function commencerTrace(coupe) {
  editeurSurfaces.arreterModification();
  traceCoupe = { id: coupe.id, etape: 'debut', debut: null };
  afficherMessage(`Coupe ${coupe.nom} : touche le début sur le plan`, null);
  if (estTelephone()) afficherOnglet('plan');
  recalculer();
}

/** Abandonne le tracé en cours (la coupe garde sa position d'avant). */
function arreterTrace() {
  traceCoupe = null;
  afficherMessage('Tracé annulé');
  recalculer();
}

/** Toucher du plan pendant le tracé d'une coupe (position en m, MN95). */
function toucherPourCoupe(touche) {
  const coupe = projet.coupes.find((c) => c.id === traceCoupe?.id);
  if (!coupe) return;
  // Coordonnées arrondies au millimètre.
  const position = { est: Math.round(touche.est * 1000) / 1000, nord: Math.round(touche.nord * 1000) / 1000 };
  if (traceCoupe.etape === 'debut') {
    traceCoupe = { ...traceCoupe, etape: 'fin', debut: position };
    afficherMessage(`Coupe ${coupe.nom} : touche maintenant la fin (${coupe.nom}')`, null);
    recalculer();
    return;
  }
  if (position.est === traceCoupe.debut.est && position.nord === traceCoupe.debut.nord) return; // même point : on attend la fin
  coupe.debut = traceCoupe.debut;
  coupe.fin = position;
  traceCoupe = null;
  afficherMessage(`Coupe ${coupe.nom} – ${coupe.nom}' tracée`);
  if (estTelephone()) afficherOnglet('volumes');
  modifie();
  requestAnimationFrame(() => document.querySelector('#coupes .carte-coupe:last-of-type')?.scrollIntoView({ block: 'center' }));
}

const ecranCoupes = creerEcranCoupes(document.querySelector('#coupes'), {
  obtenirProjet: () => projet,
  obtenirProfils: profilsDeCoupe,
  commencerTrace,
  arreterTrace,
  traceEnCours: () => traceCoupe,
  quandChange: () => modifie(),
});

// --- Mesures (onglet Calculs › Mesures) : longueurs et aires, à part des surfaces et des volumes ---

/** Nom d'une mesure dans les listes : avec sa sorte, et son levé s'il y en a plusieurs. */
function etiquetteMesure(mesure) {
  const texte = `${mesure.nom} (${NOM_TYPE[mesure.type].toLowerCase()})`;
  const leve = projet.leves.find((l) => l.id === mesure.leveId);
  return projet.leves.length > 1 && leve ? `${texte} · ${leve.nom}` : texte;
}

const ecranMesures = creerEcranMesures(document.querySelector('#mesures'), document.querySelector('#barre-mesures'), {
  obtenirProjet: () => projet,
  obtenirPoints: (mesure) => pointsDuLeve(mesure.leveId),
  obtenirResultat: (mesure) => resultatsMesures.get(mesure.id),
  leveActifId: () => leveActif(projet)?.id ?? null,
  etiquette: etiquetteMesure,
  quandChange: () => {
    // Une mesure d'un autre levé est choisie : ce levé devient le levé affiché.
    const mesure = ecranMesures.mesureActive();
    const autreLeve = mesure && mesure.leveId !== projet.leveActifId;
    if (autreLeve) projet.leveActifId = mesure.leveId;
    modifie({ recadrer: autreLeve });
  },
});

/** Mesures du levé affiché, avec leur résultat : [{ mesure, resultat }]. */
function mesuresAffichees() {
  const leve = leveActif(projet);
  return projet.mesures.filter((m) => m.leveId === leve?.id).map((mesure) => ({ mesure, resultat: resultatsMesures.get(mesure.id) }));
}

// Export des mesures : à part de celui des volumes (aucun volume dedans).
creerEcranExportMesures(document.querySelector('#export-mesures'), {
  obtenirDonnees: () => {
    const leve = leveActif(projet);
    return {
      mesures: mesuresAffichees().filter(({ resultat }) => resultat && !resultat.erreurs),
      points: leve?.points ?? [],
      fichierPoints: leve?.nom ?? '',
      cartouche: projet.cartouche,
    };
  },
});

/** Calculs de volume du projet dont le résultat est connu : [{ calcul, resultat }]. */
function calculsReussis() {
  return projet.calculs
    .map((calcul) => ({ calcul, resultat: resultatsCalculs.get(calcul.id) }))
    .filter(({ resultat }) => resultat && !resultat.erreurs);
}

creerEcranExport(document.querySelector('#export'), {
  obtenirDonnees: () => {
    const leve = leveActif(projet);
    const surfaceDe = (id) => projet.surfaces.find((s) => s.id === id);
    const nom = (calcul) => nomDuCalcul(calcul, projet.surfaces);
    // Feuille principale du PDF : calculs sur toute la surface 1 ; les calculs limités au
    // contour d'une surface ont chacun leur feuille.
    const dansUnContour = ({ calcul }) => !calcul.uneSeule && calcul.zone?.type === 'surface';
    const principaux = calculsReussis().filter((c) => !dansUnContour(c));
    const affichees = surfacesAffichees();
    const creees = affichees.filter((s) => !estImportee(s));
    return {
      nomProjet: titreProjet(projet),
      stocks: principaux.map(({ calcul }) => ({ ...surfaceDe(calcul.surface1Id), nom: nom(calcul), description: descriptionCalcul(calcul, projet.surfaces) })),
      resultats: principaux.map(({ resultat }) => resultat),
      comparaisons: calculsReussis()
        .filter(dansUnContour)
        .map(({ calcul, resultat }) => ({ nom: nom(calcul), description: descriptionCalcul(calcul, projet.surfaces), resultat })),
      volumes: projet.calculs.map((calcul) => ({ nom: nom(calcul), base: texteBase(calcul, projet.surfaces), resultat: resultatsCalculs.get(calcul.id) })),
      // DXF et LandXML : les surfaces affichées, avec ou sans volume.
      dessinSurfaces: {
        stocks: creees,
        resultats: creees.map((s) => ({ trianglesDessus: trianglesDeSurface(s.id) })),
        surfaces: affichees
          .filter(estImportee)
          .map((s) => ({ nom: s.nom, triangles: trianglesDeSurface(s.id) }))
          .filter((s) => s.triangles.length > 0),
      },
      points: leve?.points ?? [],
      fichierPoints: leve?.nom ?? '',
      // Photos des surfaces affichées (case « Photos » de l'export).
      photos: surfacesAffichees().flatMap((s) => (s.photos ?? []).map((photo) => ({ ...photo, surface: s.nom }))),
      cartouche: projet.cartouche,
      // Coupes cochées « dans le PDF », avec les profils des surfaces traversées.
      coupes: projet.coupes
        .filter((coupe) => coupe.dansPdf && coupe.debut && coupe.fin)
        .map((coupe) => ({ ...coupe, profils: profilsDeCoupe(coupe) })),
    };
  },
});

/** État d'une surface sous ses réglages : triangles, surface en plan, problèmes. */
function decrireSurface(surface) {
  const r = surfacesCalculees.get(surface.id);
  if (!r) return '';
  if (r.erreurs) return `<div class="erreur"><ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
  let aire = 0;
  for (const [a, b, c] of r.triangles) aire += Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
  const calcul = calculDuPlan(surface);
  const volume = calcul ? resultatsCalculs.get(calcul.id) : null;
  return `
    <p class="ok">✓ ${r.triangles.length} triangles · ${formaterNombre(aire)} m²${volume ? ` · remblai ${formaterNombre(volume.remblai)} m³` : ''}</p>
    ${r.avertissements.length > 0 ? `<div class="avertissement"><ul>${r.avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : ''}`;
}

// --- Calculs et affichage ---

/** Recalcule tout (surfaces, volumes) et met à jour les écrans et le plan. */
function recalculer({ recadrer = false } = {}) {
  const leve = leveActif(projet);
  // Toujours la même liste vide : une nouvelle liste à chaque fois recadrerait le plan (voir plus bas).
  const points = leve?.points ?? AUCUN_POINT;

  surfacesCalculees = new Map(projet.surfaces.map((s) => [s.id, calculerSurface(s, pointsDuLeve(s.leveId))]));
  const donnees = { surfaces: projet.surfaces, triangulations: surfacesCalculees, pointsDe: (s) => pointsDuLeve(s.leveId) };
  resultatsCalculs = new Map(projet.calculs.map((c) => [c.id, calculerVolume(c, donnees)]));
  resultatsMesures = new Map(projet.mesures.map((m) => [m.id, calculerMesure(m, pointsDuLeve(m.leveId))]));

  for (const element of document.querySelectorAll('.sans-points')) element.hidden = projet.leves.length > 0;
  // En-tête : le projet ouvert en grand (affaire - lieu), puis son nom et ce qu'il contient.
  mettreAJourEtatEntete();

  editeurSurfaces.rafraichir();
  ecranVolumes.afficher();
  ecranCoupes.afficher();
  ecranMesures.afficher();
  ecranDessin.afficher(donneesDessin());
  ecranImport.afficher(projet, dernierImport, dernierPlan);
  plan.afficherPlansDxf(plansDuProjet());
  // Point à implanter de la liste : ses coordonnées à jour (Annuler a pu l'enlever).
  if (implanter.cible?.id) {
    const point = projet.aImplanter.find((p) => p.id === implanter.cible.id);
    implanter.cible = point ? { ...point } : null;
  }
  envoyerImplantationAuPlan();
  ecranLeve?.afficher(donneesLeve());
  afficherEcranProjet();
  // Téléphone, onglet Terrain : le plan reste en haut de l'écran (voir style.css), plus petit
  // en mode Implanter pour laisser la place aux coupes.
  document.body.classList.toggle('mode-leve', Boolean(ecranLeve));
  document.body.classList.toggle('mode-controle', Boolean(ecranLeve) && terrain.mode === 'controler');
  mettreAJourToucheVolume();

  // Plan : les listes de points cochées (menu « Points » : surfaces, métrés, Autres, fichiers,
  // points ajoutés) ; leurs points, et seulement les contours, lignes et triangles des surfaces cochées.
  // Pendant une modification (surface, mesure), comme avant : les points et surfaces du levé affiché.
  const listes = listesDePoints(projet);
  plan.afficherListesPoints(listes);
  const active = editeurSurfaces.objetActif();
  const calculActif = active ? surfacesCalculees.get(active.id) : null;
  const dansSurfaces = ongletContexte === 'surfaces';
  const enModification = ongletContexte === 'mesures' || editeurSurfaces.enModification();
  const cacheesParListe = new Set(listes.filter((l) => !l.visible).map((l) => l.id));
  const visibles = new Set(enModification ? surfacesAffichees() : projet.surfaces.filter((s) => !cacheesParListe.has(s.id)));
  // Une surface importée montre ses propres points ; sinon, ceux du levé ou des listes cochées.
  let pointsDuPlan;
  if (dansSurfaces && active && estImportee(active)) pointsDuPlan = active.points;
  else if (enModification) pointsDuPlan = points;
  else pointsDuPlan = pointsStables(pointsDesListes(projet, listes));
  if (ongletContexte === 'mesures') {
    // Onglet 3. Mesures : seulement les points et les mesures (aucune surface, aucune coupe).
    plan.redessiner({
      modeMesures: true,
      mesures: mesuresAffichees(),
      mesureActive: ecranMesures.mesureActive(),
      listeEnCours: ecranMesures.listeEnCours(),
      enEdition: ecranMesures.enModification(),
      stocks: [],
      stockActif: null,
      cachees: new Set(),
      resultats: [],
      ecarts: null,
      surface: null,
      modeTriangles: false,
      coupes: [],
      traceCoupe: null,
    });
  } else plan.redessiner({
    ...editeurSurfaces.obtenirDessin(),
    cachees: new Set(projet.surfaces.filter((s) => !visibles.has(s))),
    resultats: projet.surfaces.map((s) => {
      const triangulation = surfacesCalculees.get(s.id);
      const calcul = calculDuPlan(s);
      const volume = calcul ? resultatsCalculs.get(calcul.id) : null;
      return {
        // Le volume d'abord : ses triangles du dessus sont limités à la zone du calcul,
        // mais le plan dessine toujours la surface entière.
        ...(volume ?? {}),
        trianglesDessus: triangulation?.triangles ?? null,
        segmentsEnErreur: triangulation?.segmentsEnErreur ?? [],
      };
    }),
    ecarts: null,
    // Triangles supprimés à la main : montrés (en pointillés) pendant la suppression au doigt.
    surface:
      dansSurfaces && calculActif && !calculActif.erreurs && editeurSurfaces.enSuppression()
        ? { triangles: calculActif.triangles, trianglesRetires: calculActif.trianglesRetires }
        : null,
    modeTriangles: dansSurfaces && editeurSurfaces.enSuppression(),
    // Coupes tracées (A – A', B – B'), et celle en cours de tracé.
    coupes: projet.coupes.filter((c) => c.debut && c.fin && c.id !== traceCoupe?.id),
    traceCoupe,
    // Onglet Terrain : le volume en petit dans un coin, pas en grand au milieu du stock ;
    // en mode Implanter, aucune étiquette (volume, mesures).
    volumesDiscrets: ongletContexte === 'terrain',
    sansVolumes: ongletContexte === 'terrain' && terrain.mode === 'controler',
    // Mesures (aires, longueurs, nombres) des métrés cochés dans « Afficher » (et celles faites à la
    // main si « Mesures » est cochée) ; dans Terrain › Lever, toujours celles du métré en cours ;
    // dans Terrain › Implanter, aucune.
    mesures: mesuresDuPlan(listes),
    mesureActive: null,
  });
  if (recadrer || pointsDuPlan !== pointsAffiches) {
    pointsAffiches = pointsDuPlan;
    nombrePointsAffiches = pointsDuPlan.length;
    plan.afficherPoints(pointsDuPlan);
  } else if (pointsDuPlan.length !== nombrePointsAffiches) {
    // Point levé avec le récepteur (ou effacé) : même liste, un point de plus ou de moins.
    nombrePointsAffiches = pointsDuPlan.length;
    plan.mettreAJourPoints(pointsDuPlan);
  }
  basculerModeDessin();
}

/**
 * Sur téléphone, pendant une modification (contour, ligne de rupture, triangles) :
 * le plan reste affiché en haut de l'écran et les outils en dessous (voir style.css, « mode-dessin »).
 */
function basculerModeDessin() {
  const dansMesures = ongletContexte === 'mesures';
  const dansDessin = ongletContexte === 'dessin';
  let enDessin = dansMesures ? ecranMesures.enModification() : editeurSurfaces.enModification();
  if (dansDessin) enDessin = piloteActif();
  const debut = enDessin && !document.body.classList.contains('mode-dessin');
  document.body.classList.toggle('mode-dessin', enDessin);
  if (!debut) return;
  // On revient à l'onglet (s'il était sur le plan seul), puis on montre la carte modifiée.
  const onglet = dansMesures ? 'mesures' : dansDessin ? 'dessins' : 'surfaces';
  if (document.body.dataset.onglet === 'plan') afficherOnglet(onglet === 'dessins' ? 'dessin' : onglet);
  requestAnimationFrame(() => document.querySelector(`#${onglet} .en-edition`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
let pointsAffiches = null;
const AUCUN_POINT = [];
// Points des listes cochées : toujours le même tableau (son contenu change), pour que le plan ne
// se recadre pas à chaque point levé ou à chaque liste cochée (voir recalculer).
const POINTS_DES_LISTES = [];
function pointsStables(nouveaux) {
  const pareil = nouveaux.length === POINTS_DES_LISTES.length && nouveaux.every((p, i) => p === POINTS_DES_LISTES[i]);
  if (!pareil) POINTS_DES_LISTES.splice(0, POINTS_DES_LISTES.length, ...nouveaux);
  return POINTS_DES_LISTES;
}
let nombrePointsAffiches = 0;

// --- Enregistrement automatique ---
let minuterie = null;

/** Après chaque modification : recalcule, retient l'étape (Annuler), puis enregistre un court instant plus tard. */
function modifie(options) {
  // Une surface supprimée : ses calculs de volume disparaissent avec elle.
  projet.calculs = nettoyerCalculs(projet.calculs, projet.surfaces);
  recalculer(options);
  historique.memoriser(modifications, projet);
  mettreAJourAnnuler();
  enregistrerBientot();
}

function enregistrerBientot() {
  clearTimeout(minuterie);
  minuterie = setTimeout(enregistrer, 400);
}

// --- Annuler / Rétablir ---

const boutonAnnuler = document.querySelector('#bouton-annuler');
const boutonRetablir = document.querySelector('#bouton-retablir');

// Plus de boutons Annuler / Rétablir dans l'en-tête (version 0.54.0) : Ctrl+Z / Ctrl+Y restent (ordinateur).
function mettreAJourAnnuler() {
  if (boutonAnnuler) boutonAnnuler.disabled = !historique.peutAnnuler(modifications);
  if (boutonRetablir) boutonRetablir.disabled = !historique.peutRetablir(modifications);
}

/** Remplace le projet affiché par un état de l'historique, en restant au même endroit dans les écrans. */
function revenirA(etat, message) {
  if (!etat) return;
  projet = completerProjet(etat);
  editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
  recalculer();
  mettreAJourAnnuler();
  afficherMessage(message);
  enregistrerBientot();
}

const annulerModification = () => revenirA(historique.annuler(modifications), 'Modification annulée');
const retablirModification = () => revenirA(historique.retablir(modifications), 'Modification rétablie');
boutonAnnuler?.addEventListener('click', annulerModification);
boutonRetablir?.addEventListener('click', retablirModification);

// Raccourcis clavier (ordinateur) : Ctrl+Z annule, Ctrl+Y ou Ctrl+Maj+Z rétablit.
// Dans une case de texte, on laisse le navigateur annuler la frappe.
document.addEventListener('keydown', (evenement) => {
  if (!(evenement.ctrlKey || evenement.metaKey) || evenement.target.closest('input, textarea, select')) return;
  const touche = evenement.key.toLowerCase();
  if (touche === 'z' && !evenement.shiftKey) annulerModification();
  else if (touche === 'y' || (touche === 'z' && evenement.shiftKey)) retablirModification();
  else return;
  evenement.preventDefault();
});

/** Ligne sous le titre du projet (en-tête) : nom, points, surfaces, et l'état de Drive si connecté. */
function mettreAJourEtatEntete() {
  // Titre : affaire - lieu (ou le nom, sinon « Projet sans nom 2 »…).
  document.querySelector('#titre-projet').textContent = titreProjet(projet);

  const points = leveActif(projet)?.points ?? AUCUN_POINT;
  const drive = partage?.etat.connecte
    ? { 'a-jour': 'Drive ✓', envoi: 'Drive …', repris: 'Drive' }[partage.etat.etat] ?? 'Drive : en attente'
    : '';
  document.querySelector('#etat').textContent = [sousTitreProjet(projet), `${points.length} points`, `${surfacesAffichees().length} surface(s)`, drive].filter(Boolean).join(' · ');

  // Verrou du partage : main verte (on a la main) ou « 🔒 Lecture seule · Tablette Paul » en rouge
  // (un autre appareil l'a ; toucher = prendre la main). Rien sans Drive.
  const pastille = document.querySelector('#pastille-verrou');
  const repris = partage?.etat.connecte && partage.etat.repris?.projetId === projet.id ? partage.etat.repris : null;
  pastille.hidden = !partage?.etat.connecte;
  if (repris) pastille.textContent = `🔒 Lecture seule · ${repris.nom}`;
  else pastille.innerHTML = `<svg class="main-verrou" viewBox="0 0 24 24" aria-hidden="true">${ICONE_MAIN}</svg>`;
  pastille.className = `pastille-entete ${repris ? 'pastille-rouge' : 'pastille-verte'}`;
  pastille.title = repris ? 'Ouvert sur un autre appareil : toucher pour prendre la main' : 'Tu as la main sur ce projet';
}
document.querySelector('#pastille-verrou').addEventListener('click', () => {
  if (partage?.etat.repris?.projetId === projet.id) partage.reprendreLaMain();
  else afficherMessage('Tu as la main sur ce projet', 2000);
});

/** Petit message sous l'en-tête, qui disparaît tout seul après "duree" millisecondes (null : il reste). */
let minuterieMessage = null;
function afficherMessage(texte, duree = 2000) {
  let zone = document.querySelector('#message-flottant');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'message-flottant';
    zone.className = 'message-flottant';
    zone.setAttribute('role', 'status');
    document.body.append(zone);
  }
  zone.textContent = texte;
  zone.hidden = false;
  clearTimeout(minuterieMessage);
  if (duree !== null) minuterieMessage = setTimeout(() => (zone.hidden = true), duree);
}

async function enregistrer() {
  projet.modifieLe = new Date().toISOString();
  try {
    await stockage.enregistrerProjet(projet);
    stockage.memoriserDernierProjet(projet.id);
    // Seul le résumé du projet ouvert change : on ne relit pas tous les projets de l'appareil
    // (trop lent avec des plans DXF et des photos).
    mettreAJourResume(projet);
    afficherEcranProjet();
    partage?.projetEnregistre();
  } catch (erreur) {
    console.error(erreur);
    document.querySelector('#etat').textContent = `Enregistrement impossible : ${erreur.message}`;
  }
}

async function rafraichirListe() {
  resumes = (await stockage.listerProjets()).map(resumerProjet).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

/** Met à jour le résumé d'un projet dans la liste (sans relire les autres). */
function mettreAJourResume(lequel) {
  resumes = [resumerProjet(lequel), ...resumes.filter((r) => r.id !== lequel.id)].sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

/** Étape où reprendre le travail : les surfaces si le projet a déjà des points, sinon l'import. */
const etapeUtile = () => (leveActif(projet) ? 'surfaces' : recepteurDisponible() ? 'terrain' : 'leves');

/**
 * Va à un onglet, ou à la liste des levés ('leves') : onglet Terrain dans l'appli Android s'il n'y
 * a encore aucun levé, sinon le bloc des levés de l'onglet Projet (import de fichiers, « Mes levés »).
 */
function allerA(onglet) {
  if (onglet !== 'leves') {
    afficherOnglet(onglet);
    return;
  }
  if (recepteurDisponible() && projet.leves.length === 0) {
    afficherOnglet('terrain');
    return;
  }
  afficherOnglet('projets');
  requestAnimationFrame(() => document.querySelector('#importer')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

/**
 * Ouvre un projet : il devient le projet affiché, et il est enregistré.
 * Puis on va à l'étape utile (voir etapeUtile).
 */
async function ouvrir(nouveau, { changerOnglet = true } = {}) {
  projet = nouveau;
  implanter.choix = null;
  implanter.cible = null;
  implanter.pointsLigne = [];
  implanter.ligne = null;
  implanter.talusId = null;
  autocontrole.cible = null;
  dernierImport = null;
  document.querySelector('#message-import-surface').innerHTML = '';
  editeurSurfaces.charger(projet.surfaces);
  montrerUneSurfaceDuLeve();
  recalculer({ recadrer: true });
  historique.reinitialiser(modifications, projet);
  mettreAJourAnnuler();
  if (changerOnglet) afficherOnglet(etapeUtile());
  await enregistrer();
  // RX2 déjà connecté : rappel du contrôle pour ce projet, s'il en faut un.
  if (etatRecepteur?.connecte) proposerControle();
}

/**
 * Nouveau projet, avec un nom automatique tant qu'il n'a ni affaire, ni lieu, ni nom (« Projet sans
 * nom 2 »… : jamais le même qu'un projet de l'appareil ou de Drive).
 */
function nouveauProjetSansNom() {
  const nouveau = creerProjet();
  nouveau.nomAuto = nomAutomatique([...resumes.map((r) => r.titre), ...(partage?.etat.projetsDrive ?? []).map((p) => p.titre)]);
  return nouveau;
}

// --- Démarrage : on rouvre le dernier projet, sinon le plus récent, sinon un nouveau ---
// L'appli s'ouvre sur l'onglet Projet (bouton « Continuer » pour reprendre le travail).
async function demarrer() {
  afficherOnglet('projets');
  adapterAuMode();
  stockage.demanderStockagePersistant();
  try {
    await rafraichirListe();
    const id = stockage.dernierProjet();
    const lu = (id && (await stockage.lireProjet(id))) || (resumes[0] && (await stockage.lireProjet(resumes[0].id)));
    await ouvrir(lu ? completerProjet(lu) : nouveauProjetSansNom(), { changerOnglet: false });
    // Partage : on se reconnecte à Drive si on l'était (le projet ouvert est alors comparé à Drive).
    partage.demarrer();
  } catch (erreur) {
    // Base de données indisponible (navigation privée...) : l'appli marche, sans enregistrement.
    console.error(erreur);
    recalculer({ recadrer: true });
    historique.reinitialiser(modifications, projet);
    document.querySelector('#etat').textContent = 'Attention : enregistrement impossible sur cet appareil';
  }
}
demarrer();
