// Vue 3D simple (0.99.0, Expert, sans bibliothèque) : les triangles des levés et des surfaces montrés
// sur le plan, colorés selon l'altitude et ombrés, dessinés sur un canvas du plus loin au plus près
// (« algorithme du peintre »). On tourne au doigt (glisser : autour ; haut / bas : inclinaison),
// on zoome (deux doigts ou molette) ; une réglette exagère les hauteurs (×1 à ×5).
// Coordonnées : Est, Nord, altitude (m, MN95).
import { couleurRVB } from './couleurs.js';
import { plageAltitudes } from '../topo/courbes.js';
import { echapper } from '../outils/echapper.js';
import { mini, maxi } from '../outils/bornes.js';
import { draperLignes } from '../topo/drapage.js';
import { chercheurAltitude } from '../topo/implantation.js';
import { trianglesMaquette } from '../topo/ifc.js';

/** Centre (m) et taille (plus grand côté en plan, m) des triangles. */
export function cadreScene(triangles) {
  const points = triangles.flat();
  const est = points.map((p) => p.est);
  const nord = points.map((p) => p.nord);
  const alt = points.map((p) => p.altitude ?? 0);
  const centre = { est: (mini(est) + maxi(est)) / 2, nord: (mini(nord) + maxi(nord)) / 2, altitude: (mini(alt) + maxi(alt)) / 2 };
  return { centre, taille: Math.max(maxi(est) - mini(est), maxi(nord) - mini(nord), 1) };
}

/**
 * Projette un point (m) sur l'écran. vue : { azimut (°, d'où l'on regarde : 0 = depuis le sud),
 * inclinaison (°, 90 = vu de dessus), exageration, centre, echelle (pixels par m), largeur, hauteur }.
 * Renvoie { x, y, profondeur } (profondeur plus grande = plus loin).
 */
export function projeter(p, vue) {
  const a = (vue.azimut * Math.PI) / 180;
  const i = (vue.inclinaison * Math.PI) / 180;
  const dx = p.est - vue.centre.est;
  const dy = p.nord - vue.centre.nord;
  const dz = ((p.altitude ?? vue.centre.altitude) - vue.centre.altitude) * vue.exageration;
  // Rotation autour de la verticale : x vers la droite de l'écran, y vers le fond.
  const x = dx * Math.cos(a) - dy * Math.sin(a);
  const y = dx * Math.sin(a) + dy * Math.cos(a);
  // Inclinaison : le fond monte à l'écran, le haut aussi.
  const ecranY = y * Math.sin(i) + dz * Math.cos(i);
  const profondeur = y * Math.cos(i) - dz * Math.sin(i);
  return { x: vue.largeur / 2 + (vue.decalX ?? 0) + x * vue.echelle, y: vue.hauteur / 2 + (vue.decalY ?? 0) - ecranY * vue.echelle, profondeur };
}

/**
 * Éclairage d'un triangle (0.35 à 1) : lumière venant du nord-ouest et d'en haut, sur sa pente
 * (hauteurs exagérées comprises).
 */
export function eclairage([p, q, r], exageration) {
  const u = [q.est - p.est, q.nord - p.nord, ((q.altitude ?? 0) - (p.altitude ?? 0)) * exageration];
  const v = [r.est - p.est, r.nord - p.nord, ((r.altitude ?? 0) - (p.altitude ?? 0)) * exageration];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const longueur = Math.hypot(...n) || 1;
  n = n.map((c) => c / longueur);
  if (n[2] < 0) n = n.map((c) => -c);
  const lumiere = [-0.5, 0.5, 0.7071];
  return 0.35 + 0.65 * Math.max(0, n[0] * lumiere[0] + n[1] * lumiere[1] + n[2] * lumiere[2]);
}

// Couleurs « par élément » (0.126.0) : une couleur par levé / surface.
export const COULEURS_ELEMENTS = [[217, 119, 6], [37, 99, 235], [22, 163, 74], [124, 58, 237], [219, 39, 119], [8, 145, 178]];

/**
 * Vrai si les éléments sont loin les uns des autres (0.126.0) : deux centres séparés de plus de
 * 3 fois la taille du plus grand. La vue « Tout » les montrerait alors comme des traits illisibles.
 * elements : [{ triangles }].
 */
