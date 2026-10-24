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
import { bulle } from '../aide/bulles.js';
import { svgDrapeau, iconeDrapeau } from '../outils/drapeaux.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';
import { ROLES_METRE } from '../topo/metre.js';
import { svgCoupeDirecte } from './coupe-directe.js';
import { MODES_ACCROCHE, CIBLES, cibleSelonDistance, ecartsGuidage, couleurCanne } from '../topo/accroche.js';
// Couloir de l'implantation d'une ligne : bandes de chaque côté, plus fines en s'approchant
// (loin : 10, 5, 2, 1 m, puis les mêmes que les cercles de la cible).
const BANDES_COULOIR = [[10, 5, 2, 1], ...CIBLES.map((c) => c.cercles)];
import { htmlFormulairePoint, lireFormulairePoint } from '../outils/formulaire-point.js';
import { ouvrirFenetreLibelles } from './fenetre-libelles.js';

// Mode Contrôler : ce qu'on implante (Ligne viendra plus tard), vue des coupes, longueurs.
const IMPLANTATIONS = [
  ['point', 'Point', true],
  ['ligne', 'Ligne', true],
  ['surface', 'Surface', true],
];
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
  ['terrain', 'Terrain naturel'],
  ['terrassement', 'Terrassement'],
  ['metre', 'Métré'],
  ['autres', 'Autres'],
];
// Accroches : un dessin (en gris ce qu'on touche, en ambre l'endroit accroché) et un mot dessous.
// [mot, nom complet (bulle, lecture d'écran), dessin].
const ACCROCHES = {
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
  ['rx2', 'Cap RX2'],
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
  let formulairePointOuvert = false; // « + Point » : taper un point (Est, Nord, H)
  let erreurPoint = '';

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action } = bouton.dataset;
    if (action === 'ouvrirChoixNature' || action === 'fermerChoixNature') {
      choixNatureOuvert = action === 'ouvrirChoixNature';
      dessiner();
      return;
    }
    if (action === 'ouvrirFormulairePoint') {
      formulairePointOuvert = !formulairePointOuvert;
      erreurPoint = '';
      dessiner();
      return;
    }
    if (action === 'ajouterPointTape') {
      const valeurs = lireFormulairePoint(conteneur);
      erreurPoint = valeurs.erreur ?? actions.ajouterPointTape(valeurs)?.erreur ?? '';
      if (erreurPoint) {
        const zone = conteneur.querySelector('[data-vivant="erreur-point"]');
        if (zone) zone.textContent = erreurPoint;
      } else {
        formulairePointOuvert = false;
        dessiner();
      }
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
        enregistrer: (liste) => actions.enregistrerLibelles({ ...donnees.libelles, [sorte]: liste }),
      });
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
    if (action === 'prendre') actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '');
    else if (action === 'role') actions.choisirRole(bouton.dataset.role);
    else actions[action]?.(bouton.dataset.valeur);
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'stock') actions.choisirStock(cible.value);
    else if (cible.dataset.champ === 'surface-controle') actions.choisirSurfaceControle(cible.value);
    else if (cible.dataset.reglageLigne) actions.reglerLigne(cible.dataset.reglageLigne, cible.value);
  });

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
    if (evenement.key === 'Enter' && evenement.target.dataset.point) {
      evenement.preventDefault();
      conteneur.querySelector('[data-action="ajouterPointTape"]')?.click();
      return;
    }
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
    const aImplanter = donnees?.controle.implantation === 'ligne' ? donnees.implanter.ligne : donnees?.implanter.cible;
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
      orientation.textContent = `cap RX2 ${degres(o?.cap)} · marche ${degres(o?.marche)}`;
    }
    if (donnees?.mode === 'controler' && donnees.controle.implantation === 'point') rafraichirImplantation();
    else if (donnees?.mode === 'controler' && donnees.controle.implantation === 'ligne') rafraichirLigne();
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
    if (bouton) bouton.disabled = !(etat?.connecte && etat?.autorise && donnees.implanter.cible);
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

  /**
   * Lever | Implanter, tout en haut de l'onglet, au-dessus du plan (le mode « implanter »
   * s'appelle 'controler' dans le code). Le mode actif est en couleur : ambre pour lever,
   * sarcelle pour implanter (même couleur que la pastille de l'en-tête).
   */
  function choixMode() {
    return `<div class="modes-terrain bascule-terrain mode-${donnees.mode}" role="group" aria-label="Mode">
      ${[['lever', 'Lever'], ['controler', 'Implanter']]
        .map(([cle, titre]) => `<button type="button" data-action="choisirMode" data-valeur="${cle}" class="${donnees.mode === cle ? 'actif' : ''}">${titre}</button>`)
        .join('')}
    </div>`;
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
    const vue = reglages.vueCoupes;
    const choixImplantation = `<div class="choix-implantation-type" role="group" aria-label="Implanter">${boutonsChoix('choisirImplantation', IMPLANTATIONS, reglages.implantation)} ${bulle('implanter')}</div>`;
    // Rien de choisi : on le rappelle bien en vue (après « ← », on ne savait plus quoi faire).
    const imp = donnees.implanter;
    if (reglages.implantation === 'point') {
      const invite = imp.choix ? '' : invitation('Choisis le point à implanter', 'touche-le sur le plan ou tape son nom');
      return choixImplantation + invite + barreAccroche() + implanterPoint();
    }
    if (reglages.implantation === 'ligne') {
      const invite = imp.pointsLigne.length > 0 ? '' : invitation('Choisis la ligne à implanter', 'touche-la sur le plan, ou ses points un à un');
      return choixImplantation + invite + barreAccroche() + implanterLigne();
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
      <div class="ligne-choix"><span>Coupes</span>${boutonsChoix('choisirVueCoupes', VUES_COUPES, vue)}</div>
      <div class="ligne-choix"><span>Longueur</span>${boutonsChoix('choisirLongueurCoupe', LONGUEURS_COUPE.map((m) => [m, `${m} m`]), reglages.demiLongueur)}<span class="aide">de chaque côté</span></div>
      <div class="ligne-choix"><span>Hauteurs</span>${boutonsChoix('choisirExagerationCoupe', [[1, '×1'], [2, '×2']], reglages.exagerationCoupe)}</div>
      <div class="ligne-choix"><span>Orientation</span>${boutonsChoix('choisirSourceOrientation', [['rx2', 'Cap RX2'], ['marche', 'Marche']], reglages.sourceOrientation)}</div>
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
    const enLigne = donnees.controle.implantation === 'ligne';
    const modes = enLigne ? ['trait', ...MODES_ACCROCHE] : MODES_ACCROCHE;
    const active = enLigne ? imp.accrocheLigne : imp.accroche;
    return `<div class="barre-accroche ${enLigne ? 'accroches-ligne' : ''}">
      <div class="accroches" role="group" aria-label="Accroche : ce que l'on prend en touchant le plan">
        ${modes.map((mode) => {
          const [mot, nom, dessin] = ACCROCHES[mode];
          return `<button type="button" class="bouton-accroche ${active === mode ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${mode}" title="${nom}" aria-label="${nom}" aria-pressed="${active === mode}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg><span>${mot}</span></button>`;
        }).join('')}
      </div>
      <div class="accroche-par-nom">
        <input type="text" list="noms-points-projet" data-champ="nom-a-trouver" placeholder="Nom d'un point" autocomplete="off" autocapitalize="characters" aria-label="Nom du point à implanter" />
        <datalist id="noms-points-projet">${imp.nomsPoints.map((nom) => `<option value="${echapper(nom)}"></option>`).join('')}</datalist>
        <button type="button" class="bouton-secondaire" data-action="trouverPoint">OK</button>
        ${enLigne ? '' : `<button type="button" class="bouton-secondaire ${formulairePointOuvert ? 'actif' : ''}" data-action="ouvrirFormulairePoint" title="Taper un point (Est, Nord, H)">+ Point</button>`}
      </div>
      ${formulairePointOuvert && !enLigne ? `${htmlFormulairePoint(imp.nomPointAjoute)}<p class="erreur" data-vivant="erreur-point">${echapper(erreurPoint)}</p>` : ''}
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
          : `<ol>${points.map((p, i) => `<li><strong>${role(i)}</strong> ${p.nom ? echapper(p.nom) : ''} <span class="aide">E ${formaterNombre(p.est)} · N ${formaterNombre(p.nord)}</span></li>`).join('')}</ol>`}
        <div class="ligne-outils">
          <button type="button" class="bouton-secondaire" data-action="implanterPointsLigne" ${points.length < 2 ? 'disabled' : ''}>Implanter cette ligne</button>
          ${points.length > 0 ? '<button type="button" class="bouton-lien" data-action="retirerDernierPointLigne">enlever le dernier</button>' : ''}
        </div>
      </div>
      ${lienExport()}`;
  }

  /** « 3 implantation(s) enregistrée(s) · exporter (CSV) », ou rien. */
  function lienExport() {
    const nombre = donnees.implanter.nbImplantations;
    return nombre > 0
      ? `<p class="aide">${nombre} implantation(s) enregistrée(s) · <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterImplantations">exporter (CSV)</button></p>`
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
    let le_long;
    // Position le long : + depuis le début, − avant le début (demande du 23.10.2026).
    if (abscisse < 0) le_long = `−${m(abscisse)}`;
    else if (abscisse > longueur) le_long = `Après la fin : ${m(abscisse - longueur)}`;
    else le_long = `+${m(abscisse)} · fin ${m(reste)}`;
    const hauteur = g.ecartAltitude == null
      ? ''
      : `<span class="hauteur-guidage ${g.classeAltitude}">${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(g.ecartAltitude)}</span>`;
    zone.className = `guidage-direct guidage-ligne ${g.classe}`;
    zone.innerHTML = `
      ${svgCouloir(bandeCouloir, ecart, abscisse, longueur, couleurCanne(Math.abs(ecart)))}
      <span class="lignes-guidage"><span>${sens}</span></span>
      <span class="distance-guidage">${le_long}</span>
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
          <p class="coordonnees-choix">${imp.choix.nom ? `<strong>${echapper(imp.choix.nom)}</strong> ` : ''}E ${formaterNombre(imp.choix.est)} · N ${formaterNombre(imp.choix.nord)}
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="oublierChoix">effacer</button></p>
          <div class="champs-implantation">
            <label>Nom<input type="text" data-champ="nom-implantation" value="${echapper(imp.nomPropose)}" autocomplete="off" autocapitalize="characters" /></label>
            <label>Altitude<input type="text" inputmode="decimal" data-champ="altitude-implantation" value="${imp.choix.altitude != null ? imp.choix.altitude.toFixed(3) : ''}" placeholder="facultative" /></label>
          </div>
          <div class="ligne-outils">
            <button type="button" class="bouton bouton-implanter" data-action="implanterChoix">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>Implanter</button>
            <button type="button" class="bouton-secondaire" data-action="creerPointAImplanter">+ À implanter</button>
            ${imp.choixDuProjet ? '' : '<button type="button" class="bouton-secondaire" data-action="garderPointChoisi" title="Garder ce point dans le projet (levé « Points ajoutés »)">+ Point du projet</button>'}
          </div>
        </div>`
      : '';
    const liste = imp.aImplanter.length > 0
      ? `<div class="liste-a-implanter">
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
    const ligne = reglages.implantation === 'ligne';
    const titre = ligne
      ? `<strong>${echapper(imp.ligne.nom)}</strong> · ${formaterNombre(imp.ligne.longueur)} m`
      : `Vers <strong>${echapper(imp.cible.nom ?? 'le point choisi')}</strong>`;
    const guidage = ligne
      ? '<div class="guidage-direct attente" data-vivant="guidage-ligne"></div>'
      : `<div class="cible-haut" data-vivant="cible-haut" hidden></div>
        <div class="guidage-et-boussole ${reglages.guidage === 'nseo' ? 'avec-boussole' : ''}">
          <div class="guidage-direct attente" data-vivant="guidage"></div>
          ${reglages.guidage === 'nseo' ? boussole() : ''}
        </div>`;
    return `<div class="vue-guidage">
      <div class="entete-guidage">
        <button type="button" class="bouton-retour" data-action="${ligne ? 'changerLigne' : 'arreterImplantation'}" title="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}" aria-label="Choisir ${ligne ? 'une autre ligne' : 'un autre point'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <p class="titre-vue-guidage">${titre}</p>
        ${ligne ? '<button type="button" class="bouton-retour" data-action="inverserLigne" title="Inverser le sens" aria-label="Inverser le sens">⇄</button>' : ''}
        ${!ligne && imp.suivant ? `<button type="button" class="bouton-suivant" data-action="implanterSuivant" title="Implanter le point suivant : ${echapper(imp.suivant)}" aria-label="Point suivant : ${echapper(imp.suivant)}">${echapper(imp.suivant)} ▶</button>` : ''}
        <button type="button" class="bouton-retour ${reglagesGuidageOuverts ? 'actif' : ''}" data-action="basculerReglagesGuidage" title="Réglages de l'implantation" aria-label="Réglages de l'implantation" aria-expanded="${reglagesGuidageOuverts}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></button>
      </div>
      ${reglagesGuidageOuverts ? reglagesGuidage(ligne) : ''}
      ${ligne ? detailLigne() : detailPoint()}
      ${guidage}
      <button type="button" class="bouton bouton-prendre" data-action="enregistrerImplantation" disabled>
        <span>ENREGISTRER L'IMPLANTATION</span><span class="sous-titre-prendre">ou touche vol −</span>
      </button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
    </div>`;
  }

  /** Réglages de l'implantation (roue ⚙) : guidage, orientation ; pour une ligne, segment et décalage. */
  function reglagesGuidage(ligne) {
    const { controle: reglages, implanter: imp } = donnees;
    const l = imp.ligne;
    return `<div class="reglages-guidage">
      <div class="ligne-choix"><span>Guidage</span>${boutonsChoix('choisirGuidage', GUIDAGES, reglages.guidage)}</div>
      <div class="ligne-choix"><span>Orientation</span>${boutonsChoix('choisirSourceOrientation', [['rx2', 'Cap RX2'], ['marche', 'Marche']], reglages.sourceOrientation)}</div>
      ${ligne && l.nbSegments > 1 ? `<div class="ligne-choix"><span>Ligne</span>${boutonsChoix('choisirSegment', [['tout', 'Toute'], ['segment', 'Segment par segment']], l.segment == null ? 'tout' : 'segment')}</div>` : ''}
      ${ligne ? `<label class="champ-decalage">Décalage parallèle (m)<input type="text" inputmode="decimal" data-reglage-ligne="decalage" value="${l.decalage ? l.decalage.toFixed(3) : ''}" placeholder="+ à droite, − à gauche" /></label>` : ''}
      <p class="aide" data-vivant="orientation"></p>
    </div>`;
  }

  /** Point implanté : coordonnées et altitude, sur une ligne. */
  function detailPoint() {
    const c = donnees.implanter.cible;
    return `<p class="coordonnees-cible">E ${formaterNombre(c.est)} · N ${formaterNombre(c.nord)}${c.altitude != null ? ` · H ${formaterNombre(c.altitude)}` : ''}</p>`;
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
    const altitude = (bout, cle) => (l.altitudesDuPlan
      ? `<span class="altitude-bout">H <strong>${bout.altitude != null ? formaterNombre(bout.altitude) : '—'}</strong></span>`
      : `<label class="altitude-bout">H<input type="text" inputmode="decimal" data-reglage-ligne="${cle}" value="${l.altitudes[cle] == null ? '' : l.altitudes[cle].toFixed(3)}" placeholder="—" aria-label="Altitude ${cle === 'debut' ? 'du début' : 'de la fin'}" /></label>`);
    const ligneBout = (bout, cle) => `<div class="bout-ligne">
        <span class="pastille-bout ${cle === 'fin' ? 'fin' : ''}">${iconeDrapeau(cle)}</span>
        <span class="coordonnees-bout">${bout.nom ? `<strong>${echapper(bout.nom)}</strong> ` : ''}E ${formaterNombre(bout.est)} · N ${formaterNombre(bout.nord)}</span>
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

  /**
   * Récepteur pas connecté : un rappel, qui ouvre la fenêtre du récepteur (bouton « Récepteur »
   * de la barre du bas, voir recepteur.js : la connexion et les corrections y sont).
   */
  function connexion() {
    return `<button type="button" class="connexion-terrain" data-si-deconnecte data-action="ouvrirRecepteur">
      <span class="pastille-gris"></span>Récepteur non connecté <strong>Connecter</strong></button>`;
  }

  /** Choix de ce que l'on va lever : une nouvelle surface de cette nature. */
  function choixNature() {
    return `<div class="choix-nature">
      <p class="titre-choix">Que lèves-tu ?</p>
      <div class="natures-terrain">
        ${NATURES_TERRAIN.map(([cle, titre]) => `<button type="button" class="bouton-nature nature-${cle}" data-action="nouvelleSurface" data-valeur="${cle}">${titre}</button>`).join('')}
      </div>
      ${donnees.stock ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerChoixNature">annuler</button>' : ''}
    </div>`;
  }

  /**
   * Bandeau de la surface levée en cours, à la couleur de sa nature : sa nature en petit, son
   * nom en grand (liste pour en reprendre une autre) et « + » pour en commencer une nouvelle.
   */
  function ligneSurface() {
    const nature = donnees.stock.nature ?? 'stock';
    return `<div class="ligne-leve-en-cours">
      <div class="bandeau-leve nature-${nature}">
        <span class="nature-leve">${echapper(NATURES_TERRAIN.find(([cle]) => cle === nature)?.[1] ?? '')}</span>
        <select data-champ="stock" aria-label="Levé en cours : en reprendre un autre">
          ${donnees.stocks.map((s) => `<option value="${s.id}" ${s.id === donnees.stock.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="bouton-plus nature-${nature}" data-action="ouvrirChoixNature" aria-label="Nouveau levé" title="Nouveau levé">+</button>
    </div>`;
  }

  /** Choix du rôle : 3 gros boutons à la couleur du rôle. */
  function boutonsRoles() {
    return `<div class="roles-leve" role="group" aria-label="Rôle du prochain point">
      ${[...ROLES_LEVE, ...ROLES_METRE].filter(([cle]) => donnees.rolesPermis.includes(cle)).map(
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
    if (donnees.role !== 'ligne') return '';
    const { ligne } = donnees;
    return `<div class="outils-ligne">
      <span>L-${echapper(ligne.libelle ?? '')}-${ligne.numero} · ${ligne.nbPoints} pt(s)</span>
      <button type="button" class="bouton-secondaire" data-action="nouvelleLigne" ${ligne.nbPoints === 0 ? 'disabled' : ''}>+ Nouvelle</button>
      <button type="button" class="bouton-secondaire ${ligne.fermee ? 'actif' : ''}" data-action="basculerFermeture" aria-pressed="${ligne.fermee}" ${ligne.nbPoints < 3 ? 'disabled' : ''}>
        ${ligne.fermee ? '✓ Fermée' : 'Fermer'}</button>
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
    return `<div class="libelles-terrain pour-${sorte} ${donnees.metre ? 'dans-metre' : ''}" role="group" aria-label="Ce que l'on lève">
      ${liste.map(([abreviation, signification, couleur]) => `<button type="button" class="puce-libelle ${abreviation === actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur="${echapper(abreviation)}">
          <strong>${couleur ? `<i class="pastille-libelle" style="background: ${couleur}"></i>` : ''}${echapper(abreviation)}</strong><span>${echapper(signification)}</span></button>`).join('')}
      <button type="button" class="bouton-crayon-libelles" data-action="ouvrirLibelles" title="Modifier les libellés" aria-label="Modifier les libellés">
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
      ${choixLibelle()}
      ${outilsLigne()}
      <div class="nom-et-position">
        <input type="text" class="nom-point" data-champ="nom-point" value="${echapper(donnees.nomPropose)}" autocomplete="off" autocapitalize="characters" aria-label="Nom du prochain point" />
        <div class="position-leve" data-vivant="position"></div>
      </div>
      <button type="button" class="bouton bouton-prendre" data-action="prendre" disabled>
        <span>PRENDRE LE POINT</span><span class="sous-titre-prendre">ou touche vol −</span>
      </button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
      <div class="pied-terrain">
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}>
          Annuler ${donnees.dernierPoint ? echapper(donnees.dernierPoint) : 'le dernier point'}</button>
        ${resume()}
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
    const enGuidage = donnees.mode === 'controler'
      && ((implantation === 'point' && Boolean(donnees.implanter.cible)) || (implantation === 'ligne' && Boolean(donnees.implanter.ligne)));
    document.body.classList.toggle('vue-implantation', enGuidage);
    if (!enGuidage || implantation !== 'point') document.body.classList.remove('cible-en-haut');
    let contenu;
    if (enGuidage) contenu = vueImplantation();
    else contenu = donnees.mode === 'controler' ? controle() : priseDePoint();
    conteneur.innerHTML = `
        <div class="ecran-terrain">
          ${choixMode()}
          ${connexion()}
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
 * Couloir de l'implantation d'une ligne : la ligne (ou sa parallèle) en trait vertical au milieu,
 * du début (en bas) vers la fin (en haut), des bandes de distance de chaque côté (BANDES_COULOIR),
 * et la canne (rond de la couleur de la distance) à sa place : à droite si elle est à droite.
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
  // Rayons écrits à droite de chaque bande, en escalier (pour ne pas se chevaucher).
  return `<svg class="couloir-ligne" viewBox="-120 -94 240 176" role="img" aria-label="Couloir ${texte(bandes[0])}">
    ${bandes.map((r, i) => `<rect x="${-r * echelle}" y="-80" width="${2 * r * echelle}" height="160" class="bande bande-${i}" />`).join('')}
    ${bandes.map((r, i) => `<text x="${(r * echelle + 2).toFixed(1)}" y="${-62 + i * 14}" class="rayon">${texte(r)}</text>`).join('')}
    ${haut < bas ? `<path d="M0 ${bas.toFixed(1)}V${haut.toFixed(1)}" class="trait-couloir" />` : ''}
    ${repere(yDebut, 'debut')}
    ${repere(yFin, 'fin')}
    <text y="-84" text-anchor="middle" class="haut-cible">↑ vers la fin</text>
    <circle cx="${limiter(ecart * echelle, 112).toFixed(1)}" cy="0" r="9" class="moi" style="fill: ${couleur}" />
  </svg>`;
}

/**
 * Bandeaux sous l'en-tête, dans tous les onglets, quand le récepteur est connecté :
 * « RTK FIXE » (vert) ou autre (rouge), « Inclinaison PRÊTE » (vert) ou « NON PRÊTE » (rouge).
 */
export function mettreAJourBandeaux(etat) {
  let bandeaux = document.querySelector('#bandeaux-recepteur');
  if (!bandeaux) {
    bandeaux = document.createElement('div');
    bandeaux.id = 'bandeaux-recepteur';
    bandeaux.className = 'bandeaux-recepteur';
    bandeaux.setAttribute('role', 'status');
    bandeaux.innerHTML = '<span data-bandeau="rtk"></span><span data-bandeau="inclinaison"></span>';
    document.querySelector('.entete').append(bandeaux);
  }
  const visible = Boolean(etat?.connecte);
  document.body.classList.toggle('avec-recepteur', visible);
  if (!visible) return;

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
