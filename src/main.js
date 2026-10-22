// Point de départ de l'application : ce fichier construit la page et relie les écrans entre eux.
//
// Tout est rangé dans le "projet" ouvert (voir projet/projet.js), enregistré automatiquement
// sur l'appareil après chaque modification.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { lireLandXML } from './topo/landxml.js';
import { lireDXF } from './topo/dxf-lecture.js';
import { formaterNombre } from './topo/format.js';
import { calculerSurface, surfaceImportee, cleTriangle, estImportee, nomNature } from './topo/surface.js';
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
} from './projet/projet.js';
import * as stockage from './projet/stockage.js';
import * as historique from './projet/historique.js';
import { bulle, installerAide } from './aide/bulles.js';
import { creerEcranLeve, mettreAJourBandeaux, LONGUEURS_COUPE } from './leve/ecran.js';
import { creerSuiviOrientation } from './leve/orientation.js';
import { altitudeSurSurface, ecartSurface, classeEcart, extremitesCoupe } from './topo/implantation.js';
import {
  estLeveDirect,
  leveDuJour,
  creerSurfaceDirecte,
  prochainNom,
  nomsDuProjet,
  ajouterPointDirect,
  annulerDernierPoint,
  nouvelleLigne,
  basculerFermeture,
  ligneEnCours,
  resumeStock,
} from './topo/leve-direct.js';
import { regleToucheVolume, recepteurDisponible, ecouterRecepteur, choisirRecepteur, reconnecterRecepteur, deconnecterRecepteur, prendrePointRecepteur } from './android/pont.js';

// --- État de l'application ---
let projet = creerProjet('Mon projet'); // projet ouvert
let resumes = []; // liste des projets enregistrés (pour l'onglet Projet)
let dernierImport = null; // résultat du dernier import de points
let surfacesCalculees = new Map(); // id de surface -> triangles (résultat de calculerSurface)
let resultatsCalculs = new Map(); // id de calcul -> volume (résultat de calculerVolume)
let resultatsMesures = new Map(); // id de mesure -> longueurs, aires (résultat de calculerMesure)
let ongletContexte = 'projets'; // dernier onglet (hors plan) : décide de ce que montre le plan
let calculMontre = null; // id du calcul colorié sur le plan (bouton « Voir sur le plan »)
let traceCoupe = null; // coupe en train d'être tracée sur le plan : { id, etape: 'debut' ou 'fin', debut }
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir
// Levé avec le récepteur (appli Android) : levé et stock en cours, rôle du prochain point.
const leveDirect = { stockId: null, role: 'contour' };
let etatRecepteur = null; // dernier état reçu du récepteur (voir android/pont.js)
// Onglet Terrain : mode (Lever ou Contrôler) et réglages du contrôle, retenus sur l'appareil.
const CLE_TERRAIN = 'topo-terrain';
const terrain = { mode: 'lever', surfaceId: null, vueCoupes: 'les2', demiLongueur: 5, exagerationCoupe: 1, sourceOrientation: 'rx2', ...lireReglagesTerrain() };
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
  { nom: 'calculs', titre: 'Calculs' },
  { nom: 'plan', titre: 'Plan' },
];
// Les trois parties de l'onglet Calculs (ce sont aussi les noms de leurs panneaux).
const PARTIES_CALCULS = [
  ['surfaces', 'Surfaces'],
  ['volumes', 'Volumes'],
  ['mesures', 'Mesures'],
];
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
        ${PARTIES_CALCULS.map(([cle, titre]) => `<button type="button" data-partie="${cle}">${titre}</button>`).join('')}
      </nav>
      <section class="panneau" data-onglet="surfaces">
        <h2>Surfaces <span class="aide" id="nom-leve-surfaces"></span> ${bulle('surfaces')}</h2>
        <p class="vide sans-points">${recepteurDisponible() ? 'Importe des points (onglet Projet) ou lève-les (onglet Terrain), ou importe une surface LandXML ou DXF.' : 'Importe d\'abord des points (onglet Projet), ou une surface LandXML ou DXF.'}</p>
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
        <h2>Mesures <span class="aide" id="nom-leve-mesures"></span> ${bulle('mesures')}</h2>
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
  supprimerLeve: (id) => {
    const leve = projet.leves.find((l) => l.id === id);
    const surfacesDuLeve = projet.surfaces.filter((s) => s.leveId === id);
    const mesuresDuLeve = projet.mesures.filter((m) => m.leveId === id);
    const texteMesures = mesuresDuLeve.length > 0 ? ` et ses ${mesuresDuLeve.length} mesure(s)` : '';
    if (!leve || !confirm(`Supprimer le levé « ${leve.nom} », ses ${surfacesDuLeve.length} surface(s)${texteMesures} ?`)) return;
    projet.leves = projet.leves.filter((l) => l.id !== id);
    projet.surfaces = projet.surfaces.filter((s) => s.leveId !== id);
    projet.mesures = projet.mesures.filter((m) => m.leveId !== id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    editeurSurfaces.charger(projet.surfaces);
    modifie({ recadrer: true });
  },
});

