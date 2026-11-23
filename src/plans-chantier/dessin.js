// Plans de chantier (0.289.0) : dessin des éléments sur un canvas, le même pour l'écran, l'aperçu de la feuille et le
// PDF (la feuille est dessinée comme l'écran, à l'échelle choisie). Zones, lignes à motifs, pistes, flèches, textes,
// symboles (blocs modernisés : matériaux, lustre, ombres), grues (flèche, châssis, rayon d'action) et base-vie à étage.
//
// d (contexte de dessin) : { ctx, vue (voir plan/vue.js), pc (plan de chantier), bib (bibliothèque de symboles),
//   mm : pixels pour 1 mm de papier }. Le ctx est déjà réglé en pixels CSS (densité comprise).
import { versEcran } from '../plan/vue.js';
import {
  couleurObjet, styleLigne, pointeDeFleche, positionsLeLong, morceauxAvecTrous, contourZoneMm, opaciteZone,
  dimensionsFleche, centreZone, texteSurface,
} from '../topo/plan-chantier.js';
import { nuance, primitivesEtage, grueLibre, chassisLibre, boiteSymbole } from '../topo/symboles.js';

const ecranDe = (d) => ([e, n]) => versEcran(e, n, d.vue);

function chemin(d, pts, ferme) {
  const ecran = ecranDe(d);
  d.ctx.beginPath();
  pts.forEach((p, i) => {
    const q = ecran(p);
    if (i) d.ctx.lineTo(q.x, q.y);
    else d.ctx.moveTo(q.x, q.y);
  });
  if (ferme) d.ctx.closePath();
}

