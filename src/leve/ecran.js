// Onglet Terrain (seulement dans l'appli Android), avec le récepteur Emlid. Deux modes :
// - Lever : écran épuré pour le chantier, le plan en haut (voir style.css, « mode-leve »), puis le
//   rôle du prochain point (contour, ligne de rupture, point isolé), son nom, la position et le gros
//   bouton PRENDRE LE POINT. Le levé, le stock et le récepteur sont dans une ligne repliable.
// - Implanter (mode « controler » dans le code) : on choisit une surface ; en direct, de combien monter ou descendre pour être
//   dessus, et deux coupes autour du récepteur (perpendiculaire et dans l'axe de la direction regardée).
//   Ou on implante un point : on le choisit en touchant le plan (accroche au sommet, au milieu, sur
//   la ligne ou au centre d'un cercle), puis on l'implante (guidage avance / droite) ou on le garde
//   dans la liste « À implanter ». « Enregistrer l'implantation » note la position et les écarts.
// Aussi : les bandeaux « RTK » et « Inclinaison » sous l'en-tête, visibles dans tous les onglets.
//
// L'état du récepteur arrive 5 fois par seconde (mettreAJourRecepteur) : on ne change alors que
// quelques textes et l'état du bouton, sans redessiner l'écran (le doigt peut être dessus).
import { echapper } from '../outils/echapper.js';
import { aAcces, estModeBase } from '../reglages/reglages.js';
import { demanderCode } from '../outils/code.js';
import { demanderTexte } from '../outils/choix.js';
import { ouvrirChoixLevees } from './fenetre-levees.js';
import { ouvrirFenetreSuites } from './fenetre-suites.js';
import { htmlControle } from './controle-ecran.js';
import { htmlLame, rafraichirLame } from './lame-ecran.js';
import { bulle } from '../aide/bulles.js';
import { svgDrapeau, iconeDrapeau } from '../outils/drapeaux.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE, debutDeNom } from '../topo/leve-direct.js';
import { ROLES_METRE } from '../topo/metre.js';
import { prefixeDuNom, avecPrefixe, dateDuJourCollee } from '../topo/surface.js';
import { ELEMENTS_RESEAU } from '../topo/reseau.js';
import { MATERIAUX } from './reseaux.js';
import { DIAMETRES_LISTE, GAINES_LISTE, NOMBRES_LISTE } from '../topo/chantier.js';
import { svgCoupeDirecte, controlesEchelleCoupe } from './coupe-directe.js';
import { svgCoupeTalus } from './coupe-talus.js';
import { svgCroquisTalus } from './croquis-talus.js';
import { penteSignee } from '../topo/talus.js';
import { MODES_ACCROCHE, CIBLES, cibleSelonDistance, ecartsGuidage, couleurCanne } from '../topo/accroche.js';
// Couloir de l'implantation d'une ligne : bandes de chaque côté, plus fines en s'approchant
// (loin : 10, 5, 2, 1 m, puis les mêmes que les cercles de la cible).
const BANDES_COULOIR = [[10, 5, 2, 1], ...CIBLES.map((c) => c.cercles)];
import { symboleDeForme } from '../plan/formes.js';
import { COULEURS_HABITUELLES } from './libelles.js';
import { htmlRegleHauteur } from './regle-hauteur.js';
import { ouvrirFenetrePointTape, ouvrirListePoints } from './fenetres-points.js';

// Mode Contrôler : ce qu'on implante (point, ligne, talus, surface), vue des coupes, longueurs.
const IMPLANTATIONS = [
  ['point', 'Point', true],
  ['ligne', 'Ligne', true],
  ['surface', 'Surface', true],
  ['altitude', 'Altitude', true], // 0.106 : on tape l'altitude voulue, monter / descendre (tous les modes)
  ['talus', 'Talus', true], // tout à droite (demande du 26.10.2026)
];
// Talus : Expert seulement. Base : on ne lève que des « Levé libre » (points seulement).
const IMPLANTATIONS_EXPERT = ['talus'];
const NATURES_BASE = ['autres'];
// 0.144.0 (liste du 05.11, point 5) : une seule coupe à la fois (plus de « Les 2 »).
// 0.189.3 (maquette A du 10.11) : symbole dans chaque bouton : flèche grise = ma direction, trait = la coupe, de la couleur
// qu'elle a sur le plan (perpendiculaire violet, dans l'axe rose).
const FLECHE_MARCHE = '<path d="M20 34V8M13 15l7-8 7 8" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
const symboleCoupe = (trait, couleur) => `<svg class="symbole-coupe" viewBox="0 0 40 40" aria-hidden="true">${FLECHE_MARCHE}<path d="${trait}" stroke="${couleur}" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`;
const VUES_COUPES = [
  ['perpendiculaire', `${symboleCoupe('M5 22H35', '#7c3aed')}<span>Perpendiculaire</span>`],
  ['axe', `${symboleCoupe('M20 4V36', '#db2777')}<span>Dans l\'axe</span>`],
];
// 0.190.0 : demi-longueurs (m de chaque côté) : coupes de 5, 10, 20 ou 40 m de large ; échelles de hauteur ×1 à ×3.
export const LONGUEURS_COUPE = [2.5, 5, 10, 20];
export const EXAGERATIONS_COUPE = [1, 1.5, 2, 3];
// Ce que l'on lève : une surface (même choix que « + Nouvelle surface » dans Calculs › Surfaces)
// ou un métré (aires, longueurs, points comptés : des mesures de Calculs › Mesures / métrés).
const NATURES_TERRAIN = [
  ['stock', 'Stock'],
  ['terrain', 'Terrain'], // terrain naturel et terrassement fusionnés (0.87.0)
  ['terrassement', 'Terrassement'], // 0.168.0 : de nouveau proposé (demande du 09.11)
  // Recollement de réseaux (0.101.0, voir topo/reseau.js) : un levé par réseau (EU, EC…).
  ['reseau', 'Recollement'],
  // Ancien recollement (comme Terrain) : plus proposé, les levés déjà faits restent.
  ['recollement', 'Recollement (ancien)'],
  ['metre', 'Métré'],
  ['chantier', 'Levé chantier'], // 0.175.0 : éléments en cours de chantier (Intermédiaire)
  ['autres', 'Levé libre'],
  // Surface d'un dessin (Calculs › Dessin) : pas créée ici, mais on la complète au RX2.
  ['surface', 'Surface'],
];
// Petit texte sous chaque choix de « Que lèves-tu ? » (0.168.0).
const DETAIL_NATURE = {
  stock: 'Lever de stock',
  terrain: 'Lever de terrain naturel',
  terrassement: 'Lever terrassement en cours / fini',
  chantier: 'Éléments en cours de chantier',
  autres: 'Autres',
};
// Accroches : un dessin (en gris ce qu'on touche, en ambre l'endroit accroché) et un mot dessous.
// [mot, nom complet (bulle, lecture d'écran), dessin].
export const ACCROCHES = {
  // Implantation d'une ligne : la ligne entière du plan DXF (polyligne).
  trait: ['Ligne', 'Ligne entière : DXF, ligne de rupture ou contour d\'un levé, côté de dessin', '<path class="repere-trait" d="M3 18 9 8l6 6 6-9" /><circle cx="3" cy="18" r="1.6" /><circle cx="21" cy="5" r="1.6" />'],
  // Point du projet : le même rond gris que les points du plan, entouré d'ambre (accroché).
  point: ['Point', 'Point du projet (levé ou importé)', '<circle class="anneau-accroche" cx="12" cy="12" r="8" /><circle class="rond-point" cx="12" cy="12" r="4.5" />'],
  sommet: ['Sommet', 'Sommet d\'une ligne du plan DXF', '<path d="M3 20 12 6l9 14" /><rect class="repere" x="9" y="3" width="6" height="6" />'],
  milieu: ['Milieu', 'Milieu d\'un segment du plan DXF', '<path d="M2 17h20" /><circle cx="2.5" cy="17" r="1.5" /><circle cx="21.5" cy="17" r="1.5" /><path class="repere" d="M12 8l5 9H7z" />'],
  // 0.161.0 : la ligne, le point touché à côté (petit rond) et le point le plus proche sur la ligne (pas au milieu).
  ligne: ['Sur ligne', 'Sur une ligne du plan DXF (endroit le plus proche)', '<path d="M3 20 21 4" /><circle cx="6" cy="8" r="1.4" /><path d="M6.6 9.3 9.4 14.2" stroke-dasharray="1.6 1.6" /><circle class="repere" cx="10.2" cy="13.6" r="2.6" />'],
  croisement: ['Croisem.', 'Croisement de 2 lignes (sans altitude)', '<path d="M4 4 20 20M20 4 4 20" /><circle class="repere" cx="12" cy="12" r="3" />'],
  centre: ['Centre', 'Centre d\'un cercle du plan DXF', '<circle cx="12" cy="12" r="9" /><circle class="repere" cx="12" cy="12" r="2.5" />'],
  // 0.131.0 : « Manuel » (Intermédiaire, implantation d'un point) : loupe + main, point visé sans accroche.
  manuel: ['Manuel', 'Manuel : loupe et main, le centre de la croix est le point visé', '<path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v2" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path class="repere" d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />'],
};
// Guidage vers le point : par rapport au cap du RX2 (avance / droite) ou nord / sud / est / ouest.
const GUIDAGES = [
  ['rx2', 'Cap GNSS'],
  ['nseo', 'N-S-E-O'],
];
const TITRES_COUPES = {
  perpendiculaire: { titre: 'Coupe perpendiculaire', gauche: '← gauche', droite: 'droite →' },
  axe: { titre: 'Coupe dans l\'axe', gauche: '← derrière', droite: 'devant →' },
};

// Petit dessin de chaque rôle, comme dans Calculs › Surfaces (contour rouge, ligne orange, point
// vert) ; ceux du métré en cyan, la couleur des mesures.
const ICONES = {
  contour: '<path d="M4 8 11 3l9 5-2 11-13 1z" />',
  ligne: '<path d="M3 18l6-7 4 4 8-9" />',
  isole: '<circle cx="12" cy="12" r="4" />',
  aire: '<path d="M4 6h16v12H4z" /><path d="M4 12h16M12 6v12" stroke-width="1" />',
  longueur: '<path d="M3 16 21 8" /><path d="M3 13v6M21 5v6" />',
  compte: '<circle cx="12" cy="12" r="8" /><path d="M10 9l2-1.5V16" />',
};
// Appareil photo (photo du levé, à gauche de PRENDRE LE POINT).
const ICONE_PHOTO = '<path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />';
// Lettre des noms de points d'un métré (A-ENR-1-1, L-BOR-1-1).
const LETTRES_METRE = { aire: 'A', longueur: 'L' };

/**
 * Crée l'écran dans "conteneur". Les actions sont faites par main.js via "actions" :
 * ouvrirRecepteur() (fenêtre du récepteur, voir recepteur.js), nouvelleSurface(nature), choisirStock(id), choisirRole(role), nouvelleLigne(), basculerFermeture(), prendrePoint(nom),
 * annulerDernierPoint(), choisirLibelle(abréviation),
 * choisirMode(mode), choisirSurfaceControle(id), choisirVueCoupes(vue),
 * choisirLongueurCoupe(m), choisirExagerationCoupe(facteur), choisirSourceOrientation(source),
 * choisirImplantation(quoi), choisirAccroche(mode), trouverPoint(nom), choisirGuidage('rx2' ou 'nseo'),
 * implanterChoix({ nom, altitude }),
 * creerPointAImplanter({ nom, altitude }), implanterPoint(id), supprimerPointAImplanter(id),
 * arreterImplantation(), oublierChoix(), enregistrerImplantation(),
 * ligne : retirerDernierPointLigne(), implanterPointsLigne(), changerLigne(), choisirSegment('tout',
 * 'segment', 'precedent' ou 'suivant'), inverserLigne(), reglerLigne('decalage', 'debut' ou 'fin', texte)
 * Renvoie { afficher(donnees), prendreDepuisTouche(), enregistrerDepuisTouche(), mettreAJourRecepteur(etat, direct),
 * mettreAJourBoussole(cap) }.
 */
