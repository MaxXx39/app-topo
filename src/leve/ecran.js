// Onglet Terrain (seulement dans l'appli Android), avec le récepteur Emlid. Deux modes :
// - Lever : écran épuré pour le chantier, le plan en haut (voir style.css, « mode-leve »), puis le
//   rôle du prochain point (contour, ligne de rupture, point isolé), son nom, la position et le gros
//   bouton PRENDRE LE POINT. Le levé, le stock et le récepteur sont dans une ligne repliable.
// - Contrôler : on choisit une surface ; en direct, de combien monter ou descendre pour être
//   dessus, et deux coupes autour du récepteur (perpendiculaire et dans l'axe de la direction regardée).
//   Ou on implante un point : on le choisit en touchant le plan (accroche au sommet, au milieu, sur
//   la ligne ou au centre d'un cercle), puis on l'implante (guidage avance / droite) ou on le garde
//   dans la liste « À implanter ». « Enregistrer l'implantation » note la position et les écarts.
// Aussi : les bandeaux « RTK » et « Inclinaison » sous l'en-tête, visibles dans tous les onglets.
//
// L'état du récepteur arrive 5 fois par seconde (mettreAJourRecepteur) : on ne change alors que
// quelques textes et l'état du bouton, sans redessiner l'écran (le doigt peut être dessus).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';
import { svgCoupeDirecte } from './coupe-directe.js';
import { MODES_ACCROCHE } from '../topo/accroche.js';
import { lireTexteLibelles, ecrireTexteLibelles } from './libelles.js';

// Mode Contrôler : ce qu'on implante (Ligne viendra plus tard), vue des coupes, longueurs.
const IMPLANTATIONS = [
  ['point', 'Point', true],
  ['ligne', 'Ligne', false],
  ['surface', 'Surface', true],
];
const VUES_COUPES = [
  ['les2', 'Les 2'],
  ['perpendiculaire', 'Perpendiculaire'],
  ['axe', 'Dans l\'axe'],
];
export const LONGUEURS_COUPE = [2, 5, 10, 20];
// Ce que l'on lève (même choix que « + Nouvelle surface » dans Calculs › Surfaces).
const NATURES_TERRAIN = [
  ['stock', 'Stock'],
  ['terrain', 'Terrain naturel'],
  ['terrassement', 'Terrassement'],
];
// Accroches : un petit dessin chacune, comme dans AutoCAD (le nom en bulle et pour la lecture d'écran).
const ACCROCHES = {
  sommet: ['Sommet', '<path d="M3 20 12 7l9 13" /><rect x="9" y="4" width="6" height="6" />'],
  milieu: ['Milieu', '<path d="M2 18h20" /><path d="M12 7l6 10H6z" />'],
  ligne: ['Sur la ligne', '<path d="M3 21 21 5" /><path d="M7 6h8l-8 9h8z" />'],
  centre: ['Centre du cercle', '<circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" />'],
};
const TITRES_COUPES = {
  perpendiculaire: { titre: 'Perpendiculaire', gauche: '← gauche', droite: 'droite →' },
  axe: { titre: 'Dans l\'axe', gauche: '← derrière', droite: 'devant →' },
};

// Petit dessin de chaque rôle, comme dans Calculs › Surfaces (contour rouge, ligne orange, point vert).
const ICONES = {
  contour: '<path d="M4 8 11 3l9 5-2 11-13 1z" />',
  ligne: '<path d="M3 18l6-7 4 4 8-9" />',
  isole: '<circle cx="12" cy="12" r="4" />',
};

/**
 * Crée l'écran dans "conteneur". Les actions sont faites par main.js via "actions" :
 * choisirRecepteur(), reconnecter(), deconnecter(), nouvelleSurface(nature), choisirStock(id), choisirRole(role), nouvelleLigne(), basculerFermeture(), prendrePoint(nom),
 * annulerDernierPoint(), choisirLibelle(abréviation), enregistrerLibelles({ lignes, points }),
 * choisirMode(mode), choisirSurfaceControle(id), choisirVueCoupes(vue),
 * choisirLongueurCoupe(m), choisirExagerationCoupe(facteur), choisirSourceOrientation(source),
 * choisirImplantation(quoi), choisirAccroche(mode), implanterChoix({ nom, altitude }),
 * creerPointAImplanter({ nom, altitude }), implanterPoint(id), supprimerPointAImplanter(id),
 * arreterImplantation(), oublierChoix(), enregistrerImplantation(), exporterImplantations()
 * Renvoie { afficher(donnees), prendreDepuisTouche(), enregistrerDepuisTouche(), mettreAJourRecepteur(etat, direct) }.
 */
