// Où regarde-t-on ? Orientation (azimut, °) pour la flèche du plan et les coupes en direct.
// Deux sources possibles, choisies par l'utilisateur dans l'onglet Terrain :
// - 'rx2' : le « cap » envoyé par le RX2 (message ETC, champ 4), seulement quand l'inclinaison
//   est prête ; sens exact encore à confirmer sur le terrain. Sans cap, on prend la direction de marche.
// - 'marche' : la direction de marche, calculée avec les dernières positions (il faut avancer).
// La dernière orientation connue est gardée quelques secondes (arrêt bref, cap qui manque).
import { directionDeMarche } from '../topo/implantation.js';

// Durée pendant laquelle on garde les positions pour la direction de marche, et la dernière
// orientation connue (ms).
const DUREE_HISTORIQUE = 10000;
const DUREE_GARDEE = 10000;

/** Crée le suivi de l'orientation. Renvoie { ajouter(etat, temps), changerSource(source), source }. */
export function creerSuiviOrientation(source = 'rx2') {
  const historique = [];
  let derniere = null; // { azimut, source, temps }

  return {
    get source() {
      return source;
    },
    changerSource(nouvelle) {
      source = nouvelle === 'marche' ? 'marche' : 'rx2';
      derniere = null;
    },
    /**
     * Nouvel état du récepteur (voir android/pont.js) reçu à "temps" (ms).
     * Renvoie { azimut (° ou null), source ('rx2', 'marche' ou null), cap, marche } : cap et marche
     * sont les deux valeurs brutes (°, ou null), affichées pour contrôler le cap sur le terrain.
     */
    ajouter(etat, temps) {
      const position = etat?.connecte && etat.recu ? etat.position : null;
      if (position) historique.push({ est: position.est, nord: position.nord, temps });
      while (historique.length > 0 && temps - historique[0].temps > DUREE_HISTORIQUE) historique.shift();
      const cap = etat?.inclinaisonPrete && typeof etat.cap === 'number' ? etat.cap : null;
      const marche = directionDeMarche(historique);

      let actuelle = null;
      if (source === 'rx2' && cap != null) actuelle = { azimut: cap, source: 'rx2' };
      else if (marche != null) actuelle = { azimut: marche, source: 'marche' };
      if (actuelle) derniere = { ...actuelle, temps };
      else if (derniere && temps - derniere.temps <= DUREE_GARDEE) actuelle = derniere;
      else derniere = null;
      return { azimut: actuelle?.azimut ?? null, source: actuelle?.source ?? null, cap, marche };
    },
  };
}
