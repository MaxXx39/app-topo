// Matériel (0.274.0) : le parc et ses fichiers joints (photos, documents) sur cet appareil, dans une base
// IndexedDB à part (« topo-materiel ») : rien n'est mêlé aux projets. La copie de Drive (« App Topo ›
// Matériel ») est faite par l'écran (materiel/appli.js) quand Drive est connecté.

const NOM_BASE = 'topo-materiel';
const PARC = 'parc'; // une seule entrée, clé « parc »
const FICHIERS = 'fichiers'; // { id, nom, type, blob, envoye (vrai quand il est sur Drive) }
let promesseBase = null;

function ouvrir() {
  promesseBase ??= new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(NOM_BASE, 1);
    demande.onupgradeneeded = () => {
      demande.result.createObjectStore(PARC);
      demande.result.createObjectStore(FICHIERS, { keyPath: 'id' });
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
  return promesseBase;
}

async function operation(table, mode, action) {
  const base = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(table, mode);
    const demande = action(transaction.objectStore(table));
    transaction.oncomplete = () => resoudre(demande?.result);
    transaction.onerror = () => rejeter(transaction.error);
    transaction.onabort = () => rejeter(transaction.error);
  });
}

export const lireParcLocal = () => operation(PARC, 'readonly', (t) => t.get('parc'));
export const enregistrerParcLocal = (parc) => operation(PARC, 'readwrite', (t) => t.put(parc, 'parc'));

/** Copie du parc gardée juste avant une restauration (clé « avant-restauration »), pour pouvoir revenir en arrière. */
export const enregistrerCopieAvantRestauration = (parc) => operation(PARC, 'readwrite', (t) => t.put(parc, 'avant-restauration'));

export const lireFichierLocal = (id) => operation(FICHIERS, 'readonly', (t) => t.get(id));
export const enregistrerFichierLocal = (fichier) => operation(FICHIERS, 'readwrite', (t) => t.put(fichier));
export const supprimerFichierLocal = (id) => operation(FICHIERS, 'readwrite', (t) => t.delete(id));
export const listerFichiersLocaux = () => operation(FICHIERS, 'readonly', (t) => t.getAll());

// Petit état de la copie Drive, gardé par l'appareil : vu = date (modifieLe) du parc sur Drive au dernier
// échange ; aEnvoyer = le parc a changé ici depuis (pas encore sur Drive).
const CLE_ETAT = 'topo-materiel-drive';

export function lireEtatDrive(stockage = globalThis.localStorage) {
  try {
    const lu = JSON.parse(stockage?.getItem(CLE_ETAT) ?? 'null');
    if (lu && typeof lu === 'object') return { vu: lu.vu ?? null, aEnvoyer: lu.aEnvoyer === true };
  } catch {
    // Mémoire illisible : comme au premier lancement.
  }
  return { vu: null, aEnvoyer: false };
}

export function ecrireEtatDrive(etat, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    // Mémoire indisponible : au pire, le parc est comparé à Drive à la prochaine ouverture.
  }
}

/**
 * Que faire en ouvrant le parc, d'après la date du parc sur Drive (distant, null s'il n'y est pas) et
 * l'état gardé ici ({ vu, aEnvoyer }) ? Renvoie :
 * - 'envoyer' : Drive n'a rien, ou rien de nouveau, et ce PC a des changements à envoyer ;
 * - 'prendre' : Drive a une version que ce PC n'a pas vue, et ce PC n'a rien changé ;
 * - 'conflit' : les deux ont changé (un autre PC a écrit sur Drive pendant que celui-ci changeait le parc) ;
 * - 'rien' : tout est à jour.
 */
export function choixSynchro(distant, { vu, aEnvoyer }) {
  if (!distant) return aEnvoyer ? 'envoyer' : 'rien';
  if (distant === vu) return aEnvoyer ? 'envoyer' : 'rien';
  return aEnvoyer ? 'conflit' : 'prendre';
}
