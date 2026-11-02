// Vue 3D simple (0.99.0, Expert, sans bibliothèque) : les triangles des levés et des surfaces montrés
// sur le plan, colorés selon l'altitude et ombrés, dessinés sur un canvas du plus loin au plus près
// (« algorithme du peintre »). On tourne au doigt (glisser : autour ; haut / bas : inclinaison),
// on zoome (deux doigts ou molette) ; une réglette exagère les hauteurs (×1 à ×5).
// Coordonnées : Est, Nord, altitude (m, MN95).
import { couleurRVB } from './couleurs.js';
import { plageAltitudes } from '../topo/courbes.js';
import { echapper } from '../outils/echapper.js';
import { mini, maxi } from '../outils/bornes.js';

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

/** Dessine les triangles sur le canvas (contexte 2D), du plus loin au plus près. */
export function dessinerScene(contexte, triangles, vue, plage) {
  contexte.fillStyle = '#e5ecf2';
  contexte.fillRect(0, 0, vue.largeur, vue.hauteur);
  const projetes = triangles.map((t) => {
    const sommets = t.map((p) => projeter(p, vue));
    return { t, sommets, profondeur: (sommets[0].profondeur + sommets[1].profondeur + sommets[2].profondeur) / 3 };
  });
  projetes.sort((a, b) => b.profondeur - a.profondeur);
  for (const { t, sommets } of projetes) {
    const milieu = ((t[0].altitude ?? 0) + (t[1].altitude ?? 0) + (t[2].altitude ?? 0)) / 3;
    const lumiere = eclairage(t, vue.exageration);
    const [r, g, b] = couleurRVB(milieu, plage).map((c) => Math.round(c * lumiere));
    contexte.fillStyle = `rgb(${r}, ${g}, ${b})`;
    contexte.strokeStyle = contexte.fillStyle;
    contexte.beginPath();
    contexte.moveTo(sommets[0].x, sommets[0].y);
    contexte.lineTo(sommets[1].x, sommets[1].y);
    contexte.lineTo(sommets[2].x, sommets[2].y);
    contexte.closePath();
    contexte.fill();
    contexte.stroke();
  }
}

/** Ouvre la fenêtre 3D avec ces triangles ([[p, q, r]]) et leur titre. */
export function ouvrirVue3d(triangles, titre = 'Vue 3D') {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-3d';
  fenetre.innerHTML = `
    <div class="entete-3d">
      <strong>${echapper(titre)}</strong>
      <label>Hauteurs ×<span data-vivant="exageration">2</span>
        <input type="range" min="1" max="5" step="0.5" value="2" data-champ="exageration" /></label>
      <button type="button" class="bouton" data-action="fermer">Fermer</button>
    </div>
    ${triangles.length === 0 ? '<p class="vide">Aucun levé ni surface avec des triangles sur le plan.</p>' : '<canvas class="toile-3d"></canvas>'}`;
  document.body.append(fenetre);
  fenetre.addEventListener('close', () => fenetre.remove());
  fenetre.querySelector('[data-action="fermer"]').addEventListener('click', () => fenetre.close());
  fenetre.showModal();
  const toile = fenetre.querySelector('canvas');
  if (!toile) return;

  const { centre, taille } = cadreScene(triangles);
  const plage = plageAltitudes(triangles);
  const vue = { azimut: 0, inclinaison: 35, exageration: 2, centre, echelle: 1, largeur: 0, hauteur: 0 };
  let zoom = 1;
  const dessiner = () => {
    const rectangle = toile.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    toile.width = Math.round(rectangle.width * ratio);
    toile.height = Math.round(rectangle.height * ratio);
    vue.largeur = toile.width;
    vue.hauteur = toile.height;
    vue.echelle = (0.75 * Math.min(vue.largeur, vue.hauteur) / taille) * zoom;
    dessinerScene(toile.getContext('2d'), triangles, vue, plage);
  };
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
