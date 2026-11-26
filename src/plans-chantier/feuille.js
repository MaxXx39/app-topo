// Plans de chantier, étape 4 (0.289.0) : dessin de la feuille (aperçu à l'écran et PDF). Le plan est dessiné comme à
// l'écran (dessin.js), à l'échelle de la feuille : fond swisstopo pâli, plans du projet, surfaces, points, éléments ;
// puis cadre, nord, barre d'échelle, légende et cartouche avec logo. Dans le PDF (jsPDF), l'image de la feuille est
// posée en entier et les textes de la légende et du cartouche sont écrits en vrai texte (nets à l'impression).
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { versEcran } from '../plan/vue.js';
import { dessinerObjets, dessinerLigne, dessinerPrimitives, symboleDeLObjet } from './dessin.js';
import { dessinerFondSwisstopo, attendreTuiles } from './tuiles.js';
import { ganttPhases, datesDePhase, metresParMm, styleLigne, couleurObjet, opaciteZone, bordsDesTriangles, contourZoneMm } from '../topo/plan-chantier.js';
import {
  miseEnPageFeuille, cadreSituation, etendueDuCadre, echelleDeSituation, pagesDeLaFeuille, objetsDeLaPage, elementsLegende, vueDuCadre, barreDeLaFeuille, textesCartouche,
  reglagesFeuille, FORMATS_FEUILLE,
} from '../topo/feuille-chantier.js';
import { boiteSymbole, primitivesEtage } from '../topo/symboles.js';
import { texteWinAnsi } from '../topo/comparaison-pdf.js';
import logoPerrin from '../assets/logo-perrin.jpg?inline';
import logoNatalini from '../assets/logo-natalini.jpg?inline';
import logoRonchi from '../assets/logo-ronchi.jpg?inline';

const DPI_PDF = { a4: 220, a3: 200, a2: 160, a1: 130 };

/** Image d'un logo (adresse ou data:…), chargée une fois. */
const images = new Map();
export function chargerImage(adresse) {
  if (!adresse) return Promise.resolve(null);
  if (!images.has(adresse)) {
    images.set(adresse, new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = adresse;
    }));
  }
  return images.get(adresse);
}
/** Logos livrés (0.327.0 : + Natalini et Ronchi) ; sinon une image choisie (data:…). */
export const LOGOS_LIVRES = { perrin: logoPerrin, natalini: logoNatalini, ronchi: logoRonchi };
export const adresseLogo = (logo) => (logo === 'aucun' ? null : !logo ? logoPerrin : LOGOS_LIVRES[logo] ?? logo);

/**
 * Prépare une page : mise en page, vue du cadre, légende. donnees : { plan, plans, points, surfaces, bib, projet, auteur }.
 * page : élément de pagesDeLaFeuille ; pxParMm : définition.
 */
export function preparerPage(donnees, page, pxParMm) {
  const { plan, bib } = donnees;
  const r = reglagesFeuille(plan);
  const objets = objetsDeLaPage(plan, page);
  const nomSymbole = (cle) => bib.find((s) => s.cle === cle)?.nom ?? String(cle).replace(/^[a-z]+:/, '');
  const legende = r.legende ? elementsLegende(objets, nomSymbole) : [];
  const mise = miseEnPageFeuille(r.format, r.orientation, legende.length);
  const centre = r.centre ?? donnees.centre ?? [2500000, 1118000];
  const vue = vueDuCadre(plan, mise.cadre, pxParMm, centre);
  const format = FORMATS_FEUILLE.find(([c]) => c === r.format)?.[1] ?? 'A3';
  const champs = {
    affaire: donnees.projet?.cartouche?.affaire || donnees.projet?.nom || '',
    projet: donnees.projet?.cartouche?.designation ?? '',
    titre: r.titre || plan.nom,
    phase: page.titre ? `Phase : ${page.titre}${datesDePhase(plan.phases.find((p) => p.id === page.phase)) ? ` (${datesDePhase(plan.phases.find((p) => p.id === page.phase))})` : ''}` : '',
    echelle: plan.echelle ?? 200,
    format: `${format} ${r.orientation}`,
    date: r.date || new Date().toLocaleDateString('fr-CH'),
    indice: r.indice,
    auteur: r.auteur || donnees.auteur || '',
  };
  // 0.296.1 : plans montrés dessous = ceux de la phase de la page (page par phase), sinon le choix général
  const plansPage = page.phase && donnees.plansPar ? donnees.plansPar(page.phase) : donnees.plans;
  return { r, objets, legende, mise, vue, champs, textes: [], plans: plansPage };
}