export function elementsEloignes(elements) {
  const cadres = elements.filter((e) => e.triangles.length > 0).map((e) => cadreScene(e.triangles));
  const plusGrand = Math.max(1, ...cadres.map((c) => c.taille));
  for (let i = 0; i < cadres.length; i++) {
    for (let j = i + 1; j < cadres.length; j++) {
      if (Math.hypot(cadres[i].centre.est - cadres[j].centre.est, cadres[i].centre.nord - cadres[j].centre.nord) > 3 * plusGrand) return true;
    }
  }
  return false;
}

/** Longueur « ronde » (1, 2 ou 5 × 10^n m) la plus proche de "metres" sans la dépasser (barre d'échelle). */
export function longueurRonde(metres) {
  if (!(metres > 0)) return 1;
  const puissance = 10 ** Math.floor(Math.log10(metres));
  const premier = metres / puissance;
  return (premier >= 5 ? 5 : premier >= 2 ? 2 : 1) * puissance;
}

/**
 * Direction du nord à l'écran (vecteur de longueur 1, y vers le bas) pour la flèche du nord :
 * vue depuis le sud (azimut 0), le nord est vers le haut.
 */
export function directionNord(vue) {
  const a = (vue.azimut * Math.PI) / 180;
  const i = (vue.inclinaison * Math.PI) / 180;
  const x = -Math.sin(a);
  const y = -Math.cos(a) * Math.sin(i);
  const longueur = Math.hypot(x, y) || 1;
  return { x: x / longueur, y: y / longueur };
}

/**
 * Prépare les triangles pour des dessins rapides (0.265.0 : la 3D avec une maquette IFC ramait) : coordonnées à plat,
 * couleur de chaque triangle déjà éclairée (texte « rgb(…) »), et numéros des triangles du plus grand au plus petit (pour
 * l'aperçu pendant un geste). À refaire seulement si les triangles, l'exagération ou les couleurs changent.
 * options : couleurs ('altitude' ou 'element'), elementDe(n), couleurDe(n) (couleur propre, ex. maquette IFC), exageration.
 */
export function preparerScene(triangles, plage, { couleurs = 'altitude', elementDe = null, couleurDe = null, exageration = 1 } = {}) {
  const n = triangles.length;
  const xyz = new Float64Array(9 * n);
  const teintes = new Array(n);
  const aires = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const t = triangles[k];
    for (let j = 0; j < 3; j++) {
      xyz[9 * k + 3 * j] = t[j].est;
      xyz[9 * k + 3 * j + 1] = t[j].nord;
      xyz[9 * k + 3 * j + 2] = t[j].altitude ?? 0;
    }
    const milieu = ((t[0].altitude ?? 0) + (t[1].altitude ?? 0) + (t[2].altitude ?? 0)) / 3;
    const lumiere = eclairage(t, exageration);
    const propre = couleurDe?.(k);
    const base = propre ?? (couleurs === 'element' && elementDe ? COULEURS_ELEMENTS[elementDe(k) % COULEURS_ELEMENTS.length] : couleurRVB(milieu, plage));
    teintes[k] = `rgb(${Math.round(base[0] * lumiere)}, ${Math.round(base[1] * lumiere)}, ${Math.round(base[2] * lumiere)})`;
    // Aire en 3D (m²) : pour garder les plus grands triangles dans l'aperçu.
    const ux = t[1].est - t[0].est; const uy = t[1].nord - t[0].nord; const uz = (t[1].altitude ?? 0) - (t[0].altitude ?? 0);
    const vx = t[2].est - t[0].est; const vy = t[2].nord - t[0].nord; const vz = (t[2].altitude ?? 0) - (t[0].altitude ?? 0);
    aires[k] = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  const parTaille = Uint32Array.from({ length: n }, (_, k) => k).sort((a, b) => aires[b] - aires[a]);
  return { n, xyz, teintes, parTaille };
}

// Nombre de « tiroirs » du tri par profondeur (tri en un passage : assez fin pour l'œil).
const TIROIRS = 4096;

/**
 * Dessine une scène préparée (voir preparerScene), du plus loin au plus près (« algorithme du peintre »).
 * - apercu : vrai pendant un geste : seulement les "max" plus grands triangles, sans lisere (beaucoup plus rapide) ;
 * - transparent : triangles à moitié transparents.
 * Les triangles de moins d'un quart de pixel ne sont pas dessinés (invisibles).
 */
