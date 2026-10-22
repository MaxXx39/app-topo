// Lecture d'un plan DXF (AutoCAD, Mensura) pour l'afficher en fond de plan : lignes, polylignes,
// arcs, cercles, courbes, textes, aplats, points, avec leurs calques et leurs couleurs.
// (Les surfaces en faces 3D d'un DXF se lisent ailleurs : voir dxf-lecture.js.)
//
// Le DXF est une suite de paires de lignes : un code (nombre) puis une valeur.
// Coordonnées : X = Est, Y = Nord, Z = altitude (m), sans aucune conversion : le plan doit être en
// MN95 (préparé au bureau). Les arcs et les courbes sont découpés en petits segments.
// Pour garder des nombres courts (et précis à l'écran), les coordonnées sont rangées par rapport
// à une origine (le coin sud-ouest du plan, arrondi au mètre), au millimètre.
//
// Résultat (rangé tel quel dans le projet) :
// { nom, origine: { est, nord }, bornes: { estMin, nordMin, estMax, nordMax },
//   calques: [{ nom, couleur ('#rrggbb'), visible }],
//   contenu: {
//     traits:  [{ c (n° du calque), k (couleur, ou null = celle du calque), p: [x, y, x, y…], f (fermé), z: [z…] (si 3D) }],
//     pleins:  [{ c, k, p }],                                  (aplats : SOLID, TRACE)
//     cercles: [{ c, k, x, y, r }],
//     textes:  [{ c, k, x, y, h (hauteur), a (angle °), t (texte), ah (0 gauche, 1 centre, 2 droite), av (0 ligne de base, 1 bas, 2 milieu, 3 haut) }],
//     points:  [{ c, k, x, y, z }],
//   },
//   compte: { objets, ignores: { TYPE: nombre } } }

// Pas maximal entre deux points d'un arc découpé (degrés).
const PAS_ARC = 10;
// Profondeur maximale des blocs dans les blocs.
const PROFONDEUR_BLOCS = 6;

/**
 * Texte d'un fichier DXF à partir de ses octets : les DXF récents (AutoCAD 2007 et après) sont
 * en UTF-8, les plus anciens dans le jeu de caractères de Windows (accents).
 */
export function texteDuDxf(octets) {
  const debut = new TextDecoder('latin1').decode(octets.subarray(0, 4000));
  const version = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d+)/.exec(debut)?.[1];
  const ancien = version && Number(version) < 1021;
  return new TextDecoder(ancien ? 'windows-1252' : 'utf-8').decode(octets);
}

/**
 * Vrai si les bornes du plan sont en Suisse en MN95 (Est 2 480 000 à 2 840 000 m,
 * Nord 1 070 000 à 1 300 000 m). Sinon, le plan est sans doute en coordonnées locales.
 */
export function estEnMn95(bornes) {
  return Boolean(bornes) && bornes.estMin >= 2480000 && bornes.estMax <= 2840000 && bornes.nordMin >= 1070000 && bornes.nordMax <= 1300000;
}

/** Lit un plan DXF. Renvoie { plan } ou { erreur } (message compréhensible). */
export function lirePlanDxf(texte, nom = 'plan.dxf') {
  if (texte.startsWith('AutoCAD Binary DXF')) return { erreur: 'DXF binaire : enregistre le fichier en DXF « texte » (ASCII)' };
  const paires = lirePaires(texte);
  if (paires.length === 0) return { erreur: 'fichier vide ou illisible' };
  const sections = lireSections(paires);
  if (!sections.ENTITIES) return { erreur: 'pas de section ENTITIES : ce n\'est pas un dessin DXF' };

  const calquesLus = lireCalques(sections.TABLES ?? []);
  const blocs = lireBlocs(sections.BLOCKS ?? []);
  const lecteur = creerLecteur(calquesLus);
  for (const entite of decouperEntites(sections.ENTITIES)) lecteur.ajouter(entite, blocs, identite(), 0);
  return { plan: lecteur.terminer(nom) };
}

// ---------------------------------------------------------------------------------------------
// Découpage du fichier

/** Paires { code (nombre), valeur (texte) }. */
function lirePaires(texte) {
  const lignes = texte.split(/\r?\n/);
  const paires = [];
  for (let i = 0; i + 1 < lignes.length; i += 2) {
    const code = Number(lignes[i].trim());
    if (!Number.isInteger(code)) continue;
    paires.push({ code, valeur: lignes[i + 1].replace(/\s+$/, '') });
  }
  return paires;
}

