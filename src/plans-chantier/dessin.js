// Plans de chantier (0.289.0) : dessin des éléments sur un canvas, le même pour l'écran, l'aperçu de la feuille et le
// PDF (la feuille est dessinée comme l'écran, à l'échelle choisie). Zones, lignes à motifs, pistes, flèches, textes,
// symboles (blocs modernisés : matériaux, lustre, ombres), grues (flèche, châssis, rayon d'action) et base-vie à étage.
//
// d (contexte de dessin) : { ctx, vue (voir plan/vue.js), pc (plan de chantier), bib (bibliothèque de symboles),
//   mm : pixels pour 1 mm de papier }. Le ctx est déjà réglé en pixels CSS (densité comprise).
import { versEcran } from '../plan/vue.js';
import {
  couleurObjet, styleLigne, pointeDeFleche, positionsLeLong, morceauxAvecTrous, contourZoneMm, opaciteZone,
  geometrieCotation, lignesDuTexte, dimensionsFleche, centreZone, texteSurface, texteSymbolesM, anneauxDuTas, TAS_HAUTEUR, TAS_TALUS,
  hachureZone, hachureDeLaZone, tiretsContour,
} from '../topo/plan-chantier.js';
import { textureMateriau } from './textures.js';
import { grueDeLObjet, symboleDeLObjetPose } from '../topo/grue-mobile.js';
import { nuance, primitivesEtage, chassisLibre, boiteSymbole, echelleDeLObjet } from '../topo/symboles.js';

const ecranDe = (d) => ([e, n]) => versEcran(e, n, d.vue);

// 0.299.0 : hachures des zones, gardées tant que la zone et ses réglages ne changent pas (le plan se redessine souvent).
const memoHachures = new WeakMap();
function hachuresMemo(pc, o) {
  const r = hachureDeLaZone(pc, o);
  if (!r) return null;
  const cle = JSON.stringify([o.points, r]);
  const m = memoHachures.get(o);
  if (m?.cle === cle) return m.h;
  const h = hachureZone(o.points, r);
  memoHachures.set(o, { cle, h });
  return h;
}

