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
import { creerEcranProjet } from './projet/ecran.js';
import { creerEcranImport } from './import/ecran.js';
import { creerEcranCoupes } from './coupes/ecran.js';
import { creerEcranMesures } from './mesures/ecran.js';
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
  projetSansTitre,
  EXEMPLE_TITRE,
  sousTitreProjet,
  nomDeFichierProjet,
} from './projet/projet.js';
import * as stockage from './projet/stockage.js';
import { creerPartage } from './partage/partage.js';
import * as historique from './projet/historique.js';
import { bulle, installerAide } from './aide/bulles.js';
import { creerEcranLeve, mettreAJourBandeaux, LONGUEURS_COUPE } from './leve/ecran.js';
import { creerSuiviOrientation } from './leve/orientation.js';
import { ecouterBoussole } from './leve/boussole.js';
import { lireLibelles, enregistrerLibelles } from './leve/libelles.js';
import { altitudeSurSurface, ecartSurface, classeEcart, extremitesCoupe } from './topo/implantation.js';
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
import { appliquerReglages, ouvrirReglages } from './reglages/reglages.js';
import { sonValidation, sonRefus } from './outils/son.js';
import { listesDePoints, pointsDesListes, montrerListe } from './plan/listes-points.js';
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
  ...lireReglagesTerrain(),
};
// Implantation d'un point : point choisi en touchant le plan ({ est, nord, altitude, nom, mode }) et
// point à implanter en cours ({ id (point de la liste « À implanter », ou null), nom, est, nord, altitude }).
// Implantation d'une ligne : points choisis pour la faire (pointsLigne : [{ est, nord, altitude, nom }])
// et ligne en cours (ligne : { nom, sommets, segmentTouche, segment (n° ou null : toute la ligne),
// inverse, decalage (m, + à droite), altitudes: { debut, fin } (tapées, ou null) }).
const implanter = { choix: null, cible: null, pointsLigne: [], ligne: null };
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
const ONGLETS = [
  { nom: 'projets', titre: 'Projet' },
  ...(recepteurDisponible() ? [{ nom: 'terrain', titre: 'Terrain' }] : []),
  { nom: 'calculs', titre: 'Calculs / métrés' },
  { nom: 'plan', titre: 'Plan' },
];
// Les trois parties de l'onglet Calculs (ce sont aussi les noms de leurs panneaux) : Surfaces et
// Volumes vont ensemble (un même cadre), Mesures / métrés est à part.
const PARTIES_CALCULS = [
  ['surfaces', 'Surfaces'],
  ['volumes', 'Volumes'],
  ['mesures', 'Mesures / métrés'],
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

// Réglages de cet appareil (roue ⚙) : mode téléphone, bulles d'aide, nom de l'appareil.
appliquerReglages();
document.querySelector('#bouton-reglages').addEventListener('click', () => {
  ouvrirReglages({
    nomAppareil: partage?.appareil().nom,
    nommerAppareil: partage ? (nom) => partage.nommerAppareil(nom) : null,
    aideActive: document.body.classList.contains('aide-active'),
    basculerAide: () => document.querySelector('#bouton-aide').click(),
    fermerAppli: estDansAppliAndroid() && typeof window.AppliAndroid.fermerAppli === 'function' ? fermerAppli : null,
  });
});

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
        avertissements.push('Ce plan ne semble pas être en MN95 (Est 2 480 000 à 2 840 000, Nord 1 070 000 à 1 300 000) : il est affiché tel quel, sans recalage.');
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
    requestAnimationFrame(() => plan.cadrerSurPlans([choisi]));
  },
  supprimerPlanDxf: (id) => {
    const choisi = projet.plansDxf.find((p) => p.id === id);
    if (!choisi || !confirm(`Supprimer le plan « ${choisi.nom} » du projet ?`)) return;
    projet.plansDxf = projet.plansDxf.filter((p) => p.id !== id);
    dernierPlan = null;
    modifie();
  },
  reglerPlanDxf: (id, changements) => reglerPlanDxf(id, changements),
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

