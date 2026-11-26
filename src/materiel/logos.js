// Logos des catégories du Matériel (0.325.0, famille A « trait simple » choisie le 26.11) : des dessins très simples,
// faits seulement de cercles (c), rectangles (r) et lignes (l), sur une grille de 24 × 24. Les mêmes primitives servent
// à l'écran (SVG) et au PDF (jsPDF) : un logo est le même partout. Un logo est rangé sur la CATÉGORIE (`categorie.logo` = clé).
//   ['c', cx, cy, r]   ['r', x, y, largeur, hauteur, arrondi]   ['l', x1, y1, x2, y2, …] (ligne brisée)

export const LOGOS = [
  { cle: 'canne', nom: 'Canne GPS', f: [['c', 12, 5, 3], ['l', 12, 8, 12, 21], ['l', 8, 21, 16, 21]] },
  { cle: 'station', nom: 'Station totale', f: [['r', 7, 3, 10, 8, 1.5], ['c', 12, 7, 2], ['l', 12, 11, 12, 14], ['l', 8, 21, 12, 14, 16, 21]] },
  { cle: 'prisme', nom: 'Prisme', f: [['c', 12, 8, 5], ['l', 12, 13, 12, 21], ['l', 9, 21, 15, 21]] },
  { cle: 'trepied', nom: 'Trépied', f: [['l', 8, 4, 16, 4], ['l', 12, 4, 12, 9], ['l', 12, 9, 5, 21], ['l', 12, 9, 19, 21], ['l', 12, 9, 12, 21]] },
  { cle: 'niveau', nom: 'Niveau laser', f: [['r', 6, 9, 12, 9, 2], ['c', 12, 13.5, 2], ['l', 2, 6, 22, 6]] },
  { cle: 'implantation', nom: 'Implantation laser', f: [['r', 7, 4, 10, 12, 2], ['c', 12, 10, 2.4], ['l', 12, 16, 12, 21], ['l', 5, 21, 19, 21]] },
  { cle: 'machine', nom: 'Guidage machine', f: [['l', 3, 17, 21, 17], ['r', 5, 11, 8, 6, 1], ['l', 13, 14, 19, 14, 19, 17], ['c', 7, 19.5, 1.5], ['c', 16, 19.5, 1.5]] },
  { cle: 'tablette', nom: 'Tablette', f: [['r', 6, 2.5, 12, 19, 2], ['l', 10, 18.5, 14, 18.5]] },
  { cle: 'base', nom: 'Récepteur base', f: [['c', 12, 9, 5], ['l', 12, 14, 12, 17], ['l', 7, 21, 12, 17, 17, 21]] },
  { cle: 'radio', nom: 'Radio / modem', f: [['r', 7, 8, 10, 13, 2], ['l', 10, 8, 15, 3], ['l', 10, 13, 14, 13], ['l', 10, 16, 14, 16]] },
  { cle: 'drone', nom: 'Drone', f: [['c', 5, 5, 2.5], ['c', 19, 5, 2.5], ['c', 5, 19, 2.5], ['c', 19, 19, 2.5], ['l', 7, 7, 17, 17], ['l', 17, 7, 7, 17]] },
  { cle: 'scanner', nom: 'Scanner 3D', f: [['r', 8, 6, 8, 10, 2], ['c', 12, 11, 2], ['l', 12, 16, 12, 21], ['l', 9, 21, 15, 21]] },
  { cle: 'detecteur', nom: 'Détecteur réseaux', f: [['l', 6, 21, 11, 7, 13, 7, 18, 21], ['l', 8, 15, 16, 15]] },
  { cle: 'vehicule', nom: 'Véhicule', f: [['l', 3, 16, 3, 10, 6, 5, 15, 5, 18, 10, 21, 10, 21, 16, 3, 16], ['c', 7, 17, 2], ['c', 17, 17, 2]] },
  { cle: 'telephone', nom: 'Téléphone / SIM', f: [['r', 7, 2.5, 10, 19, 2], ['l', 11, 18.5, 13, 18.5]] },
  { cle: 'accessoire', nom: 'Accessoire', f: [['c', 16, 8, 4], ['l', 13, 11, 4, 20]] },
];

export const logoDeCle = (cle) => LOGOS.find((l) => l.cle === cle) ?? null;

/** SVG d'un logo (trait de la couleur du texte), ou '' si la clé est inconnue. */
export function svgLogo(cle, classe = 'logo-materiel') {
  const logo = logoDeCle(cle);
  if (!logo) return '';
  const trace = logo.f.map(([type, ...v]) => {
    if (type === 'c') return `<circle cx="${v[0]}" cy="${v[1]}" r="${v[2]}"/>`;
    if (type === 'r') return `<rect x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}" rx="${v[4] ?? 0}"/>`;
    return `<polyline points="${v.join(' ')}"/>`;
  }).join('');
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true">${trace}</svg>`;
}

/**
 * Dessine un logo dans un PDF jsPDF : (x, y) = coin haut gauche, taille en points.
 * Trait noir fin, sans remplissage (même rendu que l'écran).
 */
export function dessinerLogoPdf(doc, cle, x, y, taille) {
  const logo = logoDeCle(cle);
  if (!logo) return;
  const k = taille / 24;
  doc.setDrawColor(27, 43, 54);
  doc.setLineWidth(Math.max(0.5, 1.6 * k));
  doc.setLineCap('round');
  doc.setLineJoin('round');
  for (const [type, ...v] of logo.f) {
    if (type === 'c') doc.circle(x + v[0] * k, y + v[1] * k, v[2] * k, 'S');
    else if (type === 'r') doc.roundedRect(x + v[0] * k, y + v[1] * k, v[2] * k, v[3] * k, (v[4] ?? 0) * k, (v[4] ?? 0) * k, 'S');
    else for (let i = 0; i + 3 < v.length; i += 2) doc.line(x + v[i] * k, y + v[i + 1] * k, x + v[i + 2] * k, y + v[i + 3] * k);
  }
}
