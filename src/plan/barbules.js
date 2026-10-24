// Barbules d'un talus : traits perpendiculaires, longs et courts en alternance, qui partent du
// haut du talus vers son bas (plan, croquis des réglages). Coordonnées en pixels.

/**
 * Barbules d'un talus (pixels) : tous les "pas" pixels le long du bord haut, un trait vers le bord
 * bas, long puis court (la moitié) en alternance. haut et bas : points { x, y } qui se répondent
 * (même nombre, le n-ième du haut en face du n-ième du bas). Renvoie le chemin SVG, ou ''.
 */
export function traitsDeBarbules(haut, bas, pas) {
  let d = '';
  let reste = 0; // pixels jusqu'à la prochaine barbule
  let numero = 0;
  for (let i = 0; i + 1 < haut.length && numero < 3000; i++) {
    const longueur = Math.hypot(haut[i + 1].x - haut[i].x, haut[i + 1].y - haut[i].y);
    if (longueur === 0) continue;
    let parcouru = reste;
    for (; parcouru <= longueur; parcouru += pas) {
      const t = parcouru / longueur;
      const debut = { x: haut[i].x + (haut[i + 1].x - haut[i].x) * t, y: haut[i].y + (haut[i + 1].y - haut[i].y) * t };
      const fin = { x: bas[i].x + (bas[i + 1].x - bas[i].x) * t, y: bas[i].y + (bas[i + 1].y - bas[i].y) * t };
      const part = numero % 2 === 0 ? 1 : 0.5;
      d += `M${debut.x.toFixed(1)} ${debut.y.toFixed(1)}L${(debut.x + (fin.x - debut.x) * part).toFixed(1)} ${(debut.y + (fin.y - debut.y) * part).toFixed(1)}`;
      numero++;
    }
    reste = parcouru - longueur;
  }
  return d;
}
