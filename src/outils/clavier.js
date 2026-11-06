// Clavier de la tablette (0.151.0, demande du 06.11) : quand le clavier s'ouvre, l'écran devient bas
// et la bande fixe de Lever (photo, ID point, Enreg. Pts) et la barre du bas cachaient le champ
// qu'on tape (ex. delta). Clavier ouvert = classe body.clavier-ouvert : la barre du bas se cache,
// la bande de Lever reprend sa place dans le cadre, et le champ touché est ramené au milieu.
//
// Clavier ouvert = un champ de texte a la main ET la hauteur de la fenêtre a baissé d'au moins
// 20 % par rapport à la plus grande hauteur vue (pour la même largeur : le clavier ne change pas la
// largeur, tourner la tablette oui).

const BAISSE_MIN = 0.8;

function estChampTexte(element) {
  if (!element) return false;
  if (element.tagName === 'TEXTAREA') return true;
  if (element.tagName !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(element.type);
}

/** Hauteur visible de la fenêtre (la partie au-dessus du clavier). */
function hauteurVisible() {
  return window.visualViewport?.height ?? window.innerHeight;
}

export function suivreClavier() {
  let hauteurMax = hauteurVisible();
  let largeur = window.innerWidth;

  function verifier() {
    if (window.innerWidth !== largeur) {
      // Tablette tournée : on repart de la hauteur actuelle.
      largeur = window.innerWidth;
      hauteurMax = hauteurVisible();
    }
    const champ = document.activeElement;
    const hauteur = hauteurVisible();
    if (!estChampTexte(champ)) hauteurMax = Math.max(hauteurMax, hauteur);
    const ouvert = estChampTexte(champ) && hauteur < hauteurMax * BAISSE_MIN;
    const avant = document.body.classList.contains('clavier-ouvert');
    document.body.classList.toggle('clavier-ouvert', ouvert);
    if (ouvert && !avant) {
      // Le champ tapé revient au milieu de ce qui reste visible.
      requestAnimationFrame(() => champ.scrollIntoView({ block: 'center', behavior: 'auto' }));
    }
  }

  window.visualViewport?.addEventListener('resize', verifier);
  window.addEventListener('resize', verifier);
  document.addEventListener('focusin', () => setTimeout(verifier, 350));
  document.addEventListener('focusout', () => setTimeout(verifier, 50));
  return { verifier };
}
