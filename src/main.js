// Point de départ de l'application : ce fichier construit la page et relie les écrans entre eux.
//
// Tout est rangé dans le "projet" ouvert (voir projet/projet.js), enregistré automatiquement
// sur l'appareil après chaque modification.
import './style.css';
import { lirePoints } from './topo/import-points.js';
import { lireLandXML } from './topo/landxml.js';
import { lireDXF } from './topo/dxf-lecture.js';
import { formaterNombre } from './topo/format.js';
import { calculerSurface, surfaceImportee, cleTriangle, estImportee } from './topo/surface.js';
import { calculerVolumeSurface } from './topo/volume.js';
import { comparerSurfaces } from './topo/comparaison.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurSurfaces } from './surfaces/editeur.js';
import { creerEcranVolumes } from './volumes/ecran.js';
import { preparerPhoto } from './photos/photo.js';
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
import { bulle, installerAide } from './aide/bulles.js';

// --- État de l'application ---
let projet = creerProjet('Mon projet'); // projet ouvert
let resumes = []; // liste des projets enregistrés (pour l'écran Mes projets)
let dernierImport = null; // résultat du dernier import de points
let surfacesCalculees = new Map(); // id de surface -> triangles (résultat de calculerSurface)
let volumes = new Map(); // id de surface -> volume (résultat de calculerVolumeSurface, ou null)
let resultatsComparaisons = []; // une entrée par comparaison du projet
let ongletContexte = 'importer'; // dernier onglet (hors plan) : décide de ce que montre le plan
let comparaisonMontree = null; // id de la comparaison coloriée sur le plan (onglet Comparer)
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir

// --- Mise en page : onglets ---
// Les onglets numérotés suivent l'ordre du travail : importer les points, préparer les surfaces,
// lire les volumes, comparer deux surfaces. « Mes projets » s'ouvre depuis l'en-tête.
const ICONES = {
  importer: '<path d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5" />',
  surfaces: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  comparer: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
};
const ONGLETS = [
  { nom: 'importer', titre: '1. Importer' },
  { nom: 'surfaces', titre: '2. Surfaces' },
  { nom: 'volumes', titre: '3. Volumes' },
  { nom: 'comparer', titre: '4. Comparer' },
  { nom: 'plan', titre: 'Plan' },
];

