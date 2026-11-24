// Plans de chantier (0.288.0) : la vue du plan (2 canvas). Dessous : les plans DXF / PDF / IFC du projet (comme le
// plan principal, dessinerPlansDxf) et les points levés. Dessus : les objets du plan de chantier (zones, lignes,
// pistes, flèches, textes), l'objet choisi, le dessin en cours et l'accroche.
// Molette = zoom autour de la souris ; glisser dans le vide = déplacer ; deux doigts = zoomer ;
// glisser l'objet choisi = le déplacer (si glisserObjet le permet).
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';
import { objetsVisibles, couleurObjet, bornesObjets, metresParMm, pointsDe, estPose, bordsDesTriangles, milieuxDesCotes } from '../topo/plan-chantier.js';
import { dessinerObjet, dessinerObjets, symboleDeLObjet } from './dessin.js';
import { coinsSymbole, poigneeRotation } from '../topo/symboles.js';
import { dessinerFondSwisstopo } from './tuiles.js';

const SEUIL_GLISSER_PX = 5;
const FACTEUR_MOLETTE = 1.2;
const ORANGE = '#ea580c';

/**
 * Crée la vue dans « conteneur » (vide). options :
 *  plans() : plans du projet à dessiner dessous (déjà recalés) ; points() : points levés [{ est, nord, nom }] ;
 *  planChantier() : le plan de chantier ; choisi() : id de l'objet choisi ou null ;
 *  saisie() : { outil, points: [[e, n]…] } pendant un dessin, ou null ;
 *  accrocher(position, toleranceM) : point accroché { est, nord } ou null ;
 *  clic(point [e, n], toleranceM, ev) ; double(point) ; bouge(point) (barre d'état) ;
 *  glisserObjet : { debut(point, tol) → true s'il prend le geste, deplacer(dEst, dNord, point accroché), fin() }.
 * Renvoie { redessiner(), redessinerDessus(), cadrer(), zoom(f), vue(), detruire() }.
 */