export function dessinerScene(contexte, scene, vue, { transparent = false, apercu = false, max = 6000 } = {}) {
  contexte.globalAlpha = 1;
  contexte.fillStyle = '#e5ecf2';
  contexte.fillRect(0, 0, vue.largeur, vue.hauteur);
  const total = apercu ? Math.min(scene.n, max) : scene.n;
  if (total === 0) return;
  const a = (vue.azimut * Math.PI) / 180;
  const i = (vue.inclinaison * Math.PI) / 180;
  const [ca, sa, ci, si] = [Math.cos(a), Math.sin(a), Math.cos(i), Math.sin(i)];
  const { est: e0, nord: n0, altitude: z0 } = vue.centre;
  const ex = vue.exageration;
  const demiL = vue.largeur / 2 + (vue.decalX ?? 0); // 0.268.0 : déplacement à deux doigts
  const demiH = vue.hauteur / 2 + (vue.decalY ?? 0);
  const ech = vue.echelle;
  const ecran = new Float32Array(6 * total);
  const profondeurs = new Float32Array(total);
  const numeros = new Uint32Array(total);
  let garde = 0;
  let pMin = Infinity;
  let pMax = -Infinity;
  const xyz = scene.xyz;
  for (let r = 0; r < total; r++) {
    const k = apercu ? scene.parTaille[r] : r;
    let p = 0;
    for (let j = 0; j < 3; j++) {
      const o = 9 * k + 3 * j;
      const dx = xyz[o] - e0;
      const dy = xyz[o + 1] - n0;
      const dz = (xyz[o + 2] - z0) * ex;
      const x = dx * ca - dy * sa;
      const y = dx * sa + dy * ca;
      ecran[6 * garde + 2 * j] = demiL + x * ech;
      ecran[6 * garde + 2 * j + 1] = demiH - (y * si + dz * ci) * ech;
      p += y * ci - dz * si;
    }
    const b = 6 * garde;
    const aire = Math.abs((ecran[b + 2] - ecran[b]) * (ecran[b + 5] - ecran[b + 1]) - (ecran[b + 4] - ecran[b]) * (ecran[b + 3] - ecran[b + 1]));
    if (aire < 0.5) continue; // moins d'un quart de pixel : invisible
    profondeurs[garde] = p;
    numeros[garde] = k;
    if (p < pMin) pMin = p;
    if (p > pMax) pMax = p;
    garde++;
  }
  // Tri par profondeur en un passage (tiroirs), du plus loin au plus près.
  const comptes = new Uint32Array(TIROIRS + 1);
  const pas = pMax > pMin ? (TIROIRS - 1) / (pMax - pMin) : 0;
  const tiroir = new Uint16Array(garde);
  for (let r = 0; r < garde; r++) {
    tiroir[r] = TIROIRS - 1 - Math.floor((profondeurs[r] - pMin) * pas);
    comptes[tiroir[r] + 1]++;
  }
  for (let t = 1; t <= TIROIRS; t++) comptes[t] += comptes[t - 1];
  const ordre = new Uint32Array(garde);
  for (let r = 0; r < garde; r++) ordre[comptes[tiroir[r]]++] = r;
  contexte.globalAlpha = transparent ? 0.55 : 1;
  contexte.lineWidth = 1;
  const lisere = !transparent && !apercu;
  let teinte = '';
  for (let q = 0; q < garde; q++) {
    const r = ordre[q];
    const b = 6 * r;
    const couleur = scene.teintes[numeros[r]];
    if (couleur !== teinte) {
      teinte = couleur;
      contexte.fillStyle = couleur;
      if (lisere) contexte.strokeStyle = couleur;
    }
    contexte.beginPath();
    contexte.moveTo(ecran[b], ecran[b + 1]);
    contexte.lineTo(ecran[b + 2], ecran[b + 3]);
    contexte.lineTo(ecran[b + 4], ecran[b + 5]);
    contexte.closePath();
    contexte.fill();
    if (lisere) contexte.stroke(); // cache les fines lignes claires entre triangles voisins
  }
  contexte.globalAlpha = 1;
}

