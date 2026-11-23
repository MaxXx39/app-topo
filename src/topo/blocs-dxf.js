// Plans de chantier, étape 2 (0.289.0) : convertisseur de blocs DXF en symboles.
// Un fichier DXF « bibliothèque » (ex. Base_2023.dxf de l'utilisateur, en mètres) contient des blocs (engins, conteneurs,
// grues…). Chaque bloc nommé devient un symbole : une liste de « primitives » dans l'ordre de dessin du DXF (le premier
// dessous, le dernier dessus), en mètres, par rapport au point de base du bloc.
//
// Primitives (coordonnées arrondies au mm) :
//   { g: 'h', k, p: [[x, y, x, y…], …], m }  remplissage (hachure, SOLID) ; plusieurs contours = trous (règle evenodd) ;
//                                            m = vrai si la hachure a un motif (pas pleine)
//   { g: 'l', k, p: [x, y…], f }             trait (ligne, polyligne, arc, ellipse, courbe) ; f = fermé
//   { g: 'c', k, x, y, r }                   cercle (trait)
//   { g: 't', k, x, y, h, a, t, ah, av }     texte (h hauteur m, a angle °, ah 0 / 1 / 2, av 0 / 1 / 2 / 3 comme dxf-plan.js)
// k = couleur '#rrggbb' ; 'BB' = « du bloc » (BYBLOCK, ou couleur 7 / calque 0 : blanc en remplissage, foncé en trait).
// Les blocs imbriqués (INSERT) sont dépliés ; les blocs « MENSURA_LEADER* », anonymes (*…), et les points sont ignorés.
import {
  lirePaires, lireSections, decouperEntites, lireCalques, lireBlocs, contoursHachure, pointsRenflement, pointsSpline,
  couleurAci, couleurVraie, symbolesTexte, texteSansMiseEnForme,
} from './dxf-plan.js';

const PAS_ARC = 10; // degrés
const PROFONDEUR = 6;
const DU_BLOC = 'BB';

/** Bloc à ignorer : flèches de Mensura, blocs anonymes, blocs techniques. */
export function blocIgnore(nom) {
  return !nom || nom.startsWith('*') || /^MENSURA_LEADER/i.test(nom) || /^_ArchTick$/i.test(nom) || /^CloneBlock/i.test(nom);
}

const mm = (v) => Math.round(v * 1000) / 1000;
const appliquer = (t, x, y) => [t.a * x + t.b * y + t.e, t.c * x + t.d * y + t.f];
const composer = (t, u) => ({
  a: t.a * u.a + t.b * u.c, b: t.a * u.b + t.b * u.d, c: t.c * u.a + t.d * u.c, d: t.c * u.b + t.d * u.d,
  e: t.a * u.e + t.b * u.f + t.e, f: t.c * u.e + t.d * u.f + t.f,
});
const valeur = (e, code, def = undefined) => {
  const p = e.paires.find((q) => q.code === code);
  return p ? p.valeur.trim() : def;
};
const nombre = (e, code, def = 0) => {
  const v = Number(valeur(e, code));
  return Number.isFinite(v) ? v : def;
};
const nombres = (e, code) => e.paires.filter((p) => p.code === code).map((p) => Number(p.valeur));

