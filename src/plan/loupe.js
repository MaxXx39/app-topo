// Accroche « Manuel » (0.130.0, demande du 05.11, maquettes 2 et 4 validées) : une loupe ronde
// posée sur le plan, avec une croix au centre, et une poignée (une main) en bas à droite.
// On tire la main au doigt : le centre de la croix est le point visé, le doigt ne le cache jamais.
// Doigt levé : la croix passe au vert, les flèches ▲▼◀▶ la déplacent d'un pixel de la loupe,
// le zoom se change (×2, ×4, ×8). Recalage d'un plan PDF (Expert) et Implanter › Point (Intermédiaire).
//
// La loupe dessine elle-même les plans DXF / PDF grossis (même dessin que le plan, plus zoomé) :
// l'image reste nette, au lieu d'agrandir les pixels de l'écran. 0.159.0 : dessous, la photo aérienne
// swisstopo (tuiles plus détaillées) quand elle est affichée sur le plan.
import { versEcran, versTerrain, zoneVisible } from './vue.js';
import { dessinerPlansDxf } from './dxf-canvas.js';
import { niveauDeZoom, tuilesPourZone } from './fond.js';

/** Rayon de la loupe et distance (en x et en y) entre son centre et celui de la poignée (px). */
export const RAYON_LOUPE = 64;
export const DECALAGE_POIGNEE = 116;

const MAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v2" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></svg>';

/**
 * Point du terrain sous le centre de la loupe après un déplacement de (dx, dy) pixels de l'écran.
 * vue : vue du plan (vue.js) ; cible : { est, nord } avant le déplacement.
 */
export function cibleDeplacee(cible, dx, dy, vue) {
  const { x, y } = versEcran(cible.est, cible.nord, vue);
  return versTerrain(x + dx, y + dy, vue);
}

/**
 * Place de départ du centre de la loupe (px) : au milieu de la partie libre du plan (au-dessus de
 * la barre posée en bas), la main (en bas à droite) restant visible. largeur, hauteur : le plan ;
 * libre : hauteur au-dessus de la barre.
 */
export function departDeLaLoupe(largeur, hauteur, libre = hauteur) {
  const bout = DECALAGE_POIGNEE + 34; // du centre de la loupe au bord de la main
  const marge = RAYON_LOUPE + 8;
  const x = Math.max(marge, Math.min(largeur / 2, largeur - bout));
  const y = Math.max(marge, Math.min(Math.min(hauteur, libre) / 2, Math.min(hauteur, libre) - bout));
  return { x, y };
}

/**
 * Crée la loupe dans "cadre" (le cadre du plan). lireVue() : vue du plan ; lirePlans() : plans DXF
 * affichés. Renvoie { montrer, cacher, actif, redessiner, deplacerDe, changerZoom, placerSur }.
 */
