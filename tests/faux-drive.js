// Faux Drive pour les tests du partage : mêmes fonctions que src/partage/drive.js, fichiers gardés
// en mémoire (pas un fichier de test : il est importé par partage.test.js et partage-main.test.js).
import { TYPE_DOSSIER } from '../src/partage/drive.js';

/** Faux Drive : mêmes fonctions que partage/drive.js, fichiers gardés en mémoire. */
export function fauxDrive() {
  const fichiers = new Map();
  let numero = 0;
  const ecritures = [];
  const correspond = (f, q) => {
    if (f.trashed) return false;
    const parent = /'([^']+)' in parents/.exec(q);
    if (parent && !(f.parents ?? []).includes(parent[1])) return false;
    const type = /mimeType = '([^']+)'/.exec(q);
    if (type && f.mimeType !== type[1]) return false;
    const propriete = /appProperties has \{ key='([^']+)' and value='([^']+)' \}/.exec(q);
    if (propriete && f.appProperties?.[propriete[1]] !== propriete[2]) return false;
    return true;
  };
  // Réseau coupé (essais) : toute demande échoue tant que panne.active est vrai.
  const panne = { active: false };
  const verifier = () => {
    if (panne.active) throw new Error('Google Drive injoignable (réseau ?)');
  };
  const copie = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, trashed: f.trashed, appProperties: { ...f.appProperties } });
  return {
    fichiers,
    ecritures,
    panne,
    async lister(q) {
      verifier();
      return [...fichiers.values()].filter((f) => correspond(f, q)).map(copie);
    },
    listerDossier(id) {
      return this.lister(`'${id}' in parents`);
    },
    async creerDossier(nom, parentId, proprietes = {}) {
      verifier();
      const f = { id: `d${++numero}`, name: nom, mimeType: TYPE_DOSSIER, parents: parentId ? [parentId] : [], appProperties: { ...proprietes } };
      fichiers.set(f.id, f);
      return copie(f);
    },
    async creerFichier(nom, parentId, contenu) {
      verifier();
      const f = { id: `f${++numero}`, name: nom, mimeType: contenu.type, parents: [parentId], appProperties: {}, contenu };
      fichiers.set(f.id, f);
      ecritures.push(nom);
      return copie(f);
    },
    async ecrireContenu(id, contenu) {
      verifier();
      fichiers.get(id).contenu = contenu;
      ecritures.push(fichiers.get(id).name);
    },
    async modifier(id, { nom, proprietes } = {}) {
      verifier();
      const f = fichiers.get(id);
      if (nom) f.name = nom;
      for (const [cle, valeur] of Object.entries(proprietes ?? {})) {
        if (valeur === null) delete f.appProperties[cle];
        else f.appProperties[cle] = valeur;
      }
      return copie(f);
    },
    async decrire(id) {
      verifier();
      return copie(fichiers.get(id));
    },
    async lire(id) {
      verifier();
      return fichiers.get(id).contenu;
    },
    async supprimer(id) {
      verifier();
      fichiers.get(id).trashed = true;
    },
  };
}