/** Dessine les hachures d'une zone (traits ou points), de la couleur choisie (sinon celle de la zone). */
function dessinerHachures(d, o, couleur) {
  const h = hachuresMemo(d.pc, o);
  if (!h) return;
  const { ctx } = d;
  const ecran = ecranDe(d);
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = o.hachure.couleur || couleur;
  ctx.fillStyle = o.hachure.couleur || couleur;
  ctx.lineWidth = Math.max(0.6, 0.18 * d.mm);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of h.segments) {
    const a = ecran([x1, y1]);
    const b = ecran([x2, y2]);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  if (h.points.length) {
    const r = Math.max(0.8, 0.25 * d.mm);
    ctx.beginPath();
    for (const p of h.points) {
      const q = ecran(p);
      ctx.moveTo(q.x + r, q.y);
      ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
  ctx.restore();
}

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

/**
 * Plaque à plusieurs lignes (0.295.1) : styles[i] = { g (gras), s (souligné) } pour la ligne i. Renvoie { w, h } (px).
 */
export function plaqueMulti(ctx, lignes, x, y, h, couleurTexte, styles = []) {
  const interligne = h * 1.25;
  const police = (i) => `${styles[i]?.g ? 800 : 500} ${h}px system-ui, sans-serif`;
  let largeur = 0;
  lignes.forEach((l, i) => {
    ctx.font = police(i);
    largeur = Math.max(largeur, ctx.measureText(l).width);
  });
  const w = largeur + h * 0.7;
  const H = lignes.length * interligne + h * 0.4;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(43,52,64,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - H / 2, w, H, h * 0.35);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = couleurTexte;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lignes.forEach((l, i) => {
    const yy = y - H / 2 + h * 0.2 + interligne * (i + 0.5);
    ctx.font = police(i);
    ctx.fillText(l, x, yy);
    if (styles[i]?.s) {
      const lw = ctx.measureText(l).width;
      ctx.strokeStyle = couleurTexte;
      ctx.lineWidth = Math.max(1, h * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - lw / 2, yy + h * 0.48);
      ctx.lineTo(x + lw / 2, yy + h * 0.48);
      ctx.stroke();
    }
  });
  return { w, h: H };
}

/** Plaque blanche arrondie avec un texte centré en (x, y) (texte de plan, surface d'une zone). */
export function plaque(ctx, texte, x, y, h, poids = 600, couleurTexte = '#1b2b36') {
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
  ctx.fillStyle = couleurTexte;
  ctx.fillText(texte, x, y + h * 0.04);
  return { w, h: h * 1.36 };
}

/**
 * Tas de stock (0.292.0) : le contour décalé vers l'intérieur de largeur = hauteur × talus (6 anneaux, de plus en plus
 * clairs vers le sommet), un éclairage du nord-ouest (clair en haut à gauche, sombre en bas à droite) et des hachures de
 * talus (traits du pied vers le sommet, un long, un court).
 */
function dessinerTas(d, o, couleur) {
  const { ctx, vue } = d;
  const { anneaux, largeur, sens } = anneauxDuTas(o.points, o.tasH, o.tasTalus ?? TAS_TALUS);
  const ecran = ecranDe(d);
  ctx.save();
  chemin(d, o.points, true);
  ctx.clip();
  // 0.296.2 : chaque anneau est un voile clair transparent (la texture et la couleur du matériau restent visibles) et
  // il n'y a plus de contours d'anneaux (les « courbes de niveau » sont supprimées) : seules les hachures de talus restent.
  anneaux.forEach((a, i) => {
    chemin(d, a, true);
    ctx.fillStyle = `rgba(255,255,255,${(0.03 + 0.1 * ((i + 1) / anneaux.length)).toFixed(3)})`;
    ctx.fill();
  });
  // Éclairage : voile clair en haut à gauche, sombre en bas à droite.
  const xs = o.points.map((p) => ecran(p).x);
  const ys = o.points.map((p) => ecran(p).y);
  const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(15,23,42,0.34)');
  chemin(d, o.points, true);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // Hachures de talus (0.297.1) : la ligne de crête est le dernier anneau (contour décalé avec ses coins droits, donc sans
  // croisement) ; les barbules partent de la crête vers le pied, une longue, une courte, sans s'approcher des coins.
  ctx.strokeStyle = nuance(couleur, -0.45);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  const crete = anneaux.at(-1);
  if (crete?.length >= 3) {
    const pas = Math.max(1.2, 6 / vue.echelle);
    let k = 0;
    crete.forEach(([x1, y1], i) => {
      const [x2, y2] = crete[(i + 1) % crete.length];
      const c1 = ecran([x1, y1]);
      const c2 = ecran([x2, y2]);
      if (i === 0) ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      const l = Math.hypot(x2 - x1, y2 - y1);
      if (l < 1e-6) return;
      const [ux, uy] = [(x2 - x1) / l, (y2 - y1) / l];
      const [nx, ny] = [-uy * sens, ux * sens]; // vers l'intérieur : les barbules vont à l'opposé
      const marge = 0.6 * largeur;
      for (let t = marge; t < l - marge; t += pas) {
        const long = (k++ % 2 === 0 ? 0.55 : 0.3) * largeur;
        const a = ecran([x1 + ux * t, y1 + uy * t]);
        const b = ecran([x1 + ux * t - nx * long, y1 + uy * t - ny * long]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.moveTo(c2.x, c2.y);
    });
  }
  ctx.stroke();
}

/** Dessine un élément du plan de chantier. */
/**
 * Dessine des objets dans l'ordre. Ceux qui ont un rendu de phase (estompé, assombri, couleur unique : `o.rendu`) sont
 * dessinés d'abord, par groupes de même rendu, sur une toile à part posée ensuite avec la transparence ou le gris voulu :
 * l'effet vaut pour tout le groupe (pas de double teinte aux croisements).
 */
export function dessinerObjets(d, objets) {
  const groupes = new Map();
  const normaux = [];
  for (const o of objets) {
    if (!o.rendu) normaux.push(o);
    else {
      const cle = `${o.rendu.mode}|${o.rendu.opacite}|${o.rendu.couleur}`;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(o);
    }
  }
  for (const liste of groupes.values()) {
    const { mode, opacite } = liste[0].rendu;
    const toile = document.createElement('canvas');
    toile.width = d.ctx.canvas.width;
    toile.height = d.ctx.canvas.height;
    const tctx = toile.getContext('2d');
    tctx.setTransform(d.ctx.getTransform());
    for (const o of liste) dessinerObjet({ ...d, ctx: tctx }, o);
    d.ctx.save();
    d.ctx.setTransform(1, 0, 0, 1, 0, 0);
    d.ctx.globalAlpha = mode === 'estompe' ? opacite : mode === 'assombri' ? 0.8 : 1;
    if (mode === 'assombri') d.ctx.filter = 'grayscale(1) brightness(0.7)';
    d.ctx.drawImage(toile, 0, 0);
    d.ctx.restore();
    toile.width = 0;
  }
  for (const o of normaux) dessinerObjet(d, o);
}

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
    ctx.globalAlpha = o.tasH > 0 ? Math.max(0.7, opaciteZone(o)) : opaciteZone(o);
    ctx.fillStyle = couleur;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 0.294.1 : texture du matériau (grains, cailloux, blocs…) par-dessus la couleur du stock
    const motif = o.materiau ? textureMateriau(ctx, o.materiau) : null;
    if (motif) {
      ctx.save();
      chemin(d, o.points, true);
      ctx.clip();
      ctx.fillStyle = motif;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, 0, vue.largeur, vue.hauteur);
      ctx.restore();
    }
    if (o.tasH > 0) dessinerTas(d, o, couleur);
    dessinerHachures(d, o, couleur); // 0.299.0 : hachures en plus du remplissage
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(0.8, contourZoneMm(o) * mm);
    // 0.299.0 : type de trait du contour (tirets en mm de papier)
    const tirets = tiretsContour(o);
    if (tirets.length) {
      ctx.setLineDash(tirets.map((t) => Math.max(1, t * mm)));
      if (o.traitContour === 'points') ctx.lineCap = 'round';
    }
    chemin(d, o.points, true);
    ctx.stroke();
    ctx.setLineDash([]);
    // Étiquette au centre : surface et / ou hauteur du tas.
    const parties = [];
    if (o.etiquette) parties.push(o.etiquette); // 0.293.0 : texte libre de la zone ou du tas
    if (o.afficherSurface) parties.push(texteSurface(o.points));
    if (o.tasH > 0 && o.afficherHauteur) parties.push(`H ${Number(o.tasH).toFixed(1)} m`);
    if (parties.length) {
      const c = ecran(centreZone(o.points));
      plaque(ctx, parties.join(' · '), c.x, c.y, Math.min(22, Math.max(10, 3 * mm)));
    }
  } else if (o.type === 'ligne') {
    dessinerLigne(ctx, o.points.map((p) => { const q = ecran(p); return [q.x, q.y]; }), styleLigne(o.style), couleur, mm, o, e);
  } else if (o.type === 'construction') {
    // Ligne de construction (0.293.0, jamais imprimée) : trait cyan en tirets, droite infinie prolongée hors de l'écran.
    const a = ecran(o.points[0]);
    const b = ecran(o.points[1]);
    let [x1, y1, x2, y2] = [a.x, a.y, b.x, b.y];
    if (o.infinie) {
      const l = Math.hypot(x2 - x1, y2 - y1) || 1;
      const [ux, uy] = [(x2 - x1) / l, (y2 - y1) / l];
      const L = (vue.largeur + vue.hauteur) * 3;
      [x1, y1, x2, y2] = [x1 - ux * L, y1 - uy * L, x2 + ux * L, y2 + uy * L];
    }
    ctx.strokeStyle = o.coupe ? '#dc2626' : couleur; // 0.312.0 : ligne de coupe (vue de côté) en rouge, trait-point, avec A et B
    ctx.lineWidth = o.coupe ? 2 : 1;
    ctx.setLineDash(o.coupe ? [14, 4, 2, 4] : ({ continu: [], points: [1.5, 5], mixte: [14, 4, 2, 4] }[o.trait] ?? [9, 5]));
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = o.coupe ? '#dc2626' : couleur;
    if (o.coupe) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', a.x - 11, a.y - 8);
      ctx.fillText('B', b.x + 11, b.y - 8);
      ctx.textAlign = 'start';
    }
    for (const q of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(q.x - 4, q.y);
      ctx.lineTo(q.x + 4, q.y);
      ctx.moveTo(q.x, q.y - 4);
      ctx.lineTo(q.x, q.y + 4);
      ctx.stroke();
    }
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
  } else if (o.type === 'cotation') {
    const g = geometrieCotation(o);
    if (!g) return;
    ctx.strokeStyle = couleur;
    ctx.fillStyle = couleur;
    ctx.lineWidth = Math.max(0.8, 0.25 * mm);
    ctx.beginPath();
    for (const [a, b] of g.lignes) {
      const A = ecran(a);
      const B = ecran(b);
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
    }
    if (g.arc) g.arc.forEach((pt, i) => { const q = ecran(pt); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.stroke();
    // Flèches aux deux bouts de la ligne de cote (3 mm sur le papier).
    const L = Math.max(5, 2.6 * mm);
    const h = Math.max(9, (pc ? texteSymbolesM(pc) : 1) * e);
    // 0.317.0 : cote COURTE (la valeur ne tient pas entre les flèches) : flèches à l'extérieur, qui pointent vers les
    // traits de rappel, et valeur écrite au-delà du bout (comme dans AutoCAD) au lieu de tout recouvrir.
    let courte = false;
    let ux = 1;
    let uy = 0;
    let lc = 0;
    if (g.lignes.length === 3 && g.fleches.length === 2) {
      ctx.font = `600 ${h}px system-ui, sans-serif`;
      const largeurTexte = ctx.measureText(g.texte.t).width + h * 0.7;
      const P1 = ecran(g.fleches[0].p);
      const P2 = ecran(g.fleches[1].p);
      lc = Math.hypot(P2.x - P1.x, P2.y - P1.y);
      courte = lc > 1e-6 && largeurTexte + 2 * L + 6 > lc;
      if (courte) {
        ux = (P2.x - P1.x) / lc;
        uy = (P2.y - P1.y) / lc;
      }
    }
    for (const f of g.fleches) {
      const q = ecran(f.p);
      let a = Math.atan2(-f.dir[1], f.dir[0]);
      if (courte) {
        a += Math.PI; // le corps de la flèche est dehors, la pointe touche le trait de rappel
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x + 2.2 * L * Math.cos(a), q.y + 2.2 * L * Math.sin(a)); // petit trait qui porte la flèche
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x + L * Math.cos(a - 0.22), q.y + L * Math.sin(a - 0.22));
      ctx.lineTo(q.x + L * Math.cos(a + 0.22), q.y + L * Math.sin(a + 0.22));
      ctx.closePath();
      ctx.fill();
    }
    // Valeur sur une plaque blanche, de la même taille que le texte des symboles, le long de la ligne de cote.
    let t = ecran(g.texte.p);
    if (courte) {
      ctx.font = `600 ${h}px system-ui, sans-serif`;
      const demi = (ctx.measureText(g.texte.t).width + h * 0.7) / 2;
      const bout = ecran(g.fleches[1].p);
      const recul = 2.2 * L + demi + 4;
      t = { x: bout.x + ux * recul, y: bout.y + uy * recul };
    }
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((-g.texte.angle * Math.PI) / 180);
    plaque(ctx, g.texte.t, 0, 0, h);
    ctx.restore();
  } else if (o.type === 'texte') {
    const q = ecran(o.point);
    const h = Math.max(9, (o.taille ?? 1) * e);
    const lignesTxt = lignesDuTexte(o.texte);
    const { w, h: hauteur } = (lignesTxt.length > 1 || o.styles?.some((x) => x?.g || x?.s)) ? plaqueMulti(ctx, lignesTxt, q.x, q.y, h, couleur, o.styles ?? []) : plaque(ctx, o.texte, q.x, q.y, h, 600, couleur);
    if (o.repere) dessinerRepere(d, o, q, w, hauteur);
  }
}

/** Ligne de repère d'un texte : du bord de la plaque au point visé, avec une flèche ou un point au bout. */
function dessinerRepere(d, o, q, w, h) {
  const { ctx } = d;
  const couleur = couleurObjet(d.pc ?? { couleurs: 'objets', phases: [] }, o);
  const t = ecranDe(d)(o.repere);
  const dx = t.x - q.x;
  const dy = t.y - q.y;
  const k = Math.min((w / 2) / (Math.abs(dx) || 1e-9), (h / 2) / (Math.abs(dy) || 1e-9));
  if (k >= 1) return; // le point visé est sous la plaque
  const dep = { x: q.x + dx * k, y: q.y + dy * k };
  ctx.strokeStyle = couleur;
  ctx.fillStyle = couleur;
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
export function dessinerLigne(ctx, pts, style, couleur, pxMm, o = {}, pxM = null) {
  const m = style.motif;
  const ech = o.echelleMotif ?? 1;
  const epaisseur = Math.max(0.8, (o.epaisseurMm ?? style.epaisseurMm) * pxMm);
  if (m?.largeurM) return dessinerBande(ctx, pts, m, couleur, epaisseur, ech, pxM ?? pxMm * 5, o);
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

/**
 * Lignes « en bande » (0.292.0) : largeur réelle en m (largeurM × échelle du motif), qui suit l'échelle du plan :
 * glissière béton GBA (éléments de 4 m), échafaudage (travées de 2,5 m avec croisillons), filet de protection (bande
 * hachurée), barrière Heras (panneaux de 3,5 m sur pieds). pxM = pixels pour 1 m sur le terrain.
 */
function dessinerBande(ctx, pts, m, couleur, epaisseur, ech, pxM, o) {
  const w = Math.max(3, (o?.largeurM ?? m.largeurM) * pxM * ech); // 0.294.1 : largeur réglable par élément
  const tube = (largeur, style) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = style;
    ctx.lineWidth = largeur;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineCap = 'round';
  };
  const reperes = positionsLeLong(pts, Math.max(4, m.elementM * pxM * ech), 0);
  const trans = (r, demi, k = 1) => {
    const [nx, ny] = [-Math.sin(r.angle), Math.cos(r.angle)];
    ctx.moveTo(r.x - nx * demi * k, r.y - ny * demi * k);
    ctx.lineTo(r.x + nx * demi * k, r.y + ny * demi * k);
  };
  ctx.setLineDash([]);
  if (m.type === 'gba') {
    tube(w + 1.6, '#334155');
    tube(w, '#c4cad0');
    tube(Math.max(1, w * 0.3), '#9aa3ab');
    ctx.beginPath();
    for (const r of reperes) trans(r, w / 2);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(0.8, w * 0.07);
    ctx.stroke();
  } else if (m.type === 'echafaudage') {
    tube(w + 1.6, '#475569');
    tube(w, 'rgba(226,232,240,0.85)');
    ctx.beginPath();
    for (let i = 0; i < reperes.length; i++) {
      const r = reperes[i];
      trans(r, w / 2);
      const s = reperes[i + 1];
      if (s) {
        const [n1x, n1y] = [-Math.sin(r.angle), Math.cos(r.angle)];
        const [n2x, n2y] = [-Math.sin(s.angle), Math.cos(s.angle)];
        ctx.moveTo(r.x + (n1x * w) / 2, r.y + (n1y * w) / 2);
        ctx.lineTo(s.x - (n2x * w) / 2, s.y - (n2y * w) / 2);
        ctx.moveTo(r.x - (n1x * w) / 2, r.y - (n1y * w) / 2);
        ctx.lineTo(s.x + (n2x * w) / 2, s.y + (n2y * w) / 2);
      }
    }
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.7, w * 0.06);
    ctx.stroke();
  } else if (m.type === 'filet') {
    tube(w, 'rgba(47,158,85,0.28)');
    tube(Math.max(1, epaisseur), couleur);
    ctx.beginPath();
    for (const r of positionsLeLong(pts, Math.max(3, 0.4 * pxM * ech), 0)) {
      const [nx, ny] = [-Math.sin(r.angle), Math.cos(r.angle)];
      const [ux, uy] = [Math.cos(r.angle), Math.sin(r.angle)];
      ctx.moveTo(r.x - nx * (w / 2) - ux * (w / 4), r.y - ny * (w / 2) - uy * (w / 4));
      ctx.lineTo(r.x + nx * (w / 2) + ux * (w / 4), r.y + ny * (w / 2) + uy * (w / 4));
    }
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(0.6, epaisseur * 0.5);
    ctx.stroke();
  } else if (m.type === 'cloture') {
    // Clôture « comme le portail » : bande orange à croisillons (tous les 0,5 m), poteaux sombres tous les 3,5 m.
    tube(w + 1.4, '#7a4b00');
    tube(w, '#f2a20c');
    ctx.beginPath();
    for (const r of positionsLeLong(pts, Math.max(3, 0.5 * pxM * ech), 0)) {
      const [ux, uy] = [Math.cos(r.angle), Math.sin(r.angle)];
      const [nx, ny] = [-uy, ux];
      const h = w * 0.42;
      const l = Math.max(1.5, 0.25 * pxM * ech);
      ctx.moveTo(r.x - ux * l - nx * h, r.y - uy * l - ny * h);
      ctx.lineTo(r.x + ux * l + nx * h, r.y + uy * l + ny * h);
      ctx.moveTo(r.x - ux * l + nx * h, r.y - uy * l + ny * h);
      ctx.lineTo(r.x + ux * l - nx * h, r.y + uy * l - ny * h);
    }
    ctx.strokeStyle = '#7a4b00';
    ctx.lineWidth = Math.max(0.5, w * 0.12);
    ctx.stroke();
    // Plots en béton de chaque panneau, en travers de la clôture (comme la barrière Heras).
    for (const r of reperes) {
      const lg = Math.max(7, 0.9 * pxM * ech);
      const ep = Math.max(2.5, 0.22 * pxM * ech);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.fillStyle = '#c3c9cf';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = Math.max(0.6, ep * 0.12);
      ctx.beginPath();
      ctx.roundRect(-ep / 2, -lg / 2, ep, lg, ep * 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const r of reperes) {
      const t = Math.max(3.5, 0.3 * pxM * ech);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(-t / 2, -t / 2, t, t);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.8, t * 0.18), 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  } else if (m.type === 'lattes') {
    // 2 lattes rouges et blanches côte à côte (bandes de 0,5 m en alternance), sur des pieds.
    const dec = w * 0.27;
    const lat = (d, sens) => {
      const dp = pts.map((q, i) => {
        const r = pts[Math.min(i + 1, pts.length - 1)];
        const t = pts[Math.max(i - 1, 0)];
        const a = Math.atan2(r[1] - t[1], r[0] - t[0]);
        return [q[0] - Math.sin(a) * d * sens, q[1] + Math.cos(a) * d * sens];
      });
      ctx.beginPath();
      dp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = w * 0.4;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.strokeStyle = '#d63a3a';
      const pas = Math.max(3, 0.5 * pxM * ech);
      ctx.setLineDash([pas, pas]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.lineCap = 'round';
    };
    for (const r of reperes) {
      const [nx, ny] = [-Math.sin(r.angle), Math.cos(r.angle)];
      ctx.beginPath();
      ctx.moveTo(r.x - nx * w * 0.55, r.y - ny * w * 0.55);
      ctx.lineTo(r.x + nx * w * 0.55, r.y + ny * w * 0.55);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1.2, w * 0.12);
      ctx.stroke();
    }
    lat(dec, 1);
    lat(dec, -1);
  } else if (m.type === 'pieton') {
    // Cheminement piéton : bande verte claire, bords pleins, petites flèches dans le sens du tracé.
    tube(w, 'rgba(34,197,94,0.28)');
    for (const sens of [1, -1]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const r = pts[Math.min(i + 1, pts.length - 1)];
        const t = pts[Math.max(i - 1, 0)];
        const an = Math.atan2(r[1] - t[1], r[0] - t[0]);
        const q = [x - Math.sin(an) * (w / 2) * sens, y + Math.cos(an) * (w / 2) * sens];
        if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      });
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(1, epaisseur);
      ctx.stroke();
    }
    // Un piéton qui marche (pictogramme, vu de côté) tous les 2,5 m, tourné dans le sens du tracé.
    for (const r of reperes) {
      const h = Math.max(5, w * 0.62);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.strokeStyle = couleur;
      ctx.fillStyle = couleur;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, h * 0.12);
      // repère : x = sens de marche, y vers le côté ; la tête est à gauche du sens de marche (y négatif à l'écran)
      ctx.beginPath();
      ctx.arc(0, -h * 0.42, h * 0.11, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.28);
      ctx.lineTo(0, h * 0.05); // tronc
      ctx.moveTo(0, -h * 0.22);
      ctx.lineTo(h * 0.2, -h * 0.02); // bras avant
      ctx.moveTo(0, -h * 0.22);
      ctx.lineTo(-h * 0.18, -h * 0.02); // bras arrière
      ctx.moveTo(0, h * 0.05);
      ctx.lineTo(h * 0.2, h * 0.4); // jambe avant
      ctx.moveTo(0, h * 0.05);
      ctx.lineTo(-h * 0.17, h * 0.4); // jambe arrière
      ctx.stroke();
      ctx.restore();
    }
  } else if (m.type === 'heras') {
    // Treillis : trait double fin ; pieds en béton perpendiculaires à chaque joint de panneau ; croisillon par panneau.
    tube(Math.max(2, w * 0.1), '#94a3b8');
    tube(Math.max(1, epaisseur), couleur);
    for (const r of reperes) {
      const [nx, ny] = [-Math.sin(r.angle), Math.cos(r.angle)];
      ctx.beginPath();
      ctx.moveTo(r.x - nx * (w / 2), r.y - ny * (w / 2));
      ctx.lineTo(r.x + nx * (w / 2), r.y + ny * (w / 2));
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.4, w * 0.16);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(1.5, w * 0.1), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  void o;
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
      // 0.292.0 : tous les textes ont la même taille (options.texteU, en unités du symbole) et une plaque blanche.
      if (p.brut) texteBrut(ctx, p, e, options.angle ?? 0);
      else texteDansSymbole(ctx, options.texteU ? { ...p, h: options.texteU } : p, e, options.angle ?? 0);
    }
  }
}

