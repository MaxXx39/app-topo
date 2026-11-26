// Application « Plans de chantier » (0.288.0, Expert, site PC et Topo Bureau ; maquette validée le 23.11) :
// dessiner un plan d'installation de chantier, de phasage ou de circulation sur les plans du projet (MN95).
// Page plein écran à part (comme Calage de plans) : « Plans » (liste du projet) · « Dessiner » (bandeau d'outils en
// haut comme AutoCAD, plan au centre, phases et élément choisi à droite).
// Étape 1 : zones, lignes (clôtures…), pistes, flèches, textes, phases, accroches, fonds. 0.289.0 (étapes 2 à 4) :
// symboles (bibliothèque de blocs modernisés à gauche, grues réglables, base-vie à étage,
// import d'un DXF de blocs),
// fond swisstopo / cadastre / surfaces, onglet « Feuille » (A4 / A3 / A1, cartouche avec logo, légende, nord, échelle,
// une page par phase), PDF et DXF.
// Calculs : topo/plan-chantier.js, topo/symboles.js, topo/feuille-chantier.js, topo/plan-chantier-dxf.js ; vue : vue.js ;
// dessin : dessin.js ; feuille : feuille.js. Rangé dans le projet : projet.plansChantier, projet.symboles (Drive).
import { habillerPage } from '../navigation/cadre-page.js';
import { presentationsDe, presentationActive, creerPresentation, appliquerPresentation, quitterPresentation, dupliquerPresentation, renommerPresentation, supprimerPresentation, synchroniserPresentation } from '../topo/presentations.js';
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte, demanderCases } from '../outils/choix.js';
import { accrocher, sourcesDesPlans, piedPerpendiculaire } from '../topo/accroche.js';
import {
  GENRES, nouveauPlanChantier, ajouterPhase, retirerPhase, ajouterObjet, retirerObjet, objetsVisibles, objetSousLePoint,
  deplacerObjet, lignesPourAccroche, resumeObjet, copiePlan, aire, longueur, sommetSousLePoint, couleurObjet, styleLigne, baseEtiquette, etiquetteSousLePoint, decalEtiquette,
  LARGEUR_FLECHE, OPACITE_ZONE, ECHELLE_PAPIER, epaisseurLigneMm, contourZoneMm, dimensionsFleche, coteDuPoint,
  decalerPolyligne, ligneLaPlusProche,
} from '../topo/plan-chantier.js';
import { creerVueChantier } from './vue.js';
import { listeGenres, apercuZone, apercuLigne } from './apercu.js';
import { chargerBibliothequeBase, entreesBibliotheque, filtrerEntrees, CATEGORIES_SYMBOLES, symbolesDuDxf, ajouterSymbolesProjet } from './bibliotheque.js';
import { dessinerVignette, symboleDeLObjet, CADRES_TEXTE, cadreDuTexte } from './dessin.js';
import { geometrieCotation, lignesDuTexte, CATEGORIES_ZONE, STYLES_LIGNE } from '../topo/plan-chantier.js';
import { SENS_DEVIATION, CLE_DEVIATION } from '../topo/panneau-deviation.js';
import { CLE_PARKING } from '../topo/parking-dynamique.js';
import { CLE_PORTAIL, GENRES_PORTAIL, PASSAGE_PORTAIL, reglagesPortail } from '../topo/portail-dynamique.js';
import { CLE_POMPE, LONGUEUR_POMPE } from '../topo/pompe-dynamique.js';
import { ouvrirGestionPhases } from './gestion-phases.js';
import { ouvrirGestionCalques, plansAvecCalques } from './gestion-calques.js';
import { autogrueDe, TONNES_MOBILES, FLECHE_MOBILE_MIN } from '../topo/grue-mobile.js';
import { reglagesGrue, ficheGrue, hauteursDe as hauteursGrue, hauteurChoisie as hauteurGrue, tourDe as tourGrue, flecheDe as flecheGrue, porteeMax as porteeGrue, RAYON_MIN as RAYON_MIN_GRUE, COULEUR_TEXTE } from '../topo/grue-fiche.js';
import { tousLesModeles, modeleDe, definirModelesPerso } from '../topo/grue-modele.js';
import { lignesDeCoupe, coupeChantier } from '../topo/coupe-chantier.js';
import { svgCoupe } from './coupe.js';
import { ouvrirModelesGrues } from './modeles-grues.js';
import { lignesChassisGrue } from '../topo/grue-accroches.js';
import { prisePresDe, pointsDePrise } from '../topo/prise-bloc.js';
import { surLeSymbole, poigneeRotation, rotationVers, coinsSymbole, POSES_ETAGE, flechesDisponibles, chassisDisponibles, CLE_CONTENEUR, coteChassis, FLECHE_MIN, FLECHE_MAX, CHASSIS_MIN, CHASSIS_MAX, echelleDeLObjet } from '../topo/symboles.js';
import { inverserSens, pointsDuRond, rectangleTroisPoints, changerRayon, pointDeBase, estRectangle, poigneeDecalageCote, decalageCoteDepuis, poigneesDe, categorieZone, TRAITS_CONTOUR, MOTIFS_HACHURE, HACHURE_ANGLE, HACHURE_PAS_MM, milieuxDesCotes, ajouterPointAuMilieu, arcSurCote, courberCote, poigneesArcs, recourber, arcsDe } from '../topo/plan-chantier.js';
import { estPose, changerOrdre, angleDeLaLigne, MATERIAUX_TAS, TAS_HAUTEUR, TAS_TALUS, TAILLE_TEXTE_MM, segmentLePlusProche, pointALaDistance, angleVers } from '../topo/plan-chantier.js';
import { plansDeLaFeuille, reglagesFeuille, nomChantierCartouche, pagesDeLaFeuille, centreDeDepart, FORMATS_FEUILLE, miseEnPageFeuille, COINS_SITUATION } from '../topo/feuille-chantier.js';
import { preparerPage, dessinerPage, creerPdfChantier, chargerImage, adresseLogo } from './feuille.js';
import { dxfPlanChantier } from '../topo/plan-chantier-dxf.js';
import { nomFichierExport } from '../outils/nom-fichier.js';
import { PALEUR_ORTHO } from './tuiles.js';
const DELAI_ARC = 150; // ms : appui sur le « + » avant que glisser courbe le côté (0.315.0 : 0,45 s avant)

