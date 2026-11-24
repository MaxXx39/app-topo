// Nouvel indice d'un plan calé (0.280.0, calage de plans ; décisions du 22.11) : un plan reçoit souvent 10 à 20
// indices. Le calage et le nettoyage faits sur le premier sont REJOUÉS sur les suivants, après un contrôle :
// « même origine » = au moins 50 % des repères du plan calé retrouvés à 2 mm près dans le nouvel indice.
// Repères : des sommets des traits gardés au nettoyage (calques gardés, dans la zone), en coordonnées du plan reçu.

export const TOLERANCE_REPERE_M = 0.002;
export const PART_MEME_ORIGINE = 0.5;
export const NOMBRE_REPERES = 300;

/** Indice suivant proposé : A → B, Z → AA, 3 → 4, B2 → B3 ; vide → A. */
export function indiceSuivant(indice) {
  const texte = String(indice ?? '').trim();
  if (!texte) return 'A';
  const chiffres = /^(.*?)(\d+)$/.exec(texte);
  if (chiffres) return `${chiffres[1]}${String(Number(chiffres[2]) + 1).padStart(chiffres[2].length, '0')}`;
  const fin = texte.at(-1);
  if (/[a-y]/i.test(fin)) return texte.slice(0, -1) + String.fromCharCode(fin.charCodeAt(0) + 1);
  if (fin === 'Z') return `${texte}A`;
  if (fin === 'z') return `${texte}a`;
  return `${texte}1`;
}

/** Sommets [[x, y], …] (coordonnées absolues du plan) des traits du plan, sans les calques écartés ni hors zone. */
function sommetsGardes(plan, { ecartes = [], zone = null } = {}) {
  const ecarte = new Set(ecartes);
  const { est: e0, nord: n0 } = plan.origine;
  const dedans = (x, y) => {
    if (!zone || zone.length < 3) return true;
    let r = false;
    for (let i = 0, j = zone.length - 1; i < zone.length; j = i, i += 1) {
      const [xi, yi] = zone[i];
      const [xj, yj] = zone[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
    }
    return r;
  };
  const sommets = [];
  for (const t of plan.contenu?.traits ?? []) {
    // Cotations, repères et contours de hachures : pas des repères sûrs d'un indice à l'autre.
    if (ecarte.has(plan.calques[t.c]?.nom) || t.s === 'DIMENSION' || t.s === 'LEADER' || t.s === 'HATCH') continue;
    for (let i = 0; i < t.p.length; i += 2) {
      const x = e0 + t.p[i];
      const y = n0 + t.p[i + 1];
      if (dedans(x, y)) sommets.push([x, y]);
    }
  }
  return sommets;
}

/**
 * Repères d'un plan calé (au plus « nombre », répartis dans la liste, sans doublon) : recette = nettoyage
 * (calques écartés, zone). Coordonnées absolues du plan reçu, arrondies au millième d'unité.
 */
export function reperesDuPlan(plan, recette = {}, nombre = NOMBRE_REPERES) {
  const vus = new Set();
  const uniques = [];
  for (const [x, y] of sommetsGardes(plan, recette)) {
    const cle = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  }
  if (uniques.length <= nombre) return uniques;
  const pas = uniques.length / nombre;
  return Array.from({ length: nombre }, (_, i) => uniques[Math.floor(i * pas)]);
}

/** Part (0 à 1) des repères qui ont un sommet du plan à moins de « tolerance » (unités du plan). */
export function partRetrouvee(reperes, plan, tolerance) {
  if (!reperes?.length) return 0;
  // Grille de cases de la taille de la tolérance : on ne regarde que les 9 cases autour de chaque repère.
  const grille = new Map();
  const cle = (i, j) => `${i},${j}`;
  for (const [x, y] of sommetsGardes(plan)) {
    const k = cle(Math.floor(x / tolerance), Math.floor(y / tolerance));
    if (!grille.has(k)) grille.set(k, []);
    grille.get(k).push([x, y]);
  }
  let trouves = 0;
  for (const [x, y] of reperes) {
    const i = Math.floor(x / tolerance);
    const j = Math.floor(y / tolerance);
    let ok = false;
    for (let di = -1; di <= 1 && !ok; di += 1) {
      for (let dj = -1; dj <= 1 && !ok; dj += 1) {
        ok = (grille.get(cle(i + di, j + dj)) ?? []).some(([u, v]) => Math.hypot(u - x, v - y) <= tolerance);
      }
    }
    if (ok) trouves += 1;
  }
  return trouves / reperes.length;
}

/**
 * Contrôle d'un nouvel indice : { memeOrigine, part (0 à 1), message }. echelle : échelle du calage (m par unité du
 * plan), pour exprimer 2 mm dans les unités du plan.
 */
export function controlerIndice(reperes, plan, echelle) {
  const part = partRetrouvee(reperes, plan, TOLERANCE_REPERE_M / echelle);
  const pourcent = Math.round(part * 100);
  if (!reperes?.length) return { memeOrigine: false, part: 0, message: 'Pas de repères gardés pour ce plan : calez le nouvel indice à la main.' };
  return part >= PART_MEME_ORIGINE
    ? { memeOrigine: true, part, message: `Même origine : ${pourcent} % des repères retrouvés à 2 mm. La recette peut être rejouée.` }
    : { memeOrigine: false, part, message: `Origine différente : ${pourcent} % des repères seulement retrouvés à 2 mm (il en faut 50 %). Le plan a bougé : calez-le à la main.` };
}

/**
 * 0.307.0 (demande du 24.11) : nom d'un plan calé = type fixe devant (« DXF- » ou « PDF- », non supprimable) + nom +
 * « _ind- » + indice : « DXF-Villa Dupont_ind-B ». Un DWG converti est un DXF.
 */
export function nomPlanCale(type, base, indice) {
  const propre = baseDuNomCale(base);
  const ind = String(indice ?? '').trim();
  return `${type === 'PDF' ? 'PDF' : 'DXF'}-${propre}${ind ? `_ind-${ind}` : ''}`;
}

/** Nom sans le type devant ni l'indice derrière (« DXF-Villa_ind-B » → « Villa »). */
export function baseDuNomCale(nom) {
  return String(nom ?? '').trim().replace(/^(DXF|PDF|DWG)[-_ ]+/i, '').replace(/_ind-[^_]*$/i, '').trim();
}

/** Type du fichier reçu pour le nom : « PDF » ou « DXF » (DXF et DWG). */
export const typeDuFichier = (fichier) => (/\.pdf$/i.test(fichier ?? '') ? 'PDF' : 'DXF');