function arc(cx, cy, r, a0, a1) {
  let bal = a1 - a0;
  while (bal <= 0) bal += 360;
  const n = Math.max(2, Math.ceil(bal / PAS_ARC));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (bal * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Lit les blocs d'un DXF. Renvoie { blocs: [{ nom, primitives, bornes { xMin, yMin, xMax, yMax } }], erreur }.
 * Le DXF doit être en mètres (le point de base du bloc = point d'insertion).
 */
export function lireBlocsDxf(texte) {
  if (texte.startsWith('AutoCAD Binary DXF')) return { blocs: [], erreur: 'DXF binaire : enregistre le fichier en DXF « texte » (ASCII)' };
  const sections = lireSections(lirePaires(texte));
  if (!sections.BLOCKS) return { blocs: [], erreur: 'ce DXF n\'a pas de blocs' };
  const calques = lireCalques(sections.TABLES ?? []);
  const blocs = lireBlocs(sections.BLOCKS);
  const res = [];
  for (const [nom, bloc] of blocs) {
    if (blocIgnore(nom) || bloc.xref) continue;
    const prims = [];
    const t0 = { a: 1, b: 0, c: 0, d: 1, e: -bloc.base.x, f: -bloc.base.y };
    for (const e of bloc.entites) ajouter(prims, e, blocs, calques, t0, 0, null);
    if (!prims.length) continue;
    res.push({ nom, primitives: prims.map(arrondir), bornes: bornesPrimitives(prims) });
  }
  return { blocs: res, erreur: res.length ? null : 'aucun bloc dessiné dans ce DXF' };
}

/** Couleur d'une entité : vraie couleur, ACI, du calque, ou 'BB' (du bloc). couleurBloc : celle de l'INSERT. */
function couleurDe(e, calques, couleurBloc) {
  const vraie = valeur(e, 420);
  if (vraie) return couleurVraie(Number(vraie));
  const aci = nombre(e, 62, 256);
  if (aci === 0) return couleurBloc ?? DU_BLOC;
  if (aci === 7) return DU_BLOC;
  if (aci !== 256) return couleurAci(Math.abs(aci));
  const nomCalque = valeur(e, 8, '0');
  if (nomCalque === '0') return couleurBloc ?? DU_BLOC;
  const c = calques.get(nomCalque)?.couleur;
  return !c || c === '#000000' ? DU_BLOC : c;
}

function ajouter(prims, e, blocs, calques, t, prof, couleurBloc) {
  const k = couleurDe(e, calques, couleurBloc);
  const P = (x, y) => appliquer(t, x, y);
  const ech = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
  const trait = (pts, f = false) => {
    if (pts.length >= 2) prims.push({ g: 'l', k, p: pts.map(([x, y]) => P(x, y)), f });
  };
  switch (e.type) {
    case 'LINE':
      trait([[nombre(e, 10), nombre(e, 20)], [nombre(e, 11), nombre(e, 21)]]);
      break;
    case 'LWPOLYLINE': {
      const xs = nombres(e, 10);
      const ys = nombres(e, 20);
      const bul = new Array(xs.length).fill(0);
      let s = -1;
      for (const q of e.paires) {
        if (q.code === 10) s++;
        else if (q.code === 42 && s >= 0) bul[s] = Number(q.valeur) || 0;
      }
      const ferme = (nombre(e, 70) & 1) === 1;
      const pts = [];
      for (let i = 0; i < xs.length; i++) {
        if (i === xs.length - 1 && !ferme) {
          pts.push([xs[i], ys[i]]);
          break;
        }
        const j = (i + 1) % xs.length;
        pts.push(...pointsRenflement([xs[i], ys[i]], [xs[j], ys[j]], bul[i]));
      }
      // Polyligne à largeur constante (code 43) : dessinée comme un trait épais (rare dans les blocs).
      trait(pts, ferme);
      break;
    }
    case 'POLYLINE': {
      const sommets = (e.sommets ?? []).map((v) => ({ x: nombre(v, 10), y: nombre(v, 20), b: nombre(v, 42) }));
      const ferme = (nombre(e, 70) & 1) === 1;
      const pts = [];
      sommets.forEach((s, i) => {
        if (i === sommets.length - 1 && !ferme) pts.push([s.x, s.y]);
        else pts.push(...pointsRenflement([s.x, s.y], [sommets[(i + 1) % sommets.length].x, sommets[(i + 1) % sommets.length].y], s.b));
      });
      trait(pts, ferme);
      break;
    }
    case 'ARC':
      trait(arc(nombre(e, 10), nombre(e, 20), nombre(e, 40), nombre(e, 50), nombre(e, 51)));
      break;
    case 'CIRCLE': {
      const [x, y] = P(nombre(e, 10), nombre(e, 20));
      prims.push({ g: 'c', k, x, y, r: nombre(e, 40) * ech });
      break;
    }
    case 'ELLIPSE': {
      const [cx, cy, ax, ay, rap] = [nombre(e, 10), nombre(e, 20), nombre(e, 11), nombre(e, 21), nombre(e, 40, 1)];
      const d = nombre(e, 41, 0);
      let f = nombre(e, 42, 2 * Math.PI);
      if (f <= d) f += 2 * Math.PI;
      const n = Math.max(12, Math.ceil(((f - d) * 180) / Math.PI / PAS_ARC));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = d + ((f - d) * i) / n;
        pts.push([cx + ax * Math.cos(a) - ay * rap * Math.sin(a), cy + ay * Math.cos(a) + ax * rap * Math.sin(a)]);
      }
      trait(pts, Math.abs(f - d - 2 * Math.PI) < 1e-6);
      break;
    }
    case 'SPLINE': {
      const ys = nombres(e, 20);
      const ctrl = nombres(e, 10).map((x, i) => [x, ys[i]]);
      const ys2 = nombres(e, 21);
      const ajust = nombres(e, 11).map((x, i) => [x, ys2[i]]);
      trait(ctrl.length >= 2 ? pointsSpline(nombre(e, 71, 3), ctrl, nombres(e, 40)) : ajust, (nombre(e, 70) & 1) === 1);
      break;
    }
    case 'SOLID':
    case 'TRACE': {
      const pts = [0, 1, 3, 2].map((i) => P(nombre(e, 10 + i), nombre(e, 20 + i)));
      prims.push({ g: 'h', k, p: [pts], m: false });
      break;
    }
    case 'HATCH': {
      const contours = contoursHachure(e.paires).map((c) => c.map(([x, y]) => P(x, y))).filter((c) => c.length >= 3);
      if (!contours.length) break;
      const plein = (nombre(e, 70) & 1) === 1 || /^SOLID$/i.test(valeur(e, 2, ''));
      prims.push({ g: 'h', k, p: contours, m: !plein });
      break;
    }
    case 'TEXT':
    case 'ATTRIB':
    case 'MTEXT': {
      if (e.type === 'ATTRIB' && (nombre(e, 70) & 1)) break;
      const brut = e.type === 'MTEXT' ? e.paires.filter((q) => q.code === 3 || q.code === 1).map((q) => q.valeur).join('') : valeur(e, 1, '');
      const lu = e.type === 'MTEXT' ? texteSansMiseEnForme(brut) : symbolesTexte(brut);
      if (!lu) break;
      let [x, y, a, ah, av] = [nombre(e, 10), nombre(e, 20), nombre(e, 50), 0, 0];
      if (e.type !== 'MTEXT') {
        ah = Math.min(nombre(e, 72), 2);
        av = nombre(e, e.type === 'ATTRIB' ? 74 : 73);
        if (ah !== 0 || av !== 0) [x, y] = [nombre(e, 11, x), nombre(e, 21, y)];
      } else {
        const att = nombre(e, 71, 1);
        ah = (att - 1) % 3;
        av = [3, 2, 1][Math.floor((att - 1) / 3)];
        if (valeur(e, 11) !== undefined) a = (Math.atan2(nombre(e, 21), nombre(e, 11)) * 180) / Math.PI;
      }
      const [xp, yp] = P(x, y);
      prims.push({ g: 't', k, x: xp, y: yp, h: nombre(e, 40, 1) * ech, a: a + (Math.atan2(t.c, t.a) * 180) / Math.PI, t: lu, ah, av });
      break;
    }
    case 'INSERT': {
      const nom = valeur(e, 2, '');
      const bloc = blocs.get(nom);
      if (!bloc || prof >= PROFONDEUR || /^MENSURA_LEADER/i.test(nom)) break;
      const [sx, sy] = [nombre(e, 41, 1), nombre(e, 42, 1)];
      const rot = (nombre(e, 50) * Math.PI) / 180;
      const [c, s] = [Math.cos(rot), Math.sin(rot)];
      const local = { a: c * sx, b: -s * sy, c: s * sx, d: c * sy, e: 0, f: 0 };
      const [bx, by] = appliquer(local, bloc.base.x, bloc.base.y);
      local.e = nombre(e, 10) - bx;
      local.f = nombre(e, 20) - by;
      const total = composer(t, local);
      const kb = k === DU_BLOC ? couleurBloc : k;
      // Les attributs de l'insertion (ATTRIB qui suivent l'INSERT) sont lus à leur tour, déjà à leur place.
      for (const sous of bloc.entites) ajouter(prims, sous, blocs, calques, total, prof + 1, kb);
      break;
    }
    default:
      break; // POINT, DIMENSION, ATTDEF, VIEWPORT… : pas dessinés
  }
}

/** Primitive arrondie au mm (textes et cercles compris). */
function arrondir(p) {
  if (p.g === 'l') return { ...p, p: p.p.flatMap(([x, y]) => [mm(x), mm(y)]) };
  if (p.g === 'h') return { ...p, p: p.p.map((c) => c.flatMap(([x, y]) => [mm(x), mm(y)])) };
  if (p.g === 'c') return { ...p, x: mm(p.x), y: mm(p.y), r: mm(p.r) };
  return { ...p, x: mm(p.x), y: mm(p.y), h: mm(p.h), a: Math.round(p.a * 100) / 100 };
}

/** Bornes { xMin, yMin, xMax, yMax } de primitives (points [x, y] ou listes plates). */
export function bornesPrimitives(prims) {
  let [xMin, yMin, xMax, yMax] = [Infinity, Infinity, -Infinity, -Infinity];
  const v = (x, y) => {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  };
  const liste = (l) => {
    if (Array.isArray(l[0])) for (const [x, y] of l) v(x, y);
    else for (let i = 0; i + 1 < l.length; i += 2) v(l[i], l[i + 1]);
  };
  for (const p of prims) {
    if (p.g === 'l') liste(p.p);
    else if (p.g === 'h') p.p.forEach(liste);
    else if (p.g === 'c') {
      v(p.x - p.r, p.y - p.r);
      v(p.x + p.r, p.y + p.r);
    } else if (p.g === 't') v(p.x, p.y);
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/** Déplace des primitives (listes plates) de (dx, dy) : pour mettre le point de base au centre du bloc. */
export function deplacerPrimitives(prims, dx, dy) {
  const plat = (l) => l.map((v, i) => mm(v + (i % 2 ? dy : dx)));
  return prims.map((p) => {
    if (p.g === 'l') return { ...p, p: plat(p.p) };
    if (p.g === 'h') return { ...p, p: p.p.map(plat) };
    return { ...p, x: mm(p.x + dx), y: mm(p.y + dy) };
  });
}
