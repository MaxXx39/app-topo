// Plans de chantier (0.291.0 → 0.292.0, retours du 23.11 sur les planches numérotées) : retouches de la bibliothèque tirée
// de Base_2023.dxf et ajout des symboles dessinés dans Topo. Appliqué une fois par outils-dev/convertir-symboles.mjs (le
// résultat est rangé dans src/plans-chantier/symboles-base.json). Les textes de tous les symboles passent sur une plaque
// blanche à taille unique (réglée par le plan : voir plans-chantier/dessin.js), il n'y a donc plus rien à faire ici pour eux.
import { bornesPrimitives, deplacerPrimitives } from './blocs-dxf.js';
import { transformerPrimitives, CATEGORIES_SYMBOLES } from './symboles.js';
import { symbolesDessines, portail, portailCoulissant, trilattes } from './symboles-dessines.js';
import {
  camionCiterne, camionCarburant, camionBitume, camionBalai, tracteurBenne, niveleuse, camionGrue, AUTOGRUES, pompeABeton,
  nacelle, elevateurCiseaux, compresseur, betonniere,
} from './symboles-vehicules.js';
import * as divers from './symboles-divers.js';
import { rectArrondi, cercle, ellipse, epais, plein, piece, trait, tourner, deplacer, miroir } from './symboles-outils.js';

// Retirés de la liste : passerelle de l'étage, radier, parties de la pelle, table du finisseur, parties du manuscop (réunies),
// et le WC seul (remplacé par « WC homme / femme »).
const RETIRES = ['Base Vie Etage passerelle', 'radier', 'Pelle Chenille Chassis', 'Pelle Chenille base', 'Finisseur Table', 'manuscop base', 'Maniscop tourelle', 'WC'];

const r3 = (v) => Math.round(v * 1000) / 1000;
const boite = (prims) => {
  const b = bornesPrimitives(prims);
  return [b.xMin, b.yMin, b.xMax, b.yMax].map(r3);
};

/**
 * Recentre des primitives sur leur boîte (sauf centre = false : le point de base reste à l'origine, pour les camions grues
 * dont la flèche déployée ne doit pas décaler le camion) et en fait un symbole de la bibliothèque.
 */
export function versSymbole(nom, categorie, prims, { prefixe = 'base:', centre = true } = {}) {
  const b = bornesPrimitives(prims);
  const dx = centre ? -(b.xMin + b.xMax) / 2 : 0;
  const dy = centre ? -(b.yMin + b.yMax) / 2 : 0;
  const p = centre ? deplacerPrimitives(prims, dx, dy).map((q) => (q.b ? { ...q, b: [q.b[0] + dx, q.b[1] + dy, q.b[2] + dx, q.b[3] + dy].map(r3) } : q)) : prims;
  return { cle: `${prefixe}${nom}`, nom, categorie, largeur: Math.round((b.xMax - b.xMin) * 100) / 100, hauteur: Math.round((b.yMax - b.yMin) * 100) / 100, decalage: [r3(dx), r3(dy)], primitives: p, boite: boite(p), dessine: true };
}

/** Éclair dessiné (remplace le « Z » des symboles Électricité), centré en (x, y), hauteur h. */
function eclair(x, y, h) {
  const u = h / 12;
  const pts = [[1.5, 6], [-3.5, -0.5], [-0.3, -0.5], [-2, -6], [3.5, 1], [0.3, 1]].map(([a, b]) => [x + a * u, y + b * u]);
  const p = [pts.flatMap(([a, b]) => [r3(a), r3(b)])];
  return [{ g: 'h', k: '#facc15', mat: 'peinture', p, b: boite([{ g: 'h', p }]), m: false }, { g: 'l', k: '#7a4b00', p: p[0], f: true, mat: 'trait' }];
}

/** Pierres d'un chargement de gravats dans un contour (suite fixe : même dessin à chaque fois). */
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

/**
 * Chargement de gravats dans une benne pleine (le même pour le dumper et le camion benne) : fond brun + pierres, posés sur
 * le remplissage n° i ; les hachures d'origine qui recouvraient le fond (même boîte) sont retirées pour qu'on voie les pierres.
 */
function chargerGravats(s, i) {
  const fond = s.primitives[i];
  if (!fond || fond.g !== 'h') return s;
  const memeBoite = (p) => p.b && fond.b && p.b.every((v, k) => Math.abs(v - fond.b[k]) < 0.02);
  const charge = { ...fond, k: '#8a6a4b', mat: 'gravats' };
  const prims = s.primitives.filter((p, k) => k === i || !(p.g === 'h' && memeBoite(p)));
  const j = prims.indexOf(fond);
  prims.splice(j, 1, charge, ...pierres(fond.p[0], 0.18));
  return { ...s, primitives: prims };
}

