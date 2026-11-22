// Calage de plans (0.281.0) : le calage automatique tourne ici, en arrière-plan (« Web Worker » : un calcul à part
// qui ne fige pas l'écran). Reçoit { segsSource, segsCible, options (échelles, échelle fixée : comparateur de PDF) }, renvoie { resultat } ou { erreur }.
import { calerAutomatiquement } from '../topo/calage-auto.js';

self.addEventListener('message', (ev) => {
  try {
    self.postMessage({ resultat: calerAutomatiquement(ev.data.segsSource, ev.data.segsCible, ev.data.options ?? {}) });
  } catch (erreur) {
    self.postMessage({ erreur: erreur.message });
  }
});