export function creerEcranLeve(conteneur, actions) {
  let etat = null; // dernier état du récepteur (voir src/android/pont.js)
  let donnees = null;
  let choixNatureOuvert = false; // « + Nouvelle » touché : on choisit stock, terrain naturel ou terrassement
  let libellesOuverts = false; // listes de libellés en cours de modification
  let direct = null; // orientation et contrôle calculés par main.js à chaque état du récepteur

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
      actions.enregistrerLibelles({ lignes: lireTexteLibelles(texte('libelles-lignes')), points: lireTexteLibelles(texte('libelles-points')) });
      return;
    }
    if (action === 'nouvelleSurface') choixNatureOuvert = false;
    if (action === 'implanterChoix' || action === 'creerPointAImplanter') {
      const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`)?.value ?? '';
      actions[action]({ nom: champ('nom-implantation'), altitude: champ('altitude-implantation') });
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
  });

  // Touche Entrée dans le nom : prend le point (comme le bouton), si c'est permis.
  conteneur.addEventListener('keydown', (evenement) => {
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

    // Orientation : valeurs brutes, pour contrôler le cap du RX2 sur le terrain.
    const orientation = conteneur.querySelector('[data-vivant="orientation"]');
    if (orientation) {
      const o = direct?.orientation;
      const degres = (valeur) => (valeur == null ? '—' : `${Math.round(valeur)}°`);
      orientation.textContent = `cap RX2 ${degres(o?.cap)} · marche ${degres(o?.marche)}`;
    }
    if (donnees?.mode === 'controler' && donnees.controle.implantation === 'point') rafraichirImplantation();
    else if (donnees?.mode === 'controler') rafraichirControle();
  }

  /** Implantation d'un point : guidage vers le point et bouton « Enregistrer l'implantation ». */
  function rafraichirImplantation() {
    const g = direct?.implantation;
    const bouton = conteneur.querySelector('[data-action="enregistrerImplantation"]');
    if (bouton) bouton.disabled = !(etat?.connecte && etat?.autorise && donnees.implanter.cible);
    const zone = conteneur.querySelector('[data-vivant="guidage"]');
    if (!zone) return;
    if (!g || g.message) {
      zone.className = 'guidage-direct attente';
      zone.innerHTML = `<span class="message-ecart">${echapper(g?.message ?? 'En attente de la position…')}</span>`;
      return;
    }
    const { avance, droite, est, nord, distance, direction, azimut } = g.guidage;
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    // Flèche vers le point : par rapport à la direction regardée, sinon par rapport au nord.
    const angle = azimut == null ? direction : direction - azimut;
    const lignes = avance == null
      ? [`${nord >= 0 ? 'Nord' : 'Sud'} ${m(nord)}`, `${est >= 0 ? 'Est' : 'Ouest'} ${m(est)}`]
      : [`${avance >= 0 ? '↑ Avance' : '↓ Recule'} ${m(avance)}`, `${droite >= 0 ? '→ Droite' : '← Gauche'} ${m(droite)}`];
    const hauteur = g.ecartAltitude == null
      ? ''
      : `<span class="hauteur-guidage ${g.classeAltitude}">${g.ecartAltitude >= 0 ? '↑ Monter' : '↓ Descendre'} ${m(g.ecartAltitude)}</span>`;
    zone.className = `guidage-direct ${g.classe}`;
    zone.innerHTML = `
      <svg class="fleche-guidage" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -17 11 6 0 0 -11 6Z" transform="rotate(${angle.toFixed(1)})" /></svg>
      <span class="lignes-guidage">${lignes.map((texte) => `<span>${texte}</span>`).join('')}</span>
      <span class="distance-guidage">${formaterNombre(distance)} m${azimut == null ? ' · nord en haut' : ''}</span>
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

  /** Lever | Contrôler, en haut de l'onglet. */
  function choixMode() {
    return `<div class="modes-terrain" role="group" aria-label="Mode">
      ${[['lever', 'Lever'], ['controler', 'Contrôler']]
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
    const choixImplantation = `<div class="ligne-choix"><span>Implanter</span>${boutonsChoix('choisirImplantation', IMPLANTATIONS, reglages.implantation)}</div>`;
    if (reglages.implantation === 'point') return choixImplantation + implanterPoint();
    return `
      ${choixImplantation}
      ${surfaces.length > 0
        ? `<select data-champ="surface-controle" aria-label="Surface à contrôler">
            ${reglages.surfaceId ? '' : '<option value="">— choisir une surface —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === reglages.surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucune surface dans le projet : crée-la dans Calculs › Surfaces, ou importe un LandXML.</p>'}
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
   * Implantation d'un point : accroche (4 petits dessins), point choisi sur le plan (implanter ou
   * créer), guidage, enregistrement, liste « À implanter ».
   */
  function implanterPoint() {
    const { implanter: imp, controle: reglages } = donnees;
    const accroches = `<div class="accroches" role="group" aria-label="Accroche">
      ${MODES_ACCROCHE.map((mode) => `<button type="button" class="bouton-accroche ${imp.accroche === mode ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${mode}" title="${ACCROCHES[mode][0]}" aria-label="${ACCROCHES[mode][0]}" aria-pressed="${imp.accroche === mode}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ACCROCHES[mode][1]}</svg></button>`).join('')}
      <span class="aide">${imp.choix ? '' : 'puis touche le plan'}</span>
    </div>`;
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
        <div class="guidage-direct attente" data-vivant="guidage"></div>
        <button type="button" class="bouton bouton-prendre" data-action="enregistrerImplantation" disabled>
          <span>ENREGISTRER L'IMPLANTATION</span><span class="sous-titre-prendre">ou touche vol − de la tablette</span>
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
      ${accroches}
      ${choix}
      ${cible}
      ${liste}
      ${exporter}
      <div class="ligne-choix"><span>Orientation</span>${boutonsChoix('choisirSourceOrientation', [['rx2', 'Cap RX2'], ['marche', 'Marche']], reglages.sourceOrientation)}</div>
      <p class="aide" data-vivant="orientation"></p>`;
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
      <p class="titre-choix">${donnees.stock ? 'Nouvelle surface : c\'est…' : 'Que lèves-tu ?'}</p>
      <div class="natures-terrain">
        ${NATURES_TERRAIN.map(([cle, titre]) => `<button type="button" class="bouton-nature nature-${cle}" data-action="nouvelleSurface" data-valeur="${cle}">${titre}</button>`).join('')}
      </div>
      ${donnees.stock ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerChoixNature">annuler</button>' : ''}
    </div>`;
  }

  /** Une seule ligne : la surface levée en cours (à changer) et « + Nouvelle ». */
  function ligneSurface() {
    return `<div class="ligne-surface">
      <select data-champ="stock" aria-label="Surface levée">
        ${donnees.stocks.map((s) => `<option value="${s.id}" ${s.id === donnees.stock.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}
      </select>
      <button type="button" class="bouton-secondaire" data-action="ouvrirChoixNature">+ Nouvelle</button>
    </div>`;
  }

  /** Récepteur connecté (à couper), en bas de l'écran. */
  function piedRecepteur() {
    return `<p class="pied-recepteur" data-si-connecte hidden>
      <span>Récepteur : <strong data-vivant="connexion"></strong></span>
      <button type="button" class="bouton-lien" data-action="deconnecter">couper</button>
    </p>`;
  }

  /** Choix du rôle : 3 gros boutons à la couleur du rôle. */
  function boutonsRoles() {
    return `<div class="roles-leve" role="group" aria-label="Rôle du prochain point">
      ${ROLES_LEVE.filter(([cle]) => donnees.rolesPermis.includes(cle)).map(
        ([cle, titre]) => `<button type="button" class="role-leve role-${cle} ${donnees.role === cle ? 'choisi' : ''}" data-action="role" data-role="${cle}" aria-pressed="${donnees.role === cle}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle]}</svg>${titre}</button>`,
      ).join('')}
    </div>`;
  }

  /** Ligne de rupture en cours : numéro, nombre de points, nouvelle ligne, fermer. */
  function outilsLigne() {
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
    const ligne = donnees.role === 'ligne';
    const liste = ligne ? donnees.libelles.lignes : donnees.libelles.points;
    const actif = ligne ? donnees.libelleLigne : donnees.libellePoint;
    return `<div class="libelles-terrain ${ligne ? 'pour-lignes' : 'pour-points'}" role="group" aria-label="Ce que l'on lève">
      ${liste.map(([abreviation, signification]) => `<button type="button" class="puce-libelle ${abreviation === actif ? 'actif' : ''}" data-action="choisirLibelle" data-valeur="${echapper(abreviation)}">
          <strong>${echapper(abreviation)}</strong><span>${echapper(signification)}</span></button>`).join('')}
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ouvrirLibelles">modifier</button>
    </div>
    ${libellesOuverts ? editeurLibelles() : ''}`;
  }

  /** Modification des listes de libellés : une ligne par libellé, « HT haut de talus ». */
  function editeurLibelles() {
    return `<div class="editeur-libelles">
      <p class="aide">Une ligne par libellé : l'abréviation (sans espace ni tiret), puis ce qu'elle veut dire. La liste est gardée sur cette tablette, pour tous les projets.</p>
      <label>Lignes de rupture (L-…)<textarea data-champ="libelles-lignes" rows="6">${echapper(ecrireTexteLibelles(donnees.libelles.lignes))}</textarea></label>
      <label>Points isolés (P-…)<textarea data-champ="libelles-points" rows="6">${echapper(ecrireTexteLibelles(donnees.libelles.points))}</textarea></label>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="enregistrerLibelles">Enregistrer</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="fermerLibelles">annuler</button>
      </div>
    </div>`;
  }

  /** Une ligne courte : points du stock par rôle et volume (le détail est dans Calculs). */
  function resume() {
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
        <span>PRENDRE LE POINT</span><span class="sous-titre-prendre">ou touche vol − de la tablette</span>
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
          ${choixMode()}
          ${connexion()}
          ${donnees.mode === 'controler' ? controle() : priseDePoint()}
          ${piedRecepteur()}
        </div>`;
    rafraichirVivant();
  }
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
    rtk.textContent = `${statut}${satellites}`;
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