/** Plaque blanche arrondie avec un texte centré en (x, y) (texte de plan, surface d'une zone). */
export function plaque(ctx, texte, x, y, h, poids = 600) {
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

/** Dessine un élément du plan de chantier. */
export function dessinerObjet(d, o) {
  const { ctx, vue, pc } = d;
  const couleur = couleurObjet(pc, o);
  const e = vue.echelle;
  const mm = d.mm;
  const ecran = ecranDe(d);
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.type === 'symbole' || o.type === 'grue') return dessinerSymbolePose(d, o);
  if (o.type === 'zone') {
    chemin(d, o.points, true);
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
    chemin(d, o.points, false);
    ctx.strokeStyle = couleur;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(3, (o.largeur ?? 4) * e);
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    chemin(d, o.points, false);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([Math.max(3, 1.5 * e), Math.max(3, 1.5 * e)]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (o.type === 'fleche') {
    const pts = o.points;
    if (pts.length < 2) return;
    const dim = dimensionsFleche(o);
    const pointe = Math.max(9 / e, dim.longueurPointe);
    const tete = pointeDeFleche(pts[pts.length - 2], pts[pts.length - 1], pointe, Math.max(dim.largeurPointe, 7 / e));
    const base = [(tete[1][0] + tete[2][0]) / 2, (tete[1][1] + tete[2][1]) / 2];
    chemin(d, [...pts.slice(0, -1), base], false);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(1.5, dim.largeur * e);
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.lineCap = 'round';
    chemin(d, tete, true);
    ctx.fillStyle = couleur;
    ctx.fill();
  } else if (o.type === 'texte') {
    const q = ecran(o.point);
    const h = Math.max(9, (o.taille ?? 1) * e);
    const { w, h: hauteur } = plaque(ctx, o.texte, q.x, q.y, h);
    if (o.repere) dessinerRepere(d, o, q, w, hauteur);
  }
}

/** Ligne de repère d'un texte : du bord de la plaque au point visé, avec une flèche ou un point au bout. */
function dessinerRepere(d, o, q, w, h) {
  const { ctx } = d;
  const t = ecranDe(d)(o.repere);
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
export function dessinerLigne(ctx, pts, style, couleur, pxMm, o = {}) {
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
  const taille = Math.max(6, m.tailleMm * pxMm * ech);
  if (m.type === 'poteau') {
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
    const a = r.angle > Math.PI / 2 || r.angle < -Math.PI / 2 ? r.angle + Math.PI : r.angle;
    ctx.rotate(m.type === 'texte' ? a : r.angle);
    if (m.type === 'texte') {
      if (m.eclair) {
        const u = taille / 12;
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

// ------------------------------------------------------------------ Symboles

/** Chemin d'un remplissage (contours plats) dans le repère courant. */
function cheminContours(ctx, contours) {
  ctx.beginPath();
  for (const c of contours) {
    for (let i = 0; i + 1 < c.length; i += 2) (i ? ctx.lineTo(c[i], c[i + 1]) : ctx.moveTo(c[i], c[i + 1]));
    ctx.closePath();
  }
}

/** Remplissage d'une pièce selon son matériau : lustre (dégradé clair → foncé du haut gauche au bas droit). */
function styleRemplissage(ctx, p) {
  const b = p.b;
  const k = p.k;
  if (!b || ['caoutchouc', 'blanc', 'feu', 'trait'].includes(p.mat)) return k;
  if (p.mat === 'phare') {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(b[2] - b[0], b[3] - b[1]) / 1.4 || 0.1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, k);
    return g;
  }
  const g = ctx.createLinearGradient(b[0], b[3], b[2], b[1]);
  const [clair, fonce] = { vitre: [0.6, -0.12], peinture: [0.3, -0.16], conteneur: [0.22, -0.2], metal: [0.32, -0.22], gravats: [0.15, -0.15] }[p.mat] ?? [0.15, -0.1];
  g.addColorStop(0, nuance(k, clair));
  g.addColorStop(p.mat === 'vitre' ? 0.35 : 0.45, k);
  g.addColorStop(1, nuance(k, fonce));
  return g;
}

/**
 * Dessine des primitives dans le repère du symbole (m, y vers le haut) : ctx déjà transformé (translate, rotate, scale).
 * e = pixels par m ; mm = pixels par mm de papier ; options : { ombre (px), ombreForte, couleurUnique }.
 */
export function dessinerPrimitives(ctx, prims, e, mm, options = {}) {
  const trait = Math.max(0.35, 0.09 * mm) / e; // traits fins (0,09 mm de papier)
  // Ombre douce de toute la pièce, en bas à droite (aplat flou de la silhouette).
  if (options.ombre !== false) {
    const flou = Math.max(1, (options.ombreForte ? 0.45 : 0.25) * e);
    const decal = (options.ombreForte ? 0.45 : 0.22);
    ctx.save();
    ctx.filter = `blur(${Math.min(14, flou).toFixed(1)}px)`;
    ctx.fillStyle = options.ombreForte ? 'rgba(15,23,42,0.42)' : 'rgba(15,23,42,0.26)';
    ctx.translate(decal, -decal);
    ctx.beginPath();
    for (const p of prims) {
      if (p.g === 'h' && !p.m && p.mat !== 'phare') for (const c of p.p) {
        for (let i = 0; i + 1 < c.length; i += 2) (i ? ctx.lineTo(c[i], c[i + 1]) : ctx.moveTo(c[i], c[i + 1]));
        ctx.closePath();
      }
    }
    ctx.fill('nonzero');
    ctx.restore();
  }
  let premier = true;
  for (const p of prims) {
    if (p.g === 'h') {
      cheminContours(ctx, p.p);
      // Ombre entre pièces : la pièce posée sur une autre lui fait une petite ombre (ombrePart).
      if (!premier && !p.m && options.ombre !== false && !['phare', 'feu'].includes(p.mat)) {
        ctx.save();
        ctx.translate(0.05, -0.05);
        ctx.fillStyle = 'rgba(15,23,42,0.16)';
        ctx.fill('evenodd');
        ctx.restore();
      }
      ctx.fillStyle = options.couleurUnique ?? styleRemplissage(ctx, p);
      ctx.globalAlpha = p.m ? 0.4 : 1;
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      premier = false;
    } else if (p.g === 'l') {
      ctx.beginPath();
      for (let i = 0; i + 1 < p.p.length; i += 2) (i ? ctx.lineTo(p.p[i], p.p[i + 1]) : ctx.moveTo(p.p[i], p.p[i + 1]));
      if (p.f) ctx.closePath();
      ctx.strokeStyle = options.couleurUnique ?? p.k;
      ctx.lineWidth = trait;
      ctx.stroke();
    } else if (p.g === 'c') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
      ctx.strokeStyle = options.couleurUnique ?? p.k;
      ctx.lineWidth = trait;
      ctx.stroke();
    } else if (p.g === 't') {
      texteDansSymbole(ctx, p, e, options.angle ?? 0);
    }
  }
}

/**
 * Texte d'un symbole (repère du symbole, y vers le haut) : jamais à l'envers (angleSymbole = rotation du symbole posé, °).
 */
function texteDansSymbole(ctx, p, e, angleSymbole) {
  if (p.h * e < 3) return; // trop petit pour être lu
  ctx.save();
  ctx.translate(p.x, p.y);
  let a = p.a ?? 0;
  const total = (((a + angleSymbole) % 360) + 360) % 360;
  if (total > 90 && total < 270) a += 180;
  ctx.rotate((a * Math.PI) / 180);
  ctx.scale(1 / e, -1 / e); // en pixels : les toutes petites polices se dessinent mal
  ctx.font = `500 ${(p.h * e).toFixed(2)}px system-ui, sans-serif`;
  // Un texte retourné (lisibilité) change de côté : on le centre alors sur son point.
  const retourne = a !== (p.a ?? 0);
  ctx.textAlign = retourne ? 'center' : ['left', 'center', 'right'][p.ah ?? 0];
  ctx.textBaseline = ['alphabetic', 'bottom', 'middle', 'top'][p.av ?? 0];
  ctx.fillStyle = p.k;
  ctx.fillText(p.t, 0, 0);
  ctx.restore();
}

/** Pictogramme de niveau (2 conteneurs empilés, le niveau en foncé) centré en (x, y), taille t (repère y vers le haut). */
function pictoNiveau(ctx, x, y, t, etage) {
  const w = t * 1.3;
  const h = t * 0.42;
  const boite = (yy, fonce) => {
    ctx.fillStyle = fonce ? '#1e293b' : '#ffffff';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = t * 0.08;
    ctx.fillRect(x - w / 2, yy, w, h);
    ctx.strokeRect(x - w / 2, yy, w, h);
  };
  boite(y + t * 0.04, etage);
  boite(y - h - t * 0.04, !etage);
}

/** Dessine un symbole (ou une grue) posé sur le plan. */
export function dessinerSymbolePose(d, o) {
  const { ctx, vue, bib } = d;
  const e = vue.echelle;
  const q = versEcran(o.point[0], o.point[1], vue);
  const rot = o.rotation ?? 0;
  const debut = () => {
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate((-(rot - (vue.rotation ?? 0)) * Math.PI) / 180);
    ctx.scale(e, -e);
  };
  const unique = d.pc?.couleurs === 'phases' ? d.pc.phases.find((p) => p.id === o.phase)?.couleur : null;
  const opts = { angle: rot, couleurUnique: unique ?? undefined };
  if (o.type === 'grue') {
    const g = grueLibre(bib, o.modele ?? 'tour', o.fleche ?? 40);
    if (!g) return manquant(d, o, q);
    debut();
    const ch = chassisLibre(bib, o.chassis); // 0.290.0 : côté libre, coté
    if (ch) dessinerPrimitives(ctx, ch.primitives, e, d.mm, opts);
    if (o.rayon !== false && g.rayon?.length) dessinerRayon(ctx, g, e, d.mm, rot);
    dessinerPrimitives(ctx, g.primitives, e, d.mm, { ...opts, ombreForte: true });
    ctx.restore();
    return;
  }
  const s = bib.find((x) => x.cle === o.cle);
  if (o.etage) {
    const et = primitivesEtage(bib, o.etage.pose ?? 0);
    if (!et) return manquant(d, o, q);
    debut();
    dessinerPrimitives(ctx, et.dessous, e, d.mm, opts);
    dessinerPrimitives(ctx, et.rez, e, d.mm, opts);
    dessinerPrimitives(ctx, et.etage, e, d.mm, { ...opts, ombreForte: true });
    // Deux textes modifiables (« 1er » / « Rez » au départ) avec le pictogramme du niveau.
    const textes = o.etage.textes ?? ['1er', 'Rez'];
    const t = 0.55;
    textes.forEach((texte, i) => {
      const y = (i ? -0.55 : 0.55) + 0.12;
      pictoNiveau(ctx, -1.0 - t * 0.3, y, t, i === 0);
      texteDansSymbole(ctx, { x: -0.55, y, h: t, a: 0, t: texte, ah: 0, av: 2, k: '#0f172a' }, e, rot);
    });
    ctx.restore();
    return;
  }
  if (!s) return manquant(d, o, q);
  debut();
  dessinerPrimitives(ctx, s.primitives, e, d.mm, opts);
  ctx.restore();
}

/** Rayon d'action d'une grue : cercles de sa bibliothèque, en tirets ambre, et un voile très léger. */
function dessinerRayon(ctx, g, e, mm, rot) {
  const lw = Math.max(0.8, 0.25 * mm) / e;
  for (const p of g.rayon) {
    if (p.g === 'c') {
      const principal = Math.abs(p.r - g.fleche) < 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
      if (principal) {
        ctx.fillStyle = 'rgba(217,119,6,0.06)';
        ctx.fill();
      }
      ctx.setLineDash(principal ? [8 / e, 5 / e] : [3 / e, 4 / e]);
      ctx.strokeStyle = principal ? 'rgba(180,83,9,0.9)' : 'rgba(100,116,139,0.6)';
      ctx.lineWidth = principal ? lw * 1.4 : lw;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (p.g === 't') texteDansSymbole(ctx, { ...p, k: '#92400e' }, e, rot);
  }
}

/** Symbole introuvable (bibliothèque pas encore chargée, ou bloc retiré) : un carré gris barré. */
function manquant(d, o, q) {
  const { ctx } = d;
  const t = Math.max(8, 2 * d.vue.echelle);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(q.x - t / 2, q.y - t / 2, t, t);
  ctx.beginPath();
  ctx.moveTo(q.x - t / 2, q.y - t / 2);
  ctx.lineTo(q.x + t / 2, q.y + t / 2);
  ctx.stroke();
}

/** Symbole de la bibliothèque qui donne la boîte d'un objet posé (la grue : sa flèche ; à étage : le conteneur). */
export function symboleDeLObjet(bib, o) {
  if (o.type === 'grue') return grueLibre(bib, o.modele ?? 'tour', o.fleche ?? 40);
  return bib.find((x) => x.cle === o.cle) ?? null;
}

/** Vignette d'un symbole dans un petit canvas (bibliothèque) : cadré, sans rotation. */
export function dessinerVignette(canvas, symbole, bib = []) {
  const densite = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 72;
  const h = canvas.clientHeight || 56;
  canvas.width = Math.round(w * densite);
  canvas.height = Math.round(h * densite);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(densite, 0, 0, densite, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let prims = symbole.primitives;
  let b = boiteSymbole(symbole);
  if (symbole.etageDemo) {
    const et = primitivesEtage(bib, symbole.poseDemo ?? 0);
    if (et) {
      prims = [...et.dessous, ...et.rez, ...et.etage];
      b = [b[0] - 1.6, b[1] - 1.6, b[2] + 1.6, b[3] + 1.6];
    }
  }
  const e = Math.min((w - 8) / (b[2] - b[0] || 1), (h - 8) / (b[3] - b[1] || 1));
  ctx.save();
  ctx.translate(w / 2 - ((b[0] + b[2]) / 2) * e, h / 2 + ((b[1] + b[3]) / 2) * e);
  ctx.scale(e, -e);
  dessinerPrimitives(ctx, prims, e, Math.max(1, e * 0.2), { ombre: true });
  ctx.restore();
}
