// Plans de chantier (0.291.0, retours du 23.11 sur les planches numérotées) : retouches de la bibliothèque tirée de
// Base_2023.dxf et ajout des symboles dessinés dans Topo. Appliqué une fois par outils-dev/convertir-symboles.mjs (le
// résultat est rangé dans src/plans-chantier/symboles-base.json).
// Numéros = ceux des planches envoyées le 23.11 (ordre Base-vie, Engins, Véhicules, Grues, Sécurité).
import { bornesPrimitives, deplacerPrimitives } from './blocs-dxf.js';
import { transformerPrimitives, CATEGORIES_SYMBOLES } from './symboles.js';
import { symbolesDessines, portail, trilattes, rectArrondi, cercle } from './symboles-dessines.js';

// Symboles dont les textes passent sur une plaque blanche arrondie (planches : 1, 3 à 8, 14 à 21).
const AVEC_PLAQUE = [
  'decrotteur', 'Benne à déchets', 'Benne Decantation', 'Base Vie Bureau', 'Base Vie Outils', 'WC', 'Base Vie double Vest Ref',
  'Base Vie double Ref Bur', 'Base Vie double Vest Bur', 'Base Vie Refectoire', 'Base Vie Contenair', 'Base Vie Bureau CM',
  'Base Vie Bureau DT', 'Base Vie Vestiaire',
];
// Retirés de la liste (planches : 22, 23, 25, 26, 30), et les 2 parties du manuscop (réunies en un seul engin).
const RETIRES = ['Base Vie Etage passerelle', 'radier', 'Pelle Chenille Chassis', 'Pelle Chenille base', 'Finisseur Table', 'manuscop base', 'Maniscop tourelle'];

const r3 = (v) => Math.round(v * 1000) / 1000;
const boite = (prims) => {
  const b = bornesPrimitives(prims);
  return [b.xMin, b.yMin, b.xMax, b.yMax].map(r3);
};

/** Recentre des primitives sur leur boîte et en fait un symbole de la bibliothèque. */
export function versSymbole(nom, categorie, prims, prefixe = 'base:') {
  const b = bornesPrimitives(prims);
  const dx = -(b.xMin + b.xMax) / 2;
  const dy = -(b.yMin + b.yMax) / 2;
  const p = deplacerPrimitives(prims, dx, dy).map((q) => (q.b ? { ...q, b: [q.b[0] + dx, q.b[1] + dy, q.b[2] + dx, q.b[3] + dy].map(r3) } : q));
  return { cle: `${prefixe}${nom}`, nom, categorie, largeur: Math.round((b.xMax - b.xMin) * 100) / 100, hauteur: Math.round((b.yMax - b.yMin) * 100) / 100, decalage: [r3(dx), r3(dy)], primitives: p, boite: boite(p), dessine: true };
}

/** Éclair dessiné (remplace le « Z » des symboles Électricité), centré en (x, y), hauteur h. */
function eclair(x, y, h) {
  const u = h / 12;
  const pts = [[1.5, 6], [-3.5, -0.5], [-0.3, -0.5], [-2, -6], [3.5, 1], [0.3, 1]].map(([a, b]) => [x + a * u, y + b * u]);
  const p = [pts.flatMap(([a, b]) => [r3(a), r3(b)])];
  return [{ g: 'h', k: '#facc15', mat: 'peinture', p, b: boite([{ g: 'h', p }]), m: false }, { g: 'l', k: '#7a4b00', p: p[0], f: true, mat: 'trait' }];
}

/** Pierres d'un chargement de gravats dans un contour (points tirés d'une suite fixe : même dessin à chaque fois). */
function pierres(contour, taille = 0.16) {
  const pts = [];
  for (let i = 0; i + 1 < contour.length; i += 2) pts.push([contour[i], contour[i + 1]]);
  const dedans = (p) => {
    let d = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  };
  const b = bornesPrimitives([{ g: 'l', p: contour }]);
  let graine = 7;
  const hasard = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  const res = [];
  const couleurs = ['#6d5641', '#8f7356', '#a58b6d', '#5f666d', '#7c6a58', '#b7a58a'];
  const pas = taille * 1.6;
  for (let y = b.yMin + pas / 2; y < b.yMax; y += pas) {
    for (let x = b.xMin + pas / 2; x < b.xMax; x += pas) {
      const c = [x + (hasard() - 0.5) * pas * 0.8, y + (hasard() - 0.5) * pas * 0.8];
      if (!dedans(c)) continue;
      const r = taille * (0.45 + hasard() * 0.55);
      const n = 6;
      const contourPierre = [];
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n + hasard() * 0.5;
        const rr = r * (0.7 + hasard() * 0.4);
        contourPierre.push(r3(c[0] + rr * Math.cos(a)), r3(c[1] + rr * Math.sin(a) * 0.8));
      }
      const p = [contourPierre];
      res.push({ g: 'h', k: couleurs[Math.floor(hasard() * couleurs.length)], mat: 'gravats', p, b: boite([{ g: 'h', p }]), m: false });
    }
  }
  return res;
}

