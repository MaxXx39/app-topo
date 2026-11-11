// Forme des points sur le plan, choisie par libellé (0.97.0, demande du 29.10.2026, réglée en
// Expert dans « Libellés des points ») : rond, carré, triangle pointe en haut ou en bas (pleins ou vides), croix, croix
// tournée à 45°, étoile, losange. '' = rond plein (la forme habituelle).
// 0.206.0 (demande du 11.11) : le triangle vide pointe en haut est réservé aux points de contrôle (avec un x dedans) ;
// le triangle vide pointe en bas n'est plus proposé. Les anciens libellés qui les gardent les montrent encore.
// Annotation : une bulle (rectangle à bord arrondi avec une encoche), forme « bulle ».

// [clé, symbole, nom] dans l'ordre de la liste de choix. 0.207.0 : la liste montre le nom, et un aperçu
// dessiné (même style que le plan) s'affiche à côté ; le symbole texte ne sert plus.
export const FORMES = [
  ['', '●', 'Rond plein'],
  ['rond-vide', '○', 'Rond vide'],
  ['carre', '■', 'Carré plein'],
  ['carre-vide', '□', 'Carré vide'],
  ['triangle', '▲', 'Triangle pointe en haut'],
  ['triangle-bas', '▼', 'Triangle pointe en bas'],
  ['losange', '◆', 'Losange plein'],
  ['losange-vide', '◇', 'Losange vide'],
  ['croix', '✚', 'Croix'],
  ['croix-45', '✖', 'Croix tournée'],
  ['etoile', '★', 'Étoile'],
];

/** Vrai si la forme se dessine en trait seulement (vide, croix, bulle). */
export function formeEnTrait(forme) {
  return /-vide$/.test(forme ?? '') || forme === 'croix' || forme === 'croix-45' || forme === 'bulle';
}

/** Vrai pour une forme vide (contour seul, sans croix) : elle reçoit un petit point léger au centre (0.207.0). */
export function formeVide(forme) {
  return /-vide$/.test(forme ?? '') || forme === 'bulle';
}

/** Rayon du petit point léger au centre d'une forme vide : 30 % de r, 1,2 px au moins. */
export function rayonPointLeger(r) {
  return Math.max(1.2, r * 0.3);
}

/** Centre du point léger d'une forme vide en (x, y), ou null si la forme n'est pas vide. La bulle : au-dessus du milieu. */
export function centrePointLeger(forme, x, y, r) {
  if (!formeVide(forme)) return null;
  return forme === 'bulle' ? { x, y: y - 0.2 * r } : { x, y };
}

/**
 * Tracé SVG (attribut d) d'une forme centrée en (x, y), de « rayon » r (pixels). Le rond n'a pas de
 * tracé ici (cercle SVG) : renvoie null pour '' et 'rond-vide'.
 */