/** Lignes DXF posées sur la surface (0.143.0) : un trait de leur couleur, juste au-dessus des triangles. */
export function dessinerLignes3d(contexte, morceaux, vue, ratio = 1) {
  contexte.lineWidth = 2 * ratio;
  contexte.lineJoin = 'round';
  for (const morceau of morceaux) {
    contexte.strokeStyle = morceau.couleur;
    contexte.beginPath();
    morceau.points.forEach((p, i) => {
      const e = projeter({ ...p, altitude: p.altitude + 0.05 }, vue);
      if (i === 0) contexte.moveTo(e.x, e.y);
      else contexte.lineTo(e.x, e.y);
    });
    contexte.stroke();
  }
  contexte.lineWidth = 1;
}

/** Flèche du nord (en haut à droite) et barre d'échelle (en bas à gauche), par-dessus la scène. */
function dessinerReperes(contexte, vue, ratio) {
  const nord = directionNord(vue);
  const cx = vue.largeur - 34 * ratio;
  const cy = 34 * ratio;
  const l = 13 * ratio;
  contexte.save();
  contexte.fillStyle = 'rgba(255, 255, 255, 0.85)';
  contexte.beginPath();
  contexte.arc(cx, cy, 26 * ratio, 0, Math.PI * 2);
  contexte.fill();
  // Flèche : pointe rouge vers le nord, queue grise.
  const px = -nord.y;
  const py = nord.x;
  contexte.fillStyle = '#dc2626';
  contexte.beginPath();
  contexte.moveTo(cx + nord.x * l, cy + nord.y * l);
  contexte.lineTo(cx + px * 7 * ratio, cy + py * 7 * ratio);
  contexte.lineTo(cx - px * 7 * ratio, cy - py * 7 * ratio);
  contexte.fill();
  contexte.fillStyle = '#6b7280';
  contexte.beginPath();
  contexte.moveTo(cx - nord.x * l, cy - nord.y * l);
  contexte.lineTo(cx + px * 7 * ratio, cy + py * 7 * ratio);
  contexte.lineTo(cx - px * 7 * ratio, cy - py * 7 * ratio);
  contexte.fill();
  contexte.fillStyle = '#111827';
  contexte.font = `bold ${11 * ratio}px sans-serif`;
  contexte.textAlign = 'center';
  contexte.textBaseline = 'middle';
  contexte.fillText('N', cx + nord.x * 20 * ratio, cy + nord.y * 20 * ratio);
  // Échelle : longueur ronde d'environ 120 px, mesurée à l'horizontale au centre de la scène.
  const metres = longueurRonde((120 * ratio) / vue.echelle);
  const pixels = metres * vue.echelle;
  const x0 = 14 * ratio;
  const y0 = vue.hauteur - 16 * ratio;
  contexte.strokeStyle = '#111827';
  contexte.lineWidth = 2 * ratio;
  contexte.beginPath();
  contexte.moveTo(x0, y0 - 5 * ratio);
  contexte.lineTo(x0, y0);
  contexte.lineTo(x0 + pixels, y0);
  contexte.lineTo(x0 + pixels, y0 - 5 * ratio);
  contexte.stroke();
  contexte.textAlign = 'left';
  contexte.textBaseline = 'bottom';
  contexte.font = `${12 * ratio}px sans-serif`;
  contexte.fillText(`${metres >= 1 ? metres : metres.toFixed(2)} m (au centre)`, x0, y0 - 6 * ratio);
  contexte.restore();
}

/**
 * Ouvre la fenêtre 3D. elements : [{ nom, triangles: [[p, q, r]] }] (0.126.0 ; une simple liste
 * de triangles marche encore). On choisit l'élément à voir (« Tout » ou un seul : un seul au départ
 * si les éléments sont loin les uns des autres), les couleurs (altitude ou par élément), la
 * transparence, le zoom (+ / −, doigts, molette) et « Vue de départ ».
 */
const GRIS_IFC = [150, 156, 164];

