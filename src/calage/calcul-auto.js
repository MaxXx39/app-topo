// Calage de plans (0.281.0) : lance le calage automatique en arrière-plan (travail-calage.js) et attend sa réponse.
// Sans « Worker » (vieux navigateur, essais), le calcul se fait ici, après avoir laissé l'écran se dessiner.
import { calerAutomatiquement } from '../topo/calage-auto.js';

/** Promesse du résultat de calerAutomatiquement(segsSource, segsCible, options) (null = rien trouvé). */
export function calculerAuto(segsSource, segsCible, options = {}) {
  return new Promise((tenir, rater) => {
    let travail = null;
    try {
      travail = new Worker(new URL('./travail-calage.js', import.meta.url), { type: 'module' });
    } catch (erreur) {
      travail = null;
    }
    if (!travail) {
      setTimeout(() => {
        try {
          tenir(calerAutomatiquement(segsSource, segsCible, options));
        } catch (erreur) {
          rater(erreur);
        }
      }, 30);
      return;
    }
    travail.addEventListener('message', (ev) => {
      travail.terminate();
      if (ev.data.erreur) rater(new Error(ev.data.erreur));
      else tenir(ev.data.resultat);
    });
    travail.addEventListener('error', (ev) => {
      travail.terminate();
      rater(new Error(ev.message || 'calcul en arrière-plan impossible'));
    });
    travail.postMessage({ segsSource, segsCible, options });
  });
}
