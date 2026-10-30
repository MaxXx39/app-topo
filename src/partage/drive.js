// Accès à Google Drive par ses adresses web (API REST de Drive), sans bibliothèque.
// L'appli ne voit que les fichiers qu'elle a créés elle-même (autorisation « drive.file ») :
// le reste du Drive du compte reste invisible pour elle.
// Un « jeton » (code d'accès temporaire, valable environ 1 heure) est demandé à la connexion
// Google (voir partage/connexion.js) et envoyé avec chaque demande.

const API = 'https://www.googleapis.com/drive/v3/files';
const ENVOI = 'https://www.googleapis.com/upload/drive/v3/files';
export const TYPE_DOSSIER = 'application/vnd.google-apps.folder';
const CHAMPS = 'id,name,mimeType,modifiedTime,size,trashed,appProperties';
// Envoi simple (en une fois) : 5 Mo au plus par fichier, selon Google.
export const TAILLE_MAX_ENVOI = 5 * 1024 * 1024;

/**
 * Crée l'accès à Drive.
 * - obtenirJeton(renouveler) : promesse d'un jeton d'accès ; renouveler = vrai si le précédent a été refusé ;
 * - envoyerRequete : fetch (remplaçable par un faux Drive dans les tests).
 */
export function creerDrive({ obtenirJeton, envoyerRequete = (...args) => fetch(...args) }) {
  /** Demande à Drive, avec le jeton ; un jeton périmé est renouvelé une fois. Lance une erreur lisible. */
  async function demander(adresse, options = {}, essai = 0) {
    const jeton = await obtenirJeton(essai > 0);
    let reponse;
    try {
      reponse = await envoyerRequete(adresse, { ...options, headers: { ...options.headers, Authorization: `Bearer ${jeton}` } });
    } catch {
      // « Failed to fetch » du navigateur : Drive n'a pas répondu du tout.
      throw new Error('Google Drive injoignable (réseau ?)');
    }
    if (reponse.status === 401 && essai === 0) return demander(adresse, options, 1);
    if (!reponse.ok) {
      let detail = '';
      try {
        detail = (await reponse.json())?.error?.message ?? '';
      } catch {
        // Pas de détail lisible.
      }
      throw new Error(`Google Drive a refusé (${reponse.status}${detail ? ` : ${detail}` : ''})`);
    }
    return reponse;
  }

  /** Écrit le contenu (Blob) d'un fichier existant. */
  async function ecrireContenu(id, contenu) {
    if (contenu.size > TAILLE_MAX_ENVOI) throw new Error(`fichier trop gros pour Drive (${(contenu.size / 1e6).toFixed(1)} Mo, 5 Mo au plus)`);
    await demander(`${ENVOI}/${id}?uploadType=media&fields=id`, { method: 'PATCH', body: contenu, headers: { 'Content-Type': contenu.type || 'application/octet-stream' } });
  }

  return {
    /** Fichiers et dossiers (non supprimés) qui répondent à la question Drive "q". */
    async lister(q) {
      const trouves = [];
      let page = '';
      do {
        const parametres = new URLSearchParams({ q: `${q} and trashed = false`, fields: `nextPageToken,files(${CHAMPS})`, pageSize: '1000', spaces: 'drive' });
        if (page) parametres.set('pageToken', page);
        const reponse = await (await demander(`${API}?${parametres}`)).json();
        trouves.push(...(reponse.files ?? []));
        page = reponse.nextPageToken ?? '';
      } while (page);
      return trouves;
    },

    /** Contenu des fichiers d'un dossier. */
    listerDossier(dossierId) {
      return this.lister(`'${dossierId}' in parents`);
    },

    /** Crée un dossier (dans "parentId", ou à la racine du Drive), avec ses propriétés. */
    async creerDossier(nom, parentId = null, proprietes = {}) {
      const corps = { name: nom, mimeType: TYPE_DOSSIER, appProperties: proprietes, ...(parentId ? { parents: [parentId] } : {}) };
      const reponse = await demander(`${API}?fields=${CHAMPS}`, { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } });
      return reponse.json();
    },

    /** Crée un fichier dans un dossier, avec son contenu (Blob). */
    async creerFichier(nom, parentId, contenu) {
      const corps = { name: nom, parents: [parentId], mimeType: contenu.type || 'application/octet-stream' };
      const fichier = await (await demander(`${API}?fields=${CHAMPS}`, { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } })).json();
      await ecrireContenu(fichier.id, contenu);
      return fichier;
    },

    ecrireContenu,

    /** Change le nom ou les propriétés d'un fichier ou d'un dossier. */
    async modifier(id, { nom, proprietes } = {}) {
      const corps = { ...(nom ? { name: nom } : {}), ...(proprietes ? { appProperties: proprietes } : {}) };
      const reponse = await demander(`${API}/${id}?fields=${CHAMPS}`, { method: 'PATCH', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } });
      return reponse.json();
    },

    /** Description d'un fichier ou d'un dossier (nom, propriétés…). */
    async decrire(id) {
      return (await demander(`${API}/${id}?fields=${CHAMPS}`)).json();
    },

    /** Contenu d'un fichier (Blob). */
    async lire(id) {
      return (await demander(`${API}/${id}?alt=media`)).blob();
    },

    /** Met un fichier ou un dossier à la corbeille de Drive (récupérable 30 jours). */
    async supprimer(id) {
      await demander(`${API}/${id}?fields=id`, { method: 'PATCH', body: JSON.stringify({ trashed: true }), headers: { 'Content-Type': 'application/json' } });
    },
  };
}