export function creerEcranLeve(conteneur, actions) {
  let etat = null; // dernier état du récepteur (voir src/android/pont.js)
  let donnees = null;
  let choixNatureOuvert = false; // « + Nouvelle » touché : on choisit stock, terrain naturel ou terrassement
  let direct = null; // orientation et contrôle calculés par main.js à chaque état du récepteur
  let cibleAffichee = 0; // cible montrée près du point à implanter (0 : aucune, voir CIBLES)
  let planEnGrandDemande = false; // 0.151.0 : encart du plan touché, le plan reprend sa place
  let bandeCouloir = 0; // échelle du couloir de la ligne (n° dans BANDES_COULOIR)
  let capBoussole = null; // dernier cap de la boussole de la tablette (°), ou null
  let reglagesGuidageOuverts = false; // roue ⚙ de l'écran de guidage
  let reglagesCoupesOuverts = false; // roue ⚙ des coupes d'Implanter › Surface (0.144.0)
  const elementsOuverts = new Set(); // lignes du levé dépliées en bas de Lever ('contour', 'ligne-2', 'isoles')
  let accrochesChoisies = false; // flèche de la barre d'accroche : les noms sous les dessins
  // 0.167.0 : en Base les noms des accroches restent affichés, sans flèche pour les replier.
  const accrochesOuvertes = () => estModeBase() || accrochesChoisies;
  let gestionControleOuverte = false; // mode Contrôler : roue ⚙ (après le code de sécurité)
  let erreurGestion = ''; // mode Contrôler : erreur de la gestion (tolérances, fichier, point tapé)
  let reglagesLameOuverts = false; // mode Lame : roue ⚙ (tolérances)
  let machineChoisie = false; // 0.153.0 : Guidage : machine choisie (sinon l'écran de choix est montré)
  let choixReseauOuvert = false; // « Recollement » touché : on choisit le réseau (EU, EC…)
  // Recollement : ce qui est tapé à côté du point, gardé quand l'écran se redessine (la fouille et la
  // remarque repartent vides après chaque point ; diamètre et matériau sont gardés par main.js).
  const saisieReseau = { diametre: null, materiau: null, profondeurFouille: '', remarque: '' };

  // Lignes du levé dépliées : gardées d'un dessin de l'écran à l'autre.
  conteneur.addEventListener('toggle', (evenement) => {
    const cle = evenement.target.dataset?.element;
    if (!cle) return;
    if (evenement.target.open) elementsOuverts.add(cle);
    else elementsOuverts.delete(cle);
  }, true);

  conteneur.addEventListener('click', (evenement) => {
    const fleche = evenement.target.closest('[data-fleche]');
    if (fleche) {
      const defile = conteneur.querySelector(`[data-defile="${fleche.dataset.fleche}"]`);
      defile?.scrollBy({ left: defile.clientWidth * 0.7, behavior: 'smooth' });
      return;
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action } = bouton.dataset;
    if (action === 'ouvrirChoixNature' || action === 'fermerChoixNature') {
      choixNatureOuvert = action === 'ouvrirChoixNature';
      choixReseauOuvert = action === 'ouvrirChoixNature' && bouton.dataset.valeur === 'reseau';
      dessiner();
      return;
    }
    // Recollement : nouvelle conduite depuis l'ouvrage choisi dans la liste à côté.
    if (action === 'nouvelleConduite') {
      actions.nouvelleConduite(conteneur.querySelector('[data-champ="depart-conduite"]')?.value ?? '');
      return;
    }
    // Guidage : « Connecter le 2e GNSS » ouvre la fenêtre du récepteur (Récepteur 2 dedans).
    if (action === 'ouvrirRecepteur') {
      document.dispatchEvent(new CustomEvent('ouvrir-recepteur'));
      return;
    }
    // Guidage (0.153.0) : la machine choisie, on passe au guidage ; ← revient au choix.
    if (action === 'choisirMachine') {
      machineChoisie = true;
      actions.choisirMachine(bouton.dataset.valeur);
      return;
    }
    if (action === 'retourChoixMachine') {
      machineChoisie = false;
      reglagesLameOuverts = false;
      dessiner();
      return;
    }
    // Mode Lame : roue ⚙ des tolérances.
    if (action === 'reglagesLame') {
      reglagesLameOuverts = !reglagesLameOuverts;
      dessiner();
      return;
    }
    // En-tête du levé en cours : renommer (crayon), en reprendre un autre (« Changer »).
    if (action === 'renommerLevee') {
      demanderTexte({ titre: 'Nom du levé', valeur: donnees.stock.nom, prefixe: prefixeDuNom(donnees.stock) }).then((nom) => {
        if (nom) actions.renommerLevee(donnees.stock.id, nom);
      });
      return;
    }
    if (action === 'changerLevee') {
      // Croix rouge (supprimer le levé et ses points) seulement en mode Expert.
      ouvrirChoixLevees({
        levees: donnees.stocks,
        actuel: donnees.stock.id,
        titres: Object.fromEntries(NATURES_TERRAIN),
        supprimable: aAcces('expert'),
        choisir: (id) => id !== donnees.stock.id && actions.choisirStock(id),
        supprimer: (id) => actions.supprimerLevee(id),
      });
      return;
    }
    // Barre d'accroche : « + Point » (point tapé), « Liste » (points du projet), flèche (noms).
    if (action === 'ouvrirFormulairePoint') {
      ouvrirFenetrePointTape({ nomPropose: donnees.implanter.nomPointAjoute, ajouter: (valeurs) => actions.ajouterPointTape(valeurs) });
      return;
    }
    if (action === 'ouvrirListePoints') {
      ouvrirListePoints({ groupes: actions.groupesPoints(), choisir: (nom) => actions.trouverPoint(nom) });
      return;
    }
    if (action === 'basculerAccroches') {
      accrochesChoisies = !accrochesChoisies;
      dessiner();
      return;
    }
    if (action === 'garderPointChoisi') {
      actions.garderPointChoisi(conteneur.querySelector('[data-champ="nom-implantation"]')?.value ?? (donnees.implanter.choix?.nom || ''));
      return;
    }
    if (action === 'basculerReglagesCoupes') {
      reglagesCoupesOuverts = !reglagesCoupesOuverts;
      dessiner();
      return;
    }
    if (action === 'basculerReglagesGuidage') {
      reglagesGuidageOuverts = !reglagesGuidageOuverts;
      dessiner();
      return;
    }
    if (action === 'lignesDepuisSuites') {
      ouvrirFenetreSuites({ suites: donnees.suites, stock: donnees.stock?.nature === 'stock' && (donnees.elements?.contour?.noms.length ?? 0) === 0, creer: (choisies, role) => actions.creerLignesDepuisSuites(choisies, role) });
      return;
    }
    // --- Mode Contrôler ---
    if (action === 'basculerGestionControle') {
      basculerGestionControle();
      return;
    }
    if (action === 'enregistrerTolerances') {
      const textes = Object.fromEntries([...conteneur.querySelectorAll('[data-tolerance]')].map((champ) => [champ.dataset.tolerance, champ.value]));
      montrerErreurGestion(actions.enregistrerTolerances(textes)?.erreur);
      return;
    }
    if (action === 'choisirPointControle') {
      ouvrirListePoints({ groupes: actions.groupesPoints(), choisir: (nom) => montrerErreurGestion(actions.ajouterPointControle(nom)?.erreur) });
      return;
    }
    if (action === 'taperPointControle') {
      ouvrirFenetrePointTape({ nomPropose: '', ajouter: (valeurs) => actions.ajouterPointControleTape(valeurs) });
      return;
    }
    // Nouveau levé (0.90.0) : la fenêtre du nom s'ouvre tout de suite (sinon tous s'appellent pareil).
    if (action === 'nouvelleSurface' && bouton.dataset.valeur === 'reseau') {
      choixReseauOuvert = true;
      dessiner();
      return;
    }
    if (action === 'nouvelleSurface') {
      choixNatureOuvert = false;
      choixReseauOuvert = false;
      actions.nouvelleSurface(bouton.dataset.valeur);
      const levee = donnees.stock;
      if (!levee) return;
      demanderTexte({ titre: 'Nom du nouveau levé', valeur: avecPrefixe(dateDuJourCollee(), prefixeDuNom(levee)), prefixe: prefixeDuNom(levee) }).then((nom) => {
        if (nom && nom !== levee.nom) actions.renommerLevee(levee.id, nom);
      });
      return;
    }
    if (action === 'implanterChoix' || action === 'creerPointAImplanter') {
      const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`)?.value;
      // Pendant le guidage (0.114.0) : le nom de la cible et l'altitude du champ H.
      actions[action]({ nom: champ('nom-implantation') ?? cibleGuidee()?.nom ?? '', altitude: champ('altitude-implantation') ?? champ('altitude-cible') ?? '' });
      return;
    }
    if (action === 'trouverPoint') {
      actions.trouverPoint(conteneur.querySelector('[data-champ="nom-a-trouver"]')?.value ?? '');
      return;
    }
    if (action === 'choisirSegment') {
      actions.choisirSegment(bouton.dataset.valeur);
      return;
    }
    if (action === 'reglerTalus') {
      actions.reglerTalus(bouton.dataset.champTalus, bouton.dataset.valeur);
      return;
    }
    // (voir plus bas : flèches › des rangées du Chantier)
    if (action === 'reglerChantier') {
      actions.reglerChantier(bouton.dataset.champChantier, bouton.dataset.valeur);
      return;
    }
    if (action === 'reglerDelta') {
      actions.reglerDelta(bouton.dataset.champDelta, bouton.dataset.valeur);
      return;
    }
    if (action === 'prendre') actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '', attributsReseau());
    else if (action === 'role') actions.choisirRole(bouton.dataset.role);
    else actions[action]?.(bouton.dataset.valeur);
  });

  // Recollement : ce qui est tapé à côté du point est gardé à chaque frappe.
  conteneur.addEventListener('input', (evenement) => {
    const champ = evenement.target.dataset?.attributReseau;
    if (champ) saisieReseau[champ] = evenement.target.value;
    // Delta (0.139.0) : gardé à chaque frappe, sans redessiner (Enreg. Pts reste touchable tout de suite).
    const champChantier = evenement.target.dataset?.chantier;
    if (champChantier) actions.reglerChantier(champChantier, evenement.target.value, false);
    const delta = evenement.target.dataset?.delta;
    if (delta) {
      actions.reglerDelta(delta, evenement.target.value, false);
      const cadre = conteneur.querySelector('.ligne-delta');
      const valeurs = [...conteneur.querySelectorAll('[data-delta]')].map((c) => Number(c.value.replace(',', '.')));
      cadre?.classList.toggle('actif', valeurs.some((v) => Number.isFinite(v) && v !== 0));
    }
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.attributReseau) saisieReseau[cible.dataset.attributReseau] = cible.value;
    else if (cible.dataset.ouvrageChamp) actions.reglerOuvrage(cible.dataset.id, cible.dataset.ouvrageChamp, cible.value);
    else if (cible.dataset.champ === 'altitude-voulue') actions.reglerAltitudeVoulue(cible.value);
    else if (cible.dataset.champ === 'altitude-cible') actions.reglerAltitudeCible(cible.value);
    else if (cible.dataset.champ === 'surface-controle') actions.choisirSurfaceControle(cible.value);
    else if (cible.dataset.champ === 'surface-lame') actions.choisirSurfaceLame(cible.value);
    else if (cible.dataset.toleranceLame) actions.reglerToleranceLame(cible.dataset.toleranceLame, cible.value);
    else if (cible.dataset.outil) actions.reglerOutil(cible.dataset.outil, cible.value);
    else if (cible.dataset.margeLame) actions.reglerMargeLame(cible.dataset.margeLame, cible.value);
    else if (cible.dataset.champ === 'delta-surface') actions.reglerDeltaSurface(cible.value);
    else if (cible.dataset.reglageLigne) actions.reglerLigne(cible.dataset.reglageLigne, cible.value);
    else if (cible.dataset.reglageTalus) actions.reglerTalus(cible.dataset.reglageTalus, cible.value);
    else if (cible.dataset.champ === 'remarque-controle') actions.remarqueControle(cible.dataset.id, cible.value);
    else if (cible.dataset.champ === 'photo-controle' && cible.files?.length) {
      // Photo d'un point de contrôle (0.105.0) : rangée dans le projet, rattachée au point.
      actions.ajouterPhotoControle(cible.dataset.id, [...cible.files]);
      cible.value = '';
    } else if (cible.dataset.champ === 'photo-levee-globale' && cible.files?.length) {
      // Photo de tout le levé (0.140.0, Intermédiaire) : pas rattachée à un point.
      actions.ajouterPhotosLeveeGlobale([...cible.files]);
      cible.value = '';
    } else if (cible.dataset.champ === 'photo-levee' && cible.files?.length) {
      // Photo du levé (0.77.0) : appareil photo de la tablette, rangée avec le levé en cours.
      actions.ajouterPhotosLevee([...cible.files]);
      cible.value = '';
    } else if (cible.dataset.champ === 'legende-photo-levee') actions.legendePhotoLevee(cible.dataset.id, cible.value.trim());
    else if (cible.dataset.champ === 'fichier-controle' && cible.files?.[0]) {
      actions.importerPointsControle(cible.files[0]).then((reponse) => montrerErreurGestion(reponse?.erreur));
    }
  });

  /** Roue ⚙ du mode Contrôler : l'ouvrir demande le code de sécurité (à chaque fois). */
  async function basculerGestionControle() {
    if (!gestionControleOuverte && !(await demanderCode('Points de contrôle et tolérances'))) return;
    gestionControleOuverte = !gestionControleOuverte;
    erreurGestion = '';
    dessiner();
  }

  /** Erreur de la gestion des contrôles (ou rien) : écrite sous la gestion. */
  function montrerErreurGestion(erreur) {
    erreurGestion = erreur ?? '';
    dessiner();
  }

  /** Point vers lequel on guide : le point à implanter, ou le point de contrôle (mode Contrôler). */
  function cibleGuidee() {
    return donnees?.mode === 'autocontrole' ? donnees.autocontrole.cible : donnees?.implanter.cible;
  }

  // Nom d'un point du projet choisi dans la liste proposée (pas tapé lettre par lettre, ni validé
  // par Entrée, traité plus bas) : on le cherche tout de suite.
  conteneur.addEventListener('input', (evenement) => {
    const cible = evenement.target;
    const choisiDansLaListe = !evenement.inputType || evenement.inputType === 'insertReplacementText';
    if (cible.dataset.champ === 'nom-a-trouver' && choisiDansLaListe && donnees?.implanter.nomsPoints.includes(cible.value.trim())) actions.trouverPoint(cible.value);
  });

  // Touche Entrée dans le nom : prend le point (comme le bouton), si c'est permis ; dans le nom
  // d'un point à implanter : le cherche.
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.dataset.champ === 'nom-a-trouver') {
      evenement.preventDefault();
      actions.trouverPoint(evenement.target.value);
      return;
    }
    if (evenement.key !== 'Enter' || evenement.target.dataset.champ !== 'nom-point') return;
    evenement.preventDefault();
    const bouton = conteneur.querySelector('[data-action="prendre"]');
    if (bouton && !bouton.disabled) actions.prendrePoint(evenement.target.value);
  });

  /** Partie « récepteur » : connexion, position, bouton. Mise à jour sans redessiner l'écran. */
  function rafraichirVivant() {
    const connecte = Boolean(etat?.connecte);
    for (const element of conteneur.querySelectorAll('[data-si-connecte]')) element.hidden = !connecte;
    for (const element of conteneur.querySelectorAll('[data-si-deconnecte]')) element.hidden = connecte;

    const position = conteneur.querySelector('[data-vivant="position"]');
    if (position) {
      const p = connecte && etat.recu ? etat.position : null;
      position.classList.toggle('pas-prete', !etat?.inclinaisonPrete);
      position.innerHTML = p
        ? `<span>E <strong>${formaterNombre(p.est)}</strong></span><span>N <strong>${formaterNombre(p.nord)}</strong></span><span>H <strong>${formaterNombre(p.altitude)}</strong></span>`
        : `<span class="aide">${connecte ? (etat.erreurConversion ? echapper(etat.erreurConversion) : 'En attente de la position…') : 'Récepteur non connecté'}</span>`;
    }

    const bouton = conteneur.querySelector('[data-action="prendre"]');
    const raison = conteneur.querySelector('[data-vivant="raison"]');
    const implantation = donnees?.mode === 'controler';
    const aImplanter = ['ligne', 'talus'].includes(donnees?.controle.implantation) ? donnees.implanter.ligne : donnees?.implanter.cible;
    const permis = connecte && Boolean(etat?.autorise) && Boolean(implantation ? aImplanter : donnees?.stock);
    if (bouton) bouton.disabled = !permis;
    if (raison) {
      raison.textContent = permis || !connecte ? '' : etat?.raison ?? '';
      raison.hidden = permis || !connecte;
    }

    // Orientation : valeurs brutes, pour contrôler le cap du RX2 sur le terrain.
    const orientation = conteneur.querySelector('[data-vivant="orientation"]');
    if (orientation) {
      const o = direct?.orientation;
      const degres = (valeur) => (valeur == null ? '—' : `${Math.round(valeur)}°`);
      orientation.textContent = `cap GNSS ${degres(o?.cap)} · marche ${degres(o?.marche)}`;
    }
    if (donnees?.mode === 'autocontrole') rafraichirImplantation();
    else if (donnees?.mode === 'controler' && donnees.controle.implantation === 'point') rafraichirImplantation();
    else if (donnees?.mode === 'controler' && donnees.controle.implantation === 'ligne') rafraichirLigne();
    else if (donnees?.mode === 'controler' && donnees.controle.implantation === 'talus') rafraichirTalus();
    else if (donnees?.mode === 'controler') rafraichirControle();
  }

  /**
   * Implantation d'un point : guidage vers le point et bouton « Enregistrer l'implantation ».
   * Loin (2 m ou plus) : une flèche et les écarts ; plus près : une cible dont le centre est le
   * point, de plus en plus précise (2 m, puis 1 m, puis 20 cm).
   */
  function rafraichirImplantation() {
    const g = direct?.implantation;
    const bouton = conteneur.querySelector('[data-action="enregistrerImplantation"]');
    if (bouton) bouton.disabled = !(etat?.connecte && etat?.autorise && cibleGuidee());
    const zone = conteneur.querySelector('[data-vivant="guidage"]');
    const haut = conteneur.querySelector('[data-vivant="cible-haut"]');
    if (!zone) return;
    if (!g || g.message) {
      cibleAffichee = 0;
      montrerCibleEnHaut(haut, null);
      zone.className = 'guidage-direct attente';
      zone.innerHTML = `<span class="message-ecart">${echapper(g?.message ?? 'En attente de la position…')}</span>`;
      return;
    }
    const { distance, direction, azimut } = g.guidage;
    const { haut: avance, droite, nordEnHaut } = ecartsGuidage(g.guidage, donnees.controle.guidage);
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    // Toujours « avance / recule », « droite / gauche » ; en N-S-E-O (nord devant), avec le point cardinal.
    const lignes = nordEnHaut
      ? [`${avance >= 0 ? '↑ Avance (Nord)' : '↓ Recule (Sud)'} ${m(avance)}`, `${droite >= 0 ? '→ Droite (Est)' : '← Gauche (Ouest)'} ${m(droite)}`]
      : [`${avance >= 0 ? '↑ Avance' : '↓ Recule'} ${m(avance)}`, `${droite >= 0 ? '→ Droite' : '← Gauche'} ${m(droite)}`];
    const hauteur = texteHauteur(g);
    cibleAffichee = cibleSelonDistance(distance, cibleAffichee);
    // Flèche vers le point : par rapport à la direction regardée, sinon par rapport au nord.
    const angle = nordEnHaut ? direction : direction - azimut;
    // Près du point (moins de 2 m) : la cible remplace le plan en haut de l'écran (téléphone), le
    // nord toujours marqué dessus ; loin : le plan en haut, la flèche avec les textes.
    const nord = nordEnHaut ? 0 : -azimut;
    montrerCibleEnHaut(haut, cibleAffichee > 0 ? { svg: svgCible(cibleAffichee, avance, droite, couleurCanne(distance), nordEnHaut, nord), classe: g.classe } : null);
    // 0.90.1 : la flèche reste aussi près du point (avec la cible en haut). À gauche avance / droite,
    // au milieu la flèche, à droite monter / descendre en grand.
    const dessin = `<svg class="fleche-guidage" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -17 11 6 0 0 -11 6Z" transform="rotate(${angle.toFixed(1)})" /></svg>`;
    zone.className = `guidage-direct guidage-3 ${g.classe}`;
    zone.innerHTML = `
      <span class="cote-plan">
        <span class="lignes-guidage">${lignes.map((texte) => `<span>${texte}</span>`).join('')}</span>
        <span class="distance-guidage">${formaterNombre(distance)} m${nordEnHaut ? ' · nord en haut' : ''}</span>
      </span>
      ${dessin}
      <span class="cote-hauteur">${hauteur}</span>`;
  }

  /** Monter / descendre (0.90.1) : sur deux lignes, en grand, à droite du guidage ; rien sans altitude. */
  function texteHauteur(g) {
    if (g.ecartAltitude == null) return '<span class="hauteur-guidage sans-altitude">pas d\'altitude</span>';
    return `<span class="hauteur-guidage ${g.classeAltitude}"><span>${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'}</span><strong>${formaterNombre(Math.abs(g.ecartAltitude))} m</strong></span>`;
  }

  /**
   * Cible en haut de l'écran (à la place du plan, voir style.css « cible-en-haut »), ou rien.
   * cible : { svg, classe (couleur de la distance) } ou null.
   */
  function montrerCibleEnHaut(zone, cibleDemandee) {
    // 0.151.0 : encart du plan touché = plan en grand (la cible revient avec « ◎ Cible », ou
    // d'office quand on repasse au-delà de 2 m / qu'on change de point).
    if (!cibleDemandee) planEnGrandDemande = false;
    document.body.classList.toggle('cible-masquee', Boolean(zone && cibleDemandee && planEnGrandDemande));
    const cible = planEnGrandDemande ? null : cibleDemandee;
    const avant = document.body.classList.contains('cible-en-haut');
    document.body.classList.toggle('cible-en-haut', Boolean(zone && cible));
    // 0.138.0 : le plan devient (ou n'est plus) un encart en haut à droite : main.js le recadre.
    if (avant !== document.body.classList.contains('cible-en-haut')) document.dispatchEvent(new CustomEvent('cible-en-haut'));
    if (!zone) return;
    zone.hidden = !cible;
    if (!cible) {
      zone.innerHTML = '';
      return;
    }
    zone.className = `cible-haut ${cible.classe}`;
    zone.innerHTML = cible.svg;
  }

  /** Mode Contrôler : écart monter / descendre et coupes en direct. */
  function rafraichirControle() {
    const zone = conteneur.querySelector('[data-vivant="ecart"]');
    const c = direct?.controle;
    if (zone) {
      if (!c || c.ecart == null) {
        zone.className = 'ecart-direct attente';
        zone.innerHTML = `<span class="message-ecart">${echapper(c?.message ?? (donnees.controle.implantation === 'altitude' ? 'Tape l\'altitude voulue' : 'Choisis une surface'))}</span>`;
      } else {
        const monter = c.ecart >= 0;
        zone.className = `ecart-direct ${c.classe}`;
        zone.innerHTML = `<span class="fleche-ecart">${monter ? '↑' : '↓'}</span>
          <span class="valeur-ecart">${monter ? 'Monter' : 'Descendre'} ${formaterNombre(Math.abs(c.ecart))} m</span>
          <span class="detail-ecart">${donnees.controle.implantation === 'altitude' ? 'voulue' : 'surface'} ${formaterNombre(c.altitudeSurface)} · canne ${formaterNombre(c.altitudeCanne)}</span>`;
      }
    }
    const regle = conteneur.querySelector('[data-vivant="regle"]');
    if (regle) regle.innerHTML = htmlRegleHauteur(c?.ecart ?? null);
    for (const sens of ['perpendiculaire', 'axe']) {
      const cadre = conteneur.querySelector(`[data-vivant="coupe-${sens}"]`);
      if (!cadre) continue;
      const coupe = c?.coupes?.[sens];
      cadre.innerHTML = coupe
        ? svgCoupeDirecte({ ...TITRES_COUPES[sens], ...coupe, classe: c.classe, sens, exageration: donnees.controle.exagerationCoupe, grille: aAcces('expert') })
        : `<p class="aide">${TITRES_COUPES[sens].titre} : ${c?.messageCoupes ?? 'en attente de la position'}</p>`;
    }
  }

  /** Petits boutons au choix (un seul actif). */
  function boutonsChoix(action, choix, actif) {
    return choix
      .map(([cle, titre, permis = true]) => `<button type="button" class="puce-choix ${String(cle) === String(actif) ? 'actif' : ''}" data-action="${action}" data-valeur="${cle}" ${permis ? '' : 'disabled title="bientôt"'}>${titre}</button>`)
      .join('');
  }

  /** Bandeau Point / Ligne / Surface… (0.123.0 : gardé aussi pendant le guidage, plus besoin de revenir en arrière). */
  function bandeauImplantation() {
    return `<div class="choix-implantation-type" role="group" aria-label="Implanter">${boutonsChoix('choisirImplantation', IMPLANTATIONS.filter(([cle]) => aAcces('expert') || !IMPLANTATIONS_EXPERT.includes(cle)), donnees.controle.implantation)} ${bulle('implanter')}</div>`;
  }

  /** Mode Contrôler : quoi implanter, surface, écart en grand, coupes et leurs réglages. */
  function controle() {
    const { controle: reglages, surfaces } = donnees;
    // Coupes directes : en Base, dans l'axe seulement (perpendiculaire, longueur et hauteurs dès Intermédiaire).
    const vue = estModeBase() ? 'axe' : (reglages.vueCoupes === 'axe' ? 'axe' : 'perpendiculaire');
    const choixImplantation = bandeauImplantation();
    // Rien de choisi : on le rappelle bien en vue (après « ← », on ne savait plus quoi faire).
    const imp = donnees.implanter;
    if (reglages.implantation === 'point') {
      const invite = imp.choix ? '' : invitation('Touche un point sur le plan');
      return choixImplantation + barreAccroche() + invite + implanterPoint();
    }
    if (reglages.implantation === 'ligne') {
      const invite = imp.pointsLigne.length > 0 || imp.ligneAValider ? '' : invitation('Touche une ligne sur le plan');
      return choixImplantation + barreAccroche() + invite + implanterLigne();
    }
    if (reglages.implantation === 'talus') {
      const invite = imp.pointsLigne.length > 0 || imp.ligneAValider ? '' : invitation('Touche la ligne du talus sur le plan');
      return choixImplantation + barreAccroche() + invite + implanterLigne() + mesTalus() + talusDesSurfaces();
    }
    if (reglages.implantation === 'altitude') {
      return `${choixImplantation}
        <div class="ligne-altitude-voulue">
          <label class="champ-altitude-voulue">Altitude voulue<input type="text" inputmode="decimal" data-champ="altitude-voulue" value="${reglages.altitudeVoulue != null ? Number(reglages.altitudeVoulue).toFixed(3) : ''}" placeholder="ex. 412.350" /></label>
          <button type="button" class="bouton-secondaire bouton-altitude-ici" data-action="prendreAltitudeIci">📍 Altitude ici</button>
        </div>
        ${ecartEtRegle()}`;
    }
    return `
      ${choixImplantation}
      ${surfaces.length > 0
        ? `<select data-champ="surface-controle" aria-label="Surface à contrôler">
            ${surfaces.some((s) => s.id === reglages.surfaceId) ? '' : '<option value="" selected>— choisir une surface —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === reglages.surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucune surface.</p>'}
      ${ecartEtRegle()}
      <div class="ligne-choix choix-coupe seulement-intermediaire">${boutonsChoix('choisirVueCoupes', VUES_COUPES, vue)}
        <button type="button" class="bouton-roue ${reglagesCoupesOuverts ? 'actif' : ''}" data-action="basculerReglagesCoupes" aria-label="Réglages des coupes" aria-expanded="${reglagesCoupesOuverts}">⚙</button></div>
      ${reglagesCoupesOuverts ? champDeltaSurface(donnees.deltaSurface) : ''}
      <div class="coupes-directes vue-${vue}">
        <div class="zone-coupe">
          <div data-vivant="coupe-${vue}"></div>
          ${controlesEchelleCoupe(`${String(2 * reglages.demiLongueur).replace('.', ',')} m`, reglages.exagerationCoupe, 'changerLargeurCoupe', 'changerHauteurCoupe')}
        </div>
      </div>
      <p class="aide" data-vivant="orientation"></p>`;
  }

  /** Delta Z de la surface (0.152.0, dès Intermédiaire) : champ (m, + = plus haut) et bouton « 0 ». */
  function champDeltaSurface(delta) {
    return `<div class="ligne-choix seulement-intermediaire ligne-delta-surface">
        <label>Δ Z surface <input type="text" inputmode="decimal" data-champ="delta-surface" value="${delta ? Number(delta).toFixed(3) : ''}" placeholder="0.000" /> m</label>
        <button type="button" class="bouton-secondaire" data-action="deltaSurfaceZero" ${delta ? '' : 'disabled'}>0</button>
        <span class="aide">+ plus haut</span>
      </div>`;
  }

  /** Écart monter / descendre en grand, avec la règle de hauteur et le bouton du bip à droite (0.107.0). */
  function ecartEtRegle() {
    return `<div class="ecart-et-regle">
      <div class="ecart-direct attente" data-vivant="ecart"></div>
      ${boutonBip()}
      <div class="colonne-regle"><div data-vivant="regle">${htmlRegleHauteur(null)}</div></div>
    </div>`;
  }

  /** Bouton 🔔 / 🔕 : bip-bip de hauteur marche / arrêt (retenu sur cet appareil). */
  function boutonBip() {
    const actif = donnees.controle.bip !== false;
    return `<button type="button" class="bouton-bip ${actif ? '' : 'coupe'}" data-action="basculerBip" aria-pressed="${actif}" title="${actif ? 'Couper le bip' : 'Remettre le bip'}" aria-label="${actif ? 'Couper le bip' : 'Remettre le bip'}">${actif ? '🔔' : '🔕'}</button>`;
  }

  /** Bandeau sarcelle : ce qu'il faut faire maintenant (flèche vers le plan) ; 0.152.0 : une seule ligne courte. */
  function invitation(titre) {
    return `<div class="invite-choix invite-courte" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6" /></svg>
      <strong>${titre}</strong>
    </div>`;
  }

  /**
   * Barre d'accroche (implantation d'un point), entre le plan et Lever | Implanter : cinq boutons
   * (dessin + mot) pour choisir ce que l'on accroche en touchant le plan, ou le nom d'un point du
   * projet à taper.
   */
  function barreAccroche() {
    const { implanter: imp } = donnees;
    // Ligne : on peut aussi prendre une ligne entière du plan DXF.
    const enLigne = ['ligne', 'talus'].includes(donnees.controle.implantation);
    // « Manuel » (0.131.0) : implantation d'un point seulement, dès Intermédiaire.
    const modes = enLigne ? ['trait', ...MODES_ACCROCHE] : (donnees.controle.implantation === 'point' ? [...MODES_ACCROCHE, 'manuel'] : MODES_ACCROCHE);
    const active = enLigne ? imp.accrocheLigne : imp.accroche;
    // Accroche « Point » : un point tapé (+ Point, pas pour une ligne ; 0.159.0 : Expert) ou choisi dans la liste.
    const outilsPoint = active === 'point'
      ? `<span class="separateur-accroche"></span>
        ${enLigne ? '' : '<button type="button" class="bouton-outil-accroche seulement-expert" data-action="ouvrirFormulairePoint" title="Taper un point (Est, Nord, H)">+ Point</button>'}
        <button type="button" class="bouton-outil-accroche" data-action="ouvrirListePoints" title="Choisir un point dans la liste du projet">Liste</button>
        ${enLigne ? '' : '<button type="button" class="bouton-outil-accroche seulement-expert" data-action="basculerPlusProche" title="Le plus proche : implanter le point du plan le plus proche, la cible suit quand tu te déplaces">⌖ Proche</button>'}`
      : '';
    // « Manuel » (0.151.0) : flèches (1 pixel de la loupe) et zoom ×2 / ×4 / ×8, comme au recalage.
    const outilsManuel = active === 'manuel' && !enLigne
      ? `<div class="reglage-loupe reglage-loupe-implantation">
          <div class="fleches-loupe">
            <span></span><button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="haut" aria-label="Monter la croix">▲</button><span></span>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="gauche" aria-label="Croix à gauche">◀</button>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="bas" aria-label="Descendre la croix">▼</button>
            <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="droite" aria-label="Croix à droite">▶</button>
          </div>
          <div class="zooms-loupe">
            <span>Zoom</span>
            ${[2, 4, 8].map((z) => `<button type="button" class="puce-choix ${imp.zoomLoupe === z ? 'actif' : ''}" data-action="zoomLoupe" data-valeur="${z}">×${z}</button>`).join('')}
          </div>
        </div>`
      : '';
    return `<div class="barre-accroche ${enLigne ? 'accroches-ligne' : ''} ${accrochesOuvertes() ? 'ouverte' : ''}">
      <div class="accroches" role="group" aria-label="Accroche : ce que l'on prend en touchant le plan">
        ${modes.map((mode) => {
          const [mot, nom, dessin] = ACCROCHES[mode];
          return `<button type="button" class="bouton-accroche ${mode === 'manuel' ? 'seulement-intermediaire' : ''} ${active === mode ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${mode}" title="${nom}" aria-label="${nom}" aria-pressed="${active === mode}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg><span class="mot-accroche">${mot}</span></button>`;
        }).join('')}
        ${outilsPoint}
        ${estModeBase() ? '' : `<button type="button" class="bouton-deplier-accroches" data-action="basculerAccroches" title="${accrochesOuvertes() ? 'Cacher' : 'Voir'} les noms" aria-label="${accrochesOuvertes() ? 'Cacher' : 'Voir'} les noms des accroches" aria-expanded="${accrochesOuvertes()}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${accrochesOuvertes() ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" /></svg></button>`}
      </div>
      ${outilsManuel}
    </div>`;
  }

  /**
   * Implantation d'une ligne, avant le guidage : les points de la ligne choisis un à un (ou une
   * ligne du DXF, touchée avec « Ligne DXF »). La ligne choisie s'implante dans l'écran de
   * guidage (vueImplantation).
   */
  function implanterLigne() {
    const { implanter: imp } = donnees;
    const points = imp.pointsLigne;
    const role = (i) => (i === 0 ? `${iconeDrapeau('debut')} Début` : i === points.length - 1 ? `${iconeDrapeau('fin')} Fin` : `${i + 1}`);
    // 0.137.0 : ligne touchée sur le plan : fiche (nom, longueur) et « Implanter » avant le guidage.
    const fiche = imp.ligneAValider && imp.ligne
      ? `<div class="choix-implantation fiche-ligne">
          <p class="coordonnees-choix"><strong>${echapper(imp.ligne.nom)}</strong> <span class="aide">· long. ${formaterNombre(imp.ligne.longueur)} m</span></p>
          <div class="ligne-outils">
            <button type="button" class="bouton bouton-implanter" data-action="implanterLigneChoisie">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>Implanter</button>
            <button type="button" class="bouton-secondaire seulement-intermediaire" data-action="decalerLigneChoisie" title="Créer une copie décalée de cette ligne">Décaler…</button>
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="changerLigne">en toucher une autre</button>
          </div>
        </div>`
      : '';
    if (fiche) return `${fiche}${lienExport()}`;
    return `
      <div class="points-ligne">
        <p class="titre-choix">Points de la ligne</p>
        ${points.length === 0
          ? '<p class="vide">Aucun point.</p>'
          : `<ol>${points.map((p, i) => `<li><strong>${role(i)}</strong> ${p.nom ? echapper(p.nom) : ''} <span class="aide"><span class="coord-en">E ${formaterNombre(p.est)} · N ${formaterNombre(p.nord)} · </span>H ${formaterNombre(p.altitude)}</span></li>`).join('')}</ol>`}
        <div class="ligne-outils">
          <button type="button" class="bouton-secondaire" data-action="implanterPointsLigne" ${points.length < 2 ? 'disabled' : ''}>${donnees.controle.implantation === 'talus' ? 'Talus depuis cette ligne' : 'Implanter cette ligne'}</button>
          ${points.length > 0 ? '<button type="button" class="bouton-lien" data-action="retirerDernierPointLigne">enlever le dernier</button>' : ''}
        </div>
      </div>
      ${lienExport()}`;
  }

  /** « 3 implantation(s) enregistrée(s) », ou rien (l'export est dans Projet › Exporter, 0.92.1). */
  function lienExport() {
    const nombre = donnees.implanter.nbImplantations;
    return nombre > 0 ? `<p class="aide seulement-expert">${nombre} implantation(s) enregistrée(s)</p>` : '';
  }

  /**
   * Implantation d'une ligne, à chaque état du récepteur : couloir (la ligne au milieu, le rond de
   * la canne), « ← Gauche / → Droite », position le long de la ligne et hauteur.
   */
  function rafraichirLigne() {
    const g = direct?.implantationLigne;
    const bouton = conteneur.querySelector('[data-action="enregistrerImplantation"]');
    if (bouton) bouton.disabled = !(etat?.connecte && etat?.autorise && donnees.implanter.ligne);
    const zone = conteneur.querySelector('[data-vivant="guidage-ligne"]');
    if (!zone) return;
    if (!g || g.message) {
      bandeCouloir = 0;
      zone.className = 'guidage-direct attente';
      zone.innerHTML = `<span class="message-ecart">${echapper(g?.message ?? 'En attente de la position…')}</span>`;
      return;
    }
    const { ecart, abscisse, longueur, reste } = g.ligne;
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    bandeCouloir = cibleSelonDistance(Math.abs(ecart), bandeCouloir);
    // 0.118.0 : un bloc coloré (tolérance en plan du Contrôle) avec gauche / droite et le début en
    // grand, la fin en petit ; dessous monter / descendre ; à droite le couloir sur toute la hauteur.
    // La canne est trop à droite (écart > 0) : il faut aller à gauche.
    const surLaLigne = Math.abs(ecart) < 0.0005;
    const sens = surLaLigne
      ? '<span class="libelle-ecart">Sur la ligne</span>'
      : `<span class="libelle-ecart">${iconeFleche(ecart > 0 ? 'gauche' : 'droite')}${ecart > 0 ? 'Gauche' : 'Droite'}</span>`;
    // Position le long : avant le début, après la fin, ou depuis le début (+ la fin en petit).
    // 0.118.1 : dans son propre bloc, coloré selon l'écart au bout le plus proche (tolérance en plan
    // du Contrôle : vert = on est sur le début ou la fin).
    let leLong;
    if (abscisse < 0) leLong = `<div class="ligne-ecart"><span class="libelle-ecart">${iconeDrapeau('debut')}Avant le début</span><strong>${m(abscisse)}</strong></div>`;
    else if (abscisse > longueur) leLong = `<div class="ligne-ecart"><span class="libelle-ecart">${iconeDrapeau('fin')}Après la fin</span><strong>${m(abscisse - longueur)}</strong></div>`;
    else leLong = `<div class="ligne-ecart"><span class="libelle-ecart">${iconeDrapeau('debut')}Début</span><strong>${m(abscisse)}</strong></div>
        <div class="fin-petite">${iconeDrapeau('fin')}fin ${m(reste)}</div>`;
    const hauteur = g.ecartAltitude == null
      ? '<div class="bloc-hauteur sans-altitude">pas d\'altitude</div>'
      : `<div class="bloc-hauteur ${g.classeAltitude}"><span class="libelle-ecart">${iconeFleche(g.ecartAltitude >= 0 ? 'monter' : 'descendre')}${g.ecartAltitude >= 0 ? 'Monter' : 'Descendre'}</span><strong>${m(g.ecartAltitude)}</strong></div>`;
    // 0.123 : se tourner pour être dans l'axe de la ligne : flèche en rond (gauche / droite) et les degrés,
    // dans le couloir, en bas à droite ; rien quand on est dans l'axe à ±5° près.
    const degres = g.virage != null ? Math.round(Math.abs(g.virage)) : null;
    const virage = degres == null || degres <= 5 ? ''
      : `<span class="virage-couloir" title="Tourne-toi de ${degres}° vers la ${g.virage > 0 ? 'droite' : 'gauche'}">${iconeVirage(g.virage > 0 ? 'droite' : 'gauche')}<strong>${degres}°</strong></span>`;
    zone.className = 'guidage-direct ligne-nette';
    zone.innerHTML = `
      <div class="colonne-ecarts">
        <div class="bloc-lateral ${g.classeLaterale ?? ''}">
          <div class="ligne-ecart">${sens}<strong>${m(ecart)}</strong></div>
        </div>
        <div class="bloc-lateral bloc-bouts ${g.classeBout ?? ''}">${leLong}</div>
        ${hauteur}
      </div>
      ${htmlCouloirVertical(bandeCouloir, ecart, abscisse, longueur, couleurLaterale(g.classeLaterale), virage, { sansFleche: surLaLigne })}`;
  }

  /**
   * Implantation d'un point, avant le guidage : point choisi (implanter ou garder dans la liste
   * « À implanter »), liste « À implanter », export. Le guidage est dans vueImplantation.
   */
  function implanterPoint() {
    const { implanter: imp } = donnees;
    const choix = imp.choix
      ? `<div class="choix-implantation">
          <p class="coordonnees-choix">${imp.choix.nom ? `<strong>${echapper(imp.choix.nom)}</strong> ` : ''}<span class="coord-en">E ${formaterNombre(imp.choix.est)} · N ${formaterNombre(imp.choix.nord)}</span></p>
          <div class="champs-implantation">
            <label>Nom<input type="text" data-champ="nom-implantation" value="${echapper(imp.nomPropose)}" autocomplete="off" autocapitalize="characters" /></label>
            <label>Altitude<input type="text" inputmode="decimal" data-champ="altitude-implantation" value="${imp.choix.altitude != null ? imp.choix.altitude.toFixed(3) : ''}" placeholder="facultative" /></label>
          </div>
          <div class="ligne-outils">
            <button type="button" class="bouton bouton-implanter" data-action="implanterChoix">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>Implanter</button>
            <button type="button" class="bouton-secondaire seulement-expert" data-action="creerPointAImplanter">+ À implanter</button>
            ${imp.choixDuProjet ? '' : '<button type="button" class="bouton-secondaire seulement-expert" data-action="garderPointChoisi" title="Garder ce point dans le projet (levé « Points ajoutés »)">+ Point du projet</button>'}
          </div>
        </div>`
      : '';
    const liste = imp.aImplanter.length > 0
      ? `<div class="liste-a-implanter seulement-expert">
          <p class="titre-choix">À implanter</p>
          ${imp.aImplanter.map((p) => `<div class="ligne-a-implanter ${imp.cible?.id === p.id ? 'actif' : ''}">
              <button type="button" class="bouton-lien bouton-lien-neutre" data-action="implanterPoint" data-valeur="${p.id}"><strong>${echapper(p.nom)}</strong></button>
              <span class="aide">${p.fait ? `✓ ${formaterNombre(p.fait.distance)} m${p.fait.dAltitude != null ? ` · dH ${formaterNombre(p.fait.dAltitude)}` : ''}` : (p.altitude != null ? `H ${formaterNombre(p.altitude)}` : '')}</span>
              <button type="button" class="bouton-lien" data-action="supprimerPointAImplanter" data-valeur="${p.id}" aria-label="Supprimer ${echapper(p.nom)}">×</button>
            </div>`).join('')}
        </div>`
      : '';
    return `
      ${choix}
      ${liste}
      ${lienExport()}`;
  }

  /**
   * Écran de guidage (après « Implanter ») : le plan en haut (moitié de l'écran, voir style.css,
   * « vue-implantation »), ici la vue rapprochée : ← pour choisir un autre point (ou une autre
   * ligne), ⚙ pour les réglages, la cible (ou le couloir) et ENREGISTRER.
   */
  function vueImplantation() {
    const { implanter: imp, controle: reglages } = donnees;
    // Mode Contrôler : guidage vers le point de contrôle, comme pour un point à implanter.
    const autocontrole = donnees.mode === 'autocontrole';
    const talus = !autocontrole && reglages.implantation === 'talus';
    const ligne = !autocontrole && (reglages.implantation === 'ligne' || talus);
    let titre = ligne
      ? `<strong>${echapper(imp.ligne.nom)}</strong> <span class="longueur-ligne">· long. ${formaterNombre(imp.ligne.longueur)} m</span>`
      : autocontrole
        ? `Contrôle de <strong>${echapper(cibleGuidee().nom ?? 'le point choisi')}</strong>`
        : ''; // 0.162.0 : le nom du point implanté est dans la bande du bas (avec E / N / Z)
    if (talus) titre = `<strong>${echapper(imp.talus.ouvert ?? 'Talus')}</strong> · ${echapper(imp.talus.texte)}`;
    // Talus pas encore réglé (pente) : les réglages s'ouvrent tout seuls (et restent ouverts).
    if (talus && !imp.talus.complet) reglagesGuidageOuverts = true;
    const ouverts = reglagesGuidageOuverts;
    const guidage = talus
      ? '<div class="guidage-direct attente" data-vivant="guidage-talus"></div>'
      : ligne
      ? '<div class="guidage-direct attente" data-vivant="guidage-ligne"></div>'
      : `<div class="cible-haut" data-vivant="cible-haut" hidden></div>
        <div class="guidage-et-boussole ${reglages.guidage === 'nseo' ? 'avec-boussole' : ''}">
          <div class="guidage-direct attente" data-vivant="guidage"></div>
          ${reglages.guidage === 'nseo' ? boussole() : ''}
        </div>`;
    return `<div class="vue-guidage">
      ${autocontrole ? '' : bandeauImplantation()}
      <div class="entete-guidage">
        <button type="button" class="bouton-retour" data-action="${ligne ? 'changerLigne' : autocontrole ? 'arreterControle' : 'arreterImplantation'}" title="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}" aria-label="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        ${!ligne && !autocontrole && imp.precedent && !imp.plusProche ? `<button type="button" class="bouton-suivant" data-action="implanterPrecedent" title="Implanter le point précédent : ${echapper(imp.precedent)}" aria-label="Point précédent : ${echapper(imp.precedent)}">◀ ${echapper(imp.precedent)}</button>` : ''}
        <p class="titre-vue-guidage">${titre}</p>
        ${ligne ? '<button type="button" class="bouton-retour" data-action="inverserLigne" title="Inverser le sens" aria-label="Inverser le sens">⇄</button>' : ''}
        ${!ligne && !autocontrole ? `<button type="button" class="bouton-suivant bouton-plus-proche seulement-expert ${imp.plusProche ? 'actif' : ''}" data-action="basculerPlusProche" aria-pressed="${imp.plusProche}" title="Le plus proche : la cible suit le point du plan le plus proche">⌖ Proche</button>` : ''}
        ${!ligne && !autocontrole && imp.suivant && !imp.plusProche ? `<button type="button" class="bouton-suivant" data-action="implanterSuivant" title="Implanter le point suivant : ${echapper(imp.suivant)}" aria-label="Point suivant : ${echapper(imp.suivant)}">${echapper(imp.suivant)} ▶</button>` : ''}
        <button type="button" class="bouton-retour ${ouverts ? 'actif' : ''}" data-action="basculerReglagesGuidage" title="Réglages de l'implantation" aria-label="Réglages de l'implantation" aria-expanded="${ouverts}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></button>
      </div>
      ${ouverts ? (talus ? reglagesTalus() : reglagesGuidage(ligne)) : ''}
      ${talus ? detailLigne() : ligne ? choixLigneNette() : detailPoint()}
      ${guidage}
      <button type="button" class="bouton bouton-prendre ${autocontrole ? '' : 'seulement-intermediaire'}" data-action="enregistrerImplantation" disabled>
        <span>${talus ? 'ENREGISTRER L\'ENTRÉE EN TERRE' : autocontrole ? 'ENREGISTRER LE CONTRÔLE' : 'ENREGISTRER L\'IMPLANTATION'}</span><span class="sous-titre-prendre">ou touche vol −</span>
      </button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
    </div>`;
  }

  /**
   * Réglages du talus (roue ⚙, ouverts tout seuls tant que la pente manque) : pente H / V, la
   * ligne est le haut ou le bas, côté, longueur, terrain, altitude de la ligne ; puis le segment,
   * le guidage, « Mes talus ».
   */
  function reglagesTalus() {
    const { implanter: imp, surfaces } = donnees;
    const r = imp.talus.reglages;
    const l = imp.ligne;
    const nombre = (v) => (v == null ? '' : String(Math.round(v * 1000) / 1000));
    const choix = (champ, liste, actif) => liste
      .map(([cle, titre]) => `<button type="button" class="puce-choix ${cle === actif ? 'actif' : ''}" data-action="reglerTalus" data-champ-talus="${champ}" data-valeur="${cle}">${titre}</button>`)
      .join('');
    const listeSurfaces = (champ, actif, sans) => `<select data-reglage-talus="${champ}">
        <option value="">${sans}</option>
        ${surfaces.map((s) => `<option value="${s.id}" ${s.id === actif ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
      </select>`;
    return `<div class="reglages-guidage reglages-talus">
      ${svgCroquisTalus(r)}
      <div class="ligne-choix pente-talus"><span>Pente</span>
        <label>H<input type="text" inputmode="decimal" data-reglage-talus="horizontal" value="${nombre(r.horizontal)}" placeholder="—" aria-label="Horizontal (m)" /></label>
        <span class="barre-pente">/</span>
        <label>V<input type="text" inputmode="decimal" data-reglage-talus="vertical" value="${nombre(r.vertical)}" placeholder="—" aria-label="Vertical (m)" /></label>
        ${bulle('talus')}
      </div>
      <div class="ligne-choix"><span>La ligne est</span>${choix('ligneEst', [['haut', 'Haut du talus'], ['bas', 'Bas du talus']], r.ligneEst)}</div>
      <div class="ligne-choix"><span>Talus à</span>${choix('cote', [['gauche', '← Gauche'], ['droite', 'Droite →']], r.cote)}</div>
      <label class="champ-decalage">Longueur en plan (m)<input type="text" inputmode="decimal" data-reglage-talus="longueur" value="${nombre(r.longueur)}" placeholder="vide : jusqu'au terrain" /></label>
      <label class="champ-decalage">Terrain${listeSurfaces('terrainId', r.terrainId, 'sol à l\'altitude de la canne')}</label>
      <label class="champ-decalage">Altitude de la ligne${listeSurfaces('altitudeSurfaceId', r.altitudeSurfaceId, l.altitudesDuPlan ? 'celle de la ligne (3D)' : 'tapée au début et à la fin')}</label>
      ${l.nbSegments > 1 ? `<div class="ligne-choix"><span>Ligne</span>${boutonsChoix('choisirSegment', [['tout', 'Toute'], ['segment', 'Segment par segment']], l.segment == null ? 'tout' : 'segment')}</div>` : ''}
      <div class="ligne-outils">
        ${imp.talus.ouvert
          ? `<span class="aide">Gardé dans « Mes talus » : ${echapper(imp.talus.ouvert)}</span>`
          : '<button type="button" class="bouton-secondaire" data-action="enregistrerTalus">+ Mes talus</button>'}
      </div>
    </div>`;
  }

  /** « Mes talus » : talus gardés dans le projet (toucher = l'implanter, × = l'enlever). */
  function mesTalus() {
    const liste = donnees.implanter.talus.mesTalus;
    if (liste.length === 0) return '';
    return `<div class="liste-a-implanter">
        <p class="titre-choix">Mes talus</p>
        ${liste.map((t) => `<div class="ligne-a-implanter">
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ouvrirTalus" data-valeur="${t.id}"><strong>${echapper(t.nom)}</strong></button>
            <span class="aide">${echapper(t.texte)}</span>
            <button type="button" class="bouton-lien" data-action="supprimerTalus" data-valeur="${t.id}" aria-label="Supprimer ${echapper(t.nom)}">×</button>
          </div>`).join('')}
      </div>`;
  }

  /** Talus des surfaces importées (0.135.0, Calculs › Dessin) : toucher = implanter ce tronçon. */
  function talusDesSurfaces() {
    const liste = donnees.implanter.talus.talusSurfaces ?? [];
    if (liste.length === 0) return '';
    return `<div class="liste-a-implanter">
        <p class="titre-choix">Talus des surfaces</p>
        ${liste.map((t) => `<div class="ligne-a-implanter">
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ouvrirTalusSurface" data-valeur="${echapper(t.valeur)}"><strong>${echapper(t.nom)}</strong></button>
            <span class="aide">${echapper(t.texte)}</span>
          </div>`).join('')}
      </div>`;
  }

  /**
   * Implantation d'un talus, à chaque état du récepteur : en grand « Éloigne-toi / Rapproche-toi »
   * (de la ligne, jusqu'à l'entrée en terre), puis « Monter / Descendre » (talus à l'endroit de la
   * canne), le détail et le profil en travers.
   */
  function rafraichirTalus() {
    const t = direct?.implantationTalus;
    const bouton = conteneur.querySelector('[data-action="enregistrerImplantation"]');
    if (bouton) bouton.disabled = !(etat?.connecte && etat?.autorise && donnees.implanter.ligne && t && !t.message);
    const zone = conteneur.querySelector('[data-vivant="guidage-talus"]');
    if (!zone) return;
    if (!t || t.message) {
      zone.className = 'guidage-direct attente';
      zone.innerHTML = `<span class="message-ecart">${echapper(t?.message ?? 'En attente de la position…')}</span>`;
      return;
    }
    const g = t.talus;
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    const mot = g.auBord ? 'Bord du talus' : 'Entrée en terre';
    // Distance > voulue : la canne est trop loin de la ligne, il faut se rapprocher.
    const sens = Math.abs(g.ecartDistance) < 0.0005
      ? `${mot} ✓`
      : `${g.ecartDistance > 0 ? '← Rapproche-toi' : 'Éloigne-toi →'} ${m(g.ecartDistance)}`;
    const hauteur = t.ecartAltitude == null
      ? `<span class="hauteur-guidage attente">${g.altitudeTalusCanne == null ? 'hors du talus' : ''}</span>`
      : `<span class="hauteur-guidage ${t.classeAltitude}">${t.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(t.ecartAltitude)}</span>`;
    const detail = [`${mot.toLowerCase()} à ${m(g.distanceVoulue)}`, `toi à ${formaterNombre(g.distance)} m`, g.solPlat ? 'sol = canne' : ''].filter(Boolean).join(' · ');
    const manque = g.auBord && g.manque != null ? `<span class="manque-talus">Le talus n'atteint pas le terrain : il manque ${m(g.manque)} de haut</span>` : '';
    zone.className = `guidage-direct guidage-talus ${t.classe}`;
    zone.innerHTML = `
      <span class="lignes-guidage"><span>${sens}</span></span>
      ${hauteur}
      <span class="distance-guidage">${detail}</span>
      ${manque}
      <div class="profil-talus">${svgCoupeTalus({ talus: g, pente: penteSignee(t.reglages), profil: t.profil, altitudeCanne: t.altitudeCanne, couleurCanne: couleurCanne(Math.abs(g.ecartDistance)) })}</div>`;
  }

  /** Réglages de l'implantation (roue ⚙) : guidage, orientation ; pour une ligne, segment et décalage. */
  function reglagesGuidage(ligne) {
    const { controle: reglages, implanter: imp } = donnees;
    const l = imp.ligne;
    return `<div class="reglages-guidage">
      <div class="ligne-choix"><span>Guidage</span>${boutonsChoix('choisirGuidage', GUIDAGES, reglages.guidage)}</div>
      ${ligne ? altitudesDesBouts() : ''}
      ${ligne ? `<label class="champ-decalage">Décalage parallèle (m)<input type="text" inputmode="decimal" data-reglage-ligne="decalage" value="${l.decalage ? l.decalage.toFixed(3) : ''}" placeholder="+ à droite, − à gauche" /></label>` : ''}
      <p class="aide" data-vivant="orientation"></p>
    </div>`;
  }

  /**
   * Ligne (0.118.0, sans les coordonnées) : bascule « Toute la polyligne / Segment » (ligne de 2
   * segments ou plus), segment en cours (◀ ▶ et ses deux bouts), décalage parallèle.
   */
  function choixLigneNette() {
    const l = donnees.implanter.ligne;
    // 0.126.0 (demande du 05.11) : bascule et segment sur UNE ligne, pour laisser la place au guidage.
    const bascule = l.nbSegments > 1
      ? `<div class="bascule-segment" role="radiogroup" aria-label="Ligne à implanter">${boutonsChoix('choisirSegment', [['tout', 'Toute'], ['segment', 'Segment']], l.segment == null ? 'tout' : 'segment')}</div>`
      : '';
    const bouts = [l.debut?.nom, l.fin?.nom].every(Boolean) ? `${echapper(l.debut.nom)} → ${echapper(l.fin.nom)}` : '';
    // 0.188.0 : la place des flèches est toujours réservée (cachées sur « Toute ») : rien ne bouge quand on bascule.
    const segment = l.nbSegments > 1
      ? `<div class="choix-segment${l.segment == null ? ' reserve' : ''}" title="${bouts}" ${l.segment == null ? 'aria-hidden="true" inert' : ''}>
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="precedent" ${l.segment == null || l.segment === 0 ? 'disabled' : ''} aria-label="Segment précédent">◀</button>
          <span><strong>${(l.segment ?? 0) + 1}</strong> / ${l.nbSegments}</span>
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="suivant" ${l.segment == null || l.segment === l.nbSegments - 1 ? 'disabled' : ''} aria-label="Segment suivant">▶</button>
        </div>`
      : '';
    return `${bascule || segment ? `<div class="ligne-segment">${bascule}${segment}</div>` : ''}
      ${l.decalage ? `<p class="aide">Parallèle à ${formaterNombre(Math.abs(l.decalage))} m ${l.decalage > 0 ? 'à droite' : 'à gauche'}</p>` : ''}`;
  }

  /**
   * Réglages ⚙ de la ligne (0.118.0) : altitude du début et de la fin (celle du plan s'il est en 3D,
   * sinon tapée dès Intermédiaire), puisque les coordonnées ne sont plus sur l'écran.
   */
  function altitudesDesBouts() {
    const l = donnees.implanter.ligne;
    const lue = (bout, cle) => (l.altitudesDuPlan ? bout.altitude : l.altitudes[cle]);
    const altitude = (bout, cle) => (l.altitudesDuPlan || estModeBase()
      ? `<span class="altitude-bout">${iconeDrapeau(cle)} H <strong>${lue(bout, cle) != null ? formaterNombre(lue(bout, cle)) : '—'}</strong></span>`
      : `<label class="altitude-bout">${iconeDrapeau(cle)} H<input type="text" inputmode="decimal" data-reglage-ligne="${cle}" value="${l.altitudes[cle] == null ? '' : l.altitudes[cle].toFixed(3)}" placeholder="—" aria-label="Altitude ${cle === 'debut' ? 'du début' : 'de la fin'}" /></label>`);
    return `<div class="altitudes-bouts">${altitude(l.debut, 'debut')}${altitude(l.fin, 'fin')}</div>`;
  }

  /** Point implanté : coordonnées et altitude, sur une ligne. */
  function detailPoint() {
    const c = cibleGuidee();
    return `<div class="ligne-cible"><p class="coordonnees-cible">${donnees.mode === 'autocontrole' ? `<span class="coord-en">E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}</span>` : ''}${donnees.mode === 'autocontrole' ? (c.altitude != null ? `<span class="coord-h">H ${formaterNombre(c.altitude)}</span>` : '') : `<label class="coord-h">H<input type="text" inputmode="decimal" data-champ="altitude-cible" value="${c.altitude != null ? c.altitude.toFixed(3) : ''}" placeholder="—" aria-label="Altitude d'implantation" /></label>`}</p>
      ${donnees.mode !== 'autocontrole' && donnees.implanter.choix ? `<div class="ligne-outils options-choix">
          <button type="button" class="bouton-secondaire seulement-expert" data-action="creerPointAImplanter">+ À implanter</button>
          ${donnees.implanter.choixDuProjet ? '' : '<button type="button" class="bouton-secondaire seulement-expert" data-action="garderPointChoisi" title="Garder ce point dans le projet (levé « Points ajoutés »)">+ Point du projet</button>'}
        </div>` : ''}</div>`;
  }

  /**
   * Ligne implantée : segment en cours (◀ ▶), puis le début (drapeau vert) et la fin (damier),
   * chacun avec ses coordonnées et son altitude à côté : celle du plan s'il est en 3D, sinon une
   * case pour la taper (facultative). ⇄ inverse le sens.
   */
  function detailLigne() {
    const l = donnees.implanter.ligne;
    const segment = l.segment == null
      ? ''
      : `<div class="choix-segment">
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="precedent" ${l.segment === 0 ? 'disabled' : ''} aria-label="Segment précédent">◀</button>
          <span>Segment <strong>${l.segment + 1}</strong> / ${l.nbSegments}</span>
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="suivant" ${l.segment === l.nbSegments - 1 ? 'disabled' : ''} aria-label="Segment suivant">▶</button>
        </div>`;
    // Altitude tapée : dès le mode Intermédiaire (en Base, on montre celle qui a pu être tapée avant).
    const lue = (bout, cle) => (l.altitudesDuPlan ? bout.altitude : l.altitudes[cle]);
    const altitude = (bout, cle) => (l.altitudesDuPlan || estModeBase()
      ? `<span class="altitude-bout">H <strong>${lue(bout, cle) != null ? formaterNombre(lue(bout, cle)) : '—'}</strong></span>`
      : `<label class="altitude-bout">H<input type="text" inputmode="decimal" data-reglage-ligne="${cle}" value="${l.altitudes[cle] == null ? '' : l.altitudes[cle].toFixed(3)}" placeholder="—" aria-label="Altitude ${cle === 'debut' ? 'du début' : 'de la fin'}" /></label>`);
    const ligneBout = (bout, cle) => `<div class="bout-ligne">
        <span class="pastille-bout ${cle === 'fin' ? 'fin' : ''}">${iconeDrapeau(cle)}</span>
        <span class="coordonnees-bout">${bout.nom ? `<strong>${echapper(bout.nom)}</strong> ` : ''}<span class="coord-en">E ${formaterNombre(bout.est)} · N ${formaterNombre(bout.nord)}</span></span>
        ${altitude(bout, cle)}
      </div>`;
    return `${segment}
      <div class="sens-ligne">
        <div class="bouts-ligne">${ligneBout(l.debut, 'debut')}${ligneBout(l.fin, 'fin')}</div>
      </div>
      ${l.decalage ? `<p class="aide">Parallèle à ${formaterNombre(Math.abs(l.decalage))} m ${l.decalage > 0 ? 'à droite' : 'à gauche'}</p>` : ''}`;
  }

  /**
   * Boussole de la tablette : l'aiguille montre le nord (le haut = le haut de la tablette).
   * Tournée à chaque nouvelle valeur par mettreAJourBoussole, sans redessiner l'écran.
   */
  function boussole() {
    return `<div class="boussole" data-vivant="boussole" title="Boussole de la tablette (nord magnétique, environ 3° près)">
      <svg viewBox="-30 -30 60 60" aria-hidden="true">
        <circle r="27" class="cadran" />
        <g class="aiguille" data-vivant="aiguille"><path d="M0 -22 6 0H-6Z" class="nord" /><path d="M0 22 6 0H-6Z" class="sud" /><text y="-11" text-anchor="middle">N</text></g>
      </svg>
      <span class="aide" data-vivant="texte-boussole">boussole…</span>
    </div>`;
  }

  /** Choix de ce que l'on va lever : une nouvelle surface de cette nature. */
  function choixNature() {
    // 0.161.0 : Lever = Stock / Terrain / Libre ; Recollement et Métré sont des applications à part.
    if (choixReseauOuvert || donnees.famille === 'reseau') return choixReseau();
    const permises = donnees.famille === 'metre' ? ['metre'] : ['stock', 'terrain', 'terrassement', 'chantier', 'autres'];
    return `<div class="choix-nature">
      <p class="titre-choix">${donnees.famille === 'metre' ? 'Nouveau métré' : 'Que lèves-tu ?'}</p>
      <div class="natures-terrain">
        ${NATURES_TERRAIN.filter(([cle]) => permises.includes(cle) && (!estModeBase() || NATURES_BASE.includes(cle))).map(([cle, titre]) => `<button type="button" class="bouton-nature nature-${cle}" data-action="nouvelleSurface" data-valeur="${cle}"><span>${titre}</span>${DETAIL_NATURE[cle] ? `<small>${DETAIL_NATURE[cle]}</small>` : ''}</button>`).join('')}
      </div>
      ${donnees.stock ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerChoixNature">annuler</button>' : ''}
    </div>`;
  }

  /** Recollement : choix du réseau du nouveau levé (un levé par réseau). */
  function choixReseau() {
    return `<div class="choix-nature choix-reseau">
      <p class="titre-choix">Quel réseau ?</p>
      <div class="natures-terrain">
        ${donnees.reseaux.map(([abreviation, description, couleur]) => `<button type="button" class="bouton-nature bouton-reseau" style="--couleur-nature: ${couleur}"
          data-action="nouvelleSurface" data-valeur="reseau:${echapper(abreviation)}"><strong>${echapper(abreviation)}</strong> <span>${echapper(description)}</span></button>`).join('')}
      </div>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="modifierReseaux">+ Ajouter ou modifier des réseaux</button>
      ${donnees.stock ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerChoixNature">annuler</button>' : ''}
    </div>`;
  }

  /** Recollement : ce qui est tapé à côté du point (diamètre, matériau, fouille, remarque). */
  function attributsReseau() {
    if (!donnees?.recollement) return {};
    const lire = (champ) => conteneur.querySelector(`[data-attribut-reseau="${champ}"]`)?.value ?? saisieReseau[champ] ?? '';
    return { diametre: lire('diametre'), materiau: lire('materiau'), profondeurFouille: lire('profondeurFouille'), remarque: lire('remarque') };
  }

  /**
   * Delta du prochain point (0.139.0, Intermédiaire) : gauche / droite selon le cap du GNSS, distance et Z.
   * Orange quand il décale le point ; le point décalé se voit sur le plan ; remis à zéro après le point.
   */
  function ligneDelta() {
    const d = donnees.delta ?? { sens: 'droite', distance: '', z: '' };
    // 0.141.0 : la ligne de réglage n'est montrée qu'après le bouton « Δ Delta » (ou si un delta est tapé).
    // 0.151.0 : fermé = petit bouton « Δ » à droite de la position (voir cadrePrise).
    if (!d.ouvert && !d.actif) return '';
    const sens = (cle, mot) => `<button type="button" class="bouton-sens-delta ${d.sens === cle ? 'actif' : ''}" data-action="reglerDelta" data-champ-delta="sens" data-valeur="${cle}" aria-pressed="${d.sens === cle}">${mot}</button>`;
    // 0.168.0 : « Δ Delta » en titre, côté + distance sur une ligne, Z ± sur une autre, grande croix sur toute la hauteur.
    return `<div class="ligne-delta seulement-intermediaire ${d.actif ? 'actif' : ''}">
        <span class="titre-delta" title="Décaler le prochain point"><i>Δ</i> Delta</span>
        <div class="rang-delta rang-lateral">
          <span class="sens-delta" role="group" aria-label="Côté du décalage">${sens('gauche', '◀ G')}${sens('droite', 'D ▶')}</span>
          <label class="champ-delta">dist.<input type="text" inputmode="decimal" data-delta="distance" value="${echapper(d.distance)}" placeholder="0.000" autocomplete="off" /></label>
        </div>
        <div class="rang-delta rang-z">
          <label class="champ-delta">Z ±<input type="text" inputmode="decimal" data-delta="z" value="${echapper(d.z)}" placeholder="0.000" autocomplete="off" /></label>
        </div>
        <button type="button" class="bouton-fermer-delta" data-action="reglerDelta" data-champ-delta="effacer" title="Fermer le delta (remis à zéro)" aria-label="Fermer le delta (remis à zéro)">×</button>
      </div>`;
  }

  /** Cadre « Point » : ID point, photo, Enreg. Pts, position, refus et « Annuler » (tous les levés). */
  function cadrePrise() {
    // Sur le site (0.120.0) : pas de récepteur ni d'Enreg. Pts ; on ajoute un point (ou les points d'une
    // ligne) en touchant le plan avec une accroche (barre posée sur le plan, voir main.js › ajoutLevee).
    if (!donnees.recepteur) {
      return `<div class="cadre-prise cadre-ajout">
        <span class="titre-cadre-prise">Ajout</span>
        <div class="ligne-ajout">
          <label class="bouton-photo-levee" title="Photo du levé" aria-label="Photo du levé">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg>
            <input type="file" data-champ="photo-levee" accept="image/*" capture="environment" hidden />
          </label>
          <button type="button" class="bouton bouton-ajouter" data-action="${donnees.ajoutActif ? 'arreterAjout' : 'commencerAjout'}">
            ${donnees.ajoutActif ? 'Terminé' : '+ Ajouter par accroche'}
          </button>
        </div>
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}>
          ↶ Effacer le dernier point${donnees.dernierPoint ? ` (${echapper(donnees.dernierPoint)})` : ''}</button>
      </div>`;
    }
    return `<div class="cadre-prise">
        <span class="titre-cadre-prise">Point</span>
        <div class="ligne-id-prendre">
          <label class="champ-id-point"><span>ID point</span>
            <input type="text" class="nom-point" data-champ="nom-point" value="${echapper(donnees.nomPropose)}" autocomplete="off" autocapitalize="characters" aria-label="Nom du prochain point" /></label>
          <label class="bouton-photo-levee" title="Photo du levé" aria-label="Photo du levé">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg>
            <input type="file" data-champ="photo-levee" accept="image/*" capture="environment" hidden />
          </label>
          <button type="button" class="bouton bouton-prendre" data-action="prendre" title="Enregistrer le point (ou touche volume −)" disabled>
            <span>Enreg. (Vol. −)</span>
          </button>
        </div>
        <div class="ligne-position-delta">
          <div class="position-leve" data-vivant="position"></div>
          ${donnees.delta?.ouvert || donnees.delta?.actif ? '' : '<button type="button" class="bouton-ouvrir-delta seulement-intermediaire" data-action="reglerDelta" data-champ-delta="ouvrir" title="Décaler le prochain point (delta)" aria-label="Delta : décaler le prochain point">Δ</button>'}
        </div>
        ${ligneDelta()}
        <p class="raison-leve" data-vivant="raison" hidden></p>
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}
          title="Effacer le dernier point${donnees.dernierPoint ? ` (${echapper(donnees.dernierPoint)})` : ''}" aria-label="Effacer le dernier point">
          ↶ Effacer le dernier point${donnees.dernierPoint ? ` (${echapper(donnees.dernierPoint)})` : ''}</button>
      </div>`;
  }

  /**
   * Recollement de réseau (0.101.0) : réseaux du projet (un clic pour changer), éléments, forme de
   * l'ouvrage ou conduite en cours, diamètre / matériau / fouille / remarque, cadre « Point »,
   * bandeau (dernier ouvrage, pente du dernier tronçon, fouille), puis ouvrages et conduites.
   */
  function priseDePointReseau() {
    const r = donnees.recollement;
    saisieReseau.diametre ??= r.diametre == null ? '' : String(r.diametre);
    saisieReseau.materiau ??= r.materiau ?? '';
    const reseaux = `<div class="reseaux-leve" role="group" aria-label="Réseaux levés">
        ${r.levees.map((l) => `<button type="button" class="puce-reseau ${l.actif ? 'actif' : ''}" style="--couleur-reseau: ${l.couleur}" data-action="choisirStock" data-valeur="${l.id}">${echapper(l.nom)}</button>`).join('')}
        <button type="button" class="puce-reseau puce-nouveau-reseau" data-action="ouvrirChoixNature" data-valeur="reseau" title="Nouveau réseau" aria-label="Nouveau réseau">+</button>
        <button type="button" class="bouton-crayon-libelles seulement-intermediaire" data-action="modifierReseaux" title="Ajouter ou modifier des réseaux" aria-label="Ajouter ou modifier des réseaux">⚙</button>
        ${bulle('recollement')}
      </div>`;
    const elements = `<div class="elements-reseau" role="group" aria-label="Élément levé">
        ${ELEMENTS_RESEAU.map(([cle, titre, ouvrage]) => `<button type="button" class="puce-element ${ouvrage ? 'element-ouvrage' : ''} ${cle === r.element ? 'actif' : ''}" data-action="choisirElementReseau" data-valeur="${cle}">${titre}</button>`).join('')}
      </div>`;
    let enCours;
    if (r.ouvrage) {
      const coins = r.enCours && r.enCours.forme === 'rect' ? `<strong>Coin ${r.enCours.nbCoins + 1} / 3</strong> de ${echapper(r.enCours.nom)}` : '';
      enCours = `<div class="ligne-choix forme-ouvrage"><span>Forme</span>
          ${boutonsChoix('choisirFormeOuvrage', [['ronde', 'Ronde (1 point)'], ['rect', 'Carrée / rect. (3 coins)']], r.forme)}
        </div>${coins ? `<p class="coins-ouvrage">${coins}</p>` : ''}`;
    } else {
      const depart = r.ouvrages.filter((o) => o.fini);
      enCours = `<div class="element-en-cours conduite-en-cours">
          <span class="titre-element">Conduite en cours</span>
          <div class="corps-element">
            <strong>${r.conduite?.numero ? `T-${echapper(r.reseau)}-${r.conduite.numero}` : 'nouvelle'}</strong><span>${r.conduite?.nbPoints ?? 0} pt(s)</span>
          </div>
          <div class="ligne-outils">
            <select data-champ="depart-conduite" aria-label="Départ de la nouvelle conduite">
              <option value="">depuis nulle part</option>
              ${depart.map((o) => `<option value="${o.id}" ${o.id === r.dernierOuvrage?.id ? 'selected' : ''}>depuis ${echapper(o.nom)}</option>`).join('')}
            </select>
            <button type="button" class="bouton-secondaire" data-action="nouvelleConduite">+ Nouvelle conduite</button>
          </div>
        </div>`;
    }
    const champ = (cle, titre, attributs = '') => `<label class="attribut-reseau"><span>${titre}</span>
        <input type="text" data-attribut-reseau="${cle}" value="${echapper(saisieReseau[cle] ?? '')}" ${attributs} /></label>`;
    const attributs = `<div class="attributs-reseau">
        ${champ('diametre', r.ouvrage ? 'Ø (mm)' : 'Ø ext. (mm)', 'inputmode="decimal" placeholder="—"')}
        <label class="attribut-reseau"><span>Matériau</span><select data-attribut-reseau="materiau">
          <option value="">—</option>
          ${MATERIAUX.map((m) => `<option ${m === saisieReseau.materiau ? 'selected' : ''}>${m}</option>`).join('')}
        </select></label>
        ${r.ouvrage ? '' : champ('profondeurFouille', 'Fouille (m)', 'inputmode="decimal" placeholder="—"')}
        ${champ('remarque', 'Remarque', 'placeholder="—"')}
      </div>`;
    return `
      ${ligneSurface()}
      ${reseaux}
      ${elements}
      <div class="cadre-role cadre-reseau" style="--couleur-reseau: ${r.couleur}">
        ${enCours}
        ${attributs}
        ${cadrePrise()}
      </div>
      ${bandeauReseau()}
      ${listeReseau()}
      ${basDuLeve()}`;
  }

  /** Bandeau du recollement : dernier ouvrage (profondeur), pente du dernier tronçon avec le sens, fouille. */
  function bandeauReseau() {
    const r = donnees.recollement;
    const morceaux = [];
    const o = r.dernierOuvrage;
    if (o) morceaux.push(`<span><strong>${echapper(o.nom)}</strong> prof. ${o.profondeur == null ? '—' : `${formaterNombre(o.profondeur)} m`}</span>`);
    const t = r.dernierTroncon;
    if (t?.pente != null) morceaux.push(`<span class="pente-troncon">${textePente(t.pente)} ${flecheSens(t.sens, t.a.nom, t.b.nom)}</span>`);
    if (r.fouille != null) morceaux.push(`<span>fouille ${formaterNombre(r.fouille)} m</span>`);
    return morceaux.length > 0 ? `<div class="bandeau-reseau" style="--couleur-reseau: ${r.couleur}">${morceaux.join('')}</div>` : '';
  }

  /** Ouvrages (tampon, radier et profondeur à taper) et conduites (tronçons, pente et sens). */
  function listeReseau() {
    const r = donnees.recollement;
    if (r.ouvrages.length === 0 && r.conduites.length === 0) return '';
    const ouvert = (cle) => (elementsOuverts.has(cle) ? 'open' : '');
    const valeur = (v) => (v == null ? '' : v.toFixed(3));
    const ouvrages = r.ouvrages.map((o) => `<details class="element-leve ouvrage-reseau" data-element="ouvrage-${o.id}" ${ouvert(`ouvrage-${o.id}`)}>
        <summary><strong>${echapper(o.nom)}</strong><span>${o.fini ? `prof. ${o.profondeur == null ? '—' : `${formaterNombre(o.profondeur)} m`}` : `${o.nbCoins} / 3 coins`}</span></summary>
        ${o.fini ? `<div class="mesures-ouvrage">
          <span>Tampon <strong>${o.tampon == null ? '—' : formaterNombre(o.tampon)}</strong></span>
          <label>Radier<input type="text" inputmode="decimal" data-ouvrage-champ="radier" data-id="${o.id}" value="${valeur(o.radier)}" placeholder="${o.radier == null && o.profondeurSaisie != null ? formaterNombre(o.tampon - o.profondeurSaisie) : '—'}" /></label>
          <label>Profondeur<input type="text" inputmode="decimal" data-ouvrage-champ="profondeur" data-id="${o.id}" value="${valeur(o.profondeurSaisie)}" placeholder="${o.radier != null ? formaterNombre(o.profondeur) : '—'}" /></label>
          ${o.ecartAngleDroit > 5 ? `<span class="alerte-ouvrage">angle à ${(90 + o.ecartAngleDroit).toFixed(0)}° : coins à vérifier</span>` : ''}
        </div>` : ''}
      </details>`).join('');
    const conduites = r.conduites.map((c) => `<details class="element-leve conduite-reseau" data-element="conduite-${c.id}" ${ouvert(`conduite-${c.id}`)}>
        <summary><strong>${echapper(c.nom)}</strong><span>${c.noms.length} nœud(s)</span></summary>
        <ul>${c.troncons.map((t) => `<li class="troncon-reseau"><span>${echapper(t.de)} → ${echapper(t.a)}</span>
          <span>${t.distance.toFixed(2)} m · ${t.pente == null ? 'pente —' : `${textePente(t.pente)} ${flecheSens(t.sens, t.de, t.a)}`}</span></li>`).join('') || '<li class="aide">un seul point</li>'}</ul>
      </details>`).join('');
    return `<div class="elements-leve liste-reseau">
      ${r.ouvrages.length > 0 ? `<p class="titre-choix">Ouvrages</p>${ouvrages}` : ''}
      ${r.conduites.length > 0 ? `<p class="titre-choix">Conduites</p>${conduites}` : ''}
    </div>`;
  }

  /**
   * Levé en cours (0.64.0) : sa nature en petit, son nom en grand (à la couleur de la nature) avec
   * un crayon pour le renommer, puis « Changer » (reprendre un autre levé) et « + Nouveau ».
   */
  function ligneSurface() {
    const nature = donnees.stock.nature ?? 'stock';
    const titre = NATURES_TERRAIN.find(([cle]) => cle === nature)?.[1] ?? '';
    return `<div class="entete-levee levee-en-cours nature-${nature}" title="${titre}">
      <span class="etiquette-levee">Lever en cours :</span>
      <strong class="nom-levee-en-cours">${echapper(donnees.stock.nom)}</strong>
      <button type="button" class="bouton-crayon-levee" data-action="renommerLevee" title="Renommer" aria-label="Renommer le levé">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></svg></button>
      <span class="boutons-levee">
        <label class="bouton-secondaire bouton-photo-globale seulement-intermediaire" title="Photo de tout le levé (pas d'un point)" aria-label="Photo de tout le levé">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg>
          <input type="file" data-champ="photo-levee-globale" accept="image/*" capture="environment" hidden />
        </label>
        <button type="button" class="bouton-secondaire" data-action="changerLevee" ${donnees.stocks.length > 1 || !estModeBase() ? '' : 'disabled'}>Changer</button>
        <button type="button" class="bouton-secondaire" data-action="ouvrirChoixNature" aria-label="Nouveau levé"><span class="texte-long">+ Nouveau</span><span class="texte-court">+</span></button>
      </span>
    </div>`;
  }

  /** Rôles proposés pour le levé en cours (dans l'ordre des boutons). */
  function rolesAffiches() {
    return [...ROLES_LEVE, ...ROLES_METRE].filter(([cle]) => donnees.rolesPermis.includes(cle));
  }

  /** Place du rôle choisi dans la rangée : le cadre n'a pas de coin arrondi sous l'onglet (premier, dernier). */
  function classeOnglet() {
    const roles = rolesAffiches();
    const i = roles.findIndex(([cle]) => cle === donnees.role);
    return `${i === 0 ? 'onglet-premier' : ''} ${i === roles.length - 1 ? 'onglet-dernier' : ''}`;
  }

  /** Choix du rôle : 3 gros boutons à la couleur du rôle. */
  function boutonsRoles() {
    return `<div class="roles-leve" role="group" aria-label="Rôle du prochain point">
      ${rolesAffiches().map(
        ([cle, titre]) => `<button type="button" class="role-leve role-${cle} ${donnees.role === cle ? 'choisi' : ''}" data-action="role" data-role="${cle}" aria-pressed="${donnees.role === cle}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle]}</svg>${titre}</button>`,
      ).join('')}
    </div>`;
  }

  /**
   * Ligne de rupture en cours : numéro, nombre de points, nouvelle ligne, fermer. Dans un métré :
   * l'aire ou la longueur en cours (« A-ENR-1 · 4 pt(s) ») et « + Nouvelle ».
   */
  function outilsLigne() {
    if (donnees.metre && LETTRES_METRE[donnees.role]) {
      const e = donnees.elementMetre;
      return `<div class="outils-ligne outils-metre">
        <span>${echapper(debutDeNom(LETTRES_METRE[donnees.role], e.libelle))}${e.numero} · ${e.nbPoints} pt(s)</span>
        <button type="button" class="bouton-secondaire" data-action="nouvelleLigne" ${e.nbPoints === 0 ? 'disabled' : ''}>+ Nouvelle</button>
      </div>`;
    }
    // Contour en cours (0.78.0) : même cadre que la ligne, sans « Fermer » (un contour est toujours fermé).
    if (donnees.role === 'contour') {
      const nbPoints = donnees.elements?.contour?.noms.length ?? 0;
      return `<div class="element-en-cours role-contour">
        <span class="titre-element">Contour en cours</span>
        <div class="corps-element"><strong>${echapper(donnees.nomPropose.replace(/-\d+$/, ''))}</strong><span>${nbPoints} pt(s)</span></div>
      </div>`;
    }
    if (donnees.role !== 'ligne') return '';
    const { ligne } = donnees;
    return `<div class="element-en-cours role-ligne">
      <span class="titre-element">Ligne en cours</span>
      <div class="corps-element">
        <strong>${echapper(debutDeNom('L', ligne.libelle))}${ligne.numero}</strong><span>${ligne.nbPoints} pt(s)</span>
        <button type="button" class="bouton-secondaire" data-action="nouvelleLigne" ${ligne.nbPoints === 0 ? 'disabled' : ''}>+ Nouvelle ligne</button>
        <button type="button" class="bouton-secondaire ${ligne.fermee ? 'actif' : ''}" data-action="basculerFermeture" aria-pressed="${ligne.fermee}" ${ligne.nbPoints < 3 ? 'disabled' : ''}>
          ${ligne.fermee ? '✓ Ligne fermée' : 'Fermer ligne'}</button>
      </div>
      ${choixLibelle()}
    </div>`;
  }

  /**
   * Ce que l'on lève (lignes : HT, BT, BOR… ; points : TN, RG…) : une rangée de boutons, le
   * libellé choisi va dans le nom du point. « modifier » ouvre la liste pour la compléter.
   */
  function choixLibelle() {
    if (donnees.role === 'contour') return '';
    if (donnees.chantier) return cadreChantier();
    // Liste de libellés selon le rôle : aires (métré), lignes (lignes de rupture, longueurs), points.
    const sorte = sorteDuRole();
    const liste = donnees.libelles[sorte];
    const actif = { aires: donnees.libelleAire, lignes: donnees.libelleLigne, points: donnees.libellePoint }[sorte];
    return `<div class="libelles-terrain seulement-intermediaire pour-${sorte} ${donnees.metre ? 'dans-metre' : ''}" role="group" aria-label="Ce que l'on lève">
      <button type="button" class="puce-libelle puce-aucun ${!actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur=""><strong><i class="symbole-libelle" style="color: #000000">${symboleDeForme('')}</i>Aucun</strong><span>sans libellé</span></button>
      ${liste.map(([abreviation, signification, couleur, forme]) => `<button type="button" class="puce-libelle ${abreviation === actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur="${echapper(abreviation)}">
          <strong><i class="symbole-libelle" style="color: ${couleur || COULEURS_HABITUELLES[sorte]}">${symboleDeForme(forme)}</i>${echapper(abreviation)}</strong><span>${echapper(signification)}</span></button>`).join('')}
      <button type="button" class="bouton-crayon-libelles" data-action="modifierLibelles" data-valeur="${sorte}" title="Ajouter ou modifier des libellés" aria-label="Ajouter ou modifier des libellés">⚙</button>
    </div>
`;
  }

  /**
   * Levé chantier (0.175.0, compact en 0.175.5, maquette validée le 09.11) : une rangée de libellés (noms courts, flèche › si
   * trop nombreux), une rangée de natures, puis sur une ligne la forme d'un ouvrage (Rond / Carré) et ce que touche le GNSS
   * (Dessus / Tampon / FE), puis les attributs (Ø, profondeur, matériau, remarque) sur une seule ligne. La FORME du point
   * sur le plan vient du libellé, sa COULEUR de la nature.
   */
  function cadreChantier() {
    const c = donnees.chantier;
    const l = c.libelle;
    const couleurNature = c.couleursNatures[c.nature] ?? '#6b7280';
    const bouton = (champ, valeur, texte, actif) => `<button type="button" class="${actif ? 'actif' : ''}" data-action="reglerChantier" data-champ-chantier="${champ}" data-valeur="${echapper(valeur)}" aria-pressed="${actif}">${texte}</button>`;
    const nomsMode = { dessus: 'Dessus', tampon: 'Tampon', fe: 'FE' };
    const rangee = (cle, contenu, aide) => `<div class="rangee-chantier"><div class="defile-chantier" data-defile="${cle}">${contenu}</div><button type="button" class="fleche-chantier" data-fleche="${cle}" hidden aria-label="${aide}">›</button></div>`;
    const champ = (nom, titre, valeur, classe, { mode = 'decimal', indice = '' } = {}) => `<label class="champ-chantier ${classe}"><span>${titre}</span>
        <input type="text" inputmode="${mode}" data-chantier="${nom}" value="${echapper(valeur)}" placeholder="${echapper(indice)}" autocomplete="off" /></label>`;
    const diametreRequis = l.modes[0] === 'dessus' && c.mode === 'dessus';
    const diametreVide = l.champs.includes('gaine') ? !c.gaine : !(Number(String(c.diametre).replace(',', '.')) > 0);
    const calcul = l.modes[0] === 'dessus' && c.mode === 'dessus'
      ? (diametreVide ? '<p class="calcul-chantier erreur">Le Ø est obligatoire pour lever le dessus</p>' : '<p class="calcul-chantier">FE = dessus − Ø extérieur</p>')
      : l.ouvrage && c.mode === 'tampon' ? '<p class="calcul-chantier">Radier = tampon − profondeur</p>' : '';
    const coins = l.ouvrage && c.forme === 'rect'
      ? `<p class="suivi-cadre">${[1, 2, 3].map((i) => `<span class="coin ${c.coinsFaits >= i ? 'fait' : c.coinsFaits + 1 === i ? 'en-cours' : ''}">${i}</span>`).join('')} Coin ${Math.min(c.coinsFaits + 1, 3)} sur 3, dans n'importe quel ordre</p>`
      : '';
    const dernier = c.dernierCadre && l.ouvrage
      ? `<p class="dernier-cadre">Dernier cadre ${echapper(c.dernierCadre.nom)} : ${c.dernierCadre.longueur.toFixed(2)} × ${c.dernierCadre.largeur.toFixed(2)} m · direction ${c.dernierCadre.direction.toFixed(1)}° · angle droit à ${c.dernierCadre.ecart.toFixed(1)}°</p>`
      : '';
    const reglages = [
      l.ouvrage ? `<span class="mini-bascule">${bouton('forme', 'ronde', '<i class="ico-forme rond"></i>Rond', c.forme === 'ronde')}${bouton('forme', 'rect', '<i class="ico-forme carre"></i>Carré', c.forme === 'rect')}</span>` : '',
      l.modes.length > 1 ? `<span class="mini-bascule">${l.modes.map((m) => bouton('mode', m, nomsMode[m], m === c.mode)).join('')}</span>` : '',
    ].join('');
    const materiaux = MATERIAUX.includes(c.materiau) || !c.materiau ? MATERIAUX : [...MATERIAUX, c.materiau];
    const liste = (nom, titre, options, valeur, classe, vide) => `<label class="champ-chantier ${classe}"><span>${titre}</span><select data-chantier="${nom}" aria-label="${echapper(titre)}">${vide ? '<option value="">—</option>' : ''}${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(valeur) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    // Ø : liste (une valeur tapée avant, absente de la liste, reste proposée).
    const diametres = DIAMETRES_LISTE.map((d) => [d, d]);
    if (c.diametre && !DIAMETRES_LISTE.includes(Number(c.diametre))) diametres.push([c.diametre, c.diametre]);
    return `<div class="chantier-leve" role="group" aria-label="Ce que l'on lève sur le chantier">
      ${rangee('libelles', c.libelles.map((lib) => `<button type="button" class="chip-chantier ${lib.abreviation === l.abreviation ? 'actif' : ''}" data-action="reglerChantier" data-champ-chantier="libelle" data-valeur="${echapper(lib.abreviation)}" title="${echapper(lib.nom)}"><i class="symbole-libelle" style="color: ${couleurNature}">${symboleDeForme(lib.forme)}</i>${echapper(lib.court || lib.nom)}</button>`).join('') + '<button type="button" class="bouton-crayon-libelles seulement-expert" data-action="modifierChantier" title="Modifier la bibliothèque du chantier" aria-label="Modifier la bibliothèque du chantier">⚙</button>', 'Plus de libellés')}
      ${rangee('natures', c.natures.map((n) => `<button type="button" class="nat-chantier ${n === c.nature ? 'actif' : ''}" data-action="reglerChantier" data-champ-chantier="nature" data-valeur="${echapper(n)}"><i style="background: ${c.couleursNatures[n] ?? '#6b7280'}"></i>${echapper(n)}</button>`).join(''), 'Plus de natures')}
      ${reglages ? `<div class="reglages-chantier">${reglages}${bulle('chantier')}</div>` : ''}
      <div class="attributs-chantier">
        ${l.champs.includes('diametre') ? liste('diametre', l.ouvrage ? 'Ø tuyau' : 'Ø', diametres, c.diametre, `d ${diametreRequis && diametreVide ? 'manque' : ''}`, true) : ''}
        ${l.champs.includes('gaine') ? liste('gaine', 'Ø', GAINES_LISTE.map(([i, x]) => [`${i}/${x}`, `${i} / ${x}`]), c.gaine, `g ${diametreRequis && !c.gaine ? 'manque' : ''}`, true) : ''}
        ${l.champs.includes('nombre') ? liste('nombre', 'Nb', NOMBRES_LISTE.map((n) => [n, n]), c.nombre, 'n', false) : ''}
        ${l.champs.includes('profondeur') && c.mode === 'tampon' ? champ('profondeur', 'Prof. (m)', c.profondeur, 'p', { indice: '1,25' }) : ''}
        ${l.champs.includes('materiau') ? `<label class="champ-chantier m"><select data-chantier="materiau" aria-label="Matériau">${materiaux.map((m) => `<option ${m === c.materiau ? 'selected' : ''}>${echapper(m)}</option>`).join('')}</select></label>` : ''}
        ${l.champs.includes('remarque') ? champ('remarque', 'Rem.', c.remarque, 'r', { mode: 'text', indice: 'facultatif' }) : ''}
        <label class="bouton-photo-levee photo-chantier" title="Photo du prochain point" aria-label="Photo du prochain point"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg><input type="file" data-champ="photo-levee" accept="image/*" capture="environment" hidden /></label>
      </div>
      ${calcul}${coins}${dernier}
    </div>`;
  }

  /** Liste de libellés du rôle choisi : 'aires' (métré), 'lignes' (lignes, longueurs) ou 'points'. */
  function sorteDuRole() {
    return donnees.role === 'aire' ? 'aires' : ['ligne', 'longueur'].includes(donnees.role) ? 'lignes' : 'points';
  }

  /** Une ligne courte : points du stock par rôle et volume (le détail est dans Calculs). */
  function resume() {
    if (donnees.resumeTexte) return `<p class="resume-terrain">${echapper(donnees.resumeTexte)}</p>`;
    const { resume: r, volume } = donnees;
    // Le contour seulement pour un stock (les autres levés n'en ont pas).
    const morceaux = [donnees.stock?.nature === 'stock' ? `${r.contour} contour` : '', `${r.pointsLignes} lignes`, `${r.isoles} isolés`].filter(Boolean);
    return `<p class="resume-terrain">${morceaux.join(' · ')}${volume != null ? ` · <strong>${formaterNombre(volume)} m³</strong>` : ''}</p>`;
  }

  /** Prise de point : rôle, nom, position, bouton, annulation. */
  function priseDePoint() {
    if (!donnees.stock || choixNatureOuvert) return choixNature();
    if (donnees.recollement) return priseDePointReseau();
    return `
      ${ligneSurface()}
      ${boutonsRoles()}
      <div class="cadre-role role-${donnees.role} ${classeOnglet()}">
      ${donnees.role === 'ligne' ? '' : choixLibelle()}
      ${outilsLigne()}
      ${cadrePrise()}
      </div>
      <div class="pied-terrain">${resume()}</div>
      ${basDuLeve()}`;
  }

  /**
   * Bas de l'écran Lever (0.77.0) : triangles en trop (dès Intermédiaire, levés qui ont une surface :
   * supprimer au doigt sur le plan, tout rétablir) et photos du levé (légende, supprimer).
   */
  function basDuLeve() {
    const photos = donnees.photos ?? [];
    const t = donnees.triangles;
    const triangles = t
      ? `<div class="triangles-leve seulement-intermediaire ${t.actif ? 'actif' : ''}">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3z" /><path d="m9 11 6 6M15 11l-6 6" /></svg>Triangles en trop · ${t.supprimes} supprimé(s) ${bulle('trianglesEnTrop')}</span>
          <div class="ligne-outils">
            <button type="button" class="${t.actif ? 'bouton' : 'bouton-secondaire'}" data-action="basculerTrianglesLevee">${t.actif ? 'Terminer' : 'Supprimer au doigt'}</button>
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="retablirTrianglesLevee" ${t.supprimes === 0 ? 'disabled' : ''}>tout rétablir</button>
          </div>
        </div>`
      : '';
    const listePhotos = photos.length > 0
      ? `<div class="photos-leve">
          <p class="titre-choix">Photos (${photos.length}) ${bulle('photos')}</p>
          <div class="liste-photos">${photos.map((photo) => `<figure class="photo">
              <img src="${photo.miniature}" alt="${echapper(photo.legende || donnees.stock.nom)}" />
              <span class="point-photo">📷 ${photo.point ? echapper(photo.point) : photo.attentePoint ? 'prochain point' : 'tout le levé'}</span>
              <input type="text" data-champ="legende-photo-levee" data-id="${photo.id}" value="${echapper(photo.legende ?? '')}" placeholder="Légende" aria-label="Légende de la photo" />
              <button type="button" class="bouton-lien" data-action="supprimerPhotoLevee" data-valeur="${photo.id}">supprimer</button>
            </figure>`).join('')}</div>
        </div>`
      : '';
    const elements = listeElements();
    // Lignes à partir des suites de points (0.95.0, Intermédiaire) : b1, b2, b3… → une ligne.
    const nbSuites = donnees.suites?.length ?? 0;
    const suites = nbSuites > 0
      ? `<div class="ligne-outils seulement-intermediaire"><button type="button" class="bouton-secondaire" data-action="lignesDepuisSuites">+ Lignes depuis les suites de points (${nbSuites})</button></div>`
      : '';
    return elements || triangles || listePhotos || suites ? `<div class="bas-du-leve">${suites}${elements}${triangles}${listePhotos}</div>` : '';
  }

  /**
   * Lignes du levé (0.78.0) : le contour, chaque ligne et les points isolés, à dérouler pour voir
   * leurs points ; ✕ supprime un point, ✂ supprime le segment entre deux points d'une ligne.
   */
  function listeElements() {
    // Base : seulement la liste « Points de ce levé » (contour, lignes et ✕ dès Intermédiaire).
    const base = estModeBase();
    const e = base && donnees.elements ? { ...donnees.elements, contour: null, lignes: [] } : donnees.elements;
    if (!e || (!e.contour && e.lignes.length === 0 && e.isoles.length === 0)) return '';
    const ouvert = (cle) => (elementsOuverts.has(cle) ? 'open' : '');
    const point = (nom, supprimable = true) => `<li class="point-element"><span>${echapper(nom)}</span>${supprimable
      ? `<button type="button" class="bouton-lien" data-action="supprimerPointLevee" data-valeur="${echapper(nom)}" title="Supprimer le point ${echapper(nom)}" aria-label="Supprimer le point ${echapper(nom)}">✕</button>` : ''}</li>`;
    const segment = (index, i, a, b) => `<li class="segment-element"><button type="button" class="bouton-lien bouton-lien-neutre" data-action="supprimerSegmentLevee" data-valeur="${index}:${i}" title="Supprimer le segment ${echapper(a)} → ${echapper(b)}">✂ segment</button></li>`;
    const ligne = (l) => {
      const morceaux = [];
      l.noms.forEach((nom, i) => {
        morceaux.push(point(nom));
        if (i + 1 < l.noms.length) morceaux.push(segment(l.index, i, nom, l.noms[i + 1]));
      });
      if (l.fermee && l.noms.length >= 3) morceaux.push(segment(l.index, l.noms.length - 1, l.noms.at(-1), l.noms[0]));
      return `<details class="element-leve role-ligne" data-element="ligne-${l.index}" ${ouvert(`ligne-${l.index}`)}>
          <summary><strong>${echapper(l.nom)}</strong><span>${l.noms.length} pt(s)${l.fermee ? ' · fermée' : ''}</span></summary>
          <ul>${morceaux.join('')}</ul>
        </details>`;
    };
    return `<div class="elements-leve">
      <p class="titre-choix">${base ? 'Points de ce levé' : 'Lignes du levé'} ${bulle('lignesLevee')}</p>
      ${e.contour ? `<details class="element-leve role-contour" data-element="contour" ${ouvert('contour')}>
          <summary><strong>${echapper(e.contour.nom)}</strong><span>contour · ${e.contour.noms.length} pt(s)</span></summary>
          <ul>${e.contour.noms.map((nom) => point(nom, e.contour.modifiable)).join('')}</ul>
        </details>` : ''}
      ${e.lignes.map(ligne).join('')}
      ${e.isoles.length > 0 ? `<details class="element-leve role-isole" data-element="isoles" ${ouvert('isoles')}>
          <summary><strong>Points isolés</strong><span>${e.isoles.length} pt(s)</span></summary>
          <ul>${e.isoles.map((nom) => point(nom, !base)).join('')}</ul>
        </details>` : ''}
    </div>`;
  }

  return {
    /** 0.151.0 : plan en grand à la place de la cible (oui), ou retour de la cible (non). */
    planEnGrand(oui) {
      planEnGrandDemande = Boolean(oui);
      rafraichirImplantation();
    },
    /**
     * Redessine l'écran. donnees : { leve (levé de la surface en cours), stocks (surfaces levées :
     * [{ id, nom }]), stock (surface en cours), role, libelles ({ lignes, points }), libelleLigne,
     * libellePoint, ligne: { libelle, numero, nbPoints, fermee }, nomPropose, dernierPoint (nom), resume
     * (voir resumeStock), volume (remblai en m³, ou null), mode ('lever' ou 'controler'),
     * controle: { surfaceId, vueCoupes, demiLongueur, sourceOrientation, implantation ('point' ou 'surface') },
     * surfaces: [{ id, etiquette }], implanter: { accroche, choix: { est, nord, altitude, nom } ou null,
     * cible: { id, nom, est, nord, altitude } ou null, nomPropose, aImplanter: [{ id, nom, est, nord,
     * altitude, fait: { distance, dAltitude } ou null }], nbImplantations } }.
     */
    afficher(nouvellesDonnees) {
      if (nouvellesDonnees.recollement?.ouvrage !== donnees?.recollement?.ouvrage) {
        // Ouvrage ↔ conduite : diamètre et matériau gardés à part (voir main.js).
        saisieReseau.diametre = null;
        saisieReseau.materiau = null;
      }
      if (nouvellesDonnees.dernierPoint !== donnees?.dernierPoint || nouvellesDonnees.stock?.id !== donnees?.stock?.id) {
        saisieReseau.profondeurFouille = '';
        saisieReseau.remarque = '';
        saisieReseau.diametre = null; // repris de main.js (gardé d'un point à l'autre)
        saisieReseau.materiau = null;
      }
      donnees = nouvellesDonnees;
      dessiner();
    },

    /**
     * Touche « volume − » : prend le point comme le bouton, avec les mêmes vérifications.
     * Renvoie null si le point est demandé, sinon la raison du refus (texte).
     */
    prendreDepuisTouche() {
      const bouton = conteneur.querySelector('[data-action="prendre"]');
      if (!bouton) return 'pas de levé en cours';
      if (bouton.disabled) return etat?.connecte ? etat.raison ?? 'pas prêt' : 'récepteur non connecté';
      actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '', attributsReseau());
      return null;
    },

    /** Touche « volume − » pendant une implantation : enregistre, comme le bouton. Renvoie null, ou la raison du refus. */
    enregistrerDepuisTouche() {
      const bouton = conteneur.querySelector('[data-action="enregistrerImplantation"]');
      if (!bouton) return 'pas de point à implanter';
      if (bouton.disabled) return etat?.connecte ? etat.raison ?? 'pas prêt' : 'récepteur non connecté';
      actions.enregistrerImplantation();
      return null;
    },

    /**
     * Nouvel état du récepteur (5 fois par seconde). direct (calculé par main.js) :
     * { orientation: { azimut, source, cap, marche }, controle: { ecart, classe, altitudeSurface,
     *   altitudeCanne, message, coupes: { perpendiculaire, axe }, messageCoupes } ou null,
     *   implantation: { guidage (voir topo/accroche.js, avec azimut), classe, ecartAltitude,
     *   classeAltitude, message } ou null }.
     */
    /** Nouveau cap de la boussole de la tablette (°, 0 = nord), ou null s'il n'y en a pas. */
    mettreAJourBoussole(cap) {
      capBoussole = cap;
      tournerBoussole();
    },

    /** Guidage (0.153.0) : retour à l'écran de choix de la machine (onglet Guidage touché). */
    revenirAuChoixMachine() {
      machineChoisie = false;
      reglagesLameOuverts = false;
      dessiner();
    },

    /** Mode Lame : nombres en direct (voir lame-ecran.js rafraichirLame). */
    mettreAJourLame(vivant) {
      if (donnees?.mode === 'lame') rafraichirLame(conteneur, vivant);
    },

    mettreAJourRecepteur(nouvelEtat, nouveauDirect = null) {
      etat = nouvelEtat;
      direct = nouveauDirect;
      rafraichirVivant();
    },
  };

  /** Dessine tout l'écran avec les dernières données. */
  function dessiner() {
    if (!donnees) return;
    // Point ou ligne en cours d'implantation : écran de guidage (plan en haut, cible en bas).
    const { implantation } = donnees.controle;
    const autocontrole = donnees.mode === 'autocontrole';
    const enGuidage = (autocontrole && Boolean(donnees.autocontrole.cible)) || (donnees.mode === 'controler'
      && ((implantation === 'point' && Boolean(donnees.implanter.cible)) || (['ligne', 'talus'].includes(implantation) && Boolean(donnees.implanter.ligne) && !donnees.implanter.ligneAValider)));
    document.body.classList.toggle('vue-implantation', enGuidage);
    // 0.123 : Implanter › Surface / Altitude : la règle de hauteur est fixée à droite, sur toute la hauteur sous le plan.
    document.body.classList.toggle('regle-sous-plan', donnees.mode === 'controler' && !enGuidage && ['surface', 'altitude'].includes(implantation));
    // Barre d'accroche collée sous le plan (téléphone, voir style.css « avec-accroches »).
    const avecAccroches = donnees.mode === 'controler' && !enGuidage && ['point', 'ligne', 'talus'].includes(implantation);
    document.body.classList.toggle('avec-accroches', avecAccroches);
    document.body.classList.toggle('accroches-ouvertes', avecAccroches && accrochesOuvertes());
    if (!enGuidage || (!autocontrole && implantation !== 'point')) document.body.classList.remove('cible-en-haut');
    // Guidage (0.152.0) : vue « 2 coupes sans plan » : le plan est caché.
    document.body.classList.toggle('guidage-sans-plan', donnees.mode === 'lame' && donnees.lame?.vue === 'coupes');
    let contenu;
    if (enGuidage) contenu = vueImplantation();
    else if (autocontrole) contenu = htmlControle(donnees.autocontrole, { gestionOuverte: gestionControleOuverte, erreurGestion });
    else if (donnees.mode === 'lame') {
      // 0.153.0 : réglages jamais ouverts d'office (la roue ⚙ les montre ; le message rappelle ce qui manque) ;
      // d'abord le choix de la machine (Grader, Bull, Râteau), puis le guidage sans ce bandeau (← pour revenir).
      contenu = htmlLame(donnees.lame, { reglagesOuverts: reglagesLameOuverts, bip: donnees.controle.bip !== false, choixMachine: !machineChoisie });
    }
    else contenu = donnees.mode === 'controler' ? controle() : priseDePoint();
    conteneur.innerHTML = `
        <div class="ecran-terrain cadre-mode-${donnees.mode}">
          ${contenu}
        </div>`;
    rafraichirVivant();
    tournerBoussole();
    majFlechesChantier();
  }

  /** Flèches › des rangées de libellés et de natures du Chantier : visibles seulement s'il reste du contenu à droite. */
  function majFlechesChantier() {
    for (const defile of conteneur.querySelectorAll('[data-defile]')) {
      const fleche = conteneur.querySelector(`[data-fleche="${defile.dataset.defile}"]`);
      if (!fleche) continue;
      const maj = () => { fleche.hidden = !(defile.scrollWidth > defile.clientWidth + 2 && defile.scrollLeft + defile.clientWidth < defile.scrollWidth - 2); };
      maj();
      defile.addEventListener('scroll', maj, { passive: true });
    }
  }

  /** Tourne l'aiguille de la boussole selon le dernier cap de la tablette. */
  function tournerBoussole() {
    const aiguille = conteneur.querySelector('[data-vivant="aiguille"]');
    const texte = conteneur.querySelector('[data-vivant="texte-boussole"]');
    if (!aiguille) return;
    if (capBoussole == null) {
      if (texte) texte.textContent = 'boussole indisponible';
      return;
    }
    // Le nord est à « -cap » du haut de la tablette.
    aiguille.setAttribute('transform', `rotate(${(-capBoussole).toFixed(1)})`);
    if (texte) texte.textContent = `cap ${Math.round(capBoussole)}°`;
  }
}

/**
 * Cible autour du point à implanter (au centre) : 4 cercles (voir CIBLES) avec leur rayon écrit, et
 * la position du récepteur (rond de la couleur de la distance, voir couleurCanne). En haut : devant (cap RX2) ou le
 * nord. haut, droite : où est le point par rapport au récepteur (m). nord : direction du nord à
 * l'écran (°, sens des aiguilles d'une montre depuis le haut), marquée « N » sur le bord.
 */
/** Pente d'un tronçon (%), avec son signe : « −2.00 % ». */
function textePente(pente) {
  return `${pente < 0 ? '−' : pente > 0 ? '+' : ''}${Math.abs(pente).toFixed(2)} %`;
}

/** Flèche du sens d'écoulement d'un tronçon de a vers b (vers le plus bas). */
function flecheSens(sens, a, b) {
  if (sens === 'plat') return '<span class="sens-ecoulement">⟷ plat</span>';
  const vers = sens === 'a-b' ? b : a;
  return `<span class="sens-ecoulement" title="L'eau coule vers ${echapper(vers)}">${sens === 'a-b' ? '⟶' : '⟵'} ${echapper(vers)}</span>`;
}

function svgCible(numero, haut, droite, couleur, nordEnHaut, nord = 0) {
  const { cercles } = CIBLES[numero - 1];
  const echelle = 100 / cercles[0]; // le grand cercle fait 100 unités de rayon
  const texteRayon = (r) => (r >= 1 ? `${r} m` : `${Math.round(r * 100)} cm`);
  // Le récepteur est à l'opposé du point : s'il faut avancer, il est en dessous du centre.
  const limiter = (v) => Math.max(-108, Math.min(108, v));
  const x = limiter(-droite * echelle);
  const y = limiter(haut * echelle);
  // Nord : petit triangle rouge et « N » sur le bord, tourné de l'angle du nord.
  const marqueNord = `<g class="nord-cible" transform="rotate(${nord.toFixed(1)})">
      <path d="M0 -118 7 -104H-7Z" /><text y="-91" text-anchor="middle" transform="rotate(${(-nord).toFixed(1)} 0 -95)">N</text></g>`;
  return `<svg class="cible-implantation cible-${numero}" viewBox="-124 -124 248 248" role="img" aria-label="Cible ${texteRayon(cercles[0])}">
    ${cercles.map((r, i) => `<circle r="${r * echelle}" class="anneau anneau-${i}" />`).join('')}
    <circle r="${Math.max(0.02 * echelle, 4).toFixed(1)}" class="pastille-centre" />
    ${cercles.map((r) => `<text x="${(r * echelle * Math.SQRT1_2 + 2).toFixed(1)}" y="${(r * echelle * Math.SQRT1_2 + 12).toFixed(1)}" class="rayon">${texteRayon(r)}</text>`).join('')}
    <path d="M-110 0H110M0 -110V110" class="axes" />
    ${nordEnHaut ? '' : '<text x="-122" y="-112" class="haut-cible">▲ devant</text>'}
    ${marqueNord}
    <path d="M-7 0H7M0 -7V7" class="centre-cible" />
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="moi" style="fill: ${couleur}" />
  </svg>`;
}

/**
 * Flèche du guidage (0.118.0) : 'gauche', 'droite', 'monter' ou 'descendre' (dessin, couleur du texte).
 */
function iconeFleche(sens) {
  const traits = {
    gauche: 'M20 12H5M11 5l-7 7 7 7',
    droite: 'M4 12h15M13 5l7 7-7 7',
    monter: 'M12 20V5M5 11l7-7 7 7',
    descendre: 'M12 4v15M5 13l7 7 7-7',
  };
  return `<svg class="icone-fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="${traits[sens]}" /></svg>`;
}

/** Flèche en rond (0.123) : se tourner vers la droite ou la gauche. */
function iconeVirage(sens) {
  const trait = sens === 'droite' ? 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5' : 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5';
  return `<svg class="icone-fleche icone-virage" viewBox="0 0 24 24" aria-hidden="true"><path d="${trait}" /></svg>`;
}

/** Couleur du rond de la canne dans le couloir (0.118.0) : celle de la tolérance en plan. */
function couleurLaterale(classe) {
  return { vert: '#16a34a', orange: '#f59e0b', rouge: '#dc2626' }[classe] ?? '#9ca3af';
}

/**
 * Couloir vertical (0.118.0, refait en 0.118.1) : un tiers de l'écran à droite, sur toute la hauteur
 * des écarts. La ligne du début (drapeau vert, en bas) à la fin (damier, en haut) ; la canne à sa
 * place le long de la ligne (proportion abscisse / longueur) et sur le côté selon l'écart. Réglette
 * gris très clair à la distance la plus large de la bande (BANDES_COULOIR, comme le grand cercle
 * de la cible : 10 m, 2 m, 1 m, 20 cm), au bord. Fait en blocs HTML placés en % (pas en SVG) pour
 * remplir toute la case sans déformer le rond de la canne. ecart : m, + à droite.
 */
function htmlCouloirVertical(numero, ecart, abscisse, longueur, couleur, virage = '', { sansFleche = false } = {}) {
  const bandes = BANDES_COULOIR[numero];
  const haut = 18; // % : haut du trait (la fin)
  const bas = 76; // % : bas du trait (le début)
  const demi = 45; // % de la largeur : la bande la plus large
  const part = longueur > 0 ? abscisse / longueur : 0;
  // Avant le début ou après la fin : la canne dépasse un peu du trait.
  const top = Math.max(haut - 6, Math.min(bas + 6, bas - part * (bas - haut)));
  const left = 50 + Math.max(-demi, Math.min(demi, (ecart / bandes[0]) * demi));
  const texte = (r) => (r >= 1 ? `${r} m` : `${Math.round(r * 100)} cm`);
  // 0.118.2 : seulement la graduation la plus éloignée (la bande la plus large), juste pour un
  // aperçu de l'échelle ; sa distance écrite en haut à droite (0.123 : en bas, la flèche pour se tourner).
  const r = bandes[0];
  const reglettes = `<span class="reglette" style="left: ${50 - demi}%"></span><span class="reglette" style="left: ${50 + demi}%"></span>
    <span class="texte-reglette en-haut-coin au-bord" style="left: ${50 + demi}%">${texte(r)}</span>`;
  // 0.189.1 (maquette A du 10.11, tous les modes) : flèche perpendiculaire à la ligne, de la canne vers la ligne (du côté où il
  // faut aller), grosse pointe pour bien voir le sens ; l'écart écrit au-dessus. Cachée quand on est dans la tolérance.
  const versGauche = ecart > 0;
  // 0.208.0 : la flèche reste visible dans la tolérance (6 % au moins), sauf pile sur la ligne.
  const largeurFleche = ecart === 0 ? 0 : Math.max(Math.abs(left - 50), 6);
  const debutFleche = versGauche ? 50 : 50 - largeurFleche;
  // Écart écrit en mètres, 3 décimales comme sur le plan (0.208.0).
  const flecheCouloir = sansFleche || largeurFleche === 0 ? ''
    : `<span class="fleche-couloir ${versGauche ? 'vers-gauche' : 'vers-droite'}" style="left: ${debutFleche.toFixed(1)}%; width: ${largeurFleche.toFixed(1)}%; top: ${top.toFixed(1)}%; --couleur-fleche: ${couleur}"><b class="mot-fleche">${ecart === 0 ? '' : `${Math.abs(ecart).toFixed(3)} m`}</b><i class="pointe"></i><i class="tige"></i></span>`;
  return `<div class="cadre-couloir" role="img" aria-label="Position de la canne le long de la ligne">
    ${reglettes}
    <span class="trait-couloir" style="top: ${haut}%; bottom: ${100 - bas}%"></span>
    <span class="bout-couloir" style="top: ${haut}%"></span>
    <span class="bout-couloir" style="top: ${bas}%"></span>
    <span class="drapeau-couloir fin" style="top: ${haut}%">${iconeDrapeau('fin')}</span>
    <span class="drapeau-couloir debut" style="top: ${bas}%">${iconeDrapeau('debut')}</span>
    ${flecheCouloir}
    <span class="moi-couloir" style="left: ${left.toFixed(1)}%; top: ${top.toFixed(1)}%; background: ${couleur}"></span>
    ${virage}
  </div>`;
}

/**
 * Bandeaux sous l'en-tête, dans tous les onglets, quand le récepteur est connecté :
 * « RTK FIXE » (vert) ou autre (rouge), « Inclinaison PRÊTE » (vert) ou « NON PRÊTE » (rouge).
 */
/**
 * Bandeaux sous l'en-tête : état du RX2 (RTK, inclinaison) ; sans RX2 connecté mais avec le GPS de
 * la tablette (tablette : { precision } ou null), « GPS tablette ± x m » bien marqué.
 */
// Vrai dès que le RTK fixe a été reçu une fois : sa perte fait clignoter la barre du récepteur.
let fixeDejaVu = false;

export function mettreAJourBandeaux(etat, tablette = null, hauteurCanne = null) {
  let bandeaux = document.querySelector('#bandeaux-recepteur');
  if (!bandeaux) {
    bandeaux = document.createElement('div');
    bandeaux.id = 'bandeaux-recepteur';
    bandeaux.className = 'bandeaux-recepteur';
    bandeaux.setAttribute('role', 'status');
    bandeaux.title = 'Récepteur : toucher pour connecter ou régler';
    // 0.138.0 (liste du 05.11, point 7) : 4 cases, chacune avec l'important en gros et le détail en petit dessous :
    // état RTK (satellites), Z du bout de la canne (précision H / V), hauteur de canne, inclinaison (angle, âge des corrections).
    bandeaux.innerHTML = ['rtk', 'z', 'canne', 'inclinaison'].map((cle) => `<div class="case-recepteur" data-bandeau="${cle}"><b></b><small></small></div>`).join('');
    bandeaux.addEventListener('click', () => document.dispatchEvent(new CustomEvent('ouvrir-recepteur')));
    document.querySelector('.entete').append(bandeaux);
  }
  // Toujours visible (appli Android) : c'est l'accès au récepteur.
  document.body.classList.add('avec-recepteur');
  const cases = Object.fromEntries([...bandeaux.querySelectorAll('[data-bandeau]')].map((c) => [c.dataset.bandeau, c]));
  /** Remplit une case : texte en gros, détail en petit, classe de couleur ; null = case cachée. */
  const remplir = (cle, grand, petit = '', classe = 'info') => {
    const c = cases[cle];
    c.hidden = grand == null;
    c.className = `case-recepteur ${classe}`;
    c.querySelector('b').textContent = grand ?? '';
    c.querySelector('small').textContent = petit;
    c.querySelector('small').hidden = !petit;
  };
  const canne = hauteurCanne != null ? formaterNombre(hauteurCanne) : null;
  if (!etat?.connecte && !tablette) {
    remplir('rtk', 'Récepteur non connecté', '', 'attente');
    remplir('z', null);
    remplir('canne', null);
    remplir('inclinaison', 'Toucher pour connecter', '', 'attente');
    return;
  }
  if (!etat?.connecte) {
    remplir('rtk', 'GPS TABLETTE', `± ${Math.max(1, Math.round(tablette.precision ?? 0))} m`, 'tablette');
    remplir('z', null);
    remplir('canne', null);
    remplir('inclinaison', 'GNSS non connecté', '', 'attente');
    return;
  }
  const age = etat.ageCorrections != null ? `corr. ${Math.round(etat.ageCorrections)} s` : '';
  if (!etat.recu) {
    remplir('rtk', 'En attente…', '', 'attente');
    remplir('z', 'Z —', '', 'info');
  } else {
    const statut = { 1: 'AUTONOME', 2: 'DGPS', 4: 'FIXE', 5: 'FLOTTANT' }[etat.qualite] ?? (etat.libelleQualite ?? '?').toUpperCase();
    // Le RTK fixe était là puis il est perdu : la case clignote jusqu'à son retour (0.114.0).
    if (etat.qualite === 4) fixeDejaVu = true;
    remplir('rtk', statut, etat.nbSatellites != null ? `${etat.nbSatellites} sat` : '', etat.qualite === 4 ? 'ok' : `pas-ok${fixeDejaVu ? ' fixe-perdu' : ''}`);
    // Z = altitude du bout de la canne envoyée par le GNSS (position compensée), comme partout dans l'appli.
    const z = etat.position?.altitude;
    const precision = etat.precisionH != null || etat.precisionV != null ? `H ${formaterNombre(etat.precisionH)} V ${formaterNombre(etat.precisionV)}` : '';
    remplir('z', `Z ${z != null ? formaterNombre(z) : '—'}`, precision, 'info');
  }
  // Hauteur de canne (0.107.1) : seulement montrée, pour contrôle (tapée en Expert dans la fenêtre du récepteur).
  remplir('canne', canne ?? '—', 'canne', 'info-canne');
  // Inclinaison toujours montrée (0.114.1) : on voit tout de suite s'il faut recalibrer.
  if (etat.etatInclinaison == null) {
    remplir('inclinaison', '?', ['incl.', age].filter(Boolean).join(' · '), 'attente');
  } else {
    const angle = etat.inclinaison != null ? `${etat.inclinaison.toFixed(0)}°` : '';
    remplir('inclinaison', etat.inclinaisonPrete ? 'PRÊTE' : 'NON PRÊTE', [`incl. ${angle}`.trim(), age].filter(Boolean).join(' · '), etat.inclinaisonPrete ? 'ok' : 'pas-ok');
  }
  // Tablette : « Incl. » devant, en gros (place suffisante) ; téléphone : seulement dans le détail.
  const motIncl = cases.inclinaison.querySelector('b');
  if (!document.body.classList.contains('mode-telephone')) {
    motIncl.textContent = `Incl. ${motIncl.textContent}`;
    const detail = cases.inclinaison.querySelector('small');
    detail.textContent = detail.textContent.replace(/^incl\.\s*(· )?/, '');
    detail.hidden = !detail.textContent;
  }
}
