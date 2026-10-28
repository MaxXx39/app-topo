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
import { htmlControle } from './controle-ecran.js';
import { htmlLame, rafraichirLame } from './lame-ecran.js';
import { bulle } from '../aide/bulles.js';
import { svgDrapeau, iconeDrapeau } from '../outils/drapeaux.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';
import { ROLES_METRE } from '../topo/metre.js';
import { svgCoupeDirecte } from './coupe-directe.js';
import { svgCoupeTalus } from './coupe-talus.js';
import { svgCroquisTalus } from './croquis-talus.js';
import { penteSignee } from '../topo/talus.js';
import { MODES_ACCROCHE, CIBLES, cibleSelonDistance, ecartsGuidage, couleurCanne } from '../topo/accroche.js';
// Couloir de l'implantation d'une ligne : bandes de chaque côté, plus fines en s'approchant
// (loin : 10, 5, 2, 1 m, puis les mêmes que les cercles de la cible).
const BANDES_COULOIR = [[10, 5, 2, 1], ...CIBLES.map((c) => c.cercles)];
import { ouvrirFenetrePointTape, ouvrirListePoints } from './fenetres-points.js';
import { ouvrirFenetreLibelles } from './fenetre-libelles.js';

// Mode Contrôler : ce qu'on implante (point, ligne, talus, surface), vue des coupes, longueurs.
const IMPLANTATIONS = [
  ['point', 'Point', true],
  ['ligne', 'Ligne', true],
  ['surface', 'Surface', true],
  ['talus', 'Talus', true], // tout à droite (demande du 26.10.2026)
];
// Talus : Expert seulement. Base : on ne lève que des « Levé libre » (points seulement).
const IMPLANTATIONS_EXPERT = ['talus'];
const NATURES_BASE = ['autres'];
const VUES_COUPES = [
  ['les2', 'Les 2'],
  ['perpendiculaire', 'Perpendiculaire'],
  ['axe', 'Dans l\'axe'],
];
export const LONGUEURS_COUPE = [2, 5, 10, 20];
// Ce que l'on lève : une surface (même choix que « + Nouvelle surface » dans Calculs › Surfaces)
// ou un métré (aires, longueurs, points comptés : des mesures de Calculs › Mesures / métrés).
const NATURES_TERRAIN = [
  ['stock', 'Stock'],
  ['terrain', 'Terrain'], // terrain naturel et terrassement fusionnés (0.87.0)
  ['recollement', 'Recollement'], // Intermédiaire et Expert ; se comporte comme Terrain (à approfondir)
  ['metre', 'Métré'],
  ['autres', 'Levé libre'],
  // Surface d'un dessin (Calculs › Dessin) : pas créée ici, mais on la complète au RX2.
  ['surface', 'Surface'],
];
// Accroches : un dessin (en gris ce qu'on touche, en ambre l'endroit accroché) et un mot dessous.
// [mot, nom complet (bulle, lecture d'écran), dessin].
export const ACCROCHES = {
  // Implantation d'une ligne : la ligne entière du plan DXF (polyligne).
  trait: ['Ligne DXF', 'Ligne entière du plan DXF (polyligne)', '<path class="repere-trait" d="M3 18 9 8l6 6 6-9" /><circle cx="3" cy="18" r="1.6" /><circle cx="21" cy="5" r="1.6" />'],
  // Point du projet : le même rond gris que les points du plan, entouré d'ambre (accroché).
  point: ['Point', 'Point du projet (levé ou importé)', '<circle class="anneau-accroche" cx="12" cy="12" r="8" /><circle class="rond-point" cx="12" cy="12" r="4.5" />'],
  sommet: ['Sommet', 'Sommet d\'une ligne du plan DXF', '<path d="M3 20 12 6l9 14" /><rect class="repere" x="9" y="3" width="6" height="6" />'],
  milieu: ['Milieu', 'Milieu d\'un segment du plan DXF', '<path d="M2 17h20" /><circle cx="2.5" cy="17" r="1.5" /><circle cx="21.5" cy="17" r="1.5" /><path class="repere" d="M12 8l5 9H7z" />'],
  ligne: ['Sur ligne', 'Sur une ligne du plan DXF (endroit le plus proche)', '<path d="M3 21 21 3" /><path class="repere" d="M8 8l8 8M16 8l-8 8" />'],
  centre: ['Centre', 'Centre d\'un cercle du plan DXF', '<circle cx="12" cy="12" r="9" /><circle class="repere" cx="12" cy="12" r="2.5" />'],
};
// Guidage vers le point : par rapport au cap du RX2 (avance / droite) ou nord / sud / est / ouest.
const GUIDAGES = [
  ['rx2', 'Cap GNSS'],
  ['nseo', 'N-S-E-O'],
];
const TITRES_COUPES = {
  perpendiculaire: { titre: 'Perpendiculaire', gauche: '← gauche', droite: 'droite →' },
  axe: { titre: 'Dans l\'axe', gauche: '← derrière', droite: 'devant →' },
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
 * annulerDernierPoint(), choisirLibelle(abréviation), enregistrerLibelles({ lignes, points, aires }),
 * choisirMode(mode), choisirSurfaceControle(id), choisirVueCoupes(vue),
 * choisirLongueurCoupe(m), choisirExagerationCoupe(facteur), choisirSourceOrientation(source),
 * choisirImplantation(quoi), choisirAccroche(mode), trouverPoint(nom), choisirGuidage('rx2' ou 'nseo'),
 * implanterChoix({ nom, altitude }),
 * creerPointAImplanter({ nom, altitude }), implanterPoint(id), supprimerPointAImplanter(id),
 * arreterImplantation(), oublierChoix(), enregistrerImplantation(), exporterImplantations(),
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
  let bandeCouloir = 0; // échelle du couloir de la ligne (n° dans BANDES_COULOIR)
  let capBoussole = null; // dernier cap de la boussole de la tablette (°), ou null
  let reglagesGuidageOuverts = false; // roue ⚙ de l'écran de guidage
  const elementsOuverts = new Set(); // lignes du levé dépliées en bas de Lever ('contour', 'ligne-2', 'isoles')
  let accrochesOuvertes = false; // flèche de la barre d'accroche : les noms sous les dessins
  let gestionControleOuverte = false; // mode Contrôler : roue ⚙ (après le code de sécurité)
  let erreurGestion = ''; // mode Contrôler : erreur de la gestion (tolérances, fichier, point tapé)
  let reglagesLameOuverts = false; // mode Lame : roue ⚙ (tolérances)

  // Lignes du levé dépliées : gardées d'un dessin de l'écran à l'autre.
  conteneur.addEventListener('toggle', (evenement) => {
    const cle = evenement.target.dataset?.element;
    if (!cle) return;
    if (evenement.target.open) elementsOuverts.add(cle);
    else elementsOuverts.delete(cle);
  }, true);

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action } = bouton.dataset;
    if (action === 'ouvrirChoixNature' || action === 'fermerChoixNature') {
      choixNatureOuvert = action === 'ouvrirChoixNature';
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
      demanderTexte({ titre: 'Nom du levé', valeur: donnees.stock.nom }).then((nom) => {
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
      accrochesOuvertes = !accrochesOuvertes;
      dessiner();
      return;
    }
    if (action === 'garderPointChoisi') {
      actions.garderPointChoisi(conteneur.querySelector('[data-champ="nom-implantation"]')?.value ?? '');
      return;
    }
    if (action === 'basculerReglagesGuidage') {
      reglagesGuidageOuverts = !reglagesGuidageOuverts;
      dessiner();
      return;
    }
    if (action === 'ouvrirLibelles') {
      // Fenêtre à part, « Enregistrer » toujours visible en bas (voir fenetre-libelles.js).
      const sorte = sorteDuRole();
      const titres = { lignes: 'Libellés des lignes (L-…)', points: 'Libellés des points (P-…)', aires: 'Libellés des aires (A-…)' };
      ouvrirFenetreLibelles({
        titre: titres[sorte],
        liste: donnees.libelles[sorte],
        couleurParDefaut: { lignes: '#ea580c', points: '#15803d', aires: '#0891b2' }[sorte],
        enregistrer: (liste) => actions.enregistrerLibelles({ ...donnees.libelles, [sorte]: liste }),
      });
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
    if (action === 'nouvelleSurface') choixNatureOuvert = false;
    if (action === 'implanterChoix' || action === 'creerPointAImplanter') {
      const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`)?.value ?? '';
      actions[action]({ nom: champ('nom-implantation'), altitude: champ('altitude-implantation') });
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
    if (action === 'prendre') actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '');
    else if (action === 'role') actions.choisirRole(bouton.dataset.role);
    else actions[action]?.(bouton.dataset.valeur);
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'surface-controle') actions.choisirSurfaceControle(cible.value);
    else if (cible.dataset.champ === 'surface-lame') actions.choisirSurfaceLame(cible.value);
    else if (cible.dataset.toleranceLame) actions.reglerToleranceLame(cible.dataset.toleranceLame, cible.value);
    else if (cible.dataset.profilLame) actions.reglerProfilLame(cible.dataset.profilLame, cible.value);
    else if (cible.dataset.reglageLigne) actions.reglerLigne(cible.dataset.reglageLigne, cible.value);
    else if (cible.dataset.reglageTalus) actions.reglerTalus(cible.dataset.reglageTalus, cible.value);
    else if (cible.dataset.champ === 'remarque-controle') actions.remarqueControle(cible.dataset.id, cible.value);
    else if (cible.dataset.champ === 'photo-levee' && cible.files?.length) {
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
    const hauteur = g.ecartAltitude == null
      ? ''
      : `<span class="hauteur-guidage ${g.classeAltitude}">${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(g.ecartAltitude)}</span>`;
    cibleAffichee = cibleSelonDistance(distance, cibleAffichee);
    // Flèche vers le point : par rapport à la direction regardée, sinon par rapport au nord.
    const angle = nordEnHaut ? direction : direction - azimut;
    // Près du point (moins de 2 m) : la cible remplace le plan en haut de l'écran (téléphone), le
    // nord toujours marqué dessus ; loin : le plan en haut, la flèche avec les textes.
    const nord = nordEnHaut ? 0 : -azimut;
    montrerCibleEnHaut(haut, cibleAffichee > 0 ? { svg: svgCible(cibleAffichee, avance, droite, couleurCanne(distance), nordEnHaut, nord), classe: g.classe } : null);
    const dessin = cibleAffichee > 0
      ? ''
      : `<svg class="fleche-guidage" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -17 11 6 0 0 -11 6Z" transform="rotate(${angle.toFixed(1)})" /></svg>`;
    zone.className = `guidage-direct ${g.classe} ${cibleAffichee > 0 ? 'avec-cible' : ''}`;
    zone.innerHTML = `
      ${dessin}
      <span class="lignes-guidage">${lignes.map((texte) => `<span>${texte}</span>`).join('')}</span>
      <span class="distance-guidage">${formaterNombre(distance)} m${nordEnHaut ? ' · nord en haut' : ''}</span>
      ${hauteur}`;
  }

  /**
   * Cible en haut de l'écran (à la place du plan, voir style.css « cible-en-haut »), ou rien.
   * cible : { svg, classe (couleur de la distance) } ou null.
   */
  function montrerCibleEnHaut(zone, cible) {
    document.body.classList.toggle('cible-en-haut', Boolean(zone && cible));
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
        zone.innerHTML = `<span class="message-ecart">${echapper(c?.message ?? 'Choisis une surface')}</span>`;
      } else {
        const monter = c.ecart >= 0;
        zone.className = `ecart-direct ${c.classe}`;
        zone.innerHTML = `<span class="fleche-ecart">${monter ? '↑' : '↓'}</span>
          <span class="valeur-ecart">${monter ? 'Monter' : 'Descendre'} ${formaterNombre(Math.abs(c.ecart))} m</span>
          <span class="detail-ecart">surface ${formaterNombre(c.altitudeSurface)} · canne ${formaterNombre(c.altitudeCanne)}</span>`;
      }
    }
    for (const sens of ['perpendiculaire', 'axe']) {
      const cadre = conteneur.querySelector(`[data-vivant="coupe-${sens}"]`);
      if (!cadre) continue;
      const coupe = c?.coupes?.[sens];
      cadre.innerHTML = coupe
        ? svgCoupeDirecte({ ...TITRES_COUPES[sens], ...coupe, classe: c.classe, sens, exageration: donnees.controle.exagerationCoupe })
        : `<p class="aide">${TITRES_COUPES[sens].titre} : ${c?.messageCoupes ?? 'en attente de la position'}</p>`;
    }
  }

  /** Petits boutons au choix (un seul actif). */
  function boutonsChoix(action, choix, actif) {
    return choix
      .map(([cle, titre, permis = true]) => `<button type="button" class="puce-choix ${String(cle) === String(actif) ? 'actif' : ''}" data-action="${action}" data-valeur="${cle}" ${permis ? '' : 'disabled title="bientôt"'}>${titre}</button>`)
      .join('');
  }

  /** Mode Contrôler : quoi implanter, surface, écart en grand, coupes et leurs réglages. */
  function controle() {
    const { controle: reglages, surfaces } = donnees;
    // Coupes directes : en Base, dans l'axe seulement (perpendiculaire, longueur et hauteurs dès Intermédiaire).
    const vue = estModeBase() ? 'axe' : reglages.vueCoupes;
    const choixImplantation = `<div class="choix-implantation-type" role="group" aria-label="Implanter">${boutonsChoix('choisirImplantation', IMPLANTATIONS.filter(([cle]) => aAcces('expert') || !IMPLANTATIONS_EXPERT.includes(cle)), reglages.implantation)} ${bulle('implanter')}</div>`;
    // Rien de choisi : on le rappelle bien en vue (après « ← », on ne savait plus quoi faire).
    const imp = donnees.implanter;
    if (reglages.implantation === 'point') {
      const invite = imp.choix ? '' : invitation('Choisis le point à implanter', 'touche-le sur le plan, ou « Liste »');
      return barreAccroche() + choixImplantation + invite + implanterPoint();
    }
    if (reglages.implantation === 'ligne') {
      const invite = imp.pointsLigne.length > 0 ? '' : invitation('Choisis la ligne à implanter', 'touche-la sur le plan, ou ses points un à un');
      return barreAccroche() + choixImplantation + invite + implanterLigne();
    }
    if (reglages.implantation === 'talus') {
      const invite = imp.pointsLigne.length > 0 ? '' : invitation('Choisis la ligne du talus (haut ou bas)', 'touche-la sur le plan, ou ses points un à un');
      return barreAccroche() + choixImplantation + invite + implanterLigne() + mesTalus();
    }
    return `
      ${choixImplantation}
      ${surfaces.length > 0
        ? `<select data-champ="surface-controle" aria-label="Surface à contrôler">
            ${reglages.surfaceId ? '' : '<option value="">— choisir une surface —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === reglages.surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucune surface.</p>'}
      <div class="ecart-direct attente" data-vivant="ecart"></div>
      <div class="coupes-directes vue-${vue}">
        ${vue !== 'axe' ? '<div data-vivant="coupe-perpendiculaire"></div>' : ''}
        ${vue !== 'perpendiculaire' ? '<div data-vivant="coupe-axe"></div>' : ''}
      </div>
      <div class="ligne-choix seulement-intermediaire"><span>Coupes</span>${boutonsChoix('choisirVueCoupes', VUES_COUPES, vue)}</div>
      <div class="ligne-choix seulement-intermediaire"><span>Longueur</span>${boutonsChoix('choisirLongueurCoupe', LONGUEURS_COUPE.map((m) => [m, `${m} m`]), reglages.demiLongueur)}<span class="aide">de chaque côté</span></div>
      <div class="ligne-choix seulement-intermediaire"><span>Hauteurs</span>${boutonsChoix('choisirExagerationCoupe', [[1, '×1'], [2, '×2']], reglages.exagerationCoupe)}</div>
      <div class="ligne-choix"><span>Orientation</span>${boutonsChoix('choisirSourceOrientation', [['rx2', 'Cap GNSS'], ['marche', 'Marche']], reglages.sourceOrientation)}</div>
      <p class="aide" data-vivant="orientation"></p>`;
  }

  /** Bandeau sarcelle bien visible : ce qu'il faut faire maintenant (flèche vers le plan). */
  function invitation(titre, detail) {
    return `<div class="invite-choix" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6" /></svg>
      <span><strong>${titre}</strong><span>${detail}</span></span>
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
    const modes = enLigne ? ['trait', ...MODES_ACCROCHE] : MODES_ACCROCHE;
    const active = enLigne ? imp.accrocheLigne : imp.accroche;
    // Accroche « Point » : un point tapé (+ Point, pas pour une ligne) ou choisi dans la liste.
    const outilsPoint = active === 'point'
      ? `<span class="separateur-accroche"></span>
        ${enLigne ? '' : '<button type="button" class="bouton-outil-accroche" data-action="ouvrirFormulairePoint" title="Taper un point (Est, Nord, H)">+ Point</button>'}
        <button type="button" class="bouton-outil-accroche" data-action="ouvrirListePoints" title="Choisir un point dans la liste du projet">Liste</button>`
      : '';
    return `<div class="barre-accroche ${enLigne ? 'accroches-ligne' : ''} ${accrochesOuvertes ? 'ouverte' : ''}">
      <div class="accroches" role="group" aria-label="Accroche : ce que l'on prend en touchant le plan">
        ${modes.map((mode) => {
          const [mot, nom, dessin] = ACCROCHES[mode];
          return `<button type="button" class="bouton-accroche ${active === mode ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${mode}" title="${nom}" aria-label="${nom}" aria-pressed="${active === mode}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg><span class="mot-accroche">${mot}</span></button>`;
        }).join('')}
        ${outilsPoint}
        <button type="button" class="bouton-deplier-accroches" data-action="basculerAccroches" title="${accrochesOuvertes ? 'Cacher' : 'Voir'} les noms" aria-label="${accrochesOuvertes ? 'Cacher' : 'Voir'} les noms des accroches" aria-expanded="${accrochesOuvertes}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${accrochesOuvertes ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" /></svg></button>
      </div>
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

  /** « 3 implantation(s) enregistrée(s) · exporter (CSV) », ou rien. */
  function lienExport() {
    const nombre = donnees.implanter.nbImplantations;
    return nombre > 0
      ? `<p class="aide seulement-expert">${nombre} implantation(s) enregistrée(s) · <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterImplantations">exporter (CSV)</button></p>`
      : '';
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
    // La canne est trop à droite (écart > 0) : il faut aller à gauche.
    const sens = Math.abs(ecart) < 0.0005 ? 'Sur la ligne' : `${ecart > 0 ? '← Gauche' : '→ Droite'} ${m(ecart)}`;
    // Position le long : + depuis le début, − avant le début (demande du 23.10.2026). Début et fin sur
    // deux lignes, de la même taille que gauche / droite (0.84.0).
    let le_long;
    if (abscisse < 0) le_long = [`−${m(abscisse)}`];
    else if (abscisse > longueur) le_long = [`Après la fin : ${m(abscisse - longueur)}`];
    else le_long = [`début ${m(abscisse)}`, `fin ${m(reste)}`];
    const hauteur = g.ecartAltitude == null
      ? ''
      : `<span class="hauteur-guidage ${g.classeAltitude}">${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(g.ecartAltitude)}</span>`;
    zone.className = `guidage-direct guidage-ligne ${g.classe}`;
    zone.innerHTML = `
      ${svgCouloir(bandeCouloir, ecart, abscisse, longueur, couleurCanne(Math.abs(ecart)))}
      <span class="lignes-guidage"><span>${sens}</span>${le_long.map((texte) => `<span>${texte}</span>`).join('')}</span>
      ${hauteur}`;
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
            ${imp.choixDuProjet ? '' : '<button type="button" class="bouton-secondaire" data-action="garderPointChoisi" title="Garder ce point dans le projet (levé « Points ajoutés »)">+ Point du projet</button>'}
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
      ? `<strong>${echapper(imp.ligne.nom)}</strong> · ${formaterNombre(imp.ligne.longueur)} m`
      : `${autocontrole ? 'Contrôle de' : 'Vers'} <strong>${echapper(cibleGuidee().nom ?? 'le point choisi')}</strong>`;
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
      <div class="entete-guidage">
        <button type="button" class="bouton-retour" data-action="${ligne ? 'changerLigne' : autocontrole ? 'arreterControle' : 'arreterImplantation'}" title="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}" aria-label="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <p class="titre-vue-guidage">${titre}</p>
        ${ligne ? '<button type="button" class="bouton-retour" data-action="inverserLigne" title="Inverser le sens" aria-label="Inverser le sens">⇄</button>' : ''}
        ${!ligne && !autocontrole && imp.suivant ? `<button type="button" class="bouton-suivant" data-action="implanterSuivant" title="Implanter le point suivant : ${echapper(imp.suivant)}" aria-label="Point suivant : ${echapper(imp.suivant)}">${echapper(imp.suivant)} ▶</button>` : ''}
        <button type="button" class="bouton-retour ${ouverts ? 'actif' : ''}" data-action="basculerReglagesGuidage" title="Réglages de l'implantation" aria-label="Réglages de l'implantation" aria-expanded="${ouverts}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></button>
      </div>
      ${ouverts ? (talus ? reglagesTalus() : reglagesGuidage(ligne)) : ''}
      ${ligne ? detailLigne() : detailPoint()}
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
      <div class="ligne-choix"><span>Orientation</span>${boutonsChoix('choisirSourceOrientation', [['rx2', 'Cap GNSS'], ['marche', 'Marche']], reglages.sourceOrientation)}</div>
      ${ligne && l.nbSegments > 1 ? `<div class="ligne-choix"><span>Ligne</span>${boutonsChoix('choisirSegment', [['tout', 'Toute'], ['segment', 'Segment par segment']], l.segment == null ? 'tout' : 'segment')}</div>` : ''}
      ${ligne ? `<label class="champ-decalage">Décalage parallèle (m)<input type="text" inputmode="decimal" data-reglage-ligne="decalage" value="${l.decalage ? l.decalage.toFixed(3) : ''}" placeholder="+ à droite, − à gauche" /></label>` : ''}
      <p class="aide" data-vivant="orientation"></p>
    </div>`;
  }

  /** Point implanté : coordonnées et altitude, sur une ligne. */
  function detailPoint() {
    const c = cibleGuidee();
    return `<p class="coordonnees-cible"><span class="coord-en">E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}</span>${c.altitude != null ? `<span class="coord-h">H ${formaterNombre(c.altitude)}</span>` : ''}</p>`;
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
    return `<div class="choix-nature">
      <p class="titre-choix">Que lèves-tu ?</p>
      <div class="natures-terrain">
        ${NATURES_TERRAIN.filter(([cle]) => cle !== 'surface' && (!estModeBase() || NATURES_BASE.includes(cle))).map(([cle, titre]) => `<button type="button" class="bouton-nature nature-${cle}" data-action="nouvelleSurface" data-valeur="${cle}">${titre}</button>`).join('')}
      </div>
      ${donnees.stock ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerChoixNature">annuler</button>' : ''}
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
        <button type="button" class="bouton-secondaire" data-action="changerLevee" ${donnees.stocks.length > 1 || !estModeBase() ? '' : 'disabled'}>Changer</button>
        <button type="button" class="bouton-secondaire" data-action="ouvrirChoixNature">+ Nouveau</button>
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
        <span>${LETTRES_METRE[donnees.role]}-${echapper(e.libelle)}-${e.numero} · ${e.nbPoints} pt(s)</span>
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
        <strong>L-${echapper(ligne.libelle ?? '')}-${ligne.numero}</strong><span>${ligne.nbPoints} pt(s)</span>
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
    // Liste de libellés selon le rôle : aires (métré), lignes (lignes de rupture, longueurs), points.
    const sorte = sorteDuRole();
    const liste = donnees.libelles[sorte];
    const actif = { aires: donnees.libelleAire, lignes: donnees.libelleLigne, points: donnees.libellePoint }[sorte];
    return `<div class="libelles-terrain seulement-intermediaire pour-${sorte} ${donnees.metre ? 'dans-metre' : ''}" role="group" aria-label="Ce que l'on lève">
      ${liste.map(([abreviation, signification, couleur]) => `<button type="button" class="puce-libelle ${abreviation === actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur="${echapper(abreviation)}">
          <strong>${couleur ? `<i class="pastille-libelle" style="background: ${couleur}"></i>` : ''}${echapper(abreviation)}</strong><span>${echapper(signification)}</span></button>`).join('')}
      <button type="button" class="bouton-crayon-libelles seulement-intermediaire" data-action="ouvrirLibelles" title="Modifier les libellés" aria-label="Modifier les libellés">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></svg></button>
    </div>
`;
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
    return `
      ${ligneSurface()}
      ${boutonsRoles()}
      <div class="cadre-role role-${donnees.role} ${classeOnglet()}">
      ${donnees.role === 'ligne' ? '' : choixLibelle()}
      ${outilsLigne()}
      <div class="cadre-prise">
        <span class="titre-cadre-prise">Point</span>
        <div class="ligne-id-prendre">
          <label class="champ-id-point"><span>ID point</span>
            <input type="text" class="nom-point" data-champ="nom-point" value="${echapper(donnees.nomPropose)}" autocomplete="off" autocapitalize="characters" aria-label="Nom du prochain point" /></label>
          <label class="bouton-photo-levee" title="Photo du levé" aria-label="Photo du levé">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_PHOTO}</svg>
            <input type="file" data-champ="photo-levee" accept="image/*" capture="environment" hidden />
          </label>
          <button type="button" class="bouton bouton-prendre" data-action="prendre" title="Enregistrer le point (ou touche volume −)" disabled>
            <span>Enreg. Pts</span><span class="sous-titre-prendre">ou touche vol −</span>
          </button>
        </div>
        <div class="position-leve" data-vivant="position"></div>
        <p class="raison-leve" data-vivant="raison" hidden></p>
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}>
          Annuler ${donnees.dernierPoint ? echapper(donnees.dernierPoint) : 'le dernier point'}</button>
      </div>
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
              <input type="text" data-champ="legende-photo-levee" data-id="${photo.id}" value="${echapper(photo.legende ?? '')}" placeholder="Légende" aria-label="Légende de la photo" />
              <button type="button" class="bouton-lien" data-action="supprimerPhotoLevee" data-valeur="${photo.id}">supprimer</button>
            </figure>`).join('')}</div>
        </div>`
      : '';
    const elements = listeElements();
    return elements || triangles || listePhotos ? `<div class="bas-du-leve">${elements}${triangles}${listePhotos}</div>` : '';
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
      donnees = nouvellesDonnees;
      dessiner();
    },

    /**
     * Touche « volume − » : prend le point comme le bouton, avec les mêmes vérifications.
     * Renvoie null si le point est demandé, sinon la raison du refus (texte).
     */
    prendreDepuisTouche() {
      const bouton = conteneur.querySelector('[data-action="prendre"]');
      if (!bouton) return 'pas de surface en cours';
      if (bouton.disabled) return etat?.connecte ? etat.raison ?? 'pas prêt' : 'récepteur non connecté';
      actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '');
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
      && ((implantation === 'point' && Boolean(donnees.implanter.cible)) || (['ligne', 'talus'].includes(implantation) && Boolean(donnees.implanter.ligne))));
    document.body.classList.toggle('vue-implantation', enGuidage);
    // Barre d'accroche collée sous le plan (téléphone, voir style.css « avec-accroches »).
    const avecAccroches = donnees.mode === 'controler' && !enGuidage && ['point', 'ligne', 'talus'].includes(implantation);
    document.body.classList.toggle('avec-accroches', avecAccroches);
    document.body.classList.toggle('accroches-ouvertes', avecAccroches && accrochesOuvertes);
    if (!enGuidage || (!autocontrole && implantation !== 'point')) document.body.classList.remove('cible-en-haut');
    let contenu;
    if (enGuidage) contenu = vueImplantation();
    else if (autocontrole) contenu = htmlControle(donnees.autocontrole, { gestionOuverte: gestionControleOuverte, erreurGestion });
    else if (donnees.mode === 'lame') contenu = htmlLame(donnees.lame, { reglagesOuverts: reglagesLameOuverts });
    else contenu = donnees.mode === 'controler' ? controle() : priseDePoint();
    conteneur.innerHTML = `
        <div class="ecran-terrain cadre-mode-${donnees.mode}">
          ${contenu}
        </div>`;
    rafraichirVivant();
    tournerBoussole();
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
    ${cercles.map((r) => `<text x="${(r * echelle * Math.SQRT1_2 + 2).toFixed(1)}" y="${(r * echelle * Math.SQRT1_2 + 12).toFixed(1)}" class="rayon">${texteRayon(r)}</text>`).join('')}
    <path d="M-110 0H110M0 -110V110" class="axes" />
    ${nordEnHaut ? '' : '<text x="-122" y="-112" class="haut-cible">▲ devant</text>'}
    ${marqueNord}
    <path d="M-7 0H7M0 -7V7" class="centre-cible" />
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="moi" style="fill: ${couleur}" />
  </svg>`;
}

