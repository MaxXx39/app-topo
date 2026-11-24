// Plateformes (0.300.0, Expert, décisions du 24.11, maquette validée) : surfaces 3D dessinées dans Topo, avec talus.
// Ici les calculs, sans écran (page : src/plateformes/appli.js).
//
// projet.plateformes = [{ id, nom, lettre ('A', 'B'…), couleur, creeLe,
//   sommets: [{ nom ('A-1'), est, nord, alt (m ou null), calc (vrai = altitude calculée : interpolée ou par une pente),
//              lien { id (plateforme), nom (son sommet) } (angle partagé avec une autre plateforme), detache (vrai =
//              même position que l'angle lié mais altitude propre : une marche) }],
//   interieurs: [{ nom, est, nord, alt, calc }] (points intérieurs isolés),
//   ruptures: [[nomA, nomB]] (lignes de rupture, entre deux points EXISTANTS de la plateforme),
//   talus: { [nom du sommet de départ du côté]: { on, deb: 'H:V', rem: 'H:V', berme? { mode: 'aucune' | 'propre', hauteur,
//            largeur, deb, rem } (0.302.0 : berme propre au côté ; absente = celle de la plateforme) } },
//   terrainId (surface de référence du talus), berme: { on, hauteur (m), largeur (m), deb, rem } }]
// projet.constructionsPlateformes = [[e1, n1, e2, n2]] : lignes de construction 2D (accroche seulement).
//
// Conventions (décidées par l'utilisateur) :
//  - pente d'un côté en % = (altitude du sommet suivant − altitude du sommet) / longueur en plan × 100, dans l'ordre du
//    contour : −2 % = descend du 1er point vers le suivant ;
//  - talus en H:V (« 3:2 » = 3 m en plan pour 2 m de haut), un pour le déblai et un pour le remblai : le côté prend l'un
//    ou l'autre selon que la plateforme est au-dessous ou au-dessus de la surface de référence ;
//  - berme plate : talus ① (pente du côté) jusqu'à « hauteur » sous / sur le bord, berme de « largeur », puis talus ③.
// Coordonnées MN95 (m).

export const TALUS_DEFAUT = { on: true, deb: '3:2', rem: '2:1' };
export const BERME_DEFAUT = { on: false, hauteur: 3, largeur: 2, deb: '3:2', rem: '2:1' };
export const COULEURS_PLATEFORMES = ['#6d28d9', '#0e7490', '#b45309', '#15803d', '#be123c', '#1d4ed8', '#a16207', '#475569'];

/** Lettre suivante libre : A, B… Z, AA, AB… */
export function lettreSuivante(plateformes) {
  const prises = new Set(plateformes.map((p) => p.lettre));
  for (let i = 0; i < 702; i += 1) {
    const l = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!prises.has(l)) return l;
  }
  return `P${plateformes.length + 1}`;
}

