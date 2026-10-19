// Affichage du plan : points avec leur nom, zoom et déplacement
// au doigt (téléphone) ou à la souris (ordinateur).
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer, barreEchelle } from './vue.js';
import { placerEtiquettes, pointInterieur } from './etiquettes.js';
import { pointDansPolygone } from '../topo/volume.js';
import { formaterNombre } from '../topo/format.js';
import { courbesDeNiveau, bandesDeNiveau, equidistanceAuto, plageAltitudes } from '../topo/courbes.js';

const SVG = 'http://www.w3.org/2000/svg';

// Distance maximale (pixels) entre le doigt et un point pour le "toucher".
const RAYON_TOUCHER = 22;

// Calques que l'on peut afficher ou masquer, avec leur état de départ.
const CALQUES = [
  { cle: 'points', titre: 'Points', parDefaut: true },
  { cle: 'noms', titre: 'Noms des points', parDefaut: true },
  { cle: 'altitudes', titre: 'Altitudes des points', parDefaut: false },
  { cle: 'contours', titre: 'Contours des stocks', parDefaut: true },
  { cle: 'lignes', titre: 'Lignes de rupture', parDefaut: true },
  { cle: 'triangles', titre: 'Triangles', parDefaut: true },
  { cle: 'couleursAltitude', titre: 'Couleurs selon l\'altitude', parDefaut: false },
  { cle: 'courbes', titre: 'Courbes de niveau', parDefaut: false },
  { cle: 'volumes', titre: 'Volume sur chaque stock', parDefaut: true },
  { cle: 'autresStocks', titre: 'Autres stocks', parDefaut: true },
];
const CLE_MEMOIRE = 'topo-calques';
// Équidistances proposées pour les courbes et les couleurs (m). « auto » : choisie selon la hauteur du stock.
const EQUIDISTANCES = ['auto', '0.1', '0.2', '0.25', '0.5', '1'];
// Couleurs du plus bas (bleu) au plus haut (rouge), palette classique des cartes d'altitude.
const PALETTE = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'];

/**
 * Crée le plan dans l'élément "conteneur" de la page.
 * - quandToucherPoint(nom) : appelé quand on touche un point pendant une modification
 * - quandToucherStock(index) : appelé quand on touche l'intérieur d'un stock (hors modification)
 * Renvoie un objet avec les fonctions afficherPoints(points) et redessiner(dessin).
 */