export function cheminForme(forme, x, y, r) {
  const f = (v) => v.toFixed(1);
  const polygone = (sommets) => `M${sommets.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`;
  switch (String(forme ?? '').replace(/-vide$/, '')) {
    case 'carre':
      return polygone([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]);
    case 'triangle':
      return polygone([[x, y - r * 1.2], [x + r * 1.1, y + r * 0.8], [x - r * 1.1, y + r * 0.8]]);
    case 'triangle-bas':
      return polygone([[x, y + r * 1.2], [x + r * 1.1, y - r * 0.8], [x - r * 1.1, y - r * 0.8]]);
    case 'losange':
      return polygone([[x, y - r * 1.3], [x + r * 1.3, y], [x, y + r * 1.3], [x - r * 1.3, y]]);
    case 'bulle': {
      // Bulle d'annotation (0.206.0) : rectangle à bord arrondi (rayon 0,5 r) avec une encoche (la pointe)
      // vers le bas à gauche. Largeur 2,8 r, de y - 1,1 r à y + 0,7 r ; la pointe descend jusqu'à y + 1,5 r.
      const g = x - 1.4 * r, d = x + 1.4 * r, h = y - 1.1 * r, b = y + 0.7 * r, k = 0.5 * r;
      return [
        `M${f(g + k)} ${f(h)}`,
        `L${f(d - k)} ${f(h)}Q${f(d)} ${f(h)} ${f(d)} ${f(h + k)}`,
        `L${f(d)} ${f(b - k)}Q${f(d)} ${f(b)} ${f(d - k)} ${f(b)}`,
        `L${f(x - 0.1 * r)} ${f(b)}L${f(x - 0.8 * r)} ${f(y + 1.5 * r)}L${f(x - 0.7 * r)} ${f(b)}`,
        `L${f(g + k)} ${f(b)}Q${f(g)} ${f(b)} ${f(g)} ${f(b - k)}`,
        `L${f(g)} ${f(h + k)}Q${f(g)} ${f(h)} ${f(g + k)} ${f(h)}Z`,
      ].join('');
    }
    case 'croix':
      return `M${f(x - r * 1.3)} ${f(y)}L${f(x + r * 1.3)} ${f(y)}M${f(x)} ${f(y - r * 1.3)}L${f(x)} ${f(y + r * 1.3)}`;
    case 'croix-45':
      return `M${f(x - r)} ${f(y - r)}L${f(x + r)} ${f(y + r)}M${f(x - r)} ${f(y + r)}L${f(x + r)} ${f(y - r)}`;
    case 'etoile': {
      const sommets = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rayon = i % 2 === 0 ? r * 1.5 : r * 0.65;
        sommets.push([x + rayon * Math.cos(angle), y + rayon * Math.sin(angle)]);
      }
      return polygone(sommets);
    }
    default:
      return null;
  }
}

/**
 * Point de contrôle (0.207.0) : triangle vide pointe en haut, avec un petit point léger au centre du triangle
 * (plus de x). Le contrôle est 1,5 fois plus gros que les autres formes : r est déjà la taille voulue.
 * Renvoie { triangle (tracé en trait), point ({x, y}), rayonPoint (rayon du point léger) }.
 */
export function cheminControle(x, y, r) {
  return {
    triangle: cheminForme('triangle', x, y, r),
    point: { x, y: y + 0.133 * r }, // centre du triangle (à peu près le centre de gravité)
    rayonPoint: rayonPointLeger(r),
  };
}

/**
 * Aperçu dessiné d'une forme (0.207.0), même style que le plan : liseré noir, ombre légère, point léger dans
 * les formes vides. Prend la couleur du texte (currentColor) : à mettre dans une balise qui a la couleur voulue.
 */
export function apercuForme(forme) {
  const r = 6;
  const trace = cheminForme(forme ?? '', 12, 12, r);
  const vide = formeEnTrait(forme);
  let corps;
  if (trace === null) {
    // Rond : cercle (plein, ou vide avec liseré).
    corps = vide
      ? `<circle cx="12" cy="12" r="${r}" class="apercu-liseret" /><circle cx="12" cy="12" r="${r}" class="apercu-vide" />`
      : `<circle cx="12" cy="12" r="${r}" class="apercu-plein" />`;
  } else {
    corps = vide
      ? `<path d="${trace}" class="apercu-liseret" /><path d="${trace}" class="apercu-vide" />`
      : `<path d="${trace}" class="apercu-plein" />`;
  }
  const centre = centrePointLeger(forme ?? '', 12, 12, r);
  if (centre) corps += `<circle cx="${centre.x}" cy="${centre.y}" r="${rayonPointLeger(r)}" class="apercu-point" />`;
  return `<span class="apercu-forme" aria-hidden="true"><svg viewBox="0 0 24 24">${corps}</svg></span>`;
}

/** Aperçu d'une forme pour les listes de choix et les boutons (0.207.0 : remplace le symbole texte). */
export function symboleDeForme(forme) {
  return apercuForme(forme ?? '');
}
