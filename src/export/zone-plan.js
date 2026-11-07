// Zone du terrain dessinée sur le plan principal du PDF (sortie de pdf.js en 0.152.0 : sans jsPDF,
// elle sert aussi à annoncer le papier et l'échelle avant l'export, voir export/ecran.js).
import { mini, maxi } from '../outils/bornes.js';
import { nomsDeLaMesure } from '../topo/mesure.js';

/** Zone du terrain couverte par des points { est, nord } : { estMin, estMax, nordMin, nordMax } (m), ou null. */
export function zoneDe(sommets) {
  if (sommets.length === 0) return null;
  const ests = sommets.map((p) => p.est);
  const nords = sommets.map((p) => p.nord);
  return { estMin: mini(ests), estMax: maxi(ests), nordMin: mini(nords), nordMax: maxi(nords) };
}

/**
 * Ce que montre le plan principal : points du levé qui servent aux surfaces calculées (contour,
 * lignes, sommets des triangles), ou tous s'il n'y a aucune surface, et la zone du terrain à
 * dessiner (points montrés et triangles). Renvoie { parNom, pointsMontres, zone } (zone null si vide).
 */
export function contenuDuPlan(calcules, points, coupes = [], dessins = [], levesSeuls = []) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const sommets = calcules.flatMap(({ resultat }) => resultat.trianglesDessus.flat());
  const noms = new Set([
    ...calcules.flatMap(({ stock }) => [...(stock.contour ?? []), ...(stock.lignesRupture ?? []).flatMap((l) => l.noms)]),
    ...sommets.filter((p) => parNom.get(p.nom) === p).map((p) => p.nom),
  ]);
  let pointsMontres = noms.size > 0 ? [...noms].map((nom) => parNom.get(nom)).filter(Boolean) : points;
  // Levés seuls (0.107.4) : tous leurs points sont montrés.
  const pointsLeves = levesSeuls.flatMap((l) => l.points);
  if (pointsLeves.length > 0) {
    const deja = new Set(pointsMontres);
    pointsMontres = [...pointsMontres, ...pointsLeves.filter((p) => !deja.has(p))];
  }
  // Les coupes doivent se voir en entier sur le plan.
  const boutsDesCoupes = coupes.flatMap((coupe) => [coupe.debut, coupe.fin]);
  // Les dessins aussi (plateformes, bâtiments…).
  const sommetsDessins = dessins.flatMap((d) => d.points);
  return { parNom, pointsMontres, zone: zoneDe([...pointsMontres, ...sommets, ...levesSeuls.flatMap((l) => l.triangles.flat()), ...boutsDesCoupes, ...sommetsDessins]) };
}

/**
 * Zone de la première feuille d'un PDF « Plan et volumes » (données de obtenirDonnees) : celle du
 * plan principal, ou du premier calcul dans un contour s'il n'y a que ceux-là. Renvoie la zone ou null.
 */
export function zonePremiereFeuille({ stocks = [], resultats = [], points = [], comparaisons = [], coupes = [], dessins = [], levesSeuls = [] }) {
  const calcules = stocks.map((stock, i) => ({ stock, resultat: resultats[i] })).filter(({ resultat }) => resultat && !resultat.erreurs);
  const comparees = comparaisons.filter(({ resultat }) => resultat && !resultat.erreurs && resultat.trianglesEcart?.length > 0);
  if (calcules.length > 0 || comparees.length === 0) return contenuDuPlan(calcules, points, coupes, dessins, levesSeuls).zone;
  return zoneDe(comparees[0].resultat.trianglesEcart.flat());
}

/** PDF des mesures : points montrés (sommets des mesures et des triangles des aires) et leur zone. */
export function contenuDesMesures(mesures, points) {
  const parNom = new Map(points.map((p) => [p.nom, p]));
  const noms = new Set(mesures.flatMap(({ mesure, resultat }) => [...nomsDeLaMesure(mesure), ...(resultat?.triangles ?? []).flat().map((p) => p.nom)]));
  const pointsMontres = [...noms].map((nom) => parNom.get(nom)).filter(Boolean);
  return { parNom, pointsMontres, zone: zoneDe(pointsMontres) };
}