document.querySelector('#app').innerHTML = `
  <div class="mise-en-page">
    <div class="colonne-gauche">
      <section class="panneau" data-onglet="projets"><div id="projets"></div></section>
      <section class="panneau" data-onglet="importer"><div id="importer"></div></section>
      <section class="panneau" data-onglet="surfaces">
        <h2>2. Surfaces <span class="aide" id="nom-leve-surfaces"></span> ${bulle('surfaces')}</h2>
        <p class="vide sans-points">Importe d'abord un fichier de points (onglet 1. Importer), ou importe une surface ci-dessous.</p>
        <div id="surfaces"></div>
        <h3>Importer une surface ${bulle('importerSurface')}</h3>
        <label class="bouton-secondaire">
          + Surface LandXML ou DXF
          <input type="file" id="fichier-surface" accept=".xml,.landxml,.dxf,application/xml,text/xml" hidden />
        </label>
        <div id="message-import-surface"></div>
      </section>
      <section class="panneau" data-onglet="volumes">
        <h2>3. Volumes ${bulle('volumes')}</h2>
        <div id="volumes"></div>
        <div id="export" class="carte-export"></div>
      </section>
      <section class="panneau" data-onglet="comparer">
        <h2>4. Comparer ${bulle('comparer')}</h2>
        <div id="comparaisons" class="section-comparaisons"></div>
      </section>
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

/** Nom d'une surface dans les listes : avec son levé s'il y en a plusieurs, ou son format si importée. */
function etiquetteSurface(surface) {
  if (estImportee(surface)) return `${surface.nom} (${surface.type === 'dxf' ? 'DXF' : 'LandXML'})`;
  const leve = projet.leves.find((l) => l.id === surface.leveId);
  return projet.leves.length > 1 && leve ? `${surface.nom} · ${leve.nom}` : surface.nom;
}

/** Surface de base du volume (base B) : { nom, triangles }, ou null. */
function surfaceDeBase(surface) {
  if (surface.volume?.base !== 'surface') return null;
  const base = projet.surfaces.find((s) => s.id === surface.volume.surfaceId && s.id !== surface.id);
  return base ? { nom: base.nom, triangles: trianglesDeSurface(base.id) } : null;
}

/** Surfaces comparables : toutes les surfaces du projet. ref : 'surface:<id>'. */
function choixComparables() {
  return projet.surfaces.map((s) => ({ ref: `surface:${s.id}`, nom: etiquetteSurface(s) }));
}

/** Zones de comparaison : toute la surface « après », ou le contour d'une surface. */
function zonesComparables() {
  const zones = [{ zone: { type: 'toute' }, nom: 'toute la surface « après »' }];
  for (const surface of projet.surfaces) {
    if (!estImportee(surface) && surface.contour.length >= 3) {
      zones.push({ zone: { type: 'surface', surfaceId: surface.id }, nom: `contour de ${etiquetteSurface(surface)}` });
    }
  }
  return zones;
}

/** Calcule une comparaison du projet. */
function calculerComparaison(comparaison) {
  const triangles = (ref) => (ref?.startsWith('surface:') ? trianglesDeSurface(ref.slice('surface:'.length)) : []);
  let contour = null;
  if (comparaison.zone?.type === 'surface') {
    const surface = projet.surfaces.find((s) => s.id === comparaison.zone.surfaceId);
    if (!surface) return { erreurs: ['la surface de la zone n\'existe plus'] };
    const parNom = new Map(pointsDuLeve(surface.leveId).map((p) => [p.nom, p]));
    contour = surface.contour.map((nom) => parNom.get(nom)).filter(Boolean);
  }
  return comparerSurfaces(triangles(comparaison.avant), triangles(comparaison.apres), contour);
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
    if (!leve || !confirm(`Supprimer le levé « ${leve.nom} » et ses ${surfacesDuLeve.length} surface(s) ?`)) return;
    projet.leves = projet.leves.filter((l) => l.id !== id);
    projet.surfaces = projet.surfaces.filter((s) => s.leveId !== id);
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
    editeurSurfaces.charger(projet.surfaces);
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
  quandToucherPoint: (nom) => editeurSurfaces.toucherPoint(nom),
  quandToucherStock: (index) => editeurSurfaces.choisir(index),
  quandToucherTriangle: (triangle) => editeurSurfaces.basculerTriangle(cleTriangle(triangle)),
});

const editeurSurfaces = creerEditeurSurfaces(document.querySelector('#surfaces'), document.querySelector('#barre-surfaces'), {
  obtenirPoints: (surface) => (estImportee(surface) ? [] : pointsDuLeve(surface.leveId)),
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
document.querySelector('#fichier-surface').addEventListener('change', async (evenement) => {
  const fichier = evenement.target.files[0];
  if (!fichier) return;
  const zone = document.querySelector('#message-import-surface');
  try {
    const texte = await fichier.text();
    const type = /\.dxf$/i.test(fichier.name) ? 'dxf' : 'landxml';
    const { surfaces, erreurs, avertissements } = type === 'dxf' ? lireDXF(texte) : lireLandXML(texte);
    for (const surface of surfaces) projet.surfaces.push(surfaceImportee(surface, fichier.name, type));
    const messages = [...erreurs, ...avertissements];
    zone.innerHTML = `<p class="resume"><strong>${surfaces.length} surface(s)</strong> importée(s) de « ${echapper(fichier.name)} ».</p>
      ${messages.length > 0 ? `<div class="avertissement"><ul>${messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}`;
    editeurSurfaces.charger(projet.surfaces, { garderPosition: true });
    if (surfaces.length > 0) editeurSurfaces.choisir(projet.surfaces.length - 1);
  } catch (erreur) {
    zone.innerHTML = `<p class="erreur">Impossible de lire « ${echapper(fichier.name)} » : ${echapper(erreur.message)}</p>`;
  }
  evenement.target.value = '';
  modifie({ recadrer: true });
});

