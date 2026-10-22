// Affichage du plan : points avec leur nom, zoom et déplacement
// au doigt (téléphone) ou à la souris (ordinateur).
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer, barreEchelle } from './vue.js';
import { bulle } from '../aide/bulles.js';
import { placerEtiquettes, pointInterieur } from './etiquettes.js';
import { pointDansPolygone } from '../topo/volume.js';
import { formaterNombre } from '../topo/format.js';
import { FONDS, niveauDeZoom, tuilesPourZone, garderLesTraits } from './fond.js';
import { couleurAltitude } from './couleurs.js';
import { zonesRemblaiDeblai, PALIERS, enRgb } from './ecarts.js';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';
import { lignesEtiquette, texteMorceau, placeEtiquetteMesure, valeurPrincipale, couleurDeMesure } from '../mesures/valeurs.js';
import { nomsDeLaMesure } from '../topo/mesure.js';

const SVG = 'http://www.w3.org/2000/svg';

// Distance maximale (pixels) entre le doigt et un point pour le "toucher".
const RAYON_TOUCHER = 22;

// Calques que l'on peut afficher ou masquer, avec leur état de départ.
// "surfaces" : calque des surfaces seulement, caché dans le menu de l'onglet Calculs › Mesures.
const CALQUES = [
  { cle: 'fondSatellite', titre: 'Fond photo aérienne (swisstopo)', parDefaut: false },
  { cle: 'cadastre', titre: 'Cadastre', parDefaut: false },
  { cle: 'plansDxf', titre: 'Plans DXF (calques : onglet Projet)', parDefaut: true },
  { cle: 'points', titre: 'Points', parDefaut: true },
  { cle: 'noms', titre: 'Noms des points', parDefaut: true },
  { cle: 'altitudes', titre: 'Altitudes des points', parDefaut: false },
  { cle: 'contours', titre: 'Contours des surfaces', parDefaut: true, surfaces: true },
  { cle: 'lignes', titre: 'Lignes de rupture', parDefaut: true, surfaces: true },
  { cle: 'triangles', titre: 'Triangles', parDefaut: true },
  { cle: 'remblaiDeblai', titre: 'Déblai (jaune) / remblai (rouge)', parDefaut: true, surfaces: true },
  { cle: 'couleursAltitude', titre: 'Couleurs selon l\'altitude', parDefaut: false },
  { cle: 'courbes', titre: 'Courbes de niveau', parDefaut: false },
  { cle: 'volumes', titre: 'Volume sur chaque surface', parDefaut: true, surfaces: true },
  { cle: 'autresStocks', titre: 'Autres surfaces', parDefaut: true, surfaces: true },
];
const CLE_MEMOIRE = 'topo-calques';
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
 * Renvoie un objet avec les fonctions afficherPoints(points) et redessiner(dessin).
 */