/**
 * Texte d'un symbole (repère du symbole, y vers le haut) : jamais à l'envers (angleSymbole = rotation du symbole posé, °).
 */
/** Texte d'un panneau (0.293.0) : noir, gras, taille propre, sans plaque ; jamais à l'envers. */
function texteBrut(ctx, p, e, angleSymbole) {
  if (p.h * e < 3) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  let a = p.a ?? 0;
  const total = (((a + angleSymbole) % 360) + 360) % 360;
  if (total > 90 && total < 270) a += 180;
  ctx.rotate((a * Math.PI) / 180);
  ctx.scale(1 / e, -1 / e);
  ctx.font = `700 ${(p.h * e).toFixed(2)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.k;
  ctx.fillText(p.t, 0, 0);
  ctx.restore();
}

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
  {
    // 0.292.0 : tout texte de symbole est sur une plaque blanche arrondie, légèrement transparente.
    const h = p.h * e;
    const w = ctx.measureText(p.t).width;
    const x0 = { left: 0, center: -w / 2, right: -w }[ctx.textAlign];
    const y0 = { alphabetic: -0.78 * h, bottom: -h, middle: -h / 2, top: 0 }[ctx.textBaseline];
    const m = h * 0.28;
    ctx.beginPath();
    ctx.roundRect(x0 - m, y0 - m * 0.7, w + 2 * m, h + m * 1.4, h * 0.35);
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,52,64,0.45)';
    ctx.lineWidth = Math.max(0.6, h * 0.06);
    ctx.stroke();
  }
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
  const k = echelleDeLObjet(o); // 0.292.0 : échelle d'un bloc (×1 = taille réelle)
  const e = vue.echelle * k; // pixels par unité du symbole
  const q = versEcran(o.point[0], o.point[1], vue);
  const rot = o.rotation ?? 0;
  const debut = () => {
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate((-(rot - (vue.rotation ?? 0)) * Math.PI) / 180);
    ctx.scale(e, -e);
  };
  const unique = o.rendu?.mode === 'couleur' ? o.rendu.couleur : d.pc?.couleurs === 'phases' ? d.pc.phases.find((p) => p.id === o.phase)?.couleur : null;
  // 0.292.0 : texte de la même taille partout (mm sur le papier × échelle du plan), indépendante de l'échelle du bloc.
  const opts = { angle: rot, couleurUnique: unique ?? undefined, texteU: d.pc ? texteSymbolesM(d.pc) / k : undefined };
  if (o.type === 'grue') {
    const g = grueDeLObjet(bib, o);
    if (!g) return manquant(d, o, q);
    debut();
    const ch = chassisLibre(bib, o.chassis); // 0.290.0 : côté libre, coté
    if (ch) dessinerPrimitives(ctx, ch.primitives, e, d.mm, opts);
    if (o.rayon !== false && g.rayon?.length) dessinerRayon(ctx, g, e, d.mm, rot, opts.texteU, 'cercles');
    dessinerPrimitives(ctx, g.primitives, e, d.mm, { ...opts, ombreForte: true });
    // 0.294.1 : les cotes des cercles sont écrites PAR-DESSUS la grue (elles étaient cachées dessous)
    if (o.rayon !== false && g.rayon?.length) dessinerRayon(ctx, g, e, d.mm, rot, opts.texteU, 'textes');
    ctx.restore();
    return;
  }
  const s = symboleDeLObjetPose(bib, o);
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
      const tot = (((rot % 360) + 360) % 360);
      pictoNiveau(ctx, -1.0 - t * 0.3, y, t, (tot > 90 && tot < 270) ? i !== 0 : i === 0); // le pictogramme reste lisible quand le bloc est retourné
      texteDansSymbole(ctx, { x: -0.55, y, h: opts.texteU ?? t, a: 0, t: texte, ah: 0, av: 2, k: '#0f172a' }, e, rot);
    });
    ctx.restore();
    return;
  }
  if (!s) return manquant(d, o, q);
  debut();
  dessinerPrimitives(ctx, s.primitives, e, d.mm, opts);
  // 0.294.1 : texte libre au centre d'un bloc (ex. « Bureaux » sur un conteneur), même taille que les autres textes de symboles
  if (o.etiquette) texteDansSymbole(ctx, { x: 0, y: 0, h: opts.texteU ?? 0.5, a: 0, t: o.etiquette, ah: 1, av: 2, k: '#0f172a' }, e, rot);
  ctx.restore();
}

/** Rayon d'action d'une grue : cercles de sa bibliothèque, en tirets ambre, et un voile très léger. */
function dessinerRayon(ctx, g, e, mm, rot, texteU, partie = 'tout') {
  const lw = Math.max(0.8, 0.25 * mm) / e;
  for (const p of g.rayon) {
    if ((p.g === 't') !== (partie === 'textes') && partie !== 'tout') continue;
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
    } else if (p.g === 't') { if (p.brut) texteBrut(ctx, p, e, rot); else texteDansSymbole(ctx, { ...p, k: p.perso ? p.k : '#92400e', ...(texteU ? { h: texteU } : {}) }, e, rot); }
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
  if (o.type === 'grue') return grueDeLObjet(bib, o);
  return symboleDeLObjetPose(bib, o);
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
