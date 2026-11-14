// Coupes des réseaux, dessinées en SVG (texte) : en travers (le tuyau est un cercle, avec sa tranchée) et dans l'axe
// (le tuyau est une bande qui suit la pente). Rien ici ne touche l'écran : tout est testé.
// Unités : m. Dans la coupe en travers, x = distance depuis le bord gauche de la coupe ; dans l'axe, d = distance depuis
// le début du réseau. Les altitudes sont des z.
import { couleurDuType, formeTranchee, pentesDesSegments, longueurReseau, HAUTEUR_SANS_SURFACE } from '../topo/reseau.js';
import { echapper } from '../outils/echapper.js';

const f = (v) => v.toFixed(1);
const nombre3 = (v) => v.toFixed(3);

/** Échelle et décalage pour faire tenir x ∈ [x0, x1] et z ∈ [z0, z1] dans largeur × hauteur (marges comprises). */
function cadre({ x0, x1, z0, z1, largeur, hauteur, marge = 12, exageration = 1 }) {
  const sx = (largeur - 2 * marge) / Math.max(x1 - x0, 1e-6);
  const sz = Math.min(sx * exageration, (hauteur - 2 * marge) / Math.max(z1 - z0, 1e-6));
  // Si la hauteur limite, x est réduit aussi pour que l'exagération demandée soit gardée.
  const sxFinal = exageration >= 1 ? Math.min(sx, sz / exageration) : sx;
  return {
    X: (x) => marge + (x - x0) * sxFinal + (largeur - 2 * marge - (x1 - x0) * sxFinal) / 2,
    Z: (z) => hauteur - marge - (z - z0) * sz,
    sx: sxFinal,
    sz,
  };
}

/**
 * Coupe en travers. coupe : résultat de coupeEnTravers ; terrain : [{ x, z }] (profil de la surface le long de la coupe,
 * peut être vide) ; terrainEn(x) : altitude du terrain ou null ; options : { largeur, hauteur }.
 * Renvoie le SVG (texte).
 */
export function svgCoupeEnTravers({ coupe, terrain = [], terrainEn = null, largeur = 720, hauteur = 320 }) {
  if (!coupe) return '';
  const largeurCoupe = 2 * coupe.demiLargeur;
  const formes = coupe.tuyaux.filter((t) => t.reseau.tranchee).map((t) => ({ t, forme: formeTranchee(t.x, t.fe, t.reseau.tranchee, terrainEn) }));
  const zs = [
    ...coupe.tuyaux.flatMap((t) => [t.fe, t.fe + t.reseau.diametre]),
    ...formes.flatMap(({ forme }) => forme.map((p) => p.z)),
    ...terrain.map((p) => p.z),
  ];
  const xs = [0, largeurCoupe, ...formes.flatMap(({ forme }) => forme.map((p) => p.x))];
  const z0 = Math.min(...zs, ...formes.map(({ t }) => t.fe - t.reseau.tranchee.hauteur)) - 0.3;
  const z1 = Math.max(...zs) + 0.3;
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const c = cadre({ x0, x1, z0, z1, largeur, hauteur });
  const pts = (liste) => liste.map((p) => `${f(c.X(p.x))},${f(c.Z(p.z))}`).join(' ');
  let s = `<svg class="svg-coupe-reseau" viewBox="0 0 ${largeur} ${hauteur}" width="100%" role="img" aria-label="Coupe en travers">`;
  // Tranchées d'abord (sous les tuyaux).
  for (const { t, forme } of formes) {
    s += `<polygon class="tranchee-coupe" points="${pts(forme)}" data-reseau="${echapper(t.reseau.id)}" />`;
  }
  if (terrain.length > 1) s += `<polyline class="terrain-coupe" points="${pts(terrain)}" />`;
  // La ligne de la canne : au milieu, celle du réseau choisi.
  for (const t of coupe.tuyaux) {
    const r = t.reseau;
    const couleur = couleurDuType(r.type);
    const rayon = Math.max(3, (r.diametre / 2) * c.sx);
    const cx = c.X(t.x);
    const cy = c.Z(t.fe + r.diametre / 2);
    s += `<circle class="tuyau-coupe" cx="${f(cx)}" cy="${f(cy)}" r="${f(rayon)}" style="stroke:${couleur};fill:${couleur}33" data-reseau="${echapper(r.id)}" />`;
    s += `<circle class="fe-coupe" cx="${f(cx)}" cy="${f(c.Z(t.fe))}" r="3" />`;
    s += `<text class="texte-coupe" x="${f(cx + rayon + 4)}" y="${f(cy - rayon - 2)}" style="fill:${couleur}">${echapper(r.nom)} · Ø${Math.round(r.diametre * 1000)} · FE ${nombre3(t.fe)}</text>`;
  }
  s += '</svg>';
  return s;
}

/** Facteur d'exagération des hauteurs pour la coupe dans l'axe (1, 2, 3, 5, 10, 20) : le plus grand qui tient. */
export function exagerationAuto(longueur, zmin, zmax, largeur = 720, hauteur = 300) {
  const sx = (largeur - 24) / Math.max(longueur, 1e-6);
  const span = Math.max(zmax - zmin, 1e-6);
  let choisi = 1;
  for (const e of [1, 2, 3, 5, 10, 20]) if (span * sx * e <= hauteur - 24) choisi = e;
  return choisi;
}

