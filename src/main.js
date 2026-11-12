// Point de départ de l'application : ce fichier construit la page et relie les écrans entre eux.
//
// Tout est rangé dans le "projet" ouvert (voir projet/projet.js), enregistré automatiquement
// sur l'appareil après chaque modification.
import { adresseParRelais } from './import/relais.js';
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { lireLandXML, fusionnerSurfaces } from './topo/landxml.js';
import { creerSurfaceSwisstopo } from './import/zone-swisstopo.js';
import { creerCadastreAutour } from './import/zone-cadastre.js';
import { lectureAndroidDisponible, lireParAndroid } from './android/pont.js';
import { lireDXF } from './topo/dxf-lecture.js';
import { texteDuDxf, lirePlanDxf, estEnMn95 } from './topo/dxf-plan.js';
import { lireTypesDxf, enregistrerTypesDxf, nettoyerTypes } from './topo/types-dxf.js';
import { dxfDuPdf, lireEchelle, PREFIXE_PDF } from './topo/pdf-dxf.js';
import { chargerPdfjs, ouvrirPdf, contenuDeLaPage, imageDeLaPage } from './import/pdf.js';
import { NETTETES, NETTETE_DEPART, facteurDeRendu, planImagePdf } from './topo/pdf-image.js';
import { formaterNombre } from './topo/format.js';
import { calculerSurface, surfaceImportee, cleTriangle, estImportee, estSurfaceFichier, origineSurface, nomNature, nouvelIdentifiant, NATURES_IMPORT, avecPrefixe, sansPrefixe, prefixeDuNom, dateDuJourCollee, PREFIXE_SURFACE } from './topo/surface.js';
import { calculsAutomatiques, calculerVolume, nettoyerCalculs, nomDuCalcul, descriptionCalcul, nouveauVolume } from './volumes/calculs.js';
import { talusDePlateforme, PENTES_TALUS } from './topo/plateforme-talus.js';
import { tranchesDeTalus, texteDePente } from './topo/tranches-talus.js';
import { contourDeSurface, talusParCotes, surfaceAvecTalus, tranchesDesCotes, tronconsAImplanter, reglageComplet } from './topo/talus-cotes.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurSurfaces } from './surfaces/editeur.js';
import { creerEcranVolumes, texteBase } from './volumes/ecran.js';
import { preparerPhoto } from './photos/photo.js';
import { creerEcranExport, telecharger, enregistrer as enregistrerFichier } from './export/ecran.js';
import { ouvrirFenetreExport } from './export/fenetre-export.js';
import { FORMATS_POINTS, fichierPoints } from './export/points.js';
import { creerEcranProjet, blocPartage, projetsReunis } from './projet/ecran.js';
import { ouvrirCarteProjets } from './projet/carte.js';
import { creerEcranImport } from './import/ecran.js';
import { creerEcranCoupes, nouvelleCoupe } from './coupes/ecran.js';
import { creerEcranMesures } from './mesures/ecran.js';
import { creerEcranDessin } from './dessin/ecran.js';
import { creerEcranTalusSurface } from './dessin/talus-surface.js';
import { gisement, directionTournee, passerParSommet, altitudeProchainSommet, altitudeSelonChoix, pointSelonGisement, rectangle, airePolygone, longueursCotes, estFerme, altitudesDuDessin, nomDessin, pointsDuDessin, cotesDuDessin, coteSousLeDoigt, surfaceDuDessin } from './topo/dessin.js';
import { creerModuleExport } from './export/module.js';
import { calculerMesure } from './topo/mesure.js';
import { NOM_TYPE } from './mesures/valeurs.js';
import { profilSurface, decalerProfil } from './topo/coupe.js';
import { guidageLame, TOLERANCES_LAME, pointDeProfil, bordsDeLaLame, sensCoupeLame, pointsGuidageLame, coupeEntre, coupeMilieuLame, avantDeLaLame, classeEcartLame, ecartAUneLigne } from './topo/lame.js';
import { echapper } from './outils/echapper.js';
import {
  creerProjet,
  ajouterLeve,
  leveActif,
  dupliquerProjet,
  ecrireFichierProjet,
  lireFichierProjet,
  completerProjet,
  prefixerNoms,
  resumerProjet,
  titreProjet,
  nomAutomatique,
  sousTitreProjet,
  nomDeFichierProjet,
} from './projet/projet.js';
import * as stockage from './projet/stockage.js';
import { creerPartage } from './partage/partage.js';
import * as historique from './projet/historique.js';
import { archiver, restaurer, supprimerArchive } from './projet/archives.js';
import { lireJournal, ecrireJournal, noter, aUnControleRecent } from './recap/journal.js';
import { appareil as appareilDuJournal } from './partage/memoire.js';
import { bulle, installerAide } from './aide/bulles.js';
import { creerEcranLeve, mettreAJourBandeaux, LONGUEURS_COUPE, EXAGERATIONS_COUPE, ACCROCHES } from './leve/ecran.js';
import { creerEncartPlan } from './plan/encart.js';
import { creerBoutonImplanterPlan } from './plan/bouton-implanter.js';
import { suivreClavier } from './outils/clavier.js';
import { pointAvecDelta, deltaActif } from './topo/delta.js';
import { ligneDecalee, rangerLigneDecalee } from './topo/ligne-decalee.js';
import { pointsOutil, penteEngin } from './topo/outil.js';
import { creerDao } from './dao/dao.js';
import { creerBoutonRecepteur } from './leve/recepteur.js';
import { surChangementListes } from './reglages/listes-partagees.js';
import { lireDossiers, ecrireDossiers, dossiersTries, dossierDuProjet, ajouterDossier, renommerDossier, supprimerDossier, rangerProjet, SANS_DOSSIER } from './projet/dossiers.js';
import { imageAvecDessins, ouvrirEditeurDessin, photosAvecDessins } from './photos/annotation.js';
import { creerSuiviOrientation } from './leve/orientation.js';
import { ecouterBoussole } from './leve/boussole.js';
import { lireLibellesChantier, lireNaturesChantier, libelleChantier, couleurNatureChantier } from './leve/libelles-chantier.js';
import { lireAttributsChantier, altitudesDuPoint, cadreDeTroisCoins, RAYON_TAMPON_ROND } from './topo/chantier.js';
import { lireLibelles, recreerLibellesManquants, definirLibellesProjet, surLibellesProjet } from './leve/libelles.js';
import { modifierLibellesDeSorte } from './leve/fenetre-libelles.js';
import { ouvrirFenetreChantier } from './leve/fenetre-chantier.js';
import { altitudeSurSurface, ecartSurface, classeEcart, extremitesCoupe, chercheurAltitude, directionDeMarche, pointLePlusProche } from './topo/implantation.js';
import { guidageTalus, zoneTalus, sourceAltitudeLigne, talusComplet, textePente } from './topo/talus.js';
import { guidageLigne, sommetsChoisis, longueurPolyligne, ligneParallele, ecartAuBout } from './topo/ligne-implantation.js';
import { MODES_ACCROCHE, piedPerpendiculaire, accrocher, accrocherTrait, sourcesDesPlans, guidage, ecartsImplantation, classeDistance, nomPointAImplanter, csvImplantations } from './topo/accroche.js';
import {
  estLeveDirect,
  creerListeDeLevee,
  nommerListeDeLevee,
  leveDepuisFichier,
  creerLeveeDuDessin,
  synchroniserLeveeDuDessin,
  creerSurfaceDirecte,
  creerAutres,
  creerChantier,
  prochainNom,
  nomsDuProjet,
  rolesPermis,
  ajouterPointDirect,
  annulerDernierPoint,
  nouvelleLigne,
  basculerFermeture,
  ligneEnCours,
  resumeStock,
  supprimerLevee,
  pointsDeLaLevee,
} from './topo/leve-direct.js';
import { segmentCroise, supprimerSegment, ajouterPointExistant, horsDuContour, supprimerPointDuLevee, placeDuPoint, nomDeLigne, suitesLibres, creerLignesDepuisSuites } from './topo/lignes-levee.js';
import { retirerPointDuProjet, retirerPointDesMesures, texteUsages, usagesDuPoint } from './topo/retirer-point.js';
import { installerMesureDuree } from './outils/mesure-duree-ui.js';
import { regleToucheVolume, recepteurDisponible, ecouterRecepteur, choisirRecepteur, reconnecterRecepteur, deconnecterRecepteur, prendrePointRecepteur, consommerPointMoyen } from './android/pont.js';
import { correctionsTropAnciennes } from './topo/age-corrections.js';
import { centreDePoints, MAX_POINTS_CENTRE } from './topo/centre-points.js';
import { correctionsDisponibles, lireReglagesCorrections, demarrerCorrections, arreterCorrections, estDansAppliAndroid, ecouterPositionTablette } from './android/pont.js';
import { sortesDePhrases, lignesBatterie } from './topo/nmea-sortes.js';
import { journalNmeaDisponible, demarrerJournalNmea, lireJournalNmea } from './android/pont.js';
import { recepteur2Disponible, ecouterRecepteur2, choisirRecepteur2, deconnecterRecepteur2, choisirModeCorrections2, lireReglagesCorrections2, demarrerCorrections2, arreterCorrections2 } from './android/pont.js';
import { creerNavigation } from './navigation/bande.js';
import { mesureRapide } from './topo/mesure-rapide.js';
import { rangerMesureRapide } from './topo/mesure-rapide-levee.js';
import { htmlMesureRapide, nombreDePages } from './mesure-rapide/ecran.js';
import { htmlAnnotation, htmlBandeauAnnotation, dateHeure } from './annotation/ecran.js';
import { htmlEncadreAnnotation } from './annotation/encadre.js';
import { ajouterAnnotation, trouverAnnotation, supprimerAnnotation, listesAnnotation, nettoyerRemarques, precisionSuffisante, estAnnotation, nomProposeAnnotation, dernierAnnotation, PRECISION_TABLETTE_DEPART } from './topo/annotation.js';
import { applisDisponibles, appliCourante } from './navigation/applis.js';
import { aAcces, appliquerReglages, estModeBase, lameActive, ouvrirReglages } from './reglages/reglages.js';
import { sonValidation, sonRefus, sonPerteFix, sonRetourFix, vibrer, piloterBip } from './outils/son.js';
import { rythmeBip } from './topo/bip.js';
import { ecartsControle, resultatControle, estControleReussi, controleNecessaire, lireTolerances, csvControles, ajouterPointsControle, delaiControleMs, lireDelaiControle, couleurImplantation, classeTolerance, TOLERANCES_PAR_DEFAUT } from './topo/controle.js';
import { noterAffichage, appliquerAffichage } from './projet/affichage-appareil.js';
import { listesDePoints, pointsDesListes, montrerListe, mesuresVisibles, couleursDesPoints, listeDesPoints, pointsDesImports, planDuCadastre, lierCadastres, COULEUR_CADASTRE, LISTE_CONTROLE, LISTE_MESURES } from './plan/listes-points.js';
import { calculerHelmert, planRecale, calageParAxes, echelleParDeuxPoints } from './topo/recalage.js';
import { nomSuivant, nomPrecedent } from './topo/noms.js';
import { demanderChamps, demanderChoix, demanderTexte } from './outils/choix.js';
import { demanderCode } from './outils/code.js';
import { genererDxfPlan, octetsDxf } from './export/dxf-recale.js';
import { dessinerPlansDxf } from './plan/dxf-canvas.js';
import { fabriquerPaquet } from './export/paquet.js';
import { creerBarreRecalage, etapeAxes } from './recalage/barre.js';
import { ajouterPointAjoute, nomPointAjoute, lireNombreTape } from './topo/points-ajoutes.js';
import { ajouterTous } from './outils/bornes.js';

// Écrans en attente d'être redessinés (0.126.0, voir afficherSiVisible) : nom → { element, fonction }.
const ecransEnAttente = new Map();
const estAffiche = (element) => !element || element.getClientRects().length > 0;

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
// { dessinId, accroche (objet pris en touchant : 'point', 'sommet', 'milieu', 'ligne', 'centre', voir
// topo/accroche.js), direction (gisement en gon, ou null), distance (texte tapé), reference (d'où
// vient la direction : « vers b3 », « 30° à droite »…), angle (texte tapé, en degrés), tourne (degrés
// tournés depuis le prolongement du côté précédent, + = à droite : chaque clic ajoute l'angle),
// altitude (texte tapé : altitude du prochain sommet) }.
// Un toucher sur le plan donne le point de départ (aucun sommet), sinon la direction.
let pilote = null;
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir
// Levé avec le récepteur (appli Android) : levé et stock en cours, rôle du prochain point.
const leveDirect = { stockId: null, role: 'contour' };
// L'écran Lever ne sert plus qu'à l'application Lever (le Recollement et le Métré ont été supprimés en 0.212.0).
/** Famille d'un levé d'après sa nature. */
const familleDeNature = (nature) => (nature === 'annotation' ? 'annotation' : 'leve');
/** Sous-application de Lever (Stock / Terrain / Terrass. / Libre) d'après la nature d'un levé. */
const sousAppliDeNature = (nature) => (nature === 'stock' ? 'stock' : nature === 'autres' ? 'autres' : nature === 'chantier' ? 'chantier' : nature === 'terrassement' ? 'terrassement' : 'terrain');
// Delta du prochain point levé (0.139.0, Intermédiaire) : sens 'gauche' / 'droite' (selon le cap du GNSS),
// distance et Z tapés (texte) ; remis à zéro après chaque point enregistré (un seul point à la fois).
const deltaLeve = { sens: 'droite', distance: '', z: '', ouvert: false }; // ouvert : ligne de réglage montrée (bouton « Δ Delta »)
// Dernier cap du GNSS calculé (degrés), pour décaler le point au moment de l'enregistrer.
let dernierAzimut = null;

/** Delta tapé, en mètres : { lateral (+ = droite), z } ; un nombre mal tapé compte pour 0. */
function deltaEnMetres() {
  if (!aAcces('intermediaire')) return { lateral: 0, z: 0 };
  const lire = (texte) => {
    const n = Number(String(texte ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const distance = Math.abs(lire(deltaLeve.distance));
  return { lateral: deltaLeve.sens === 'gauche' ? -distance : distance, z: lire(deltaLeve.z) };
}
let etatRecepteur = null; // dernier état reçu du récepteur (voir android/pont.js)
let etatRecepteur2 = null; // dernier état du 2e récepteur (essai à 2 RX2, guidage de lame)
// GPS de la tablette (APK, sans RX2 connecté) : { est, nord, precision } ou null ; seulement pour se localiser.
let positionTablette = null;
// Onglet Terrain : mode (Lever ou Contrôler) et réglages du contrôle, retenus sur l'appareil.
const CLE_TERRAIN = 'topo-terrain';
const terrain = {
  mode: 'lever',
  surfaceId: null,
  vueCoupes: 'perpendiculaire',
  demiLongueur: 5,
  exagerationCoupe: 1,
  sourceOrientation: 'rx2',
  libelleLigne: 'HT', // dernier libellé choisi pour une ligne de rupture
  libellePoint: 'TN', // et pour un point isolé (ou compté)
  libelleAire: 'ENR',
  implantation: 'surface', // mode Implanter : implanter une surface ou un point
  altitudeVoulue: null, // mode Implanter « Altitude » : altitude tapée (m)
  bip: true, // 0.107.0 : bip-bip de hauteur (Implanter Altitude / Surface, Guidage)
  hauteurCanne: null, // 0.107.1 : hauteur de canne réglée dans Emlid Flow (m), seulement montrée (Expert la change)
  accroche: 'point', // implantation d'un point : point du projet, sommet, milieu, sur la ligne ou centre (voir topo/accroche.js)
  guidage: 'rx2', // guidage vers le point : 'rx2' (avance / droite selon le cap du RX2) ou 'nseo' (nord / est)
  accrocheLigne: 'trait', // implantation d'une ligne : 'trait' (ligne du plan DXF) ou une accroche de point
  // Implantation d'un talus (voir topo/talus.js) : derniers réglages, repris pour le talus suivant.
  talus: { horizontal: null, vertical: null, ligneEst: 'haut', cote: 'droite', longueur: null, terrainId: null, altitudeSurfaceId: null },
  // Guidage de lame à 2 RX2 (mode Lame, voir topo/lame.js) : surface suivie, gauche / droite inversés, tolérances (m).
  // Profil en long (0.73.0) : point de la lame ('gauche', 'milieu', 'droite'), longueur devant et derrière (m).
  // Machine (0.100.0) : 'grader' ou 'bull' (sens de la coupe, voir topo/lame.js sensCoupeLame).
  lame: { surfaceId: null, inverse: false, tolerances: { ...TOLERANCES_LAME }, machine: 'grader' },
  ...lireReglagesTerrain(),
};
// Levé chantier (0.175.0) : derniers choix (libellé, nature, mode d'altitude, forme, Ø, matériau…) gardés d'un point à l'autre.
terrain.chantier = { libelle: 'T', nature: 'EU', mode: '', forme: 'ronde', diametre: '', gaine: '', nombre: '1', profondeur: '', materiau: 'PVC', remarque: '', ...terrain.chantier };
// Orientation (0.90.1) : toujours le cap du GNSS (la direction de marche sert en secours, sans le dire).
terrain.sourceOrientation = 'rx2';
// Site sans récepteur : seulement le mode Lever (et Contrôle en consultation).
if (!recepteurDisponible()) terrain.mode = 'lever';
// Libellé « Aucun » (0.90.0) choisi à chaque démarrage de l'appli.
terrain.libelleLigne = '';
terrain.libellePoint = '';
terrain.libelleAire = '';
// Anciens réglages (avant 0.73.0) : le profil en long prend ses valeurs de départ.
// 0.144.0 : une seule coupe à la fois (l'ancien « Les 2 » devient « Perpendiculaire »).
if (terrain.vueCoupes !== 'axe') terrain.vueCoupes = 'perpendiculaire';
terrain.lame = { machine: 'grader', ...terrain.lame };
// 0.142.0 : outil à 1 GNSS (râteau, ou Bull à 1 récepteur) : nombre de GNSS du Bull et distances
// depuis le bas du mât jusqu'aux bords de chaque outil (m).
terrain.lame.recepteursBull = terrain.lame.recepteursBull === 1 ? 1 : 2;
terrain.lame.outils = { rateau: { gauche: 0, droite: 0, avant: 0, arriere: 0 }, bull: { gauche: 0, droite: 0, avant: 0, arriere: 0 }, ...(terrain.lame.outils ?? {}) };
// 0.151.0 : coupe Arr – Av des lames (Grader, Bull) : 1 m devant et 1 m derrière au départ.
terrain.lame.outils.grader ??= { avant: 1, arriere: 1, axe: 0 };
// 0.152.0 : vue du Guidage ('plan1' : plan + une coupe ; 'plan2' : plan + 2 coupes côte à côte ;
// 'coupes' : 2 coupes l'une sous l'autre, sans plan), coupe de la vue 'plan1' ('gd' ou 'long') et
// longueur des coupes au-delà de l'outil (m) : 1 m à gauche et à droite, 2 m devant et derrière.
terrain.lame.vue = ['plan1', 'plan2', 'coupes'].includes(terrain.lame.vue) ? terrain.lame.vue : 'plan2';
terrain.lame.coupeSeule = terrain.lame.coupeSeule === 'long' ? 'long' : 'gd';
terrain.lame.marges = { gauche: 1, droite: 1, devant: 2, derriere: 2, ...(terrain.lame.marges ?? {}) };
// 0.190.0 : échelle des coupes du Guidage : largeur (facteur appliqué aux marges) et hauteurs (×1 à ×3).
terrain.lame.zoomMarges = terrain.lame.zoomMarges ?? 1;
terrain.lame.exagerationCoupe = terrain.lame.exagerationCoupe ?? 1;
if (!(terrain.lame.outils.bull.avant > 0) && !(terrain.lame.outils.bull.arriere > 0)) terrain.lame.outils.bull = { ...terrain.lame.outils.bull, avant: 1, arriere: 1 };

/** Vrai si la machine choisie est guidée par un seul GNSS (râteau, ou Bull réglé sur 1 GNSS). */
function outilAUnGnss() {
  return terrain.lame.machine === 'rateau' || (terrain.lame.machine === 'bull' && terrain.lame.recepteursBull === 1);
}
// Implantation d'un point : point choisi en touchant le plan ({ est, nord, altitude, nom, mode }) et
// point à implanter en cours ({ id (point de la liste « À implanter », ou null), nom, est, nord, altitude }).
// Implantation d'une ligne : points choisis pour la faire (pointsLigne : [{ est, nord, altitude, nom }])
// et ligne en cours (ligne : { nom, sommets, segmentTouche, segment (n° ou null : toute la ligne),
// inverse, decalage (m, + à droite), altitudes: { debut, fin } (tapées, ou null) }).
// Talus : la ligne est implanter.ligne, ses réglages terrain.talus ; talusId : talus de « Mes talus »
// ouvert (ses changements y sont gardés), ou null.
// voirLigne (0.118.0) : case « Voir toute la ligne » du plan, décochée au départ et pour chaque nouvelle ligne.
// ligneAValider (0.137.0) : ligne touchée sur le plan, montrée en fiche, pas encore implantée (bouton « Implanter »).
const implanter = { choix: null, cible: null, pointsLigne: [], ligne: null, ligneAValider: false, talusId: null, voirLigne: false };
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

/** Mode de Terrain (Lever, Implanter = 'controler', Contrôle = 'autocontrole', Guidage = 'lame'), choisi dans la barre du bas. */
function choisirModeTerrain(mode) {
  editeurSurfaces.arreterModification();
  const permis = lameActive() ? ['controler', 'autocontrole', 'lame'] : ['controler', 'autocontrole'];
  terrain.mode = permis.includes(mode) ? mode : 'lever';
  retenirReglagesTerrain();
  if (terrain.mode === 'controler') montrerSurfaceControle();
  majBoutonsTerrain();
  recalculer();
}

function retenirReglagesTerrain() {
  try {
    localStorage.setItem(CLE_TERRAIN, JSON.stringify(terrain));
  } catch {
    // Mémoire du navigateur indisponible : les réglages ne seront simplement pas retenus.
  }
}

// --- Mise en page : onglets ---
// Projet (le chantier : levés importés, fichier projet), Terrain (Lever, Implanter, Contrôle, Guidage),
// Calculs (Volumes, Mesures, Dessin : un seul affiché à la fois) et Plan (en plein écran sur téléphone,
// toujours à droite sur ordinateur). On passe de l'un à l'autre par la bande du bas (0.156.0).
// Main ouverte (on a la main sur le projet), dessinée en traits comme les autres icônes.
const ICONE_MAIN = '<path d="M18 11V6a2 2 0 0 0-4 0v5" /><path d="M14 10V4a2 2 0 0 0-4 0v6" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />';

// 0.156.0 (demande du 08.11) : la barre du bas à 7 boutons est remplacée par la bande du bas
// (navigation/bande.js : bouton « application | sous-application », page Applications, roue des favoris).
if (!recepteurDisponible()) document.body.classList.add('sur-site');
// Bande du bas (créée juste après la page, voir « Bande du bas et page Applications »).
let navigation = null;
// Mesure rapide (0.158.0, dès Intermédiaire) : points choisis (jamais enregistrés tant qu'on ne touche pas
// « Enregistrer »), accroche du toucher, page de chaque tableau.
const mesureRapideEtat = { points: [], accroche: 'point', pages: { points: 0, cotes: 0 }, candidat: null, fermee: true, angles: true }; // angles : 0.214.0, coché au départ
// Ajout manuel d'un point en touchant le plan (voir plus bas « Édition Lever sur le site ») ; déclaré ici car afficherOnglet le lit.
const ajoutLevee = { actif: false, accroche: 'point', choix: null };
// Les parties de l'onglet Calculs (ce sont aussi les noms de leurs panneaux) : Volumes, Mesures /
// métrés, Dessin. Plus de « Surfaces » (0.77.0, demande du 27.10.2026) : tout se fait dans
// Terrain › Lever ; son panneau reste caché (l'éditeur garde le levé affiché et les triangles en trop).
const PARTIES_CALCULS = [
  ['volumes', 'Volumes'],
  ['dessin', 'Dessin'],
];
const boutonPartie = ([cle, titre]) => `<button type="button" data-partie="${cle}">${titre}</button>`;
const estPartieCalculs = (nom) => PARTIES_CALCULS.some(([cle]) => cle === nom);
let partieCalculs = 'volumes'; // dernière partie affichée dans Calculs

document.querySelector('#app').innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau panneau-projet" data-onglet="projets">
        <h2 class="titre-partie-projet"><button type="button" class="bouton-retour-partie" data-retour-menu aria-label="Retour au menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button><span id="titre-partie-projet">Contenu du projet</span></h2>
        <div id="projets"></div>
        <div class="onglets-projet" role="group" aria-label="Import et export">
          <button type="button" class="onglet-projet seulement-expert" data-onglet-projet="import" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 10l5 5 5-5M4 21h16" /></svg>Import</button>
          <button type="button" class="onglet-projet" data-onglet-projet="export" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M4 21h16" /></svg>Exporter</button>
        </div>
        <div id="nouveau-projet" class="nouveau-projet-page"></div>
        <div id="importer" hidden></div>
        <div id="exporter-projet" hidden></div>
        <div id="contenu-projet"></div>
        <div id="projets-suite"></div>
      </section>
      <section class="panneau" data-onglet="terrain">
        <h2 class="titre-page seulement-site" id="titre-terrain">Édition Lever</h2>
        <div id="leve-direct"></div>
      </section>
      <nav class="parties-calculs" aria-label="Calculs">
        <div class="groupe-surfaces-volumes">${boutonPartie(PARTIES_CALCULS[0])}</div>
        <div class="groupe-dessin seulement-expert">${boutonPartie(PARTIES_CALCULS[1])}</div>
      </nav>
      <section class="panneau" data-onglet="surfaces">
        <h2>Surfaces ${bulle('surfaces')}</h2>
        <p class="vide sans-points">Aucun point dans le projet.</p>
        <div id="surfaces"></div>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>Volumes ${bulle('volumes')}</h2>
        <div id="volumes"></div>
        <div id="coupes" class="carte-section seulement-intermediaire"></div>
      </section>
      <section class="panneau" data-onglet="mesures" hidden>
        <div id="mesures"></div>
      </section>
      <section class="panneau" data-onglet="dessin">
        <h2>Dessin ${bulle('dessin')}</h2>
        <button type="button" class="bouton seulement-expert bouton-dao" id="bouton-dao">✏ DAO : dessiner sur le plan</button>
        <div id="dessins"></div>
        <div id="talus-surfaces" class="carte-section"></div>
      </section>
      <section class="panneau" data-onglet="mesure-rapide">
        <div id="mesure-rapide"></div>
      </section>
      <section class="panneau" data-onglet="annotation">
        <div id="annotation"></div>
      </section>
      <div id="barre-surfaces" class="barre-edition" hidden></div>
      <div id="barre-mesures" class="barre-edition" hidden></div>
    </div>
    <section class="panneau panneau-plan" data-onglet="plan">
      <div id="plan"></div>
      <div class="boutons-taille-plan">
        <button type="button" class="bouton-taille-plan" data-taille-plan="-1" aria-label="Réduire le plan">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
        </button>
        <button type="button" class="bouton-taille-plan" data-taille-plan="1" aria-label="Agrandir le plan">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
    </section>
  </div>
  <nav class="bande-appli" id="bande-appli" aria-label="Applications"></nav>
`;

// --- Bande du bas et page Applications (0.156.0, demande du 08.11) ---

/** Nom d'une application à l'écran (sur le site, « Lever » s'appelle « Édition Lever »). */
const titreAppli = (appli) => {
  // Pages du projet (0.159.0) : le bouton porte le nom de la page (Projets, Import, Exporter, Contenu).
  if (appli?.cle === 'projet') return { ouvrir: 'Projets', import: 'Import', export: 'Exporter', contenu: 'Contenu', points: 'Liste de points', plans: 'Plans', surfaces: 'Surfaces', archives: 'Archives' }[document.body.dataset.partieProjet] ?? 'Projet';
  return !recepteurDisponible() && appli?.titreSite ? appli.titreSite : (appli?.titre ?? '');
};

/** Boutons d'un écran lus comme sous-applications : [{ cle, titre, actif }]. */
function sousApplisDesBoutons(selecteur, cle, actif) {
  return [...document.querySelectorAll(selecteur)].map((b) => ({ cle: cle(b), titre: b.textContent.trim(), actif: actif(b) }));
}

/**
 * Sous-applications de l'application affichée : Implanter = Point / Ligne / Surface / Talus / Altitude,
 * Guidage = machine, Calculs = Volumes / Mesures / Dessin (0.157.0 : pas le rôle de Lever, il reste
 * sur l'écran). Lues sur les boutons de l'écran : le mode (Base, Intermédiaire, Expert) est donc respecté.
 */
function sousApplis() {
  const cle = appliCourante(document.body.dataset.onglet, terrain.mode);
  if (cle === 'lever') {
    // 0.161.0 : Stock / Terrain / Libre = la nature du levé en cours (Base : seulement Libre).
    const actuelle = leveeEnCours() ? sousAppliDeNature(leveeEnCours().nature) : null;
    // 0.171.0 : simple information (la nature du levé en cours), le toucher ne fait rien (`info`).
    return sousApplisDeLever().map(([c, titre]) => ({ cle: c, titre, actif: c === actuelle, info: true }));
  }
  if (cle === 'implanter') return sousApplisDesBoutons('#leve-direct .choix-implantation-type .puce-choix', (b) => b.dataset.valeur, (b) => b.classList.contains('actif'));
  if (cle === 'guidage') return [['grader', 'Grader'], ['bull', 'Bull'], ['rateau', 'Râteau']].map(([c, titre]) => ({ cle: c, titre, actif: terrain.lame.machine === c }));
  if (cle === 'calculs') {
    return PARTIES_CALCULS.filter(([c]) => c !== 'dessin' || aAcces('expert')).map(([c, titre]) => ({ cle: c, titre, actif: partieCalculs === c }));
  }
  return [];
}

/** Sous-applications de Lever (0.161.0) : natures permises par le mode. */
function sousApplisDeLever() {
  return [['stock', 'Stock'], ['terrain', 'Terrain'], ['terrassement', 'Terrass.'], ['chantier', 'Chantier'], ['autres', 'Libre']].filter(([c]) => aAcces('intermediaire') || c === 'chantier'); // 0.214.0 : en Base, seulement le Levé chantier
}

/**
 * Sous-application de Lever touchée : le levé le plus récent de cette nature devient le levé en cours ;
 * il n'y en a pas encore = on en crée un (fenêtre du nom, comme « + Nouveau »).
 */
function choisirNatureDeLever(sous) {
  const nature = (l) => sousAppliDeNature(l.nature);
  const levees = [...surfacesLevees(), ...projet.autres].filter((l) => !estAnnotation(l) && nature(l) === sous);
  const choisie = levees.filter((l) => l.leveId === projet.leveActifId).at(-1) ?? levees.at(-1);
  if (choisie) {
    if (choisie.id !== leveDirect.stockId) choisirLevee(choisie.id);
    return;
  }
  if (refuserEnLectureSeule()) return;
  ajouterSurfaceLevee(sous);
  const nouvelle = leveeEnCours();
  if (!nouvelle) return;
  demanderTexte({ titre: 'Nom du nouveau levé', valeur: avecPrefixe(dateDuJourCollee(), prefixeDuNom(nouvelle)), prefixe: prefixeDuNom(nouvelle) }).then((nom) => {
    if (nom && nom !== nouvelle.nom) {
      const suite = sansPrefixe(nom, prefixeDuNom(nouvelle));
      if (!suite) return;
      nouvelle.nom = avecPrefixe(suite, prefixeDuNom(nouvelle));
      nommerListeDeLevee(projet, nouvelle);
      modifie();
    }
  });
}

function choisirSousAppli(cle) {
  const appli = appliCourante(document.body.dataset.onglet, terrain.mode);
  const conteneur = document.querySelector('#leve-direct');
  if (appli === 'lever') choisirNatureDeLever(cle);
  else if (appli === 'implanter') conteneur.querySelector(`.choix-implantation-type .puce-choix[data-valeur="${CSS.escape(cle)}"]`)?.click();
  else if (appli === 'guidage') {
    // Comme toucher la machine sur l'écran de choix (il est redessiné tout de suite).
    ecranLeve.revenirAuChoixMachine();
    conteneur.querySelector(`.grosse-machine[data-valeur="${CSS.escape(cle)}"]`)?.click();
  } else if (appli === 'calculs') afficherOnglet(cle);
}

/** Gros bouton de la zone du milieu : il touche le vrai bouton de l'écran (caché, voir body[data-relais]). */
function boutonDeBande(cle, titre, detail, desactive = false, court = null) {
  // 0.172.0 : `court` = texte du mode téléphone (voir .t-long / .t-court).
  const texte = court ? `<span class="t-long">${echapper(titre)}</span><span class="t-court">${echapper(court)}</span>` : echapper(titre);
  return `<button type="button" class="bouton-enreg-bande relais-${cle}" data-nav="action" data-cle="${cle}" ${desactive ? 'disabled' : ''}>
    <span>${texte}</span>${detail ? `<small>${echapper(detail)}</small>` : ''}</button>`;
}

// Vrais boutons de l'écran relayés par la zone du milieu (clé → sélecteur).
const RELAIS_BANDE = {
  prendre: '#leve-direct .cadre-prise .bouton-prendre',
  implanter: '#leve-direct [data-action="implanterChoix"].bouton-implanter, #leve-direct [data-action="implanterLigneChoisie"].bouton-implanter',
  enregistrer: '#leve-direct [data-action="enregistrerImplantation"]',
  dao: '#bouton-dao',
  // 0.167.0 : Implanter › Altitude (bouton « Alti ici ») et Guidage (choix des lignes) sont dans la bande.
  'altitude-ici': '#leve-direct [data-action="prendreAltitudeIci"]',
  // 0.171.0 (maquette B) : L1 (bord G) et L2 (bord D) du Guidage : touchent les cases de l'écran (qui restent visibles).
  'ligne-guidage-0': '#leve-direct [data-action="choisirLignesGuidage"][data-valeur="0"]',
  'ligne-guidage-1': '#leve-direct [data-action="choisirLignesGuidage"][data-valeur="1"]',
  'renommer-levee': '#leve-direct .levee-en-cours .bouton-crayon-levee',
  // 0.162.0 : photo, Changer et + du levé en cours sont dans la bande (la rangée de l'écran est cachée).
  'photo-levee': '#leve-direct .levee-en-cours input[data-champ="photo-levee-globale"]',
  'changer-levee': '#leve-direct .levee-en-cours [data-action="changerLevee"]',
  'nouveau-levee': '#leve-direct .levee-en-cours [data-action="ouvrirChoixNature"]',
};
// Boutons de la bande qui ne cachent aucun bouton d'origine (body[data-relais] ne les note pas).
const RELAIS_SANS_CACHE = ['ligne-guidage-0', 'ligne-guidage-1', 'renommer-levee', 'photo-levee', 'changer-levee', 'nouveau-levee'];
const ICONE_PHOTO_BANDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>';

/**
 * Zone du milieu de la bande (0.157.0 / 0.158.0, validé le 08.11) : un gros bouton qui touche le vrai
 * bouton de l'écran (mêmes contrôles, même touche volume −) :
 * - Lever (appli Android) : Enreg. Pts + nom du prochain point ;
 * - Implanter : « Implanter » + nom du point et altitude (ou nom de la ligne) quand un élément est choisi ;
 *   Point en guidage (dès Intermédiaire) : « Enregistrer l'implantation » ;
 * - Contrôle : « Enregistrer le contrôle » quand un point est visé ;
 * - Calculs › Dessin (Expert) : « DAO » ;
 * - Mesure rapide : voir mesureRapideBande ;
 * ailleurs rien : la bande s'efface. Note aussi quel bouton est relayé (body[data-relais]) pour cacher l'original.
 */
function infoAppli() {
  const html = contenuBande();
  const relais = [...html.matchAll(/data-cle="([a-z-]+)"/g)].map((m) => m[1]).find((cle) => !RELAIS_SANS_CACHE.includes(cle));
  if (relais) document.body.dataset.relais = relais;
  else delete document.body.dataset.relais;
  document.body.classList.toggle('levee-en-bande', html.includes('levee-bande'));
  // 0.167.0 : le choix de la surface est dans la bande : la liste de l'écran est cachée (elle sert de relais).
  document.body.classList.toggle('surface-en-bande', html.includes('data-nav-champ="surface-'));
  return html;
}

/**
 * 0.167.0 (demande du 09.11) : choix de la surface dans la bande, à la manière de « Levé en cours » : petit titre,
 * puis le nom de la surface choisie en ambre (liste déroulante). Les options sont lues sur la vraie liste de l'écran
 * (cachée) ; un choix la change (champDepuisBande).
 */
function selecteurSurfaceBande(champ, titre) {
  const liste = document.querySelector(`#leve-direct select[data-champ="${champ}"]`);
  if (!liste) return '';
  const options = [...liste.options].map((o) => `<option value="${echapper(o.value)}" ${o.selected ? 'selected' : ''}>${echapper(o.textContent.trim())}</option>`).join('');
  // 0.170.0 : la liste (transparente) couvre tout le bloc, flèche ronde comprise : un toucher n'importe où l'ouvre.
  const choisie = [...liste.options].find((o) => o.selected) ?? liste.options[0];
  return `<div class="levee-bande surface-bande"><span class="titre-levee-bande">${titre}</span>
    <span class="valeur-liste-bande">${echapper(choisie?.textContent.trim() ?? '')}</span>
    <select class="liste-bande" data-nav-champ="${champ}" aria-label="${titre}">${options}</select></div>`;
}

/** Un choix fait dans la bande : on le reporte sur le vrai champ de l'écran (mêmes contrôles). */
function champDepuisBande(cle, valeur) {
  const champ = document.querySelector(`#leve-direct [data-champ="${cle}"]`);
  if (!champ) return;
  champ.value = valeur;
  champ.dispatchEvent(new Event('change', { bubbles: true }));
}

function contenuBande() {
  const cle = appliCourante(document.body.dataset.onglet, terrain.mode);
  const trouver = (relais) => document.querySelector(RELAIS_BANDE[relais]);
  if (cle === 'lever') {
    // 0.162.0 : « Levé en cours : nom ✎ », puis photo / Changer / + dans la bande ; Enreg. Pts (appli Android)
    // est un gros bouton fixe au-dessus de la bande, à droite.
    const levee = leveeEnCours();
    const petit = (cleBouton, contenu, titre) => {
      const vrai = trouver(cleBouton);
      return `<button type="button" class="petit-bouton-levee" data-nav="action" data-cle="${cleBouton}" title="${titre}" aria-label="${titre}" ${!vrai || vrai.disabled ? 'disabled' : ''}>${contenu}</button>`;
    };
    // 0.196.0 (maquette B du 10.11) : un seul cadre (liseré et fond de « Levé en cours ») qui réunit photo | Levé en cours | « + ».
    const bloc = levee
      ? `<div class="cadre-levee">
          ${trouver('photo-levee') && aAcces('intermediaire') ? petit('photo-levee', ICONE_PHOTO_BANDE, 'Photo de tout le levé') : ''}
          <div class="levee-bande levee-choix"><span class="titre-levee-bande">Levé en cours</span>
          <button type="button" class="nom-levee-bande" data-nav="action" data-cle="renommer-levee" title="Renommer">${echapper(levee.nom)} ✎</button>
          ${trouver('changer-levee') ? `<button type="button" class="fleche-levee-bande" data-nav="action" data-cle="changer-levee" title="Changer de levé" aria-label="Changer de levé" ${trouver('changer-levee').disabled ? 'disabled' : ''}>▾</button>` : ''}</div>
          ${trouver('nouveau-levee') ? petit('nouveau-levee', '+', 'Nouveau levé') : ''}
        </div>`
      : '';
    const prendre = trouver('prendre');
    const enreg = prendre ? boutonDeBande('prendre', 'Enreg. (Vol. −)', document.querySelector('#leve-direct .cadre-prise [data-champ="nom-point"]')?.value ?? '', prendre.disabled, 'Enreg.') : '';
    return bloc || enreg ? `<div class="zone-levee">${bloc}${enreg}</div>` : '';
  }
  if (cle === 'implanter') {
    if (trouver('implanter')) {
      if (implanter.ligneAValider && implanter.ligne) return boutonDeBande('implanter', 'Implanter', implanter.ligne.nom);
      const nom = document.querySelector('#leve-direct [data-champ="nom-implantation"]')?.value.trim() || implanter.choix?.nom || '';
      const altitude = document.querySelector('#leve-direct [data-champ="altitude-implantation"]')?.value.trim() ?? '';
      return boutonDeBande('implanter', 'Implanter', [nom, altitude ? `H ${altitude}` : ''].filter(Boolean).join(' · '));
    }
    // 0.167.0 : Surface : la surface choisie ; Altitude : le champ « altitude voulue » et « Alti ici ».
    if (terrain.implantation === 'surface') {
      const surface = selecteurSurfaceBande('surface-controle', 'Surface');
      return surface ? `<div class="zone-levee">${surface}</div>` : '';
    }
    if (terrain.implantation === 'altitude') {
      const champ = document.querySelector('#leve-direct [data-champ="altitude-voulue"]');
      const ici = trouver('altitude-ici');
      if (!champ || !ici) return '';
      return `<div class="zone-levee"><div class="levee-bande altitude-bande"><span class="titre-levee-bande">Altitude voulue</span>
        <input type="text" inputmode="decimal" class="champ-bande" data-nav-champ="altitude-voulue" value="${echapper(champ.value)}" placeholder="ex. 412.350" aria-label="Altitude voulue" /></div>
        <button type="button" class="bouton-enreg-bande relais-altitude-ici" data-nav="action" data-cle="altitude-ici" ${ici.disabled ? 'disabled' : ''}><span>📍 Alti ici</span></button></div>`;
    }
    const enregistrer = trouver('enregistrer');
    if (enregistrer && terrain.implantation === 'point' && implanter.cible) {
      // 0.162.0 : nom du point, E / N en tout petit et Z s'il existe dans la bande ; petit bouton « Enr. »
      // (dès Intermédiaire) à droite.
      const c = implanter.cible;
      const detail = `E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}${c.altitude != null ? ` · Z ${formaterNombre(c.altitude)}` : ''}`;
      return `<div class="zone-cible-bande"><div class="cible-bande"><b>${echapper(c.nom ?? '')}</b><small>${echapper(detail)}</small></div>
        ${aAcces('intermediaire') ? `<button type="button" class="bouton-enreg-bande petit relais-enregistrer" data-nav="action" data-cle="enregistrer" title="Enregistrer l'implantation" aria-label="Enregistrer l'implantation" ${enregistrer.disabled ? 'disabled' : ''}><span>Enr.</span></button>` : ''}</div>`;
    }
    return '';
  }
  if (cle === 'guidage') {
    // 0.167.0 : la surface à suivre (plus « levé à suivre ») et le choix des lignes (Expert) dans la bande.
    const surface = selecteurSurfaceBande('surface-lame', 'Surface à suivre');
    if (!surface) return '';
    // 0.171.0 (maquette B) : L1 (violet, bord G) et L2 (orange, bord D) : toucher = choisir la ligne sur le plan.
    const placeEnChoix = lignesGuidage.choix;
    const boutonLigne = (place) => {
      if (!trouver(`ligne-guidage-${place}`)) return '';
      const choisie = lignesGuidage.liste.some((l) => l.place === place);
      return `<button type="button" class="bouton-enreg-bande petit relais-ligne-guidage place-${place} ${placeEnChoix === place ? 'actif' : ''}" data-nav="action" data-cle="ligne-guidage-${place}" title="Choisir la ligne L${place + 1} (bord ${place === 0 ? 'gauche' : 'droit'}) sur le plan"><span>L${place + 1}${choisie ? ' ✓' : ''}</span></button>`;
    };
    // 0.188.0 : L1 / L2 ne sont plus répétés dans la bande (seulement dans l'écran du Guidage).
    return `<div class="zone-levee">${surface}</div>`;
  }
  if (cle === 'controle') {
    const enregistrer = trouver('enregistrer');
    return enregistrer && autocontrole.cible ? boutonDeBande('enregistrer', 'Enregistrer le contrôle', autocontrole.cible.nom, enregistrer.disabled, 'Enreg.') : '';
  }
  if (cle === 'calculs' && document.body.dataset.onglet === 'dessin' && aAcces('expert')) {
    return boutonDeBande('dao', daoAppli?.actif() ? 'Quitter la DAO' : 'DAO', 'dessiner sur le plan');
  }
  if (cle === 'mesure') return mesureRapideBande();
  if (cle === 'annotation') return annotationBande();
  return '';
}

/** Bouton de la zone du milieu touché. */
function agirDepuisBande(cle) {
  if (cle.startsWith('mesure-')) {
    agirMesureRapide(cle);
    return;
  }
  if (cle.startsWith('annotation-')) {
    agirAnnotation(cle);
    return;
  }
  document.querySelector(RELAIS_BANDE[cle])?.click();
}

// --- Mesure rapide (0.158.0, dès Intermédiaire, demande du 08.11, formules validées) ---
// Points touchés sur le plan (accroche) ou pris au GNSS (bouton de la bande), résultats en direct sur le
// plan et sous le plan ; rien d'enregistré sauf « Enregistrer » (levé libre « LV-Mesures rapides »).
// 0.159.0 : la barre d'accroche d'Implanter (icônes), puis Libre et GNSS (lever au récepteur, appli Android).
const ACCROCHES_MESURE_EN_PLUS = {
  libre: ['Libre', 'Libre : l\'endroit touché, sans altitude', '<path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle class="repere" cx="12" cy="12" r="2.5" />'],
  perpendiculaire: ['Perp.', 'Perpendiculaire (Expert) : touche une ligne, le point est le pied de la perpendiculaire depuis le dernier point', '<path d="M3 19h18M8 19V6" /><path d="M8 14h5v5" /><circle class="repere" cx="8" cy="5" r="2" />'],
  gnss: ['GNSS', 'Lever au récepteur : « + Point GNSS » en bas', '<path d="M8.5 3.2a5 5 0 0 1 7 0" /><ellipse class="repere" cx="12" cy="9" rx="6" ry="2.6" /><path d="M6 9v1.4a6 2.6 0 0 0 12 0V9M12 13v9" />'],
};
const accrochesMesure = () => [
  ...MODES_ACCROCHE.map((cle) => [cle, ...ACCROCHES[cle]]),
  ['centrepts', ...ACCROCHES.centrepts], // 0.214.0 : centre de 2 ou 3 points (la Mesure rapide est dès Intermédiaire)
  // 0.162.0 : « Perp. » (Expert) : le 2e point est le pied de la perpendiculaire menée du 1er point sur la ligne touchée.
  ...(aAcces('expert') ? [['perpendiculaire', ...ACCROCHES_MESURE_EN_PLUS.perpendiculaire]] : []),
  // 0.162.2 (demande du 08.11) : la loupe « Manuel » remplace « Libre » (point visé sans altitude).
  ['manuel', ...ACCROCHES.manuel],
  ...(recepteurDisponible() ? [['gnss', ...ACCROCHES_MESURE_EN_PLUS.gnss]] : []),
];

// Accroche « Centre pts » (0.214.0) : points touchés (2 ou 3), pour Implanter › Point et la Mesure rapide.
const centrePts = { points: [] };
const centrePtsVider = () => { centrePts.points = []; };
/** Centre en cours : { est, nord, altitude } (arrondi au mm) ou null (moins de 2 points). */
function centrePtsCalcule() {
  const r = centreDePoints(centrePts.points);
  if (!r.ok) return null;
  const mm = (v) => Math.round(v * 1000) / 1000;
  return { est: mm(r.est), nord: mm(r.nord), altitude: r.altitude != null ? mm(r.altitude) : null };
}
/** Vrai si l'accroche « Centre pts » est celle de l'écran de travail (Mesure rapide ou Implanter › Point). */
function centrePtsActif() {
  return (mesureRapideActive() && mesureRapideEtat.accroche === 'centrepts')
    || (ongletContexte === 'terrain' && enImplantationDePoint() && terrain.accroche === 'centrepts' && aAcces('intermediaire'));
}
/**
 * Toucher un point pour le centre : un point du projet, sinon un sommet ou un point du plan DXF. Renvoie le centre { est, nord, altitude }
 * quand on a 2 ou 3 points, 'attente' après le 1er point, ou null (refus : message donné).
 */
function toucherCentrePoints(position, tolerance) {
  if (centrePts.points.length >= MAX_POINTS_CENTRE) {
    afficherMessage(`Centre pts : ${MAX_POINTS_CENTRE} points au maximum (touche ← pour recommencer)`, 3500);
    return null;
  }
  const trouve = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsDuProjet() })
    ?? accrocher('sommet', position, tolerance, avecToutesLesLignes('sommet', sourcesDesPlans(plansDuProjet(), position, tolerance)));
  if (!trouve) {
    afficherMessage('Centre pts : aucun point ni sommet sous le doigt', 3000);
    return null;
  }
  if (centrePts.points.some((q) => Math.hypot(q.est - trouve.est, q.nord - trouve.nord) < 0.0005)) {
    afficherMessage('Centre pts : ce point est déjà pris', 3000);
    return null;
  }
  centrePts.points.push({ est: trouve.est, nord: trouve.nord, altitude: trouve.altitude ?? null, nom: trouve.nom ?? '' });
  if (centrePts.points.length < 2) {
    afficherMessage('Centre pts : point 1 pris, touche le 2e (et un 3e pour le centre du cercle)', 3500);
    return 'attente';
  }
  const resultat = centreDePoints(centrePts.points);
  if (!resultat.ok) {
    centrePts.points.pop();
    afficherMessage(`Centre pts : ${resultat.raison}`, 3500);
    return null;
  }
  return centrePtsCalcule();
}

/** Vrai quand la Mesure rapide est l'écran de travail (le plan lui envoie ses touchers). */
function mesureRapideActive() {
  return ongletContexte === 'mesure-rapide' && aAcces('intermediaire');
}

/** Redessine l'écran (sous le plan), le plan et la bande. */
function afficherMesureRapide() {
  const mesure = mesureRapide(mesureRapideEtat.points, { fermee: mesureRapideEtat.fermee });
  for (const [cle, n] of [['points', mesure.points.length], ['cotes', mesure.cotes.length]]) {
    mesureRapideEtat.pages[cle] = Math.min(mesureRapideEtat.pages[cle], nombreDePages(n) - 1);
  }
  if (mesureRapideEtat.accroche === 'libre') mesureRapideEtat.accroche = 'manuel';
  document.querySelector('#mesure-rapide').innerHTML = htmlMesureRapide({
    mesure, accroche: mesureRapideEtat.accroche, accroches: accrochesMesure(), pages: mesureRapideEtat.pages,
    centre: mesureRapideEtat.accroche === 'centrepts' ? { points: centrePts.points.length, pret: centrePtsCalcule() != null } : null, manuel: { candidat: Boolean(mesureRapideEtat.candidat), zoom: terrain.zoomLoupe ?? 4 }, fermee: mesureRapideEtat.fermee, afficherAngles: mesureRapideEtat.angles, accrochesOuvertes: Boolean(mesureRapideEtat.accrochesOuvertes),
  });
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
  navigation?.mettreAJour();
}

/** Ajoute un point à la mesure (les tableaux passent à leur dernière page). */
function ajouterPointMesure(point) {
  const mm = (valeur) => Math.round(valeur * 1000) / 1000;
  mesureRapideEtat.points.push({ nom: point.nom ?? '', est: mm(point.est), nord: mm(point.nord), altitude: point.altitude != null ? mm(point.altitude) : null });
  const mesure = mesureRapide(mesureRapideEtat.points, { fermee: mesureRapideEtat.fermee });
  mesureRapideEtat.pages = { points: nombreDePages(mesure.points.length) - 1, cotes: nombreDePages(mesure.cotes.length) - 1 };
  vibrer(30);
  afficherMesureRapide();
}

/** Toucher du plan : le point accroché (point du projet, sommet, milieu…) ou, en « Libre », l'endroit touché. */
function toucherPourMesureRapide(position, tolerance) {
  const accroche = mesureRapideEtat.accroche;
  if (accroche === 'gnss') {
    afficherMessage('Accroche GNSS : touche « + Point GNSS » en bas', 3000);
    return;
  }
  // 0.214.0 : centre de 2 ou 3 points ; « ✓ Ajouter le centre » l'ajoute à la mesure.
  if (accroche === 'centrepts') {
    if (toucherCentrePoints(position, tolerance)) afficherMesureRapide();
    return;
  }
  // « Manuel » : toucher le plan y pose la loupe ; « Ajouter ce point » l'ajoute à la mesure.
  if (accroche === 'manuel' || accroche === 'libre') {
    plan.loupe.placerSur(position.est, position.nord);
    return;
  }
  if (accroche === 'perpendiculaire') {
    const dernier = mesureRapideEtat.points.at(-1);
    if (!dernier) {
      afficherMessage('Perpendiculaire : pose d\'abord un premier point (autre accroche)', 3500);
      return;
    }
    const pied = piedPerpendiculaire(dernier, position, tolerance, avecToutesLesLignes('croisement', sourcesDesPlans(plansDuProjet(), position, tolerance)).lignes);
    if (!pied) {
      afficherMessage('Aucune ligne sous le doigt', 3000);
      return;
    }
    ajouterPointMesure({ nom: '', est: pied.est, nord: pied.nord, altitude: pied.altitude });
    return;
  }
  const sources = accroche === 'point' ? { lignes: [], cercles: [], points: pointsDuProjet() } : sourcesDesPlans(plansDuProjet(), position, tolerance);
  const trouve = accrocher(accroche, position, tolerance, avecToutesLesLignes(accroche, sources));
  if (!trouve) {
    const quoi = { point: 'Aucun point du projet', sommet: 'Aucun sommet', milieu: 'Aucune ligne', ligne: 'Aucune ligne', croisement: 'Aucun croisement de lignes', centre: 'Aucun cercle' }[accroche];
    afficherMessage(`${quoi} sous le doigt`, 3000);
    return;
  }
  ajouterPointMesure({ nom: accroche === 'point' ? trouve.nom : '', est: trouve.est, nord: trouve.nord, altitude: trouve.altitude ?? null });
}

/**
 * Bande du bas de la Mesure rapide (appli Android, accroche GNSS) : « + Point GNSS », prêt en RTK fixe
 * avec l'inclinaison prête (validé le 08.11 : seulement le fixe).
 */
function mesureRapideBande() {
  const n = mesureRapideEtat.points.length;
  const dernier = mesureRapideEtat.points.at(-1);
  const gnss = recepteurDisponible() && mesureRapideEtat.accroche === 'gnss';
  const pret = Boolean(etatRecepteur?.connecte && etatRecepteur.recu && etatRecepteur.position && etatRecepteur.qualite === 4 && etatRecepteur.inclinaisonPrete);
  // 0.171.0 : Annuler (nom du dernier point), RAZ, Export (qui propose aussi d'enregistrer dans le levé), puis tout à droite
  // « Enreg. (Vol −) » = le point GNSS.
  const bouton = (cle, classe, titre, detail = '', desactive = false, court = null) => `<button type="button" class="bouton-bande-mesure ${classe}" data-nav="action" data-cle="${cle}" ${desactive ? 'disabled' : ''}>
      <span>${court ? `<span class="t-long">${echapper(titre)}</span><span class="t-court">${echapper(court)}</span>` : echapper(titre)}</span>${detail ? `<small>${echapper(detail)}</small>` : ''}</button>`;
  return `<div class="boutons-bande-mesure">
    ${bouton('mesure-annuler', 'annuler', '↶ Annuler', dernier ? (dernier.nom || `point ${n}`) : '', n === 0)}
    ${bouton('mesure-raz', 'raz', 'RAZ', '', n === 0)}
    ${bouton('mesure-export', 'export', 'Export', '', n === 0)}
    ${gnss ? bouton('mesure-gnss', 'relais-mesure-gnss', 'Enreg. (Vol −)', pret ? '' : 'RTK fixe + incl.', !pret, 'Enreg.') : ''}
  </div>`;
}

/** Retire le dernier point de la mesure. */
function annulerDernierPointMesure() {
  mesureRapideEtat.points.pop();
  afficherMesureRapide();
}

/** Remise à zéro de la mesure. */
function remettreMesureAZero() {
  centrePtsVider();
  mesureRapideEtat.points = [];
  mesureRapideEtat.fermee = true;
  mesureRapideEtat.pages = { points: 0, cotes: 0 };
  afficherMesureRapide();
}

function agirMesureRapide(cle) {
  if (cle === 'mesure-annuler') return annulerDernierPointMesure();
  if (cle === 'mesure-raz') return remettreMesureAZero();
  if (cle === 'mesure-export') return exporterMesureRapide();
  if (cle !== 'mesure-gnss') return undefined;
  // 0.214.0 : point moyen d'une mesure de durée (déjà vérifié à chaque lecture), sinon la position en direct.
  const moyen = consommerPointMoyen();
  const position = moyen ?? (etatRecepteur?.connecte && etatRecepteur.recu ? etatRecepteur.position : null);
  if (!moyen && (!position || etatRecepteur.qualite !== 4 || !etatRecepteur.inclinaisonPrete)) {
    refuser('Point GNSS refusé : il faut le RTK fixe et l\'inclinaison prête');
    return undefined;
  }
  if (!moyen && correctionsTropAnciennes(etatRecepteur.ageCorrections)) {
    refuser(`Point GNSS refusé : corrections trop anciennes (${Math.round(etatRecepteur.ageCorrections)} s, 2 s au plus)`);
    return undefined;
  }
  ajouterPointMesure({ est: position.est, nord: position.nord, altitude: position.altitude ?? null });
  return undefined;
}

// --- Annotation (0.177.0, Intermédiaire et Expert, demande du 09.11 ; bandeau comme Lever : 0.179.0) ---
// Un point posé sur le plan (loupe), pris au récepteur (GNSS) ou au GPS de la tablette (précision 3 m au plus, réglable),
// avec un nom (ID tapé, « Annot-n » au départ), une remarque et des photos (dessin possible dessus). Rangé dans la
// liste du jour « Annot-AAAAMMJJ » (voir topo/annotation.js). Bandeau fixe en bas : photo | ↶ | ID + remarque | Enreg. point.
const annotationEtat = {
  mode: null, // 'loupe' quand « Manuel » est choisi dans la bande
  position: null, // position prise { est, nord, altitude, source, precision }, ou null
  nom: '', // ID tapé ('' = nom proposé)
  remarque: '',
  photos: [], // photos du prochain point (pas encore rangées)
  fiche: null, // point enregistré rouvert { nom, est, nord, altitude, source, precision, remarques }
  reglages: false,
  tri: 'recent', // 'recent' | 'ancien'
};

/** Vrai quand l'Annotation est l'écran de travail. */
function annotationActive() {
  return ongletContexte === 'annotation' && aAcces('intermediaire');
}

const precisionTabletteMax = () => terrain.precisionTablette ?? PRECISION_TABLETTE_DEPART;
const arrondirMm = (valeur) => Math.round(valeur * 1000) / 1000;

/** Texte et état du GPS de la tablette (précision en direct). */
function etatTabletteAnnotation() {
  if (!positionTablette) return { ok: false, texte: 'Pas de position GPS de la tablette' };
  const precision = positionTablette.precision;
  const ok = precisionSuffisante(precision, precisionTabletteMax());
  return { ok, texte: `Précision ±${Number.isFinite(precision) ? formaterNombre(precision) : '?'} m · ${ok ? 'assez précis' : `il faut ${formaterNombre(precisionTabletteMax())} m ou mieux`}` };
}

/** Précision du GPS de la tablette mise à jour sans redessiner l'écran (5 fois par seconde) ; la bande suit. */
function majPrecisionAnnotation() {
  if (!annotationActive()) return;
  const texte = document.querySelector('#annotation [data-champ="precision-tablette"]');
  const etat = etatTabletteAnnotation();
  if (texte && texte.textContent !== etat.texte) texte.textContent = etat.texte;
  navigation?.mettreAJour();
}

/** Pourquoi le bouton GNSS est grisé (texte court), ou '' s'il est utilisable. */
function raisonGnssAnnotation() {
  if (!recepteurDisponible()) return 'appli Android';
  if (!etatRecepteur?.connecte) return 'non connecté';
  if (!etatRecepteur.recu || !etatRecepteur.position) return 'pas de position';
  if (etatRecepteur.qualite !== 4) return 'pas en RTK fixe';
  if (!etatRecepteur.inclinaisonPrete) return 'incl. non prête';
  return '';
}

/** Pourquoi le bouton GPS tablette est grisé (texte court), ou '' s'il est utilisable. */
function raisonTabletteAnnotation() {
  if (!recepteurDisponible()) return 'appli Android';
  if (!positionTablette) return 'pas de GPS';
  const precision = positionTablette.precision;
  if (!precisionSuffisante(precision, precisionTabletteMax())) return `±${Number.isFinite(precision) ? Math.ceil(precision) : '?'} m, ${precisionTabletteMax()} m voulu`;
  return '';
}

/**
 * Bande du bas d'Annotation (0.178.0) : trois boutons à droite du bouton d'application, Manuel / GNSS / GPS tablette
 * (grisés avec la raison écrite dessous quand ils ne sont pas utilisables). Enreg. point est dans le bandeau.
 */
function annotationBande() {
  const bouton = (cle, classe, titre, raison) => `<button type="button" class="bouton-bande-mesure ${classe}" data-nav="action" data-cle="${cle}" ${raison ? 'disabled' : ''}>
      <span>${echapper(titre)}</span>${raison ? `<small>${echapper(raison)}</small>` : ''}</button>`;
  return `<div class="boutons-bande-mesure boutons-bande-annotation">
    ${bouton('annotation-manuel', annotationEtat.mode === 'loupe' ? 'manuel actif' : 'manuel', 'Manuel', '')}
    ${bouton('annotation-gnss', 'gnss', 'GNSS', raisonGnssAnnotation())}
    ${bouton('annotation-tablette', 'tablette', 'GPS tablette', raisonTabletteAnnotation())}
  </div>`;
}

/** Bouton de la bande touché : Manuel (loupe), GNSS ou GPS tablette. */
function agirAnnotation(cle) {
  lireBandeauAnnotation();
  if (cle === 'annotation-manuel') {
    annotationEtat.mode = 'loupe';
    afficherAnnotation();
  } else if (cle === 'annotation-gnss') {
    annotationEtat.mode = null;
    prendreGnssAnnotation();
  } else if (cle === 'annotation-tablette') {
    annotationEtat.mode = null;
    prendreTabletteAnnotation();
  }
}

/** Recopie l'ID et la remarque tapés dans le bandeau (avant tout redessin). */
function lireBandeauAnnotation() {
  const nom = document.querySelector('#annotation [data-champ="nom-annotation"]');
  const remarque = document.querySelector('#annotation [data-champ="remarque-annotation"]');
  if (nom) annotationEtat.nom = nom.value;
  if (remarque) annotationEtat.remarque = remarque.value;
}

/** Nom proposé pour le prochain point (« Annot-n »). */
const nomProposeAffiche = () => nomProposeAnnotation(projet, nomsDuProjet(projet));

/** Recopie les remarques tapées dans la fiche du point rouvert. */
function lireFicheAnnotation() {
  const fiche = annotationEtat.fiche;
  const champs = [...document.querySelectorAll('#annotation [data-champ="remarque"]')];
  if (fiche && champs.length > 0) fiche.remarques = champs.map((c) => c.value);
}

/** Photos du point rouvert (celles de sa liste). */
function photosDeLaFicheAnnotation() {
  const fiche = annotationEtat.fiche;
  if (!fiche) return [];
  return (trouverAnnotation(projet, fiche.nom)?.liste.photos ?? []).filter((p) => p.point === fiche.nom);
}

function afficherAnnotation() {
  // Triées par date : la plus récente d'abord (ou l'ancienne d'abord, bouton « Trier par date »).
  const sens = annotationEtat.tri === 'recent' ? -1 : 1;
  const liste = listesAnnotation(projet).flatMap((l) => (projet.leves.find((v) => v.id === l.leveId)?.points ?? []).map((p) => ({ l, p })))
    .sort((a, b) => sens * String(a.p.annotation?.le ?? '').localeCompare(String(b.p.annotation?.le ?? ''))).map(({ l, p }) => ({
      nom: p.nom, source: p.annotation?.source, remarques: p.annotation?.remarques?.length ?? 0, date: dateHeure(p.annotation?.le),
      photos: (l.photos ?? []).filter((ph) => ph.point === p.nom).length, premiere: p.annotation?.remarques?.[0] ?? '',
    }));
  const dernier = dernierAnnotation(projet);
  document.querySelector('#annotation').innerHTML = `${htmlAnnotation({
    mode: annotationEtat.mode, fiche: annotationEtat.fiche, photos: photosDeLaFicheAnnotation(),
    manuel: { zoom: terrain.zoomLoupe ?? 4 },
    tablette: { ...etatTabletteAnnotation(), maximum: precisionTabletteMax() }, liste, reglages: annotationEtat.reglages, tri: annotationEtat.tri,
  })}${htmlBandeauAnnotation({
    nom: annotationEtat.nom, remarque: annotationEtat.remarque, photos: annotationEtat.photos.length,
    position: annotationEtat.position, dernier: dernier?.nom ?? '',
  })}`;
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
  navigation?.mettreAJour();
}

/** Annotation la plus proche du toucher (à « tolerance » mètres au plus), ou null. */
function annotationSousLeDoigt(position, tolerance) {
  let meilleure = null;
  let distanceMin = Math.max(tolerance ?? 0, 0);
  for (const liste of listesAnnotation(projet)) {
    for (const point of projet.leves.find((l) => l.id === liste.leveId)?.points ?? []) {
      const distance = Math.hypot(point.est - position.est, point.nord - position.nord);
      if (distance <= distanceMin) {
        distanceMin = distance;
        meilleure = point;
      }
    }
  }
  return meilleure;
}

/** Position du prochain point (mode Loupe : à chaque doigt levé ; GNSS / Tablette : au toucher du bouton). */
function poserPositionAnnotation({ est, nord, altitude, source, precision }) {
  const avant = annotationEtat.position;
  annotationEtat.position = { est: arrondirMm(est), nord: arrondirMm(nord), altitude: altitude != null ? arrondirMm(altitude) : null, source, precision: precision ?? null };
  // Redessin seulement si le bouton Enreg. point change (première position, ou autre façon de la prendre).
  if (!avant || avant.source !== source) {
    lireBandeauAnnotation();
    afficherAnnotation();
  }
}

function prendreGnssAnnotation() {
  // 0.214.0 : point moyen d'une mesure de durée, sinon la position en direct (corrections de 2 s au plus).
  const moyen = consommerPointMoyen();
  const position = moyen ?? (etatRecepteur?.connecte && etatRecepteur.recu ? etatRecepteur.position : null);
  if (!moyen && (!position || etatRecepteur.qualite !== 4 || !etatRecepteur.inclinaisonPrete)) {
    refuser('Point GNSS refusé : il faut le RTK fixe et l\'inclinaison prête');
    return;
  }
  if (!moyen && correctionsTropAnciennes(etatRecepteur.ageCorrections)) {
    refuser(`Point GNSS refusé : corrections trop anciennes (${Math.round(etatRecepteur.ageCorrections)} s, 2 s au plus)`);
    return;
  }
  vibrer(30);
  poserPositionAnnotation({ est: position.est, nord: position.nord, altitude: position.altitude ?? null, source: 'gnss', precision: moyen?.precisionH ?? etatRecepteur.precisionH ?? null });
}

function prendreTabletteAnnotation() {
  if (!positionTablette) {
    refuser('Pas de position GPS de la tablette');
    return;
  }
  if (!precisionSuffisante(positionTablette.precision, precisionTabletteMax())) {
    refuser(`GPS de la tablette trop imprécis (±${formaterNombre(positionTablette.precision)} m) : ${formaterNombre(precisionTabletteMax())} m ou mieux`);
    return;
  }
  vibrer(30);
  poserPositionAnnotation({ est: positionTablette.est, nord: positionTablette.nord, altitude: null, source: 'tablette', precision: positionTablette.precision });
}

/** « Enreg. point » du bandeau : le point (ID, remarque, photos, position prise) entre dans la liste du jour. */
function enregistrerAnnotation() {
  if (refuserEnLectureSeule()) return;
  lireBandeauAnnotation();
  const position = annotationEtat.position;
  if (!position) {
    refuser('Prends d\'abord une position (Manuel, GNSS ou GPS tablette)');
    return;
  }
  const resultat = ajouterAnnotation(projet, { ...position, appareil: nomDeLAppareil(), nom: annotationEtat.nom, remarques: [annotationEtat.remarque], photos: annotationEtat.photos }, nomsDuProjet(projet));
  if (resultat.erreur) {
    refuser(resultat.erreur);
    return;
  }
  vibrer(40);
  afficherMessage(`${resultat.point.nom} enregistré`);
  Object.assign(annotationEtat, { position: null, nom: '', remarque: '', photos: [] });
  modifie();
  afficherAnnotation();
}

/** ↶ : efface le dernier point enregistré (avec ses remarques et photos : demande avant s'il en a). */
async function effacerDernierAnnotation() {
  const dernier = dernierAnnotation(projet);
  if (!dernier || refuserEnLectureSeule()) return;
  const trouve = trouverAnnotation(projet, dernier.nom);
  const contenu = (dernier.annotation?.remarques?.length ?? 0) > 0 || (trouve?.liste.photos ?? []).some((p) => p.point === dernier.nom);
  if (contenu) {
    const choix = await demanderChoix({ titre: `Effacer ${dernier.nom} ?`, texte: 'Le point, ses remarques et ses photos seront enlevés.', boutons: [{ cle: 'oui', texte: 'Effacer', principal: true }, { cle: 'non', texte: 'Garder' }] });
    if (choix !== 'oui') return;
  }
  supprimerAnnotation(projet, dernier.nom);
  if (annotationEtat.fiche?.nom === dernier.nom) annotationEtat.fiche = null;
  afficherMessage(`${dernier.nom} effacé`);
  modifie();
  afficherAnnotation();
}

/** Après une photo : l'éditeur de dessin s'ouvre tout de suite (cercle, flèche, trait) ; fermé sans dessin, la photo reste telle quelle. */
async function dessinerSurPhoto(photo) {
  const dessins = await ouvrirEditeurDessin(photo, photo.dessins ?? []);
  if (dessins?.length > 0) photo.dessins = dessins;
}

/** Photos prises avec l'appareil du bandeau : rangées avec le prochain point, après le dessin éventuel. */
async function ajouterPhotosBandeauAnnotation(fichiers) {
  if (fichiers.length === 0) return;
  lireBandeauAnnotation();
  afficherMessage('Préparation de la photo…', null);
  const erreurs = [];
  const prises = [];
  for (const fichier of fichiers) {
    try {
      prises.push(await preparerPhoto(fichier));
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${erreur.message}`);
    }
  }
  if (erreurs.length > 0) afficherMessage(`Photo refusée. ${erreurs.join(' ; ')}`, 8000);
  else afficherMessage(`${prises.length} photo(s) prise(s)`);
  for (const photo of prises) {
    annotationEtat.photos.push(photo);
    afficherAnnotation();
    await dessinerSurPhoto(photo);
  }
  afficherAnnotation();
}

/** Encadré posé sur le plan quand on touche une annotation (nom, date, remarques, photos). */
function fermerEncadreAnnotation() {
  document.querySelector('#encadre-annotation-plan')?.remove();
}
function montrerEncadreAnnotation(nom) {
  const trouve = trouverAnnotation(projet, nom);
  fermerEncadreAnnotation();
  if (!trouve) return;
  const { point, liste } = trouve;
  const boite = document.createElement('div');
  boite.id = 'encadre-annotation-plan';
  boite.innerHTML = htmlEncadreAnnotation({
    nom, date: dateHeure(point.annotation?.le), remarques: point.annotation?.remarques ?? [],
    photos: (liste.photos ?? []).filter((p) => p.point === nom),
  });
  const zone = document.querySelector('.panneau-plan')?.getBoundingClientRect();
  boite.style.cssText = `position: fixed; z-index: 40; left: 8px; right: 8px; bottom: ${Math.max(8, window.innerHeight - (zone?.bottom ?? window.innerHeight) + 34)}px; display: flex; justify-content: center; pointer-events: none;`;
  boite.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-action]');
    if (!bouton) return;
    if (bouton.dataset.action === 'fermer-encadre') fermerEncadreAnnotation();
    else if (bouton.dataset.action === 'photo-encadre') montrerPhoto(bouton.dataset.id);
    else if (bouton.dataset.action === 'modifier-encadre') {
      fermerEncadreAnnotation();
      if (ongletContexte !== 'annotation') afficherOnglet('annotation');
      ouvrirAnnotation(nom);
    }
  });
  document.body.append(boite);
}

/** Ouvre la fiche d'un point d'annotation déjà enregistré (remarques et photos modifiables). */
function ouvrirAnnotation(nom) {
  const trouve = trouverAnnotation(projet, nom);
  if (!trouve) return;
  lireBandeauAnnotation();
  lireFicheAnnotation();
  const { point } = trouve;
  annotationEtat.fiche = {
    nom, est: point.est, nord: point.nord, altitude: point.altitude ?? null,
    source: point.annotation?.source, precision: point.annotation?.precision ?? null,
    remarques: [...(point.annotation?.remarques ?? [])],
  };
  afficherAnnotation();
}

function enregistrerFicheAnnotation() {
  if (refuserEnLectureSeule()) return;
  lireBandeauAnnotation();
  lireFicheAnnotation();
  const fiche = annotationEtat.fiche;
  if (!fiche) return;
  const trouve = trouverAnnotation(projet, fiche.nom);
  if (trouve) trouve.point.annotation.remarques = nettoyerRemarques(fiche.remarques);
  afficherMessage(`${fiche.nom} modifié`);
  annotationEtat.fiche = null;
  modifie();
  afficherAnnotation();
}

async function supprimerFicheAnnotation() {
  const fiche = annotationEtat.fiche;
  if (!fiche || refuserEnLectureSeule()) return;
  const choix = await demanderChoix({ titre: `Supprimer ${fiche.nom} ?`, texte: 'Le point, ses remarques et ses photos seront enlevés.', boutons: [{ cle: 'oui', texte: 'Supprimer', principal: true }, { cle: 'non', texte: 'Garder' }] });
  if (choix !== 'oui') return;
  supprimerAnnotation(projet, fiche.nom);
  annotationEtat.fiche = null;
  modifie();
  afficherAnnotation();
}

/** Photos ajoutées à la fiche d'un point rouvert (rangées tout de suite dans sa liste, avec le dessin). */
async function ajouterPhotosFicheAnnotation(fichiers) {
  const fiche = annotationEtat.fiche;
  if (!fiche || fichiers.length === 0 || refuserEnLectureSeule()) return;
  lireBandeauAnnotation();
  lireFicheAnnotation();
  afficherMessage('Préparation de la photo…', null);
  const erreurs = [];
  for (const fichier of fichiers) {
    try {
      const photo = { ...(await preparerPhoto(fichier)), point: fiche.nom };
      const trouve = trouverAnnotation(projet, fiche.nom);
      if (trouve) trouve.liste.photos = [...(trouve.liste.photos ?? []), photo];
      afficherAnnotation();
      await dessinerSurPhoto(photo);
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${erreur.message}`);
    }
  }
  if (erreurs.length > 0) afficherMessage(`Photo refusée. ${erreurs.join(' ; ')}`, 8000);
  else afficherMessage(`${fichiers.length} photo(s) ajoutée(s)`);
  modifie();
  afficherAnnotation();
}

function enleverPhotoAnnotation(id) {
  lireBandeauAnnotation();
  lireFicheAnnotation();
  const fiche = annotationEtat.fiche;
  if (!fiche || refuserEnLectureSeule()) return;
  const trouve = trouverAnnotation(projet, fiche.nom);
  if (trouve) trouve.liste.photos = (trouve.liste.photos ?? []).filter((p) => p.id !== id);
  modifie();
  afficherAnnotation();
}

document.querySelector('#annotation').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-action]');
  if (!bouton || bouton.disabled) return;
  const action = bouton.dataset.action;
  if (action === 'basculer-reglages-annotation') {
    lireBandeauAnnotation();
    lireFicheAnnotation();
    annotationEtat.reglages = !annotationEtat.reglages;
    afficherAnnotation();
  } else if (action === 'deplacer-loupe-annotation') {
    const [dx, dy] = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] }[bouton.dataset.valeur] ?? [0, 0];
    plan.loupe.deplacerDe(dx, dy);
  } else if (action === 'zoom-loupe-annotation') {
    terrain.zoomLoupe = Number(bouton.dataset.valeur) || 4;
    plan.loupe.changerZoom(terrain.zoomLoupe);
    lireBandeauAnnotation();
    lireFicheAnnotation();
    afficherAnnotation();
  } else if (action === 'ajouter-remarque') {
    lireFicheAnnotation();
    annotationEtat.fiche?.remarques.push('');
    afficherAnnotation();
    document.querySelector('#annotation [data-champ="remarque"]:last-of-type')?.focus();
  } else if (action === 'enregistrer-annotation') enregistrerAnnotation();
  else if (action === 'enregistrer-fiche-annotation') enregistrerFicheAnnotation();
  else if (action === 'effacer-dernier-annotation') effacerDernierAnnotation();
  else if (action === 'fermer-annotation') {
    annotationEtat.fiche = null;
    lireBandeauAnnotation();
    afficherAnnotation();
  } else if (action === 'supprimer-annotation') supprimerFicheAnnotation();
  else if (action === 'ouvrir-annotation') ouvrirAnnotation(bouton.dataset.nom);
  else if (action === 'trier-annotation') {
    lireBandeauAnnotation();
    lireFicheAnnotation();
    annotationEtat.tri = annotationEtat.tri === 'recent' ? 'ancien' : 'recent';
    afficherAnnotation();
  } else if (action === 'voir-photo-annotation') montrerPhoto(bouton.dataset.id);
  else if (action === 'enlever-photo-annotation') enleverPhotoAnnotation(bouton.dataset.id);
});
document.querySelector('#annotation').addEventListener('change', (evenement) => {
  const precision = evenement.target.closest('input[data-champ="precision-tablette-max"]');
  if (precision) {
    const valeur = Number(String(precision.value).replace(',', '.'));
    terrain.precisionTablette = Number.isFinite(valeur) && valeur > 0 ? Math.min(valeur, 50) : PRECISION_TABLETTE_DEPART;
    retenirReglagesTerrain();
    lireBandeauAnnotation();
    afficherAnnotation();
    return;
  }
  const bandeau = evenement.target.closest('input[data-champ="photo-annotation-bandeau"]');
  if (bandeau) {
    const fichiers = [...bandeau.files];
    bandeau.value = '';
    ajouterPhotosBandeauAnnotation(fichiers);
    return;
  }
  const champ = evenement.target.closest('input[data-champ="photo-annotation"]');
  if (!champ) return;
  const fichiers = [...champ.files];
  champ.value = '';
  ajouterPhotosFicheAnnotation(fichiers);
});
// ID et remarque tapés : gardés au fur et à mesure (rien n'est redessiné pendant la frappe).
document.querySelector('#annotation').addEventListener('input', (evenement) => {
  const nom = evenement.target.closest('[data-champ="nom-annotation"]');
  if (nom) annotationEtat.nom = nom.value;
  else if (evenement.target.closest('[data-champ="remarque-annotation"]')) annotationEtat.remarque = evenement.target.value;
});

document.querySelector('#mesure-rapide').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-action]');
  if (!bouton || bouton.disabled) return;
  const action = bouton.dataset.action;
  if (action === 'basculer-accroches-mesure') {
    mesureRapideEtat.accrochesOuvertes = !mesureRapideEtat.accrochesOuvertes;
    afficherMesureRapide();
  } else if (action === 'ajouter-centre-mesure') {
    const centre = centrePtsCalcule();
    if (centre) {
      centrePtsVider();
      ajouterPointMesure({ nom: '', ...centre });
    }
  } else if (action === 'basculer-angles-mesure') {
    mesureRapideEtat.angles = !mesureRapideEtat.angles;
    afficherMesureRapide();
  } else if (action === 'basculer-ferme-mesure') {
    mesureRapideEtat.fermee = !mesureRapideEtat.fermee;
    mesureRapideEtat.pages.cotes = nombreDePages(mesureRapide(mesureRapideEtat.points, { fermee: mesureRapideEtat.fermee }).cotes.length) - 1;
    afficherMesureRapide();
  } else if (action === 'accroche-mesure') {
    mesureRapideEtat.accroche = bouton.dataset.valeur;
    mesureRapideEtat.candidat = null;
    centrePtsVider();
    afficherMesureRapide();
    mettreAJourToucheVolume();
  } else if (action === 'ajouter-manuel-mesure' && mesureRapideEtat.candidat) {
    const { est, nord } = mesureRapideEtat.candidat;
    mesureRapideEtat.candidat = null;
    ajouterPointMesure({ est, nord, altitude: null });
  } else if (action === 'deplacer-loupe-mesure') {
    const [dx, dy] = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] }[bouton.dataset.valeur] ?? [0, 0];
    plan.loupe.deplacerDe(dx, dy);
  } else if (action === 'zoom-loupe-mesure') {
    terrain.zoomLoupe = Number(bouton.dataset.valeur) || 4;
    plan.loupe.changerZoom(terrain.zoomLoupe);
    afficherMesureRapide();
  } else if (action === 'page-mesure') {
    mesureRapideEtat.pages[bouton.dataset.tableau] += Number(bouton.dataset.sens);
    afficherMesureRapide();
  }
});

/** « Enregistrer » : la mesure va dans le levé libre « LV-Mesures rapides » (points MR-n-…, ligne fermée dès 3 points). */
function enregistrerMesureRapide() {
  if (mesureRapideEtat.points.length === 0 || refuserEnLectureSeule()) return;
  const resultat = rangerMesureRapide(projet, mesureRapideEtat.points, nomsDuProjet(projet), { fermee: mesureRapideEtat.fermee });
  if (resultat.erreur) {
    alert(`Mesure non enregistrée : ${resultat.erreur}.`);
    return;
  }
  afficherMessage(`Mesure enregistrée dans « ${resultat.levee.nom} » (points MR-${resultat.numero}-…)`, 4000);
  modifie();
}

/**
 * Fond du croquis du PDF (0.159.0, demande du 08.11) : la photo aérienne swisstopo (WMS, réseau) et / ou
 * les plans DXF affichés, dessinés à l'échelle du croquis, en une image JPEG (data URL), ou null.
 */
async function fondDuCroquisMesure(mesure, { photo, plans }) {
  const { cadreDuCroquis, LARGEUR_CROQUIS, HAUTEUR_CROQUIS } = await import('./export/mesure-rapide.js');
  const { zone, estCentre, nordCentre } = cadreDuCroquis(mesure.points);
  const pixelsParMm = 6; // environ 150 dpi
  const largeur = Math.round(LARGEUR_CROQUIS * pixelsParMm);
  const hauteur = Math.round(HAUTEUR_CROQUIS * pixelsParMm);
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largeur, hauteur);
  if (photo) {
    try {
      const { adresseMorceau } = await import('./export/geotiff.js');
      const reponse = await fetch(adresseMorceau(zone.estMin, zone.nordMin, zone.estMax, zone.nordMax, largeur, hauteur));
      if (!reponse.ok) throw new Error(`swisstopo a répondu ${reponse.status}`);
      // 0.166.0 : la photo garde la transparence réglée dans Fond (sur le blanc du papier).
      ctx.globalAlpha = plan.opacitePhoto() ?? 1;
      ctx.drawImage(await createImageBitmap(await reponse.blob()), 0, 0, largeur, hauteur);
      ctx.globalAlpha = 1;
    } catch (erreur) {
      afficherMessage(`Photo swisstopo non chargée (réseau ?) : PDF sans photo. ${erreur.message ?? ''}`, 6000);
    }
  }
  if (plans) {
    const visibles = plansDuProjet().filter((p) => p.visible !== false);
    const vue = { estCentre, nordCentre, echelle: largeur / (zone.estMax - zone.estMin), largeur, hauteur, rotation: 0 };
    const toilePlans = document.createElement('canvas');
    dessinerPlansDxf(toilePlans, visibles, vue, 1);
    // 0.166.0 : plans DXF à 80 % de transparence (20 % d'opacité).
    ctx.globalAlpha = 0.2;
    ctx.drawImage(toilePlans, 0, 0);
    ctx.globalAlpha = 1;
  }
  return toile.toDataURL('image/jpeg', 0.85);
}

/** « Exporter » : PDF (croquis + tableaux) ou DXF (points, lignes, textes), puis la fenêtre Exporter. */
function exporterMesureRapide() {
  const mesure = mesureRapide(mesureRapideEtat.points, { fermee: mesureRapideEtat.fermee });
  if (mesure.points.length === 0) return;
  const base = `${nomDeFichierProjet(projet)}_mesure-rapide`.replace(/[\\/:*?"<>|]/g, '_');
  const avecPlans = plansDuProjet().some((p) => p.visible !== false);
  ouvrirFenetreExport({
    titre: 'Mesure rapide',
    formats: [['pdf', 'PDF', 'croquis et tableaux'], ['dxf', 'DXF', 'points, lignes et textes']],
    // 0.159.0 : fond du croquis du PDF : photo swisstopo et plans DXF affichés.
    // 0.171.0 : « Enregistrer dans le levé » (avant : bouton « Enreg. » de la bande, pris par le point GNSS).
    boutonsEnPlus: [{ titre: 'Enregistrer dans le levé', detail: 'LV-Mesures rapides (points MR-n)', faire: enregistrerMesureRapide }],
    options: [
      { cle: 'photo', texte: 'Photo aérienne swisstopo en fond', formats: ['pdf'] },
      ...(avecPlans ? [{ cle: 'plans', texte: 'Plans DXF affichés en fond', formats: ['pdf'] }] : []),
    ],
    fabriquer: async (format, choix = {}) => {
      const { pdfMesureRapide, dxfMesureRapide } = await import('./export/mesure-rapide.js');
      if (format === 'pdf') {
        const fond = choix.photo || choix.plans ? await fondDuCroquisMesure(mesure, { photo: choix.photo, plans: choix.plans }) : null;
        return { blob: pdfMesureRapide({ mesure, fond, titre: `Mesure rapide · ${titreProjet(projet)}`, cartouche: { affaire: projet.cartouche?.affaire ?? '', date: new Date().toLocaleDateString('fr-CH') } }), nom: `${base}.pdf` };
      }
      return { blob: new Blob([octetsDxf(dxfMesureRapide(mesure))], { type: 'application/dxf' }), nom: `${base}.dxf` };
    },
    enregistrer: enregistrerFichier,
    message: (texte) => afficherMessage(texte, 5000),
  });
}

// Pages du projet (0.159.0, demande du 08.11) : il n'y a plus d'application « Projet » ; chaque bouton
// de l'encadré du projet (page Applications) ouvre sa page à part : la liste des projets (« Changer »),
// Import, Exporter ou le contenu du projet (body[data-partie-projet], le reste de l'onglet est caché).
const TITRES_PARTIES_PROJET = { ouvrir: 'Projets', nouveau: 'Nouveau projet', import: 'Import', export: 'Exporter', contenu: 'Contenu du projet', points: 'Liste de points', plans: 'Plans', surfaces: 'Surfaces importées', archives: 'Archives' };
const PAGES_CONTENU = ['points', 'plans', 'surfaces', 'archives'];
// 0.197.0 : bouton « liste » des tuiles : les catégories de points montrées (Lever : tous les levés de terrain).
const CATEGORIES_TUILES = {
  lever: ['libre', 'stock', 'terrain', 'terrassement', 'chantier'],
  mesure: ['libre'],
  annotation: ['annotation'],
  controle: ['controle'],
};

/** Page du projet : 'ouvrir' (liste des projets), 'import', 'export' ou une page du contenu ('points', 'plans', 'surfaces', 'archives'). */
function ouvrirPartieProjet(quoi) {
  if (quoi === 'contenu') quoi = 'points'; // ancien nom
  if (PAGES_CONTENU.includes(quoi)) ecranImport?.choisirVue(quoi);
  afficherOnglet('projets', { partie: quoi });
  if (quoi === 'ouvrir') {
    // La page « Ouvrir projet » (liste, dossiers, + Nouveau) de l'écran Projet.
    if (!document.querySelector('.panneau-projet')?.classList.contains('page-gestion-projets')) {
      document.querySelector('#projets [data-action="panneau"][data-panneau="projets"]')?.click();
    }
  } else montrerOngletProjet(PAGES_CONTENU.includes(quoi) || quoi === 'nouveau' ? null : quoi);
  window.scrollTo(0, 0);
}

/**
 * Sous-applications écrites en petit sur les tuiles de la page Applications (toucher = ouvrir
 * l'application dessus) ; toucher le reste de la tuile ouvre la dernière sous-application utilisée.
 */
function sousApplisDe(cle) {
  if (cle === 'lever') return sousApplisDeLever();
  if (cle === 'implanter') {
    return [['point', 'Point'], ['ligne', 'Ligne'], ['surface', 'Surface'], ['altitude', 'Altitude'], ...(aAcces('expert') ? [['talus', 'Talus']] : [])];
  }
  if (cle === 'guidage') return [['grader', 'Grader'], ['bull', 'Bull'], ['rateau', 'Râteau']];
  if (cle === 'calculs') return PARTIES_CALCULS.filter(([c]) => c !== 'dessin' || aAcces('expert')).map(([c, titre]) => [c, titre.replace(' / métrés', '')]);
  return [];
}

/** Ouvre une application (tuile, sous-application d'une tuile, ou bulle de la roue des favoris). */
function ouvrirAppli(cle, sous = null, depuisMenu = false) {
  fenetreReglages?.fermer?.();
  const modes = { lever: 'lever', implanter: 'controler', controle: 'autocontrole', guidage: 'lame' };
  if (modes[cle]) {
    // Guidage (0.153.0) : on revient toujours au choix de la machine, comme avant avec l'onglet.
    if (cle === 'guidage') ecranLeve?.revenirAuChoixMachine();
    choisirModeTerrain(modes[cle]);
    afficherOnglet('terrain');
  } else if (cle === 'calculs') afficherOnglet(sous ?? 'calculs');
  else if (cle === 'plan') afficherOnglet('plan');
  else if (cle === 'mesure') afficherOnglet('mesure-rapide');
  else if (cle === 'annotation') afficherOnglet('annotation');
  else if (cle === 'recepteur') document.dispatchEvent(new CustomEvent('ouvrir-recepteur', { detail: { retourMenu: depuisMenu } }));
  if (sous && cle !== 'calculs') {
    // L'écran vient d'être dessiné : on touche sa sous-application (au besoin à l'image suivante).
    choisirSousAppli(sous);
    requestAnimationFrame(() => {
      if (!sousApplis().find((s) => s.cle === sous)?.actif) choisirSousAppli(sous);
    });
  }
}

/** 0.161.0 : « 3 levés · 2 DXF · 1 surface » en petit sous Import / Exporter / Contenu (ce qui est à zéro n'est pas écrit). */
function comptesDuProjet() {
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const surfaces = projet.surfaces.filter((s) => estSurfaceFichier(s)).length;
  return [
    projet.leves.length > 0 ? pluriel(projet.leves.length, 'levé') : '',
    (projet.plansDxf ?? []).length > 0 ? `${projet.plansDxf.length} DXF` : '',
    surfaces > 0 ? pluriel(surfaces, 'surface') : '',
  ].filter(Boolean).join(' · ');
}

/** 0.161.0 : en petit sous le nom d'une tuile (Contrôle : date du dernier contrôle réussi du projet). */
function detailDeTuile(cle) {
  if (cle !== 'controle') return '';
  const dernier = projet.controles.filter(estControleReussi).map((c) => new Date(c.le)).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => b - a)[0];
  if (!dernier) return 'Aucun contrôle';
  return `Dernier : ${dernier.toLocaleDateString('fr-CH')} ${dernier.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
}

navigation = creerNavigation(document.querySelector('#bande-appli'), {
  comptes: comptesDuProjet,
  detailTuile: detailDeTuile,
  // 0.195.0 : bouton « liste » des tuiles Lever, Annotation, Contrôle… : le tableau « Points » avec leur catégorie.
  categorieListe: (cle) => CATEGORIES_TUILES[cle] ?? null,
  ouvrirListe: (cle) => {
    const categories = CATEGORIES_TUILES[cle];
    if (!categories) return;
    ecranImport.choisirCategories(categories);
    ouvrirPartieProjet('points');
  },
  applis: () => applisDisponibles({ avecRecepteur: recepteurDisponible(), aAcces })
    // Ordinateur et tablette en largeur : le plan est toujours à droite, pas besoin de sa tuile.
    .filter((a) => a.cle !== 'plan' || !window.matchMedia('(min-width: 900px)').matches),
  courante: () => appliCourante(document.body.dataset.onglet, terrain.mode),
  titre: titreAppli,
  sousApplis,
  choisirSousAppli,
  info: infoAppli,
  ouvrirAppli,
  projet: () => ({
    titre: document.querySelector('#titre-projet')?.textContent ?? 'Projet',
    detail: document.querySelector('#etat')?.textContent ?? '',
  }),
  partieProjet: ouvrirPartieProjet,
  sousApplisDe,
  reglages: () => ouvrirFenetreReglages(),
  // 0.216.0 : carte de tous les projets (bouton à gauche de « Changer »).
  carteProjets: () => ouvrirCarteDesProjets(),
  // La page Applications s'ouvre par-dessus tout : la page des réglages se ferme.
  avantPage: () => fenetreReglages?.fermer?.(),
  fermerAppli: estDansAppliAndroid() && typeof window.AppliAndroid.fermerAppli === 'function' ? () => fermerAppli() : null,
  importPermis: () => aAcces('expert'),
  agir: agirDepuisBande,
  choisir: champDepuisBande,
  changerProjet: () => ouvrirPartieProjet('ouvrir'),
  get nouveauProjet() {
    return aAcces('intermediaire') ? () => creerNouveauProjet() : null;
  },
  message: (texte) => afficherMessage(texte, 4000),
  vibrer: () => vibrer(40),
});
// Lever, Implanter… redessinent leurs boutons (rôle, Point / Ligne…) : la bande suit (une fois par image au plus).
let bandePrevue = false;
new MutationObserver(() => {
  if (bandePrevue) return;
  bandePrevue = true;
  requestAnimationFrame(() => {
    bandePrevue = false;
    navigation.mettreAJour();
  });
}).observe(document.querySelector('#leve-direct'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
// Le nom du prochain point tapé suit dans le bouton Enreg. Pts de la bande.
document.querySelector('#leve-direct').addEventListener('input', () => navigation.mettreAJour());

/**
 * Affiche un onglet ('projets', 'terrain', 'plan') ou une partie de Calculs ('surfaces',
 * 'volumes', 'mesures' ; 'calculs' : la dernière partie affichée). Sur ordinateur, le plan reste
 * toujours visible à droite.
 */
function afficherOnglet(demande, { partie = null } = {}) {
  const ongletAvant = document.body.dataset.onglet; // Annotation : on sait qu'on la quitte
  const nom = demande === 'calculs' ? partieCalculs : demande;
  // 0.159.0 : l'onglet Projet n'est plus montré en entier : une de ses pages (voir ouvrirPartieProjet) ;
  // demandé sans page (après l'ouverture d'un projet…), c'est la page Applications qui s'ouvre.
  if (nom === 'projets') {
    document.body.dataset.partieProjet = partie ?? 'contenu';
    const titre = document.querySelector('#titre-partie-projet');
    if (titre) titre.textContent = TITRES_PARTIES_PROJET[partie ?? 'contenu'];
  }
  // Drive : on travaille sur le projet de départ (fenêtre de démarrage) : il est comparé à Drive.
  if (nom !== 'projets') partage?.choixFait();
  // Ajout manuel (0.120.0) : on le quitte en changeant de page (le plan en fait partie).
  if (ajoutLevee.actif && nom !== 'terrain' && nom !== 'plan') arreterAjout();
  if (estPartieCalculs(nom)) partieCalculs = nom;
  const entreDansCalculs = (nom === 'volumes' || nom === 'mesures') && !['volumes', 'mesures', 'dessin'].includes(ongletContexte);
  for (const panneau of document.querySelectorAll('.panneau[data-onglet]')) {
    panneau.classList.toggle('actif', panneau.dataset.onglet === nom);
  }
  for (const bouton of document.querySelectorAll('.parties-calculs button')) {
    bouton.classList.toggle('actif', bouton.dataset.partie === nom);
  }
  document.body.dataset.onglet = nom;
  navigation?.fermer();
  majBoutonsTerrain();
  if (nom !== 'plan' && nom !== 'dessin') pilote = null;
  // DAO (0.147.0) : seulement dans Calculs › Dessin (et le plan sur téléphone).
  if (nom !== 'plan' && nom !== 'dessin' && daoAppli?.actif()) daoAppli.arreter();
  // Annotation (0.180.3) : en quittant l'application, la loupe « Manuel » disparaît (sinon elle recouvre le plan).
  if (ongletAvant !== nom) fermerEncadreAnnotation();
  if (ongletAvant === 'annotation' && nom !== 'annotation') {
    annotationEtat.mode = null;
    plan.loupe.cacher();
    loupeImplantation = false;
  }
  if (nom !== 'plan' && nom !== ongletContexte) {
    // Triangles en trop (Terrain › Lever) : on arrête en quittant l'onglet.
    if (ongletContexte === 'terrain') editeurSurfaces.arreterModification();
    // Les mesures sont à part : on ne modifie pas une surface (ou une coupe) et une mesure en même temps.
    if (nom === 'mesures') {
      editeurSurfaces.arreterModification();
      if (traceCoupe) arreterTrace();
    } else {
      ecranMesures.arreterModification();
    }
    ongletContexte = nom;
    if (nom !== 'terrain') piloterBip(null);
    recalculer();
  }
  // 0.208.0 / 0.214.0 : le plan n'est pâli autour du travail que dans le Terrain ; dans l'application Plan (qui garde le
  // contexte d'avant) et ailleurs il est normal, et il le redevient en revenant dans le Terrain.
  plan.palirAutour(nom === 'terrain' && ongletContexte === 'terrain' ? travailAGarder() : null);
  mettreAJourToucheVolume();
  rattraperEcrans();
  // 0.126.0 : le suivi de la position revient tout seul dans Terrain ; Calculs cadre sur le volume.
  plan.retourAutomatiqueDuSuivi(ongletContexte === 'terrain' && nom !== 'plan');
  plan.autoriserRecentrageAuto(nom !== 'plan'); // 0.214.0 : pas de recentrage automatique dans l'application Plan
  if (entreDansCalculs) cadrerSurCalculs();
  if (nom === 'mesure-rapide') afficherMesureRapide();
  if (nom === 'annotation') afficherAnnotation();
  navigation?.mettreAJour();
  window.scrollTo(0, 0);
  if (nom === 'projets' && !partie) navigation?.ouvrirPage();
}

/**
 * Calculs › Volumes ou Mesures (0.126.0) : le plan cadre sur le volume montré (ou le premier),
 * sinon sur tous les points affichés, au lieu de suivre la position du GNSS.
 */
function cadrerSurCalculs() {
  const calcul = projet.calculs.find((c) => c.id === calculMontre) ?? projet.calculs[0];
  const surfaces = calcul ? [calcul.surface1Id, calcul.surface2Id].map((id) => projet.surfaces.find((s) => s.id === id)).filter(Boolean) : [];
  let coins = surfaces.flatMap((s) => (estImportee(s) ? (s.points ?? []) : pointsDuLeve(s.leveId)));
  if (coins.length === 0) coins = pointsAffiches ?? [];
  if (coins.length > 0) plan.cadrerSur(coins, 10, { libre: true });
}
/** Mode de Terrain en cours noté sur la page (body.dataset.modeTerrain) et bouton de la bande du bas à jour. */
function majBoutonsTerrain() {
  const dansTerrain = document.body.dataset.onglet === 'terrain';
  // Site (0.124) : le titre de la page suit le mode (Édition Lever ou Contrôle).
  const titreTerrain = document.querySelector('#titre-terrain');
  if (titreTerrain) titreTerrain.textContent = terrain.mode === 'autocontrole' ? 'Contrôle' : 'Édition Lever';
  if (dansTerrain) document.body.dataset.modeTerrain = terrain.mode;
  else delete document.body.dataset.modeTerrain;
  navigation?.mettreAJour();
}
document.querySelector('.parties-calculs').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-partie]');
  if (bouton) afficherOnglet(bouton.dataset.partie);
});
installerAide(document.querySelector('#bouton-aide'));
// Toucher le projet ouvert (en-tête) : on va à l'onglet Projet.
// 0.159.0 : toucher le nom du projet (en-tête) ouvre la page Applications (encadré du projet en haut).
document.querySelector('#entete-projet').addEventListener('click', () => navigation.ouvrirPage());
// Pages Import / Exporter / Contenu / Nouveau : « ← » à gauche du titre = retour au menu (0.161.0).
document.querySelector('.titre-partie-projet').addEventListener('click', (evenement) => {
  if (evenement.target.closest('[data-retour-menu]')) navigation.ouvrirPage();
});
// Page « Ouvrir projet » : sa flèche ← ramène à la page Applications (il n'y a plus de page Projet entière).
document.querySelector('#projets').addEventListener('click', (evenement) => {
  if (document.body.dataset.partieProjet === 'ouvrir' && evenement.target.closest('.entete-page-projets .bouton-retour[data-panneau="projets"]')) navigation.ouvrirPage();
});

// Réglages de cet appareil (roue ⚙) : mode Base / Intermédiaire / Expert, mode téléphone, bulles d'aide, nom de l'appareil.
appliquerReglages();
// Les barres de l'en-tête (1 verte = Base, 2 jaunes = Intermédiaire, 3 rouges = Expert) ouvrent aussi les réglages.
document.querySelector('#bouton-mode').addEventListener('click', () => ouvrirFenetreReglages());
// Fenêtre des réglages ouverte (pour y redessiner l'état du partage Drive), ou null.
/** Carte des projets (0.216.0, Base) : les projets de cet appareil et de Drive, placés à leur centre sur le fond swisstopo. */
function ouvrirCarteDesProjets() {
  const projets = projetsReunis(resumes, partage ? { etat: partage.etat, appareil: partage.appareil() } : null, 'date');
  navigation?.fermer();
  const carte = ouvrirCarteProjets(projets, {
    ouvertId: projet.id,
    appareilId: partage?.appareil().id ?? null,
    quandOuvrir: (p) => (p.local ? actionsProjet.ouvrirProjet(p.id) : actionsProjet.ouvrirDrive(p.drive.dossierId)),
  });
  // La liste de Drive est relue à l'ouverture : « 🔒 ouvert sur xxx » est à jour, la carte se redessine.
  if (partage?.etat.connecte) {
    partage.rafraichirListe().then(() => carte.miseAJour(projetsReunis(resumes, { etat: partage.etat, appareil: partage.appareil() }, 'date'))).catch(() => {});
  }
}

let fenetreReglages = null;
/** Fenêtre des réglages ⚙ (0.156.0 : tuile « Réglages » de la page Applications, ou la pyramide du mode). */
function ouvrirFenetreReglages(page = null) {
  // 0.160.0 : une vraie page (plein écran) ; « ← » ramène à la page Applications.
  fenetreReglages?.fermer?.();
  navigation?.fermer();
  fenetreReglages = ouvrirReglages({
    enPage: true,
    page,
    quandRetour: () => navigation.ouvrirPage(),
    aideActive: document.body.classList.contains('aide-active'),
    basculerAide: () => document.querySelector('#bouton-aide').click(),
    fermerAppli: estDansAppliAndroid() && typeof window.AppliAndroid.fermerAppli === 'function' ? fermerAppli : null,
    // Partie « Récepteur » des réglages (appli Android) : ouvre la fenêtre du récepteur.
    recepteur: estDansAppliAndroid() ? () => document.dispatchEvent(new CustomEvent('ouvrir-recepteur')) : null,
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
            reprendreLaMain: () => partage.prendreLaMain(),
            rendreLaMain: () => partage.rendreLaMain('rendue à la main'),
            reprendreApresRendu: () => partage.reprendreApresRendu(),
            // Recap des contrôles (0.119.0, Expert) : refait tout de suite (sinon une fois par jour).
            mettreAJourRecap: async () => {
              afficherMessage('Recap des contrôles : mise à jour…', null);
              const { erreur } = await partage.mettreAJourRecap({ forcer: true });
              afficherMessage(erreur ? `Recap impossible : ${erreur}` : 'Recap mis à jour : Drive › App Topo › Recap › Recap App Topo.xlsx', 6000);
            },
            nommerAppareil: (nom) => {
              partage.nommerAppareil(nom);
              fenetreReglages?.rafraichir();
            },
            nommerUtilisateur: (nom) => {
              partage.nommerUtilisateur(nom);
              fenetreReglages?.rafraichir();
            },
          },
        }
      : null,
  });
}

/**
 * On quitte ce que le nouveau mode cache (onglet Calculs en Base, Dessin, guidage de lame et talus
 * avant Expert). Rien n'est supprimé : en repassant dans un mode plus complet, tout est là.
 */
function adapterAuMode() {
  // Guidage de lame : mode Expert seulement.
  if (terrain.mode === 'lame' && !lameActive()) {
    terrain.mode = 'lever';
    retenirReglagesTerrain();
    majBoutonsTerrain();
  }
  if (estModeBase() && estPartieCalculs(document.body.dataset.onglet)) afficherOnglet('projets');
  else if (!aAcces('expert') && document.body.dataset.onglet === 'dessin') afficherOnglet('volumes');
  if (!aAcces('expert') && terrain.implantation === 'talus') {
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
  if (estImportee(surface)) precisions.push(origineSurface(surface));
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

// Projet › Exporter (0.92.1) : tous les exports au même endroit (voir export/module.js).
// Onglets « Import » (Expert) et « Exporter » de l'onglet Projet (0.103.0) : un seul ouvert à la
// fois, juste sous le projet ouvert ; le retoucher le referme. Fermés au démarrage.
let ongletProjet = null;
/** Montre l'onglet demandé ('import', 'export' ou null), ou remet à jour celui ouvert (après un changement de mode). */
function montrerOngletProjet(onglet = ongletProjet) {
  ongletProjet = onglet === 'import' && !aAcces('expert') ? null : onglet;
  document.querySelector('#importer').hidden = ongletProjet !== 'import';
  document.querySelector('#exporter-projet').hidden = ongletProjet !== 'export';
  for (const bouton of document.querySelectorAll('[data-onglet-projet]')) {
    const actif = bouton.dataset.ongletProjet === ongletProjet;
    bouton.classList.toggle('actif', actif);
    bouton.setAttribute('aria-pressed', String(actif));
  }
  rattraperEcrans();
}
document.querySelector('.onglets-projet').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-onglet-projet]');
  if (!bouton) return;
  montrerOngletProjet(bouton.dataset.ongletProjet === ongletProjet ? null : bouton.dataset.ongletProjet);
});

const moduleExport = creerModuleExport(document.querySelector('#exporter-projet'), {
  exporterListe: (type, id) => exporterListe(type, id),
  exporterControles: (format) => exporterControles(format).catch((e) => alert(`Export impossible : ${e.message ?? e}.`)),
  exporterImplantations: () => exporterImplantations(),
  exporterPlanRecale: (id) => exporterPlanRecale(id),
  // Cadastre · Swisstopo · photo en un clic (0.121.0) : ZIP avec le DXF et le GeoTIFF.
  exporterPaquet: async (options, dire) => {
    const resultat = await fabriquerPaquet(projet, options, {
      trianglesDe: (surface) => surfacesCalculees.get(surface.id)?.triangles ?? [],
      // Une surface Swisstopo (ou importée) garde ses propres points ; sinon ceux de son levé.
      pointsDe: (surface) => surface.points ?? pointsDuLeve(surface.leveId),
      dire,
    });
    if (resultat.erreur) {
      dire(resultat.erreur);
      return;
    }
    dire(`Prêt : ${resultat.nom}`);
    telecharger(resultat.blob, resultat.nom);
  },
  exporterProjet: () => {
    const complet = completerProjet(projet);
    telecharger(new Blob([ecrireFichierProjet(complet)], { type: 'application/json' }), `${nomDeFichierProjet(complet)}.topo.json`);
  },
});

/** Retire un point de contrôle (et ses photos) après confirmation. 0.209.0 : partagé par la page Gérer et le tableau de points. */
function retirerPointControleConfirme(id) {
  const point = projet.pointsControle.find((p) => p.id === id);
  if (!point || !confirm(`Enlever ${point.nom} des points de contrôle ?`)) return;
  projet.pointsControle = projet.pointsControle.filter((p) => p.id !== id);
  projet.photosControle = (projet.photosControle ?? []).filter((ph) => ph.pointId !== id);
  if (autocontrole.cible?.id === id) autocontrole.cible = null;
  modifie();
}

const ecranImport = creerEcranImport(document.querySelector('#importer'), document.querySelector('#contenu-projet'), {
  exporterListe: (type, id) => exporterListe(type, id),
  exporterPlanRecale: (id) => exporterPlanRecale(id),
  importerSurface: (fichier) => importerSurface(fichier),
  colorerListe: (id, couleur) => colorerListe(id, couleur),
  importerPointsControle: (fichier) => importerPointsControle(fichier),
  importerPoints: async (fichier) => {
    try {
      const resultat = lirePoints(await fichier.text());
      dernierImport = { ...resultat, nomFichier: fichier.name };
      if (resultat.points.length > 0) {
        // Simple liste de points, ou levé (0.77.0) : rangé dans Lever, à compléter dans Terrain › Lever.
        const choix = await demanderChoix({
          titre: `${resultat.points.length} point(s) dans « ${fichier.name} »`,
          texte: 'C\'est quoi ?',
          boutons: [['liste', 'Liste de points'], ...NATURES_IMPORT].map(([cle, titre], i) => ({ cle, texte: titre, detail: i === 0 ? '' : 'levé', principal: i === 0 })),
        });
        const leve = ajouterLeve(projet, fichier.name, resultat.points);
        if (choix !== 'liste') {
          const surface = leveDepuisFichier(projet, leve, choix);
          projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
          leveDirect.stockId = surface.id;
          editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
          montrerStockEnCours();
        }
      }
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
  // 0.194.0 (Expert) : modifier la liste des types de plans DXF (partagée par Drive).
  modifierTypesDxf: async () => {
    const actuels = lireTypesDxf().map((t) => t.nom).join(', ');
    const texte = await demanderTexte({ titre: 'Types de plans DXF (séparés par des virgules)', valeur: actuels });
    if (texte == null) return;
    const noms = nettoyerTypes(texte);
    if (noms.length === 0) {
      afficherMessage('Il faut au moins un type', 4000);
      return;
    }
    enregistrerTypesDxf(noms);
    afficherMessage('Types enregistrés (partagés par Drive)', 3000);
    recalculer();
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
      // 0.194.0 (Expert) : nom, type (GEOOFF, TER, CANA…) et recalage au choix, avant de ranger le plan.
      const types = lireTypesDxf();
      // 0.217.0 : la fenêtre dit si le plan est déjà en coordonnées suisses (MN95) ou non, et propose le recalage qui va avec.
      const dejaEnMn95 = estEnMn95(lu.bornes);
      const choix = await demanderChamps({
        titre: `Plan « ${fichier.name} »`,
        note: dejaEnMn95
          ? { ton: 'ok', texte: '✓ Coordonnées suisses (MN95) : le plan semble déjà en place.' }
          : { ton: 'alerte', texte: '⚠ Pas en coordonnées suisses (MN95) : le plan est à recaler.' },
        champs: [
          { cle: 'nom', titre: 'Nom du plan', valeur: lu.nom ?? fichier.name.replace(/\.dxf$/i, '') },
          { cle: 'type', titre: 'Type', choix: [['', '— aucun —'], ...types.map((t) => [t.nom, t.nom])], valeur: '' },
          // 0.214.0 : « Non (déjà calé) » : le plan est déjà en MN95, rien à recaler ni à signaler.
          { cle: 'recaler', titre: 'Recalage', choix: [['non', 'Plus tard'], ['oui', 'Recaler maintenant'], ['cale', 'Non (déjà calé)']], valeur: dejaEnMn95 ? 'cale' : 'oui' },
        ],
      });
      if (!choix) {
        afficherMessage('Plan non importé');
        recalculer();
        return;
      }
      const nouveau = { id: nouvelIdentifiant(), importeLe: new Date().toISOString(), ...lu, nom: choix.nom || lu.nom, type: choix.type || '', ...(choix.recaler === 'cale' ? { dejaCale: true } : {}) };
      projet.plansDxf.push(nouveau);
      dernierPlan = { nom: nouveau.nom, avertissements: choix.recaler === 'cale' ? avertissements.filter((a) => !a.includes('MN95')) : avertissements };
      afficherMessage(`Plan « ${nouveau.nom} » importé : ${lu.compte.objets} objets`, 4000);
      modifie();
      if (choix.recaler === 'oui') commencerRecalage(nouveau.id);
    } catch (erreur) {
      dernierPlan = { nom: fichier.name, erreur: erreur.message };
      afficherMessage('Plan non importé');
      recalculer();
    }
  },
  // 0.129.0 : plan PDF (Expert, Projet › Import) : les traits du PDF deviennent un plan DXF.
  // 0.130.0 : un PDF sans traits (scanné) devient une image en fond, recalée avec « Manuel ».
  importerPlanPdf: async (fichier) => {
    let doc = null;
    try {
      afficherMessage(`Ouverture du PDF « ${fichier.name} »…`, null);
      const pdfjs = await chargerPdfjs();
      doc = await ouvrirPdf(pdfjs, new Uint8Array(await fichier.arrayBuffer()));
      const pages = doc.numPages;
      let page = 1;
      if (pages > 1) {
        afficherMessage(`PDF ouvert : ${pages} pages`, 1500);
        const choix = await demanderChamps({ titre: `Plan PDF « ${fichier.name} »`, champs: [{ cle: 'page', titre: `Page (1 à ${pages})`, valeur: '1' }] });
        if (!choix) return;
        page = Number(choix.page);
        if (!Number.isInteger(page) || page < 1 || page > pages) throw new Error(`page « ${choix.page} » : choisis un nombre de 1 à ${pages}`);
      }

      afficherMessage(`Lecture du PDF (page ${page})…`, null);
      await new Promise((fin) => setTimeout(fin, 30));
      const contenu = await contenuDeLaPage(doc, page, pdfjs.OPS);
      // Vectoriel → traits ; sans traits mais avec une image (scanné) → image (choix d'office, validé le 05.11).
      const enImage = contenu.traits.length === 0 && contenu.textes.length === 0;
      if (enImage && contenu.images === 0) throw new Error('aucun trait ni image sur cette page');
      afficherMessage(enImage ? 'PDF scanné : il sera posé en image' : `PDF en traits : ${contenu.traits.length} traits`, 2500);
      // 0.217.0 : comme pour un DXF, la fenêtre le dit : un PDF est une page (en points), jamais en coordonnées suisses.
      const valeurs = await demanderChamps({
        titre: `Plan PDF « ${fichier.name} »${enImage ? ' (image)' : ''}`,
        note: { ton: 'alerte', texte: '⚠ Un PDF n\'est pas en coordonnées suisses (MN95) : le plan est à recaler.' },
        champs: [
          { cle: 'echelle', titre: 'Échelle du plan 1:', valeur: '', exemple: '500 (vide si inconnue)' },
          // 0.145.0 (liste du 05.11, point 10, à essayer) : PDF en traits montré comme le PDF (image de la
          // page), ses traits restant invisibles pour les accroches ; ou en traits comme un DXF (avant).
          ...(enImage ? [] : [{ cle: 'aspect', titre: 'Affichage', choix: [['image', 'Aspect du PDF (image + accroches)'], ['traits', 'Traits (comme un DXF)']], valeur: 'image' }]),
          { cle: 'nettete', titre: 'Netteté de l\'image', choix: NETTETES.map(([cle, titre, dpi]) => [cle, `${titre} (${dpi} dpi)`]), valeur: NETTETE_DEPART },
          // 0.213.0 : comme pour un DXF : type du plan (liste partagée) et recalage tout de suite ou plus tard.
          { cle: 'type', titre: 'Type', choix: [['', '— aucun —'], ...lireTypesDxf().map((t) => [t.nom, t.nom])], valeur: '' },
          { cle: 'recaler', titre: 'Recalage', choix: [['non', 'Plus tard'], ['oui', 'Recaler maintenant'], ['cale', 'Non (déjà calé)']], valeur: 'non' },
        ],
      });
      if (!valeurs) return;
      const { echelle, erreur: erreurEchelle } = lireEchelle(valeurs.echelle);
      if (erreurEchelle) throw new Error(erreurEchelle);

      // Préfixe fixe « PDF- » (0.132.0) ; « .pdf » est enlevé (le préfixe le dit déjà).
      const base = fichier.name.replace(/\.pdf$/i, '');
      const nom = avecPrefixe(pages > 1 ? `${base} (page ${page})` : base, PREFIXE_PDF);
      const avertissements = valeurs.recaler === 'cale' ? [] : [`Plan PDF : il n'est pas en MN95, touche « recaler » sur le plan pour le mettre en place${enImage ? ' (accroche « Manuel » : loupe)' : ''}.`];
      if (!echelle) avertissements.push('Sans échelle : le plan est à la taille de la feuille, le recalage trouvera l\'échelle.');
      let lu;
      if (enImage) {
        const rendu = facteurDeRendu(contenu.largeur, contenu.hauteur, valeurs.nettete);
        afficherMessage(`Image de la page (${rendu.dpi} dpi)…`, null);
        await new Promise((fin) => setTimeout(fin, 30));
        const image = await imageDeLaPage(doc, page, rendu.facteur);
        lu = planImagePdf({ nom, largeurPt: image.largeurPt, hauteurPt: image.hauteurPt, echelle, donnees: image.donnees, pixels: image.pixels });
        const octets = image.donnees.length * 0.75;
        const taille = octets >= 1e6 ? `${(octets / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1e3))} Ko`;
        if (rendu.reduite) avertissements.push(`Page très grande : image réduite à ${rendu.dpi} dpi (${image.pixels.largeur} × ${image.pixels.hauteur} pixels).`);
        avertissements.push(`Image de ${taille} (envoyée avec le projet sur Drive).`);
      } else {
        const lecture = lirePlanDxf(dxfDuPdf(contenu, echelle), nom);
        if (lecture.erreur || !lecture.plan.bornes) throw new Error(lecture.erreur ?? 'aucun objet dessiné trouvé');
        lu = lecture.plan;
        if (valeurs.aspect === 'image') {
          // Image de la page posée sous les traits : son coin en bas à gauche est l'origine de la page,
          // les traits sont rangés depuis l'origine du plan lu (décalage par la matrice de l'image).
          const rendu = facteurDeRendu(contenu.largeur, contenu.hauteur, valeurs.nettete);
          afficherMessage(`Image de la page (${rendu.dpi} dpi)…`, null);
          await new Promise((fin) => setTimeout(fin, 30));
          const image = await imageDeLaPage(doc, page, rendu.facteur);
          const page2 = planImagePdf({ nom, largeurPt: image.largeurPt, hauteurPt: image.hauteurPt, echelle, donnees: image.donnees, pixels: image.pixels });
          lu.contenu.image = { ...page2.contenu.image, matrice: [1, 0, 0, 1, -lu.origine.est, -lu.origine.nord] };
          lu.traitsInvisibles = true;
          avertissements.push('Aspect du PDF : on voit l\'image de la page ; ses traits sont invisibles mais servent aux accroches (Sommet, Milieu, Ligne…).');
        }
        if (contenu.images > 0) avertissements.push(`${contenu.images} image(s) du PDF non reprise(s) (seuls les traits et les textes sont lus).`);
      }
      const nouveauPlan = { id: nouvelIdentifiant(), importeLe: new Date().toISOString(), ...lu, type: valeurs.type || '', ...(valeurs.recaler === 'cale' ? { dejaCale: true } : {}), pdf: { page, echelle, image: enImage } };
      projet.plansDxf.push(nouveauPlan);
      dernierPlan = { nom, avertissements };
      afficherMessage(`Plan PDF « ${nom} » importé${enImage ? ' en image' : ` : ${lu.compte.objets} objets`}`, 4000);
      modifie();
      if (valeurs.recaler === 'oui') commencerRecalage(nouveauPlan.id);
    } catch (erreur) {
      dernierPlan = { nom: fichier.name, erreur: erreur.message };
      afficherMessage(`Plan PDF non importé : ${erreur.message}`, 8000);
      recalculer();
    } finally {
      doc?.loadingTask?.destroy();
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
  exporterPlanRecale,
  exporterListe,
  // 0.191.0 : « Exporter la sélection (CSV) » du tableau « Points » de Contenu du projet.
  exporterTableauPoints: (csv, nombre) => {
    const base = `${nomDeFichierProjet(projet)}_points`.replace(/[\\/:*?"<>|]/g, '_');
    ouvrirFenetreExport({
      titre: `Points (${nombre})`,
      formats: [['csv', 'CSV', 'la sélection du tableau (Excel)']],
      fabriquer: async () => ({ blob: new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), nom: `${base}.csv` }),
      enregistrer: enregistrerFichier,
      message: (texte) => afficherMessage(texte, 5000),
    });
  },
  // Point tapé (nom, Est, Nord, altitude facultative) : rangé dans le levé « Points ajoutés ».
  ajouterPointTape: (valeurs) => {
    const { point, erreur } = ajouterPointAjoute(projet, { ...valeurs, source: 'tape', appareil: nomDeLAppareil() });
    if (erreur) return { erreur };
    afficherMessage(`Point ${point.nom} ajouté`, 2500);
    modifie();
    return null;
  },
  commencerPointage: () => commencerPointage(),
  commencerSurfaceSwisstopo: () => {
    if (cadastreAutour.actif()) cadastreAutour.arreter();
    surfaceSwisstopo.commencer();
  },
  commencerCadastre: () => {
    if (surfaceSwisstopo.actif()) surfaceSwisstopo.arreter();
    cadastreAutour.commencer();
  },
  montrerCalqueDxf: (id, numero, visible) => {
    const calque = projet.plansDxf.find((p) => p.id === id)?.calques[numero];
    if (!calque) return;
    calque.visible = visible;
    affichageModifie();
  },
  montrerTousCalquesDxf: (id, visible) => {
    for (const calque of projet.plansDxf.find((p) => p.id === id)?.calques ?? []) calque.visible = visible;
    affichageModifie();
  },
  // Cadastre (0.116.4) : points montrés ou non (Projet › Contenu du projet › Cadastre).
  montrerPointsCadastre: (id, visible) => {
    montrerListe(projet, id, visible);
    recalculer();
    enregistrer();
  },
  // Cadastre : supprime ensemble la liste de points et le plan DXF des lignes.
  supprimerCadastre: (id) => {
    const leve = projet.leves.find((l) => l.id === id);
    if (!leve || !confirm(`Supprimer le cadastre « ${leve.nom} » (${leve.points.length} points et ses lignes) ?`)) return;
    const planDxf = planDuCadastre(projet, leve);
    projet.leves = projet.leves.filter((l) => l.id !== id);
    if (planDxf) projet.plansDxf = projet.plansDxf.filter((p) => p.id !== planDxf.id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    dernierPlan = null;
    modifie({ recadrer: true });
  },
  // 0.208.0 : retirer un point de la liste « Points de contrôle » depuis la page Gérer (Intermédiaire, sans code).
  enleverPointControle: (id) => retirerPointControleConfirme(id),
  // 0.209.0 : supprimer un point seul de n'importe quelle liste (tableau de points, Intermédiaire, sans code). S'il sert dans un
  // contour, des lignes, une mesure ou des photos, la confirmation le dit et il en est retiré aussi.
  supprimerPointListe: (listeId, nom) => {
    if (listeId === 'controle') {
      const point = projet.pointsControle.find((p) => p.nom === nom);
      if (point) retirerPointControleConfirme(point.id);
      return;
    }
    const leve = projet.leves.find((l) => l.id === listeId);
    if (!leve || !leve.points.some((p) => p.nom === nom)) return;
    const usages = texteUsages(usagesDuPoint(projet, leve, nom));
    const suite = usages ? `\n\nIl sert dans : ${usages}. Il en sera aussi retiré.` : '';
    if (!confirm(`Supprimer le point ${nom} de la liste « ${leve.nom} » ?${suite}`)) return;
    retirerPointDuProjet(projet, leve, nom);
    editeurSurfaces.charger(projet.surfaces);
    afficherMessage(`Point ${nom} supprimé`);
    modifie();
  },
  // 0.208.0 : supprimer toute la liste « Points de contrôle » (Expert). L'historique des contrôles est gardé.
  supprimerListeControle: () => {
    const nombre = projet.pointsControle.length;
    if (nombre === 0 || !confirm(`Supprimer la liste « Points de contrôle » (${nombre} points) ? L'historique des contrôles est gardé.`)) return;
    projet.pointsControle = [];
    projet.photosControle = [];
    autocontrole.cible = null;
    modifie();
  },
  supprimerLeve: (id) => {
    const leve = projet.leves.find((l) => l.id === id);
    const levees = [...projet.surfaces, ...projet.autres].filter((s) => s.leveId === id);
    const mesuresDuLeve = projet.mesures.filter((m) => m.leveId === id);
    const texteLevees = levees.length > 0 ? `, ${levees.length === 1 && leve?.dediee ? 'le levé' : `${levees.length} levé(s)`}` : '';
    const texteMesures = mesuresDuLeve.length > 0 ? ` et ${mesuresDuLeve.length} mesure(s)` : '';
    if (!leve || !confirm(`Supprimer la liste « ${leve.nom} » (${leve.points.length} points)${texteLevees}${texteMesures} ?`)) return;
    projet.leves = projet.leves.filter((l) => l.id !== id);
    projet.surfaces = projet.surfaces.filter((s) => s.leveId !== id);
    projet.mesures = projet.mesures.filter((m) => m.leveId !== id);
    projet.autres = projet.autres.filter((a) => a.leveId !== id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    editeurSurfaces.charger(projet.surfaces);
    modifie({ recadrer: true });
  },
  // Projet › Surface Projet (0.77.0) : surfaces importées (LandXML, DXF 3D).
  renommerSurfaceProjet: (id, nom) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    const suite = surface && sansPrefixe(nom, prefixeDuNom(surface));
    if (!suite) return;
    surface.nom = avecPrefixe(suite, prefixeDuNom(surface)); // le préfixe « Surf- » reste toujours
    modifie();
  },
  voirPhoto: (id) => montrerPhoto(id),
  // Archives (0.119.0, Expert) : l'élément quitte le projet actif, restaurable dans « Archivés ».
  archiver: (type, id) => {
    const { archive, erreur } = archiver(projet, type, id);
    if (erreur) {
      afficherMessage(`Impossible d'archiver : ${erreur}`, 4000);
      return;
    }
    // Levé en cours ou dessin en cours archivé : on ne le suit plus.
    if (leveDirect.stockId && !stockEnCours()) {
      leveDirect.stockId = null;
      reprendreLeveDirect();
    }
    if (pilote && !(projet.dessins ?? []).some((d) => d.id === pilote.dessinId)) pilote = null;
    editeurSurfaces.charger(projet.surfaces);
    dernierPlan = null;
    afficherMessage(`« ${archive.nom} » archivé (Contenu du projet › Archivés)`, 3500);
    modifie({ recadrer: true });
  },
  restaurerArchive: (id) => {
    const { nom, erreur } = restaurer(projet, id);
    if (erreur) {
      afficherMessage(`Impossible de restaurer : ${erreur}`, 4000);
      return;
    }
    editeurSurfaces.charger(projet.surfaces);
    afficherMessage(`« ${nom} » restauré`, 3000);
    modifie({ recadrer: true });
  },
  supprimerArchive: (id) => {
    const archive = (projet.archives ?? []).find((a) => a.id === id);
    if (!archive || !confirm(`Supprimer pour de bon « ${archive.nom} » des archives ?\n\nLa suppression est définitive.`)) return;
    supprimerArchive(projet, id);
    modifie();
  },
  supprimerSurfaceProjet: (id) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    if (!surface || !confirm(`Supprimer la surface « ${surface.nom} » ?`)) return;
    projet.surfaces = projet.surfaces.filter((s) => s.id !== id);
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
/** Levé en cours, quelle que soit sa sorte (surface ou levé libre), ou null. */
function leveeEnCours() {
  return stockEnCours();
}

/** Levé (fait avec le récepteur) de la surface ou du levé libre en cours, ou null. */
function leveEnCours() {
  const enCours = leveeEnCours();
  return enCours ? projet.leves.find((l) => l.id === enCours.leveId) ?? null : null;
}

/** Surfaces levées avec le récepteur (celles qu'on peut reprendre dans l'onglet Terrain). */
function surfacesLevees() {
  const directs = new Set(projet.leves.filter(estLeveDirect).map((l) => l.id));
  return projet.surfaces.filter((s) => directs.has(s.leveId));
}

/** Levé en cours = celui d'identifiant « id » (liste « Changer », sous-application de Lever). */
function choisirLevee(id) {
  editeurSurfaces.arreterModification();
  leveDirect.stockId = id;
  // Levé libre (« Autres ») : pas une surface ; on affiche les points de son levé.
  const horsSurface = projet.autres.find((a) => a.id === id);
  if (horsSurface) projet.leveActifId = horsSurface.leveId;
  else montrerStockEnCours();
  recalculer({ recadrer: Boolean(horsSurface) });
}

/** Affiche la surface en cours sur le plan et dans Calculs › Surfaces (son levé devient le levé affiché). */
function montrerStockEnCours() {
  const index = projet.surfaces.indexOf(stockEnCours());
  if (index >= 0) editeurSurfaces.choisir(index);
}

/** Reprend une surface levée s'il n'y en a pas en cours (celle du levé affiché, sinon la dernière). */
function reprendreLeveDirect() {
  const enCours = leveeEnCours();
  if (enCours && familleDeNature(enCours.nature) === 'leve') return;
  // Levés de l'application Lever, le plus récent d'abord choisi.
  const levees = [...surfacesLevees(), ...projet.autres.filter((a) => !estAnnotation(a))];
  const choisie = levees.filter((s) => s.leveId === projet.leveActifId).at(-1) ?? levees.at(-1);
  leveDirect.stockId = choisie?.id ?? null;
}

/**
 * Nouveau levé (avec sa propre liste de points) : un stock a tout de suite son calcul de volume.
 */
function ajouterSurfaceLevee(nature) {
  // Chaque levé a sa propre liste de points, à son nom (0.77.0).
  const leve = creerListeDeLevee(projet);
  if (nature === 'chantier') {
    const chantier = creerChantier(projet, leve);
    nommerListeDeLevee(projet, chantier);
    projet.leveActifId = leve.id;
    leveDirect.stockId = chantier.id;
    leveDirect.role = 'isole';
    modifie({ recadrer: true });
    return;
  }
  if (nature === 'autres') {
    const autres = creerAutres(projet, leve);
    nommerListeDeLevee(projet, autres);
    projet.leveActifId = leve.id;
    leveDirect.stockId = autres.id;
    leveDirect.role = 'isole';
    modifie({ recadrer: true });
    return;
  }
  const surface = creerSurfaceDirecte(projet, leve, nature);
  nommerListeDeLevee(projet, surface);
  projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
  leveDirect.stockId = surface.id;
  // Un stock commence par son contour ; un terrain naturel ou un terrassement par des points isolés.
  leveDirect.role = surface.nature === 'stock' ? 'contour' : 'isole';
  editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
  montrerStockEnCours();
  modifie({ recadrer: true });
}

// Récepteur (appli Android) : la barre d'état sous l'en-tête l'ouvre ; fenêtre pour
// connecter / couper le récepteur et régler les corrections NTRIP (voir leve/recepteur.js).
const boutonRecepteur = recepteurDisponible()
  ? creerBoutonRecepteur(document.querySelector('.entete'), {
      classeBouton: 'entete-icone-bouton bouton-recepteur-entete',
      choisirRecepteur,
      reconnecter: reconnecterRecepteur,
      // Hauteur de canne (0.107.1) : montrée pour contrôle, changée en Expert (comme dans Emlid Flow).
      lireHauteurCanne: () => terrain.hauteurCanne ?? null,
      reglerHauteurCanne: (texte) => {
        const lue = lireAltitude(texte);
        if (lue === undefined) return false;
        if (lue != null && (lue < 0 || lue > 10)) {
          alert(`Hauteur de canne « ${texte} » : entre 0 et 10 m.`);
          return false;
        }
        terrain.hauteurCanne = lue;
        retenirReglagesTerrain();
        afficherMessage(lue == null ? 'Hauteur de canne effacée' : `Hauteur de canne : ${lue.toFixed(3)} m`);
        return true;
      },
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
      // Journal NMEA (Expert, 0.82.0) : tout ce que le RX2 envoie pendant 1 minute, dans un fichier.
      journalNmea: journalNmeaDisponible() ? enregistrerJournalNmea : null,
      // Essai à 2 récepteurs (mode Expert) : seulement avec un APK qui le sait.
      choisirRecepteur2: recepteur2Disponible() ? choisirRecepteur2 : null,
      deconnecter2: deconnecterRecepteur2,
      choisirModeCorrections2,
      lireReglagesCorrections2,
      demarrerCorrections2: (reglages) => {
        demarrerCorrections2(reglages);
        afficherMessage('Récepteur 2 : connexion à swipos…');
      },
      arreterCorrections2,
    })
  : null;
if (boutonRecepteur && recepteur2Disponible()) {
  ecouterRecepteur2((etat, mode) => {
    const changeConnexion = Boolean(etat?.connecte) !== Boolean(etatRecepteur2?.connecte);
    etatRecepteur2 = etat;
    boutonRecepteur.mettreAJour2(etat, mode);
    if (changeConnexion && terrain.mode === 'lame') recalculer(); // message « Connecte le 2e RX2 »
    else montrerLame();
  });
}

// Onglet Terrain (téléphone) : flèches ▲ / ▼ sous le plan ; chaque appui change sa hauteur de 15 %
// de l'écran (entre 20 % et 80 %, 35 % au départ), retenue sur l'appareil.
// Pendant le guidage d'une implantation (0.84.0), le plan a sa propre part (la moitié au départ).
const CLE_PLAN_TERRAIN = 'topo-plan-terrain-part';
const CLE_PLAN_GUIDAGE = 'topo-plan-guidage-part';
// 0.175.3 (demande du 09.11) : Lever / Terrain entre 30 % et 70 % (les infos sous le plan gardent 30 % au moins), guidage d'une
// implantation entre 30 % et 85 % ; une part choisie avec ▲ / ▼ (ou retenue) est respectée : l'agrandissement automatique ne la change plus.
const PART_PLAN = { pas: 0.15, min: 0.3, max: 0.7, depart: 0.35, departGuidage: 0.5, maxGuidage: 0.85 };
const partsPlan = { terrain: PART_PLAN.depart, guidage: PART_PLAN.departGuidage };
const bornesPlan = (sorte) => [PART_PLAN.min, sorte === 'guidage' ? PART_PLAN.maxGuidage : PART_PLAN.max];
let partTerrainChoisie = false; // vrai dès que la part a été choisie (▲ / ▼ ou retenue sur l'appareil)
for (const [sorte, cle, variable] of [['terrain', CLE_PLAN_TERRAIN, '--part-plan-terrain'], ['guidage', CLE_PLAN_GUIDAGE, '--part-plan-guidage']]) {
  try {
    const lue = Number(localStorage.getItem(cle));
    const [mini, maxi] = bornesPlan(sorte);
    if (localStorage.getItem(cle) !== null && lue >= mini && lue <= maxi) {
      partsPlan[sorte] = lue;
      if (sorte === 'terrain') partTerrainChoisie = true;
    }
  } catch {
    // stockage refusé : hauteur de départ
  }
  document.body.style.setProperty(variable, String(partsPlan[sorte]));
}
for (const bouton of document.querySelectorAll('[data-taille-plan]')) {
  bouton.addEventListener('click', () => {
    const enGuidage = document.body.classList.contains('vue-implantation');
    const sorte = enGuidage ? 'guidage' : 'terrain';
    // Part vraiment montrée (l'agrandissement automatique peut l'avoir dépassée) : on part d'elle.
    const actuelle = sorte === 'terrain' ? Math.max(partsPlan.terrain, Number(document.body.style.getPropertyValue('--part-plan-auto')) || 0) : partsPlan.guidage;
    const [mini, maxi] = bornesPlan(sorte);
    const voulue = actuelle + Number(bouton.dataset.taillePlan) * PART_PLAN.pas;
    partsPlan[sorte] = Math.round(Math.min(maxi, Math.max(mini, voulue)) * 100) / 100;
    if (sorte === 'terrain') {
      partTerrainChoisie = true;
      document.body.style.setProperty('--part-plan-auto', '0');
    }
    document.body.style.setProperty(enGuidage ? '--part-plan-guidage' : '--part-plan-terrain', String(partsPlan[sorte]));
    try {
      localStorage.setItem(enGuidage ? CLE_PLAN_GUIDAGE : CLE_PLAN_TERRAIN, String(partsPlan[sorte]));
    } catch {
      // pas retenu
    }
  });
}

// 0.126.0 : écran court (peu de choses sous le plan) → le plan s'agrandit pour remplir l'écran
// (--part-plan-auto, jamais moins que la part choisie par ▲ / ▼, au plus 80 %). Recalculé dès que
// le contenu sous le plan change de taille (ResizeObserver).
function ajusterPlanAuContenu() {
  const disponible = window.innerHeight - (document.querySelector('header')?.offsetHeight ?? 0) - (document.querySelector('.bande-appli')?.offsetHeight ?? 0);
  const colonne = document.querySelector('.colonne-gauche');
  if (!colonne || disponible <= 0) return;
  // Bande fixe « ID point / Enreg. Pts » de Lever : elle prend aussi de la place en bas.
  const bande = document.querySelector('.cadre-prise .ligne-id-prendre');
  const hauteurBande = bande && getComputedStyle(bande).position === 'fixed' ? bande.offsetHeight + 12 : 0;
  // 0.167.0 : dans Lever (APK), le plan prend tout sauf l'essentiel du rôle choisi (Contour : « Contour en cours » ;
  // Ligne : « Ligne en cours » avec ses boutons et libellés ; Point : les libellés) ; le reste (comptes, triangles)
  // défile sous le bandeau. La ligne E / N posée au-dessus du bandeau est comptée pour ne rien cacher.
  const bas = colonne.getBoundingClientRect();
  const essentiel = [...document.querySelectorAll('#leve-direct .cadre-role .element-en-cours, #leve-direct .cadre-role .chantier-leve, #leve-direct .cadre-role .libelles-terrain')].find((e) => e.offsetParent !== null);
  const enNord = document.querySelector('.ligne-position-delta');
  const hauteurEnNord = bande && essentiel && enNord && getComputedStyle(enNord).position === 'fixed' ? enNord.offsetHeight + 4 : 0;
  const utile = bande && essentiel && getComputedStyle(bande).position === 'fixed' ? essentiel.getBoundingClientRect().bottom - bas.top + 6 : bas.height;
  const part = (disponible - utile - hauteurBande - hauteurEnNord - 24) / disponible;
  const auto = partTerrainChoisie ? 0 : Math.min(PART_PLAN.max, Math.max(0, Math.round(part * 100) / 100));
  if (document.body.style.getPropertyValue('--part-plan-auto') !== String(auto)) document.body.style.setProperty('--part-plan-auto', String(auto));
}
let ajustementPrevu = false;
new ResizeObserver(() => {
  if (ajustementPrevu) return;
  ajustementPrevu = true;
  requestAnimationFrame(() => {
    ajustementPrevu = false;
    ajusterPlanAuContenu();
  });
}).observe(document.querySelector('.colonne-gauche'));
window.addEventListener('resize', () => requestAnimationFrame(ajusterPlanAuContenu));

// Lever existe aussi sur le site depuis 0.96.0 (sans récepteur : modifier les levés).
const ecranLeve = creerEcranLeve(document.querySelector('#leve-direct'), {
      ouvrirRecepteur: () => boutonRecepteur?.ouvrir(),
      nouvelleSurface: (nature) => ajouterSurfaceLevee(nature),
      // Renommer le levé en cours (surface ou levé libre) : les noms des points ne changent pas.
      renommerLevee: (id, nom) => {
        const levee = [...projet.surfaces, ...projet.autres].find((s) => s.id === id);
        if (!levee) return;
        const suite = sansPrefixe(nom, prefixeDuNom(levee));
        if (!suite) return;
        levee.nom = avecPrefixe(suite, prefixeDuNom(levee)); // le préfixe reste toujours
        nommerListeDeLevee(projet, levee);
        modifie();
      },
      // Croix rouge de « Changer » (Expert) : le levé et ses points, après confirmation.
      supprimerLevee: (id) => {
        const levee = [...projet.surfaces, ...projet.autres].find((s) => s.id === id);
        if (!levee) return false;
        const nombre = pointsDeLaLevee(projet, id).length;
        if (!confirm(`Supprimer « ${levee.nom} » et ${nombre} point(s) ?\n\nLa suppression est définitive.`)) return false;
        const resultat = supprimerLevee(projet, id);
        if (leveDirect.stockId === id) {
          leveDirect.stockId = null;
          reprendreLeveDirect();
        }
        editeurSurfaces.charger(projet.surfaces);
        afficherMessage(`« ${resultat.nom} » supprimé (${resultat.points} point(s))`, 3000);
        modifie({ recadrer: true });
        return true;
      },
      choisirStock: (id) => choisirLevee(id),
      choisirRole: (role) => {
        leveDirect.role = role;
        if (ajoutLevee.actif) dessinerBarreAjout();
        recalculer();
      },
      nouvelleLigne: () => {
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
      // Photos du levé en cours (0.77.0) : appareil photo à gauche de PRENDRE LE POINT.
      ajouterPhotosLevee: (fichiers) => {
        const levee = leveeEnCours();
        if (!levee || refuserEnLectureSeule()) return;
        // 0.96.0 : la photo attend le prochain point enregistré, et prend son nom (voir rangerPointPris).
        ajouterPhotos(levee, fichiers, { attentePoint: true, dessiner: levee.nature === 'chantier' });
      },
      // Photo de tout le levé (0.140.0, Intermédiaire, bandeau « Lever en cours ») : sans point.
      ajouterPhotosLeveeGlobale: (fichiers) => {
        const levee = leveeEnCours();
        if (!levee || refuserEnLectureSeule()) return;
        ajouterPhotos(levee, fichiers);
      },
      legendePhotoLevee: (id, legende) => {
        const photo = (leveeEnCours())?.photos?.find((p) => p.id === id);
        if (!photo) return;
        photo.legende = legende;
        modifie();
      },
      supprimerPhotoLevee: (id) => {
        const levee = leveeEnCours();
        if (!levee?.photos?.some((p) => p.id === id) || !confirm('Supprimer cette photo ?')) return;
        levee.photos = levee.photos.filter((p) => p.id !== id);
        modifie();
      },
      // Triangles en trop (Intermédiaire, 0.77.0) : on les touche sur le plan pour les enlever ou les remettre.
      basculerTrianglesLevee: () => {
        const stock = stockEnCours();
        if (!stock) return;
        montrerStockEnCours();
        editeurSurfaces.suppressionTriangles(!(editeurSurfaces.enSuppression() && editeurSurfaces.objetActif() === stock));
        recalculer();
      },
      retablirTrianglesLevee: () => {
        const stock = stockEnCours();
        if (!stock?.trianglesSupprimes?.length) return;
        stock.trianglesSupprimes = [];
        modifie();
      },
      commencerAjout,
      arreterAjout,
      // Delta du prochain point (0.139.0) : sens gauche / droite, distance, Z ; « effacer » remet à zéro.
      reglerDelta: (champ, valeur, redessiner = true) => {
        if (champ === 'sens') deltaLeve.sens = valeur === 'gauche' ? 'gauche' : 'droite';
        else if (champ === 'distance' || champ === 'z') deltaLeve[champ] = String(valeur ?? '');
        else if (champ === 'ouvrir') deltaLeve.ouvert = !deltaLeve.ouvert;
        else if (champ === 'effacer') {
          deltaLeve.distance = '';
          deltaLeve.z = '';
          deltaLeve.ouvert = false;
        }
        if (redessiner) ecranLeve?.afficher(donneesLeve());
      },
      prendrePoint: (nom, attributs = {}) => {
        if (refuserEnLectureSeule()) return;
        const leve = leveEnCours();
        const stock = stockEnCours();
        if (!leve || !stock) return;
        // Levé chantier (0.175.0) : nature, Ø obligatoire en « Dessus »… vérifiés avant de lire le GNSS.
        const chantier = stock?.nature === 'chantier' ? lireAttributsChantier(libelleChantier(terrain.chantier.libelle), terrain.chantier) : null;
        if (chantier?.erreur) {
          refuser(`Point refusé : ${chantier.erreur}`);
          return;
        }
        // Position vérifiée par l'appli Android au moment du toucher : RTK fixe et inclinaison prête.
        const reponse = prendrePointRecepteur();
        if (!reponse.ok) {
          refuser(`Point refusé : ${reponse.raison}`);
          return;
        }
        let { est, nord, altitude, ...gnss } = reponse.point;
        // Delta (0.139.0) : seule la position décalée est gardée (le décalage est noté avec le GNSS).
        const delta = deltaEnMetres();
        if (deltaActif(delta)) {
          const decale = pointAvecDelta({ est, nord, altitude }, delta, dernierAzimut);
          if (!decale) {
            refuser('Point refusé : pas de cap du GNSS pour le décalage gauche / droite');
            return;
          }
          ({ est, nord, altitude } = decale);
          gnss = { ...gnss, delta: { ...delta, azimut: dernierAzimut != null ? Math.round(dernierAzimut * 10) / 10 : null } };
          deltaLeve.distance = '';
          deltaLeve.z = '';
          deltaLeve.ouvert = false;
        }
        const point = { est, nord, altitude, gnss: { ...gnss, prisLe: new Date().toISOString(), appareil: nomDeLAppareil() } };
        // Levé chantier : attributs, altitude gardée (fil d'eau, radier) et cadre d'un ouvrage à 3 coins.
        if (chantier) {
          prendrePointChantier(leve, stock, nom, point, chantier.attributs);
          return;
        }
        // Contour du stock et croisements (0.78.0) : le point peut finir en point isolé, ou être refusé.
        controlerPlacePoint(stock, leveDirect.role, point).then((role) => {
          if (!role) return;
          const nomVoulu = role === leveDirect.role ? nom.trim() : '';
          const libelle = role === leveDirect.role ? libelleDuRole() : libelleDesPoints();
          rangerPointPris(ajouterPointDirect(leve, stock, role, { ...point, nom: nomVoulu || prochainNom(projet, stock, role, libelle) }, nomsDuProjet(projet)));
        });
      },
      // Liste des lignes en bas de Lever (0.78.0) : supprimer un point, ou un segment d'une ligne.
      supprimerPointLevee: (nom) => {
        const stock = stockEnCours();
        const leve = leveEnCours();
        if (!stock || !leve || refuserEnLectureSeule() || !confirm(`Supprimer le point ${nom} ?`)) return;
        supprimerPointDuLevee(leve, stock, nom, [...projet.surfaces, ...projet.autres, ...projet.mesures]);
        afficherMessage(`Point ${nom} supprimé`);
        modifie();
      },
      supprimerSegmentLevee: (valeur) => {
        const stock = stockEnCours();
        const [index, i] = String(valeur).split(':').map(Number);
        const ligne = stock?.lignesRupture[index];
        if (!ligne || refuserEnLectureSeule()) return;
        const [a, b] = [ligne.noms[i], ligne.noms[(i + 1) % ligne.noms.length]];
        if (!confirm(`Supprimer le segment ${a} → ${b} de ${nomDeLigne(ligne, index)} ?\n\nLa ligne est coupée en deux ; les points restent.`)) return;
        supprimerSegment(stock, index, i);
        modifie();
      },
      // Lignes depuis les suites de points (0.95.0) : lignes de rupture, ou le contour d'un stock.
      creerLignesDepuisSuites: (suites, role) => {
        const stock = stockEnCours();
        if (!stock || refuserEnLectureSeule()) return;
        const nombre = creerLignesDepuisSuites(stock, suites, role);
        afficherMessage(role === 'contour' ? 'Contour créé' : `${nombre} ligne(s) créée(s)`, 3000);
        modifie();
      },
      // Levé chantier : un champ du cadre de saisie (libellé, nature, mode, forme, Ø, profondeur, matériau, remarque).
      reglerChantier: (champ, valeur, redessiner = true) => {
        if (!(champ in terrain.chantier)) return;
        terrain.chantier[champ] = String(valeur ?? '');
        // Changer de libellé : les natures et les champs changent, on repart avec la forme ronde.
        if (champ === 'libelle') {
          terrain.chantier.forme = 'ronde';
          terrain.chantier.mode = '';
          terrain.chantier.diametre = '';
          terrain.chantier.gaine = '';
          terrain.chantier.profondeur = '';
          const libelle = libelleChantier(valeur);
          const natures = lireNaturesChantier()[libelle.reseau ? 'reseau' : 'bordure'];
          if (!natures.includes(terrain.chantier.nature)) terrain.chantier.nature = natures[0];
        }
        retenirReglagesTerrain();
        if (redessiner) recalculer();
      },
      choisirLibelle: (abreviation) => {
        if (leveDirect.role === 'aire') terrain.libelleAire = abreviation;
        else if (['ligne', 'longueur'].includes(leveDirect.role)) terrain.libelleLigne = abreviation;
        else terrain.libellePoint = abreviation;
        retenirReglagesTerrain();
        recalculer();
      },
      modifierLibelles: (sorte) => modifierLibellesDeSorte(sorte, recalculer),
      modifierChantier: () => ouvrirFenetreChantier(recalculer),
      choisirMode: choisirModeTerrain,
      // --- Guidage de lame (mode Lame) ---
      choisirSurfaceLame: (id) => {
        terrain.lame.surfaceId = id || null;
        retenirReglagesTerrain();
        recalculer();
      },
      inverserLame: () => {
        terrain.lame.inverse = !terrain.lame.inverse;
        retenirReglagesTerrain();
        afficherMessage(terrain.lame.inverse ? 'Gauche = récepteur 2, droite = récepteur 1' : 'Gauche = récepteur 1, droite = récepteur 2', 3000);
        montrerLame();
      },
      // Machine (0.100.0) : Grader (coupe dans le sens de marche) ou Bull (perpendiculaire à la lame).
      choisirMachine: (machine) => {
        terrain.lame.machine = ['bull', 'rateau'].includes(machine) ? machine : 'grader';
        retenirReglagesTerrain();
        recalculer();
      },
      // Delta Z de la surface (0.152.0) : tapé (m, + = plus haut) ou remis à 0.
      reglerDeltaSurface: (texte) => {
        const valeur = String(texte ?? '').trim() === '' ? 0 : lireNombreTape(texte);
        if (valeur == null || !Number.isFinite(valeur) || Math.abs(valeur) > 50) {
          afficherMessage('Delta Z illisible : un nombre de mètres entre −50 et 50, par exemple 0.250 ou −0.100', 4000);
          recalculer();
          return;
        }
        deltaSurface = valeur;
        recalculer();
      },
      deltaSurfaceZero: () => {
        deltaSurface = 0;
        recalculer();
      },
      // Lignes suivies (0.154.0 ; 0.171.0, maquette B) : L1 = bord G, L2 = bord D ; toucher la case (ou L1 / L2 de la bande)
      // puis la ligne sur le plan ; × pour l'enlever.
      choisirLignesGuidage: (valeur) => {
        const place = Number(valeur) === 1 ? 1 : 0;
        lignesGuidage.choix = lignesGuidage.choix === place ? null : place;
        lignesGuidage.candidat = null;
        if (lignesGuidage.choix !== null) afficherMessage(`Touche la ligne L${place + 1} sur le plan`, 4000);
        recalculer();
      },
      validerLigneGuidage: () => validerLigneGuidage(),
      enleverLigneGuidage: (valeur) => {
        lignesGuidage.liste = lignesGuidage.liste.filter((l) => l.place !== Number(valeur));
        recalculer();
      },
      // Vue du Guidage et coupe montrée (0.152.0, dans ⚙).
      choisirVueLame: (vue) => {
        terrain.lame.vue = ['plan1', 'plan2', 'coupes'].includes(vue) ? vue : 'plan2';
        retenirReglagesTerrain();
        recalculer();
      },
      // Triangles et valeurs (0.153.1) : à côté de la règle (B) ou posés sur la règle (C).
      choisirIndicLame: (cle) => {
        terrain.lame.indic = cle === 'regle' ? 'regle' : 'exterieur';
        retenirReglagesTerrain();
        recalculer();
      },
      // 0.170.0 : choix rapide dans le bandeau de la sonnette : G – D, Arr – Av ou les 2 coupes (avec le plan).
      choisirCoupesBandeau: (cle) => {
        if (cle === 'deux') terrain.lame.vue = terrain.lame.vue === 'coupes' ? 'coupes' : 'plan2';
        else {
          terrain.lame.vue = 'plan1';
          terrain.lame.coupeSeule = cle === 'long' ? 'long' : 'gd';
        }
        retenirReglagesTerrain();
        recalculer();
      },
      choisirCoupeLame: (cle) => {
        terrain.lame.coupeSeule = cle === 'long' ? 'long' : 'gd';
        retenirReglagesTerrain();
        recalculer();
      },
      // Longueur des coupes au-delà de l'outil (m, 0 à 50) : gauche, droite, devant, derrière.
      reglerMargeLame: (cle, texte) => {
        if (!['gauche', 'droite', 'devant', 'derriere'].includes(cle)) return;
        const valeur = String(texte ?? '').trim() === '' ? 0 : lireNombreTape(texte);
        if (valeur == null || !Number.isFinite(valeur) || valeur < 0 || valeur > 50) {
          afficherMessage('Longueur illisible : un nombre de mètres entre 0 et 50, par exemple 2', 4000);
          recalculer();
          return;
        }
        terrain.lame.marges = { ...terrain.lame.marges, [cle]: valeur };
        retenirReglagesTerrain();
        recalculer();
      },
      // Bull : 1 ou 2 GNSS (0.142.0).
      choisirRecepteursBull: (nombre) => {
        terrain.lame.recepteursBull = Number(nombre) === 1 ? 1 : 2;
        retenirReglagesTerrain();
        recalculer();
      },
      // Distances de l'outil à 1 GNSS (m, depuis le bas du mât) : gauche, droite, avant, arrière.
      // 0.151.0 : aussi l'axe G – D (m depuis le GNSS, − derrière) et la machine Grader.
      reglerOutil: (champ, texte) => {
        const machine = ['bull', 'rateau'].includes(terrain.lame.machine) ? terrain.lame.machine : 'grader';
        if (!['gauche', 'droite', 'avant', 'arriere', 'axe'].includes(champ)) return;
        const vide = String(texte ?? '').trim() === '';
        if (champ === 'axe') {
          const axe = vide ? (machine === 'rateau' ? null : 0) : lireNombreTape(texte);
          if (axe !== null && (!Number.isFinite(axe) || Math.abs(axe) > 30)) {
            afficherMessage('Axe illisible : un nombre de mètres entre −30 et 30 (− derrière, + devant), par exemple 0.500', 4000);
            recalculer();
            return;
          }
          terrain.lame.outils[machine] = { ...terrain.lame.outils[machine], axe };
          retenirReglagesTerrain();
          recalculer();
          return;
        }
        const valeur = vide ? 0 : lireNombreTape(texte);
        if (valeur == null || !Number.isFinite(valeur) || valeur < 0 || valeur > 30) {
          afficherMessage('Distance illisible : un nombre de mètres entre 0 et 30, par exemple 1.250', 4000);
          recalculer();
          return;
        }
        terrain.lame.outils[machine] = { ...terrain.lame.outils[machine], [champ]: valeur };
        retenirReglagesTerrain();
        recalculer();
      },
      reglerToleranceLame: (cle, texte) => {
        const cm = lireNombreTape(texte);
        if (!(cm > 0)) {
          afficherMessage('Tolérance illisible : un nombre de centimètres plus grand que 0', 4000);
          recalculer();
          return;
        }
        terrain.lame.tolerances = { ...terrain.lame.tolerances, [cle]: cm / 100 };
        retenirReglagesTerrain();
        recalculer();
      },
      choisirImplantation: (quoi) => {
        const permises = aAcces('expert') ? ['point', 'ligne', 'altitude', 'talus'] : ['point', 'ligne', 'altitude'];
        terrain.implantation = permises.includes(quoi) ? quoi : 'surface';
        retenirReglagesTerrain();
        recalculer();
      },
      // 0.107.0 : bip-bip de hauteur marche / arrêt (retenu sur cet appareil)
      basculerBip: () => {
        terrain.bip = terrain.bip === false;
        retenirReglagesTerrain();
        if (!terrain.bip) piloterBip(null);
        recalculer();
      },
      // 0.106 : altitude voulue du mode « Altitude » (vide = rien à guider)
      reglerAltitudeVoulue: (texte) => {
        const lue = lireAltitude(texte);
        if (lue === undefined) return;
        terrain.altitudeVoulue = lue;
        retenirReglagesTerrain();
        recalculer();
      },
      // 0.126.0 (demande du 05.11) : « Altitude ici » : l'altitude mesurée par le GNSS là où est la canne
      // (mêmes vérifications qu'un point : RTK fixe, inclinaison prête) devient l'altitude voulue.
      prendreAltitudeIci: () => {
        const reponse = prendrePointRecepteur();
        if (!reponse.ok) {
          refuser(`Altitude non prise : ${reponse.raison}`);
          return;
        }
        const altitude = Number(reponse.point.altitude);
        if (!Number.isFinite(altitude)) {
          refuser('Altitude non prise : le GNSS ne donne pas d\'altitude');
          return;
        }
        terrain.altitudeVoulue = Math.round(altitude * 1000) / 1000;
        retenirReglagesTerrain();
        sonValidation();
        afficherMessage(`Altitude voulue : ${terrain.altitudeVoulue.toFixed(3)} (mesurée ici)`);
        recalculer();
      },
      // 0.106 : on change l'altitude du point en cours d'implantation (le point de la liste n'est pas modifié)
      reglerAltitudeCible: (texte) => {
        const lue = lireAltitude(texte);
        if (lue === undefined || !implanter.cible) return;
        implanter.cible = { ...implanter.cible, altitude: lue };
        montrerImplantation();
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
        implanter.ligneAValider = false;
        implanter.talusId = null;
        implanter.pointsLigne = [];
        montrerImplantation();
      },
      // Fiche de la ligne touchée (0.137.0) : « Implanter » lance le guidage, « en toucher une autre » l'oublie.
      implanterLigneChoisie: () => {
        implanter.ligneAValider = false;
        montrerImplantation();
      },
      // Décaler la ligne choisie (0.141.0, Intermédiaire) : copie décalée (gauche / droite selon le sens
      // de la ligne, Z ±) rangée dans « LV-Lignes décalées » ; elle devient la ligne choisie.
      decalerLigneChoisie: async () => {
        if (!implanter.ligne || !aAcces('intermediaire') || refuserEnLectureSeule()) return;
        const valeurs = await demanderChamps({
          titre: `Décaler ${implanter.ligne.nom}`,
          champs: [
            { cle: 'sens', titre: 'Côté (en regardant vers la fin)', choix: [['droite', 'Droite ▶'], ['gauche', '◀ Gauche']], valeur: 'droite' },
            { cle: 'distance', titre: 'Distance (m)', exemple: '1.500' },
            { cle: 'z', titre: 'Z ± (m)', exemple: '0.000' },
          ],
        });
        if (!valeurs) return;
        const lire = (texte) => (String(texte ?? '').trim() === '' ? 0 : Number(String(texte).replace(',', '.')));
        const distance = lire(valeurs.distance);
        const dz = lire(valeurs.z);
        if (!Number.isFinite(distance) || !Number.isFinite(dz)) {
          alert('Distance ou Z mal tapé : un nombre avec un point, par exemple 1.500.');
          return;
        }
        if (distance === 0 && dz === 0) {
          afficherMessage('Rien à décaler (distance et Z à 0)', 3000);
          return;
        }
        const decalee = ligneDecalee(implanter.ligne.sommets, valeurs.sens === 'gauche' ? -Math.abs(distance) : Math.abs(distance), dz);
        const resultat = rangerLigneDecalee(projet, decalee, nomsDuProjet(projet));
        if (resultat.erreur) {
          alert(`Ligne non créée : ${resultat.erreur}.`);
          return;
        }
        const sommets = resultat.points.map((p) => ({ ...p }));
        implanter.ligne = nouvelleLigneAImplanter(`${resultat.points[0].nom.replace(/-1$/, '')} (${resultat.ligne.noms.length} pts)`, decalee.fermee ? [...sommets, { ...sommets[0] }] : sommets, null);
        implanter.ligneAValider = true;
        afficherMessage(`Ligne décalée créée dans « ${resultat.levee.nom} »`, 3000);
        modifie();
      },
      // 0.214.0 : grand bouton « Retour » de la fiche d'un point choisi : on peut en toucher un autre.
      changerPoint: () => {
        centrePtsVider();
        implanter.choix = null;
        montrerImplantation();
      },
      changerLigne: () => {
        implanter.ligne = null;
        implanter.ligneAValider = false;
        implanter.voirLigne = false;
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
      // Talus d'une surface importée (0.135.0) : un tronçon (côtés réglés pareil) à implanter.
      ouvrirTalusSurface: (valeur) => ouvrirTalusSurface(valeur),
      supprimerTalus: (id) => {
        const talus = projet.talus.find((t) => t.id === id);
        if (!talus || !confirm(`Enlever ${talus.nom} de « Mes talus » ?`)) return;
        projet.talus = projet.talus.filter((t) => t.id !== id);
        if (implanter.talusId === id) implanter.talusId = null;
        modifie();
      },
      // Loupe « Manuel » d'Implanter › Point (0.151.0) : réglage fin et zoom.
      deplacerLoupe: (sens) => {
        const [dx, dy] = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] }[sens] ?? [0, 0];
        plan.loupe.deplacerDe(dx, dy);
      },
      zoomLoupe: (zoom) => {
        terrain.zoomLoupe = Number(zoom) || 4;
        plan.loupe.changerZoom(terrain.zoomLoupe);
        montrerImplantation();
      },
      choisirAccroche: (mode) => {
        if (enImplantationDeLigne()) {
          terrain.accrocheLigne = mode === 'trait' || MODES_ACCROCHE.includes(mode) ? mode : 'trait';
          retenirReglagesTerrain();
          montrerImplantation();
          return;
        }
        // « Manuel » (0.131.0, Intermédiaire) : loupe + main, point visé sans accroche.
        centrePtsVider();
        terrain.accroche = MODES_ACCROCHE.includes(mode) || ((mode === 'manuel' || mode === 'centrepts') && aAcces('intermediaire')) ? mode : 'point';
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
        else guiderVersChoix(choisi);
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
        // Le choix reste (« + À implanter », « + Point du projet » sous la cible pendant le guidage).
        implanter.choix = { ...implanter.choix, nom: implanter.cible.nom, altitude: lue };
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
        const nouveau = { id: nouvelIdentifiant(), nom: choisi, est: implanter.choix.est, nord: implanter.choix.nord, altitude: lue };
        projet.aImplanter.push(nouveau);
        implanter.choix = null;
        if (implanter.cible) implanter.cible = { ...nouveau }; // pendant le guidage : on continue vers ce point
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
        const { point, erreur } = ajouterPointAjoute(projet, { ...valeurs, source: 'tape', appareil: nomDeLAppareil() });
        if (erreur) return { erreur };
        guiderVersChoix({ ...point });
        afficherMessage(`Point ${point.nom} ajouté`, 2500);
        modifie();
        return null;
      },
      // Point accroché sur le DXF : gardé dans le projet (levé « Points ajoutés »).
      garderPointChoisi: (nom) => {
        if (!implanter.choix) return;
        const { est, nord, altitude } = implanter.choix;
        const { point, erreur } = ajouterPointAjoute(projet, { nom: nom.trim() || nomPointAjoute(projet), est, nord, altitude, source: 'dxf', appareil: nomDeLAppareil() });
        if (erreur) {
          alert(`Point non ajouté : ${erreur}.`);
          return;
        }
        implanter.choix = { ...implanter.choix, nom: point.nom };
        if (implanter.cible && implanter.cible.id == null) implanter.cible.nom = point.nom;
        afficherMessage(`Point ${point.nom} ajouté au projet`, 2500);
        modifie();
      },
      arreterImplantation: () => {
        implanter.cible = null;
        implanter.choix = null; // ← : on choisit un autre point (0.114.0 : le guidage commence dès le choix)
        // ← : on choisit soi-même le point, « Le plus proche » s'arrête.
        if (terrain.plusProche) {
          terrain.plusProche = false;
          retenirReglagesTerrain();
        }
        montrerImplantation();
      },
      // Point suivant (P1 → P2…, voir nomSuivant) ou précédent (0.90.1) : implanté tout de suite.
      implanterSuivant: () => implanterPointNomme(nomSuivant(implanter.cible?.nom, pointsDuProjet().map((p) => p.nom))),
      implanterPrecedent: () => implanterPointNomme(nomPrecedent(implanter.cible?.nom, pointsDuProjet().map((p) => p.nom))),
      // « Le plus proche » (Expert, 0.90.1) : la cible suit le point montré sur le plan le plus proche.
      basculerPlusProche: () => {
        terrain.plusProche = !terrain.plusProche;
        retenirReglagesTerrain();
        if (terrain.plusProche && !viserLePlusProche()) afficherMessage('Le plus proche : en attente de la position du GNSS', 3000);
        montrerImplantation();
      },
      enregistrerImplantation: () => {
        if (refuserEnLectureSeule()) return;
        if (enAutocontrole()) {
          enregistrerControle();
          return;
        }
        if (estModeBase()) {
          afficherMessage('Enregistrer l\'implantation : seulement en mode Intermédiaire ou Expert', 4000);
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
          refuser(`Implantation refusée : ${reponse.raison}`);
          return;
        }
        const { est, nord, altitude, ...gnss } = reponse.point;
        const mesure = { est, nord, altitude, gnss };
        const ecarts = ecartsImplantation(cible, mesure);
        const le = new Date().toISOString();
        projet.implantations.push({ id: nouvelIdentifiant(), nom: cible.nom, aImplanterId: cible.id, cible: { est: cible.est, nord: cible.nord, altitude: cible.altitude }, mesure, ecarts, le });
        noterJournal({ type: 'implantation', controleRecent: controleRecentIci() });
        vibrer(60);
        sonValidation();
        const hauteur = ecarts.dAltitude != null ? ` · dH ${formaterNombre(ecarts.dAltitude)} m` : '';
        afficherMessage(`${cible.nom} implanté : écart ${formaterNombre(ecarts.distance)} m${hauteur}`, 4000);
        modifie();
      },
      // --- Mode Contrôler (autocontrôle sur les points de contrôle du projet) ---
      controlerPoint: (id) => {
        const point = projet.pointsControle.find((p) => p.id === id);
        if (!point) return;
        if (!recepteurDisponible()) {
          fichePointControle(point);
          return;
        }
        autocontrole.cible = { ...point };
        // 0.188.0 : déjà en guidage, on change de point en gardant le zoom (le cadrage ne se fait qu'au début du guidage).
        const dejaEnGuidage = document.body.classList.contains('vue-implantation');
        montrerImplantation();
        if (!dejaEnGuidage) requestAnimationFrame(cadrerSurImplantation);
      },
      // Photo d'un point de contrôle (0.105.0, Intermédiaire) : rangée dans projet.photosControle.
      ajouterPhotoControle: (id, fichiers) => ajouterPhotoControle(id, fichiers),
      // 0.123.1 : le point a déjà des photos : « Prendre » une photo ou « Voir » celles qu'il a.
      photoPointControle: (id) => {
        const point = projet.pointsControle.find((p) => p.id === id);
        if (!recepteurDisponible() && point) fichePointControle(point);
        else choisirPrendreOuVoir(id);
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
      enregistrerTolerances: (textes) => {
        const { tolerances, erreur } = lireTolerances(textes);
        if (erreur) return { erreur };
        // Durée entre deux contrôles (Expert, 0.90.0) : champ absent en dessous d'Expert.
        if (aAcces('expert') && textes.delai !== undefined) {
          const delai = lireDelaiControle(textes.delai);
          if (delai.erreur) return { erreur: delai.erreur };
          projet.delaiControleHeures = delai.heures;
        }
        projet.tolerancesControle = tolerances;
        afficherMessage('Réglages du contrôle enregistrés');
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
        projet.photosControle = (projet.photosControle ?? []).filter((ph) => ph.pointId !== id);
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
        terrain.vueCoupes = vue === 'axe' ? 'axe' : 'perpendiculaire';
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
      // 0.190.0 : boutons − / + de la largeur de la coupe et ▲ / ▼ de l'échelle des hauteurs (Implanter › Surface).
      changerLargeurCoupe: (pas) => {
        terrain.demiLongueur = voisinDansListe(LONGUEURS_COUPE, terrain.demiLongueur, Number(pas));
        retenirReglagesTerrain();
        recalculer();
      },
      changerLargeurCoupeLame: (pas) => {
        terrain.lame.zoomMarges = voisinDansListe([0.5, 1, 2, 4], terrain.lame.zoomMarges ?? 1, Number(pas));
        retenirReglagesTerrain();
        recalculer();
      },
      changerHauteurCoupeLame: (pas) => {
        terrain.lame.exagerationCoupe = voisinDansListe(EXAGERATIONS_COUPE, terrain.lame.exagerationCoupe ?? 1, Number(pas));
        retenirReglagesTerrain();
        recalculer();
      },
      changerHauteurCoupe: (pas) => {
        terrain.exagerationCoupe = voisinDansListe(EXAGERATIONS_COUPE, terrain.exagerationCoupe, Number(pas));
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
        for (const c of projet.autres) if (c.cadres) c.cadres = c.cadres.map((cadre) => ({ ...cadre, noms: cadre.noms.filter((n) => n !== dernier.nom) })).filter((cadre) => cadre.noms.length > 0);
        annulerDernierPoint(leve, [...projet.surfaces, ...projet.autres]);
        retirerPointDesMesures(projet, dernier.nom); // le point sort aussi des mesures (Calculs › Mesures)
        afficherMessage(`Point ${dernier.nom} effacé`);
        modifie();
      },
    });

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
// Loupe de l'accroche « Manuel » dans Implanter › Point (0.131.0, Intermédiaire, demande du 05.11).
let loupeImplantation = false;

/**
 * Montre la loupe pendant l'implantation d'un point avec l'accroche « Manuel » (onglet Terrain),
 * la cache sinon. Doigt levé : le point visé (sans altitude) devient la cible, le guidage commence.
 * Le recalage d'un plan PDF garde sa propre loupe (voir montrerLoupe).
 */
function gererLoupeImplantation() {
  if (recalage.planId) {
    loupeImplantation = false;
    return;
  }
  // Mesure rapide (0.162.2) : la loupe remplace « Libre » ; doigt levé = point candidat, « Ajouter ce point » l'ajoute.
  if (mesureRapideActive() && mesureRapideEtat.accroche === 'manuel') {
    const premiere = !loupeImplantation;
    plan.loupe.montrer({
      recentrer: premiere,
      zoom: terrain.zoomLoupe ?? 4,
      quandLache: ({ est, nord }) => {
        const mm = (valeur) => Math.round(valeur * 1000) / 1000;
        const avant = Boolean(mesureRapideEtat.candidat);
        mesureRapideEtat.candidat = { est: mm(est), nord: mm(nord) };
        // Le bouton « Ajouter ce point » s'allume la première fois (pas de redessin à chaque flèche).
        if (!avant) afficherMesureRapide();
      },
    });
    loupeImplantation = true;
    return;
  }
  // Annotation (0.177.0) : mode Loupe ; doigt levé = position du point en cours (nouvelle fiche si besoin).
  if (annotationActive() && annotationEtat.mode === 'loupe') {
    const premiere = !loupeImplantation;
    plan.loupe.montrer({
      recentrer: premiere,
      zoom: terrain.zoomLoupe ?? 4,
      quandLache: ({ est, nord }) => poserPositionAnnotation({ est, nord, altitude: null, source: 'loupe', precision: null }),
    });
    loupeImplantation = true;
    return;
  }
  const voulue = ongletContexte === 'terrain' && enImplantationDePoint() && terrain.accroche === 'manuel' && aAcces('intermediaire');
  if (!voulue) {
    if (loupeImplantation) plan.loupe.cacher();
    loupeImplantation = false;
    return;
  }
  plan.loupe.montrer({
    recentrer: !loupeImplantation,
    zoom: terrain.zoomLoupe ?? 4,
    quandLache: ({ est, nord }) => {
      const mm = (valeur) => Math.round(valeur * 1000) / 1000;
      guiderVersChoix({ est: mm(est), nord: mm(nord), altitude: null, nom: implanter.choix?.mode === 'manuel' ? implanter.choix.nom : nomProposeImplantation(), mode: 'manuel' });
      montrerImplantation();
    },
  });
  loupeImplantation = true;
}

function envoyerImplantationAuPlan() {
  // Terrain › Contrôle (sans point choisi) : toucher le plan choisit un point de contrôle.
  const accrocheActive = mesureRapideActive() || annotationActive() || choixLignesGuidageActif() || ((enImplantationDePoint() || enImplantationDeLigne() || (enAutocontrole() && !autocontrole.cible)) && ongletContexte === 'terrain') || pointage.actif || ajoutLevee.actif || Boolean(recalage.planId) || Boolean(daoAppli?.actif());
  // 0.159.0 : les applications sont indépendantes : la Mesure rapide ne montre rien d'Implanter.
  const mesure = mesureRapideActive() || annotationActive();
  const enLigne = accrocheActive && !mesure && !pointage.actif && !ajoutLevee.actif && enImplantationDeLigne();
  const sommets = enLigne && implanter.ligne ? sommetsDeLaLigne() : null;
  // Lignes des levés « Autres » cochés dans le menu « Points » (ce ne sont pas des surfaces).
  // Bouton « Seul » en Implanter (0.90.1) : ni levés libres, ni points de contrôle, ni dessins, ni « À implanter ».
  const seul = Boolean(elementSeul());
  // Bouton « Seul » (0.94.0) : seulement les listes gardées (points de contrôle en mode Contrôle…).
  const gardees = listesDuTravail(listesDePoints(projet));
  // Lignes suivies en Guidage (0.154.0) : en violet.
  const lignesSuivies = ongletContexte === 'terrain' && terrain.mode === 'lame' ? [...lignesGuidage.liste, ...(lignesGuidage.candidat ? [lignesGuidage.candidat] : [])].map((l) => ({ id: 'ligne-guidage', sommets: l.sommets, fermee: false, couleur: ['#7c3aed', '#ea580c'][l.place] })) : [];
  const lignesAutres = [...(seul ? [] : lignesDesAutres().filter((l) => !gardees || gardees.has(l.id))), ...lignesSuivies];
  const chantiers = seul ? [] : formesDuChantier().filter((f) => !gardees || gardees.has(f.id));
  // Points de contrôle : dessinés si leur case « Points de contrôle » est cochée (menu Afficher).
  const pointsControle = seul || (gardees && !gardees.has(LISTE_CONTROLE)) || (projet.listesCachees ?? []).includes(LISTE_CONTROLE) ? [] : projet.pointsControle;
  const dessins = seul ? [] : dessinsVisibles().filter((d) => !gardees || gardees.has(d.id));
  // Talus des surfaces importées (0.135.0) : barbules, et côtés à choisir pendant le choix.
  const choixCotes = choixCotesTalusActif();
  const talusSurfaces = seul && !choixCotes ? [] : tranchesDesTalusSurfaces();
  const cotesTalus = cotesTalusPourPlan();
  const aImplanter = seul || gardees ? [] : projet.aImplanter;
  // Points implantés (0.114.0, Implanter, dès Intermédiaire) : vert / orange / rouge selon les tolérances du Contrôle.
  const implantes = ongletContexte === 'terrain' && terrain.mode === 'controler' && aAcces('intermediaire') && !seul
    ? projet.implantations.filter((i) => i.mesure).map((i) => ({ nom: i.nom, est: i.mesure.est, nord: i.mesure.nord, couleur: couleurImplantation(i, projet.tolerancesControle) }))
    : [];
  // Mode Contrôler : le point de contrôle vers lequel on guide est la cible du plan.
  const cibleControle = enAutocontrole() && ongletContexte === 'terrain' ? autocontrole.cible : null;
  // Dessins (Calculs › Dessin) : toujours sur le plan ; le dessin en cours avec son pilote.
  const avecPilote = piloteActif();
  plan.palirAutour(ongletContexte === 'terrain' && document.body.dataset.onglet === 'terrain' ? travailAGarder() : null); // 0.214.0 : jamais pâli dans l'application Plan
  // Case « Voir toute la ligne » (0.118.0) : seulement pendant le guidage d'une ligne (pas d'un talus).
  const guidageLigne = ongletContexte === 'terrain' && enImplantationDeLigne() && !enTalus() && Boolean(implanter.ligne) && !implanter.ligneAValider;
  // 0.137.0 : point ou ligne choisi mais pas encore « Implanter » : le plan reste où il est (pas de retour du suivi).
  // Annotation en mode Manuel (0.178.2) : le plan ne suit pas la position (on place la loupe où on veut).
  plan.suspendreSuivi((annotationActive() && annotationEtat.mode === 'loupe') || (ongletContexte === 'terrain' && ((enImplantationDePoint() && Boolean(implanter.choix) && !implanter.cible) || (enImplantationDeLigne() && Boolean(implanter.ligne) && implanter.ligneAValider))));
  if (!guidageLigne) implanter.voirLigne = false;
  plan.voirLigne({ visible: guidageLigne, sommets: guidageLigne && implanter.voirLigne ? implanter.ligne.sommets : null });
  plan.afficherImplantation(accrocheActive || avecPilote || choixCotes || aImplanter.length > 0 || implantes.length > 0 || lignesAutres.length > 0 || chantiers.length > 0 || pointsControle.length > 0 || cibleControle || dessins.length > 0 || talusSurfaces.length > 0
    ? {
        actif: accrocheActive || avecPilote || choixCotes,
        // Talus des dessins : barbules du haut vers le bas et pente écrite dedans (0.122.0) ; aussi ceux des surfaces (0.135.0).
        talusDessins: [...dessins.flatMap((d) => tranchesDuDessin(d)), ...talusSurfaces],
        cotesTalus,
        dessins: dessins.map((d) => ({ ...d, noms: pointsDuDessin(d, projet.dessins).map((p) => p.nom), couleur: projet.couleursListes?.[d.id] ?? null })),
        actifId: avecPilote ? pilote.dessinId : null,
        pilote: avecPilote ? { direction: pilote.direction, distance: lireNombreTape(pilote.distance) ?? null } : null,
        aImplanter,
        implantes,
        pointsControle,
        lignesAutres,
        chantiers,
        choix: daoAppli?.actif() ? daoAppli.dernierPoint() : recalage.planId ? (recalage.candidat ? { est: recalage.candidat.x, nord: recalage.candidat.y } : recalage.choix ? { est: recalage.choix.x, nord: recalage.choix.y } : null) : pointage.actif ? pointage.choix : ajoutLevee.actif ? ajoutLevee.choix : mesureRapideActive() && mesureRapideEtat.accroche === 'centrepts' ? centrePtsCalcule() : accrocheActive && !mesure && !enLigne && !enAutocontrole() ? implanter.choix : null,
        cible: cibleControle ?? (accrocheActive && !mesure && !enLigne && !enAutocontrole() && !ajoutLevee.actif ? implanter.cible : null),
        // Ligne : la ligne choisie (début, fin), sa parallèle s'il y a un décalage, les points en préparation.
        ligne: sommets ? { sommets, parallele: implanter.ligne.decalage && !enTalus() ? ligneParallele(sommets, implanter.ligne.decalage) : null, talus: enTalus() ? { zone: zoneDuTalus(), cote: terrain.talus.cote, ligneEst: terrain.talus.ligneEst } : null } : null,
        pointsLigne: enLigne ? implanter.pointsLigne : centrePtsActif() ? centrePts.points : [],
        mesureRapide: mesureRapideActive() ? { ...mesureRapide(mesureRapideEtat.points, { fermee: mesureRapideEtat.fermee }), afficherAngles: mesureRapideEtat.angles } : null,
      }
    : null);
  gererLoupeImplantation();
}

// --- Exports (0.92.1 : tous dans Projet › Exporter, voir export/module.js) ---

/** Plan DXF recalé, en MN95 (fenêtre « Exporter »). */
function exporterPlanRecale(id) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi || choisi.pdf?.image) return;
  // 0.214.0 : tout plan importé s'exporte (avant : seulement les recalés et les dessins DAO) ; non recalé = tel qu'il a été importé.
  const recale = Boolean(choisi.recalage?.applique || choisi.dao);
  const nom = String(choisi.nom).replace(/\.dxf$/i, '');
  telecharger(new Blob([octetsDxf(genererDxfPlan(planRecale(choisi)))], { type: 'application/dxf' }), `${nom}${recale ? '_MN95' : ''}.dxf`);
}

/**
 * Une liste de points (Intermédiaire, 0.79.0) : TXT, CSV (toutes les infos) ou DXF, puis Enregistrer,
 * Envoyer par mail ou autrement (fenêtre « Exporter »). type : 'leve', 'dessin' ou 'controle'.
 */
function exporterListe(type, id) {
  let points;
  let titre;
  let roles = new Map();
  let photos = [];
  if (type === 'controle') {
    points = projet.pointsControle;
    titre = 'Points de contrôle';
    photos = (projet.photosControle ?? []).filter((ph) => points.some((p) => p.id === ph.pointId)).map((ph) => {
      const point = points.find((p) => p.id === ph.pointId);
      return { ...ph, surface: titre, legende: [ph.point, point.altitude == null ? null : `H ${formaterNombre(point.altitude)}`, ph.legende].filter(Boolean).join(' · ') };
    });
  } else if (type === 'dessin') {
    const dessin = dessinDe(id);
    if (!dessin) return;
    points = pointsDuDessin(dessin, projet.dessins);
    titre = dessin.nom;
  } else {
    const leve = projet.leves.find((l) => l.id === id);
    if (!leve) return;
    points = leve.points;
    titre = leve.nom;
    roles = rolesDesPoints(leve.id);
    // Photos rattachées à un point de ce levé (case « avec les photos des points », PDF).
    const proprietaire = [...projet.surfaces, ...projet.autres].find((o) => o.leveId === leve.id);
    const parNom = new Map(points.map((p) => [p.nom, p]));
    photos = (proprietaire?.photos ?? []).filter((ph) => ph.point && parNom.has(ph.point)).map((ph) => ({
      ...ph,
      surface: leve.nom,
      legende: [ph.point, parNom.get(ph.point).altitude == null ? null : `H ${formaterNombre(parNom.get(ph.point).altitude)}`, ph.legende].filter(Boolean).join(' · '),
    }));
    // Photos de tout le levé (0.140.0) : d'abord, avec « levé » devant la légende.
    const globales = (proprietaire?.photos ?? []).filter((ph) => !ph.point && !ph.attentePoint).map((ph) => ({ ...ph, surface: leve.nom, legende: ['Photo du levé', ph.legende].filter(Boolean).join(' · ') }));
    photos = [...globales, ...photos];
  }
  // Nom du fichier : projet_liste, sans l'extension du fichier importé (« stock.csv » -> « stock »).
  const base = `${nomDeFichierProjet(projet)}_${titre.replace(/\.[a-z0-9]{2,4}$/i, '')}`.replace(/[\\/:*?"<>|]/g, '_');
  ouvrirFenetreExport({
    titre,
    formats: FORMATS_POINTS,
    options: photos.length > 0 ? [{ cle: 'photos', texte: `Avec les photos des points (${photos.length})`, formats: ['pdf'] }] : [],
    fabriquer: async (format, choix = {}) => {
      if (format === 'pdf') {
        const { pdfPoints } = await import('./export/pdf-points.js');
        const blob = pdfPoints({
          titre,
          points,
          roles,
          cartouche: { affaire: projet.cartouche?.affaire ?? '', date: new Date().toLocaleDateString('fr-CH') },
          photos: choix.photos ? await photosAvecDessins(photos) : [],
        });
        return { blob, nom: `${base}.pdf` };
      }
      // Levé chantier : lignes et cadres par libellé et nature dans le DXF.
      const chantierDuLeve = projet.autres.find((a) => a.nature === 'chantier' && a.leveId === (type === 'dessin' ? null : id));
      const parNomChantier = new Map(points.map((p) => [p.nom, p]));
      const chantier = chantierDuLeve
        ? {
            lignes: chantierDuLeve.lignesRupture.filter((l) => l.noms.length >= 2).map((l) => ({ noms: l.noms, fermee: Boolean(l.fermee), libelle: l.libelle, nature: parNomChantier.get(l.noms[0])?.chantier?.nature ?? '' })),
            cadres: (chantierDuLeve.cadres ?? []).filter((c) => c.coins),
          }
        : null;
      const { blob, extension } = fichierPoints(points, format, roles, chantier);
      return { blob, nom: `${base}.${extension}` };
    },
    enregistrer: enregistrerFichier,
    message: (texte) => afficherMessage(texte, 5000),
  });
}

/** Implantations enregistrées (CSV). */
function exporterImplantations() {
  telecharger(new Blob(['\ufeff' + csvImplantations(projet.implantations)], { type: 'text/csv;charset=utf-8' }), `${nomDeFichierProjet(projet)}_implantations.csv`);
}

/** Contrôles et refus du projet : CSV ou PDF. */
async function exporterControles(format) {
  const nom = `${nomDeFichierProjet(projet)}_controles`;
  if (format === 'pdf') {
    const { pdfControles } = await import('./export/pdf-controles.js'); // chargé à la demande (0.126.0)
    telecharger(pdfControles(projet), `${nom}.pdf`);
  }
  else telecharger(new Blob(['\ufeff' + csvControles(projet.controles)], { type: 'text/csv;charset=utf-8' }), `${nom}.csv`);
}

/** Couleur choisie pour une liste de points (null : la couleur normale). Les points de contrôle restent rouges. */
function colorerListe(id, couleur) {
  // Cadastre (0.116.4) : une seule couleur pour les lignes (plan DXF), les points et leurs noms.
  const cadastre = projet.leves.find((l) => l.id === id && l.cadastre);
  const planCadastre = cadastre && planDuCadastre(projet, cadastre);
  if (planCadastre) {
    if (projet.couleursListes) delete projet.couleursListes[id];
    reglerPlanDxf(planCadastre.id, { couleur: couleur || COULEUR_CADASTRE });
    return;
  }
  projet.couleursListes ??= {};
  if (couleur) projet.couleursListes[id] = couleur;
  else delete projet.couleursListes[id];
  modifie();
}

/**
 * Ouvrages des levés chantier visibles (0.175.0) : un cercle de 60 cm autour d'un tampon rond (chambre, grille),
 * le cadre mesuré pour un ouvrage à 3 coins. [{ id, est, nord, rayon, couleur } ou { id, coins, couleur }].
 */
function formesDuChantier() {
  const cachees = new Set(projet.listesCachees ?? []);
  const libelles = lireLibellesChantier();
  const couleurs = lireNaturesChantier().couleurs;
  const formes = [];
  for (const chantier of projet.autres.filter((a) => a.nature === 'chantier' && !cachees.has(a.id))) {
    const points = projet.leves.find((l) => l.id === chantier.leveId)?.points ?? [];
    for (const p of points) {
      const c = p.chantier;
      if (!c || c.forme !== 'ronde' || !libelles.find((l) => l.abreviation === c.libelle)?.ouvrage) continue;
      formes.push({ id: chantier.id, est: p.est, nord: p.nord, rayon: RAYON_TAMPON_ROND, couleur: couleurNatureChantier(c.nature, couleurs) });
    }
    for (const cadre of chantier.cadres ?? []) {
      if (cadre.coins) formes.push({ id: chantier.id, coins: cadre.coins, couleur: couleurNatureChantier(cadre.nature, couleurs) });
    }
  }
  return formes;
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
      if (sommets.length >= 2) lignes.push({ id: autres.id, sommets, fermee: Boolean(ligne.fermee), couleur: projet.couleursListes?.[autres.id] ?? null });
    }
  }
  return lignes;
}

/**
 * Point choisi ou point à implanter changé (rien d'autre dans le projet) : on met à jour l'écran
 * Terrain et l'implantation sur le plan, sans tout recalculer ni redessiner (plus rapide).
 */
/** Implante tout de suite ce point du projet (par son nom), s'il existe. */
function implanterPointNomme(nom) {
  const point = pointsDuProjet().find((p) => p.nom === nom);
  if (!point) return;
  const dansLaListe = projet.aImplanter.find((p) => p.nom === nom);
  implanter.cible = { id: dansLaListe?.id ?? null, nom, est: point.est, nord: point.nord, altitude: point.altitude ?? null };
  implanter.choix = null;
  // 0.188.0 : déjà en guidage, on change de point en gardant le zoom (le cadrage ne se fait qu'au début du guidage).
  const dejaEnGuidage = document.body.classList.contains('vue-implantation');
  montrerImplantation();
  if (!dejaEnGuidage) requestAnimationFrame(cadrerSurImplantation);
}

/**
 * « Le plus proche » (Expert, 0.90.1) : la cible devient le point montré sur le plan le plus proche
 * du GNSS (voir pointLePlusProche). Vrai si une cible est choisie ; l'écran est redessiné si elle change.
 */
function viserLePlusProche() {
  const position = etatRecepteur?.connecte && etatRecepteur.recu ? etatRecepteur.position : null;
  if (!position || !enImplantationDePoint()) return false;
  const actuelle = implanter.cible ? (pointsDesListesMontres ?? []).find((p) => p.nom === implanter.cible.nom) ?? null : null;
  const choisi = pointLePlusProche(position, pointsDesListesMontres ?? [], actuelle);
  if (!choisi) return false;
  if (choisi.nom !== implanter.cible?.nom) {
    const dansLaListe = projet.aImplanter.find((p) => p.nom === choisi.nom);
    implanter.cible = { id: dansLaListe?.id ?? null, nom: choisi.nom, est: choisi.est, nord: choisi.nord, altitude: choisi.altitude ?? null };
    implanter.choix = null;
    montrerImplantation();
  }
  return true;
}

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

/**
 * Ce qui reste net sur le plan, le reste à 50 % (0.118.1, Terrain) : { stockId, noms, garderMesures }.
 * Lever : le levé en cours (ou le métré) et ses points ; Implanter : la ligne, le point ou la surface
 * choisi ; rien de choisi, ou autre mode : null (tout normal).
 */
function travailAGarder() {
  if (!ecranLeve) return null;
  if (terrain.mode === 'lever') {
    const stock = stockEnCours();
    if (stock) return { stockId: stock.id, noms: pointsDuLeve(stock.leveId).map((p) => p.nom) };
    return null;
  }
  if (terrain.mode !== 'controler') return null;
  if (terrain.implantation === 'point') return implanter.cible ? { stockId: null, noms: implanter.cible.nom ? [implanter.cible.nom] : [] } : null;
  if (['ligne', 'talus'].includes(terrain.implantation)) {
    if (!implanter.ligne) return null;
    return { stockId: terrain.implantation === 'talus' ? terrain.talus.terrainId ?? null : null, noms: implanter.ligne.sommets.map((s) => s.nom).filter(Boolean) };
  }
  if (terrain.implantation === 'surface') {
    const surface = projet.surfaces.find((s) => s.id === terrain.surfaceId);
    return surface ? { stockId: surface.id, noms: surface.leveId ? pointsDuLeve(surface.leveId).map((p) => p.nom) : [] } : null;
  }
  return null;
}

// 0.138.0 : la cible prend le haut (plan en encart) ou le rend : le plan se recadre sur le point et la canne.
document.addEventListener('cible-en-haut', () => requestAnimationFrame(() => requestAnimationFrame(cadrerSurImplantation)));
// 0.151.0 : bouton « Implanter » en bas à droite du plan (point ou ligne choisi).
creerBoutonImplanterPlan(document.querySelector('.panneau-plan'), document.querySelector('#leve-direct'));
// 0.166.2 : sur téléphone (Lever, dès Intermédiaire) le Δ est un bouton rond du plan ; il touche le vrai bouton « Δ ».
document.querySelector('.panneau-plan [data-action="delta-plan"]')?.addEventListener('click', () => {
  document.querySelector('#leve-direct .bouton-ouvrir-delta')?.click();
});
// 0.151.0 : encart du plan déplaçable, + / −, toucher = plan en grand (voir plan/encart.js).
creerEncartPlan(document.querySelector('.panneau-plan'), {
  quandToucher: () => ecranLeve.planEnGrand(true),
  quandCible: () => ecranLeve.planEnGrand(false),
  zoomer: (facteur) => document.querySelector(`#plan [data-action="${facteur > 1 ? 'zoom-plus' : 'zoom-moins'}"]`)?.click(),
});

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
  // 0.210.0 : fleche + classe (tolérance) pour la flèche de l'écart sur le plan ; le talus garde le texte seul.
  return { sommets: trace, abscisse: l.abscisse, longueur: l.longueur, ecart: l.ecart, fleche: true, classe: implantationLigne.classeLaterale };
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
  const choisies = new Set(mesuresVisibles(projet, listes));
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
  return { dessinId: dessin.id, accroche: pilote?.accroche ?? 'point', direction: null, distance: '', reference: null, angle: pilote?.angle ?? '90', tourne: 0, altitude: '', altitudeChoix: pilote?.altitudeChoix ?? 'tapee', pente: pilote?.pente ?? '' };
}

const auMillimetre = (valeur) => (valeur == null ? null : Math.round(valeur * 1000) / 1000);

/**
 * Ajoute un sommet au dessin en cours ({ est, nord, altitude }) ; ensuite, la direction du côté
 * suivant est à redonner (tourner, toucher le plan ou RX2), la distance tapée est gardée.
 */
function ajouterSommetDessin(point, nomDepart = null) {
  const dessin = dessinDe(pilote?.dessinId);
  if (!dessin) return;
  // Le point de départ : son nom (point accroché, « RX2 »), écrit dans la carte du dessin.
  if (dessin.sommets.length === 0) dessin.nomDepart = nomDepart ?? point.nom ?? null;
  dessin.sommets.push({ est: auMillimetre(point.est), nord: auMillimetre(point.nord), altitude: auMillimetre(point.altitude ?? null) });
  if (dessin.sommets.length >= 2) {
    pilote.direction = null;
    pilote.reference = null;
    pilote.tourne = 0;
  }
  modifie();
}

/**
 * Direction du côté suivant : celle du côté précédent tournée de pilote.tourne degrés (+ = à
 * droite) ; texte « tout droit », « 30° à droite »… dans pilote.reference.
 */
function appliquerTourne(dessin) {
  const precedent = gisement(dessin.sommets.at(-2), dessin.sommets.at(-1));
  if (precedent == null) return;
  const t = pilote.tourne;
  pilote.direction = directionTournee(precedent, Math.abs(t), t >= 0 ? 'droite' : 'gauche');
  pilote.reference = t === 0 ? 'tout droit' : `${auMillimetre(Math.abs(t))}° à ${t > 0 ? 'droite' : 'gauche'}`;
}

/**
 * Toucher le plan pendant un dessin : on s'accroche à un objet selon l'accroche choisie (point du
 * projet, sommet, milieu, sur une ligne ou centre : du plan DXF et des dessins), jamais à un endroit
 * vide (demande du 26.10.2026) ; puis point de départ (sommet) ou direction selon le pilote.
 */
function toucherPourDessin(position, tolerance) {
  const dessin = dessinDe(pilote.dessinId);
  const accroche = pilote.accroche ?? 'point';
  let sources;
  if (accroche === 'point') sources = { lignes: [], cercles: [], points: pointsDuProjet() };
  else {
    // Plan DXF, et les côtés des autres dessins (le dessin en cours aussi, pour s'accrocher à ses sommets).
    const dxf = sourcesDesPlans(plansDuProjet(), position, tolerance);
    const lignesDessins = projet.dessins.filter((d) => d.type !== 'points' && d.sommets.length >= 2).map((d) => ({ points: d.sommets, ferme: estFerme(d) && d.sommets.length >= 3 }));
    sources = { ...dxf, lignes: [...dxf.lignes, ...lignesDessins] };
  }
  const trouve = accrocher(accroche, position, tolerance, avecToutesLesLignes(accroche, sources));
  if (!trouve) {
    const quoi = { point: 'aucun point', sommet: 'aucun sommet', milieu: 'aucune ligne', ligne: 'aucune ligne', croisement: 'aucun croisement de lignes', centre: 'aucun cercle' }[accroche];
    afficherMessage(`${quoi[0].toUpperCase()}${quoi.slice(1)} sous le doigt`, 3000);
    return;
  }
  const point = trouve;
  if (dessin.sommets.length > 0 && dessin.type !== 'points') {
    const gon = gisement(dessin.sommets.at(-1), point);
    if (gon == null) return;
    pilote.direction = gon;
    pilote.reference = trouve?.nom ? `vers ${trouve.nom}` : 'touchée sur le plan';
    pilote.tourne = 0;
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

/**
 * Surfaces faites d'un dessin (plateforme, bâtiment) : remises à jour avec leur dessin à chaque
 * modification ; enlevées si le dessin est supprimé. Si le dessin ne donne plus de surface
 * (altitude effacée…), la surface garde sa dernière forme et la raison est notée (erreurDessin).
 */
/**
 * Talus d'une plateforme jusqu'au terrain (0.108.0, voir topo/plateforme-talus.js) : null si le
 * dessin n'en a pas, { erreur } ou le talus calculé. Réglages dans dessin.talus : { actif,
 * terrainId, remblai: { horizontal, vertical }, deblai: { horizontal, vertical } }.
 */
function talusDuDessin(dessin) {
  const reglage = dessin?.talus;
  if (!reglage?.actif) return null;
  const terrain = projet.surfaces.find((s) => s.id === reglage.terrainId);
  if (!terrain) return { erreur: 'terrain à choisir' };
  const triangles = trianglesDeSurface(terrain.id);
  if (triangles.length === 0) return { erreur: `le terrain « ${terrain.nom} » n'a pas de triangles` };
  return talusDePlateforme(pointsDuDessin(dessin, projet.dessins), { remblai: reglage.remblai, deblai: reglage.deblai }, chercheurAltitude(triangles), { pas: 2 });
}

// Tranches de talus des dessins pour le plan (barbules et pente), gardées tant que le dessin, ses réglages
// et son terrain ne changent pas : id du dessin → { signature, tranches }.
const tranchesTalusDessins = new Map();

/** Tranches de talus d'un dessin à dessiner sur le plan (0.122.0) : [] sans talus ou si le calcul échoue. */
function tranchesDuDessin(dessin) {
  const reglage = dessin?.talus;
  if (!reglage?.actif) return [];
  const sommets = pointsDuDessin(dessin, projet.dessins);
  const signature = JSON.stringify([sommets.map((p) => [p.est, p.nord, p.altitude]), reglage, surfacesCalculees.get(reglage.terrainId)?.triangles?.length ?? 0]);
  const gardee = tranchesTalusDessins.get(dessin.id);
  if (gardee?.signature === signature) return gardee.tranches;
  const tranches = tranchesDeTalus(talusDuDessin(dessin), { remblai: reglage.remblai, deblai: reglage.deblai });
  tranchesTalusDessins.set(dessin.id, { signature, tranches });
  return tranches;
}

/** Volume de la plateforme avec talus : comparée au terrain choisi (créé une fois, puis suivi). */
function volumeDuTalus(surface, terrainId) {
  const calcul = projet.calculs.find((c) => c.talusDe === surface.id);
  if (calcul) {
    calcul.surface2Id = terrainId;
    return;
  }
  projet.calculs.push({ ...nouveauVolume(), surface1Id: surface.id, uneSeule: false, surface2Id: terrainId, talusDe: surface.id });
}

function synchroniserSurfacesDessins() {
  const avant = projet.surfaces.length;
  // Dessin supprimé : sa surface part, et la liste de points de son levé « Surface » aussi.
  const parties = projet.surfaces.filter((s) => s.dessinId && !projet.dessins.some((d) => d.id === s.dessinId));
  projet.surfaces = projet.surfaces.filter((s) => !parties.includes(s));
  const listesParties = new Set(parties.filter((s) => s.type === 'points').map((s) => s.leveId));
  projet.leves = projet.leves.filter((l) => !(listesParties.has(l.id) && l.dediee));
  if (listesParties.has(projet.leveActifId)) projet.leveActifId = projet.leves[0]?.id ?? null;
  for (const surface of projet.surfaces) {
    if (!surface.dessinId) continue;
    const dessin = dessinDe(surface.dessinId);
    // Levé « Surface » (0.77.0) : les sommets du dessin sont remis dans sa liste (contour).
    if (surface.type === 'points') {
      // Talus jusqu'au terrain (0.108.0) : ses points et ses lignes sont refaits à chaque fois.
      const talus = talusDuDessin(dessin);
      surface.erreurDessin = surfaceDuDessin(dessin, projet.dessins).erreur ?? (talus?.erreur ? `talus : ${talus.erreur}` : undefined);
      if (!surface.erreurDessin) delete surface.erreurDessin;
      synchroniserLeveeDuDessin(projet, surface, pointsDuDessin(dessin, projet.dessins), talus);
      if (talus && !talus.erreur) volumeDuTalus(surface, dessin.talus.terrainId);
      continue;
    }
    const { points, faces, erreur } = surfaceDuDessin(dessin, projet.dessins);
    surface.nomFichier = dessin.nom;
    if (erreur) {
      surface.erreurDessin = erreur;
      continue;
    }
    delete surface.erreurDessin;
    surface.points = points;
    surface.faces = faces;
  }
  if (projet.surfaces.length !== avant) editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
}

// --- Talus d'une surface importée (0.135.0, Calculs › Dessin, Expert ; calculs dans topo/talus-cotes.js) ---
// Une surface de talus : { id, nom, type: 'talus', sourceId (la surface importée), terrainId (terrain de
// référence, ou null), reglages: { n° du côté: { horizontal, vertical, sens, longueur, altitudeSol } },
// points, faces } : la surface importée + ses talus, refaite à chaque réglage (comme une surface importée
// pour le reste de l'appli : volumes, Implanter › Surface, exports, Drive).
const talusSurface = { actifId: null, choisis: new Set() };
// Calcul gardé tant que la surface importée, le terrain et les réglages ne changent pas : id → { signature, resultat, ecrit }.
const calculsTalusSurfaces = new Map();
const contoursDesSources = new WeakMap();

/** Contour extérieur (sens trigonométrique) d'une surface importée : [{ nom, est, nord, altitude }]. */
function contourDeLaSource(source) {
  if (!source?.faces || !source.points) return [];
  if (!contoursDesSources.has(source.faces)) {
    contoursDesSources.set(source.faces, contourDeSurface(source.faces.map((f) => f.map((i) => source.points[i]))));
  }
  return contoursDesSources.get(source.faces);
}

/** Empreinte rapide de triangles (pour savoir si un terrain a changé). */
function empreinteTriangles(triangles) {
  let somme = 0;
  for (const t of triangles) somme += t[0].est + t[1].nord + (t[2].altitude ?? 0);
  return `${triangles.length}:${somme.toFixed(3)}`;
}

/** Talus d'une surface de talus : { contour, talus } ou { erreur }. */
function calculDuTalusSurface(surface) {
  const source = projet.surfaces.find((s) => s.id === surface.sourceId);
  if (!source) return { erreur: 'surface importée introuvable (supprimée ou archivée ?)' };
  const contour = contourDeLaSource(source);
  if (contour.length < 3) return { erreur: `contour de « ${source.nom} » introuvable` };
  const trianglesTerrain = surface.terrainId ? trianglesDeSurface(surface.terrainId) : [];
  const signature = JSON.stringify([source.points.length, source.faces.length, surface.terrainId, empreinteTriangles(trianglesTerrain), surface.reglages ?? {}]);
  const garde = calculsTalusSurfaces.get(surface.id);
  if (garde?.signature === signature) return garde.resultat;
  let perimetre = 0;
  contour.forEach((p, i) => {
    const q = contour[(i + 1) % contour.length];
    perimetre += Math.hypot(q.est - p.est, q.nord - p.nord);
  });
  const talus = talusParCotes(contour, surface.reglages ?? {}, { altitudeTerrain: trianglesTerrain.length ? altitudeDeSurface(surface.terrainId) : null, pas: Math.max(1, perimetre / 400) });
  const resultat = talus.erreur ? { erreur: talus.erreur } : { contour, talus, source };
  calculsTalusSurfaces.set(surface.id, { signature, resultat, ecrit: false });
  return resultat;
}

/** Surfaces de talus remises à jour (points et faces) quand leur calcul a changé ; sinon rien. */
function synchroniserTalusSurfaces() {
  for (const surface of projet.surfaces) {
    if (surface.type !== 'talus') continue;
    const calcul = calculDuTalusSurface(surface);
    if (calcul.erreur) {
      surface.erreurTalus = calcul.erreur;
      continue;
    }
    delete surface.erreurTalus;
    const garde = calculsTalusSurfaces.get(surface.id);
    if (garde.ecrit && surface.points?.length) continue;
    const { points, faces } = surfaceAvecTalus(calcul.source.points, calcul.source.faces, calcul.talus);
    surface.points = points;
    surface.faces = faces;
    surface.nomFichier = calcul.source.nom;
    garde.ecrit = true;
  }
}

/** Vrai pendant le choix des côtés d'un talus sur le plan (Calculs › Dessin). */
function choixCotesTalusActif() {
  return Boolean(talusSurface.actifId) && ongletContexte === 'dessin' && aAcces('expert') && projet.surfaces.some((s) => s.id === talusSurface.actifId);
}

/** Côtés du contour pour le plan pendant le choix : [{ a, b, numero, choisi, regle }]. */
function cotesTalusPourPlan() {
  if (!choixCotesTalusActif()) return [];
  const surface = projet.surfaces.find((s) => s.id === talusSurface.actifId);
  const calcul = calculDuTalusSurface(surface);
  if (calcul.erreur) return [];
  const { contour } = calcul;
  return contour.map((a, k) => ({ a, b: contour[(k + 1) % contour.length], numero: k + 1, choisi: talusSurface.choisis.has(k), regle: reglageComplet(surface.reglages?.[k]) }));
}

/** Toucher le plan pendant le choix des côtés : le côté le plus proche (sous le doigt) est choisi ou enlevé. */
function toucherCoteTalus(position, tolerance) {
  const cotes = cotesTalusPourPlan();
  let meilleur = null;
  for (const c of cotes) {
    const dx = c.b.est - c.a.est;
    const dy = c.b.nord - c.a.nord;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((position.est - c.a.est) * dx + (position.nord - c.a.nord) * dy) / l2)) : 0;
    const d = Math.hypot(position.est - (c.a.est + dx * t), position.nord - (c.a.nord + dy * t));
    if (d <= tolerance && (!meilleur || d < meilleur.d)) meilleur = { d, k: c.numero - 1 };
  }
  if (!meilleur) {
    afficherMessage('Aucun côté de la surface sous le doigt', 2500);
    return;
  }
  if (talusSurface.choisis.has(meilleur.k)) talusSurface.choisis.delete(meilleur.k);
  else talusSurface.choisis.add(meilleur.k);
  recalculer();
}

/** Talus des surfaces montrées, pour le plan (barbules et pente). */
function tranchesDesTalusSurfaces() {
  const cachees = new Set(projet.listesCachees ?? []);
  return projet.surfaces
    .filter((s) => s.type === 'talus' && (!cachees.has(s.id) || s.id === talusSurface.actifId))
    .flatMap((s) => {
      const calcul = calculDuTalusSurface(s);
      return calcul.erreur ? [] : tranchesDesCotes(calcul.talus, s.reglages);
    });
}

/** Côtés numérotés « C1 », « C1–C4 » (n° à partir de 1). */
function texteCotes(cotes) {
  return cotes.length === 1 ? `C${cotes[0] + 1}` : `C${cotes[0] + 1}–C${cotes.at(-1) + 1}`;
}

/** Réglage en mots : « 3/2 · remblai · 2 m », « 2/1 · auto · terrain ». */
function texteReglageTalus(reglage, avecTerrain) {
  const sens = { auto: 'auto', remblai: 'remblai', deblai: 'déblai' }[reglage.sens ?? 'auto'];
  const fin = reglage.longueur > 0
    ? `${formaterNombre(reglage.longueur)} m`
    : avecTerrain ? 'jusqu\'au terrain' : reglage.altitudeSol != null ? `sol à ${formaterNombre(reglage.altitudeSol)} m` : 'entrée en terre sur le terrain';
  return `${texteDePente(reglage)} · ${sens} · ${fin}`;
}

/** Données de l'écran « Talus d'une surface ». */
function donneesTalusSurfaces() {
  const talus = projet.surfaces.filter((s) => s.type === 'talus').map((s) => {
    const calcul = calculDuTalusSurface(s);
    const nombreCotes = calcul.contour?.length ?? 0;
    const troncons = calcul.contour ? tronconsAImplanter(calcul.contour, s.reglages ?? {}, calcul.talus) : [];
    const etats = new Map((calcul.talus?.cotes ?? []).map((c) => [c.cote, c]));
    const enChoix = talusSurface.actifId === s.id && choixCotesTalusActif();
    const choisis = enChoix ? [...talusSurface.choisis].sort((a, b) => a - b) : [];
    return {
      id: s.id,
      nom: s.nom,
      sourceId: s.sourceId,
      terrainId: s.terrainId ?? null,
      enChoix,
      choisis: choisis.length,
      cleChoix: choisis.join(','),
      reglage: choisis.map((k) => s.reglages?.[k]).find(reglageComplet) ?? null,
      nombreCotes,
      erreur: calcul.erreur ?? null,
      groupes: troncons.map((t) => {
        const resultats = t.cotes.map((k) => etats.get(k)).filter(Boolean);
        const erreur = resultats.find((c) => c.etat === 'erreur');
        const aChercher = resultats.some((c) => c.etat === 'aChercher');
        return {
          cotes: texteCotes(t.cotes),
          texte: `${texteReglageTalus(t.reglage, Boolean(s.terrainId))}${(t.reglage.sens ?? 'auto') === 'auto' && t.nature ? ` · en ${t.nature === 'deblai' ? 'déblai' : 'remblai'}` : ''}`,
          etat: erreur ? 'erreur' : aChercher ? 'aChercher' : 'ok',
          message: erreur?.message ?? (aChercher ? 'à chercher sur le terrain' : null),
        };
      }),
    };
  });
  return {
    sources: projet.surfaces.filter((s) => estSurfaceFichier(s) && s.type !== 'talus').map((s) => ({ id: s.id, nom: s.nom })),
    terrains: projet.surfaces.filter((s) => trianglesDeSurface(s.id).length > 0).map((s) => ({ id: s.id, nom: s.nom })),
    talus,
  };
}

const ecranTalusSurface = creerEcranTalusSurface(document.querySelector('#talus-surfaces'), {
  nouveauTalusSurface: (sourceId) => {
    const source = projet.surfaces.find((s) => s.id === sourceId);
    if (!source || refuserEnLectureSeule()) return;
    const surface = { id: nouvelIdentifiant(), nom: avecPrefixe(`${sansPrefixe(source.nom, PREFIXE_SURFACE)} talus`, PREFIXE_SURFACE), type: 'talus', sourceId, terrainId: null, reglages: {}, nomFichier: source.nom, points: source.points.map((p) => ({ ...p })), faces: source.faces.map((f) => [...f]) };
    projet.surfaces.push(surface);
    talusSurface.actifId = surface.id;
    talusSurface.choisis = new Set();
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    afficherMessage('Touche les côtés de la surface sur le plan', 3000);
    modifie();
  },
  choisirCotesTalus: (id) => {
    if (talusSurface.actifId === id && choixCotesTalusActif()) {
      talusSurface.actifId = null;
      talusSurface.choisis = new Set();
    } else {
      talusSurface.actifId = id;
      talusSurface.choisis = new Set();
      afficherMessage('Touche les côtés de la surface sur le plan', 3000);
    }
    recalculer();
  },
  toutChoisirTalus: (id) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    const n = surface ? calculDuTalusSurface(surface).contour?.length ?? 0 : 0;
    talusSurface.choisis = new Set(Array.from({ length: n }, (_, k) => k));
    recalculer();
  },
  rienChoisirTalus: () => {
    talusSurface.choisis = new Set();
    recalculer();
  },
  appliquerTalus: (id, reglage) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    if (!surface || talusSurface.choisis.size === 0) return;
    if (!reglageComplet(reglage)) {
      afficherMessage('Pente du talus à choisir', 3000);
      return;
    }
    surface.reglages ??= {};
    const propre = { horizontal: reglage.horizontal, vertical: reglage.vertical, sens: ['remblai', 'deblai'].includes(reglage.sens) ? reglage.sens : 'auto', longueur: reglage.longueur > 0 ? reglage.longueur : null, altitudeSol: Number.isFinite(reglage.altitudeSol) ? reglage.altitudeSol : null };
    for (const k of talusSurface.choisis) surface.reglages[k] = { ...propre };
    modifie();
  },
  enleverTalus: (id) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    if (!surface) return;
    for (const k of talusSurface.choisis) delete surface.reglages?.[k];
    modifie();
  },
  reglerTerrainTalus: (id, terrainId) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    if (!surface) return;
    surface.terrainId = terrainId || null;
    modifie();
  },
  supprimerTalusSurface: (id) => {
    const surface = projet.surfaces.find((s) => s.id === id);
    if (!surface || !confirm(`Supprimer « ${surface.nom} » (la surface importée reste) ?`)) return;
    projet.surfaces = projet.surfaces.filter((s) => s.id !== id);
    if (talusSurface.actifId === id) talusSurface.actifId = null;
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    modifie();
  },
});

/**
 * Talus des surfaces, à implanter (Terrain › Implanter › Talus) : un par tronçon (côtés voisins
 * réglés pareil). [{ valeur: « id:n° du tronçon », nom, texte }].
 */
function talusDesSurfacesAImplanter() {
  return projet.surfaces.filter((s) => s.type === 'talus').flatMap((s) => {
    const calcul = calculDuTalusSurface(s);
    if (!calcul.contour) return [];
    const nature = { remblai: ' · en remblai', deblai: ' · en déblai' };
    // Sens « auto » : un tronçon par passage du remblai au déblai (Implanter doit savoir si la ligne est le haut ou le bas).
    return tronconsAImplanter(calcul.contour, s.reglages ?? {}, calcul.talus).map((t, i) => ({ valeur: `${s.id}:${i}`, nom: `${s.nom} · ${texteCotes(t.cotes)}`, texte: `${texteReglageTalus(t.reglage, Boolean(s.terrainId))}${(t.reglage.sens ?? 'auto') === 'auto' ? nature[t.nature] ?? '' : ''}` }));
  });
}

/**
 * Ouvre un tronçon de talus d'une surface dans Implanter › Talus : la ligne = les côtés (sens du
 * contour, talus à droite), les réglages = pente, haut / bas (remblai / déblai ; auto : selon le
 * terrain au milieu du tronçon), longueur et terrain de référence (sans terrain : sol plat à la canne).
 */
function ouvrirTalusSurface(valeur) {
  const [id, numero] = String(valeur).split(':');
  const surface = projet.surfaces.find((s) => s.id === id);
  const calcul = surface ? calculDuTalusSurface(surface) : null;
  const troncon = calcul?.contour ? tronconsAImplanter(calcul.contour, surface.reglages ?? {}, calcul.talus)[Number(numero)] : null;
  if (!troncon) return;
  const { reglage } = troncon;
  let ligneEst = (troncon.nature ?? reglage.sens) === 'deblai' ? 'bas' : 'haut';
  if (troncon.nature == null && (reglage.sens ?? 'auto') === 'auto') {
    const altitudeDuTerrain = altitudeDeSurface(surface.terrainId);
    const m = troncon.sommets[Math.floor(troncon.sommets.length / 2)];
    const zTerrain = altitudeDuTerrain?.(m.est, m.nord);
    if (zTerrain != null) ligneEst = m.altitude >= zTerrain ? 'haut' : 'bas';
    else afficherMessage('Sens « auto » sans terrain : talus pris depuis le haut (remblai), à vérifier', 4000);
  }
  const mm = (x) => Math.round(x * 1000) / 1000;
  const sommets = troncon.sommets.map((p) => ({ est: mm(p.est), nord: mm(p.nord), altitude: p.altitude != null ? mm(p.altitude) : null, ...(p.nom ? { nom: p.nom } : {}) }));
  implanter.ligne = nouvelleLigneAImplanter(`${surface.nom} · ${texteCotes(troncon.cotes)}`, sommets, null);
  implanter.ligneAValider = false;
  implanter.pointsLigne = [];
  implanter.talusId = null;
  terrain.talus = { ...terrain.talus, horizontal: reglage.horizontal, vertical: reglage.vertical, ligneEst, cote: 'droite', longueur: reglage.longueur ?? null, terrainId: surface.terrainId ?? null, altitudeSurfaceId: null };
  retenirReglagesTerrain();
  montrerImplantation();
}

/** Sommets de tous les dessins, prêts à implanter (« PF1-1 »…, avec leur altitude). */
function pointsDesDessins() {
  return projet.dessins.flatMap((d) => pointsDuDessin(d, projet.dessins));
}

/** Dessins montrés sur le plan : ceux cochés dans « Afficher » (et toujours celui en cours). */
function dessinsVisibles() {
  const cachees = new Set(projet.listesCachees ?? []);
  return projet.dessins.filter((d) => !cachees.has(d.id) || (piloteActif() && d.id === pilote.dessinId));
}

/** Données de l'écran Calculs › Dessin : les dessins (côtés, aire, altitudes) et le pilote. */
function donneesDessin() {
  return {
    dessins: projet.dessins.map((d) => {
      const ferme = estFerme(d) && d.sommets.length >= 3;
      const surface = projet.surfaces.find((s) => s.dessinId === d.id);
      return {
        ...d,
        perimetre: longueursCotes(d.sommets, ferme).reduce((somme, l) => somme + l, 0),
        aire: ferme ? airePolygone(d.sommets) : 0,
        altitudes: altitudesDuDessin(d),
        noms: pointsDuDessin(d, projet.dessins).map((p) => p.nom),
        // Plateforme, bâtiment : sa surface de terrassement (nom, et pourquoi elle n'est pas à jour), ou
        // pourquoi on ne peut pas encore la créer.
        surface: surface ? { nom: surface.nom, erreur: surface.erreurDessin ?? null } : null,
        empecheSurface: estFerme(d) ? (surfaceDuDessin(d, projet.dessins).erreur ?? null) : null,
        // Talus jusqu'au terrain (0.108.0) : réglages et terrains possibles (levés et surfaces avec triangles).
        talus: d.talus ?? null,
        terrains: ferme ? projet.surfaces.filter((s) => !s.dessinId && trianglesDeSurface(s.id).length > 0).map((s) => ({ id: s.id, nom: s.nom })) : [],
      };
    }),
    pentesTalus: PENTES_TALUS,
    pilote,
    recepteur: recepteurDisponible(),
  };
}

const ecranDessin = creerEcranDessin(document.querySelector('#dessins'), {
  nouveauDessin: () => {
    const type = 'dessin';
    const nom = nomDessin(type, projet.dessins);
    // numero : le 1 de « PF1-1 » (noms des sommets à implanter), gardé même si le dessin est renommé.
    const dessin = { id: nouvelIdentifiant(), nom, numero: Number(nom.split(' ').at(-1)), type, ferme: false, sommets: [], hauteur: { mode: 'fixe', altitude: null, pente: null } };
    projet.dessins.push(dessin);
    pilote = nouveauPilote(dessin);
    modifie();
  },
  dessiner: (id) => {
    const dessin = dessinDe(id);
    if (!dessin) return;
    pilote = nouveauPilote(dessin);
    // Figure fermée : on la rouvre pour continuer (sa surface attend qu'elle soit refermée).
    if (dessin.ferme) {
      dessin.ferme = false;
      modifie();
      return;
    }
    recalculer();
  },
  fermerFigure: () => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin || dessin.sommets.length < 3) return;
    dessin.ferme = true;
    pilote = null;
    afficherMessage(`« ${dessin.nom} » fermé : « Créer la surface » est possible`, 3000);
    modifie();
  },
  terminerDessin: () => {
    pilote = null;
    recalculer();
  },
  supprimerDessin: (id) => {
    const dessin = dessinDe(id);
    const avecSurface = projet.surfaces.some((s) => s.dessinId === id);
    if (!dessin || !confirm(`Supprimer « ${dessin.nom} »${avecSurface ? ' et son levé « Surface » (avec ses points)' : ''} ?`)) return;
    projet.dessins = projet.dessins.filter((d) => d.id !== id);
    if (pilote?.dessinId === id) pilote = null;
    modifie(); // sa surface part avec lui (voir synchroniserSurfacesDessins)
  },
  creerSurfaceDessin: (id) => {
    const dessin = dessinDe(id);
    if (!dessin || projet.surfaces.some((s) => s.dessinId === id)) return;
    const { points, erreur } = surfaceDuDessin(dessin, projet.dessins);
    if (erreur) {
      afficherMessage(`Surface impossible : ${erreur}`, 4000);
      return;
    }
    // Un levé « Surface » (0.77.0) : rangé avec les levés, complété au RX2 dans Terrain › Lever.
    const surface = creerLeveeDuDessin(projet, dessin, points);
    projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    afficherMessage(`Levé « ${surface.nom} » créé (Terrain › Lever, et Volumes)`, 4000);
    modifie();
  },
  renommerDessin: (id, nom) => {
    const dessin = dessinDe(id);
    if (!dessin || !nom) return;
    dessin.nom = nom;
    modifie();
  },
  choisirAccrocheDessin: (mode) => {
    if (!pilote) return;
    pilote.accroche = MODES_ACCROCHE.includes(mode) ? mode : 'point';
    recalculer();
  },
  // Chaque clic tourne de l'angle inscrit (cumulé) ; « Tout droit » : dans le prolongement du côté précédent.
  tournerCote: ({ angle, sens }) => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin || dessin.sommets.length < 2) return;
    if (sens === 'droit') pilote.tourne = 0;
    else {
      const degres = lireNombreTape(angle);
      if (degres == null || !(degres > 0 && degres <= 180)) {
        afficherMessage('Angle illisible : un nombre de degrés entre 0 et 180 (90 = d\'équerre)', 4000);
        return;
      }
      pilote.angle = String(angle).trim();
      // On part de la direction actuelle (tournée, touchée sur le plan ou vers le RX2), sinon du
      // prolongement du côté précédent ; « tourne » est compté depuis ce prolongement, entre −180° et +180°.
      const precedent = gisement(dessin.sommets.at(-2), dessin.sommets.at(-1));
      const depuis = pilote.direction == null || precedent == null ? 0 : ((pilote.direction - precedent) * 360) / 400;
      const total = depuis + (sens === 'droite' ? degres : -degres);
      pilote.tourne = ((((total + 180) % 360) + 360) % 360) - 180;
    }
    appliquerTourne(dessin);
    recalculer();
  },
  // Altitude du prochain sommet (tapée à côté de la distance).
  reglerAltitudePilote: (texte) => {
    if (!pilote) return;
    pilote.altitude = texte.trim();
    // Une altitude tapée remplace « idem » ou « pente » (qui se choisissent en touchant leur bouton).
    if (pilote.altitude !== '') pilote.altitudeChoix = 'tapee';
  },
  // « = dernier point » ou « pente depuis le dernier » (0.84.0) : touché une 2e fois, retour à l'altitude tapée.
  choisirAltitudePilote: (valeur) => {
    if (!pilote) return;
    pilote.altitudeChoix = pilote.altitudeChoix === valeur ? 'tapee' : valeur;
    pilote.altitude = '';
    recalculer();
  },
  reglerPentePilote: (texte) => {
    if (pilote) pilote.pente = texte.trim();
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
      afficherMessage(dessin.sommets.length === 1 ? 'Donne d\'abord la direction : touche le plan, ou vers le GNSS' : 'Donne d\'abord la direction : tourne à gauche ou à droite, ou touche le plan', 4000);
      return;
    }
    if (!(distance > 0)) {
      afficherMessage('Distance illisible : un nombre de mètres plus grand que 0', 4000);
      return;
    }
    const tapee = lireNombreTape(pilote.altitude);
    if (tapee === undefined) {
      afficherMessage('Altitude illisible : écris un nombre, ou laisse vide', 4000);
      return;
    }
    const choisie = altitudeSelonChoix(dessin, { choix: pilote.altitudeChoix, tapee, pente: lireNombreTape(pilote.pente), distance });
    if (choisie.erreur) {
      afficherMessage(`Altitude : ${choisie.erreur}`, 4000);
      return;
    }
    const altitude = altitudeProchainSommet(dessin, choisie.altitude);
    pilote.altitude = '';
    ajouterSommetDessin({ ...pointSelonGisement(dessin.sommets.at(-1), pilote.direction, distance), altitude });
  },
  sommetRx2: () => {
    const reponse = prendrePointRecepteur();
    if (!reponse.ok) {
      refuser(`Point refusé : ${reponse.raison}`);
      return;
    }
    sonValidation();
    ajouterSommetDessin(reponse.point, 'GNSS');
  },
  directionRx2: () => {
    const dessin = dessinDe(pilote?.dessinId);
    const reponse = prendrePointRecepteur();
    if (!reponse.ok) {
      refuser(`Point refusé : ${reponse.raison}`);
      return;
    }
    const gon = dessin?.sommets.length ? gisement(dessin.sommets.at(-1), reponse.point) : null;
    if (gon == null) {
      afficherMessage('Le GNSS est sur le dernier sommet : éloigne-toi dans la direction voulue', 4000);
      return;
    }
    sonValidation();
    pilote.direction = gon;
    pilote.reference = 'vers le GNSS';
    pilote.tourne = 0;
    recalculer();
  },
  rectangleDessin: ({ longueur, largeur, cote }) => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin || dessin.sommets.length !== 1) return;
    if (pilote.direction == null) {
      afficherMessage('Rectangle : donne d\'abord la direction de la longueur (touche le plan, ou vers le GNSS)', 4000);
      return;
    }
    const a = dessin.sommets[0];
    const { sommets, erreur } = rectangle(a, pointSelonGisement(a, pilote.direction, 1), lireNombreTape(longueur), lireNombreTape(largeur), cote);
    if (erreur) {
      afficherMessage(`Rectangle : ${erreur}`, 4000);
      return;
    }
    dessin.sommets = sommets.map((s, i) => (i === 0 ? a : { est: auMillimetre(s.est), nord: auMillimetre(s.nord), altitude: null }));
    // Un rectangle est une figure fermée : le dessin est terminé.
    if (dessin.type === 'dessin') dessin.ferme = true;
    pilote = null;
    modifie();
  },
  annulerSommet: () => {
    const dessin = dessinDe(pilote?.dessinId);
    if (!dessin?.sommets.length) return;
    dessin.sommets.pop();
    pilote.direction = null;
    pilote.reference = null;
    pilote.tourne = 0;
    modifie();
  },
  choisirModeHauteur: (valeur) => {
    const [id, mode] = valeur.split(':');
    const dessin = dessinDe(id);
    if (!dessin) return;
    dessin.hauteur.mode = mode === 'sommets' ? 'sommets' : 'fixe';
    modifie();
  },
  // Talus jusqu'au terrain (0.108.0) : marche / arrêt, terrain, pente du remblai et du déblai.
  reglerTalusDessin: (id, champ, valeur) => {
    const dessin = dessinDe(id);
    if (!dessin) return;
    const pente = (texte) => {
      const choisie = PENTES_TALUS.find(([cle]) => cle === texte);
      if (choisie) return { horizontal: choisie[1], vertical: choisie[2] };
      // Tapée : « 5/4 » (H/V).
      const lu = /^\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(texte));
      if (!lu) {
        afficherMessage(`Pente « ${texte} » illisible : écris H/V, par exemple 5/4`, 4000);
        return null;
      }
      const [h, v] = [Number(lu[1].replace(',', '.')), Number(lu[2].replace(',', '.'))];
      return h > 0 && v > 0 ? { horizontal: h, vertical: v } : null;
    };
    dessin.talus ??= { actif: false, terrainId: null, remblai: { horizontal: 3, vertical: 2 }, deblai: { horizontal: 3, vertical: 2 } };
    if (champ === 'actif') dessin.talus.actif = Boolean(valeur);
    else if (champ === 'terrainId') dessin.talus.terrainId = valeur || null;
    else if (champ === 'remblai' || champ === 'deblai') {
      const lue = pente(valeur);
      if (!lue) return;
      dessin.talus[champ] = lue;
    }
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
  // Altitude d'un sommet changée dans « Voir les sommets » : le dessin passe « par sommet ».
  altitudeSommet: (id, numero, texte) => {
    const dessin = dessinDe(id);
    const valeur = lireNombreTape(texte);
    if (!dessin?.sommets[numero]) return;
    if (valeur === undefined) {
      afficherMessage(`Altitude du sommet ${numero + 1} illisible : écris un nombre, ou laisse vide`, 4000);
      return;
    }
    passerParSommet(dessin);
    dessin.sommets[numero].altitude = valeur;
    modifie();
  },
});

// Lignes suivies en Guidage (0.154.0, Expert) : 2 au plus, choisies en touchant le plan (toutes les
// lignes : plans DXF, levés, dessins) ; pour chacune, le bout de l'outil mesuré (G ou D). En mémoire
// seulement (oubliées au redémarrage).
// 0.171.0 : `place` = 0 (L1, bord G, violet) ou 1 (L2, bord D, orange) ; `choix` = place en cours de choix, ou null.
// 0.188.0 : candidat = ligne touchée mais pas encore validée ({ place, sommets }).
const lignesGuidage = { liste: [], choix: null, candidat: null };
function choixLignesGuidageActif() {
  return lignesGuidage.choix !== null && ongletContexte === 'terrain' && terrain.mode === 'lame' && lameActive();
}

/** Toucher du plan pendant le choix des lignes du Guidage : la ligne touchée est ajoutée (2 au plus). */
function toucherPourLigneGuidage(position, tolerance) {
  const lignes = avecToutesLesLignes('croisement', sourcesDesPlans(plansDuProjet(), position, tolerance)).lignes;
  const trouve = accrocherTrait(position, tolerance, lignes);
  if (!trouve) {
    afficherMessage('Aucune ligne sous le doigt (plan DXF, levé, dessin)', 3000);
    return;
  }
  // 0.188.0 : toucher = proposer la ligne (en pointillé sur le plan) ; elle n'est gardée qu'avec « Valider ».
  lignesGuidage.candidat = { place: lignesGuidage.choix, sommets: trouve.sommets.map((p) => ({ est: p.est, nord: p.nord })) };
  afficherMessage('Ligne touchée : touche « Valider » (ou une autre ligne)', 3000);
  recalculer();
}

/** Valide la ligne touchée : elle est gardée et on sort du choix. */
function validerLigneGuidage() {
  const c = lignesGuidage.candidat;
  if (!c) return;
  lignesGuidage.liste = lignesGuidage.liste.filter((l) => l.place !== c.place);
  lignesGuidage.liste.push({ place: c.place, sommets: c.sommets, bout: c.place === 0 ? 'gauche' : 'droite' });
  sonValidation();
  lignesGuidage.choix = null;
  lignesGuidage.candidat = null;
  recalculer();
}

/** Valeur voisine dans une liste croissante : pas = +1 (suivante) ou −1 (précédente), bornée aux extrémités. */
function voisinDansListe(liste, valeur, pas) {
  let i = liste.findIndex((v) => v === Number(valeur));
  if (i < 0) i = liste.reduce((meilleur, v, k) => (Math.abs(v - valeur) < Math.abs(liste[meilleur] - valeur) ? k : meilleur), 0);
  return liste[Math.max(0, Math.min(liste.length - 1, i + (pas > 0 ? 1 : -1)))];
}

// Delta Z de la surface (0.152.0, dès Intermédiaire) : la surface suivie est montée (+) ou descendue
// (−) de ce décalage, en Implanter › Surface et en Guidage ; jamais enregistré : 0 à chaque démarrage.
let deltaSurface = 0;

// --- Guidage de lame à 2 RX2 (Terrain › Lame, voir topo/lame.js et leve/lame-ecran.js) ---

// Recherche rapide de l'altitude de la surface suivie (refaite quand ses triangles changent).
let chercheurLame = { triangles: null, chercher: null };
// Dernières positions du milieu de la lame { est, nord, temps } : sens de marche du profil en long.
const historiqueLame = [];

/** Pourquoi un récepteur ne peut pas guider (texte), ou null s'il est prêt (RTK fixe, inclinaison prête). */
function raisonRecepteurLame(etat, nom) {
  if (!etat?.connecte) return `${nom} : pas connecté`;
  if (!etat.recu || !etat.position) return `${nom} : en attente de la position`;
  if (!etat.autorise) return `${nom} : ${etat.raison ?? 'position pas fiable'}`;
  return null;
}

/**
 * Guidage de la lame avec les 2 derniers états reçus : { raison (texte ou null), guidage (axe G – D),
 * long (axe Arr – Av), coupe (G – D), coupeLong (Arr – Av), coins: { gauche, droite } (pour le plan) },
 * ou null hors du mode Lame.
 */
function calculerLame() {
  if (!ecranLeve || terrain.mode !== 'lame' || !lameActive()) return null;
  if (outilAUnGnss()) return calculerOutilUnGnss();
  const [etatG, etatD] = terrain.lame.inverse ? [etatRecepteur2, etatRecepteur] : [etatRecepteur, etatRecepteur2];
  const [nomG, nomD] = terrain.lame.inverse ? ['Gauche (récepteur 2)', 'Droite (récepteur 1)'] : ['Gauche (récepteur 1)', 'Droite (récepteur 2)'];
  const lame = etatG?.position && etatD?.position ? { gauche: etatG.position, droite: etatD.position } : null;
  const surface = projet.surfaces.find((s) => s.id === terrain.lame.surfaceId);
  const triangles = surface ? trianglesDeSurface(surface.id) : [];
  const raison = (!surface && 'Choisis la surface à suivre')
    || (triangles.length === 0 && 'Ce levé n\'a pas encore de triangles')
    || raisonRecepteurLame(etatG, nomG)
    || raisonRecepteurLame(etatD, nomD);
  if (raison) return { raison, guidage: null, coins: lame };
  // 0.151.0 : axe G – D à « axe » m de la lame, coupe Arr – Av au milieu (Bull : perpendiculaire à
  // la lame ; Grader : sens de marche, perpendiculaire à la lame à l'arrêt).
  const sens = sensAvantLame(lame);
  if (!sens) return { raison: 'les deux récepteurs sont au même endroit', guidage: null, coins: lame };
  const points = pointsGuidageLame(lame.gauche, lame.droite, sens, reglagesOutilLame());
  return { ...guidageDesPoints(points, triangles, { gauche: points.gauche, droite: points.droite }, sens), penteEngin: penteDeLEngin(), exageration: terrain.lame.exagerationCoupe };
}

/**
 * Pente de l'engin (0.171.0) : celle du 1er GNSS (1 GNSS : le seul ; 2 GNSS : « la pente du 1er », demande du 09.11),
 * en % vers l'avant (+ = nez en l'air), ou null (pas de cap ou d'inclinaison prête).
 */
function penteDeLEngin() {
  const e = etatRecepteur;
  if (!e?.connecte || !e.inclinaisonPrete || e.cap == null) return null;
  return penteEngin({ cap: e.cap, inclinaison: e.inclinaison ?? 0, directionInclinaison: e.directionInclinaison ?? 0 });
}

/**
 * Outil à 1 GNSS (0.142.0) : râteau ou Bull à 1 récepteur. Les bouts gauche / droit (sur l'axe G – D)
 * jouent le rôle des 2 GNSS du Bull ; mêmes écarts, dévers et coupes. Voir topo/outil.js.
 */
function calculerOutilUnGnss() {
  const etat = etatRecepteur;
  const machine = terrain.lame.machine === 'rateau' ? 'rateau' : 'bull';
  const dims = reglagesOutilLame();
  const surface = projet.surfaces.find((s) => s.id === terrain.lame.surfaceId);
  const triangles = surface ? trianglesDeSurface(surface.id) : [];
  const penche = (etat?.inclinaison ?? 0) > 0.2;
  const raison = (!surface && 'Choisis la surface à suivre')
    || (triangles.length === 0 && 'Ce levé n\'a pas encore de triangles')
    || raisonRecepteurLame(etat, 'GNSS')
    || (!etat.inclinaisonPrete && 'GNSS : inclinaison pas prête (le cap et la pente de l\'outil en dépendent)')
    || (etat.cap == null && 'GNSS : pas de cap reçu')
    || (penche && etat.directionInclinaison == null && 'GNSS : direction de l\'inclinaison pas reçue (mets l\'APK à jour)')
    || (!(dims.gauche + dims.droite > 0.1) && `Tape les distances de l'outil (⚙ : gauche, droite${machine === 'rateau' ? ', avant, arrière' : ''})`);
  if (raison) return { raison, guidage: null, coins: null, unGnss: true };
  const points = pointsOutil(etat.position, { cap: etat.cap, inclinaison: etat.inclinaison ?? 0, directionInclinaison: etat.directionInclinaison ?? 0 }, dims);
  // Bull à 1 GNSS : lame vue de côté = un seul point (le milieu), avant = perpendiculaire à la lame.
  const sensLame = machine === 'bull' ? avantDeLaLame(points.gauche, points.droite) : null;
  const resultat = guidageDesPoints(points, triangles, { gauche: points.gauche, droite: points.droite, contour: machine === 'rateau' ? points.coins : null }, sensLame);
  if (resultat.guidage) {
    // Écart au centre de l'outil (même formule qu'un coin : altitude de la surface − altitude du point).
    const surfaceBase = chercheurLame.chercher(points.centre.est, points.centre.nord);
    const surfaceCentre = surfaceBase == null ? null : surfaceBase + deltaSurface;
    resultat.guidage.centre = { ecart: surfaceCentre == null ? null : surfaceCentre - points.centre.altitude };
  }
  return { ...resultat, unGnss: true, penteEngin: penteDeLEngin(), exageration: terrain.lame.exagerationCoupe };
}

/**
 * Réglages de l'outil de la machine choisie (m) : gauche, droite (outil à 1 GNSS), avant, arrière
 * (longueur de la coupe Arr – Av depuis le GNSS) et axe (place de l'axe G – D, + devant ; râteau :
 * mi-longueur s'il n'est pas tapé).
 */
function reglagesOutilLame() {
  const machine = ['bull', 'rateau'].includes(terrain.lame.machine) ? terrain.lame.machine : 'grader';
  const r = terrain.lame.outils[machine] ?? {};
  const nombre = (v, defaut) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : defaut);
  return {
    gauche: nombre(r.gauche, 0),
    droite: nombre(r.droite, 0),
    avant: nombre(r.avant, 0),
    arriere: nombre(r.arriere, 0),
    axe: machine === 'rateau' ? (r.axe == null ? null : nombre(r.axe, null)) : nombre(r.axe, 0),
  };
}

/**
 * Écarts et coupes des 4 points guidés (0.151.0) : gauche, droite (axe G – D), arriere, avant
 * (axe Arr – Av). coins : ce qui est montré sur le plan.
 */
function guidageDesPoints(points, triangles, coins, sensLame = null) {
  if (chercheurLame.triangles !== triangles) chercheurLame = { triangles, chercher: chercheurAltitude(triangles) };
  const tolerances = terrain.lame.tolerances;
  // Delta Z de la surface (0.152.0) : la surface suivie est décalée ; la surface de base reste sur les coupes.
  const delta = deltaSurface;
  const altitudeSurface = delta ? (est, nord) => {
    const z = chercheurLame.chercher(est, nord);
    return z == null ? null : z + delta;
  } : chercheurLame.chercher;
  const guidage = guidageLame({ gauche: points.gauche, droite: points.droite, altitudeSurface, tolerances });
  if (guidage.erreur) return { raison: guidage.erreur, guidage: null, coins };
  // Coupes : l'outil + 1 m à gauche / droite et 2 m devant / derrière au départ (0.152.0).
  // 0.190.0 : les boutons − / + de la coupe multiplient les marges (la coupe est plus ou moins large autour de l'outil).
  const facteurMarges = terrain.lame.zoomMarges ?? 1;
  const marges = Object.fromEntries(Object.entries(terrain.lame.marges).map(([cle, valeur]) => [cle, Math.max(valeur, 0.5) * facteurMarges]));
  const coupe = coupeDecalee(coupeEntre(triangles, points.gauche, points.droite, [marges.gauche, marges.droite]), delta);
  let long;
  let coupeLong;
  if (sensLame) {
    // Lame (Grader, Bull, 0.153.1) : vue de côté, un seul point = le milieu du bas de la lame ; le
    // terrain de « derrière » m derrière à « devant » m devant ; l'écart au milieu seulement.
    const { milieu, arriere, avant } = coupeMilieuLame(points.gauche, points.droite, sensLame, marges.derriere, marges.devant);
    const surfaceMilieu = altitudeSurface(milieu.est, milieu.nord);
    const ecart = surfaceMilieu == null ? null : surfaceMilieu - milieu.altitude;
    long = { milieu: { ecart, classe: classeEcartLame(ecart, tolerances) } };
    const brute = coupeEntre(triangles, arriere, avant, 0);
    coupeLong = brute ? coupeDecalee({ ...brute, centre: { distance: marges.derriere, altitude: milieu.altitude } }, delta) : null;
  } else {
    // Râteau : Arr – Av comme G – D, l'arrière à gauche ; le « dévers » est la pente vers l'avant.
    const calcul = guidageLame({ gauche: points.arriere, droite: points.avant, altitudeSurface, tolerances });
    long = calcul.erreur ? null : calcul;
    coupeLong = calcul.erreur ? null : coupeDecalee(coupeEntre(triangles, points.arriere, points.avant, [marges.derriere, marges.devant]), delta);
  }
  // Lignes suivies (0.154.0) : écart en plan du bout choisi à la ligne, sur l'axe G – D, et place du
  // croisement sur la coupe G – D (distance depuis le début de la coupe).
  const lignes = [...lignesGuidage.liste].sort((a, b) => a.place - b.place).map((l) => {
    const bout = l.bout === 'gauche' ? points.gauche : points.droite;
    const ecart = ecartAUneLigne(bout, points.gauche, points.droite, l.sommets);
    return {
      nom: `L${l.place + 1}`,
      slot: l.place,
      bout: l.bout,
      ecart,
      classe: ecart == null ? null : classeEcartLame(ecart, tolerances),
      surCoupe: ecart == null ? null : marges.gauche + (l.bout === 'gauche' ? 0 : guidage.largeur) + ecart,
    };
  });
  return {
    raison: null,
    guidage,
    long,
    lignes,
    coupe,
    coupeLong,
    coins,
    bords: bordsDeLaLame(points.gauche, points.droite, triangles),
    toleranceVert: tolerances.vert,
  };
}

/** Coupe du Guidage avec la surface décalée de "delta" (m) ; la surface de base gardée à part. */
function coupeDecalee(coupe, delta) {
  if (!coupe || !delta) return coupe;
  return { ...coupe, morceauxBase: coupe.morceaux, morceaux: decalerProfil(coupe.morceaux, delta), delta };
}

/**
 * Sens « vers l'avant » d'une lame à 2 GNSS : Bull = perpendiculaire à la lame ; Grader = sens de
 * marche (dernières positions du milieu), perpendiculaire à la lame à l'arrêt.
 */
function sensAvantLame(lame) {
  const milieu = pointDeProfil(lame.gauche, lame.droite, 'milieu');
  const maintenant = performance.now();
  historiqueLame.push({ est: milieu.est, nord: milieu.nord, temps: maintenant });
  while (historiqueLame.length > 0 && maintenant - historiqueLame[0].temps > 10_000) historiqueLame.shift();
  const azimut = directionDeMarche(historiqueLame, { distanceMin: 1, dureeMax: 5000 });
  return sensCoupeLame(terrain.lame.machine, lame.gauche, lame.droite, azimut);
}

/** Écran Lame et lame sur le plan, avec les derniers états des 2 récepteurs. */
function montrerLame() {
  const lame = calculerLame();
  derniereLame = lame;
  if (lame) ecranLeve.mettreAJourLame(lame);
  const surPlan = lame?.coins && ongletContexte === 'terrain'
    ? { ...lame.coins, classeGauche: lame.guidage?.gauche.classe ?? null, classeDroite: lame.guidage?.droite.classe ?? null }
    : null;
  plan.afficherLame(surPlan);
}

let derniereLame = null; // dernier calcul du guidage (pour le bip-bip)

/**
 * Bip-bip de hauteur (0.107.0, voir topo/bip.js) : Implanter Altitude ou Surface (tolérance 2 cm,
 * comme le vert de l'écart) et Guidage (le coin de lame le plus loin, tolérance « vert » de la lame).
 * Silence ailleurs, ou si le bip est coupé (bouton 🔔 / 🔕).
 */
function mettreAJourBip(controle) {
  let rythme = null;
  if (terrain.bip !== false && ongletContexte === 'terrain') {
    if (terrain.mode === 'controler' && ['surface', 'altitude'].includes(terrain.implantation)) rythme = rythmeBip(controle?.ecart ?? null, 0.02);
    else if (terrain.mode === 'lame' && derniereLame?.guidage) {
      const { gauche, droite } = derniereLame.guidage;
      const ecarts = [gauche?.ecart, droite?.ecart].filter((e) => e != null && Number.isFinite(e));
      const plusLoin = ecarts.sort((a, b) => Math.abs(b) - Math.abs(a))[0] ?? null;
      rythme = rythmeBip(plusLoin, terrain.lame.tolerances.vert);
    }
  }
  piloterBip(rythme);
}

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
    // 0.208.0 : le reste du fichier est bien importé même si certains noms existent déjà ; le résumé le dit.
    const { ajoutes, deja, sansNom } = ajouterPointsControle(projet.pointsControle, points, nouvelIdentifiant);
    if (ajoutes > 0) modifie();
    const morceaux = [`${ajoutes} point(s) ajouté(s)`];
    if (deja.length > 0) morceaux.push(`${deja.length} déjà dans la liste, non ajouté(s) : ${deja.slice(0, 10).join(', ')}${deja.length > 10 ? '…' : ''}`);
    if (sansNom > 0) morceaux.push(`${sansNom} sans nom, non ajouté(s)`);
    if (erreurs.length > 0) morceaux.push(`${erreurs.length} ligne(s) illisible(s) : ${erreurs.slice(0, 5).map((e) => `ligne ${e.ligne}`).join(', ')}${erreurs.length > 5 ? '…' : ''}`);
    const alerte = deja.length > 0 || sansNom > 0 || erreurs.length > 0;
    return { info: morceaux.join(' ; '), erreur: alerte ? morceaux.join(' ; ') : '' };
  } catch (erreur) {
    return { info: '', erreur: `impossible de lire « ${fichier.name} » : ${erreur.message}` };
  }
}

/** Nom de cet appareil (partage Drive), noté dans chaque contrôle ; '' s'il n'est pas donné. */
function nomDeLAppareil() {
  return partage?.appareil()?.nom ?? '';
}

/**
 * Journal de l'appareil (0.119.0, recap des contrôles, voir recap/journal.js) : note ce qui vient
 * d'être fait dans le projet ouvert (ouverture, point levé, implantation, contrôle).
 */
function noterJournal(evenement) {
  const journal = lireJournal(appareilDuJournal());
  noter(journal, { id: projet.id, nom: titreProjet(projet) }, evenement);
  ecrireJournal(journal);
}

/** Vrai si cet appareil a fait un contrôle de ce projet aujourd'hui, dans la durée du projet. */
function controleRecentIci() {
  return aUnControleRecent(projet.controles, nomDeLAppareil(), new Date(), delaiControleMs(projet));
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
    refuser(`Contrôle refusé : ${reponse.raison}`);
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
  noterJournal({ type: 'controle', controle: projet.controles.at(-1) });
  if (resultat.global === 'rouge') {
    vibrer([80, 80, 80]);
    sonRefus();
  } else {
    vibrer(60);
    sonValidation();
  }
  const mots = { vert: 'OK', orange: 'limite', rouge: 'HORS TOLÉRANCE' };
  const hauteur = ecarts.hauteur != null ? ` · haut. ${formaterNombre(ecarts.hauteur)} m` : '';
  const detail = `${point.nom} : plan ${formaterNombre(ecarts.plan)} m${hauteur}`;
  afficherMessage(`${point.nom} : ${mots[resultat.global]} (plan ${formaterNombre(ecarts.plan)} m${hauteur})`, 5000);
  autocontrole.cible = null;
  modifie();
  // Orange : avertissement ; rouge : contacter le géomètre (demande du 26.10.2026). Un OK pour fermer.
  if (resultat.global === 'orange') {
    demanderChoix({ titre: '⚠ Contrôle à la limite', texte: `${detail}. Écart entre les deux tolérances : avertissement.`, boutons: [{ cle: 'ok', texte: 'OK', principal: true }] });
  } else if (resultat.global === 'rouge') {
    demanderChoix({ titre: '⛔ Hors tolérance', texte: `${detail}. Contacte le géomètre.`, boutons: [{ cle: 'ok', texte: 'OK', principal: true }] });
  }
}

/**
 * Rappel du contrôle, à la connexion du RX2 (ou à l'ouverture d'un projet, RX2 déjà connecté) :
 * s'il n'y a pas eu de contrôle réussi aujourd'hui, ou depuis 4 h (voir topo/controle.js).
 * « Oui » ouvre Terrain › Contrôle ; « Non » note le refus dans le projet (CSV, PDF, Drive).
 */
let rappelEnCours = false;
let dernierRappel = 0; // date du dernier rappel montré (ms)
async function proposerControle() {
  if (!ecranLeve || rappelEnCours || !controleNecessaire(projet.controles, new Date(), delaiControleMs(projet), nomDeLAppareil())) return;
  rappelEnCours = true;
  dernierRappel = Date.now();
  const projetDuRappel = projet;
  const aujourdHui = projet.controles.some((c) => estControleReussi(c) && new Date(c.le).toDateString() === new Date().toDateString());
  const texte = aujourdHui ? `Dernier contrôle réussi il y a plus de ${Number((delaiControleMs(projet) / 3600000).toFixed(2))} h.` : 'Aucun contrôle réussi aujourd\'hui.';
  // Pas de point de contrôle dans le projet : un simple bandeau (0.114.0, avant une fenêtre qui
  // bloquait l'écran) ; rien n'est noté (demande du 26.10.2026).
  if (projet.pointsControle.length === 0) {
    afficherMessage(`${texte} Aucun point de contrôle dans ce projet.`, 6000);
    rappelEnCours = false;
    return;
  }
  const choix = await demanderChoix({
    titre: 'Faire le contrôle ?',
    texte,
    boutons: [
      { cle: 'oui', texte: 'Oui, faire le contrôle', principal: true },
      { cle: 'non', texte: 'Non', detail: '⚠ le géomètre sera averti' },
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
  noterJournal({ type: 'controle', controle: projet.controles.at(-1) });
  afficherMessage('Refus enregistré : le géomètre sera au courant', 5000);
  modifie();
}

/** Terrain › Contrôle : toucher un point de contrôle sur le plan le choisit (comme dans la liste). */
function toucherPourControle(position, tolerance) {
  const trouve = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: projet.pointsControle });
  const point = trouve && projet.pointsControle.find((p) => p.nom === trouve.nom);
  if (!point) {
    afficherMessage('Aucun point de contrôle sous le doigt', 3000);
    return;
  }
  if (!recepteurDisponible()) {
    fichePointControle(point);
    return;
  }
  autocontrole.cible = { ...point };
  // 0.188.0 : déjà en guidage, on change de point en gardant le zoom (le cadrage ne se fait qu'au début du guidage).
  const dejaEnGuidage = document.body.classList.contains('vue-implantation');
  montrerImplantation();
  if (!dejaEnGuidage) requestAnimationFrame(cadrerSurImplantation);
}

/** Données de l'écran Terrain › Contrôle (voir leve/controle-ecran.js). */
function donneesAutocontrole() {
  const controles = projet.controles;
  const dates = controles.filter(estControleReussi).map((c) => c.le).sort();
  return {
    points: projet.pointsControle.map((p) => {
      const dernier = [...controles].reverse().find((c) => c.type === 'mesure' && c.pointId === p.id);
      const nbPhotos = (projet.photosControle ?? []).filter((ph) => ph.pointId === p.id).length;
      return { ...p, nbPhotos, dernier: dernier ? { global: dernier.resultat.global, le: dernier.le } : null };
    }),
    cible: autocontrole.cible,
    tolerances: projet.tolerancesControle,
    controles: [...controles].sort((a, b) => (a.le < b.le ? 1 : -1)).slice(0, 30),
    nbControles: controles.length,
    necessaire: controleNecessaire(controles, new Date(), delaiControleMs(projet), nomDeLAppareil()),
    delaiHeures: delaiControleMs(projet) / 3600000,
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
function calculerImplantationLigne(etat, orientation = null) {
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
    // Gauche / droite (0.118.0) : vert / orange / rouge selon la tolérance en plan du Contrôle.
    classeLaterale: fiable ? classeTolerance(g.ecart, projet.tolerancesControle?.plan ?? TOLERANCES_PAR_DEFAUT.plan) : 'pas-fiable',
    // Début / fin (0.118.1) : même tolérance, sur l'écart au bout le plus proche (vert = arrivé au bout).
    // 0.118.3 : gris (« loin ») à plus de 1 m des deux bouts, pour ne pas être rouge tout le temps.
    classeBout: !fiable ? 'pas-fiable' : ecartAuBout(g.abscisse, g.longueur) > 1 ? 'loin' : classeTolerance(ecartAuBout(g.abscisse, g.longueur), projet.tolerancesControle?.plan ?? TOLERANCES_PAR_DEFAUT.plan),
    ecartAltitude,
    classeAltitude: ecartAltitude == null ? null : classeEcart(ecartAltitude),
    // 0.123 : de combien de degrés se tourner pour être dans l'axe de la ligne (+ = vers la droite) ; null sans cap.
    virage: virageVersLigne(orientation?.azimut ?? null, sommetsDeLaLigne(), g.segment),
    message: null,
  };
}

/**
 * Angle à tourner (degrés, + = vers la droite, de -180 à 180) pour que le devant du GNSS soit dans
 * l'axe du segment de la ligne (dans le sens de l'implantation). null si le cap est inconnu.
 */
function virageVersLigne(azimut, sommets, segment) {
  const a = sommets[segment];
  const b = sommets[segment + 1];
  if (azimut == null || !a || !b) return null;
  const axe = (Math.atan2(b.est - a.est, b.nord - a.nord) * 180) / Math.PI;
  return ((((axe - azimut) % 360) + 540) % 360) - 180;
}

/** « Enregistrer l'implantation » sur une ligne : position mesurée, abscisse, décalage, écarts. */
function enregistrerImplantationLigne() {
  const ligne = implanter.ligne;
  if (!ligne) return;
  const reponse = prendrePointRecepteur();
  if (!reponse.ok) {
    refuser(`Implantation refusée : ${reponse.raison}`);
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
  noterJournal({ type: 'implantation', controleRecent: controleRecentIci() });
  vibrer(60);
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
    refuser(`Implantation refusée : ${reponse.raison}`);
    return;
  }
  const { est, nord, altitude, ...gnss } = reponse.point;
  const mesure = { est, nord, altitude, gnss };
  const { sommets, reglages, altitudeLigne, altitudeTerrain } = donneesTalus();
  const g = guidageTalus(mesure, sommets, reglages, { altitudeLigne, altitudeTerrain });
  if (g.message) {
    refuser(`Implantation refusée : ${g.message}`);
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
  noterJournal({ type: 'implantation', controleRecent: controleRecentIci() });
  vibrer(60);
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

/**
 * Lignes de rupture et contours des levés montrés sur le plan (cases cochées dans « Afficher »),
 * pour les implanter comme une ligne DXF (0.90.1). Chaque ligne : { nom (« L-HT-1 · LV-Stock 1 »),
 * points: [{ est, nord, altitude }], ferme }, dans la forme qu'attend accrocherTrait.
 */
function lignesDesLeves() {
  const montrees = new Set(listesDePoints(projet).filter((l) => l.visible).map((l) => l.id));
  const lignes = [];
  for (const levee of [...projet.surfaces, ...(projet.autres ?? [])]) {
    if (estImportee(levee) || !montrees.has(levee.id)) continue;
    const parNom = new Map(pointsDuLeve(levee.leveId).map((p) => [p.nom, p]));
    const sommets = (noms) => noms.map((nom) => parNom.get(nom)).filter(Boolean).map((p) => ({ est: p.est, nord: p.nord, altitude: p.altitude ?? null }));
    const ajouter = (nom, noms, ferme) => {
      const points = sommets(noms);
      if (points.length < 2) return;
      lignes.push({ nom: `${nom} · ${levee.nom}`, points, ferme: ferme && points.length >= 3 });
    };
    if ((levee.contour ?? []).length >= 3) ajouter('Contour', levee.contour, true);
    (levee.lignesRupture ?? []).forEach((ligne, index) => ajouter(nomDeLigne(ligne, index), ligne.noms, ligne.fermee));
  }
  return lignes;
}

/**
 * Accroche « Croisement » (0.152.0) : toutes les lignes comptent (plans DXF montrés, lignes de rupture
 * et contours des levés montrés, côtés des dessins) ; ajoutées aux sources d'une autre accroche.
 */
function avecToutesLesLignes(mode, sources) {
  if (mode !== 'croisement') return sources;
  const dessins = dessinsVisibles().filter((d) => d.type !== 'points' && d.sommets.length >= 2).map((d) => ({ points: d.sommets, ferme: estFerme(d) && d.sommets.length >= 3 }));
  return { ...sources, lignes: [...(sources.lignes ?? []), ...lignesDesLeves(), ...dessins] };
}

/** Toucher du plan pendant l'implantation d'une ligne : une ligne du DXF, ou un point de plus. */
function toucherPourLigne(position, tolerance) {
  const mm = (p) => ({ ...p, est: Math.round(p.est * 1000) / 1000, nord: Math.round(p.nord * 1000) / 1000, altitude: p.altitude != null ? Math.round(p.altitude * 1000) / 1000 : null });
  if (terrain.accrocheLigne === 'trait') {
    // Un côté d'un dessin (Calculs › Dessin) d'abord : chaque côté est une ligne à lui seul.
    const cote = coteSousLeDoigt(position, tolerance, dessinsVisibles().flatMap((d) => cotesDuDessin(d, projet.dessins)));
    if (cote) {
      implanter.ligne = nouvelleLigneAImplanter(cote.nom, cote.sommets.map(mm), null);
      implanter.ligneAValider = true;
      implanter.talusId = null;
      implanter.pointsLigne = [];
      montrerImplantation();
      return;
    }
    // Puis une ligne de rupture ou un contour d'un levé montré sur le plan (0.90.1).
    const lignesLeves = lignesDesLeves();
    const deLeve = accrocherTrait(position, tolerance, lignesLeves);
    if (deLeve) {
      implanter.ligne = nouvelleLigneAImplanter(deLeve.ligne.nom, deLeve.sommets.map(mm), deLeve.segment);
      implanter.ligneAValider = true;
      implanter.talusId = null;
      implanter.pointsLigne = [];
      montrerImplantation();
      return;
    }
    const trouve = accrocherTrait(position, tolerance, sourcesDesPlans(plansDuProjet(), position, tolerance).lignes);
    if (!trouve) {
      afficherMessage('Aucune ligne (DXF, levé) ni côté de dessin sous le doigt', 3000);
      return;
    }
    const sommets = trouve.sommets.map(mm);
    const nombre = sommets.length - 1;
    implanter.ligne = nouvelleLigneAImplanter(`Ligne DXF (${nombre} segment${nombre > 1 ? 's' : ''})`, sommets, trouve.segment);
    implanter.ligneAValider = true;
    implanter.talusId = null;
    implanter.pointsLigne = [];
  } else {
    const sources = terrain.accrocheLigne === 'point'
      ? { lignes: [], cercles: [], points: pointsDuProjet() }
      : sourcesDesPlans(plansDuProjet(), position, tolerance);
    const trouve = accrocher(terrain.accrocheLigne, position, tolerance, avecToutesLesLignes(terrain.accrocheLigne, sources));
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
  for (const point of [...projet.leves.flatMap((l) => l.points), ...projet.aImplanter, ...projet.pointsControle, ...pointsDesDessins()]) {
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
  // Mesure rapide (0.158.0) : le point touché (selon l'accroche) s'ajoute à la mesure.
  if (mesureRapideActive()) {
    toucherPourMesureRapide(position, tolerance);
    return;
  }
  // Annotation (0.177.0) : en mode Loupe, toucher le plan y pose la loupe.
  if (annotationActive()) {
    // Toucher un nuage = ouvrir la fiche de cette annotation ; sinon, en mode Manuel, la loupe se pose là.
    const proche = annotationSousLeDoigt(position, tolerance);
    if (proche) montrerEncadreAnnotation(proche.nom);
    else {
      fermerEncadreAnnotation();
      if (annotationEtat.mode === 'loupe') plan.loupe.placerSur(position.est, position.nord);
    }
    return;
  }
  // Choix des côtés d'un talus de surface (Calculs › Dessin, 0.135.0).
  if (choixCotesTalusActif()) {
    toucherCoteTalus(position, tolerance);
    return;
  }
  if (choixLignesGuidageActif()) {
    toucherPourLigneGuidage(position, tolerance);
    return;
  }
  if (daoAppli?.actif()) {
    daoAppli.toucher(position, tolerance);
    return;
  }
  if (piloteActif()) {
    toucherPourDessin(position, tolerance);
    return;
  }
  if (enAutocontrole()) {
    toucherPourControle(position, tolerance);
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
  if (ajoutLevee.actif) {
    toucherPourAjout(position, tolerance);
    return;
  }
  if (enImplantationDeLigne()) {
    toucherPourLigne(position, tolerance);
    return;
  }
  // 0.163.0 : pendant l'implantation d'un point, toucher un autre point ne change rien : on passe par « ← ».
  if (terrain.mode === 'controler' && terrain.implantation === 'point' && implanter.cible) {
    afficherMessage('Implantation en cours : touche ← (en haut à gauche du guidage) pour changer de point', 2500);
    return;
  }
  // 0.214.0 : « Centre pts » : 2 points = le milieu, 3 points = le centre du cercle ; le centre devient le point choisi (fiche + « Implanter »).
  if (terrain.accroche === 'centrepts' && aAcces('intermediaire')) {
    const centre = toucherCentrePoints(position, tolerance);
    if (centre && centre !== 'attente') guiderVersChoix({ nom: '', ...centre });
    montrerImplantation();
    return;
  }
  // « Manuel » : toucher le plan y pose la loupe (le point visé devient la cible).
  if (terrain.accroche === 'manuel') {
    if (aAcces('intermediaire')) plan.loupe.placerSur(position.est, position.nord);
    return;
  }
  const sources = terrain.accroche === 'point'
    ? { lignes: [], cercles: [], points: pointsDuProjet() }
    : sourcesDesPlans(plansDuProjet(), position, tolerance);
  const trouve = accrocher(terrain.accroche, position, tolerance, avecToutesLesLignes(terrain.accroche, sources));
  if (!trouve) {
    const quoi = { point: 'aucun point du projet', sommet: 'aucun sommet', milieu: 'aucune ligne', ligne: 'aucune ligne', croisement: 'aucun croisement de lignes', centre: 'aucun cercle' }[terrain.accroche];
    afficherMessage(`${quoi[0].toUpperCase()}${quoi.slice(1)} sous le doigt`, 3000);
    return;
  }
  const mm = (valeur) => Math.round(valeur * 1000) / 1000;
  guiderVersChoix({ ...trouve, est: mm(trouve.est), nord: mm(trouve.nord), altitude: trouve.altitude != null ? mm(trouve.altitude) : null });
  montrerImplantation();
}

/**
 * Point choisi (touché sur le plan, pris dans la « Liste » ou tapé) : 0.137.0 (demande du 05.11) : il est
 * montré dans une fiche (nom, altitude) avec le bouton « Implanter » ; le guidage commence seulement
 * après ce bouton (implanterChoix), et le plan reste où il est pour voir ce qu'on a touché.
 */
function guiderVersChoix(choix) {
  implanter.choix = choix;
  implanter.cible = null;
}

// --- Recalage d'un plan DXF (Projet › Imports › Recaler ; calculs dans topo/recalage.js) ---
// recalage : { planId (plan en cours de recalage, ou null), accroche (sur le DXF à recaler), choix
// ({ x, y } : point touché sur le DXF d'origine), accrocheCale (position calée : 'point' = point levé
// ou de contrôle, sinon accroche d'un autre DXF), taper (Est / Nord tapés ouverts), paires (points de
// calage { x, y, est, nord, nom, actif }) }. candidat (0.104.0) : le point touché sur le plan, montré par une
// croix, pas encore validé ({ sorte: 'dxf' ou 'cale', x, y, nom }) ; « Valider » le prend en compte. Pendant le recalage, ce plan est montré tel qu'il a été lu.
// Étapes écrites (0.92.0) : voir recalage/barre.js.
const recalage = { planId: null, accroche: 'sommet', choix: null, candidat: null, accrocheCale: 'point', taper: false, paires: [], zoomLoupe: 4, etapeLoupe: null, methode: 'points', axes: null };

// Calage par axes (0.152.0, Expert) : lignes du plan à caler et lignes calées ({ a, b } : points
// { x, y } du plan / { est, nord } MN95), échelle, 180°, façon (« ligne » touchée ou « points »).
function axesVides() {
  return { lignesPlan: [], lignesCalees: [], echelle: 1, tourne: false, facon: 'ligne', premier: null, miseEchelle: null };
}

/** Plan PDF : 'image' (scanné), 'traits' (vectoriel), sinon null (DXF). */
const sortePdf = (plan) => (plan?.pdf ? (plan.pdf.image ? 'image' : 'traits') : null);
let barreRecalage = null;

/** Plans DXF du projet tels qu'on les utilise : recalés (sauf celui qu'on est en train de recaler). */
function plansDuProjet() {
  return (projet.plansDxf ?? []).map((p) => (p.id === recalage.planId ? p : planRecale(p)));
}

function commencerRecalage(id) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi) return;
  if (pointage.actif) arreterPointage();
  if (surfaceSwisstopo.actif()) surfaceSwisstopo.arreter();
  if (cadastreAutour.actif()) cadastreAutour.arreter();
  recalage.planId = id;
  recalage.choix = null;
  recalage.candidat = null;
  recalage.paires = (choisi.recalage?.paires ?? []).map((p) => ({ ...p }));
  recalage.methode = choisi.recalage?.axes && aAcces('expert') ? 'axes' : 'points';
  recalage.axes = axesVides();
  // Accroche « Manuel » (0.130.0) : seulement pour un plan PDF ; d'office pour un PDF scanné.
  recalage.etapeLoupe = null;
  if (sortePdf(choisi) === 'image') recalage.accroche = 'manuel';
  else if (!sortePdf(choisi) && recalage.accroche === 'manuel') recalage.accroche = 'sommet';
  barreRecalage ??= creerBarreRecalage(document.querySelector('#plan .plan-cadre'), {
    choisirAccroche: (mode) => {
      recalage.accroche = mode;
      recalage.candidat = null;
      recalage.etapeLoupe = null;
      montrerRecalage();
    },
    // Réglage fin de la loupe : un pixel de la loupe par toucher.
    deplacerLoupe: (sens) => {
      const [dx, dy] = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] }[sens] ?? [0, 0];
      plan.loupe.deplacerDe(dx, dy);
    },
    zoomLoupe: (zoom) => {
      recalage.zoomLoupe = Number(zoom) || 4;
      plan.loupe.changerZoom(recalage.zoomLoupe);
      montrerRecalage();
    },
    choisirAccrocheCale: (mode) => {
      recalage.accrocheCale = mode;
      montrerRecalage();
    },
    basculerTaper: () => {
      recalage.taper = !recalage.taper;
      montrerRecalage();
    },
    // « en toucher un autre » : retour à l'étape du point sur le DXF à recaler.
    oublierChoix: () => {
      const loin = recalage.choix && loinDuProjet(recalage.choix.x, recalage.choix.y);
      recalage.choix = null;
      recalage.candidat = null;
      montrerRecalage();
      const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
      if (loin && choisi) plan.cadrerSurPlans([choisi]);
    },
    ajouterPaire: ({ est, nord }) => {
      const e = lireNombreTape(String(est).replace(/\s/g, ''));
      const n = lireNombreTape(String(nord).replace(/\s/g, ''));
      if (e == null || n == null) {
        afficherMessage('Est et Nord : écris deux nombres', 4000);
        return;
      }
      ajouterPaireCalage({ est: e, nord: n, nom: `E ${formaterNombre(e)} / N ${formaterNombre(n)}` });
    },
    prendreAuRx2: () => {
      // Même règle qu'un point levé : RTK fixe et inclinaison prête.
      const reponse = prendrePointRecepteur();
      if (!reponse.ok) {
        refuser(`Point refusé : ${reponse.raison}`);
        return;
      }
      ajouterPaireCalage({ est: reponse.point.est, nord: reponse.point.nord, nom: `GNSS ${new Date().toLocaleTimeString('fr-CH')}` });
    },
    basculerPaire: (index, actif) => {
      recalage.paires[index].actif = actif;
      montrerRecalage();
    },
    enleverPaire: (index) => {
      recalage.paires.splice(index, 1);
      montrerRecalage();
    },
    validerCandidat: validerCandidatRecalage,
    appliquer: appliquerRecalage,
    // --- Calage par axes (0.152.0, Expert) ---
    choisirMethode: (methode) => {
      recalage.methode = methode === 'axes' && aAcces('expert') ? 'axes' : 'points';
      recalage.candidat = null;
      montrerRecalage();
    },
    choisirFaconAxes: (facon) => {
      recalage.axes.facon = facon === 'points' ? 'points' : 'ligne';
      recalage.axes.premier = null;
      montrerRecalage();
    },
    commencerEchelle: () => {
      recalage.axes.miseEchelle = { points: [] };
      montrerRecalage();
    },
    annulerEchelle: () => {
      recalage.axes.miseEchelle = null;
      montrerRecalage();
    },
    echelleUn: () => {
      recalage.axes.echelle = 1;
      montrerRecalage();
    },
    tournerAxes: () => {
      recalage.axes.tourne = !recalage.axes.tourne;
      montrerRecalage();
    },
    effacerLigneAxes: () => {
      const { lignesPlan, lignesCalees } = recalage.axes;
      recalage.axes.premier = null;
      if (lignesPlan.length > lignesCalees.length) lignesPlan.pop();
      else lignesCalees.pop();
      montrerRecalage();
    },
    appliquerAxes: appliquerCalageAxes,
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
  recalage.candidat = null;
  recalage.taper = false;
  recalage.etapeLoupe = null;
  plan.loupe.cacher();
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
    pdf: sortePdf(choisi),
    zoomLoupe: recalage.zoomLoupe,
    accroche: recalage.accroche,
    accrocheCale: recalage.accrocheCale,
    choix: recalage.choix,
    candidat: recalage.candidat,
    taper: recalage.taper,
    rx2: recepteurDisponible(),
    paires: recalage.paires,
    methode: recalage.methode,
    axes: recalage.axes,
  });
  // Après la barre : la loupe se place au-dessus d'elle (sa hauteur est alors connue).
  montrerLoupe();
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/**
 * Loupe de l'accroche « Manuel » (0.130.0) : visible aux étapes impaires (point sur le plan PDF à
 * recaler) ; au milieu du plan au début de chaque étape ; doigt levé = point touché (croix, « Valider »).
 */
function montrerLoupe() {
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  if (!choisi || !sortePdf(choisi) || recalage.accroche !== 'manuel' || recalage.choix || recalage.methode === 'axes') {
    plan.loupe.cacher();
    recalage.etapeLoupe = null;
    return;
  }
  const etape = recalage.paires.length;
  plan.loupe.montrer({
    recentrer: recalage.etapeLoupe !== etape,
    zoom: recalage.zoomLoupe,
    quandLache: ({ est, nord }) => proposerCandidat({ sorte: 'dxf', x: est, y: nord, nom: 'Manuel' }),
  });
  recalage.etapeLoupe = etape;
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
  // Dessins (Calculs › Dessin) : une liste par dessin, en violet.
  for (const dessin of projet.dessins) {
    if (dessin.sommets.length > 0) groupes.push({ titre: dessin.nom, noms: pointsDuDessin(dessin, projet.dessins).map((p) => p.nom), classe: 'groupe-points-dessin' });
  }
  return groupes;
}

/**
 * Toucher le plan pendant le recalage (0.92.0) : étape impaire, on accroche un point du DXF à recaler
 * (tel qu'il a été lu) ; étape paire, sa position calée : un point du projet (levé, contrôle…) avec
 * l'accroche « Point », sinon une accroche sur un autre plan DXF (déjà en MN95).
 */
function toucherPourRecalage(position, tolerance) {
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  if (recalage.methode === 'axes') {
    toucherPourAxes(choisi, position, tolerance);
    return;
  }
  if (!recalage.choix) {
    // « Point » (0.116.0) : un point levé ou de contrôle sert de 1er point (ses coordonnées telles quelles).
    if (recalage.accroche === 'point') {
      const point = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsDuProjet() });
      if (!point) {
        afficherMessage('Aucun point (levé ou de contrôle) sous le doigt', 3000);
        return;
      }
      proposerCandidat({ sorte: 'dxf', x: point.est, y: point.nord, nom: point.nom });
      return;
    }
    // « Manuel » : toucher le plan y pose la loupe (le point se règle ensuite avec la main).
    if (recalage.accroche === 'manuel') {
      plan.loupe.placerSur(position.est, position.nord);
      return;
    }
    const trouve = accrocher(recalage.accroche, position, tolerance, sourcesDesPlans([choisi], position, tolerance));
    if (!trouve) {
      afficherMessage('Rien à accrocher sous le doigt sur le DXF à recaler', 3000);
      return;
    }
    proposerCandidat({ sorte: 'dxf', x: trouve.est, y: trouve.nord });
    return;
  }
  if (recalage.accrocheCale === 'point') {
    const point = accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsDuProjet() });
    if (!point) {
      afficherMessage('Aucun point (levé ou de contrôle) sous le doigt', 3000);
      return;
    }
    proposerCandidat({ sorte: 'cale', x: point.est, y: point.nord, nom: point.nom });
    return;
  }
  // Accroche sur un autre DXF (pas celui qu'on recale : il n'est pas encore en MN95).
  const autres = plansDuProjet().filter((p) => p.id !== recalage.planId && p.visible !== false);
  const trouve = accrocher(recalage.accrocheCale, position, tolerance, avecToutesLesLignes(recalage.accrocheCale, sourcesDesPlans(autres, position, tolerance)));
  if (!trouve) {
    afficherMessage(autres.length > 0 ? 'Rien à accrocher sous le doigt sur un autre DXF' : 'Aucun autre plan DXF dans le projet', 3000);
    return;
  }
  proposerCandidat({ sorte: 'cale', x: trouve.est, y: trouve.nord, nom: `DXF E ${formaterNombre(trouve.est)} / N ${formaterNombre(trouve.nord)}` });
}

/** Point touché pendant le recalage : une croix le montre, la barre propose « Valider » (0.104.0). */
function proposerCandidat(candidat) {
  recalage.candidat = candidat;
  montrerRecalage();
}

/** « Valider » : le point touché (croix) est pris en compte, l'étape suivante commence. */
function validerCandidatRecalage() {
  const candidat = recalage.candidat;
  if (!candidat) return;
  recalage.candidat = null;
  if (candidat.sorte === 'dxf') {
    recalage.choix = { x: candidat.x, y: candidat.y };
    sonValidation();
    montrerRecalage();
    cadrerPourPositionCalee();
  } else {
    ajouterPaireCalage({ est: candidat.x, nord: candidat.y, nom: candidat.nom });
  }
}

/**
 * Ajoute un point de calage : le point touché sur le DXF à recaler et sa position calée MN95
 * ({ est, nord, nom }). L'étape suivante commence.
 */
function ajouterPaireCalage({ est, nord, nom }) {
  if (!recalage.choix) return;
  recalage.paires.push({ x: recalage.choix.x, y: recalage.choix.y, est, nord, nom, actif: true });
  recalage.choix = null;
  recalage.candidat = null;
  recalage.taper = false;
  sonValidation();
  vibrer(60);
  montrerRecalage();
  // Retour sur le DXF à recaler pour le point suivant, s'il est loin des points du projet.
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  if (choisi && loinDuProjet(recalage.paires.at(-1).x, recalage.paires.at(-1).y)) plan.cadrerSurPlans([choisi]);
}

/**
 * Vrai si ce point du DXF à recaler (x, y) est à plus de 2 km de tous les points du projet : le DXF
 * n'est pas encore en MN95 et il faut déplacer la vue entre lui et les points du projet.
 */
function loinDuProjet(x, y) {
  const points = pointsDuProjet();
  if (points.length === 0) return false;
  return points.every((p) => Math.hypot(p.est - x, p.nord - y) > 2000);
}

/** Étape « position calée » : si le DXF est loin, la vue va sur les points du projet (et les autres DXF). */
function cadrerPourPositionCalee() {
  if (!recalage.choix || !loinDuProjet(recalage.choix.x, recalage.choix.y)) return;
  const points = pointsDuProjet();
  requestAnimationFrame(() => plan.cadrerSur(points, 10));
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

/**
 * Calage par axes (0.152.0, Expert) : un toucher prend une ligne (trait touché, ou 2 points l'un après
 * l'autre) sur le plan à caler ou parmi les lignes déjà calées, selon l'étape (voir etapeAxes) ; ou un
 * point de la mise à l'échelle.
 */
function toucherPourAxes(choisi, position, tolerance) {
  const axes = recalage.axes;
  const etape = etapeAxes(axes);
  const surLePlan = Boolean(axes.miseEchelle) || etape.cote === 'plan';
  if (!axes.miseEchelle && etape.numero === 5) return;
  // Lignes et accroches : sur le plan à caler (tel qu'il a été lu), ou déjà en MN95 (autres plans DXF
  // montrés, levés, dessins, points du projet).
  const autres = () => plansDuProjet().filter((p) => p.id !== recalage.planId && p.visible !== false);
  const accrocherPoint = () => {
    const mode = surLePlan ? recalage.accroche : recalage.accrocheCale;
    if (mode === 'point') return accrocher('point', position, tolerance, { lignes: [], cercles: [], points: pointsDuProjet() });
    if (mode === 'manuel') return { est: position.est, nord: position.nord };
    const sources = surLePlan ? sourcesDesPlans([choisi], position, tolerance) : avecToutesLesLignes('croisement', sourcesDesPlans(autres(), position, tolerance));
    return accrocher(mode, position, tolerance, sources);
  };
  if (axes.miseEchelle) {
    const point = accrocherPoint();
    if (!point) {
      afficherMessage('Rien à accrocher sous le doigt sur le plan à caler', 3000);
      return;
    }
    axes.miseEchelle.points.push({ x: point.est, y: point.nord });
    sonValidation();
    if (axes.miseEchelle.points.length < 2) {
      montrerRecalage();
      return;
    }
    const [p1, p2] = axes.miseEchelle.points;
    const longueur = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    demanderTexte({ titre: 'Distance réelle entre les 2 points (m)', valeur: longueur.toFixed(3) }).then((texte) => {
      const distance = texte == null ? null : lireNombreTape(texte);
      const echelle = distance == null ? null : echelleParDeuxPoints(p1, p2, distance);
      axes.miseEchelle = null;
      if (texte != null && !echelle) afficherMessage('Distance illisible : un nombre de mètres plus grand que 0', 4000);
      if (echelle) {
        axes.echelle = echelle;
        afficherMessage(`Échelle du plan : ${echelle.toFixed(6)}`, 3000);
      }
      montrerRecalage();
    });
    return;
  }
  let ligne = null;
  if (axes.facon === 'points') {
    const point = accrocherPoint();
    if (!point) {
      afficherMessage(surLePlan ? 'Rien à accrocher sous le doigt sur le plan à caler' : 'Rien à accrocher sous le doigt (autre plan, levé, point)', 3000);
      return;
    }
    const p = surLePlan ? { x: point.est, y: point.nord } : { est: point.est, nord: point.nord };
    if (!axes.premier) {
      axes.premier = p;
      sonValidation();
      montrerRecalage();
      return;
    }
    ligne = { a: axes.premier, b: p };
    axes.premier = null;
  } else {
    const lignes = surLePlan
      ? sourcesDesPlans([choisi], position, tolerance).lignes
      : avecToutesLesLignes('croisement', sourcesDesPlans(autres(), position, tolerance)).lignes;
    const trouve = accrocherTrait(position, tolerance, lignes);
    if (!trouve) {
      afficherMessage(surLePlan ? 'Aucun trait sous le doigt sur le plan à caler' : 'Aucune ligne calée sous le doigt (autre plan, levé, dessin)', 3000);
      return;
    }
    const a = trouve.sommets[trouve.segment];
    const b = trouve.sommets[trouve.segment + 1];
    ligne = surLePlan ? { a: { x: a.est, y: a.nord }, b: { x: b.est, y: b.nord } } : { a: { est: a.est, nord: a.nord }, b: { est: b.est, nord: b.nord } };
  }
  (surLePlan ? axes.lignesPlan : axes.lignesCalees).push(ligne);
  sonValidation();
  vibrer(60);
  montrerRecalage();
  // Plan à caler loin de la Suisse (pas encore en MN95) : la vue passe d'un côté à l'autre.
  if (choisi && !estEnMn95(choisi.bornes) && etapeAxes(axes).numero < 5) {
    if (surLePlan) {
      const calees = autres();
      const points = pointsDuProjet();
      requestAnimationFrame(() => (calees.length > 0 ? plan.cadrerSurPlans(calees) : points.length > 0 && plan.cadrerSur(points, 10)));
    } else requestAnimationFrame(() => plan.cadrerSurPlans([choisi]));
  }
}

/** « Appliquer » du calage par axes : mêmes paramètres qu'un recalage par points (Helmert). */
function appliquerCalageAxes() {
  const choisi = projet.plansDxf.find((p) => p.id === recalage.planId);
  const { lignesPlan, lignesCalees, echelle, tourne } = recalage.axes;
  const r = calageParAxes(lignesPlan, lignesCalees, { echelle, tourne });
  if (!choisi || r.erreur) return;
  const { a, b, tEst, tNord, rotation, ecartAngle } = r;
  choisi.recalage = {
    paires: [],
    axes: { lignesPlan, lignesCalees, echelle, tourne, ecartAngle },
    parametres: { a, b, tEst, tNord, echelle, rotation },
    applique: true,
    le: new Date().toISOString(),
  };
  arreterRecalage();
  modifie();
  afficherMessage(`Plan « ${choisi.nom} » calé par axes`, 3000);
  requestAnimationFrame(() => plan.cadrerSurPlans([planRecale(choisi)]));
}

/**
 * Annule le recalage (0.104.0) : le plan revient à sa position d'origine (tel qu'il a été lu) et les
 * points de calage et les paramètres calculés sont effacés. Marche en cours de recalage comme après.
 */
function annulerRecalage(id) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi) return;
  const enCours = recalage.planId === id;
  const quelqueChose = Boolean(choisi.recalage) || (enCours && (recalage.paires.length > 0 || recalage.choix || recalage.candidat));
  if (quelqueChose && !confirm(`Annuler le recalage de « ${choisi.nom} » ? Le plan revient à sa position d'origine et les points de calage sont effacés.`)) return;
  delete choisi.recalage;
  if (enCours) arreterRecalage();
  else recalculer();
  modifie();
}

// --- Surface Swisstopo (0.109.0, Projet › Import, Expert) : voir import/zone-swisstopo.js ---
const surfaceSwisstopo = creerSurfaceSwisstopo({
  get plan() {
    return plan;
  },
  get cadre() {
    return document.querySelector('#plan .plan-cadre');
  },
  afficherMessage,
  allerAuPlan: () => {
    if (estTelephone()) afficherOnglet('plan');
  },
  avantDeCommencer: () => {
    if (pointage.actif) arreterPointage();
  },
  nomsPris: () => projet.surfaces.map((s) => s.nom),
  ajouterSurface: (surface) => {
    projet.surfaces.push(surface);
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    editeurSurfaces.choisir(projet.surfaces.length - 1);
    modifie({ recadrer: true });
  },
});

// --- Cadastre autour d'un point (0.112.0, Projet › Import, Expert) : voir import/zone-cadastre.js ---
const cadastreAutour = creerCadastreAutour({
  get plan() {
    return plan;
  },
  get cadre() {
    return document.querySelector('#plan .plan-cadre');
  },
  afficherMessage,
  allerAuPlan: () => {
    if (estTelephone()) afficherOnglet('plan');
  },
  avantDeCommencer: () => {
    if (pointage.actif) arreterPointage();
  },
  nomsPris: () => [...projet.leves.map((l) => l.nom), ...projet.plansDxf.map((p) => p.nom)],
  // Dans l'APK, les demandes passent par Android (pas de blocage CORS du service RDPPF de Vaud).
  // Site internet (0.116.0) : le service de Vaud passe par le relais du cadastre (import/relais.js).
  chercher: (adresse) => (lectureAndroidDisponible() ? lireParAndroid(adresse) : fetch(adresseParRelais(adresse))),
  ajouterCadastre: ({ nom, points, planDxf }) => {
    const leve = ajouterLeve(projet, nom, points);
    // 0.113 : liste marquée « cadastre », cachée au départ (seules les lignes du DXF se voient).
    leve.cadastre = true;
    projet.listesCachees = [...new Set([...(projet.listesCachees ?? []), leve.id])];
    // 0.116.3 : lignes du cadastre en violet au départ (modifiable dans la liste des plans DXF).
    // 0.116.4 : le plan est relié à sa liste (`cadastre`) : rangés ensemble, une seule couleur.
    if (planDxf) projet.plansDxf.push({ id: nouvelIdentifiant(), importeLe: new Date().toISOString(), ...planDxf, couleur: COULEUR_CADASTRE, cadastre: leve.id });
    modifie({ recadrer: true });
  },
});

// --- Points ajoutés en touchant le plan DXF (Projet › Imports › Point › Pointer sur le plan DXF) ---
// pointage : { actif, accroche ('sommet', 'milieu', 'ligne', 'centre'), choix (point touché, à
// contrôler et valider : { est, nord, altitude }) }. Le plan ne bouge pas : une croix montre le
// point, on vérifie, on donne son nom, puis « Valider ».
const pointage = { actif: false, accroche: 'sommet', choix: null };
const ACCROCHES_POINTAGE = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['croisement', 'Croisement'], ['centre', 'Centre']];

/** Début du pointage : une barre sur le plan (accroche, Terminé) ; sur téléphone, on va au plan. */
function commencerPointage() {
  if (ajoutLevee.actif) arreterAjout();
  if (surfaceSwisstopo.actif()) surfaceSwisstopo.arreter();
  if (cadastreAutour.actif()) cadastreAutour.arreter();
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
  const trouve = accrocher(pointage.accroche, position, tolerance, avecToutesLesLignes(pointage.accroche, sourcesDesPlans(plansDuProjet(), position, tolerance)));
  if (!trouve) {
    const quoi = { sommet: 'Aucun sommet', milieu: 'Aucune ligne', ligne: 'Aucune ligne', croisement: 'Aucun croisement de lignes', centre: 'Aucun cercle' }[pointage.accroche];
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
  const { point, erreur } = ajouterPointAjoute(projet, { ...pointage.choix, nom, altitude, source: 'dxf', appareil: nomDeLAppareil() });
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

// --- Édition Lever sur le site (0.120.0) : ajouter un point ou une ligne en touchant le plan ---
// ajoutLevee : { actif, accroche ('point', 'sommet', 'milieu', 'ligne', 'centre'), choix (point touché, à
// contrôler et valider : { est, nord, altitude }) }. Même principe que le pointage ci-dessus, mais le
// point entre dans le levé en cours avec le rôle choisi dans Lever (point isolé, ligne, contour ; métré).
// Pour une ligne ou un contour : chaque « Valider » ajoute un point à la suite.
const ACCROCHES_AJOUT = [['point', 'Point'], ...ACCROCHES_POINTAGE];
const TITRES_ROLE_AJOUT = { isole: 'Point isolé', ligne: 'Ligne', contour: 'Contour' };

/** Nom proposé pour le prochain point ajouté (le même que pour un point pris au récepteur). */
function nomProposeAjout() {
  const stock = stockEnCours();
  if (stock) return prochainNom(projet, stock, leveDirect.role, libelleDuRole());
  return '';
}

function commencerAjout() {
  if (refuserEnLectureSeule()) return;
  if (!leveEnCours() || !stockEnCours()) {
    afficherMessage('Choisis d\'abord un levé', 4000);
    return;
  }
  if (pointage.actif) arreterPointage();
  if (surfaceSwisstopo.actif()) surfaceSwisstopo.arreter();
  if (cadastreAutour.actif()) cadastreAutour.arreter();
  ajoutLevee.actif = true;
  ajoutLevee.choix = null;
  dessinerBarreAjout();
  if (estTelephone()) afficherOnglet('plan');
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
  recalculer();
}

function arreterAjout() {
  if (!ajoutLevee.actif) return;
  ajoutLevee.actif = false;
  ajoutLevee.choix = null;
  document.querySelector('.barre-ajout')?.remove();
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
  recalculer();
}

/** Barre posée en bas du plan : accroche, puis le point touché (nom, H, Valider). */
function dessinerBarreAjout() {
  let barre = document.querySelector('.barre-ajout');
  if (!barre) {
    barre = document.createElement('div');
    barre.className = 'barre-pointage barre-ajout';
    barre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-action]');
      if (!bouton) return;
      const action = bouton.dataset.action;
      if (action === 'accroche-ajout') {
        ajoutLevee.accroche = bouton.dataset.valeur;
        dessinerBarreAjout();
      } else if (action === 'valider-ajout') validerAjout();
      else if (action === 'oublier-ajout') {
        ajoutLevee.choix = null;
        dessinerBarreAjout();
        envoyerImplantationAuPlan();
        plan.rafraichirImplantation();
      } else if (action === 'fin-ajout') arreterAjout();
    });
    barre.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') validerAjout();
    });
    document.querySelector('#plan .plan-cadre').append(barre);
  }
  const c = ajoutLevee.choix;
  const role = TITRES_ROLE_AJOUT[leveDirect.role] ?? 'Point';
  barre.innerHTML = `<div class="ligne-barre-pointage">
      <strong class="titre-ajout">Ajout : ${echapper(role)}</strong>
      ${ACCROCHES_AJOUT.map(([cle, titre]) => `<button type="button" class="puce-choix ${ajoutLevee.accroche === cle ? 'actif' : ''}" data-action="accroche-ajout" data-valeur="${cle}">${titre}</button>`).join('')}
      <button type="button" class="bouton" data-action="fin-ajout">Terminé</button>
    </div>
    ${c ? `<div class="choix-pointage">
      <span class="coordonnees-pointage">E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}</span>
      <label>Nom<input type="text" data-pointage="nom" value="${echapper(nomProposeAjout())}" autocomplete="off" autocapitalize="characters" /></label>
      <label>H<input type="text" inputmode="decimal" data-pointage="altitude" value="${c.altitude != null ? c.altitude.toFixed(3) : ''}" placeholder="altitude" /></label>
      <button type="button" class="bouton" data-action="valider-ajout">Valider</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="oublier-ajout">annuler</button>
    </div>` : `<p class="aide-pointage">Touche le plan (accroche : ${echapper(ACCROCHES_AJOUT.find(([cle]) => cle === ajoutLevee.accroche)?.[1] ?? '')})</p>`}`;
}

/** Toucher du plan pendant l'ajout : le point accroché est montré (croix), à valider. */
function toucherPourAjout(position, tolerance) {
  const sources = ajoutLevee.accroche === 'point'
    ? { lignes: [], cercles: [], points: pointsDuProjet() }
    : sourcesDesPlans(plansDuProjet(), position, tolerance);
  const trouve = accrocher(ajoutLevee.accroche, position, tolerance, avecToutesLesLignes(ajoutLevee.accroche, sources));
  if (!trouve) {
    const quoi = { point: 'Aucun point du projet', sommet: 'Aucun sommet', milieu: 'Aucune ligne', ligne: 'Aucune ligne', croisement: 'Aucun croisement de lignes', centre: 'Aucun cercle' }[ajoutLevee.accroche];
    afficherMessage(`${quoi} sous le doigt`, 3000);
    return;
  }
  const mm = (valeur) => Math.round(valeur * 1000) / 1000;
  ajoutLevee.choix = { est: mm(trouve.est), nord: mm(trouve.nord), altitude: trouve.altitude != null ? mm(trouve.altitude) : null };
  dessinerBarreAjout();
  envoyerImplantationAuPlan();
  plan.rafraichirImplantation();
}

/**
 * « Valider » : le point montré entre dans le levé en cours (rôle choisi dans Lever), après les mêmes
 * contrôles qu'un point pris au récepteur (hors contour, croisement de lignes). Sans altitude, seul
 * le levé libre l'accepte : les autres levés servent à des surfaces et des volumes.
 */
async function validerAjout() {
  if (!ajoutLevee.choix || refuserEnLectureSeule()) return;
  const barre = document.querySelector('.barre-ajout');
  const nomTape = barre.querySelector('[data-pointage="nom"]').value.trim();
  const altitude = lireNombreTape(barre.querySelector('[data-pointage="altitude"]').value);
  if (altitude === undefined) {
    afficherMessage('Altitude illisible : écris un nombre en mètres', 4000);
    return;
  }
  const leve = leveEnCours();
  const stock = stockEnCours();
  if (!leve || !stock) return;
  if (altitude === null && stock.nature !== 'autres') {
    afficherMessage('Altitude manquante : tape-la dans « H » (seul le levé libre accepte un point sans altitude)', 5000);
    return;
  }
  const point = { est: ajoutLevee.choix.est, nord: ajoutLevee.choix.nord, altitude, source: 'accroche', creeLe: new Date().toISOString(), creePar: nomDeLAppareil() };
  const role = await controlerPlacePoint(stock, leveDirect.role, point);
  if (!role) return;
  const nomVoulu = role === leveDirect.role ? nomTape : '';
  const libelle = role === leveDirect.role ? libelleDuRole() : libelleDesPoints();
  const resultat = ajouterPointDirect(leve, stock, role, { ...point, nom: nomVoulu || prochainNom(projet, stock, role, libelle) }, nomsDuProjet(projet));
  if (resultat.erreur) {
    refuser(`Point refusé : ${resultat.erreur}`);
    return;
  }
  ajoutLevee.choix = null;
  // Photos prises juste avant : rattachées à ce point, comme pour un point pris au récepteur.
  const enAttente = (leveeEnCours()?.photos ?? []).filter((photo) => photo.attentePoint);
  for (const photo of enAttente) {
    photo.point = resultat.point.nom;
    delete photo.attentePoint;
  }
  vibrer(40);
  sonValidation();
  afficherMessage(`Point ${resultat.point.nom} ajouté${enAttente.length > 0 ? ` · ${enAttente.length} photo(s) rattachée(s)` : ''}`, 2500);
  dessinerBarreAjout();
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
  const lever = dansTerrain && terrain.mode === 'lever' && Boolean(stockEnCours());
  const implanterAvecTouche = dansTerrain && ((enImplantationDePoint() && Boolean(implanter.cible)) || (enImplantationDeLigne() && Boolean(implanter.ligne)) || (enAutocontrole() && Boolean(autocontrole.cible)));
  // 0.171.0 : Mesure rapide avec l'accroche GNSS : la touche prend le point (bouton « Enreg. (Vol −) » de la bande).
  const mesureGnss = () => ongletContexte === 'mesure-rapide' && recepteurDisponible() && mesureRapideEtat.accroche === 'gnss';
  const actif = lever || implanterAvecTouche || mesureGnss();
  if (actif === toucheVolumeActive) return;
  toucheVolumeActive = actif;
  regleToucheVolume(actif, () => {
    if (mesureGnss()) {
      agirMesureRapide('mesure-gnss');
      return;
    }
    if (refuserEnLectureSeule()) return;
    const enImplantation = enImplantationDePoint() || enImplantationDeLigne() || enAutocontrole();
    const refus = enImplantation ? ecranLeve.enregistrerDepuisTouche() : ecranLeve.prendreDepuisTouche();
    if (refus) {
      refuser(`${enAutocontrole() ? 'Contrôle refusé' : enImplantation ? 'Implantation refusée' : 'Point refusé'} : ${refus}`);
    }
  });
}

/** Rôles permis pour lever : en Base, des points isolés seulement (contour et lignes dès Intermédiaire). */
function rolesDuMode(stock) {
  return estModeBase() ? ['isole'] : rolesPermis(stock);
}

/** Vrai quand toucher un point du plan l'ajoute à la ligne ou au contour en cours (Terrain › Lever, Intermédiaire et Expert). */
function toucherPourLever() {
  return Boolean(ecranLeve) && !ajoutLevee.actif && ongletContexte === 'terrain' && terrain.mode === 'lever' && aAcces('intermediaire')
    && Boolean(stockEnCours()) && ['ligne', 'contour'].includes(leveDirect.role) && !editeurSurfaces.enSuppression();
}

/**
 * Journal NMEA (0.82.0) : on note la hauteur de canne réglée dans Emlid Flow (pour le nom du
 * fichier), l'APK enregistre tout ce que le RX2 envoie pendant 1 minute, puis la fenêtre
 * « Exporter » propose d'enregistrer ou d'envoyer le fichier texte.
 */
async function enregistrerJournalNmea() {
  if (!etatRecepteur?.connecte) {
    afficherMessage('Connecte d\'abord le récepteur', 3000);
    return;
  }
  const hauteur = await demanderTexte({ titre: 'Hauteur de canne dans Emlid Flow (m)', valeur: '' });
  if (hauteur === null) return;
  const duree = 60;
  demarrerJournalNmea(duree);
  const fin = Date.now() + duree * 1000;
  const minuterie = setInterval(() => {
    const reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
    afficherMessage(`Journal NMEA : enregistrement… ${reste} s (ne coupe pas le récepteur)`, null);
  }, 1000);
  setTimeout(() => {
    clearInterval(minuterie);
    const texte = lireJournalNmea();
    if (!texte.trim()) {
      afficherMessage('Journal NMEA : rien reçu du récepteur', 5000);
      return;
    }
    // Sortes de phrases reçues (0.119.0) : pour savoir si le récepteur envoie sa batterie.
    const sortes = sortesDePhrases(texte).map(({ sorte, nombre }) => `${sorte} ×${nombre}`).join(', ');
    const batterie = lignesBatterie(texte);
    afficherMessage(`Journal NMEA : ${texte.trim().split(/\r?\n/).length} lignes. Reçu : ${sortes || 'rien de lisible'}. Batterie : ${batterie.length > 0 ? batterie.join(' | ') : 'rien trouvé'}`, 20000);
    const date = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const canne = hauteur.trim() ? `_canne-${hauteur.trim().replace(/[^\d.,]/g, '').replace(',', '.')}m` : '';
    telecharger(new Blob([texte], { type: 'text/plain;charset=utf-8' }), `journal-nmea_${date}${canne}.txt`);
  }, duree * 1000 + 1500);
}

/** Point, implantation ou contrôle refusé (0.90.0) : vibration, son grave et message. */
function refuser(texte) {
  vibrer([80, 80, 80]);
  sonRefus();
  afficherMessage(texte, 4000);
}

/** Point rangé dans le levé (ou refusé) : vibration, son et message, puis enregistrement. */
/**
 * Point du Levé chantier (0.175.0) : le libellé (abréviation) donne le nom (P-CH-1, L-T-1-3), l'altitude gardée est
 * le fil d'eau ou le radier quand on le connaît (l'altitude levée reste dans point.chantier.altitudeLevee).
 * Ouvrage en 3 coins : les 3 points sont des points isolés ; au 3e, le cadre (taille, direction) est calculé et gardé.
 */
function prendrePointChantier(leve, stock, nomVoulu, point, attributs) {
  const alt = altitudesDuPoint(point.altitude, attributs);
  const rect = attributs.forme === 'rect';
  const role = rect ? 'isole' : leveDirect.role;
  const finir = (roleFinal) => {
    const nom = (roleFinal === role && nomVoulu.trim()) || prochainNom(projet, stock, roleFinal, attributs.libelle);
    const resultat = ajouterPointDirect(leve, stock, roleFinal, {
      ...point, nom, altitude: alt.altitude, chantier: { ...attributs, altitudeLevee: alt.altitudeLevee, filEau: alt.filEau, radier: alt.radier },
    }, nomsDuProjet(projet));
    if (resultat.erreur) return rangerPointPris(resultat);
    if (rect) {
      stock.cadres ??= [];
      let cadre = stock.cadres.find((c) => c.noms.length < 3 && c.libelle === attributs.libelle);
      if (!cadre) stock.cadres.push((cadre = { id: nouvelIdentifiant(), libelle: attributs.libelle, nature: attributs.nature, noms: [] }));
      cadre.noms.push(nom);
      resultat.point.chantier.cadre = cadre.id;
      if (cadre.noms.length === 3) {
        try {
          const c = cadreDeTroisCoins(cadre.noms.map((n) => leve.points.find((p) => p.nom === n)));
          Object.assign(cadre, { coins: c.coins, centre: c.centre, longueur: c.longueur, largeur: c.largeur, direction: c.direction, tampon: c.tampon, ecartAngleDroit: c.ecartAngleDroit });
          if (c.ecartAngleDroit > 3) afficherMessage(`Cadre fini, mais l'angle droit s'écarte de ${c.ecartAngleDroit.toFixed(1)}° : vérifie les coins`, 5000);
        } catch (erreur) {
          afficherMessage(`Cadre impossible : ${erreur.message}`, 5000);
        }
      }
    }
    rangerPointPris(resultat);
  };
  controlerPlacePoint(stock, role, point).then((roleFinal) => {
    if (roleFinal) finir(roleFinal);
  });
}

function rangerPointPris(resultat) {
  if (resultat.erreur) {
    refuser(`Point refusé : ${resultat.erreur}`);
    return;
  }
  vibrer(60);
  sonValidation();
  // Photos prises juste avant (0.96.0) : rattachées à ce point.
  const levee = leveeEnCours();
  const enAttente = (levee?.photos ?? []).filter((photo) => photo.attentePoint);
  for (const photo of enAttente) {
    photo.point = resultat.point.nom;
    delete photo.attentePoint;
  }
  noterJournal({ type: 'point', controleRecent: controleRecentIci() });
  afficherMessage(`Point ${resultat.point.nom} pris${enAttente.length > 0 ? ` · ${enAttente.length} photo(s) rattachée(s)` : ''}`);
  modifie();
}

/**
 * Photos rattachées à un point (0.96.0) des levés montrés sur le plan : [{ id, nom (du point),
 * est, nord }] (un 📷 près du point ; le toucher ouvre la photo, voir montrerPhoto).
 */
function photosDuPlan(listes) {
  const montrees = new Set(listes.filter((l) => l.visible).map((l) => l.id));
  const resultat = [];
  for (const levee of [...projet.surfaces, ...projet.autres]) {
    if (!montrees.has(levee.id)) continue;
    const parNom = new Map(pointsDuLeve(levee.leveId).map((p) => [p.nom, p]));
    for (const photo of levee.photos ?? []) {
      const point = photo.point ? parNom.get(photo.point) : null;
      if (point) resultat.push({ id: photo.id, nom: point.nom, est: point.est, nord: point.nord });
    }
  }
  // Photos des points de contrôle : avec la liste « Contrôle ».
  if (montrees.has(LISTE_CONTROLE)) {
    for (const photo of projet.photosControle ?? []) {
      const point = projet.pointsControle.find((p) => p.id === photo.pointId);
      if (point) resultat.push({ id: photo.id, nom: point.nom, est: point.est, nord: point.nord });
    }
  }
  return resultat;
}

/** Ouvre une photo en grand (📷 touché sur le plan) : image, point et légende. */
function montrerPhoto(id) {
  const deControle = (projet.photosControle ?? []).some((p) => p.id === id);
  const photo = [...projet.surfaces, ...projet.autres].flatMap((l) => l.photos ?? []).concat(projet.photosControle ?? []).find((p) => p.id === id);
  if (!photo) return;
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-photo';
  fenetre.innerHTML = `<form method="dialog">
      <h2>📷 ${echapper(photo.point ?? 'Photo du levé')}</h2>
      <img src="${photo.image}" alt="${echapper(photo.legende || photo.point || 'photo')}" />
      ${photo.legende ? `<p>${echapper(photo.legende)}</p>` : ''}
      <div class="ligne-outils"><button class="bouton">Fermer</button><button type="button" class="bouton-secondaire seulement-intermediaire" data-cle="dessiner">✎ Dessiner</button>${deControle ? '<button type="button" class="bouton-lien" data-cle="supprimer">supprimer la photo</button>' : ''}</div>
    </form>`;
  // Dessins (0.124.0, Intermédiaire) : cercle, flèche, trait ; la photo d'origine reste intacte.
  if (photo.dessins?.length) {
    imageAvecDessins(photo).then((src) => {
      if (src) fenetre.querySelector('img').src = src;
    }).catch(() => {});
  }
  fenetre.querySelector('[data-cle="dessiner"]').addEventListener('click', async () => {
    if (refuserEnLectureSeule()) return;
    fenetre.close();
    const dessins = await ouvrirEditeurDessin(photo, photo.dessins ?? []);
    if (dessins) {
      if (dessins.length > 0) photo.dessins = dessins;
      else delete photo.dessins;
      modifie();
    }
    montrerPhoto(id);
  });
  fenetre.querySelector('[data-cle="supprimer"]')?.addEventListener('click', () => {
    if (!confirm('Supprimer cette photo ?')) return;
    projet.photosControle = projet.photosControle.filter((p) => p.id !== id);
    fenetre.close();
    modifie();
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}

/** Rôle de chaque point d'une liste dans ses levés (« contour », « ligne L-HT-1 », « point isolé ») : Map nom -> texte. */
function rolesDesPoints(leveId) {
  const roles = new Map();
  for (const levee of [...projet.surfaces, ...projet.autres].filter((s) => s.leveId === leveId)) {
    for (const nom of levee.contour ?? []) roles.set(nom, 'contour');
    (levee.lignesRupture ?? []).forEach((ligne, index) => ligne.noms.forEach((nom) => roles.set(nom, `ligne ${nomDeLigne(ligne, index)}`)));
    for (const nom of levee.points ?? []) if (typeof nom === 'string') roles.set(nom, 'point isolé');
  }
  return roles;
}

/** Libellé des points isolés (celui choisi, sinon le premier de la liste). */
function libelleDesPoints() {
  return terrain.libellePoint === '' || lireLibelles().points.some(([abreviation]) => abreviation === terrain.libellePoint) ? terrain.libellePoint : '';
}

/**
 * Avant de ranger un point dans un levé (0.78.0, demandes du 27.10.2026) :
 * - un nouveau segment de ligne ou de contour (depuis son dernier point) ne doit pas croiser un
 *   autre segment du levé : fenêtre « Supprimer le segment du dessous » (ligne la plus ancienne,
 *   ce segment seulement ; ses points restent) ou « Lever en point isolé » ;
 * - dans un stock, un point de ligne ou un point isolé hors du contour est refusé.
 * position : { est, nord } ; versNom : nom du point s'il est déjà levé (toucher sur le plan).
 * Renvoie le rôle à utiliser ('contour', 'ligne' ou 'isole'), ou null si le point est refusé.
 */
async function controlerPlacePoint(stock, role, position, versNom = null) {
  const parNom = new Map(pointsDuLeve(stock.leveId).map((p) => [p.nom, p]));
  // Stock : un point de ligne ou un point isolé hors du contour est refusé tout de suite.
  if (role !== 'contour' && horsDuContour(stock, parNom, position)) {
    refuser('Point refusé : hors du contour du stock');
    return null;
  }
  let roleFinal = role;
  let segmentSupprime = false;
  if (role === 'ligne' || role === 'contour') {
    const depuis = (role === 'contour' ? stock.contour : ligneEnCours(stock).noms).at(-1);
    for (let essai = 0; depuis && essai < 20; essai++) {
      const croise = segmentCroise(stock, parNom, depuis, position, versNom);
      if (!croise) break;
      const nomCroise = croise.type === 'contour' ? 'le contour' : nomDeLigne(stock.lignesRupture[croise.index], croise.index);
      const choix = await demanderChoix({
        titre: 'Les lignes se croisent',
        texte: `Le segment ${depuis} → ${versNom ?? 'nouveau point'} croise ${nomCroise} (${croise.a} → ${croise.b}).`,
        boutons: [
          ...(croise.type === 'ligne' ? [{ cle: 'segment', texte: 'Supprimer le segment du dessous', detail: `${croise.a} → ${croise.b} de ${nomCroise} ; ses points restent`, principal: true }] : []),
          { cle: 'isole', texte: 'Lever en point isolé', principal: croise.type !== 'ligne' },
          { cle: 'annuler', texte: 'Ne pas prendre le point' },
        ],
      });
      if (choix === 'segment') {
        supprimerSegment(stock, croise.index, croise.i);
        segmentSupprime = true;
        continue;
      }
      roleFinal = choix === 'isole' ? 'isole' : null;
      break;
    }
  }
  if (!roleFinal && segmentSupprime) modifie();
  return roleFinal;
}

/**
 * Toucher un point déjà levé sur le plan (modes Intermédiaire et Expert, rôle Ligne ou Contour, 0.78.0) : il entre
 * dans la ligne ou le contour en cours avec son nom (s'il n'est encore dans aucune ligne), après
 * les mêmes contrôles qu'un point pris au RX2.
 */
async function ajouterPointTouche(nom) {
  const stock = stockEnCours();
  if (!stock || !['ligne', 'contour'].includes(leveDirect.role) || refuserEnLectureSeule()) return;
  const point = pointsDuLeve(stock.leveId).find((p) => p.nom === nom);
  if (!point) {
    afficherMessage(`${nom} n'est pas dans la liste de ce levé`, 3000);
    return;
  }
  const place = placeDuPoint(stock, nom);
  if (place && place.type !== 'isole') {
    afficherMessage(`${nom} est déjà dans ${place.type === 'contour' ? 'le contour' : `la ligne ${nomDeLigne(stock.lignesRupture[place.index], place.index)}`}`, 3000);
    return;
  }
  const role = await controlerPlacePoint(stock, leveDirect.role, point, nom);
  if (!role) return;
  if (role === 'isole') {
    if (!place) stock.points.push(nom);
    afficherMessage(`${nom} : point isolé`);
  } else {
    if (role === 'ligne') prochainNom(projet, stock, 'ligne', libelleDuRole()); // prépare la ligne en cours (libellé, numéro)
    const refus = ajouterPointExistant(stock, role, nom);
    if (refus) {
      afficherMessage(refus.erreur, 3000);
      return;
    }
    afficherMessage(`${nom} ajouté ${role === 'contour' ? 'au contour' : `à ${nomDeLigne(ligneEnCours(stock), stock.lignesRupture.length - 1)}`}`);
  }
  vibrer(40);
  modifie();
}

/** Libellé utilisé pour le rôle en cours (dans la liste ; sinon le premier de la liste). */
function libelleDuRole() {
  if (leveDirect.role === 'contour') return null;
  if (stockEnCours()?.nature === 'chantier') return libelleChantier(terrain.chantier.libelle).abreviation;
  const sorte = leveDirect.role === 'aire' ? 'aires' : ['ligne', 'longueur'].includes(leveDirect.role) ? 'lignes' : 'points';
  const liste = lireLibelles()[sorte];
  const voulu = { aires: terrain.libelleAire, lignes: terrain.libelleLigne, points: terrain.libellePoint }[sorte];
  return liste.some(([abreviation]) => abreviation === voulu) ? voulu : '';
}

/** Données du cadre « Chantier » de Lever (voir leve/ecran.js) : libellés, natures, choix en cours, cadre commencé. */
function donneesChantier(stock) {
  const libelles = lireLibellesChantier();
  const libelle = libelleChantier(terrain.chantier.libelle, libelles);
  const toutesNatures = lireNaturesChantier();
  const natures = toutesNatures[libelle.reseau ? 'reseau' : 'bordure'];
  const nature = natures.includes(terrain.chantier.nature) ? terrain.chantier.nature : natures[0];
  const mode = libelle.modes.includes(terrain.chantier.mode) ? terrain.chantier.mode : libelle.modes[0] ?? '';
  const cadre = (stock.cadres ?? []).find((c) => c.noms.length < 3 && c.libelle === libelle.abreviation);
  const dernier = (stock.cadres ?? []).filter((c) => c.noms.length === 3).at(-1);
  return {
    libelles, libelle, natures, nature, mode, couleursNatures: Object.fromEntries(natures.map((n) => [n, couleurNatureChantier(n, toutesNatures.couleurs)])), forme: libelle.ouvrage ? terrain.chantier.forme : 'ronde',
    diametre: terrain.chantier.diametre, gaine: terrain.chantier.gaine, nombre: terrain.chantier.nombre, profondeur: terrain.chantier.profondeur, materiau: terrain.chantier.materiau, remarque: terrain.chantier.remarque,
    coinsFaits: cadre?.noms.length ?? 0,
    dernierCadre: dernier ? { nom: dernier.noms[0].replace(/-\d+$/, ''), longueur: dernier.longueur, largeur: dernier.largeur, direction: dernier.direction, ecart: dernier.ecartAngleDroit } : null,
  };
}

/** Ce que montre l'onglet Terrain (voir leve/ecran.js). */
function donneesLeve() {
  reprendreLeveDirect();
  // Terrain naturel ou terrassement : pas de contour, on passe aux points isolés.
  if (!rolesDuMode(stockEnCours()).includes(leveDirect.role)) leveDirect.role = 'isole';
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
    rolesPermis: rolesDuMode(stock),
    dernierPoint: leve?.points[leve.points.length - 1]?.nom ?? null,
    resume: stock ? resumeStock(stock) : null,
    volume: stock ? volumeDuStock(stock) : null,
    elements: stock ? elementsDuLevee(stock) : null,
    // Suites de points pas encore dans une ligne (0.95.0) : pour « + Lignes depuis les suites ».
    suites: stock ? suitesLibres(stock, pointsDuLeve(stock.leveId).map((p) => p.nom)) : [],
    photos: stock?.photos ?? [],
    // Levé chantier (0.175.0) : bibliothèque et derniers choix, pour le cadre de saisie des attributs.
    chantier: stock?.nature === 'chantier' ? donneesChantier(stock) : null,
    // Triangles en trop (Intermédiaire) : seulement pour un levé qui a une surface (pas un levé libre).
    triangles: stock && projet.surfaces.includes(stock)
      ? { actif: editeurSurfaces.enSuppression() && editeurSurfaces.objetActif() === stock, supprimes: stock.trianglesSupprimes?.length ?? 0 }
      : null,
  };
}

/**
 * Contour, lignes et points isolés du levé, pour la liste en bas de Terrain › Lever (0.78.0) :
 * { contour: { nom, noms, modifiable } ou null, lignes: [{ index, nom, noms, fermee }], isoles: [nom] }.
 * Le contour d'une Surface (dessin) suit le dessin : ses points ne se suppriment pas ici.
 */
function elementsDuLevee(stock) {
  const dans = new Set([...(stock.contour ?? []), ...stock.lignesRupture.flatMap((l) => l.noms)]);
  const isoles = stock.tousLesPoints ? pointsDuLeve(stock.leveId).map((p) => p.nom).filter((n) => !dans.has(n)) : [...(stock.points ?? [])];
  return {
    contour: stock.contour?.length
      ? { nom: stock.numeroContour ? `C-Stock-${stock.numeroContour}` : 'Contour', noms: [...stock.contour], modifiable: !stock.dessinId }
      : null,
    lignes: stock.lignesRupture.map((l, index) => ({ index, nom: nomDeLigne(l, index), noms: [...l.noms], fermee: l.fermee })).filter((l) => l.noms.length > 0),
    isoles,
  };
}

/** Nombre tapé (virgule acceptée), ou null s'il est vide ou illisible. */
function lireNombre(texte) {
  const nettoye = String(texte ?? '').trim().replace(',', '.');
  const nombre = Number(nettoye);
  return nettoye && Number.isFinite(nombre) ? nombre : null;
}

/** Données de l'onglet Terrain communes aux surfaces et aux levés libres. */
function donneesCommunes() {
  return {
    delta: { ...deltaLeve, actif: deltaActif(deltaEnMetres()) },
    // Surfaces levées et levés libres, avec la date de leur levé (« Stock 2 · 22.10.2026 »).
    famille: 'leve',
    stocks: [...surfacesLevees(), ...projet.autres]
      .filter((s) => familleDeNature(s.nature) === 'leve')
      .map((s) => ({ id: s.id, nom: `${s.nom} · ${jourDuLeve(s.leveId)}`, nature: s.nature ?? 'stock' })),
    libelles: lireLibelles(),
    libelleLigne: terrain.libelleLigne,
    libellePoint: terrain.libellePoint,
    libelleAire: terrain.libelleAire,
    mode: terrain.mode,
    recepteur: recepteurDisponible(),
    ajoutActif: ajoutLevee.actif,
    controle: terrain,
    deltaSurface, // 0.152.0 : delta Z de la surface (Implanter › Surface)
    // Mode Lame : surfaces (terrassement d'abord), surface suivie, tolérances, 2e RX2 connecté ?
    lame: {
      surfaces: [...projet.surfaces].sort((a, b) => Number(['terrassement', 'surface'].includes(b.nature)) - Number(['terrassement', 'surface'].includes(a.nature))).map((s) => ({ id: s.id, etiquette: etiquetteSurface(s) })),
      surfaceId: terrain.lame.surfaceId,
      inverse: terrain.lame.inverse,
      tolerances: terrain.lame.tolerances,
      machine: terrain.lame.machine,
      recepteur2: Boolean(etatRecepteur2?.connecte),
      recepteursBull: terrain.lame.recepteursBull,
      unGnss: outilAUnGnss(),
      vue: terrain.lame.vue,
      indic: terrain.lame.indic === 'regle' ? 'regle' : 'exterieur',
      lignes: lignesGuidage.liste.map((l) => ({ nom: `L${l.place + 1}`, slot: l.place, bout: l.bout })),
      choixLignes: lignesGuidage.choix,
      candidatLigne: lignesGuidage.candidat ? lignesGuidage.candidat.place : null,
      deltaSurface,
      coupeSeule: terrain.lame.coupeSeule,
      marges: terrain.lame.marges,
      exagerationCoupe: terrain.lame.exagerationCoupe,
      outil: terrain.lame.outils[['bull', 'rateau'].includes(terrain.lame.machine) ? terrain.lame.machine : 'grader'],
    },
    autocontrole: donneesAutocontrole(),
    // Seulement les levés et surfaces qui ont des triangles (0.90.1 : pas les levés vides), plus la surface choisie.
    surfaces: projet.surfaces.filter((s) => s.id === terrain.surfaceId || trianglesDeSurface(s.id).length > 0).map((s) => ({ id: s.id, etiquette: etiquetteSurface(s) })),
    implanter: {
      accroche: terrain.accroche,
      zoomLoupe: terrain.zoomLoupe ?? 4,
      choix: implanter.choix,
      cible: implanter.cible,
      nomPropose: nomProposeImplantation(),
      // Nom du point suivant à implanter (P1 → P2), ou null.
      suivant: implanter.cible?.nom && enImplantationDePoint() ? nomSuivant(implanter.cible.nom, pointsDuProjet().map((p) => p.nom)) : null,
      precedent: implanter.cible?.nom && enImplantationDePoint() ? nomPrecedent(implanter.cible.nom, pointsDuProjet().map((p) => p.nom)) : null,
      plusProche: Boolean(terrain.plusProche) && aAcces('expert'),
      aImplanter: projet.aImplanter.map((p) => {
        const derniere = [...projet.implantations].reverse().find((i) => i.aImplanterId === p.id);
        return { ...p, fait: derniere ? { distance: derniere.ecarts.distance, dAltitude: derniere.ecarts.dAltitude } : null };
      }),
      nbImplantations: projet.implantations.length,
      nomsPoints: enImplantationDePoint() || enImplantationDeLigne() ? pointsDuProjet().map((p) => p.nom) : [],
      accrocheLigne: terrain.accrocheLigne,
      pointsLigne: implanter.pointsLigne,
      ligne: implanter.ligne ? resumeLigne() : null,
      ligneAValider: Boolean(implanter.ligne) && implanter.ligneAValider,
      // Talus : réglages, talus de « Mes talus » ouvert (nom) et la liste.
      talus: {
        reglages: terrain.talus,
        complet: talusComplet(terrain.talus),
        texte: textePente(terrain.talus),
        ouvert: projet.talus.find((t) => t.id === implanter.talusId)?.nom ?? null,
        mesTalus: projet.talus.map((t) => ({ id: t.id, nom: t.nom, texte: `${textePente(t.reglages)} · ${t.reglages.ligneEst === 'bas' ? 'depuis le bas' : 'depuis le haut'} · à ${t.reglages.cote}` })),
        talusSurfaces: talusDesSurfacesAImplanter(),
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
function reglerPlanDxf(id, { visible, couleur, nom, transparence, type }) {
  const choisi = projet.plansDxf.find((p) => p.id === id);
  if (!choisi) return;
  if (visible !== undefined) choisi.visible = visible;
  if (couleur !== undefined) choisi.couleur = couleur;
  // Plan PDF (0.132.0) : le préfixe « PDF- » reste devant, quoi qu'on tape.
  if (nom !== undefined && sansPrefixe(nom, choisi.pdf ? PREFIXE_PDF : '').trim()) choisi.nom = choisi.pdf ? avecPrefixe(nom, PREFIXE_PDF) : nom.trim();
  if (transparence !== undefined) choisi.transparence = Math.min(100, Math.max(0, Math.round(transparence)));
  // Seulement montrer / cacher : réglage de la tablette (0.128.1), permis aussi en lecture seule.
  if (type !== undefined) choisi.type = String(type);
  if (couleur === undefined && nom === undefined && transparence === undefined && type === undefined) affichageModifie();
  else modifie();
}

/**
 * Plan DXF ou calque montré / caché (0.128.1) : c'est l'affichage de cette tablette (voir
 * projet/affichage-appareil.js), donc permis même sans la main sur le projet (lecture seule).
 */
function affichageModifie() {
  noterAffichage(projet);
  if (lectureSeule()) {
    recalculer();
    return;
  }
  modifie();
}

/** Mode Contrôler : la surface choisie devient la surface affichée (plan, Calculs › Surfaces). */
function montrerSurfaceControle() {
  const index = projet.surfaces.findIndex((s) => s.id === terrain.surfaceId);
  if (index >= 0) editeurSurfaces.choisir(index);
}

/** Mode « Altitude » : seulement monter / descendre pour atteindre l'altitude tapée (pas de position). */
function calculerAltitudeVoulue(etat) {
  const voulue = terrain.altitudeVoulue;
  if (voulue == null) return { message: 'Tape l\'altitude voulue' };
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };
  if (!etat.autorise) return { message: etat.raison ?? 'Position pas fiable' };
  const ecart = ecartSurface(voulue, position.altitude);
  return { ecart, classe: classeEcart(ecart), altitudeSurface: voulue, altitudeCanne: position.altitude, message: null };
}

/**
 * Mode Contrôler, à chaque état du récepteur : de combien monter ou descendre pour être sur la
 * surface choisie, et les coupes autour du récepteur. L'écart n'est donné que si le point serait
 * accepté par la règle de prise de point (RTK fixe et inclinaison prête) ; sinon, la raison.
 */
function calculerControle(etat, orientation) {
  if (terrain.implantation === 'altitude') return calculerAltitudeVoulue(etat);
  const surface = projet.surfaces.find((s) => s.id === terrain.surfaceId);
  if (!surface) return { message: 'Choisis une surface' };
  const triangles = trianglesDeSurface(surface.id);
  if (triangles.length === 0) return { message: 'Cette surface n\'a pas encore de triangles' };
  const position = etat.connecte && etat.recu ? etat.position : null;
  if (!position) return { message: etat.connecte ? 'En attente de la position…' : 'Récepteur non connecté' };

  const altitudeBase = altitudeSurSurface(triangles, position.est, position.nord);
  const delta = aAcces('intermediaire') ? deltaSurface : 0;
  const altitudeSurface = altitudeBase == null ? null : altitudeBase + delta;
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
    const base = profilSurface(triangles, debut, fin);
    coupes[sens] = {
      debut,
      fin,
      lignes: decalerProfil(base, delta),
      lignesBase: delta ? base : null,
      delta,
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

// Barre du récepteur sous l'en-tête (toujours là dans l'appli Android) : la toucher ouvre la fenêtre du récepteur.
if (recepteurDisponible()) {
  mettreAJourBandeaux(null, null);
  // 0.161.0 : ouvert depuis le menu, la fenêtre du récepteur ramène au menu en se fermant.
  document.addEventListener('ouvrir-recepteur', (evenement) => boutonRecepteur?.ouvrir({ quandFerme: evenement.detail?.retourMenu ? () => navigation.ouvrirPage() : null }));
}
// État du récepteur, 5 fois par seconde : bandeaux, bloc de levé, position sur le plan.
if (recepteurDisponible()) {
  ecouterRecepteur((etat) => {
    // RX2 qui vient de se connecter : rappel du contrôle s'il en faut un (voir proposerControle).
    const vientDeSeConnecter = Boolean(etat.connecte) && !etatRecepteur?.connecte;
    // Fix RTK perdu ou retrouvé (0.90.0) : son et vibration, récepteur toujours connecté.
    const fixAvant = etatRecepteur?.connecte && etatRecepteur?.recu && etatRecepteur.qualite === 4;
    const fixMaintenant = etat.connecte && etat.recu && etat.qualite === 4;
    if (etatRecepteur?.connecte && etatRecepteur.recu && etat.connecte && etat.recu && fixAvant !== fixMaintenant) {
      if (fixMaintenant) sonRetourFix();
      else sonPerteFix();
      vibrer(fixMaintenant ? 60 : [200, 100, 200]);
    }
    etatRecepteur = etat;
    // Mesure rapide : « + Point GNSS » de la bande suit l'état du récepteur (prêt ou non).
    if (ongletContexte === 'mesure-rapide' || ongletContexte === 'annotation') navigation?.mettreAJour();
    if (vientDeSeConnecter) proposerControle();
    mettreAJourBandeaux(etat, etat.connecte ? null : positionTablette, terrain.hauteurCanne ?? null);
    boutonRecepteur?.mettreAJour(etat);
    const orientation = suiviOrientation.ajouter(etat, performance.now());
    if (terrain.plusProche && aAcces('expert')) viserLePlusProche();
    const enPoint = enImplantationDePoint();
    const enLigne = enImplantationDeLigne();
    const controle = terrain.mode === 'controler' && !enPoint && !enLigne ? calculerControle(etat, orientation) : null;
    let implantation = enPoint ? calculerImplantation(etat, orientation) : null;
    if (enAutocontrole() && autocontrole.cible) implantation = calculerImplantation(etat, orientation, autocontrole.cible);
    const talus = enTalus();
    const implantationLigne = enLigne && !talus && !implanter.ligneAValider ? calculerImplantationLigne(etat, orientation) : null;
    const implantationTalus = talus && !implanter.ligneAValider ? calculerImplantationTalus(etat) : null;
    ecranLeve.mettreAJourRecepteur(etat, { orientation, controle, implantation, implantationLigne, implantationTalus });
    montrerLame();
    mettreAJourBip(controle);
    const position = etat.connecte && etat.recu ? etat.position : null;
    // Coupes affichées (mode Implanter) : leur trait en pointillés sur le plan.
    // 0.144.0 : une seule coupe (en Base, toujours dans l'axe).
    const vues = estModeBase() || terrain.vueCoupes === 'axe' ? ['axe'] : ['perpendiculaire'];
    // Seulement dans l'onglet Terrain (ailleurs, la croix des coupes n'a rien à faire sur le plan).
    const traits = controle?.coupes && ongletContexte === 'terrain' ? vues.map((sens) => ({ sens, debut: controle.coupes[sens].debut, fin: controle.coupes[sens].fin })) : [];
    // Ligne : trait en pointillés jusqu'au point de la ligne en face de la canne.
    // Talus : trait jusqu'à l'entrée en terre (ou au bord du talus) en face de la canne.
    const vers = implantationLigne?.ligne?.cible ?? (implantationTalus?.message ? null : implantationTalus?.talus?.cible) ?? null;
    const cotes = implantationTalus ? cotesTalus(implantationTalus) : cotesLigne(implantationLigne);
    // Sans RX2 connecté : la position du GPS de la tablette, en gris avec son cercle de précision.
    dernierAzimut = orientation.azimut ?? null;
    // Delta en cours (Lever) : le point décalé se voit sur le plan avant Enreg. Pts.
    const delta = deltaEnMetres();
    const decale = position && ongletContexte === 'terrain' && terrain.mode === 'lever' && deltaActif(delta) ? pointAvecDelta(position, delta, orientation.azimut) : null;
    const tablette = !etat.connecte && positionTablette ? { est: positionTablette.est, nord: positionTablette.nord, prete: false, tablette: true, precision: positionTablette.precision, azimut: null } : null;
    plan.afficherPosition(position ? { est: position.est, nord: position.nord, prete: Boolean(etat.inclinaisonPrete), azimut: orientation.azimut, coupes: traits, vers, cotesLigne: cotes, delta: decale } : tablette);
  });
  // GPS de la tablette : gardé ici, montré avec l'état suivant du RX2 (5 fois par seconde).
  ecouterPositionTablette((position) => {
    positionTablette = position && Number.isFinite(position.est) && Number.isFinite(position.nord) ? position : null;
    majPrecisionAnnotation();
  });
}

/**
 * Nouveau projet (0.74.0) : une fenêtre (affaire, désignation) ; le projet n'est créé qu'avec
 * « OK » (fenêtre fermée : rien ne change). On reste sur l'onglet Projet. Renvoie vrai si créé.
 */
const NOUVEAU_DOSSIER = '+nouveau';

/** Choix d'un dossier pour une liste (0.125.0) : les dossiers, « Sans dossier », et en Expert « + Nouveau dossier… ». */
function choixDeDossiers() {
  return [
    ...dossiersTries(lireDossiers()).map((d) => [d.id, d.nom]),
    [SANS_DOSSIER, 'Sans dossier'],
    ...(aAcces('expert') ? [[NOUVEAU_DOSSIER, '+ Nouveau dossier…']] : []),
  ];
}

/** Demande le nom d'un nouveau dossier et le crée ; renvoie son id, ou null. */
async function creerDossierDemande() {
  const nom = await demanderTexte({ titre: 'Nouveau dossier', texte: 'Nom du dossier (ex. Maxime)', valeur: '' });
  if (nom == null) return null;
  const resultat = ajouterDossier(lireDossiers(), nom);
  if (resultat.erreur) {
    afficherMessage(resultat.erreur, 4000);
    return null;
  }
  ecrireDossiers(resultat.dossiers);
  return resultat.id;
}

/**
 * 0.161.0 (demande du 08.11) : « Nouveau projet » = une page à part (nom, désignation, dossier), comme
 * Import / Exporter / Contenu ; « ← » ramène au menu. Le projet n'est créé qu'avec « Créer le projet ».
 */
function creerNouveauProjet() {
  const avecDossiers = lireDossiers().liste.length > 0 || aAcces('expert');
  const zone = document.querySelector('#nouveau-projet');
  zone.innerHTML = `
    <label>Affaire<input type="text" data-champ="affaire" placeholder="ex. 10 203" /></label>
    <label>Désignation<input type="text" data-champ="lieu" placeholder="ex. Gland, plateforme Migros" /></label>
    ${avecDossiers ? `<label>Dossier<select data-champ="dossier">${choixDeDossiers().map(([v, t]) => `<option value="${echapper(v)}" ${v === dossierDuProjet(lireDossiers(), projet.id) ? 'selected' : ''}>${echapper(t)}</option>`).join('')}</select></label>` : ''}
    <button type="button" class="bouton" data-action="creer-projet"><strong>Créer le projet</strong></button>`;
  ouvrirPartieProjet('nouveau');
  zone.querySelector('input')?.focus();
  return true;
}

/** « Créer le projet » de la page Nouveau projet. */
async function validerNouveauProjet() {
  const zone = document.querySelector('#nouveau-projet');
  const valeur = (cle) => zone.querySelector(`[data-champ="${cle}"]`)?.value.trim() ?? '';
  const nouveau = nouveauProjetSansNom();
  nouveau.cartouche.affaire = valeur('affaire');
  nouveau.cartouche.lieu = valeur('lieu');
  let dossier = zone.querySelector('[data-champ="dossier"]') ? valeur('dossier') : SANS_DOSSIER;
  if (dossier === NOUVEAU_DOSSIER) dossier = (await creerDossierDemande()) ?? SANS_DOSSIER;
  if (dossier) ecrireDossiers(rangerProjet(lireDossiers(), nouveau.id, dossier));
  await changerDeProjet(() => ouvrir(nouveau, { changerOnglet: false }));
  zone.innerHTML = '';
  afficherOnglet('projets'); // sans page : ouvre le menu
  afficherMessage(`Projet « ${titreProjet(nouveau)} » créé`);
}
document.querySelector('#nouveau-projet').addEventListener('click', (evenement) => {
  if (evenement.target.closest('[data-action="creer-projet"]')) validerNouveauProjet();
});
document.querySelector('#nouveau-projet').addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Enter' && evenement.target.matches('input')) validerNouveauProjet();
});

const actionsProjet = {
  renommer: (nom) => {
    projet.nom = nom; // facultatif : le projet se reconnaît à son affaire et son lieu
    modifie();
  },
  changerCartouche: (champ, valeur) => {
    projet.cartouche[champ] = valeur;
    modifie();
  },
  // Crayon à côté du projet ouvert (0.84.0) : affaire et désignation dans une fenêtre, comme au « Nouveau projet ».
  // Dossiers de projets (0.125.0, Expert) : ranger un projet, créer / renommer / supprimer un dossier.
  rangerProjet: async (id) => {
    if (!aAcces('expert')) return;
    const actuel = dossierDuProjet(lireDossiers(), id);
    const choix = await demanderChoix({
      titre: 'Ranger dans le dossier',
      boutons: [
        ...choixDeDossiers().map(([cle, texte]) => ({ cle: cle || 'sans', texte: `${texte}${cle === actuel && cle !== NOUVEAU_DOSSIER ? ' ✓' : ''}`, principal: cle === actuel })),
        { cle: 'fermer', texte: 'Fermer' },
      ],
    });
    if (!choix || choix === 'fermer') return;
    let dossier = choix === 'sans' ? SANS_DOSSIER : choix;
    if (dossier === NOUVEAU_DOSSIER) {
      dossier = await creerDossierDemande();
      if (dossier == null) return;
    }
    ecrireDossiers(rangerProjet(lireDossiers(), id, dossier));
    afficherEcranProjet();
  },
  gererDossier: async (action, dossierId) => {
    if (!aAcces('expert')) return;
    const dossiers = lireDossiers();
    if (action === 'nouveau-dossier') await creerDossierDemande();
    else if (action === 'renommer-dossier') {
      const actuel = dossiers.liste.find((d) => d.id === dossierId);
      if (!actuel) return;
      const nom = await demanderTexte({ titre: 'Renommer le dossier', valeur: actuel.nom });
      if (nom == null) return;
      const resultat = renommerDossier(dossiers, dossierId, nom);
      if (resultat.erreur) afficherMessage(resultat.erreur, 4000);
      else ecrireDossiers(resultat.dossiers);
    } else if (action === 'supprimer-dossier') {
      const existants = [...resumes.map((r) => r.id), ...(partage?.etat.projetsDrive ?? []).map((p) => p.projetId)];
      const resultat = supprimerDossier(dossiers, dossierId, existants);
      if (resultat.erreur) {
        afficherMessage(resultat.erreur, 5000);
        return;
      }
      const nom = dossiers.liste.find((d) => d.id === dossierId)?.nom ?? '';
      if (!confirm(`Supprimer le dossier « ${nom} » ?`)) return;
      ecrireDossiers(resultat.dossiers);
    }
    afficherEcranProjet();
  },
  modifierProjet: async () => {
    if (refuserEnLectureSeule()) return;
    const valeurs = await demanderChamps({
      titre: 'Renommer le projet',
      champs: [
        { cle: 'affaire', titre: 'Affaire', exemple: 'ex. 10 203', valeur: projet.cartouche.affaire ?? '' },
        { cle: 'lieu', titre: 'Désignation', exemple: 'ex. Gland, plateforme Migros', valeur: projet.cartouche.lieu ?? '' },
      ],
    });
    if (!valeurs) return;
    projet.cartouche.affaire = valeurs.affaire;
    projet.cartouche.lieu = valeurs.lieu;
    modifie();
  },
  exporterProjet: async (id) => {
    const lu = id === projet.id ? projet : await stockage.lireProjet(id);
    if (!lu) return;
    const complet = completerProjet(lu);
    telecharger(new Blob([ecrireFichierProjet(complet)], { type: 'application/json' }), `${nomDeFichierProjet(complet)}.topo.json`);
  },
  // Nouveau projet (0.74.0) : une fenêtre (affaire, désignation) ; le projet n'est créé qu'avec
  // « OK » (fenêtre fermée : rien ne change). On reste sur l'onglet Projet.
  nouveauProjet: () => creerNouveauProjet(),
  ouvrirProjet: (id) => avecChargement(async () => {
    const lu = await stockage.lireProjet(id);
    if (lu) await changerDeProjet(() => ouvrir(completerProjet(lu)));
  }),
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
  reprendreLaMain: () => partage.prendreLaMain(),
  ouvrirDrive: (dossierId) => avecChargement(() => partage.ouvrirDepuisDrive(dossierId)),
  // 0.217.0 : relecture silencieuse de la liste de Drive (ouverture de la liste des projets) ; pas de message si ça échoue.
  rafraichirDriveEnDouce: () => { if (partage?.etat.connecte) partage.rafraichirListe().catch(() => {}); },
  rafraichirDrive: () => partage.rafraichirListe().catch((erreur) => afficherMessage(`Drive : ${erreur.message}`, 4000)),
};
const ecranProjet = creerEcranProjet(document.querySelector('#projets'), actionsProjet, document.querySelector('#projets-suite'));

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
// Dossiers de projets (0.125.0) : un autre appareil a changé le classement (listes partagées reçues de Drive).
surChangementListes(() => afficherEcranProjet());

function afficherEcranProjet() {
  ecranProjet.afficher(projet, resumes, partage ? { etat: partage.etat, appareil: partage.appareil() } : null);
}

/**
 * Ouvre un autre projet (action "ouvrirAutre") : le projet ouvert est d'abord envoyé sur Drive et
 * rendu (verrou), puis le nouveau est comparé à sa version de Drive.
 */
async function changerDeProjet(ouvrirAutre) {
  await avecChargement(async () => {
    partage?.avantDeChanger(); // en arrière-plan : l'autre projet s'ouvre sans attendre internet
    await ouvrirAutre();
    partage?.apresOuverture();
  });
}

/**
 * « Chargement du projet… » (0.151.0, demande du 06.11) : écran plein et opaque pendant qu'un autre
 * projet s'ouvre, pour ne plus voir l'ancien projet le temps que le nouveau charge. Les fenêtres
 * (prise de main, erreurs) passent au-dessus (elles sont dans la couche du haut du navigateur).
 */
let chargementsEnCours = 0;
async function avecChargement(travail) {
  chargementsEnCours += 1;
  let ecran = document.querySelector('.ecran-chargement');
  if (!ecran) {
    ecran = document.createElement('div');
    ecran.className = 'ecran-chargement';
    ecran.setAttribute('role', 'status');
    ecran.innerHTML = '<span class="roue-attente" aria-hidden="true"></span><strong>Chargement du projet…</strong>';
    document.body.append(ecran);
  }
  // Laisse le navigateur dessiner l'écran avant le travail (sinon il n'apparaît qu'à la fin).
  await new Promise((fin) => requestAnimationFrame(() => setTimeout(fin, 0)));
  try {
    return await travail();
  } finally {
    chargementsEnCours -= 1;
    if (chargementsEnCours === 0) ecran.remove();
  }
}

let renduParInactivite = false; // 0.123 : main rendue par le site après 5 min (reprise au premier geste, même en Expert)
let fermerPopupLectureSeule = null;
partage = creerPartage({
  obtenirProjet: () => projet,
  titreDe: (p) => titreProjet(p),
  lireLocal: async (id) => {
    const lu = await stockage.lireProjet(id);
    return lu ? completerProjet(lu) : null;
  },
  ouvrirProjet: (nouveau) => ouvrir(completerProjet(nouveau), { changerOnglet: false }),
  // Projet qu'un autre appareil a en main (0.76.0) : lecture seule, ou prendre la main (Expert).
  demanderPriseDeMain: (verrou, titre, { avecAnnuler = false } = {}) => demanderChoix({
    titre: `${verrou.nom} a la main sur « ${titre} »`,
    texte: verrou.depuis ? `depuis ${new Date(verrou.depuis).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}` : '',
    boutons: [
      { cle: 'lecture', texte: 'Voir en lecture seule', detail: 'voir et implanter, sans rien enregistrer', principal: true },
      ...(aAcces('expert') ? [{ cle: 'prendre', texte: 'Prendre la main', detail: `code de sécurité ; ${verrou.nom} sera mis en attente` }] : []),
      ...(avecAnnuler ? [{ cle: 'annuler', texte: 'Ne pas ouvrir' }] : []),
    ],
  }).then((cle) => (cle === 'annuler' ? null : cle)),
  autoriserPrise: async (verrou) => {
    if (!aAcces('expert')) {
      afficherMessage('Prendre la main : seulement en mode Expert', 4000);
      return false;
    }
    return demanderCode(`Prendre la main à ${verrou.nom}`);
  },
  quandMainPrise: (verrou) => montrerAttenteMain(verrou),
  quandMainRendue: (nom, { repris = true } = {}) => {
    fermetureAttente?.abort();
    // Fenêtre avec « OK » (0.84.0) : un petit message passait inaperçu. Le projet est déjà repris.
    vibrer([200, 100, 200]);
    demanderChoix({
      titre: `${nom} a rendu la main`,
      texte: repris ? 'Le projet est mis à jour et tu as de nouveau la main.' : 'Le projet est mis à jour. Il reste en lecture seule : touche la main en haut pour la reprendre.',
      boutons: [{ cle: 'ok', texte: 'OK', principal: true }],
    });
  },
  quandChange: () => {
    afficherEcranProjet();
    mettreAJourEtatEntete();
    fenetreReglages?.rafraichir();
    montrerAttenteSynchro();
    // Main reprise : le popup « Lecture seule » se ferme (0.123).
    if (partage?.etat.rendu?.projetId !== projet.id) {
      renduParInactivite = false;
      fermerPopupLectureSeule?.();
    }
  },
  message: (texte) => afficherMessage(texte, 4000),
});

// L'appli passe en arrière-plan (on change d'appli, on éteint l'écran) : on envoie tout de suite.
// Elle revient (0.103.4) : le verrou est vérifié tout de suite (main prise entre-temps, version
// envoyée par un autre appareil pendant l'absence), sans attendre la vérification des 30 s.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') partage.envoyerMaintenant();
  else partage.verifierMaintenant();
});

// DAO (0.147.0, Expert) : voir dao/dao.js ; créée après le plan (plus bas).
let daoAppli = null;
const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPosition: toucherPourCoupe,
  peutDeplacerCoupe: () => !refuserEnLectureSeule(),
  quandDeplacerCoupe: (id, bout, position) => {
    const coupe = projet.coupes.find((c) => c.id === id);
    if (!coupe) return;
    coupe[bout] = position;
    modifie();
  },
  // Un point touché va à la liste en cours : celle d'une mesure (onglet Calculs › Mesures) ou d'une surface.
  quandToucherPoint: (nom) => {
    if (ongletContexte === 'mesures') ecranMesures.toucherPoint(nom);
    else if (toucherPourLever()) ajouterPointTouche(nom);
    else editeurSurfaces.toucherPoint(nom);
  },
  quandToucherMesure: (id) => ecranMesures.choisir(id),
  quandToucherStock: (index) => editeurSurfaces.choisir(index),
  quandToucherTriangle: (triangle) => editeurSurfaces.basculerTriangle(cleTriangle(triangle)),
  quandToucherImplantation: toucherPourImplantation,
  // Appli Plan (0.180.3) : toucher un point d'annotation ouvre sa fiche dans l'application Annotation.
  quandToucherAnnotation: (position, tolerance) => {
    const point = annotationSousLeDoigt(position, tolerance);
    if (!point) return false;
    montrerEncadreAnnotation(point.nom);
    return true;
  },
  // « Voir toute la ligne » (0.118.0) cochée ou décochée (aussi décochée par « Ma position »).
  quandVoirLigne: (coche) => {
    implanter.voirLigne = coche && Boolean(implanter.ligne);
    envoyerImplantationAuPlan();
    if (!coche) plan.rafraichirImplantation();
  },
  quandReglerPlanDxf: (id, changements) => reglerPlanDxf(id, changements),
  // Menu « Points » : cocher / décocher une liste de points ('*' : toutes). Pas une modification
  // du travail (rien à annuler) : on redessine et on enregistre.
  // Couleur d'une liste (menu « Afficher » ; aussi dans Projet › Listes de points).
  quandColorerListe: (id, couleur) => colorerListe(id, couleur),
  quandToucherPhoto: (id) => montrerPhoto(id),
  quandChangerZone: (sommets) => (cadastreAutour.actif() ? cadastreAutour.changerZone(sommets) : surfaceSwisstopo.changerZone(sommets)),
  quandMontrerListe: (id, visible) => {
    if (typeof id === 'string' && id.startsWith('section:')) {
      // 0.192.0 : case d'une catégorie d'Afficher : toutes ses listes d'un coup.
      const ids = new Set(listesDePoints(projet).filter((l) => l.section === id.slice(8)).map((l) => l.id));
      const cachees = new Set(projet.listesCachees ?? []);
      for (const un of ids) (visible ? cachees.delete(un) : cachees.add(un));
      projet.listesCachees = [...cachees];
    } else if (id === '*') projet.listesCachees = visible ? [] : listesDePoints(projet).map((l) => l.id);
    else montrerListe(projet, id, visible);
    recalculer();
    enregistrer();
  },
  // Menu DXF (0.94.0) : un calque d'un plan, coché ou non.
  quandMontrerCalqueDxf: (id, numero, visible) => {
    const calque = projet.plansDxf.find((p) => p.id === id)?.calques[numero];
    if (!calque) return;
    calque.visible = visible;
    affichageModifie();
  },
  // Bouton « Seul » (0.94.0) : seulement ce sur quoi je travaille (voir listesDuTravail).
  quandBasculerSeul: (actif) => {
    seulTravail = actif;
    // Implanter : « Seul » ne montre que l'élément choisi ; sans élément choisi, rien ne change : on le dit.
    if (actif && ongletContexte === 'terrain' && ecranLeve && terrain.mode === 'controler' && !elementSeul()) {
      afficherMessage('Seul : choisis d\'abord le point, la ligne ou la surface à implanter', 4000);
    }
    recalculer();
    envoyerImplantationAuPlan();
    plan.rafraichirImplantation();
  },
});

// DAO (0.147.0, Expert, Calculs › Dessin) : dessiner des objets sur le plan (voir dao/dao.js).
daoAppli = creerDao({
  cadre: () => document.querySelector('#plan .plan-cadre'),
  projet: () => projet,
  nouvelId: () => nouvelIdentifiant(),
  accrocher: (mode, position, tolerance) => {
    const sources = mode === 'point' ? { lignes: [], cercles: [], points: pointsDuProjet() } : sourcesDesPlans(plansDuProjet(), position, tolerance);
    return accrocher(mode, position, tolerance, avecToutesLesLignes(mode, sources));
  },
  demanderTexte,
  demanderChamps,
  confirmer: (texte) => confirm(texte),
  surfaces: () => projet.surfaces.filter((x) => trianglesDeSurface(x.id).length > 0).map((x) => [x.id, x.nom]),
  altitudeSur: (id) => {
    const triangles = trianglesDeSurface(id);
    return triangles.length > 0 ? chercheurAltitude(triangles) : null;
  },
  traitSous: (position, tolerance) => accrocherTrait(position, tolerance, sourcesDesPlans(plansDuProjet(), position, tolerance).lignes)?.sommets ?? null,
  message: (texte, duree) => afficherMessage(texte, duree),
  redessiner: () => recalculer(),
  enregistrer: () => modifie(),
  lectureSeule: () => refuserEnLectureSeule(),
});
document.querySelector('#bouton-dao').addEventListener('click', () => {
  if (daoAppli.actif()) daoAppli.arreter();
  else if (aAcces('expert')) {
    if (estTelephone()) afficherOnglet('plan');
    daoAppli.commencer();
  }
  navigation?.mettreAJour();
});

/**
 * Ajoute des photos (réduites) à une surface ou à une mesure : objet.photos. attentePoint : la photo
 * sera rattachée au prochain point enregistré dans ce levé (photo.point = son nom).
 */
async function ajouterPhotos(objet, fichiers, { attentePoint = false, dessiner = false } = {}) {
  // La conversion d'une photo HEIC prend quelques secondes : le message reste affiché jusqu'à la fin.
  afficherMessage('Préparation de la photo…', null);
  const erreurs = [];
  for (const fichier of fichiers) {
    try {
      const photo = await preparerPhoto(fichier);
      if (attentePoint) photo.attentePoint = true;
      objet.photos = [...(objet.photos ?? []), photo];
      // 0.188.0 (Levé chantier) : l'éditeur de dessin s'ouvre juste après la photo (fermé sans dessin : la photo reste telle quelle).
      if (dessiner) {
        afficherMessage('Photo prise', 1500);
        await dessinerSurPhoto(photo);
      }
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${erreur.message}`);
    }
  }
  if (erreurs.length > 0) afficherMessage(`Photo refusée. ${erreurs.join(' ; ')}`, 8000);
  else afficherMessage(`${fichiers.length} photo(s) ajoutée(s)`);
  modifie();
}

/** Ajoute des photos à un point de contrôle (photo.point = son nom, photo.pointId = son id). */
/** Site (0.124) : fiche d'un point de contrôle : position, derniers contrôles, photos (sans mesure, pas de GNSS). */
async function fichePointControle(point) {
  const photos = (projet.photosControle ?? []).filter((ph) => ph.pointId === point.id);
  const controles = projet.controles.filter((c) => c.type === 'mesure' && c.pointId === point.id).slice(-3).reverse();
  const MOTS = { vert: 'OK', orange: 'Limite', rouge: 'Hors tolérance' };
  const ecart = (v) => (v == null ? '—' : `${formaterNombre(v)} m`);
  const texte = [
    `E ${formaterNombre(point.est)} · N ${formaterNombre(point.nord)} · H ${point.altitude != null ? formaterNombre(point.altitude) : '—'}`,
    ...(controles.length > 0
      ? controles.map((c) => `${new Date(c.le).toLocaleDateString('fr-CH')} : ${MOTS[c.resultat.global]} (plan ${ecart(c.ecarts.plan)}, haut. ${ecart(c.ecarts.hauteur)})`)
      : ['Jamais contrôlé']),
  ].join('\n');
  plan.cadrerSur([{ est: point.est, nord: point.nord }], 10);
  const choix = await demanderChoix({
    titre: point.nom,
    texte,
    boutons: [
      ...(photos.length > 0 ? [{ cle: 'voir', texte: `Voir les photos (${photos.length})`, principal: true }] : []),
      { cle: 'fermer', texte: 'Fermer' },
    ],
  });
  if (choix !== 'voir') return;
  if (photos.length === 1) {
    montrerPhoto(photos[0].id);
    return;
  }
  const laquelle = await demanderChoix({
    titre: `Photos de ${point.nom}`,
    boutons: [...photos.map((ph, i) => ({ cle: ph.id, texte: `Photo ${i + 1}`, detail: ph.legende || '' })), { cle: 'fermer', texte: 'Fermer' }],
  });
  if (laquelle && laquelle !== 'fermer') montrerPhoto(laquelle);
}

async function choisirPrendreOuVoir(id) {
  const point = projet.pointsControle.find((p) => p.id === id);
  if (!point) return;
  const photos = (projet.photosControle ?? []).filter((ph) => ph.pointId === id);
  const choix = await demanderChoix({
    titre: `Photos de ${point.nom}`,
    boutons: [
      { cle: 'voir', texte: `Voir (${photos.length})`, principal: true },
      { cle: 'prendre', texte: 'Prendre une photo' },
      { cle: 'fermer', texte: 'Fermer' },
    ],
  });
  if (choix === 'voir') {
    if (photos.length === 1) {
      montrerPhoto(photos[0].id);
      return;
    }
    const laquelle = await demanderChoix({
      titre: `Photos de ${point.nom}`,
      boutons: [...photos.map((ph, i) => ({ cle: ph.id, texte: `Photo ${i + 1}`, detail: ph.legende || '' })), { cle: 'fermer', texte: 'Fermer' }],
    });
    if (laquelle && laquelle !== 'fermer') montrerPhoto(laquelle);
  } else if (choix === 'prendre') {
    // L'appareil photo s'ouvre (fichier choisi dans un champ caché, comme le bouton sans photo).
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    champ.setAttribute('capture', 'environment');
    champ.addEventListener('change', () => {
      if (champ.files?.length) ajouterPhotoControle(id, [...champ.files]);
    });
    champ.click();
  }
}

async function ajouterPhotoControle(id, fichiers) {
  const point = projet.pointsControle.find((p) => p.id === id);
  if (!point) return;
  afficherMessage('Préparation de la photo…', null);
  const erreurs = [];
  for (const fichier of fichiers) {
    try {
      const photo = await preparerPhoto(fichier);
      projet.photosControle = [...(projet.photosControle ?? []), { ...photo, point: point.nom, pointId: point.id }];
    } catch (erreur) {
      erreurs.push(`${fichier.name} : ${erreur.message}`);
    }
  }
  if (erreurs.length > 0) afficherMessage(`Photo refusée. ${erreurs.join(' ; ')}`, 8000);
  else afficherMessage(`Photo ajoutée à ${point.nom}`);
  modifie();
}

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
  ajouterPhotos,
});
editeurSurfaces.charger(projet.surfaces);

/** Après un changement de levé : on montre une surface de ce levé (s'il en a une). */
function montrerUneSurfaceDuLeve() {
  const active = editeurSurfaces.objetActif();
  if (active && (estImportee(active) || active.leveId === projet.leveActifId)) return;
  const index = projet.surfaces.findIndex((s) => s.leveId === projet.leveActifId);
  if (index >= 0) editeurSurfaces.choisir(index);
}

// --- Import d'une surface LandXML ou DXF 3D (Projet › Import, depuis 0.71.0) : chaque surface du
// fichier devient une surface du projet, de la nature choisie juste après (stock, terrain naturel,
// terrassement). Renvoie le message à afficher sous l'import (HTML).
async function importerSurface(fichier) {
  let message;
  try {
    const texte = await fichier.text();
    const type = /\.dxf$/i.test(fichier.name) ? 'dxf' : 'landxml';
    const lu = type === 'dxf' ? lireDXF(texte) : lireLandXML(texte);
    const { erreurs, avertissements } = lu;
    // LandXML (0.134.0) : toutes les surfaces du fichier (ex. une par plateforme Mensura) en une seule.
    const surfaces = type === 'dxf' ? lu.surfaces : fusionnerSurfaces(lu.surfaces, fichier.name.replace(/\.[^.]+$/, ''));
    if (surfaces.length < lu.surfaces.length) avertissements.push(`${lu.surfaces.length} surfaces du fichier réunies en une seule`);
    // Plus de question « Stock, Terrain… ? » (0.90.0) : la nature ne servait à rien.
    for (const surface of surfaces) projet.surfaces.push(surfaceImportee(surface, fichier.name, type));
    const messages = [...erreurs, ...avertissements];
    message = `<p class="resume"><strong>${surfaces.length} surface(s)</strong> importée(s) de « ${echapper(fichier.name)} » : voir Surfaces importées, plus bas.</p>
      ${messages.length > 0 ? `<div class="avertissement"><ul>${messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}`;
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    if (surfaces.length > 0) editeurSurfaces.choisir(projet.surfaces.length - 1);
  } catch (erreur) {
    message = `<p class="erreur">Impossible de lire « ${echapper(fichier.name)} » : ${echapper(erreur.message)}</p>`;
  }
  modifie({ recadrer: true });
  return message;
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
  allerLever: () => {
    choisirModeTerrain('lever');
    afficherOnglet('terrain');
  },
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
/** Bouton « Coupe » du plan : commence une nouvelle coupe (2 au plus), ou abandonne le tracé en cours. */
function creerCoupeSurPlan() {
  if (traceCoupe) {
    arreterTrace();
    return;
  }
  if (refuserEnLectureSeule()) return;
  const nouvelle = nouvelleCoupe(projet);
  if (!nouvelle) {
    afficherMessage('Il y a déjà 2 coupes (A et B) : glisse leurs bouts sur le plan, ou supprime-en une dans Calculs › Volumes', 5000);
    return;
  }
  modifie();
  commencerTrace(nouvelle);
}

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
  ajouterPhotos,
  quandChange: () => {
    // Une mesure d'un autre levé est choisie : ce levé devient le levé affiché.
    const mesure = ecranMesures.mesureActive();
    const autreLeve = mesure && mesure.leveId !== projet.leveActifId;
    if (autreLeve) projet.leveActifId = mesure.leveId;
    modifie({ recadrer: autreLeve });
  },
});

// Export des mesures : à part de celui des volumes (aucun volume dedans).
/** Vrai si cette liste (surface, métré, dessin, levé…) est cochée dans « Afficher ». */
const estAffichee = (id) => !(projet.listesCachees ?? []).includes(id);

/** Calculs de volume du projet dont le résultat est connu : [{ calcul, resultat }]. */
function calculsReussis() {
  return projet.calculs
    .map((calcul) => ({ calcul, resultat: resultatsCalculs.get(calcul.id) }))
    .filter(({ resultat }) => resultat && !resultat.erreurs);
}

creerEcranExport(moduleExport.zone('plan'), {
  // « Quoi exporter ? » : volumes, surfaces (par nature), dessins, listes de points ; cochés comme « Afficher ».
  obtenirGroupes: () => {
    const surfacesDe = (natures) => projet.surfaces.filter((s) => (estImportee(s) ? natures.includes('importee') : natures.includes(s.nature ?? 'stock'))).map((s) => ({ id: s.id, nom: etiquetteSurface(s), defaut: estAffichee(s.id) }));
    return [
      { titre: 'Volumes', elements: projet.calculs.map((c) => ({ id: c.id, nom: nomDuCalcul(c, projet.surfaces), defaut: estAffichee(c.surface1Id) })) },
      { titre: 'Stocks', elements: surfacesDe(['stock']) },
      { titre: 'Terrain', elements: surfacesDe(['terrain']) },
      { titre: 'Terrassement', elements: surfacesDe(['terrassement']) },
      { titre: 'Surfaces (dessins)', elements: surfacesDe(['surface']) },
      { titre: 'Surfaces importées', elements: surfacesDe(['importee']) },
      { titre: 'Dessins', elements: projet.dessins.filter((d) => d.sommets.length > 0).map((d) => ({ id: d.id, nom: d.nom, defaut: estAffichee(d.id) })) },
      {
        titre: 'Listes de points',
        elements: projet.leves.map((l) => ({
          id: l.id,
          nom: l.nom,
          // Levé du récepteur : coché si c'est le levé affiché ; fichier importé : comme « Afficher ».
          defaut: estLeveDirect(l) ? l.id === projet.leveActifId : estAffichee(l.id),
        })),
      },
    ];
  },
  obtenirDonnees: (selection) => {
    const leves = projet.leves.filter((l) => selection.has(l.id));
    const choisi = ({ calcul }) => selection.has(calcul.id);
    const surfaceDe = (id) => projet.surfaces.find((s) => s.id === id);
    const nom = (calcul) => nomDuCalcul(calcul, projet.surfaces);
    // Feuille principale du PDF : calculs sur toute la surface 1 ; les calculs limités au
    // contour d'une surface ont chacun leur feuille.
    const dansUnContour = ({ calcul }) => !calcul.uneSeule && calcul.zone?.type === 'surface';
    const principaux = calculsReussis().filter((c) => choisi(c) && !dansUnContour(c));
    const affichees = projet.surfaces.filter((s) => selection.has(s.id));
    const creees = affichees.filter((s) => !estImportee(s));
    return {
      nomProjet: titreProjet(projet),
      stocks: principaux.map(({ calcul }) => ({ ...surfaceDe(calcul.surface1Id), nom: nom(calcul), description: descriptionCalcul(calcul, projet.surfaces) })),
      resultats: principaux.map(({ resultat }) => resultat),
      comparaisons: calculsReussis()
        .filter((c) => choisi(c) && dansUnContour(c))
        .map(({ calcul, resultat }) => ({ nom: nom(calcul), description: descriptionCalcul(calcul, projet.surfaces), resultat })),
      volumes: projet.calculs.filter((c) => selection.has(c.id)).map((calcul) => ({ nom: nom(calcul), base: texteBase(calcul, projet.surfaces), resultat: resultatsCalculs.get(calcul.id) })),
      // PDF (0.107.4) : levés cochés qui ne sont dans aucun volume coché (« levé seul ») : contour,
      // lignes de rupture, triangles et points, sans étiquette de volume.
      levesSeuls: (() => {
        const dansUnVolume = new Set(principaux.map(({ calcul }) => calcul.surface1Id));
        return creees
          .filter((s) => !dansUnVolume.has(s.id))
          .map((s) => ({
            nom: s.nom,
            contour: s.contour ?? [],
            lignesRupture: s.lignesRupture ?? [],
            triangles: trianglesDeSurface(s.id),
            points: projet.leves.find((l) => l.id === s.leveId)?.points ?? [],
          }));
      })(),
      // DXF et LandXML : les surfaces cochées, avec ou sans volume.
      dessinSurfaces: {
        stocks: creees,
        resultats: creees.map((s) => ({ trianglesDessus: trianglesDeSurface(s.id) })),
        surfaces: affichees
          .filter(estImportee)
          .map((s) => ({ nom: s.nom, triangles: trianglesDeSurface(s.id) }))
          .filter((s) => s.triangles.length > 0),
      },
      points: leves.flatMap((l) => l.points),
      fichierPoints: leves.map((l) => l.nom).join(', '),
      // Dessins (Calculs › Dessin) cochés : DXF (calque DESSINS) et PDF.
      dessins: projet.dessins
        .filter((d) => selection.has(d.id) && d.sommets.length > 0)
        .map((d) => ({ ferme: estFerme(d), lignes: d.type !== 'points', points: pointsDuDessin(d, projet.dessins) })),
      // Photos des surfaces cochées (case « Photos » de l'export).
      // Photo rattachée à un point (0.96.0) : le nom du point devant la légende.
      photos: affichees.flatMap((s) => (s.photos ?? []).map((photo) => ({ ...photo, surface: s.nom, legende: [photo.point, photo.legende].filter(Boolean).join(' · ') }))),
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

/**
 * Écrans redessinés seulement quand ils se voient (0.126.0, vitesse sur tablette lente) : un écran
 * caché (autre onglet) est noté « en attente » et redessiné dès qu'il réapparaît (rattraperEcrans).
 */
function afficherSiVisible(nom, element, fonction) {
  if (estAffiche(element)) {
    ecransEnAttente.delete(nom);
    fonction();
  } else ecransEnAttente.set(nom, { element, fonction });
}
function rattraperEcrans() {
  for (const [nom, { element, fonction }] of [...ecransEnAttente]) {
    if (!estAffiche(element)) continue;
    ecransEnAttente.delete(nom);
    fonction();
  }
}
// Filet de sécurité : après chaque toucher et chaque changement de taille, les écrans devenus visibles sont redessinés.
document.addEventListener('click', () => setTimeout(rattraperEcrans, 0), true);
window.addEventListener('resize', () => setTimeout(rattraperEcrans, 0));

/** Recalcule tout (surfaces, volumes) et met à jour les écrans et le plan. */
function recalculer({ recadrer = false } = {}) {
  definirLibellesProjet(projet.libelles); // libellés de ce projet seulement (0.105.6)
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
  // 0.126.0 (vitesse) : les écrans cachés (Projet, Volumes…) ne sont redessinés qu'en les ouvrant.
  const panneauProjet = document.querySelector('.panneau[data-onglet="projets"]');
  afficherSiVisible('volumes', document.querySelector('.panneau[data-onglet="volumes"]'), () => ecranVolumes.afficher());
  afficherSiVisible('coupes', document.querySelector('.panneau[data-onglet="volumes"]'), () => ecranCoupes.afficher());
  ecranMesures.afficher();
  ecranDessin.afficher(donneesDessin());
  ecranTalusSurface.afficher(donneesTalusSurfaces());
  // Choix des côtés d'un talus (0.135.0) : sur tablette / téléphone, le plan passe en haut de Dessin (voir style.css).
  document.body.classList.toggle('en-choix-cotes-talus', choixCotesTalusActif());
  afficherSiVisible('import', panneauProjet, () => ecranImport.afficher(projet, dernierImport, dernierPlan));
  afficherSiVisible('export', panneauProjet, () => moduleExport.afficher(projet));
  montrerOngletProjet();
  // Point à implanter de la liste : ses coordonnées à jour (Annuler a pu l'enlever).
  if (implanter.cible?.id) {
    const point = projet.aImplanter.find((p) => p.id === implanter.cible.id);
    implanter.cible = point ? { ...point } : null;
  }
  envoyerImplantationAuPlan();
  ecranLeve?.afficher(donneesLeve());
  afficherSiVisible('projet', panneauProjet, afficherEcranProjet);
  // Téléphone, onglet Terrain : le plan reste en haut de l'écran (voir style.css), plus petit
  // en mode Implanter pour laisser la place aux coupes.
  document.body.classList.toggle('mode-leve', Boolean(ecranLeve));
  document.body.classList.toggle('mode-controle', Boolean(ecranLeve) && terrain.mode === 'controler');
  mettreAJourToucheVolume();

  // Plan : les listes de points cochées (menu « Points » : surfaces, métrés, Autres, fichiers,
  // points ajoutés) ; leurs points, et seulement les contours, lignes et triangles des surfaces cochées.
  // Pendant une modification (surface, mesure), comme avant : les points et surfaces du levé affiché.
  const toutesLesListes = listesDePoints(projet);
  plan.afficherListesPoints(toutesLesListes);
  // Bouton « Seul » : les autres listes sont dessinées comme décochées (le menu ne change pas).
  const gardees = listesDuTravail(toutesLesListes);
  const listes = gardees ? toutesLesListes.map((l) => ({ ...l, visible: l.visible && gardees.has(l.id) })) : toutesLesListes;
  plan.afficherCouleursPoints(couleursDesPoints(projet, listes));
  plan.afficherListeDesPoints(listeDesPoints(projet, listes));
  plan.afficherPointsImport(pointsDesImports(projet, listes));
  // Points des surfaces importées (visibles dans « Afficher ») : cases Points / Altitudes de Surface Import (0.122.0).
  plan.afficherPointsSurfaces(projet.surfaces.filter((s) => estSurfaceFichier(s) && !(projet.listesCachees ?? []).includes(s.id)).flatMap((s) => s.points ?? []));
  plan.afficherPhotos(photosDuPlan(listes));
  const active = editeurSurfaces.objetActif();
  const calculActif = active ? surfacesCalculees.get(active.id) : null;
  const dansSurfaces = ongletContexte === 'surfaces';
  // Triangles en trop : supprimés au doigt depuis Terrain › Lever (0.77.0 ; avant : Calculs › Surfaces).
  const trianglesAuDoigt = (dansSurfaces || (ongletContexte === 'terrain' && terrain.mode === 'lever')) && editeurSurfaces.enSuppression();
  // Calculs › Mesures : hors modification, les points des listes cochées (comme ailleurs) ; pendant la
  // modification d'une mesure, ceux de son levé (ce sont eux qu'on touche pour les ajouter).
  const enModification = (ongletContexte === 'mesures' && ecranMesures.enModification()) || editeurSurfaces.enModification();
  const cacheesParListe = new Set(listes.filter((l) => !l.visible).map((l) => l.id));
  const visibles = new Set(editeurSurfaces.enModification() ? surfacesAffichees() : projet.surfaces.filter((s) => !cacheesParListe.has(s.id)));
  // Une surface importée montre ses propres points ; sinon, ceux du levé ou des listes cochées.
  let pointsDuPlan;
  if (dansSurfaces && active && estImportee(active)) pointsDuPlan = active.points;
  else if (enModification) pointsDuPlan = points;
  else if (ongletContexte === 'mesures') {
    // Mesures : les listes cochées, plus le levé affiché (les mesures sont faites sur ses points).
    const desListes = pointsDesListes(projet, listes);
    const dejaLa = new Set(desListes);
    pointsDuPlan = pointsStables([...desListes, ...points.filter((p) => !dejaLa.has(p))]);
  } else pointsDuPlan = pointsStables(pointsDesListes(projet, listes));
  // « Le plus proche » choisit parmi les points des listes cochées, même si on n'en montre qu'un.
  pointsDesListesMontres = pointsDuPlan;
  // Bouton « Seul » en Implanter : le point, la ligne ou la surface choisi, rien d'autre.
  const seul = elementSeul();
  if (seul) {
    pointsDuPlan = seul.pointNom ? pointsStables(pointsDuPlan.filter((p) => p.nom === seul.pointNom)) : AUCUN_POINT;
    for (const s of projet.surfaces) if (s.id !== seul.surfaceId) visibles.delete(s);
  }
  // Bouton « Seul » dans Lever (0.105.4) : tout est caché (plans DXF, autres levés, imports, mesures, coupes) sauf le fond et le levé en cours.
  const seulEnLever = seulTravail && ongletContexte === 'terrain' && Boolean(ecranLeve) && terrain.mode === 'lever';
  plan.afficherPlansDxf(seul || seulEnLever ? [] : plansDuProjet());
  // Ce qui est coché (calques, « Afficher ») vaut dans tous les onglets.
  const dessinDuPlan = {
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
      trianglesAuDoigt && calculActif && !calculActif.erreurs
        ? { triangles: calculActif.triangles, trianglesRetires: calculActif.trianglesRetires }
        : null,
    modeTriangles: trianglesAuDoigt,
    // Coupes tracées (A – A', B – B'), et celle en cours de tracé.
    coupes: projet.coupes.filter((c) => c.debut && c.fin && c.id !== traceCoupe?.id),
    traceCoupe,
    // Mesures (aires, longueurs, nombres) des métrés cochés dans « Afficher » (et celles faites à la
    // main si « Mesures » est cochée).
    mesures: seul || seulEnLever ? [] : mesuresDuPlan(listes),
    mesureActive: null,
  };
  if (seul || seulEnLever) dessinDuPlan.coupes = [];
  if (ongletContexte === 'mesures') {
    // Onglet 3. Mesures : les mesures cochées et celle ouverte ; toucher une mesure la choisit.
    const mesureActive = ecranMesures.mesureActive();
    const mesures = mesuresDuPlan(listes);
    if (mesureActive && !mesures.some((m) => m.mesure === mesureActive)) mesures.push({ mesure: mesureActive, resultat: resultatsMesures.get(mesureActive.id) });
    plan.redessiner({
      ...dessinDuPlan,
      modeMesures: true,
      mesures,
      mesureActive,
      listeEnCours: ecranMesures.listeEnCours(),
      enEdition: ecranMesures.enModification(),
      stockActif: null,
      surface: null,
      modeTriangles: false,
      traceCoupe: null,
    });
  } else {
    // Terrain › Lever, rôle Ligne ou Contour (Intermédiaire) : toucher un point levé l'ajoute (0.78.0).
    if (toucherPourLever()) {
      const stock = stockEnCours();
      dessinDuPlan.enEdition = true;
      dessinDuPlan.listeEnCours = leveDirect.role === 'contour' ? stock.contour : ligneEnCours(stock).noms;
    }
    plan.redessiner(dessinDuPlan);
  }
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
  // Triangles en trop depuis Terrain › Lever : l'écran Terrain reste tel quel.
  if (ongletContexte === 'terrain') enDessin = false;
  const debut = enDessin && !document.body.classList.contains('mode-dessin');
  document.body.classList.toggle('mode-dessin', enDessin);
  if (!debut) return;
  // On revient à l'onglet (s'il était sur le plan seul), puis on montre la carte modifiée.
  const onglet = dansMesures ? 'mesures' : dansDessin ? 'dessins' : 'surfaces';
  if (document.body.dataset.onglet === 'plan') afficherOnglet(onglet === 'dessins' ? 'dessin' : onglet);
  requestAnimationFrame(() => document.querySelector(`#${onglet} .en-edition`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
let pointsAffiches = null;
let pointsDesListesMontres = null; // points des listes cochées (avant « Seulement l'élément à implanter »)
let seulTravail = false; // bouton « Seul » du plan (0.94.0)

/**
 * Bouton « Seul » (0.94.0) : identifiants des listes à garder sur le plan, ou null (rien à cacher ;
 * en Implanter, c'est elementSeul qui choisit). Lever : le levé en cours ; Contrôle : les points
 * de contrôle ; Guidage : la surface suivie ; ailleurs : la liste cochée dans Projet (et ses levés).
 */
function listesDuTravail(listes) {
  if (!seulTravail) return null;
  if (ongletContexte === 'terrain' && ecranLeve) {
    if (terrain.mode === 'controler') return null;
    if (terrain.mode === 'lever') return new Set(stockEnCours() ? [stockEnCours().id] : []);
    if (terrain.mode === 'autocontrole') return new Set([LISTE_CONTROLE]);
    if (terrain.mode === 'lame') return new Set(terrain.lame.surfaceId ? [terrain.lame.surfaceId] : []);
  }
  return new Set(listes.filter((l) => l.leveId && l.leveId === projet.leveActifId).map((l) => l.id));
}

/**
 * « Seulement l'élément à implanter » (case de Terrain › Implanter, 0.90.1) : ce qu'il faut garder
 * sur le plan { pointNom, surfaceId } quand la case est cochée et qu'un élément est choisi ; sinon null.
 */
function elementSeul() {
  if (!seulTravail || ongletContexte !== 'terrain' || !ecranLeve || terrain.mode !== 'controler') return null;
  if (terrain.implantation === 'point') return implanter.cible ? { pointNom: implanter.cible.nom, surfaceId: null } : null;
  if (['ligne', 'talus'].includes(terrain.implantation)) return implanter.ligne ? { pointNom: null, surfaceId: terrain.implantation === 'talus' ? terrain.talus.terrainId : null } : null;
  if (terrain.implantation === 'surface') return terrain.surfaceId ? { pointNom: null, surfaceId: terrain.surfaceId } : null;
  return null;
}
const AUCUN_POINT = [];
// Points des listes cochées : toujours le même tableau (son contenu change), pour que le plan ne
// se recadre pas à chaque point levé ou à chaque liste cochée (voir recalculer).
const POINTS_DES_LISTES = [];
function pointsStables(nouveaux) {
  const pareil = nouveaux.length === POINTS_DES_LISTES.length && nouveaux.every((p, i) => p === POINTS_DES_LISTES[i]);
  if (!pareil) {
    POINTS_DES_LISTES.length = 0;
    ajouterTous(POINTS_DES_LISTES, nouveaux);
  }
  return POINTS_DES_LISTES;
}
let nombrePointsAffiches = 0;

// --- Enregistrement automatique ---
let minuterie = null;

/** Après chaque modification : recalcule, retient l'étape (Annuler), puis enregistre un court instant plus tard. */
function modifie(options) {
  // Lecture seule : la modification est défaite tout de suite (retour à l'état d'avant).
  if (lectureSeule()) {
    projet = completerProjet(historique.relireActuel(modifications));
    appliquerAffichage(projet); // l'affichage de la tablette n'est pas une modification refusée (0.128.1)
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    recalculer(options);
    refuserEnLectureSeule();
    return;
  }
  synchroniserSurfacesDessins();
  synchroniserTalusSurfaces();
  prefixerNoms(projet);
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

/** Ligne sous le titre du projet (en-tête) : sous-titre et l'état de Drive si connecté. */
function mettreAJourEtatEntete() {
  // Titre : affaire - lieu (ou le nom, sinon « Projet sans nom 2 »…).
  document.querySelector('#titre-projet').textContent = titreProjet(projet);

  const drive = partage?.etat.connecte
    ? { 'a-jour': 'Drive ✓', envoi: 'Drive …', repris: 'Drive', rendu: 'Drive : main rendue' }[partage.etat.etat] ?? 'Drive : en attente'
    : '';
  // 0.157.0 (demande du 08.11) : plus le nombre de points et de levés, seulement le sous-titre et Drive.
  document.querySelector('#etat').textContent = sousTitreProjet(projet);
  // 0.165.0 : l'état de Drive est une pastille à gauche de la main ; discrète quand tout est à jour,
  // orange bien visible dans tous les autres cas (envoi, attente, main rendue…).
  const pastilleDrive = document.querySelector('#etat-drive');
  pastilleDrive.hidden = !drive;
  // 0.174.1 (demande du 09.11) : partout (tablette et téléphone) seulement un nuage avec un symbole dedans et une couleur :
  // vert + ✓ à jour, orange + ⟳ envoi / connexion, gris + pause (main rendue, lecture seule), rouge + ! (erreur, attente).
  const etatDrive = partage?.etat.connecte ? partage.etat.etat : null;
  const SYMBOLES = {
    'a-jour': ['ok', '<path d="M8.6 14.2l2.4 2.4 4.6-4.8" />'],
    envoi: ['envoi', '<path d="M12 17v-6M9.5 13.2L12 10.6l2.5 2.6" />'],
    connexion: ['envoi', '<path d="M12 17v-6M9.5 13.2L12 10.6l2.5 2.6" />'],
    rendu: ['pause', '<path d="M10.2 11.5v5M13.8 11.5v5" />'],
    repris: ['pause', '<path d="M10.2 11.5v5M13.8 11.5v5" />'],
  };
  const [classeDrive, symbole] = SYMBOLES[etatDrive] ?? ['alerte', '<path d="M12 11v3.2M12 16.8v.1" />'];
  pastilleDrive.hidden = !drive;
  pastilleDrive.classList.remove('etat-drive-ok', 'etat-drive-envoi', 'etat-drive-pause', 'etat-drive-alerte');
  pastilleDrive.classList.add(`etat-drive-${classeDrive}`);
  pastilleDrive.innerHTML = drive
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nuage" d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.2 4.4 4.4 0 0 1 17.5 18z" />${symbole}</svg>`
    : '';
  pastilleDrive.title = drive;
  // 0.213.0 : nuage barré quand Drive ne peut pas travailler : rouge hors ligne (le récepteur peut recevoir, pas Drive),
  // gris quand Google n'est pas connecté. Toucher le nuage ouvre les réglages Drive.
  const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false;
  const driveNonConnecte = Boolean(partage) && !partage.etat.connecte;
  const nuageBarre = horsLigne ? 'hors-ligne' : driveNonConnecte ? 'non-connecte' : null;
  if (nuageBarre && partage) {
    pastilleDrive.hidden = false;
    pastilleDrive.classList.remove('etat-drive-ok', 'etat-drive-envoi', 'etat-drive-pause', 'etat-drive-alerte', 'etat-drive-hors-ligne', 'etat-drive-non-connecte');
    pastilleDrive.classList.add(`etat-drive-${nuageBarre}`);
    pastilleDrive.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nuage" d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.2 4.4 4.4 0 0 1 17.5 18z" /><path class="barre-nuage" d="M4 4L20 20" /></svg>';
    pastilleDrive.title = horsLigne ? 'Hors ligne : Drive ne reçoit rien, les modifications restent sur la tablette (toucher : réglages Drive)' : 'Drive non connecté : toucher pour connecter Google';
  } else {
    pastilleDrive.classList.remove('etat-drive-hors-ligne', 'etat-drive-non-connecte');
  }
  // La page Applications ouverte montre le projet à jour dans son encadré.
  navigation?.mettreAJour();

  // Verrou du partage : main verte (on a la main) ou « 🔒 Lecture seule · Tablette Paul » en rouge
  // (un autre appareil l'a ; toucher = prendre la main). Rien sans Drive.
  const pastille = document.querySelector('#pastille-verrou');
  const repris = partage?.etat.connecte && partage.etat.repris?.projetId === projet.id ? partage.etat.repris : null;
  pastille.hidden = !partage?.etat.connecte;
  // Main rendue (bouton, ou 5 minutes sans rien faire) : « 🔒 Lecture seule · main rendue » en gris ; toucher = la reprendre.
  const rendu = partage?.etat.connecte && partage.etat.rendu?.projetId === projet.id;
  if (repris) pastille.textContent = `🔒 ${repris.nom} a la main`;
  else if (rendu) pastille.textContent = '🔒 Lecture seule · main rendue';
  else pastille.innerHTML = `<svg class="main-verrou" viewBox="0 0 24 24" aria-hidden="true">${ICONE_MAIN}</svg>`;
  pastille.className = `pastille-entete ${repris ? 'pastille-rouge' : rendu ? 'pastille-grise' : 'pastille-verte'}`;
  pastille.classList.toggle('pastille-inactive', !aAcces('expert'));
  pastille.title = !aAcces('expert') ? (repris ? `${repris.nom} a la main` : rendu ? 'Main rendue' : 'Tu as la main') : repris ? 'Lecture seule : toucher pour prendre la main' : rendu ? 'Main rendue : toucher pour la reprendre' : 'Tu as la main : toucher pour la rendre';
  document.body.classList.toggle('lecture-seule', Boolean(repris || rendu));
}
// 0.213.0 : toucher le nuage = réglages Drive (connecter Google, voir l'état). Le réseau qui part ou revient met le nuage à jour.
document.querySelector('#etat-drive').addEventListener('click', () => ouvrirFenetreReglages('drive'));
window.addEventListener('offline', () => mettreAJourEtatEntete());
window.addEventListener('online', () => mettreAJourEtatEntete());
// Main de l'en-tête (0.76.0) : rouge = prendre la main (Expert, code), grise = la reprendre,
// verte = la rendre (le projet part sur Drive, un autre appareil peut la prendre).
// Depuis 0.90.0, seulement en Expert : en Base et Intermédiaire on voit la main sans pouvoir la toucher.
document.querySelector('#pastille-verrou').addEventListener('click', async () => {
  if (!aAcces('expert')) return;
  if (partage?.etat.repris?.projetId === projet.id) partage.prendreLaMain();
  else if (partage?.etat.rendu?.projetId === projet.id) partage.reprendreApresRendu();
  else if (partage?.etat.connecte) {
    const choix = await demanderChoix({
      titre: 'Rendre la main ?',
      texte: 'Le projet part sur Drive ; un autre appareil peut alors le reprendre.',
      boutons: [
        { cle: 'rendre', texte: 'Rendre la main', principal: true },
        { cle: 'garder', texte: 'Garder la main' },
      ],
    });
    if (choix === 'rendre') partage.rendreLaMain('rendue à la main');
  }
});

// Fenêtre d'attente (0.76.0) : un autre appareil a pris la main sur le projet ouvert. Elle se
// ferme toute seule quand il la rend (le projet est alors repris de Drive, avec la main).
let fermetureAttente = null;
async function montrerAttenteMain(verrou) {
  fermetureAttente?.abort();
  fermetureAttente = new AbortController();
  const choix = await demanderChoix({
    titre: `${verrou.nom} a la main`,
    texte: 'Ce projet est en attente : il sera mis à jour et tu reprendras la main dès qu\'elle sera rendue.',
    boutons: [
      { cle: 'lecture', texte: 'Voir en lecture seule', detail: 'voir et implanter, sans rien enregistrer', principal: true },
      { cle: 'autre', texte: 'Ouvrir un autre projet' },
    ],
    signal: fermetureAttente.signal,
  });
  if (choix === 'autre') ouvrirPartieProjet('ouvrir');
}

/** Vrai si un autre appareil a la main sur le projet ouvert : rien ne s'enregistre (0.76.0). */
function lectureSeule() {
  // Synchronisation avec Drive en cours (0.92.1) : rien ne se modifie avant qu'elle soit finie.
  if (partage?.etat.synchroEnCours) return true;
  // Main rendue (0.80.0) : lecture seule aussi, jusqu'à la reprendre (main grise).
  return Boolean(partage?.etat.connecte && (partage.etat.repris?.projetId === projet.id || partage.etat.rendu?.projetId === projet.id));
}

/**
 * « En attente de synchronisation » (0.92.1, demande du 29.10.2026) : au démarrage et à l'ouverture
 * d'un projet, l'écran est bloqué tant que Drive n'a pas été comparé. Après 15 s (pas de réseau…),
 * « Continuer sans synchroniser » : l'écran se libère, mais le projet reste en lecture seule
 * jusqu'à la fin de la synchronisation (voir lectureSeule).
 */
const ATTENTE_AVANT_CONTINUER = 15_000;
let attenteSynchro = null; // { element, minuterie, ignoree }
function montrerAttenteSynchro() {
  const enCours = Boolean(partage?.etat.synchroEnCours);
  if (!enCours) {
    if (attenteSynchro) {
      clearTimeout(attenteSynchro.minuterie);
      attenteSynchro.element.remove();
      attenteSynchro = null;
    }
    return;
  }
  if (attenteSynchro) return;
  const element = document.createElement('div');
  element.className = 'attente-synchro';
  element.setAttribute('role', 'alertdialog');
  element.setAttribute('aria-label', 'En attente de synchronisation');
  element.innerHTML = `<div class="boite-attente-synchro">
      <span class="roue-attente" aria-hidden="true"></span>
      <strong>En attente de synchronisation</strong>
      <span class="aide">Google Drive</span>
      <button type="button" class="bouton-secondaire" data-action="continuer-sans-synchro" hidden>Continuer sans synchroniser</button>
    </div>`;
  element.querySelector('[data-action="continuer-sans-synchro"]').addEventListener('click', () => {
    element.hidden = true;
    afficherMessage('Lecture seule tant que Drive n\'est pas synchronisé', 4000);
  });
  document.body.append(element);
  attenteSynchro = {
    element,
    minuterie: setTimeout(() => {
      const bouton = element.querySelector('[data-action="continuer-sans-synchro"]');
      if (bouton) bouton.hidden = false;
    }, ATTENTE_AVANT_CONTINUER),
  };
}

/** En lecture seule : message et vrai (l'action est refusée). */
function refuserEnLectureSeule() {
  if (!lectureSeule()) return false;
  afficherMessage(partage.etat.repris ? `Lecture seule : ${partage.etat.repris.nom} a la main` : 'Lecture seule : main rendue', 3000);
  vibrer([80, 80, 80]);
  return true;
}

// Pastille « Contrôle à refaire » (0.188.1, demande du 10.11) : toujours à l'écran, sous la barre du récepteur, tant que
// cette tablette n'a pas fait son contrôle (récepteur connecté) ; elle n'apparaît qu'après 10 s de « contrôle à faire »
// de suite (pas de clignotement à l'ouverture ou à la connexion). La toucher ouvre Terrain › Contrôle.
const DELAI_PASTILLE_CONTROLE_MS = 10_000;
let controleAFaireDepuis = null;
function mettreAJourPastilleControle() {
  let pastille = document.querySelector('#pastille-controle');
  const enControle = ongletContexte === 'terrain' && terrain.mode === 'autocontrole';
  const afaire = recepteurDisponible() && Boolean(etatRecepteur?.connecte) && Boolean(projet) && !enControle
    && controleNecessaire(projet.controles, new Date(), delaiControleMs(projet), nomDeLAppareil());
  if (!afaire) controleAFaireDepuis = null;
  else if (controleAFaireDepuis == null) controleAFaireDepuis = Date.now();
  const visible = afaire && Date.now() - controleAFaireDepuis >= DELAI_PASTILLE_CONTROLE_MS;
  if (!visible) {
    pastille?.remove();
    return;
  }
  if (pastille) return;
  pastille = document.createElement('button');
  pastille.id = 'pastille-controle';
  pastille.type = 'button';
  pastille.className = 'pastille-controle';
  pastille.innerHTML = '<span>Contrôle</span><span>à refaire</span>'; // 0.214.0 : sur le tiers bas du logo du récepteur
  pastille.setAttribute('aria-label', 'Contrôle à refaire : ouvrir le Contrôle');
  pastille.addEventListener('click', () => {
    terrain.mode = 'autocontrole';
    retenirReglagesTerrain();
    afficherOnglet('terrain');
    recalculer();
  });
  (document.querySelector('.entete') ?? document.body).append(pastille);
}
setInterval(mettreAJourPastilleControle, 1000);

// 0.214.0 : mesure de durée (appui long sur « Enreg. » : 5 / 15 / 30 s) ; en Contrôle, 5 s d'office.
installerMesureDuree({
  disponible: () => recepteurDisponible() && Boolean(etatRecepteur?.connecte),
  dureeParDefaut: () => (enAutocontrole() && document.body.dataset.onglet === 'terrain' ? 5 : 0),
  refuser: (texte) => refuser(texte),
});

// Rappel du contrôle aussi pendant le travail (0.90.0) : GNSS connecté, une fois la durée entre deux
// contrôles passée depuis le dernier rappel (pas seulement à la connexion du récepteur).
setInterval(() => {
  if (etatRecepteur?.connecte && Date.now() - dernierRappel >= delaiControleMs(projet)) proposerControle();
}, 60_000);

// Site (pas l'APK) : après 5 minutes sans rien faire, le projet est envoyé et la main rendue
// (demande du 26.10.2026) : lecture seule jusqu'à la reprendre (main grise, 0.80.0).
const INACTIVITE = 5 * 60 * 1000;
let derniereActivite = Date.now();
// Base et Intermédiaire (0.90.0) : la main ne se touche pas ; après 5 minutes sans activité, elle
// est reprise toute seule au premier geste.
let derniereReprise = 0;
/** Popup « Lecture seule » (0.123) : se ferme toute seule dès que la main est reprise. */
async function montrerPopupLectureSeule() {
  if (fermerPopupLectureSeule) return;
  const arret = new AbortController();
  fermerPopupLectureSeule = () => arret.abort();
  const choix = await demanderChoix({
    titre: 'Lecture seule',
    texte: 'Tu n\'as plus la main sur le projet (5 minutes sans activité). Touche l\'écran pour la reprendre.',
    boutons: [{ cle: 'reprendre', texte: 'Reprendre la main', principal: true }],
    signal: arret.signal,
  });
  fermerPopupLectureSeule = null;
  if (choix === 'reprendre') partage?.reprendreApresRendu();
}
for (const evenement of ['pointerdown', 'keydown', 'wheel']) {
  document.addEventListener(evenement, () => {
    derniereActivite = Date.now();
    // Une seule demande à la fois (la reprise passe par Drive) : pas plus d'une toutes les 10 s.
    // Expert : la main se reprend toute seule seulement après un repos du site (0.123, popup ci-dessous).
    if ((aAcces('expert') && !renduParInactivite) || partage?.etat.rendu?.projetId !== projet.id || Date.now() - derniereReprise < 10_000) return;
    derniereReprise = Date.now();
    partage.reprendreApresRendu();
  }, { passive: true, capture: true });
}
setInterval(() => {
  if (estDansAppliAndroid() || !partage?.etat.connecte) return;
  if (Date.now() - derniereActivite < INACTIVITE) return;
  if (partage.etat.rendu?.projetId === projet.id || partage.etat.repris?.projetId === projet.id) return;
  partage.rendreLaMain('rendue après 5 minutes sans activité').then(() => {
    if (partage.etat.rendu?.projetId !== projet.id) return;
    renduParInactivite = true;
    montrerPopupLectureSeule();
  });
}, 30_000);

/** Petit message sous l'en-tête, qui disparaît tout seul après "duree" millisecondes (null : il reste). */
let minuterieMessage = null;
function afficherMessage(texte, duree = 2000) {
  let zone = document.querySelector('#message-flottant');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'message-flottant';
    zone.className = 'message-flottant';
    zone.setAttribute('role', 'status');
    // 0.126.0 : en bas de l'écran, fermé d'un toucher (avant : en haut, il cachait des boutons).
    zone.addEventListener('click', () => (zone.hidden = true));
    document.body.append(zone);
  }
  zone.textContent = texte;
  zone.hidden = false;
  clearTimeout(minuterieMessage);
  if (duree !== null) minuterieMessage = setTimeout(() => (zone.hidden = true), duree);
}

async function enregistrer() {
  noterAffichage(projet); // affichage gardé par appareil (0.128)
  projet.modifieLe = new Date().toISOString();
  try {
    await stockage.enregistrerProjet(projet);
    stockage.memoriserDernierProjet(projet.id);
    // Seul le résumé du projet ouvert change : on ne relit pas tous les projets de l'appareil
    // (trop lent avec des plans DXF et des photos).
    mettreAJourResume(projet);
    afficherSiVisible('projet', document.querySelector('.panneau[data-onglet="projets"]'), afficherEcranProjet);
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
  // Import (Expert), sinon le contenu du projet : sa page à part (0.159.0).
  ouvrirPartieProjet(aAcces('expert') ? 'import' : 'points');
}

/**
 * Ouvre un projet : il devient le projet affiché, et il est enregistré.
 * Puis on va à la page Applications (0.159.0).
 */
// La fenêtre des libellés range ceux « de ce projet seulement » dans le projet (0.105.6).
surLibellesProjet((libelles) => {
  projet.libelles = libelles;
  modifie();
});

let dernierProjetNote = null; // dernier projet noté « ouvert » dans le journal de l'appareil
let dernierProjetFond = null; // 0.213.0 : projet pour lequel le fond de plan a été remis au départ
async function ouvrir(nouveau, { changerOnglet = true } = {}) {
  projet = nouveau;
  // 0.213.0 : à chaque ouverture d'un autre projet, le fond ortho est coché, transparent à 60 % (pas à chaque version reçue de Drive).
  if (projet.id !== dernierProjetFond) {
    dernierProjetFond = projet.id;
    plan.remettreFond();
  }
  // 0.128 : listes de points et plans / calques DXF masqués = choix de CET appareil, gardés au
  // redémarrage et jamais repris d'une autre tablette (aussi pour une version reçue de Drive).
  appliquerAffichage(projet);
  // Cadastre (0.116.4) : plan DXF relié à sa liste de points.
  lierCadastres(projet);
  // Anciens projets : un libellé absent de la liste mais utilisé par des points est recréé, pour ce projet seulement (0.105.5).
  definirLibellesProjet(projet.libelles);
  const recrees = recreerLibellesManquants(projet.leves.flatMap((l) => l.points.map((p) => p.nom)));
  if (recrees) projet.libelles = recrees;
  implanter.choix = null;
  implanter.cible = null;
  implanter.pointsLigne = [];
  implanter.ligne = null;
  implanter.ligneAValider = false;
  implanter.talusId = null;
  autocontrole.cible = null;
  dernierImport = null;
  editeurSurfaces.charger(projet.surfaces);
  montrerUneSurfaceDuLeve();
  recalculer({ recadrer: true });
  historique.reinitialiser(modifications, projet);
  mettreAJourAnnuler();
  // 0.159.0 : après l'ouverture d'un projet, la page Applications (menu de départ).
  if (changerOnglet) afficherOnglet('projets');
  await enregistrer();
  // Journal de l'appareil (0.119.0) : une ouverture par projet ouvert (pas à chaque nouvelle
  // version reçue de Drive pour le même projet).
  if (projet.id !== dernierProjetNote) {
    dernierProjetNote = projet.id;
    noterJournal({ type: 'ouverture' });
  }
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

// --- Démarrage : fenêtre « Continuer sur… / Ouvrir un projet / Nouveau projet » (0.84.0) ---
// L'appli s'ouvre sur l'onglet Projet. Le dernier projet ouvert sur cet appareil (sinon le plus
// récent) est chargé tout de suite ; Drive ne le compare qu'après le choix.
async function demarrer() {
  afficherOnglet('projets');
  adapterAuMode();
  stockage.demanderStockagePersistant();
  try {
    await rafraichirListe();
    const id = stockage.dernierProjet();
    const lu = (id && (await stockage.lireProjet(id))) || (resumes[0] && (await stockage.lireProjet(resumes[0].id)));
    await ouvrir(lu ? completerProjet(lu) : nouveauProjetSansNom(), { changerOnglet: false });
    // Premier lancement (aucun projet sur l'appareil) : rien à demander.
    const choix = lu ? await demanderChoix({
      titre: 'Que veux-tu faire ?',
      boutons: [
        { cle: 'continuer', texte: `Continuer sur « ${titreProjet(projet)} »`, detail: 'le dernier projet ouvert sur cette tablette', principal: true },
        { cle: 'ouvrir', texte: 'Ouvrir un projet', classe: 'choix-ouvrir-projet' },
        ...(aAcces('intermediaire') ? [{ cle: 'nouveau', texte: 'Nouveau projet' }] : []),
      ],
    }) : 'continuer';
    // Partage : on se reconnecte à Drive si on l'était (le projet ouvert est alors comparé à Drive).
    partage.demarrer({ choixEnAttente: choix !== 'continuer' });
    // 0.157.0 : la page Applications est le menu de départ.
    if (choix === 'continuer') navigation.ouvrirPage();
    if (choix === 'ouvrir') ouvrirPartieProjet('ouvrir');
    else if (choix === 'nouveau') creerNouveauProjet();
  } catch (erreur) {
    // Base de données indisponible (navigation privée...) : l'appli marche, sans enregistrement.
    console.error(erreur);
    recalculer({ recadrer: true });
    historique.reinitialiser(modifications, projet);
    document.querySelector('#etat').textContent = 'Attention : enregistrement impossible sur cet appareil';
  }
}
suivreClavier();
demarrer();
