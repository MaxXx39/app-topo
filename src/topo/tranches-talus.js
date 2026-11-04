// Tranches d'un talus de plateforme (0.122.0), pour le dessiner sur le plan : une tranche par côté de la
// plateforme et par nature (remblai ou déblai). Chaque tranche donne le haut et le bas du talus (de
// quoi tracer les barbules, qui partent du haut vers le bas) et la pente à écrire dedans.
// Entrée : le résultat de talusDePlateforme (bord, entree) et les pentes { remblai, deblai }.

/** Pente écrite « H/V » (3/2, 1/1, 5/4…). */
export function texteDePente({ horizontal, vertical }) {
  const arrondi = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  return `${arrondi(horizontal)}/${arrondi(vertical)}`;
}

/**
 * Tranches : [{ nature, pente, haut: [{ est, nord }], bas: [{ est, nord }], milieu: { est, nord } }].
 * Remblai : la plateforme est en haut (haut = bord, bas = entrée en terre) ; déblai : l'inverse.
 * Une nouvelle tranche commence à chaque sommet de la plateforme et à chaque changement de nature.
 * Les tranches d'un seul point sont ignorées.
 */
export function tranchesDeTalus(talus, pentes) {
  if (!talus || talus.erreur || !talus.bord?.length) return [];
  const tranches = [];
  let courante = null;
  talus.bord.forEach((point, i) => {
    const entree = talus.entree[i];
    if (!entree) return;
    if (!courante || point.sommet != null || point.nature !== courante.nature) {
      courante = { nature: point.nature, bords: [], entrees: [] };
      tranches.push(courante);
    }
    courante.bords.push(point);
    courante.entrees.push(entree);
  });
  return tranches
    .filter((t) => t.bords.length >= 2)
    .map((t) => {
      const [haut, bas] = t.nature === 'remblai' ? [t.bords, t.entrees] : [t.entrees, t.bords];
      const m = Math.floor(t.bords.length / 2);
      const milieu = { est: (haut[m].est + bas[m].est) / 2, nord: (haut[m].nord + bas[m].nord) / 2 };
      const simple = ({ est, nord }) => ({ est, nord });
      return { nature: t.nature, pente: pentes?.[t.nature] ? texteDePente(pentes[t.nature]) : '', haut: haut.map(simple), bas: bas.map(simple), milieu };
    });
}
