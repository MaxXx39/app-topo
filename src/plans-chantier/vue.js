// Plans de chantier (0.288.0) : la vue du plan (2 canvas). Dessous : les plans DXF / PDF / IFC du projet (comme le
// plan principal, dessinerPlansDxf) et les points levés. Dessus : les objets du plan de chantier (zones, lignes,
// pistes, flèches, textes), l'objet choisi, le dessin en cours et l'accroche.
// Molette = zoom autour de la souris ; glisser dans le vide = déplacer ; deux doigts = zoomer ;
// glisser l'objet choisi = le déplacer (si glisserObjet le permet).
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';
import {
  objetsVisibles, couleurObjet, styleLigne, pointeDeFleche, bornesObjets, positionsLeLong, morceauxAvecTrous, metresParMm,
  epaisseurLigneMm, contourZoneMm, opaciteZone, dimensionsFleche, centreZone, texteSurface, pointsDe,
} from '../topo/plan-chantier.js';

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
  const { plans, points, planChantier, choisi, saisie, accrocher = () => null, clic = () => {}, double = () => {}, bouge = () => {}, glisserObjet = null } = options;
  conteneur.classList.add('toile-chantier');
  const fond = document.createElement('canvas');
  const dessus = document.createElement('canvas');
  conteneur.append(fond, dessus);
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
    dessinerPlansDxf(fond, plans(), vue, densite());
    const pc = planChantier();
    if (pc?.fond?.points !== false) {
      const ctx = fond.getContext('2d');
      ctx.setTransform(densite(), 0, 0, densite(), 0, 0);
      ctx.fillStyle = '#475569';
      for (const p of points()) {
        if (!Number.isFinite(p.est)) continue;
        const q = versEcran(p.est, p.nord, vue);
        if (q.x < -5 || q.y < -5 || q.x > largeur + 5 || q.y > hauteur + 5) continue;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    redessinerDessus();
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
      for (const o of visibles) dessinerObjet(ctx, pc, o);
      const sel = visibles.find((o) => o.id === choisi()); // phase cachée : plus de cadre de choix
      if (sel) dessinerChoix(ctx, sel);
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

  /** Plaque blanche arrondie avec un texte centré en (x, y) (texte de plan, surface d'une zone). */
  function plaque(ctx, texte, x, y, h, poids = 600) {
    ctx.font = `${poids} ${h}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(texte).width + h * 0.7;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(43,52,64,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h * 0.68, w, h * 1.36, h * 0.35);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b2b36';
    ctx.fillText(texte, x, y + h * 0.04);
    return { w, h: h * 1.36 };
  }

  function dessinerObjet(ctx, pc, o) {
    const couleur = couleurObjet(pc, o);
    const e = vue.echelle;
    const mm = pxParMm(pc);
    ctx.setLineDash([]);
    if (o.type === 'zone') {
      chemin(ctx, o.points, true);
      ctx.globalAlpha = opaciteZone(o);
      ctx.fillStyle = couleur;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(0.8, contourZoneMm(o) * mm);
      ctx.stroke();
      if (o.afficherSurface) {
        const c = ecran(centreZone(o.points));
        plaque(ctx, texteSurface(o.points), c.x, c.y, Math.min(22, Math.max(10, 3 * mm)));
      }
    } else if (o.type === 'ligne') {
      dessinerLigne(ctx, o.points.map((p) => { const q = ecran(p); return [q.x, q.y]; }), styleLigne(o.style), couleur, mm, o);
    } else if (o.type === 'piste') {
      chemin(ctx, o.points, false);
      ctx.strokeStyle = couleur;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(3, (o.largeur ?? 4) * e);
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      chemin(ctx, o.points, false);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([Math.max(3, 1.5 * e), Math.max(3, 1.5 * e)]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (o.type === 'fleche') {
      const pts = o.points;
      if (pts.length < 2) return;
      // Largeur du corps (m) et pointe à l'échelle réglée ; au moins 1,5 px / 9 px pour rester visibles.
      const dim = dimensionsFleche(o);
      const pointe = Math.max(9 / e, dim.longueurPointe);
      const tete = pointeDeFleche(pts[pts.length - 2], pts[pts.length - 1], pointe, Math.max(dim.largeurPointe, 7 / e));
      const base = [(tete[1][0] + tete[2][0]) / 2, (tete[1][1] + tete[2][1]) / 2];
      chemin(ctx, [...pts.slice(0, -1), base], false);
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(1.5, dim.largeur * e);
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.lineCap = 'round';
      chemin(ctx, tete, true);
      ctx.fillStyle = couleur;
      ctx.fill();
    } else if (o.type === 'texte') {
      const q = ecran(o.point);
      const h = Math.max(9, (o.taille ?? 1) * e);
      const { w, h: hauteur } = plaque(ctx, o.texte, q.x, q.y, h);
      if (o.repere) dessinerRepere(ctx, o, q, w, hauteur, couleur);
    }
  }

  /** Ligne de repère d'un texte : du bord de la plaque au point visé, avec une flèche ou un point au bout. */
  function dessinerRepere(ctx, o, q, w, h, couleur) {
    const t = ecran(o.repere);
    const dx = t.x - q.x;
    const dy = t.y - q.y;
    const k = Math.min((w / 2) / (Math.abs(dx) || 1e-9), (h / 2) / (Math.abs(dy) || 1e-9));
    if (k >= 1) return; // le point visé est sous la plaque
    const dep = { x: q.x + dx * k, y: q.y + dy * k };
    ctx.strokeStyle = '#1b2b36';
    ctx.fillStyle = '#1b2b36';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dep.x, dep.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    const bout = o.repereBout ?? 'fleche';
    if (bout === 'point') {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    } else if (bout === 'fleche') {
      const a = Math.atan2(t.y - dep.y, t.x - dep.x);
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - 10 * Math.cos(a - 0.35), t.y - 10 * Math.sin(a - 0.35));
      ctx.lineTo(t.x - 10 * Math.cos(a + 0.35), t.y - 10 * Math.sin(a + 0.35));
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Ligne à l'écran (points en px) avec son style : tirets, épaisseur et motif en mm de papier (× l'échelle du motif de la
   * ligne) ; la ligne s'interrompt autour de chaque motif. pxMm = pixels pour 1 mm de papier.
   */
  function dessinerLigne(ctx, pts, style, couleur, pxMm, o = {}) {
    const m = style.motif;
    const ech = o.echelleMotif ?? 1;
    const epaisseur = Math.max(0.8, (o.epaisseurMm ?? style.epaisseurMm) * pxMm);
    const trace = (morceaux) => {
      ctx.strokeStyle = couleur;
      ctx.lineWidth = epaisseur;
      ctx.setLineDash(style.tirets.map((t) => Math.max(1.5, t * pxMm)));
      for (const mo of morceaux) {
        ctx.beginPath();
        mo.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    if (!m) return trace([pts]);
    const taille = Math.max(6, m.tailleMm * pxMm * ech); // hauteur du motif (px)
    if (m.type === 'poteau') {
      // Poteaux tous les pasMm de papier : petit rectangle en travers de la ligne.
      trace([pts]);
      const pas = Math.max(m.pasMm * pxMm * ech, taille * 1.6);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(1, epaisseur * 0.8);
      for (const q of positionsLeLong(pts, pas, 0)) {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.angle);
        ctx.fillRect(-taille * 0.2, -taille / 2, taille * 0.4, taille);
        ctx.strokeRect(-taille * 0.2, -taille / 2, taille * 0.4, taille);
        ctx.restore();
      }
      return;
    }
    ctx.font = `600 ${taille}px system-ui, sans-serif`;
    const larg = m.type === 'texte' ? ctx.measureText(m.texte).width + (m.eclair ? taille : 0) : m.type === 'double' ? taille * 2 : taille;
    const pas = Math.max(m.pasMm * pxMm * ech, larg + taille * 1.5);
    const reperes = positionsLeLong(pts, pas);
    trace(morceauxAvecTrous(pts, reperes.map((r) => r.s), larg / 2 + taille * 0.5));
    ctx.fillStyle = couleur;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(1.2, epaisseur * 0.9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const inverse = o.sens === 'inverse';
    for (const r of reperes) {
      ctx.save();
      ctx.translate(r.x, r.y);
      // Texte lisible : jamais à l'envers.
      const a = r.angle > Math.PI / 2 || r.angle < -Math.PI / 2 ? r.angle + Math.PI : r.angle;
      ctx.rotate(m.type === 'texte' ? a : r.angle);
      if (m.type === 'texte') {
        if (m.eclair) {
          const u = taille / 12; // l'éclair tient dans un carré de 12 u
          const x0 = -larg / 2;
          ctx.beginPath();
          ctx.moveTo(x0 + 6 * u, -6 * u);
          ctx.lineTo(x0 + 1.5 * u, 1 * u);
          ctx.lineTo(x0 + 5 * u, 1 * u);
          ctx.lineTo(x0 + 3 * u, 7 * u);
          ctx.lineTo(x0 + 9 * u, -1 * u);
          ctx.lineTo(x0 + 5.5 * u, -1 * u);
          ctx.closePath();
          ctx.fill();
          ctx.fillText(m.texte, taille * 0.5, taille * 0.04);
        } else ctx.fillText(m.texte, 0, taille * 0.04);
      } else {
        // Chevron : « > » dans le sens de la ligne (retournable) ; flèche double « < > » : un dans chaque sens.
        const demi = taille / 2;
        const chevron = (dx, sens) => {
          ctx.beginPath();
          ctx.moveTo(dx - demi * 0.55 * sens, -demi);
          ctx.lineTo(dx + demi * 0.55 * sens, 0);
          ctx.lineTo(dx - demi * 0.55 * sens, demi);
          ctx.stroke();
        };
        if (m.type === 'chevron') chevron(0, inverse ? -1 : 1);
        else {
          chevron(-demi * 0.7, -1);
          chevron(demi * 0.7, 1);
        }
      }
      ctx.restore();
    }
  }

  function dessinerChoix(ctx, o) {
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
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
