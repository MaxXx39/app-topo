// Affichage du plan : points avec leur nom, zoom et déplacement
// au doigt (téléphone) ou à la souris (ordinateur).
import { cadrerSurPoints, versEcran, deplacer, zoomer, barreEchelle } from './vue.js';

const SVG = 'http://www.w3.org/2000/svg';

// Distance maximale (pixels) entre le doigt et un point pour le "toucher".
const RAYON_TOUCHER = 22;

/**
 * Crée le plan dans l'élément "conteneur" de la page.
 * - quandToucherPoint(nom) : appelé quand on touche un point (sans faire glisser)
 * Renvoie un objet avec les fonctions afficherPoints(points) et redessiner(dessin).
 */
export function creerPlan(conteneur, { quandToucherPoint } = {}) {
  conteneur.innerHTML = `
    <div class="plan-outils">
      <button type="button" class="bouton-secondaire" data-action="tout-voir">Tout voir</button>
      <button type="button" class="bouton-secondaire" data-action="zoom-plus" aria-label="Zoomer">+</button>
      <button type="button" class="bouton-secondaire" data-action="zoom-moins" aria-label="Dézoomer">−</button>
      <label class="case"><input type="checkbox" data-action="noms" checked /> Noms</label>
    </div>
    <div class="plan-cadre"><svg class="plan" role="img" aria-label="Plan des points"></svg></div>
  `;
  const svg = conteneur.querySelector('svg');
  const caseNoms = conteneur.querySelector('[data-action="noms"]');

  let points = [];
  let vue = null;
  // Stocks à dessiner : { stocks, stockActif, pointsDeBase, listeEnCours } (voir editeur.js)
  let dessin = { stocks: [], stockActif: null, pointsDeBase: [], listeEnCours: [] };

  /** Taille actuelle du plan à l'écran (pixels). */
  function taille() {
    const rectangle = svg.getBoundingClientRect();
    return { largeur: rectangle.width, hauteur: rectangle.height };
  }

  /** Redessine tout le plan avec la vue actuelle. */
  function dessiner() {
    svg.replaceChildren();
    if (!vue || points.length === 0) return;

    dessinerStocks();

    // Rôle de chaque point dans le stock actif, pour lui donner une couleur.
    const stock = dessin.stockActif;
    const classes = new Map();
    if (stock) {
      for (const nom of stock.pointsDessus) classes.set(nom, 'role-dessus');
      for (const nom of stock.lignesRupture.flat()) classes.set(nom, 'role-ligne');
      for (const nom of dessin.pointsDeBase) classes.set(nom, 'role-base');
      for (const nom of stock.contour) classes.set(nom, 'role-contour');
    }
    const rangs = new Map(dessin.listeEnCours.map((nom, index) => [nom, index + 1]));

    const groupePoints = creerElement('g', { class: 'points' });
    const groupeNoms = creerElement('g', { class: 'noms' });
    for (const point of points) {
      const { x, y } = versEcran(point.est, point.nord, vue);
      // On ne dessine pas les points loin hors de l'écran.
      if (x < -50 || y < -50 || x > vue.largeur + 50 || y > vue.hauteur + 50) continue;
      groupePoints.append(creerElement('circle', { cx: x, cy: y, r: 3.5, class: classes.get(point.nom) ?? '' }));
      if (rangs.has(point.nom)) {
        // Point de la liste en cours : entouré, avec son numéro d'ordre.
        groupePoints.append(creerElement('circle', { cx: x, cy: y, r: 8, class: 'selection' }));
        const rang = creerElement('text', { x: x - 5, y: y + 16, class: 'rang', 'text-anchor': 'end' });
        rang.textContent = rangs.get(point.nom);
        groupeNoms.append(rang);
      }
      if (caseNoms.checked) {
        const nom = creerElement('text', { x: x + 5, y: y - 5 });
        nom.textContent = point.nom;
        groupeNoms.append(nom);
      }
    }
    svg.append(groupePoints, groupeNoms);
    dessinerBarreEchelle();
  }

  /** Contours de tous les stocks, puis lignes de rupture du stock actif. */
  function dessinerStocks() {
    const positions = new Map(points.map((p) => [p.nom, versEcran(p.est, p.nord, vue)]));
    const chemin = (noms, ferme) => {
      const sommets = noms.filter((nom) => positions.has(nom)).map((nom) => positions.get(nom));
      if (sommets.length < 2) return null;
      return sommets.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ') + (ferme ? ' Z' : '');
    };

    const groupe = creerElement('g', { class: 'stocks' });
    for (const stock of dessin.stocks) {
      const actif = stock === dessin.stockActif;
      const contour = chemin(stock.contour, true);
      if (contour) groupe.append(creerElement('path', { d: contour, class: actif ? 'contour actif' : 'contour' }));
      if (!actif) continue;
      for (const ligne of stock.lignesRupture) {
        const trace = chemin(ligne, false);
        if (trace) groupe.append(creerElement('path', { d: trace, class: 'ligne-rupture' }));
      }
    }
    svg.append(groupe);
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
    vue = cadrerSurPoints(points, largeur, hauteur);
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
  caseNoms.addEventListener('change', dessiner);

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
    if (toucher && pointeurs.size === 0 && quandToucherPoint) {
      const point = pointLePlusProche(toucher);
      if (point) quandToucherPoint(point.nom);
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

  /** Position du doigt ou de la souris dans le plan (pixels). */
  function positionDansPlan(evenement) {
    const rectangle = svg.getBoundingClientRect();
    return { x: evenement.clientX - rectangle.left, y: evenement.clientY - rectangle.top };
  }

  // Si la taille de l'écran change (rotation du téléphone), on garde le même centre.
  new ResizeObserver(() => {
    if (!vue) return;
    vue = { ...vue, ...taille() };
    dessiner();
  }).observe(svg);

  return {
    /** Affiche une nouvelle liste de points et cadre le plan dessus. */
    afficherPoints(nouveauxPoints) {
      points = nouveauxPoints;
      toutVoir();
    },
    /** Redessine le plan avec les stocks (sans changer le zoom). */
    redessiner(nouveauDessin) {
      dessin = nouveauDessin;
      dessiner();
    },
  };
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