export function creerPlan(conteneur, { quandToucherPoint, quandToucherStock, quandToucherTriangle, quandToucherPosition, quandToucherMesure } = {}) {
  const calques = lireCalques();

  // Boutons posés sur le plan : calques en haut à gauche, zoom en haut à droite.
  conteneur.innerHTML = `
    <div class="plan-cadre">
      <div class="plan-fond" aria-hidden="true"></div>
      <svg class="plan" role="img" aria-label="Plan des points"></svg>
      <div class="plan-attribution" hidden></div>
      <div class="plan-calques">
        <button type="button" class="puce" data-action="calques" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>
          Calques
        </button>
        ${bulle('plan')}
        <div class="menu-calques" hidden>
          ${CALQUES.map(
            (c) => `<label class="case ${c.surfaces ? 'seulement-surfaces' : ''}"><input type="checkbox" data-calque="${c.cle}" ${calques[c.cle] ? 'checked' : ''} /> ${c.titre}</label>`,
          ).join('')}
          <label class="choix-equidistance seulement-surfaces">Palier déblai / remblai
            <select data-calque="palier">
              ${PALIERS.map((e) => `<option value="${e}" ${calques.palier === e ? 'selected' : ''}>${e === 'auto' ? 'auto' : `${e} m`}</option>`).join('')}
            </select>
          </label>
          <label class="choix-equidistance">Équidistance des courbes
            <select data-calque="equidistance">
              ${EQUIDISTANCES.map((e) => `<option value="${e}" ${calques.equidistance === e ? 'selected' : ''}>${e === 'auto' ? 'auto' : `${e} m`}</option>`).join('')}
            </select>
          </label>
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
      </div>
    </div>
  `;
  const svg = conteneur.querySelector('svg.plan');
  const boutonCalques = conteneur.querySelector('[data-action="calques"]');
  const menuCalques = conteneur.querySelector('.menu-calques');
  const cadre = conteneur.querySelector('.plan-cadre');
  const fond = conteneur.querySelector('.plan-fond');
  const attribution = conteneur.querySelector('.plan-attribution');
  // Images des tuiles affichées, rangées par adresse (pour les réutiliser d'un dessin à l'autre).
  const tuilesAffichees = new Map();
  let fondIndisponible = false;

  let points = [];
  let vue = null;
  // Position du récepteur (appli Android) : { est, nord, prete, azimut (°, ou null),
  // coupes: [{ sens, debut, fin }] (coupes en direct du mode Contrôler) } ou null.
  let position = null;
  // Suivi de la position : le plan se recentre sur elle à chaque mise à jour (bouton « Ma position »),
  // jusqu'à ce qu'on déplace le plan au doigt.
  let suivre = false;
  // Plans DXF en fond (voir topo/dxf-plan.js). Leur dessin SVG est préparé une seule fois (dans le
  // repère du plan, en m) puis seulement déplacé et agrandi : id -> { plan, cle, groupe }.
  let plansDxf = [];
  const dessinsDxf = new Map();
  // Vrai si le plan doit être recadré dès qu'il devient visible (il est caché dans un autre onglet).
  let recadrerQuandVisible = false;
  // Ce qu'il faut dessiner (voir editeur.js et main.js) :
  // stocks (les surfaces du projet), stockActif (surface choisie), listeEnCours, enEdition,
  // resultats (un par surface : trianglesDessus, et le volume s'il est calculé, voir volume.js),
  // cachees : surfaces à ne pas dessiner (celles d'un autre levé)
  // surface : surface affichée { triangles, trianglesRetires } ; modeTriangles : suppression au doigt
  // ecarts : triangles d'écart à colorier à la place de ceux des surfaces, sinon null
  // coupes : coupes tracées [{ nom, debut, fin }] ; traceCoupe : { debut } pendant un tracé, sinon null
  // modeMesures : onglet Calculs › Mesures (pas de surface ni de coupe) ; mesures : [{ mesure, resultat }]
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
    const rectangle = svg.getBoundingClientRect();
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
    svg.replaceChildren();
    legende = null;
    legendeEcarts = null;
    dessinerFond();
    if (vue) dessinerPlansDxf();
    if (!vue || points.length === 0) {
      if (vue && plansDxf.length > 0) dessinerBarreEchelle();
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
    for (const { point, x, y } of visibles) {
      if (calques.points || rangs.has(point.nom)) {
        groupePoints.append(creerElement('circle', { cx: x, cy: y, r: 3.5, class: classes.get(point.nom) ?? '' }));
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
    if (calques.noms || calques.altitudes) {
      const textes = visibles.map(({ point }) =>
        [calques.noms ? point.nom : null, calques.altitudes ? formaterNombre(point.altitude) : null].filter(Boolean),
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
    dessinerLegende();
    dessinerBarreEchelle();
    dessinerPosition();
  }

  /**
   * Position du récepteur : rond bleu (gris si l'inclinaison n'est pas prête : c'est alors
   * la position de l'antenne, pas celle du bout de canne). Redessinée seule, 5 fois par seconde.
   */
  function dessinerPosition() {
    svg.querySelector('g.position')?.remove();
    if (!position || !vue) return;
    const { x, y } = versEcran(position.est, position.nord, vue);
    const groupe = creerElement('g', { class: position.prete ? 'position' : 'position pas-prete' });
    // Coupes en direct : en pointillés, chacune de sa couleur (la même que son dessin).
    for (const coupe of position.coupes ?? []) {
      const debut = versEcran(coupe.debut.est, coupe.debut.nord, vue);
      const fin = versEcran(coupe.fin.est, coupe.fin.nord, vue);
      groupe.append(creerElement('line', { x1: debut.x, y1: debut.y, x2: fin.x, y2: fin.y, class: `trace-coupe-directe coupe-${coupe.sens}` }));
    }
    groupe.append(creerElement('circle', { cx: x, cy: y, r: 13, class: 'halo' }));
    // Petite flèche (comme Google Maps) : la direction où l'on regarde, dessinée vers le haut
    // puis tournée de l'azimut (sens des aiguilles d'une montre, comme à l'écran).
    if (position.azimut != null) {
      groupe.append(creerElement('path', {
        d: `M${x} ${y - 25} L${x + 8} ${y - 9} L${x} ${y - 13} L${x - 8} ${y - 9} Z`,
        class: 'fleche',
        transform: `rotate(${position.azimut.toFixed(1)} ${x} ${y})`,
      }));
    }
    groupe.append(creerElement('circle', { cx: x, cy: y, r: 6 }));
    svg.append(groupe);
  }

  /**
   * Dessin SVG d'un plan DXF, dans son propre repère (m depuis son origine, nord vers le haut) :
   * un chemin par couleur pour les traits et les cercles, un pour les aplats, puis les textes.
   * Refait seulement si le plan ou ses calques visibles changent.
   */
  function groupeDxf(plan) {
    const cle = plan.calques.map((c) => (c.visible ? 1 : 0)).join('');
    const enCache = dessinsDxf.get(plan.id);
    if (enCache && enCache.plan === plan && enCache.cle === cle) return enCache.groupe;
    const groupe = creerElement('g', {});
    const visible = (objet) => plan.calques[objet.c]?.visible !== false;
    const couleur = (objet) => objet.k ?? plan.calques[objet.c]?.couleur ?? '#000000';
    const traits = new Map();
    const pleins = new Map();
    const ajouter = (liste, teinte, morceau) => {
      if (!liste.has(teinte)) liste.set(teinte, []);
      liste.get(teinte).push(morceau);
    };
    const { traits: lignes = [], cercles = [], pleins: aplats = [], textes = [] } = plan.contenu ?? {};
    for (const trait of lignes) {
      if (!visible(trait)) continue;
      let d = `M${trait.p[0]} ${trait.p[1]}`;
      for (let i = 2; i < trait.p.length; i += 2) d += `L${trait.p[i]} ${trait.p[i + 1]}`;
      ajouter(traits, couleur(trait), trait.f ? `${d}Z` : d);
    }
    for (const { x, y, r, ...cercle } of cercles) {
      if (!visible(cercle)) continue;
      ajouter(traits, couleur(cercle), `M${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}`);
    }
    for (const aplat of aplats) {
      if (!visible(aplat)) continue;
      const p = aplat.p;
      ajouter(pleins, couleur(aplat), `M${p[0]} ${p[1]}L${p[2]} ${p[3]}L${p[4]} ${p[5]}L${p[6]} ${p[7]}Z`);
    }
    for (const [teinte, morceaux] of pleins) groupe.append(creerElement('path', { d: morceaux.join(''), fill: teinte, class: 'plein-dxf' }));
    for (const [teinte, morceaux] of traits) groupe.append(creerElement('path', { d: morceaux.join(''), stroke: teinte, class: 'trait-dxf' }));
    const groupeTextes = creerElement('g', { class: 'textes-dxf' });
    const ancres = ['start', 'middle', 'end'];
    const bases = ['alphabetic', 'text-after-edge', 'central', 'text-before-edge'];
    for (const texte of textes) {
      if (!visible(texte)) continue;
      // Le repère du plan a le nord vers le haut : on retourne le texte pour qu'il se lise droit.
      const element = creerElement('text', {
        transform: `translate(${texte.x} ${texte.y}) scale(1 -1) rotate(${-texte.a})`,
        'font-size': texte.h,
        fill: couleur(texte),
        'text-anchor': ancres[texte.ah] ?? 'start',
        'dominant-baseline': bases[texte.av] ?? 'alphabetic',
      });
      element.textContent = texte.t;
      groupeTextes.append(element);
    }
    groupe.append(groupeTextes);
    dessinsDxf.set(plan.id, { plan, cle, groupe });
    return groupe;
  }

  /** Plans DXF sous le dessin : le groupe préparé, placé à l'échelle et au bon endroit. */
  function dessinerPlansDxf() {
    if (!calques.plansDxf) return;
    for (const plan of plansDxf) {
      if (!plan.contenu) continue;
      const groupe = groupeDxf(plan);
      const e = vue.echelle;
      const tx = vue.largeur / 2 + (plan.origine.est - vue.estCentre) * e;
      const ty = vue.hauteur / 2 - (plan.origine.nord - vue.nordCentre) * e;
      groupe.setAttribute('transform', `matrix(${e} 0 0 ${-e} ${tx} ${ty})`);
      // Textes de moins de 3 pixels de haut : cachés (illisibles, et plus rapide).
      groupe.classList.toggle('sans-textes', e * 0.25 < 3);
      groupe.classList.add('plan-dxf');
      svg.append(groupe);
    }
  }

  /** Centre le plan sur la position du récepteur (sans changer le zoom, sauf au premier affichage). */
  function centrerSurPosition() {
    if (!position) return;
    const { largeur, hauteur } = taille();
    if (largeur === 0 || hauteur === 0) return;
    // Sans vue (aucun point encore) : environ 60 m de large à l'écran.
    vue = vue ? { ...vue, estCentre: position.est, nordCentre: position.nord } : { echelle: largeur / 60, estCentre: position.est, nordCentre: position.nord, largeur, hauteur };
    dessiner();
  }
  /**
   * Fonds de plan swisstopo (photo aérienne, cadastre) : des images posées sous le dessin.
   * Seules les tuiles visibles à l'écran sont chargées (connexion internet nécessaire).
   */
  function dessinerFond() {
    const couches = Object.keys(FONDS).filter((nom) => calques[nom === 'satellite' ? 'fondSatellite' : nom]);
    const voulues = new Set();

    if (vue && (points.length > 0 || position || plansDxf.length > 0) && couches.length > 0) {
      const z = niveauDeZoom(1 / vue.echelle, window.devicePixelRatio || 1);
      const hautGauche = versTerrain(0, 0, vue);
      const basDroite = versTerrain(vue.largeur, vue.hauteur, vue);
      const tuiles = tuilesPourZone(
        { estMin: hautGauche.est, estMax: basDroite.est, nordMin: basDroite.nord, nordMax: hautGauche.nord },
        z,
      );
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
    if (calques.couleursAltitude || calques.courbes) dessinerRelief(groupe);
    dessinerSurface(groupe);
    dessin.stocks.forEach((stock, index) => {
      const actif = stock === dessin.stockActif;
      if (!estVisible(stock)) return;
      const resultat = dessin.resultats[index];

      // Triangles du dessus : stock actif seulement, pour ne pas surcharger.
      if (actif && calques.triangles && resultat?.trianglesDessus) {
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
        for (const ligne of stock.lignesRupture ?? []) {
          const trace = chemin(ligne.noms, ligne.fermee);
          if (trace) groupe.append(creerElement('path', { d: trace, class: actif ? 'ligne-rupture actif' : 'ligne-rupture' }));
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
    const triangles = dessin.stocks.flatMap((stock, index) => {
      if (!estVisible(stock)) return [];
      return dessin.resultats[index]?.trianglesDessus ?? [];
    });
    // La surface affichée (onglet Calculs › Surfaces) est aussi coloriée, et les aires mesurées (onglet Calculs › Mesures).
    if (dessin.surface) triangles.push(...dessin.surface.triangles);
    for (const { resultat } of dessin.mesures ?? []) if (resultat?.triangles) triangles.push(...resultat.triangles);
    if (triangles.length === 0) return;
    const plage = plageAltitudes(triangles);
    const equidistance =
      calques.equidistance === 'auto' ? equidistanceAuto(plage.min, plage.max) : Number(calques.equidistance);
    const versPixels = (p) => versEcran(p.est, p.nord, vue);

    if (calques.couleursAltitude) {
      // Une couleur par bande : on regroupe les morceaux de même altitude en un seul tracé.
      const tracesParBande = new Map();
      for (const { altitude, polygone } of bandesDeNiveau(triangles, equidistance)) {
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

    if (calques.courbes) {
      // Une courbe sur 5 (courbe maîtresse) est plus épaisse.
      const traits = { normale: [], maitresse: [] };
      for (const { altitude, a, b } of courbesDeNiveau(triangles, equidistance)) {
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

    legende = { plage, equidistance };
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
      if (calques.couleursAltitude) {
        const pas = 20;
        const cases = Array.from({ length: pas }, (_, i) => couleurAltitude(plage.min + ((i + 0.5) / pas) * (plage.max - plage.min), plage));
        ecrire(x, ligne + 10, 'Altitude', 'start', 'titre-legende');
        ligne += 16;
        rangee(cases, formaterNombre(plage.min), formaterNombre(plage.max));
      }
      if (calques.couleursAltitude || calques.courbes) {
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

  /** Nom et volume (remblai, et déblai s'il y en a) écrits au milieu de chaque surface calculée. */
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
    if (!dessin.mesures?.length) return;
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
    if (!dessin.mesures?.length) return;
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
    const centre = points.length === 1 ? points[0] : points.length === 0 ? position : null;
    if (centre) vue = { echelle: largeur / 60, estCentre: centre.est, nordCentre: centre.nord, largeur, hauteur };
    else if (points.length > 0) vue = cadrerSurPoints(points, largeur, hauteur);
    else vue = plansDxf.length > 0 ? cadrerSurPoints(coinsDesPlans(plansDxf), largeur, hauteur) : null;
    dessiner();
  }

  function zoomerAuCentre(facteur) {
    if (!vue) return;
    vue = zoomer(vue, facteur, vue.largeur / 2, vue.hauteur / 2);
    dessiner();
  }

  // --- Boutons ---
  conteneur.querySelector('[data-action="tout-voir"]').addEventListener('click', toutVoir);
  conteneur.querySelector('[data-action="zoom-plus"]').addEventListener('click', () => zoomerAuCentre(1.5));
  conteneur.querySelector('[data-action="zoom-moins"]').addEventListener('click', () => zoomerAuCentre(1 / 1.5));
  const boutonPosition = conteneur.querySelector('[data-action="ma-position"]');
  boutonPosition.addEventListener('click', () => {
    suivre = true;
    boutonPosition.classList.add('actif');
    centrerSurPosition();
  });

  /** Arrête le suivi de la position (le plan a été déplacé au doigt). */
  function arreterSuivi() {
    suivre = false;
    boutonPosition.classList.remove('actif');
  }

  // --- Menu des calques ---
  boutonCalques.addEventListener('click', () => {
    menuCalques.hidden = !menuCalques.hidden;
    boutonCalques.setAttribute('aria-expanded', String(!menuCalques.hidden));
  });
  menuCalques.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    calques[champ.dataset.calque] = champ.type === 'checkbox' ? champ.checked : champ.value;
    // Remblai / déblai et couleurs selon l'altitude ne se lisent pas l'un sur l'autre : un seul à la fois.
    const exclusifs = { remblaiDeblai: 'couleursAltitude', couleursAltitude: 'remblaiDeblai' };
    const autre = exclusifs[champ.dataset.calque];
    if (autre && champ.checked) {
      calques[autre] = false;
      menuCalques.querySelector(`[data-calque="${autre}"]`).checked = false;
    }
    memoriserCalques(calques);
    dessiner();
  });
  // Le menu se ferme quand on touche le plan.
  svg.addEventListener('pointerdown', () => {
    menuCalques.hidden = true;
    boutonCalques.setAttribute('aria-expanded', 'false');
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

    if (apres.length === 1) {
      if (!toucher && suivre) arreterSuivi();
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
    dessiner();
  });

  svg.addEventListener('pointerup', (evenement) => {
    pointeurs.delete(evenement.pointerId);
    if (toucher && pointeurs.size === 0) {
      if (dessin.traceCoupe) {
        // Tracé d'une coupe : la position touchée (celle du point levé s'il y en a un tout près).
        const point = pointLePlusProche(toucher);
        quandToucherPosition?.(point ? { est: point.est, nord: point.nord } : versTerrain(toucher.x, toucher.y, vue));
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
        // Sinon : toucher l'intérieur d'un stock le choisit.
        const index = stockSousLeDoigt(toucher);
        if (index >= 0) quandToucherStock?.(index);
      }
    }
    toucher = null;
  });
  svg.addEventListener('pointercancel', (evenement) => {
    pointeurs.delete(evenement.pointerId);
    toucher = null;
  });

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
    const rectangle = svg.getBoundingClientRect();
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
      if (position && (!vue || suivre || (premiere && points.length === 0))) centrerSurPosition();
      else dessinerPosition();
    },
    /** Plans DXF à dessiner en fond (voir topo/dxf-plan.js). */
    afficherPlansDxf(nouveaux) {
      const avant = plansDxf.length;
      plansDxf = nouveaux.filter((plan) => plan.contenu && plan.bornes);
      for (const id of dessinsDxf.keys()) if (!plansDxf.some((plan) => plan.id === id)) dessinsDxf.delete(id);
      // Premier plan sans levé : on cadre dessus. Sinon, le dessin suit (redessiner, juste après).
      if (!vue || (avant === 0 && points.length === 0 && !position)) toutVoir();
    },
    /** Cadre le plan sur ces plans DXF (bouton « voir »). */
    cadrerSurPlans(choisis) {
      const { largeur, hauteur } = taille();
      if (largeur === 0 || hauteur === 0 || choisis.length === 0) return;
      suivre = false;
      boutonPosition.classList.remove('actif');
      vue = cadrerSurPoints(coinsDesPlans(choisis), largeur, hauteur);
      dessiner();
    },
    /** Redessine le plan avec les stocks (sans changer le zoom). */
    redessiner(nouveauDessin) {
      dessin = nouveauDessin;
      // Onglet 3. Mesures : le menu ne propose pas les calques des surfaces.
      menuCalques.classList.toggle('mode-mesures', Boolean(dessin.modeMesures));
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

/** Relit les calques choisis la dernière fois (gardés dans le navigateur), sinon ceux par défaut. */
function lireCalques() {
  const calques = Object.fromEntries(CALQUES.map((c) => [c.cle, c.parDefaut]));
  calques.equidistance = 'auto';
  calques.palier = 'auto';
  try {
    const memoire = JSON.parse(localStorage.getItem(CLE_MEMOIRE) ?? '{}');
    for (const c of CALQUES) if (typeof memoire[c.cle] === 'boolean') calques[c.cle] = memoire[c.cle];
    if (EQUIDISTANCES.includes(memoire.equidistance)) calques.equidistance = memoire.equidistance;
    if (PALIERS.includes(memoire.palier)) calques.palier = memoire.palier;
    if (calques.remblaiDeblai && calques.couleursAltitude) calques.couleursAltitude = false;
  } catch {
    // Mémoire du navigateur indisponible (navigation privée...) : on garde les valeurs par défaut.
  }
  return calques;
}

function memoriserCalques(calques) {
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(calques));
  } catch {
    // Pas grave : les calques reviendront aux valeurs par défaut à la prochaine ouverture.
  }
}
