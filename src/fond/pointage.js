// Pointage sur le fond de plan DXF : on touche un coin du plan, l'appli « s'accroche » au
// sommet le plus proche, puis on saisit son altitude. Le point est rangé dans un levé
// « dessiné » du projet et sert ensuite comme un point levé (contour, lignes de rupture...).
// Unités : mètres (Est, Nord, altitude en MN95).

/**
 * Coins où l'on peut s'accrocher, dans les calques visibles des fonds de plan :
 * sommets des lignes et polylignes, centre des cercles et des arcs, bouts des arcs.
 * Les doublons (à moins de 1 mm) sont retirés. Renvoie [{ est, nord }].
 */
export function coinsAccrochables(fonds) {
  const coins = new Map();
  const ajouter = (p) => {
    const cle = `${p.est.toFixed(3)} ${p.nord.toFixed(3)}`;
    if (!coins.has(cle)) coins.set(cle, { est: p.est, nord: p.nord });
  };
  for (const fond of fonds) {
    const caches = new Set(fond.calquesCaches);
    for (const trait of fond.traits) {
      if (caches.has(trait.calque)) continue;
      if (trait.courbe) {
        ajouter(trait.centre);
        if (!trait.ferme) [trait.points[0], trait.points.at(-1)].forEach(ajouter);
      } else {
        trait.points.forEach(ajouter);
      }
    }
  }
  return [...coins.values()];
}

/** Élément le plus proche de "position" ({ est, nord }) à moins de "rayon" (m), ou null. */
export function lePlusProche(elements, position, rayon) {
  let meilleur = null;
  let meilleureDistance = rayon;
  for (const element of elements) {
    const distance = Math.hypot(element.est - position.est, element.nord - position.nord);
    if (distance <= meilleureDistance) {
      meilleur = element;
      meilleureDistance = distance;
    }
  }
  return meilleur;
}

/**
 * Lit une altitude tapée au clavier (m) : « 473.20 », « 473,2 », « 473 ».
 * Renvoie le nombre, ou null si le texte n'est pas une altitude.
 */
export function lireAltitude(texte) {
  const propre = String(texte ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(propre)) return null;
  return Number(propre);
}

/** Nom proposé pour un nouveau point dessiné : P1, P2... (après le plus grand numéro déjà pris). */
export function nomSuivant(points) {
  const numeros = points.map((p) => /^P(\d+)$/.exec(p.nom)).filter(Boolean).map((m) => Number(m[1]));
  return `P${Math.max(0, ...numeros) + 1}`;
}