/** Paires de chaque section, par nom (HEADER, TABLES, BLOCKS, ENTITIES…). */
function lireSections(paires) {
  const sections = {};
  let nom = null;
  let debut = 0;
  for (let i = 0; i < paires.length; i++) {
    const { code, valeur } = paires[i];
    if (code === 0 && valeur.trim() === 'SECTION' && paires[i + 1]?.code === 2) {
      nom = paires[i + 1].valeur.trim();
      debut = i + 2;
    } else if (code === 0 && valeur.trim() === 'ENDSEC' && nom) {
      sections[nom] = paires.slice(debut, i);
      nom = null;
    }
  }
  return sections;
}

/** Entités d'une liste de paires : { type, paires } (paires dans l'ordre, sans le code 0). */
function decouperEntites(paires) {
  const entites = [];
  let courante = null;
  for (const paire of paires) {
    if (paire.code === 0) {
      courante = { type: paire.valeur.trim(), paires: [] };
      entites.push(courante);
    } else if (courante) {
      courante.paires.push(paire);
    }
  }
  // Polylignes à l'ancienne (POLYLINE) : on range les VERTEX qui suivent dans la polyligne.
  const regroupees = [];
  for (let i = 0; i < entites.length; i++) {
    const entite = entites[i];
    if (entite.type === 'POLYLINE') {
      entite.sommets = [];
      while (entites[i + 1] && entites[i + 1].type === 'VERTEX') entite.sommets.push(entites[++i]);
      if (entites[i + 1]?.type === 'SEQEND') i++;
    }
    regroupees.push(entite);
  }
  return regroupees;
}

/** Première valeur d'un code (texte), ou "parDefaut". */
function valeur(entite, code, parDefaut = undefined) {
  const paire = entite.paires.find((p) => p.code === code);
  return paire ? paire.valeur.trim() : parDefaut;
}

/** Première valeur d'un code (nombre), ou "parDefaut". */
function nombre(entite, code, parDefaut = 0) {
  const lu = Number(valeur(entite, code));
  return Number.isFinite(lu) ? lu : parDefaut;
}

/** Toutes les valeurs d'un code, dans l'ordre (nombres). */
function nombres(entite, code) {
  return entite.paires.filter((p) => p.code === code).map((p) => Number(p.valeur));
}

/** Calques de la table LAYER : Map(nom -> { couleur, visible }). */
function lireCalques(paires) {
  const calques = new Map();
  for (const entite of decouperEntites(paires)) {
    if (entite.type !== 'LAYER') continue;
    const nom = valeur(entite, 2);
    if (!nom) continue;
    const aci = nombre(entite, 62, 7);
    const vraie = valeur(entite, 420);
    // Couleur négative : calque éteint ; drapeau 1 : calque gelé.
    const visible = aci >= 0 && (nombre(entite, 70) & 1) === 0;
    calques.set(nom, { couleur: vraie ? couleurVraie(Number(vraie)) : couleurAci(Math.abs(aci)), visible });
  }
  return calques;
}

/** Blocs : Map(nom -> { base: { x, y }, entites }). */
function lireBlocs(paires) {
  const blocs = new Map();
  let bloc = null;
  for (const entite of decouperEntites(paires)) {
    if (entite.type === 'BLOCK') {
      bloc = { base: { x: nombre(entite, 10), y: nombre(entite, 20) }, entites: [] };
      blocs.set(valeur(entite, 2, ''), bloc);
    } else if (entite.type === 'ENDBLK') {
      bloc = null;
    } else if (bloc) {
      bloc.entites.push(entite);
    }
  }
  return blocs;
}

// ---------------------------------------------------------------------------------------------
// Transformations (blocs insérés) : x' = a·x + b·y + e ; y' = c·x + d·y + f

const identite = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

function composer(t, u) {
  return {
    a: t.a * u.a + t.b * u.c,
    b: t.a * u.b + t.b * u.d,
    c: t.c * u.a + t.d * u.c,
    d: t.c * u.b + t.d * u.d,
    e: t.a * u.e + t.b * u.f + t.e,
    f: t.c * u.e + t.d * u.f + t.f,
  };
}

const appliquer = (t, x, y) => [t.a * x + t.b * y + t.e, t.c * x + t.d * y + t.f];
const echelleDe = (t) => Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
const angleDe = (t) => (Math.atan2(t.c, t.a) * 180) / Math.PI;

// ---------------------------------------------------------------------------------------------
// Géométrie

