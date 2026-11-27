// Plans de chantier (0.288.0) : la vue du plan (2 canvas). Dessous : les plans DXF / PDF / IFC du projet (comme le
// plan principal, dessinerPlansDxf) et les points levés. Dessus : les objets du plan de chantier (zones, lignes,
// pistes, flèches, textes), l'objet choisi, le dessin en cours et l'accroche.
// Molette = zoom autour de la souris ; glisser dans le vide = déplacer ; deux doigts = zoomer ;
// glisser l'objet choisi = le déplacer (si glisserObjet le permet).
import { dessinerPlansDxf, surImageChargee } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';
import { objetsVisibles, couleurObjet, bornesObjets, metresParMm, pointsDe, estPose, bordsDesTriangles, milieuxDesCotes, poigneesDe, poigneeDecalageCote, poigneesArcs, pointsDansArcs, etiquettePresente, ancreEtiquette } from '../topo/plan-chantier.js';
import { dessinerObjet, dessinerObjets, symboleDeLObjet } from './dessin.js';
import { coinsSymbole, poigneeRotation } from '../topo/symboles.js';
import { pointsDePrise } from '../topo/prise-bloc.js';
import { dessinerFondSwisstopo } from './tuiles.js';
import { resultatMesure } from '../topo/mesure-plan.js';

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
    plans, points, planChantier, choisi, multi = () => [], saisie, selection = () => [], accrocher = () => null, clic = () => {}, double = () => {}, bouge = () => {}, glisserObjet = null,
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

  // 0.319.9 : un plan PDF en image se charge après coup : on redessine quand il est prêt (sinon la vue restait blanche)
  const arreterImages = surImageChargee(() => redessiner());

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
      for (const id of multi()) { // plusieurs éléments choisis (Ctrl + clic)
        const autre = visibles.find((o) => o.id === id);
        if (autre) dessinerChoix(ctx, autre);
      }
      // Symbole à poser (0.289.0) : aperçu transparent sous la souris.
      const fantome = curseur ? apercu() : null;
      if (fantome) {
        ctx.globalAlpha = 0.6;
        dessinerObjet(d, { ...fantome, point: curseur, phase: pc.phaseActive });
        ctx.globalAlpha = 1;
      }
    }
    // 0.337.0 : éléments de plan choisis pour « Geler / Isoler » : montrés en orange (formes en MN95)
    const formes = selection();
    if (formes.length) {
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      for (const forme of formes) {
        ctx.beginPath();
        if (forme.type === 'trait') {
          forme.pts.forEach((q, i) => { const e = versEcran(q.est, q.nord, vue); if (i) ctx.lineTo(e.x, e.y); else ctx.moveTo(e.x, e.y); });
          if (forme.ferme) ctx.closePath();
        } else {
          const e = versEcran(forme.est, forme.nord, vue);
          ctx.arc(e.x, e.y, forme.type === 'cercle' ? Math.max(3, forme.r * vue.echelle) : 9, 0, 2 * Math.PI);
        }
        ctx.stroke();
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

  /** 0.317.0 : petit cadenas à côté d'un élément verrouillé. */
  function cadenas(ctx, q) {
    ctx.setLineDash([]);
    ctx.strokeStyle = ORANGE;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(q.x + 12, q.y - 17, 4, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(q.x + 6, q.y - 17, 12, 9, 2);
    ctx.fill();
    ctx.stroke();
  }

  // 0.320.5 : losange blanc au point du texte (zone ou bloc) : le prendre pour le déplacer.
  function poigneeEtiquette(ctx, o) {
    if (!etiquettePresente(o)) return;
    const q = ecran(ancreEtiquette(o));
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 6);
    ctx.lineTo(q.x + 6, q.y);
    ctx.lineTo(q.x, q.y + 6);
    ctx.lineTo(q.x - 6, q.y);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function dessinerChoix(ctx, o) {
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    if (o.verrou) {
      // Verrouillé : seulement le contour, sans poignées ni « + », et un cadenas.
      if (estPose(o)) {
        const s = symboleDeLObjet(bibliotheque(), o);
        if (s) {
          chemin(ctx, coinsSymbole(o, s), true);
          ctx.stroke();
        }
        return cadenas(ctx, ecran(o.point));
      }
      const pv = pointsDe(o);
      if (o.type !== 'texte' && pv.length) {
        chemin(ctx, pv, o.type === 'zone');
        ctx.stroke();
      }
      return cadenas(ctx, ecran(o.cercle ? o.cercle.centre : pv[0] ?? o.point));
    }
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
        // 0.305.0 : les 8 points de base possibles (4 coins, 4 milieux des bords) : en saisir un pour déplacer le bloc
        // par ce point (il suit la souris et s'accroche) ; celui sous la souris grossit.
        const points = pointsDePrise(o, s); // 0.320.2 : les points d'accroche du bloc (grue : son châssis)
        const souris = curseur ? ecran(curseur) : null;
        for (const q of points) {
          const e = ecran(q);
          const proche = souris && Math.hypot(e.x - souris.x, e.y - souris.y) <= 15;
          ctx.beginPath();
          ctx.arc(e.x, e.y, proche ? 6.5 : 4, 0, 2 * Math.PI);
          ctx.fillStyle = proche ? ORANGE : '#ffffff';
          ctx.fill();
          ctx.stroke();
        }
        // 0.320.7 : pastille de déplacement au centre du bloc (comme la grue) : un rond avec une croix, à prendre pour le bouger.
        const cc = ecran(o.point);
        ctx.beginPath();
        ctx.arc(cc.x, cc.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 2;
        ctx.stroke();
        // quatre petites flèches (icône « déplacer »), pas un « + » qui ferait penser à ajouter
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(cc.x + dx * 1.5, cc.y + dy * 1.5);
          ctx.lineTo(cc.x + dx * 5.5, cc.y + dy * 5.5);
          ctx.moveTo(cc.x + dx * 5.5 - (dx ? dx * 2 : 2), cc.y + dy * 5.5 - (dy ? dy * 2 : 2));
          ctx.lineTo(cc.x + dx * 5.5, cc.y + dy * 5.5);
          ctx.moveTo(cc.x + dx * 5.5 - (dx ? dx * 2 : -2), cc.y + dy * 5.5 - (dy ? dy * 2 : -2));
          ctx.lineTo(cc.x + dx * 5.5, cc.y + dy * 5.5);
        }
        ctx.stroke();
      }
      poigneeEtiquette(ctx, o);
      return;
    }
    const pts = pointsDe(o);
    if (o.type !== 'texte') {
      chemin(ctx, pts, o.type === 'zone');
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    const dansArcs = pointsDansArcs(o); // 0.315.0 : pas de carré sur les points intérieurs d'un arc (une poignée ronde à la place)
    poigneesDe(o).forEach((p, k) => {
      if (dansArcs.has(k)) return;
      const q = ecran(p);
      ctx.fillRect(q.x - 4, q.y - 4, 8, 8);
      ctx.strokeRect(q.x - 4, q.y - 4, 8, 8);
    });
    for (const { point } of poigneesArcs(o)) {
      const q = ecran(point);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = ORANGE;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
    }
    // 0.328.0 : poignée ronde au milieu de la ligne de cote (la glisser = éloigner / rapprocher la ligne de cote)
    const hc = poigneeDecalageCote(o);
    if (hc) {
      const q = ecran(hc);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - 3);
      ctx.lineTo(q.x, q.y + 3);
      ctx.strokeStyle = ORANGE;
      ctx.stroke();
    }
    poigneeEtiquette(ctx, o); // 0.320.5 : poignée du texte de la zone (surface, tas, texte)
    // 0.299.0 : petit « + » au milieu de chaque côté (ligne, zone, flèche, piste) : clic ou glisser = ajouter un point.
    for (const { index, milieu } of milieuxDesCotes(o)) {
      // 0.307.0 : pas de « + » sur les petits côtés (ceux d'un arc), trop serrés à l'écran.
      const a = ecran(o.points[index]);
      const b = ecran(o.points[(index + 1) % o.points.length]);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 36) continue;
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
    // 0.307.0 : cotation de longueur, 2 points cliqués : la cote elle-même suit la souris (le 3e clic la pose), au lieu
    // d'un trait vers un 3e point qui faisait croire à un autre point à coter.
    if (s.outil === 'cotation' && s.genre !== 'angle' && s.points.length === 2 && curseur && pc) {
      const [A, B] = s.points;
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const decalage = ((curseur[0] - A[0]) * -(B[1] - A[1]) + (curseur[1] - A[1]) * (B[0] - A[0])) / L;
      dessinerObjet(contexteDessin(ctx, pc), { type: 'cotation', genre: 'longueur', points: [A, B], decalage, phase: pc.phaseActive });
      return;
    }
    // 0.315.0 : rectangle, 2 coins posés : le rectangle entier (trait plein, comme une zone posée) suit la souris et le 3e clic
    // fixe sa largeur, comme une cote ; plus de trait en tirets qui faisait croire à une polyligne.
    if (s.outil === 'rectangle' && s.points.length === 2 && curseur && pc && s.apercu?.length > 3) {
      dessinerObjet(contexteDessin(ctx, pc), { type: 'zone', categorie: s.categorie, points: s.apercu.slice(0, 4), phase: pc.phaseActive, opacite: 20 });
      ctx.fillStyle = couleurObjet(pc, { type: 'zone', categorie: s.categorie, phase: pc.phaseActive });
      for (const p of s.points) {
        const q = ecran(p);
        ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
      }
      return;
    }
    const pts = curseur ? [...s.points, curseur] : s.points;
    const mesure = s.outil === 'mesure'; // 0.334.0 : mesure rapide (rien n'est enregistré), tracée en bleu avec le résultat près du curseur
    const couleur = mesure ? '#2563eb' : pc ? couleurObjet(pc, { type: s.outil, categorie: s.categorie, style: s.style, phase: pc.phaseActive }) : ORANGE;
    const fermee = s.outil === 'zone' || (mesure && s.mode === 'surface');
    chemin(ctx, pts, fermee);
    if (fermee && pts.length >= 3) {
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
    if (mesure && curseur) {
      const lignes = resultatMesure(s.mode, pts).lignes;
      const c = ecran(curseur);
      ctx.font = 'bold 13px sans-serif';
      const l = Math.max(...lignes.map((t) => ctx.measureText(t).width), 0) + 12;
      lignes.forEach((t, i) => {
        const x = c.x + 14;
        const y = c.y + 14 + i * 20;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(x, y, l, 18);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText(t, x + 6, y + 13);
      });
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

  // 0.304.0 : quand un bandeau apparaît au-dessus (le haut du plan descend, le bas ne bouge pas), le dessin reste
  // à sa place à l'écran : on décale la vue de la moitié de la différence de hauteur.
  let cadreAvant = null;
  const observateur = new ResizeObserver(() => {
    if (!conteneur.clientWidth) return;
    const r = conteneur.getBoundingClientRect();
    if (vue && cadreAvant && Math.abs(r.bottom - cadreAvant.bottom) < 1 && Math.abs(r.width - cadreAvant.width) < 1 && Math.abs(r.top - cadreAvant.top) >= 1) {
      vue = deplacer(vue, 0, (conteneur.clientHeight - cadreAvant.hauteur) / 2);
    }
    cadreAvant = { top: r.top, bottom: r.bottom, width: r.width, hauteur: conteneur.clientHeight };
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
      arreterImages();
      observateur.disconnect();
      conteneur.replaceChildren();
    },
  };
}
