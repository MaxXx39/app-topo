// Enregistrement des projets sur l'appareil (base de données du navigateur « IndexedDB »).
// Rien n'est envoyé sur internet. Chaque appareil (téléphone, ordinateur) a ses propres projets ;
// pour passer de l'un à l'autre, on utilise le fichier projet (.topo.json).

// Nom de la base : « topo » pour l'appli. La version de test (V2, publiée à part) utilise
// une autre base (variable VITE_NOM_BASE au moment de construire l'appli), pour ne jamais
// toucher aux projets de l'appli habituelle.
const NOM_BASE = import.meta.env?.VITE_NOM_BASE || 'topo';
const TABLE = 'projets';
let promesseBase = null;

/** Ouvre (ou crée) la base de données. */
function ouvrir() {
  promesseBase ??= new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(NOM_BASE, 1);
    demande.onupgradeneeded = () => demande.result.createObjectStore(TABLE, { keyPath: 'id' });
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
  return promesseBase;
}

/** Exécute une opération sur la table des projets et renvoie son résultat. */
async function operation(mode, action) {
  const base = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(TABLE, mode);
    const demande = action(transaction.objectStore(TABLE));
    transaction.oncomplete = () => resoudre(demande?.result);
    transaction.onerror = () => rejeter(transaction.error);
    transaction.onabort = () => rejeter(transaction.error);
  });
}

export const listerProjets = () => operation('readonly', (table) => table.getAll());
export const lireProjet = (id) => operation('readonly', (table) => table.get(id));
export const enregistrerProjet = (projet) => operation('readwrite', (table) => table.put(projet));
export const supprimerProjet = (id) => operation('readwrite', (table) => table.delete(id));

/** Demande au navigateur de ne pas effacer les données de l'appli quand l'appareil manque de place. */
export async function demanderStockagePersistant() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Pas grave : les données restent enregistrées, simplement sans cette garantie.
  }
}

// Dernier projet ouvert (petit réglage gardé dans le navigateur).
export function memoriserDernierProjet(id) {
  try {
    localStorage.setItem('topo-dernier-projet', id);
  } catch {
    // Sans mémoire, l'appli ouvrira simplement la liste des projets.
  }
}

export function dernierProjet() {
  try {
    return localStorage.getItem('topo-dernier-projet');
  } catch {
    return null;
  }
}