/** Points d'un arc de cercle (centre, rayon, angles en degrés, sens trigonométrique). */
function pointsArc(cx, cy, r, debutDeg, finDeg) {
  let balayage = finDeg - debutDeg;
  while (balayage <= 0) balayage += 360;
  const n = Math.max(2, Math.ceil(balayage / PAS_ARC));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const angle = ((debutDeg + (balayage * i) / n) * Math.PI) / 180;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points;
}

/**
 * Points entre deux sommets d'une polyligne avec un « renflement » (bulge) : arc dont l'angle
 * vaut 4 × arctan(renflement), positif dans le sens trigonométrique. Sans le dernier point.
 * Le centre est sur la médiatrice de la corde, à la distance demi-corde × (1 − b²) / (2b),
 * côté gauche de la corde (côté droit si cette distance est négative).
 */
export function pointsRenflement([x1, y1], [x2, y2], renflement) {
  if (Math.abs(renflement) < 1e-9) return [[x1, y1]];
  const corde = Math.hypot(x2 - x1, y2 - y1);
  if (corde < 1e-12) return [[x1, y1]];
  const demi = corde / 2;
  const angle = 4 * Math.atan(renflement);
  const rayon = (demi * (1 + renflement * renflement)) / (2 * Math.abs(renflement));
  const distance = (demi * (1 - renflement * renflement)) / (2 * renflement);
  // Normale à gauche de la corde (sens P1 → P2), de longueur 1.
  const gx = -(y2 - y1) / corde;
  const gy = (x2 - x1) / corde;
  const cx = (x1 + x2) / 2 + gx * distance;
  const cy = (y1 + y2) / 2 + gy * distance;
  const depart = Math.atan2(y1 - cy, x1 - cx);
  const n = Math.max(2, Math.ceil(Math.abs((angle * 180) / Math.PI) / PAS_ARC));
  const points = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const a = depart + (angle * i) / n;
    points.push([cx + rayon * Math.cos(a), cy + rayon * Math.sin(a)]);
  }
  return points;
}

/** Points d'une courbe B-spline (degré, points de contrôle, nœuds), calculés par l'algorithme de De Boor. */
export function pointsSpline(degre, controle, noeuds) {
  if (controle.length < 2) return controle;
  if (noeuds.length !== controle.length + degre + 1 || degre < 1) return controle; // courbe mal décrite : on relie les points
  const debut = noeuds[degre];
  const fin = noeuds[controle.length];
  // Nombre de points : 8 par morceau de courbe, mais pas plus d'un tous les 2 cm (petites courbes).
  let longueur = 0;
  for (let i = 1; i < controle.length; i++) longueur += Math.hypot(controle[i][0] - controle[i - 1][0], controle[i][1] - controle[i - 1][1]);
  const n = Math.max(2, Math.min((controle.length - degre) * 8, Math.ceil(longueur / 0.02)));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const u = Math.min(debut + ((fin - debut) * i) / n, fin - 1e-12 * Math.max(1, Math.abs(fin)));
    let k = degre;
    while (k < controle.length - 1 && u >= noeuds[k + 1]) k++;
    const d = [];
    for (let j = 0; j <= degre; j++) d.push([...controle[k - degre + j]]);
    for (let r = 1; r <= degre; r++) {
      for (let j = degre; j >= r; j--) {
        const gauche = noeuds[k - degre + j];
        const droite = noeuds[k + 1 + j - r];
        const alpha = droite - gauche === 0 ? 0 : (u - gauche) / (droite - gauche);
        d[j] = [(1 - alpha) * d[j - 1][0] + alpha * d[j][0], (1 - alpha) * d[j - 1][1] + alpha * d[j][1]];
      }
    }
    points.push(d[degre]);
  }
  return points;
}

// ---------------------------------------------------------------------------------------------
// Couleurs AutoCAD

const ACI_DE_BASE = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0' };

/**
 * Couleur d'un numéro de couleur AutoCAD (1 à 255). La couleur 7 (blanc sur fond noir dans
 * AutoCAD) est dessinée en noir, le plan de l'appli ayant un fond clair. Les couleurs 10 à 249
 * sont approchées (teinte tous les 15°, 5 luminosités, pleine ou pâle).
 */
