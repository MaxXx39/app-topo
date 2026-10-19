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
import { calculerTousLesStocks, afficherResultats, afficherComparaisons } from './stocks/resultats.js';
import { creerEcranExport, telecharger } from './export/ecran.js';
import { creerEcranProjet } from './projet/ecran.js';
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

// --- État de l'application ---
let projet = creerProjet('Mon projet'); // projet ouvert
let resumes = []; // liste des projets enregistrés (pour l'onglet Projet)
let dernierImport = null; // résultat du dernier import de points
let surfacesCalculees = new Map(); // id de surface -> résultat de calculerSurface
let resultatsStocks = []; // volumes des stocks du levé affiché
let resultatsComparaisons = []; // une entrée par comparaison du projet
let ongletContexte = 'projet'; // dernier onglet (hors plan) : décide de ce que montre le plan

// --- Mise en page : onglets ---
const ICONES = {
  projet: '<path d="M3 7h6l2 2h10v10H3z" />',
  stocks: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  surfaces: '<path d="M3 17 9 8l4 5 3-4 5 8zM3 17h18" /><path d="m9 8 7 1" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
};
const ONGLETS = [
  { nom: 'projet', titre: 'Projet' },
  { nom: 'stocks', titre: 'Stocks' },
  { nom: 'surfaces', titre: 'Surfaces' },
  { nom: 'plan', titre: 'Plan' },
  { nom: 'volumes', titre: 'Volumes' },
];

document.querySelector('#app').innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau" data-onglet="projet"><div id="projet"></div></section>
      <section class="panneau" data-onglet="stocks">
        <h2>Stocks <span class="aide" id="nom-leve-stocks"></span></h2>
        <div class="avec-points" hidden><div id="stocks"></div></div>
        <p class="vide sans-points">Importe d'abord un fichier de points (onglet Projet).</p>
      </section>
      <section class="panneau" data-onglet="surfaces">
        <h2>Surfaces</h2>
        <p class="aide">Une surface (modèle de terrain) se crée à partir des points d'un levé, ou s'importe d'un LandXML. Elle peut servir de base à un stock (mode B) ou être comparée à une autre.</p>
        <div id="surfaces"></div>
        <label class="bouton-secondaire bouton-fichier">
          Importer une surface LandXML
          <input type="file" id="fichier-landxml" accept=".xml,.landxml,application/xml,text/xml" hidden />
        </label>
        <div id="message-landxml"></div>
        <div id="comparaisons" class="section-comparaisons"></div>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>Volumes</h2>
        <div id="resultats"></div>
        <div id="resultats-comparaisons"></div>
        <div id="export" class="carte-export"></div>
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

const ecranProjet = creerEcranProjet(document.querySelector('#projet'), {
  renommer: (nom) => {
    if (nom) projet.nom = nom;
    modifie();
  },
  importerPoints: async (fichier) => {
    try {
      const resultat = lirePoints(await fichier.text());
      dernierImport = { ...resultat, nomFichier: fichier.name };
      if (resultat.points.length > 0) {
        ajouterLeve(projet, fichier.name, resultat.points);
        changerDeLeve();
      }
    } catch (erreur) {
      dernierImport = { nomFichier: fichier.name, format: '?', points: [], erreurs: [{ ligne: '-', message: erreur.message }], avertissements: [] };
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
      await ouvrir(restants[0] ? completerProjet(restants[0]) : creerProjet('Mon projet'));
    } else {
      await rafraichirListe();
      ecranProjet.afficher(projet, resumes, dernierImport);
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

// --- Import d'un LandXML : chaque surface TIN devient une surface du projet ---
document.querySelector('#fichier-landxml').addEventListener('change', async (evenement) => {
  const fichier = evenement.target.files[0];
  if (!fichier) return;
  const zone = document.querySelector('#message-landxml');
  try {
    const { surfaces, erreurs, avertissements } = lireLandXML(await fichier.text());
    for (const surface of surfaces) projet.surfaces.push(surfaceDepuisLandXML(surface, fichier.name));
    const messages = [...erreurs, ...avertissements];
    zone.innerHTML = `<p class="resume"><strong>${surfaces.length} surface(s) TIN</strong> importée(s) de « ${echapper(fichier.name)} ».</p>
      ${messages.length > 0 ? `<div class="avertissement"><ul>${messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}`;
    editeurSurfaces.charger(projet.surfaces);
    if (surfaces.length > 0) editeurSurfaces.choisir(projet.surfaces.length - 1);
  } catch (erreur) {
    zone.innerHTML = `<p class="erreur">Impossible de lire « ${echapper(fichier.name)} » : ${echapper(erreur.message)}</p>`;
  }
  evenement.target.value = '';
  modifie({ recadrer: true });
});

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
  ecranProjet.afficher(projet, resumes, dernierImport);
  afficherResultats(document.querySelector('#resultats'), leve?.stocks ?? [], resultatsStocks);
  afficherComparaisons(document.querySelector('#resultats-comparaisons'), projet.comparaisons, resultatsComparaisons);

  // Plan : dans l'onglet Surfaces, on montre la surface choisie (et les points de son levé).
  const surface = ongletContexte === 'surfaces' ? editeurSurfaces.objetActif() : null;
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

/** Après chaque modification : recalcule, puis enregistre le projet un court instant plus tard. */
function modifie(options) {
  recalculer(options);
  clearTimeout(minuterie);
  minuterie = setTimeout(enregistrer, 400);
}

async function enregistrer() {
  projet.modifieLe = new Date().toISOString();
  try {
    await stockage.enregistrerProjet(projet);
    stockage.memoriserDernierProjet(projet.id);
    await rafraichirListe();
    ecranProjet.afficher(projet, resumes, dernierImport);
  } catch (erreur) {
    console.error(erreur);
    document.querySelector('#etat').textContent = `Enregistrement impossible : ${erreur.message}`;
  }
}

async function rafraichirListe() {
  resumes = (await stockage.listerProjets()).map(resumerProjet).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

/** Ouvre un projet : il devient le projet affiché, et il est enregistré. */
async function ouvrir(nouveau) {
  projet = nouveau;
  dernierImport = null;
  changerDeLeve();
  editeurSurfaces.charger(projet.surfaces);
  ecranExport.rafraichir();
  recalculer({ recadrer: true });
  await enregistrer();
}

// --- Démarrage : on rouvre le dernier projet, sinon le plus récent, sinon un nouveau ---
async function demarrer() {
  afficherOnglet('projet');
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
    document.querySelector('#etat').textContent = 'Attention : enregistrement impossible sur cet appareil';
  }
}
demarrer();
