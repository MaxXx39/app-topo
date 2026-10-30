// Affichage du plan : points avec leur nom, zoom et déplacement
// au doigt (téléphone) ou à la souris (ordinateur).
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer, barreEchelle, zoneVisible } from './vue.js';
import { bulle } from '../aide/bulles.js';
import { aAcces } from '../reglages/reglages.js';
import { dessinerDessins } from './dessins.js';
import { placerEtiquettes, pointInterieur } from './etiquettes.js';
import { pointDansPolygone } from '../topo/volume.js';
import { bordDeTriangles } from '../topo/surface.js';
import { formaterNombre } from '../topo/format.js';
import { svgDrapeau } from '../outils/drapeaux.js';
import { traitsDeBarbules } from './barbules.js';
import { pointALAbscisse } from '../topo/ligne-implantation.js';
import { lireLibelles, couleurDuNom, couleurDeLigne, formeDuNom } from '../leve/libelles.js';
import { cheminForme, formeEnTrait } from './formes.js';
import { ouvrirVue3d } from './vue3d.js';
import { dessinerPlansDxf as dessinerCanvasDxf, COULEURS_PLANS } from './dxf-canvas.js';
import { echapper } from '../outils/echapper.js';
import { COULEURS_LISTES, SECTIONS } from './listes-points.js';
import { choixCouleur as paletteCouleur } from '../outils/palette.js';
import { FONDS, niveauDeZoom, tuilesPourZone, garderLesTraits } from './fond.js';
import { couleurAltitude } from './couleurs.js';
import { zonesRemblaiDeblai, PALIERS, enRgb } from './ecarts.js';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';
import { lignesEtiquette, texteMorceau, placeEtiquetteMesure, valeurPrincipale, couleurDeMesure } from '../mesures/valeurs.js';
import { nomsDeLaMesure } from '../topo/mesure.js';

const SVG = 'http://www.w3.org/2000/svg';

// Distance maximale (pixels) entre le doigt et un point pour le "toucher".
const RAYON_TOUCHER = 22;
// Bouton « Ma position » : le plan montre environ 20 m (dans sa plus petite dimension) autour de soi.
const METRES_AUTOUR_DE_MOI = 20;

// Ce qui est dessiné (0.94.0, tableau « Affichage » du 29.10.2026). Plus rien n'est retenu : ces
// valeurs de départ reviennent à chaque démarrage de l'appli.
// - Fond : photo aérienne (et sa transparence, %), cadastre ;
// - Contrôle : nom (ID) et altitude des points de contrôle (roue en Expert) ;
// - Levé (et Points Import) : points, noms, altitudes, contours, lignes ; en Expert (roue) :
//   triangles, couleurs selon l'altitude, courbes de niveau, altitudes des lignes et contours ;
// - Volume (Expert) : déblai / remblai, étiquette du volume (cachés au départ) ;
// - Surface Import : couleurs selon l'altitude (roue, tous les modes) ;
// - Métré : traits et valeurs des mesures.
const CALQUES_DEPART = {
  fondSatellite: false,
  cadastre: false,
  transparencePhoto: 0,
  controleNoms: true,
  controleAltitudes: true,
  points: true,
  noms: true,
  altitudes: true,
  contours: true,
  lignes: true,
  altitudesLignes: true,
  triangles: false,
  couleursAltitude: false,
  courbes: false,
  equidistance: 'auto',
  remblaiDeblai: false,
  volumes: false,
  palier: 'auto',
  couleursAltitudeImport: false,
  mesures: true,
  autresStocks: true,
};
// Réglages réservés à Expert : en dessous, ils gardent leur valeur de départ.
const CALQUES_EXPERT = new Set(['controleNoms', 'controleAltitudes', 'triangles', 'couleursAltitude', 'courbes', 'altitudesLignes', 'remblaiDeblai', 'volumes', 'palier', 'equidistance']);
// Équidistances proposées pour les courbes et les couleurs (m). « auto » : choisie selon la hauteur du stock.
const EQUIDISTANCES = ['auto', '0.1', '0.2', '0.25', '0.5', '1'];

/**
 * Crée le plan dans l'élément "conteneur" de la page.
 * - quandToucherPoint(nom) : appelé quand on touche un point pendant une modification
 * - quandToucherStock(index) : appelé quand on touche l'intérieur d'un stock (hors modification)
 * - quandToucherTriangle(triangle) : appelé quand on touche un triangle de la surface affichée,
 *   en mode suppression de triangles (dessin.modeTriangles)
 * - quandToucherPosition({ est, nord }) : appelé pendant le tracé d'une coupe (dessin.traceCoupe) ;
 *   près d'un point levé, la position est celle de ce point
 * - quandToucherMesure(id) : appelé quand on touche une mesure (onglet Calculs › Mesures, hors modification)
 * - quandToucherImplantation({ est, nord }, tolerance) : appelé quand on touche le plan pendant
 *   l'implantation d'un point (tolérance en m : la taille du doigt à l'échelle du plan)
 * - quandMontrerCalqueDxf(idPlan, numero, visible) : un calque d'un plan DXF coché (menu DXF, 0.94.0)
 * - quandBasculerSeul(actif) : bouton « Seul » (seulement ce sur quoi je travaille, 0.94.0)
 * Renvoie un objet avec les fonctions afficherPoints(points) et redessiner(dessin).
 */