/** Nom libre suivant d'un point de la plateforme : « A-1 », « A-2 »… (numéros pris par ses sommets et points intérieurs). */
export function prochainNom(pf) {
  let max = 0;
  for (const s of [...pf.sommets, ...pf.interieurs]) {
    const m = String(s.nom).match(new RegExp(`^${pf.lettre}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${pf.lettre}-${max + 1}`;
}

/** Nouvelle plateforme (sans sommet). */
export function nouvellePlateforme(plateformes, id, maintenant = new Date().toISOString()) {
  const lettre = lettreSuivante(plateformes);
  return {
    id, nom: `Plateforme ${lettre}`, lettre, couleur: COULEURS_PLATEFORMES[plateformes.length % COULEURS_PLATEFORMES.length], creeLe: maintenant,
    sommets: [], interieurs: [], ruptures: [], talus: {}, terrainId: null, berme: { ...BERME_DEFAUT },
  };
}

/** « 3:2 » → { horizontal: 3, vertical: 2 } (aussi « 3/2 », « 1.5 » = 1.5:1), ou null. */
export function lireHV(texte) {
  const t = String(texte ?? '').replace(',', '.').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) > 0 && Number(m[2]) > 0 ? { horizontal: Number(m[1]), vertical: Number(m[2]) } : null;
  const v = Number(t);
  return v > 0 ? { horizontal: v, vertical: 1 } : null;
}

const parId = (plateformes, id) => plateformes.find((p) => p.id === id) ?? null;

/** Sommet source d'un sommet lié (en suivant les liens, 5 au plus), ou le sommet lui-même. */
function sommetSource(plateformes, s, profondeur = 0) {
  if (!s.lien || profondeur > 5) return s;
  const q = parId(plateformes, s.lien.id)?.sommets.find((x) => x.nom === s.lien.nom);
  return q ? sommetSource(plateformes, q, profondeur + 1) : s;
}

/**
 * Sommets d'une plateforme avec la position (et l'altitude, sauf détaché) des angles liés :
 * [{ nom, est, nord, alt, calc, lie, detache }].
 */
export function sommetsResolus(pf, plateformes) {
  return pf.sommets.map((s) => {
    const src = sommetSource(plateformes, s);
    const lie = src !== s;
    return { nom: s.nom, est: src.est, nord: src.nord, alt: lie && !s.detache ? src.alt : s.alt, calc: lie && !s.detache ? src.calc : s.calc, lie, detache: Boolean(s.detache) };
  });
}

/** Plateformes accrochées à celle-ci (par des angles liés, dans les deux sens, de proche en proche), elle comprise. */
export function plateformesAccrochees(plateformes, id) {
  const voisins = new Map(plateformes.map((p) => [p.id, new Set()]));
  for (const p of plateformes) {
    for (const s of p.sommets) {
      if (s.lien && voisins.has(s.lien.id)) {
        voisins.get(p.id).add(s.lien.id);
        voisins.get(s.lien.id).add(p.id);
      }
    }
  }
  const vus = new Set([id]);
  const pile = [id];
  while (pile.length) for (const v of voisins.get(pile.pop()) ?? []) if (!vus.has(v)) vus.add(v), pile.push(v);
  return vus;
}

/**
 * Change l'altitude d'un point (sommet ou point intérieur) de la plateforme. Un angle lié non détaché change l'angle
 * source (donc toutes les plateformes qui le partagent). calc : vrai pour une altitude calculée.
 */
export function changerAltitude(plateformes, pf, nom, alt, calc = false) {
  const valeur = alt == null || !Number.isFinite(alt) ? null : Math.round(alt * 1000) / 1000;
  const s = pf.sommets.find((x) => x.nom === nom) ?? pf.interieurs.find((x) => x.nom === nom);
  if (!s) return;
  const cible = s.lien && !s.detache ? sommetSource(plateformes, s) : s;
  cible.alt = valeur;
  cible.calc = valeur == null ? false : Boolean(calc);
}

/** Longueur en plan (m). */
const longueurPlan = (a, b) => Math.hypot(b.est - a.est, b.nord - a.nord);

/** Pente (%) du côté i (du sommet i au suivant), ou null si une altitude manque. */
export function penteCote(sommets, i) {
  const a = sommets[i];
  const b = sommets[(i + 1) % sommets.length];
  const l = longueurPlan(a, b);
  if (a.alt == null || b.alt == null || l < 1e-9) return null;
  return ((b.alt - a.alt) / l) * 100;
}

/** Altitude du sommet suivant pour une pente (%) tapée sur le côté i : alt(i) + pente / 100 × longueur, ou null. */
export function altitudeParPente(sommets, i, pente) {
  const a = sommets[i];
  const b = sommets[(i + 1) % sommets.length];
  if (a.alt == null || !Number.isFinite(pente)) return null;
  return a.alt + (pente / 100) * longueurPlan(a, b);
}

/**
 * Altitudes interpolées des sommets sans altitude, le long du contour, selon la longueur entre les deux sommets connus
 * (non calculés) qui les entourent. Renvoie [{ nom, alt }] (seulement ceux qu'on peut remplir).
 */
export function interpolerContour(sommets) {
  const n = sommets.length;
  const connu = (i) => sommets[i].alt != null && !sommets[i].calc;
  if (sommets.filter((s, i) => connu(i)).length < 1) return [];
  const res = [];
  for (let i = 0; i < n; i += 1) {
    if (connu(i)) continue;
    // Avant : on recule jusqu'à un sommet connu ; après : on avance.
    let a = i;
    let da = 0;
    for (let k = 0; k < n; k += 1) {
      const p = (a - 1 + n) % n;
      da += longueurPlan(sommets[p], sommets[a]);
      a = p;
      if (connu(a)) break;
    }
    let b = i;
    let db = 0;
    for (let k = 0; k < n; k += 1) {
      const q = (b + 1) % n;
      db += longueurPlan(sommets[b], sommets[q]);
      b = q;
      if (connu(b)) break;
    }
    if (!connu(a) || !connu(b)) continue;
    const t = da + db > 1e-9 ? da / (da + db) : 0.5;
    res.push({ nom: sommets[i].nom, alt: sommets[a].alt + (sommets[b].alt - sommets[a].alt) * t });
  }
  return res;
}

/** Identité d'un sommet (pour reconnaître un côté partagé) : « id de la plateforme source | nom ». */
function identite(plateformes, pf, s) {
  if (!s.lien) return `${pf.id}|${s.nom}`;
  const src = sommetSource(plateformes, s);
  const proprio = plateformes.find((p) => p.sommets.includes(src));
  return `${proprio?.id ?? s.lien.id}|${src.nom}`;
}

/** Vrai si le côté i de la plateforme est aussi un côté d'une autre plateforme (accrochée) : pas de talus. */
export function cotePartage(plateformes, pf, i) {
  const n = pf.sommets.length;
  const a = identite(plateformes, pf, pf.sommets[i]);
  const b = identite(plateformes, pf, pf.sommets[(i + 1) % n]);
  return plateformes.some((q) => q !== pf && q.sommets.some((s, k) => {
    const x = identite(plateformes, q, s);
    const y = identite(plateformes, q, q.sommets[(k + 1) % q.sommets.length]);
    return (x === a && y === b) || (x === b && y === a);
  }));
}

/**
 * Ajoute un point au milieu du côté i de la plateforme (petit « + ») : altitude = moyenne des deux voisins (calculée).
 * Si le côté est partagé, l'autre plateforme reçoit le même point (lié). Renvoie le nom du point.
 */
export function ajouterPointMilieu(plateformes, pf, i) {
  const res = sommetsResolus(pf, plateformes);
  const n = res.length;
  const a = res[i];
  const b = res[(i + 1) % n];
  const nom = prochainNom(pf);
  const ida = identite(plateformes, pf, pf.sommets[i]);
  const idb = identite(plateformes, pf, pf.sommets[(i + 1) % n]);
  const alt = a.alt != null && b.alt != null ? (a.alt + b.alt) / 2 : null;
  const m = (v) => Math.round(v * 1000) / 1000;
  pf.sommets.splice(i + 1, 0, { nom, est: m((a.est + b.est) / 2), nord: m((a.nord + b.nord) / 2), alt: alt == null ? null : m(alt), calc: alt != null });
  pf.talus[nom] = { ...(pf.talus[pf.sommets[i].nom] ?? TALUS_DEFAUT) };
  for (const q of plateformes) {
    if (q === pf) continue;
    const k = q.sommets.findIndex((s, j) => {
      const x = identite(plateformes, q, s);
      const y = identite(plateformes, q, q.sommets[(j + 1) % q.sommets.length]);
      return (x === ida && y === idb) || (x === idb && y === ida);
    });
    if (k < 0) continue;
    q.sommets.splice(k + 1, 0, { nom, est: pf.sommets[i + 1].est, nord: pf.sommets[i + 1].nord, alt: null, calc: false, lien: { id: pf.id, nom } });
    q.talus[nom] = { ...(q.talus[q.sommets[k].nom] ?? TALUS_DEFAUT) };
  }
  return nom;
}

/**
 * 0.304.0 : retire un point de la plateforme (angle ou point intérieur). Un angle garde au moins 3 angles ; les deux côtés
 * qui l'entouraient deviennent un seul (réglage de talus du côté d'avant) ; ses lignes de rupture partent. Un angle d'une
 * autre plateforme lié à lui devient un angle propre (même position, même altitude). Renvoie un texte d'erreur ou null.
 */
export function retirerPoint(plateformes, pf, nom) {
  const k = pf.interieurs.findIndex((p) => p.nom === nom);
  if (k >= 0) {
    pf.interieurs.splice(k, 1);
  } else {
    const i = pf.sommets.findIndex((s) => s.nom === nom);
    if (i < 0) return 'point introuvable';
    if (pf.sommets.length <= 3) return 'une plateforme garde au moins 3 angles';
    const res = sommetsResolus(pf, plateformes)[i];
    for (const q of plateformes) {
      if (q === pf) continue;
      for (const s of q.sommets) {
        if (s.lien?.id !== pf.id || s.lien.nom !== nom) continue;
        Object.assign(s, { est: res.est, nord: res.nord, alt: s.detache ? s.alt : res.alt, calc: s.detache ? s.calc : res.calc });
        delete s.lien;
        delete s.detache;
      }
    }
    pf.sommets.splice(i, 1);
    delete pf.talus[nom];
  }
  pf.ruptures = pf.ruptures.filter(([a, b]) => a !== nom && b !== nom);
  return null;
}

/** Δ Z : ajoute dz à toutes les altitudes de la plateforme (et des plateformes accrochées si « avecAccrochees »). */
export function appliquerDeltaZ(plateformes, id, dz, avecAccrochees = false) {
  const ids = avecAccrochees ? plateformesAccrochees(plateformes, id) : new Set([id]);
  const faits = new Set();
  for (const pf of plateformes) {
    if (!ids.has(pf.id)) continue;
    for (const s of [...pf.sommets, ...pf.interieurs]) {
      // Un angle lié non détaché bouge avec sa source (une seule fois, même partagé par plusieurs plateformes).
      const cible = s.lien && !s.detache ? sommetSource(plateformes, s) : s;
      if (faits.has(cible) || cible.alt == null) continue;
      faits.add(cible);
      cible.alt = Math.round((cible.alt + dz) * 1000) / 1000;
    }
  }
}

// --- Triangles de la plateforme ---

/** Vrai si (x, y) est dans le polygone [{ est, nord }] (pair-impair). */
function dedans(x, y, poly) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if ((a.nord > y) !== (b.nord > y) && x < ((b.est - a.est) * (y - a.nord)) / (b.nord - a.nord) + a.est) r = !r;
  }
  return r;
}