const ecranVolumes = creerEcranVolumes(document.querySelector('#volumes'), {
  obtenirLignes: () =>
    surfacesAffichees().map((surface) => ({
      surface,
      resultat: volumes.get(surface.id),
      bases: projet.surfaces.map((s) => ({ id: s.id, nom: etiquetteSurface(s) })),
    })),
  quandChange: () => modifie(),
});

const ecranComparaisons = creerEcranComparaisons(document.querySelector('#comparaisons'), {
  obtenirProjet: () => projet,
  obtenirChoix: choixComparables,
  obtenirZones: zonesComparables,
  obtenirResultat: (comparaison) => resultatsComparaisons[projet.comparaisons.indexOf(comparaison)],
  quandChange: () => modifie(),
  obtenirAffichee: () => comparaisonAMontrer()?.id ?? null,
  montrer: (id) => {
    comparaisonMontree = id;
    recalculer();
    // Sur téléphone, on passe au plan ; sur ordinateur, il est déjà visible à droite.
    if (!window.matchMedia('(min-width: 900px)').matches) afficherOnglet('plan');
  },
});

/** Comparaison coloriée sur le plan : celle choisie, sinon la première qui a un résultat. */
function comparaisonAMontrer() {
  const calculables = projet.comparaisons.filter((c, i) => resultatsComparaisons[i] && !resultatsComparaisons[i].erreurs);
  return calculables.find((c) => c.id === comparaisonMontree) ?? calculables[0] ?? null;
}

/** Surfaces affichées dont le volume est calculé : [{ surface, resultat }]. */
function volumesCalcules() {
  return surfacesAffichees()
    .map((surface) => ({ surface, resultat: volumes.get(surface.id) }))
    .filter(({ resultat }) => resultat && !resultat.erreurs);
}