// --- Levé avec le récepteur Emlid (seulement dans l'appli Android) ---
// Sur le terrain, on lève une surface (stock, terrain naturel ou terrassement). Ses points vont
// dans le levé du jour (créé tout seul, comme un fichier importé) et, selon leur rôle, dans la
// surface (voir topo/leve-direct.js) : surfaces, volumes, mesures et exports marchent pareil.

/** Surface levée en cours (dans un levé fait avec le récepteur), ou null. */
function stockEnCours() {
  const surface = projet.surfaces.find((s) => s.id === leveDirect.stockId);
  const leve = projet.leves.find((l) => l.id === surface?.leveId);
  return surface && estLeveDirect(leve) ? surface : null;
}
/** Levé (fait avec le récepteur) de la surface en cours, ou null. */
function leveEnCours() {
  const surface = stockEnCours();
  return surface ? projet.leves.find((l) => l.id === surface.leveId) : null;
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
  if (stockEnCours()) return;
  const levees = surfacesLevees();
  leveDirect.stockId = (levees.filter((s) => s.leveId === projet.leveActifId).at(-1) ?? levees.at(-1))?.id ?? null;
}

/** Nouvelle surface levée (dans le levé du jour) : un stock a tout de suite son calcul de volume. */
function ajouterSurfaceLevee(nature) {
  const surface = creerSurfaceDirecte(projet, leveDuJour(projet), nature);
  projet.calculs = calculsAutomatiques(projet.calculs, projet.surfaces, surface);
  leveDirect.stockId = surface.id;
  editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
  montrerStockEnCours();
  modifie({ recadrer: true });
}