export function creerLoupe(cadre, { lireVue, lirePlans, lireFond = () => null }) {
  const boite = document.createElement('div');
  boite.className = 'loupe-manuelle';
  boite.hidden = true;
  const r = RAYON_LOUPE;
  boite.innerHTML = `
    <div class="loupe-tige" aria-hidden="true"></div>
    <div class="loupe-rond" role="img" aria-label="Loupe : le point visé est au centre de la croix">
      <canvas class="loupe-photo"></canvas>
      <canvas class="loupe-plans"></canvas>
      <svg class="loupe-croix" viewBox="0 0 ${2 * r} ${2 * r}" aria-hidden="true">
        <line x1="8" y1="${r}" x2="${r - 7}" y2="${r}" /><line x1="${r + 7}" y1="${r}" x2="${2 * r - 8}" y2="${r}" />
        <line x1="${r}" y1="8" x2="${r}" y2="${r - 7}" /><line x1="${r}" y1="${r + 7}" x2="${r}" y2="${2 * r - 8}" />
        <circle cx="${r}" cy="${r}" r="4" />
      </svg>
      <span class="loupe-zoom"></span>
    </div>
    <button type="button" class="loupe-poignee" aria-label="Déplacer la loupe">${MAIN}</button>`;
  cadre.append(boite);
  const canvas = boite.querySelector('.loupe-plans');
  const toilePhoto = boite.querySelector('.loupe-photo');
  // Tuiles de la photo déjà demandées (adresse → image) ; une tuile chargée redessine la loupe.
  const imagesPhoto = new Map();
  const texteZoom = boite.querySelector('.loupe-zoom');

  /** Hauteur du plan au-dessus de la barre posée en bas (recalage), en px. */
  const hauteurLibre = () => {
    const barre = cadre.querySelector('.barre-pointage');
    return barre ? barre.offsetTop : cadre.clientHeight;
  };

  let cible = null; // { est, nord } : point sous le centre de la croix
  let zoom = 4;
  let quandLache = null;
  let glisse = null; // { id, x, y } pendant qu'on tire
  let dessinPrevu = false;

  function placer() {
    const vue = lireVue();
    if (!vue || !cible) return;
    const { x, y } = versEcran(cible.est, cible.nord, vue);
    boite.style.transform = `translate(${x - r}px, ${y - r}px)`;
  }

  function dessiner() {
    dessinPrevu = false;
    const vue = lireVue();
    if (boite.hidden || !vue || !cible) return;
    placer();
    const densite = Math.min(window.devicePixelRatio || 1, 2);
    const vueLoupe = { ...vue, largeur: 2 * r, hauteur: 2 * r, echelle: vue.echelle * zoom, estCentre: cible.est, nordCentre: cible.nord };
    dessinerPhoto(vueLoupe, densite);
    dessinerPlansDxf(canvas, lirePlans(), vueLoupe, densite);
    texteZoom.textContent = `×${zoom}`;
  }

  /** Photo aérienne sous les plans : chaque tuile posée par ses coins (le plan peut être tourné). */
  function dessinerPhoto(vueLoupe, densite) {
    const fond = lireFond();
    const taille = Math.round(2 * r * densite);
    if (toilePhoto.width !== taille) {
      toilePhoto.width = taille;
      toilePhoto.height = taille;
    }
    const ctx = toilePhoto.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, taille, taille);
    toilePhoto.hidden = !fond;
    if (!fond) return;
    const z = niveauDeZoom(1 / vueLoupe.echelle, densite);
    const tuiles = tuilesPourZone(zoneVisible(vueLoupe), z);
    if (tuiles.length > 16) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, fond.opacite));
    for (const tuile of tuiles) {
      const adresse = fond.url(tuile.z, tuile.colonne, tuile.ligne);
      let image = imagesPhoto.get(adresse);
      if (!image) {
        image = new Image();
        image.onload = redessiner;
        image.src = adresse;
        imagesPhoto.set(adresse, image);
        if (imagesPhoto.size > 64) imagesPhoto.delete(imagesPhoto.keys().next().value);
      }
      if (!image.complete || !image.naturalWidth) continue;
      const a = versEcran(tuile.est, tuile.nord, vueLoupe);
      const b = versEcran(tuile.est + tuile.cote, tuile.nord, vueLoupe);
      const c = versEcran(tuile.est, tuile.nord - tuile.cote, vueLoupe);
      const n = image.naturalWidth;
      ctx.setTransform(((b.x - a.x) / n) * densite, ((b.y - a.y) / n) * densite, ((c.x - a.x) / n) * densite, ((c.y - a.y) / n) * densite, a.x * densite, a.y * densite);
      ctx.drawImage(image, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function redessiner() {
    if (dessinPrevu || boite.hidden) return;
    dessinPrevu = true;
    requestAnimationFrame(dessiner);
  }

  // Tirer la loupe par la main (ou par le rond) : le doigt ne cache jamais le centre.
  boite.addEventListener('pointerdown', (evenement) => {
    if (!evenement.target.closest('.loupe-poignee, .loupe-rond')) return;
    evenement.preventDefault();
    evenement.stopPropagation();
    glisse = { id: evenement.pointerId, x: evenement.clientX, y: evenement.clientY };
    boite.setPointerCapture?.(evenement.pointerId);
    boite.classList.add('glisse');
    boite.classList.remove('posee');
  });
  boite.addEventListener('pointermove', (evenement) => {
    if (!glisse || evenement.pointerId !== glisse.id) return;
    const vue = lireVue();
    if (!vue || !cible) return;
    cible = cibleDeplacee(cible, evenement.clientX - glisse.x, evenement.clientY - glisse.y, vue);
    glisse.x = evenement.clientX;
    glisse.y = evenement.clientY;
    placer();
    redessiner();
  });
  const finir = (evenement) => {
    if (!glisse || evenement.pointerId !== glisse.id) return;
    glisse = null;
    boite.classList.remove('glisse');
    boite.classList.add('posee');
    quandLache?.({ ...cible });
  };
  boite.addEventListener('pointerup', finir);
  boite.addEventListener('pointercancel', finir);
  // Un toucher sur la loupe ne doit pas arriver au plan (pas de point accroché dessous).
  boite.addEventListener('click', (evenement) => evenement.stopPropagation());

  return {
    /**
     * Montre la loupe. recentrer : au milieu du plan (début d'une étape) ; sinon là où elle était.
     * zoom : 2, 4 ou 8 ; quandLache({ est, nord }) : appelé quand le doigt se lève (ou une flèche).
     */
    montrer({ recentrer = false, zoom: nouveauZoom, quandLache: rappel } = {}) {
      const vue = lireVue();
      if (!vue) return;
      quandLache = rappel ?? quandLache;
      if (nouveauZoom) zoom = nouveauZoom;
      if (recentrer || !cible) {
        const { x, y } = departDeLaLoupe(vue.largeur, vue.hauteur, hauteurLibre());
        cible = versTerrain(x, y, vue);
        boite.classList.remove('posee');
      }
      boite.hidden = false;
      redessiner();
    },
    cacher() {
      boite.hidden = true;
      glisse = null;
      boite.classList.remove('glisse', 'posee');
    },
    actif: () => !boite.hidden,
    redessiner,
    /** Déplace la croix de (dx, dy) pixels de la loupe (flèches du réglage fin). */
    deplacerDe(dx, dy) {
      const vue = lireVue();
      if (!vue || !cible) return;
      cible = cibleDeplacee(cible, dx / zoom, dy / zoom, vue);
      boite.classList.add('posee');
      redessiner();
      quandLache?.({ ...cible });
    },
    changerZoom(nouveau) {
      zoom = nouveau;
      redessiner();
    },
    /** Pose la loupe sur un point du terrain (toucher le plan ailleurs). */
    placerSur(est, nord) {
      cible = { est, nord };
      boite.classList.add('posee');
      redessiner();
      quandLache?.({ ...cible });
    },
  };
}
