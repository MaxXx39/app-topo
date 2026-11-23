// Calage de plans (0.278.0) : une vue de plan (canvas) pour cliquer les éléments homologues.
// Dessin des plans par dessinerPlansDxf (comme le plan principal), molette = zoom autour de la souris,
// glisser = déplacer, deux doigts = zoomer ; au survol, l'accroche trouvée est montrée avant le clic.
// Les marques (P1, A1, V1…) sont dessinées par-dessus, sur un 2e canvas.
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';

const SEUIL_GLISSER_PX = 5; // au-delà, c'est un déplacement, pas un clic
const FACTEUR_MOLETTE = 1.2;

/**
 * Crée une vue dans « conteneur » (élément vide). options :
 *  plans() : plans à dessiner (format de lirePlanDxf, déjà recalés si besoin) ;
 *  marques() : [{ type: 'point' | 'axe', xy: [x, y] ou [x1, y1, x2, y2], texte, couleur, attente }] ;
 *  survol(position { est, nord }, toleranceM) : accroche { est, nord } ou { segment: [x1, y1, x2, y2] }, ou null ;
 *  infobulle(position, toleranceM) : texte montré près de la souris (nom du calque…), ou null (0.283.0) ;
 *  clic(position, toleranceM) : appelé au clic (sans glisser) ;
 *  cadrage() : plans montrés en entier par « Tout » (par défaut : plans()).
 * Renvoie { redessiner(), cadrer(), zoom(facteur), detruire() }.
 */