const ecranLeve = recepteurDisponible()
  ? creerEcranLeve(document.querySelector('#leve-direct'), {
      choisirRecepteur,
      reconnecter: reconnecterRecepteur,
      deconnecter: deconnecterRecepteur,
      nouvelleSurface: (nature) => ajouterSurfaceLevee(nature),
      choisirStock: (id) => {
        leveDirect.stockId = id;
        montrerStockEnCours();
        recalculer();
      },
      choisirRole: (role) => {
        leveDirect.role = role;
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
      prendrePoint: (nom) => {
        const leve = leveEnCours();
        const stock = stockEnCours();
        if (!leve || !stock) return;
        // Position vérifiée par l'appli Android au moment du toucher : RTK fixe et inclinaison prête.
        const reponse = prendrePointRecepteur();
        if (!reponse.ok) {
          afficherMessage(`Point refusé : ${reponse.raison}`, 4000);
          return;
        }
        const { est, nord, altitude, ...gnss } = reponse.point;
        const resultat = ajouterPointDirect(leve, stock, leveDirect.role, {
          nom: nom.trim() || prochainNom(projet, stock),
          est,
          nord,
          altitude,
          gnss: { ...gnss, prisLe: new Date().toISOString() },
        }, nomsDuProjet(projet));
        if (resultat.erreur) {
          afficherMessage(`Point refusé : ${resultat.erreur}`, 4000);
          return;
        }
        navigator.vibrate?.(60);
        afficherMessage(`Point ${resultat.point.nom} pris`);
        modifie();
      },
      choisirMode: (mode) => {
        terrain.mode = mode === 'controler' ? 'controler' : 'lever';
        retenirReglagesTerrain();
        if (terrain.mode === 'controler') montrerSurfaceControle();
        recalculer();
      },
      choisirImplantation: () => {}, // Point et Ligne : plus tard
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
        annulerDernierPoint(leve, projet.surfaces);
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
 * Touche « volume − » : elle prend le point seulement dans l'onglet Terrain, en mode Lever, avec une
 * surface en cours ; ailleurs, elle règle le volume comme d'habitude. Point refusé : message et
 * double vibration (on ne regarde pas forcément l'écran).
 */
let toucheVolumeActive = null;
function mettreAJourToucheVolume() {
  if (!ecranLeve) return;
  const actif = document.body.dataset.onglet === 'terrain' && terrain.mode === 'lever' && Boolean(stockEnCours());
  if (actif === toucheVolumeActive) return;
  toucheVolumeActive = actif;
  regleToucheVolume(actif, () => {
    const refus = ecranLeve.prendreDepuisTouche();
    if (refus) {
      navigator.vibrate?.([80, 80, 80]);
      afficherMessage(`Point refusé : ${refus}`, 4000);
    }
  });
}

/** Ce que montre l'onglet Terrain (voir leve/ecran.js). */
function donneesLeve() {
  reprendreLeveDirect();
  const leve = leveEnCours();
  const stock = stockEnCours();
  const ligne = stock ? ligneEnCours(stock) : null;
  const numeroLigne = stock ? stock.lignesRupture.indexOf(ligne) + 1 : 0;
  return {
    leve,
    // Surfaces levées, avec la date de leur levé (« Stock 2 · 22.10.2026 »).
    stocks: surfacesLevees().map((s) => ({ id: s.id, nom: `${s.nom} · ${jourDuLeve(s.leveId)}` })),
    stock,
    role: leveDirect.role,
    ligne: ligne ? { numero: numeroLigne, nbPoints: ligne.noms.length, fermee: ligne.fermee } : null,
    nomPropose: stock ? prochainNom(projet, stock) : '',
    dernierPoint: leve?.points[leve.points.length - 1]?.nom ?? null,
    resume: stock ? resumeStock(stock) : null,
    volume: stock ? volumeDuStock(stock) : null,
    mode: terrain.mode,
    controle: terrain,
    surfaces: projet.surfaces.map((s) => ({ id: s.id, etiquette: etiquetteSurface(s) })),
  };
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

// État du récepteur, 5 fois par seconde : bandeaux, bloc de levé, position sur le plan.
if (recepteurDisponible()) {
  ecouterRecepteur((etat) => {
    etatRecepteur = etat;
    mettreAJourBandeaux(etat);
    const orientation = suiviOrientation.ajouter(etat, performance.now());
    const controle = terrain.mode === 'controler' ? calculerControle(etat, orientation) : null;
    ecranLeve.mettreAJourRecepteur(etat, { orientation, controle });
    const position = etat.connecte && etat.recu ? etat.position : null;
    // Coupes affichées (mode Contrôler) : leur trait en pointillés sur le plan.
    const vues = { les2: ['perpendiculaire', 'axe'], perpendiculaire: ['perpendiculaire'], axe: ['axe'] }[terrain.vueCoupes] ?? [];
    const traits = controle?.coupes ? vues.map((sens) => ({ sens, debut: controle.coupes[sens].debut, fin: controle.coupes[sens].fin })) : [];
    plan.afficherPosition(position ? { est: position.est, nord: position.nord, prete: Boolean(etat.inclinaisonPrete), azimut: orientation.azimut, coupes: traits } : null);
  });
}

const ecranProjet = creerEcranProjet(document.querySelector('#projets'), {
  renommer: (nom) => {
    if (nom) projet.nom = nom;
    modifie();
  },
  changerCartouche: (champ, valeur) => {
    projet.cartouche[champ] = valeur;
    modifie();
  },
  continuer: () => allerA(etapeUtile()),
  allerA: (onglet) => allerA(onglet),
  exporterProjet: () => {
    const nom = projet.nom.replace(/[^\w-]+/g, '_') || 'projet';
    telecharger(new Blob([ecrireFichierProjet(projet)], { type: 'application/json' }), `${nom}.topo.json`);
  },
  nouveauProjet: async () => {
    const nom = prompt('Nom du nouveau projet :', `Projet ${resumes.length + 1}`);
    if (!nom) return;
    await ouvrir(creerProjet(nom.trim()));
  },
  ouvrirProjet: async (id) => {
    const lu = await stockage.lireProjet(id);
    if (lu) await ouvrir(completerProjet(lu));
  },
  dupliquerProjet: async (id) => {
    const lu = id === projet.id ? projet : await stockage.lireProjet(id);
    if (lu) await ouvrir(dupliquerProjet(completerProjet(lu), `${lu.nom} (copie)`));
  },
  supprimerProjet: async (id) => {
    const resume = resumes.find((r) => r.id === id);
    if (!resume || !confirm(`Supprimer définitivement le projet « ${resume.nom} » de cet appareil ?`)) return;
    await stockage.supprimerProjet(id);
    if (id === projet.id) {
      const restants = (await stockage.listerProjets()).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
      await ouvrir(restants[0] ? completerProjet(restants[0]) : creerProjet('Mon projet'), { changerOnglet: false });
    } else {
      await rafraichirListe();
      ecranProjet.afficher(projet, resumes);
    }
  },
  importerFichierProjet: async (fichier) => {
    const { projet: lu, erreur } = lireFichierProjet(await fichier.text());
    if (erreur) {
      alert(`Impossible d'ouvrir « ${fichier.name} » : ${erreur}.`);
      return;
    }
    if (resumes.some((r) => r.id === lu.id) && !confirm(`Le projet « ${lu.nom} » existe déjà sur cet appareil. Le remplacer par le fichier ?`)) {
      return;
    }
    await ouvrir(lu);
  },
}, document.querySelector('#projets-suite'));

const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPosition: toucherPourCoupe,
  // Un point touché va à la liste en cours : celle d'une mesure (onglet Calculs › Mesures) ou d'une surface.
  quandToucherPoint: (nom) => (ongletContexte === 'mesures' ? ecranMesures.toucherPoint(nom) : editeurSurfaces.toucherPoint(nom)),
  quandToucherMesure: (id) => ecranMesures.choisir(id),
  quandToucherStock: (index) => editeurSurfaces.choisir(index),
  quandToucherTriangle: (triangle) => editeurSurfaces.basculerTriangle(cleTriangle(triangle)),
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
      nomProjet: projet.nom,
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
    <p class="ok">✓ ${r.triangles.length} triangles · ${formaterNombre(aire)} m²${volume ? ` · remblai ${formaterNombre(volume.remblai)} m³ (onglet Calculs › Volumes)` : ''}</p>
    ${r.avertissements.length > 0 ? `<div class="avertissement"><ul>${r.avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : ''}`;
}

// --- Calculs et affichage ---

/** Recalcule tout (surfaces, volumes) et met à jour les écrans et le plan. */
function recalculer({ recadrer = false } = {}) {
  const leve = leveActif(projet);
  const points = leve?.points ?? [];

  surfacesCalculees = new Map(projet.surfaces.map((s) => [s.id, calculerSurface(s, pointsDuLeve(s.leveId))]));
  const donnees = { surfaces: projet.surfaces, triangulations: surfacesCalculees, pointsDe: (s) => pointsDuLeve(s.leveId) };
  resultatsCalculs = new Map(projet.calculs.map((c) => [c.id, calculerVolume(c, donnees)]));
  resultatsMesures = new Map(projet.mesures.map((m) => [m.id, calculerMesure(m, pointsDuLeve(m.leveId))]));

  for (const element of document.querySelectorAll('.sans-points')) element.hidden = projet.leves.length > 0;
  document.querySelector('#nom-leve-surfaces').textContent = leve ? `· levé « ${leve.nom} »` : '';
  document.querySelector('#nom-leve-mesures').textContent = leve ? `· levé « ${leve.nom} »` : '';
  document.querySelector('#etat').textContent = `${projet.nom} · ${points.length} points · ${surfacesAffichees().length} surface(s)`;

  editeurSurfaces.rafraichir();
  ecranVolumes.afficher();
  ecranCoupes.afficher();
  ecranMesures.afficher();
  ecranImport.afficher(projet, dernierImport);
  ecranLeve?.afficher(donneesLeve());
  ecranProjet.afficher(projet, resumes);
  // Téléphone, onglet Terrain : le plan reste en haut de l'écran (voir style.css), plus petit
  // en mode Contrôler pour laisser la place aux coupes.
  document.body.classList.toggle('mode-leve', Boolean(ecranLeve));
  document.body.classList.toggle('mode-controle', Boolean(ecranLeve) && terrain.mode === 'controler');
  mettreAJourToucheVolume();

  // Plan : surfaces du levé affiché et surfaces importées ; les autres sont cachées.
  const visibles = new Set(surfacesAffichees());
  const active = editeurSurfaces.objetActif();
  const calculActif = active ? surfacesCalculees.get(active.id) : null;
  const dansSurfaces = ongletContexte === 'surfaces';
  // Une surface importée montre ses propres points ; sinon, les points du levé.
  const pointsDuPlan = dansSurfaces && active && estImportee(active) ? active.points : points;
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
    await rafraichirListe();
    ecranProjet.afficher(projet, resumes);
  } catch (erreur) {
    console.error(erreur);
    document.querySelector('#etat').textContent = `Enregistrement impossible : ${erreur.message}`;
  }
}

async function rafraichirListe() {
  resumes = (await stockage.listerProjets()).map(resumerProjet).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
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
    await ouvrir(lu ? completerProjet(lu) : creerProjet('Mon projet'), { changerOnglet: false });
  } catch (erreur) {
    // Base de données indisponible (navigation privée...) : l'appli marche, sans enregistrement.
    console.error(erreur);
    recalculer({ recadrer: true });
    historique.reinitialiser(modifications, projet);
    document.querySelector('#etat').textContent = 'Attention : enregistrement impossible sur cet appareil';
  }
}
demarrer();
