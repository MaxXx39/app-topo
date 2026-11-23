// Plans de chantier, étape 4 (0.289.0) : export DXF (format AutoCAD R12, lu par AutoCAD et Mensura), en MN95.
// Calques « PC_<phase>_<genre> » (ex. PC_PHASE_1_CLOTURE) ; zones = contours fermés (+ surface écrite si affichée) ;
// lignes = polylignes (les textes des motifs ELEC, EAU… écrits le long) ; pistes et flèches = polylignes épaisses ;
// textes ; symboles = BLOCS (un bloc par symbole utilisé, point de base = centre) insérés avec leur rotation ;
// grues = bloc (grue + châssis) et rayon d'action sur un calque à part (PC_GRUES_RAYON) ; base-vie à étage = bloc par
// pose, ses deux textes (« 1er », « Rez ») écrits à part (modifiables).
import {
  styleLigne, categorieZone, couleurObjet, dimensionsFleche, pointeDeFleche, centreZone, texteSurface, positionsLeLong,
  metresParMm, estPose,
} from './plan-chantier.js';
import { couleurAci } from './dxf-plan.js';
import { symboleGrue, symboleChassis, primitivesEtage } from './symboles.js';
import { nomDeCalque, texteAscii } from '../export/dxf.js';

const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3));

let tableAci = null;
/** Numéro de couleur AutoCAD le plus proche d'une couleur '#rrggbb' (les 255 couleurs ACI, 7 = noir / blanc exclu). */
export function aciProche(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return 7;
  tableAci ??= Array.from({ length: 255 }, (_, i) => i + 1).filter((n) => n !== 7).map((n) => [n, [1, 3, 5].map((k) => parseInt(couleurAci(n).slice(k, k + 2), 16))]);
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  if (c[0] + c[1] + c[2] < 90) return 250; // presque noir : gris très foncé
  let meilleur = 7;
  let dMin = Infinity;
  for (const [n, r] of tableAci) {
    const d = (r[0] - c[0]) ** 2 * 0.3 + (r[1] - c[1]) ** 2 * 0.59 + (r[2] - c[2]) ** 2 * 0.11;
    if (d < dMin) [dMin, meilleur] = [d, n];
  }
  return meilleur;
}

/**
 * Triangles d'un polygone simple (oreilles successives) : liste plate [x, y…] → [[ax, ay, bx, by, cx, cy]…].
 * Polygone tordu (oreille introuvable) : on s'arrête avec ce qui est fait.
 */
export function trianguler(plat) {
  let pts = [];
  for (let i = 0; i + 1 < plat.length; i += 2) pts.push([plat[i], plat[i + 1]]);
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-9) pts.pop();
  let aire = 0;
  for (let i = 0; i < pts.length; i++) aire += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
  if (aire < 0) pts = pts.reverse();
  const croix = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const dedans = (p, a, b, c) => croix(a, b, p) >= 0 && croix(b, c, p) >= 0 && croix(c, a, p) >= 0;
  const res = [];
  let garde = 0;
  while (pts.length > 3 && garde < 10000) {
    garde += 1;
    let coupe = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      if (croix(a, b, c) <= 1e-12) continue;
      if (pts.some((p) => p !== a && p !== b && p !== c && dedans(p, a, b, c))) continue;
      res.push([...a, ...b, ...c]);
      pts.splice(i, 1);
      coupe = true;
      break;
    }
    if (!coupe) break;
  }
  if (pts.length === 3) res.push([...pts[0], ...pts[1], ...pts[2]]);
  return res;
}

// ------------------------------------------------------------------ Entités R12

const couleurCode = (aci) => (aci == null ? [] : ['62', String(aci)]);
function polyligne(points, calque, { ferme = false, aci = null, largeur = null } = {}) {
  return [
    '0', 'POLYLINE', '8', calque, ...couleurCode(aci), '66', '1', '10', '0', '20', '0', '30', '0', '70', ferme ? '1' : '0',
    ...(largeur ? ['40', f3(largeur), '41', f3(largeur)] : []),
    ...points.flatMap(([x, y]) => ['0', 'VERTEX', '8', calque, '10', f3(x), '20', f3(y), '30', '0']),
    '0', 'SEQEND', '8', calque,
  ];
}
const texte = (x, y, h, angle, t, calque, aci = null) => ['0', 'TEXT', '8', calque, ...couleurCode(aci), '10', f3(x), '20', f3(y), '30', '0', '40', f3(h), '1', texteAscii(t), '50', angle.toFixed(2), '72', '1', '73', '2', '11', f3(x), '21', f3(y), '31', '0'];
const solide = ([ax, ay, bx, by, cx, cy], calque, aci) => ['0', 'SOLID', '8', calque, ...couleurCode(aci), '10', f3(ax), '20', f3(ay), '30', '0', '11', f3(bx), '21', f3(by), '31', '0', '12', f3(cx), '22', f3(cy), '32', '0', '13', f3(cx), '23', f3(cy), '33', '0'];