export function creerVueCalage(conteneur, { plans, cadrage = plans, marques = () => [], survol = () => null, infobulle = null, clic = () => {} }) {
  conteneur.classList.add('vue-calage-plan');
  const fond = document.createElement('canvas');
  const dessus = document.createElement('canvas');
  fond.className = 'fond-calage';
  dessus.className = 'dessus-calage';
  const bulle = document.createElement('div');
  bulle.className = 'infobulle-calage';
  bulle.hidden = true;
  conteneur.append(fond, dessus, bulle);
  let vue = null;
  let accroche = null;
  let image = 0;
  const pointeurs = new Map();
  let geste = null; // { x, y, vue, glisse, distance (2 doigts) }

  const taille = () => ({ largeur: conteneur.clientWidth || 300, hauteur: conteneur.clientHeight || 200 });
  const tolerance = () => (vue ? 10 / vue.echelle : 1); // 10 px

  function cadrer() {
    const { largeur, hauteur } = taille();
    const coins = cadrage().flatMap((p) => (p.bornes ? [{ est: p.bornes.estMin, nord: p.bornes.nordMin }, { est: p.bornes.estMax, nord: p.bornes.nordMax }] : []));
    vue = cadrerSurPoints(coins, largeur, hauteur, 20);
    redessiner();
  }

  function redessiner() {
    if (!vue) return;
    const { largeur, hauteur } = taille();
    vue = { ...vue, largeur, hauteur };
    const densite = window.devicePixelRatio || 1;
    dessinerPlansDxf(fond, plans(), vue, densite);
    dessinerDessus();
  }

  function dessinerDessus() {
    const densite = window.devicePixelRatio || 1;
    const { largeur, hauteur } = vue;
    dessus.width = Math.round(largeur * densite);
    dessus.height = Math.round(hauteur * densite);
    const ctx = dessus.getContext('2d');
    ctx.setTransform(densite, 0, 0, densite, 0, 0);
    ctx.font = 'bold 12px sans-serif';
    ctx.lineWidth = 2;
    for (const m of marques()) {
      ctx.strokeStyle = m.couleur;
      ctx.fillStyle = m.couleur;
      ctx.setLineDash(m.attente ? [4, 3] : []);
      if (m.type === 'zone') {
        // Zone à garder (nettoyage) : polygone, fermé une fois fini, en pointillé pendant le dessin.
        const pts = [];
        for (let i = 0; i + 1 < m.xy.length; i += 2) pts.push(versEcran(m.xy[i], m.xy[i + 1], vue));
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        if (!m.attente) ctx.closePath();
        ctx.stroke();
        if (!m.attente) {
          ctx.globalAlpha = 0.06;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        for (const q of pts) ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
        continue;
      }
      if (m.type === 'axe') {
        const a = versEcran(m.xy[0], m.xy[1], vue);
        const b = versEcran(m.xy[2], m.xy[3], vue);
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        etiquette(ctx, m.texte, (a.x + b.x) / 2, (a.y + b.y) / 2, m.couleur);
      } else {
        const p = versEcran(m.xy[0], m.xy[1], vue);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 11, p.y);
        ctx.lineTo(p.x + 11, p.y);
        ctx.moveTo(p.x, p.y - 11);
        ctx.lineTo(p.x, p.y + 11);
        ctx.stroke();
        etiquette(ctx, m.texte, p.x + 10, p.y - 12, m.couleur);
      }
    }
    ctx.setLineDash([]);
    // Accroche au survol : carré orange (point) ou trait orange (axe).
    if (accroche) {
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      if (accroche.segment) {
        const [x1, y1, x2, y2] = accroche.segment;
        const a = versEcran(x1, y1, vue);
        const b = versEcran(x2, y2, vue);
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const p = versEcran(accroche.est, accroche.nord, vue);
        ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
      }
    }
  }

  function etiquette(ctx, texte, x, y, couleur) {
    if (!texte) return;
    const l = ctx.measureText(texte).width + 8;
    ctx.fillStyle = couleur;
    ctx.fillRect(x, y - 9, l, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texte, x + 4, y + 4);
  }

  const position = (ev) => {
    const r = conteneur.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  function chercherAccroche(ev) {
    cancelAnimationFrame(image);
    const { x, y } = position(ev);
    image = requestAnimationFrame(() => {
      if (!vue) return;
      const terrain = versTerrain(x, y, vue);
      accroche = survol(terrain, tolerance());
      dessinerDessus();
      const texte = infobulle ? infobulle(terrain, tolerance()) : null;
      bulle.hidden = !texte;
      if (texte) {
        bulle.textContent = texte;
        bulle.style.left = `${Math.min(x + 14, Math.max(0, conteneur.clientWidth - 200))}px`;
        bulle.style.top = `${y + 16}px`;
      }
    });
  }

  conteneur.addEventListener('wheel', (ev) => {
    if (!vue) return;
    ev.preventDefault();
    const { x, y } = position(ev);
    vue = zoomer(vue, ev.deltaY < 0 ? FACTEUR_MOLETTE : 1 / FACTEUR_MOLETTE, x, y);
    redessiner();
  }, { passive: false });

  conteneur.addEventListener('pointerdown', (ev) => {
    if (!vue) return;
    conteneur.setPointerCapture(ev.pointerId);
    pointeurs.set(ev.pointerId, position(ev));
    const pts = [...pointeurs.values()];
    if (pts.length === 1) geste = { ...pts[0], vue, glisse: false };
    else if (pts.length === 2) geste = { vue, glisse: true, distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), milieu: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
  });
  conteneur.addEventListener('pointermove', (ev) => {
    if (!vue) return;
    if (!pointeurs.has(ev.pointerId)) {
      chercherAccroche(ev);
      return;
    }
    pointeurs.set(ev.pointerId, position(ev));
    const pts = [...pointeurs.values()];
    if (pts.length === 2 && geste?.distance) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      vue = zoomer(geste.vue, d / geste.distance, geste.milieu.x, geste.milieu.y);
      redessiner();
    } else if (pts.length === 1 && geste) {
      const p = pts[0];
      if (!geste.glisse && Math.hypot(p.x - geste.x, p.y - geste.y) > SEUIL_GLISSER_PX) geste.glisse = true;
      if (geste.glisse) bulle.hidden = true;
      if (geste.glisse && geste.x !== undefined) {
        vue = deplacer(geste.vue, p.x - geste.x, p.y - geste.y);
        redessiner();
      } else if (ev.pointerType !== 'mouse') chercherAccroche(ev);
    }
  });
  const relacher = (ev) => {
    if (!pointeurs.has(ev.pointerId)) return;
    const p = position(ev);
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size === 0) {
      if (geste && !geste.glisse && ev.type === 'pointerup') {
        const terrain = versTerrain(p.x, p.y, vue);
        accroche = survol(terrain, tolerance());
        clic(terrain, tolerance());
      }
      geste = null;
    } else {
      // Il reste un doigt : il reprend le déplacement depuis là.
      const reste = [...pointeurs.values()][0];
      geste = { ...reste, vue, glisse: true };
    }
  };
  conteneur.addEventListener('pointerup', relacher);
  conteneur.addEventListener('pointercancel', relacher);
  conteneur.addEventListener('pointerleave', () => {
    if (pointeurs.size) return;
    accroche = null;
    bulle.hidden = true;
    if (vue) dessinerDessus();
  });

  // Vue courante lisible depuis l'élément (essais automatiques : viser un sommet précis).
  conteneur.vueCalage = () => vue;

  const observateur = new ResizeObserver(() => {
    if (!conteneur.clientWidth) return;
    if (!vue) cadrer();
    else redessiner();
  });
  observateur.observe(conteneur);

  return {
    redessiner,
    cadrer,
    zoom(facteur) {
      if (!vue) return;
      vue = zoomer(vue, facteur, vue.largeur / 2, vue.hauteur / 2);
      redessiner();
    },
    detruire() {
      observateur.disconnect();
      conteneur.replaceChildren();
    },
  };
}
