// Comparer des PDF (0.282.0) : détection des zones modifiées en arrière-plan (Web Worker : l'écran ne se fige pas).
// Reçoit { encreA, encreB, w, h, options } (masques d'encre), renvoie { zones } ou { erreur }.
import { detecterZones } from '../topo/comparaison-pdf.js';

self.addEventListener('message', (ev) => {
  try {
    const { encreA, encreB, w, h, options } = ev.data;
    self.postMessage({ zones: detecterZones(encreA, encreB, w, h, options) });
  } catch (erreur) {
    self.postMessage({ erreur: erreur.message });
  }
});