const ecranLeve = recepteurDisponible()
  ? creerEcranLeve(document.querySelector('#leve-direct'), {
      choisirRecepteur,
      // Corrections par internet (swipos) : seulement avec un APK qui sait le faire.
      lireReglagesCorrections: () => (correctionsDisponibles() ? lireReglagesCorrections() : null),
      demarrerCorrections: (reglages) => {
        demarrerCorrections(reglages);
        afficherMessage('Corrections : connexion à swipos…');
        setTimeout(() => ecranLeve.afficher(donneesLeve()), 300); // bouton « Redémarrer », mot de passe enregistré
      },
      arreterCorrections: () => {
        arreterCorrections();
        afficherMessage('Corrections arrêtées : Emlid Flow peut reprendre');
        setTimeout(() => ecranLeve.afficher(donneesLeve()), 300);
      },
      reconnecter: reconnecterRecepteur,
      deconnecter: deconnecterRecepteur,
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
        terrain.mode = mode === 'controler' ? 'controler' : 'lever';
        retenirReglagesTerrain();
        if (terrain.mode === 'controler') montrerSurfaceControle();
        recalculer();
      },
      choisirImplantation: (quoi) => {
        terrain.implantation = ['point', 'ligne'].includes(quoi) ? quoi : 'surface';
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
        implanter.pointsLigne = [];
        montrerImplantation();
      },
      changerLigne: () => {
        implanter.ligne = null;
        montrerImplantation();
      },
      choisirSegment: (choix) => {
        const ligne = implanter.ligne;
        if (!ligne) return;
        const nombre = ligne.sommets.length - 1;
        if (choix === 'tout') ligne.segment = null;
        else if (choix === 'segment') ligne.segment = ligne.segmentTouche ?? 0;
        else if (ligne.segment != null) ligne.segment = Math.max(0, Math.min(nombre - 1, ligne.segment + (choix === 'suivant' ? 1 : -1)));
        montrerImplantation();
      },
      inverserLigne: () => {
        if (!implanter.ligne) return;
        implanter.ligne.inverse = !implanter.ligne.inverse;
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
        montrerImplantation();
      },
      choisirAccroche: (mode) => {
        if (terrain.implantation === 'ligne') {
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
      enregistrerImplantation: () => {
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
  const accrocheActive = ((enImplantationDePoint() || enImplantationDeLigne()) && ongletContexte === 'terrain') || pointage.actif;
  const enLigne = accrocheActive && !pointage.actif && enImplantationDeLigne();
  const sommets = enLigne && implanter.ligne ? sommetsDeLaLigne() : null;
  // Lignes des levés « Autres » cochés dans le menu « Points » (ce ne sont pas des surfaces).
  const lignesAutres = lignesDesAutres();
  plan.afficherImplantation(accrocheActive || projet.aImplanter.length > 0 || lignesAutres.length > 0
    ? {
        actif: accrocheActive,
        aImplanter: projet.aImplanter,
        lignesAutres,
        choix: pointage.actif ? pointage.choix : accrocheActive && !enLigne ? implanter.choix : null,
        cible: accrocheActive && !enLigne ? implanter.cible : null,
        // Ligne : la ligne choisie (début, fin), sa parallèle s'il y a un décalage, les points en préparation.
        ligne: sommets ? { sommets, parallele: implanter.ligne.decalage ? ligneParallele(sommets, implanter.ligne.decalage) : null } : null,
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
  const coins = implanter.ligne && terrain.implantation === 'ligne' ? [...implanter.ligne.sommets] : implanter.cible ? [implanter.cible] : [];
  const position = etatRecepteur?.connecte && etatRecepteur.recu ? etatRecepteur.position : null;
  // La canne aussi, si elle est assez près (sinon le point serait tout petit à l'écran).
  if (position && coins.length > 0 && Math.hypot(position.est - coins[0].est, position.nord - coins[0].nord) < 300) coins.push(position);
  plan.cadrerSur(coins, 10);
}

/**
 * Implantation d'une ligne : texte écrit à côté de la canne sur le plan, la position le long de la
 * ligne (depuis le début) et le décalage de la canne (à droite ou à gauche de la ligne), ou null.
 */
function etiquetteLigne(implantationLigne) {
  const l = implantationLigne?.ligne;
  if (!l || implantationLigne.message) return null;
  const decalage = Math.abs(l.ecart) < 0.0005 ? 'sur la ligne' : `${formaterNombre(Math.abs(l.ecart))} m ${l.ecart > 0 ? 'à droite' : 'à gauche'}`;
  let le_long = `Début + ${formaterNombre(l.abscisse)} m`;
  if (l.abscisse < 0) le_long = `Avant le début ${formaterNombre(-l.abscisse)} m`;
  else if (l.abscisse > l.longueur) le_long = `Après la fin ${formaterNombre(l.abscisse - l.longueur)} m`;
  return [le_long, decalage];
}

/** Vrai pendant l'implantation d'un point (Terrain › Implanter › Point). */
function enImplantationDePoint() {
  return Boolean(ecranLeve) && terrain.mode === 'controler' && terrain.implantation === 'point';
}

/** Vrai pendant l'implantation d'une ligne (Terrain › Implanter › Ligne). */
function enImplantationDeLigne() {
  return Boolean(ecranLeve) && terrain.mode === 'controler' && terrain.implantation === 'ligne';
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
  const g = guidageLigne(position, sommetsDeLaLigne(), { decalageVoulu: ligne.decalage, altitudes: ligne.altitudes });
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
  const g = guidageLigne(mesure, sommetsDeLaLigne(), { decalageVoulu: ligne.decalage, altitudes: ligne.altitudes });
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

/** Toucher du plan pendant l'implantation d'une ligne : une ligne du DXF, ou un point de plus. */
function toucherPourLigne(position, tolerance) {
  const mm = (p) => ({ ...p, est: Math.round(p.est * 1000) / 1000, nord: Math.round(p.nord * 1000) / 1000, altitude: p.altitude != null ? Math.round(p.altitude * 1000) / 1000 : null });
  if (terrain.accrocheLigne === 'trait') {
    const trouve = accrocherTrait(position, tolerance, sourcesDesPlans(projet.plansDxf ?? [], position, tolerance).lignes);
    if (!trouve) {
      afficherMessage('Aucune ligne DXF sous le doigt', 3000);
      return;
    }
    const sommets = trouve.sommets.map(mm);
    const nombre = sommets.length - 1;
    implanter.ligne = nouvelleLigneAImplanter(`Ligne DXF (${nombre} segment${nombre > 1 ? 's' : ''})`, sommets, trouve.segment);
    implanter.pointsLigne = [];
  } else {
    const sources = terrain.accrocheLigne === 'point'
      ? { lignes: [], cercles: [], points: pointsDuProjet() }
      : sourcesDesPlans(projet.plansDxf ?? [], position, tolerance);
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
  for (const point of [...projet.leves.flatMap((l) => l.points), ...projet.aImplanter]) {
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
    : sourcesDesPlans(projet.plansDxf ?? [], position, tolerance);
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
  const trouve = accrocher(pointage.accroche, position, tolerance, sourcesDesPlans(projet.plansDxf ?? [], position, tolerance));
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
function calculerImplantation(etat, orientation) {
  const cible = implanter.cible;
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
  const implanterAvecTouche = dansTerrain && ((enImplantationDePoint() && Boolean(implanter.cible)) || (enImplantationDeLigne() && Boolean(implanter.ligne)));
  const actif = lever || implanterAvecTouche;
  if (actif === toucheVolumeActive) return;
  toucheVolumeActive = actif;
  regleToucheVolume(actif, () => {
    const enImplantation = enImplantationDePoint() || enImplantationDeLigne();
    const refus = enImplantation ? ecranLeve.enregistrerDepuisTouche() : ecranLeve.prendreDepuisTouche();
    if (refus) {
      navigator.vibrate?.([80, 80, 80]);
      sonRefus();
      afficherMessage(`${enImplantation ? 'Implantation refusée' : 'Point refusé'} : ${refus}`, 4000);
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
    stocks: [...surfacesLevees(), ...projet.metres, ...projet.autres].map((s) => ({ id: s.id, nom: `${s.nom} · ${jourDuLeve(s.leveId)}` })),
    libelles,
    libelleLigne: terrain.libelleLigne,
    libellePoint: terrain.libellePoint,
    libelleAire: terrain.libelleAire,
    mode: terrain.mode,
    controle: terrain,
    surfaces: projet.surfaces.map((s) => ({ id: s.id, etiquette: etiquetteSurface(s) })),
    implanter: {
      accroche: terrain.accroche,
      choix: implanter.choix,
      cible: implanter.cible,
      nomPropose: nomProposeImplantation(),
      aImplanter: projet.aImplanter.map((p) => {
        const derniere = [...projet.implantations].reverse().find((i) => i.aImplanterId === p.id);
        return { ...p, fait: derniere ? { distance: derniere.ecarts.distance, dAltitude: derniere.ecarts.dAltitude } : null };
      }),
      nbImplantations: projet.implantations.length,
      nomsPoints: enImplantationDePoint() || enImplantationDeLigne() ? pointsDuProjet().map((p) => p.nom) : [],
      accrocheLigne: terrain.accrocheLigne,
      pointsLigne: implanter.pointsLigne,
      ligne: implanter.ligne ? resumeLigne() : null,
      nomPointAjoute: nomPointAjoute(projet),
      // Point choisi qui est déjà un point du projet (pas de « + Point du projet »).
      choixDuProjet: Boolean(implanter.choix?.nom && pointsDuProjet().some((p) => p.nom === implanter.choix.nom)),
    },
  };
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
    altitudes: ligne.altitudes,
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
    etatRecepteur = etat;
    mettreAJourBandeaux(etat);
    const orientation = suiviOrientation.ajouter(etat, performance.now());
    const enPoint = enImplantationDePoint();
    const enLigne = enImplantationDeLigne();
    const controle = terrain.mode === 'controler' && !enPoint && !enLigne ? calculerControle(etat, orientation) : null;
    const implantation = enPoint ? calculerImplantation(etat, orientation) : null;
    const implantationLigne = enLigne ? calculerImplantationLigne(etat) : null;
    ecranLeve.mettreAJourRecepteur(etat, { orientation, controle, implantation, implantationLigne });
    const position = etat.connecte && etat.recu ? etat.position : null;
    // Coupes affichées (mode Implanter) : leur trait en pointillés sur le plan.
    const vues = { les2: ['perpendiculaire', 'axe'], perpendiculaire: ['perpendiculaire'], axe: ['axe'] }[terrain.vueCoupes] ?? [];
    const traits = controle?.coupes ? vues.map((sens) => ({ sens, debut: controle.coupes[sens].debut, fin: controle.coupes[sens].fin })) : [];
    // Ligne : trait en pointillés jusqu'au point de la ligne en face de la canne.
    const vers = implantationLigne?.ligne?.cible ?? null;
    plan.afficherPosition(position ? { est: position.est, nord: position.nord, prete: Boolean(etat.inclinaisonPrete), azimut: orientation.azimut, coupes: traits, vers, etiquette: etiquetteLigne(implantationLigne) } : null);
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
  continuer: () => {
    // Nouveau projet (ni levé ni plan DXF) : on reste sur l'onglet Projet, aux imports
    // (demande du 23.10.2026) ; on va au terrain par l'onglet Terrain.
    if (projet.leves.length === 0 && (projet.plansDxf ?? []).length === 0) {
      document.activeElement?.blur?.();
      document.querySelector('#importer')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    allerA(etapeUtile());
  },
  exporterProjet: async (id) => {
    const lu = id === projet.id ? projet : await stockage.lireProjet(id);
    if (!lu) return;
    const complet = completerProjet(lu);
    telecharger(new Blob([ecrireFichierProjet(complet)], { type: 'application/json' }), `${nomDeFichierProjet(complet)}.topo.json`);
  },
  // Nouveau projet : on reste sur l'onglet Projet, curseur dans « Affaire ».
  nouveauProjet: async () => {
    await changerDeProjet(() => ouvrir(creerProjet(), { changerOnglet: false }));
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
    await ouvrir(restants[0] ? completerProjet(restants[0]) : creerProjet(), { changerOnglet: false });
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
  ouvrirProjet: (nouveau) => ouvrir(completerProjet(nouveau), { changerOnglet: false }),
  garderCopie: async (local) => {
    const copie = dupliquerProjet(completerProjet(local), `${local.nom || titreProjet(local)} (copie de cet appareil)`);
    await stockage.enregistrerProjet(copie);
    mettreAJourResume(copie);
  },
  quandChange: () => {
    afficherEcranProjet();
    mettreAJourEtatEntete();
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
  ecranImport.afficher(projet, dernierImport, dernierPlan);
  plan.afficherPlansDxf(projet.plansDxf ?? []);
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
    // Onglet Terrain, métré en cours : ses aires, longueurs et points comptés.
    mesures: ongletContexte === 'terrain' && terrain.mode === 'lever' && metreEnCours()
      ? projet.mesures.filter((m) => m.metreId === metreEnCours().id).map((mesure) => ({ mesure, resultat: resultatsMesures.get(mesure.id) }))
      : [],
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
  const enDessin = dansMesures ? ecranMesures.enModification() : editeurSurfaces.enModification();
  const debut = enDessin && !document.body.classList.contains('mode-dessin');
  document.body.classList.toggle('mode-dessin', enDessin);
  if (!debut) return;
  // On revient à l'onglet (s'il était sur le plan seul), puis on montre la carte modifiée.
  const onglet = dansMesures ? 'mesures' : 'surfaces';
  if (document.body.dataset.onglet === 'plan') afficherOnglet(onglet);
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

function mettreAJourAnnuler() {
  boutonAnnuler.disabled = !historique.peutAnnuler(modifications);
  boutonRetablir.disabled = !historique.peutRetablir(modifications);
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
boutonAnnuler.addEventListener('click', annulerModification);
boutonRetablir.addEventListener('click', retablirModification);

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
  // Titre : affaire - lieu (ou le nom) ; tant que rien n'est tapé, un exemple en gris.
  const titre = document.querySelector('#titre-projet');
  const sansTitre = projetSansTitre(projet);
  titre.textContent = sansTitre ? EXEMPLE_TITRE : titreProjet(projet);
  titre.classList.toggle('titre-exemple', sansTitre);

  const points = leveActif(projet)?.points ?? AUCUN_POINT;
  const drive = partage?.etat.connecte
    ? { 'a-jour': 'Drive ✓', envoi: 'Drive …', repris: 'Drive' }[partage.etat.etat] ?? 'Drive : en attente'
    : '';
  document.querySelector('#etat').textContent = [sousTitreProjet(projet), `${points.length} points`, `${surfacesAffichees().length} surface(s)`, drive].filter(Boolean).join(' · ');

  // Verrou du partage : crayon vert ✎ (on a la main) ou « 🔒 Lecture seule · Tablette Paul » en rouge
  // (un autre appareil l'a ; toucher = prendre la main). Rien sans Drive.
  const pastille = document.querySelector('#pastille-verrou');
  const repris = partage?.etat.connecte && partage.etat.repris?.projetId === projet.id ? partage.etat.repris : null;
  pastille.hidden = !partage?.etat.connecte;
  pastille.textContent = repris ? `🔒 Lecture seule · ${repris.nom}` : '✎';
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
  dernierImport = null;
  document.querySelector('#message-import-surface').innerHTML = '';
  editeurSurfaces.charger(projet.surfaces);
  montrerUneSurfaceDuLeve();
  recalculer({ recadrer: true });
  historique.reinitialiser(modifications, projet);
  mettreAJourAnnuler();
  if (changerOnglet) afficherOnglet(etapeUtile());
  await enregistrer();
}

// --- Démarrage : on rouvre le dernier projet, sinon le plus récent, sinon un nouveau ---
// L'appli s'ouvre sur l'onglet Projet (bouton « Continuer » pour reprendre le travail).
async function demarrer() {
  afficherOnglet('projets');
  stockage.demanderStockagePersistant();
  try {
    await rafraichirListe();
    const id = stockage.dernierProjet();
    const lu = (id && (await stockage.lireProjet(id))) || (resumes[0] && (await stockage.lireProjet(resumes[0].id)));
    await ouvrir(lu ? completerProjet(lu) : creerProjet(), { changerOnglet: false });
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
