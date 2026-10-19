// Stocks et rôles des points.
// Un stock a la forme :
// {
//   nom: 'Stock 1',
//   contour: ['b1', 'b2', ...],      // bord du stock, dans l'ordre (fermé automatiquement)
//   baseEgaleContour: true,          // si vrai, la surface de base utilise les points du contour
//   base: [...],                     // points du pied (utilisés si baseEgaleContour est faux)
//   lignesRupture: [{ noms: ['h1', 'h2', ...], fermee: false }, ...], // haut de talus, arêtes, dans l'ordre
//                                    // fermee : le dernier point est relié au premier
//   pointsDessus: [...],             // points isolés sur le dessus du stock
// }
// Les rôles sont choisis par l'utilisateur : on ne déduit jamais rien du nom d'un point.

/** Crée un stock vide. */
export function creerStock(nom) {
  return { nom, contour: [], baseEgaleContour: true, base: [], lignesRupture: [creerLigne()], pointsDessus: [] };
}

/** Crée une ligne de rupture vide (ouverte). */
export function creerLigne() {
  return { noms: [], fermee: false };
}

/** Points de la surface de base d'un stock (noms). */
export function pointsDeBase(stock) {
  return stock.baseEgaleContour ? stock.contour : stock.base;
}

/**
 * Lit une liste de noms tapée par l'utilisateur, par exemple :
 *   "b100 à b116"         -> b100, b101, ..., b116
 *   "b116 à b100"         -> même chose dans l'ordre inverse
 *   "b1 à b5, b9, h3"     -> plusieurs morceaux séparés par des virgules
 * Une plage relie deux noms qui ont le même début et finissent par un numéro.
 * "nomsExistants" : les noms des points importés. Les noms absents sont signalés.
 * Renvoie { noms, erreurs }.
 */
export function lireListeDeNoms(texte, nomsExistants) {
  const existe = new Set(nomsExistants);
  const noms = [];
  const erreurs = [];

  const morceaux = texte
    .split(/[,;]/)
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau !== '');

  for (const morceau of morceaux) {
    const plage = morceau.match(/^(\S+)\s+(?:à|a)\s+(\S+)$/i);
    if (!plage) {
      if (existe.has(morceau)) noms.push(morceau);
      else erreurs.push(`point « ${morceau} » introuvable`);
      continue;
    }

    const debut = decouperNom(plage[1]);
    const fin = decouperNom(plage[2]);
    if (!debut || !fin || debut.prefixe !== fin.prefixe) {
      erreurs.push(`« ${morceau} » : une plage doit relier deux noms comme « b100 à b116 »`);
      continue;
    }

    const pas = fin.numero >= debut.numero ? 1 : -1;
    const absents = [];
    for (let numero = debut.numero; numero !== fin.numero + pas; numero += pas) {
      const nom = debut.prefixe + String(numero).padStart(debut.largeur, '0');
      if (existe.has(nom)) noms.push(nom);
      else absents.push(nom);
    }
    if (absents.length > 0) {
      erreurs.push(`« ${morceau} » : point(s) introuvable(s) ignoré(s) : ${absents.join(', ')}`);
    }
  }

  return { noms, erreurs };
}

/**
 * Écrit une liste de noms de façon courte, en regroupant les numéros qui se suivent :
 * ['b1', 'b2', 'b3', 'h7'] -> "b1 à b3, h7". C'est l'inverse de lireListeDeNoms.
 */
export function ecrireListeDeNoms(noms) {
  const morceaux = [];
  let i = 0;
  while (i < noms.length) {
    const debut = decouperNom(noms[i]);
    let j = i;
    if (debut) {
      // On avance tant que le numéro augmente (ou diminue) de 1 à chaque nom.
      const pas = pasEntre(noms[i], noms[i + 1]);
      if (pas !== 0) {
        while (j + 1 < noms.length && pasEntre(noms[j], noms[j + 1]) === pas) j++;
      }
    }
    morceaux.push(j - i >= 2 ? `${noms[i]} à ${noms[j]}` : noms[i]);
    if (j - i === 1) morceaux.push(noms[j]);
    i = j + 1;
  }
  return morceaux.join(', ');
}