/**
 * Triangles de la plateforme (contour + points intérieurs + lignes de rupture imposées). « trianguler » =
 * trianglerAvecContraintes (topo/volume.js, passé pour garder ce fichier sans dépendance lourde).
 * Renvoie { triangles: [[p, q, r]] (points { nom, est, nord, altitude }) } ou { erreur }.
 */
export function trianglesPlateforme(pf, plateformes, trianguler) {
  const sommets = sommetsResolus(pf, plateformes);
  if (sommets.length < 3) return { erreur: 'il faut au moins 3 angles' };
  const tous = [...sommets, ...pf.interieurs];
  const manque = tous.filter((p) => p.alt == null).map((p) => p.nom);
  if (manque.length) return { erreur: `altitude manquante : ${manque.slice(0, 6).join(', ')}${manque.length > 6 ? '…' : ''}` };
  const parNom = new Map(tous.map((p) => [p.nom, { nom: p.nom, est: p.est, nord: p.nord, altitude: p.alt }]));
  const noms = [...parNom.keys()];
  const segments = [];
  for (let i = 0; i < sommets.length; i += 1) segments.push([sommets[i].nom, sommets[(i + 1) % sommets.length].nom]);
  for (const [a, b] of pf.ruptures) if (parNom.has(a) && parNom.has(b)) segments.push([a, b]);
  const r = trianguler(noms, segments, parNom);
  if (r.erreurs) return { erreur: r.erreurs[0] };
  const triangles = r.triangles.filter((t) => dedans((t[0].est + t[1].est + t[2].est) / 3, (t[0].nord + t[1].nord + t[2].nord) / 3, sommets));
  return { triangles };
}

// --- Talus (avec berme) ---

/**
 * Altitude du talus à d m du bord (profil) : nature 'remblai' (descend) ou 'deblai' (monte) ; p1 = talus ① { horizontal,
 * vertical }, berme = { hauteur, largeur, p3 } ou null. Renvoie { z, partie (1, 'berme', 3) }.
 */
export function profilTalus(zBord, d, nature, p1, berme = null) {
  const sens = nature === 'remblai' ? -1 : 1;
  const r1 = p1.vertical / p1.horizontal;
  if (!berme) return { z: zBord + sens * d * r1, partie: 1 };
  const d1 = berme.hauteur / r1;
  if (d <= d1) return { z: zBord + sens * d * r1, partie: 1 };
  if (d <= d1 + berme.largeur) return { z: zBord + sens * berme.hauteur, partie: 'berme' };
  const r3 = berme.p3.vertical / berme.p3.horizontal;
  return { z: zBord + sens * (berme.hauteur + (d - d1 - berme.largeur) * r3), partie: 3 };
}

