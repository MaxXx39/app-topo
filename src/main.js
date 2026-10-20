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
import { creerCalcul, calculerVolume, nettoyerCalculs, nomDuCalcul, descriptionCalcul } from './volumes/calculs.js';
import { creerPlan } from './plan/plan.js';
import { creerEditeurSurfaces } from './surfaces/editeur.js';
import { creerEcranVolumes, texteBase } from './volumes/ecran.js';
import { preparerPhoto } from './photos/photo.js';
import { creerEcranExport, telecharger } from './export/ecran.js';
import { creerEcranProjet } from './projet/ecran.js';
import { creerEcranImport } from './import/ecran.js';
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
let resultatsCalculs = new Map(); // id de calcul -> volume (résultat de calculerVolume)
let ongletContexte = 'importer'; // dernier onglet (hors plan) : décide de ce que montre le plan
let calculMontre = null; // id du calcul colorié sur le plan (bouton « Voir sur le plan »)
const modifications = historique.creerHistorique(); // pour Annuler / Rétablir

// --- Mise en page : onglets ---
// Les onglets numérotés suivent l'ordre du travail : importer les points, préparer les surfaces,
// calculer les volumes. « Mes projets » s'ouvre depuis l'en-tête.
const ICONES = {
  importer: '<path d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5" />',
  surfaces: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  volumes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
};
const ONGLETS = [
  { nom: 'importer', titre: '1. Importer' },
  { nom: 'surfaces', titre: '2. Surfaces' },
  { nom: 'volumes', titre: '3. Volumes' },
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

/** Zones d'un calcul à deux surfaces : toute la surface 1, ou le contour d'une surface. */
function zonesComparables() {
  const zones = [{ zone: { type: 'toute' }, nom: 'toute la surface 1' }];
  for (const surface of projet.surfaces) {
    if (!estImportee(surface) && surface.contour.length >= 3) {
      zones.push({ zone: { type: 'surface', surfaceId: surface.id }, nom: `contour de ${etiquetteSurface(surface)}` });
    }
  }
  return zones;
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
  // Nouvelle surface : un stock a tout de suite son calcul de volume (sur sa ligne basse), un
  // terrassement aussi (par rapport au dernier terrain naturel). Voir volumes/calculs.js.
  quandCree: (surface) => {
    if (surface.nature === 'stock' || surface.nature === 'terrassement') projet.calculs.push(creerCalcul(surface, projet.surfaces));
  },
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
  obtenirProjet: () => projet,
  obtenirResultat: (calcul) => resultatsCalculs.get(calcul.id),
  etiquette: etiquetteSurface,
  obtenirZones: zonesComparables,
  surfaceActive: () => editeurSurfaces.objetActif(),
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

/** Calculs de volume du projet dont le résultat est connu : [{ calcul, resultat }]. */
function calculsReussis() {
  return projet.calculs
    .map((calcul) => ({ calcul, resultat: resultatsCalculs.get(calcul.id) }))
    .filter(({ resultat }) => resultat && !resultat.erreurs);
}

const ecranExport = creerEcranExport(document.querySelector('#export'), {
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
  const calcul = calculDuPlan(surface);
  const volume = calcul ? resultatsCalculs.get(calcul.id) : null;
  return `
    <p class="ok">✓ ${r.triangles.length} triangles · ${formaterNombre(aire)} m²${volume ? ` · remblai ${formaterNombre(volume.remblai)} m³ (onglet 3. Volumes)` : ''}</p>
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

  for (const element of document.querySelectorAll('.sans-points')) element.hidden = projet.leves.length > 0;
  document.querySelector('#nom-leve-surfaces').textContent = leve ? `· levé « ${leve.nom} »` : '';
  document.querySelector('#etat').textContent = `${projet.nom} · ${points.length} points · ${surfacesAffichees().length} surface(s)`;

  editeurSurfaces.rafraichir();
  ecranVolumes.afficher();
  ecranImport.afficher(projet, dernierImport);
  ecranProjet.afficher(projet, resumes);

  // Plan : surfaces du levé affiché et surfaces importées ; les autres sont cachées.
  const visibles = new Set(surfacesAffichees());
  const active = editeurSurfaces.objetActif();
  const calculActif = active ? surfacesCalculees.get(active.id) : null;
  const dansSurfaces = ongletContexte === 'surfaces';
  // Une surface importée montre ses propres points ; sinon, les points du levé.
  const pointsDuPlan = dansSurfaces && active && estImportee(active) ? active.points : points;
  plan.redessiner({
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