/**
 * Vérifie un stock et renvoie la liste des problèmes (textes), vide si tout va bien.
 */
export function verifierStock(stock, nomsExistants) {
  const existe = new Set(nomsExistants);
  const problemes = [];

  if (stock.contour.length < 3) problemes.push('le contour doit avoir au moins 3 points');
  signalerDoublons(stock.contour, 'contour', problemes);

  if (!stock.baseEgaleContour) {
    if (stock.base.length < 3) problemes.push('la surface de base doit avoir au moins 3 points');
    signalerDoublons(stock.base, 'surface de base', problemes);
  }

  stock.lignesRupture.forEach((ligne, index) => {
    const minimum = ligne.fermee ? 3 : 2;
    if (ligne.noms.length > 0 && ligne.noms.length < minimum) {
      problemes.push(`la ligne de rupture ${index + 1} doit avoir au moins ${minimum} points${ligne.fermee ? ' (ligne fermée)' : ''}`);
    }
    signalerDoublons(ligne.noms, `ligne de rupture ${index + 1}`, problemes);
  });

  const tous = [...stock.contour, ...pointsDeBase(stock), ...stock.lignesRupture.flatMap((ligne) => ligne.noms), ...stock.pointsDessus];
  const introuvables = [...new Set(tous.filter((nom) => !existe.has(nom)))];
  if (introuvables.length > 0) {
    problemes.push(`point(s) absent(s) du fichier importé : ${introuvables.join(', ')}`);
  }

  return problemes;
}

/**
 * Repère les séries de points numérotés à la suite dans le fichier,
 * par exemple b1, b2, ..., b17 puis h1, ..., h31.
 * Ce ne sont que des propositions : c'est l'utilisateur qui choisit le rôle de chaque série.
 * Renvoie une liste de séries (chacune est une liste de noms, d'au moins 2 points).
 */
export function detecterSeries(noms) {
  const series = [];
  let serie = [];
  for (const nom of noms) {
    if (serie.length > 0 && pasEntre(serie.at(-1), nom) === 1) {
      serie.push(nom);
    } else {
      if (serie.length >= 2) series.push(serie);
      serie = [nom];
    }
  }
  if (serie.length >= 2) series.push(serie);
  return series;
}

/** Ajoute un problème si un nom apparaît deux fois dans la même liste. */
function signalerDoublons(noms, role, problemes) {
  const doublons = [...new Set(noms.filter((nom, index) => noms.indexOf(nom) !== index))];
  if (doublons.length > 0) problemes.push(`${role} : point(s) en double : ${doublons.join(', ')}`);
}

/**
 * Sépare un nom en un début et un numéro final : "b105" -> { prefixe: 'b', numero: 105, largeur: 3 }.
 * Renvoie null si le nom ne finit pas par un numéro.
 */
function decouperNom(nom) {
  const morceaux = nom.match(/^(.*?)(\d+)$/);
  if (!morceaux) return null;
  // Largeur utile seulement pour les numéros écrits avec des zéros devant ("p007").
  const largeur = morceaux[2].startsWith('0') ? morceaux[2].length : 1;
  return { prefixe: morceaux[1], numero: Number(morceaux[2]), largeur };
}

/** +1 ou -1 si le nom b suit (ou précède) directement le nom a, sinon 0. */
function pasEntre(a, b) {
  if (b === undefined) return 0;
  const da = decouperNom(a);
  const db = decouperNom(b);
  if (!da || !db || da.prefixe !== db.prefixe) return 0;
  // On vérifie que b s'écrit bien comme lireListeDeNoms le recréerait.
  const ecrire = (numero) => da.prefixe + String(numero).padStart(da.largeur, '0');
  if (ecrire(da.numero + 1) === b) return 1;
  if (ecrire(da.numero - 1) === b) return -1;
  return 0;
}
