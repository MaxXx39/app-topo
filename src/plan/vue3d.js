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
  return { x: vue.largeur / 2 + x * vue.echelle, y: vue.hauteur / 2 - ecranY * vue.echelle, profondeur };
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
 * Dessine les triangles sur le canvas (contexte 2D), du plus loin au plus près.
 * options (0.126.0) : couleurs ('altitude' ou 'element' : triangles [{ t, element }]), transparent.
 */
export function dessinerScene(contexte, triangles, vue, plage, { couleurs = 'altitude', transparent = false, elementDe = null } = {}) {
  contexte.globalAlpha = 1;
  contexte.fillStyle = '#e5ecf2';
  contexte.fillRect(0, 0, vue.largeur, vue.hauteur);
  const projetes = triangles.map((t, n) => {
    const sommets = t.map((p) => projeter(p, vue));
    return { t, n, sommets, profondeur: (sommets[0].profondeur + sommets[1].profondeur + sommets[2].profondeur) / 3 };
  });
  projetes.sort((a, b) => b.profondeur - a.profondeur);
  contexte.globalAlpha = transparent ? 0.55 : 1;
  for (const { t, n, sommets } of projetes) {
    const milieu = ((t[0].altitude ?? 0) + (t[1].altitude ?? 0) + (t[2].altitude ?? 0)) / 3;
    const lumiere = eclairage(t, vue.exageration);
    const base = couleurs === 'element' && elementDe ? COULEURS_ELEMENTS[elementDe(n) % COULEURS_ELEMENTS.length] : couleurRVB(milieu, plage);
    const [r, g, b] = base.map((c) => Math.round(c * lumiere));
    contexte.fillStyle = `rgb(${r}, ${g}, ${b})`;
    contexte.strokeStyle = contexte.fillStyle;
    contexte.beginPath();
    contexte.moveTo(sommets[0].x, sommets[0].y);
    contexte.lineTo(sommets[1].x, sommets[1].y);
    contexte.lineTo(sommets[2].x, sommets[2].y);
    contexte.closePath();
    contexte.fill();
    if (!transparent) contexte.stroke();
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
export function ouvrirVue3d(elementsOuTriangles, titre = 'Vue 3D', { lignesDxf = [] } = {}) {
  const elements = Array.isArray(elementsOuTriangles[0]) ? [{ nom: titre, triangles: elementsOuTriangles }] : elementsOuTriangles.filter((e) => e.triangles.length > 0);
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
      <label>Hauteurs ×<span data-vivant="exageration">2</span>
        <input type="range" min="1" max="5" step="0.5" value="2" data-champ="exageration" /></label>
      <button type="button" class="bouton" data-action="fermer">Fermer</button>
    </div>
    <div class="outils-3d">
      <div class="bascule-3d" role="group" aria-label="Couleurs">
        <button type="button" class="puce-choix actif" data-couleurs="altitude">Altitude</button>
        ${elements.length > 1 ? '<button type="button" class="puce-choix" data-couleurs="element">Par élément</button>' : ''}
      </div>
      <label class="case"><input type="checkbox" data-champ="transparent" /> Transparent</label>
      ${lignesDxf.length > 0 ? '<label class="case"><input type="checkbox" data-champ="lignes-dxf" checked /> Lignes DXF</label>' : ''}
      <span class="zoom-3d">
        <button type="button" class="bouton-secondaire" data-action="zoom-moins" aria-label="Dézoomer">−</button>
        <button type="button" class="bouton-secondaire" data-action="zoom-plus" aria-label="Zoomer">+</button>
        <button type="button" class="bouton-secondaire" data-action="depart" title="Vue de départ">⟲ Départ</button>
      </span>
    </div>
    ${elements.length === 0 ? '<p class="vide">Aucun levé ni surface avec des triangles sur le plan.</p>' : '<canvas class="toile-3d"></canvas>'}`;
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
  let cadre = null;
  let plage = null;
  let drapees = [];
  let voirLignes = true;
  const vue = { azimut: 0, inclinaison: 35, exageration: 2, centre: null, echelle: 1, largeur: 0, hauteur: 0 };
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
    cadre = cadreScene(triangles);
    plage = plageAltitudes(triangles);
    vue.centre = cadre.centre;
    // 0.143.0 : lignes des plans DXF montrés, posées sur les triangles choisis.
    drapees = lignesDxf.length > 0 && triangles.length > 0 ? draperLignes(lignesDxf, chercheurAltitude(triangles), { pas: Math.max(0.5, cadre.taille / 400) }) : [];
  };
  const depart = () => {
    vue.azimut = 0;
    vue.inclinaison = 35;
    zoom = 1;
  };
  choisir();
  const dessiner = () => {
    const rectangle = toile.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    toile.width = Math.round(rectangle.width * ratio);
    toile.height = Math.round(rectangle.height * ratio);
    vue.largeur = toile.width;
    vue.hauteur = toile.height;
    vue.echelle = (0.75 * Math.min(vue.largeur, vue.hauteur) / cadre.taille) * zoom;
    const contexte = toile.getContext('2d');
    dessinerScene(contexte, triangles, vue, plage, { ...reglages, elementDe });
    if (voirLignes) dessinerLignes3d(contexte, drapees, vue, ratio);
    dessinerReperes(contexte, vue, ratio);
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
  fenetre.querySelector('[data-champ="transparent"]').addEventListener('change', (evenement) => {
    reglages.transparent = evenement.target.checked;
    dessiner();
  });
  fenetre.querySelector('[data-champ="exageration"]').addEventListener('input', (evenement) => {
    vue.exageration = Number(evenement.target.value);
    fenetre.querySelector('[data-vivant="exageration"]').textContent = String(vue.exageration);
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
    } else {
      vue.azimut = (vue.azimut + (evenement.clientX - avant.x) * 0.5) % 360;
      vue.inclinaison = Math.min(90, Math.max(5, vue.inclinaison + (evenement.clientY - avant.y) * 0.3));
      doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    }
    dessiner();
  });
  const lever = (evenement) => doigts.delete(evenement.pointerId);
  toile.addEventListener('pointerup', lever);
  toile.addEventListener('pointercancel', lever);
  toile.addEventListener('wheel', (evenement) => {
    evenement.preventDefault();
    zoom = Math.min(20, Math.max(0.2, zoom * (evenement.deltaY < 0 ? 1.15 : 1 / 1.15)));
    dessiner();
  }, { passive: false });
  requestAnimationFrame(dessiner);
}