export function ouvrirVue3d(elementsOuTriangles, titre = 'Vue 3D', { lignesDxf = [], maquettes = [], altitudeCoupe = null } = {}) {
  const surfaces = Array.isArray(elementsOuTriangles[0]) ? [{ nom: titre, triangles: elementsOuTriangles }] : elementsOuTriangles.filter((e) => e.triangles.length > 0);
  // Maquettes IFC (0.264.0, Intermédiaire) : un élément par maquette, chaque triangle à la couleur de son type ; « Couper » enlève
  // tout ce qui est au-dessus de l'altitude de la coupe IFC (choisie dans Plan). maquettes : [{ nom, maquette, cachees (calques décochés) }].
  let couper = false;
  const elementsIfc = () => maquettes.map((m) => {
    const morceaux = trianglesMaquette(m.maquette, { cachees: m.cachees, haut: couper ? altitudeCoupe : null });
    // 0.268.0 (demande du 17.11) : l'IFC est tout gris (l'éclairage garde le relief) ; les couleurs par type restent sur le plan.
    return { nom: `IFC « ${m.nom} »`, ifc: true, triangles: morceaux.map((x) => x.t), couleurs: morceaux.map(() => GRIS_IFC) };
  }).filter((e) => e.triangles.length > 0 || couper);
  let elements = [...surfaces, ...elementsIfc()];
  // Hauteurs à l'échelle (×1) quand il y a une maquette IFC (sinon le bâtiment est étiré) ; ×2 pour un terrain seul.
  const exagerationDepart = maquettes.length > 0 ? 1 : 2;
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-3d';
  const options = elements.length > 1
    ? `<select data-champ="element-3d" aria-label="Élément à voir">
        <option value="tout">Tout</option>
        ${elements.map((e, i) => `<option value="${i}">${echapper(e.nom)}</option>`).join('')}
      </select>`
    : `<strong>${echapper(elements[0]?.nom ?? titre)}</strong>`;
  fenetre.innerHTML = `
    <div class="entete-3d">
      ${options}
      <label>Hauteurs ×<span data-vivant="exageration">${exagerationDepart}</span>
        <input type="range" min="1" max="5" step="0.5" value="${exagerationDepart}" data-champ="exageration" /></label>
      <button type="button" class="bouton" data-action="fermer">Fermer</button>
    </div>
    <div class="outils-3d">
      <div class="bascule-3d" role="group" aria-label="Couleurs">
        <button type="button" class="puce-choix actif" data-couleurs="altitude">Altitude</button>
        ${elements.length > 1 ? '<button type="button" class="puce-choix" data-couleurs="element">Par élément</button>' : ''}
      </div>
      <label class="case"><input type="checkbox" data-champ="transparent" /> Transparent</label>
      ${lignesDxf.length > 0 ? '<label class="case"><input type="checkbox" data-champ="lignes-dxf" checked /> Lignes DXF</label>' : ''}
      ${maquettes.length > 0 && altitudeCoupe != null ? `<label class="case"><input type="checkbox" data-champ="couper-ifc" /> Couper l'IFC à ${altitudeCoupe.toFixed(2)}</label>` : ''}
      <span class="zoom-3d">
        <button type="button" class="bouton-secondaire" data-action="zoom-moins" aria-label="Dézoomer">−</button>
        <button type="button" class="bouton-secondaire" data-action="zoom-plus" aria-label="Zoomer">+</button>
        <button type="button" class="bouton-secondaire" data-action="depart" title="Vue de départ">⟲ Départ</button>
      </span>
    </div>
    ${elements.length === 0 ? '<p class="vide">Aucun levé, surface ni maquette IFC avec des triangles sur le plan.</p>' : '<canvas class="toile-3d"></canvas>'}`;
  document.body.append(fenetre);
  fenetre.addEventListener('close', () => fenetre.remove());
  fenetre.querySelector('[data-action="fermer"]').addEventListener('click', () => fenetre.close());
  fenetre.showModal();
  const toile = fenetre.querySelector('canvas');
  if (!toile) return;

  // Ce qui est montré : tous les éléments, ou un seul (le premier au départ s'ils sont éloignés).
  let choix = elements.length > 1 && elementsEloignes(elements) ? 0 : 'tout';
  const selecteur = fenetre.querySelector('[data-champ="element-3d"]');
  if (selecteur) selecteur.value = String(choix);
  let triangles = [];
  let elementDe = () => 0;
  let couleurDe = () => null;
  let scene = null; // triangles préparés (preparerScene), refaits si les triangles, l'exagération ou les couleurs changent
  let enGeste = false;
  let imagePrevue = false;
  let minuterieComplete = null;
  let cadre = null;
  let plage = null;
  let drapees = [];
  let voirLignes = true;
  const vue = { azimut: 0, inclinaison: 35, exageration: exagerationDepart, centre: null, echelle: 1, largeur: 0, hauteur: 0 };
  const reglages = { couleurs: 'altitude', transparent: false };
  let zoom = 1;
  const choisir = () => {
    const montres = choix === 'tout' ? elements.map((e, i) => ({ e, i })) : [{ e: elements[choix], i: choix }];
    triangles = montres.flatMap(({ e }) => e.triangles);
    const debuts = [];
    let n = 0;
    for (const { e, i } of montres) {
      debuts.push({ fin: n + e.triangles.length, i });
      n += e.triangles.length;
    }
    elementDe = (rang) => debuts.find((d) => rang < d.fin)?.i ?? 0;
    // Couleur propre de chaque triangle (maquette IFC), null pour une surface (couleur d'altitude ou par élément).
    const couleursTri = montres.flatMap(({ e }) => e.couleurs ?? e.triangles.map(() => null));
    couleurDe = (rang) => couleursTri[rang];
    const terrain = montres.filter(({ e }) => !e.ifc).flatMap(({ e }) => e.triangles);
    cadre = cadreScene(triangles.length > 0 ? triangles : terrain);
    // Couleurs d'altitude et lignes DXF : seulement sur les surfaces (pas sur le bâtiment).
    plage = plageAltitudes(terrain.length > 0 ? terrain : triangles);
    vue.centre = cadre.centre;
    // 0.143.0 : lignes des plans DXF montrés, posées sur les triangles choisis.
    drapees = lignesDxf.length > 0 && terrain.length > 0 ? draperLignes(lignesDxf, chercheurAltitude(terrain), { pas: Math.max(0.5, cadre.taille / 400) }) : [];
    scene = null; // à préparer au prochain dessin
  };
  const depart = () => {
    vue.azimut = 0;
    vue.inclinaison = 35;
    vue.decalX = 0;
    vue.decalY = 0;
    zoom = 1;
  };
  choisir();
  const preparer = () => {
    scene = preparerScene(triangles, plage, { couleurs: reglages.couleurs, elementDe, couleurDe, exageration: vue.exageration });
  };
  // Dessin d'une image. 0.265.0 : pendant un geste (doigt posé), un aperçu (les plus grands triangles) ; le dessin complet
  // vient 150 ms après le dernier mouvement. Le canvas ne change de taille que si la fenêtre a changé.
  const dessinerMaintenant = () => {
    imagePrevue = false;
    const rectangle = toile.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const largeur = Math.round(rectangle.width * ratio);
    const hauteur = Math.round(rectangle.height * ratio);
    if (toile.width !== largeur || toile.height !== hauteur) {
      toile.width = largeur;
      toile.height = hauteur;
    }
    vue.largeur = toile.width;
    vue.hauteur = toile.height;
    vue.echelle = (0.75 * Math.min(vue.largeur, vue.hauteur) / cadre.taille) * zoom;
    if (!scene) preparer();
    const contexte = toile.getContext('2d');
    dessinerScene(contexte, scene, vue, { transparent: reglages.transparent, apercu: enGeste });
    if (voirLignes) dessinerLignes3d(contexte, drapees, vue, ratio);
    dessinerReperes(contexte, vue, ratio);
  };
  // Un seul dessin par image affichée, même si le doigt envoie plusieurs mouvements entre deux images.
  const dessiner = () => {
    if (!imagePrevue) {
      imagePrevue = true;
      requestAnimationFrame(dessinerMaintenant);
    }
  };
  // Pendant un geste : aperçu tout de suite ; dessin complet quand le doigt est levé (molette : 150 ms après le dernier cran).
  const dessinerEnGeste = () => {
    enGeste = true;
    dessiner();
    clearTimeout(minuterieComplete);
    if (doigts.size === 0) minuterieComplete = setTimeout(finirGeste, 150);
  };
  const finirGeste = () => {
    if (!enGeste) return;
    enGeste = false;
    dessiner();
  };
  selecteur?.addEventListener('change', () => {
    choix = selecteur.value === 'tout' ? 'tout' : Number(selecteur.value);
    choisir();
    depart();
    dessiner();
  });
  fenetre.querySelector('.outils-3d').addEventListener('click', (evenement) => {
    const couleurs = evenement.target.closest('[data-couleurs]')?.dataset.couleurs;
    if (couleurs) {
      reglages.couleurs = couleurs;
      scene = null;
      for (const b of fenetre.querySelectorAll('[data-couleurs]')) b.classList.toggle('actif', b.dataset.couleurs === couleurs);
    }
    const action = evenement.target.closest('[data-action]')?.dataset.action;
    if (action === 'zoom-plus') zoom = Math.min(20, zoom * 1.4);
    if (action === 'zoom-moins') zoom = Math.max(0.2, zoom / 1.4);
    if (action === 'depart') depart();
    if (couleurs || action) dessiner();
  });
  fenetre.querySelector('[data-champ="lignes-dxf"]')?.addEventListener('change', (evenement) => {
    voirLignes = evenement.target.checked;
    dessiner();
  });
  // Couper l'IFC (0.264.0) : on refait les triangles des maquettes, sans changer la vue (ni le centre, ni le zoom).
  fenetre.querySelector('[data-champ="couper-ifc"]')?.addEventListener('change', (evenement) => {
    couper = evenement.target.checked;
    elements = [...surfaces, ...elementsIfc()];
    const centre = vue.centre;
    const taille = cadre?.taille;
    choisir();
    vue.centre = centre;
    if (taille) cadre.taille = taille;
    dessiner();
  });
  fenetre.querySelector('[data-champ="transparent"]').addEventListener('change', (evenement) => {
    reglages.transparent = evenement.target.checked;
    dessiner();
  });
  fenetre.querySelector('[data-champ="exageration"]').addEventListener('input', (evenement) => {
    vue.exageration = Number(evenement.target.value);
    fenetre.querySelector('[data-vivant="exageration"]').textContent = String(vue.exageration);
    scene = null; // l'éclairage dépend de l'exagération
    dessiner();
  });
  // Un doigt : tourner (gauche / droite) et incliner (haut / bas) ; deux doigts : zoomer.
  const doigts = new Map();
  toile.addEventListener('pointerdown', (evenement) => {
    toile.setPointerCapture(evenement.pointerId);
    doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
  });
  toile.addEventListener('pointermove', (evenement) => {
    const avant = doigts.get(evenement.pointerId);
    if (!avant) return;
    if (doigts.size >= 2) {
      const [a, b] = [...doigts.values()];
      const ecartAvant = Math.hypot(a.x - b.x, a.y - b.y);
      doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
      const [c, d] = [...doigts.values()];
      const ecartApres = Math.hypot(c.x - d.x, c.y - d.y);
      if (ecartAvant > 0) zoom = Math.min(20, Math.max(0.2, zoom * (ecartApres / ecartAvant)));
      // Déplacer : le milieu des deux doigts entraîne la vue (en pixels du canvas).
      const ratioEcran = toile.width / Math.max(1, toile.getBoundingClientRect().width);
      vue.decalX = (vue.decalX ?? 0) + (((c.x + d.x) - (a.x + b.x)) / 2) * ratioEcran;
      vue.decalY = (vue.decalY ?? 0) + (((c.y + d.y) - (a.y + b.y)) / 2) * ratioEcran;
    } else {
      vue.azimut = (vue.azimut + (evenement.clientX - avant.x) * 0.5) % 360;
      vue.inclinaison = Math.min(90, Math.max(5, vue.inclinaison + (evenement.clientY - avant.y) * 0.3));
      doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    }
    dessinerEnGeste();
  });
  const lever = (evenement) => {
    doigts.delete(evenement.pointerId);
    if (doigts.size === 0) finirGeste();
  };
  toile.addEventListener('pointerup', lever);
  toile.addEventListener('pointercancel', lever);
  toile.addEventListener('wheel', (evenement) => {
    evenement.preventDefault();
    zoom = Math.min(20, Math.max(0.2, zoom * (evenement.deltaY < 0 ? 1.15 : 1 / 1.15)));
    dessinerEnGeste();
  }, { passive: false });
  requestAnimationFrame(dessiner);
}