/** Entités d'une liste de primitives de symbole (repère du bloc), sur le calque 0 (elles prennent celui de l'insertion). */
function entitesPrimitives(prims) {
  const res = [];
  for (const p of prims) {
    const aci = aciProche(p.k);
    if (p.g === 'h') {
      // Remplissage : en triangles pleins s'il n'a qu'un contour (pas de trou) et pas de motif ; sinon ses contours.
      if (p.p.length === 1 && !p.m) for (const t of trianguler(p.p[0])) res.push(...solide(t, '0', aci));
      else for (const c of p.p) res.push(...polyligne(paires(c), '0', { ferme: true, aci }));
    } else if (p.g === 'l') res.push(...polyligne(paires(p.p), '0', { ferme: p.f, aci }));
    else if (p.g === 'c') res.push('0', 'CIRCLE', '8', '0', ...couleurCode(aci), '10', f3(p.x), '20', f3(p.y), '30', '0', '40', f3(p.r));
    else if (p.g === 't') res.push(...texte(p.x, p.y, p.h, p.a ?? 0, p.t, '0', aci));
  }
  return res;
}
function paires(plat) {
  const r = [];
  for (let i = 0; i + 1 < plat.length; i += 2) r.push([plat[i], plat[i + 1]]);
  return r;
}

/** Nom de bloc accepté par AutoCAD (majuscules sans accent, 31 caractères au plus). */
export const nomDeBloc = (texteNom) => nomDeCalque(`PC_${texteNom}`);

/**
 * Texte du fichier DXF d'un plan de chantier. objets : ceux à écrire (par défaut : les phases visibles) ; bib :
 * bibliothèque des symboles. Renvoie le texte (CRLF).
 */