/** Première distance (m) où le profil rencontre le terrain en partant de p dans la direction u (longueur 1), ou null. */
function entreeProfil(p, u, zBord, nature, p1, berme, altitudeTerrain, distanceMax) {
  const ecart = (d) => {
    const t = altitudeTerrain(p.est + u.est * d, p.nord + u.nord * d);
    return t == null ? null : profilTalus(zBord, d, nature, p1, berme).z - t;
  };
  const PAS = 0.25;
  let avant = ecart(0);
  let dAvant = 0;
  if (avant === 0) return 0;
  for (let d = PAS; d <= distanceMax + 1e-9; d += PAS) {
    const v = ecart(d);
    if (v == null) {
      avant = null;
      continue;
    }
    if (avant != null && Math.sign(v) !== Math.sign(avant)) {
      let [a, b, va] = [dAvant, d, avant];
      while (b - a > 0.0005) {
        const m = (a + b) / 2;
        const vm = ecart(m);
        if (vm == null) break;
        if (Math.sign(vm) === Math.sign(va)) [a, va] = [m, vm];
        else b = m;
      }
      return (a + b) / 2;
    }
    avant = v;
    dAvant = d;
  }
  return null;
}

/**
 * Talus d'une plateforme jusqu'à la surface de référence, côté par côté.
 * - sommets : sommetsResolus (altitudes connues) ;
 * - reglageCote(i) → { pentes: { deblai, remblai } ({ horizontal, vertical }), berme? (propre au côté : objet ou null = aucune ;
 *   absent = celle de la plateforme) } ou null (pas de talus sur ce côté) ;
 * - berme : { hauteur, largeur, p3: { deblai, remblai } } ou null ;
 * - altitudeTerrain(est, nord) → m ou null.
 * Renvoie { colonnes: [{ points: [{ est, nord, altitude }…] (du bord à l'entrée en terre, avec les 2 bords de la berme
 *   s'il y en a), nature, chaine (n° de suite continue), sommet (n° de l'angle ou null) }], erreurs: [texte] }.
 */
