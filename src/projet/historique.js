// Historique des modifications du projet, pour « Annuler » et « Rétablir ».
//
// Après chaque modification, on garde une copie du projet (sous forme de texte JSON).
// Annuler revient à la copie précédente ; Rétablir refait ce qui vient d'être annulé.
// L'historique est remis à zéro quand on ouvre un autre projet.

/** Nombre de retours en arrière possibles, par défaut. */
const LIMITE = 50;

/** Crée un historique vide. */
export function creerHistorique(limite = LIMITE) {
  return { passe: [], futur: [], actuel: null, limite };
}

/** Copie du projet sous forme de texte. La date d'enregistrement est ignorée (ce n'est pas une modification). */
function instantane(projet) {
  return JSON.stringify({ ...projet, modifieLe: null });
}

/** Repart de zéro avec ce projet (à l'ouverture d'un projet). */
export function reinitialiser(historique, projet) {
  historique.passe = [];
  historique.futur = [];
  historique.actuel = instantane(projet);
}

/**
 * À appeler après une modification. Si le projet a vraiment changé, l'état d'avant
 * devient annulable et ce qui avait été annulé ne peut plus être rétabli.
 * Renvoie vrai si une étape a été ajoutée.
 */
export function memoriser(historique, projet) {
  const nouveau = instantane(projet);
  if (nouveau === historique.actuel) return false;
  if (historique.actuel !== null) {
    historique.passe.push(historique.actuel);
    if (historique.passe.length > historique.limite) historique.passe.shift();
  }
  historique.futur = [];
  historique.actuel = nouveau;
  return true;
}

export const peutAnnuler = (historique) => historique.passe.length > 0;
export const peutRetablir = (historique) => historique.futur.length > 0;

/** Revient à l'état précédent. Renvoie le projet de cet état (nouvel objet), ou null s'il n'y en a pas. */
export function annuler(historique) {
  if (!peutAnnuler(historique)) return null;
  historique.futur.push(historique.actuel);
  historique.actuel = historique.passe.pop();
  return JSON.parse(historique.actuel);
}

/** Refait la dernière modification annulée. Renvoie le projet, ou null s'il n'y a rien à rétablir. */
export function retablir(historique) {
  if (!peutRetablir(historique)) return null;
  historique.passe.push(historique.actuel);
  historique.actuel = historique.futur.pop();
  return JSON.parse(historique.actuel);
}
