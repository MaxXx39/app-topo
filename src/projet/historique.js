// Historique des modifications du projet, pour « Annuler » et « Rétablir ».
//
// Après chaque modification, on garde une copie du projet (sous forme de texte JSON).
// Annuler revient à la copie précédente ; Rétablir refait ce qui vient d'être annulé.
// L'historique est remis à zéro quand on ouvre un autre projet.
// Les photos sont lourdes : elles ne sont pas recopiées à chaque étape. On les garde une seule
// fois (par leur identifiant) et on les remet en place quand on revient à une étape.

/** Nombre de retours en arrière possibles, par défaut. */
const LIMITE = 50;

/** Crée un historique vide. */
export function creerHistorique(limite = LIMITE) {
  return { passe: [], futur: [], actuel: null, limite, photos: new Map() };
}

/**
 * Copie du projet sous forme de texte. La date d'enregistrement est ignorée (ce n'est pas une
 * modification) ; les images des photos sont remplacées par leur identifiant et gardées à part.
 */
function instantane(historique, projet) {
  const surfaces = (projet.surfaces ?? []).map((surface) =>
    surface.photos?.length
      ? {
          ...surface,
          photos: surface.photos.map((photo) => {
            historique.photos.set(photo.id, { image: photo.image, miniature: photo.miniature });
            return { ...photo, image: null, miniature: null };
          }),
        }
      : surface,
  );
  return JSON.stringify({ ...projet, surfaces, modifieLe: null });
}

/** Relit une étape de l'historique et remet les images des photos. */
function relire(historique, texte) {
  const projet = JSON.parse(texte);
  for (const surface of projet.surfaces ?? []) {
    for (const photo of surface.photos ?? []) Object.assign(photo, historique.photos.get(photo.id));
  }
  return projet;
}

/** Repart de zéro avec ce projet (à l'ouverture d'un projet). */
export function reinitialiser(historique, projet) {
  historique.passe = [];
  historique.futur = [];
  historique.photos.clear();
  historique.actuel = instantane(historique, projet);
}

/**
 * À appeler après une modification. Si le projet a vraiment changé, l'état d'avant
 * devient annulable et ce qui avait été annulé ne peut plus être rétabli.
 * Renvoie vrai si une étape a été ajoutée.
 */
export function memoriser(historique, projet) {
  const nouveau = instantane(historique, projet);
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
  return relire(historique, historique.actuel);
}

/** Refait la dernière modification annulée. Renvoie le projet, ou null s'il n'y a rien à rétablir. */
export function retablir(historique) {
  if (!peutRetablir(historique)) return null;
  historique.passe.push(historique.actuel);
  historique.actuel = historique.futur.pop();
  return relire(historique, historique.actuel);
}