export function talusPlateforme(sommets, reglageCote, berme, altitudeTerrain, { pas = 1, distanceMax = 200 } = {}) {
  const n = sommets.length;
  const erreurs = [];
  const colonnes = [];
  if (n < 3 || sommets.some((s) => s.alt == null)) return { colonnes, erreurs: ['altitudes de la plateforme incomplètes'] };
  let aire = 0;
  for (let i = 0; i < n; i += 1) aire += sommets[i].est * sommets[(i + 1) % n].nord - sommets[(i + 1) % n].est * sommets[i].nord;
  const signe = aire >= 0 ? 1 : -1;
  const normale = (a, b) => {
    const l = longueurPlan(a, b) || 1;
    return { est: ((b.nord - a.nord) / l) * signe, nord: (-(b.est - a.est) / l) * signe };
  };
  const normales = sommets.map((a, i) => normale(a, sommets[(i + 1) % n]));
  const reglages = sommets.map((_, i) => reglageCote(i));
  let chaine = 0;

  // dir : direction du talus en plan (sa longueur allonge l'horizontale : arête d'un angle), ou fonction de la nature
  // (0.304.0 : angle entre deux côtés de pentes différentes).
  const colonne = (p, zBord, dirOuFonction, reglage, sommet, cote) => {
    const pentes = reglage.pentes;
    // 0.302.0 : berme propre au côté (reglage.berme, null = aucune), sinon celle de la plateforme.
    const bermeIci = reglage.berme !== undefined ? reglage.berme : berme;
    const t = altitudeTerrain(p.est, p.nord);
    if (t == null) {
      erreurs.push(`surface de référence absente sous E ${p.est.toFixed(1)} N ${p.nord.toFixed(1)}`);
      return null;
    }
    const nature = zBord - t >= 0 ? 'remblai' : 'deblai';
    const p1 = pentes[nature];
    const dir = typeof dirOuFonction === 'function' ? dirOuFonction(nature) : dirOuFonction;
    const b = bermeIci ? { hauteur: bermeIci.hauteur, largeur: bermeIci.largeur, p3: bermeIci.p3[nature] } : null;
    const lu = Math.hypot(dir.est, dir.nord) || 1;
    const u = { est: dir.est / lu, nord: dir.nord / lu };
    // Le long d'une arête (angle), la distance en plan est plus longue : on garde le profil vu sur la normale.
    const facteur = lu;
    const terrainLe = (e, nn) => altitudeTerrain(e, nn);
    const dPlan = Math.abs(zBord - t) < 1e-6 ? 0 : entreeProfil(p, u, zBord, nature, { horizontal: p1.horizontal * facteur, vertical: p1.vertical }, b ? { ...b, largeur: b.largeur * facteur, p3: { horizontal: b.p3.horizontal * facteur, vertical: b.p3.vertical } } : null, terrainLe, distanceMax * facteur);
    if (dPlan == null) {
      erreurs.push(`pas d'entrée en terre à moins de ${distanceMax} m (E ${p.est.toFixed(1)} N ${p.nord.toFixed(1)})`);
      return null;
    }
    const pts = [{ est: p.est, nord: p.nord, altitude: zBord }];
    if (b) {
      const r1 = p1.vertical / (p1.horizontal * facteur);
      const d1 = b.hauteur / r1;
      const sens = nature === 'remblai' ? -1 : 1;
      if (dPlan > d1 + 1e-6) {
        pts.push({ est: p.est + u.est * d1, nord: p.nord + u.nord * d1, altitude: zBord + sens * b.hauteur });
        const d2 = Math.min(dPlan, d1 + b.largeur * facteur);
        if (d2 > d1 + 1e-6) pts.push({ est: p.est + u.est * d2, nord: p.nord + u.nord * d2, altitude: zBord + sens * b.hauteur });
      }
    }
    if (dPlan > 1e-6) {
      const fin = profilTalus(zBord, dPlan, nature, { horizontal: p1.horizontal * facteur, vertical: p1.vertical }, b ? { ...b, largeur: b.largeur * facteur, p3: { horizontal: b.p3.horizontal * facteur, vertical: b.p3.vertical } } : null);
      const dernier = pts.at(-1);
      if (Math.hypot(dernier.est - (p.est + u.est * dPlan), dernier.nord - (p.nord + u.nord * dPlan)) > 1e-6) pts.push({ est: p.est + u.est * dPlan, nord: p.nord + u.nord * dPlan, altitude: fin.z });
    }
    return { points: pts, nature, sommet, cote };
  };
  const ratio = (r, nature) => r.pentes[nature].vertical / r.pentes[nature].horizontal;

  for (let k = 0; k < n; k += 1) {
    const a = sommets[k];
    const b = sommets[(k + 1) % n];
    const avant = reglages[(k + n - 1) % n];
    const ici = reglages[k];
    // Angle k : colonne sur l'arête (bissectrice) si les deux côtés ont un talus ; sur la normale du côté qui en a un sinon.
    // (Angle 0 sans talus après lui : sa colonne est ajoutée à la fin, avec le dernier côté.)
    if ((avant || ici) && !(k === 0 && avant && !ici)) {
      let dir;
      if (avant && ici) {
        // Arête de l'angle = croisement des deux plans de talus : en plan, le point p où les deux talus ont descendu
        // (ou monté) de 1 m : n1·p = 1 / r1 et n2·p = 1 / r2 (r = V / H de chaque côté). Mêmes pentes : la bissectrice.
        const n1 = normales[(k + n - 1) % n];
        const n2 = normales[k];
        dir = (nature) => {
          const r1 = ratio(avant, nature);
          const r2 = ratio(ici, nature);
          const det = n1.est * n2.nord - n1.nord * n2.est;
          if (Math.abs(det) < 1e-6 || 1 + n1.est * n2.est + n1.nord * n2.nord < 1e-6) return n2;
          const p = { est: (n2.nord / r1 - n1.nord / r2) / det, nord: (n1.est / r2 - n2.est / r1) / det };
          // Longueur = allongement de l'horizontale de « ici » le long de l'arête.
          return { est: p.est * r2, nord: p.nord * r2 };
        };
      } else dir = ici ? normales[k] : normales[(k + n - 1) % n];
      if (!avant) chaine += 1;
      const c = colonne(a, a.alt, dir, ici ?? avant, k, ici ? k : (k + n - 1) % n);
      if (c) colonnes.push({ ...c, chaine });
    }
    if (!ici) continue;
    const l = longueurPlan(a, b);
    const nombre = Math.max(1, Math.ceil(l / pas));
    for (let j = 1; j < nombre; j += 1) {
      const t = j / nombre;
      const p = { est: a.est + (b.est - a.est) * t, nord: a.nord + (b.nord - a.nord) * t };
      const c = colonne(p, a.alt + (b.alt - a.alt) * t, normales[k], ici, null, k);
      if (c) colonnes.push({ ...c, chaine });
    }
    // Dernier côté avec talus, mais pas le suivant : la colonne de l'angle d'arrivée ferme la suite.
    if (!reglages[(k + 1) % n] && k + 1 === n) {
      const c = colonne(b, b.alt, normales[k], ici, (k + 1) % n, k);
      if (c) colonnes.push({ ...c, chaine });
    }
  }
  // Tour complet : une seule suite, fermée. Sinon, si le dernier côté et le premier ont un talus, la dernière suite
  // continue la première : on la remet devant.
  const ferme = reglages.every(Boolean);
  if (!ferme && reglages[n - 1] && reglages[0] && colonnes.length) {
    const derniere = colonnes.at(-1).chaine;
    const premiere = colonnes[0].chaine;
    if (derniere !== premiere) {
      const fin = colonnes.filter((c) => c.chaine === derniere).map((c) => ({ ...c, chaine: premiere }));
      const reste = colonnes.filter((c) => c.chaine !== derniere);
      colonnes.length = 0;
      colonnes.push(...fin, ...reste);
    }
  }
  return { colonnes, erreurs: [...new Set(erreurs)].slice(0, 5), ferme };
}

/** Triangles du talus (bandes entre colonnes voisines de la même suite ; tour fermé si « ferme »). */
export function trianglesTalus({ colonnes, ferme }) {
  const tri = [];
  const relier = (c1, c2) => {
    const a = c1.points;
    const b = c2.points;
    if (a.length === b.length) {
      for (let i = 0; i + 1 < a.length; i += 1) {
        tri.push([a[i], b[i], b[i + 1]]);
        tri.push([a[i], b[i + 1], a[i + 1]]);
      }
    } else {
      // Une seule a une berme (le talus la quitte entre deux colonnes) : éventail simple.
      const [court, long, inverse] = a.length < b.length ? [a, b, false] : [b, a, true];
      for (let i = 0; i + 1 < long.length; i += 1) {
        const j = Math.min(court.length - 1, Math.round((i / (long.length - 1)) * (court.length - 1)));
        const t = [court[j], long[i], long[i + 1]];
        tri.push(inverse ? [t[0], t[2], t[1]] : t);
      }
      for (let j = 0; j + 1 < court.length; j += 1) tri.push(inverse ? [court[j], long.at(-1), court[j + 1]] : [court[j], court[j + 1], long.at(-1)]);
    }
  };
  for (let i = 0; i + 1 < colonnes.length; i += 1) if (colonnes[i].chaine === colonnes[i + 1].chaine) relier(colonnes[i], colonnes[i + 1]);
  if (ferme && colonnes.length > 2) relier(colonnes.at(-1), colonnes[0]);
  // Triangles plats (deux points au même endroit) retirés.
  return tri.filter(([p, q, r]) => Math.abs((q.est - p.est) * (r.nord - p.nord) - (q.nord - p.nord) * (r.est - p.est)) > 1e-8);
}