export function creerPlan(conteneur, { quandToucherPoint, quandToucherStock } = {}) {
  const calques = lireCalques();

  // Boutons posés sur le plan : calques en haut à gauche, zoom en haut à droite.
  conteneur.innerHTML = `
    <div class="plan-cadre">
      <svg class="plan" role="img" aria-label="Plan des points"></svg>
      <div class="plan-calques">
        <button type="button" class="puce" data-action="calques" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>
          Calques
        </button>
        <div class="menu-calques" hidden>
          ${CALQUES.map(
            (c) => `<label class="case"><input type="checkbox" data-calque="${c.cle}" ${calques[c.cle] ? 'checked' : ''} /> ${c.titre}</label>`,
          ).join('')}
          <label class="choix-equidistance">Équidistance
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
      </div>
    </div>
  `;
  const svg = conteneur.querySelector('svg.plan');
  const boutonCalques = conteneur.querySelector('[data-action="calques"]');
  const menuCalques = conteneur.querySelector('.menu-calques');

  let points = [];
  let vue = null;
  // Vrai si le plan doit être recadré dès qu'il devient visible (il est caché dans un autre onglet).
  let recadrerQuandVisible = false;
  // Ce qu'il faut dessiner (voir editeur.js et main.js) :
  // stocks, stockActif, pointsDeBase, listeEnCours, enEdition, resultats (un par stock, voir volume.js)
  let dessin = { stocks: [], stockActif: null, pointsDeBase: [], listeEnCours: [], enEdition: false, resultats: [] };

  /** Taille actuelle du plan à l'écran (pixels). */
  function taille() {
    const rectangle = svg.getBoundingClientRect();
    return { largeur: rectangle.width, hauteur: rectangle.height };
  }

  /** Noms des points qui appartiennent à un stock (tous rôles confondus). */
  function nomsDuStock(stock) {
    return [...stock.contour, ...stock.base, ...stock.lignesRupture.flatMap((l) => l.noms), ...stock.pointsDessus];
  }

  // Légende du relief (couleurs, équidistance), remplie par dessinerRelief.
  let legende = null;

  /** Redessine tout le plan avec la vue actuelle. */
  function dessiner() {
    svg.replaceChildren();
    legende = null;
    if (!vue || points.length === 0) return;

    const stock = dessin.stockActif;
    // Si « Autres stocks » est décoché, on cache les points qui appartiennent à un autre stock.
    const nomsCaches = new Set();
    if (!calques.autresStocks) {
      const nomsActifs = new Set(stock ? nomsDuStock(stock) : []);
      for (const autre of dessin.stocks) {
        if (autre !== stock) for (const nom of nomsDuStock(autre)) if (!nomsActifs.has(nom)) nomsCaches.add(nom);
      }
    }

    dessinerStocks();

    // Rôle de chaque point dans le stock actif, pour lui donner une couleur.
    const classes = new Map();
    if (stock) {
      for (const nom of stock.pointsDessus) classes.set(nom, 'role-dessus');
      for (const nom of stock.lignesRupture.flatMap((ligne) => ligne.noms)) classes.set(nom, 'role-ligne');
      for (const nom of dessin.pointsDeBase) classes.set(nom, 'role-base');
      for (const nom of stock.contour) classes.set(nom, 'role-contour');
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

    svg.append(groupePoints, groupeNoms);
    if (calques.volumes) dessinerVolumes();
    dessinerLegende();
    dessinerBarreEchelle();
  }

  /** Triangles, contours des stocks, lignes de rupture et segments en erreur. */
  function dessinerStocks() {
    const positions = new Map(points.map((p) => [p.nom, versEcran(p.est, p.nord, vue)]));
    const chemin = (noms, ferme) => {
      const sommets = noms.filter((nom) => positions.has(nom)).map((nom) => positions.get(nom));
      if (sommets.length < 2) return null;
      return sommets.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ') + (ferme ? ' Z' : '');
    };

    const groupe = creerElement('g', { class: 'stocks' });
    if (calques.couleursAltitude || calques.courbes) dessinerRelief(groupe);
    dessin.stocks.forEach((stock, index) => {
      const actif = stock === dessin.stockActif;
      if (!actif && !calques.autresStocks) return;
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
        const contour = chemin(stock.contour, true);
        if (contour) groupe.append(creerElement('path', { d: contour, class: actif ? 'contour actif' : 'contour' }));
      }
      if (calques.lignes) {
        for (const ligne of stock.lignesRupture) {
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
   * Couleurs selon l'altitude et courbes de niveau, sur la surface du dessus des stocks visibles.
   * Les couleurs utilisent la même échelle pour tous les stocks, pour pouvoir les comparer.
   */
  function dessinerRelief(groupe) {
    const triangles = dessin.stocks.flatMap((stock, index) => {
      if (stock !== dessin.stockActif && !calques.autresStocks) return [];
      return dessin.resultats[index]?.trianglesDessus ?? [];
    });
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

  /** Légende en bas à droite : échelle des couleurs et équidistance. */
  function dessinerLegende() {
    if (!legende) return;
    const { plage, equidistance } = legende;
    const largeur = 150;
    const x = vue.largeur - largeur - 12;
    const y = vue.hauteur - (calques.couleursAltitude ? 74 : 44);
    const groupe = creerElement('g', { class: 'legende' });
    groupe.append(creerElement('rect', { x: x - 8, y: y - 8, width: largeur + 16, height: vue.hauteur - y - 4, rx: 8 }));
    let ligne = y + 8;
    if (calques.couleursAltitude) {
      const pas = 20;
      for (let i = 0; i < pas; i++) {
        const altitude = plage.min + ((i + 0.5) / pas) * (plage.max - plage.min);
        groupe.append(
          creerElement('rect', { x: x + (i * largeur) / pas, y: ligne, width: largeur / pas + 0.5, height: 10, fill: couleurAltitude(altitude, plage) }),
        );
      }
      const textes = [
        [x, formaterNombre(plage.min), 'start'],
        [x + largeur, formaterNombre(plage.max), 'end'],
      ];
      for (const [tx, contenu, ancre] of textes) {
        const texte = creerElement('text', { x: tx, y: ligne + 24, 'text-anchor': ancre });
        texte.textContent = contenu;
        groupe.append(texte);
      }
      ligne += 38;
    }
    const texte = creerElement('text', { x, y: ligne + 4 });
    texte.textContent = `Équidistance ${equidistance} m`;
    groupe.append(texte);
    svg.append(groupe);
  }

  /** Nom et volume de remblai écrits au milieu de chaque stock calculé. */
  function dessinerVolumes() {
    const groupe = creerElement('g', { class: 'volumes' });
    dessin.stocks.forEach((stock, index) => {
      const actif = stock === dessin.stockActif;
      if (!actif && !calques.autresStocks) return;
      const resultat = dessin.resultats[index];
      const centre = resultat?.trianglesDessus ? pointInterieur(resultat.trianglesDessus) : null;
      if (!centre) return;
      const { x, y } = versEcran(centre.est, centre.nord, vue);
      const lignes = [stock.nom, `${formaterNombre(resultat.remblai)} m³`];
      const largeur = Math.max(...lignes.map((l) => l.length)) * 7.2 + 16;
      groupe.append(
        creerElement('rect', { x: x - largeur / 2, y: y - 20, width: largeur, height: 38, rx: 8, class: actif ? 'actif' : '' }),
      );
      lignes.forEach((ligne, i) => {
        const texte = creerElement('text', { x, y: y - 4 + i * 16, 'text-anchor': 'middle', class: i === 0 ? 'nom-stock' : '' });
        texte.textContent = ligne;
        groupe.append(texte);
      });
    });
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
    if (largeur === 0 || hauteur === 0) {
      // Plan caché (autre onglet) : on recadrera quand il s'affichera.
      recadrerQuandVisible = true;
      return;
    }
    recadrerQuandVisible = false;
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

  // --- Menu des calques ---
  boutonCalques.addEventListener('click', () => {
    menuCalques.hidden = !menuCalques.hidden;
    boutonCalques.setAttribute('aria-expanded', String(!menuCalques.hidden));
  });
  menuCalques.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    calques[champ.dataset.calque] = champ.type === 'checkbox' ? champ.checked : champ.value;
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
      if (dessin.enEdition) {
        // Pendant une modification : toucher un point l'ajoute ou le retire.
        const point = pointLePlusProche(toucher);
        if (point) quandToucherPoint?.(point.nom);
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
      const contour = stock.contour.map((nom) => parNom.get(nom)).filter(Boolean);
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

/** Relit les calques choisis la dernière fois (gardés dans le navigateur), sinon ceux par défaut. */
function lireCalques() {
  const calques = Object.fromEntries(CALQUES.map((c) => [c.cle, c.parDefaut]));
  calques.equidistance = 'auto';
  try {
    const memoire = JSON.parse(localStorage.getItem(CLE_MEMOIRE) ?? '{}');
    for (const c of CALQUES) if (typeof memoire[c.cle] === 'boolean') calques[c.cle] = memoire[c.cle];
    if (EQUIDISTANCES.includes(memoire.equidistance)) calques.equidistance = memoire.equidistance;
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

/**
 * Couleur d'une altitude (m) : du bleu (plus bas) au rouge (plus haut),
 * en mélangeant les couleurs voisines de la palette.
 */
function couleurAltitude(altitude, plage) {
  const etendue = plage.max - plage.min;
  const t = etendue > 0 ? Math.min(Math.max((altitude - plage.min) / etendue, 0), 1) : 0.5;
  const position = t * (PALETTE.length - 1);
  const i = Math.min(Math.floor(position), PALETTE.length - 2);
  const melange = position - i;
  const [r1, g1, b1] = enRVB(PALETTE[i]);
  const [r2, g2, b2] = enRVB(PALETTE[i + 1]);
  const canal = (a, b) => Math.round(a + (b - a) * melange);
  return `rgb(${canal(r1, r2)}, ${canal(g1, g2)}, ${canal(b1, b2)})`;
}

/** '#2c7bb6' -> [44, 123, 182] */
function enRVB(couleur) {
  return [1, 3, 5].map((i) => parseInt(couleur.slice(i, i + 2), 16));
}