/** Voiture grise : tournée pour être dans le même sens que les 3 autres (même dessin du DXF). */
function tournerCommeModele(s, modele) {
  const essais = [(x, y) => [-y, x], (x, y) => [y, -x]];
  const centre = (p) => {
    const b = bornesPrimitives([p]);
    return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2];
  };
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
  const sym = versSymbole('Manuscop (télescopique rotatif)', 'Engins', [...brut(base), ...brut(tourelle)]);
  // 0.293.0 : tourelle orientable : les primitives de la base (châssis) restent, la tourelle tourne autour du centre du châssis.
  return { ...sym, dessine: false, pivote: { depuis: base.primitives.length, centre: [sym.decalage[0], sym.decalage[1]] } };
}


/** Réduit de moitié l'épaisseur des bandes jaunes (y de 1,5 à 2,1 m, de chaque côté) en gardant leur bord extérieur. */
function reduireBandesJaunes(prims, k = 0.5) {
  const dedans = (ys) => ys.every((y) => y >= 1.49 && y <= 2.11) || ys.every((y) => y <= -1.49 && y >= -2.11);
  const f = (flat) => flat.map((v, i) => {
    if (i % 2 === 0) return v;
    const sens = v >= 0 ? 1 : -1;
    const ext = sens * 2.101;
    return r3(ext + (v - ext) * k);
  });
  return prims.map((p) => {
    if (p.g === 'h' && p.k === '#f2a20c' && p.b && dedans([p.b[1], p.b[3]]) && p.b[3] - p.b[1] > 0.3) {
      const pp = p.p.map(f);
      return { ...p, p: pp, b: [p.b[0], Math.min(...pp.flatMap((c) => c.filter((_, i) => i % 2))), p.b[2], Math.max(...pp.flatMap((c) => c.filter((_, i) => i % 2)))].map(r3) };
    }
    if (p.g === 'l' && dedans(p.p.filter((_, i) => i % 2))) return { ...p, p: f(p.p) };
    return p;
  });
}

/** Benne jaune du DXF (« Benne à déchets », la même pour le recyclage et le tri) sans son texte, avec une icône par-dessus. */
function benneAvecIcone(benne, nom, icone, texteBenne) {
  const prims = benne.primitives.filter((p) => p.g !== 't');
  const b = benne.boite;
  const cy = (b[1] + b[3]) / 2;
  const ajouts = [...icone(0, cy + 0.7, 1.75)];
  if (texteBenne) ajouts.push({ g: 't', k: '#1e293b', x: 0, y: cy - 1.45, h: 0.35, a: 90, t: texteBenne, ah: 1, av: 2 });
  return { ...benne, cle: `base:${nom}`, nom, primitives: [...prims, ...ajouts], dessine: true };
}

/** 0.305.0 : tourelles orientables des pelles à pneus et 5 t (voir retoucherBibliotheque). */
export const PIVOT_PELLE_PNEU = { depuis: 36, centre: [2.14, 0.02] };
export const PIVOT_PELLE_5T = { indices: [0, 1, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 62], centre: [0, 1.4] };
const CACHES_DESSINES = ['Place de parking réservée', 'Camion pompe à béton (plié)', 'Camion pompe à béton (déplié)'];

/** Camion toupie goulotte dépliée : le camion du DXF et sa goulotte de déversement à 3 éléments articulés derrière. */
function toupieDeployee(base) {
  const yMax = base.boite[3];
  const pts = [[0, yMax - 0.4]];
  const lon = [2.7, 2.4, 2.0];
  const dev = [90 + 8, 90 - 10, 90 + 14];
  lon.forEach((l, i) => {
    const [x, y] = pts[i];
    pts.push([x + l * Math.cos((dev[i] * Math.PI) / 180), y + l * Math.sin((dev[i] * Math.PI) / 180)]);
  });
  const chute = [];
  pts.slice(0, -1).forEach((p, i) => {
    const g = epais([p, pts[i + 1]], 0.62 - i * 0.05);
    chute.push(...piece('#aeb4ba', 'metal', g), plein('#7b8794', 'metal', epais([p, pts[i + 1]], 0.34 - i * 0.03)));
  });
  pts.forEach((p, i) => chute.push(...piece('#5f666d', 'metal', cercle(p[0], p[1], 0.18 - i * 0.02, 10))));
  const prims = [...base.primitives, ...chute];
  // 0.305.0 : la goulotte tourne autour de son attache (le camion reste) : champ « Rotation de la goulotte ».
  return { ...versSymbole('Camion toupie (goulotte dépliée)', 'Véhicules', prims, { centre: false }), dessine: false, pivote: { depuis: base.primitives.length, centre: pts[0], libelle: 'Rotation de la goulotte (par rapport au camion)' } };
}

