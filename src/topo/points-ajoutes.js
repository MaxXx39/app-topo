// Points ajoutés à la main (coordonnées tapées) ou en touchant un plan DXF (sommet, milieu, sur une
// ligne, centre d'un cercle). Ils sont rangés dans un levé à part, « Points ajoutés », et servent
// partout comme les autres points du projet (implanter, surfaces, mesures).
// Leur nom est libre (proposé : P1, P2…) mais ne sert qu'une fois dans le projet. L'altitude est
// facultative (null : inconnue, par exemple un point d'un plan DXF en 2D).
import { nouvelIdentifiant } from './surface.js';

export const NOM_LEVE_AJOUTES = 'Points ajoutés';

/** Levé des points ajoutés du projet, ou null s'il n'y en a pas encore. */
export function leveDesPointsAjoutes(projet) {
  return projet.leves.find((leve) => leve.ajoutes) ?? null;
}

/** Noms de tous les points du projet (levés et points « À implanter »). */
function nomsDuProjet(projet) {
  return new Set([...projet.leves.flatMap((l) => l.points), ...(projet.aImplanter ?? [])].map((p) => p.nom));
}

/** Nom proposé pour le prochain point ajouté : P1, P2… (le premier libre dans le projet). */
export function nomPointAjoute(projet) {
  const pris = nomsDuProjet(projet);
  let numero = 1;
  while (pris.has(`P${numero}`)) numero++;
  return `P${numero}`;
}

/**
 * Nombre tapé (coordonnée ou altitude, m) : la virgule est acceptée comme le point.
 * Renvoie le nombre, null si la case est vide, ou undefined si le texte n'est pas un nombre.
 */
export function lireNombreTape(texte) {
  const nettoye = String(texte ?? '').trim().replace(',', '.');
  if (!nettoye) return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(nettoye)) return undefined;
  return Number(nettoye);
}

/**
 * Ajoute un point au levé « Points ajoutés » (créé au premier point, sans devenir le levé actif).
 * point : { nom, est, nord, altitude (ou null), source ('tape' ou 'dxf') }.
 * Renvoie { point } ou { erreur } (message compréhensible).
 */
export function ajouterPointAjoute(projet, { nom, est, nord, altitude = null, source = 'tape' }) {
  const nomPropre = String(nom ?? '').trim() || nomPointAjoute(projet);
  if (!Number.isFinite(est) || !Number.isFinite(nord)) return { erreur: 'Est et Nord : écris deux nombres, par exemple 2507360.125' };
  if (altitude != null && !Number.isFinite(altitude)) return { erreur: 'altitude illisible : écris un nombre, ou laisse vide' };
  if (nomsDuProjet(projet).has(nomPropre)) return { erreur: `le nom « ${nomPropre} » existe déjà dans le projet` };
  let leve = leveDesPointsAjoutes(projet);
  if (!leve) {
    leve = { id: nouvelIdentifiant(), nom: NOM_LEVE_AJOUTES, ajoutes: true, importeLe: new Date().toISOString(), points: [] };
    projet.leves.push(leve);
    // Premier levé du projet : il devient le levé affiché.
    if (!projet.leveActifId) projet.leveActifId = leve.id;
  }
  const point = { nom: nomPropre, est, nord, altitude: altitude ?? null, ajoute: source };
  leve.points.push(point);
  return { point };
}
