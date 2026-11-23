// Plans de chantier (0.294.1) : une texture par type de matériau de stock (terre, remblai, sable, gravier, grave, béton
// concassé, enrobé, blocs). Petites tuiles dessinées une fois avec une suite fixe de nombres (même dessin à chaque fois).
const tuiles = new Map(); // matériau → canvas

/** Suite de nombres entre 0 et 1, toujours la même pour une graine donnée. */
function suite(graine) {
  let x = graine >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const TAILLE = 72;

/** Dessine la tuile d'un matériau dans un canvas de TAILLE × TAILLE (fond transparent : la couleur du stock reste dessous). */
function dessinerTuile(cle) {
  const c = document.createElement('canvas');
  c.width = TAILLE;
  c.height = TAILLE;
  const g = c.getContext('2d');
  const r = suite(cle.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const points = (n, couleur, rayon, variation = 0) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = couleur;
      g.globalAlpha = 0.45 + r() * 0.5;
      g.beginPath();
      g.arc(r() * TAILLE, r() * TAILLE, rayon * (1 - variation + r() * variation * 2), 0, 2 * Math.PI);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  const cailloux = (n, claire, sombre, taille, angulaire) => {
    for (let i = 0; i < n; i++) {
      const x = r() * TAILLE;
      const y = r() * TAILLE;
      const t = taille * (0.6 + r() * 0.8);
      g.beginPath();
      if (angulaire) {
        const k = 5 + Math.floor(r() * 2);
        for (let j = 0; j < k; j++) {
          const a = (2 * Math.PI * j) / k + r() * 0.5;
          const rr = t * (0.65 + r() * 0.45);
          j ? g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : g.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
        }
        g.closePath();
      } else g.ellipse(x, y, t, t * (0.7 + r() * 0.3), r() * Math.PI, 0, 2 * Math.PI);
      g.fillStyle = r() > 0.5 ? claire : sombre;
      g.globalAlpha = 0.8;
      g.fill();
      g.globalAlpha = 0.55;
      g.strokeStyle = '#3f3f46';
      g.lineWidth = 0.7;
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  if (cle === 'terre') {
    points(70, '#3b2a1a', 1.1, 0.6);
    points(26, '#8a6a47', 1.8, 0.5);
    g.strokeStyle = 'rgba(60,40,20,0.35)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) {
      const x = r() * TAILLE;
      const y = r() * TAILLE;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3 + r() * 5, y + (r() - 0.5) * 3);
      g.stroke();
    }
  } else if (cle === 'remblai') {
    points(50, '#4b3a2a', 1.3, 0.5);
    cailloux(7, '#a8a29e', '#78716c', 3.2, true);
    points(20, '#d6d3d1', 0.9, 0.4);
  } else if (cle === 'sable') {
    points(140, '#b9923f', 0.7, 0.4);
    points(60, '#fff7d6', 0.7, 0.4);
  } else if (cle === 'gravier') {
    cailloux(26, '#e7e5e4', '#a8a29e', 3.4, false);
  } else if (cle === 'grave') {
    cailloux(14, '#d6d3d1', '#78716c', 3, true);
    points(90, '#57534e', 0.8, 0.5);
  } else if (cle === 'concasse') {
    cailloux(20, '#d4d4d8', '#71717a', 4.2, true);
    points(30, '#52525b', 0.9, 0.4);
  } else if (cle === 'enrobe') {
    points(160, '#0b0b0e', 1, 0.5);
    points(70, '#52525b', 0.7, 0.4);
  } else if (cle === 'blocs') {
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(30,30,35,0.7)';
    for (let y = 0; y < TAILLE; y += 18) {
      const dec = (y / 18) % 2 ? 12 : 0;
      for (let x = -dec; x < TAILLE; x += 24) {
        g.fillStyle = `rgba(${150 + Math.floor(r() * 50)},${150 + Math.floor(r() * 40)},${145 + Math.floor(r() * 40)},0.7)`;
        g.fillRect(x + 1, y + 1, 22, 16);
        g.strokeRect(x + 1, y + 1, 22, 16);
      }
    }
  } else points(80, '#44403c', 1, 0.5);
  return c;
}

/** Motif (CanvasPattern) d'un matériau pour ce contexte, ou null (hors navigateur). */
export function textureMateriau(ctx, cle) {
  if (typeof document === 'undefined' || !cle) return null;
  if (!tuiles.has(cle)) tuiles.set(cle, dessinerTuile(cle));
  return ctx.createPattern(tuiles.get(cle), 'repeat');
}