/** Réglage du talus du côté i pour talusPlateforme (null si pas de talus : côté partagé, case décochée, pente illisible). */
export function reglageDuCote(plateformes, pf, i) {
  if (cotePartage(plateformes, pf, i)) return null;
  const t = pf.talus[pf.sommets[i].nom] ?? TALUS_DEFAUT;
  if (!t.on) return null;
  const deblai = lireHV(t.deb);
  const remblai = lireHV(t.rem);
  if (!deblai || !remblai) return null;
  // 0.302.0 : berme du côté : « comme la plateforme » (rien), « aucune », ou « propre » (ses réglages).
  if (t.berme?.mode === 'aucune') return { pentes: { deblai, remblai }, berme: null };
  if (t.berme?.mode === 'propre') return { pentes: { deblai, remblai }, berme: bermeDe({ berme: { ...t.berme, on: true } }) };
  return { pentes: { deblai, remblai } };
}

/** Berme de la plateforme pour talusPlateforme, ou null. */
export function bermeDe(pf) {
  const b = pf.berme;
  if (!b?.on || !(b.hauteur > 0) || !(b.largeur >= 0)) return null;
  const deblai = lireHV(b.deb);
  const remblai = lireHV(b.rem);
  return deblai && remblai ? { hauteur: b.hauteur, largeur: b.largeur, p3: { deblai, remblai } } : null;
}

/** Points et faces (indices) d'une surface en triangles : { points: [{ nom, est, nord, altitude }], faces }. */
export function pointsEtFaces(triangles, prefixe) {
  const index = new Map();
  const points = [];
  const cle = (p) => `${p.est.toFixed(4)} ${p.nord.toFixed(4)} ${p.altitude.toFixed(4)}`;
  const faces = triangles.map((t) => t.map((p) => {
    const k = cle(p);
    if (!index.has(k)) {
      index.set(k, points.length);
      points.push({ nom: p.nom ?? `${prefixe}T${points.length + 1}`, est: Math.round(p.est * 1000) / 1000, nord: Math.round(p.nord * 1000) / 1000, altitude: Math.round(p.altitude * 1000) / 1000 });
    }
    return index.get(k);
  }));
  return { points, faces };
}

// --- Groupes et étapes (0.302.0, décisions du 24.11) ---
// projet.groupesPlateformes = [{ id, nom, couleur, terrainId }] ; une plateforme est dans UN seul groupe (pf.groupeId).
// Un groupe = une seule surface du projet (ses plateformes + leurs talus ; pas de talus entre elles, côtés partagés) ;
// sa surface de référence (terrainId) remplace celle de ses plateformes.
// Étape = une plateforme seule ou un groupe, « posée sur » une surface : le terrain, ou la surface d'une autre étape.

/**
 * Unités de calcul : [{ id, type: 'plateforme' | 'groupe', nom, couleur, membres: [pf…], terrainId, source }]
 * (source = la plateforme ou le groupe, où l'on change terrainId). Un groupe vide n'est pas une unité.
 */
export function unitesPlateformes(plateformes, groupes = []) {
  const res = [];
  for (const g of groupes) {
    const membres = plateformes.filter((p) => p.groupeId === g.id);
    if (membres.length) res.push({ id: g.id, type: 'groupe', nom: g.nom, couleur: g.couleur, membres, terrainId: g.terrainId ?? null, source: g });
  }
  for (const p of plateformes) {
    if (p.groupeId && groupes.some((g) => g.id === p.groupeId)) continue;
    res.push({ id: p.id, type: 'plateforme', nom: p.nom, couleur: p.couleur, membres: [p], terrainId: p.terrainId ?? null, source: p });
  }
  return res;
}

/**
 * Ordre de calcul des étapes : une unité posée sur la surface d'une autre unité vient après elle.
 * surfaceDeUnite(id) → id de la surface du projet de cette unité (ou null). Renvoie { ordre: [unités], cycle: [noms] }
 * (cycle : unités qui se posent les unes sur les autres en boucle ; elles sont mises à la fin, sans référence).
 */
export function ordreDesEtapes(unites, surfaceDeUnite) {
  const parSurface = new Map();
  for (const u of unites) {
    const s = surfaceDeUnite(u.id);
    if (s) parSurface.set(s, u);
  }
  const ordre = [];
  const etat = new Map(); // 1 = en cours, 2 = fait
  const cycle = [];
  const visiter = (u, pile) => {
    if (etat.get(u.id) === 2) return;
    if (etat.get(u.id) === 1) {
      cycle.push(...pile.slice(pile.indexOf(u)).map((x) => x.nom));
      return;
    }
    etat.set(u.id, 1);
    const dessous = u.terrainId ? parSurface.get(u.terrainId) : null;
    if (dessous && dessous !== u) visiter(dessous, [...pile, u]);
    etat.set(u.id, 2);
    ordre.push(u);
  };
  for (const u of unites) visiter(u, [u]);
  return { ordre, cycle: [...new Set(cycle)] };
}

