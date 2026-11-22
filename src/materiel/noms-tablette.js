// Ce que chaque appareil garde du parc (0.274.0) pour Réglages › Drive : la liste des articles (choisir
// l'article de cette tablette) et des responsables (choisir l'utilisateur). Lu sur Drive (« App Topo ›
// Matériel ») quand l'appareil est connecté ; sans prix ni mot de passe (voir nomsPourTablettes).

const CLE = 'topo-materiel-noms';
// Valeur de la ligne « Autre… » des listes déroulantes (nom tapé à la main, ponctuel).
export const CHOIX_AUTRE = '__autre__';

/** { articles: [{ numero, designation, categorie }], responsables: [], modifieLe } ; listes vides si rien. */
export function lireNomsMateriel(stockage = globalThis.localStorage) {
  try {
    const lu = JSON.parse(stockage?.getItem(CLE) ?? 'null');
    if (lu && Array.isArray(lu.articles) && Array.isArray(lu.responsables)) return lu;
  } catch {
    // Mémoire illisible : listes vides (on peut toujours taper un nom).
  }
  return { articles: [], responsables: [], modifieLe: null };
}

/** Retient les listes (noms : voir nomsPourTablettes) et la date du parc d'où elles viennent. */
export function retenirNomsMateriel(noms, modifieLe, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE, JSON.stringify({ articles: noms.articles ?? [], responsables: noms.responsables ?? [], modifieLe: modifieLe ?? null }));
  } catch {
    // Mémoire indisponible : les listes seront relues à la prochaine connexion.
  }
}

/**
 * Choix d'une liste déroulante « article / utilisateur » : la valeur actuelle est-elle dans la
 * liste ? Sinon elle est montrée comme « autre » (nom tapé, ponctuel). Renvoie { dansListe, valeur }.
 */
export function valeurDansListe(valeur, liste) {
  const v = String(valeur ?? '').trim();
  return { valeur: v, dansListe: v === '' || liste.some((x) => x.toLowerCase() === v.toLowerCase()) };
}
