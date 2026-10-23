// Ce que cet appareil retient pour le partage par Google Drive (dans la mémoire du navigateur,
// jamais dans le projet ni dans le fichier projet) :
// - l'appareil : { id (tiré au hasard une fois), nom (tapé une fois : « Tablette Max ») } ;
// - s'il était connecté à Drive (pour se reconnecter tout seul) ;
// - par projet : { dossierId (Drive), envoyeLe (date du projet au dernier échange), empreintes }.

const CLE_APPAREIL = 'topo-appareil';
const CLE_CONNECTE = 'topo-drive-connecte';
const CLE_PROJETS = 'topo-drive-projets';

function lire(cle, defaut) {
  try {
    return JSON.parse(localStorage.getItem(cle)) ?? defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Mémoire indisponible : l'appli marche, elle ne retiendra simplement rien.
  }
}

/** Appareil : { id, nom } ('' tant que pas nommé). L'identifiant est créé au premier appel. */
export function appareil() {
  const lu = lire(CLE_APPAREIL, null);
  if (lu?.id) return lu;
  const nouveau = { id: `app-${crypto.randomUUID().slice(0, 8)}`, nom: '' };
  ecrire(CLE_APPAREIL, nouveau);
  return nouveau;
}

export function nommerAppareil(nom) {
  ecrire(CLE_APPAREIL, { ...appareil(), nom: String(nom).trim().slice(0, 40) });
}

export const etaitConnecte = () => lire(CLE_CONNECTE, false) === true;
export const retenirConnexion = (connecte) => ecrire(CLE_CONNECTE, Boolean(connecte));

/** Mémoire d'un projet (voir synchro.js), ou null. */
export function memoireProjet(projetId) {
  return lire(CLE_PROJETS, {})[projetId] ?? null;
}

export function retenirProjet(projetId, memoire) {
  const toutes = lire(CLE_PROJETS, {});
  if (memoire) toutes[projetId] = memoire;
  else delete toutes[projetId];
  ecrire(CLE_PROJETS, toutes);
}