/** Profil d'une surface (fonction altitude(est, nord) → m ou null) le long du segment a → b : [{ d, z }] tous les « pas » m. */
export function profilLeLong(altitude, a, b, pas = 0.5) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.min(4000, Math.ceil(L / pas)));
  const res = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    res.push({ d: t * L, z: altitude(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) });
  }
  return res;
}

/**
 * Volume « du terrain à la fin, d'un coup » (0.302.0) : sur une grille de « pas » m couvrant les emprises, l'altitude
 * finale est celle de la dernière étape qui couvre le point (ordre de calcul), comparée au terrain de départ.
 * etapes = [altitude(e, n) → m ou null] dans l'ordre ; terrain = altitude du terrain ; bornes = { estMin… }.
 * Renvoie { deblai, remblai } (m³). Approché à la taille de la grille (0,5 m : écart de l'ordre du pour mille).
 */
export function volumeTerrainAFin(etapes, terrain, bornes, pas = 0.5) {
  let deblai = 0;
  let remblai = 0;
  const aire = pas * pas;
  for (let e = bornes.estMin + pas / 2; e < bornes.estMax; e += pas) {
    for (let n = bornes.nordMin + pas / 2; n < bornes.nordMax; n += pas) {
      let z = null;
      for (const f of etapes) {
        const v = f(e, n);
        if (v != null) z = v;
      }
      if (z == null) continue;
      const t = terrain(e, n);
      if (t == null) continue;
      if (z > t) remblai += (z - t) * aire;
      else deblai += (t - z) * aire;
    }
  }
  return { deblai, remblai };
}

// --- Altitudes automatiques, sur-profondeur / sur-hauteur, ouvrages (0.303.0, lot c du 24.11) ---
// pf.auto = { mode: 'altitude' (toutes les altitudes = valeur) | 'decalage' (surface de dessous + valeur : épaisseur
//   d'un remblai > 0, profondeur d'une sur-profondeur < 0) | 'surface' (altitude d'une autre surface : remblai « jusqu'à un
//   terrain »), valeur (m), surfaceId } ; les altitudes du tableau sont alors calculées (calc).
// pf.surprof = { parentId, genre: 'creux' | 'bosse' } : plateforme dessinée DANS sa parente, posée sur elle (une étape),
//   avec un talus (même pente partout) qui va jusqu'à la parente.
// projet.ouvragesPlateformes = [{ id, nom, type: 'mur' | 'radier' | 'dalle', points: [[e, n]…] (mur : FACE EXTÉRIEURE ;
//   radier / dalle : contour), ferme, cote ('gauche' | 'droite' : côté du bâtiment en suivant la ligne, mur ouvert),
//   epaisseur (m : mur = vers le bâtiment ; radier / dalle = en hauteur), altBas (m), hauteur (m, mur) }].
// Contre un ouvrage (un côté de plateforme posé sur sa face extérieure), pas de talus.

/**
 * Sommets avec les altitudes automatiques (copie ; rien n'est changé dans le projet). altDessous(e, n) = surface sur
 * laquelle la plateforme est posée ; altSurface(e, n) = la surface de « auto.surfaceId ». Un point hors de la surface
 * voulue garde une altitude vide (le calcul le signale).
 */
export function altitudesAuto(sommets, auto, altDessous = null, altSurface = null) {
  if (!auto?.mode) return sommets;
  const v = Number(auto.valeur) || 0;
  const r = (z) => (z == null ? null : Math.round(z * 1000) / 1000);
  return sommets.map((s) => {
    let alt = null;
    if (auto.mode === 'altitude') alt = v;
    else if (auto.mode === 'decalage') {
      const z = altDessous ? altDessous(s.est, s.nord) : null;
      alt = z == null ? null : z + v;
    } else if (auto.mode === 'surface') alt = altSurface ? altSurface(s.est, s.nord) : null;
    return { ...s, alt: r(alt), calc: true };
  });
}

/** Aire signée d'une suite [[e, n]…] (> 0 dans le sens trigonométrique). */
const aireXY = (pts) => pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2;

/** Décalage simple d'une polyligne de d m à gauche (d > 0) en suivant la ligne ; coins aux croisements des côtés décalés. */
function decaler(points, d, ferme) {
  const n = points.length;
  const segs = [];
  const nb = ferme ? n : n - 1;
  for (let i = 0; i < nb; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const [nx, ny] = [-(by - ay) / l, (bx - ax) / l];
    segs.push([[ax + nx * d, ay + ny * d], [bx + nx * d, by + ny * d]]);
  }
  const croise = (s1, s2) => {
    const [[x1, y1], [x2, y2]] = s1;
    const [[x3, y3], [x4, y4]] = s2;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-12) return s1[1];
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  const res = [];
  for (let i = 0; i < n; i += 1) {
    if (ferme) res.push(croise(segs[(i - 1 + segs.length) % segs.length], segs[i % segs.length]));
    else if (i === 0) res.push(segs[0][0]);
    else if (i === n - 1) res.push(segs[i - 1][1]);
    else res.push(croise(segs[i - 1], segs[i]));
  }
  return res;
}

/**
 * Emprise en plan d'un ouvrage : { anneaux: [[[e, n]…]…] (règle pair-impair : un mur fermé = 2 anneaux), faces: [[e, n]…]
 * (la face extérieure, fermée si ferme) }. Mur : la face extérieure + son décalage de « epaisseur » vers le bâtiment
 * (intérieur du contour s'il est fermé, sinon le côté « cote ») ; radier / dalle : le contour.
 */
