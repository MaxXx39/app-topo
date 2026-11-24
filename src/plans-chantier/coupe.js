// Plans de chantier (0.311.0) : dessin SVG de la vue de côté (coupe) calculée par topo/coupe-chantier.js.
// Échelle identique en horizontal et en vertical ; Z à gauche ; grues en jaune, bâtiments en gris bleuté avec leurs Z.
import { echapper } from '../outils/echapper.js';

const COULEURS = {
  mat: ['#f3cd6b', '#61666a'], fleche: ['#f3cd6b', '#61666a'], contre: ['#f3cd6b', '#61666a'], pied: ['#aab2ba', '#61666a'],
  massif: ['#b9bfc6', '#6b7280'], crochet: ['#1b1f24', '#1b1f24'],
};

/** SVG de la coupe dans une zone de largeur × hauteur pixels. */
export function svgCoupe(coupe, largeur = 700, hauteur = 240) {
  const ml = 54;
  const mr = 12;
  const mt = 40; // place pour les étiquettes au-dessus de la grue
  const mb = 22;
  let sMin = 0;
  let sMax = coupe.longueur;
  for (const sf of coupe.surfaces ?? []) for (const l of sf.lignes) for (const p of l) { sMin = Math.min(sMin, p[0]); sMax = Math.max(sMax, p[0]); }
  for (const g of coupe.grues) {
    for (const f of g.formes) {
      for (const p of f.pts ?? (f.ancre === 'end' ? [[f.s - 16, f.z], [f.s, f.z]] : [[f.s, f.z]])) {
        sMin = Math.min(sMin, p[0]);
        sMax = Math.max(sMax, p[0]);
      }
    }
  }
  const zMin = coupe.zMin - 2.2;
  const zMax = coupe.zMax + 1.2;
  const echelle = Math.min((largeur - ml - mr) / Math.max(1, sMax - sMin), (hauteur - mt - mb) / Math.max(1, zMax - zMin));
  const X = (s) => ml + (s - sMin) * echelle;
  const Y = (z) => hauteur - mb - (z - zMin) * echelle;
  const chemin = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
  const pas = [1, 2, 5, 10, 20, 50, 100].find((p) => p * echelle >= 34) ?? 100;
  const reperes = [];
  for (let z = Math.ceil(zMin / pas) * pas; z <= zMax; z += pas) {
    reperes.push(`<line x1="${ml}" x2="${largeur - mr}" y1="${Y(z).toFixed(1)}" y2="${Y(z).toFixed(1)}" stroke="#e2e8f0"/><text x="${ml - 5}" y="${(Y(z) + 4).toFixed(1)}" text-anchor="end" class="z">${z.toFixed(pas < 1 ? 1 : 0)}</text>`);
  }
  const corps = [];
  const etiquettes = []; // étiquettes avec flèche, placées à la fin sans chevauchement
  const boites = []; // cadres [x1, y1, x2, y2] déjà occupés par du texte
  const largeurTexte = (t, taille = 11) => t.length * taille * 0.55 + 8;
  for (const b of coupe.batiments) {
    corps.push(`<rect x="${X(b.s0).toFixed(1)}" y="${Y(b.zHaut).toFixed(1)}" width="${Math.max(1, (b.s1 - b.s0) * echelle).toFixed(1)}" height="${Math.max(1, (b.zHaut - b.zBas) * echelle).toFixed(1)}" fill="#cbd5e1" stroke="#475569" stroke-width="1.2"/>`);
    const tb = `${b.nom} · Z ${b.zBas.toFixed(2)} → ${b.zHaut.toFixed(2)}`;
    const cx = X((b.s0 + b.s1) / 2);
    const cy = Y((b.zHaut + b.zBas) / 2) + 4;
    boites.push([cx - largeurTexte(tb) / 2, cy - 11, cx + largeurTexte(tb) / 2, cy + 3]);
    corps.push(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" class="t">${echapper(tb)}</text>`);
  }
  for (const g of coupe.grues) {
    for (const f of g.formes) {
      if (f.type === 'poly') {
        const [fill, stroke] = COULEURS[f.genre] ?? ['#f3cd6b', '#61666a'];
        corps.push(`<path d="${chemin(f.pts)}Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
      } else if (f.type === 'ligne') {
        corps.push(`<path d="${chemin(f.pts)}" fill="none" stroke="#475569" stroke-width="${f.genre === 'cable' ? 1.2 : 0.8}"/>`);
      } else if (f.type === 'cote') {
        // cote verticale (HSC) : trait, deux petits traits de bout, étiquette à gauche au milieu
        const [p1, p2] = f.pts;
        const x = X(p1[0]);
        corps.push(`<path d="M${x.toFixed(1)} ${Y(p1[1]).toFixed(1)}V${Y(p2[1]).toFixed(1)}M${(x - 4).toFixed(1)} ${Y(p1[1]).toFixed(1)}h8M${(x - 4).toFixed(1)} ${Y(p2[1]).toFixed(1)}h8" stroke="#7c2d12" stroke-width="1.2" fill="none"/>`);
        // texte debout le long de la cote, à gauche du trait
        const yMilieu = (Y(p1[1]) + Y(p2[1])) / 2;
        const w = largeurTexte(f.t);
        boites.push([x - 18, yMilieu - w / 2, x - 2, yMilieu + w / 2]);
        corps.push(`<text transform="translate(${(x - 6).toFixed(1)} ${yMilieu.toFixed(1)}) rotate(-90)" text-anchor="middle" class="t" style="fill:#7c2d12">${echapper(f.t)}</text>`);
      } else if (f.type === 'etiquette') {
        etiquettes.push({ t: f.t, x: X(f.s), y: Y(f.z), genre: f.genre, pref: f.pref });
      }
    }
    corps.push(`<line x1="${ml}" x2="${largeur - mr}" y1="${Y(g.niveaux.pied).toFixed(1)}" y2="${Y(g.niveaux.pied).toFixed(1)}" stroke="#92400e" stroke-dasharray="5 4" stroke-width="1"/>`);
  }
  // Surfaces du projet (terrains en vert, plateformes en brun), par-dessus les bâtiments
  for (const sf of coupe.surfaces ?? []) {
    const k = sf.type === 'plateforme' ? '#b45309' : '#15803d';
    for (const l of sf.lignes) corps.push(`<path d="${chemin(l)}" fill="none" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>`);
    const fin = sf.lignes[sf.lignes.length - 1];
    const dernier = fin[fin.length - 1];
    corps.push(`<text x="${(X(dernier[0]) - 4).toFixed(1)}" y="${(Y(dernier[1]) - 5).toFixed(1)}" text-anchor="end" class="t" style="fill:${k}">${echapper(sf.nom)}</text>`);
  }
  // Placement des étiquettes : premier emplacement libre (pas de chevauchement avec les autres textes), repli : le premier
  const CAND = {
    haut: [[0, -20], [30, -24], [-30, -24], [0, -40], [60, -42], [-60, -42], [0, -60], [90, -60], [-90, -60]],
    'droite-bas': [[24, 16], [24, 34], [-24, 16], [-24, 34], [60, 52], [-60, 52]],
    gauche: [[-10, 0], [-10, -16], [-10, 16], [-10, -32], [-10, 32], [-10, -48], [-10, 48]],
  };
  const croise = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const cadre = (e, dx, dy) => {
    const w = largeurTexte(e.t);
    const ax = e.x + dx;
    const ay = e.y + dy;
    const x1 = dx > 4 ? ax : dx < -4 ? ax - w : ax - w / 2;
    return { ax, ay, w, boite: [x1, ay - 11, x1 + w, ay + 4], ancre: dx > 4 ? 'start' : dx < -4 ? 'end' : 'middle', x1 };
  };
  for (const e of etiquettes) {
    const liste = CAND[e.sansFleche ? 'gauche' : e.pref ?? 'haut'] ?? CAND.haut;
    const dedans = (b) => b[0] >= 1 && b[2] <= largeur - 1 && b[1] >= 1 && b[3] <= hauteur - 1;
    const choix = liste.map(([dx, dy]) => cadre(e, dx, dy)).find((c) => dedans(c.boite) && !boites.some((b) => croise(b, c.boite))) ?? cadre(e, ...liste[0]);
    boites.push(choix.boite);
    const k = e.genre === 'hsc' ? '#7c2d12' : '#1e293b';
    if (!e.sansFleche) corps.push(`<line x1="${e.x.toFixed(1)}" y1="${e.y.toFixed(1)}" x2="${choix.ax.toFixed(1)}" y2="${(choix.ay - 4).toFixed(1)}" stroke="#64748b" stroke-width="0.9"/><circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="2" fill="#64748b"/>`);
    corps.push(`<rect x="${choix.boite[0].toFixed(1)}" y="${choix.boite[1].toFixed(1)}" width="${choix.w.toFixed(1)}" height="15" rx="3" fill="#ffffff" fill-opacity="0.88" stroke="#cbd5e1" stroke-width="0.6"/><text x="${(choix.ancre === 'start' ? choix.ax + 4 : choix.ancre === 'end' ? choix.ax - 4 : choix.ax).toFixed(1)}" y="${choix.ay.toFixed(1)}" text-anchor="${choix.ancre}" class="t" style="fill:${k}">${echapper(e.t)}</text>`);
  }
  coupe.etiquettesPlacees = boites; // pour les tests (aucun chevauchement)
  const vide = !coupe.grues.length && !coupe.batiments.length && !(coupe.surfaces ?? []).length ? `<text x="${largeur / 2}" y="${hauteur / 2}" text-anchor="middle" class="t">Rien à voir sur cette ligne (grue d'après fiche, zone Bâtiment avec Z bas et Z haut, surface du projet)</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}" role="img" aria-label="Vue de côté">
    <style>.z{font:10px sans-serif;fill:#64748b}.t{font:11px sans-serif;fill:#1e293b}.tc{font:11px sans-serif;fill:#7c2d12}</style>
    ${reperes.join('')}
    <line x1="${ml}" x2="${ml}" y1="${mt}" y2="${hauteur - mb}" stroke="#94a3b8"/>
    ${corps.join('')}${vide}
    <text x="${ml}" y="${hauteur - 6}" class="z">A</text><text x="${X(coupe.longueur).toFixed(1)}" y="${hauteur - 6}" class="z" text-anchor="end">B (${coupe.longueur.toFixed(1)} m)</text>
  </svg>`;
}