export function creerVueChantier(conteneur, options) {
  const {
    plans, points, planChantier, choisi, saisie, accrocher = () => null, clic = () => {}, double = () => {}, bouge = () => {}, glisserObjet = null,
    bibliotheque = () => [], surfaces = () => [], apercu = () => null, etatFond = () => {},
  } = options;
  conteneur.classList.add('toile-chantier');
  const photo = document.createElement('canvas'); // 0.289.0 : fond swisstopo (photo pâlie, cadastre)
  const fond = document.createElement('canvas');
  const dessus = document.createElement('canvas');
  conteneur.append(photo, fond, dessus);
  const bordsCache = new Map(); // id de surface → bords (calculés une fois)
  let vue = null;
  let curseur = null; // dernier point sous la souris (accroché si possible) [e, n]
  let accroche = null;
  let image = 0;
  const pointeurs = new Map();
  let geste = null;

  const taille = () => ({ largeur: conteneur.clientWidth || 300, hauteur: conteneur.clientHeight || 200 });
  const tolerance = () => (vue ? 10 / vue.echelle : 1);
  const densite = () => window.devicePixelRatio || 1;
  const ecran = ([e, n]) => versEcran(e, n, vue);

  function cadrer() {
    const { largeur, hauteur } = taille();
    const pc = planChantier();
    let b = pc ? bornesObjets(pc.objets) : null;
    const coins = [];
    if (b) coins.push({ est: b.estMin, nord: b.nordMin }, { est: b.estMax, nord: b.nordMax });
    else {
      for (const p of plans()) if (p.bornes) coins.push({ est: p.bornes.estMin, nord: p.bornes.nordMin }, { est: p.bornes.estMax, nord: p.bornes.nordMax });
      if (!coins.length) for (const p of points()) coins.push(p);
    }
    if (coins.length === 1) coins.push({ est: coins[0].est + 30, nord: coins[0].nord + 20 }, { est: coins[0].est - 30, nord: coins[0].nord - 20 });
    if (!coins.length) coins.push({ est: 2500000, nord: 1118000 }, { est: 2500080, nord: 1118050 });
    vue = cadrerSurPoints(coins, largeur, hauteur, 40);
    b = null;
    redessiner();
  }

  function redessiner() {
    if (!vue) return;
    const { largeur, hauteur } = taille();
    vue = { ...vue, largeur, hauteur };
    const pc = planChantier();
    dessinerPhoto(pc);
    dessinerPlansDxf(fond, plans(), vue, densite());
    if (pc?.fond?.surfaces !== false) dessinerSurfaces();
    if (pc?.fond?.points !== false) {
      const ctx = fond.getContext('2d');
      ctx.setTransform(densite(), 0, 0, densite(), 0, 0);
      ctx.fillStyle = '#475569';
      const noms = [];
      for (const p of points()) {
        if (!Number.isFinite(p.est)) continue;
        const q = versEcran(p.est, p.nord, vue);
        if (q.x < -5 || q.y < -5 || q.x > largeur + 5 || q.y > hauteur + 5) continue;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.2, 0, 2 * Math.PI);
        ctx.fill();
        if (pc?.fond?.nomsPoints && p.nom) noms.push([q, p.nom]);
      }
      // 0.299.0 : noms des points (au plus 1500 à l'écran, sinon illisible : zoomer)
      if (noms.length && noms.length <= 1500) {
        ctx.font = '11px system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineJoin = 'round';
        for (const [q, nom] of noms) {
          ctx.strokeText(String(nom), q.x + 4, q.y - 2);
          ctx.fillText(String(nom), q.x + 4, q.y - 2);
        }
      }
    }
    redessinerDessus();
  }

  let imagePhoto = 0;
  /** Fond swisstopo (0.289.0) : redessiné quand une tuile arrive. */
  function dessinerPhoto(pc) {
    const d = densite();
    photo.width = Math.round(vue.largeur * d);
    photo.height = Math.round(vue.hauteur * d);
    const ctx = photo.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const r = dessinerFondSwisstopo(ctx, vue, pc?.fond, d, () => {
      cancelAnimationFrame(imagePhoto);
      imagePhoto = requestAnimationFrame(() => vue && dessinerPhoto(planChantier()));
    });
    etatFond(r);
  }

  /** Surfaces du projet en fond : leurs bords, en gris fin. */
  function dessinerSurfaces() {
    const ctx = fond.getContext('2d');
    ctx.setTransform(densite(), 0, 0, densite(), 0, 0);
    ctx.strokeStyle = 'rgba(71,85,105,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const s of surfaces()) {
      const cle = `${s.id}:${s.triangles.length}`;
      if (!bordsCache.has(cle)) bordsCache.set(cle, bordsDesTriangles(s.triangles));
      ctx.beginPath();
      for (const [a, b] of bordsCache.get(cle)) {
        const p = ecran(a);
        const q = ecran(b);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function redessinerDessus() {
    if (!vue) return;
    const d = densite();
    const { largeur, hauteur } = vue;
    dessus.width = Math.round(largeur * d);
    dessus.height = Math.round(hauteur * d);
    const ctx = dessus.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const pc = planChantier();
    if (pc) {
      const visibles = objetsVisibles(pc);
      const d = contexteDessin(ctx, pc);
      dessinerObjets(d, visibles);
      const sel = visibles.find((o) => o.id === choisi()); // phase cachée : plus de cadre de choix
      if (sel) dessinerChoix(ctx, sel);
      // Symbole à poser (0.289.0) : aperçu transparent sous la souris.
      const fantome = curseur ? apercu() : null;
      if (fantome) {
        ctx.globalAlpha = 0.6;
        dessinerObjet(d, { ...fantome, point: curseur, phase: pc.phaseActive });
        ctx.globalAlpha = 1;
      }
    }
    dessinerSaisie(ctx, pc);
    if (accroche) {
      const q = versEcran(accroche.est, accroche.nord, vue);
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(q.x - 6, q.y - 6, 12, 12);
    }
  }

  function chemin(ctx, pts, ferme) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = ecran(p);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    if (ferme) ctx.closePath();
  }

  /** Pixels à l'écran pour 1 mm de papier (échelle du plan × zoom) : épaisseurs et motifs suivent le PDF à l'échelle choisie. */
  const pxParMm = (pc) => vue.echelle * metresParMm(pc);
  const contexteDessin = (ctx, pc) => ({ ctx, vue, pc, bib: bibliotheque(), mm: pxParMm(pc) });

  function dessinerChoix(ctx, o) {
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    if (estPose(o)) {
      // Symbole : sa boîte tournée, son centre, et la poignée ronde de rotation.
      const s = symboleDeLObjet(bibliotheque(), o);
      if (s) {
        chemin(ctx, coinsSymbole(o, s), true);
        ctx.stroke();
        const c = ecran(o.point);
        const r = ecran(poigneeRotation(o, s));
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
        ctx.strokeRect(c.x - 4, c.y - 4, 8, 8);
      }
      return;
    }
    const pts = pointsDe(o);
    if (o.type !== 'texte') {
      chemin(ctx, pts, o.type === 'zone');
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    for (const p of pts) {
      const q = ecran(p);
      ctx.fillRect(q.x - 4, q.y - 4, 8, 8);
      ctx.strokeRect(q.x - 4, q.y - 4, 8, 8);
    }
    // 0.299.0 : petit « + » au milieu de chaque côté (ligne, zone, flèche, piste) : clic ou glisser = ajouter un point.
    for (const { milieu } of milieuxDesCotes(o)) {
      const q = ecran(milieu);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(q.x - 2.8, q.y);
      ctx.lineTo(q.x + 2.8, q.y);
      ctx.moveTo(q.x, q.y - 2.8);
      ctx.lineTo(q.x, q.y + 2.8);
      ctx.stroke();
    }
  }

  function dessinerSaisie(ctx, pc) {
    const s = saisie();
    if (s?.source) {
      // Décalage : la ligne de départ (orange épais) et l'aperçu de la copie décalée.
      chemin(ctx, s.source, false);
      ctx.strokeStyle = ORANGE;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (s.apercu?.length > 1) {
        chemin(ctx, s.apercu, false);
        ctx.strokeStyle = pc ? couleurObjet(pc, { type: 'ligne', style: s.style, phase: pc.phaseActive }) : ORANGE;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }
    if (!s || !s.points.length) return;
    const pts = curseur ? [...s.points, curseur] : s.points;
    const couleur = pc ? couleurObjet(pc, { type: s.outil, categorie: s.categorie, style: s.style, phase: pc.phaseActive }) : ORANGE;
    chemin(ctx, pts, s.outil === 'zone');
    if (s.outil === 'zone' && pts.length >= 3) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = couleur;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = couleur;
    ctx.lineWidth = s.outil === 'piste' ? Math.max(3, (s.largeur ?? 4) * vue.echelle) : 2;
    if (s.outil === 'piste') ctx.globalAlpha = 0.35;
    ctx.setLineDash(s.outil === 'piste' ? [] : [6, 4]);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = couleur;
    for (const p of s.points) {
      const q = ecran(p);
      ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
  }

  const position = (ev) => {
    const r = conteneur.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  // Point du terrain sous la souris, accroché si une accroche trouve quelque chose.
  function pointSous(x, y) {
    const t = versTerrain(x, y, vue);
    accroche = accrocher(t, tolerance());
    return accroche ? [accroche.est, accroche.nord] : [t.est, t.nord];
  }
  function suivre(ev) {
    cancelAnimationFrame(image);
    const { x, y } = position(ev);
    image = requestAnimationFrame(() => {
      if (!vue) return;
      curseur = pointSous(x, y);
      bouge(curseur);
      redessinerDessus();
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
    if (pts.length === 1) {
      const t = versTerrain(pts[0].x, pts[0].y, vue);
      const objet = ev.button === 0 && glisserObjet?.debut([t.est, t.nord], tolerance());
      geste = { ...pts[0], vue, glisse: false, objet: Boolean(objet), dernier: [t.est, t.nord] };
    } else if (pts.length === 2) {
      geste = { vue, glisse: true, distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), milieu: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
    }
  });
  conteneur.addEventListener('pointermove', (ev) => {
    if (!vue) return;
    if (!pointeurs.has(ev.pointerId)) {
      suivre(ev);
      return;
    }
    pointeurs.set(ev.pointerId, position(ev));
    const pts = [...pointeurs.values()];
    if (pts.length === 2 && geste?.distance) {
      vue = zoomer(geste.vue, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / geste.distance, geste.milieu.x, geste.milieu.y);
      redessiner();
    } else if (pts.length === 1 && geste) {
      const p = pts[0];
      if (!geste.glisse && Math.hypot(p.x - geste.x, p.y - geste.y) > SEUIL_GLISSER_PX) geste.glisse = true;
      if (!geste.glisse) return;
      if (geste.objet) {
        const t = versTerrain(p.x, p.y, vue);
        glisserObjet.deplacer(t.est - geste.dernier[0], t.nord - geste.dernier[1], pointSous(p.x, p.y));
        geste.dernier = [t.est, t.nord];
        redessinerDessus();
      } else if (geste.x !== undefined) {
        vue = deplacer(geste.vue, p.x - geste.x, p.y - geste.y);
        redessiner();
      }
    }
  });
  const relacher = (ev) => {
    if (!pointeurs.has(ev.pointerId)) return;
    const p = position(ev);
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size === 0) {
      if (geste?.objet && geste.glisse) glisserObjet.fin();
      else if (geste && !geste.glisse && ev.type === 'pointerup') {
        curseur = pointSous(p.x, p.y);
        clic(curseur, tolerance(), ev);
      }
      geste = null;
    } else {
      const reste = [...pointeurs.values()][0];
      geste = { ...reste, vue, glisse: true };
    }
  };
  conteneur.addEventListener('pointerup', relacher);
  conteneur.addEventListener('pointercancel', relacher);
  conteneur.addEventListener('dblclick', (ev) => {
    if (!vue) return;
    const { x, y } = position(ev);
    double(pointSous(x, y));
  });
  conteneur.addEventListener('pointerleave', () => {
    if (pointeurs.size) return;
    accroche = null;
    curseur = null;
    if (vue) redessinerDessus();
  });

  // Vue lisible depuis l'élément (essais automatiques : cliquer à un endroit précis du terrain).
  conteneur.vueChantier = () => vue;

  const observateur = new ResizeObserver(() => {
    if (!conteneur.clientWidth) return;
    if (!vue) cadrer();
    else redessiner();
  });
  observateur.observe(conteneur);

  return {
    redessiner,
    redessinerDessus,
    cadrer,
    vue: () => vue,
    oublierCurseur() {
      curseur = null;
    },
    zoom(f) {
      if (!vue) return;
      vue = zoomer(vue, f, vue.largeur / 2, vue.hauteur / 2);
      redessiner();
    },
    detruire() {
      observateur.disconnect();
      conteneur.replaceChildren();
    },
  };
}