export function dxfPlanChantier(plan, bib, objets = null) {
  const visibles = new Set(plan.phases.filter((p) => p.visible !== false).map((p) => p.id));
  const liste = objets ?? plan.objets.filter((o) => visibles.has(o.phase));
  const nomPhase = (id) => plan.phases.find((p) => p.id === id)?.nom ?? 'PHASE';
  const calques = new Map(); // nom → ACI
  const calque = (o, genre, aci) => {
    const nom = nomDeCalque(`PC_${nomPhase(o.phase)}_${genre}`);
    if (!calques.has(nom)) calques.set(nom, aci);
    return nom;
  };
  const blocs = new Map(); // nom → entités
  const entites = [];
  const mParMm = metresParMm(plan);
  for (const o of liste) {
    const aci = aciProche(couleurObjet(plan, o));
    if (o.type === 'zone') {
      const c = calque(o, `ZONE_${categorieZone(o.categorie).nom}`, aci);
      entites.push(...polyligne(o.points, c, { ferme: true }));
      if (o.afficherSurface) {
        const [x, y] = centreZone(o.points);
        entites.push(...texte(x, y, 3 * mParMm, 0, texteSurface(o.points), c));
      }
    } else if (o.type === 'ligne') {
      const st = styleLigne(o.style);
      const c = calque(o, st.nom.replace(/\s+[<>].*$/, ''), aci);
      entites.push(...polyligne(o.points, c, {}));
      if (st.motif?.type === 'texte') {
        for (const r of positionsLeLong(o.points, st.motif.pasMm * mParMm * (o.echelleMotif ?? 1))) {
          const a = (r.angle * 180) / Math.PI;
          const lisible = a > 90 || a < -90 ? a + 180 : a;
          entites.push(...texte(r.x, r.y, st.motif.tailleMm * mParMm * (o.echelleMotif ?? 1), lisible, st.motif.texte, c));
        }
      }
    } else if (o.type === 'piste') {
      entites.push(...polyligne(o.points, calque(o, 'PISTE', aci), { largeur: o.largeur ?? 4 }));
    } else if (o.type === 'fleche' && o.points.length >= 2) {
      const c = calque(o, 'CIRCULATION', aci);
      const dim = dimensionsFleche(o);
      const tete = pointeDeFleche(o.points.at(-2), o.points.at(-1), dim.longueurPointe, dim.largeurPointe);
      const base = [(tete[1][0] + tete[2][0]) / 2, (tete[1][1] + tete[2][1]) / 2];
      entites.push(...polyligne([...o.points.slice(0, -1), base], c, { largeur: dim.largeur }));
      entites.push(...solide([...tete[0], ...tete[1], ...tete[2]], c, null));
    } else if (o.type === 'texte') {
      const c = calque(o, 'TEXTES', 7);
      entites.push(...texte(o.point[0], o.point[1], o.taille ?? 1, 0, o.texte, c));
      if (o.repere) entites.push('0', 'LINE', '8', c, '10', f3(o.point[0]), '20', f3(o.point[1]), '30', '0', '11', f3(o.repere[0]), '21', f3(o.repere[1]), '31', '0');
    } else if (estPose(o)) {
      const pose = blocDuPose(o, bib);
      if (!pose) continue;
      if (!blocs.has(pose.nom)) blocs.set(pose.nom, entitesPrimitives(pose.primitives));
      const c = calque(o, o.type === 'grue' ? 'GRUES' : 'SYMBOLES', 7);
      entites.push('0', 'INSERT', '8', c, '2', pose.nom, '10', f3(o.point[0]), '20', f3(o.point[1]), '30', '0', '50', (o.rotation ?? 0).toFixed(2));
      if (o.type === 'grue' && o.rayon !== false) {
        const r = nomDeCalque('PC_GRUES_RAYON');
        calques.set(r, 30);
        entites.push('0', 'CIRCLE', '8', r, '10', f3(o.point[0]), '20', f3(o.point[1]), '30', '0', '40', f3(pose.fleche));
      }
      if (o.etage) {
        const a = ((o.rotation ?? 0) * Math.PI) / 180;
        (o.etage.textes ?? ['1er', 'Rez']).forEach((t, i) => {
          const dy = (i ? -0.55 : 0.55) + 0.12;
          entites.push(...texte(o.point[0] - Math.sin(a) * dy, o.point[1] + Math.cos(a) * dy, 0.55, o.rotation ?? 0, t, c));
        });
      }
    }
  }
  return ecrire(calques, blocs, entites);
}

/** Bloc d'un élément posé : { nom, primitives, fleche } (grue = châssis + grue ; à étage = escalier + 2 conteneurs). */
export function blocDuPose(o, bib) {
  if (o.type === 'grue') {
    const g = symboleGrue(bib, o.modele ?? 'tour', o.fleche ?? 40);
    if (!g) return null;
    const ch = symboleChassis(bib, o.chassis);
    return { nom: nomDeBloc(`GRUE_${o.modele === 'auto' ? 'AUTO' : 'TOUR'}_${g.fleche}M${ch ? `_${ch.chassis}` : ''}`), primitives: [...(ch?.primitives ?? []), ...g.primitives], fleche: g.fleche };
  }
  if (o.etage) {
    const et = primitivesEtage(bib, o.etage.pose ?? 0);
    return et ? { nom: nomDeBloc(`BASE_VIE_ETAGE_P${(o.etage.pose ?? 0) + 1}`), primitives: [...et.dessous, ...et.rez, ...et.etage] } : null;
  }
  const s = bib.find((x) => x.cle === o.cle);
  return s ? { nom: nomDeBloc(s.nom), primitives: s.primitives } : null;
}

function ecrire(calques, blocs, entites) {
  const lignes = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(calques.size + 1),
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
    ...[...calques].flatMap(([nom, aci]) => ['0', 'LAYER', '2', nom, '70', '0', '62', String(aci ?? 7), '6', 'CONTINUOUS']),
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS',
    ...[...blocs].flatMap(([nom, ents]) => ['0', 'BLOCK', '8', '0', '2', nom, '70', '0', '10', '0', '20', '0', '30', '0', '3', nom, ...ents, '0', 'ENDBLK', '8', '0']),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...entites, '0', 'ENDSEC', '0', 'EOF',
  ];
  return `${lignes.join('\r\n')}\r\n`;
}