const OUTILS = [
  ['zone', '<path d="M4 8L12 4L20 9L17 19H6Z"/>', 'Zone'],
  ['rectangle', '<path d="M4 9L15 4L20 15L9 20Z"/>', 'Rectangle'],
  ['rond', '<circle cx="12" cy="12" r="8"/><path d="M12 12H20"/>', 'Rond'],
  ['ligne', '<path d="M3 18L9 8L15 14L21 5"/>', 'Ligne'],
  ['fleche', '<path d="M3 14H15V9L21 15L15 21V16H3Z"/>', 'Flèche'],
  ['texte', '<path d="M5 6H19M12 6V20M9 20H15"/>', 'Texte'],
  ['decaler', '<path d="M3 16L10 6L21 13"/><path d="M3 21L11 10L21 18" opacity=".55"/>', 'Décaler'],
  ['cotation', '<path d="M4 18H20M4 14V21M20 14V21"/><path d="M4 18L7 16V20ZM20 18L17 16V20Z"/>', 'Cotation'],
  ['construction', '<path d="M3 20L21 4" stroke-dasharray="3 2.5"/><path d="M12 8V16M8 12H16"/>', 'Construction'],
];
/** Genre de l'élément choisi ou de l'outil : liste déroulante AVEC l'aperçu du trait / de la zone (le bandeau garde sa hauteur). */
const genreDeroulant = (type, valeur, cible) => {
  const genres = type === 'zone' ? CATEGORIES_ZONE : STYLES_LIGNE;
  const g = genres.find((x) => x.cle === valeur) ?? genres[0];
  return `<details class="genre-deroulant"><summary>${type === 'zone' ? apercuZone(g.cle) : apercuLigne(g)}<span>${echapper(g.nom)}</span></summary>${listeGenres(type, g.cle, cible, echapper)}</details>`;
};
const selectGenres = (type, valeur) => genreDeroulant(type, valeur, 'objet');
const selectGenresOutil = (type, valeur) => genreDeroulant(type, valeur, 'outil');
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const TRAITS_CONSTRUCTION = [['tirets', 'Tirets'], ['continu', 'Continu'], ['points', 'Pointillé'], ['mixte', 'Tirets-points']];
const ACCROCHES = [['point', 'Point'], ['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['croisement', 'Croisement'], ['perpendiculaire', 'Perpendiculaire']];
const ICONE_CHOISIR = '<path d="M6 3L18 13L12 14L15 21L12.5 22L9.5 15L6 19Z"/>';
const MAX_ANNULER = 50;
const icoCadenas = (v) => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="' + (v ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-1.8') + '"/></svg>';
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const n1 = (x) => (Math.abs(x) < 0.05 ? 0 : x).toFixed(1);
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-CH') : '');

/**
 * Ouvre la page. projet (projet.plansChantier) ; modifie() : enregistrer (et Drive) ; plans() : plans du projet prêts
 * à dessiner (recalés) ; points() : points levés ; listesPoints() : [{ id, nom, points }] (0.299.0, points montrés par liste) ; lectureSeule() : vrai si le projet ne peut pas être modifié ici ;
 * quandRetour() ; message(texte, durée, options).
 */
/** Liste déroulante simple pour un réglage (0.320.2) : `attr` = 'prop' (élément choisi) ou 'reglage' (outil). */
function listeChoix(libelle, attr, cle, options, valeur) {
  return `<label class="champ-calage"><span>${libelle}</span><select data-${attr}="${cle}">${options.map(([v, t]) => `<option value="${v}" ${valeur === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
}
const STYLES_COTE = [['dessus', 'Au-dessus, sans cadre'], ['dessus-cadre', 'Au-dessus, avec cadre'], ['sur', 'Sur la ligne'], ['coupee', 'Ligne coupée sous le texte']];
const FLECHES_COTE = [['fleche', 'Flèche'], ['point', 'Point'], ['tiret', 'Tiret oblique']];
const ARRONDIS = [['peu', 'Peu arrondi'], ['carre', 'Carré'], ['normal', 'Très arrondi']];

export function ouvrirPlansChantier({
  projet: projetDonne, modifie, plans: plansDonnes = () => [], points = () => [], listesPoints = null, surfaces = () => [], enregistrer: enregistrerFichier = null,
  auteur = () => '', lectureSeule = () => false, quandRetour = null, message = () => {},
}) {
  // Le projet est relu à chaque fois (projet() ou objet) : l'appli peut le remplacer (Drive, Annuler général).
  const leProjet = typeof projetDonne === 'function' ? projetDonne : () => projetDonne;
  const liste = () => {
    const pr = leProjet();
    pr.plansChantier ??= [];
    return pr.plansChantier;
  };
  // 0.320.2 : tous les plans du projet sont proposés ici, quel que soit le dossier choisi dans le projet (le dossier coche /
  // décoche l'affichage du plan principal, pas celui des plans de chantier). Copie « visible » gardée en mémoire (même objet
  // d'un appel à l'autre : le cache de dessin reste valable ; ne jamais copier un plan avec { ...p }).
  const copiesVisibles = new WeakMap();
  const plans = () => plansDonnes().map((p) => {
    if (p.visible !== false) return p;
    if (!copiesVisibles.has(p)) copiesVisibles.set(p, Object.assign(Object.create(p), { visible: true, sourcePlan: p.sourcePlan ?? p }));
    return copiesVisibles.get(p);
  });
  const synchroModeles = () => definirModelesPerso(leProjet().modelesGrues); // 0.311.0 : modèles de grues du projet (en plus de ceux livrés)
  synchroModeles();
  /**
   * 0.299.0 : points levés montrés sur le plan de chantier : ceux des listes cochées (plan.fond.listesPointsCachees = ids
   * décochés), un nom ne compte qu'une fois ; rien si les points sont cachés.
   */
  const pointsMontres = () => {
    const pc = plan();
    if (pc?.fond?.points === false) return [];
    if (!listesPoints) return points();
    const caches = new Set(pc?.fond?.listesPointsCachees ?? []);
    const vus = new Set();
    const res = [];
    for (const l of listesPoints()) {
      if (caches.has(l.id)) continue;
      for (const q of l.points) {
        if (vus.has(q.nom)) continue;
        vus.add(q.nom);
        res.push(q);
      }
    }
    return res;
  };
  let dernierMessagePrise = 0;
  let bandeDessin = ''; // 0.327.0 : outils posés dans la bande du bas (accroches, ortho, échelle, 3D, texte) : remplie par htmlDessin
  const page = document.createElement('dialog');
  page.className = 'page-chantier';
  habillerPage(page, { couleur: '#b45309', titre: 'Plans de chantier', contenuBande: () => bandeDessin });
  document.body.append(page);
  page.showModal();

  const etat = {
    ecran: 'liste', planId: null, outil: 'choisir', saisie: null, choisi: null, accroches: new Set(['point', 'sommet']),
    categorie: 'installation', style: 'cloture', largeur: 4, tailleTexte: 1.2, curseur: null, cadreTexte: 'arrondi', styleCote: 'sur', flecheCote: 'fleche', tailleFlecheCote: 2.6, coteTexte: 'fin', arrondi: 'peu',
    // Réglages de l'outil (valeurs données aux éléments dessinés ensuite) : null = celle du genre.
    opacite: OPACITE_ZONE, contourMm: null, afficherSurface: false, epaisseurMm: null, echelleMotif: 1,
    // 0.299.0 : trait du contour d'une zone et hachure (en plus du remplissage) donnés aux zones dessinées ensuite.
    traitContour: 'continu', hachure: { motif: 'aucune', angle: HACHURE_ANGLE, pasMm: HACHURE_PAS_MM, couleur: '' },
    largeurFleche: LARGEUR_FLECHE, echelleFleche: 1, texteRepere: false, repereBout: 'fleche', distanceDecalage: 0.5, cotationGenre: 'longueur', ortho: false, orthoAngle: 0, orthoRepere: false,
    attenteRepere: null, // id du texte qui attend le point visé par sa ligne de repère
    reglageEnCours: false, // un curseur (transparence…) est en train d'être glissé
    glisse: null, // glisse : { type: 'sommet', i } ou { type: 'objet' } ou { type: 'rotation' }
    // 0.289.0 : symboles
    pose: null, // élément à poser (outil « symbole ») : { type: 'symbole', cle… } ou { type: 'grue', … }
    rotationPose: 0, biblio: { ouvert: false, categorie: '', recherche: '' }, fondEtat: null,
    orienter: null, // 0.290.0 : { id, mode: 'point' | 'ligne' } : le prochain clic oriente le symbole choisi
    constructionMode: 'segment', constructionTrait: 'tirets', // 0.294.1 : segment par défaut ; 0.293.0 : 'droite' (2 points) | 'angle' (1 point + angle tapé) | 'segment' (2 points ou longueur tapée)
    coupe: { ouvert: false, ligne: null, cachees: new Set() }, // 0.311.0 : vue de côté (coupe) ; 0.312.0 : surfaces cachées, ligne de coupe tracée
    coupeProchaine: false, // le prochain segment de construction dessiné est une ligne de coupe
    decalerConstruction: false, // Décaler : créer une ligne de construction (parallèle) au lieu d'une ligne
  };
  let vue = null;
  let pileAnnuler = [];
  // Bibliothèque des symboles : livrée (chargée à l'ouverture) + importée dans le projet.
  let bibBase = [];
  const bib = () => [...bibBase, ...(leProjet().symboles ?? [])];
  chargerBibliothequeBase().then((liste) => {
    bibBase = liste;
    if (fermee) return;
    if (etat.ecran === 'dessin') {
      majBiblio();
      majTout();
    } else if (etat.ecran === 'feuille') majFeuille();
  });

  const plan = () => liste().find((x) => x.id === etat.planId) ?? null;
  // 0.296.1 : plans montrés dessous PAR PHASE (plan.fond.plansParPhase[idPhase] = ids), sinon le choix général (plansCaches)
  const plansMontres = (idPhase = plan()?.phaseActive) => {
    const fond = plan()?.fond;
    const propres = fond?.plansParPhase?.[idPhase];
    if (propres) return plans().filter((p) => propres.includes(p.id));
    const caches = new Set(fond?.plansCaches ?? []);
    return plans().filter((p) => !caches.has(p.id));
  };
  // 0.296.0 : réglages de calques (masqués, couleurs) propres à ce plan de chantier
  const plansFond = (idPhase) => plansAvecCalques(plansMontres(idPhase), plan()?.fond);
  // 0.317.0 : plans de la FEUILLE, réglés à part de l'écran (plan.feuille.plans : cases + opacité) ; sans réglage = comme l'écran.
  const plansFeuille = (idPhase) => {
    const p = plan();
    return plansDeLaFeuille(plansAvecCalques(plans(), p?.fond), plansFond(idPhase), p ? reglagesFeuille(p).plans : null);
  };

  let fermee = false;
  function fermer() {
    fermee = true;
    vue?.detruire();
    feuille?.observateur?.disconnect();
    page.close();
    page.remove();
    quandRetour?.();
  }
  // Le navigateur peut fermer la page à un 2e Échap malgré tout (Chrome) : on la rouvre, seul « ← » la ferme.
  page.addEventListener('close', () => {
    if (!fermee && page.isConnected) page.showModal();
  });

  /** Avant chaque changement : refusé en lecture seule, sinon on garde l'état d'avant (↶ Annuler). */
  function avantChangement() {
    if (lectureSeule()) {
      message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      return false;
    }
    pileAnnuler.push(copiePlan(plan()));
    if (pileAnnuler.length > MAX_ANNULER) pileAnnuler.shift();
    return true;
  }
  function enregistrer() {
    plan().modifieLe = new Date().toISOString();
    synchroniserPresentation(plan()); // 0.330.0 : la présentation choisie reprend les réglages de la feuille (toute seule)
    modifie();
  }
  function annuler() {
    const avant = pileAnnuler.pop();
    if (!avant) {
      message('Rien à annuler.', 2500);
      return;
    }
    const p = plan();
    for (const cle of Object.keys(p)) delete p[cle];
    Object.assign(p, avant);
    if (!p.objets.some((o) => o.id === etat.choisi)) etat.choisi = null;
    enregistrer();
    majTout();
  }

  function echap() {
    if (etat.orienter) {
      etat.orienter = null;
      majTout();
    } else if (etat.attenteRepere) {
      etat.attenteRepere = null;
      majTout();
    } else if (etat.saisie) {
      etat.saisie = null;
      majTout();
    } else if (etat.choisi) {
      etat.choisi = null;
      majTout();
    } else if (etat.outil !== 'choisir') {
      etat.outil = 'choisir';
      majTout();
    }
  }
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    echap();
  });
  // Liste des genres (0.296.2) : ouverte sous son bouton, en position fixe (le bandeau a un défilement qui la couperait).
  page.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d.matches?.('details.genre-deroulant') || !d.open) return;
    const liste = d.querySelector('.liste-genres');
    const r = d.querySelector('summary').getBoundingClientRect();
    Object.assign(liste.style, { position: 'fixed', left: `${r.left}px`, top: `${r.bottom + 2}px`, width: `${Math.max(r.width, 320)}px`, maxHeight: `${Math.max(160, window.innerHeight - r.bottom - 16)}px` });
  }, true);

  page.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ['z', 'y'].includes(ev.key.toLowerCase())) ev.stopPropagation();
    // Échap (0.287.0) : arrête le dessin ou le choix, mais ne ramène jamais au menu de l'appli.
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      if (!ev.target.matches('input, select, textarea')) {
        ev.preventDefault();
        echap();
      }
      return;
    }
    if (etat.ecran !== 'dessin') return;
    if (ev.key === 'F8') {
      ev.preventDefault();
      etat.ortho = !etat.ortho;
      majOutils();
      return majConsigne();
    }
    const dansChamp = ev.target.matches('input, select, textarea');
    if (ev.key === 'Enter' && ev.target.matches('[data-saisie]')) {
      ev.preventDefault();
      placerParSaisie();
      return;
    }
    // Un chiffre tapé pendant le dessin va tout de suite dans « Longueur » (comme la saisie directe d'AutoCAD).
    if (!dansChamp && etat.saisie?.points?.length && etat.saisie.outil !== 'decaler' && /^[0-9.,]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
      const champ = page.querySelector('[data-saisie="longueur"]:not([hidden])') && !page.querySelector('[data-zone="saisie"]').hidden ? page.querySelector('[data-saisie="longueur"]') : null;
      champ?.focus();
      return;
    }
    if (ev.key === 'Enter' && !dansChamp && etat.saisie) {
      ev.preventDefault();
      finirSaisie();
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !dansChamp && etat.choisi) {
      ev.preventDefault();
      supprimerChoisi();
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !dansChamp) {
      ev.preventDefault();
      annuler();
    }
  });

  // ================================================================ Page

  /** Remet la bande du bas à jour (valeurs de l'échelle, du texte…) sans tout redessiner. */
  function majBande() {
    if (etat.ecran === 'dessin') {
      page.majBandePage?.();
      majOutils();
    }
  }

  function dessiner() {
    bandeDessin = ''; // seul l'onglet Dessiner met des outils dans la bande (htmlDessin la remplit)
    synchroModeles();
    vue?.detruire();
    vue = null;
    feuille?.observateur?.disconnect();
    feuille = null;
    page.innerHTML = `
      <header class="entete-calage entete-chantier">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Plans de chantier ${bulle('plansChantier')}</h2>
        <nav class="etapes-calage" aria-label="Parties">
          <button type="button" data-ecran="liste" class="${etat.ecran === 'liste' ? 'actif' : ''}">Plans</button>
          <button type="button" data-ecran="dessin" class="${etat.ecran === 'dessin' ? 'actif' : ''}" ${plan() ? '' : 'disabled'}>Dessiner</button>
          <button type="button" data-ecran="feuille" class="${etat.ecran === 'feuille' ? 'actif' : ''}" ${plan() ? '' : 'disabled'}>Feuille</button>
        </nav>
        ${plan() && etat.ecran !== 'liste' ? `<span class="nom-plan-chantier">${echapper(plan().nom)}</span>` : ''}
      </header>
      <main class="contenu-calage ${etat.ecran !== 'liste' ? 'en-calage' : ''}">${etat.ecran === 'dessin' ? htmlDessin() : etat.ecran === 'feuille' ? htmlFeuille() : htmlListe()}</main>`;
    if (etat.ecran === 'dessin') monterVue();
    if (etat.ecran === 'feuille') monterFeuille();
  }

  // ---------------------------------------------------------------- Liste des plans

  function htmlListe() {
    const tries = [...liste()].sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)));
    const genre = (g) => GENRES.find(([c]) => c === g)?.[1] ?? '';
    return `
      <div class="barre-calage"><button type="button" class="bouton" data-action="nouveau">＋ Nouveau plan</button></div>
      ${tries.length ? `<div class="cadre-tableau-calage"><table class="tableau-calage">
        <thead><tr><th>Plan</th><th>Genre</th><th>Phases</th><th>Objets</th><th>Modifié</th><th></th></tr></thead>
        <tbody>${tries.map((p) => `<tr>
          <td><strong>${echapper(p.nom)}</strong></td><td>${echapper(genre(p.genre))}</td>
          <td class="chiffre">${p.phases.length}</td><td class="chiffre">${p.objets.length}</td><td>${dateCourte(p.modifieLe)}</td>
          <td class="actions-chantier"><button type="button" class="bouton" data-ouvrir="${echapper(p.id)}">Ouvrir</button>
            <button type="button" class="bouton-secondaire" data-renommer="${echapper(p.id)}">Renommer</button>
            <button type="button" class="bouton-secondaire" data-dupliquer="${echapper(p.id)}">Dupliquer</button>
            <button type="button" class="bouton-secondaire" data-supprimer="${echapper(p.id)}">Supprimer</button></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="aide-calage">Aucun plan de chantier dans ce projet.</p>'}`;
  }

  async function nouveau() {
    if (lectureSeule()) {
      message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      return;
    }
    const genre = await demanderChoix({ titre: 'Nouveau plan de chantier', boutons: [...GENRES.map(([cle, texte], i) => ({ cle, texte, principal: i === 0 })), { cle: '', texte: 'Annuler' }] });
    if (!genre) return;
    const titre = GENRES.find(([c]) => c === genre)[1];
    const nom = await demanderTexte({ titre: 'Nom du plan', valeur: `${titre} ${liste().filter((p) => p.genre === genre).length + 1}` });
    if (!nom) return;
    const p = nouveauPlanChantier(nom, genre);
    liste().push(p);
    modifie();
    ouvrirPlan(p);
  }

  function ouvrirPlan(p) {
    etat.planId = p.id;
    etat.ecran = 'dessin';
    etat.outil = 'choisir';
    etat.saisie = null;
    etat.choisi = null;
    pileAnnuler = [];
    dessiner();
  }

  // ---------------------------------------------------------------- Dessiner

  function htmlDessin() {
    // 0.297.1 : le ruban tient sur UNE ligne : icônes seules (le nom est dans l'infobulle), plus de titres de groupes.
    const groupe = (titre, html) => `<div class="groupe-ruban" role="group" aria-label="${titre}">${html}</div>`;
    // Mots courts sous les icônes (le nom complet est dans l'infobulle) : un juste milieu entre icônes seules et textes longs.
    const COURTS = {
      'Sélectionner': 'Choisir', 'Effacer': 'Effacer', 'Annuler (Ctrl+Z)': 'Annuler', 'Zone': 'Zone', 'Ligne': 'Ligne', 'Flèche': 'Flèche', 'Texte': 'Texte',
      'Décaler': 'Décaler', 'Cotation': 'Cote', 'Construction': 'Constr.', 'Bibliothèque de symboles': 'Symboles',
      'Accroche : point levé': 'Point', 'Accroche : sommet': 'Sommet', 'Accroche : milieu': 'Milieu', 'Accroche : sur la ligne': 'Ligne', 'Accroche : croisement': 'Croisem.', 'Accroche : perpendiculaire': 'Perpend.',
      'Plans du projet dessous (par phase)': 'Plans', 'Calques des plans affichés (masquer, couleur)': 'Calques', 'Points levés': 'Points', 'Fond : carte nationale': 'Carte', 'Fond : photo aérienne': 'Ortho', 'Fond : cadastre': 'Cadastre', 'Fond : surfaces du projet': 'Surfaces',
      'Repère à 0° : Nord / Sud / Est / Ouest': 'N S E O', 'Montrer / cacher les lignes de construction (jamais imprimées)': 'Constr.', 'Vue de côté (coupe) : grues, bâtiments, terrains et plateformes le long d\'une ligne': 'Coupe', 'Tracer une ligne de coupe (2 points, avec les accroches)': 'Tracer', 'Zoom avant': '+', 'Zoom arrière': '−', 'Tout voir': 'Tout',
    };
    const court = (titre) => COURTS[titre] ?? (titre.startsWith('Ortho') ? 'Ortho F8' : titre.startsWith('Repère de l') ? 'Repère' : titre);
    const bt = (attrs, icone, titre, classe = '') => `<button type="button" class="outil-ruban ${classe}" ${attrs} title="${titre}" aria-label="${titre}">${ico(icone)}<span>${court(titre)}</span></button>`;
    const outil = (cle, icone, texte) => bt(`data-outil="${cle}"`, icone, texte);
    const ICONES_ACCROCHE = {
      point: '<rect x="5" y="5" width="14" height="14" rx="1"/><circle cx="12" cy="12" r="2.2"/>',
      sommet: '<rect x="6" y="6" width="12" height="12"/>',
      milieu: '<path d="M12 5L19 18H5Z"/>',
      ligne: '<path d="M4 19L20 5"/><circle cx="12" cy="12" r="2.4"/>',
      croisement: '<path d="M5 5L19 19M19 5L5 19"/><rect x="8.5" y="8.5" width="7" height="7"/>',
      perpendiculaire: '<path d="M5 19H19M12 19V6"/><path d="M12 15H16V19"/>',
    };
    const TITRES_ACCROCHE = { point: 'Accroche : point levé', sommet: 'Accroche : sommet', milieu: 'Accroche : milieu', ligne: 'Accroche : sur la ligne', croisement: 'Accroche : croisement', perpendiculaire: 'Accroche : perpendiculaire' };
    // 0.327.0 : accroches, ortho, échelle, effet 3D et taille du texte des symboles sont dans la BANDE DU BAS (à droite du bouton de l'appli) :
    // ça libère le ruban du haut. Les gestionnaires restent ceux de la page (clics et changements sur toute la page).
    const echellePapier = plan()?.echelle ?? ECHELLE_PAPIER;
    bandeDessin = `
      ${groupe('Accroche', ACCROCHES.map(([c]) => bt(`data-accroche="${c}"`, ICONES_ACCROCHE[c], TITRES_ACCROCHE[c], etat.accroches.has(c) ? 'actif' : '')).join(''))}
      ${groupe('Ortho', `${bt('data-action="ortho"', '<path d="M5 5V19H19"/><path d="M5 14H10V19"/>', 'Ortho (F8) : le dessin est aimanté aux directions N / S / E / O ou à celles du repère', etat.ortho ? 'actif' : '')}
          <input type="number" step="0.1" value="${etat.orthoAngle}" data-reglage="orthoAngle" class="champ-ortho" title="Angle du repère de l'Ortho en degrés (0 = Nord / Sud / Est / Ouest)" aria-label="Angle du repère de l'Ortho">
          ${bt('data-action="ortho-zero"', '<path d="M12 3V21M3 12H21"/><path d="M12 3L9.5 7H14.5Z"/>', 'Repère à 0° : Nord / Sud / Est / Ouest')}
          ${bt('data-action="ortho-repere"', '<path d="M3 17L21 7"/><path d="M14 12V20L16.4 17.6L19 20.6"/>', 'Repère de l\'Ortho = l\'angle d\'une ligne cliquée')}`)}
      ${groupe('Échelle', `<label class="champ-bande" title="Échelle d'impression 1 : (choisis dans la liste ou tape-la)"><span>Échelle 1 :</span><input type="text" inputmode="numeric" list="echelles-chantier" value="${echellePapier}" data-champ="echelle" aria-label="Échelle d'impression" size="6" autocomplete="off"></label>
        <datalist id="echelles-chantier">${[50, 100, 200, 250, 500, 1000, 2000].map((x) => `<option value="${x}"></option>`).join('')}</datalist>`)}
      ${groupe('Affichage', `<label class="case-bande" title="Décoché : symboles aux couleurs unies, sans dégradé ni ombre (écran et feuille)"><input type="checkbox" data-champ="rendu3d" ${plan()?.rendu3d === false ? '' : 'checked'}> <span>Effet 3D</span></label>
        <label class="champ-bande" title="Texte des symboles, en mm sur le papier"><span>Texte (mm)</span><input type="number" min="0.5" max="12" step="0.5" value="${plan()?.tailleTexteMm ?? TAILLE_TEXTE_MM}" data-champ="tailleTexteMm" size="4" aria-label="Texte des symboles en mm sur le papier"></label>`)}`;
    return `
      <div class="ruban-calage ruban-chantier ruban-une-ligne" role="toolbar" aria-label="Outils de dessin">
        ${groupe('Sélection', `${outil('choisir', ICONE_CHOISIR, 'Sélectionner')}
          ${bt('data-action="effacer"', '<path d="M5 5L19 19M19 5L5 19"/>', 'Effacer')}
          ${bt('data-action="annuler"', '<path d="M9 14L4 9L9 4"/><path d="M4 9H14A6 6 0 0 1 14 21H11"/>', 'Annuler (Ctrl+Z)')}`)}
        ${groupe('Dessin', OUTILS.map(([c, i, t]) => outil(c, i, t)).join(''))}
        ${groupe('Symboles', bt(`data-action="biblio" aria-pressed="${etat.biblio.ouvert}"`, '<rect x="3" y="7" width="12" height="9" rx="1"/><path d="M15 10H19L21 13V16H15"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>', 'Bibliothèque de symboles'))}
        ${groupe('Fond', `${bt('data-action="fond-plans"', '<path d="M3 6L9 4L15 6L21 4V18L15 20L9 18L3 20Z"/><path d="M9 4V18M15 6V20"/>', 'Plans du projet dessous (par phase)')}
          ${bt('data-action="fond-calques"', '<path d="M12 4L21 9L12 14L3 9Z"/><path d="M3 13L12 18L21 13"/>', 'Calques des plans affichés (masquer, couleur)')}
          ${bt('data-action="fond-points"', '<circle cx="7" cy="8" r="1.7"/><circle cx="16" cy="7" r="1.7"/><circle cx="11" cy="16" r="1.7"/><circle cx="19" cy="15" r="1.7"/>', 'Points levés')}
          ${bt('data-action="fond-carte"', '<circle cx="12" cy="12" r="8"/><path d="M15.5 8.5L13.2 13.2L8.5 15.5L10.8 10.8Z"/>', 'Fond : carte nationale')}
          ${bt('data-action="fond-ortho"', '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 7L9.5 5H14.5L16 7"/>', 'Fond : photo aérienne')}
          ${bt('data-action="fond-cadastre"', '<path d="M4 4H20V20H4Z"/><path d="M4 12H20M12 4V20"/>', 'Fond : cadastre')}
          ${bt('data-action="fond-surfaces"', '<path d="M3 18L9 8L14 13L21 5"/><path d="M3 18H21"/>', 'Fond : surfaces du projet')}`)}
        ${groupe('Construction', bt('data-action="construction-visible"', '<path d="M2 12S6 5 12 5S22 12 22 12S18 19 12 19S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', 'Montrer / cacher les lignes de construction (jamais imprimées)'))}
        ${groupe('Coupe', `${bt(`data-action="coupe" aria-pressed="${etat.coupe.ouvert}"`, '<path d="M3 20H21"/><path d="M6 20V9H12V20"/><path d="M15 20V4M15 4L21 8H15"/>', 'Vue de côté (coupe) : grues, bâtiments, terrains et plateformes le long d\'une ligne')}
          ${bt('data-action="coupe-tracer"', '<path d="M3 18L21 6" stroke-dasharray="4 2 1 2"/><path d="M3 13V21M21 1V9"/>', 'Tracer une ligne de coupe (2 points, avec les accroches)')}`)}
        ${groupe('Zoom', `${bt('data-zoom="tout"', '<path d="M4 9V4H9M20 9V4H15M4 15V20H9M20 15V20H15"/>', 'Tout voir')}`)}
      </div>
      <div class="ruban-element" data-zone="bandeau-element"></div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="saisie-longueur" data-zone="saisie" hidden>
        <label>Longueur <input type="text" inputmode="decimal" size="7" data-saisie="longueur" placeholder="m" autocomplete="off"></label>
        <label>Angle <input type="text" inputmode="decimal" size="6" data-saisie="angle" placeholder="° (sens inverse, depuis l'Est)" autocomplete="off"></label>
        <button type="button" class="bouton-secondaire" data-action="saisie-ok">↵ Placer le point</button>
      </div>
      <div class="travail-chantier ${etat.biblio.ouvert ? 'avec-biblio' : ''}">
        <aside class="carte-calage biblio-chantier" data-zone="biblio" ${etat.biblio.ouvert ? '' : 'hidden'}></aside>
        <div class="vue-calage vue-chantier">
          <div class="toile-chantier" data-toile></div>
          <div class="coupe-chantier" data-zone="coupe" ${etat.coupe.ouvert ? '' : 'hidden'}></div>
          <div class="pied-vue etat-chantier" data-zone="etat"></div>
        </div>
        <aside class="carte-calage panneau-chantier" data-zone="panneau"></aside>
      </div>`;
  }

  function monterVue() {
    vue = creerVueChantier(page.querySelector('[data-toile]'), {
      plans: plansFond,
      points: () => (pointsMontres()),
      planChantier: plan,
      choisi: () => etat.choisi,
      saisie: saisieVue,
      bibliotheque: bib,
      surfaces,
      apercu: () => (etat.outil === 'symbole' && etat.pose ? { ...etat.pose, rotation: etat.rotationPose } : null),
      etatFond: (r) => {
        etat.fondEtat = r;
      },
      accrocher: accrochage,
      clic: toucher,
      double: (p) => {
        if (etat.outil === 'choisir' && etat.choisi && p && supprimerSommet(p, 10 / (vue?.vue?.().echelle ?? 1))) return; // double-clic sur un carré = supprimer ce point
        if (etat.saisie?.outil === 'decaler') return;
        if (etat.saisie && etat.saisie.outil !== 'zone') finirSaisie();
        else if (etat.saisie?.outil === 'zone' && etat.saisie.points.length >= 3) finirSaisie();
      },
      bouge: (p) => {
        etat.curseur = p;
        majEtat();
      },
      glisserObjet: {
        // 0.287.0 : sur une poignée (sommet) de l'élément choisi = déplacer ce sommet (avec l'accroche) ; ailleurs sur
        // l'élément = le déplacer en entier.
        debut: (p, tol) => {
          if (etat.outil !== 'choisir' || !etat.choisi || etat.orienter) return false;
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return false;
          if (o.verrou) {
            message('Élément verrouillé : « Déverrouiller » dans le bandeau pour le déplacer.', 2500);
            return false;
          }
          // 0.320.5 : le texte d'une zone ou d'un bloc (surface, tas, texte) se prend par sa poignée
          if (etiquetteSousLePoint(o, p, tol)) {
            if (!avantChangement()) return false;
            etat.glisse = { type: 'etiquette', base: baseEtiquette(o) };
            return true;
          }
          if (estPose(o)) {
            // Symbole : la poignée ronde = tourner ; ailleurs sur lui = le déplacer (son centre s'accroche).
            const sy = symboleDeLObjet(bib(), o);
            const r = sy ? poigneeRotation(o, sy) : null;
            if (r && Math.hypot(p[0] - r[0], p[1] - r[1]) <= tol * 1.4) {
              if (!avantChangement()) return false;
              etat.glisse = { type: 'rotation' };
              return true;
            }
            // 0.320.2 : on ne prend un bloc que par l'un de ses points d'accroche (les petits ronds) : le point pris suit la
            // souris et s'accroche ; ailleurs sur le bloc il ne bouge pas (sinon il se décalait de là où l'on avait cliqué).
            const base = prisePresDe(o, sy, p, tol * 1.5);
            if (!base) {
              if (toucheSymbole(o, p, tol) && Date.now() - dernierMessagePrise > 5000) {
                dernierMessagePrise = Date.now();
                message('Pour déplacer ce bloc : prenez-le par un de ses petits ronds (points d\'accroche).', 3000);
              }
              return false;
            }
            if (!avantChangement()) return false;
            etat.glisse = { type: 'objet', decal: [base[0] - o.point[0], base[1] - o.point[1]] };
            return true;
          }
          // 0.315.0 : la poignée ronde au milieu d'un arc : glisser = courber de nouveau (pas d'appui long)
          const arcPris = poigneesArcs(o).find((x) => Math.hypot(p[0] - x.point[0], p[1] - x.point[1]) <= tol * 1.3);
          if (arcPris) {
            if (!avantChangement()) return false;
            etat.glisse = { type: 'recourber', numero: arcPris.numero };
            return true;
          }
          // 0.328.0 : la poignée ronde au milieu de la ligne de cote : glisser = éloigner / rapprocher la ligne de cote.
          const hc = poigneeDecalageCote(o);
          if (hc && Math.hypot(p[0] - hc[0], p[1] - hc[1]) <= tol * 1.4) {
            if (!avantChangement()) return false;
            etat.glisse = { type: 'decalage-cote' };
            return true;
          }
          let i = sommetSousLePoint(o, p, tol);
          // 0.328.0 : angle d'un RECTANGLE, ou point nord / ouest / sud d'un ROND : on déplace toute la forme en la prenant par ce point
          // (le point pris suit la souris et s'accroche, comme pour un symbole).
          if (i >= 0 && (estRectangle(o) || (o.cercle && i >= 2))) {
            if (!avantChangement()) return false;
            etat.glisse = { type: 'coin', ref: [...poigneesDe(o)[i]] };
            return true;
          }
          // 0.299.0 : le petit « + » au milieu d'un côté : glisser = un nouveau point qui suit la souris.
          const m = i < 0 ? milieuSousLePoint(o, p, tol) : -1;
          if (m >= 0) {
            // 0.307.0 : appui sur le « + » puis glisser = le côté devient un arc qui suit la souris ; 0.315.0 : appui court
            // (0,15 s) ; l'arc reste modifiable (poignée ronde au milieu).
            const g = { type: 'milieu', index: m, t0: Date.now() };
            etat.glisse = g;
            setTimeout(() => { if (etat.glisse === g) message('Arc : glissez pour courber le côté (relâchez pour le garder).', 2500); }, DELAI_ARC);
            return true;
          }
          if (o.type === 'texte' && i === 0) i = -1; // le texte se déplace en entier ; seule la poignée du repère est un sommet
          if (i < 0 && objetSousLePoint(objetsVisibles(plan()), p, tol)?.id !== etat.choisi) return false;
          if (!avantChangement()) return false;
          etat.glisse = i >= 0 ? { type: 'sommet', i } : { type: 'objet' };
          return true;
        },
        deplacer: (de, dn, point) => {
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return;
          if (etat.glisse?.type === 'etiquette') {
            o.decalEtiq = decalEtiquette(o, etat.glisse.base, point);
            return;
          }
          if (etat.glisse?.type === 'rotation') {
            o.rotation = rotationVers(o, point);
            return majEtat();
          }
          if (etat.glisse?.type === 'decalage-cote') {
            o.decalage = decalageCoteDepuis(o, point);
            return;
          }
          if (etat.glisse?.type === 'coin') {
            deplacerObjet(o, point[0] - etat.glisse.ref[0], point[1] - etat.glisse.ref[1]);
            etat.glisse.ref = [...point];
            return;
          }
          if (estPose(o)) {
            // Le point saisi suit la souris (et s'accroche) : comme « Déplacer » d'AutoCAD avec un point de base.
            const [dx, dy] = etat.glisse?.decal ?? [0, 0];
            o.point = [point[0] - dx, point[1] - dy];
            return;
          }
          if (etat.glisse?.type === 'milieu' && Date.now() - etat.glisse.t0 >= DELAI_ARC) {
            if (!avantChangement()) return;
            etat.glisse = { type: 'arc', index: etat.glisse.index, base: o.points.map((q) => [...q]), baseArcs: arcsDe(o).map((a) => ({ ...a })) };
          }
          if (etat.glisse?.type === 'recourber') {
            recourber(o, etat.glisse.numero, point);
            return;
          }
          if (etat.glisse?.type === 'arc') {
            const r = courberCote(etat.glisse.base, etat.glisse.baseArcs, etat.glisse.index, point, o.type === 'zone');
            o.points = r.points;
            o.arcs = r.arcs;
            o.arcsLen = r.arcsLen;
            return;
          }
          if (etat.glisse?.type === 'milieu') {
            if (!avantChangement()) return;
            o.points = ajouterPointAuMilieu(o.points, etat.glisse.index, o.type === 'zone');
            etat.glisse = { type: 'sommet', i: etat.glisse.index + 1 };
          }
          if (etat.glisse?.type === 'sommet' && o.cercle) {
            // Rond : centre = le déplacer ; point du bord = changer le rayon.
            if (etat.glisse.i === 0) deplacerObjet(o, point[0] - o.cercle.centre[0], point[1] - o.cercle.centre[1]);
            else changerRayon(o, Math.hypot(point[0] - o.cercle.centre[0], point[1] - o.cercle.centre[1]));
            return;
          }
          if (etat.glisse?.type === 'sommet') {
            if (o.type === 'texte') o.repere = point;
            else o.points[etat.glisse.i] = point;
          } else deplacerObjet(o, de, dn);
        },
        fin: () => {
          etat.glisse = null;
          enregistrer();
          majPanneau();
        },
      },
    });
    majTout();
    majBiblio();
  }

  /** Dessin en cours pour la vue ; pendant un décalage, avec l'aperçu de la copie du côté où est la souris. */
  function saisieVue() {
    if (etat.orthoRepere && etat.curseur) {
      // 0.296.2 : on voit la ligne qui sera prise comme repère de l'Ortho (surbrillance orange)
      const tol = 10 / (vue?.vue?.().echelle ?? 1);
      const lignes = lignesRepere(etat.curseur, tol);
      const source = segmentLePlusProche(lignes, etat.curseur, tol * 1.5); // le segment visé, pas toute la polyligne
      if (source) return { outil: 'ortho-repere', points: [], source, style: 'libre' };
    }
    const s = etat.saisie;
    // 0.301.0 : aperçu du rectangle (2 coins posés) et du rond (centre posé) qui suit la souris.
    if (s && etat.curseur && s.outil === 'rectangle' && s.points.length === 2) {
      const r = rectangleTroisPoints(s.points[0], s.points[1], etat.curseur);
      if (r) return { ...s, apercu: [...r, r[0]] };
    }
    if (s && etat.curseur && s.outil === 'rond' && s.points.length === 1) {
      const rayon = Math.hypot(etat.curseur[0] - s.points[0][0], etat.curseur[1] - s.points[0][1]);
      if (rayon > 0.001) {
        const r = pointsDuRond(s.points[0], rayon, 48);
        return { ...s, apercu: [...r, r[0]] };
      }
    }
    if (!s?.source || !etat.curseur) return s;
    return { ...s, apercu: decalerPolyligne(s.source, coteDuPoint(s.source, etat.curseur) * etat.distanceDecalage) };
  }

  /** Le point p touche-t-il le symbole posé o (boîte tournée) ? */
  function toucheSymbole(o, p, tol) {
    const sy = symboleDeLObjet(bib(), o);
    return sy ? surLeSymbole(o, sy, p, tol) : Math.hypot(p[0] - o.point[0], p[1] - o.point[1]) <= tol + 1;
  }
  /** Élément sous le point (symboles compris). */
  const objetSous = (p, tol) => objetSousLePoint(objetsVisibles(plan()), p, tol, toucheSymbole);

  /** Boîtes des symboles posés, pour l'accroche (sommets, milieux des côtés) ; grues : leur châssis. */
  const lignesSymboles = (objets) => objets.filter(estPose).flatMap((o) => {
    if (o.type === 'grue') return lignesChassisGrue(o);
    const sy = symboleDeLObjet(bib(), o);
    if (!sy) return [];
    const boite = { points: coinsSymbole(o, sy).map(([est, nord]) => ({ est, nord, altitude: null })), ferme: true };
    // 0.320.2 : un bloc qui donne ses propres points (portail : poteaux) les offre à l'accroche « Sommet »
    const propres = (sy.prises ?? []).length ? pointsDePrise(o, sy).map(([est, nord]) => ({ points: [{ est, nord, altitude: null }, { est: est + 0.001, nord, altitude: null }], ferme: false })) : [];
    return [boite, ...propres];
  });

  /** Accroche pendant un dessin : points levés, puis sommets / milieux / bords des plans et de ce qui est dessiné. */
  function accrochage(position, tolerance) {
    if (etat.orienter?.mode === 'ligne') return null; // on touche la ligne elle-même
    if (etat.outil === 'choisir' && !etat.orienter && etat.glisse?.type !== 'sommet' && !(etat.glisse?.type === 'objet' && etat.glisse.decal)) return null;
    if (etat.outil === 'decaler') return null; // on touche la ligne elle-même, puis le côté : pas d'accroche
    const a = etat.accroches;
    if (a.has('point')) {
      const t = accrocher('point', position, tolerance, { points: pointsMontres() });
      if (t) return t;
    }
    const sources = sourcesDesPlans(plansFond(), position, tolerance);
    // Pendant qu'on glisse un sommet, l'élément lui-même n'est pas une accroche (il bouge).
    const autres = etat.glisse ? plan().objets.filter((o) => o.id !== etat.choisi) : plan().objets;
    sources.lignes = [...sources.lignes, ...lignesPourAccroche(autres), ...lignesSymboles(autres)];
    for (const mode of ['sommet', 'milieu', 'croisement', 'perpendiculaire', 'ligne']) {
      if (!a.has(mode)) continue;
      if (mode === 'perpendiculaire') {
        // Pied de la perpendiculaire menée du dernier point posé sur la ligne touchée (comme Mesure rapide).
        const dernier = etat.saisie?.points?.at(-1);
        if (!dernier) continue;
        const pied = piedPerpendiculaire({ est: dernier[0], nord: dernier[1] }, position, tolerance, sources.lignes);
        if (pied) return { est: pied.est, nord: pied.nord, altitude: null, mode };
        continue;
      }
      const t = accrocher(mode, position, tolerance, sources);
      if (t) return t;
    }
    return pointOrtho(position);
  }

  /** Ortho (0.294.1) : pendant un dessin, le point suivant est aimanté à la direction du repère (ou à ses perpendiculaires). */
  function pointOrtho(position) {
    const dernier = etat.saisie?.points?.at(-1);
    if (!etat.ortho || !dernier || etat.saisie.outil === 'decaler') return null;
    const [x, y] = [position.est - dernier[0], position.nord - dernier[1]];
    const L = Math.hypot(x, y);
    if (L < 1e-6) return null;
    const base = ((etat.orthoAngle || 0) * Math.PI) / 180;
    const a = Math.atan2(y, x) - base;
    const k = Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + base;
    const d = L * Math.cos(Math.atan2(y, x) - k); // longueur projetée sur la direction choisie
    return { est: dernier[0] + d * Math.cos(k), nord: dernier[1] + d * Math.sin(k), altitude: null, mode: 'ortho' };
  }

  /** Orienter le symbole choisi (0.290.0) : vers le point cliqué (accroché), ou parallèle à la ligne cliquée. */
  function toucherOrientation(p, tolerance) {
    const { id, mode } = etat.orienter;
    const o = plan().objets.find((x) => x.id === id);
    if (!o) {
      etat.orienter = null;
      return majTout();
    }
    let rotation;
    if (mode === 'point') {
      if (Math.hypot(p[0] - o.point[0], p[1] - o.point[1]) < 0.01) return message('Cliquez un point plus loin que le centre du symbole.', 3000);
      rotation = rotationVers(o, p);
    } else {
      const autres = plan().objets.filter((x) => x.id !== id);
      const lignes = [...lignesPourAccroche(objetsVisibles({ ...plan(), objets: autres })), ...lignesSymboles(autres), ...sourcesDesPlans(plansFond(), { est: p[0], nord: p[1] }, tolerance).lignes];
      rotation = angleDeLaLigne(lignes, p, tolerance * 1.5, o.rotation ?? 0);
      if (rotation === null) return message('Aucune ligne ici : cliquez une ligne du plan ou un élément dessiné.', 3000);
    }
    if (!avantChangement()) return;
    o.rotation = rotation;
    etat.orienter = null;
    enregistrer();
    majTout();
  }

  /** Décalage : 1er clic = la ligne à décaler (dessin ou plan DXF), 2e clic = le côté de la copie. */
  function toucherDecalage(p, tolerance) {
    const s = etat.saisie;
    if (!s?.source) {
      const lignes = [...lignesPourAccroche(objetsVisibles(plan()).filter((o) => o.type !== 'texte')), ...sourcesDesPlans(plansFond(), { est: p[0], nord: p[1] }, tolerance).lignes];
      // En ligne de construction : on décale seulement le segment touché (une droite parallèle), pas toute la polyligne.
      const source = etat.decalerConstruction ? segmentLePlusProche(lignes, p, tolerance * 1.5) : ligneLaPlusProche(lignes, p, tolerance * 1.5);
      if (!source) return message('Aucune ligne ici : touchez une ligne du plan ou un élément dessiné.', 3000);
      etat.saisie = { outil: 'decaler', source, style: etat.style, points: [] };
      majConsigne();
      return vue?.redessinerDessus();
    }
    creerDecalage(s.source, coteDuPoint(s.source, p) * etat.distanceDecalage, s.style);
  }

  /** Crée la ligne décalée de distance m (+ à gauche, − à droite en suivant la ligne de départ). */
  function creerDecalage(source, distance, style) {
    if (!avantChangement()) return;
    const decalee = decalerPolyligne(source, distance);
    const o = etat.decalerConstruction && decalee.length === 2
      ? ajouterObjet(plan(), { type: 'construction', points: decalee, infinie: true })
      : ajouterObjet(plan(), compact({ type: 'ligne', points: decalee, style, epaisseurMm: etat.epaisseurMm ?? undefined, echelleMotif: etat.echelleMotif !== 1 ? etat.echelleMotif : undefined }));
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  /** « Décaler… » depuis l'élément choisi : la ligne de départ est déjà connue, on touche seulement le côté. */
  function decalerChoisi() {
    const o = plan().objets.find((x) => x.id === etat.choisi);
    if (!o || o.type === 'texte') return;
    const source = o.type === 'zone' ? [...o.points, o.points[0]] : o.points;
    etat.outil = 'decaler';
    etat.style = o.type === 'ligne' ? styleLigne(o.style).cle : etat.style;
    etat.saisie = { outil: 'decaler', source, style: etat.style, points: [] };
    etat.choisi = null;
    majTout();
  }

  /** Lignes que l'on peut prendre comme repère de l'Ortho : plan DXF dessous, éléments dessinés, contours des symboles. */
  function lignesRepere(p, tolerance) {
    return [...lignesPourAccroche(objetsVisibles(plan())), ...lignesSymboles(plan().objets), ...sourcesDesPlans(plansFond(), { est: p[0], nord: p[1] }, tolerance).lignes];
  }

  /** Supprime le sommet touché de la ligne, piste, flèche ou zone choisie (au moins 2 points, 3 pour une zone). */
  function supprimerSommet(p, tolerance) {
    const o = plan().objets.find((x) => x.id === etat.choisi);
    if (!o || o.verrou || !Array.isArray(o.points) || o.type === 'construction' || o.type === 'cotation' || o.cercle) return false;
    const i = sommetSousLePoint(o, p, tolerance * 1.5);
    if (i < 0) return false;
    const min = o.type === 'zone' ? 3 : 2;
    if (o.points.length <= min) {
      message(o.type === 'zone' ? 'Une zone garde au moins 3 points.' : 'Il faut garder au moins 2 points.', 3000);
      return true;
    }
    if (!avantChangement()) return true;
    o.points.splice(i, 1);
    enregistrer();
    majTout();
    vue?.redessinerDessus();
    return true;
  }

  /** Côté de l'élément choisi dont le petit « + » (milieu) est sous le point : index du côté, ou -1. */
  function milieuSousLePoint(o, p, tol) {
    for (const { index, milieu } of milieuxDesCotes(o)) if (Math.hypot(p[0] - milieu[0], p[1] - milieu[1]) <= tol) return index;
    return -1;
  }

  /** Clic sur un « + » de l'élément choisi : un point ajouté au milieu de ce côté (0.299.0). */
  function ajouterPointCote(p, tolerance) {
    const o = plan().objets.find((x) => x.id === etat.choisi);
    if (!o || o.verrou) return false;
    const m = milieuSousLePoint(o, p, tolerance);
    if (m < 0 || sommetSousLePoint(o, p, tolerance) >= 0) return false;
    if (!avantChangement()) return true;
    o.points = ajouterPointAuMilieu(o.points, m, o.type === 'zone');
    enregistrer();
    majTout();
    vue?.redessinerDessus();
    message('Point ajouté au milieu du côté : glissez son carré pour le placer.', 2500);
    return true;
  }

  async function toucher(p, tolerance, ev) {
    etat.glisse = null;
    if (etat.outil === 'choisir' && etat.choisi && !ev?.shiftKey && !ev?.ctrlKey && ajouterPointCote(p, tolerance)) return;
    if (etat.outil === 'choisir' && etat.choisi && (ev?.shiftKey || ev?.ctrlKey) && supprimerSommet(p, tolerance)) return; // Maj / Ctrl + clic sur un carré = supprimer ce point
    if (etat.orthoRepere) {
      etat.orthoRepere = false;
      const seg = segmentLePlusProche(lignesRepere(p, tolerance), p, tolerance * 1.5);
      if (!seg) return message('Aucune ligne ici : l\'angle de repère n\'a pas changé.', 3000);
      // L'angle de la ligne cliquée, tel quel (0 à 180°, sens trigonométrique depuis l'Est) ; 0 = N / S / E / O.
      const angle = ((angleVers(seg[0], seg[1]) % 180) + 180) % 180;
      etat.orthoAngle = Math.round(angle * 100) / 100;
      etat.ortho = true;
      message(`Repère de l'Ortho : ${etat.orthoAngle}° (angle de la ligne cliquée)`, 3500);
      return majTout();
    }
    if (etat.attenteRepere) {
      const o = plan().objets.find((x) => x.id === etat.attenteRepere);
      etat.attenteRepere = null;
      if (o && avantChangement()) {
        o.repere = p;
        o.repereBout = etat.repereBout;
        enregistrer();
      }
      return majTout();
    }
    if (etat.orienter) return toucherOrientation(p, tolerance);
    if (etat.outil === 'decaler') return toucherDecalage(p, tolerance);
    if (etat.outil === 'choisir') {
      etat.choisi = objetSous(p, tolerance)?.id ?? null;
      etat.orienter = null;
      majTout();
      return;
    }
    if (etat.outil === 'symbole') {
      if (!etat.pose) return message('Choisissez d\'abord un symbole dans la bibliothèque (à gauche).', 3000);
      if (!avantChangement()) return;
      const o = ajouterObjet(plan(), JSON.parse(JSON.stringify({ ...etat.pose, point: p, rotation: etat.rotationPose })));
      etat.choisi = o.id;
      etat.outil = 'choisir';
      vue?.oublierCurseur();
      enregistrer();
      majBiblio();
      majTout();
      return;
    }
    if (etat.outil === 'texte') {
      const texte = await demanderTexte({ titre: 'Texte à écrire sur le plan' });
      if (!texte || !avantChangement()) return;
      const o = ajouterObjet(plan(), { type: 'texte', point: p, texte, taille: etat.tailleTexte, ...(etat.cadreTexte !== 'arrondi' ? { cadre: etat.cadreTexte } : {}), ...(etat.arrondi !== 'peu' ? { arrondi: etat.arrondi } : {}) });
      etat.choisi = o.id;
      etat.outil = 'choisir';
      if (etat.texteRepere) etat.attenteRepere = o.id; // le prochain clic donne le point visé
      enregistrer();
      majTout();
      return;
    }
    const s = etat.saisie ?? (etat.saisie = { outil: etat.outil, points: [], categorie: etat.categorie, style: etat.style, largeur: etat.largeur, genre: etat.cotationGenre });
    // Zone : toucher le 1er sommet la ferme.
    if (s.outil === 'zone' && s.points.length >= 3 && Math.hypot(p[0] - s.points[0][0], p[1] - s.points[0][1]) <= tolerance) {
      finirSaisie();
      return;
    }
    const dernier = s.points[s.points.length - 1];
    if (!dernier || Math.hypot(p[0] - dernier[0], p[1] - dernier[1]) > 1e-6) s.points.push(p);
    if (s.outil === 'construction' && s.points.length >= 2 && (etat.constructionMode !== 'segment' || etat.coupeProchaine)) return finirSaisie(); // droite / coupe : 2 points ; segment : autant de points qu'on veut (Entrée ou double-clic)
    if (s.outil === 'rectangle' && s.points.length >= 3) return creerForme(); // 0.301.0 : un côté puis la largeur
    if (s.outil === 'rond' && s.points.length >= 2) return creerForme(); // centre puis un point du bord
    if (s.outil === 'cotation' && s.points.length >= 3) return creerCotation(s.points);
    majConsigne();
    vue?.redessinerDessus();
  }

  /** 0.301.0 : rectangle (3 clics) ou rond (centre + bord, ou rayon tapé) = une zone du genre choisi. */
  function creerForme(rayonTape = null) {
    const s = etat.saisie;
    if (!s) return;
    let champs;
    if (s.outil === 'rond') {
      const centre = s.points[0];
      const rayon = rayonTape ?? (s.points[1] ? Math.hypot(s.points[1][0] - centre[0], s.points[1][1] - centre[1]) : 0);
      if (!(rayon > 0.001)) return message('Rayon nul : cliquez un point du bord ou tapez le rayon.', 3000);
      const cercle = { centre: centre.map((v) => Math.round(v * 1000) / 1000), rayon: Math.round(rayon * 1000) / 1000 };
      champs = { cercle, points: pointsDuRond(cercle.centre, cercle.rayon) };
    } else {
      const coins = rectangleTroisPoints(...s.points.slice(0, 3));
      if (!coins) {
        s.points.length = 2;
        return message('Le 3e point est sur le côté : cliquez à côté pour donner la largeur.', 3000);
      }
      champs = { points: coins };
    }
    if (!avantChangement()) return;
    const o = ajouterObjet(plan(), {
      type: 'zone', ...champs, categorie: s.categorie, opacite: etat.opacite, contourMm: etat.contourMm ?? undefined,
      traitContour: etat.traitContour !== 'continu' ? etat.traitContour : undefined,
      hachure: etat.hachure.motif !== 'aucune' ? compact({ ...etat.hachure, couleur: etat.hachure.couleur || undefined }) : undefined,
    });
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  /** Cotation : longueur = A, B puis un 3e point qui donne le côté et la distance de la ligne de cote ; angle = sommet, P1, P2. */
  function creerCotation(pts) {
    if (!avantChangement()) return;
    let champs;
    if (etat.cotationGenre === 'angle') {
      champs = { type: 'cotation', genre: 'angle', ordre: 'p1-s-p3', points: pts.slice(0, 3), ...(etat.cotationNu ? { nu: true } : {}), ...(etat.arrondi !== 'peu' ? { arrondi: etat.arrondi } : {}) }; // sommet = point 2
    } else {
      const [A, B, C] = pts;
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const decalage = (((C[0] - A[0]) * -(B[1] - A[1])) + ((C[1] - A[1]) * (B[0] - A[0]))) / L; // distance signée de C à la droite A → B
      champs = { type: 'cotation', genre: 'longueur', points: [A, B], decalage: Math.round(decalage * 1000) / 1000, ...(etat.cotationNu ? { nu: true } : {}), ...(etat.arrondi !== 'peu' ? { arrondi: etat.arrondi } : {}), styleCote: etat.styleCote, fleche: etat.flecheCote, tailleFlecheMm: etat.tailleFlecheCote, coteTexte: etat.coteTexte };
    }
    const o = ajouterObjet(plan(), champs);
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  function finirSaisie() {
    const s = etat.saisie;
    if (!s || s.outil === 'decaler') return;
    if (s.outil === 'construction') return creerConstruction(etat.constructionMode === 'segment' && !etat.coupeProchaine ? s.points : s.points.slice(0, 2), etat.constructionMode !== 'segment');
    const min = s.outil === 'zone' ? 3 : 2;
    if (s.points.length < min) {
      message(s.outil === 'zone' ? 'Une zone a au moins 3 sommets.' : 'Il faut au moins 2 points.', 3000);
      return;
    }
    if (!avantChangement()) return;
    const props = {
      zone: compact({
        categorie: s.categorie, opacite: etat.opacite, contourMm: etat.contourMm ?? undefined, afficherSurface: etat.afficherSurface || undefined,
        traitContour: etat.traitContour !== 'continu' ? etat.traitContour : undefined,
        hachure: etat.hachure.motif !== 'aucune' ? compact({ ...etat.hachure, couleur: etat.hachure.couleur || undefined }) : undefined,
      }),
      ligne: compact({ style: s.style, epaisseurMm: etat.epaisseurMm ?? undefined, echelleMotif: etat.echelleMotif !== 1 ? etat.echelleMotif : undefined }),
      piste: { largeur: s.largeur },
      fleche: compact({ largeur: etat.largeurFleche, echelle: etat.echelleFleche !== 1 ? etat.echelleFleche : undefined }),
    }[s.outil];
    const o = ajouterObjet(plan(), { type: s.outil, points: s.points, ...props });
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir'; // 0.287.0 : l'élément dessiné est choisi (poignées, réglages à droite)
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  /** Crée une ligne de construction (2 points ; droite infinie ou segment) et la choisit. */
  function creerConstruction(pts, infinie) {
    if (pts.length < 2 || Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 1e-6) {
      message('Il faut 2 points différents.', 3000);
      return;
    }
    if (!avantChangement()) return;
    if (plan().construction?.visible === false) plan().construction = { ...(plan().construction ?? {}), visible: true }; // on la voit en la créant
    const estCoupe = etat.coupeProchaine && !infinie;
    const o = ajouterObjet(plan(), { type: 'construction', points: pts, infinie, ...(estCoupe ? { coupe: true } : {}), ...(etat.constructionTrait !== 'tirets' ? { trait: etat.constructionTrait } : {}) });
    if (estCoupe) {
      etat.coupeProchaine = false;
      etat.coupe = { ...etat.coupe, ouvert: true, ligne: `constr:${o.id}`, suivre: o.id };
      page.querySelector('[data-action="coupe"]')?.setAttribute('aria-pressed', 'true');
    }
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  // ---------------------------------------------------------------- Longueur et angle tapés (0.293.0)

  const nombreSaisi = (c) => {
    const v = Number(String(c?.value ?? '').replace(',', '.'));
    return String(c?.value ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
  };

  /**
   * Place le prochain point d'après la longueur (m) et l'angle (°) tapés : le dernier point posé + longueur dans la direction
   * de l'angle (sens inverse des aiguilles depuis l'Est, comme la rotation des symboles) ou, sans angle, dans la direction
   * de la souris (comme AutoCAD). Droite par un point et un angle : l'angle seul suffit.
   */
  function placerParSaisie() {
    const s = etat.saisie;
    const dernier = s?.points?.at(-1);
    if (!s || !dernier || s.outil === 'decaler') return;
    const longueurTapee = nombreSaisi(page.querySelector('[data-saisie="longueur"]'));
    const angleTape = nombreSaisi(page.querySelector('[data-saisie="angle"]'));
    if (s.outil === 'construction' && etat.constructionMode === 'angle') {
      if (angleTape === null) return message('Tapez l\'angle de la droite.', 3000);
      return creerConstruction([dernier, pointALaDistance(dernier, 10, angleTape)], true);
    }
    if (longueurTapee === null || !(longueurTapee > 0)) return message('Tapez une longueur en mètres (plus grande que 0).', 3000);
    if (s.outil === 'rond') {
      for (const c of page.querySelectorAll('[data-saisie]')) c.value = '';
      return creerForme(longueurTapee); // rayon tapé
    }
    if (s.outil === 'rectangle' && s.points.length === 2) {
      // 0.317.0 : 2e longueur tapée = la largeur, perpendiculaire au 1er côté, du côté où est la souris (à gauche sans souris).
      const [a, b] = s.points;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / L;
      const ny = (b[0] - a[0]) / L;
      const cote = etat.curseur && ((etat.curseur[0] - a[0]) * nx + (etat.curseur[1] - a[1]) * ny) < 0 ? -1 : 1;
      s.points.push([a[0] + nx * cote * longueurTapee, a[1] + ny * cote * longueurTapee]);
      for (const c of page.querySelectorAll('[data-saisie]')) c.value = '';
      return creerForme();
    }
    const angle = angleTape ?? (etat.curseur ? angleVers(dernier, etat.curseur) : null);
    if (angle === null) return message('Bougez la souris pour donner la direction, ou tapez un angle.', 3500);
    const p = pointALaDistance(dernier, longueurTapee, angle);
    for (const c of page.querySelectorAll('[data-saisie]')) c.value = '';
    if (s.outil === 'construction' && (etat.constructionMode !== 'segment' || etat.coupeProchaine)) {
      s.points.push(p);
      return creerConstruction(s.points.slice(0, 2), etat.constructionMode !== 'segment');
    }
    s.points.push(p);
    majConsigne();
    vue?.redessinerDessus();
    page.querySelector('[data-saisie="longueur"]')?.focus();
  }

  function supprimerChoisi() {
    if (!etat.choisi || !avantChangement()) return;
    retirerObjet(plan(), etat.choisi);
    etat.choisi = null;
    enregistrer();
    majTout();
  }


  // ---------------------------------------------------------------- Feuille (mise en page, PDF, DXF)

  let feuille = null; // { canvas, page (rang), observateur }

  /** Bande du bas de l'onglet Feuille (0.330.0) : présentations (liste, enregistrer, dupliquer, renommer, supprimer), format, orientation, échelle, PDF. */
  function htmlBandeFeuille() {
    const p = plan();
    if (!p) return '';
    const r = reglagesFeuille(p);
    const liste = presentationsDe(p);
    const active = presentationActive(p);
    const options = (l, v) => l.map(([c, t]) => `<option value="${c}" ${c === v ? 'selected' : ''}>${t}</option>`).join('');
    const bouton = (attrs, icone, titre, court, desactive = false) => `<button type="button" class="outil-ruban" ${attrs} ${desactive ? 'disabled' : ''} title="${titre}" aria-label="${titre}">${ico(icone)}<span>${court}</span></button>`;
    return `
      <div class="groupe-ruban" role="group" aria-label="Présentation">
        <label class="champ-bande" title="Présentation : les réglages de la feuille gardés sous un nom (se mettent à jour toutes seules)"><span>Présentation</span>
          <select data-presentation="choisir" aria-label="Présentation"><option value="">— réglages libres —</option>${liste.map((x) => `<option value="${echapper(x.id)}" ${x.id === active?.id ? 'selected' : ''}>${echapper(x.nom)}</option>`).join('')}</select></label>
        ${bouton('data-action="pres-nouvelle"', '<path d="M12 5V19M5 12H19"/>', 'Enregistrer les réglages actuels comme nouvelle présentation', 'Enreg.')}
        ${bouton('data-action="pres-dupliquer"', '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V5A1 1 0 0 1 5 4H16"/>', 'Dupliquer la présentation choisie', 'Dupliquer', !active)}
        ${bouton('data-action="pres-renommer"', '<path d="M4 20H8L19 9L15 5L4 16Z"/>', 'Renommer la présentation choisie', 'Renommer', !active)}
        ${bouton('data-action="pres-supprimer"', '<path d="M5 7H19M10 7V4H14V7M7 7L8 20H16L17 7"/>', 'Supprimer la présentation choisie', 'Supprimer', !active)}
      </div>
      <div class="groupe-ruban" role="group" aria-label="Feuille">
        <label class="champ-bande"><span>Format</span><select data-feuille="format">${options(FORMATS_FEUILLE, r.format)}</select></label>
        <label class="champ-bande"><span>Sens</span><select data-feuille="orientation">${options([['paysage', 'Paysage'], ['portrait', 'Portrait']], r.orientation)}</select></label>
        <label class="champ-bande" title="Échelle d'impression 1 : (choisis dans la liste ou tape-la)"><span>Échelle 1 :</span><input type="text" inputmode="numeric" list="echelles-chantier" value="${p.echelle ?? ECHELLE_PAPIER}" data-feuille="echelle" size="6" autocomplete="off"></label>
        <datalist id="echelles-chantier">${[50, 100, 200, 250, 500, 1000, 2000].map((x) => `<option value="${x}"></option>`).join('')}</datalist>
      </div>
      <div class="groupe-ruban" role="group" aria-label="Sortie">
        ${bouton('data-action="feuille-centrer"', '<path d="M4 9V4H9M20 9V4H15M4 15V20H9M20 15V20H15"/>', 'Recentrer la feuille sur les éléments', 'Recentrer')}
        <button type="button" class="bouton" data-action="feuille-pdf" title="Fabriquer le PDF de la feuille">PDF</button>
      </div>`;
  }

  /** Remet la bande du bas de l'onglet Feuille à jour (liste des présentations, valeurs). */
  function majBandeFeuille() {
    if (etat.ecran !== 'feuille') return;
    bandeDessin = htmlBandeFeuille();
    page.majBandePage?.();
  }

  function htmlFeuille() {
    bandeDessin = htmlBandeFeuille();
    return `
      <p class="consigne-calage">Glisser sur la feuille = déplacer le plan dans le cadre. Présentation, format, échelle et PDF : bande du bas.</p>
      <div class="travail-chantier">
        <div class="vue-calage vue-feuille">
          <div class="toile-feuille" data-feuille><canvas></canvas></div>
          <div class="pied-vue etat-chantier" data-zone="etat-feuille"></div>
        </div>
        <aside class="carte-calage panneau-chantier" data-zone="panneau-feuille"></aside>
      </div>`;
  }

  /** Données communes à l'aperçu et au PDF. */
  /** 0.312.0 : page « Vue de côté » du PDF : SVG de la coupe montrée sous le plan, aux proportions demandées (px). */
  function coupePourFeuille(largeur, hauteur) {
    const p = plan();
    if (!reglagesFeuille(p).coupe) return null;
    const lignes = lignesDeCoupe(p);
    const ligne = lignes.find((l) => l.id === etat.coupe.ligne) ?? lignes[0];
    if (!ligne) return null;
    const montrees = surfaces().filter((s) => s.triangles?.length && !etat.coupe.cachees.has(s.id));
    return { titre: ligne.nom, svg: svgCoupe(coupeChantier(p, ligne, montrees), largeur, hauteur) };
  }
  const donneesFeuille = () => ({
    coupe: coupePourFeuille,
    plan: plan(), plans: plansFeuille(), plansPar: (idPhase) => plansFeuille(idPhase), points: pointsMontres(), surfaces: plan()?.fond?.surfaces === false ? [] : surfaces(),
    bib: bib(), projet: leProjet(), auteur: auteur(), centre: centreDeDepart(plan(), plansFond()),
  });

  function monterFeuille() {
    const toile = page.querySelector('[data-feuille]');
    const canvas = toile.querySelector('canvas');
    feuille = { canvas, page: 0, geste: null };
    feuille.observateur = new ResizeObserver(() => dessinerApercu());
    feuille.observateur.observe(toile);
    canvas.addEventListener('pointerdown', (ev) => {
      if (!plan()) return;
      canvas.setPointerCapture(ev.pointerId);
      const r = reglagesFeuille(plan());
      feuille.geste = { x: ev.clientX, y: ev.clientY, centre: r.centre ?? donneesFeuille().centre ?? [0, 0], change: false };
    });
    canvas.addEventListener('pointermove', (ev) => {
      const g = feuille?.geste;
      if (!g) return;
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      if (!g.change && Math.hypot(dx, dy) < 4) return;
      if (!g.change) {
        if (!avantChangement()) {
          feuille.geste = null;
          return;
        }
        g.change = true;
      }
      // px d'aperçu → mm de papier → m sur le terrain.
      const m = (plan().echelle ?? ECHELLE_PAPIER) / 1000 / (feuille.pxParMm || 1);
      plan().feuille = { ...(plan().feuille ?? {}), centre: [g.centre[0] - dx * m, g.centre[1] + dy * m] };
      dessinerApercu();
    });
    const fin = () => {
      if (feuille?.geste?.change) enregistrer();
      if (feuille) feuille.geste = null;
    };
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    majFeuille();
  }

  function majFeuille() {
    if (etat.ecran !== 'feuille' || !feuille) return;
    majPanneauFeuille();
    dessinerApercu();
  }

  let imageApercu = 0;
  async function dessinerApercu() {
    if (!feuille || !plan()) return;
    const toile = page.querySelector('[data-feuille]');
    if (!toile?.clientWidth) return;
    const pages = pagesDeLaFeuille(plan());
    feuille.page = Math.min(feuille.page, pages.length - 1);
    const r = reglagesFeuille(plan());
    const mise = miseEnPageFeuille(r.format, r.orientation, 0);
    const densite = window.devicePixelRatio || 1;
    const pxParMm = Math.min((toile.clientWidth - 16) / mise.page.largeur, (toile.clientHeight - 16) / mise.page.hauteur);
    feuille.pxParMm = pxParMm;
    const c = feuille.canvas;
    c.style.width = `${Math.round(mise.page.largeur * pxParMm)}px`;
    c.style.height = `${Math.round(mise.page.hauteur * pxParMm)}px`;
    // 0.319.4 : la page est dessinée sur une toile à part puis copiée d'un coup : l'aperçu ne devient plus blanc pendant le calcul,
    // et une erreur de dessin est écrite au lieu de laisser une page vide.
    const hors = document.createElement('canvas');
    hors.width = Math.round(mise.page.largeur * pxParMm * densite);
    hors.height = Math.round(mise.page.hauteur * pxParMm * densite);
    const ctx = hors.getContext('2d');
    ctx.setTransform(densite, 0, 0, densite, 0, 0);
    const numero = (feuille.numero = (feuille.numero ?? 0) + 1);
    let prep;
    try {
      const donnees = donneesFeuille();
      prep = preparerPage(donnees, pages[feuille.page], pxParMm);
      const logo = await chargerImage(adresseLogo(r.logo));
      if (!feuille || feuille.canvas !== c || feuille.numero !== numero) return; // un dessin plus récent a pris la suite
      dessinerPage(ctx, donnees, prep, pxParMm, {
        logo,
        quandTuile: () => {
          cancelAnimationFrame(imageApercu);
          imageApercu = requestAnimationFrame(() => dessinerApercu());
        },
      });
    } catch (e) {
      console.error(e);
      message(`Aperçu de la feuille impossible : ${e?.message ?? e}`, 6000);
      return;
    }
    c.width = hors.width;
    c.height = hors.height;
    c.getContext('2d').drawImage(hors, 0, 0);
    const etatZone = page.querySelector('[data-zone="etat-feuille"]');
    if (etatZone) {
      etatZone.innerHTML = `${pages.length > 1 ? `<button type="button" class="bouton-secondaire" data-page-feuille="-1" ${feuille.page ? '' : 'disabled'}>◀</button>
        <span>Page ${feuille.page + 1} / ${pages.length}${pages[feuille.page].titre ? ` · ${echapper(pages[feuille.page].titre)}` : ''}</span>
        <button type="button" class="bouton-secondaire" data-page-feuille="1" ${feuille.page < pages.length - 1 ? '' : 'disabled'}>▶</button>` : '<span>1 page</span>'}
        <span>${prep.objets.length} élément(s) · légende : ${prep.legende.length}</span>`;
    }
  }

  function majPanneauFeuille() {
    const zone = page.querySelector('[data-zone="panneau-feuille"]');
    if (!zone) return;
    const p = plan();
    const r = reglagesFeuille(p);
    const options = (liste, valeur) => liste.map(([v, t]) => `<option value="${v}" ${v === valeur ? 'selected' : ''}>${t}</option>`).join('');
    const nomPdf = `${nomFichier()}.pdf`;
    majBandeFeuille();
    zone.innerHTML = `
      <h3>Feuille ${bulle('feuilleChantier')}</h3>
      <label class="champ-calage"><span>Pages</span><select data-feuille="pages">${options([['une', 'Toutes les phases sur une page'], ['phases', 'Une page par phase']], r.pages)}</select></label>
      ${r.pages === 'phases' ? `<p class="aide-calage">Phases montrées sur toutes les pages :</p>
        ${p.phases.map((ph) => `<label class="case-chantier"><input type="checkbox" data-phase-commune="${ph.id}" ${ph.commune ? 'checked' : ''}> ${echapper(ph.nom)}</label>`).join('')}` : ''}
      <h3>Plans de la feuille</h3>
      ${plans().length ? `<p class="aide-calage">${r.plans ? 'Réglés à part de l\'écran.' : 'Comme à l\'écran.'}</p>
        ${plans().map((x) => {
    const eff = plansDeLaFeuille(plansAvecCalques(plans(), p.fond), plansFond(), r.plans).find((y) => y.id === x.id);
    const op = Math.round(100 - (eff ? (eff.transparence ?? 0) : (r.plans?.[x.id]?.opacite !== undefined ? 100 - r.plans[x.id].opacite : (x.transparence ?? 0))));
    return `<div class="plan-feuille"><label class="case-chantier"><input type="checkbox" data-feuille-plan="${echapper(x.id)}" ${eff ? 'checked' : ''}> ${echapper(x.nom)}</label>
          <label class="champ-calage"><span>Opacité : <b data-valeur-de="op-${echapper(x.id)}">${op} %</b></span><input type="range" min="0" max="100" step="5" value="${op}" data-feuille-plan-op="${echapper(x.id)}"></label></div>`;
  }).join('')}
        ${r.plans ? '<button type="button" class="lien-calage" data-action="feuille-plans-reinit">Remettre comme à l\'écran</button>' : ''}` : '<p class="aide-calage">Aucun plan dans le projet.</p>'}
      <h3>Fond</h3>
      <label class="case-chantier"><input type="checkbox" data-fond="carte" ${p.fond.carte ? 'checked' : ''}> Carte nationale swisstopo</label>
      <label class="case-chantier"><input type="checkbox" data-fond="ortho" ${p.fond.ortho ? 'checked' : ''}> Photo aérienne swisstopo</label>
      ${p.fond.ortho ? `<label class="champ-calage"><span>Photo pâlie : <b data-valeur-de="paleur">${p.fond.paleur ?? PALEUR_ORTHO} %</b></span><input type="range" min="0" max="90" step="5" value="${p.fond.paleur ?? PALEUR_ORTHO}" data-feuille-curseur="paleur"></label>` : ''}
      <label class="case-chantier"><input type="checkbox" data-fond="cadastre" ${p.fond.cadastre ? 'checked' : ''}> Cadastre</label>
      <label class="case-chantier"><input type="checkbox" data-fond="surfaces" ${p.fond.surfaces !== false ? 'checked' : ''}> Surfaces du projet</label>
      <label class="case-chantier"><input type="checkbox" data-fond="points" ${p.fond.points !== false ? 'checked' : ''}> Points levés</label>
      <h3>Cartouche</h3>
      <label class="champ-calage"><span>Nom du chantier (vide = affaire - désignation)</span><input type="text" maxlength="120" value="${echapper(r.chantier)}" placeholder="${echapper(nomChantierCartouche(leProjet().cartouche, leProjet().nom))}" data-feuille="chantier"></label>
      <label class="champ-calage"><span>Titre du plan</span><input type="text" maxlength="80" value="${echapper(r.titre || p.nom)}" data-feuille="titre"></label>
      <label class="champ-calage"><span>Indice</span><input type="text" maxlength="6" value="${echapper(r.indice)}" data-feuille="indice"></label>
      <label class="champ-calage"><span>Date (vide = du jour)</span><input type="text" maxlength="20" value="${echapper(r.date)}" placeholder="${new Date().toLocaleDateString('fr-CH')}" data-feuille="date"></label>
      <label class="champ-calage"><span>Dessiné par</span><input type="text" maxlength="40" value="${echapper(r.auteur)}" placeholder="${echapper(auteur())}" data-feuille="auteur"></label>
      <label class="champ-calage"><span>Logo</span><select data-feuille="logo">${options([['perrin', 'Perrin'], ['natalini', 'Natalini'], ['ronchi', 'Ronchi'], ['aucun', 'Sans logo'], ['image', r.logo?.startsWith?.('data:') ? 'Image choisie' : 'Autre image…']], r.logo?.startsWith?.('data:') ? 'image' : r.logo)}</select></label>
      ${r.logo?.startsWith?.('data:') ? '<button type="button" class="lien-calage" data-action="feuille-logo">Changer d\'image…</button>' : ''}
      <label class="case-chantier"><input type="checkbox" data-feuille-case="legende" ${r.legende ? 'checked' : ''}> Légende automatique</label>
      <label class="case-chantier"><input type="checkbox" data-feuille-case="nord" ${r.nord ? 'checked' : ''}> Nord</label>
      <label class="case-chantier"><input type="checkbox" data-feuille-case="barre" ${r.barre ? 'checked' : ''}> Barre d'échelle</label>
      <label class="case-chantier"><input type="checkbox" data-situation="actif" ${r.situation.actif ? 'checked' : ''}> Vue de situation (carte nationale)</label>
      ${r.situation.actif ? `<label class="champ-calage"><span>Coin</span><select data-situation="coin">${options(COINS_SITUATION, r.situation.coin)}</select></label>
      <label class="case-chantier"><input type="checkbox" data-situation="auto" ${r.situation.auto ? 'checked' : ''}> Échelle automatique (la zone du plan reste bien visible)</label>
      ${r.situation.auto ? '' : `<label class="champ-calage"><span>Échelle de la situation 1 :</span><input type="number" min="500" max="100000" step="500" value="${r.situation.echelle}" data-situation="echelle"></label>`}
      <label class="champ-calage"><span>Taille (mm, A3)</span><input type="number" min="30" max="120" step="5" value="${r.situation.taille}" data-situation="taille"></label>
      <label class="champ-calage" title="La carte s'efface vers le blanc (le plan dessous ne se voit jamais) : le rectangle rouge ressort"><span>Transparence de la carte : <b data-valeur-de="sit-transparence">${r.situation.transparence} %</b></span><input type="range" min="0" max="90" step="5" value="${r.situation.transparence}" data-situation="transparence"></label>
      <label class="champ-calage"><span>Épaisseur du rectangle rouge (mm)</span><input type="number" min="0.2" max="3" step="0.1" value="${r.situation.epaisseur}" data-situation="epaisseur"></label>` : ''}
      <label class="case-chantier"><input type="checkbox" data-feuille-case="coupe" ${r.coupe ? 'checked' : ''}> Page « Vue de côté » (coupe) à la fin du PDF</label>
      ${r.coupe ? '<p class="aide-calage">La coupe est celle montrée sous le plan (bouton « Coupe » de Dessiner).</p>' : ''}
      <h3>Enregistrer</h3>
      <div class="actions-chantier"><button type="button" class="bouton-secondaire" data-action="feuille-dxf">DXF</button></div><p class="aide-calage">Le PDF et le cadrage sont dans la bande du bas.</p>
      <p class="aide-calage">Nom : <span class="chiffre">${echapper(nomPdf)}</span></p>`;
  }

  const nomFichier = () => nomFichierExport(leProjet().cartouche?.affaire || leProjet().nom || '', `plan-chantier_${plan().nom}`);

  function telecharger(blob, nom) {
    if (enregistrerFichier) return enregistrerFichier(blob, nom);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** Un clic dans l'onglet Feuille ; renvoie false s'il n'est pas pour lui. */
  async function clicFeuille(b, p) {
    if (b.dataset.pageFeuille) {
      feuille.page += Number(b.dataset.pageFeuille);
      return dessinerApercu();
    }
    if (b.dataset.action === 'feuille-centrer') {
      if (!avantChangement()) return;
      const f = { ...(p.feuille ?? {}) };
      delete f.centre;
      p.feuille = f;
      enregistrer();
      return dessinerApercu();
    }
    if (b.dataset.action === 'feuille-plans-reinit') {
      if (!avantChangement()) return;
      const f = { ...(p.feuille ?? {}) };
      delete f.plans;
      p.feuille = f;
      enregistrer();
      majPanneauFeuille();
      return dessinerApercu();
    }
    if (b.dataset.action === 'pres-nouvelle') {
      const nom = await demanderTexte({ titre: 'Nouvelle présentation', valeur: `Présentation ${presentationsDe(p).length + 1}` });
      if (nom === null || !avantChangement()) return;
      creerPresentation(p, nom);
      enregistrer();
      message(`Présentation « ${presentationActive(p).nom} » enregistrée : elle se met à jour toute seule.`, 4000, { ok: true });
      return majFeuille();
    }
    if (b.dataset.action === 'pres-dupliquer') {
      if (!presentationActive(p) || !avantChangement()) return;
      const c = dupliquerPresentation(p);
      enregistrer();
      message(`« ${c.nom} » créée et choisie : modifiez-la, l'originale reste comme elle était.`, 5000, { ok: true });
      return majFeuille();
    }
    if (b.dataset.action === 'pres-renommer') {
      const a = presentationActive(p);
      if (!a) return;
      const nom = await demanderTexte({ titre: 'Renommer la présentation', valeur: a.nom });
      if (nom === null || !avantChangement()) return;
      renommerPresentation(p, a.id, nom);
      enregistrer();
      return majFeuille();
    }
    if (b.dataset.action === 'pres-supprimer') {
      const a = presentationActive(p);
      if (!a) return;
      const choix = await demanderChoix({ titre: `Supprimer « ${a.nom} » ?`, texte: 'Les réglages actuels de la feuille restent comme ils sont ; seule la présentation enregistrée disparaît.', boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer' }] });
      if (choix !== 'oui' || !avantChangement()) return;
      supprimerPresentation(p, a.id);
      enregistrer();
      return majFeuille();
    }
    if (b.dataset.action === 'feuille-logo') return choisirLogo(p);
    if (b.dataset.action === 'feuille-pdf') {
      b.disabled = true;
      try {
        const { blob, remarques } = await creerPdfChantier(donneesFeuille(), (t) => message(t, null));
        telecharger(blob, `${nomFichier()}.pdf`);
        message(`PDF prêt${remarques.length ? ` (${remarques.join(' ; ')})` : ''}.`, 5000, { ok: !remarques.length });
      } catch (erreur) {
        message(`PDF impossible : ${erreur?.message ?? erreur}`, 8000);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.dataset.action === 'feuille-dxf') {
      const pages = pagesDeLaFeuille(p);
      const objets = pages.length > 1 ? p.objets : null; // une page par phase : toutes les phases, chacune sur ses calques
      const texte = dxfPlanChantier(p, bib(), objets);
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomFichier()}.dxf`);
      message('DXF prêt (un calque par phase et par genre, symboles en blocs).', 4000, { ok: true });
      return;
    }
    return false;
  }

  /** Image du logo choisie (réduite à 600 px, gardée dans le plan, part sur Drive avec le projet). */
  async function choisirLogo(p) {
    const entree = document.createElement('input');
    entree.type = 'file';
    entree.accept = 'image/png,image/jpeg';
    const fichier = await new Promise((ok) => {
      entree.addEventListener('change', () => ok(entree.files?.[0] ?? null));
      entree.click();
    });
    if (!fichier) return majPanneauFeuille();
    const url = URL.createObjectURL(fichier);
    const image = await chargerImage(url);
    if (!image) {
      message(`« ${fichier.name} » n'est pas une image lisible.`, 5000);
      return majPanneauFeuille();
    }
    const k = Math.min(1, 600 / Math.max(image.width, image.height));
    const c = document.createElement('canvas');
    c.width = Math.round(image.width * k);
    c.height = Math.round(image.height * k);
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    if (!avantChangement()) return;
    p.feuille = { ...(p.feuille ?? {}), logo: c.toDataURL(fichier.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9) };
    enregistrer();
    majFeuille();
  }

  /** Réglages de plans de la feuille : tous les plans reçoivent leur état actuel (écran ou déjà réglé) avant le 1er changement. */
  function reglagesPlansFeuille(p) {
    if (p.feuille?.plans) return { ...p.feuille.plans };
    const montres = new Set(plansMontres().map((x) => x.id));
    return Object.fromEntries(plans().map((x) => [x.id, { visible: montres.has(x.id), opacite: Math.round(100 - (x.transparence ?? 0)) }]));
  }

  function entreeFeuille(c) {
    const p = plan();
    if (c.dataset.feuillePlanOp) {
      const etiquette = page.querySelector(`[data-valeur-de="op-${c.dataset.feuillePlanOp}"]`);
      if (etiquette) etiquette.textContent = `${c.value} %`;
      if (!etat.reglageEnCours) {
        if (!avantChangement()) return;
        etat.reglageEnCours = true;
      }
      const rg = reglagesPlansFeuille(p);
      rg[c.dataset.feuillePlanOp] = { ...(rg[c.dataset.feuillePlanOp] ?? { visible: true }), opacite: Number(c.value) };
      p.feuille = { ...(p.feuille ?? {}), plans: rg };
      dessinerApercu();
      return;
    }
    if (c.dataset.feuilleCurseur === 'paleur') {
      const etiquette = page.querySelector('[data-valeur-de="paleur"]');
      if (etiquette) etiquette.textContent = `${c.value} %`;
      if (!etat.reglageEnCours) {
        if (!avantChangement()) return;
        etat.reglageEnCours = true;
      }
      p.fond.paleur = Number(c.value);
      dessinerApercu();
    }
  }

  function changeFeuille(c, p) {
    if (c.dataset.feuillePlanOp) {
      if (etat.reglageEnCours) enregistrer();
      etat.reglageEnCours = false;
      return;
    }
    if (c.dataset.feuillePlan) {
      if (!avantChangement()) return majPanneauFeuille();
      const rg = reglagesPlansFeuille(p);
      rg[c.dataset.feuillePlan] = { ...(rg[c.dataset.feuillePlan] ?? { opacite: 100 }), visible: c.checked };
      p.feuille = { ...(p.feuille ?? {}), plans: rg };
      enregistrer();
      majFeuille();
      return majPanneauFeuille();
    }
    if (c.dataset.feuilleCurseur) {
      if (etat.reglageEnCours) enregistrer();
      etat.reglageEnCours = false;
      return;
    }
    if (c.dataset.presentation === 'choisir') {
      if (!avantChangement()) return majBandeFeuille();
      if (c.value) appliquerPresentation(p, c.value);
      else quitterPresentation(p);
      enregistrer();
      majFeuille();
      return vue?.redessiner();
    }
    if (c.dataset.situation) {
      if (!avantChangement()) return majPanneauFeuille();
      const v = c.type === 'checkbox' ? c.checked : c.type === 'number' ? nombreDe(c) : c.value;
      if (v === null) return majPanneauFeuille();
      p.feuille = { ...(p.feuille ?? {}), situation: { ...reglagesFeuille(p).situation, [c.dataset.situation]: v } };
      enregistrer();
      majFeuille();
      return majPanneauFeuille();
    }
    const cle = c.dataset.feuille ?? c.dataset.feuilleCase ?? c.dataset.fond ?? c.dataset.phaseCommune;
    if (!cle) return;
    if (cle === 'logo' && c.value === 'image') return choisirLogo(p);
    if (!avantChangement()) return majPanneauFeuille();
    if (c.dataset.phaseCommune) p.phases.find((x) => x.id === c.dataset.phaseCommune).commune = c.checked || undefined;
    else if (c.dataset.fond) p.fond[cle] = c.checked;
    else if (c.dataset.feuilleCase) p.feuille = { ...(p.feuille ?? {}), [cle]: c.checked };
    else if (cle === 'echelle') {
      const v = Number(String(c.value).replace(/^\s*1\s*:\s*/, '').replace(',', '.').trim());
      if (!Number.isFinite(v) || v < 1 || v > 10000) { message('Échelle : un nombre entre 1 et 10000 (ex. 200 pour le 1:200).', 3500); return majPanneauFeuille(); }
      p.echelle = v;
    } else p.feuille = { ...(p.feuille ?? {}), [cle]: c.value.trim() };
    enregistrer();
    majFeuille();
  }

  // ---------------------------------------------------------------- Mises à jour

  function majTout() {
    if (etat.ecran !== 'dessin') return;
    majOutils();
    majPanneau();
    vue?.redessiner();
  }

  function majOutils() {
    page.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    page.querySelectorAll('[data-accroche]').forEach((b) => b.classList.toggle('actif', etat.accroches.has(b.dataset.accroche)));
    page.querySelector('[data-action="fond-points"]')?.classList.toggle('actif', plan()?.fond?.points !== false);
    page.querySelector('[data-action="fond-carte"]')?.classList.toggle('actif', Boolean(plan()?.fond?.carte));
    page.querySelector('[data-action="fond-ortho"]')?.classList.toggle('actif', Boolean(plan()?.fond?.ortho));
    page.querySelector('[data-action="fond-cadastre"]')?.classList.toggle('actif', Boolean(plan()?.fond?.cadastre));
    page.querySelector('[data-action="fond-surfaces"]')?.classList.toggle('actif', plan()?.fond?.surfaces !== false);
    page.querySelector('[data-action="ortho"]')?.classList.toggle('actif', etat.ortho);
    page.querySelector('[data-action="construction-visible"]')?.classList.toggle('actif', plan()?.construction?.visible !== false);
    page.querySelector('[data-action="biblio"]')?.setAttribute('aria-pressed', String(etat.biblio.ouvert));
    page.querySelector('[data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
    const toile = page.querySelector('[data-toile]');
    if (toile) toile.dataset.outil = etat.outil;
    majConsigne();
  }

  function majConsigne() {
    const s = etat.saisie;
    const n = s?.points.length ?? 0;
    const textes = {
      choisir: etat.choisi ? (estPose(plan().objets.find((x) => x.id === etat.choisi) ?? {}) ? 'Glisser le symbole = le déplacer (le point saisi s\'accroche) ; poignée ronde = le tourner ; Suppr = l\'effacer ; Échap = ne plus le choisir.' : 'Glisser une poignée (carré) = déplacer ce sommet ; Maj + clic ou double-clic sur un carré = supprimer ce point ; glisser l\'élément = le déplacer ; Suppr = l\'effacer ; Échap = ne plus le choisir.') : 'Cliquez un élément pour le choisir (ou dans la liste à droite). Molette = zoom, glisser dans le vide = déplacer le plan.',
      symbole: etat.pose ? 'Cliquez où poser le symbole (son centre). La rotation de pose se règle à droite.' : 'Choisissez un symbole dans la bibliothèque (à gauche).',
      rectangle: n === 0 ? 'Rectangle : cliquez le 1er coin.' : n === 1 ? 'Cliquez le 2e coin (le 1er côté), ou dirigez la souris et tapez la 1re longueur puis Entrée.' : 'Cliquez de quel côté et à quelle distance, ou placez la souris du bon côté et tapez la 2e longueur (largeur) puis Entrée.',
      rond: n === 0 ? 'Rond : cliquez le centre.' : 'Cliquez un point du bord, ou tapez le rayon (m) puis Entrée.',
      zone: n >= 3 ? 'Cliquez le sommet suivant ; cliquez le 1er sommet (ou Entrée, double-clic) pour fermer la zone.' : 'Cliquez les sommets de la zone.',
      ligne: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir.' : 'Cliquez le départ de la ligne.',
      piste: n >= 2 ? 'Point suivant de l\'axe ; Entrée ou double-clic = finir.' : 'Cliquez le départ de l\'axe de la piste.',
      fleche: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir (la pointe est au dernier point).' : 'Cliquez le départ de la flèche, puis les points jusqu\'à la pointe.',
      texte: etat.attenteRepere ? 'Cliquez le point visé par la ligne de repère.' : `Cliquez où écrire le texte${etat.texteRepere ? ' (puis le point visé par la ligne de repère)' : ''}.`,
      decaler: etat.saisie?.source ? `Cliquez du côté où mettre la copie, à ${etat.distanceDecalage} m.` : (etat.decalerConstruction ? 'Cliquez le segment dont on veut une parallèle en ligne de construction (plan DXF, dessin ou autre construction).' : 'Cliquez la ligne à décaler (une ligne du plan DXF ou un élément dessiné).'),
      cotation: etat.cotationGenre === 'angle'
        ? (n === 0 ? 'Cliquez le point 1 (sur le 1er côté).' : n === 1 ? 'Cliquez le point 2 : c\'est le sommet de l\'angle.' : 'Cliquez le point 3 (sur le 2e côté) : l\'angle 2 est coté.')
        : (n === 0 ? 'Cliquez le 1er point à coter (accroches actives).' : n === 1 ? 'Cliquez le 2e point.' : 'Cliquez où placer la ligne de cote (de quel côté et à quelle distance).'),
      construction: etat.constructionMode === 'angle'
        ? (n ? 'Tapez l\'angle de la droite puis Entrée (ou cliquez un 2e point).' : 'Cliquez un point de la droite, puis tapez son angle.')
        : (n >= 2 && etat.constructionMode === 'segment' && !etat.coupeProchaine ? 'Cliquez le point suivant, ou Entrée / double-clic pour finir (pas de prolongement).' : n ? 'Cliquez le 2e point, ou tapez la longueur (et l\'angle) puis Entrée.' : (etat.coupeProchaine ? 'Ligne de coupe : cliquez le point A (les accroches sont actives), puis le point B.' : `Cliquez le 1er point de la ${etat.constructionMode === 'segment' ? 'ligne (segment)' : 'droite'}.`)),
    };
    const zone = page.querySelector('[data-zone="consigne"]');
    if (zone && etat.orienter) {
      zone.textContent = etat.orienter.mode === 'point' ? 'Cliquez le point vers lequel tourner le symbole (accroches actives). (Échap = abandonner)' : 'Cliquez la ligne sur laquelle aligner le symbole (plan DXF ou élément dessiné). (Échap = abandonner)';
      return;
    }
    if (zone) zone.textContent = etat.attenteRepere ? `${textes.texte} (Échap = sans repère)` : `${textes[etat.outil]}${etat.outil !== 'choisir' ? ' (Échap = arrêter)' : ''}`;
    // Longueur et angle tapés : visibles dès qu'un 1er point est posé (lignes, pistes, flèches, zones, constructions).
    const saisie = page.querySelector('[data-zone="saisie"]');
    if (saisie) {
      const actif = Boolean(etat.saisie?.points?.length) && etat.saisie.outil !== 'decaler';
      saisie.hidden = !actif;
      const lon = saisie.querySelector('[data-saisie="longueur"]');
      if (lon) lon.closest('label').hidden = actif && etat.saisie.outil === 'construction' && etat.constructionMode === 'angle';
      const ang = saisie.querySelector('[data-saisie="angle"]');
      if (ang) ang.closest('label').hidden = actif && (etat.saisie.outil === 'rond' || (etat.saisie.outil === 'rectangle' && etat.saisie.points.length === 2)); // rond : le rayon ; rectangle 2e côté : la largeur
    }
  }

  function majEtat() {
    const zone = page.querySelector('[data-zone="etat"]');
    if (!zone) return;
    const c = etat.curseur;
    const s = etat.saisie;
    let mesure = '';
    if (s?.points.length && c) {
      const pts = [...s.points, c];
      mesure = s.outil === 'zone' && pts.length >= 3 ? `Surface ${n1(aire(pts))} m² · ` : '';
      mesure += `Longueur ${n1(longueur(pts, s.outil === 'zone'))} m`;
    }
    zone.innerHTML = c ? `<span class="chiffre">E ${c[0].toFixed(2)}</span><span class="chiffre">N ${c[1].toFixed(2)}</span>${mesure ? `<span>${mesure}</span>` : ''}` : '';
  }

  /** Champ nombre : data-reglage (outil) ou data-prop (élément choisi). */
  const champNombre = (titre, attr, cle, valeur, min, max, pas, unite = '') =>
    `<label class="champ-calage"><span>${titre}${unite ? ` (${unite})` : ''}</span><input type="number" min="${min}" max="${max}" step="${pas}" value="${valeur}" data-${attr}="${cle}"></label>`;
  const champCase = (titre, attr, cle, coche) => `<label class="case-chantier"><input type="checkbox" data-${attr}="${cle}" ${coche ? 'checked' : ''}> ${titre}</label>`;
  const champCurseur = (titre, attr, cle, valeur) =>
    `<label class="champ-calage"><span>${titre} : <b data-valeur-de="${cle}">${Math.round(valeur)} %</b></span><input type="range" min="0" max="100" step="5" value="${valeur}" data-${attr}="${cle}"></label>`;

  /** 0.299.0 : trait du contour et hachure d'une zone (attr 'hachure-outil' pour l'outil, 'hachure' pour l'élément choisi). */
  function champsStyleZone(attr, trait, h, couleurZone) {
    const motif = h?.motif ?? 'aucune';
    return `<label class="champ-calage"><span>Trait du contour</span><select data-${attr}="traitContour">${TRAITS_CONTOUR.map(([v, t]) => `<option value="${v}" ${(trait ?? 'continu') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="champ-calage"><span>Hachure (en plus du fond)</span><select data-${attr}="motif">${MOTIFS_HACHURE.map(([v, t]) => `<option value="${v}" ${motif === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${motif === 'aucune' ? '' : `<label class="champ-calage"><span>Angle (°)</span><input type="number" min="-180" max="180" step="5" value="${h.angle ?? HACHURE_ANGLE}" data-${attr}="angle"></label>
      <label class="champ-calage"><span>Espacement (mm papier)</span><input type="number" min="0.5" max="50" step="0.5" value="${h.pasMm ?? HACHURE_PAS_MM}" data-${attr}="pasMm"></label>
      <label class="champ-calage"><span>Couleur des hachures</span><span class="ligne-couleur-hachure"><input type="color" value="${echapper(h.couleur || couleurZone)}" data-${attr}="couleur">${h.couleur ? `<button type="button" class="bouton-secondaire petit" data-action="${attr}-couleur-zone" title="Même couleur que la zone">↺</button>` : ''}</span></label>`}`;
  }

  /** 0.310.0 : fiche écrite d'une grue Liebherr 172 EC-B choisie (charges, hauteur, contrepoids… : tout vient de la fiche du constructeur). */
  function ficheGrueHtml(o) {
    if (o?.type !== 'grue' || o.modele !== 'fiche') return '';
    const fiche = ficheGrue(o);
    const alerte = (t) => `<li class="alerte-fiche">⚠ ${echapper(t)}</li>`;
    return `<h3>Fiche de la grue</h3><ul class="fiche-grue">${fiche.lignes.map((l) => `<li><b>${echapper(l.titre)}</b> : ${echapper(l.valeur)}${l.detail ? `<small>${echapper(l.detail)}</small>` : ''}</li>${l.alerte ? alerte(l.alerte) : ''}`).join('')}${fiche.pasDansLaFiche.map(alerte).join('')}</ul>`;
  }

  /** 0.311.0 : vue de côté sous le plan (grues d'après fiche et bâtiments = zones avec Z bas / Z haut le long d'une ligne). */
  function majCoupe() {
    const zone = page.querySelector('[data-zone="coupe"]');
    if (!zone) return;
    zone.hidden = !etat.coupe.ouvert;
    if (!etat.coupe.ouvert) return;
    const p = plan();
    const lignes = lignesDeCoupe(p);
    const choisie = p?.objets.find((x) => x.id === etat.choisi);
    if (choisie && ((choisie.type === 'grue' && choisie.modele === 'fiche') || (choisie.type === 'construction' && choisie.coupe)) && etat.coupe.suivre !== choisie.id) {
      etat.coupe.ligne = `${choisie.type === 'grue' ? 'grue' : 'constr'}:${choisie.id}`; // toucher une grue ou une ligne de coupe = sa vue de côté
      etat.coupe.suivre = choisie.id;
    }
    if (!lignes.find((l) => l.id === etat.coupe.ligne)) etat.coupe.ligne = lignes[0]?.id ?? null;
    const ligne = lignes.find((l) => l.id === etat.coupe.ligne);
    const largeur = Math.max(320, zone.clientWidth || 700);
    const toutes = ligne ? surfaces().filter((s) => s.triangles?.length) : [];
    const montrees = toutes.filter((s) => !etat.coupe.cachees.has(s.id));
    zone.innerHTML = `<div class="entete-coupe"><strong>Vue de côté</strong>
      ${lignes.length ? `<select data-coupe-ligne aria-label="Ligne de la coupe">${lignes.map((l) => `<option value="${echapper(l.id)}" ${l.id === etat.coupe.ligne ? 'selected' : ''}>${echapper(l.nom)}</option>`).join('')}</select>` : ''}
      ${toutes.length ? `<details class="surfaces-coupe"><summary>Surfaces (${montrees.length}/${toutes.length})</summary><div>${toutes.map((s) => `<label><input type="checkbox" data-coupe-surface="${echapper(s.id)}" ${etat.coupe.cachees.has(s.id) ? '' : 'checked'}> ${echapper(s.nom)}${s.type === 'plateforme' ? ' (plateforme)' : ''}</label>`).join('')}</div></details>` : ''}
      <button type="button" class="bouton-secondaire petit" data-action="coupe-fermer" aria-label="Fermer la vue de côté">✕</button></div>
      ${ligne ? svgCoupe(coupeChantier(p, ligne, montrees), largeur, 230) : '<p class="aide-calage">Poser une grue d\'après fiche, ou tracer une ligne de coupe (bouton « Tracer »), pour choisir où couper.</p>'}`;
  }

  function majPanneau() {
    const zone = page.querySelector('[data-zone="panneau"]');
    if (!zone) return;
    const p = plan();
    const o = p.objets.find((x) => x.id === etat.choisi);
    const mmLigne = (cle) => (etat.epaisseurMm ?? styleLigne(cle).epaisseurMm);
    // Réglages de l'outil : donnés aux éléments dessinés ensuite.
    const reglages = {
      zone: `${selectGenresOutil('zone', etat.categorie)}
        ${champCurseur('Transparence du fond (opacité)', 'reglage', 'opacite', etat.opacite)}
        ${champNombre('Épaisseur du contour', 'reglage', 'contourMm', etat.contourMm ?? (etat.categorie === 'emprise' ? 0.7 : 0.35), 0.05, 5, 0.05, 'mm')}
        ${champCase('Afficher la surface (m²)', 'reglage-case', 'afficherSurface', etat.afficherSurface)}
        ${champsStyleZone('hachure-outil', etat.traitContour, etat.hachure, categorieZone(etat.categorie).couleur)}`,
      ligne: `${selectGenresOutil('ligne', etat.style)}
        ${champNombre('Épaisseur', 'reglage', 'epaisseurMm', mmLigne(etat.style), 0.05, 5, 0.05, 'mm')}
        ${champNombre('Échelle du motif', 'reglage', 'echelleMotif', etat.echelleMotif, 0.3, 5, 0.1, '×')}`,
      piste: champNombre('Largeur de la piste', 'reglage', 'largeur', etat.largeur, 1, 30, 0.5, 'm'),
      fleche: `${champNombre('Largeur de la ligne', 'reglage', 'largeurFleche', etat.largeurFleche, 0.05, 5, 0.05, 'm')}
        ${champNombre('Échelle de la pointe', 'reglage', 'echelleFleche', etat.echelleFleche, 0.3, 10, 0.1, '×')}`,
      texte: `${champNombre('Hauteur des lettres', 'reglage', 'tailleTexte', etat.tailleTexte, 0.2, 10, 0.1, 'm')}
        ${listeChoix('Cadre', 'reglage', 'cadreTexte', CADRES_TEXTE, etat.cadreTexte)}
        ${listeChoix('Coins du cadre', 'reglage', 'arrondi', ARRONDIS, etat.arrondi)}
        ${champCase('Avec ligne de repère', 'reglage-case', 'texteRepere', etat.texteRepere)}
        <label class="champ-calage"><span>Bout du repère</span><select data-reglage="repereBout">
          ${[['fleche', 'Flèche'], ['point', 'Point'], ['aucun', 'Rien']].map(([v, t]) => `<option value="${v}" ${etat.repereBout === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
      symbole: etat.pose ? `<p class="resume-chantier">${echapper(nomDeLaPose(etat.pose))}</p>
        ${champNombre('Rotation de pose', 'reglage', 'rotationPose', etat.rotationPose, -360, 360, 5, '°')}` : '<p class="aide-calage">Choisissez un symbole dans la bibliothèque.</p>',
      construction: `<label class="champ-calage"><span>Trait</span><select data-reglage="constructionTrait">${TRAITS_CONSTRUCTION.map(([v, t]) => `<option value="${v}" ${etat.constructionTrait === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="champ-calage"><span>Type</span><select data-reglage="constructionMode">
          ${[['droite', 'Droite (2 points)'], ['angle', 'Droite par un point et un angle'], ['segment', 'Segment / polyligne (autant de points que voulu, Entrée pour finir)']].map(([v, t]) => `<option value="${v}" ${etat.constructionMode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="aide-calage">Cyan en tirets, jamais imprimées ni exportées ; elles servent d'accroche (Sur ligne, Croisement, Perpendiculaire) et pour aligner. « Décaler » avec la case « En ligne de construction » donne une parallèle.</p>`,
      cotation: `${listeChoix('Valeur', 'reglage', 'styleCote', STYLES_COTE, etat.styleCote)}${listeChoix('Bouts', 'reglage', 'flecheCote', FLECHES_COTE, etat.flecheCote)}${champNombre('Taille des bouts', 'reglage', 'tailleFlecheCote', etat.tailleFlecheCote, 0.8, 8, 0.2, 'mm')}${listeChoix('Si la cote est courte, valeur au', 'reglage', 'coteTexte', [['fin', 'bout B'], ['debut', 'bout A']], etat.coteTexte)}${listeChoix('Coins du cadre', 'reglage', 'arrondi', ARRONDIS, etat.arrondi)}${champCase('Valeur sans cadre ni fond', 'reglage-case', 'cotationNu', etat.cotationNu)}<label class="champ-calage"><span>Genre de cotation</span><select data-reglage="cotationGenre"><option value="longueur" ${etat.cotationGenre !== 'angle' ? 'selected' : ''}>Longueur alignée</option><option value="angle" ${etat.cotationGenre === 'angle' ? 'selected' : ''}>Angle</option></select></label>`,
      decaler: `${champNombre('Distance du décalage', 'reglage', 'distanceDecalage', etat.distanceDecalage, 0.01, 100, 0.05, 'm')}
        ${champCase('En ligne de construction (parallèle)', 'reglage-case', 'decalerConstruction', etat.decalerConstruction)}
        ${selectGenresOutil('ligne', etat.style)}`,
    }[['rectangle', 'rond'].includes(etat.outil) ? 'zone' : etat.outil] ?? '';
    let choisi = '';
    let propreHtml = '';
    if (o) {
      const propre = {
        construction: `<label class="champ-calage"><span>Trait</span><select data-prop="trait">${TRAITS_CONSTRUCTION.map(([v, t]) => `<option value="${v}" ${(o.trait ?? 'tirets') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          ${champCase('Droite infinie', 'prop-case', 'infinie', Boolean(o.infinie))}`,
        zone: `${selectGenres('zone', o.categorie)}
          ${o.categorie === 'batiment' ? `<label class="champ-calage" title="Z du bas et du haut du bâtiment, visibles sur la vue de côté"><span>Z bas</span><input type="number" min="-500" max="5000" step="0.01" value="${o.zBas ?? ''}" data-prop="zBas"></label>
          <label class="champ-calage"><span>Z haut</span><input type="number" min="-500" max="5000" step="0.01" value="${o.zHaut ?? ''}" data-prop="zHaut"></label>` : ''}
          <label class="champ-calage"><span>Texte de la zone (au centre)</span><input type="text" maxlength="60" value="${echapper(o.etiquette ?? '')}" placeholder="ex. Stock de sable" data-prop="etiquette"></label>
          ${champCurseur('Transparence du fond (opacité)', 'prop', 'opacite', o.opacite ?? OPACITE_ZONE)}
          ${champNombre('Épaisseur du contour', 'prop', 'contourMm', contourZoneMm(o), 0.05, 5, 0.05, 'mm')}
          ${champCase('Afficher la surface (m²)', 'prop-case', 'afficherSurface', o.afficherSurface)}
          ${o.cercle ? champNombre('Rayon du rond', 'prop', 'rayonRond', o.cercle.rayon, 0.01, 10000, 0.1, 'm') : ''}
          ${champsStyleZone('hachure', o.traitContour, o.hachure, couleurObjet(p, o))}
          <label class="champ-calage"><span>Matériau du stock</span><select data-prop="materiau"><option value="">— (couleur du genre)</option>
            ${MATERIAUX_TAS.map((m) => `<option value="${m.cle}" ${o.materiau === m.cle ? 'selected' : ''}>${m.nom}</option>`).join('')}</select></label>
          ${champCase('Effet de tas', 'prop-case', 'tasOui', o.tasH > 0)}
          ${o.tasH > 0 ? `${champNombre('Hauteur du tas', 'prop', 'tasH', o.tasH, 0.2, 30, 0.1, 'm')}
            ${champCase('Écrire la hauteur', 'prop-case', 'afficherHauteur', o.afficherHauteur)}` : ''}`,
        ligne: `${selectGenres('ligne', styleLigne(o.style).cle)}
          ${styleLigne(o.style).motif?.largeurM ? champNombre('Largeur de la bande', 'prop', 'largeurM', o.largeurM ?? styleLigne(o.style).motif.largeurM, 0.1, 20, 0.1, 'm') : champNombre('Épaisseur', 'prop', 'epaisseurMm', epaisseurLigneMm(o), 0.05, 5, 0.05, 'mm')}
          ${champNombre('Échelle du motif', 'prop', 'echelleMotif', o.echelleMotif ?? 1, 0.3, 5, 0.1, '×')}
          <label class="champ-calage"><span>Texte le long de la ligne</span><input type="text" data-prop="texteLigne" maxlength="40" value="${echapper(o.texteLigne ?? styleLigne(o.style).texteDefaut ?? '')}" placeholder="aucun"></label>
          ${champNombre('Un texte tous les', 'prop', 'texteTousM', o.texteTousM ?? styleLigne(o.style).texteTousM ?? 15, 1, 500, 1, 'm')}
          ${champNombre('Hauteur du texte', 'prop', 'texteLigneMm', o.texteLigneMm ?? 2.5, 1, 10, 0.5, 'mm')}
          `,
        piste: champNombre('Largeur', 'prop', 'largeur', o.largeur ?? 4, 1, 30, 0.5, 'm'),
        cotation: (o.genre === 'angle' ? '' : listeChoix('Valeur', 'prop', 'styleCote', STYLES_COTE, o.styleCote ?? 'dessus') + listeChoix('Bouts', 'prop', 'fleche', FLECHES_COTE, o.fleche ?? 'fleche') + champNombre('Taille des bouts', 'prop', 'tailleFlecheMm', o.tailleFlecheMm ?? 2.6, 0.8, 8, 0.2, 'mm') + listeChoix('Cote courte : valeur au', 'prop', 'coteTexte', [['fin', 'bout B'], ['debut', 'bout A']], o.coteTexte ?? 'fin')) + listeChoix('Coins du cadre', 'prop', 'arrondi', ARRONDIS, o.arrondi ?? 'peu') + champCase('Valeur sans cadre ni fond', 'prop-case', 'nu', Boolean(o.nu)) + (o.genre === 'angle' ? champNombre('Rayon de l\'arc', 'prop', 'rayon', o.rayon ?? Math.round((geometrieCotation(o)?.arc?.[0] ? Math.hypot(geometrieCotation(o).arc[0][0] - geometrieCotation(o).sommet[0], geometrieCotation(o).arc[0][1] - geometrieCotation(o).sommet[1]) : 1) * 100) / 100, 0.1, 500, 0.1, 'm') : champNombre('Distance de la ligne de cote (+ gauche, − droite)', 'prop', 'decalage', o.decalage ?? 1, -500, 500, 0.1, 'm')),
        texte: `<label class="champ-calage"><span>Texte (Entrée = nouvelle ligne)</span><textarea data-prop="texte" maxlength="400" rows="2">${echapper(o.texte)}</textarea></label>
          <div class="styles-lignes"><span>Par ligne :</span>${lignesDuTexte(o.texte).map((l, i) => `<span class="style-ligne">${i + 1}
            <button type="button" data-style-ligne="${i}" data-s="g" class="${o.styles?.[i]?.g ? 'actif' : ''}" title="Gras" style="font-weight:800">G</button><button type="button" data-style-ligne="${i}" data-s="s" class="${o.styles?.[i]?.s ? 'actif' : ''}" title="Souligné" style="text-decoration:underline">S</button>
            ${['g', 'c', 'd'].map((a) => `<button type="button" data-style-ligne="${i}" data-s="a" data-v="${a}" class="${(o.styles?.[i]?.a ?? 'c') === a ? 'actif' : ''}" title="${{ g: 'À gauche', c: 'Centré', d: 'À droite' }[a]}">${{ g: '⇤', c: '↔', d: '⇥' }[a]}</button>`).join('')}
            <input type="number" min="0.2" max="10" step="0.1" data-style-ligne-champ="${i}" data-s="h" value="${o.styles?.[i]?.h ?? ''}" placeholder="${o.taille ?? 1}" title="Hauteur de cette ligne (m), vide = celle du texte" style="width:4.2em">
            <input type="color" data-style-ligne-champ="${i}" data-s="k" value="${o.styles?.[i]?.k ?? '#1b2b36'}" title="Couleur de cette ligne"></span>`).join('')}</div>
          ${champNombre('Hauteur des lettres', 'prop', 'taille', o.taille ?? 1, 0.2, 10, 0.1, 'm')}
          ${listeChoix('Cadre', 'prop', 'cadre', CADRES_TEXTE, cadreDuTexte(o))}
          ${champNombre('Épaisseur du cadre et du repère', 'prop', 'epaisseurCadreMm', o.epaisseurCadreMm ?? 0.3, 0.1, 3, 0.1, 'mm')}
          ${listeChoix('Fond', 'prop', 'fond', [['blanc', 'Blanc'], ['transparent', 'Transparent']], o.fond ?? 'blanc')}
          ${cadreDuTexte(o) === 'arrondi' || cadreDuTexte(o) === 'double' ? listeChoix('Coins du cadre', 'prop', 'arrondi', ARRONDIS, o.arrondi ?? 'peu') : ''}
          ${champCase('Ligne de repère', 'prop-case', 'repere', Boolean(o.repere) || etat.attenteRepere === o.id)}
          ${o.repere ? `<label class="champ-calage"><span>Bout du repère</span><select data-prop="repereBout">
            ${[['fleche', 'Flèche'], ['point', 'Point'], ['aucun', 'Rien']].map(([v, t]) => `<option value="${v}" ${(o.repereBout ?? 'fleche') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${champNombre('Échelle du bout du repère', 'prop', 'echelleBout', o.echelleBout ?? 1, 0.3, 5, 0.1, '×')}` : ''}
          ${etat.attenteRepere === o.id ? '<p class="aide-calage">Cliquez le point visé sur le plan (Échap = sans repère).</p>' : ''}`,
        fleche: `${champNombre('Largeur de la ligne', 'prop', 'largeur', dimensionsFleche(o).largeur, 0.05, 5, 0.05, 'm')}
          ${champNombre('Échelle de la pointe', 'prop', 'echelle', Math.round(dimensionsFleche(o).echelle * 100) / 100, 0.3, 10, 0.1, '×')}`,
        symbole: panneauSymbole(o),
        grue: panneauSymbole(o),
      }[o.type];
      propreHtml = propre ?? ''; // 0.293.0 : tout ce qui concerne l'élément choisi est dans le bandeau du haut
    }
    zone.innerHTML = `
      <h3>Plan</h3>
      <h3>Phases</h3>
      <ul class="phases-chantier">${p.phases.map((ph) => `<li class="${ph.id === p.phaseActive ? 'active' : ''}">
        <input type="checkbox" data-phase-visible="${ph.id}" ${ph.visible !== false ? 'checked' : ''} aria-label="Montrer ${echapper(ph.nom)}">
        <input type="color" value="${ph.couleur}" data-phase-couleur="${ph.id}" aria-label="Couleur de ${echapper(ph.nom)}">
        <button type="button" class="nom-phase" data-phase-active="${ph.id}" title="Dessiner dans cette phase">${echapper(ph.nom)}</button>
        <button type="button" class="suppr-calage" data-phase-renommer="${ph.id}" aria-label="Renommer ${echapper(ph.nom)}">✎</button>
        ${p.phases.length > 1 ? `<button type="button" class="suppr-calage" data-phase-suppr="${ph.id}" aria-label="Supprimer ${echapper(ph.nom)}">✕</button>` : ''}</li>`).join('')}</ul>
      <button type="button" class="lien-calage" data-action="phase-ajouter">＋ Nouvelle phase</button>
      <button type="button" class="bouton-secondaire" data-action="gestion-phases">Gestion des phases…</button>
      <label class="champ-calage"><span>Couleurs</span><select data-champ="couleurs">
        <option value="objets" ${p.couleurs !== 'phases' ? 'selected' : ''}>Celles des objets</option>
        <option value="phases" ${p.couleurs === 'phases' ? 'selected' : ''}>Une couleur par phase</option></select></label>
      ${choisi}
      ${ficheGrueHtml(o)}
      <button type="button" class="bouton-secondaire" data-action="modeles-grues">Modèles de grues…</button>
      <h3>Éléments (${p.objets.length})</h3>
      <ul class="elements-chantier">${[...p.objets].reverse().map((x) => `<li class="ligne-element"><button type="button" data-choisir="${x.id}" class="${x.id === etat.choisi ? 'actif' : ''}">
        <i style="background:${couleurObjet(p, x)}"></i>${echapper(resumeObjet(x))}</button><button type="button" class="cadenas-liste ${x.verrou ? 'actif' : ''}" data-verrou-id="${x.id}" title="${x.verrou ? 'Verrouillé : toucher pour déverrouiller' : 'Toucher pour verrouiller'}" aria-label="Verrou">${icoCadenas(x.verrou)}</button></li>`).join('') || '<li class="aide-calage">Rien de dessiné.</li>'}</ul>`;
    page.querySelector('.ruban-chantier [data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
    zone.querySelectorAll('canvas[data-vignette-pose]').forEach((c) => dessinerPose(c, Number(c.dataset.vignettePose)));
    majBandeau(o, p, propreHtml, reglages);
    majCoupe();
  }

  /**
   * Bandeau de l'élément choisi (0.293.0, au-dessus du plan) : ce qu'on règle le plus souvent, sans défiler dans le panneau de
   * droite : rotation, échelle, orientation, phase, couleur, ordre de dessin, décaler, effacer.
   */
  function majBandeau(o, p, propre = '', reglagesOutil = '') {
    const zone = page.querySelector('[data-zone="bandeau-element"]');
    if (!zone) return;
    // 0.305.0 : le bandeau est toujours là, à hauteur fixe (rien ne saute quand on choisit un élément ou un outil).
    zone.hidden = false;
    // 0.318.0 : une grue d'après fiche a beaucoup de réglages : le bandeau grandit (sans défiler) tant qu'elle est choisie.
    zone.classList.toggle('bandeau-grue', Boolean(o && o.type === 'grue' && o.modele === 'fiche'));
    const avecOutil = Boolean(reglagesOutil && etat.outil !== 'choisir');
    if (!o) {
      // 0.296.0 : les réglages de l'outil actif sont dans le bandeau du haut (plus dans la colonne de droite)
      const nom = [...OUTILS, ...[['symbole', '', 'Symbole']]].find(([c]) => c === etat.outil)?.[2] ?? 'Outil';
      zone.innerHTML = avecOutil ? `<span class="puce-element">Outil : ${echapper(nom)}</span><div class="propre-element">${reglagesOutil}</div>`
        : '<span class="aide-calage">Aucun élément choisi : touchez un élément du plan, ou prenez un outil du ruban.</span>';
      return;
    }
    const k = echelleDeLObjet(o);
    const pose = estPose(o);
    const petit = (titre, attr, cle, valeur, min, max, pas, unite = '') => `<label class="champ-bandeau"><span>${titre}${unite ? ` (${unite})` : ''}</span><input type="number" min="${min}" max="${max}" step="${pas}" value="${valeur}" data-${attr}="${cle}"></label>`;
    const bouton = (attr, texte, titre) => `<button type="button" class="bouton-secondaire petit" ${attr} title="${titre}">${texte}</button>`;
    const phases = `<label class="champ-bandeau"><span>Phase</span><select data-prop="phase">${p.phases.map((ph) => `<option value="${ph.id}" ${ph.id === o.phase ? 'selected' : ''}>${echapper(ph.nom)}</option>`).join('')}</select></label>
      <label class="champ-bandeau" title="Dernière phase où l'élément est en place ; après, il est « fini » (voir Gestion des phases)"><span>Fin</span><select data-prop="fin"><option value="">— (reste)</option>${p.phases.map((ph) => `<option value="${ph.id}" ${ph.id === o.fin ? 'selected' : ''}>${echapper(ph.nom)}</option>`).join('')}</select></label>`;
    const couleur = pose || o.type === 'construction' ? '' : p.couleurs === 'phases' ? '<span class="aide-calage">Couleur : celle de la phase</span>'
      : `<label class="champ-bandeau"><span>Couleur</span><input type="color" value="${couleurObjet({ ...p, couleurs: 'objets' }, o)}" data-prop="couleur"></label>${o.couleur ? bouton('data-action="couleur-origine"', '↺', 'Couleur d\'origine') : ''}`;
    const poseHtml = pose ? `${petit('Rotation', 'prop', 'rotation', o.rotation ?? 0, -360, 360, 1, '°')}
      ${bouton('data-tourner="90"', '⟲ 90°', 'Tourner de 90° à gauche')}${bouton('data-tourner="-90"', '⟳ 90°', 'Tourner de 90° à droite')}
      <label class="champ-bandeau" title="Taille du texte de ce bloc, en mm sur le papier ; vide = celle du plan (Texte des symboles)"><span>Texte (mm)</span><input type="number" min="0.5" max="12" step="0.5" value="${o.texteMm ?? ''}" placeholder="${p.tailleTexteMm ?? TAILLE_TEXTE_MM}" data-prop="texteMm"></label>
      ${champCase('Sans le texte du bloc', 'prop-case', 'sansTexte', Boolean(o.sansTexte))}
      ${o.type === 'grue' ? '' : petit('Échelle', 'prop', 'echelle', k, 0.1, 10, 0.05, '×')}${k !== 1 && o.type !== 'grue' ? bouton('data-echelle-reelle', '1×', 'Taille réelle') : ''}
      ${bouton(`data-orienter="point" class="${etat.orienter?.mode === 'point' ? 'actif' : ''}"`, 'Vers un point', 'Orienter vers un point (cliquer ensuite le point visé)')}
      ${bouton(`data-orienter="ligne" class="${etat.orienter?.mode === 'ligne' ? 'actif' : ''}"`, 'Aligner', 'Aligner sur une ligne (cliquer ensuite une ligne)')}` : '';
    const decaler = !['texte', 'symbole', 'grue', 'construction', 'cotation'].includes(o.type) && !pose ? bouton('data-action="decaler-choisi"', '⇉ Décaler', 'Décaler une copie') : '';
    const inverser = ['ligne', 'fleche', 'piste'].includes(o.type) && !o.verrou ? bouton('data-action="inverser-sens"', '⇄ Inverser le sens', 'Inverser le sens : le départ et l\'arrivée s\'échangent (flèche, piéton, chevrons…)') : '';
    zone.innerHTML = `<span class="puce-element">${echapper(resumeObjet(o))}</span>
      ${poseHtml}${phases}${couleur}${inverser}
      <span class="groupe-ordre" role="group" aria-label="Ordre de dessin">${bouton('data-ordre="devant"', '⤒', 'Premier plan')}${bouton('data-ordre="monter"', '▲', 'Un cran au-dessus')}${bouton('data-ordre="descendre"', '▼', 'Un cran en dessous')}${bouton('data-ordre="arriere"', '⤓', 'Arrière-plan')}</span>
      ${bouton(`data-action="verrou" class="${o.verrou ? 'actif' : ''}"`, icoCadenas(o.verrou), o.verrou ? 'Déverrouiller' : 'Verrouiller', o.verrou ? 'Déverrouiller : on pourra de nouveau le déplacer' : 'Verrouiller : l\'élément ne peut plus être déplacé (ni ses points, ni tourné)')}
      ${decaler}${bouton('data-action="effacer"', '✕ Effacer', 'Effacer cet élément')}
      ${propre ? `<div class="propre-element">${propre}</div>` : ''}`;
    // 0.317.0 : élément verrouillé = rien de ce qui le déplace (rotation, échelle, orientation) ; effacer, genre, couleur restent possibles.
    if (o.verrou) zone.querySelectorAll('[data-tourner], [data-prop="rotation"], [data-prop="echelle"], [data-orienter], [data-echelle-reelle]').forEach((c) => { c.disabled = true; });
    zone.querySelectorAll('canvas[data-vignette-pose]').forEach((c) => dessinerPose(c, Number(c.dataset.vignettePose))); // vignettes des 8 poses de l'escalier
  }

  /** Nom de ce qui va être posé (panneau de l'outil). */
  function nomDeLaPose(pose) {
    if (pose.type === 'grue') return pose.modele === 'auto' ? 'Grue automontante' : pose.modele === 'mobile' ? 'Grue mobile' : pose.modele === 'fiche' ? `Grue ${modeleDe(pose.modeleGrue).nom}` : 'Grue à tour';
    if (pose.etage) return 'Base-vie à étage';
    return bib().find((x) => x.cle === pose.cle)?.nom ?? pose.cle;
  }

  /** Réglages d'un symbole posé : rotation ; grue : modèle, flèche, châssis, rayon ; base-vie à étage : pose, textes. */
  function panneauSymbole(o) {
    const sy = symboleDeLObjet(bib(), o);
    const k = echelleDeLObjet(o);
    const dims = sy && o.type !== 'grue' ? `<p class="aide-calage">${n1(sy.largeur * k)} × ${n1(sy.hauteur * k)} m${k === 1 ? ' (échelle réelle)' : ` (échelle ×${k})`}</p>` : '';
    const echelle = o.type === 'grue' ? '' : `<div class="ligne-rotation">${champNombre('Échelle du bloc', 'prop', 'echelle', k, 0.1, 10, 0.05, '×')}
      ${k !== 1 ? '<button type="button" class="bouton-secondaire" data-echelle-reelle title="Revenir à la taille réelle">Taille réelle</button>' : ''}</div>`;
    const rotation = ''; // 0.293.0 : rotation, échelle et orientation sont dans le bandeau du haut
    const orienter = '';
    if (o.type === 'grue' && o.modele === 'fiche') {
      // 0.311.0 : grue d'après la fiche d'un modèle : libellés courts ; la fiche écrite est dans la colonne de droite.
      const g = reglagesGrue(o);
      const familles = [...new Set(g.modele.tours.map((t) => t.famille))];
      const opt = (v, t, ok) => `<option value="${echapper(String(v))}" ${ok ? 'selected' : ''}>${echapper(t)}</option>`;
      // 0.315.0 : réglages rangés par thème (Modèle · Flèche et charge · Tour et châssis · Affichage)
      const bloc = (titre, contenu) => `<div class="groupe-grue"><b>${titre}</b>${contenu}</div>`;
      return bloc('Modèle', `<label class="champ-calage"><span>Modèle</span><select data-prop="modeleGrue">${tousLesModeles().map((m) => opt(m.id, m.nom, m.id === g.modele.id)).join('')}</select></label>`)
        + bloc('Flèche et charge', `<label class="champ-calage"><span>Flèche (m)</span><select data-prop="fleche">${g.modele.fleches.map((f) => opt(f.nom, `${f.nom.toFixed(1)} m`, f.nom === g.fleche.nom)).join('')}</select></label>
        ${champCase('Crochet', 'prop-case', 'afficherCrochet', g.afficherCrochet)}
        ${g.afficherCrochet ? champNombre('Rayon crochet', 'prop', 'rayonCrochet', g.r, RAYON_MIN_GRUE, porteeGrue(g.fleche), 0.1, 'm') : ''}
        ${g.fleche.charges2 ? `<label class="champ-calage"><span>Charges</span><select data-prop="mode">${opt('lm1', 'Tableau 1', g.mode === 'lm1')}${opt('lm2', 'Tableau 2', g.mode === 'lm2')}</select></label>` : ''}
        <label class="champ-calage"><span>Cercles de charge</span><select data-prop="cerclesMode" title="Fiche : portées du tableau avec leur charge ; 5 m : un cercle tous les 5 m dès 20 m (sans charge)">${opt('fiche', 'Ceux de la fiche (charges)', g.cerclesMode === 'fiche')}${opt('cinq', 'Tous les 5 m dès 20 m', g.cerclesMode === 'cinq')}${opt('aucun', 'Aucun', g.cerclesMode === 'aucun')}</select></label>
        ${champNombre('Rotation flèche', 'prop', 'rotationFleche', o.rotationFleche ?? 0, -360, 360, 1, '°')}`)
        + bloc('Tour et châssis', `<label class="champ-calage"><span>Tour / pied</span><select data-prop="tour">${familles.map((fa) => `<optgroup label="${echapper(fa)}">${g.modele.tours.filter((t) => t.famille === fa).map((t) => opt(t.id, t.nom, t.id === g.tour.id)).join('')}</optgroup>`).join('')}</select></label>
        <label class="champ-calage"><span>HSC (m)</span><select data-prop="hauteur">${hauteursGrue(g.tour).map((h) => opt(h.h, `${h.h.toFixed(1)} m${h.etoile ? ' *' : ''} (${h.etiquette})`, h.h === g.hauteur.h)).join('')}</select></label>
        ${champNombre('Z châssis', 'prop', 'zPied', g.zPied, -500, 5000, 0.01, 'm')}
        ${champCase('Massifs sous le pied', 'prop-case', 'massifs', g.massifs)}
        ${g.massifs ? champNombre('Côté du massif', 'prop', 'massifL', g.massifL, 0.1, 30, 0.1, 'm') : ''}`)
        + bloc('Affichage', `${champCase('Charge', 'prop-case', 'afficherCharge', g.afficherCharge)}
        ${champCase('HSC', 'prop-case', 'afficherHsc', g.afficherHsc)}
        ${champCase('Rayon d\'action', 'prop-case', 'rayon', o.rayon !== false)}
        <label class="champ-calage" title="Écrit avant « Flèche … m » sur la flèche"><span>Texte avant la flèche</span><input type="text" maxlength="60" value="${echapper(g.texteFleche)}" placeholder="ex. Grue G1" data-prop="texteFleche"></label>
        <label class="champ-calage"><span>Couleur des textes</span><input type="color" value="${g.couleurTexte}" data-prop="couleurTexte"></label>`);
    }
    if (o.type === 'grue' && o.modele === 'mobile') {
      // 0.293.0 : grue mobile dynamique (porteur = rotation de l'objet, tourelle et flèche indépendantes).
      const a = autogrueDe(o.tonnes ?? 100);
      return `<label class="champ-calage"><span>Taille de la grue</span><select data-prop="tonnes">${TONNES_MOBILES.map((t) => `<option value="${t}" ${t === a.t ? 'selected' : ''}>${t} t</option>`).join('')}</select></label>
        ${champNombre('Rotation de la tourelle (par rapport au porteur)', 'prop', 'tourelle', o.tourelle ?? 0, -360, 360, 1, '°')}
        ${champNombre('Longueur de la flèche', 'prop', 'fleche', sy?.fleche ?? o.fleche ?? 20, FLECHE_MOBILE_MIN, a.fleche, 0.5, 'm')}
        ${champCase('Stabilisateurs sortis', 'prop-case', 'stabilisateurs', o.stabilisateurs !== false)}
        ${champCase('Repliée (sur la route)', 'prop-case', 'repliee', Boolean(o.repliee))}`;
    }
    if (o.type === 'grue') {
      // 0.290.0 : longueur de flèche et côté du châssis tapés librement (les longueurs du DXF sont proposées).
      const fleches = flechesDisponibles(bib(), o.modele ?? 'tour');
      const chassis = chassisDisponibles(bib());
      const cote = coteChassis(o.chassis);
      return `${rotation}${orienter}
        <label class="champ-calage"><span>Modèle</span><select data-prop="modele">
          <option value="tour" ${o.modele !== 'auto' ? 'selected' : ''}>Grue à tour</option><option value="auto" ${o.modele === 'auto' ? 'selected' : ''}>Grue automontante</option></select></label>
        <label class="champ-calage"><span>Longueur de la flèche (m)</span><input type="number" min="${FLECHE_MIN}" max="${FLECHE_MAX}" step="0.5" value="${sy?.fleche ?? o.fleche ?? 40}" data-prop="fleche" list="fleches-grue"></label>
        <datalist id="fleches-grue">${fleches.map((f) => `<option value="${f}"></option>`).join('')}</datalist>
        ${champCase('Châssis (coté sur le plan)', 'prop-case', 'chassisOui', Boolean(cote))}
        ${cote ? `<label class="champ-calage"><span>Côté du châssis (m)</span><input type="number" min="${CHASSIS_MIN}" max="${CHASSIS_MAX}" step="0.05" value="${cote.toFixed(2)}" data-prop="chassis" list="chassis-grue"></label>
        <datalist id="chassis-grue">${chassis.map((c) => `<option value="${c}"></option>`).join('')}</datalist>` : ''}
        ${champNombre('Orientation de la flèche (indépendante du châssis)', 'prop', 'rotationFleche', o.rotationFleche ?? 0, -360, 360, 1, '°')}
        ${champCase('Rayon d\'action', 'prop-case', 'rayon', o.rayon !== false)}
        <label class="champ-calage"><span>Abaque (portée : charge) — vide = cercles tous les 5 m dès 20 m</span><input type="text" maxlength="200" value="${echapper(o.abaqueTexte ?? '')}" placeholder="20:5.2, 25:3.8, 30:2.9" data-prop="abaqueTexte"></label>`;
    }
    if (o.etage) {
      const textes = o.etage.textes ?? ['1er', 'Rez'];
      return `${dims}${rotation}${orienter}
        <p class="aide-calage">Pose de l'escalier (4 coins × 2 sens de montée) :</p>
        <div class="poses-etage">${POSES_ETAGE.map((t, i) => `<button type="button" data-pose-etage="${i}" class="${(o.etage.pose ?? 0) === i ? 'actif' : ''}" title="${echapper(t)}"><canvas data-vignette-pose="${i}"></canvas></button>`).join('')}</div>
        <label class="champ-calage"><span>Texte de l'étage</span><input type="text" maxlength="30" value="${echapper(textes[0])}" data-etage-texte="0"></label>
        <label class="champ-calage"><span>Texte du rez</span><input type="text" maxlength="30" value="${echapper(textes[1])}" data-etage-texte="1"></label>`;
    }
    if (o.cle === CLE_POMPE) {
      // 0.305.0 : pompe à béton réglable : mât plié / déplié, longueur et rotation du mât.
      return `${champCase('Mât déplié', 'prop-case', 'deploye', o.deploye !== false)}
        ${o.deploye !== false ? `${champNombre('Longueur du mât', 'prop', 'longueur', o.longueur ?? LONGUEUR_POMPE.depart, LONGUEUR_POMPE.min, LONGUEUR_POMPE.max, 1, 'm')}
        ${champNombre('Rotation du mât (par rapport au camion)', 'prop', 'tourelle', o.tourelle ?? 0, -360, 360, 1, '°')}` : ''}`;
    }
    if (o.cle === CLE_PARKING) {
      return `${champNombre('Nombre de places côte à côte', 'prop', 'nombre', o.nombre ?? 1, 1, 30, 1, '')}
        <label class="champ-calage"><span>Couleur</span><input type="color" value="${o.couleur ?? '#1f5fae'}" data-prop="couleur"></label>`;
    }
    if (o.cle === CLE_PORTAIL) {
      const r = reglagesPortail(o);
      const lim = PASSAGE_PORTAIL[r.genre];
      return `<label class="champ-calage"><span>Genre</span><select data-prop="genre">${GENRES_PORTAIL.map(([v, t]) => `<option value="${v}" ${r.genre === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        ${champNombre('Largeur de passage (entre les poteaux)', 'prop', 'passage', r.passage, lim.min, lim.max, 0.05, 'm')}
        ${r.genre === 'portillon' ? `<label class="champ-calage"><span>Charnière</span><select data-prop="charniere"><option value="gauche" ${r.charniere === 'gauche' ? 'selected' : ''}>À gauche</option><option value="droite" ${r.charniere === 'droite' ? 'selected' : ''}>À droite</option></select></label>` : ''}
        <label class="champ-calage"><span>Texte sous le portail</span><input type="text" maxlength="40" value="${echapper(o.texteSous ?? '')}" placeholder="ex. Accès chantier" data-prop="texteSous"></label>`;
    }
    if (o.cle === CLE_DEVIATION) {
      return `<label class="champ-calage"><span>Texte du panneau</span><input type="text" maxlength="30" value="${echapper(o.texte ?? 'Lugano')}" data-prop="texte"></label>
        <label class="champ-calage"><span>Sens</span><select data-prop="sens">${SENS_DEVIATION.map(([v, t]) => `<option value="${v}" ${(o.sens ?? 'droite') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    }
    const tourelle = sy?.pivote ? champNombre(sy.pivote.libelle ?? 'Rotation de la tourelle (par rapport au châssis)', 'prop', 'tourelle', o.tourelle ?? 0, -360, 360, 1, '°') : '';
    const etiq = `<label class="champ-calage"><span>Texte sur le bloc</span><input type="text" maxlength="40" value="${echapper(o.etiquette ?? '')}" placeholder="ex. Bureaux" data-prop="etiquette"></label>`;
    return `<p class="resume-chantier">${echapper(sy?.nom ?? 'Symbole introuvable')}</p>${dims}${tourelle}${etiq}${rotation}${orienter}`;
  }

  /** Vignette d'une pose de la base-vie à étage. */
  function dessinerPose(canvas, pose) {
    const conteneur = bib().find((x) => x.cle === CLE_CONTENEUR);
    if (!conteneur) return;
    dessinerVignette(canvas, { ...conteneur, etageDemo: true, poseDemo: pose }, bib());
  }

  // ---------------------------------------------------------------- Bibliothèque (panneau de gauche)

  function majBiblio() {
    const zone = page.querySelector('[data-zone="biblio"]');
    if (!zone) return;
    zone.hidden = !etat.biblio.ouvert;
    page.querySelector('.travail-chantier')?.classList.toggle('avec-biblio', etat.biblio.ouvert);
    if (!etat.biblio.ouvert) return;
    if (!zone.querySelector('[data-zone="biblio-liste"]')) {
      zone.innerHTML = `
        <h3>Symboles ${bulle('symbolesChantier')}</h3>
        <input type="search" placeholder="Rechercher…" data-biblio="recherche" value="${echapper(etat.biblio.recherche)}" aria-label="Rechercher un symbole">
        <div class="categories-biblio">${['', ...CATEGORIES_SYMBOLES].map((c) => `<button type="button" data-biblio-cat="${c}">${c || 'Tous'}</button>`).join('')}</div>
        <div class="liste-biblio" data-zone="biblio-liste"></div>
        <button type="button" class="lien-calage" data-action="importer-blocs">＋ Importer un DXF de blocs…</button>`;
    }
    zone.querySelectorAll('[data-biblio-cat]').forEach((b) => b.classList.toggle('actif', b.dataset.biblioCat === etat.biblio.categorie));
    const liste = zone.querySelector('[data-zone="biblio-liste"]');
    if (!bibBase.length && !(leProjet().symboles ?? []).length) {
      liste.innerHTML = '<p class="aide-calage">Chargement de la bibliothèque…</p>';
      return;
    }
    const entrees = filtrerEntrees(entreesBibliotheque(bib()), etat.biblio.categorie, etat.biblio.recherche);
    const choisie = etat.outil === 'symbole' ? cleDeLaPose(etat.pose) : null;
    // 0.307.0 : un titre par type (catégorie) quand plusieurs types sont montrés.
    liste.innerHTML = entrees.map((x, i) => `${!etat.biblio.categorie && x.categorie !== entrees[i - 1]?.categorie ? `<h4 class="titre-type-biblio">${echapper(x.categorie ?? 'Autres')}</h4>` : ''}<button type="button" class="entree-biblio ${x.cle === choisie ? 'actif' : ''}" data-entree="${echapper(x.cle)}" title="${echapper(x.nom)}">
      <canvas data-vignette="${echapper(x.cle)}"></canvas><span class="nom">${echapper(x.nom)}</span>
      <span class="dims">${x.detail ? echapper(x.detail) : `${n1(x.largeur)} × ${n1(x.hauteur)} m`}${x.importe ? ' · projet' : ''}</span></button>`).join('') || '<p class="aide-calage">Aucun symbole.</p>';
    const parCle = new Map(entrees.map((x) => [x.cle, x]));
    liste.querySelectorAll('canvas[data-vignette]').forEach((c) => {
      const x = parCle.get(c.dataset.vignette);
      if (x) dessinerVignette(c, x.symbole, bib());
    });
  }

  const cleDeLaPose = (pose) => (!pose ? null : pose.type === 'grue' ? (pose.modele === 'fiche' ? `grue:fiche:${pose.modeleGrue}` : `grue:${pose.modele}`) : pose.etage ? 'etage' : pose.cle);

  async function importerBlocs() {
    if (lectureSeule()) return message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
    const entree = document.createElement('input');
    entree.type = 'file';
    entree.accept = '.dxf';
    const fichier = await new Promise((ok) => {
      entree.addEventListener('change', () => ok(entree.files?.[0] ?? null));
      entree.click();
    });
    if (!fichier) return;
    const { symboles, erreur } = symbolesDuDxf(new Uint8Array(await fichier.arrayBuffer()));
    if (erreur) return message(`« ${fichier.name} » : ${erreur}.`, 6000);
    const { ajoutes, remplaces } = ajouterSymbolesProjet(leProjet(), symboles);
    modifie();
    message(`${ajoutes} symbole(s) ajouté(s) au projet${remplaces ? `, ${remplaces} remplacé(s)` : ''} (style moderne ajouté).`, 5000, { ok: true });
    majBiblio();
  }

  // ---------------------------------------------------------------- Événements

  page.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    const p = plan();
    if (b.dataset.action === 'retour') return fermer();
    if (b.dataset.ecran) {
      if (b.dataset.ecran === 'liste') etat.ecran = 'liste';
      else if (p) etat.ecran = b.dataset.ecran;
      return dessiner();
    }
    if (etat.ecran === 'feuille' && p && (await clicFeuille(b, p)) !== false) return;
    if (b.dataset.action === 'nouveau') return nouveau();
    const trouve = (id) => liste().find((x) => x.id === id);
    if (b.dataset.ouvrir) return ouvrirPlan(trouve(b.dataset.ouvrir));
    if (b.dataset.renommer || b.dataset.dupliquer || b.dataset.supprimer) {
      if (lectureSeule()) return message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      const x = trouve(b.dataset.renommer || b.dataset.dupliquer || b.dataset.supprimer);
      if (b.dataset.renommer) {
        const nom = await demanderTexte({ titre: 'Nouveau nom du plan', valeur: x.nom });
        if (!nom) return;
        x.nom = nom;
      } else if (b.dataset.dupliquer) {
        const copie = { ...copiePlan(x), id: nouveauPlanChantier('').id, nom: `${x.nom} (copie)`, modifieLe: new Date().toISOString() };
        liste().push(copie);
      } else {
        const ok = await demanderChoix({ titre: `Supprimer « ${x.nom} » ?`, texte: `${x.objets.length} élément(s) seront supprimés du projet.`, boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'danger' }] });
        if (ok !== 'oui') return;
        leProjet().plansChantier = liste().filter((y) => y !== x);
        if (etat.planId === x.id) etat.planId = null;
      }
      modifie();
      return dessiner();
    }
    if (!p || etat.ecran !== 'dessin') return;
    if (b.dataset.action === 'biblio') {
      etat.biblio.ouvert = !etat.biblio.ouvert;
      majBiblio();
      majOutils();
      return;
    }
    if (b.dataset.action === 'importer-blocs') return importerBlocs();
    if (b.dataset.biblioCat !== undefined) {
      etat.biblio.categorie = b.dataset.biblioCat;
      return majBiblio();
    }
    if (b.dataset.entree) {
      const x = entreesBibliotheque(bib()).find((y) => y.cle === b.dataset.entree);
      if (!x) return;
      etat.pose = JSON.parse(JSON.stringify(x.pose));
      etat.outil = 'symbole';
      etat.saisie = null;
      etat.choisi = null;
      majBiblio();
      return majTout();
    }
    if (b.dataset.ordre) {
      if (!etat.choisi || !avantChangement()) return;
      if (!changerOrdre(p, etat.choisi, b.dataset.ordre)) {
        pileAnnuler.pop();
        return message(b.dataset.ordre === 'devant' || b.dataset.ordre === 'monter' ? 'Cet élément est déjà tout au-dessus.' : 'Cet élément est déjà tout en dessous.', 2500);
      }
      enregistrer();
      return majTout();
    }
    if (b.dataset.orienter) {
      etat.orienter = etat.orienter?.mode === b.dataset.orienter ? null : { id: etat.choisi, mode: b.dataset.orienter };
      return majTout();
    }
    if (b.dataset.echelleReelle !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      delete o.echelle;
      enregistrer();
      return majTout();
    }
    if (b.dataset.tourner || b.dataset.poseEtage !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (b.dataset.tourner) o.rotation = ((((o.rotation ?? 0) + Number(b.dataset.tourner)) % 360) + 360) % 360;
      else o.etage = { ...o.etage, pose: Number(b.dataset.poseEtage) };
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'coupe-tracer') {
      etat.coupeProchaine = true;
      etat.constructionMode = 'segment';
      etat.outil = 'construction';
      etat.saisie = null;
      etat.choisi = null;
      majBiblio();
      return majTout();
    }
    if (b.dataset.action === 'coupe' || b.dataset.action === 'coupe-fermer') {
      etat.coupe.ouvert = b.dataset.action === 'coupe' ? !etat.coupe.ouvert : false;
      etat.coupe.suivre = null;
      page.querySelector('[data-action="coupe"]')?.setAttribute('aria-pressed', String(etat.coupe.ouvert));
      majCoupe();
      return vue?.redessiner();
    }
    if (b.dataset.action === 'modeles-grues') {
      return ouvrirModelesGrues({
        projet: leProjet, lectureSeule, message, modeleInitial: () => { const o = plan()?.objets.find((x) => x.id === etat.choisi); return o?.modele === 'fiche' ? o.modeleGrue : null; }, modifie: () => { modifie(); synchroModeles(); }, redessiner: () => { synchroModeles(); majTout(); },
      });
    }
    if (['fond-carte', 'fond-ortho', 'fond-cadastre', 'fond-surfaces'].includes(b.dataset.action)) {
      if (!avantChangement()) return;
      const cle = { 'fond-carte': 'carte', 'fond-ortho': 'ortho', 'fond-cadastre': 'cadastre', 'fond-surfaces': 'surfaces' }[b.dataset.action];
      p.fond[cle] = cle === 'surfaces' ? p.fond.surfaces === false : !p.fond[cle];
      if (cle === 'surfaces' && !surfaces().length && p.fond.surfaces) message('Le projet n\'a aucune surface (ou elles sont cachées par le dossier choisi).', 4000);
      enregistrer();
      majTout();
      if (cle !== 'surfaces' && p.fond[cle]) setTimeout(() => {
        if (etat.fondEtat?.manquantes && !etat.fondEtat.enCours) message('Fond swisstopo indisponible (pas de connexion ?).', 4000);
      }, 6000);
      return;
    }
    if (b.dataset.outil) {
      etat.coupeProchaine = false;
      etat.outil = b.dataset.outil;
      etat.saisie = null;
      etat.attenteRepere = null;
      if (etat.outil !== 'choisir') etat.choisi = null;
      return majTout();
    }
    if (b.dataset.accroche) {
      const a = b.dataset.accroche;
      if (etat.accroches.has(a)) etat.accroches.delete(a);
      else etat.accroches.add(a);
      return majOutils();
    }
    if (b.dataset.zoom) return b.dataset.zoom === 'tout' ? vue?.cadrer() : vue?.zoom(Number(b.dataset.zoom));
    if (b.dataset.choisir) {
      etat.outil = 'choisir';
      etat.saisie = null;
      etat.choisi = b.dataset.choisir;
      return majTout();
    }
    if (b.dataset.action === 'couleur-origine') {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      delete o.couleur;
      enregistrer();
      return majTout();
    }
    if (b.dataset.genre) {
      const { genre, cible, valeur } = b.dataset;
      if (cible === 'outil') {
        if (genre === 'zone') etat.categorie = valeur;
        else {
          etat.style = valeur;
          etat.epaisseurMm = null; // l'épaisseur redevient celle du genre
          if (etat.saisie?.source) etat.saisie.style = valeur;
        }
        if (etat.saisie && !etat.saisie.source) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style });
        return majTout();
      }
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (genre === 'zone') o.categorie = valeur;
      else {
        o.style = valeur;
        delete o.epaisseurMm; // épaisseur du nouveau genre
      }
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'inverser-sens') {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (!inverserSens(o)) return;
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'construction-visible') {
      if (!avantChangement()) return;
      p.construction = { ...(p.construction ?? {}), visible: p.construction?.visible === false };
      if (etat.choisi && p.objets.find((x) => x.id === etat.choisi)?.type === 'construction' && p.construction.visible === false) etat.choisi = null;
      enregistrer();
      return majTout();
    }
    if (b.dataset.styleLigne !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      const i = Number(b.dataset.styleLigne);
      const styles = [...(o.styles ?? [])];
      styles[i] = b.dataset.s === 'a' ? { ...(styles[i] ?? {}), a: b.dataset.v } : { ...(styles[i] ?? {}), [b.dataset.s]: !styles[i]?.[b.dataset.s] };
      o.styles = styles;
      enregistrer();
      majTout();
      return vue?.redessinerDessus();
    }
    if (b.dataset.action === 'ortho') {
      etat.ortho = !etat.ortho;
      majOutils();
      return majConsigne();
    }
    if (b.dataset.action === 'ortho-zero') {
      etat.orthoAngle = 0;
      majOutils();
      const champ = page.querySelector('[data-reglage="orthoAngle"]');
      if (champ) champ.value = 0;
      return message('Ortho : repère à 0° (Nord / Sud / Est / Ouest).', 2500);
    }
    if (b.dataset.action === 'ortho-repere') {
      etat.orthoRepere = true;
      message('Cliquez une ligne du plan ou du dessin : son angle devient le repère de l\'Ortho.', 4000);
      return;
    }
    if (b.dataset.action === 'saisie-ok') return placerParSaisie();
    if (b.dataset.action === 'verrou' || b.dataset.verrouId) {
      const id = b.dataset.verrouId ?? etat.choisi;
      const o = id ? plan().objets.find((x) => x.id === id) : null;
      if (!o || !avantChangement()) return;
      if (o.verrou) delete o.verrou;
      else o.verrou = true;
      enregistrer();
      majTout();
      vue?.redessinerDessus();
      message(o.verrou ? 'Élément verrouillé : il ne peut plus être déplacé.' : 'Élément déverrouillé.', 2500, { ok: true });
      return;
    }
    if (b.dataset.action === 'decaler-choisi') return decalerChoisi();
    if (b.dataset.action === 'effacer') return supprimerChoisi();
    if (b.dataset.action === 'annuler') return annuler();
    if (b.dataset.action === 'hachure-outil-couleur-zone') {
      etat.hachure = { ...etat.hachure, couleur: '' };
      return majPanneau();
    }
    if (b.dataset.action === 'hachure-couleur-zone') {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o?.hachure || !avantChangement()) return;
      delete o.hachure.couleur;
      enregistrer();
      majPanneau();
      return vue?.redessinerDessus();
    }
    if (b.dataset.action === 'fond-points') {
      // 0.299.0 : fenêtre de cases : les noms des points (une case pour toutes les listes), puis chaque liste.
      if (!listesPoints) {
        if (!avantChangement()) return;
        p.fond.points = p.fond.points === false;
        enregistrer();
        return majTout();
      }
      const listes = listesPoints();
      if (!listes.length) return message('Le projet n\'a aucun point levé.', 3500);
      const caches = new Set(p.fond.listesPointsCachees ?? []);
      const montres = p.fond.points !== false;
      const coches = await demanderCases({
        titre: 'Points levés montrés sur le plan',
        options: [
          { cle: '__noms', texte: 'Écrire les noms des points (toutes les listes)', coche: Boolean(p.fond.nomsPoints) },
          ...listes.map((l) => ({ cle: l.id, texte: `${l.nom} (${l.points.length})`, coche: montres && !caches.has(l.id) })),
        ],
      });
      if (!coches || !avantChangement()) return;
      const ids = listes.map((l) => l.id).filter((id) => coches.includes(id));
      p.fond.points = ids.length > 0;
      p.fond.listesPointsCachees = listes.map((l) => l.id).filter((id) => !coches.includes(id));
      if (coches.includes('__noms')) p.fond.nomsPoints = true;
      else delete p.fond.nomsPoints;
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'fond-plans') {
      const tous = plans();
      if (!tous.length) return message('Le projet n\'a aucun plan (DXF, PDF, IFC) à mettre dessous.', 4000);
      // 0.296.1 : choix général ou propre à une phase (« changer de plan par phase »)
      let phase = null;
      if (p.phases.length > 1) {
        const rep = await demanderChoix({
          titre: 'Plans montrés dessous : pour quelle phase ?',
          boutons: [
            { cle: '__toutes', texte: 'Toutes les phases', detail: 'choix général (phases sans choix propre)', principal: true },
            ...p.phases.map((ph) => ({ cle: ph.id, texte: ph.nom, detail: p.fond.plansParPhase?.[ph.id] ? 'choix propre à cette phase' : 'suit le choix général' })),
            ...(p.fond.plansParPhase && Object.keys(p.fond.plansParPhase).length ? [{ cle: '__reinit', texte: 'Tout remettre au choix général', detail: 'efface les choix par phase' }] : []),
          ],
        });
        if (!rep) return;
        if (rep === '__reinit') {
          if (!avantChangement()) return;
          delete p.fond.plansParPhase;
          enregistrer();
          return majTout();
        }
        phase = rep === '__toutes' ? null : rep;
      }
      const caches = new Set(p.fond.plansCaches ?? []);
      const actuels = phase ? new Set(plansMontres(phase).map((x) => x.id)) : null;
      const nomPhase = p.phases.find((x) => x.id === phase)?.nom;
      const coches = await demanderCases({ titre: phase ? `Plans montrés dessous en « ${nomPhase} »` : 'Plans du projet montrés dessous', options: tous.map((x) => ({ cle: x.id, texte: x.nom ?? x.id, coche: phase ? actuels.has(x.id) : !caches.has(x.id) })) });
      if (!coches || !avantChangement()) return;
      if (phase) {
        p.fond.plansParPhase = { ...(p.fond.plansParPhase ?? {}), [phase]: coches };
      } else {
        p.fond.plansCaches = tous.map((x) => x.id).filter((id) => !coches.includes(id));
      }
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'fond-calques') {
      return ouvrirGestionCalques({ plans: plansMontres, plan, avantChangement, enregistrer, redessiner: () => { majTout(); vue?.redessiner(); } });
    }
    if (b.dataset.action === 'gestion-phases') {
      return ouvrirGestionPhases({ plan, avantChangement, enregistrer, redessiner: () => { majTout(); vue?.redessinerDessus(); } });
    }
    if (b.dataset.action === 'phase-ajouter') {
      if (!avantChangement()) return;
      ajouterPhase(p);
      enregistrer();
      return majTout();
    }
    if (b.dataset.phaseActive) {
      p.phaseActive = b.dataset.phaseActive;
      if (etat.choisi && !objetsVisibles(p).some((o) => o.id === etat.choisi)) etat.choisi = null; // l'élément choisi n'est plus montré dans cette phase
      enregistrer();
      majTout();
      return vue?.redessiner(); // 0.294.1 : l'affichage suit la gestion des phases dès qu'on change de phase
    }
    if (b.dataset.phaseRenommer) {
      const ph = p.phases.find((x) => x.id === b.dataset.phaseRenommer);
      const nom = await demanderTexte({ titre: 'Nom de la phase', valeur: ph.nom });
      if (!nom || !avantChangement()) return;
      ph.nom = nom;
      enregistrer();
      return majPanneau();
    }
    if (b.dataset.phaseSuppr) {
      const ph = p.phases.find((x) => x.id === b.dataset.phaseSuppr);
      const nb = p.objets.filter((o) => o.phase === ph.id).length;
      const ok = await demanderChoix({ titre: `Supprimer « ${ph.nom} » ?`, texte: nb ? `Ses ${nb} élément(s) seront supprimés aussi (↶ Annuler possible).` : '', boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'danger' }] });
      if (ok !== 'oui' || !avantChangement()) return;
      retirerPhase(p, ph.id);
      if (!p.objets.some((o) => o.id === etat.choisi)) etat.choisi = null;
      enregistrer();
      return majTout();
    }
  });

  /** Valeur d'un champ nombre, bornée par son min / max (virgule acceptée) ; null si illisible. */
  const nombreDe = (c) => {
    const v = Number(String(c.value).replace(',', '.'));
    if (!Number.isFinite(v) || String(c.value).trim() === '') return null;
    return Math.min(c.max !== '' ? Number(c.max) : Infinity, Math.max(c.min !== '' ? Number(c.min) : -Infinity, v));
  };

  // Curseur de transparence : l'aperçu suit le doigt ; un seul « Annuler » pour tout le glissement.
  page.addEventListener('input', (ev) => {
    const c = ev.target;
    if (c.dataset.biblio === 'recherche') {
      etat.biblio.recherche = c.value;
      return majBiblio();
    }
    if (etat.ecran === 'feuille' && (c.dataset.feuilleCurseur || c.dataset.feuillePlanOp)) return entreeFeuille(c);
    const p = plan();
    if (!p || c.type !== 'range') return;
    const valeur = Number(c.value);
    const etiquette = page.querySelector(`[data-valeur-de="${c.dataset.reglage ?? c.dataset.prop}"]`);
    if (etiquette) etiquette.textContent = `${Math.round(valeur)} %`;
    if (c.dataset.reglage) {
      etat[c.dataset.reglage] = valeur;
      return;
    }
    const o = p.objets.find((x) => x.id === etat.choisi);
    if (!o) return;
    if (!etat.reglageEnCours) {
      if (!avantChangement()) return;
      etat.reglageEnCours = true;
    }
    o[c.dataset.prop] = valeur;
    vue?.redessinerDessus();
  });

  page.addEventListener('change', (ev) => {
    const c = ev.target;
    const p = plan();
    if (!p) return;
    if (etat.ecran === 'feuille') return changeFeuille(c, p);
    if (c.dataset.coupeSurface !== undefined) {
      if (c.checked) etat.coupe.cachees.delete(c.dataset.coupeSurface); else etat.coupe.cachees.add(c.dataset.coupeSurface);
      return majCoupe();
    }
    if (c.dataset.coupeLigne !== undefined) {
      etat.coupe.ligne = c.value;
      etat.coupe.suivre = etat.choisi;
      return majCoupe();
    }
    if (c.dataset.etageTexte !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o?.etage || !avantChangement()) return;
      const textes = [...(o.etage.textes ?? ['1er', 'Rez'])];
      textes[Number(c.dataset.etageTexte)] = c.value.trim();
      o.etage = { ...o.etage, textes };
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.type === 'range') {
      if (etat.reglageEnCours) enregistrer();
      etat.reglageEnCours = false;
      return;
    }
    if (c.dataset.genreOutil) {
      if (c.dataset.genreOutil === 'zone') etat.categorie = c.value;
      else {
        etat.style = c.value;
        etat.epaisseurMm = null;
        if (etat.saisie?.source) etat.saisie.style = c.value;
      }
      if (etat.saisie && !etat.saisie.source) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style });
      return majTout();
    }
    if (c.dataset.genreListe) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (c.dataset.genreListe === 'zone') o.categorie = c.value;
      else {
        o.style = c.value;
        delete o.epaisseurMm;
      }
      enregistrer();
      return majTout();
    }
    if (c.dataset.reglage) {
      const cle = c.dataset.reglage;
      if (c.type === 'number') {
        const v = nombreDe(c);
        if (v === null) return majPanneau();
        etat[cle] = v;
      } else etat[cle] = c.value;
      if (etat.saisie && !etat.saisie.source) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style, largeur: etat.largeur });
      majConsigne();
      vue?.redessinerDessus();
      return;
    }
    if (c.dataset.reglageCase) {
      etat[c.dataset.reglageCase] = c.checked;
      return majConsigne();
    }
    if (c.dataset.champ === 'echelle') {
      const v = Number(String(c.value).replace(/^\s*1\s*:\s*/, '').replace(',', '.').trim());
      if (!Number.isFinite(v) || v < 1 || v > 10000) { message('Échelle : un nombre entre 1 et 10000 (ex. 200 pour le 1:200).', 3500); return majBande(); }
      if (v === null || !avantChangement()) return majPanneau();
      p.echelle = v;
      c.value = String(v); // « 1:500 » devient « 500 »
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.champ === 'rendu3d') {
      if (!avantChangement()) return majPanneau();
      if (c.checked) delete p.rendu3d;
      else p.rendu3d = false;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.champ === 'tailleTexteMm') {
      const v = nombreDe(c);
      if (v === null || !avantChangement()) return majPanneau();
      p.tailleTexteMm = v;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.phaseVisible) {
      if (!avantChangement()) return;
      p.phases.find((x) => x.id === c.dataset.phaseVisible).visible = c.checked;
      enregistrer();
      return majTout();
    }
    if (c.dataset.phaseCouleur) {
      if (!avantChangement()) return;
      p.phases.find((x) => x.id === c.dataset.phaseCouleur).couleur = c.value;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.champ === 'couleurs') {
      if (!avantChangement()) return;
      p.couleurs = c.value;
      enregistrer();
      return vue?.redessinerDessus();
    }
    // 0.299.0 : trait du contour et hachure (outil, puis élément choisi)
    if (c.dataset.hachureOutil) {
      const cle = c.dataset.hachureOutil;
      if (cle === 'traitContour') etat.traitContour = c.value;
      else {
        const v = c.type === 'number' ? nombreDe(c) : c.value;
        if (v === null) return majPanneau();
        etat.hachure = { ...etat.hachure, [cle]: v };
      }
      return majPanneau();
    }
    if (c.dataset.hachure) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o) return;
      const cle = c.dataset.hachure;
      const v = c.type === 'number' ? nombreDe(c) : c.value;
      if (v === null) return majPanneau();
      if (!avantChangement()) return;
      if (cle === 'traitContour') {
        if (v === 'continu') delete o.traitContour;
        else o.traitContour = v;
      } else if (cle === 'motif' && v === 'aucune') delete o.hachure;
      else o.hachure = { motif: 'lignes', angle: HACHURE_ANGLE, pasMm: HACHURE_PAS_MM, ...(o.hachure ?? {}), [cle]: v };
      enregistrer();
      majPanneau();
      return vue?.redessinerDessus();
    }
    if (c.dataset.propCase) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o) return;
      const cle = c.dataset.propCase;
      if (cle === 'tasOui') {
        if (!avantChangement()) return;
        if (c.checked) {
          o.tasH = o.tasH > 0 ? o.tasH : TAS_HAUTEUR;
          o.tasTalus ??= TAS_TALUS;
          o.afficherHauteur = true;
        } else {
          delete o.tasH;
          delete o.tasTalus;
          delete o.afficherHauteur;
        }
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'chassisOui') {
        if (!avantChangement()) return;
        o.chassis = c.checked ? (coteChassis(o.chassisAvant) ?? 4.5).toFixed(2) : 'aucun';
        if (!c.checked) o.chassisAvant = coteChassis(o.chassis) ?? o.chassisAvant;
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'stabilisateurs' || cle === 'repliee' || cle === 'deploye' || cle === 'afficherCharge' || cle === 'afficherHsc' || cle === 'afficherCrochet' || cle === 'sansTexte') {
        if (!avantChangement()) return;
        o[cle] = c.checked;
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'nu') {
        if (!avantChangement()) return;
        if (c.checked) o.nu = true;
        else delete o.nu;
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'rayon') {
        if (!avantChangement()) return;
        o.rayon = c.checked; // rayon d'action d'une grue : affiché ou caché
        enregistrer();
        return vue?.redessinerDessus();
      }
      if (cle === 'repere') {
        if (c.checked) {
          etat.attenteRepere = o.id; // le prochain clic sur le plan donne le point visé
          etat.repereBout = o.repereBout ?? etat.repereBout;
        } else {
          etat.attenteRepere = null;
          if (o.repere && avantChangement()) {
            delete o.repere;
            delete o.repereBout;
            enregistrer();
          }
        }
        return majTout();
      }
      if (!avantChangement()) return;
      if (c.checked) o[cle] = true;
      else delete o[cle];
      enregistrer();
      majPanneau();
      return vue?.redessinerDessus();
    }
    if (c.dataset.styleLigneChamp !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      const i = Number(c.dataset.styleLigneChamp);
      const styles = [...(o.styles ?? [])];
      const cle = c.dataset.s;
      const v = c.type === 'number' ? (c.value.trim() === '' ? undefined : Number(c.value)) : c.value;
      const ligne = { ...(styles[i] ?? {}) };
      if (v === undefined || Number.isNaN(v)) delete ligne[cle];
      else ligne[cle] = v;
      styles[i] = ligne;
      o.styles = styles;
      enregistrer();
      majTout();
      return vue?.redessinerDessus();
    }
    if (c.dataset.prop) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o) return;
      const cle = c.dataset.prop;
      if ((cle === 'zBas' || cle === 'zHaut') && !c.value.trim()) {
        if (o[cle] === undefined || !avantChangement()) return;
        delete o[cle];
        enregistrer();
        return majTout();
      }
      if (cle === 'texteMm' && !c.value.trim()) {
        if (o.texteMm === undefined || !avantChangement()) return;
        delete o.texteMm; // retour à la taille du plan
        enregistrer();
        return majTout();
      }
      if (cle === 'texte' && !c.value.trim()) return majPanneau();
      let valeur = c.value.trim();
      if (c.type === 'number') {
        valeur = nombreDe(c);
        if (valeur === null) return majPanneau();
      }
      if (!avantChangement()) return;
      if (cle === 'rayonRond') {
        changerRayon(o, valeur);
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      o[cle] = valeur;
      if (o.modele === 'fiche') {
        // 0.311.0 : réglages d'une grue d'après fiche : nombres, et HSC / rayon qui restent valables quand le choix change
        if (['fleche', 'hauteur'].includes(cle)) o[cle] = Number(valeur);
        if (cle === 'modeleGrue') {
          const m = modeleDe(valeur);
          o.fleche = m.fleches[Math.floor(m.fleches.length / 2)].nom;
          o.tour = m.tours[0].id;
          o.hauteur = hauteurGrue(m.tours[0], o.hauteur).h;
          delete o.rayonCrochet;
          delete o.mode;
        }
        if (cle === 'tour') o.hauteur = hauteurGrue(tourGrue(modeleDe(o.modeleGrue), valeur), o.hauteur).h;
        if (cle === 'fleche') {
          const f = flecheGrue(modeleDe(o.modeleGrue), Number(valeur));
          o.rayonCrochet = Math.min(Number(o.rayonCrochet) || porteeGrue(f), porteeGrue(f));
        }
      }
      if (cle === 'genre' && o.cle === CLE_PORTAIL) o.passage = PASSAGE_PORTAIL[valeur]?.depart ?? 5; // un autre genre repart de sa largeur habituelle
      if (cle === 'fin' && !valeur) delete o.fin;
      if (cle === 'etiquette' && !valeur) delete o.etiquette;
      if (cle === 'texteSous' && !valeur) delete o.texteSous; // 0.320.6 : texte aligné sous le portail
      if (cle === 'abaqueTexte' && !valeur) delete o.abaqueTexte;
      if (cle === 'materiau' && !valeur) delete o.materiau;
      if (cle === 'tonnes') o.tonnes = Number(valeur);
      if (cle === 'chassis') o.chassis = Number(valeur).toFixed(2); // côté libre (m), gardé en texte comme « 4.50 »
      enregistrer();
      majPanneau();
      vue?.redessinerDessus();
    }
  });

  dessiner();
  return { fermer };
}