/**
 * Dessine une page dans ctx (pixels, 1 mm = pxParMm px). avecTextes : écrire aussi les textes (aperçu) ; sinon ils sont
 * seulement rangés dans prep.textes (le PDF les écrit en vrai texte). logo : image chargée ou null.
 */
export function dessinerPage(ctx, donnees, prep, pxParMm, { avecTextes = true, logo = null, quandTuile = null } = {}) {
  const { plan, bib } = donnees;
  const { mise, vue, legende } = prep;
  const s = pxParMm;
  const mm = (v) => v * s;
  prep.textes = [];
  const texte = (t, x, y, taille, { gras = false, couleur = '#1b2b36', align = 'left' } = {}) => {
    prep.textes.push({ texte: t, x, y, taille, gras, couleur, align });
    if (!avecTextes) return;
    ctx.fillStyle = couleur;
    ctx.font = `${gras ? 700 : 400} ${(taille * 0.3528 * s).toFixed(2)}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(t, mm(x), mm(y));
  };
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, mm(mise.page.largeur), mm(mise.page.hauteur));

  // --- Le plan, dans son cadre.
  const c = mise.cadre;
  ctx.save();
  ctx.beginPath();
  ctx.rect(mm(c.x), mm(c.y), mm(c.l), mm(c.h));
  ctx.clip();
  ctx.translate(mm(c.x), mm(c.y));
  dessinerFondSwisstopo(ctx, vue, plan.fond, 1, quandTuile);
  const plansPage = prep.plans ?? donnees.plans;
  if (plansPage.length) {
    const toile = document.createElement('canvas');
    dessinerPlansDxf(toile, plansPage, vue, 1);
    ctx.drawImage(toile, 0, 0);
    toile.width = 0;
  }
  if (plan.fond?.surfaces !== false) {
    ctx.strokeStyle = 'rgba(71,85,105,0.7)';
    ctx.lineWidth = Math.max(1, 0.18 * s);
    ctx.setLineDash([1.2 * s, 0.9 * s]);
    ctx.beginPath();
    for (const su of donnees.surfaces) {
      for (const [a, b] of bordsDesTriangles(su.triangles)) {
        const p = versEcran(a[0], a[1], vue);
        const q = versEcran(b[0], b[1], vue);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (plan.fond?.points !== false) {
    ctx.fillStyle = '#475569';
    const noms = [];
    for (const p of donnees.points) {
      const q = versEcran(p.est, p.nord, vue);
      if (q.x < -5 || q.y < -5 || q.x > vue.largeur + 5 || q.y > vue.hauteur + 5) continue;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.5, 0.5 * s), 0, 2 * Math.PI);
      ctx.fill();
      if (plan.fond.nomsPoints && p.nom) noms.push([q, p.nom]);
    }
    // 0.299.0 : noms des points, 1,8 mm sur le papier
    if (noms.length) {
      ctx.save();
      ctx.font = `${Math.max(6, 1.8 * s)}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.5, 0.5 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      for (const [q, nom] of noms) {
        ctx.strokeText(String(nom), q.x + 0.8 * s, q.y - 0.4 * s);
        ctx.fillText(String(nom), q.x + 0.8 * s, q.y - 0.4 * s);
      }
      ctx.restore();
    }
  }
  const d = { ctx, vue, pc: plan, bib, mm: s };
  dessinerObjets(d, prep.objets);
  ctx.restore();

  // --- Cadre, nord, barre d'échelle.
  ctx.strokeStyle = '#1b2b36';
  ctx.lineWidth = Math.max(1, 0.5 * s);
  ctx.strokeRect(mm(c.x), mm(c.y), mm(c.l), mm(c.h));
  if (prep.r.nord) dessinerNord(ctx, mise.nord, s);
  if (prep.r.situation.actif) dessinerSituation(ctx, d, prep, s, quandTuile, texte);
  if (prep.r.barre) {
    const b = barreDeLaFeuille(plan.echelle ?? 200, mise.barre.max);
    const x = mise.barre.x;
    const y = mise.barre.y;
    const h = 1.6 * mise.k;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(mm(x - 2 * mise.k), mm(y - 6 * mise.k), mm(b.mm + 14 * mise.k), mm(9 * mise.k));
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#1b2b36';
      ctx.fillRect(mm(x + (b.mm / 4) * i), mm(y), mm(b.mm / 4), mm(h));
    }
    ctx.strokeStyle = '#1b2b36';
    ctx.lineWidth = Math.max(1, 0.2 * s);
    ctx.strokeRect(mm(x), mm(y), mm(b.mm), mm(h));
    texte('0', x, y - 2.2 * mise.k, 6 * mise.k, { align: 'center' });
    texte(`${b.metres} m`, x + b.mm, y - 2.2 * mise.k, 6 * mise.k, { align: 'center' });
  }

  // --- Planning des phases (diagramme de Gantt) à gauche du cartouche.
  if (prep.r.planning && mise.planning.l > 40 * mise.k) {
    const g = ganttPhases(plan.phases);
    if (g) {
      const B = mise.planning;
      boite(ctx, B, s);
      texte('Planning', B.x + 3 * mise.k, B.y + 4.5 * mise.k, 7 * mise.k, { gras: true });
      const n = g.lignes.length;
      const ligne = Math.min(6 * mise.k, (B.h - 9 * mise.k) / n);
      const xm = B.x + 28 * mise.k;
      const lg = B.l - 32 * mise.k;
      g.lignes.forEach((l, i) => {
        const y = B.y + 8 * mise.k + i * ligne;
        texte(l.nom, B.x + 3 * mise.k, y + ligne / 2, Math.min(6 * mise.k, ligne * 2.2), {});
        ctx.fillStyle = l.couleur;
        ctx.fillRect(mm(xm + l.x0 * lg), mm(y + ligne * 0.18), mm(Math.max(1, (l.x1 - l.x0) * lg)), mm(ligne * 0.64));
      });
      texte(`${datesDePhase({ debut: g.lignes[0].debut })} → ${new Date(g.fin).toLocaleDateString('fr-CH')}`, B.x + B.l - 3 * mise.k, B.y + 4.5 * mise.k, 5.5 * mise.k, { align: 'right' });
    }
  }

  // --- Légende.
  if (legende.length) {
    const L = mise.legende;
    boite(ctx, L, s);
    texte('Légende', L.x + 3 * mise.k, L.y + 4.5 * mise.k, 8 * mise.k, { gras: true });
    const larg = L.l / L.colonnes;
    const parColonne = Math.ceil(legende.length / L.colonnes);
    legende.forEach((el, i) => {
      const col = Math.floor(i / parColonne);
      const lig = i % parColonne;
      const x = L.x + col * larg + 3 * mise.k;
      const y = L.y + 9 * mise.k + (lig + 0.5) * L.ligne;
      dessinerEchantillon(ctx, d, el, { x: mm(x), y: mm(y), l: mm(14 * mise.k), h: mm(L.ligne * 0.75) });
      texte(el.nom, x + 17 * mise.k, y, 6.5 * mise.k);
    });
  }

  // --- Cartouche : logo à gauche, textes à droite.
  const K = mise.cartouche;
  boite(ctx, K, s);
  ctx.strokeStyle = '#1b2b36';
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.beginPath();
  ctx.moveTo(mm(K.x + K.l * 0.4), mm(K.y));
  ctx.lineTo(mm(K.x + K.l * 0.4), mm(K.y + K.h));
  ctx.stroke();
  if (logo) {
    const lx = K.l * 0.4 - 6 * mise.k;
    const ly = K.h - 6 * mise.k;
    const r = Math.min(lx / logo.width, ly / logo.height);
    const w = logo.width * r;
    const h = logo.height * r;
    ctx.drawImage(logo, mm(K.x + (K.l * 0.4 - w) / 2), mm(K.y + (K.h - h) / 2), mm(w), mm(h));
  }
  for (const t of textesCartouche(K, mise.k, prep.champs)) texte(t.texte, t.x, t.y, t.taille, { gras: t.gras, couleur: t.couleur });
  ctx.restore();
  return prep;
}

