// Lecture d'un fichier DXF (texte) comme fond de plan : lignes, polylignes, cercles, arcs, textes.
//
// Le fond sert à voir le plan du projet (talus, murs, axes...) sous les points, et plus tard
// à toucher ses coins pour créer des points. On ne garde que la position en plan :
// X = Est, Y = Nord (m, MN95), sans aucune conversion. Les altitudes (Z) sont ignorées.
//
// Un DXF est une suite de paires de lignes : un code (nombre) puis une valeur.
// Les blocs (INSERT) ne sont pas encore lus : ils sont comptés dans les avertissements.

// Nombre de segments pour dessiner un cercle ou un arc complet.
const SEGMENTS_CERCLE = 32;

/**
 * Lit le texte d'un fichier DXF.
 * Renvoie { calques, traits, textes, erreurs, avertissements } :
 * - calques : noms des calques qui contiennent quelque chose, triés
 * - traits : [{ calque, points: [{ est, nord }], ferme }] (lignes, polylignes, cercles, arcs) ;
 *   les cercles et arcs ont en plus courbe: true et leur centre { est, nord }
 * - textes : [{ calque, est, nord, texte, hauteur (m), rotation (degrés) }]
 */
export function lireFondDXF(texte) {
  const resultat = { calques: [], traits: [], textes: [], erreurs: [], avertissements: [] };
  if (texte.startsWith('AutoCAD Binary DXF')) {
    resultat.erreurs.push('DXF binaire non lu : enregistre le fichier en DXF « texte » (ASCII)');
    return resultat;
  }
  const entites = entitesDuFichier(lirePaires(texte));
  const ignores = new Map(); // type d'entité non lu -> nombre

  for (let i = 0; i < entites.length; i++) {
    const entite = entites[i];
    const { type, calque } = entite;
    if (type === 'LINE') {
      const a = point(entite, '10', '20');
      const b = point(entite, '11', '21');
      if (a && b) resultat.traits.push({ calque, points: [a, b], ferme: false });
    } else if (type === 'LWPOLYLINE') {
      const sommets = sommetsLwpolyligne(entite);
      if (sommets.length >= 2) resultat.traits.push({ calque, points: sommets, ferme: (entier(valeur(entite, '70')) & 1) !== 0 });
    } else if (type === 'POLYLINE') {
      // Ancienne polyligne : ses sommets sont les VERTEX qui suivent, jusqu'à SEQEND.
      const drapeau = entier(valeur(entite, '70'));
      const sommets = [];
      for (i++; i < entites.length && entites[i].type === 'VERTEX'; i++) {
        const sommet = point(entites[i], '10', '20');
        if (sommet) sommets.push(sommet);
      }
      // Les maillages (drapeaux 16 et 64) sont des surfaces : lus par l'import de surface.
      if ((drapeau & (16 | 64)) === 0 && sommets.length >= 2) resultat.traits.push({ calque, points: sommets, ferme: (drapeau & 1) !== 0 });
    } else if (type === 'CIRCLE') {
      const centre = point(entite, '10', '20');
      const rayon = Number(valeur(entite, '40'));
      // courbe : dessiné en petits segments ; on s'accroche à son centre, pas à ses segments.
      if (centre && rayon > 0) resultat.traits.push({ calque, points: pointsArc(centre, rayon, 0, 360), ferme: true, courbe: true, centre });
    } else if (type === 'ARC') {
      const centre = point(entite, '10', '20');
      const rayon = Number(valeur(entite, '40'));
      if (centre && rayon > 0) {
        const traitArc = pointsArc(centre, rayon, Number(valeur(entite, '50')) || 0, Number(valeur(entite, '51')) || 0);
        resultat.traits.push({ calque, points: traitArc, ferme: false, courbe: true, centre });
      }
    } else if (type === 'TEXT' || type === 'MTEXT') {
      const position = point(entite, '10', '20');
      const contenu = type === 'MTEXT' ? texteMtext(entite) : (valeur(entite, '1') ?? '').trim();
      if (position && contenu) {
        resultat.textes.push({
          calque,
          ...position,
          texte: contenu,
          hauteur: Number(valeur(entite, '40')) || 0.2,
          rotation: Number(valeur(entite, '50')) || 0,
        });
      }
    } else if (!['VERTEX', 'SEQEND', 'ATTDEF', 'ATTRIB', 'POINT', '3DFACE', 'VIEWPORT'].includes(type)) {
      ignores.set(type, (ignores.get(type) ?? 0) + 1);
    }
  }

  resultat.calques = [...new Set([...resultat.traits, ...resultat.textes].map((e) => e.calque))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (resultat.calques.length === 0) resultat.erreurs.push('aucune ligne ni aucun texte trouvé dans le fichier');
  for (const [type, nombre] of ignores) {
    resultat.avertissements.push(`${nombre} élément(s) ${type === 'INSERT' ? 'de type bloc (INSERT)' : type} non affiché(s)`);
  }
  const tous = [...resultat.traits.flatMap((t) => t.points), ...resultat.textes];
  if (tous.some((p) => p.est < p.nord)) {
    resultat.avertissements.push('certaines coordonnées ont X plus petit que Y : en MN95, X = Est (environ 2 600 000) et Y = Nord (environ 1 200 000). Vérifie que le fichier est bien en MN95.');
  }
  return resultat;
}

/**
 * Texte d'un fichier DXF à partir de ses octets. Les DXF récents sont en UTF-8 ; les plus
 * anciens (AutoCAD 2000 à 2004, « ANSI_1252 ») en Windows-1252 : on essaie l'un puis l'autre,
 * pour garder les accents des textes (« béton »).
 */
export function decoderTexteDXF(octets) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

/** Rectangle qui contient tout le fond : { estMin, estMax, nordMin, nordMax } (m), ou null. */
export function emprise(fond) {
  const points = [...fond.traits.flatMap((t) => t.points), ...fond.textes];
  if (points.length === 0) return null;
  const ests = points.map((p) => p.est);
  const nords = points.map((p) => p.nord);
  return { estMin: Math.min(...ests), estMax: Math.max(...ests), nordMin: Math.min(...nords), nordMax: Math.max(...nords) };
}

/**
 * Points d'un arc de cercle (degrés, sens inverse des aiguilles d'une montre, comme en DXF),
 * de l'angle "debut" à l'angle "fin". Un cercle complet va de 0 à 360.
 */
export function pointsArc(centre, rayon, debut, fin) {
  let balayage = fin - debut;
  if (balayage <= 0) balayage += 360;
  const nombre = Math.max(2, Math.ceil((SEGMENTS_CERCLE * balayage) / 360));
  return Array.from({ length: nombre + 1 }, (_, k) => {
    const angle = ((debut + (balayage * k) / nombre) * Math.PI) / 180;
    return { est: centre.est + rayon * Math.cos(angle), nord: centre.nord + rayon * Math.sin(angle) };
  });
}

/** Sommets d'une LWPOLYLINE : chaque paire de codes 10 / 20 est un sommet. */
function sommetsLwpolyligne(entite) {
  const sommets = [];
  for (const { code, valeur: v } of entite.paires) {
    if (code === '10') sommets.push({ est: Number(v), nord: NaN });
    else if (code === '20' && sommets.length > 0) sommets.at(-1).nord = Number(v);
  }
  return sommets.filter((s) => Number.isFinite(s.est) && Number.isFinite(s.nord));
}

/** Texte d'un MTEXT, sans les codes de mise en forme (\P = retour à la ligne, {\f...;} = police...). */
function texteMtext(entite) {
  const morceaux = entite.paires.filter((p) => p.code === '3' || p.code === '1').map((p) => p.valeur);
  return morceaux
    .join('')
    .replace(/\\P/g, ' ')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

/** Découpe le texte en paires { code, valeur }. */
function lirePaires(texte) {
  const lignes = texte.split(/\r?\n/);
  const paires = [];
  for (let i = 0; i + 1 < lignes.length; i += 2) paires.push({ code: lignes[i].trim(), valeur: lignes[i + 1].trim() });
  return paires;
}

/** Entités de la section ENTITIES : { type, calque, paires } (toutes les paires, dans l'ordre). */
function entitesDuFichier(paires) {
  const entites = [];
  let dansEntites = false;
  let courante = null;
  for (let i = 0; i < paires.length; i++) {
    const { code, valeur: v } = paires[i];
    if (code === '0' && v === 'SECTION' && paires[i + 1]?.code === '2') {
      dansEntites = paires[i + 1].valeur === 'ENTITIES';
      continue;
    }
    if (!dansEntites) continue;
    if (code === '0') {
      if (v === 'ENDSEC') {
        dansEntites = false;
        courante = null;
        continue;
      }
      courante = { type: v, calque: '0', paires: [] };
      entites.push(courante);
    } else if (courante) {
      if (code === '8') courante.calque = v;
      courante.paires.push({ code, valeur: v });
    }
  }
  return entites;
}

/** Première valeur d'un code dans une entité (ou undefined). */
function valeur(entite, code) {
  return entite.paires.find((p) => p.code === code)?.valeur;
}

/** Point { est, nord } lu sur deux codes (ex. '10' et '20'), ou null s'il manque. */
function point(entite, codeEst, codeNord) {
  const est = Number(valeur(entite, codeEst));
  const nord = Number(valeur(entite, codeNord));
  return Number.isFinite(est) && Number.isFinite(nord) ? { est, nord } : null;
}

const entier = (v) => Number.parseInt(v ?? '0', 10) || 0;
