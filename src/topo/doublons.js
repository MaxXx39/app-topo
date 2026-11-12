// Noms de points en double à l'import (0.219.0, demande du 12.11) : on repère les doublons, puis on choisit de les ignorer,
// de les renommer (« nom-2 », « nom-3 »…) ou de les importer quand même. Un nom est comparé sans espaces autour ; un nom vide n'est pas un doublon.

const nomDe = (p) => String(p?.nom ?? '').trim();

/** Noms déjà pris (liste de noms existants) ou répétés dans les points eux-mêmes, sans répétition dans le résultat. */
export function nomsEnDouble(nomsExistants, points) {
  const vus = new Set(nomsExistants.map((n) => String(n).trim()));
  const doubles = new Set();
  for (const p of points) {
    const nom = nomDe(p);
    if (!nom) continue;
    if (vus.has(nom)) doubles.add(nom);
    vus.add(nom);
  }
  return [...doubles];
}

/** Points sans les doublons (le premier de chaque nom est gardé, ceux déjà pris sont retirés). */
export function sansDoublons(nomsExistants, points) {
  const vus = new Set(nomsExistants.map((n) => String(n).trim()));
  return points.filter((p) => {
    const nom = nomDe(p);
    if (!nom) return true;
    if (vus.has(nom)) return false;
    vus.add(nom);
    return true;
  });
}

/** Points dont les noms en double sont renommés « nom-2 », « nom-3 »… (jamais un nom déjà pris). Renvoie { points, renommes: [{ avant, apres }] }. */
export function renommerDoublons(nomsExistants, points) {
  const pris = new Set(nomsExistants.map((n) => String(n).trim()));
  const renommes = [];
  const resultat = points.map((p) => {
    const nom = nomDe(p);
    if (!nom) return p;
    let final = nom;
    for (let n = 2; pris.has(final); n += 1) final = `${nom}-${n}`;
    pris.add(final);
    if (final === nom) return p;
    renommes.push({ avant: nom, apres: final });
    return { ...p, nom: final };
  });
  return { points: resultat, renommes };
}