/** Vue de situation : carte nationale autour du plan, rectangle rouge = zone du plan, nord, échelle. */
function dessinerSituation(ctx, d, prep, s, quandTuile, texte) {
  const { mise, vue, r } = prep;
  const sit = r.situation;
  const B = cadreSituation(mise, sit);
  const mm = (v) => v * s;
  const centre = [vue.estCentre, vue.nordCentre];
  const echSit = echelleDeSituation(plan, mise, sit);
  const vueS = { echelle: (s * 1000) / echSit, estCentre: centre[0], nordCentre: centre[1], largeur: B.l * s, hauteur: B.h * s, rotation: 0 };
  prep.vueSituation = vueS;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mm(B.x), mm(B.y), mm(B.l), mm(B.h));
  ctx.beginPath();
  ctx.rect(mm(B.x), mm(B.y), mm(B.l), mm(B.h));
  ctx.clip();
  ctx.translate(mm(B.x), mm(B.y));
  dessinerFondSwisstopo(ctx, vueS, { carte: true }, 1, quandTuile);
  const e = etendueDuCadre(d.pc, mise.cadre, centre);
  const a = versEcran(e.estMin, e.nordMax, vueS);
  const b = versEcran(e.estMax, e.nordMin, vueS);
  ctx.fillStyle = 'rgba(220,38,38,0.15)';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = Math.max(1, 0.5 * s);
  // Rectangle rouge : jamais plus petit que 5 mm sur le papier (0.295.1), centré sur la zone du plan.
  const mini = 5 * mise.k * s;
  const [rl, rh] = [Math.max(b.x - a.x, mini), Math.max(b.y - a.y, mini)];
  const [rx, ry] = [(a.x + b.x) / 2 - rl / 2, (a.y + b.y) / 2 - rh / 2];
  ctx.fillRect(rx, ry, rl, rh);
  ctx.strokeRect(rx, ry, rl, rh);
  ctx.restore();
  ctx.strokeStyle = '#1b2b36';
  ctx.lineWidth = Math.max(1, 0.5 * s);
  ctx.strokeRect(mm(B.x), mm(B.y), mm(B.l), mm(B.h));
  // Titre et nord, sur une bande blanche en bas du cadre.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(mm(B.x), mm(B.y + B.h - 6 * mise.k), mm(B.l), mm(6 * mise.k));
  texte(`Situation 1:${echSit}`, B.x + 2 * mise.k, B.y + B.h - 3 * mise.k, 6 * mise.k, { gras: true });
  dessinerNord(ctx, { x: B.x + B.l - 5 * mise.k, y: B.y + 6 * mise.k, t: 6 * mise.k }, s);
}