/**
 * Couloir de l'implantation d'une ligne : seulement la ligne (ou sa parallèle) en trait vertical au
 * milieu, du début (en bas) vers la fin (en haut), et la canne (rond de la couleur de la distance) à
 * sa place : à droite si elle est à droite. Pas de bandes autour (demande du 26.10.2026) : la
 * distance écrite et la couleur suffisent ; BANDES_COULOIR ne sert plus qu'à l'échelle (zoom).
 * ecart : décalage de la canne (m, + à droite) ; abscisse, longueur : position le long (m).
 */
function svgCouloir(numero, ecart, abscisse, longueur, couleur) {
  const bandes = BANDES_COULOIR[numero];
  const echelle = 100 / bandes[0]; // la bande la plus large fait 100 unités de chaque côté
  const texte = (r) => (r >= 1 ? `${r} m` : `${Math.round(r * 100)} cm`);
  const limiter = (v, max) => Math.max(-max, Math.min(max, v));
  // La canne est au milieu (en hauteur) ; le début est en dessous de « abscisse », la fin au-dessus.
  const yDebut = abscisse * echelle;
  const yFin = (abscisse - longueur) * echelle;
  const haut = Math.max(yFin, -78);
  const bas = Math.min(yDebut, 78);
  const repere = (y, type) => (Math.abs(y) <= 78
    ? `<path d="M-40 ${y.toFixed(1)}H40" class="bout-couloir" /><g class="drapeau-couloir">${svgDrapeau(type, 44, y + 2, 20)}</g>`
    : '');
  return `<svg class="couloir-ligne" viewBox="-120 -94 240 176" role="img" aria-label="Couloir ${texte(bandes[0])}">
    ${haut < bas ? `<path d="M0 ${bas.toFixed(1)}V${haut.toFixed(1)}" class="trait-couloir" />` : ''}
    ${repere(yDebut, 'debut')}
    ${repere(yFin, 'fin')}
    <g class="drapeau-fin-couloir">${svgDrapeau('fin', -8, -72, 22)}</g>
    <circle cx="${limiter(ecart * echelle, 112).toFixed(1)}" cy="0" r="9" class="moi" style="fill: ${couleur}" />
  </svg>`;
}