/** Gravats bien visibles dans une benne pleine : fond brun + pierres, posés sur le remplissage n° i du symbole. */
function chargerGravats(s, i) {
  const fond = s.primitives[i];
  if (!fond || fond.g !== 'h') return s;
  const charge = { ...fond, k: '#8a6a4b', mat: 'gravats' };
  const prims = [...s.primitives];
  prims.splice(i, 1, charge, ...pierres(fond.p[0], 0.18));
  return { ...s, primitives: prims };
}

/** Voiture grise : tournée pour être dans le même sens que les 3 autres (même dessin du DXF). */
function tournerCommeModele(s, modele) {
  const essais = [(x, y) => [-y, x], (x, y) => [y, -x]];
  const centre = (p) => {
    const b = bornesPrimitives([p]);
    return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2];
  };
  // On compare le centre d'une pièce bien décentrée (phare, n° 4 du dessin) avec celui du modèle.
  const cible = centre(modele.primitives[4]);
  let meilleur = null;
  for (const f of essais) {
    const prims = transformerPrimitives(s.primitives, f);
    const c = centre(prims[4]);
    const d = Math.hypot(c[0] - cible[0], c[1] - cible[1]);
    if (!meilleur || d < meilleur.d) meilleur = { d, prims };
  }
  return { ...s, primitives: meilleur.prims, largeur: s.hauteur, hauteur: s.largeur, boite: boite(meilleur.prims) };
}

/** Réunit la base et la tourelle du manuscop (télescopique rotatif) : les deux blocs tournent autour du même point de base. */
function manuscop(base, tourelle) {
  const brut = (s) => deplacerPrimitives(s.primitives, -s.decalage[0], -s.decalage[1]).map((p) => (p.b ? { ...p, b: [p.b[0] - s.decalage[0], p.b[1] - s.decalage[1], p.b[2] - s.decalage[0], p.b[3] - s.decalage[1]].map(r3) } : p));
  return { ...versSymbole('Manuscop (télescopique rotatif)', 'Engins', [...brut(base), ...brut(tourelle)]), dessine: false };
}

/**
 * Retouches demandées le 23.11 sur la bibliothèque tirée du DXF + symboles dessinés. symboles : bibliothèque de
 * bibliothequeDepuisBlocs ; renvoie la nouvelle liste.
 */
export function retoucherBibliotheque(symboles) {
  const par = (nom) => symboles.find((s) => s.nom === nom);
  let res = symboles.map((s) => {
    let t = s;
    if (AVEC_PLAQUE.includes(s.nom)) t = { ...t, primitives: t.primitives.map((p) => (p.g === 't' ? { ...p, pl: true } : p)) };
    if (s.nom === 'Elec' || s.nom === 'Elec Gene') {
      // Un vrai éclair jaune à la place du « Z » rouge (les traits ouverts du bloc).
      const h = (t.boite[3] - t.boite[1]) * 0.8;
      t = { ...t, primitives: [...t.primitives.filter((p) => p.g !== 'l' || p.f), ...eclair(0, 0, h)] };
    }
    if (s.nom === 'Dumper plein') t = chargerGravats(t, 5);
    if (s.nom === 'Dumper Vide') {
      // Benne vide : l'intérieur en tôle plus foncée, pour la distinguer de la pleine.
      t = { ...t, primitives: t.primitives.map((p, i) => (i === 5 ? { ...p, k: '#b9770a', mat: 'metal' } : p)) };
    }
    if (s.nom === 'Camion Benne Plein') {
      const i = t.primitives.findIndex((p) => p.g === 'h' && p.mat === 'gravats');
      if (i >= 0) t = chargerGravats(t, i);
    }
    if (s.nom === 'Voiture Grise' && par('Voiture Blanche')) t = tournerCommeModele(t, par('Voiture Blanche'));
    if (s.nom === 'Portail') t = { ...versSymbole('Portail', 'Sécurité', portail(5)), cle: s.cle };
    if (s.nom === 'Tri Lattes') t = { ...versSymbole('Tri Lattes', 'Sécurité', trilattes()), cle: s.cle };
    if (s.nom === 'Tri lattes + travaux' && par('Panneau Travaux')) {
      // Trilattes avec le panneau « Travaux » fixé dessus (comme sur la photo).
      const panneau = transformerPrimitives(par('Panneau Travaux').primitives.filter((p) => p.mat !== 'feu'), (x, y) => [r3(x * 0.9), r3(y * 0.9 + 0.35)]);
      t = { ...versSymbole('Tri lattes + travaux', 'Sécurité', [...trilattes(), ...panneau]), cle: s.cle };
    }
    if (RETIRES.includes(s.nom)) t = { ...t, cache: true };
    return t;
  });
  if (par('manuscop base') && par('Maniscop tourelle')) res.push(manuscop(par('manuscop base'), par('Maniscop tourelle')));
  for (const d of symbolesDessines()) res.push(versSymbole(d.nom, d.categorie, d.primitives));
  return res;
}

export { CATEGORIES_SYMBOLES, rectArrondi, cercle };
