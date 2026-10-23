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
import { etatCorrections } from './corrections.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';
import { ROLES_METRE } from '../topo/metre.js';
import { svgCoupeDirecte } from './coupe-directe.js';
import { MODES_ACCROCHE, CIBLES, cibleSelonDistance, ecartsGuidage, couleurCanne } from '../topo/accroche.js';
// Couloir de l'implantation d'une ligne : bandes de chaque côté, plus fines en s'approchant
// (loin : 10, 5, 2, 1 m, puis les mêmes que les cercles de la cible).
const BANDES_COULOIR = [[10, 5, 2, 1], ...CIBLES.map((c) => c.cercles)];
import { lireTexteLibelles, ecrireTexteLibelles } from './libelles.js';

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
];
// Accroches : un dessin (en gris ce qu'on touche, en ambre l'endroit accroché) et un mot dessous.
// [mot, nom complet (bulle, lecture d'écran), dessin].
const ACCROCHES = {
  // Implantation d'une ligne : la ligne entière du plan DXF (polyligne).
  trait: ['Ligne DXF', 'Ligne entière du plan DXF (polyligne)', '<path class="repere-trait" d="M3 18 9 8l6 6 6-9" /><circle cx="3" cy="18" r="1.6" /><circle cx="21" cy="5" r="1.6" />'],
  point: ['Point', 'Point du projet (levé ou importé)', '<path d="M12 3v5M12 16v5M3 12h5M16 12h5" /><circle class="repere" cx="12" cy="12" r="3.5" />'],
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
 * choisirRecepteur(), reconnecter(), deconnecter(), lireReglagesCorrections(), demarrerCorrections(reglages), arreterCorrections(), nouvelleSurface(nature), choisirStock(id), choisirRole(role), nouvelleLigne(), basculerFermeture(), prendrePoint(nom),
 * annulerDernierPoint(), choisirLibelle(abréviation), enregistrerLibelles({ lignes, points }),
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
  let libellesOuverts = false; // listes de libellés en cours de modification
  let direct = null; // orientation et contrôle calculés par main.js à chaque état du récepteur
  let cibleAffichee = 0; // cible montrée près du point à implanter (0 : aucune, voir CIBLES)
  let bandeCouloir = 0; // échelle du couloir de la ligne (n° dans BANDES_COULOIR)
  let correctionsOuvertes = false; // bloc « Corrections » ouvert
  const saisieCorrections = {}; // réglages des corrections tapés, pas encore envoyés
  let capBoussole = null; // dernier cap de la boussole de la tablette (°), ou null

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action } = bouton.dataset;
    if (action === 'ouvrirChoixNature' || action === 'fermerChoixNature') {
      choixNatureOuvert = action === 'ouvrirChoixNature';
      dessiner();
      return;
    }
    if (action === 'ouvrirLibelles' || action === 'fermerLibelles') {
      libellesOuverts = action === 'ouvrirLibelles';
      dessiner();
      return;
    }
    if (action === 'enregistrerLibelles') {
      const texte = (champ) => conteneur.querySelector(`[data-champ="${champ}"]`)?.value ?? '';
      libellesOuverts = false;
      actions.enregistrerLibelles({
        lignes: lireTexteLibelles(texte('libelles-lignes')),
        points: lireTexteLibelles(texte('libelles-points')),
        aires: lireTexteLibelles(texte('libelles-aires')),
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
    if (action === 'demarrerCorrections') {
      const lire = (champ) => conteneur.querySelector(`[data-correction="${champ}"]`)?.value.trim() ?? '';
      actions.demarrerCorrections({
        hote: lire('hote'),
        port: Number(lire('port')) || 2101,
        pointDeMontage: lire('pointDeMontage'),
        utilisateur: lire('utilisateur'),
        motDePasse: conteneur.querySelector('[data-correction="motDePasse"]')?.value ?? '',
      });
      for (const cle of Object.keys(saisieCorrections)) delete saisieCorrections[cle];
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

  // Réglages des corrections : ouverture du bloc et valeurs tapées (gardées si l'écran se redessine).
  conteneur.addEventListener('toggle', (evenement) => {
    if (evenement.target.dataset?.zone === 'corrections') correctionsOuvertes = evenement.target.open;
  }, true);
  conteneur.addEventListener('input', (evenement) => {
    const champ = evenement.target.dataset.correction;
    if (champ && champ !== 'motDePasse') saisieCorrections[champ] = evenement.target.value;
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
    const texte = conteneur.querySelector('[data-vivant="connexion"]');
    if (texte) texte.textContent = etat?.bluetooth ?? 'non connecté';
    // Bouton principal de connexion : le dernier récepteur s'il est connu, sinon la liste.
    const connecter = conteneur.querySelector('[data-vivant="connecter"]');
    if (connecter) {
      connecter.dataset.action = etat?.dernierRecepteur ? 'reconnecter' : 'choisirRecepteur';
      connecter.textContent = etat?.dernierRecepteur ? `Connecter ${etat.dernierRecepteur}` : 'Connecter le récepteur';
    }
    const autre = conteneur.querySelector('[data-vivant="autre-recepteur"]');
    if (autre) autre.hidden = connecte || !etat?.dernierRecepteur;

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
    const implantation = donnees?.mode === 'controler' && donnees.controle.implantation === 'point';
    const permis = connecte && Boolean(etat?.autorise) && Boolean(implantation ? donnees.implanter.cible : donnees?.stock);
    if (bouton) bouton.disabled = !permis;
    if (raison) {
      raison.textContent = permis || !connecte ? '' : etat?.raison ?? '';
      raison.hidden = permis || !connecte;
    }

    // Corrections : par Emlid Flow, ou reçues directement (état en direct).
    const corrections = conteneur.querySelector('[data-vivant="corrections"]');
    if (corrections) {
      const { texte, classe } = etatCorrections(etat?.corrections);
      corrections.textContent = texte;
      corrections.className = `etat-corrections ${classe}`;
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
    if (!zone) return;
    if (!g || g.message) {
      cibleAffichee = 0;
      zone.className = 'guidage-direct attente';
      zone.innerHTML = `<span class="message-ecart">${echapper(g?.message ?? 'En attente de la position…')}</span>`;
      return;
    }
    const { distance, direction, azimut } = g.guidage;
    const { haut, droite, nordEnHaut } = ecartsGuidage(g.guidage, donnees.controle.guidage);
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    // Toujours « avance / recule », « droite / gauche » ; en N-S-E-O (nord devant), avec le point cardinal.
    const lignes = nordEnHaut
      ? [`${haut >= 0 ? '↑ Avance (Nord)' : '↓ Recule (Sud)'} ${m(haut)}`, `${droite >= 0 ? '→ Droite (Est)' : '← Gauche (Ouest)'} ${m(droite)}`]
      : [`${haut >= 0 ? '↑ Avance' : '↓ Recule'} ${m(haut)}`, `${droite >= 0 ? '→ Droite' : '← Gauche'} ${m(droite)}`];
    const hauteur = g.ecartAltitude == null
      ? ''
      : `<span class="hauteur-guidage ${g.classeAltitude}">${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(g.ecartAltitude)}</span>`;
    cibleAffichee = cibleSelonDistance(distance, cibleAffichee);
    // Flèche vers le point : par rapport à la direction regardée, sinon par rapport au nord.
    const angle = nordEnHaut ? direction : direction - azimut;
    const dessin = cibleAffichee > 0
      ? svgCible(cibleAffichee, haut, droite, couleurCanne(distance), nordEnHaut)
      : `<svg class="fleche-guidage" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -17 11 6 0 0 -11 6Z" transform="rotate(${angle.toFixed(1)})" /></svg>`;
    zone.className = `guidage-direct ${g.classe} ${cibleAffichee > 0 ? 'avec-cible' : ''}`;
    zone.innerHTML = `
      ${dessin}
      <span class="lignes-guidage">${lignes.map((texte) => `<span>${texte}</span>`).join('')}</span>
      <span class="distance-guidage">${formaterNombre(distance)} m${nordEnHaut ? ' · nord en haut' : ''}</span>
      ${hauteur}`;
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

  /** Lever | Implanter, en haut de l'onglet (le mode « implanter » s'appelle 'controler' dans le code). */
  function choixMode() {
    return `<div class="modes-terrain" role="group" aria-label="Mode">
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
    const choixImplantation = `<div class="ligne-choix choix-implantation-type">${boutonsChoix('choisirImplantation', IMPLANTATIONS, reglages.implantation)} ${bulle('implanter')}</div>`;
    if (reglages.implantation === 'point') return choixImplantation + implanterPoint();
    if (reglages.implantation === 'ligne') return choixImplantation + implanterLigne();
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
      </div>
    </div>`;
  }

  /**
   * Implantation d'une ligne : d'abord la ligne (points choisis un à un, ou ligne du DXF), puis
   * toute la ligne ou un segment, le sens (début → fin), le décalage parallèle, les altitudes, le
   * couloir de guidage et l'enregistrement.
   */
  function implanterLigne() {
    const { implanter: imp } = donnees;
    const exporter = imp.nbImplantations > 0
      ? `<p class="aide">${imp.nbImplantations} implantation(s) enregistrée(s) · <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterImplantations">exporter (CSV)</button></p>`
      : '';
    if (!imp.ligne) {
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
        ${exporter}`;
    }
    const l = imp.ligne;
    const valeur = (v) => (v == null ? '' : v.toFixed(3));
    const segments = l.nbSegments > 1
      ? `<div class="ligne-choix">
          ${boutonsChoix('choisirSegment', [['tout', 'Toute la ligne'], ['segment', 'Segment par segment']], l.segment == null ? 'tout' : 'segment')}
        </div>
        ${l.segment == null ? '' : `<div class="choix-segment">
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="precedent" ${l.segment === 0 ? 'disabled' : ''} aria-label="Segment précédent">◀</button>
          <span>Segment <strong>${l.segment + 1}</strong> / ${l.nbSegments}</span>
          <button type="button" class="bouton-secondaire" data-action="choisirSegment" data-valeur="suivant" ${l.segment === l.nbSegments - 1 ? 'disabled' : ''} aria-label="Segment suivant">▶</button>
        </div>`}`
      : '';
    const bout = (p) => `${p.nom ? `<strong>${echapper(p.nom)}</strong> ` : ''}E ${formaterNombre(p.est)} · N ${formaterNombre(p.nord)}`;
    return `
      <div class="ligne-choisie">
        <p class="titre-guidage">Ligne <strong>${echapper(l.nom)}</strong> · ${formaterNombre(l.longueur)} m
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="changerLigne">changer</button></p>
        ${segments}
        <div class="sens-ligne">
          <p><span class="pastille-bout">${iconeDrapeau('debut')} Début</span> ${bout(l.debut)}</p>
          <p><span class="pastille-bout fin">${iconeDrapeau('fin')} Fin</span> ${bout(l.fin)}</p>
          <button type="button" class="bouton-secondaire" data-action="inverserLigne">⇄ Inverser le sens</button>
        </div>
        <div class="champs-implantation champs-ligne">
          <label>Décalage parallèle (m)<input type="text" inputmode="decimal" data-reglage-ligne="decalage" value="${l.decalage ? l.decalage.toFixed(3) : ''}" placeholder="0 · + à droite, − à gauche" /></label>
          <label>Altitude début<input type="text" inputmode="decimal" data-reglage-ligne="debut" value="${valeur(l.altitudes.debut)}" placeholder="${l.altitudesDuPlan ? 'du plan (3D)' : 'facultative'}" /></label>
          <label>Altitude fin<input type="text" inputmode="decimal" data-reglage-ligne="fin" value="${valeur(l.altitudes.fin)}" placeholder="${l.altitudesDuPlan ? 'du plan (3D)' : 'facultative'}" /></label>
        </div>
      </div>
      <div class="guidage-direct attente" data-vivant="guidage-ligne"></div>
      <button type="button" class="bouton bouton-prendre" data-action="enregistrerImplantation" disabled>
        <span>ENREGISTRER L'IMPLANTATION</span><span class="sous-titre-prendre">ou touche vol −</span>
      </button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
      ${exporter}`;
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
    if (abscisse < 0) le_long = `Avant le début : ${m(abscisse)}`;
    else if (abscisse > longueur) le_long = `Après la fin : ${m(abscisse - longueur)}`;
    else le_long = `Début + ${formaterNombre(abscisse)} m · fin − ${formaterNombre(reste)} m`;
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
   * Implantation d'un point : point choisi (implanter ou créer), guidage (cible, boussole),
   * enregistrement, liste « À implanter ».
   */
  function implanterPoint() {
    const { implanter: imp, controle: reglages } = donnees;
    const choix = imp.choix
      ? `<div class="choix-implantation">
          <p class="coordonnees-choix">${imp.choix.nom ? `<strong>${echapper(imp.choix.nom)}</strong> ` : ''}E ${formaterNombre(imp.choix.est)} · N ${formaterNombre(imp.choix.nord)}
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="oublierChoix">effacer</button></p>
          <div class="champs-implantation">
            <label>Nom<input type="text" data-champ="nom-implantation" value="${echapper(imp.nomPropose)}" autocomplete="off" autocapitalize="characters" /></label>
            <label>Altitude<input type="text" inputmode="decimal" data-champ="altitude-implantation" value="${imp.choix.altitude != null ? imp.choix.altitude.toFixed(3) : ''}" placeholder="facultative" /></label>
          </div>
          <div class="ligne-outils">
            <button type="button" class="bouton-secondaire" data-action="implanterChoix">Implanter</button>
            <button type="button" class="bouton-secondaire" data-action="creerPointAImplanter">+ À implanter</button>
          </div>
        </div>`
      : '';
    const cible = imp.cible
      ? `<p class="titre-guidage">Vers <strong>${echapper(imp.cible.nom ?? 'le point choisi')}</strong>${imp.cible.altitude != null ? ` · H ${formaterNombre(imp.cible.altitude)}` : ''}
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="arreterImplantation">arrêter</button></p>
        <div class="guidage-et-boussole ${reglages.guidage === 'nseo' ? 'avec-boussole' : ''}">
          <div class="guidage-direct attente" data-vivant="guidage"></div>
          ${reglages.guidage === 'nseo' ? boussole() : ''}
        </div>
        <button type="button" class="bouton bouton-prendre" data-action="enregistrerImplantation" disabled>
          <span>ENREGISTRER L'IMPLANTATION</span><span class="sous-titre-prendre">ou touche vol −</span>
        </button>
        <p class="raison-leve" data-vivant="raison" hidden></p>`
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
    const exporter = imp.nbImplantations > 0
      ? `<p class="aide">${imp.nbImplantations} implantation(s) enregistrée(s) · <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterImplantations">exporter (CSV)</button></p>`
      : '';
    return `
      ${choix}
      ${cible}
      ${liste}
      ${exporter}
      <div class="ligne-choix"><span>Guidage</span>${boutonsChoix('choisirGuidage', GUIDAGES, reglages.guidage)}</div>
      <p class="aide" data-vivant="orientation"></p>`;
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

  /** Connexion au récepteur : un gros bouton tant qu'il n'est pas connecté. */
  function connexion() {
    return `<div class="connexion-terrain" data-si-deconnecte>
      <button type="button" class="bouton bouton-large" data-vivant="connecter" data-action="choisirRecepteur">Connecter le récepteur</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-vivant="autre-recepteur" data-action="choisirRecepteur" hidden>autre récepteur</button>
    </div>`;
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
    return `<div class="bandeau-leve nature-${nature}">
      <div class="bandeau-leve-texte">
        <span class="nature-leve">${echapper(NATURES_TERRAIN.find(([cle]) => cle === nature)?.[1] ?? '')}</span>
        <select data-champ="stock" aria-label="Surface levée : en reprendre une autre">
          ${donnees.stocks.map((s) => `<option value="${s.id}" ${s.id === donnees.stock.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="bouton-plus" data-action="ouvrirChoixNature" aria-label="Nouvelle surface levée" title="Nouvelle surface levée">+</button>
    </div>`;
  }

  /** Récepteur connecté (à couper), en bas de l'écran, puis les corrections. */
  function piedRecepteur() {
    return `<p class="pied-recepteur" data-si-connecte hidden>
      <span>Récepteur : <strong data-vivant="connexion"></strong></span>
      <button type="button" class="bouton-lien" data-action="deconnecter">couper</button>
    </p>
    ${blocCorrections()}`;
  }

  /**
   * Corrections RTK : par Emlid Flow (rien à régler ici), ou reçues directement de swipos par
   * l'appli (réglages repris d'Emlid Flow, gardés sur la tablette). Seulement avec un APK récent.
   */
  function blocCorrections() {
    const reglages = actions.lireReglagesCorrections?.();
    if (!reglages) return '';
    // Valeurs tapées pas encore envoyées : gardées si l'écran se redessine.
    const valeur = (champ) => echapper(String(saisieCorrections[champ] ?? reglages[champ] ?? ''));
    return `<details class="bloc-corrections" data-zone="corrections" ${correctionsOuvertes ? 'open' : ''}>
      <summary>Corrections : <span class="etat-corrections" data-vivant="corrections">…</span> ${bulle('corrections')}</summary>
      <div class="champs-corrections">
        <label class="champ-large">Serveur<input type="text" data-correction="hote" value="${valeur('hote')}" placeholder="adresse (voir Emlid Flow)" autocapitalize="off" spellcheck="false" /></label>
        <label>Port<input type="text" inputmode="numeric" data-correction="port" value="${valeur('port')}" /></label>
        <label>Point de montage<input type="text" data-correction="pointDeMontage" value="${valeur('pointDeMontage')}" autocapitalize="off" spellcheck="false" /></label>
        <label>Identifiant<input type="text" data-correction="utilisateur" value="${valeur('utilisateur')}" autocapitalize="off" spellcheck="false" autocomplete="off" /></label>
        <label>Mot de passe<input type="password" data-correction="motDePasse" value="" placeholder="${reglages.motDePasseEnregistre ? 'enregistré' : ''}" autocomplete="off" /></label>
      </div>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="demarrerCorrections">${reglages.actives ? 'Redémarrer' : 'Démarrer'}</button>
        ${reglages.actives ? '<button type="button" class="bouton-lien" data-action="arreterCorrections">arrêter (retour à Emlid Flow)</button>' : ''}
      </div>
    </details>`;
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
    const sorte = donnees.role === 'aire' ? 'aires' : ['ligne', 'longueur'].includes(donnees.role) ? 'lignes' : 'points';
    const liste = donnees.libelles[sorte];
    const actif = { aires: donnees.libelleAire, lignes: donnees.libelleLigne, points: donnees.libellePoint }[sorte];
    return `<div class="libelles-terrain pour-${sorte} ${donnees.metre ? 'dans-metre' : ''}" role="group" aria-label="Ce que l'on lève">
      ${liste.map(([abreviation, signification]) => `<button type="button" class="puce-libelle ${abreviation === actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur="${echapper(abreviation)}">
          <strong>${echapper(abreviation)}</strong><span>${echapper(signification)}</span></button>`).join('')}
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ouvrirLibelles">modifier</button>
    </div>
    ${libellesOuverts ? editeurLibelles() : ''}`;
  }

  /** Modification des listes de libellés : une ligne par libellé, « HT haut de talus ». */
  function editeurLibelles() {
    return `<div class="editeur-libelles">
      <p class="aide">Une ligne par libellé, ex. « HT haut de talus ».</p>
      <label>Lignes de rupture et longueurs (L-…)<textarea data-champ="libelles-lignes" rows="6">${echapper(ecrireTexteLibelles(donnees.libelles.lignes))}</textarea></label>
      <label>Points isolés et points comptés (P-…)<textarea data-champ="libelles-points" rows="6">${echapper(ecrireTexteLibelles(donnees.libelles.points))}</textarea></label>
      <label>Aires d'un métré (A-…)<textarea data-champ="libelles-aires" rows="5">${echapper(ecrireTexteLibelles(donnees.libelles.aires))}</textarea></label>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="enregistrerLibelles">Enregistrer</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerLibelles">annuler</button>
      </div>
    </div>`;
  }

  /** Une ligne courte : points du stock par rôle et volume (le détail est dans Calculs). */
  function resume() {
    if (donnees.resumeTexte) return `<p class="resume-terrain">${echapper(donnees.resumeTexte)}</p>`;
    const { resume: r, volume } = donnees;
    const morceaux = [`${r.contour} contour`, `${r.pointsLignes} lignes`, `${r.isoles} isolés`];
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
    conteneur.innerHTML = `
        <div class="ecran-terrain">
          ${donnees.mode === 'controler' && ['point', 'ligne'].includes(donnees.controle.implantation) ? barreAccroche() : ''}
          ${choixMode()}
          ${connexion()}
          ${donnees.mode === 'controler' ? controle() : priseDePoint()}
          ${piedRecepteur()}
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
 * nord. haut, droite : où est le point par rapport au récepteur (m).
 */
function svgCible(numero, haut, droite, couleur, nordEnHaut) {
  const { cercles } = CIBLES[numero - 1];
  const echelle = 100 / cercles[0]; // le grand cercle fait 100 unités de rayon
  const texteRayon = (r) => (r >= 1 ? `${r} m` : `${Math.round(r * 100)} cm`);
  // Le récepteur est à l'opposé du point : s'il faut avancer, il est en dessous du centre.
  const limiter = (v) => Math.max(-108, Math.min(108, v));
  const x = limiter(-droite * echelle);
  const y = limiter(haut * echelle);
  return `<svg class="cible-implantation cible-${numero}" viewBox="-120 -124 240 240" role="img" aria-label="Cible ${texteRayon(cercles[0])}">
    ${cercles.map((r, i) => `<circle r="${r * echelle}" class="anneau anneau-${i}" />`).join('')}
    ${cercles.map((r) => `<text x="${(r * echelle * Math.SQRT1_2 + 2).toFixed(1)}" y="${(r * echelle * Math.SQRT1_2 + 12).toFixed(1)}" class="rayon">${texteRayon(r)}</text>`).join('')}
    <path d="M-110 0H110M0 -110V110" class="axes" />
    <text y="-112" text-anchor="middle" class="haut-cible">${nordEnHaut ? 'N' : 'devant'}</text>
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
    const satellites = etat.nbSatellites != null ? ` · ${etat.nbSatellites} sat.` : '';
    const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat.qualite] ?? `GNSS : ${etat.libelleQualite ?? '?'}`;
    // Corrections reçues directement par l'appli (sans Emlid Flow) : on le rappelle.
    const direct = etat.corrections?.etat === 'recoit' ? ' · direct' : '';
    rtk.textContent = `${statut}${satellites}${direct}`;
    rtk.className = etat.qualite === 4 ? 'ok' : 'pas-ok';
  }
  if (etat.etatInclinaison == null) {
    inclinaison.textContent = 'Inclinaison : ?';
    inclinaison.className = 'attente';
  } else {
    const angle = etat.inclinaison != null ? ` (${etat.inclinaison.toFixed(0)}°)` : '';
    inclinaison.textContent = etat.inclinaisonPrete ? `Inclinaison PRÊTE${angle}` : 'Inclinaison NON PRÊTE';
    inclinaison.className = etat.inclinaisonPrete ? 'ok' : 'pas-ok';
  }
}