export function creerPlan(conteneur, { quandToucherPoint, quandToucherStock, quandToucherTriangle, quandToucherPosition, quandToucherMesure, quandToucherImplantation, quandReglerPlanDxf, quandMontrerListe, quandColorerListe, quandMontrerCalqueDxf, quandBasculerSeul, quandToucherPhoto } = {}) {
  // Réglages choisis ; « calques » est ce qui est dessiné : en dessous d'Expert, les réglages
  // d'Expert gardent leur valeur de départ.
  const calquesChoisis = { ...CALQUES_DEPART };
  const calques = new Proxy(calquesChoisis, {
    get: (cible, cle) => (CALQUES_EXPERT.has(cle) && !aAcces('expert') ? CALQUES_DEPART[cle] : cible[cle]),
  });
  // « Seulement ce sur quoi je travaille » (0.94.0) : bouton du plan, l'appli décide quoi garder.
  let seulTravail = false;

  // Boutons posés sur le plan : calques en haut à gauche, zoom en haut à droite.
  conteneur.innerHTML = `
    <div class="plan-cadre">
      <div class="plan-fond" aria-hidden="true"></div>
      <canvas class="plan-dxf-canvas" aria-hidden="true"></canvas>
      <svg class="plan" role="img" aria-label="Plan des points"></svg>
      <div class="plan-attribution" hidden></div>
      <div class="plan-calques">
        <button type="button" class="puce" data-action="calques" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>
          Fond
        </button>
        <button type="button" class="puce" data-action="plans-dxf" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11l5 5v11H4z" /><path d="M15 4v5h5M8 13h8M8 17h5" /></svg>
          DXF
        </button>
        <button type="button" class="puce" data-action="listes-points" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
          Afficher
        </button>
        <button type="button" class="puce puce-seul" data-action="seul-travail" aria-pressed="false" title="Seulement ce sur quoi je travaille">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
          Seul
        </button>
        <button type="button" class="puce seulement-expert" data-action="vue-3d" title="Vue 3D des levés et surfaces montrés">3D</button>
        ${bulle('plan')}
        <div class="menu-plans-dxf" hidden></div>
        <div class="menu-plans-dxf menu-listes-points" hidden></div>
        <div class="menu-calques" hidden>
          <div class="ligne-menu-plan">
            <label class="case"><input type="checkbox" data-calque="fondSatellite" /> Photo aérienne (swisstopo)</label>
            <button type="button" class="roue-menu" data-roue="photo" aria-expanded="false" title="Transparence" aria-label="Transparence de la photo">⚙</button>
          </div>
          <label class="reglette-transparence" data-zone-roue="photo" hidden>Transparence <span data-vivant="transparence">0 %</span>
            <input type="range" min="0" max="100" step="5" value="0" data-calque="transparencePhoto" /></label>
          <label class="case"><input type="checkbox" data-calque="cadastre" /> Cadastre</label>
        </div>
      </div>
      <div class="plan-boutons">
        <button type="button" data-action="zoom-plus" aria-label="Zoomer">+</button>
        <button type="button" data-action="zoom-moins" aria-label="Dézoomer">−</button>
        <button type="button" data-action="tout-voir" aria-label="Tout voir" title="Tout voir">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        <button type="button" data-action="ma-position" aria-label="Ma position" title="Ma position" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
        <button type="button" data-action="nord-en-haut" class="bouton-nord" aria-label="Nord en haut" title="Nord en haut" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 16 12H8Z" class="nord" /><path d="M12 22 8 12h8Z" /><text x="12" y="10.5" text-anchor="middle">N</text></svg>
        </button>
      </div>
    </div>
  `;
  const svg = conteneur.querySelector('svg.plan');
  const boutonCalques = conteneur.querySelector('[data-action="calques"]');
  const menuCalques = conteneur.querySelector('.menu-calques');
  const boutonPlans = conteneur.querySelector('[data-action="plans-dxf"]');
  const menuPlans = conteneur.querySelector('.menu-plans-dxf:not(.menu-listes-points)');
  const boutonListes = conteneur.querySelector('[data-action="listes-points"]');
  const menuListes = conteneur.querySelector('.menu-listes-points');
  const cadre = conteneur.querySelector('.plan-cadre');
  const fond = conteneur.querySelector('.plan-fond');
  const canvasDxf = conteneur.querySelector('.plan-dxf-canvas');
  const attribution = conteneur.querySelector('.plan-attribution');
  // Images des tuiles affichées, rangées par adresse (pour les réutiliser d'un dessin à l'autre).
  const tuilesAffichees = new Map();
  let fondIndisponible = false;

  let points = [];
  let vue = null;
  // Position du récepteur (appli Android) : { est, nord, prete, azimut (°, ou null),
  // coupes: [{ sens, debut, fin }] (coupes en direct du mode Implanter) } ou null.
  let position = null;
  // Suivi de la position (bouton « Ma position », 3 modes à la suite, comme Google Maps) :
  // 'libre' (pas de suivi), 'suivre' (le plan se recentre sur elle, nord en haut), 'cap' (il se
  // recentre et tourne : le devant du RX2 en haut). Déplacer le plan au doigt arrête le suivi
  // (le plan garde son angle ; la boussole du plan le remet nord en haut).
  let suivi = 'libre';
  // Plans DXF en fond (voir topo/dxf-plan.js), dessinés sur un canvas sous le dessin (voir
  // dxf-canvas.js) ; redessinés seulement si la vue ou les plans changent (signatureDxf).
  let plansDxf = [];
  let signatureDxf = '';
  // Implantation d'un point (Terrain › Implanter › Point) : { actif (toucher le plan accroche un
  // point), aImplanter: [{ nom, est, nord }], pointsControle: [{ nom, est, nord }] (triangles rouges),
  // choix: { est, nord } (croix), cible: { est, nord, nom } } ou null.
  let implantation = null;
  // Couleur de chaque point d'après sa liste (menu « Afficher » ou Projet, voir listes-points.js) : Map point → couleur.
  let couleursPoints = new Map();
  // Vrai si le plan doit être recadré dès qu'il devient visible (il est caché dans un autre onglet).
  let recadrerQuandVisible = false;
  let cadreSurfacesImportees = 0; // sommets des surfaces importées sur lesquels on a déjà cadré (projet sans point)
  // Ce qu'il faut dessiner (voir editeur.js et main.js) :
  // stocks (les surfaces du projet), stockActif (surface choisie), listeEnCours, enEdition,
  // resultats (un par surface : trianglesDessus, et le volume s'il est calculé, voir volume.js),
  // cachees : surfaces à ne pas dessiner (celles d'un autre levé)
  // surface : surface affichée { triangles, trianglesRetires } ; modeTriangles : suppression au doigt
  // ecarts : triangles d'écart à colorier à la place de ceux des surfaces, sinon null
  // coupes : coupes tracées [{ nom, debut, fin }] ; traceCoupe : { debut } pendant un tracé, sinon null
  // modeMesures : onglet Calculs › Mesures (toucher une mesure la choisit) ; mesures : [{ mesure, resultat }]
  // du levé affiché ; mesureActive : mesure choisie (ses points sont entourés pendant une modification)
  let dessin = {
    modeMesures: false,
    mesures: [],
    mesureActive: null,
    coupes: [],
    traceCoupe: null,
    stocks: [],
    stockActif: null,
    cachees: new Set(),
    listeEnCours: [],
    enEdition: false,
    resultats: [],
    surface: null,
    modeTriangles: false,
    ecarts: null,
  };

  /** Taille actuelle du plan à l'écran (pixels). */
  function taille() {
    const rectangle = cadre.getBoundingClientRect();
    return { largeur: rectangle.width, hauteur: rectangle.height };
  }

  /** Noms des points choisis dans une surface (tous rôles confondus). */
  function nomsDuStock(stock) {
    return [...(stock.contour ?? []), ...(stock.lignesRupture ?? []).flatMap((l) => l.noms), ...pointsChoisis(stock)];
  }

  /** Points choisis un par un pour une surface (rien si elle prend tous les points, ou si elle est importée). */
  function pointsChoisis(stock) {
    return stock.tousLesPoints ? [] : (stock.points ?? []).filter((p) => typeof p === 'string');
  }

  /** Vrai si la surface doit être dessinée : pas cachée, et active ou « Autres surfaces » coché. */
  function estVisible(stock) {
    return !dessin.cachees?.has(stock) && (stock === dessin.stockActif || calques.autresStocks);
  }

  // Légendes remplies pendant le dessin : relief (couleurs, équidistance) et remblai / déblai.
  let legende = null;
  let legendeEcarts = null;

  /** Redessine tout le plan avec la vue actuelle. */
  function dessiner() {
    if (geste) return; // redessiné à la fin du geste
    svg.replaceChildren();
    legende = null;
    legendeEcarts = null;
    dessinerFond();
    if (vue) dessinerPlansDxf();
    else if (signatureDxf) {
      canvasDxf.getContext('2d').clearRect(0, 0, canvasDxf.width, canvasDxf.height);
      signatureDxf = '';
    }
    // Sans point, une surface importée (LandXML, DXF 3D) se dessine quand même (0.83.0).
    if (vue && points.length === 0 && sommetsDesSurfacesImportees().length > 0) {
      dessinerStocks();
      dessinerBarreEchelle();
      dessinerImplantation();
      dessinerPosition();
      return;
    }
    if (!vue || points.length === 0) {
      if (vue && plansDxf.length > 0) dessinerBarreEchelle();
      dessinerImplantation();
      dessinerPosition();
      return;
    }

    const stock = dessin.stockActif;
    // Si « Autres stocks » est décoché, on cache les points qui appartiennent à un autre stock.
    const nomsCaches = new Set();
    if (!calques.autresStocks) {
      const nomsActifs = new Set(stock ? nomsDuStock(stock) : []);
      for (const autre of dessin.stocks) {
        if (autre !== stock && !dessin.cachees?.has(autre)) for (const nom of nomsDuStock(autre)) if (!nomsActifs.has(nom)) nomsCaches.add(nom);
      }
    }

    dessinerStocks();

    // Rôle de chaque point dans le stock actif, pour lui donner une couleur.
    const classes = new Map();
    if (stock) {
      for (const nom of pointsChoisis(stock)) classes.set(nom, 'role-dessus');
      // « Tous les points du levé » : ils sont tous en vert (seulement ceux dans le contour s'il y en a un).
      if (stock.type === 'points' && stock.tousLesPoints) {
        const parNom = new Map(points.map((p) => [p.nom, p]));
        const polygone = (stock.contour ?? []).map((nom) => parNom.get(nom)).filter(Boolean);
        for (const point of points) {
          if (polygone.length < 3 || pointDansPolygone(point, polygone)) classes.set(point.nom, 'role-dessus');
        }
      }
      for (const nom of (stock.lignesRupture ?? []).flatMap((ligne) => ligne.noms)) classes.set(nom, 'role-ligne');
      for (const nom of stock.contour ?? []) classes.set(nom, 'role-contour');
    }
    // Points de la mesure choisie : dans sa couleur (cyan au départ).
    svg.style.setProperty('--couleur-mesure', dessin.mesureActive ? couleurDeMesure(dessin.mesureActive) : '');
    if (dessin.mesureActive) {
      for (const nom of nomsDeLaMesure(dessin.mesureActive)) classes.set(nom, 'role-mesure');
      const triangles = dessin.mesures.find((m) => m.mesure === dessin.mesureActive)?.resultat?.triangles ?? [];
      for (const nom of triangles.flat().map((p) => p.nom)) classes.set(nom, 'role-mesure');
    }
    const rangs = new Map(dessin.listeEnCours.map((nom, index) => [nom, index + 1]));

    // Points visibles à l'écran, ceux du stock actif en premier (leurs noms sont prioritaires).
    const visibles = [];
    for (const point of points) {
      if (nomsCaches.has(point.nom)) continue;
      const { x, y } = versEcran(point.est, point.nord, vue);
      if (x < -50 || y < -50 || x > vue.largeur + 50 || y > vue.hauteur + 50) continue;
      visibles.push({ point, x, y, prioritaire: rangs.has(point.nom) || classes.has(point.nom) });
    }
    visibles.sort((a, b) => Number(b.prioritaire) - Number(a.prioritaire));

    const groupePoints = creerElement('g', { class: 'points' });
    const groupeNoms = creerElement('g', { class: 'noms' });
    // Couleur choisie pour le libellé du nom (P-RG-1 : regard en noir…), à la place de celle du rôle.
    const libelles = lireLibelles();
    for (const { point, x, y } of visibles) {
      if (calques.points || rangs.has(point.nom)) {
        // Forme choisie pour le libellé (0.97.0) : rond plein, sinon carré, triangle, croix…
        const forme = formeDuNom(point.nom, libelles);
        const trace = cheminForme(forme, x, y, 3.5);
        const classe = `${classes.get(point.nom) ?? ''}${formeEnTrait(forme) ? ' forme-trait' : ''}`;
        const rond = trace ? creerElement('path', { d: trace, class: classe }) : creerElement('circle', { cx: x, cy: y, r: 3.5, class: classe });
        // Couleur du libellé d'abord (plus précise), sinon celle de la liste.
        const couleur = classes.get(point.nom) === 'role-mesure' ? null : couleurDuNom(point.nom, libelles) ?? couleursPoints.get(point);
        if (couleur) rond.style.color = couleur;
        groupePoints.append(rond);
      }
      if (rangs.has(point.nom)) {
        // Point de la liste en cours : entouré, avec son numéro d'ordre.
        groupePoints.append(creerElement('circle', { cx: x, cy: y, r: 8, class: 'selection' }));
        const rang = creerElement('text', { x: x - 5, y: y + 16, class: 'rang', 'text-anchor': 'end' });
        rang.textContent = rangs.get(point.nom);
        groupeNoms.append(rang);
      }
    }

    // Noms et altitudes : placés sans chevauchement (les étiquettes sans place sont cachées).
    // Roue de « Levé » (Expert) : altitudes des points des lignes et des contours cachées.
    const nomsDesLignes = new Set();
    if (!calques.altitudesLignes) {
      for (const autre of dessin.stocks) for (const nom of [...(autre.contour ?? []), ...(autre.lignesRupture ?? []).flatMap((l) => l.noms)]) nomsDesLignes.add(nom);
    }
    if (calques.noms || calques.altitudes) {
      const textes = visibles.map(({ point }) =>
        [calques.noms ? point.nom : null, calques.altitudes && !nomsDesLignes.has(point.nom) ? formaterNombre(point.altitude) : null].filter(Boolean),
      );
      const places = placerEtiquettes(
        visibles.map(({ x, y }, i) => ({
          x,
          y,
          largeur: Math.max(...textes[i].map((t) => t.length)) * 6.6,
          hauteur: textes[i].length * 13,
        })),
      );
      places.forEach((place, i) => {
        if (!place) return;
        textes[i].forEach((texte, ligne) => {
          const element = creerElement('text', {
            x: place.x,
            y: place.y - (textes[i].length - 1 - ligne) * 13 - 2,
            'text-anchor': place.aGauche ? 'end' : 'start',
            class: calques.noms && ligne === 0 ? '' : 'altitude',
          });
          // Nom à la couleur de sa liste, si elle en a une.
          const couleurListe = couleursPoints.get(visibles[i].point);
          if (couleurListe && calques.noms && ligne === 0) element.style.fill = couleurListe;
          element.textContent = texte;
          groupeNoms.append(element);
        });
      });
    }

    dessinerTracesMesures();
    svg.append(groupePoints, groupeNoms);
    dessinerEtiquettesMesures();
    dessinerCoupes();
    if (calques.volumes) dessinerVolumes();
    dessinerPhotos();
    dessinerLegende();
    dessinerBarreEchelle();
    dessinerImplantation();
    dessinerPosition();
    mettreAJourBoussolePlan();
  }

  /**
   * Implantation : points « À implanter » (croix sarcelle et nom), point choisi en touchant le
   * plan (croix ambre) et point à implanter en cours (cercle autour).
   */
  function dessinerImplantation() {
    svg.querySelector('g.implantation')?.remove();
    if (!implantation || !vue) return;
    const groupe = creerElement('g', { class: 'implantation' });
    const croix = (est, nord, classe, taille) => {
      const { x, y } = versEcran(est, nord, vue);
      groupe.append(creerElement('path', { d: `M${x - taille} ${y}H${x + taille}M${x} ${y - taille}V${y + taille}`, class: classe }));
      return { x, y };
    };
    // Lignes des levés « Autres » (contrôle, points géomètre…) : trait gris ardoise.
    const libelles = lireLibelles();
    for (const ligne of implantation.lignesAutres ?? []) {
      const ecran = ligne.sommets.map((p) => versEcran(p.est, p.nord, vue));
      const element = creerElement('path', { d: tracePar(ecran, ligne.fermee), class: 'ligne-autres' });
      const couleur = couleurDuNom(ligne.sommets[0]?.nom, libelles) ?? ligne.couleur;
      if (couleur) element.style.stroke = couleur;
      groupe.append(element);
    }
    // Points de contrôle (Terrain › Contrôle) : triangle rouge et nom en rouge.
    for (const point of implantation.pointsControle ?? []) {
      const { x, y } = versEcran(point.est, point.nord, vue);
      groupe.append(creerElement('path', { d: `M${x} ${y - 8}L${x + 7} ${y + 5}H${x - 7}Z`, class: 'triangle-controle' }));
      if (calques.controleNoms) {
        const nom = creerElement('text', { x: x + 9, y: y - 6, class: 'nom-controle' });
        nom.textContent = point.nom;
        groupe.append(nom);
      }
      // Altitude, sous le nom (roue de « Contrôle » en Expert).
      if (calques.controleAltitudes && point.altitude != null) {
        const altitude = creerElement('text', { x: x + 9, y: y + (calques.controleNoms ? 7 : -6), class: 'altitude-controle' });
        altitude.textContent = formaterNombre(point.altitude);
        groupe.append(altitude);
      }
    }
    for (const point of implantation.aImplanter ?? []) {
      const { x, y } = croix(point.est, point.nord, 'croix-a-implanter', 7);
      if (!calques.noms) continue;
      const nom = creerElement('text', { x: x + 9, y: y - 6, class: 'nom-a-implanter' });
      nom.textContent = point.nom;
      groupe.append(nom);
    }
    // Ligne à implanter : trait sarcelle épais, sa parallèle en pointillés, « Début » et « Fin ».
    const ligne = implantation.ligne;
    // Talus : zone brune entre la ligne et l'entrée en terre (ou le bord), le bord en pointillés,
    // et les barbules (traits longs et courts) qui partent du haut du talus. Sans entrée en terre
    // connue (ni surface ni longueur) : barbules courtes du côté du talus, pour le montrer.
    if (ligne?.talus && ligne.sommets.length >= 2) {
      const { zone, cote, ligneEst } = ligne.talus;
      let pied = [];
      let bord = [];
      if (zone) {
        pied = zone.ligne.map((p) => versEcran(p.est, p.nord, vue));
        bord = zone.bord.map((p) => versEcran(p.est, p.nord, vue));
        groupe.append(creerElement('path', { d: tracePar([...pied, ...[...bord].reverse()], true), class: 'zone-talus' }));
        groupe.append(creerElement('path', { d: tracePar(bord, false), class: 'bord-talus' }));
      } else {
        const ecran = ligne.sommets.map((p) => versEcran(p.est, p.nord, vue));
        const signe = cote === 'gauche' ? -1 : 1;
        for (let i = 0; i + 1 < ecran.length; i++) {
          const a = ecran[i];
          const b = ecran[i + 1];
          const l = Math.hypot(b.x - a.x, b.y - a.y);
          if (l === 0) continue;
          // À droite du sens de la ligne, à l'écran (y vers le bas) : (−dy, dx).
          const n = { x: (-(b.y - a.y) / l) * 16 * signe, y: ((b.x - a.x) / l) * 16 * signe };
          pied.push(a, b);
          bord.push({ x: a.x + n.x, y: a.y + n.y }, { x: b.x + n.x, y: b.y + n.y });
        }
      }
      const [haut, bas] = ligneEst === 'bas' ? [bord, pied] : [pied, bord];
      const d = traitsDeBarbules(haut, bas, 9);
      if (d) groupe.append(creerElement('path', { d, class: 'barbules-talus' }));
    }
    if (ligne?.sommets.length >= 2) {
      const ecran = ligne.sommets.map((s) => versEcran(s.est, s.nord, vue));
      groupe.append(creerElement('path', { d: tracePar(ecran, false), class: 'ligne-a-implanter' }));
      if (ligne.parallele) {
        groupe.append(creerElement('path', { d: tracePar(ligne.parallele.map((s) => versEcran(s.est, s.nord, vue)), false), class: 'parallele-a-implanter' }));
      }
      // Sens : petits chevrons tout le long, environ tous les 60 pixels.
      for (let i = 0; i + 1 < ecran.length; i++) {
        const a = ecran[i];
        const b = ecran[i + 1];
        const longueur = Math.hypot(b.x - a.x, b.y - a.y);
        if (longueur < 16) continue;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const nombre = Math.max(1, Math.floor(longueur / 60));
        for (let k = 0; k < nombre; k++) {
          const t = (k + 0.5) / nombre;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          groupe.append(creerElement('path', { d: 'M-5 -6 3 0-5 6', class: 'chevron-ligne', transform: `translate(${x} ${y}) rotate(${angle})` }));
        }
      }
      // Début : drapeau vert ; fin : drapeau à damier.
      for (const [bout, type] of [[ecran[0], 'debut'], [ecran.at(-1), 'fin']]) {
        groupe.append(creerElement('circle', { cx: bout.x, cy: bout.y, r: 5, class: 'bout-ligne' }));
        const drapeau = creerElement('g', { class: 'drapeau-ligne' });
        drapeau.innerHTML = svgDrapeau(type, bout.x, bout.y, 26);
        groupe.append(drapeau);
      }
    }
    // Points choisis pour faire une ligne : croix ambre numérotées.
    (implantation.pointsLigne ?? []).forEach((point, i) => {
      const { x, y } = croix(point.est, point.nord, 'croix-choix', 10);
      const numero = creerElement('text', { x: x + 10, y: y + 16, class: 'nom-bout-ligne' });
      numero.textContent = String(i + 1);
      groupe.append(numero);
    });
    const { cible, choix } = implantation;
    if (cible) {
      const { x, y } = versEcran(cible.est, cible.nord, vue);
      groupe.append(creerElement('circle', { cx: x, cy: y, r: 14, class: 'cible-implantation' }));
    }
    if (choix) croix(choix.est, choix.nord, 'croix-choix', 12);
    // Dessins (Calculs › Dessin) et, pour celui en cours, le pilote.
    dessinerDessins(groupe, implantation, (est, nord) => versEcran(est, nord, vue), creerElement, 1 / vue.echelle, calques.noms);
    svg.append(groupe);
  }

  // Lame suivie (Terrain › Lame), ou null.
  let lame = null;

  /** Lame sur le plan : trait épais entre les coins, chaque coin de la couleur de son écart, G et D. */
  function dessinerLame() {
    svg.querySelector('g.lame-plan')?.remove();
    if (!lame || !vue) return;
    const g = versEcran(lame.gauche.est, lame.gauche.nord, vue);
    const d = versEcran(lame.droite.est, lame.droite.nord, vue);
    const groupe = creerElement('g', { class: 'lame-plan' });
    groupe.append(creerElement('line', { x1: g.x, y1: g.y, x2: d.x, y2: d.y, class: 'trait-lame' }));
    for (const [p, classe, lettre] of [[g, lame.classeGauche, 'G'], [d, lame.classeDroite, 'D']]) {
      groupe.append(creerElement('circle', { cx: p.x, cy: p.y, r: 8, class: `coin-lame-plan ${classe ? `ecart-${classe}` : ''}` }));
      const texte = creerElement('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', class: 'lettre-lame' });
      texte.textContent = lettre;
      groupe.append(texte);
    }
    svg.append(groupe);
  }

  /**
   * Position du récepteur : rond bleu (gris si l'inclinaison n'est pas prête : c'est alors
   * la position de l'antenne, pas celle du bout de canne). Redessinée seule, 5 fois par seconde.
   */
  function dessinerPosition() {
    if (geste) return; // redessinée à la fin du geste
    svg.querySelector('g.position')?.remove();
    dessinerLame();
    if (!position || !vue) return;
    const { x, y } = versEcran(position.est, position.nord, vue);
    const groupe = creerElement('g', { class: position.tablette ? 'position position-tablette' : position.prete ? 'position' : 'position pas-prete' });
    // GPS de la tablette (sans RX2) : cercle de sa précision (quelques mètres), en gris.
    if (position.tablette && position.precision > 0) groupe.append(creerElement('circle', { cx: x, cy: y, r: Math.max(13, position.precision * vue.echelle), class: 'precision-tablette' }));
    // Coupes en direct : en pointillés, chacune de sa couleur (la même que son dessin).
    for (const coupe of position.coupes ?? []) {
      const debut = versEcran(coupe.debut.est, coupe.debut.nord, vue);
      const fin = versEcran(coupe.fin.est, coupe.fin.nord, vue);
      groupe.append(creerElement('line', { x1: debut.x, y1: debut.y, x2: fin.x, y2: fin.y, class: `trace-coupe-directe coupe-${coupe.sens}` }));
    }
    // Implantation d'une ligne : trait en pointillés jusqu'au point de la ligne en face de la canne.
    if (position.vers) {
      const vers = versEcran(position.vers.est, position.vers.nord, vue);
      groupe.append(creerElement('line', { x1: x, y1: y, x2: vers.x, y2: vers.y, class: 'trait-vers-cible' }));
    }
    // Implantation : trait en pointillés jusqu'au point à implanter.
    if (implantation?.cible) {
      const cible = versEcran(implantation.cible.est, implantation.cible.nord, vue);
      groupe.append(creerElement('line', { x1: x, y1: y, x2: cible.x, y2: cible.y, class: 'trait-vers-cible' }));
    }
    groupe.append(creerElement('circle', { cx: x, cy: y, r: 13, class: 'halo' }));
    // Petite flèche (comme Google Maps) : la direction où l'on regarde, dessinée vers le haut
    // puis tournée de l'azimut (sens des aiguilles d'une montre, comme à l'écran).
    if (position.azimut != null) {
      groupe.append(creerElement('path', {
        d: `M${x} ${y - 25} L${x + 8} ${y - 9} L${x} ${y - 13} L${x - 8} ${y - 9} Z`,
        class: 'fleche',
        transform: `rotate(${(position.azimut - (vue.rotation ?? 0)).toFixed(1)} ${x} ${y})`,
      }));
    }
    groupe.append(creerElement('circle', { cx: x, cy: y, r: 6 }));
    // Implantation d'une ligne : distances écrites le long de la ligne et sur la perpendiculaire.
    if (position.cotesLigne) dessinerCotesLigne(groupe, position.cotesLigne, { x, y }, position.vers);
    svg.append(groupe);
  }

  /**
   * Cotes de l'implantation d'une ligne, sans bulle, attachées aux traits : distance depuis le
   * début (« +8.111 m », « −5.428 m » avant le début) et jusqu'à la fin, écrites le long de la ligne (de chaque côté du pied de la
   * perpendiculaire ; si la distance est courte, le texte est quand même écrit, décalé vers le début ou vers la fin) ; avant le début ou après la fin, le prolongement de la ligne en pointillés
   * avec sa longueur ; l'écart de la canne écrit sur la perpendiculaire (canne → ligne).
   * cotes : { sommets, abscisse, longueur, ecart } (m) ; canne : { x, y } (pixels) ; vers : pied (MN95).
   */
  function dessinerCotesLigne(groupe, cotes, canne, vers) {
    const { sommets, abscisse, longueur, ecart } = cotes;
    const ecran = (p) => versEcran(p.est, p.nord, vue);
    const m = (valeur) => `${formaterNombre(Math.abs(valeur))} m`;
    // Texte posé le long d'un trait (de a à b, pixels), au milieu, lisible à l'endroit.
    const texteLeLong = (a, b, texte, classe) => {
      let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const element = creerElement('text', { x: milieu.x, y: milieu.y - 5, 'text-anchor': 'middle', class: `cote-ligne ${classe}`, transform: `rotate(${angle.toFixed(1)} ${milieu.x} ${milieu.y})` });
      element.textContent = texte;
      groupe.append(element);
    };
    // Morceau de la ligne entre deux abscisses : sommets traversés compris (pixels).
    const morceau = (de, a) => {
      const debut = pointALAbscisse(sommets, de);
      const fin = pointALAbscisse(sommets, a);
      if (!debut || !fin) return [];
      return [ecran(debut), ...sommets.slice(debut.segment + 1, fin.segment + 1).map(ecran), ecran(fin)];
    };
    // Texte au milieu (en longueur) d'un morceau, le long du segment où il tombe. Morceau trop court
    // à l'écran pour contenir le texte : il est écrit quand même, décalé de 20 px dans le sens
    // « cote » (−1 vers le début de la ligne, +1 vers la fin) pour ne pas se poser sur l'autre.
    const coteMorceau = (de, a, texte, classe, cote = 0) => {
      const points = morceau(de, a);
      if (points.length < 2) return;
      const milieu = pointALAbscisse(sommets, (de + a) / 2);
      const debutSegment = ecran(sommets[milieu.segment]);
      const finSegment = ecran(sommets[milieu.segment + 1]);
      const centre = ecran(milieu);
      const dx = finSegment.x - debutSegment.x;
      const dy = finSegment.y - debutSegment.y;
      const l = Math.hypot(dx, dy) || 1;
      let pixels = 0;
      for (let i = 0; i + 1 < points.length; i++) pixels += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      const decalage = pixels < 34 ? cote * 20 : 0;
      const c = { x: centre.x + (dx / l) * decalage, y: centre.y + (dy / l) * decalage };
      texteLeLong({ x: c.x - (dx / l) * 20, y: c.y - (dy / l) * 20 }, { x: c.x + (dx / l) * 20, y: c.y + (dy / l) * 20 }, texte, classe);
    };
    if (abscisse < 0) {
      // Avant le début : prolongement du premier segment jusqu'en face de la canne.
      groupe.append(creerElement('path', { d: tracePar(morceau(abscisse, 0), false), class: 'prolongement-ligne' }));
      coteMorceau(abscisse, 0, `−${m(abscisse)}`, 'cote-prolongement');
    } else if (abscisse > longueur) {
      groupe.append(creerElement('path', { d: tracePar(morceau(longueur, abscisse), false), class: 'prolongement-ligne' }));
      coteMorceau(longueur, abscisse, `${m(abscisse - longueur)} après la fin`, 'cote-prolongement');
    } else {
      coteMorceau(0, abscisse, `+${m(abscisse)}`, 'cote-debut', -1);
      coteMorceau(abscisse, longueur, `fin ${m(longueur - abscisse)}`, 'cote-fin', 1);
    }
    // Repère au pied de la perpendiculaire (petit trait en travers de la ligne).
    const pied = pointALAbscisse(sommets, abscisse);
    if (pied) {
      const p = ecran(pied);
      const a = ecran(sommets[pied.segment]);
      const b = ecran(sommets[pied.segment + 1]);
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / l;
      const ny = (b.x - a.x) / l;
      groupe.append(creerElement('line', { x1: p.x - nx * 9, y1: p.y - ny * 9, x2: p.x + nx * 9, y2: p.y + ny * 9, class: 'repere-pied' }));
    }
    // Écart de la canne, écrit sur la perpendiculaire.
    if (vers) {
      const cible = ecran(vers);
      texteLeLong(canne, cible, Math.abs(ecart) < 0.0005 ? 'sur la ligne' : m(ecart), 'cote-ecart');
    }
  }

  /** Plans DXF sous le dessin, sur le canvas (seulement si la vue ou les plans ont changé). */
  function dessinerPlansDxf() {
    const densite = Math.min(window.devicePixelRatio || 1, 2);
    const visibles = plansDxf; // affichés ou cachés un par un (menu « Plans »)
    const signature = [vue.echelle, vue.estCentre, vue.nordCentre, vue.largeur, vue.hauteur, vue.rotation ?? 0, densite,
      ...visibles.map((p) => `${p.id}:${p.visible !== false}:${p.couleur ?? ''}:${p.calques.map((c) => (c.visible ? 1 : 0)).join('')}`)].join('|');
    if (signature === signatureDxf) return;
    signatureDxf = signature;
    dessinerCanvasDxf(canvasDxf, visibles, vue, densite);
  }

  /**
   * Centre le plan sur la position du récepteur (sans changer le zoom, sauf au premier affichage,
   * ou avec "zoomer" : environ 20 m visibles, bouton « Ma position »).
   */
  function centrerSurPosition(zoomer = false) {
    if (!position) return;
    const { largeur, hauteur } = taille();
    if (largeur === 0 || hauteur === 0) return;
    // Sans vue (aucun point encore) : environ 60 m de large à l'écran.
    const echelle = zoomer ? Math.min(largeur, hauteur) / METRES_AUTOUR_DE_MOI : vue?.echelle ?? largeur / 60;
    vue = vue ? { ...vue, echelle, estCentre: position.est, nordCentre: position.nord } : { echelle, estCentre: position.est, nordCentre: position.nord, largeur, hauteur };
    dessiner();
  }
  /**
   * Fonds de plan swisstopo (photo aérienne, cadastre) : des images posées sous le dessin.
   * Seules les tuiles visibles à l'écran sont chargées (connexion internet nécessaire).
   */
  function dessinerFond() {
    const couches = Object.keys(FONDS).filter((nom) => calques[nom === 'satellite' ? 'fondSatellite' : nom]);
    const voulues = new Set();

    // Sans point, une surface importée suffit aussi à placer le fond (0.90.0).
    if (vue && (points.length > 0 || position || plansDxf.length > 0 || sommetsDesSurfacesImportees().length > 0) && couches.length > 0) {
      const z = niveauDeZoom(1 / vue.echelle, window.devicePixelRatio || 1);
      // Zone vue (plus grande que l'écran quand le plan est tourné).
      const tuiles = tuilesPourZone(zoneVisible(vue), z);
      const rotationTuile = vue.rotation ? `rotate(${(-vue.rotation).toFixed(2)}deg)` : '';
      // Garde-fou : on ne charge pas des centaines d'images d'un coup.
      if (tuiles.length <= 300) {
        couches.forEach((nom, ordre) => {
          for (const tuile of tuiles) {
            const adresse = FONDS[nom].url(tuile.z, tuile.colonne, tuile.ligne);
            voulues.add(adresse);
            let image = tuilesAffichees.get(adresse);
            if (!image) {
              image = creerTuile(adresse, FONDS[nom].traitsSeulement, () => {
                fondIndisponible = true;
                afficherAttribution(couches);
              });
              image.className = `tuile ${nom}`;
              tuilesAffichees.set(adresse, image);
              fond.append(image);
            }
            // Position arrondie au pixel, un pixel de plus pour éviter les fentes entre tuiles.
            const coin = versEcran(tuile.est, tuile.nord, vue);
            const cote = tuile.cote * vue.echelle;
            image.style.left = `${Math.floor(coin.x)}px`;
            image.style.top = `${Math.floor(coin.y)}px`;
            image.style.width = `${Math.ceil(cote) + 1}px`;
            image.style.height = `${Math.ceil(cote) + 1}px`;
            image.style.zIndex = String(ordre);
            // Plan tourné : la tuile tourne autour de son coin en haut à gauche (nord-ouest).
            image.style.transformOrigin = '0 0';
            image.style.transform = rotationTuile;
          }
        });
      }
    }

    // On retire les tuiles qui ne servent plus (autre zoom, hors de l'écran, calque décoché).
    for (const [adresse, image] of tuilesAffichees) {
      if (!voulues.has(adresse)) {
        image.remove();
        tuilesAffichees.delete(adresse);
      }
    }
    if (voulues.size === 0) fondIndisponible = false;
    cadre.classList.toggle('avec-photo', calques.fondSatellite);
    afficherAttribution(couches);
  }

  /**
   * Élément d'une tuile du fond. Pour le cadastre (traitsSeulement), la tuile est recopiée dans
   * un "canvas" en ne gardant que les traits : le reste est transparent, la photo se voit dessous.
   * quandErreur() : appelé si la tuile ne se charge pas.
   */
  function creerTuile(adresse, traitsSeulement, quandErreur) {
    const image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    if (!traitsSeulement) {
      image.addEventListener('error', () => {
        image.style.visibility = 'hidden';
        quandErreur();
      });
      image.src = adresse;
      return image;
    }
    const toile = document.createElement('canvas');
    toile.style.visibility = 'hidden'; // visible une fois la tuile chargée et traitée
    image.crossOrigin = 'anonymous'; // pour pouvoir lire ses pixels
    image.addEventListener('load', () => {
      try {
        garderLesTraits(image, toile);
        toile.style.visibility = '';
      } catch {
        quandErreur();
      }
    });
    image.addEventListener('error', quandErreur);
    image.src = adresse;
    return toile;
  }

  /** Mention obligatoire de la source des fonds (et message si le fond ne charge pas). */
  function afficherAttribution(couches) {
    attribution.hidden = couches.length === 0;
    const textes = couches.map((nom) => FONDS[nom].attribution);
    if (fondIndisponible) textes.push('fond indisponible (pas de connexion ?)');
    attribution.textContent = textes.join(' · ');
  }

  /** Sommets des surfaces importées visibles (LandXML, DXF 3D) : pour cadrer un projet sans point. */
  function sommetsDesSurfacesImportees() {
    return dessin.stocks
      .filter((s) => (s.type === 'landxml' || s.type === 'dxf') && !dessin.cachees?.has(s))
      .flatMap((s) => s.points ?? []);
  }

  // Bord de chaque surface importée, calculé une fois par liste de triangles (le plan se redessine souvent).
  const bords = new WeakMap();
  function bordDuStock(triangles) {
    if (!bords.has(triangles)) bords.set(triangles, bordDeTriangles(triangles));
    return bords.get(triangles);
  }

  /** Triangles, contours des stocks, lignes de rupture et segments en erreur. */
  function dessinerStocks() {
    const positions = new Map(points.map((p) => [p.nom, versEcran(p.est, p.nord, vue)]));
    const chemin = (noms, ferme) => {
      const sommets = noms.filter((nom) => positions.has(nom)).map((nom) => positions.get(nom));
      if (sommets.length < 2) return null;
      return sommets.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ') + (ferme ? ' Z' : '');
    };

    const groupe = creerElement('g', { class: calques.remblaiDeblai ? 'stocks avec-ecarts' : 'stocks' });
    if (calques.remblaiDeblai) dessinerEcarts(groupe);
    if (calques.couleursAltitude || calques.courbes || calques.couleursAltitudeImport) dessinerRelief(groupe);
    dessinerSurface(groupe);
    dessin.stocks.forEach((stock, index) => {
      const actif = stock === dessin.stockActif;
      if (!estVisible(stock)) return;
      const resultat = dessin.resultats[index];

      // Surface importée (LandXML, DXF 3D ; 0.83.0, mode Base) : elle n'a pas de contour ; fond
      // léger à la couleur de sa nature, bord en trait plein, triangles avec la case « Triangles ».
      const importee = stock.type === 'landxml' || stock.type === 'dxf';
      if (importee && resultat?.trianglesDessus?.length) {
        const nature = `nature-${stock.nature ?? 'terrassement'}`;
        // Couleur choisie dans « Afficher » (Surface Import, 0.94.0), sinon le bleu habituel.
        const couleurChoisie = couleursDesListes.get(stock.id);
        const style = couleurChoisie ? `--couleur-nature: ${couleurChoisie}` : '';
        const enPixels = (p) => versEcran(p.est, p.nord, vue);
        const traces = resultat.trianglesDessus
          .map((triangle) => {
            const [a, b, c] = triangle.map(enPixels);
            return `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} Z`;
          })
          .join(' ');
        groupe.append(creerElement('path', { d: traces, class: `surface-importee ${nature}${calques.triangles ? ' avec-triangles' : ''}`, style }));
        const bord = bordDuStock(resultat.trianglesDessus)
          .map(([p, q]) => {
            const [a, b] = [enPixels(p), enPixels(q)];
            return `M${a.x} ${a.y} L${b.x} ${b.y}`;
          })
          .join(' ');
        groupe.append(creerElement('path', { d: bord, class: `bord-surface-importee ${nature}`, style }));
      }

      // Levé sans contour (terrain, recollement… ; 0.90.1) : son bord et un fond léger, même sans le
      // calque Triangles (Expert), pour voir où il s'étend (implantation d'une surface en Base).
      const sansContour = (stock.contour ?? []).length < 3;
      if (!importee && sansContour && resultat?.trianglesDessus?.length && !(actif && calques.triangles)) {
        const enPixels = (p) => versEcran(p.est, p.nord, vue);
        const bord = bordDuStock(resultat.trianglesDessus)
          .map(([p, q]) => {
            const [a, b] = [enPixels(p), enPixels(q)];
            return `M${a.x} ${a.y} L${b.x} ${b.y}`;
          })
          .join(' ');
        const fond = resultat.trianglesDessus
          .map((triangle) => {
            const [a, b, c] = triangle.map(enPixels);
            return `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} Z`;
          })
          .join(' ');
        groupe.append(creerElement('path', { d: fond, class: `fond-leve nature-${stock.nature ?? 'terrain'}${actif ? ' actif' : ''}` }));
        groupe.append(creerElement('path', { d: bord, class: `bord-leve nature-${stock.nature ?? 'terrain'}${actif ? ' actif' : ''}` }));
      }

      // Triangles du dessus : stock actif seulement, pour ne pas surcharger.
      if (!importee && actif && calques.triangles && resultat?.trianglesDessus) {
        const traits = resultat.trianglesDessus
          .map((triangle) => {
            const [a, b, c] = triangle.map((p) => versEcran(p.est, p.nord, vue));
            return `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} Z`;
          })
          .join(' ');
        groupe.append(creerElement('path', { d: traits, class: 'triangles' }));
      }
      if (calques.contours) {
        const contour = chemin(stock.contour ?? [], true);
        if (contour) groupe.append(creerElement('path', { d: contour, class: actif ? 'contour actif' : 'contour' }));
      }
      if (calques.lignes) {
        const libelles = lireLibelles();
        for (const ligne of stock.lignesRupture ?? []) {
          const trace = chemin(ligne.noms, ligne.fermee);
          if (!trace) continue;
          const element = creerElement('path', { d: trace, class: actif ? 'ligne-rupture actif' : 'ligne-rupture' });
          const couleur = couleurDeLigne(ligne, libelles);
          if (couleur) element.style.stroke = couleur;
          groupe.append(element);
        }
      }
      // Segments qui se croisent : en rouge, toujours visibles, pour trouver l'erreur.
      for (const segment of resultat?.segmentsEnErreur ?? []) {
        const trace = chemin(segment, false);
        if (trace) groupe.append(creerElement('path', { d: trace, class: 'segment-erreur' }));
      }
    });
    svg.append(groupe);
  }

  /**
   * Remblai en rouge et déblai en jaune, par paliers de hauteur : sur la comparaison affichée
   * s'ils sont donnés, sinon sur les surfaces visibles (calcul de volume de chacune).
   */
  function dessinerEcarts(groupe) {
    const triangles =
      dessin.ecarts ??
      dessin.stocks.flatMap((stock, index) => {
        if (!estVisible(stock)) return [];
        return dessin.resultats[index]?.trianglesEcart ?? [];
      });
    if (triangles.length === 0) return;
    const { zones, legende: legendeZones } = zonesRemblaiDeblai(triangles, calques.palier);
    // Un seul tracé par couleur : beaucoup plus léger à afficher.
    const tracesParCouleur = new Map();
    for (const { couleur, polygone } of zones) {
      const trace = polygone.map((p, i) => {
        const { x, y } = versEcran(p.est, p.nord, vue);
        return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
      });
      const cle = enRgb(couleur);
      if (!tracesParCouleur.has(cle)) tracesParCouleur.set(cle, []);
      tracesParCouleur.get(cle).push(trace.join(' ') + ' Z');
    }
    // La transparence est mise sur l'ensemble (et non sur chaque tracé) : pas de traits entre les morceaux.
    const zonesEcart = creerElement('g', { class: 'zones-ecart' });
    for (const [couleur, traces] of tracesParCouleur) {
      zonesEcart.append(creerElement('path', { d: traces.join(' '), fill: couleur, stroke: couleur }));
    }
    groupe.append(zonesEcart);
    legendeEcarts = legendeZones;
  }

  /** Surface affichée (onglet Calculs › Surfaces) : ses triangles, et les triangles supprimés en pointillés rouges. */
  function dessinerSurface(groupe) {
    const surface = dessin.surface;
    if (!surface) return;
    const trace = (triangles) =>
      triangles
        .map((triangle) => {
          const [a, b, c] = triangle.map((p) => versEcran(p.est, p.nord, vue));
          return `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} Z`;
        })
        .join(' ');
    if (calques.triangles && surface.triangles.length > 0) {
      groupe.append(creerElement('path', { d: trace(surface.triangles), class: 'surface-triangles' }));
    }
    if (surface.trianglesRetires.length > 0) {
      groupe.append(creerElement('path', { d: trace(surface.trianglesRetires), class: 'triangles-retires' }));
    }
  }

  /**
   * Couleurs selon l'altitude et courbes de niveau, sur la surface du dessus des stocks visibles.
   * Les couleurs utilisent la même échelle pour tous les stocks, pour pouvoir les comparer.
   */
  function dessinerRelief(groupe) {
    // Couleurs : les levés (roue Expert de « Levé ») et les surfaces importées (roue de « Surface
    // Import ») ; courbes : les levés seulement (0.94.0).
    const pourCouleurs = [];
    const pourCourbes = [];
    dessin.stocks.forEach((stock, index) => {
      if (!estVisible(stock)) return;
      const triangles = dessin.resultats[index]?.trianglesDessus ?? [];
      const importee = stock.type === 'landxml' || stock.type === 'dxf';
      if (importee ? calques.couleursAltitudeImport : calques.couleursAltitude) pourCouleurs.push(...triangles);
      if (!importee && calques.courbes) pourCourbes.push(...triangles);
    });
    // La surface affichée (onglet Calculs › Surfaces) est aussi coloriée, et les aires mesurées (onglet Calculs › Mesures).
    const autres = [...(dessin.surface?.triangles ?? []), ...(dessin.mesures ?? []).flatMap(({ resultat }) => resultat?.triangles ?? [])];
    if (calques.couleursAltitude) pourCouleurs.push(...autres);
    if (calques.courbes) pourCourbes.push(...autres);
    const triangles = [...pourCouleurs, ...pourCourbes];
    if (triangles.length === 0) return;
    const plage = plageAltitudes(triangles);
    const equidistance =
      calques.equidistance === 'auto' ? equidistanceAuto(plage.min, plage.max) : Number(calques.equidistance);
    const versPixels = (p) => versEcran(p.est, p.nord, vue);

    if (pourCouleurs.length > 0) {
      // Une couleur par bande : on regroupe les morceaux de même altitude en un seul tracé.
      const tracesParBande = new Map();
      for (const { altitude, polygone } of bandesDeNiveau(pourCouleurs, equidistance)) {
        const trace = polygone.map((p, i) => {
          const { x, y } = versPixels(p);
          return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
        });
        if (!tracesParBande.has(altitude)) tracesParBande.set(altitude, []);
        tracesParBande.get(altitude).push(trace.join(' ') + ' Z');
      }
      for (const [altitude, traces] of tracesParBande) {
        const milieu = altitude + equidistance / 2;
        groupe.append(creerElement('path', { d: traces.join(' '), class: 'bande', fill: couleurAltitude(milieu, plage) }));
      }
    }

    if (pourCourbes.length > 0) {
      // Une courbe sur 5 (courbe maîtresse) est plus épaisse.
      const traits = { normale: [], maitresse: [] };
      for (const { altitude, a, b } of courbesDeNiveau(pourCourbes, equidistance)) {
        const pa = versPixels(a);
        const pb = versPixels(b);
        const rang = altitude / (5 * equidistance);
        const type = Math.abs(rang - Math.round(rang)) < 1e-6 ? 'maitresse' : 'normale';
        traits[type].push(`M${pa.x} ${pa.y} L${pb.x} ${pb.y}`);
      }
      if (traits.normale.length > 0) groupe.append(creerElement('path', { d: traits.normale.join(' '), class: 'courbe' }));
      if (traits.maitresse.length > 0) {
        groupe.append(creerElement('path', { d: traits.maitresse.join(' '), class: 'courbe maitresse' }));
      }
    }

    legende = { plage, equidistance, couleurs: pourCouleurs.length > 0, courbes: pourCourbes.length > 0 };
  }

  /** Légende en bas à droite : remblai / déblai par paliers, couleurs selon l'altitude, équidistance. */
  function dessinerLegende() {
    if (!legende && !legendeEcarts) return;
    const largeur = 150;
    const x = vue.largeur - largeur - 12;
    const bas = vue.hauteur - 20; // place pour la mention des sources en dessous
    const elements = [];
    let ligne = 0; // hauteur déjà occupée, à partir du haut de la légende

    const ecrire = (tx, ty, contenu, ancre = 'start', classe = '') => {
      const texte = creerElement('text', { x: tx, y: ty, 'text-anchor': ancre, class: classe });
      texte.textContent = contenu;
      elements.push(texte);
    };
    /** Une rangée de cases de couleur, avec la première et la dernière valeur dessous. */
    const rangee = (cases, debut, fin) => {
      cases.forEach((couleur, i) => {
        elements.push(creerElement('rect', { x: x + (i * largeur) / cases.length, y: ligne, width: largeur / cases.length + 0.5, height: 10, fill: couleur }));
      });
      ecrire(x, ligne + 23, debut);
      ecrire(x + largeur, ligne + 23, fin, 'end');
      ligne += 32;
    };

    if (legendeEcarts) {
      for (const [titre, classes] of [['Remblai', legendeEcarts.remblai], ['Déblai', legendeEcarts.deblai]]) {
        if (classes.length === 0) continue;
        ecrire(x, ligne + 10, `${titre} (palier ${legendeEcarts.palier} m)`, 'start', 'titre-legende');
        ligne += 16;
        rangee(classes.map((c) => enRgb(c.couleur)), '0', `${formaterNombre(classes.at(-1).a)} m`);
      }
    }
    if (legende) {
      const { plage, equidistance } = legende;
      if (legende.couleurs) {
        const pas = 20;
        const cases = Array.from({ length: pas }, (_, i) => couleurAltitude(plage.min + ((i + 0.5) / pas) * (plage.max - plage.min), plage));
        ecrire(x, ligne + 10, 'Altitude', 'start', 'titre-legende');
        ligne += 16;
        rangee(cases, formaterNombre(plage.min), formaterNombre(plage.max));
      }
      if (legende.couleurs || legende.courbes) {
        ecrire(x, ligne + 10, `Équidistance ${equidistance} m`);
        ligne += 16;
      }
    }

    // Tout est placé à partir du haut de la légende : on la pose en bas à droite du plan.
    const haut = bas - ligne;
    const groupe = creerElement('g', { class: 'legende', transform: `translate(0 ${haut})` });
    groupe.append(creerElement('rect', { x: x - 8, y: -8, width: largeur + 16, height: ligne + 8, rx: 8 }));
    for (const element of elements) groupe.append(element);
    svg.append(groupe);
  }

  /** Coupes A – A', B – B' : trait bleu nuit avec le nom à chaque bout ; début d'une coupe en cours de tracé. */
  function dessinerCoupes() {
    const groupe = creerElement('g', { class: 'coupes' });
    for (const coupe of dessin.coupes ?? []) {
      const a = versEcran(coupe.debut.est, coupe.debut.nord, vue);
      const b = versEcran(coupe.fin.est, coupe.fin.nord, vue);
      groupe.append(creerElement('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      // Les noms sont écrits un peu au-delà des bouts, dans le prolongement du trait.
      const longueur = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const [ux, uy] = [(b.x - a.x) / longueur, (b.y - a.y) / longueur];
      for (const [bout, texte, sens] of [[a, coupe.nom, -1], [b, `${coupe.nom}'`, 1]]) {
        groupe.append(creerElement('circle', { cx: bout.x, cy: bout.y, r: 4 }));
        const etiquette = creerElement('text', { x: bout.x + sens * ux * 14, y: bout.y + sens * uy * 14 + 5, 'text-anchor': 'middle' });
        etiquette.textContent = texte;
        groupe.append(etiquette);
      }
    }
    if (dessin.traceCoupe?.debut) {
      const a = versEcran(dessin.traceCoupe.debut.est, dessin.traceCoupe.debut.nord, vue);
      groupe.append(creerElement('circle', { cx: a.x, cy: a.y, r: 7, class: 'debut-trace' }));
    }
    svg.append(groupe);
  }

  /**
   * Nom et volume (remblai, et déblai s'il y en a) écrits au milieu de chaque surface calculée
   * (calque « Volume sur chaque surface », dans tous les onglets).
   */
  function dessinerVolumes() {
    const groupe = creerElement('g', { class: 'volumes' });
    dessin.stocks.forEach((stock, index) => {
      const actif = stock === dessin.stockActif;
      if (!estVisible(stock)) return;
      const resultat = dessin.resultats[index];
      if (resultat?.remblai === undefined) return;
      const centre = resultat.trianglesDessus ? pointInterieur(resultat.trianglesDessus) : null;
      if (!centre) return;
      const { x, y } = versEcran(centre.est, centre.nord, vue);
      const lignes = [stock.nom, `${resultat.deblai > 0 ? 'R ' : ''}${formaterNombre(resultat.remblai)} m³`];
      if (resultat.deblai > 0) lignes.push(`D ${formaterNombre(resultat.deblai)} m³`);
      const largeur = Math.max(...lignes.map((l) => l.length)) * 7.2 + 16;
      const hauteur = 22 + lignes.length * 16 - 16;
      groupe.append(
        creerElement('rect', { x: x - largeur / 2, y: y - 20, width: largeur, height: hauteur + 16, rx: 8, class: actif ? 'actif' : '' }),
      );
      lignes.forEach((ligne, i) => {
        const texte = creerElement('text', { x, y: y - 4 + i * 16, 'text-anchor': 'middle', class: i === 0 ? 'nom-stock' : '' });
        texte.textContent = ligne;
        groupe.append(texte);
      });
    });
    svg.append(groupe);
  }

  /** Position à l'écran de chaque point de la mesure (ceux qui existent dans le levé). */
  function sommetsMesure(noms) {
    const parNom = new Map(points.map((p) => [p.nom, p]));
    return noms.map((nom) => parNom.get(nom)).filter(Boolean).map((p) => versEcran(p.est, p.nord, vue));
  }

  /** Tracé SVG passant par des positions à l'écran (fermé ou non). */
  const tracePar = (sommets, ferme) => sommets.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ') + (ferme ? ' Z' : '');

  /**
   * Mesures (onglet Calculs › Mesures) : longueurs en trait cyan pointillé, aires avec leur contour
   * pointillé, un fond cyan léger, leurs lignes de rupture et leurs triangles (calque « Triangles »).
   */
  function dessinerTracesMesures() {
    if (!dessin.mesures?.length || !(calques.mesures || dessin.modeMesures)) return;
    const tout = creerElement('g', { class: 'mesures' });
    for (const { mesure, resultat } of dessin.mesures) {
      const actif = mesure === dessin.mesureActive ? ' actif' : '';
      // Chaque mesure dans sa couleur.
      const groupe = creerElement('g', { style: `--couleur-mesure: ${couleurDeMesure(mesure)}` });
      tout.append(groupe);
      if (mesure.type === 'aire') {
        if (calques.triangles && resultat?.triangles) {
          const traits = resultat.triangles.map((t) => tracePar(t.map((p) => versEcran(p.est, p.nord, vue)), true)).join(' ');
          groupe.append(creerElement('path', { d: traits, class: 'triangles-mesure' }));
        }
        for (const ligne of mesure.lignesRupture) {
          const sommets = sommetsMesure(ligne.noms);
          if (sommets.length >= 2) groupe.append(creerElement('path', { d: tracePar(sommets, ligne.fermee), class: `ligne-mesure${actif}` }));
        }
        const contour = sommetsMesure(mesure.contour);
        if (contour.length >= 2) groupe.append(creerElement('path', { d: tracePar(contour, contour.length >= 3), class: `aire-mesure${actif}` }));
      } else if (mesure.type === 'nombre') {
        // Points comptés : un rond autour de chacun.
        for (const { x, y } of sommetsMesure(mesure.points)) groupe.append(creerElement('circle', { cx: x, cy: y, r: 9, class: `compte-mesure${actif}` }));
      } else {
        const sommets = sommetsMesure(mesure.points);
        if (sommets.length >= 2) groupe.append(creerElement('path', { d: tracePar(sommets, false), class: `longueur-mesure${actif}` }));
      }
    }
    svg.append(tout);
  }

  /**
   * Étiquette de chaque mesure : petite (nom et une valeur) pour les autres mesures ; pour la
   * mesure choisie, toutes ses valeurs cochées et, si demandé, le texte de chaque morceau.
   */
  function dessinerEtiquettesMesures() {
    if (!dessin.mesures?.length || !(calques.mesures || dessin.modeMesures)) return;
    const tout = creerElement('g', { class: 'etiquettes-mesures' });
    for (const { mesure, resultat } of dessin.mesures) {
      if (!resultat || resultat.erreurs) continue;
      const active = mesure === dessin.mesureActive;
      const groupe = creerElement('g', { style: `--couleur-mesure: ${couleurDeMesure(mesure)}` });
      tout.append(groupe);
      if (active && mesure.afficher?.morceaux) {
        for (const morceau of resultat.morceaux) {
          const a = versEcran(morceau.debut.est, morceau.debut.nord, vue);
          const b = versEcran(morceau.fin.est, morceau.fin.nord, vue);
          // Texte le long du morceau, toujours lisible (jamais à l'envers), un peu au-dessus du trait.
          let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          if (angle > 90) angle -= 180;
          if (angle < -90) angle += 180;
          const x = (a.x + b.x) / 2;
          const y = (a.y + b.y) / 2;
          const texte = creerElement('text', { x, y: y - 5, 'text-anchor': 'middle', class: 'cote-morceau', transform: `rotate(${angle} ${x} ${y})` });
          texte.textContent = texteMorceau(mesure, morceau);
          groupe.append(texte);
        }
      }
      const lignes = active ? lignesEtiquette(mesure, resultat) : [mesure.nom, valeurPrincipale(mesure, resultat)];
      const place = placeEtiquetteMesure(mesure, resultat);
      const { x, y } = versEcran(place.est, place.nord, vue);
      const largeur = Math.max(...lignes.map((l) => l.length)) * 6.8 + 14;
      const hauteur = lignes.length * 15 + 8;
      groupe.append(creerElement('rect', { x: x - largeur / 2, y: y - hauteur / 2, width: largeur, height: hauteur, rx: 6, class: active ? 'actif' : '' }));
      lignes.forEach((ligne, i) => {
        const texte = creerElement('text', { x, y: y - hauteur / 2 + 15 + i * 15, 'text-anchor': 'middle', class: i === 0 ? 'nom-mesure' : '' });
        texte.textContent = ligne;
        groupe.append(texte);
      });
    }
    svg.append(tout);
  }

  /** Mesure touchée : dans le contour d'une aire, ou tout près du trait d'une longueur. Renvoie son id, ou null. */
  function mesureSousLeDoigt(position) {
    const terrain = versTerrain(position.x, position.y, vue);
    for (const { mesure } of dessin.mesures ?? []) {
      if (mesure.type === 'aire') {
        const parNom = new Map(points.map((p) => [p.nom, p]));
        const contour = mesure.contour.map((nom) => parNom.get(nom)).filter(Boolean);
        if (contour.length >= 3 && pointDansPolygone(terrain, contour)) return mesure.id;
      } else if (mesure.type === 'nombre') {
        if (sommetsMesure(mesure.points).some((s) => Math.hypot(s.x - position.x, s.y - position.y) < RAYON_TOUCHER)) return mesure.id;
      } else {
        const sommets = sommetsMesure(mesure.points);
        for (let i = 0; i + 1 < sommets.length; i++) {
          if (distanceAuSegment(position, sommets[i], sommets[i + 1]) < RAYON_TOUCHER / 2) return mesure.id;
        }
      }
    }
    return null;
  }

  /** Barre d'échelle en bas à gauche, avec une longueur ronde en mètres. */
  function dessinerBarreEchelle() {
    const { metres, pixels } = barreEchelle(vue.echelle);
    const x = 12;
    const y = vue.hauteur - 14;
    const groupe = creerElement('g', { class: 'echelle' });
    groupe.append(
      creerElement('rect', { x: x - 4, y: y - 18, width: pixels + 8, height: 26, rx: 4 }),
      creerElement('path', { d: `M${x} ${y - 5} V${y} H${x + pixels} V${y - 5}` }),
    );
    const texte = creerElement('text', { x: x + pixels / 2, y: y - 7, 'text-anchor': 'middle' });
    texte.textContent = `${metres} m`;
    groupe.append(texte);
    svg.append(groupe);
  }

  function toutVoir() {
    const { largeur, hauteur } = taille();
    if (largeur === 0 || hauteur === 0) {
      // Plan caché (autre onglet) : on recadrera quand il s'affichera.
      recadrerQuandVisible = true;
      return;
    }
    recadrerQuandVisible = false;
    // Levé avec le récepteur, encore 0 ou 1 point : environ 60 m de large autour du point
    // (ou de la position du récepteur), plutôt qu'un zoom extrême sur un seul point.
    // Sans point : sur la position du récepteur, sinon sur les plans DXF ; sinon pas encore de vue
    // (elle se fera sur la première position reçue).
    // Sans point mais avec une surface importée : sur ses sommets (0.83.0).
    const sommetsImportes = points.length === 0 ? sommetsDesSurfacesImportees() : [];
    const centre = points.length === 1 ? points[0] : points.length === 0 && sommetsImportes.length === 0 ? position : null;
    if (centre) vue = { echelle: largeur / 60, estCentre: centre.est, nordCentre: centre.nord, largeur, hauteur };
    else if (points.length > 0) vue = cadrerSurPoints(points, largeur, hauteur);
    else if (sommetsImportes.length > 0) vue = cadrerSurPoints(sommetsImportes, largeur, hauteur);
    else vue = plansDxf.length > 0 ? cadrerSurPoints(coinsDesPlans(plansDxf), largeur, hauteur) : null;
    dessiner();
  }

  function zoomerAuCentre(facteur) {
    if (!vue) return;
    vue = zoomer(vue, facteur, vue.largeur / 2, vue.hauteur / 2);
    dessiner();
  }

  // --- Boutons ---
  conteneur.querySelector('[data-action="tout-voir"]').addEventListener('click', () => {
    changerSuivi('libre');
    toutVoir();
  });
  conteneur.querySelector('[data-action="zoom-plus"]').addEventListener('click', () => zoomerAuCentre(1.5));
  conteneur.querySelector('[data-action="zoom-moins"]').addEventListener('click', () => zoomerAuCentre(1 / 1.5));
  const boutonPosition = conteneur.querySelector('[data-action="ma-position"]');
  const boutonNord = conteneur.querySelector('[data-action="nord-en-haut"]');
  // Dessin du bouton selon le mode : viseur (libre), viseur plein (suivi, nord en haut), flèche
  // de navigation (suivi, devant en haut).
  const ICONES_SUIVI = {
    libre: '<circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />',
    suivre: '<circle cx="12" cy="12" r="4" class="plein" /><circle cx="12" cy="12" r="8" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" />',
    cap: '<path d="M12 2 20 21 12 16 4 21Z" class="plein" />',
  };
  const TITRES_SUIVI = {
    libre: 'Ma position',
    suivre: 'Suit ma position, nord en haut (toucher : devant en haut)',
    cap: 'Suit ma position, devant du GNSS en haut (toucher : nord en haut)',
  };

  /** Change le mode de suivi et le dessin du bouton. */
  function changerSuivi(mode) {
    suivi = mode;
    boutonPosition.classList.toggle('actif', mode !== 'libre');
    boutonPosition.classList.toggle('mode-cap', mode === 'cap');
    boutonPosition.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_SUIVI[mode]}</svg>`;
    boutonPosition.title = TITRES_SUIVI[mode];
    boutonPosition.setAttribute('aria-label', TITRES_SUIVI[mode]);
  }

  // 1er toucher : suivre (nord en haut) ; puis on passe de « nord en haut » à « devant en haut ».
  boutonPosition.addEventListener('click', () => {
    if (suivi === 'suivre') {
      changerSuivi('cap');
      if (position?.azimut != null) tournerVers(position.azimut);
      else centrerSurPosition();
      return;
    }
    changerSuivi('suivre');
    if (vue) vue = { ...vue, rotation: 0 };
    centrerSurPosition(true);
  });

  // Boussole du plan (visible quand il est tourné) : le remet nord en haut.
  boutonNord.addEventListener('click', () => {
    if (suivi === 'cap') changerSuivi('suivre');
    if (!vue) return;
    vue = { ...vue, rotation: 0 };
    dessiner();
  });

  /** Écart entre deux angles (°), entre −180 et 180. */
  function ecartAngle(a, b) {
    return ((((a - b) % 360) + 540) % 360) - 180;
  }

  /** Tourne le plan pour que "azimut" (°) soit en haut, centré sur la position. */
  function tournerVers(azimut) {
    if (!vue || !position) return;
    vue = { ...vue, rotation: azimut, estCentre: position.est, nordCentre: position.nord };
    dessiner();
  }

  /** Boussole du plan : montrée seulement quand le plan n'a pas le nord en haut ; l'aiguille montre le nord. */
  function mettreAJourBoussolePlan() {
    const rotation = vue?.rotation ?? 0;
    boutonNord.hidden = Math.abs(ecartAngle(rotation, 0)) < 0.5;
    boutonNord.querySelector('svg').style.transform = `rotate(${(-rotation).toFixed(1)}deg)`;
  }

  /** Vrai si la position est à plus de 20 % de la largeur (ou de la hauteur) du centre du plan. */
  function loinDuCentre() {
    const { x, y } = versEcran(position.est, position.nord, vue);
    return Math.abs(x - vue.largeur / 2) > vue.largeur * 0.2 || Math.abs(y - vue.hauteur / 2) > vue.hauteur * 0.2;
  }

  /** Arrête le suivi de la position (le plan a été déplacé au doigt). */
  function arreterSuivi() {
    changerSuivi('libre');
  }

  // --- Menu des calques ---
  boutonCalques.addEventListener('click', () => {
    menuCalques.hidden = !menuCalques.hidden;
    boutonCalques.setAttribute('aria-expanded', String(!menuCalques.hidden));
    ajusterHauteurMenu(menuCalques);
  });

  /**
   * Un menu (Calques, Plans, Afficher) ne dépasse pas le bas du plan : sur un téléphone, le plan
   * est petit (onglet Terrain) ; le menu prend la place qui reste et son contenu défile.
   */
  function ajusterHauteurMenu(menu) {
    if (menu.hidden) return;
    menu.style.maxHeight = '';
    const place = cadre.getBoundingClientRect().bottom - menu.getBoundingClientRect().top - 10;
    menu.style.maxHeight = `${Math.max(80, place)}px`;
    marquerSuite(menu);
  }

  /** « ▾ encore » en bas du menu tant qu'il reste des lignes plus bas (on les voit en faisant défiler). */
  function marquerSuite(menu) {
    menu.classList.toggle('a-suivre', menu.scrollTop + menu.clientHeight < menu.scrollHeight - 4);
  }
  for (const menu of [menuCalques, menuPlans, menuListes]) menu.addEventListener('scroll', () => marquerSuite(menu));
  /** Un réglage changé (case, liste, réglette data-calque) dans Fond ou Afficher. */
  function changerCalque(champ) {
    const cle = champ.dataset.calque;
    calquesChoisis[cle] = champ.type === 'checkbox' ? champ.checked : champ.type === 'range' ? Number(champ.value) : champ.value;
    // Remblai / déblai et couleurs selon l'altitude ne se lisent pas l'un sur l'autre : un seul à la fois.
    const exclusifs = { remblaiDeblai: 'couleursAltitude', couleursAltitude: 'remblaiDeblai' };
    const autre = exclusifs[cle];
    if (autre && champ.checked) {
      calquesChoisis[autre] = false;
      const caseAutre = conteneur.querySelector(`[data-calque="${autre}"]`);
      if (caseAutre) caseAutre.checked = false;
    }
    if (cle === 'transparencePhoto') {
      conteneur.querySelector('[data-vivant="transparence"]').textContent = `${calquesChoisis.transparencePhoto} %`;
      appliquerTransparence();
      return;
    }
    dessiner();
  }
  menuCalques.addEventListener('change', (evenement) => {
    if (evenement.target.dataset.calque) changerCalque(evenement.target);
  });
  menuCalques.addEventListener('input', (evenement) => {
    if (evenement.target.type === 'range') changerCalque(evenement.target);
  });
  // Roues ⚙ des menus : montrent ou cachent les réglages de leur ligne (data-zone-roue).
  const rouesOuvertes = new Set();
  conteneur.addEventListener('click', (evenement) => {
    const roue = evenement.target.closest('[data-roue]');
    if (!roue) return;
    const cle = roue.dataset.roue;
    if (rouesOuvertes.has(cle)) rouesOuvertes.delete(cle);
    else rouesOuvertes.add(cle);
    montrerRoues();
  });
  function montrerRoues() {
    for (const zone of conteneur.querySelectorAll('[data-zone-roue]')) zone.hidden = !rouesOuvertes.has(zone.dataset.zoneRoue);
    for (const roue of conteneur.querySelectorAll('[data-roue]')) roue.setAttribute('aria-expanded', String(rouesOuvertes.has(roue.dataset.roue)));
  }
  /** Photo aérienne plus ou moins transparente (0 % : normale, 100 % : invisible). */
  function appliquerTransparence() {
    fond.style.setProperty('--opacite-photo', String(1 - calquesChoisis.transparencePhoto / 100));
  }
  // Vue 3D (0.99.0, Expert) : les triangles des levés et surfaces montrés sur le plan.
  conteneur.querySelector('[data-action="vue-3d"]').addEventListener('click', () => {
    const triangles = dessin.stocks.flatMap((stock, index) => (estVisible(stock) ? dessin.resultats[index]?.trianglesDessus ?? [] : []));
    ouvrirVue3d(triangles, dessin.stocks.filter((stock) => estVisible(stock)).map((s) => s.nom).join(', ') || 'Vue 3D');
  });
  // « Seul » : seulement ce sur quoi je travaille (main.js choisit quoi garder).
  const boutonSeul = conteneur.querySelector('[data-action="seul-travail"]');
  boutonSeul.addEventListener('click', () => {
    seulTravail = !seulTravail;
    boutonSeul.classList.toggle('actif', seulTravail);
    boutonSeul.setAttribute('aria-pressed', String(seulTravail));
    quandBasculerSeul?.(seulTravail);
  });
  // --- Menu des plans DXF : afficher / cacher chaque plan (œil), sa couleur ---
  // Un seul menu ouvert à la fois (Calques, Plans, Points).
  const menus = [[boutonCalques, menuCalques], [boutonPlans, menuPlans], [boutonListes, menuListes]];
  for (const [bouton, menu] of menus) {
    bouton.addEventListener('click', () => {
      for (const [autreBouton, autreMenu] of menus) {
        if (autreMenu === menu || autreMenu === menuCalques) continue; // menuCalques : géré plus bas
        autreMenu.hidden = true;
        autreBouton.setAttribute('aria-expanded', 'false');
      }
      if (menu !== menuCalques) {
        menuCalques.hidden = true;
        boutonCalques.setAttribute('aria-expanded', 'false');
        menu.hidden = !menu.hidden;
        bouton.setAttribute('aria-expanded', String(!menu.hidden));
        ajusterHauteurMenu(menu);
      }
    });
  }
  menuListes.addEventListener('change', (evenement) => {
    const id = evenement.target.dataset.liste;
    if (id) quandMontrerListe?.(id, evenement.target.checked);
  });
  menuListes.addEventListener('click', (evenement) => {
    const pastille = evenement.target.closest('[data-choix-couleur]');
    if (pastille) {
      pastille.closest('details')?.removeAttribute('open');
      quandColorerListe?.(pastille.dataset.id, pastille.dataset.choixCouleur || null);
      return;
    }
    const bouton = evenement.target.closest('[data-toutes]');
    if (bouton) quandMontrerListe?.('*', bouton.dataset.toutes === 'oui');
  });

  /**
   * Menu « Afficher » (0.94.0, tableau « Affichage ») : par catégories (voir SECTIONS de
   * listes-points.js), une case par liste ; une roue ⚙ pour les réglages de la catégorie
   * (Contrôle et Levé : Expert ; Surface Import : tous les modes) ; « Volume » en Expert.
   */
  // Réglages de chaque catégorie : [clé du calque, texte, niveau] ; niveau 'expert' ou '' (tous).
  const REGLAGES_SECTIONS = {
    controle: [['controleNoms', 'ID point', 'expert'], ['controleAltitudes', 'Altitude', 'expert']],
    leve: [
      ['triangles', 'Triangles', 'expert'],
      ['couleursAltitude', 'Couleurs selon l\'altitude', 'expert'],
      ['courbes', 'Courbes de niveau', 'expert'],
      ['altitudesLignes', 'Altitudes des lignes et contours', 'expert'],
    ],
    surface: [['couleursAltitudeImport', 'Couleurs selon l\'altitude', '']],
  };
  const caseCalque = (cle, titre, classe = '') => `<label class="case ${classe}"><input type="checkbox" data-calque="${cle}" ${calquesChoisis[cle] ? 'checked' : ''} /> ${titre}</label>`;
  const choixListe = (cle, valeurs, titre, unite) => `<label class="choix-equidistance">${titre}
      <select data-calque="${cle}">${valeurs.map((e) => `<option value="${e}" ${calquesChoisis[cle] === e ? 'selected' : ''}>${e === 'auto' ? 'auto' : `${e} ${unite}`}</option>`).join('')}</select></label>`;
  /** Réglages d'une catégorie (sous sa roue). */
  function reglagesSection(section) {
    const reglages = REGLAGES_SECTIONS[section] ?? [];
    if (reglages.length === 0) return '';
    const niveau = reglages.every(([, , n]) => n === 'expert') ? 'seulement-expert' : '';
    return `<div class="reglages-section ${niveau}" data-zone-roue="${section}" hidden>
      ${reglages.map(([cle, titre, n]) => caseCalque(cle, titre, n ? `seulement-${n}` : '')).join('')}
      ${section === 'leve' ? choixListe('equidistance', EQUIDISTANCES, 'Équidistance des courbes', 'm').replace('class="choix-equidistance"', 'class="choix-equidistance seulement-expert"') : ''}
    </div>`;
  }
  /** Titre d'une catégorie, avec sa roue s'il y a des réglages. */
  function titreSection(section, titre) {
    const reglages = REGLAGES_SECTIONS[section] ?? [];
    const niveau = reglages.length > 0 && reglages.every(([, , n]) => n === 'expert') ? 'seulement-expert' : '';
    const roue = reglages.length > 0 ? `<button type="button" class="roue-menu ${niveau}" data-roue="${section}" aria-expanded="false" title="Réglages" aria-label="Réglages ${titre}">⚙</button>` : '';
    return `<div class="titre-partie-menu titre-avec-roue"><span>${titre}</span>${roue}</div>${reglagesSection(section)}`;
  }
  let signatureListes = null;
  let couleursDesListes = new Map(); // id d'une liste → couleur choisie (surfaces importées)
  function remplirMenuListes(listes) {
    couleursDesListes = new Map(listes.map((l) => [l.id, l.couleur]));
    const signature = listes.map((l) => `${l.id}:${l.nom}:${l.visible}:${l.couleur}`).join('|');
    if (signature === signatureListes) return;
    signatureListes = signature;
    const ligne = (l) => `<div class="ligne-menu-plan">
        <label class="oeil-plan"><input type="checkbox" data-liste="${l.id}" ${l.visible ? 'checked' : ''} />
          <span class="pastille-liste liste-${l.nature}" ${l.couleur ? `style="background: ${l.couleur}"` : ''}></span><span>${echapper(l.nom)}</span></label>
        ${l.couleurModifiable ? paletteCouleur({ couleur: l.couleur, options: COULEURS_LISTES, attributs: `data-champ-couleur="couleur-liste" data-id="${l.id}"`, nom: `Couleur de ${l.nom}` }) : ''}
      </div>`;
    const parties = SECTIONS.map(([section, titre]) => {
      const liste = listes.filter((l) => l.section === section);
      let html = liste.length > 0 ? titreSection(section, titre) + liste.map(ligne).join('') : '';
      // Volume (Expert) : juste après les levés ; caché au départ (tableau « Affichage »).
      if (section === 'leve') {
        html += `<div class="seulement-expert"><p class="titre-partie-menu">Volume</p>
          ${caseCalque('remblaiDeblai', 'Déblai (jaune) / remblai (rouge)')}
          ${choixListe('palier', PALIERS, 'Palier déblai / remblai', 'm')}
          ${caseCalque('volumes', 'Étiquette du volume')}</div>`;
      }
      return html;
    });
    menuListes.innerHTML = `${parties.join('') || '<p class="menu-vide">Rien à afficher</p>'}
      <div class="ligne-outils"><button type="button" class="bouton-lien bouton-lien-neutre" data-toutes="oui">tout</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-toutes="non">rien</button></div>`;
    montrerRoues();
  }
  menuListes.addEventListener('change', (evenement) => {
    if (evenement.target.dataset.calque) changerCalque(evenement.target);
  });
  menuPlans.addEventListener('click', (evenement) => {
    const pastille = evenement.target.closest('[data-choix-couleur]');
    if (!pastille) return;
    pastille.closest('details')?.removeAttribute('open');
    quandReglerPlanDxf?.(pastille.dataset.id, { couleur: pastille.dataset.choixCouleur || null });
  });
  menuPlans.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    const id = champ.dataset.plan;
    if (!id) return;
    if (champ.dataset.reglage === 'visible') quandReglerPlanDxf?.(id, { visible: champ.checked });
    else if (champ.dataset.calqueDxf !== undefined) quandMontrerCalqueDxf?.(id, Number(champ.dataset.calqueDxf), champ.checked);
  });
  // Flèche d'un plan : ses calques, à cocher un par un (0.94.0).
  const plansDeplies = new Set();
  menuPlans.addEventListener('click', (evenement) => {
    const fleche = evenement.target.closest('[data-deplier-plan]');
    if (!fleche) return;
    const id = fleche.dataset.deplierPlan;
    if (plansDeplies.has(id)) plansDeplies.delete(id);
    else plansDeplies.add(id);
    signatureMenuPlans = null;
    remplirMenuPlans();
    ajusterHauteurMenu(menuPlans);
  });

  /** Liste des plans DXF du menu « Plans » (refaite quand les plans changent). */
  let signatureMenuPlans = null;
  function remplirMenuPlans() {
    const signature = plansDxf.map((plan) => `${plan.id}:${plan.nom}:${plan.visible !== false}:${plan.couleur || ''}:${(plan.calques ?? []).map((c) => (c.visible ? 1 : 0)).join('')}`).join('|');
    if (signature === signatureMenuPlans) return;
    signatureMenuPlans = signature;
    // Aucun plan : un petit cadre « Aucun DXF » (avant : un trait blanc vide).
    if (plansDxf.length === 0) {
      menuPlans.innerHTML = '<p class="menu-vide">Aucun DXF</p>';
      return;
    }
    menuPlans.innerHTML = plansDxf.map((plan) => `<div class="ligne-menu-plan">
        <label class="oeil-plan" title="Afficher / cacher"><input type="checkbox" data-plan="${plan.id}" data-reglage="visible" ${plan.visible !== false ? 'checked' : ''} />
          <span>${echapper(plan.nom)}</span></label>
        ${paletteCouleur({ couleur: plan.couleur, options: COULEURS_PLANS, attributs: `data-champ-couleur="plan-couleur" data-id="${plan.id}"`, nom: `Couleur de ${plan.nom}` })}
        ${(plan.calques ?? []).length > 0 ? `<button type="button" class="fleche-calques-dxf" data-deplier-plan="${plan.id}" aria-expanded="${plansDeplies.has(plan.id)}" title="Calques" aria-label="Calques de ${echapper(plan.nom)}">${plansDeplies.has(plan.id) ? '▴' : '▾'}</button>` : ''}
      </div>
      ${plansDeplies.has(plan.id) ? `<div class="calques-dxf-menu">${plan.calques.map((c, numero) => `<label class="case"><input type="checkbox" data-plan="${plan.id}" data-calque-dxf="${numero}" ${c.visible !== false ? 'checked' : ''} /> ${echapper(c.nom)}</label>`).join('')}</div>` : ''}`).join('');
  }

  // Les menus se ferment quand on touche le plan.
  svg.addEventListener('pointerdown', () => {
    menuCalques.hidden = true;
    boutonCalques.setAttribute('aria-expanded', 'false');
    menuPlans.hidden = true;
    boutonPlans.setAttribute('aria-expanded', 'false');
    menuListes.hidden = true;
    boutonListes.setAttribute('aria-expanded', 'false');
  });

  // --- Molette de la souris : zoom autour du curseur ---
  svg.addEventListener(
    'wheel',
    (evenement) => {
      if (!vue) return;
      evenement.preventDefault();
      const { x, y } = positionDansPlan(evenement);
      vue = zoomer(vue, evenement.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
      dessiner();
    },
    { passive: false },
  );

  // --- Doigts ou souris : un doigt déplace, deux doigts zooment ---
  const pointeurs = new Map(); // position actuelle de chaque doigt posé
  let toucher = null; // position de départ, tant que le doigt n'a presque pas bougé
  // Pendant un déplacement ou un zoom au doigt, on ne redessine pas (trop lent avec un gros plan
  // DXF) : l'image déjà dessinée est seulement glissée et agrandie (transformation CSS), puis le
  // plan est redessiné une fois, quand le doigt se lève. geste = { vueDepart } ou null.
  let geste = null;

  /** Glisse et agrandit l'image dessinée pour qu'elle corresponde à la vue actuelle. */
  function suivreLeGeste() {
    const depart = geste.vueDepart;
    const k = vue.echelle / depart.echelle;
    // Le coin en haut à gauche de l'ancienne image : où il est maintenant (marche aussi plan tourné).
    const coin = versTerrain(0, 0, depart);
    const { x: tx, y: ty } = versEcran(coin.est, coin.nord, vue);
    const transformation = `translate(${tx}px, ${ty}px) scale(${k})`;
    svg.style.transform = transformation;
    fond.style.transform = transformation;
    canvasDxf.style.transform = transformation;
  }

  /** Fin du geste : on enlève la transformation et on redessine pour de bon. */
  function finirLeGeste() {
    if (!geste) return;
    geste = null;
    cadre.classList.remove('en-geste');
    svg.style.transform = '';
    fond.style.transform = '';
    canvasDxf.style.transform = '';
    dessiner();
  }

  svg.addEventListener('pointerdown', (evenement) => {
    svg.setPointerCapture(evenement.pointerId);
    const position = positionDansPlan(evenement);
    pointeurs.set(evenement.pointerId, position);
    toucher = pointeurs.size === 1 ? position : null;
  });

  svg.addEventListener('pointermove', (evenement) => {
    if (!vue || !pointeurs.has(evenement.pointerId)) return;
    const avant = [...pointeurs.values()];
    pointeurs.set(evenement.pointerId, positionDansPlan(evenement));
    const apres = [...pointeurs.values()];
    // Si le doigt a bougé de plus de 6 pixels, c'est un déplacement, pas un toucher.
    if (toucher && distance(toucher, apres[0]) > 6) toucher = null;

    if (toucher && apres.length === 1) return; // pas encore un déplacement
    if (!geste) {
      geste = { vueDepart: vue };
      cadre.classList.add('en-geste');
    }
    if (apres.length === 1) {
      if (suivi !== 'libre') arreterSuivi();
      vue = deplacer(vue, apres[0].x - avant[0].x, apres[0].y - avant[0].y);
    } else if (apres.length >= 2) {
      // Pincement : on zoome selon l'écart entre les deux doigts,
      // et on déplace selon le mouvement de leur milieu.
      const ecartAvant = distance(avant[0], avant[1]);
      const ecartApres = distance(apres[0], apres[1]);
      const milieuAvant = milieu(avant[0], avant[1]);
      const milieuApres = milieu(apres[0], apres[1]);
      if (ecartAvant > 0) vue = zoomer(vue, ecartApres / ecartAvant, milieuAvant.x, milieuAvant.y);
      vue = deplacer(vue, milieuApres.x - milieuAvant.x, milieuApres.y - milieuAvant.y);
    }
    suivreLeGeste();
  });

  svg.addEventListener('pointerup', (evenement) => {
    pointeurs.delete(evenement.pointerId);
    if (toucher && pointeurs.size === 0) {
      if (dessin.traceCoupe) {
        // Tracé d'une coupe : la position touchée (celle du point levé s'il y en a un tout près).
        const point = pointLePlusProche(toucher);
        quandToucherPosition?.(point ? { est: point.est, nord: point.nord } : versTerrain(toucher.x, toucher.y, vue));
      } else if (implantation?.actif) {
        // Implantation : main.js cherche le sommet, le milieu, l'endroit de la ligne ou le centre.
        quandToucherImplantation?.(versTerrain(toucher.x, toucher.y, vue), RAYON_TOUCHER / vue.echelle);
      } else if (dessin.modeTriangles) {
        // Suppression de triangles : on cherche le triangle sous le doigt.
        const terrain = versTerrain(toucher.x, toucher.y, vue);
        const tous = [...(dessin.surface?.triangles ?? []), ...(dessin.surface?.trianglesRetires ?? [])];
        const triangle = tous.find((t) => pointDansPolygone(terrain, t));
        if (triangle) quandToucherTriangle?.(triangle);
      } else if (dessin.enEdition) {
        // Pendant une modification : toucher un point l'ajoute ou le retire.
        const point = pointLePlusProche(toucher);
        if (point) quandToucherPoint?.(point.nom);
      } else if (dessin.modeMesures) {
        // Onglet 3. Mesures : toucher une mesure la choisit.
        const id = mesureSousLeDoigt(toucher);
        if (id) quandToucherMesure?.(id);
      } else {
        // Un 📷 (photo rattachée à un point, 0.96.0) ouvre la photo ; sinon, toucher l'intérieur d'un stock le choisit.
        const photo = photoSousLeDoigt(toucher);
        if (photo) quandToucherPhoto?.(photo.id);
        else {
          const index = stockSousLeDoigt(toucher);
          if (index >= 0) quandToucherStock?.(index);
        }
      }
    }
    toucher = null;
    if (pointeurs.size === 0) finirLeGeste();
  });
  svg.addEventListener('pointercancel', (evenement) => {
    pointeurs.delete(evenement.pointerId);
    toucher = null;
    if (pointeurs.size === 0) finirLeGeste();
  });

  // Photos rattachées à un point (0.96.0) : [{ id, nom, est, nord }] ; un 📷 en haut à droite du point.
  let photos = [];
  const decalagePhoto = (x, y) => ({ x: x + 10, y: y - 14 });
  function dessinerPhotos() {
    if (!vue || photos.length === 0) return;
    const groupe = creerElement('g', { class: 'photos-plan' });
    for (const photo of photos) {
      const ecran = versEcran(photo.est, photo.nord, vue);
      const { x, y } = decalagePhoto(ecran.x, ecran.y);
      groupe.append(creerElement('rect', { x: x - 9, y: y - 8, width: 18, height: 15, rx: 4, class: 'fond-photo-plan' }));
      const texte = creerElement('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'icone-photo-plan' });
      texte.textContent = '📷';
      groupe.append(texte);
    }
    svg.append(groupe);
  }
  function photoSousLeDoigt(position) {
    if (!vue) return null;
    return photos.find((photo) => {
      const { x, y } = versEcran(photo.est, photo.nord, vue);
      return distance(position, decalagePhoto(x, y)) < RAYON_TOUCHER;
    }) ?? null;
  }

  /** Point le plus proche d'une position de l'écran, s'il est à moins de RAYON_TOUCHER pixels. */
  function pointLePlusProche(position) {
    let meilleur = null;
    let meilleureDistance = RAYON_TOUCHER;
    for (const point of points) {
      const d = distance(position, versEcran(point.est, point.nord, vue));
      if (d < meilleureDistance) {
        meilleur = point;
        meilleureDistance = d;
      }
    }
    return meilleur;
  }

  /** Numéro du stock dont le contour contient la position touchée, ou -1. */
  function stockSousLeDoigt(position) {
    const terrain = versTerrain(position.x, position.y, vue);
    const parNom = new Map(points.map((p) => [p.nom, p]));
    return dessin.stocks.findIndex((stock) => {
      if (dessin.cachees?.has(stock)) return false;
      const contour = (stock.contour ?? []).map((nom) => parNom.get(nom)).filter(Boolean);
      return contour.length >= 3 && pointDansPolygone(terrain, contour);
    });
  }

  /** Position du doigt ou de la souris dans le plan (pixels). */
  function positionDansPlan(evenement) {
    // Le cadre, pas le dessin : pendant un geste, le dessin est déplacé (voir « geste »).
    const rectangle = cadre.getBoundingClientRect();
    return { x: evenement.clientX - rectangle.left, y: evenement.clientY - rectangle.top };
  }

  // Si la taille du plan change (rotation du téléphone, changement d'onglet), on garde le même centre.
  new ResizeObserver(() => {
    const nouvelleTaille = taille();
    if (nouvelleTaille.largeur === 0 || nouvelleTaille.hauteur === 0) return;
    if (recadrerQuandVisible || !vue) {
      toutVoir();
      return;
    }
    vue = { ...vue, ...nouvelleTaille };
    dessiner();
  }).observe(svg);

  return {
    /** Affiche une nouvelle liste de points et cadre le plan dessus. */
    afficherPoints(nouveauxPoints) {
      points = nouveauxPoints;
      toutVoir();
    },
    /** Nouvelle liste de points (un point levé en plus ou en moins), sans changer le cadrage. */
    mettreAJourPoints(nouveauxPoints) {
      points = nouveauxPoints;
      if (!vue) toutVoir();
      else dessiner();
    },
    /**
     * Position du récepteur { est, nord, prete, azimut, coupes } (ou null : on la cache ; azimut null :
     * pas de flèche). Pendant le suivi (bouton « Ma position »), le plan se recentre sur elle. Le premier affichage
     * d'un levé encore vide se cadre sur elle.
     */
    afficherPosition(nouvellePosition) {
      const premiere = !position && nouvellePosition;
      position = nouvellePosition;
      boutonPosition.hidden = !position;
      // Suivi : on ne recentre (et ne redessine tout) que si la position s'approche du bord.
      if (position && suivi === 'cap' && position.azimut != null && vue && Math.abs(ecartAngle(position.azimut, vue.rotation ?? 0)) > 3) tournerVers(position.azimut);
      else if (position && (!vue || (suivi !== 'libre' && loinDuCentre()) || (premiere && points.length === 0))) centrerSurPosition();
      else dessinerPosition();
    },
    /**
     * Lame (Terrain › Lame, 2 RX2) : { gauche, droite } (positions des coins), classeGauche,
     * classeDroite ('vert', 'orange', 'rouge' ou null) ; null pour la cacher.
     */
    afficherLame(nouvelleLame) {
      lame = nouvelleLame;
      dessinerPosition();
    },
    /** Listes de points du menu « Points » (voir listes-points.js). */
    afficherListesPoints(listes) {
      remplirMenuListes(listes);
    },
    /** Photos rattachées à un point (📷 sur le plan) : [{ id, nom, est, nord }]. */
    afficherPhotos(nouvelles) {
      photos = nouvelles;
    },
    /** Couleur de chaque point d'après sa liste (Map point → couleur, voir couleursDesPoints). */
    afficherCouleursPoints(couleurs) {
      couleursPoints = couleurs;
    },
    /** Plans DXF à dessiner en fond (voir topo/dxf-plan.js). */
    afficherPlansDxf(nouveaux) {
      const avant = plansDxf.length;
      plansDxf = nouveaux.filter((plan) => plan.contenu && plan.bornes);
      // (Le canvas se redessine de lui-même si les plans ont changé : voir signatureDxf.)
      remplirMenuPlans();
      // Premier plan sans levé : on cadre dessus. Sinon, le dessin suit (redessiner, juste après).
      if (!vue || (avant === 0 && points.length === 0 && !position)) toutVoir();
    },
    /**
     * Implantation d'un point (voir « implantation » plus haut), ou null quand on n'implante pas.
     * Dessinée au prochain redessiner (appelé juste après par main.js).
     */
    afficherImplantation(nouvelle) {
      implantation = nouvelle;
    },
    /** Redessine seulement l'implantation (et la position, par-dessus), sans tout le plan. */
    rafraichirImplantation() {
      if (geste) return;
      dessinerImplantation();
      dessinerPosition();
    },
    /** Cadre le plan sur ces points [{ est, nord }], sur au moins "minimum" mètres (implantation). */
    cadrerSur(coins, minimum = 10) {
      const { largeur, hauteur } = taille();
      if (largeur === 0 || hauteur === 0 || coins.length === 0) return;
      changerSuivi('libre');
      const cadre = cadrerSurPoints(coins, largeur, hauteur, 40);
      vue = { ...cadre, echelle: Math.min(cadre.echelle, Math.min(largeur, hauteur) / minimum) };
      dessiner();
    },
    /** Cadre le plan sur ces plans DXF (bouton « voir »). */
    cadrerSurPlans(choisis) {
      const { largeur, hauteur } = taille();
      if (largeur === 0 || hauteur === 0 || choisis.length === 0) return;
      changerSuivi('libre');
      vue = cadrerSurPoints(coinsDesPlans(choisis), largeur, hauteur);
      dessiner();
    },
    /** Redessine le plan avec les stocks (sans changer le zoom). */
    redessiner(nouveauDessin) {
      dessin = nouveauDessin;
      // Projet sans point avec une surface importée : on cadre une fois sur elle (0.83.0).
      const signature = points.length === 0 ? sommetsDesSurfacesImportees().length : 0;
      if (signature > 0 && signature !== cadreSurfacesImportees) {
        cadreSurfacesImportees = signature;
        toutVoir();
        return;
      }
      // Onglet 3. Mesures : le menu ne propose pas les calques des surfaces.
      dessiner();
    },
  };
}

/** Coins des plans DXF (pour les cadrer) : [{ est, nord }]. */
function coinsDesPlans(plans) {
  return plans.flatMap(({ bornes: b }) => [
    { est: b.estMin, nord: b.nordMin },
    { est: b.estMax, nord: b.nordMax },
  ]);
}

function creerElement(type, attributs) {
  const element = document.createElementNS(SVG, type);
  for (const [nom, valeur] of Object.entries(attributs)) element.setAttribute(nom, valeur);
  return element;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function milieu(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Distance (pixels) entre une position p et le segment [a, b]. */
function distanceAuSegment(p, a, b) {
  const longueur2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = longueur2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / longueur2)) : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

