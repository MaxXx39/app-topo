// Point de départ de l'application : ce fichier construit la page et relie les écrans entre eux.
//
// Tout est rangé dans le "projet" ouvert (voir projet/projet.js), enregistré automatiquement
// sur l'appareil après chaque modification.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { lireLandXML } from './topo/landxml.js';
import { formaterNombre } from './topo/format.js';
import { calculerSurface, surfaceDepuisLandXML, cleTriangle } from './topo/surface.js';
import { comparerSurfaces } from './topo/comparaison.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurStocks } from './stocks/editeur.js';
import { calculerTousLesStocks, afficherResultats } from './stocks/resultats.js';
import { creerEcranExport, telecharger } from './export/ecran.js';
import { creerEcranProjet } from './projet/ecran.js';
import { creerEcranImport } from './import/ecran.js';
import { creerEcranComparaisons } from './surfaces/comparaisons.js';
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

// --- État de l'application ---
let projet = creerProjet('Mon projet'); // projet ouvert
let resumes = []; // liste des projets enregistrés (pour l'écran Mes projets)
let dernierImport = null; // résultat du dernier import (points ou LandXML)
let surfacesCalculees = new Map(); // id de surface -> résultat de calculerSurface
let resultatsStocks = []; // volumes des stocks du levé affiché
let resultatsComparaisons = []; // une entrée par comparaison du projet
let ongletContexte = 'importer';
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir // dernier onglet (hors plan) : décide de ce que montre le plan

// --- Mise en page : onglets ---
// Les onglets numérotés suivent l'ordre du travail : importer, définir les stocks, lire les volumes.
// « Comparer » (surfaces et comparaisons) est à part. « Mes projets » s'ouvre depuis l'en-tête.
const ICONES = {
  importer: '<path d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5" />',
  stocks: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  comparer: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
};
const ONGLETS = [
  { nom: 'importer', titre: '1. Importer' },
  { nom: 'stocks', titre: '2. Stocks' },
  { nom: 'volumes', titre: '3. Volumes' },
  { nom: 'comparer', titre: 'Comparer' },
  { nom: 'plan', titre: 'Plan' },
];

document.querySelector('#app').innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau" data-onglet="projets"><div id="projets"></div></section>
      <section class="panneau" data-onglet="importer"><div id="importer"></div></section>
      <section class="panneau" data-onglet="stocks">
        <h2>2. Stocks <span class="aide" id="nom-leve-stocks"></span></h2>
        <div class="avec-points" hidden><div id="stocks"></div></div>
        <p class="vide sans-points">Importe d'abord un fichier de points (onglet 1. Importer).</p>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>3. Volumes</h2>
        <div id="resultats"></div>
        <div id="export" class="carte-export"></div>
      </section>
      <section class="panneau" data-onglet="comparer">
        <h2>Comparer</h2>
        <h3>Surfaces</h3>
        <p class="aide">Créées à partir des points d'un levé, ou importées d'un LandXML (onglet 1. Importer).</p>
        <div id="surfaces"></div>
        <div id="comparaisons" class="section-comparaisons"></div>
      </section>
      <div id="barre-stocks" class="barre-edition" hidden></div>
      <div id="barre-surfaces" class="barre-edition" hidden></div>
    </div>
    <section class="panneau panneau-plan" data-onglet="plan">
      <div id="plan"></div>
    </section>
  </div>
  <nav class="onglets" aria-label="Onglets">
    ${ONGLETS.map(
      (o) => `<button type="button" data-onglet="${o.nom}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[o.nom]}</svg>
        <span>${o.titre}</span>
      </button>`,
    ).join('')}
  </nav>