export function couleurAci(numero) {
  if (ACI_DE_BASE[numero]) return ACI_DE_BASE[numero];
  if (numero >= 250 && numero <= 255) {
    const gris = Math.round(51 + ((numero - 250) * (255 - 51)) / 5);
    return `#${gris.toString(16).padStart(2, '0').repeat(3)}`;
  }
  if (numero < 10 || numero > 249) return '#000000';
  const teinte = Math.floor((numero - 10) / 10) * 15;
  const rang = (numero - 10) % 10;
  const luminosite = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][rang];
  const pale = rang % 2 === 1;
  return hsvVersHex(teinte, pale ? 0.5 : 1, luminosite);
}

function hsvVersHex(teinte, saturation, valeurMax) {
  const f = (n) => {
    const k = (n + teinte / 60) % 6;
    return valeurMax - valeurMax * saturation * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Couleur « vraie » (code 420, rouge × 65536 + vert × 256 + bleu). */
function couleurVraie(rvb) {
  return `#${(rvb & 0xffffff).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Lecture des entités

/** Symboles AutoCAD d'un texte : %%c → Ø, %%d → °, %%p → ±. */
export function symbolesTexte(texte) {
  return texte.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').trim();
}

/** Texte d'un MTEXT sans ses codes de mise en forme ({\fArial;…}, \P = retour à la ligne…). */
export function texteSansMiseEnForme(texte) {
  return symbolesTexte(
    texte
      .replace(/\\P/g, ' ')
      .replace(/\\[ACcFfHhQTWp][^;]*;/g, '')
      .replace(/\\[LlOoKk]/g, '')
      .replace(/\\S([^;]*);/g, '$1')
      .replace(/[{}]/g, ''),
  );
}

/** Crée le lecteur qui accumule les objets du plan (coordonnées absolues). */
function creerLecteur(calquesLus) {
  const calques = []; // [{ nom, couleur, visible }]
  const indexCalque = new Map();
  const brut = { traits: [], pleins: [], cercles: [], textes: [], points: [] };
  const ignores = {};
  let estMin = Infinity;
  let nordMin = Infinity;
  let estMax = -Infinity;
  let nordMax = -Infinity;
  const etendre = (x, y) => {
    estMin = Math.min(estMin, x);
    nordMin = Math.min(nordMin, y);
    estMax = Math.max(estMax, x);
    nordMax = Math.max(nordMax, y);
  };

  function numeroCalque(nom) {
    if (!indexCalque.has(nom)) {
      const lu = calquesLus.get(nom) ?? { couleur: '#000000', visible: true };
      indexCalque.set(nom, calques.length);
      calques.push({ nom, couleur: lu.couleur, visible: lu.visible });
    }
    return indexCalque.get(nom);
  }

  /** Couleur propre de l'entité, ou null (celle du calque). "couleurBloc" : pour la couleur DUBLOC. */
  function couleurPropre(entite, couleurBloc) {
    const vraie = valeur(entite, 420);
    if (vraie) return couleurVraie(Number(vraie));
    const aci = nombre(entite, 62, 256);
    if (aci === 256) return null;
    if (aci === 0) return couleurBloc ?? null;
    return couleurAci(Math.abs(aci));
  }

  function trait(c, k, points, ferme, z = null) {
    if (points.length < 2) return;
    for (const [x, y] of points) etendre(x, y);
    brut.traits.push({ c, k, points, f: ferme, z });
  }

  /**
   * Ajoute une entité (et, pour un bloc, son contenu) avec la transformation "t" (blocs insérés).
   * "calqueBloc", "couleurBloc" : calque et couleur de l'insertion, pour les entités du bloc sur le calque 0.
   */
  function ajouter(entite, blocs, t, profondeur, calqueBloc = null, couleurBloc = null) {
    let nomCalque = valeur(entite, 8, '0');
    if (calqueBloc && nomCalque === '0') nomCalque = calqueBloc;
    const c = numeroCalque(nomCalque);
    const k = couleurPropre(entite, couleurBloc);
    const point = (x, y) => appliquer(t, x, y);
    const echelle = echelleDe(t);

    switch (entite.type) {
      case 'LINE': {
        const z1 = nombre(entite, 30);
        const z2 = nombre(entite, 31);
        trait(c, k, [point(nombre(entite, 10), nombre(entite, 20)), point(nombre(entite, 11), nombre(entite, 21))], false, z1 || z2 ? [z1, z2] : null);
        break;
      }
      case 'LWPOLYLINE': {
        const xs = nombres(entite, 10);
        const ys = nombres(entite, 20);
        // Renflements : chaque code 42 suit le sommet auquel il appartient.
        const renflements = new Array(xs.length).fill(0);
        let sommet = -1;
        for (const paire of entite.paires) {
          if (paire.code === 10) sommet++;
          else if (paire.code === 42 && sommet >= 0) renflements[sommet] = Number(paire.valeur) || 0;
        }
        const ferme = (nombre(entite, 70) & 1) === 1;
        const points = [];
        const n = xs.length;
        for (let i = 0; i < n; i++) {
          const suivant = (i + 1) % n;
          if (i === n - 1 && !ferme) {
            points.push([xs[i], ys[i]]);
            break;
          }
          points.push(...pointsRenflement([xs[i], ys[i]], [xs[suivant], ys[suivant]], renflements[i]));
        }
        const altitude = nombre(entite, 38);
        trait(c, k, points.map(([x, y]) => point(x, y)), ferme, altitude ? points.map(() => altitude) : null);
        break;
      }
      case 'POLYLINE': {
        const drapeau = nombre(entite, 70);
        if (drapeau & (16 | 64)) {
          ignores.MAILLAGE = (ignores.MAILLAGE ?? 0) + 1; // maillages : surfaces (voir dxf-lecture.js)
          break;
        }
        const sommets = (entite.sommets ?? []).map((v) => ({ x: nombre(v, 10), y: nombre(v, 20), z: nombre(v, 30), renflement: nombre(v, 42) }));
        const ferme = (drapeau & 1) === 1;
        const points = [];
        const zs = [];
        for (let i = 0; i < sommets.length; i++) {
          const s = sommets[i];
          const suivant = sommets[(i + 1) % sommets.length];
          const morceau = i === sommets.length - 1 && !ferme ? [[s.x, s.y]] : pointsRenflement([s.x, s.y], [suivant.x, suivant.y], s.renflement);
          points.push(...morceau);
          for (let j = 0; j < morceau.length; j++) zs.push(s.z);
        }
        trait(c, k, points.map(([x, y]) => point(x, y)), ferme, zs.some((z) => z) ? zs : null);
        break;
      }
      case 'ARC':
        trait(c, k, pointsArc(nombre(entite, 10), nombre(entite, 20), nombre(entite, 40), nombre(entite, 50), nombre(entite, 51)).map(([x, y]) => point(x, y)), false);
        break;
      case 'CIRCLE': {
        const [x, y] = point(nombre(entite, 10), nombre(entite, 20));
        const r = nombre(entite, 40) * echelle;
        etendre(x - r, y - r);
        etendre(x + r, y + r);
        brut.cercles.push({ c, k, x, y, r });
        break;
      }
      case 'ELLIPSE': {
        const cx = nombre(entite, 10);
        const cy = nombre(entite, 20);
        const ax = nombre(entite, 11);
        const ay = nombre(entite, 21);
        const rapport = nombre(entite, 40, 1);
        const debut = nombre(entite, 41, 0);
        let fin = nombre(entite, 42, 2 * Math.PI);
        if (fin <= debut) fin += 2 * Math.PI;
        const n = Math.max(8, Math.ceil(((fin - debut) * 180) / Math.PI / PAS_ARC));
        const points = [];
        for (let i = 0; i <= n; i++) {
          const a = debut + ((fin - debut) * i) / n;
          points.push(point(cx + ax * Math.cos(a) - ay * rapport * Math.sin(a), cy + ay * Math.cos(a) + ax * rapport * Math.sin(a)));
        }
        trait(c, k, points, false);
        break;
      }
      case 'SPLINE': {
        const controle = nombres(entite, 10).map((x, i) => [x, nombres(entite, 20)[i]]);
        const ajustement = nombres(entite, 11).map((x, i) => [x, nombres(entite, 21)[i]]);
        const points = controle.length >= 2 ? pointsSpline(nombre(entite, 71, 3), controle, nombres(entite, 40)) : ajustement;
        trait(c, k, points.map(([x, y]) => point(x, y)), (nombre(entite, 70) & 1) === 1);
        break;
      }
      case 'SOLID':
      case 'TRACE': {
        // Les sommets 3 et 4 sont dans l'ordre « en Z » : on remet le contour dans l'ordre.
        const sommets = [0, 1, 3, 2].map((i) => point(nombre(entite, 10 + i), nombre(entite, 20 + i)));
        for (const [x, y] of sommets) etendre(x, y);
        brut.pleins.push({ c, k, points: sommets });
        break;
      }
      case 'POINT': {
        const [x, y] = point(nombre(entite, 10), nombre(entite, 20));
        etendre(x, y);
        brut.points.push({ c, k, x, y, z: nombre(entite, 30) });
        break;
      }
      case 'TEXT':
      case 'MTEXT': {
        const brutTexte = entite.type === 'MTEXT'
          ? entite.paires.filter((p) => p.code === 3 || p.code === 1).map((p) => p.valeur).join('')
          : valeur(entite, 1, '');
        const lu = entite.type === 'MTEXT' ? texteSansMiseEnForme(brutTexte) : symbolesTexte(brutTexte);
        if (!lu) break;
        let ah = 0;
        let av = 0;
        let x = nombre(entite, 10);
        let y = nombre(entite, 20);
        let angle = nombre(entite, 50);
        if (entite.type === 'TEXT') {
          ah = Math.min(nombre(entite, 72), 2);
          av = nombre(entite, 73);
          if (ah !== 0 || av !== 0) {
            x = nombre(entite, 11, x);
            y = nombre(entite, 21, y);
          }
        } else {
          // MTEXT : point d'attache 1 à 9 (haut gauche … bas droite) ; direction en code 11/21.
          const attache = nombre(entite, 71, 1);
          ah = (attache - 1) % 3;
          av = [3, 2, 1][Math.floor((attache - 1) / 3)];
          if (valeur(entite, 11) !== undefined) angle = (Math.atan2(nombre(entite, 21), nombre(entite, 11)) * 180) / Math.PI;
        }
        const [xp, yp] = point(x, y);
        etendre(xp, yp);
        brut.textes.push({ c, k, x: xp, y: yp, h: nombre(entite, 40, 1) * echelle, a: angle + angleDe(t), t: lu, ah, av });
        break;
      }
      case 'INSERT': {
        const bloc = blocs.get(valeur(entite, 2, ''));
        if (!bloc || profondeur >= PROFONDEUR_BLOCS) break;
        const sx = nombre(entite, 41, 1);
        const sy = nombre(entite, 42, 1);
        const rotation = (nombre(entite, 50) * Math.PI) / 180;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        // Insertion : déplacer la base du bloc à l'origine, agrandir, tourner, poser au point d'insertion.
        const local = { a: cos * sx, b: -sin * sy, c: sin * sx, d: cos * sy, e: 0, f: 0 };
        const [bx, by] = appliquer(local, bloc.base.x, bloc.base.y);
        local.e = nombre(entite, 10) - bx;
        local.f = nombre(entite, 20) - by;
        const total = composer(t, local);
        for (const contenu of bloc.entites) ajouter(contenu, blocs, total, profondeur + 1, nomCalque, k);
        break;
      }
      case 'ATTRIB':
      case 'ATTDEF':
      case 'VIEWPORT':
      case 'SEQEND':
      case 'VERTEX':
        break;
      default:
        ignores[entite.type] = (ignores[entite.type] ?? 0) + 1;
    }
  }

  /** Range tout par rapport à l'origine (coin sud-ouest arrondi au mètre), au millimètre. */
  function terminer(nom) {
    const vide = !Number.isFinite(estMin);
    const origine = vide ? { est: 0, nord: 0 } : { est: Math.floor(estMin), nord: Math.floor(nordMin) };
    const mm = (v) => Math.round(v * 1000) / 1000;
    const local = ([x, y]) => [mm(x - origine.est), mm(y - origine.nord)];
    const contenu = {
      traits: brut.traits.map(({ c, k, points, f, z }) => ({ c, k, p: points.flatMap(local), f, ...(z ? { z: z.map(mm) } : {}) })),
      pleins: brut.pleins.map(({ c, k, points }) => ({ c, k, p: points.flatMap(local) })),
      cercles: brut.cercles.map(({ c, k, x, y, r }) => ({ c, k, x: mm(x - origine.est), y: mm(y - origine.nord), r: mm(r) })),
      textes: brut.textes.map((texte) => ({ ...texte, x: mm(texte.x - origine.est), y: mm(texte.y - origine.nord), h: mm(texte.h), a: Math.round(texte.a * 100) / 100 })),
      points: brut.points.map(({ c, k, x, y, z }) => ({ c, k, x: mm(x - origine.est), y: mm(y - origine.nord), z: mm(z) })),
    };
    const objets = contenu.traits.length + contenu.pleins.length + contenu.cercles.length + contenu.textes.length + contenu.points.length;
    return {
      nom,
      origine,
      bornes: vide ? null : { estMin, nordMin, estMax, nordMax },
      calques,
      contenu,
      compte: { objets, ignores },
    };
  }

  return { ajouter, terminer };
}