export function empriseOuvrage(o) {
  const pts = o.points ?? [];
  if (o.type !== 'mur') return { anneaux: [pts], faces: pts };
  const e = Math.max(0.01, Number(o.epaisseur) || 0.2);
  if (o.ferme && pts.length >= 3) {
    const versInterieur = aireXY(pts) > 0 ? e : -e; // contour trigonométrique : l'intérieur est à gauche
    return { anneaux: [pts, decaler(pts, versInterieur, true)], faces: pts };
  }
  const d = (o.cote ?? 'gauche') === 'gauche' ? e : -e;
  const autre = decaler(pts, d, false);
  return { anneaux: [[...pts, ...autre.reverse()]], faces: pts };
}

/** Haut et bas d'un ouvrage (m) : mur = bas + hauteur ; radier / dalle = bas + épaisseur. */
export const hautOuvrage = (o) => (Number(o.altBas) || 0) + (o.type === 'mur' ? Number(o.hauteur) || 0 : Number(o.epaisseur) || 0);

/** Distance (m) d'un point { est, nord } à une suite de points [[e, n]…] (fermée si « ferme »). */
function distanceALaFace(p, pts, ferme) {
  let d = Infinity;
  const nb = ferme ? pts.length : pts.length - 1;
  for (let i = 0; i < nb; i += 1) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p.est - ax) * (bx - ax) + (p.nord - ay) * (by - ay)) / l2));
    d = Math.min(d, Math.hypot(ax + t * (bx - ax) - p.est, ay + t * (by - ay) - p.nord));
  }
  return d;
}

/** Vrai si le côté a → b d'une plateforme est posé sur la face extérieure d'un ouvrage (à « tol » m près) : pas de talus. */
export function contreUnOuvrage(a, b, ouvrages = [], tol = 0.02) {
  const m = { est: (a.est + b.est) / 2, nord: (a.nord + b.nord) / 2 };
  return ouvrages.some((o) => {
    const { faces } = empriseOuvrage(o);
    const ferme = o.type !== 'mur' || o.ferme;
    return [a, b, m].every((p) => distanceALaFace(p, faces, ferme) <= tol);
  });
}

/** Parties [d1, d2] (m depuis a) du segment a → b ([e, n]) qui sont dans l'emprise de l'ouvrage (pair-impair). */
export function traverseesOuvrage(o, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1e-9) return [];
  const ts = [0, 1];
  for (const anneau of empriseOuvrage(o).anneaux) {
    for (let i = 0; i < anneau.length; i += 1) {
      const [cx, cy] = anneau[i];
      const [dx, dy] = anneau[(i + 1) % anneau.length];
      const den = (b[0] - a[0]) * (dy - cy) - (b[1] - a[1]) * (dx - cx);
      if (Math.abs(den) < 1e-12) continue;
      const t = ((cx - a[0]) * (dy - cy) - (cy - a[1]) * (dx - cx)) / den;
      const u = ((cx - a[0]) * (b[1] - a[1]) - (cy - a[1]) * (b[0] - a[0])) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
  }
  ts.sort((x, y) => x - y);
  const dedans = (x, y) => empriseOuvrage(o).anneaux.reduce((r, an) => {
    let c = false;
    for (let i = 0, j = an.length - 1; i < an.length; j = i, i += 1) {
      if ((an[i][1] > y) !== (an[j][1] > y) && x < ((an[j][0] - an[i][0]) * (y - an[i][1])) / (an[j][1] - an[i][1]) + an[i][0]) c = !c;
    }
    return c ? !r : r;
  }, false);
  const res = [];
  for (let i = 0; i + 1 < ts.length; i += 1) {
    const tm = (ts[i] + ts[i + 1]) / 2;
    if (ts[i + 1] - ts[i] > 1e-9 && dedans(a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm)) res.push([ts[i] * L, ts[i + 1] * L]);
  }
  return res;
}

/**
 * 0.307.0 (demande du 24.11 : « remblayer du bon côté ») : bande de remblai contre la face extérieure d'un ouvrage, de
 * « largeur » m, du côté OPPOSÉ au bâtiment. Mur ouvert : le long de toute la face ; contour fermé (mur fermé, radier,
 * dalle) : le long du côté « segment » (n° du côté). Renvoie le contour [[e, n]…] (la face d'abord), ou [] si impossible.
 */
export function bandeRemblai(o, largeur, segment = 0) {
  const pts = o.points ?? [];
  const L = Math.abs(Number(largeur) || 0);
  if (pts.length < 2 || !(L > 0)) return [];
  const ferme = o.type !== 'mur' || (o.ferme && pts.length >= 3);
  let face = pts;
  let d;
  if (ferme) {
    // Intérieur à gauche pour un contour trigonométrique : dehors = à droite (décalage négatif).
    d = aireXY(pts) > 0 ? -L : L;
    const i = Math.max(0, Math.min(pts.length - 1, segment));
    face = [pts[i], pts[(i + 1) % pts.length]];
  } else {
    d = (o.cote ?? 'gauche') === 'gauche' ? -L : L;
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return [...face, ...decaler(face, d, false).reverse()].map(([e, n]) => [r3(e), r3(n)]);
}

/** Côté d'un ouvrage le plus proche d'un point { est, nord } : n° du segment (contour fermé : le dernier ferme). */
export function coteOuvrageProche(o, p) {
  const pts = o.points ?? [];
  const ferme = o.type !== 'mur' || (o.ferme && pts.length >= 3);
  let meilleur = { i: 0, d: Infinity };
  for (let i = 0; i < (ferme ? pts.length : pts.length - 1); i += 1) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.est - a[0]) * dx + (p.nord - a[1]) * dy) / l2));
    const d = Math.hypot(p.est - (a[0] + t * dx), p.nord - (a[1] + t * dy));
    if (d < meilleur.d) meilleur = { i, d };
  }
  return meilleur.i;
}
