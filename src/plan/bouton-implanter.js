// Bouton « Implanter » posé en bas à droite du plan (0.151.0, demande du 06.11) : quand un point ou
// une ligne (touchée, ou faite de points touchés un à un) est choisi (fiche avec « Implanter », voir leve/ecran.js), le même bouton est montré sur
// le plan, sous le doigt ; il touche le bouton de la fiche (qui reste caché, classe .sur-le-plan).

const SELECTEUR = '[data-action="implanterChoix"].bouton-implanter, [data-action="implanterLigneChoisie"].bouton-implanter, [data-action="implanterPointsLigne"].bouton-implanter';

/** panneau : section .panneau-plan ; ecran : conteneur de Terrain (#leve-direct). */
export function creerBoutonImplanterPlan(panneau, ecran) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton bouton-implanter bouton-implanter-plan';
  bouton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></svg>Implanter';
  bouton.hidden = true;
  panneau.append(bouton);
  bouton.addEventListener('click', () => ecran.querySelector(SELECTEUR)?.click());

  function synchroniser() {
    const original = ecran.querySelector(SELECTEUR);
    if (original && !original.classList.contains('sur-le-plan')) original.classList.add('sur-le-plan');
    if (bouton.hidden !== !original) bouton.hidden = !original;
  }
  new MutationObserver(synchroniser).observe(ecran, { childList: true, subtree: true });
  synchroniser();
  return { synchroniser };
}