/** Cadre blanc à liseré (légende, cartouche). */
function boite(ctx, b, s) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(b.x * s, b.y * s, b.l * s, b.h * s);
  ctx.strokeStyle = '#1b2b36';
  ctx.lineWidth = Math.max(1, 0.35 * s);
  ctx.strokeRect(b.x * s, b.y * s, b.l * s, b.h * s);
}

/** Flèche du nord (le plan est toujours nord en haut). */
function dessinerNord(ctx, n, s) {
  const x = n.x * s;
  const y = n.y * s;
  const t = n.t * s;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, t * 0.75, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#1b2b36';
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - t * 0.6);
  ctx.lineTo(x + t * 0.22, y + t * 0.35);
  ctx.lineTo(x, y + t * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#1b2b36';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - t * 0.6);
  ctx.lineTo(x - t * 0.22, y + t * 0.35);
  ctx.lineTo(x, y + t * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b2b36';
  ctx.font = `700 ${(t * 0.34).toFixed(1)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', x, y - t * 0.95);
}

/** Petit dessin d'un genre dans la légende, dans la boîte b (px). */
function dessinerEchantillon(ctx, d, el, b) {
  const o = el.exemple;
  const couleur = couleurObjet(d.pc, o);
  ctx.save();
  if (el.type === 'zone') {
    ctx.globalAlpha = opaciteZone(o);
    ctx.fillStyle = couleur;
    ctx.fillRect(b.x, b.y - b.h / 2, b.l, b.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(1, contourZoneMm(o) * d.mm);
    ctx.strokeRect(b.x, b.y - b.h / 2, b.l, b.h);
  } else if (el.type === 'ligne') {
    // Motif un peu réduit pour tenir dans la case.
    dessinerLigne(ctx, [[b.x, b.y], [b.x + b.l, b.y]], { ...styleLigne(o.style), motif: styleLigne(o.style).motif && { ...styleLigne(o.style).motif, pasMm: (b.l / d.mm) * 0.9 } }, couleur, d.mm, { ...o, echelleMotif: 0.8 });
  } else if (el.type === 'piste') {
    ctx.fillStyle = couleur;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(b.x, b.y - b.h / 2, b.l, b.h);
    ctx.globalAlpha = 1;
  } else if (el.type === 'fleche') {
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - b.h * 0.12);
    ctx.lineTo(b.x + b.l * 0.65, b.y - b.h * 0.12);
    ctx.lineTo(b.x + b.l * 0.65, b.y - b.h * 0.45);
    ctx.lineTo(b.x + b.l, b.y);
    ctx.lineTo(b.x + b.l * 0.65, b.y + b.h * 0.45);
    ctx.lineTo(b.x + b.l * 0.65, b.y + b.h * 0.12);
    ctx.lineTo(b.x, b.y + b.h * 0.12);
    ctx.closePath();
    ctx.fill();
  } else if (el.type === 'grue') {
    // Grue : son rayon d'action en tirets et la tour au centre.
    const r = b.h * 0.55;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = Math.max(1, 0.25 * d.mm);
    ctx.setLineDash([2, 1.5].map((v) => v * Math.max(1, d.mm * 0.5)));
    ctx.beginPath();
    ctx.arc(b.x + b.l / 2, b.y, r, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e8b33c';
    ctx.fillRect(b.x + b.l / 2 - r * 0.15, b.y - r * 0.9, r * 0.3, r * 1.8);
    ctx.fillStyle = '#5f666d';
    ctx.fillRect(b.x + b.l / 2 - r * 0.25, b.y - r * 0.25, r * 0.5, r * 0.5);
  } else {
    // Symbole, réduit pour tenir dans la case.
    const s = symboleDeLObjet(d.bib, o);
    if (s) {
      let prims = s.primitives;
      let bx = boiteSymbole(s);
      if (o.etage) {
        const et = primitivesEtage(d.bib, o.etage.pose ?? 0);
        if (et) prims = [...et.dessous, ...et.rez, ...et.etage];
        bx = [bx[0] - 1, bx[1] - 1, bx[2] + 1, bx[3] + 1];
      }
      const e = Math.min(b.l / (bx[2] - bx[0] || 1), (b.h * 1.3) / (bx[3] - bx[1] || 1));
      ctx.translate(b.x + b.l / 2 - ((bx[0] + bx[2]) / 2) * e, b.y + ((bx[1] + bx[3]) / 2) * e);
      ctx.scale(e, -e);
      dessinerPrimitives(ctx, prims, e, d.mm, { ombre: false });
    }
  }
  ctx.restore();
}

/** Toutes les pages de la feuille (une par phase, ou une seule). */
export const pagesDuPlan = (plan) => pagesDeLaFeuille(plan);

/**
 * Fabrique le PDF (jsPDF, chargé au besoin). Renvoie un Blob. avancement(texte) : message pendant le travail.
 * Les tuiles swisstopo sont attendues (8 s au plus par page) ; une photo refusée par le navigateur est signalée.
 */
export async function creerPdfChantier(donnees, avancement = () => {}) {
  const { jsPDF } = await import('jspdf');
  const r = reglagesFeuille(donnees.plan);
  const pages = pagesDeLaFeuille(donnees.plan, r.pages);
  const dpi = DPI_PDF[r.format] ?? 200;
  const s = dpi / 25.4;
  const logo = await chargerImage(adresseLogo(r.logo));
  let doc = null;
  const remarques = [];
  let derniere = null;
  for (let i = 0; i < pages.length; i++) {
    avancement(`PDF : page ${i + 1} / ${pages.length}…`);
    const prep = preparerPage(donnees, pages[i], s);
    if (donnees.plan.fond?.ortho || donnees.plan.fond?.cadastre) {
      const att = await attendreTuiles(prep.vue, donnees.plan.fond, 1);
      if (att?.manquantes) remarques.push('fond swisstopo incomplet (pas de connexion ?)');
    }
    if (prep.r.situation.actif) {
      const sit = prep.r.situation;
      const vS = { echelle: (s * 1000) / echelleDeSituation(donnees.plan, prep.mise, sit), estCentre: prep.vue.estCentre, nordCentre: prep.vue.nordCentre, largeur: cadreSituation(prep.mise, sit).l * s, hauteur: cadreSituation(prep.mise, sit).h * s, rotation: 0 };
      const att = await attendreTuiles(vS, { carte: true }, 1);
      if (att?.manquantes) remarques.push('carte de situation incomplète (pas de connexion ?)');
    }
    const { page } = prep.mise;
    derniere = prep.mise;
    const toile = document.createElement('canvas');
    toile.width = Math.round(page.largeur * s);
    toile.height = Math.round(page.hauteur * s);
    const ctx = toile.getContext('2d');
    dessinerPage(ctx, donnees, prep, s, { avecTextes: false, logo });
    const orientation = page.largeur > page.hauteur ? 'landscape' : 'portrait';
    if (!doc) doc = new jsPDF({ orientation, unit: 'mm', format: [page.largeur, page.hauteur], compress: true });
    else doc.addPage([page.largeur, page.hauteur], orientation);
    let image;
    try {
      image = toile.toDataURL('image/jpeg', 0.9);
    } catch {
      // Une tuile du fond refuse d'être lue (CORS) : la page est refaite sans le fond swisstopo.
      remarques.push('fond swisstopo refusé par le navigateur : page faite sans lui');
      const sans = { ...donnees, plan: { ...donnees.plan, fond: { ...donnees.plan.fond, ortho: false, cadastre: false, carte: false } } };
      const prepSans = { ...prep, r: { ...prep.r, situation: { ...prep.r.situation, actif: false } } };
      const sans2 = { ...sans, plan: { ...sans.plan, fond: { ...sans.plan.fond, carte: false } } };
      dessinerPage(ctx, sans2, prepSans, s, { avecTextes: false, logo });
      image = toile.toDataURL('image/jpeg', 0.9);
    }
    doc.addImage(image, 'JPEG', 0, 0, page.largeur, page.hauteur, undefined, 'FAST');
    toile.width = 0;
    for (const t of prep.textes) {
      doc.setFont('helvetica', t.gras ? 'bold' : 'normal');
      doc.setFontSize(t.taille);
      doc.setTextColor(t.couleur);
      doc.text(texteWinAnsi(t.texte), t.x, t.y, { align: t.align, baseline: 'middle' });
    }
  }
  // 0.312.0 : page « Vue de côté » (coupe) à la fin, si demandée
  const largeurSvg = 1400;
  const cadre = derniere?.cadre;
  const coupe = cadre && donnees.coupe ? donnees.coupe(largeurSvg, Math.round((largeurSvg * (cadre.h - 16)) / cadre.l)) : null;
  if (coupe) {
    avancement('PDF : page « Vue de côté »…');
    const { page } = derniere;
    const toile = document.createElement('canvas');
    toile.width = Math.round(page.largeur * s);
    toile.height = Math.round(page.hauteur * s);
    const ctx = toile.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, toile.width, toile.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1, 0.35 * s);
    ctx.strokeRect(cadre.x * s, cadre.y * s, cadre.l * s, cadre.h * s);
    const img = new Image();
    await new Promise((fin) => {
      img.onload = fin;
      img.onerror = fin;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coupe.svg)}`;
    });
    if (img.naturalWidth) ctx.drawImage(img, cadre.x * s, (cadre.y + 14) * s, cadre.l * s, (cadre.h - 16) * s);
    else remarques.push('vue de côté non dessinée');
    doc.addPage([page.largeur, page.hauteur], page.largeur > page.hauteur ? 'landscape' : 'portrait');
    doc.addImage(toile.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, page.largeur, page.hauteur, undefined, 'FAST');
    toile.width = 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#1e293b');
    doc.text(texteWinAnsi(`Vue de côté — ${coupe.titre} — ${donnees.plan.nom}`), cadre.x + 4, cadre.y + 8, { baseline: 'middle' });
  }
  doc.setProperties({ title: texteWinAnsi(donnees.plan.nom), creator: 'Topo' });
  return { blob: doc.output('blob'), remarques: [...new Set(remarques)] };
}

export { metresParMm };