const boiteLigne = (p) => {
  const b = bornesPrimitives([p]);
  return b ? [b.xMin, b.yMin, b.xMax, b.yMax] : null;
};

/** Tri lattes + travaux : les 3 lattes et le panneau « Travaux » 1,8 fois plus grand, lampe (gyrophare) gardée, posé en haut. */
function trilattesTravaux(panneau) {
  const k = 1.8;
  const grand = transformerPrimitives(panneau.primitives, (x, y) => [r3(x * k), r3(y * k + 0.55)]);
  return [...trilattes(), ...grand];
}

/**
 * Retouches demandées le 23.11 sur la bibliothèque tirée du DXF + symboles dessinés. symboles : bibliothèque de
 * bibliothequeDepuisBlocs ; renvoie la nouvelle liste.
 */
export function retoucherBibliotheque(symboles) {
  const par = (nom) => symboles.find((s) => s.nom === nom);
  let res = symboles.map((s) => {
    let t = s;
    if (s.nom === 'Elec' || s.nom === 'Elec Gene') {
      const h = (t.boite[3] - t.boite[1]) * 0.8;
      t = { ...t, primitives: [...t.primitives.filter((p) => p.g !== 'l' || p.f), ...eclair(0, 0, h)] };
    }
    if (s.nom === 'Dumper plein') t = chargerGravats(t, 5);
    if (s.nom === 'Dumper Vide') {
      // Fond de benne de la même couleur que les côtés (jaune de la benne) pour bien se distinguer de la benne pleine.
      t = { ...t, primitives: t.primitives.map((p, i) => (i === 5 ? { ...p, k: '#f2a20c', mat: 'peinture' } : p)) };
    }
    if (s.nom === 'Camion Benne Plein') {
      const i = t.primitives.findIndex((p) => p.g === 'h' && p.mat === 'gravats');
      if (i >= 0) t = chargerGravats(t, i);
    }
    if (s.nom === 'Voiture Grise' && par('Voiture Blanche')) t = tournerCommeModele(t, par('Voiture Blanche'));
    if (s.nom === 'Portail') t = { ...versSymbole('Portail', 'Sécurité', portail(5)), cle: s.cle };
    if (s.nom === 'Tri Lattes') t = { ...versSymbole('Tri Lattes', 'Sécurité', trilattes()), cle: s.cle };
    if (s.nom === 'Tri lattes + travaux' && par('Panneau Travaux')) t = { ...versSymbole('Tri lattes + travaux', 'Sécurité', trilattesTravaux(par('Panneau Travaux'))), cle: s.cle };
    if (s.nom === 'Benne Decantation') t = { ...versSymbole('Benne Decantation', 'Base-vie', divers.benneDecantation()), cle: s.cle };
    if (s.nom === '2.50interdictiondeparquer') t = { ...t, nom: 'Interdiction de parquer' };
    // 0.293.0 : pelle à tourelle orientable : les 47 premières primitives = chenilles, le reste tourne autour du centre des chenilles.
    if (s.nom === 'Pelle Chenille 20T') t = { ...t, pivote: { depuis: 47, centre: [0, 1.961] } };
    // 0.305.0 : pelle à pneus (36 premières primitives = roues, lame, appuis, châssis) et pelle 5 t (tourelle = godet,
    // bras, caisse, cabine : primitives choisies une à une, le reste = chenilles et lame). Centres estimés : à valider.
    if (s.nom === 'Pelle Pneu') t = { ...t, pivote: PIVOT_PELLE_PNEU };
    if (s.nom === 'Pelle Chenille 5t') t = { ...t, pivote: PIVOT_PELLE_5T };
    // 0.294.1 : compacteurs : les 2 bandes jaunes des extrémités sont deux fois moins larges (plus de gris et de noir visibles).
    if (['Compact Tandem', 'Compact Mixte', 'Compact pneu'].includes(s.nom)) t = { ...t, primitives: reduireBandesJaunes(t.primitives) };
    if (RETIRES.includes(s.nom)) t = { ...t, cache: true };
    return t;
  });
  if (par('manuscop base') && par('Maniscop tourelle')) res.push(manuscop(par('manuscop base'), par('Maniscop tourelle')));
  const benne = par('Benne à déchets');
  if (benne) {
    res.push(benneAvecIcone(benne, 'Benne recyclage', (x, y) => divers.logoRecyclage(x, y, 1.35), null));
    res.push(benneAvecIcone(benne, 'Benne de tri – bois', divers.iconeBois, 'BOIS'));
    res.push(benneAvecIcone(benne, 'Benne de tri – métal', divers.iconeMetal, 'MÉTAL'));
    res.push(benneAvecIcone(benne, 'Benne de tri – inertes', divers.iconeInertes, 'INERTES'));
    res.push(benneAvecIcone(benne, 'Benne de tri – plâtre', divers.iconePlatre, 'PLÂTRE'));
  }
  const conteneur = par('Base Vie Contenair');
  if (conteneur) {
    const prims = [...conteneur.primitives, ...divers.pictoDouche(0, 0, 1.3)];
    res.push({ ...conteneur, cle: 'base:Douches', nom: 'Douches', primitives: prims, dessine: true });
  }
  const toupie = par('Camion Toupie');
  if (toupie) res.push(toupieDeployee(toupie));
  const nouveaux = [
    // Véhicules
    ['Tracteur + benne', 'Véhicules', tracteurBenne()], ['Camion citerne', 'Véhicules', camionCiterne()], ['Camion carburant', 'Véhicules', camionCarburant()],
    ['Camion balai', 'Véhicules', camionBalai()], ['Camion bitume', 'Véhicules', camionBitume()],
    ['Camion pompe à béton (plié)', 'Véhicules', pompeABeton(false), false], ['Camion pompe à béton (déplié)', 'Véhicules', pompeABeton(true), false],
    // Engins
    ['Niveleuse', 'Engins', niveleuse()], ['Nacelle articulée (repliée)', 'Engins', nacelle(false)], ['Nacelle articulée (déployée)', 'Engins', nacelle(true), false],
    ['Élévateur à ciseaux', 'Engins', elevateurCiseaux()], ['Compresseur', 'Engins', compresseur()], ['Bétonnière', 'Engins', betonniere()],
    // Installations
    ['Centrale à béton mobile', 'Installations', divers.centraleBeton()], ['Silo à ciment', 'Installations', divers.siloCiment()],
    ['Citerne à gasoil sur bac', 'Installations', divers.citerneGasoil()], ['Armoire électrique de chantier', 'Installations', divers.armoireElectrique()],
    ['Mât d\'éclairage', 'Installations', divers.matEclairage()], ['Poste de lavage des roues', 'Installations', divers.lavageRoues()],
    ['Extincteur', 'Sécurité', divers.extincteur()],
    // Base-vie
    ['Abri à vélos', 'Base-vie', divers.abriVelos()], ['Place de parking réservée', 'Base-vie', divers.parkingReserve()],
    // Stockage
    ['Banche avec lest', 'Stockage', divers.stockBanches()], ['Palette de tuyaux PVC', 'Stockage', divers.paletteTuyaux()],
    ['Stock d\'armatures', 'Stockage', divers.stockArmatures()], ['Treillis soudés', 'Stockage', divers.stockTreillis()],
    ['Regards préfabriqués', 'Stockage', divers.stockRegards()], ['Big-bags', 'Stockage', divers.stockBigBags()],
    ['Sacs sur palette', 'Stockage', divers.sacsPalette()], ['Palette de parpaings', 'Stockage', divers.paletteParpaings()],
    ['Plaques de roulage', 'Stockage', divers.plaquesRoulage()], ['Bobine de câble', 'Stockage', divers.bobineCable()],
    // Portail coulissant
    ['Portail coulissant', 'Sécurité', portailCoulissant(4)],
  ];
  for (const [nom, categorie, prims, centre] of nouveaux) {
    const sym = versSymbole(nom, categorie, prims, { centre: centre !== false });
    // 0.297.0 : place de parking remplacée par le parking dynamique ; 0.305.0 : pompes fixes remplacées par la pompe
    // dynamique (topo/pompe-dynamique.js). Gardées cachées pour les anciens plans.
    res.push(CACHES_DESSINES.includes(nom) ? { ...sym, cache: true } : sym);
  }
  // Camions grues : 4 tailles, repliés et dépliés (le point de base reste le centre du camion).
  for (const a of AUTOGRUES) {
    // 0.293.0 : remplacés par la grue mobile dynamique (topo/grue-mobile.js) ; gardés cachés pour les plans déjà dessinés.
    res.push({ ...versSymbole(`Camion grue ${a.t} t (plié)`, 'Grues', camionGrue(a, false), { centre: false }), cache: true });
    res.push({ ...versSymbole(`Camion grue ${a.t} t (déplié)`, 'Grues', camionGrue(a, true), { centre: false }), cache: true });
  }
  for (const d of symbolesDessines()) res.push(versSymbole(d.nom, d.categorie, d.primitives));
  return res;
}

export { CATEGORIES_SYMBOLES, rectArrondi, cercle, ellipse, trait, tourner, deplacer, miroir };
