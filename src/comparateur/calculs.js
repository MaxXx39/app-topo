// Comparer des PDF (0.282.0) : calculs lourds lancés en arrière-plan (détection des zones), avec repli sur place.
import { detecterZones } from '../topo/comparaison-pdf.js';

/** Promesse des zones modifiées (voir detecterZones). */
export function detecterEnArrierePlan(encreA, encreB, w, h, options) {
  return new Promise((tenir, rater) => {
    let travail = null;
    try {
      travail = new Worker(new URL('./travail-diff.js', import.meta.url), { type: 'module' });
    } catch {
      travail = null;
    }
    if (!travail) {
      setTimeout(() => {
        try {
          tenir(detecterZones(encreA, encreB, w, h, options));
        } catch (erreur) {
          rater(erreur);
        }
      }, 30);
      return;
    }
    travail.addEventListener('message', (ev) => {
      travail.terminate();
      if (ev.data.erreur) rater(new Error(ev.data.erreur));
      else tenir(ev.data.zones);
    });
    travail.addEventListener('error', (ev) => {
      travail.terminate();
      rater(new Error(ev.message || 'calcul en arrière-plan impossible'));
    });
    travail.postMessage({ encreA, encreB, w, h, options }, [encreA.buffer, encreB.buffer]);
  });
}