const ecranExport = creerEcranExport(document.querySelector('#export'), {
  obtenirDonnees: () => {
    const leve = leveActif(projet);
    const calcules = volumesCalcules();
    const avecVolume = new Set(calcules.map(({ surface }) => surface.id));
    return {
      nomProjet: projet.nom,
      stocks: calcules.map(({ surface }) => surface),
      resultats: calcules.map(({ resultat }) => resultat),
      points: leve?.points ?? [],
      fichierPoints: leve?.nom ?? '',
      // Surfaces sans volume (les autres sont déjà exportées avec leur volume).
      surfaces: surfacesAffichees()
        .filter((s) => !avecVolume.has(s.id))
        .map((s) => ({ nom: s.nom, triangles: trianglesDeSurface(s.id) }))
        .filter((s) => s.triangles.length > 0),
      comparaisons: projet.comparaisons.map((c, i) => ({ nom: c.nom, resultat: resultatsComparaisons[i] })),
      photos: surfacesAffichees().flatMap((s) => (s.photos ?? []).map((photo) => ({ ...photo, surface: s.nom }))),
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
  const volume = volumes.get(surface.id);
  return `
    <p class="ok">✓ ${r.triangles.length} triangles · ${formaterNombre(aire)} m²${volume && !volume.erreurs ? ` · remblai ${formaterNombre(volume.remblai)} m³ (onglet 3. Volumes)` : ''}</p>
    ${r.avertissements.length > 0 ? `<div class="avertissement"><ul>${r.avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : ''}`;
}

// --- Calculs et affichage ---

/** Recalcule tout (surfaces, volumes, comparaisons) et met à jour les écrans et le plan. */
function recalculer({ recadrer = false } = {}) {
  const leve = leveActif(projet);
  const points = leve?.points ?? [];

  surfacesCalculees = new Map(projet.surfaces.map((s) => [s.id, calculerSurface(s, pointsDuLeve(s.leveId))]));
  volumes = new Map(
    projet.surfaces.map((s) => [s.id, calculerVolumeSurface(s, surfacesCalculees.get(s.id), pointsDuLeve(s.leveId), surfaceDeBase(s))]),
  );
  resultatsComparaisons = projet.comparaisons.map(calculerComparaison);

  for (const element of document.querySelectorAll('.sans-points')) element.hidden = projet.leves.length > 0;
  document.querySelector('#nom-leve-surfaces').textContent = leve ? `· levé « ${leve.nom} »` : '';
  document.querySelector('#etat').textContent = `${projet.nom} · ${points.length} points · ${surfacesAffichees().length} surface(s)`;

  editeurSurfaces.rafraichir();
  ecranVolumes.afficher();
  ecranComparaisons.afficher();
  ecranImport.afficher(projet, dernierImport);
  ecranProjet.afficher(projet, resumes);

  // Plan : surfaces du levé affiché et surfaces importées ; les autres sont cachées.
  const visibles = new Set(surfacesAffichees());
  const active = editeurSurfaces.objetActif();
  const calculActif = active ? surfacesCalculees.get(active.id) : null;
  const dansSurfaces = ongletContexte === 'surfaces';
  // Une surface importée montre ses propres points ; sinon, les points du levé.
  const pointsDuPlan = dansSurfaces && active && estImportee(active) ? active.points : points;
  // Dans l'onglet Comparer, le remblai / déblai colorié est celui de la comparaison montrée.
  const comparaison = ongletContexte === 'comparer' ? comparaisonAMontrer() : null;
  plan.redessiner({
    ...editeurSurfaces.obtenirDessin(),
    cachees: new Set(projet.surfaces.filter((s) => !visibles.has(s))),
    resultats: projet.surfaces.map((s) => {
      const calcul = surfacesCalculees.get(s.id);
      const volume = volumes.get(s.id);
      return {
        trianglesDessus: calcul?.triangles ?? null,
        segmentsEnErreur: calcul?.segmentsEnErreur ?? [],
        ...(volume && !volume.erreurs ? volume : {}),
      };
    }),
    ecarts: comparaison ? resultatsComparaisons[projet.comparaisons.indexOf(comparaison)].trianglesEcart : null,
    // Triangles supprimés à la main : montrés (en pointillés) pendant la suppression au doigt.
    surface:
      dansSurfaces && calculActif && !calculActif.erreurs && editeurSurfaces.enSuppression()
        ? { triangles: calculActif.triangles, trianglesRetires: calculActif.trianglesRetires }
        : null,
    modeTriangles: dansSurfaces && editeurSurfaces.enSuppression(),
  });
  if (recadrer || pointsDuPlan !== pointsAffiches) {
    pointsAffiches = pointsDuPlan;
    plan.afficherPoints(pointsDuPlan);
  }
  basculerModeDessin();
}

/**
 * Sur téléphone, pendant une modification (contour, ligne de rupture, triangles) :
 * le plan reste affiché en haut de l'écran et les outils en dessous (voir style.css, « mode-dessin »).
 */
function basculerModeDessin() {
  const enDessin = editeurSurfaces.enModification();
  const debut = enDessin && !document.body.classList.contains('mode-dessin');
  document.body.classList.toggle('mode-dessin', enDessin);
  if (!debut) return;
  // On revient à l'onglet Surfaces (s'il était sur le plan seul), puis on montre la carte modifiée.
  if (document.body.dataset.onglet === 'plan') afficherOnglet('surfaces');
  requestAnimationFrame(() => document.querySelector('#surfaces .en-edition')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
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

/**
 * Ouvre un projet : il devient le projet affiché, et il est enregistré.
 * Puis on va à l'étape utile : les surfaces s'il a déjà des points, sinon l'import.
 */
async function ouvrir(nouveau, { changerOnglet = true } = {}) {
  projet = nouveau;
  dernierImport = null;
  document.querySelector('#message-import-surface').innerHTML = '';
  editeurSurfaces.charger(projet.surfaces);
  montrerUneSurfaceDuLeve();
  ecranExport.rafraichir();
  recalculer({ recadrer: true });
  historique.reinitialiser(modifications, projet);
  mettreAJourAnnuler();
  if (changerOnglet) afficherOnglet(leveActif(projet) ? 'surfaces' : 'importer');
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
