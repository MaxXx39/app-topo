// Flèche + texte de l'écart de la canne, collés à la ligne à implanter (0.210.0, maquette 2 du 11.11).
// La flèche touche la ligne et pointe vers elle ; le texte est au-delà, sur l'axe de la perpendiculaire (penché si la ligne
// est en diagonale). Le bloc reste à distance fixe de la ligne, du côté de la canne, et glisse seulement le long de la ligne ;
// il est posé juste au-dessus du trait pointillé de la perpendiculaire pour ne pas le recouvrir.

/** Couleur de la flèche selon la tolérance (vert / orange / rouge) ; neutre sinon (position peu fiable, talus). */
export function couleurFlecheEcart(classe) {
  return { vert: '#16a34a', orange: '#f59e0b', rouge: '#dc2626' }[classe] ?? '#0f766e';
}

/**
 * Où poser le bloc (pixels du plan) : cible = point de la ligne en face de la canne, canne = position du récepteur.
 * Renvoie { x, y, angle, retourne } : le point de départ du bloc (à "decalage" pixels de la ligne), l'angle (degrés, de -90 à 90, pour
 * que le texte se lise à l'endroit) et « retourne » : vrai quand la canne est du côté gauche de l'écran (on lit alors le texte
 * puis la flèche, la flèche reste contre la ligne).
 * 0.232.0 : « repli » = direction (x, y) de la perpendiculaire côté canne, utilisée quand la canne est à moins d'un pixel de la
 * ligne (écart de quelques mm à petite échelle) : la flèche reste visible. Sans repli et canne sur la ligne : null.
 */
export function placerFlecheEcart(cible, canne, decalage = 6, repli = null) {
  let dx = canne.x - cible.x;
  let dy = canne.y - cible.y;
  let longueur = Math.hypot(dx, dy);
  if (longueur < 1) {
    const l = repli ? Math.hypot(repli.x, repli.y) : 0;
    if (l === 0) return null;
    dx = repli.x;
    dy = repli.y;
    longueur = l;
  }
  const nx = dx / longueur;
  const ny = dy / longueur;
  let angle = (Math.atan2(ny, nx) * 180) / Math.PI;
  let retourne = false;
  if (angle > 90) {
    angle -= 180;
    retourne = true;
  } else if (angle < -90) {
    angle += 180;
    retourne = true;
  }
  return { x: cible.x + nx * decalage, y: cible.y + ny * decalage, angle, retourne };
}
