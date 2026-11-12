// Mesure rapide sur le plan (0.158.0) : les points choisis (rond violet + numéro, ou leur nom), les
// côtés (fermés dès 3 points, le côté de fermeture en pointillé), la longueur à plat de chaque côté
// écrite au milieu, le long du côté (jamais à l'envers), et la surface à plat au milieu de la figure.
import { formaterNombre } from '../topo/format.js';

/**
 * Arc d'un angle au sommet s (pixels), entre les directions vers le point précédent p et le suivant q. valeur : angle en degrés
 * (plus de 180° : l'arc passe du côté du coin rentrant). Renvoie { chemin (secteur SVG), texte: { x, y } } ou null si un côté est trop court.
 */
export function arcAngle(s, p, q, valeur) {
  const [ux, uy, vx, vy] = [p.x - s.x, p.y - s.y, q.x - s.x, q.y - s.y];
  const [lu, lv] = [Math.hypot(ux, uy), Math.hypot(vx, vy)];
  if (lu < 10 || lv < 10) return null;
  const rayon = Math.max(8, Math.min(20, 0.4 * Math.min(lu, lv)));
  const phi1 = Math.atan2(uy, ux);
  let delta = Math.atan2(vy, vx) - phi1;
  delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // petit arc, entre −180° et 180°
  let grand = 0;
  let sens = delta > 0 ? 1 : 0;
  let milieu = phi1 + delta / 2;
  if (valeur > 180) { // coin rentrant : l'autre côté
    grand = 1;
    sens = 1 - sens;
    milieu += Math.PI;
  }
  const [x1, y1] = [s.x + rayon * Math.cos(phi1), s.y + rayon * Math.sin(phi1)];
  const phi2 = phi1 + delta;
  const [x2, y2] = [s.x + rayon * Math.cos(phi2), s.y + rayon * Math.sin(phi2)];
  const f = (v) => v.toFixed(1);
  const chemin = `M${f(s.x)} ${f(s.y)}L${f(x1)} ${f(y1)}A${f(rayon)} ${f(rayon)} 0 ${grand} ${sens} ${f(x2)} ${f(y2)}Z`;
  return { chemin, texte: { x: s.x + (rayon + 12) * Math.cos(milieu), y: s.y + (rayon + 12) * Math.sin(milieu) + 3 } };
}

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
  // 0.214.0 : angles (dès 3 points), arc discret et valeur en degrés, si la case « Afficher les angles sur le plan » est cochée.
  if (mesure.afficherAngles !== false && mesure.angles) {
    ecran.forEach((p, i) => {
      const valeur = mesure.angles[i];
      if (valeur == null) return;
      const arc = arcAngle(p, ecran[(i + ecran.length - 1) % ecran.length], ecran[(i + 1) % ecran.length], valeur);
      if (!arc) return;
      groupe.append(creer('path', { d: arc.chemin, class: 'arc-angle-mesure-rapide' }));
      const texte = creer('text', { x: arc.texte.x, y: arc.texte.y, class: 'angle-mesure-rapide', 'text-anchor': 'middle' });
      texte.textContent = `${valeur.toFixed(1)}°`;
      groupe.append(texte);
    });
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