/**
 * Bandeaux sous l'en-tête, dans tous les onglets, quand le récepteur est connecté :
 * « RTK FIXE » (vert) ou autre (rouge), « Inclinaison PRÊTE » (vert) ou « NON PRÊTE » (rouge).
 */
/**
 * Bandeaux sous l'en-tête : état du RX2 (RTK, inclinaison) ; sans RX2 connecté mais avec le GPS de
 * la tablette (tablette : { precision } ou null), « GPS tablette ± x m » bien marqué.
 */
export function mettreAJourBandeaux(etat, tablette = null) {
  let bandeaux = document.querySelector('#bandeaux-recepteur');
  if (!bandeaux) {
    bandeaux = document.createElement('div');
    bandeaux.id = 'bandeaux-recepteur';
    bandeaux.className = 'bandeaux-recepteur';
    bandeaux.setAttribute('role', 'status');
    bandeaux.title = 'Récepteur : toucher pour connecter ou régler';
    // Petite icône de récepteur (+ flèche) : on comprend qu'on peut toucher la barre (0.86.0).
    bandeaux.innerHTML = `<span data-bandeau="rtk"></span><span data-bandeau="inclinaison"></span>
      <svg class="icone-bandeau" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 3.2a5 5 0 0 1 7 0M6.6 1.3a7.8 7.8 0 0 1 10.8 0" /><ellipse cx="12" cy="9" rx="6" ry="2.6" /><path d="M6 9v1.4a6 2.6 0 0 0 12 0V9M12 13v9" /></svg>`;
    bandeaux.addEventListener('click', () => document.dispatchEvent(new CustomEvent('ouvrir-recepteur')));
    document.querySelector('.entete').append(bandeaux);
  }
  // Toujours visible (appli Android) : c'est l'accès au récepteur.
  document.body.classList.add('avec-recepteur');
  if (!etat?.connecte && !tablette) {
    const [rtk, inclinaison] = bandeaux.querySelectorAll('[data-bandeau]');
    rtk.textContent = 'Récepteur non connecté';
    rtk.className = 'attente';
    inclinaison.textContent = 'Toucher pour connecter';
    inclinaison.className = 'attente';
    return;
  }
  if (!etat?.connecte) {
    const [rtk, inclinaison] = bandeaux.querySelectorAll('[data-bandeau]');
    rtk.textContent = `GPS TABLETTE · ± ${Math.max(1, Math.round(tablette.precision ?? 0))} m`;
    rtk.className = 'tablette';
    inclinaison.textContent = 'GNSS non connecté';
    inclinaison.className = 'attente';
    return;
  }

  const rtk = bandeaux.querySelector('[data-bandeau="rtk"]');
  const inclinaison = bandeaux.querySelector('[data-bandeau="inclinaison"]');
  if (!etat.recu) {
    rtk.textContent = 'En attente du récepteur…';
    rtk.className = 'attente';
  } else {
    const satellites = etat.nbSatellites != null ? ` · ${etat.nbSatellites} sat` : '';
    const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat.qualite] ?? `GNSS : ${etat.libelleQualite ?? '?'}`;
    // Précision estimée par le RX2 (message GST, m) ; « — » s'il ne l'envoie pas. (Les corrections
    // « direct » sont dans la fenêtre du récepteur : le bandeau doit tenir sur un téléphone.)
    const precision = ` · H ${formaterNombre(etat.precisionH)} V ${formaterNombre(etat.precisionV)}`;
    rtk.textContent = `${statut}${satellites}${precision}`;
    rtk.className = etat.qualite === 4 ? 'ok' : 'pas-ok';
  }
  if (etat.etatInclinaison == null) {
    inclinaison.textContent = 'Inclinaison : ?';
    inclinaison.className = 'attente';
  } else {
    const angle = etat.inclinaison != null ? ` (${etat.inclinaison.toFixed(0)}°)` : '';
    inclinaison.textContent = etat.inclinaisonPrete ? `Incl. PRÊTE${angle}` : 'Incl. NON PRÊTE';
    inclinaison.className = etat.inclinaisonPrete ? 'ok' : 'pas-ok';
  }
}