/**
 * Coupe dans l'axe d'un réseau. terrain : liste de morceaux [[{ d, z }]] (profil de la surface le long du réseau) ;
 * croisements : [{ reseau, d, fe }] ; position : { d, fe } de la canne ou null.
 * Renvoie { svg, exageration }.
 */
export function svgCoupeAxe({ reseau, terrain = [], croisements = [], position = null, largeur = 720, hauteur = 300 }) {
  const L = longueurReseau(reseau);
  const t = reseau.tranchee;
  const sommetsD = [];
  let cumul = 0;
  reseau.sommets.forEach((s, i) => {
    if (i > 0) cumul += Math.hypot(s.est - reseau.sommets[i - 1].est, s.nord - reseau.sommets[i - 1].nord);
    sommetsD.push({ d: cumul, fe: s.fe });
  });
  const zs = [
    ...sommetsD.flatMap((s) => [s.fe, s.fe + reseau.diametre, ...(t ? [s.fe - t.hauteur] : []), ...(t && terrain.length === 0 ? [s.fe + HAUTEUR_SANS_SURFACE] : [])]),
    ...terrain.flat().map((p) => p.z),
  ];
  const zmin = Math.min(...zs) - 0.2;
  const zmax = Math.max(...zs) + 0.2;
  const exageration = exagerationAuto(L, zmin, zmax, largeur, hauteur);
  const c = cadre({ x0: 0, x1: L, z0: zmin, z1: zmax, largeur, hauteur, exageration });
  const P = (d, z) => `${f(c.X(d))},${f(c.Z(z))}`;
  const couleur = couleurDuType(reseau.type);
  let s = `<svg class="svg-coupe-reseau" viewBox="0 0 ${largeur} ${hauteur}" width="100%" role="img" aria-label="Coupe dans l'axe">`;
  // Tranchée : entre le fond et le terrain (ou FE + 1,5 m sans surface).
  if (t) {
    const haut = terrain.length > 0 ? terrain.flat() : sommetsD.map((p) => ({ d: p.d, z: p.fe + HAUTEUR_SANS_SURFACE }));
    const fond = sommetsD.map((p) => ({ d: p.d, z: p.fe - t.hauteur }));
    s += `<polygon class="tranchee-coupe" points="${[...haut.map((p) => P(p.d, p.z)), ...[...fond].reverse().map((p) => P(p.d, p.z))].join(' ')}" />`;
    s += `<polyline class="fond-tranchee-coupe" points="${fond.map((p) => P(p.d, p.z)).join(' ')}" />`;
  }
  for (const morceau of terrain) s += `<polyline class="terrain-coupe" points="${morceau.map((p) => P(p.d, p.z)).join(' ')}" />`;
  // Tuyau : la bande entre le FE et le FE + diamètre.
  const bas = sommetsD.map((p) => P(p.d, p.fe));
  const haut = [...sommetsD].reverse().map((p) => P(p.d, p.fe + reseau.diametre));
  s += `<polygon class="tuyau-coupe" points="${[...bas, ...haut].join(' ')}" style="stroke:${couleur};fill:${couleur}33" />`;
  // Réseaux qui croisent : un petit rectangle de la largeur du tuyau.
  for (const x of croisements) {
    const dm = Math.max(0.1, x.reseau.diametre);
    const col = couleurDuType(x.reseau.type);
    s += `<rect class="tuyau-coupe" x="${f(c.X(x.d) - 6)}" y="${f(c.Z(x.fe + dm))}" width="12" height="${f(Math.max(3, dm * c.sz))}" style="stroke:${col};fill:${col}55" />`;
    s += `<text class="texte-coupe" x="${f(c.X(x.d) + 9)}" y="${f(c.Z(x.fe + dm) - 3)}" style="fill:${col}">${echapper(x.reseau.nom)}</text>`;
  }
  // Sommets : un point de FE avec sa valeur.
  sommetsD.forEach((p, i) => {
    s += `<circle class="fe-coupe" cx="${f(c.X(p.d))}" cy="${f(c.Z(p.fe))}" r="4" />`;
    const bord = i === sommetsD.length - 1 ? -1 : 1;
    s += `<text class="texte-coupe" x="${f(c.X(p.d) + 5 * bord)}" y="${f(c.Z(p.fe) + 16)}" text-anchor="${bord < 0 ? 'end' : 'start'}" style="fill:${couleur}">${nombre3(p.fe)}</text>`;
  });
  // Pente de chaque segment, au milieu.
  pentesDesSegments(reseau).forEach((pente, i) => {
    if (pente == null) return;
    const dm = (sommetsD[i].d + sommetsD[i + 1].d) / 2;
    const zm = (sommetsD[i].fe + sommetsD[i + 1].fe) / 2 - reseau.diametre;
    s += `<text class="pente-coupe" x="${f(c.X(dm))}" y="${f(c.Z(zm) + 14)}" text-anchor="middle">${pente >= 0 ? '↗ +' : '↘ −'}${Math.abs(pente).toFixed(2)} %</text>`;
  });
  if (position) s += `<circle class="canne-coupe" cx="${f(c.X(position.d))}" cy="${f(c.Z(position.fe))}" r="7" />`;
  s += '</svg>';
  return { svg: s, exageration };
}