`;

/** Affiche un onglet. Sur ordinateur, le plan reste toujours visible à droite. */
function afficherOnglet(nom) {
  for (const element of document.querySelectorAll('[data-onglet]')) {
    element.classList.toggle('actif', element.dataset.onglet === nom);
  }
  document.body.dataset.onglet = nom;
  if (nom !== 'plan' && nom !== ongletContexte) {
    ongletContexte = nom;
    recalculer();
  }
  window.scrollTo(0, 0);
}
document.querySelector('.onglets').addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-onglet]');
  if (bouton) afficherOnglet(bouton.dataset.onglet);
});
document.querySelector('#bouton-projets').addEventListener('click', () => afficherOnglet('projets'));

// --- Accès aux données du projet ---

const pointsDuLeve = (id) => projet.leves.find((l) => l.id === id)?.points ?? [];

/** Surfaces du projet utilisables comme base (mode B) : celles qui ont des triangles. */
function surfacesUtilisables() {
  return projet.surfaces.map((s) => ({ id: s.id, nom: s.nom }));
}

/** Triangles d'une surface du projet (ou [] si elle n'est pas calculable). */
const trianglesDeSurface = (id) => surfacesCalculees.get(id)?.triangles ?? [];

/**
 * Surfaces comparables : surfaces du projet et dessus des stocks de chaque levé.
 * ref : 'surface:<id>' ou 'stock:<levéId>:<nom du stock>'.
 */
function choixComparables() {
  const choix = projet.surfaces.map((s) => ({ ref: `surface:${s.id}`, nom: `Surface « ${s.nom} »` }));
  for (const leve of projet.leves) {
    for (const stock of leve.stocks) choix.push({ ref: `stock:${leve.id}:${stock.nom}`, nom: `${stock.nom} (${leve.nom})` });
  }
  return choix;
}

/** Zones de comparaison : toute la surface « après », ou le contour d'un stock. */
function zonesComparables() {
  const zones = [{ zone: { type: 'toute' }, nom: 'toute la surface « après »' }];
  for (const leve of projet.leves) {
    for (const stock of leve.stocks) {
      if (stock.contour.length >= 3) zones.push({ zone: { type: 'stock', leveId: leve.id, stockNom: stock.nom }, nom: `contour de ${stock.nom} (${leve.nom})` });
    }
  }
  return zones;
}

/** Triangles d'une surface comparable (voir choixComparables). */
function trianglesComparables(ref) {
  if (!ref) return [];
  if (ref.startsWith('surface:')) return trianglesDeSurface(ref.slice('surface:'.length));
  const [, leveId, ...nom] = ref.split(':');
  const leve = projet.leves.find((l) => l.id === leveId);
  const index = leve?.stocks.findIndex((s) => s.nom === nom.join(':')) ?? -1;
  if (index < 0) return [];
  const resultat = calculerTousLesStocks([leve.stocks[index]], leve.points, surfaceDeBase)[0];
  return resultat.trianglesDessus ?? [];
}

/** Surface de base d'un stock en mode B. */
function surfaceDeBase(stock) {
  const surface = projet.surfaces.find((s) => s.id === stock.surfaceBaseId);
  return surface ? { nom: surface.nom, triangles: trianglesDeSurface(surface.id) } : null;
}

/** Calcule une comparaison du projet. */
function calculerComparaison(comparaison) {
  const avant = trianglesComparables(comparaison.avant);
  const apres = trianglesComparables(comparaison.apres);
  let contour = null;
  if (comparaison.zone?.type === 'stock') {
    const leve = projet.leves.find((l) => l.id === comparaison.zone.leveId);
    const stock = leve?.stocks.find((s) => s.nom === comparaison.zone.stockNom);
    if (!stock) return { erreurs: ['le stock de la zone n\'existe plus'] };
    const parNom = new Map(leve.points.map((p) => [p.nom, p]));
    contour = stock.contour.map((nom) => parNom.get(nom)).filter(Boolean);
  }
  return comparerSurfaces(avant, apres, contour);
}

// --- Écrans ---

const ecranImport = creerEcranImport(document.querySelector('#importer'), {
  importerPoints: async (fichier) => {
    try {
      const resultat = lirePoints(await fichier.text());
      dernierImport = { type: 'points', ...resultat, nomFichier: fichier.name };
      if (resultat.points.length > 0) {
        ajouterLeve(projet, fichier.name, resultat.points);
        changerDeLeve();
      }
    } catch (erreur) {
      dernierImport = { type: 'points', nomFichier: fichier.name, format: '?', points: [], erreurs: [{ ligne: '-', message: erreur.message }], avertissements: [] };
    }
    modifie({ recadrer: true });
  },
  // Chaque surface TIN du fichier devient une surface du projet.
  importerLandXML: async (fichier) => {
    try {
      const { surfaces, erreurs, avertissements } = lireLandXML(await fichier.text());
      for (const surface of surfaces) projet.surfaces.push(surfaceDepuisLandXML(surface, fichier.name));
      dernierImport = { type: 'landxml', nomFichier: fichier.name, nombreSurfaces: surfaces.length, messages: [...erreurs, ...avertissements] };
      editeurSurfaces.charger(projet.surfaces);
      if (surfaces.length > 0) editeurSurfaces.choisir(projet.surfaces.length - 1);
    } catch (erreur) {
      dernierImport = { type: 'landxml', nomFichier: fichier.name, erreur: erreur.message };
    }
    modifie({ recadrer: true });
  },
  choisirLeve: (id) => {
    projet.leveActifId = id;
    changerDeLeve();
    modifie({ recadrer: true });
  },
  renommerLeve: (id, nom) => {
    const leve = projet.leves.find((l) => l.id === id);
    if (leve && nom) leve.nom = nom;
    modifie();
  },
  supprimerLeve: (id) => {
    const leve = projet.leves.find((l) => l.id === id);
    if (!leve || !confirm(`Supprimer le levé « ${leve.nom} » et ses ${leve.stocks.length} stock(s) ?`)) return;
    projet.leves = projet.leves.filter((l) => l.id !== id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    changerDeLeve();
    modifie({ recadrer: true });
  },
});

const ecranProjet = creerEcranProjet(document.querySelector('#projets'), {
  renommer: (nom) => {
    if (nom) projet.nom = nom;
    modifie();
  },
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
});

const plan = creerPlan(document.querySelector('#plan'), {
  quandToucherPoint: (nom) => {
    if (editeurStocks.enModification()) editeurStocks.toucherPoint(nom);
    else if (editeurSurfaces.enModification()) editeurSurfaces.toucherPoint(nom);
  },
  quandToucherStock: (index) => editeurStocks.choisir(index),
  quandToucherTriangle: (triangle) => editeurSurfaces.basculerTriangle(cleTriangle(triangle)),
});

const editeurStocks = creerEditeurStocks(document.querySelector('#stocks'), document.querySelector('#barre-stocks'), {
  genre: 'stock',
  obtenirPoints: () => leveActif(projet)?.points ?? [],
  quandChange: () => {
    if (editeurStocks.enModification()) editeurSurfaces.arreterModification();
    modifie();
  },
  allerAuPlan: () => afficherOnglet('plan'),
  obtenirSurfaces: surfacesUtilisables,
});

const editeurSurfaces = creerEditeurStocks(document.querySelector('#surfaces'), document.querySelector('#barre-surfaces'), {
  genre: 'surface',
  obtenirPoints: (surface) => (surface.type === 'landxml' ? [] : pointsDuLeve(surface.leveId)),
  quandChange: () => {
    if (editeurSurfaces.enModification()) editeurStocks.arreterModification();
    modifie();
  },
  allerAuPlan: () => afficherOnglet('plan'),
  leveActifId: () => leveActif(projet)?.id ?? null,
  decrire: decrireSurface,
});
editeurSurfaces.charger(projet.surfaces);

const ecranComparaisons = creerEcranComparaisons(document.querySelector('#comparaisons'), {
  obtenirProjet: () => projet,
  obtenirChoix: choixComparables,
  obtenirZones: zonesComparables,
  obtenirResultat: (comparaison) => resultatsComparaisons[projet.comparaisons.indexOf(comparaison)],
  quandChange: () => modifie(),
});

const ecranExport = creerEcranExport(document.querySelector('#export'), {
  obtenirDonnees: () => {
    const leve = leveActif(projet);
    return {
      nomProjet: projet.nom,
      stocks: leve?.stocks ?? [],
      resultats: resultatsStocks,
      points: leve?.points ?? [],
      fichierPoints: leve?.nom ?? '',
      surfaces: projet.surfaces.map((s) => ({ nom: s.nom, triangles: trianglesDeSurface(s.id) })).filter((s) => s.triangles.length > 0),
      comparaisons: projet.comparaisons.map((c, i) => ({ nom: c.nom, resultat: resultatsComparaisons[i] })),
      cartouche: projet.cartouche,
    };
  },
  quandChange: () => modifie(),
});

/** État d'une surface sous ses réglages : triangles, surface en plan, problèmes. */
function decrireSurface(surface) {
  const r = surfacesCalculees.get(surface.id);
  if (!r) return '';
  if (r.erreurs) return `<div class="erreur"><ul>${r.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
  let aire = 0;
  for (const [a, b, c] of r.triangles) aire += Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
  const leve = projet.leves.find((l) => l.id === surface.leveId);
  return `
    <p class="ok">✓ ${r.triangles.length} triangles · ${formaterNombre(aire)} m²${leve ? ` · levé « ${echapper(leve.nom)} »` : ''}</p>
    ${r.avertissements.length > 0 ? `<div class="avertissement"><ul>${r.avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : ''}`;
}

// --- Calculs et affichage ---

/** Après un changement de levé : l'écran des stocks montre les stocks de ce levé. */
function changerDeLeve() {
  editeurStocks.charger(leveActif(projet)?.stocks ?? []);
}

/** Recalcule tout (surfaces, volumes, comparaisons) et met à jour les écrans et le plan. */
function recalculer({ recadrer = false } = {}) {
  const leve = leveActif(projet);
  const points = leve?.points ?? [];

  surfacesCalculees = new Map(projet.surfaces.map((s) => [s.id, calculerSurface(s, pointsDuLeve(s.leveId))]));
  resultatsStocks = calculerTousLesStocks(leve?.stocks ?? [], points, surfaceDeBase);
  resultatsComparaisons = projet.comparaisons.map(calculerComparaison);

  for (const element of document.querySelectorAll('.avec-points')) element.hidden = points.length === 0;
  for (const element of document.querySelectorAll('.sans-points')) element.hidden = points.length > 0;
  document.querySelector('#nom-leve-stocks').textContent = leve ? `· levé « ${leve.nom} »` : '';
  document.querySelector('#etat').textContent = `${projet.nom} · ${points.length} points · ${leve?.stocks.length ?? 0} stock(s)`;

  editeurStocks.rafraichir();
  editeurSurfaces.rafraichir();
  ecranComparaisons.afficher();
  ecranImport.afficher(projet, dernierImport);
  ecranProjet.afficher(projet, resumes);
  afficherResultats(document.querySelector('#resultats'), leve?.stocks ?? [], resultatsStocks);

  // Plan : dans l'onglet Comparer, on montre la surface choisie (et les points de son levé).
  const surface = ongletContexte === 'comparer' ? editeurSurfaces.objetActif() : null;
  const calcul = surface ? surfacesCalculees.get(surface.id) : null;
  const pointsDuPlan = surface ? (surface.type === 'landxml' ? surface.points : pointsDuLeve(surface.leveId)) : points;
  const dessinStocks = editeurStocks.obtenirDessin();
  const dessinSurface = editeurSurfaces.obtenirDessin();
  plan.redessiner({
    ...dessinStocks,
    ...(surface && dessinSurface.enEdition ? { listeEnCours: dessinSurface.listeEnCours, enEdition: true } : {}),
    resultats: resultatsStocks,
    surface: calcul && !calcul.erreurs ? { triangles: calcul.triangles, trianglesRetires: calcul.trianglesRetires } : null,
    modeTriangles: Boolean(surface && editeurSurfaces.enSuppression()),
  });
  if (recadrer || pointsDuPlan !== pointsAffiches) {
    pointsAffiches = pointsDuPlan;
    plan.afficherPoints(pointsDuPlan);
  }
}
let pointsAffiches = null;

// --- Enregistrement automatique ---
let minuterie = null;

/** Après chaque modification : recalcule, retient l'étape (Annuler), puis enregistre un court instant plus tard. */
function modifie(options) {
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
  editeurStocks.charger(leveActif(projet)?.stocks ?? [], { garderPosition: true });
  editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
  ecranExport.rafraichir();
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

/** Petit message sous l'en-tête, qui disparaît tout seul. */
let minuterieMessage = null;
function afficherMessage(texte) {
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
  minuterieMessage = setTimeout(() => (zone.hidden = true), 2000);
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

/**
 * Ouvre un projet : il devient le projet affiché, et il est enregistré.
 * Puis on va à l'étape utile : les stocks s'il a déjà des points, sinon l'import.
 */
async function ouvrir(nouveau, { changerOnglet = true } = {}) {
  projet = nouveau;
  dernierImport = null;
  changerDeLeve();
  editeurSurfaces.charger(projet.surfaces);
  ecranExport.rafraichir();
  recalculer({ recadrer: true });
  historique.reinitialiser(modifications, projet);
  mettreAJourAnnuler();
  if (changerOnglet) afficherOnglet(leveActif(projet) ? 'stocks' : 'importer');
  await enregistrer();
}

// --- Démarrage : on rouvre le dernier projet, sinon le plus récent, sinon un nouveau ---
async function demarrer() {
  afficherOnglet('importer');
  stockage.demanderStockagePersistant();
  try {
    await rafraichirListe();
    const id = stockage.dernierProjet();
    const lu = (id && (await stockage.lireProjet(id))) || (resumes[0] && (await stockage.lireProjet(resumes[0].id)));
    await ouvrir(lu ? completerProjet(lu) : creerProjet('Mon projet'));
  } catch (erreur) {
    // Base de données indisponible (navigation privée...) : l'appli marche, sans enregistrement.
    console.error(erreur);
    recalculer({ recadrer: true });
    historique.reinitialiser(modifications, projet);
    document.querySelector('#etat').textContent = 'Attention : enregistrement impossible sur cet appareil';
  }
}
demarrer();
