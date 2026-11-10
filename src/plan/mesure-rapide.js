// Mesure rapide sur le plan (0.158.0) : les points choisis (rond violet + numéro, ou leur nom), les
// côtés (fermés dès 3 points, le côté de fermeture en pointillé), la longueur à plat de chaque côté
// écrite au milieu, le long du côté (jamais à l'envers), et la surface à plat au milieu de la figure.
import { formaterNombre } from '../topo/format.js';

/**
 * Dessine dans "groupe" (SVG). mesure : { points, cotes, ferme } (voir topo/mesure-rapide.js) ;
 * versEcran(est, nord) → { x, y } ; creer(type, attributs) : élément SVG.
 */
export function dessinerMesureRapide(groupe, mesure, versEcran, creer) {
  if (!mesure || mesure.points.length === 0) return;
  const ecran = mesure.points.map((p) => versEcran(p.est, p.nord));
  if (mesure.ferme) {
    groupe.append(creer('path', { d: `M${ecran.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`, class: 'fond-mesure-rapide' }));
  }
  for (const c of mesure.cotes) {
    const a = ecran[c.de - 1];
    const b = ecran[c.a - 1];
    const fermeture = Boolean(mesure.ferme) && c.a === 1;
    groupe.append(creer('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `trait-mesure-rapide ${fermeture ? 'fermeture' : ''}` }));
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    const [mx, my] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const texte = creer('text', { x: mx, y: my - 5, class: 'cote-mesure-rapide', transform: `rotate(${angle.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})` });
    texte.textContent = `${formaterNombre(c.longueur2d)} m`;
    groupe.append(texte);
  }
  ecran.forEach((p, i) => {
    groupe.append(creer('circle', { cx: p.x, cy: p.y, r: 6, class: 'point-mesure-rapide' }));
    const nom = creer('text', { x: p.x + 9, y: p.y - 9, class: 'nom-mesure-rapide' });
    nom.textContent = mesure.points[i].nom ? `${i + 1} · ${mesure.points[i].nom}` : String(i + 1);
    groupe.append(nom);
  });
  if (mesure.ferme) {
    const x = ecran.reduce((t, p) => t + p.x, 0) / ecran.length;
    const y = ecran.reduce((t, p) => t + p.y, 0) / ecran.length;
    const surface = creer('text', { x, y, class: 'surface-mesure-rapide' });
    surface.textContent = `${formaterNombre(mesure.ferme.surface2d)} m²`;
    groupe.append(surface);
  }
}
