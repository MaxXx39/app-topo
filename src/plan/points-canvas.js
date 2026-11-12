// Points du plan dessinés sur un canvas (0.126.0, vitesse sur tablette lente).
// Un canvas est une seule image : avec des milliers de points, c'est bien plus rapide que des
// milliers de ronds SVG (chacun est un objet de la page que la tablette doit redessiner).
// Le plan s'en sert seulement quand beaucoup de points sont visibles (SEUIL_POINTS_CANVAS) :
// en dessous, rien ne change (SVG, comme avant).

/** Nombre de points visibles à partir duquel ils sont dessinés sur le canvas. */
export const SEUIL_POINTS_CANVAS = 1500;

/**
 * Regroupe les points par façon de les dessiner (couleur, trait ou plein, pâli), pour peindre
 * chaque groupe d'un seul coup (bien plus rapide qu'un point à la fois).
 * points : [{ x, y, trace (chemin SVG ou null = rond), trait (vrai = forme vide / croix), couleur, pale, marque (voir marqueCentre) }]
 * Renvoie une Map "couleur|trait|pale" → liste de points.
 */
export function grouperPoints(points) {
  const groupes = new Map();
  for (const point of points) {
    const cle = `${point.couleur}|${point.trait ? 1 : 0}|${point.pale ? 1 : 0}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(point);
  }
  return groupes;
}

/**
 * Dessine les points sur le canvas (taille de l'écran × densité de pixels).
 * rayon : rayon des ronds (px) ; largeur, hauteur : taille du plan (px).
 */
export function dessinerPointsCanvas(canvas, points, { rayon, largeur, hauteur, densite = 1 }) {
  const l = Math.round(largeur * densite);
  const h = Math.round(hauteur * densite);
  if (canvas.width !== l || canvas.height !== h) {
    canvas.width = l;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, l, h);
  if (points.length === 0) return;
  ctx.setTransform(densite, 0, 0, densite, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [cle, groupe] of grouperPoints(points)) {
    const [couleur, trait, pale] = cle.split('|');
    const chemin = new Path2D();
    // 0.207.0 : petit point léger au centre des formes vides (même couleur).
    const pointsLegers = new Path2D();
    for (const p of groupe) {
      if (p.trace) chemin.addPath(new Path2D(p.trace));
      else {
        chemin.moveTo(p.x + rayon, p.y);
        chemin.arc(p.x, p.y, rayon, 0, Math.PI * 2);
      }
      if (p.centre) {
        pointsLegers.moveTo(p.centre.x + p.centre.r, p.centre.y);
        pointsLegers.arc(p.centre.x, p.centre.y, p.centre.r, 0, Math.PI * 2);
      }
    }
    ctx.globalAlpha = pale === '1' ? 0.5 : 1;
    // 0.206.0 : même rendu que sur le SVG (style.css) : liseré noir fin, et une légère ombre sous les pleins.
    if (trait === '1') {
      // Forme vide ou croix : un liseré noir plus large passe dessous, la couleur reste par-dessus.
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke(chemin);
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 1.8;
      ctx.stroke(chemin);
      ctx.fillStyle = couleur;
      ctx.fill(pointsLegers);
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = couleur;
      ctx.fill(chemin);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.stroke(chemin);
    }
  }
  // 0.212.0 : marque au centre selon le type (levé = rond noir, importé = carré noir), par-dessus les formes.
  for (const p of points) {
    if (!p.marque) continue;
    ctx.globalAlpha = p.pale ? 0.5 : 1;
    ctx.fillStyle = p.marque.couleur;
    if (p.marque.chemin) ctx.fill(new Path2D(p.marque.chemin));
    else {
      ctx.beginPath();
      ctx.arc(p.marque.x, p.marque.y, p.marque.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Efface le canvas des points (peu de points : ils sont de nouveau en SVG). */
export function effacerPointsCanvas(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}
